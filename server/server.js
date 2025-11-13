// server.js - Main server file for the Socket.io chat application

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const Sentry = require('@sentry/node');
const dotenv = require('dotenv');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

dotenv.config();

// Initialize Sentry if DSN is provided (optional)
if (process.env.SENTRY_DSN) {
  try {
    Sentry.init({ dsn: process.env.SENTRY_DSN, environment: process.env.NODE_ENV || 'development' });
    console.log('Sentry initialized');
  } catch (err) {
    console.warn('Failed to initialize Sentry:', err.message || err);
  }
}

const DEFAULT_ROOMS = [
  {
    id: 'general',
    name: 'General',
    description: 'Welcome to the main lobby. Say hi 👋',
  },
  {
    id: 'random',
    name: 'Random',
    description: 'Anything goes. Share memes, links, and fun stuff.',
  },
];

const MAX_ROOM_MESSAGES = 250;
const MAX_PRIVATE_MESSAGES = 250;
const TYPING_TIMEOUT_MS = 4000;

const parseOrigins = (value) =>
  value
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

const allowedOrigins = parseOrigins(process.env.CLIENT_URL || 'http://localhost:5173');

const app = express();
// Attach Sentry request handler early so it can capture requests
if (process.env.SENTRY_DSN) {
  app.use(Sentry.Handlers.requestHandler());
}
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
  })
);
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const users = new Map();
const usernameToSocketId = new Map();
const rooms = new Map();
const privateThreads = new Map();
const typingTimers = new Map();

const normalizeRoomId = (value) =>
  value.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || `room-${uuidv4()}`;

const createRoom = (name, options = {}) => {
  const roomId = options.id || normalizeRoomId(name);

  if (rooms.has(roomId)) {
    return rooms.get(roomId);
  }

  const now = new Date().toISOString();
  const room = {
    id: roomId,
    name: options.name || name,
    description: options.description || '',
    createdAt: now,
    createdBy: options.createdBy || 'system',
    messages: [],
    members: new Set(),
    typing: new Set(),
  };

  rooms.set(roomId, room);
  return room;
};

DEFAULT_ROOMS.forEach((room) => createRoom(room.name, room));

const makeThreadKey = (a, b) => [a, b].sort((x, y) => x.localeCompare(y)).join('::');

const ensurePrivateThread = (userA, userB) => {
  const key = makeThreadKey(userA, userB);

  if (!privateThreads.has(key)) {
    privateThreads.set(key, {
      id: key,
      participants: [userA, userB],
      messages: [],
      createdAt: new Date().toISOString(),
    });
  }

  return privateThreads.get(key);
};

const setWith = (collection, key, valueFactory) => {
  if (!collection.has(key)) {
    collection.set(key, valueFactory());
  }

  return collection.get(key);
};

const serializeReactions = (reactionMap) => {
  const output = {};

  if (!reactionMap) {
    return output;
  }

  reactionMap.forEach((userSet, emoji) => {
    output[emoji] = Array.from(userSet);
  });

  return output;
};

const serializeMessage = (message) => ({
  id: message.id,
  roomId: message.roomId,
  sender: message.sender,
  senderId: message.senderId,
  body: message.body,
  timestamp: message.timestamp,
  attachments: message.attachments || [],
  isSystem: Boolean(message.isSystem),
  isPrivate: Boolean(message.isPrivate),
  reactions: serializeReactions(message.reactions),
  deliveredTo: Array.from(message.deliveredTo || []),
  readBy: Array.from(message.readBy || []),
  tempId: message.tempId || null,
});

const serializeRoom = (room, { limit = 30 } = {}) => {
  const messages = room.messages.slice(-limit).map(serializeMessage);

  return {
    id: room.id,
    name: room.name,
    description: room.description,
    createdAt: room.createdAt,
    createdBy: room.createdBy,
    memberCount: room.members.size,
    hasMore: room.messages.length > messages.length,
    messages,
  };
};

const serializeThread = (thread, viewer) => {
  const messages = thread.messages.slice(-30).map(serializeMessage);
  const counterpart = thread.participants.find((participant) => participant !== viewer) || null;

  return {
    id: thread.id,
    participants: thread.participants,
    counterpart,
    createdAt: thread.createdAt,
    hasMore: thread.messages.length > messages.length,
    messages,
  };
};

const getPublicUsers = () =>
  Array.from(users.values()).map((user) => ({
    id: user.id,
    username: user.username,
    status: user.status,
    activeRoom: user.activeRoom,
    rooms: Array.from(user.rooms),
    lastSeen: user.lastSeen,
  }));

const emitUserList = () => {
  io.emit('user_list', getPublicUsers());
};

const emitRoomList = () => {
  io.emit(
    'room_list',
    Array.from(rooms.values()).map((room) => ({
      id: room.id,
      name: room.name,
      description: room.description,
      memberCount: room.members.size,
    }))
  );
};

const trimMessages = (collection, max) => {
  if (collection.length > max) {
    collection.splice(0, collection.length - max);
  }
};

const addMessageToRoom = (room, message) => {
  room.messages.push(message);
  trimMessages(room.messages, MAX_ROOM_MESSAGES);
};

const addMessageToThread = (thread, message) => {
  thread.messages.push(message);
  trimMessages(thread.messages, MAX_PRIVATE_MESSAGES);
};

const registerDelivered = (message, username) => {
  if (!message.deliveredTo) {
    message.deliveredTo = new Set();
  }

  message.deliveredTo.add(username);
};

const registerRead = (message, username) => {
  if (!message.readBy) {
    message.readBy = new Set();
  }

  message.readBy.add(username);
};

const toggleReaction = (message, emoji, username) => {
  message.reactions = message.reactions || new Map();
  const userSet = setWith(message.reactions, emoji, () => new Set());

  if (userSet.has(username)) {
    userSet.delete(username);
    if (userSet.size === 0) {
      message.reactions.delete(emoji);
    }
  } else {
    userSet.add(username);
  }
};

const buildMessage = ({ roomId, sender, body, attachments = [], isSystem = false, isPrivate = false, tempId }) => {
  const now = new Date().toISOString();

  return {
    id: uuidv4(),
    roomId,
    sender: sender.username,
    senderId: sender.id,
    body,
    timestamp: now,
    attachments,
    isSystem,
    isPrivate,
    reactions: new Map(),
    deliveredTo: new Set([sender.username]),
    readBy: new Set(isSystem ? [] : [sender.username]),
    tempId: tempId || null,
  };
};

const addSystemMessage = (roomId, text) => {
  const room = rooms.get(roomId);

  if (!room) {
    return;
  }

  const systemSender = { id: 'system', username: 'System' };
  const message = buildMessage({
    roomId,
    sender: systemSender,
    body: text,
    isSystem: true,
  });

  addMessageToRoom(room, message);
  io.to(roomId).emit('receive_message', serializeMessage(message));
};

const listUserThreads = (username) =>
  Array.from(privateThreads.values())
    .filter((thread) => thread.participants.includes(username))
    .map((thread) => serializeThread(thread, username));

app.get('/api/rooms', (req, res) => {
  const payload = Array.from(rooms.values()).map((room) => ({
    id: room.id,
    name: room.name,
    description: room.description,
    memberCount: room.members.size,
    createdAt: room.createdAt,
  }));

  res.json(payload);
});

app.get('/api/rooms/:roomId/messages', (req, res) => {
  const { roomId } = req.params;
  const { before, limit = 30 } = req.query;
  const room = rooms.get(roomId);

  if (!room) {
    res.status(404).json({ error: 'Room not found' });
    return;
  }

  const parsedLimit = Math.min(Number(limit) || 30, 100);
  const beforeIndex = before ? room.messages.findIndex((message) => message.id === before) : -1;

  const endIndex = beforeIndex === -1 ? room.messages.length : beforeIndex;
  const startIndex = Math.max(0, endIndex - parsedLimit);
  const slice = room.messages.slice(startIndex, endIndex).map(serializeMessage);
  const hasMore = startIndex > 0;
  const nextCursor = hasMore ? room.messages[startIndex - 1]?.id || null : null;

  res.json({
    roomId,
    messages: slice,
    hasMore,
    nextCursor,
  });
});

app.get('/api/search', (req, res) => {
  const { roomId, q } = req.query;

  if (!q) {
    res.json([]);
    return;
  }

  const targetRooms = roomId ? [rooms.get(roomId)] : Array.from(rooms.values());
  const term = q.toLowerCase();
  const results = [];

  targetRooms.forEach((room) => {
    if (!room) {
      return;
    }

    room.messages.forEach((message) => {
      if (message.body.toLowerCase().includes(term)) {
        results.push({
          roomId: room.id,
          roomName: room.name,
          message: serializeMessage(message),
        });
      }
    });
  });

  res.json(results.slice(-100));
});

app.get('/api/users', (req, res) => {
  res.json(getPublicUsers());
});

app.get('/', (req, res) => {
  res.send('Socket.io Chat Server is running');
});

// Health endpoint for uptime checks / monitoring
app.get('/health', (req, res) => {
  res.json({ status: 'ok', uptime: process.uptime(), now: new Date().toISOString() });
});


io.on('connection', (socket) => {
  socket.on('user_join', (payload, ack) => {
    const rawUsername = typeof payload === 'string' ? payload : payload?.username;
    const username = rawUsername ? rawUsername.trim() : '';

    if (!username) {
      ack?.({ ok: false, error: 'Username is required' });
      return;
    }

    if (usernameToSocketId.has(username)) {
      ack?.({ ok: false, error: 'That username is already in use' });
      return;
    }

    const now = new Date().toISOString();
    const userRecord = {
      id: socket.id,
      username,
      status: 'online',
      activeRoom: 'general',
      rooms: new Set(),
      lastSeen: now,
    };

    users.set(socket.id, userRecord);
    usernameToSocketId.set(username, socket.id);

    const defaultRoom = rooms.get('general') || createRoom('General', { id: 'general' });
    userRecord.rooms.add(defaultRoom.id);
    socket.join(defaultRoom.id);
    defaultRoom.members.add(socket.id);

    const initialRooms = Array.from(userRecord.rooms).map((roomId) => serializeRoom(rooms.get(roomId)));
    const initialThreads = listUserThreads(username);

    socket.emit('initial_state', {
      rooms: initialRooms,
      threads: initialThreads,
      activeRoom: userRecord.activeRoom,
      users: getPublicUsers(),
    });

    emitUserList();
    emitRoomList();
    io.emit('user_joined', { username, id: socket.id, joinedAt: now });
    addSystemMessage(defaultRoom.id, `${username} joined the chat`);

    ack?.({ ok: true, activeRoom: userRecord.activeRoom });
  });

  socket.on('join_room', (payload, ack) => {
    const { roomId: requestedRoom, roomName, description } = payload || {};
    const user = users.get(socket.id);

    if (!user) {
      ack?.({ ok: false, error: 'Not authenticated' });
      return;
    }

    const targetName = requestedRoom || roomName;

    if (!targetName) {
      ack?.({ ok: false, error: 'Room name is required' });
      return;
    }

    const room = createRoom(targetName, { id: requestedRoom, name: roomName, description, createdBy: user.username });

    if (!user.rooms.has(room.id)) {
      user.rooms.add(room.id);
      room.members.add(socket.id);
      socket.join(room.id);
      addSystemMessage(room.id, `${user.username} joined ${room.name}`);
    }

    user.activeRoom = room.id;

    const payloadRoom = serializeRoom(room);
    socket.emit('room_joined', payloadRoom);
    socket.to(room.id).emit('room_user_joined', {
      roomId: room.id,
      user: {
        id: user.id,
        username: user.username,
      },
    });

    emitRoomList();
    ack?.({ ok: true, roomId: room.id, room: payloadRoom });
  });

  socket.on('leave_room', ({ roomId }, ack) => {
    const user = users.get(socket.id);
    const room = rooms.get(roomId);

    if (!user || !room) {
      ack?.({ ok: false, error: 'Unable to leave room' });
      return;
    }

    user.rooms.delete(room.id);
    room.members.delete(socket.id);
    socket.leave(room.id);
    addSystemMessage(room.id, `${user.username} left ${room.name}`);

    if (user.activeRoom === room.id) {
      user.activeRoom = 'general';
      socket.emit('active_room_changed', { roomId: user.activeRoom });
    }

    socket.to(room.id).emit('room_user_left', {
      roomId: room.id,
      user: {
        id: user.id,
        username: user.username,
      },
    });

    emitRoomList();
    ack?.({ ok: true });
  });

  socket.on('send_message', (payload, ack) => {
    const { roomId, message, attachments = [], tempId } = payload || {};
    const user = users.get(socket.id);
    const trimmed = message ? String(message).trim() : '';

    if (!user) {
      ack?.({ ok: false, error: 'Not authenticated' });
      return;
    }

    if (!roomId) {
      ack?.({ ok: false, error: 'Room is required' });
      return;
    }

    if (!trimmed) {
      ack?.({ ok: false, error: 'Message cannot be empty' });
      return;
    }

    const room = rooms.get(roomId);

    if (!room) {
      ack?.({ ok: false, error: 'Room not found' });
      return;
    }

    const messageRecord = buildMessage({
      roomId,
      sender: user,
      body: trimmed,
      attachments,
      tempId: tempId || null,
    });

    addMessageToRoom(room, messageRecord);
    io.to(roomId).emit('receive_message', serializeMessage(messageRecord));

    ack?.({ ok: true, messageId: messageRecord.id });
  });

  socket.on('message_delivered', ({ messageId, roomId }) => {
    const user = users.get(socket.id);
    const room = rooms.get(roomId);

    if (!user || !room) {
      return;
    }

    const message = room.messages.find((item) => item.id === messageId);

    if (!message) {
      return;
    }

    registerDelivered(message, user.username);
    io.to(roomId).emit('message_delivery_update', {
      roomId,
      messageId,
      deliveredTo: Array.from(message.deliveredTo || []),
    });
  });

  socket.on('message_read', ({ messageId, roomId }) => {
    const user = users.get(socket.id);
    const room = rooms.get(roomId);

    if (!user || !room) {
      return;
    }

    const message = room.messages.find((item) => item.id === messageId);

    if (!message) {
      return;
    }

    registerRead(message, user.username);
    io.to(roomId).emit('message_read_update', {
      roomId,
      messageId,
      readBy: Array.from(message.readBy || []),
    });
  });

  socket.on('react_to_message', ({ roomId, messageId, emoji }) => {
    const user = users.get(socket.id);
    const room = rooms.get(roomId);

    if (!user || !room) {
      return;
    }

    const message = room.messages.find((item) => item.id === messageId);

    if (!message) {
      return;
    }

    toggleReaction(message, emoji, user.username);
    io.to(roomId).emit('message_reaction_update', {
      roomId,
      messageId,
      reactions: serializeReactions(message.reactions),
    });
  });

  socket.on('typing', ({ roomId, isTyping }) => {
    const user = users.get(socket.id);
    const room = rooms.get(roomId);

    if (!user || !room) {
      return;
    }

    if (isTyping) {
      room.typing.add(user.username);
      io.to(roomId).emit('typing_users', {
        roomId,
        users: Array.from(room.typing),
      });

      const key = `${socket.id}:${roomId}`;
      clearTimeout(typingTimers.get(key));
      const timer = setTimeout(() => {
        room.typing.delete(user.username);
        typingTimers.delete(key);
        io.to(roomId).emit('typing_users', {
          roomId,
          users: Array.from(room.typing),
        });
      }, TYPING_TIMEOUT_MS);

      typingTimers.set(key, timer);
    } else {
      const key = `${socket.id}:${roomId}`;
      room.typing.delete(user.username);
      clearTimeout(typingTimers.get(key));
      typingTimers.delete(key);
      io.to(roomId).emit('typing_users', {
        roomId,
        users: Array.from(room.typing),
      });
    }
  });

  socket.on('request_room_history', ({ roomId, before, limit = 30 }, ack) => {
    const user = users.get(socket.id);
    const room = rooms.get(roomId);

    if (!user || !room) {
      ack?.({ ok: false, error: 'Room not found' });
      return;
    }

    const parsedLimit = Math.min(Number(limit) || 30, 100);
    const beforeIndex = before ? room.messages.findIndex((message) => message.id === before) : -1;
    const endIndex = beforeIndex === -1 ? room.messages.length : beforeIndex;
    const startIndex = Math.max(0, endIndex - parsedLimit);
    const slice = room.messages.slice(startIndex, endIndex).map(serializeMessage);
    const hasMore = startIndex > 0;
    const nextCursor = hasMore ? room.messages[startIndex - 1]?.id || null : null;

    ack?.({
      ok: true,
      roomId,
      messages: slice,
      nextCursor,
      hasMore,
    });
  });

  socket.on('private_message', (payload, ack) => {
    const { to, message, tempId } = payload || {};
    const user = users.get(socket.id);
    const trimmed = message ? String(message).trim() : '';

    if (!user) {
      ack?.({ ok: false, error: 'Not authenticated' });
      return;
    }

    if (!to) {
      ack?.({ ok: false, error: 'Recipient is required' });
      return;
    }

    if (!trimmed) {
      ack?.({ ok: false, error: 'Message cannot be empty' });
      return;
    }

    const recipientSocketId = usernameToSocketId.get(to);
    const recipientUser = recipientSocketId ? users.get(recipientSocketId) : null;

    if (!recipientUser) {
      ack?.({ ok: false, error: 'Recipient is offline' });
      return;
    }

    const thread = ensurePrivateThread(user.username, recipientUser.username);
    const messageRecord = buildMessage({
      roomId: thread.id,
      sender: user,
      body: trimmed,
      isPrivate: true,
      tempId: tempId || null,
    });

    addMessageToThread(thread, messageRecord);
    registerDelivered(messageRecord, recipientUser.username);

    const serialized = serializeMessage(messageRecord);

    socket.emit('private_message', {
      thread: serializeThread(thread, user.username),
      message: serialized,
    });

    io.to(recipientSocketId).emit('private_message', {
      thread: serializeThread(thread, recipientUser.username),
      message: serialized,
    });

    io.to(recipientSocketId).emit('private_notification', {
      from: user.username,
      threadId: thread.id,
    });

    ack?.({ ok: true, messageId: messageRecord.id, threadId: thread.id });
  });

  socket.on('private_typing', ({ to, isTyping }) => {
    const user = users.get(socket.id);
    const recipientSocketId = usernameToSocketId.get(to);

    if (!user || !recipientSocketId) {
      return;
    }

    io.to(recipientSocketId).emit('private_typing', {
      from: user.username,
      isTyping: Boolean(isTyping),
    });
  });

  socket.on('private_message_read', ({ threadId, messageId }) => {
    const user = users.get(socket.id);
    const thread = privateThreads.get(threadId);

    if (!user || !thread) {
      return;
    }

    const message = thread.messages.find((item) => item.id === messageId);

    if (!message) {
      return;
    }

    registerRead(message, user.username);

    thread.participants.forEach((participant) => {
      const targetSocket = usernameToSocketId.get(participant);

      if (targetSocket) {
        io.to(targetSocket).emit('private_read_receipt', {
          threadId,
          messageId,
          readBy: Array.from(message.readBy || []),
        });
      }
    });
  });

  socket.on('react_to_private_message', ({ threadId, messageId, emoji }) => {
    const user = users.get(socket.id);
    const thread = privateThreads.get(threadId);

    if (!user || !thread) {
      return;
    }

    const message = thread.messages.find((item) => item.id === messageId);

    if (!message) {
      return;
    }

    toggleReaction(message, emoji, user.username);

    thread.participants.forEach((participant) => {
      const targetSocket = usernameToSocketId.get(participant);

      if (targetSocket) {
        io.to(targetSocket).emit('private_reaction_update', {
          threadId,
          messageId,
          reactions: serializeReactions(message.reactions),
        });
      }
    });
  });

  socket.on('set_active_room', ({ roomId }) => {
    const user = users.get(socket.id);
    const room = rooms.get(roomId);

    if (!user || !room) {
      return;
    }

    user.activeRoom = roomId;
    user.lastSeen = new Date().toISOString();
  });

  socket.on('disconnect', () => {
    const user = users.get(socket.id);

    if (!user) {
      return;
    }

    const username = user.username;

    user.rooms.forEach((roomId) => {
      const room = rooms.get(roomId);

      if (room) {
        room.members.delete(socket.id);
        room.typing.delete(username);
        addSystemMessage(room.id, `${username} left the room`);
        io.to(room.id).emit('typing_users', {
          roomId: room.id,
          users: Array.from(room.typing),
        });
      }
    });

    users.delete(socket.id);
    usernameToSocketId.delete(username);

    Array.from(typingTimers.entries()).forEach(([key, timer]) => {
      if (key.startsWith(`${socket.id}:`)) {
        clearTimeout(timer);
        typingTimers.delete(key);
      }
    });

    emitUserList();
    emitRoomList();
    io.emit('user_left', { username, id: socket.id, leftAt: new Date().toISOString() });
  });
});

const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

module.exports = { app, server, io };

// Attach Sentry error handler (if enabled) and a generic error handler
if (process.env.SENTRY_DSN) {
  // Sentry's error handler must be added after all routes
  app.use(Sentry.Handlers.errorHandler());
}

// Generic error handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err && (err.stack || err.message || err));
  if (!res.headersSent) {
    res.status(500).json({ error: 'Internal Server Error' });
  }
});
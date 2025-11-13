import { createContext, useContext, useEffect, useMemo, useReducer, useRef } from 'react';
import dayjs from 'dayjs';
import { socket } from '../socket/socket';
import { makeThreadId, sortMessages } from '../utils/chatHelpers';
import {
  loadActiveConversation,
  loadUsername,
  saveActiveConversation,
  saveUsername,
} from '../utils/storage';

const defaultConversation = { type: 'room', id: 'general' };

const initialState = {
  user: null,
  isConnected: false,
  isConnecting: false,
  rooms: {},
  roomOrder: [],
  threads: {},
  threadOrder: [],
  activeConversation: loadActiveConversation() || defaultConversation,
  users: [],
  typingByRoom: {},
  typingByThread: {},
  unreadRooms: {},
  unreadThreads: {},
  searchResults: [],
  toasts: [],
};

const Actions = {
  SET_CONNECTING: 'SET_CONNECTING',
  SET_CONNECTED: 'SET_CONNECTED',
  SET_USER: 'SET_USER',
  RESET_SESSION: 'RESET_SESSION',
  SET_INITIAL_STATE: 'SET_INITIAL_STATE',
  UPSERT_ROOM: 'UPSERT_ROOM',
  UPSERT_THREAD: 'UPSERT_THREAD',
  APPEND_ROOM_MESSAGE: 'APPEND_ROOM_MESSAGE',
  UPDATE_ROOM_MESSAGE: 'UPDATE_ROOM_MESSAGE',
  APPEND_THREAD_MESSAGE: 'APPEND_THREAD_MESSAGE',
  UPDATE_THREAD_MESSAGE: 'UPDATE_THREAD_MESSAGE',
  SET_ACTIVE_CONVERSATION: 'SET_ACTIVE_CONVERSATION',
  SET_USERS: 'SET_USERS',
  SET_TYPING_ROOM: 'SET_TYPING_ROOM',
  SET_TYPING_THREAD: 'SET_TYPING_THREAD',
  INCREMENT_UNREAD_ROOM: 'INCREMENT_UNREAD_ROOM',
  RESET_UNREAD_ROOM: 'RESET_UNREAD_ROOM',
  INCREMENT_UNREAD_THREAD: 'INCREMENT_UNREAD_THREAD',
  RESET_UNREAD_THREAD: 'RESET_UNREAD_THREAD',
  SET_SEARCH_RESULTS: 'SET_SEARCH_RESULTS',
  ADD_TOAST: 'ADD_TOAST',
  REMOVE_TOAST: 'REMOVE_TOAST',
};

const ensureRoomState = (room) => ({
  id: room.id,
  name: room.name,
  description: room.description,
  createdAt: room.createdAt,
  createdBy: room.createdBy,
  memberCount: room.memberCount ?? 0,
  hasMore: Boolean(room.hasMore),
  nextCursor: room.nextCursor || null,
  messages: sortMessages(room.messages || []),
});

const ensureThreadState = (thread) => ({
  id: thread.id,
  participants: thread.participants,
  counterpart: thread.counterpart,
  createdAt: thread.createdAt,
  hasMore: Boolean(thread.hasMore),
  messages: sortMessages(thread.messages || []),
});

const reducer = (state, action) => {
  switch (action.type) {
    case Actions.SET_CONNECTING:
      return { ...state, isConnecting: action.payload };
    case Actions.SET_CONNECTED:
      return { ...state, isConnected: action.payload };
    case Actions.SET_USER:
      return { ...state, user: action.payload };
    case Actions.RESET_SESSION:
      return {
        ...initialState,
        activeConversation: defaultConversation,
      };
    case Actions.SET_INITIAL_STATE: {
      const rooms = {};
      const roomOrder = [];
      (action.payload.rooms || []).forEach((room) => {
        rooms[room.id] = ensureRoomState(room);
        if (!roomOrder.includes(room.id)) {
          roomOrder.push(room.id);
        }
      });

      const threads = {};
      const threadOrder = [];
      (action.payload.threads || []).forEach((thread) => {
        threads[thread.id] = ensureThreadState(thread);
        if (!threadOrder.includes(thread.id)) {
          threadOrder.push(thread.id);
        }
      });

      return {
        ...state,
        rooms,
        roomOrder,
        threads,
        threadOrder,
        users: action.payload.users || [],
      };
    }
    case Actions.UPSERT_ROOM: {
      const incoming = action.payload;
      const previous = state.rooms[incoming.id];
      const merged = {
        ...previous,
        ...incoming,
        messages: incoming.messages
          ? sortMessages(incoming.messages)
          : previous?.messages || [],
        memberCount: incoming.memberCount ?? previous?.memberCount ?? 0,
        hasMore: incoming.hasMore ?? previous?.hasMore ?? false,
        nextCursor: incoming.nextCursor ?? previous?.nextCursor ?? null,
      };
      const rooms = { ...state.rooms, [incoming.id]: merged };
      const roomOrder = state.roomOrder.includes(incoming.id)
        ? state.roomOrder
        : [...state.roomOrder, incoming.id];
      return { ...state, rooms, roomOrder };
    }
    case Actions.UPSERT_THREAD: {
      const incoming = action.payload;
      const previous = state.threads[incoming.id];
      const merged = {
        ...previous,
        ...incoming,
        messages: incoming.messages
          ? sortMessages(incoming.messages)
          : previous?.messages || [],
        hasMore: incoming.hasMore ?? previous?.hasMore ?? false,
      };
      const threads = { ...state.threads, [incoming.id]: merged };
      const threadOrder = state.threadOrder.includes(incoming.id)
        ? state.threadOrder
        : [...state.threadOrder, incoming.id];
      return { ...state, threads, threadOrder };
    }
    case Actions.APPEND_ROOM_MESSAGE: {
      const { roomId, message } = action.payload;
      const current = state.rooms[roomId];
      if (!current) {
        return state;
      }
      const exists = current.messages.some((item) => item.id === message.id);
      const messages = exists
        ? current.messages.map((item) => (item.id === message.id ? { ...item, ...message } : item))
        : [...current.messages, message];
      return {
        ...state,
        rooms: {
          ...state.rooms,
          [roomId]: {
            ...current,
            messages: sortMessages(messages),
          },
        },
      };
    }
    case Actions.UPDATE_ROOM_MESSAGE: {
      const { roomId, messageId, updater } = action.payload;
      const current = state.rooms[roomId];
      if (!current) {
        return state;
      }
      const messages = current.messages.map((message) =>
        message.id === messageId ? { ...message, ...updater(message) } : message
      );
      return {
        ...state,
        rooms: {
          ...state.rooms,
          [roomId]: {
            ...current,
            messages,
          },
        },
      };
    }
    case Actions.APPEND_THREAD_MESSAGE: {
      const { threadId, message } = action.payload;
      const current = state.threads[threadId];
      if (!current) {
        return state;
      }
      const exists = current.messages.some((item) => item.id === message.id);
      const messages = exists
        ? current.messages.map((item) => (item.id === message.id ? { ...item, ...message } : item))
        : [...current.messages, message];
      return {
        ...state,
        threads: {
          ...state.threads,
          [threadId]: {
            ...current,
            messages: sortMessages(messages),
          },
        },
      };
    }
    case Actions.UPDATE_THREAD_MESSAGE: {
      const { threadId, messageId, updater } = action.payload;
      const current = state.threads[threadId];
      if (!current) {
        return state;
      }
      const messages = current.messages.map((message) =>
        message.id === messageId ? { ...message, ...updater(message) } : message
      );
      return {
        ...state,
        threads: {
          ...state.threads,
          [threadId]: {
            ...current,
            messages,
          },
        },
      };
    }
    case Actions.SET_ACTIVE_CONVERSATION:
      return { ...state, activeConversation: action.payload };
    case Actions.SET_USERS:
      return { ...state, users: action.payload };
    case Actions.SET_TYPING_ROOM:
      return {
        ...state,
        typingByRoom: {
          ...state.typingByRoom,
          [action.payload.roomId]: action.payload.users,
        },
      };
    case Actions.SET_TYPING_THREAD:
      return {
        ...state,
        typingByThread: {
          ...state.typingByThread,
          [action.payload.threadId]: action.payload.users,
        },
      };
    case Actions.INCREMENT_UNREAD_ROOM: {
      const { roomId } = action.payload;
      const current = state.unreadRooms[roomId] || 0;
      return {
        ...state,
        unreadRooms: { ...state.unreadRooms, [roomId]: current + 1 },
      };
    }
    case Actions.RESET_UNREAD_ROOM: {
      const unreadRooms = { ...state.unreadRooms };
      delete unreadRooms[action.payload.roomId];
      return { ...state, unreadRooms };
    }
    case Actions.INCREMENT_UNREAD_THREAD: {
      const { threadId } = action.payload;
      const current = state.unreadThreads[threadId] || 0;
      return {
        ...state,
        unreadThreads: { ...state.unreadThreads, [threadId]: current + 1 },
      };
    }
    case Actions.RESET_UNREAD_THREAD: {
      const unreadThreads = { ...state.unreadThreads };
      delete unreadThreads[action.payload.threadId];
      return { ...state, unreadThreads };
    }
    case Actions.SET_SEARCH_RESULTS:
      return { ...state, searchResults: action.payload };
    case Actions.ADD_TOAST:
      return { ...state, toasts: [...state.toasts, action.payload] };
    case Actions.REMOVE_TOAST:
      return { ...state, toasts: state.toasts.filter((toast) => toast.id !== action.payload) };
    default:
      return state;
  }
};

const ChatContext = createContext(null);

const createToast = (data) => ({
  id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
  createdAt: dayjs().toISOString(),
  ...data,
});

const shouldShowBrowserNotification = () => {
  if (typeof window === 'undefined' || typeof document === 'undefined' || !('Notification' in window)) {
    return false;
  }
  return document.hidden && Notification.permission === 'granted';
};

export const ChatProvider = ({ children }) => {
  const [state, dispatch] = useReducer(reducer, initialState);
  const stateRef = useRef(state);
  const audioContextRef = useRef(null);
  const usernameRef = useRef(loadUsername());

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    if (state.activeConversation) {
      saveActiveConversation(state.activeConversation);
    }
  }, [state.activeConversation]);

  useEffect(() => {
    if (state.isConnected && usernameRef.current) {
      dispatch({ type: Actions.SET_USER, payload: { username: usernameRef.current } });
    }
  }, [state.isConnected]);

  const playNotificationSound = () => {
    if (typeof window === 'undefined') {
      return;
    }

    try {
      const context = audioContextRef.current || new (window.AudioContext || window.webkitAudioContext)();
      audioContextRef.current = context;

      if (context.state === 'suspended') {
        context.resume().catch(() => {});
      }

      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = 'triangle';
      oscillator.frequency.value = 880;
      gain.gain.value = 0.0015;
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start();
      oscillator.stop(context.currentTime + 0.12);
    } catch (error) {
      // ignore audio errors silently
    }
  };

  const showBrowserNotification = (title, options) => {
    if (!shouldShowBrowserNotification()) {
      return;
    }

    try {
      new Notification(title, options);
    } catch (error) {
      // ignore notification errors
    }
  };

  const handleInitialState = (payload) => {
    const username = usernameRef.current;
    const me = (payload.users || []).find((user) => user.username === username) || null;

    dispatch({
      type: Actions.SET_INITIAL_STATE,
      payload: {
        rooms: payload.rooms || [],
        threads: payload.threads || [],
        users: payload.users || [],
      },
    });

    if (me) {
      dispatch({ type: Actions.SET_USER, payload: me });
    }

    const storedConversation = loadActiveConversation();
    if (storedConversation) {
      dispatch({ type: Actions.SET_ACTIVE_CONVERSATION, payload: storedConversation });
    } else if (payload.activeRoom) {
      dispatch({
        type: Actions.SET_ACTIVE_CONVERSATION,
        payload: { type: 'room', id: payload.activeRoom },
      });
    }
  };

  const requestNotificationPermission = () => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      return;
    }

    if (Notification.permission === 'default') {
      Notification.requestPermission().catch(() => {});
    }
  };

  const ensureRoomExists = (room) => {
    if (!room?.id) {
      return;
    }

    const existing = stateRef.current.rooms[room.id];

    if (!existing) {
      dispatch({
        type: Actions.UPSERT_ROOM,
        payload: {
          ...room,
          messages: room.messages ?? [],
        },
      });
      return;
    }

    const hasNewInfo = Boolean(
      (room.name && room.name !== existing.name) ||
        (room.description && room.description !== existing.description) ||
        (typeof room.memberCount === 'number' && room.memberCount !== existing.memberCount) ||
        (Array.isArray(room.messages) && room.messages.length > existing.messages.length)
    );

    if (hasNewInfo) {
      dispatch({
        type: Actions.UPSERT_ROOM,
        payload: {
          ...existing,
          ...room,
        },
      });
    }
  };

  const ensureThreadExists = (thread) => {
    dispatch({ type: Actions.UPSERT_THREAD, payload: thread });
  };

  const handleRoomMessage = (message) => {
  ensureRoomExists({ id: message.roomId });
    dispatch({ type: Actions.APPEND_ROOM_MESSAGE, payload: { roomId: message.roomId, message } });

    const currentState = stateRef.current;
    const isSelf = currentState.user?.username === message.sender;
    const isActiveRoom =
      currentState.activeConversation?.type === 'room' &&
      currentState.activeConversation.id === message.roomId;
    const isHidden = typeof document !== 'undefined' ? document.hidden : false;

    socket.emit('message_delivered', { roomId: message.roomId, messageId: message.id });

    if (isActiveRoom) {
      dispatch({
        type: Actions.SET_TYPING_ROOM,
        payload: {
          roomId: message.roomId,
          users: (currentState.typingByRoom[message.roomId] || []).filter(
            (user) => user !== message.sender
          ),
        },
      });
    }

    if (!isSelf && isActiveRoom && !isHidden) {
      socket.emit('message_read', { roomId: message.roomId, messageId: message.id });
    }

    if (!isSelf && (!isActiveRoom || isHidden)) {
      dispatch({ type: Actions.INCREMENT_UNREAD_ROOM, payload: { roomId: message.roomId } });
      playNotificationSound();
      dispatch({
        type: Actions.ADD_TOAST,
        payload: createToast({
          title: currentState.rooms[message.roomId]?.name || 'New message',
          message: `${message.sender}: ${message.body}`,
        }),
      });
      showBrowserNotification('New message', {
        body: `${message.sender}: ${message.body}`,
      });
    }
  };

  const handlePrivateMessage = ({ thread, message }) => {
    ensureThreadExists(thread);
    dispatch({ type: Actions.UPSERT_THREAD, payload: thread });

    const currentState = stateRef.current;
    const isSelf = currentState.user?.username === message.sender;
    const active = currentState.activeConversation;
    const isActiveThread = active?.type === 'thread' && active.id === thread.id;
    const isHidden = typeof document !== 'undefined' ? document.hidden : false;

    if (isActiveThread) {
      dispatch({
        type: Actions.SET_TYPING_THREAD,
        payload: {
          threadId: thread.id,
          users: (currentState.typingByThread[thread.id] || []).filter(
            (user) => user !== message.sender
          ),
        },
      });
    }

    if (!isSelf && (!isActiveThread || isHidden)) {
      dispatch({ type: Actions.INCREMENT_UNREAD_THREAD, payload: { threadId: thread.id } });
      playNotificationSound();
      dispatch({
        type: Actions.ADD_TOAST,
        payload: createToast({
          title: `Direct message • ${thread.counterpart}`,
          message: `${message.sender}: ${message.body}`,
        }),
      });
      showBrowserNotification(`Message from ${message.sender}`, {
        body: message.body,
      });
    }

    if (!isSelf && isActiveThread && !isHidden) {
      socket.emit('private_message_read', { threadId: thread.id, messageId: message.id });
    }

    dispatch({ type: Actions.APPEND_THREAD_MESSAGE, payload: { threadId: thread.id, message } });
  };

  const handlePrivateTyping = ({ from, isTyping }) => {
    const currentState = stateRef.current;
    const username = currentState.user?.username;

    if (!username) {
      return;
    }

    const threadId = makeThreadId(username, from);
    const users = isTyping
      ? Array.from(new Set([...(currentState.typingByThread[threadId] || []), from]))
      : (currentState.typingByThread[threadId] || []).filter((user) => user !== from);

    dispatch({ type: Actions.SET_TYPING_THREAD, payload: { threadId, users } });
  };

  useEffect(() => {
    const onConnect = () => {
      dispatch({ type: Actions.SET_CONNECTED, payload: true });
      dispatch({ type: Actions.SET_CONNECTING, payload: false });
    };

    const onDisconnect = () => {
      dispatch({ type: Actions.SET_CONNECTED, payload: false });
    };

    const onConnectError = (err) => {
      console.error('Socket connect error:', err);
      dispatch({ type: Actions.SET_CONNECTING, payload: false });
      dispatch({
        type: Actions.ADD_TOAST,
        payload: createToast({ title: 'Connection error', message: 'Unable to connect to the chat server. Check server URL and CORS settings.' }),
      });
    };

    const onConnectTimeout = () => {
      console.error('Socket connect timeout');
      dispatch({ type: Actions.SET_CONNECTING, payload: false });
      dispatch({
        type: Actions.ADD_TOAST,
        payload: createToast({ title: 'Connection timeout', message: 'Connection to the chat server timed out.' }),
      });
    };

    const onRoomList = (payload) => {
      payload.forEach((room) => ensureRoomExists(room));
    };

    const onRoomJoined = (room) => {
      ensureRoomExists(room);
      dispatch({
        type: Actions.SET_ACTIVE_CONVERSATION,
        payload: { type: 'room', id: room.id },
      });
    };

    const onTypingUsers = ({ roomId, users }) => {
      dispatch({ type: Actions.SET_TYPING_ROOM, payload: { roomId, users } });
    };

    const onMessageReaction = ({ roomId, messageId, reactions }) => {
      dispatch({
        type: Actions.UPDATE_ROOM_MESSAGE,
        payload: {
          roomId,
          messageId,
          updater: () => ({ reactions }),
        },
      });
    };

    const onReadUpdate = ({ roomId, messageId, readBy }) => {
      dispatch({
        type: Actions.UPDATE_ROOM_MESSAGE,
        payload: {
          roomId,
          messageId,
          updater: () => ({ readBy }),
        },
      });
    };

    const onDeliveryUpdate = ({ roomId, messageId, deliveredTo }) => {
      dispatch({
        type: Actions.UPDATE_ROOM_MESSAGE,
        payload: {
          roomId,
          messageId,
          updater: () => ({ deliveredTo }),
        },
      });
    };

    const onUserList = (users) => {
      dispatch({ type: Actions.SET_USERS, payload: users });
      const username = usernameRef.current;
      const me = users.find((user) => user.username === username);
      if (me) {
        dispatch({ type: Actions.SET_USER, payload: me });
      }
    };

    const onUserJoined = (user) => {
      dispatch({
        type: Actions.ADD_TOAST,
        payload: createToast({
          title: 'User joined',
          message: `${user.username} joined the chat`,
        }),
      });
    };

    const onUserLeft = (user) => {
      dispatch({
        type: Actions.ADD_TOAST,
        payload: createToast({
          title: 'User left',
          message: `${user.username} left the chat`,
        }),
      });
    };

    const onPrivateReaction = ({ threadId, messageId, reactions }) => {
      dispatch({
        type: Actions.UPDATE_THREAD_MESSAGE,
        payload: {
          threadId,
          messageId,
          updater: () => ({ reactions }),
        },
      });
    };

    const onPrivateRead = ({ threadId, messageId, readBy }) => {
      dispatch({
        type: Actions.UPDATE_THREAD_MESSAGE,
        payload: {
          threadId,
          messageId,
          updater: () => ({ readBy }),
        },
      });
    };

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
  socket.on('connect_error', onConnectError);
  socket.on('connect_timeout', onConnectTimeout);
    socket.on('initial_state', handleInitialState);
    socket.on('room_list', onRoomList);
    socket.on('room_joined', onRoomJoined);
    socket.on('receive_message', handleRoomMessage);
    socket.on('typing_users', onTypingUsers);
    socket.on('message_reaction_update', onMessageReaction);
    socket.on('message_read_update', onReadUpdate);
    socket.on('message_delivery_update', onDeliveryUpdate);
    socket.on('user_list', onUserList);
    socket.on('user_joined', onUserJoined);
    socket.on('user_left', onUserLeft);
    socket.on('private_message', handlePrivateMessage);
    socket.on('private_typing', handlePrivateTyping);
    socket.on('private_reaction_update', onPrivateReaction);
    socket.on('private_read_receipt', onPrivateRead);

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('initial_state', handleInitialState);
      socket.off('room_list', onRoomList);
      socket.off('room_joined', onRoomJoined);
      socket.off('receive_message', handleRoomMessage);
      socket.off('typing_users', onTypingUsers);
      socket.off('message_reaction_update', onMessageReaction);
      socket.off('message_read_update', onReadUpdate);
      socket.off('message_delivery_update', onDeliveryUpdate);
      socket.off('user_list', onUserList);
      socket.off('user_joined', onUserJoined);
      socket.off('user_left', onUserLeft);
      socket.off('private_message', handlePrivateMessage);
      socket.off('private_typing', handlePrivateTyping);
      socket.off('private_reaction_update', onPrivateReaction);
      socket.off('private_read_receipt', onPrivateRead);
    };
  }, []);

  const actions = useMemo(() => {
    const connect = async (username) => {
      const trimmed = username?.trim();

      if (!trimmed) {
        throw new Error('Username is required');
      }

      requestNotificationPermission();

      return new Promise((resolve, reject) => {
        dispatch({ type: Actions.SET_CONNECTING, payload: true });
        usernameRef.current = trimmed;
        socket.connect();

        socket.emit('user_join', { username: trimmed }, (response) => {
          if (!response?.ok) {
            dispatch({ type: Actions.SET_CONNECTING, payload: false });
            usernameRef.current = null;
            reject(new Error(response?.error || 'Unable to join chat'));
            return;
          }

          saveUsername(trimmed);
          dispatch({ type: Actions.SET_USER, payload: { username: trimmed } });
          dispatch({
            type: Actions.SET_ACTIVE_CONVERSATION,
            payload: { type: 'room', id: response.activeRoom || 'general' },
          });
          resolve(response);
        });
      });
    };

    const disconnect = () => {
      saveUsername(null);
      saveActiveConversation(null);
      usernameRef.current = null;
      socket.disconnect();
      dispatch({ type: Actions.RESET_SESSION });
    };

    const sendMessage = ({ roomId, body }) =>
      new Promise((resolve, reject) => {
        socket.emit(
          'send_message',
          {
            roomId,
            message: body,
            tempId: crypto.randomUUID?.() || `${Date.now()}`,
          },
          (response) => {
            if (!response?.ok) {
              reject(new Error(response?.error || 'Unable to send message'));
              return;
            }
            resolve(response);
          }
        );
      });

    const sendPrivateMessage = ({ to, body }) =>
      new Promise((resolve, reject) => {
        socket.emit(
          'private_message',
          {
            to,
            message: body,
            tempId: crypto.randomUUID?.() || `${Date.now()}`,
          },
          (response) => {
            if (!response?.ok) {
              reject(new Error(response?.error || 'Unable to send direct message'));
              return;
            }
            resolve(response);
          }
        );
      });

    const setActiveConversation = (conversation) => {
      if (!conversation) {
        return;
      }

      if (conversation.type === 'room') {
        socket.emit('set_active_room', { roomId: conversation.id });
        dispatch({ type: Actions.RESET_UNREAD_ROOM, payload: { roomId: conversation.id } });
      }

      if (conversation.type === 'thread') {
        dispatch({ type: Actions.RESET_UNREAD_THREAD, payload: { threadId: conversation.id } });
      }

      saveActiveConversation(conversation);
      dispatch({ type: Actions.SET_ACTIVE_CONVERSATION, payload: conversation });
    };

    const createRoom = (roomName) =>
      new Promise((resolve, reject) => {
        const trimmed = roomName?.trim();
        if (!trimmed) {
          reject(new Error('Room name is required'));
          return;
        }

        socket.emit(
          'join_room',
          {
            roomName: trimmed,
            description: '',
          },
          (response) => {
            if (!response?.ok) {
              reject(new Error(response?.error || 'Unable to create room'));
              return;
            }
            resolve(response.room);
          }
        );
      });

    const joinRoom = (roomId) =>
      new Promise((resolve, reject) => {
        socket.emit(
          'join_room',
          {
            roomId,
          },
          (response) => {
            if (!response?.ok) {
              reject(new Error(response?.error || 'Unable to join room'));
              return;
            }
            resolve(response.room);
          }
        );
      });

    const fetchOlderMessages = ({ roomId, before, limit = 30 }) =>
      new Promise((resolve, reject) => {
        socket.emit(
          'request_room_history',
          {
            roomId,
            before,
            limit,
          },
          (response) => {
            if (!response?.ok) {
              reject(new Error(response?.error || 'Unable to load history'));
              return;
            }
            const room = stateRef.current.rooms[roomId];
            if (room) {
              const combined = [...response.messages, ...room.messages];
              const deduped = Array.from(
                combined.reduce((map, item) => map.set(item.id, item), new Map()).values()
              );
              const merged = sortMessages(deduped);
              dispatch({
                type: Actions.UPSERT_ROOM,
                payload: {
                  ...room,
                  messages: merged,
                  hasMore: response.hasMore,
                  nextCursor: response.nextCursor,
                },
              });
            }
            resolve(response);
          }
        );
      });

    const reactToMessage = ({ roomId, messageId, emoji }) => {
      socket.emit('react_to_message', { roomId, messageId, emoji });
    };

    const reactToPrivateMessage = ({ threadId, messageId, emoji }) => {
      socket.emit('react_to_private_message', { threadId, messageId, emoji });
    };

    const markConversationRead = (conversation) => {
      const currentState = stateRef.current;
      const username = currentState.user?.username;

      if (!username) {
        return;
      }

      if (conversation.type === 'room') {
        const room = currentState.rooms[conversation.id];
        if (!room) {
          return;
        }
        const lastMessage = [...room.messages].reverse().find((message) => message.sender !== username);
        if (lastMessage) {
          socket.emit('message_read', { roomId: room.id, messageId: lastMessage.id });
        }
        dispatch({ type: Actions.RESET_UNREAD_ROOM, payload: { roomId: room.id } });
      }

      if (conversation.type === 'thread') {
        const thread = currentState.threads[conversation.id];
        if (!thread) {
          return;
        }
        const lastMessage = [...thread.messages]
          .reverse()
          .find((message) => message.sender !== username);
        if (lastMessage) {
          socket.emit('private_message_read', { threadId: thread.id, messageId: lastMessage.id });
        }
        dispatch({ type: Actions.RESET_UNREAD_THREAD, payload: { threadId: thread.id } });
      }
    };

    const setTyping = (roomId, isTyping) => {
      socket.emit('typing', { roomId, isTyping });
    };

    const setPrivateTyping = (username, isTyping) => {
      socket.emit('private_typing', { to: username, isTyping });
    };

    const ensureThread = (counterpart) => {
      const username = stateRef.current.user?.username;
      if (!username) {
        return null;
      }
      const threadId = makeThreadId(username, counterpart);
      const existing = stateRef.current.threads[threadId];
      if (!existing) {
        dispatch({
          type: Actions.UPSERT_THREAD,
          payload: {
            id: threadId,
            participants: [username, counterpart],
            counterpart,
            messages: [],
            hasMore: false,
          },
        });
      }
      return threadId;
    };

    const openDirectMessage = (username) => {
      const threadId = ensureThread(username);
      if (threadId) {
        setActiveConversation({ type: 'thread', id: threadId });
      }
    };

    const searchMessages = async (query, roomId) => {
      const trimmed = query?.trim();
      if (!trimmed) {
        dispatch({ type: Actions.SET_SEARCH_RESULTS, payload: [] });
        return [];
      }

      const params = new URLSearchParams();
      params.append('q', trimmed);
      if (roomId) {
        params.append('roomId', roomId);
      }

      const response = await fetch(`/api/search?${params.toString()}`);
      if (!response.ok) {
        throw new Error('Unable to search messages');
      }

      const results = await response.json();
      dispatch({ type: Actions.SET_SEARCH_RESULTS, payload: results });
      return results;
    };

    const dismissToast = (id) => {
      dispatch({ type: Actions.REMOVE_TOAST, payload: id });
    };

    return {
      connect,
      disconnect,
      sendMessage,
      sendPrivateMessage,
      setActiveConversation,
      createRoom,
      joinRoom,
      fetchOlderMessages,
      reactToMessage,
      reactToPrivateMessage,
      markConversationRead,
      setTyping,
      setPrivateTyping,
      openDirectMessage,
      ensureThread,
      searchMessages,
      dismissToast,
    };
  }, []);

  useEffect(() => {
    if (!usernameRef.current || state.isConnected || state.isConnecting || socket.connected) {
      return;
    }

    actions.connect(usernameRef.current).catch(() => {
      // ignore auto-connect failures; the login screen will let the user retry
    });
  }, [actions, state.isConnected, state.isConnecting]);

  return (
    <ChatContext.Provider value={{ state, dispatch, actions }}>
      {children}
    </ChatContext.Provider>
  );
};

export const useChat = () => {
  const context = useContext(ChatContext);
  if (!context) {
    throw new Error('useChat must be used within a ChatProvider');
  }
  return context;
};

import { useEffect, useMemo, useState } from 'react';
import { useChat } from '../context/ChatContext.jsx';
import Sidebar from './Sidebar.jsx';
import MessageList from './MessageList.jsx';
import MessageComposer from './MessageComposer.jsx';
import TypingIndicator from './TypingIndicator.jsx';

const ChatLayout = () => {
  const { state, actions } = useChat();
  const {
    user,
    rooms,
    roomOrder,
    threads,
    threadOrder,
    activeConversation,
    typingByRoom,
    typingByThread,
    unreadRooms,
    unreadThreads,
    users,
    searchResults,
  } = state;
  const [searchTerm, setSearchTerm] = useState('');
  const [searchLoading, setSearchLoading] = useState(false);

  const activeRoom = activeConversation?.type === 'room' ? rooms[activeConversation.id] : null;
  const activeThread = activeConversation?.type === 'thread' ? threads[activeConversation.id] : null;

  const counterpart = useMemo(() => {
    if (!activeThread) {
      return null;
    }
    return (
      activeThread.participants?.find((name) => name !== user?.username) ||
      activeThread.counterpart ||
      null
    );
  }, [activeThread, user?.username]);

  const messages = activeRoom
    ? activeRoom.messages
    : activeThread
    ? activeThread.messages
    : [];

  const hasMore = Boolean(activeRoom?.hasMore);

  const typingNames = activeRoom
    ? typingByRoom[activeRoom.id] || []
    : activeThread
    ? typingByThread[activeThread.id] || []
    : [];

  useEffect(() => {
    if (activeConversation) {
      actions.markConversationRead(activeConversation);
    }
  }, [activeConversation, messages.length, actions]);

  const handleSend = async (body) => {
    if (activeRoom) {
      await actions.sendMessage({ roomId: activeRoom.id, body });
      return;
    }
    if (activeThread && counterpart) {
      await actions.sendPrivateMessage({ to: counterpart, body });
    }
  };

  const handleTyping = (isTyping) => {
    if (activeRoom) {
      actions.setTyping(activeRoom.id, isTyping);
      return;
    }
    if (activeThread && counterpart) {
      actions.setPrivateTyping(counterpart, isTyping);
    }
  };

  const handleReact = (messageId, emoji) => {
    if (activeRoom) {
      actions.reactToMessage({ roomId: activeRoom.id, messageId, emoji });
      return;
    }
    if (activeThread) {
      actions.reactToPrivateMessage({ threadId: activeThread.id, messageId, emoji });
    }
  };

  const handleLoadMore = () => {
    if (activeRoom && activeRoom.hasMore) {
      const before = activeRoom.messages[0]?.id;
      actions.fetchOlderMessages({ roomId: activeRoom.id, before });
    }
  };

  const handleCreateRoom = async () => {
    const name = window.prompt('Room name');
    if (!name) {
      return;
    }
    try {
      await actions.createRoom(name);
    } catch (error) {
      console.error(error);
    }
  };

  const handleJoinRoom = async () => {
    const roomId = window.prompt('Enter a room id to join');
    if (!roomId) {
      return;
    }
    try {
      await actions.joinRoom(roomId.trim());
    } catch (error) {
      console.error(error);
    }
  };

  const handleSearch = async (event) => {
    event.preventDefault();
    setSearchLoading(true);
    try {
      await actions.searchMessages(searchTerm, activeRoom?.id);
    } catch (error) {
      console.error(error);
    } finally {
      setSearchLoading(false);
    }
  };

  const handleSelectConversation = (conversation) => {
    setSearchTerm('');
    actions.setActiveConversation(conversation);
  };

  const handleStartDm = (username) => {
    actions.openDirectMessage(username);
  };

  useEffect(() => {
    if (!searchTerm.trim()) {
      actions.searchMessages('');
    }
  }, [searchTerm, actions]);

  return (
    <div className="chat-shell">
      <Sidebar
        user={user}
        rooms={rooms}
        roomOrder={roomOrder}
        threads={threads}
        threadOrder={threadOrder}
        activeConversation={activeConversation}
        unreadRooms={unreadRooms}
        unreadThreads={unreadThreads}
        users={users}
        onSelectConversation={handleSelectConversation}
        onCreateRoom={handleCreateRoom}
        onJoinRoom={handleJoinRoom}
        onStartDirectMessage={handleStartDm}
        onLogout={actions.disconnect}
      />

      <div className="chat-panel">
        <header className="chat-header">
          <div>
            <h2>
              {activeRoom ? `#${activeRoom.name || activeRoom.id}` : counterpart ? `@${counterpart}` : 'Select a room'}
            </h2>
            {activeRoom ? (
              <p className="subtitle">
                {activeRoom.description || 'No description yet.'} • {activeRoom.memberCount || 0} members
              </p>
            ) : null}
            {counterpart ? <p className="subtitle">Direct conversation with {counterpart}</p> : null}
          </div>
          <form className="search" onSubmit={handleSearch}>
            <input
              type="search"
              placeholder="Search messages"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
            />
            <button type="submit" disabled={!searchTerm.trim() || searchLoading}>
              {searchLoading ? 'Searching…' : 'Search'}
            </button>
          </form>
        </header>

        <main className="chat-main">
          <MessageList
            messages={messages}
            currentUser={user}
            hasMore={hasMore}
            onLoadMore={handleLoadMore}
            onReact={handleReact}
            conversationType={activeConversation?.type}
          />
          <TypingIndicator names={typingNames} />
          <MessageComposer
            onSend={handleSend}
            onTyping={handleTyping}
            placeholder={activeRoom ? `Message #${activeRoom.name || activeRoom.id}` : counterpart ? `Message @${counterpart}` : 'Select a conversation to start chatting'}
            disabled={!activeRoom && !activeThread}
          />
        </main>

        {searchResults?.length ? (
          <section className="search-results">
            <h3>Search results</h3>
            <ul>
              {searchResults.map((entry) => (
                <li key={entry.message.id}>
                  <button
                    type="button"
                    className="search-result"
                    onClick={() =>
                      handleSelectConversation({ type: 'room', id: entry.roomId })
                    }
                  >
                    <span className="result-room">#{entry.roomName}</span>
                    <span className="result-body">{entry.message.sender}: {entry.message.body}</span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>

    </div>
  );
};

export default ChatLayout;

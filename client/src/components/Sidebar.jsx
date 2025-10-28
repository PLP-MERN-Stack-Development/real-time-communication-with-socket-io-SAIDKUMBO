import clsx from 'clsx';
import { useMemo } from 'react';

const Sidebar = ({
  user,
  rooms,
  roomOrder,
  threads,
  threadOrder,
  activeConversation,
  unreadRooms,
  unreadThreads,
  users,
  onSelectConversation,
  onCreateRoom,
  onJoinRoom,
  onStartDirectMessage,
  onLogout,
}) => {
  const sortedUsers = useMemo(
    () => users.filter((entry) => entry.username !== user?.username),
    [users, user?.username]
  );

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <div className="user-pill">
          <span className="status-dot online" />
          <span>{user?.username || 'You'}</span>
        </div>
        <button type="button" onClick={onCreateRoom} className="sidebar-action">
          ＋ Room
        </button>
      </div>
      <button type="button" className="sidebar-action logout" onClick={onLogout}>
        Sign out
      </button>

      <nav className="sidebar-section">
        <div className="sidebar-section-header">
          <span>Rooms</span>
          <button type="button" onClick={onJoinRoom} className="sidebar-link">
            Browse
          </button>
        </div>
        <ul>
          {roomOrder.map((roomId) => {
            const room = rooms[roomId];
            if (!room) {
              return null;
            }
            const isActive = activeConversation?.type === 'room' && activeConversation.id === roomId;
            const unread = unreadRooms[roomId];
            return (
              <li key={roomId}>
                <button
                  type="button"
                  className={clsx('sidebar-item', { active: isActive })}
                  onClick={() => onSelectConversation({ type: 'room', id: roomId })}
                >
                  <span className="item-name">#{room.name || roomId}</span>
                  {unread ? <span className="badge">{unread}</span> : null}
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      <nav className="sidebar-section">
        <div className="sidebar-section-header">
          <span>Direct messages</span>
        </div>
        <ul>
          {threadOrder.length === 0 ? <li className="empty">No conversations yet</li> : null}
          {threadOrder.map((threadId) => {
            const thread = threads[threadId];
            if (!thread) {
              return null;
            }
            const counterpart = thread.participants.find((name) => name !== user?.username) || thread.counterpart || 'Unknown';
            const isActive = activeConversation?.type === 'thread' && activeConversation.id === threadId;
            const unread = unreadThreads[threadId];
            return (
              <li key={threadId}>
                <button
                  type="button"
                  className={clsx('sidebar-item', { active: isActive })}
                  onClick={() => onSelectConversation({ type: 'thread', id: threadId })}
                >
                  <span className="item-name">@{counterpart}</span>
                  {unread ? <span className="badge">{unread}</span> : null}
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      <section className="sidebar-section">
        <div className="sidebar-section-header">
          <span>Online now</span>
        </div>
        <ul>
          {sortedUsers.length === 0 ? <li className="empty">Only you</li> : null}
          {sortedUsers.map((entry) => (
            <li key={entry.id} className="user-row">
              <div className="user-meta">
                <span className={clsx('status-dot', entry.status === 'online' ? 'online' : 'offline')} />
                <span>{entry.username}</span>
              </div>
              <button
                type="button"
                className="sidebar-link"
                onClick={() => onStartDirectMessage(entry.username)}
              >
                Message
              </button>
            </li>
          ))}
        </ul>
      </section>
    </aside>
  );
};

export default Sidebar;

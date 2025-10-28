import { useEffect, useMemo, useRef } from 'react';
import clsx from 'clsx';
import dayjs from 'dayjs';
import { formatTimestamp, isSameDay } from '../utils/chatHelpers.js';

const REACTIONS = ['👍', '❤️', '😂', '🎉', '👀'];

const MessageList = ({
  messages = [],
  currentUser,
  hasMore,
  onLoadMore,
  onReact,
  conversationType,
}) => {
  const listRef = useRef(null);

  useEffect(() => {
    const node = listRef.current;
    if (!node) {
      return;
    }
    node.scrollTop = node.scrollHeight;
  }, [messages.length]);

  const grouped = useMemo(() => {
    const chunks = [];
    let currentDay = null;

    messages.forEach((message) => {
      const day = message.timestamp ? message.timestamp.slice(0, 10) : 'unknown';
      if (!currentDay || !isSameDay(day, currentDay)) {
        currentDay = day;
        const label = message.timestamp ? dayjs(message.timestamp).format('MMM D, YYYY') : 'Unknown day';
        chunks.push({ type: 'day', id: `day-${day}`, label });
      }
      chunks.push({ type: 'message', data: message, id: message.id });
    });

    return chunks;
  }, [messages]);

  return (
    <div className="message-list" ref={listRef}>
      {hasMore && onLoadMore ? (
        <button type="button" className="load-more" onClick={onLoadMore}>
          Load older messages
        </button>
      ) : null}

      {grouped.map((entry) => {
        if (entry.type === 'day') {
          return (
            <div key={entry.id} className="day-separator">
              <span>{entry.label}</span>
            </div>
          );
        }

        return (
          <MessageItem
            key={entry.id}
            message={entry.data}
            currentUser={currentUser}
            onReact={onReact}
            conversationType={conversationType}
          />
        );
      })}
    </div>
  );
};

const MessageItem = ({ message, currentUser, onReact, conversationType }) => {
  const isOwn = message.sender === currentUser?.username;
  const reactions = Object.entries(message.reactions || {});
  const readBy = (message.readBy || []).filter((name) => name !== message.sender);
  const readLabel = useMemo(() => {
    if (!readBy.length) {
      return null;
    }
    if (conversationType === 'thread') {
      return `Seen by ${readBy.join(', ')}`;
    }
    return `Seen by ${readBy.length} ${readBy.length === 1 ? 'person' : 'people'}`;
  }, [readBy, conversationType]);

  return (
    <div className={clsx('message', { own: isOwn, system: message.isSystem })}>
      {!message.isSystem ? (
        <div className="meta">
          <span className="sender">{isOwn ? 'You' : message.sender}</span>
          <time dateTime={message.timestamp}>{formatTimestamp(message.timestamp)}</time>
        </div>
      ) : null}
      <div className="body">{message.body}</div>
      {reactions.length ? (
        <div className="reactions">
          {reactions.map(([emoji, users]) => (
            <button
              type="button"
              key={emoji}
              className="reaction"
              onClick={() => onReact(message.id, emoji)}
            >
              {emoji} <span>{users.length}</span>
            </button>
          ))}
        </div>
      ) : null}
      {!message.isSystem ? (
        <div className="reaction-picker">
          {REACTIONS.map((emoji) => (
            <button
              type="button"
              key={emoji}
              onClick={() => onReact(message.id, emoji)}
              className="reaction ghost"
            >
              {emoji}
            </button>
          ))}
        </div>
      ) : null}
      {readLabel ? <p className="read-receipt">{readLabel}</p> : null}
    </div>
  );
};

export default MessageList;

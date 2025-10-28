import { useEffect, useRef, useState } from 'react';

const STOP_TYPING_DELAY = 1500;

const MessageComposer = ({ onSend, onTyping, placeholder, disabled }) => {
  const [value, setValue] = useState('');
  const typingTimeout = useRef(null);

  const emitTyping = (isTyping) => {
    if (typeof onTyping !== 'function') {
      return;
    }

    if (isTyping) {
      onTyping(true);
      clearTimeout(typingTimeout.current);
      typingTimeout.current = setTimeout(() => onTyping(false), STOP_TYPING_DELAY);
    } else {
      clearTimeout(typingTimeout.current);
      typingTimeout.current = null;
      onTyping(false);
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const trimmed = value.trim();
    if (!trimmed || disabled) {
      return;
    }

    try {
      await onSend(trimmed);
      setValue('');
      emitTyping(false);
    } catch (error) {
      console.error(error);
    }
  };

  const handleChange = (event) => {
    setValue(event.target.value);
    if (event.target.value.trim()) {
      emitTyping(true);
    } else {
      emitTyping(false);
    }
  };

  useEffect(
    () => () => {
      if (typingTimeout.current) {
        clearTimeout(typingTimeout.current);
      }
      if (typeof onTyping === 'function') {
        onTyping(false);
      }
    },
    [onTyping]
  );

  return (
    <form className="composer" onSubmit={handleSubmit}>
      <textarea
        value={value}
        onChange={handleChange}
        placeholder={placeholder}
        disabled={disabled}
        rows={1}
      />
      <button type="submit" disabled={disabled || !value.trim()}>
        Send
      </button>
    </form>
  );
};

export default MessageComposer;

const USERNAME_KEY = 'rtc-username';
const ACTIVE_CONVERSATION_KEY = 'rtc-active-conversation';

const isBrowser = typeof window !== 'undefined';

export const loadUsername = () => {
  if (!isBrowser) {
    return null;
  }

  return window.localStorage.getItem(USERNAME_KEY);
};

export const saveUsername = (username) => {
  if (!isBrowser) {
    return;
  }

  if (username) {
    window.localStorage.setItem(USERNAME_KEY, username);
  } else {
    window.localStorage.removeItem(USERNAME_KEY);
  }
};

export const loadActiveConversation = () => {
  if (!isBrowser) {
    return null;
  }

  const raw = window.localStorage.getItem(ACTIVE_CONVERSATION_KEY);

  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw);
  } catch (error) {
    window.localStorage.removeItem(ACTIVE_CONVERSATION_KEY);
    return null;
  }
};

export const saveActiveConversation = (conversation) => {
  if (!isBrowser) {
    return;
  }

  if (!conversation) {
    window.localStorage.removeItem(ACTIVE_CONVERSATION_KEY);
    return;
  }

  window.localStorage.setItem(ACTIVE_CONVERSATION_KEY, JSON.stringify(conversation));
};

import dayjs from 'dayjs';

export const makeThreadId = (a, b) => [a, b].sort((x, y) => x.localeCompare(y)).join('::');

export const sortMessages = (messages = []) =>
  [...messages].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

const safeDayjs = (value) => {
  const date = dayjs(value);
  return date.isValid() ? date : dayjs();
};

export const formatTimestamp = (timestamp) => safeDayjs(timestamp).format('HH:mm');

export const formatFullDate = (timestamp) => safeDayjs(timestamp).format('MMM D, YYYY • HH:mm');

export const isSameDay = (a, b) => safeDayjs(a).isSame(safeDayjs(b), 'day');

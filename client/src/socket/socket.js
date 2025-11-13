// socket.js - Socket.io client configuration

import { io } from 'socket.io-client';


const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000';

// Allow polling fallback for environments where websocket transport may be blocked.
export const socket = io(SOCKET_URL, {
  autoConnect: false,
  reconnection: true,
  reconnectionAttempts: 10,
  reconnectionDelay: 1000,
  withCredentials: true,
  // include polling as a fallback transport
  transports: ['websocket', 'polling'],
  // increase connect timeout to allow slower networks
  timeout: 20000,
});

export default socket;
// socket.js - Socket.io client configuration

import { io } from 'socket.io-client';


// Prefer VITE_SOCKET_URL (set in Vercel). If missing, use localhost for dev;
// otherwise fall back to the deployed Render backend URL so the production
// client doesn't try to connect to localhost.
const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || (typeof window !== 'undefined' && window.location.hostname === 'localhost' ? 'http://localhost:5000' : 'https://real-time-communication-with-socket-io-km0o.onrender.com');

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
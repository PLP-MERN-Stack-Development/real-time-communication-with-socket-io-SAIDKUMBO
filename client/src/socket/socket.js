// socket.js - Socket.io client configuration

import { io } from 'socket.io-client';


// Resolution order (prefer runtime-configurable values):
// 1) window.__VITE_SOCKET_URL (can be injected at runtime by the host / index.html)
// 2) a <meta name="socket-url" content="..."> tag in index.html
// 3) import.meta.env.VITE_SOCKET_URL (build-time, Vercel env)
// 4) localhost (dev) or a sensible production fallback (Render URL)
const runtimeSocket = (typeof window !== 'undefined') ? (window.__VITE_SOCKET_URL || (document.querySelector('meta[name="socket-url"]') && document.querySelector('meta[name="socket-url"]').getAttribute('content'))) : null;
const SOCKET_URL = runtimeSocket || import.meta.env.VITE_SOCKET_URL || (typeof window !== 'undefined' && window.location.hostname === 'localhost' ? 'http://localhost:5000' : 'https://real-time-communication-with-socket-io-km0o.onrender.com');

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
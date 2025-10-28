# Real-Time Communication with Socket.io

A full-stack real-time chat application built with Express, Socket.io, and React for the PLP Week 5 assignment. Users can collaborate in public rooms or private conversations with live updates, reactions, read receipts, and notifications.

## Features

- Real-time message delivery with delivery and read acknowledgements
- Username-based sign-in with online/offline presence tracking
- Multiple chat rooms (create/join) plus direct messages between users
- Typing indicators for rooms and DMs
- Message reactions (👍 ❤️ 😂 🎉 👀)
- Private and room read receipts with last-seen tracking
- Toast, sound, and browser notifications for new activity
- Message search per room and unread counters per conversation
- Message history pagination and automatic reconnection logic

### Advanced Features Implemented

- Private messaging between any two users
- Multiple chat rooms with dynamic creation and membership events
- Message reactions with live updates
- Read receipts for both rooms and direct messages
- Real-time notifications (toast, sound, browser) for joins and messages
- Message pagination and reconnection handling for resilient UX

## Tech Stack

- **Client**: React 18 + Vite, Socket.io client, Day.js, clsx
- **Server**: Node.js 18+, Express 4, Socket.io 4, UUID, Dotenv, CORS

## Project Structure

```
client/
  index.html
  package.json
  src/
    App.jsx
    main.jsx
    components/
    context/
    socket/
    styles/
    utils/
server/
  package.json
  server.js
  .env.example
README.md
Week5-Assignment.md
```

## Prerequisites

- Node.js **18.x** or higher
- npm (included with Node.js)

## Setup Instructions

1. Clone your GitHub Classroom repo (or this project) and move into it
2. Install server dependencies:

   ```bash
   cd server
   npm install
   cp .env.example .env   # optional: customise PORT and CLIENT_URL
   ```

3. Install client dependencies:

   ```bash
   cd ../client
   npm install
   cp .env.example .env    # optional: customise VITE_SOCKET_URL
   ```

## Running the Application

Use two terminals (or background processes):

```bash
# terminal 1 - start the Socket.io server
cd server
npm run dev

# terminal 2 - start the React client
cd client
npm run dev
```

- Server defaults to `http://localhost:5000`
- Client defaults to `http://localhost:5173`
- During development the Vite dev server proxies `/api` requests to the Express server

## Environment Variables

| Location | Variable | Description |
| --- | --- | --- |
| `server/.env` | `PORT` | Port for Express/Socket.io (default 5000) |
|  | `CLIENT_URL` | Comma-separated list of allowed origins (default `http://localhost:5173`) |
| `client/.env` | `VITE_SOCKET_URL` | Socket server URL (default `http://localhost:5000`) |

## Implementation Highlights

- **Rooms & Presence**: Users join `#general` on login, can browse/create rooms, and see live member counts and presence updates.
- **Direct Messages**: Deterministic thread IDs keep DM history between the same usernames. Read receipts update for both parties in real time.
- **Typing Indicators**: Per-room and per-thread typing states with automatic clear-down after inactivity.
- **Message State**: Delivery/read acknowledgements, reaction toggles, and message pagination exposable through sockets and REST.
- **Notifications**: Toasts, audio cues, and optional browser notifications respect window visibility before alerting users.
- **Search**: Server-side search endpoint surfaces per-room matches with quick navigation.

## Testing & Verification

- Manual testing covering:
  - Multi-tab conversations for room and DM flows
  - Typing, reactions, and read receipts
  - Reconnection after network toggle
  - Message pagination and search
- Additional automated testing can be added via Vitest or Jest on the client side and SuperTest on the server to cover socket event flows and REST endpoints.

![alt text](<Screenshot 2025-10-28 123645.png>) ![alt text](<Screenshot 2025-10-28 123605.png>) ![alt text](<Screenshot 2025-10-28 123619.png>)

## Next Steps / Enhancements

- Persist conversations with a database (e.g., MongoDB, PostgreSQL)
- Add file/image sharing with secure uploads
- Implement message pinning/starred items and channel topics
- Support offline DM queuing and email push notifications
- Harden validation and rate limiting for production deployments

## Screenshots / Demo

Add screenshots or a short screen recording here to showcase the UX (required by the assignment rubric).

---

For assignment requirements, refer to `Week5-Assignment.md`. Feel free to open issues or pull requests with improvements.
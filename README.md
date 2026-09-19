# Converge

A real-time collaborative workspace for teams: shared documents (Yjs), workspace chat,
@mentions, notifications, comments and version history.

> **Status:** Phase 5 - real-time collaborative editing complete. Features are being built one phase at a time.

## Tech stack

| Layer    | Technology                                        |
| -------- | ------------------------------------------------- |
| Frontend | React, Vite, Tailwind CSS v4, React Router, TipTap (rich-text editor) |
| Backend  | Node.js, Express 5, Mongoose, Zod, helmet         |
| Auth     | JWT in HTTP-only cookies, bcrypt (bcryptjs)       |
| Database | MongoDB                                           |
| Real time | Socket.IO (WebSockets), Yjs (CRDT)               |
| Later    | Redis (added in its phase)                        |

## Project structure

```text
server/
├── index.js          entry point: connects the database, starts the server
├── app.js            builds the Express app (middlewares + routes)
├── config/           settings and external connections (env, database, auth cookie, roles and permissions)
├── service/          logic that does not belong to one route (Yjs helpers, the live document rooms, who is online, chat message formatting)
├── socket/           the real-time side: socket login check, the document protocol and the chat
├── events/           a small in-process event bus
├── model/            Mongoose models
├── validators/       Zod schemas that check what the client sends
├── controllers/      the logic of every route
├── routes/           which URL goes to which controller
└── middlewares/      functions that run before the controllers

client/src/
├── pages/            one component per screen
├── components/       small reusable UI pieces
├── features/         feature logic (auth, health, workspace, documents, chat, and the Yjs socket provider)
├── hooks/            reusable React hooks
├── services/         the API client
└── utils/            helper functions
```

## Prerequisites

- Node.js 20+
- MongoDB running locally (default `mongodb://127.0.0.1:27017`)

## Setup

```bash
# Backend
cd server
cp .env.example .env      # then set JWT_SECRET (see the comment inside the file)
npm install
npm run dev               # http://localhost:5000

# Frontend (second terminal)
cd client
npm install
npm run dev               # http://localhost:5173
```

In development the Vite dev server proxies `/api` to the Express server, so the browser
only talks to `localhost:5173`.

## Environment variables (`server/.env`)

| Variable              | Default                 | Description                                        |
| --------------------- | ----------------------- | -------------------------------------------------- |
| `NODE_ENV`            | `development`           | `development`, `test` or `production`              |
| `PORT`                | `5000`                  | API port                                           |
| `MONGODB_URI`         | *(required)*            | MongoDB connection string                          |
| `CLIENT_URL`          | `http://localhost:5173` | Allowed CORS origin and CSRF origin (the React app) |
| `JWT_SECRET`          | *(required, 32+ chars)* | Secret used to sign login tokens                   |
| `JWT_EXPIRES_IN_DAYS` | `7`                     | Login lifetime (also the cookie lifetime)          |
| `BCRYPT_ROUNDS`       | `12`                    | bcrypt cost factor                                 |
| `AUTH_RATE_LIMIT_MAX` | `10`                    | Failed login/signup attempts per IP per 15 minutes |
| `CHAT_RATE_LIMIT_MAX` | `30`                    | Chat messages per person per 10 seconds (reactions get twice as many) |

Variables are validated with Zod at startup; the server exits with a clear message if any is invalid.

## API

All endpoints live under `/api`. Every response is JSON with a `message`, plus extra fields:

```jsonc
// success
{ "message": "User Logged in Successfully", "user": { "id": "...", "name": "...", "email": "..." } }
// failure
{ "message": "Invalid Credentials" }
// validation failure: the first message, plus one message per invalid field
{ "message": "Email is not valid", "errors": { "email": "Email is not valid" } }
```

| Endpoint                                   | Login needed | Description                                          |
| ------------------------------------------ | ------------ | ---------------------------------------------------- |
| `GET /api/health`                          | no           | 200 when the API and MongoDB are up, 503 otherwise   |
| `POST /api/user/signup`                    | no           | Create an account and log in (201)                   |
| `POST /api/user/login`                     | no           | Log in; sets the HTTP-only login cookie              |
| `POST /api/user/logout`                    | no           | Clear the login cookie                               |
| `GET /api/user/profile`                    | yes          | The current user, or 401                             |
| `PATCH /api/user/profile`                  | yes          | Update the name                                      |
| `POST /api/workspace`                      | yes          | Create a workspace; you become its OWNER             |
| `GET /api/workspace`                       | yes          | Your workspaces, each with your role                 |
| `GET /api/workspace/:id`                   | member       | The workspace, your role and what you may do         |
| `PATCH /api/workspace/:id`                 | OWNER, ADMIN | Rename / change the description                      |
| `DELETE /api/workspace/:id`                | OWNER        | Delete the workspace                                 |
| `GET /api/workspace/:id/members`           | member       | The people in the workspace                          |
| `PATCH /api/workspace/:id/members/:userId` | OWNER, ADMIN | Change someone's role (below your own rank)          |
| `DELETE /api/workspace/:id/members/:userId`| OWNER, ADMIN | Remove someone (below your own rank)                 |
| `POST /api/workspace/:id/leave`            | member       | Leave (the OWNER cannot)                             |
| `POST /api/workspace/:id/invites`          | OWNER, ADMIN | Invite an email to a role below your own             |
| `GET /api/workspace/:id/invites`           | OWNER, ADMIN | Pending invitations of the workspace                 |
| `DELETE /api/workspace/:id/invites/:inviteId` | OWNER, ADMIN | Cancel an invitation                              |
| `GET /api/invite`                          | yes          | Invitations addressed to your email                  |
| `POST /api/invite/:id/accept`, `/decline`  | yes          | Answer an invitation addressed to you                |
| `POST /api/workspace/:id/documents`        | OWNER, ADMIN, MEMBER | Create a document                            |
| `GET /api/workspace/:id/documents`         | member       | The workspace's documents (without their content)    |
| `GET /api/workspace/:id/documents/:docId`  | member       | One document's details and what you may do (its content travels over the socket) |
| `PATCH /api/workspace/:id/documents/:docId`| OWNER, ADMIN, MEMBER | Rename                                       |
| `DELETE /api/workspace/:id/documents/:docId` | see below  | Delete a document                                    |
| `GET /api/workspace/:id/messages`          | member       | The latest chat messages, or a page `?before=` / `?after=` a message id (`limit` 1-50) |
| `POST /api/workspace/:id/messages`         | OWNER, ADMIN, MEMBER | Send a message, or a reply with `parentMessageId`; `mentions: [{userId}]` mentions members (201) |
| `GET /api/workspace/:id/messages/:messageId/replies` | member | The replies of a message (its thread), same paging |
| `PUT /api/workspace/:id/messages/:messageId/reactions/:emoji` | OWNER, ADMIN, MEMBER | Add your reaction (safe to repeat) |
| `DELETE /api/workspace/:id/messages/:messageId/reactions/:emoji` | OWNER, ADMIN, MEMBER | Take your reaction back |

### Roles and permissions

Every workspace route first checks that you are a member (a non-member gets `404`, so ids cannot be probed), then that your role may do the action (`403`).

| Action                          | OWNER | ADMIN | MEMBER | VIEWER |
| ------------------------------- | :---: | :---: | :----: | :----: |
| View the workspace and members  |  yes  |  yes  |  yes   |  yes   |
| Rename the workspace            |  yes  |  yes  |   -    |   -    |
| Delete the workspace            |  yes  |   -   |   -    |   -    |
| Invite, cancel invitations      |  yes  |  yes  |   -    |   -    |
| Change roles, remove members    |  yes  |  yes  |   -    |   -    |
| Leave the workspace             |   -   |  yes  |  yes   |  yes   |
| View documents                  |  yes  |  yes  |  yes   |  yes   |
| Create, rename and edit documents |  yes  |  yes  |  yes   |   -    |
| Delete any document             |  yes  |  yes  |   -    |   -    |
| Delete a document you created   |  yes  |  yes  |  yes   |   -    |
| Read the chat and its threads   |  yes  |  yes  |  yes   |  yes   |
| Send messages, reply, react     |  yes  |  yes  |  yes   |   -    |

One more rule sits on top: **you can only manage people who rank below you**, and only give roles below your own.
So an ADMIN cannot change or remove another ADMIN or the OWNER, and nobody can make someone OWNER.
The matrix lives in one file, `server/config/permissions.js`.

### Real-time editing (WebSocket and Yjs architecture)

Documents are edited live by several people at once. Two technologies do the work:

- **Yjs** is a CRDT (conflict-free replicated data type). Every edit is a small binary *update* that can be applied in any order on any copy and always gives the same result, so concurrent edits merge instead of conflicting.
- **Socket.IO** (WebSockets) is the transport. It gives a permanent two-way connection, one *room* per open document, automatic reconnection and binary messages.

```text
Browser A: TipTap <-> Yjs doc                 Browser B: TipTap <-> Yjs doc
              \                                        /
               \----- Socket.IO (same port as the API) -/
                                  |
                Server: one live Yjs doc per open document  (service/docRoomService.js)
                                  |
                MongoDB: Yjs state (source of truth) + a readable JSON snapshot
```

**Protocol** (`socket/documentSocketHandlers.js`):

| Message | Direction | Meaning |
| --- | --- | --- |
| `doc:join {workspaceId, documentId, stateVector}` | browser to server | "I want this document; here is a summary of what I already have" |
| `doc:sync {update, stateVector}` | server to browser | what the browser is missing, and the server's summary. The browser then sends back what the server is missing (edits made offline) |
| `doc:update {update}` | both ways | a live edit |
| `doc:awareness {update}` | both ways | presence: who is here and where their cursor is (temporary, never saved) |
| `doc:error {code, message}` | server to browser | `ACCESS_REVOKED`, `DOCUMENT_DELETED`, `READ_ONLY`, `INVALID_UPDATE`, ... |

**Going offline:** the browser keeps its Yjs document, so typing continues. When the connection returns the join handshake exchanges exactly what each side is missing, and both merge.

**Saving:** the server keeps the live document in memory while people are in it and writes it to MongoDB at most every 2 seconds and when the last person leaves.

**Security of the real-time layer:**
- The socket handshake uses the same HTTP-only login cookie as the REST API, and is refused for any `Origin` other than `CLIENT_URL` (cross-site WebSocket hijacking).
- Joining needs workspace membership and `document:view`; sending edits needs `document:edit`. Outsiders get the same "not found" as for a document that does not exist. Membership is checked again once the tab is registered in the room, so a person removed while joining is not let in.
- Removing a member, changing a role, or deleting a document or workspace sends the affected people out of the room immediately.
- Every incoming Yjs update is decoded and checked against the same whitelist as saved documents (allowed node types, marks and attributes; links only `http`, `https` or `mailto`) before it is applied or forwarded, and the whole document is checked again before it is saved.
- Presence is controlled by the server: names and colours come from the logged in user, a Yjs client id belongs to the first connection that uses it, and cursors are cleaned.
- Limits: 1 MB per message, a message rate per connection, and a size limit per document.
- Limitation: the rooms live in one server process. Running several instances needs Redis Pub/Sub (planned).

### Workspace chat

Every workspace has one chat, with one-level threads and emoji reactions. Messages are plain text (1 to 4000 characters) stored in MongoDB.

**Writing goes through REST, reading arrives live.** A message is sent with `POST /api/workspace/:id/messages`, so validation, permissions and rate limiting live in one place. The controller then announces `message:created` on the in-process event bus (`events/appEvents.js`), and the socket layer pushes it to everybody who has that workspace's chat open. Sockets never save anything, they only deliver.

```text
POST /messages -> validate -> save in MongoDB -> event bus: message:created -> Socket.IO room chat:<workspaceId>
                                                                                   -> every open browser
                                                                                      (the sender's own copy is recognised by its id and shown once)
```

- **Pagination** uses a cursor (the id of a message) instead of page numbers, so messages arriving while somebody scrolls cannot shift or repeat anything. The order is `(createdAt, _id)`, which stays strict for messages created in the same millisecond.
- **Threads** have one level: a reply cannot have replies. The parent keeps an atomic reply counter (`$inc`) and the time of the last reply (`$max`).
- **Reactions** are stored as `{ emoji: [userIds] }` and changed with `$addToSet` / `$pull`, so people reacting at the same instant never overwrite each other. Only the 8 emoji of a fixed list (`config/reactions.js`) are accepted, which also keeps user input out of database field names.
- **Rate limits**, per person: `CHAT_RATE_LIMIT_MAX` messages per 10 seconds, and twice as many reactions.

**Live protocol** (`socket/chatSocketHandlers.js`):

| Message | Direction | Meaning |
| --- | --- | --- |
| `chat:join {workspaceId}` | browser to server | open the chat. The answer is `{ok, canSend, onlineUserIds}` |
| `chat:leave` | browser to server | close it |
| `chat:message {chatMessage}` | server to browser | a new message or reply |
| `chat:message-updated {chatMessage}` | server to browser | new reactions, or a new reply count |
| `presence:update {userId, online}` | server to browser | somebody opened or closed the chat |
| `chat:access {canSend}` | server to browser | your role changed, you may still read |
| `chat:error {code, message}` | server to browser | `ACCESS_REVOKED`, `WORKSPACE_DELETED` |

**Presence** means "has this workspace's chat open in at least one tab". Two tabs of the same person count as one person: they come online with the first tab and go offline when the last one closes. It lives in server memory (`service/presenceService.js`) and is never saved.

**Reconnecting:** the browser joins the room first and only then reads the history, so a message sent in between shows up in both and is shown once. After a lost connection it reads the latest page again: this fills in what was missed and refreshes reactions and reply counts. If more than one page was missed, the list starts again from the newest messages and the older ones load on demand.

**Mentions.** Typing `@` in the message box lists the workspace members. A person chosen from the list becomes a *structured* mention, stored with the message as `mentions: [{ userId, displayName }]`. A `@Priya` typed completely by hand stays plain text.

```jsonc
// POST /api/workspace/:id/messages
{ "content": "hi @Priya please look", "mentions": [{ "userId": "..." }] }
```

The client only says WHO is meant. The server decides the rest (`service/mentionService.js`):
- every mentioned person must be a member of this workspace (`400` otherwise);
- the stored `displayName` is the person's real name from the database, never a name sent by the client;
- the text must really contain `@Name` (`mail@Name` and `@Namex` do not count, names are matched as plain text), so nobody can be mentioned invisibly, which would otherwise be a way to spam notifications;
- at most 20 mentions per message, and the same person twice is one mention.

Each stored mention emits `mention:created` `{ workspaceId, recipientId, senderId, sourceType: "MESSAGE", sourceId }` on the event bus, which is what notifications will listen to.

In the browser the arrow keys move in the list, Enter or Tab (or a click) choose, Escape closes it. If a chosen name is edited away, that person is not mentioned. Mentions are highlighted (yours in yellow, and the whole message is tinted); the text is built from separate text pieces, never from HTML.

**Security of the chat:**
- Same cookie login and `Origin` check as the document sockets. Joining needs membership and `chat:view`; everybody else gets the same "not found".
- The workspace id is checked to be a plain 24-character id before it reaches the database, and membership is checked again once the tab is registered, so a person removed during the join does not stay in.
- Removing a member, leaving, or deleting the workspace closes that person's chat immediately. A role change keeps a reader in the chat and only tells the browser whether it may still send.
- Every chat query is scoped to the workspace in the URL: a message id from another workspace is "not found".
- Message text is shown as plain text by React, so nothing a person writes can run as HTML.
- A mention can only point at a member of the workspace; the name and the visibility of a mention are decided by the server, and the mention list is limited to 20.
- Limitations: the list of people offered by `@` is loaded when the chat page opens (somebody who joined later appears after a reload, somebody who left is refused by the server with a clear message); names are matched case-sensitively, and a stored name is a snapshot (old messages keep the name a person had then); presence and the rate-limit counters live in one server process (Redis in a later phase); messages cannot be edited or deleted yet; a reaction given while a browser was offline shows up on the recent messages after it reconnects, and on very old ones after a reload.

### Authentication and security

- Passwords are hashed with bcrypt (max 72 bytes, the bcrypt limit); hashes never leave the server.
- Login sets a signed JWT in an **HTTP-only, SameSite=Lax** cookie (`Secure` in production). Tokens are never
  stored in `localStorage` or returned in response bodies.
- Wrong email and wrong password return the same 401, with equalised timing, so accounts cannot be discovered.
- Failed login/signup attempts are rate limited per IP.
- Requests that change data and come from an `Origin` other than `CLIENT_URL` are rejected (CSRF protection).
- Every request body is validated with Zod; unknown fields are dropped.
- Rich text is checked on the server against a whitelist of the editor's node types, marks and attributes; links may only be `http`, `https` or `mailto`, so a modified client cannot store scripts or `javascript:` links.

## Scripts

| Where     | Command         | Purpose                     |
| --------- | --------------- | --------------------------- |
| `server/` | `npm run dev`   | Start the API with reload   |
| `server/` | `npm start`     | Start the API               |
| `client/` | `npm run dev`   | Start the Vite dev server   |
| `client/` | `npm run build` | Production build            |
| `client/` | `npm run lint`  | Lint with oxlint            |

# Converge

A real-time collaborative workspace for teams: shared documents (Yjs), workspace chat,
@mentions, notifications, comments and version history.

> **Status:** Phase 4 - documents with a rich-text editor complete. Features are being built one phase at a time.

## Tech stack

| Layer    | Technology                                        |
| -------- | ------------------------------------------------- |
| Frontend | React, Vite, Tailwind CSS v4, React Router, TipTap (rich-text editor) |
| Backend  | Node.js, Express 5, Mongoose, Zod, helmet         |
| Auth     | JWT in HTTP-only cookies, bcrypt (bcryptjs)       |
| Database | MongoDB                                           |
| Later    | Socket.IO, Yjs + TipTap, Redis (added per phase)  |

## Project structure

```text
server/
├── index.js          entry point: connects the database, starts the server
├── app.js            builds the Express app (middlewares + routes)
├── config/           settings and external connections (env, database, auth cookie, roles and permissions)
├── model/            Mongoose models
├── validators/       Zod schemas that check what the client sends
├── controllers/      the logic of every route
├── routes/           which URL goes to which controller
└── middlewares/      functions that run before the controllers

client/src/
├── pages/            one component per screen
├── components/       small reusable UI pieces
├── features/         feature logic (auth, health, workspace, documents)
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
| `GET /api/workspace/:id/documents/:docId`  | member       | One document with its content and version           |
| `PATCH /api/workspace/:id/documents/:docId`| OWNER, ADMIN, MEMBER | Rename                                       |
| `PUT /api/workspace/:id/documents/:docId/content` | OWNER, ADMIN, MEMBER | Save the content (`{content, version}`; 409 if the version is stale) |
| `DELETE /api/workspace/:id/documents/:docId` | see below  | Delete a document                                    |

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

One more rule sits on top: **you can only manage people who rank below you**, and only give roles below your own.
So an ADMIN cannot change or remove another ADMIN or the OWNER, and nobody can make someone OWNER.
The matrix lives in one file, `server/config/permissions.js`.

### Authentication and security

- Passwords are hashed with bcrypt (max 72 bytes, the bcrypt limit); hashes never leave the server.
- Login sets a signed JWT in an **HTTP-only, SameSite=Lax** cookie (`Secure` in production). Tokens are never
  stored in `localStorage` or returned in response bodies.
- Wrong email and wrong password return the same 401, with equalised timing, so accounts cannot be discovered.
- Failed login/signup attempts are rate limited per IP.
- Requests that change data and come from an `Origin` other than `CLIENT_URL` are rejected (CSRF protection).
- Every request body is validated with Zod; unknown fields are dropped.
- Rich text is checked on the server against a whitelist of the editor's node types, marks and attributes; links may only be `http`, `https` or `mailto`, so a modified client cannot store scripts or `javascript:` links.
- Saving a document needs the version it was based on; a stale save gets `409` instead of silently overwriting someone else's edit.

## Scripts

| Where     | Command         | Purpose                     |
| --------- | --------------- | --------------------------- |
| `server/` | `npm run dev`   | Start the API with reload   |
| `server/` | `npm start`     | Start the API               |
| `client/` | `npm run dev`   | Start the Vite dev server   |
| `client/` | `npm run build` | Production build            |
| `client/` | `npm run lint`  | Lint with oxlint            |

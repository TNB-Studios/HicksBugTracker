# Local Development Guide

This document explains how to set up and run the Task Manager application locally for development.

---

## Prerequisites

Before you begin, ensure you have the following installed:

1. **Node.js** (v20.x or higher recommended)
   - Check version: `node --version`
   - Download: https://nodejs.org/

2. **npm** (comes with Node.js)
   - Check version: `npm --version`

3. **MongoDB** (v7.x recommended)
   - Either installed locally, running in Docker, or using MongoDB Atlas (cloud)
   - Check if running: `mongosh --eval "db.version()"`

---

## Project Structure

```
Hicks/
├── client/          # React frontend (runs on port 5173)
├── server/          # Express backend (runs on port 5000)
├── PROJECT_PLAN.md
├── PROJECT_STATUS.md
├── DEVELOPMENT.md   # This file
└── DEPLOYMENT.md
```

---

## Initial Setup (First Time Only)

### 1. Install Dependencies

Open two terminal windows/tabs:

**Terminal 1 - Backend:**
```bash
cd ~/TNB/Hicks/server
npm install
```

**Terminal 2 - Frontend:**
```bash
cd ~/TNB/Hicks/client
npm install
```

### 2. Configure Environment

Edit the backend environment file:

```bash
nano ~/TNB/Hicks/server/.env
```

Ensure these values are set:
```env
PORT=5000
NODE_ENV=development
MONGODB_URI=mongodb://localhost:27017/task-manager
```

If using MongoDB Atlas, replace `MONGODB_URI` with your Atlas connection string:
```env
MONGODB_URI=mongodb+srv://username:password@cluster.xxxxx.mongodb.net/task-manager
```

### 3. Start MongoDB

**Option A - Local MongoDB:**
```bash
# If installed via apt/package manager and using systemd:
sudo systemctl start mongod

# If running manually (WSL):
mongod --dbpath /data/db --fork --logpath /var/log/mongodb.log

# Or simply:
mongod --dbpath ~/mongodb-data
```

**Option B - Docker:**
```bash
docker run -d -p 27017:27017 --name mongodb mongo:7.0
```

**Option C - MongoDB Atlas:**
No local MongoDB needed - just ensure your connection string is correct in `.env`

---

## Running the Application (Daily Development)

You need **three things running** simultaneously:
1. MongoDB (database)
2. Backend server (API)
3. Frontend dev server (UI)

### Step 1: Ensure MongoDB is Running

```bash
# Check if MongoDB is running:
mongosh --eval "db.version()"

# If not running, start it (see options above)
```

### Step 2: Start the Backend Server

Open a terminal:
```bash
cd ~/TNB/Hicks/server
npm run dev
```

You should see:
```
[nodemon] starting `node server.js`
Server running on port 5000
Connected to MongoDB
```

The backend API is now available at: **http://localhost:5000**

### Step 3: Start the Frontend Dev Server

Open another terminal:
```bash
cd ~/TNB/Hicks/client
npm run dev
```

You should see:
```
  VITE v7.x.x  ready in XXX ms

  ➜  Local:   http://localhost:5173/
  ➜  Network: http://192.168.x.x:5173/
```

The frontend is now available at: **http://localhost:5173**

### Step 4: Open in Browser

Open your web browser and navigate to:
```
http://localhost:5173
```

You should see the Task Manager application.

---

## Development Workflow

### Making Changes

- **Frontend changes** (React components, CSS):
  - Edit files in `client/src/`
  - Vite hot-reloads automatically - changes appear instantly in browser

- **Backend changes** (API routes, models):
  - Edit files in `server/`
  - Nodemon auto-restarts the server on file save

- **No manual restart needed** for most changes during development

### Stopping the Servers

In each terminal, press `Ctrl + C` to stop the server.

### Restarting Fresh

```bash
# Kill everything and restart:

# Terminal 1 (Backend):
cd ~/TNB/Hicks/server
npm run dev

# Terminal 2 (Frontend):
cd ~/TNB/Hicks/client
npm run dev
```

---

## Common Commands Reference

### Backend (server/)

| Command | Description |
|---------|-------------|
| `npm run dev` | Start server with auto-reload (development) |
| `npm start` | Start server without auto-reload (production) |
| `npm install <package>` | Add a new dependency |

### Frontend (client/)

| Command | Description |
|---------|-------------|
| `npm run dev` | Start Vite dev server with hot reload |
| `npm run build` | Build for production (outputs to `dist/`) |
| `npm run preview` | Preview production build locally |
| `npm install <package>` | Add a new dependency |

### MongoDB

| Command | Description |
|---------|-------------|
| `mongosh` | Open MongoDB shell |
| `mongosh task-manager` | Connect directly to task-manager database |
| `show dbs` | List all databases (in mongosh) |
| `show collections` | List all collections (in mongosh) |

---

## Ports Summary

| Service | Port | URL |
|---------|------|-----|
| Frontend (Vite) | 5173 | http://localhost:5173 |
| Backend (Express) | 5000 | http://localhost:5000 |
| MongoDB | 27017 | mongodb://localhost:27017 |

---

## Troubleshooting

### "Cannot connect to MongoDB"
- Ensure MongoDB is running: `mongosh --eval "db.version()"`
- Check the connection string in `server/.env`
- For Atlas: ensure your IP is whitelisted

### "Port 5000 already in use"
```bash
# Find what's using port 5000:
lsof -i :5000

# Kill it:
kill -9 <PID>
```

### "Port 5173 already in use"
```bash
# Find what's using port 5173:
lsof -i :5173

# Kill it:
kill -9 <PID>
```

### Frontend can't reach backend (CORS errors)
- Ensure backend is running on port 5000
- Check that CORS is configured in `server/server.js`
- Verify the API URL in `client/src/services/api.js`

### Changes not appearing
- Frontend: Hard refresh browser (`Ctrl + Shift + R`)
- Backend: Check terminal for errors, restart with `npm run dev`

---

## Development Tools (Recommended)

### Browser Extensions
- **React Developer Tools** - Inspect React component tree
- **MongoDB Compass** - GUI for viewing/editing database

### VS Code Extensions
- ESLint - JavaScript linting
- Prettier - Code formatting
- ES7+ React/Redux/React-Native snippets

### API Testing
- **Postman** or **Insomnia** - Test backend API endpoints directly
- Example: `GET http://localhost:5000/api/boards`

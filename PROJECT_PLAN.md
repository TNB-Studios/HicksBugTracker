# Trello-Like Task Management Application - Project Plan

## Project Overview
A web-based task management application similar to Trello, built with Node.js backend, React.js frontend, and MongoDB database.

---

## Tech Stack

### Frontend
- **React.js** - UI framework
- **Node.js** - Runtime environment
- **Vite** - Build tool and dev server (faster alternative to Create React App)

### Backend
- **Node.js** - Server runtime
- **Express.js** - Web framework
- **MongoDB** - Database
- **Mongoose** - MongoDB ODM

---

## Required Dependencies

### Backend Package Dependencies (`server/package.json`)

**Production Dependencies:**
```json
{
  "express": "^4.18.2",
  "mongoose": "^8.0.0",
  "cors": "^2.8.5",
  "dotenv": "^16.3.1",
  "express-validator": "^7.0.1"
}
```

**Development Dependencies:**
```json
{
  "nodemon": "^3.0.1"
}
```

**Dependency Explanations:**
- `express` - Web application framework for building REST API
- `mongoose` - MongoDB object modeling for schema definition and validation
- `cors` - Enable Cross-Origin Resource Sharing between frontend and backend
- `dotenv` - Load environment variables from .env file
- `express-validator` - Request validation middleware
- `nodemon` - Auto-restart server during development

---

### Frontend Package Dependencies (`client/package.json`)

**Production Dependencies:**
```json
{
  "react": "^18.2.0",
  "react-dom": "^18.2.0",
  "axios": "^1.6.0",
  "@dnd-kit/core": "^6.1.0",
  "@dnd-kit/sortable": "^8.0.0",
  "@dnd-kit/utilities": "^3.2.2"
}
```

**Development Dependencies:**
```json
{
  "@vitejs/plugin-react": "^4.2.0",
  "vite": "^5.0.0",
  "eslint": "^8.55.0",
  "eslint-plugin-react": "^7.33.2"
}
```

**Dependency Explanations:**
- `react` - Core React library
- `react-dom` - React rendering for web
- `axios` - HTTP client for API calls
- `@dnd-kit/*` - Modern drag-and-drop library for React (lightweight, accessible)
- `vite` - Fast build tool and dev server
- `@vitejs/plugin-react` - Vite plugin for React support
- `eslint` - Code linting

**Alternative DnD Libraries (choose one):**
- `react-beautiful-dnd` - More mature but heavier (deprecated)
- `@dnd-kit` - Recommended - modern, lightweight, better accessibility
- `react-dnd` - Lower level, more complex

---

## System Requirements

### Software to Install
1. **Node.js** (v18.x or higher)
   - Download from: https://nodejs.org/
   - Includes npm (package manager)

2. **MongoDB** (v6.x or higher)
   - **Option A - Local Installation:**
     - Download from: https://www.mongodb.com/try/download/community
     - Or use MongoDB Atlas (cloud free tier)
   - **Option B - Docker:**
     ```bash
     docker run -d -p 27017:27017 --name mongodb mongo:latest
     ```

3. **MongoDB Compass** (Optional - GUI for database)
   - Download from: https://www.mongodb.com/products/compass

---

## Project Structure

```
Hicks/
├── client/                 # React frontend
│   ├── public/
│   ├── src/
│   │   ├── components/
│   │   │   ├── Board/
│   │   │   │   ├── Board.jsx
│   │   │   │   ├── Column.jsx
│   │   │   │   └── TaskCard.jsx
│   │   │   ├── BoardSelector/
│   │   │   │   └── BoardSelector.jsx
│   │   │   ├── Filters/
│   │   │   │   └── FilterPanel.jsx
│   │   │   └── TaskModal/
│   │   │       └── TaskModal.jsx
│   │   ├── context/
│   │   │   └── AppContext.jsx
│   │   ├── services/
│   │   │   └── api.js
│   │   ├── App.jsx
│   │   ├── App.css
│   │   └── main.jsx
│   ├── package.json
│   └── vite.config.js
│
├── server/                 # Express backend
│   ├── models/
│   │   ├── Board.js
│   │   ├── Column.js
│   │   └── Task.js
│   ├── routes/
│   │   ├── boards.js
│   │   ├── columns.js
│   │   └── tasks.js
│   ├── middleware/
│   │   └── errorHandler.js
│   ├── config/
│   │   └── db.js
│   ├── server.js
│   ├── package.json
│   └── .env
│
├── PROJECT_PLAN.md         # This file
└── PROJECT_STATUS.md       # Implementation status tracker
```

---

## Database Schema Design

### Board Schema
```javascript
{
  _id: ObjectId,
  name: String (required),
  createdAt: Date,
  updatedAt: Date,
  columnOrder: [ObjectId] // References to Column documents
}
```

### Column Schema
```javascript
{
  _id: ObjectId,
  boardId: ObjectId (required, ref: 'Board'),
  name: String (required),
  isDefault: Boolean, // true for Backlog, Next Up, Current, Completed
  order: Number,
  taskIds: [ObjectId] // Ordered list of task IDs in this column
}
```

### Task Schema
```javascript
{
  _id: ObjectId,
  boardId: ObjectId (required, ref: 'Board'),
  columnId: ObjectId (required, ref: 'Column'),
  name: String (required),
  description: String,
  state: String (enum: ['Backlog', 'Next Up', 'Current', 'Completed', ...custom]),
  assignedTo: String,
  reportedBy: String,
  dateCreated: Date,
  comments: [{
    text: String,
    author: String,
    date: Date
  }],
  order: Number // Position within column
}
```

---

## API Endpoints Design

### Boards
- `GET /api/boards` - Get all boards
- `GET /api/boards/:id` - Get single board with columns and tasks
- `POST /api/boards` - Create new board
- `PUT /api/boards/:id` - Update board name
- `DELETE /api/boards/:id` - Delete board (cascade delete columns and tasks)

### Columns
- `GET /api/boards/:boardId/columns` - Get all columns for a board
- `POST /api/boards/:boardId/columns` - Create new column
- `PUT /api/columns/:id` - Update column name or order
- `DELETE /api/columns/:id` - Delete column (only if not default)
- `PUT /api/boards/:boardId/columns/reorder` - Reorder columns

### Tasks
- `GET /api/boards/:boardId/tasks` - Get all tasks (with filters)
- `GET /api/tasks/:id` - Get single task
- `POST /api/tasks` - Create new task
- `PUT /api/tasks/:id` - Update task properties
- `DELETE /api/tasks/:id` - Delete task
- `PUT /api/tasks/:id/move` - Move task to different column

---

## Implementation Phases

### Phase 1: Project Setup
1. Create project directory structure
2. Initialize backend Node.js project (`npm init`)
3. Initialize frontend React project with Vite
4. Install all dependencies
5. Set up MongoDB connection
6. Create .env file for configuration

### Phase 2: Backend Development
1. Set up Express server
2. Configure MongoDB connection with Mongoose
3. Define Mongoose schemas (Board, Column, Task)
4. Implement API routes for boards
5. Implement API routes for columns
6. Implement API routes for tasks
7. Add error handling middleware
8. Test API endpoints with Postman or similar

### Phase 3: Frontend Foundation
1. Set up Vite React project
2. Create basic component structure
3. Set up React Context for state management
4. Create API service layer with axios
5. Build basic layout and styling

### Phase 4: Core Features
1. Implement board selector dropdown
2. Build column display
3. Build task card components
4. Implement task creation/editing modal
5. Connect components to backend API

### Phase 5: Drag and Drop
1. Install and configure @dnd-kit
2. Implement drag-and-drop for tasks between columns
3. Implement column reordering
4. Update backend on drag operations

### Phase 6: Filtering System
1. Build filter panel component
2. Implement state filter (multi-select)
3. Implement assigned-to filter
4. Implement text search filter
5. Combine filters with AND logic
6. Update task display based on active filters

### Phase 7: Board Management
1. Implement board creation modal
2. Implement board deletion with confirmation
3. Implement board switching
4. Handle default columns creation for new boards

### Phase 8: Polish and Testing
1. Add loading states
2. Add error handling and user feedback
3. Improve UI/UX
4. Test all features
5. Fix bugs

---

## Future Enhancements (Not in Initial Scope)

### Remote Database Migration
- Update MongoDB connection string to remote server
- Set up MongoDB Atlas or self-hosted MongoDB
- Handle connection security (SSL, authentication)

### Authentication with Authentik
**Additional Dependencies:**
- `passport` - Authentication middleware
- `passport-oauth2` or `openid-client` - OAuth/OIDC client
- `express-session` - Session management
- `connect-mongo` - MongoDB session store

**Implementation:**
1. Set up Authentik server
2. Configure OAuth2/OIDC client in application
3. Add User schema to database
4. Implement login/logout routes
5. Add authentication middleware to protected routes
6. Add userId to board/task schemas
7. Implement board permissions (viewers, editors, admins)

---

## Environment Variables (.env)

```bash
# Server Configuration
PORT=5000
NODE_ENV=development

# Database
MONGODB_URI=mongodb://localhost:27017/task-manager

# Future: Authentication
# AUTHENTIK_CLIENT_ID=your_client_id
# AUTHENTIK_CLIENT_SECRET=your_client_secret
# AUTHENTIK_ISSUER=https://your-authentik-instance.com
# SESSION_SECRET=your_session_secret
```

---

## Development Commands

### Backend
```bash
cd server
npm install              # Install dependencies
npm run dev              # Start server with nodemon
npm start                # Start server in production
```

### Frontend
```bash
cd client
npm install              # Install dependencies
npm run dev              # Start development server (default: http://localhost:5173)
npm run build            # Build for production
npm run preview          # Preview production build
```

---

## Estimated Package Sizes

**Backend:** ~50-60 MB (node_modules)
**Frontend:** ~200-250 MB (node_modules)
**MongoDB:** ~500 MB (application)

---

## Key Architectural Decisions

1. **State Management:** React Context API (sufficient for this app size)
   - Alternative: Redux Toolkit (if app grows significantly)

2. **Drag and Drop:** @dnd-kit
   - Modern, lightweight, good accessibility
   - Better than deprecated react-beautiful-dnd

3. **Build Tool:** Vite
   - Much faster than Create React App
   - Better developer experience

4. **Database:** MongoDB with Mongoose
   - Flexible schema for evolving requirements
   - Good for document-based task storage
   - Easy to add fields later

5. **API Design:** RESTful
   - Clear, standard endpoints
   - Easy to understand and maintain
   - Future: Could migrate to GraphQL if needed

---

## Notes

- All default columns (Backlog, Next Up, Current, Completed) are created automatically when a board is created
- Default columns cannot be deleted but can be reordered
- Custom columns can be added and deleted freely
- Tasks maintain their column association via `columnId` reference
- Drag operations update both task's `columnId` and the column's `taskIds` array
- Filters are applied client-side for now; can be moved to server-side for performance with large datasets

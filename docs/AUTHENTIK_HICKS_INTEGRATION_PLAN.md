# Authentik + Hicks Bug Hunt Integration Plan

This document outlines how to integrate Authentik authentication with the Hicks Bug Hunt application, including board-level access control.

## Overview

We will use OAuth2/OpenID Connect (OIDC) to:
1. Require users to log in via Authentik to access Hicks
2. Retrieve user identity and group memberships
3. Restrict board access based on user groups

## Architecture

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Browser   │────▶│ Hicks React │────▶│ Hicks API   │
│             │◀────│   Client    │◀────│  (Express)  │
└─────────────┘     └─────────────┘     └─────────────┘
                           │                   │
                           │ OAuth2/OIDC       │ Validate Token
                           ▼                   ▼
                    ┌─────────────────────────────┐
                    │         Authentik           │
                    │   (Identity Provider)       │
                    └─────────────────────────────┘
```

## Phase 1: Create OAuth2 Application in Authentik

### 1.1 Create OAuth2/OpenID Provider

1. Log in to Authentik admin: `https://auth.yourdomain.com/if/admin/`
2. Go to Applications > Providers
3. Click "Create" and select "OAuth2/OpenID Provider"
4. Configure:
   - Name: `Hicks Bug Hunt`
   - Authorization flow: `default-provider-authorization-explicit-consent`
   - Client type: `Confidential`
   - Client ID: (auto-generated, save this)
   - Client Secret: (auto-generated, save this)
   - Redirect URIs:
     ```
     http://localhost:5173/callback
     https://hicks.yourdomain.com/callback
     ```
   - Scopes: `openid`, `email`, `profile`

### 1.2 Create Application

1. Go to Applications > Applications
2. Click "Create"
3. Configure:
   - Name: `Hicks Bug Hunt`
   - Slug: `hicks`
   - Provider: Select the provider created above
   - Launch URL: `https://hicks.yourdomain.com`

### 1.3 Configure Group Claims

1. Go to Customization > Property Mappings
2. Create new "Scope Mapping":
   - Name: `Hicks Groups`
   - Scope name: `groups`
   - Expression:
     ```python
     return [group.name for group in request.user.ak_groups.all()]
     ```
3. Add this scope to the Hicks provider

## Phase 2: Update Hicks Backend (Express)

### 2.1 Install Dependencies

```bash
cd /home/jakes/TNB/Hicks/server
npm install express-openid-connect jsonwebtoken jwks-rsa
```

### 2.2 Environment Variables

Add to `server/.env`:
```
# Authentik OIDC Configuration
OIDC_ISSUER_URL=https://auth.yourdomain.com/application/o/hicks/
OIDC_CLIENT_ID=your-client-id
OIDC_CLIENT_SECRET=your-client-secret
OIDC_CALLBACK_URL=http://localhost:5173/callback
SESSION_SECRET=generate-a-long-random-string
```

### 2.3 Create Authentication Middleware

Create `server/middleware/auth.js`:
```javascript
const { auth, requiresAuth } = require('express-openid-connect');

const authConfig = {
  authRequired: false,  // Not all routes require auth
  auth0Logout: true,
  issuerBaseURL: process.env.OIDC_ISSUER_URL,
  baseURL: process.env.BASE_URL || 'http://localhost:5000',
  clientID: process.env.OIDC_CLIENT_ID,
  clientSecret: process.env.OIDC_CLIENT_SECRET,
  secret: process.env.SESSION_SECRET,
  idpLogout: true,
  authorizationParams: {
    response_type: 'code',
    scope: 'openid profile email groups'
  }
};

// Middleware to check if user has access to a board
const requireBoardAccess = async (req, res, next) => {
  if (!req.oidc.isAuthenticated()) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const userGroups = req.oidc.user.groups || [];
  const boardId = req.params.boardId || req.body.boardId;

  // Admins have access to everything
  if (userGroups.includes('hicks-admins')) {
    return next();
  }

  // Check board-specific access
  // This will be implemented with board permissions in the database
  const board = await Board.findById(boardId);
  if (!board) {
    return res.status(404).json({ error: 'Board not found' });
  }

  // Check if user's groups intersect with board's allowed groups
  const hasAccess = board.allowedGroups.some(g => userGroups.includes(g));
  if (!hasAccess) {
    return res.status(403).json({ error: 'Access denied to this board' });
  }

  next();
};

module.exports = { authConfig, auth, requiresAuth, requireBoardAccess };
```

### 2.4 Update Express App

Update `server/server.js`:
```javascript
const { authConfig, auth } = require('./middleware/auth');

// Add auth middleware (before routes)
app.use(auth(authConfig));

// Add user info endpoint
app.get('/api/me', (req, res) => {
  if (!req.oidc.isAuthenticated()) {
    return res.status(401).json({ authenticated: false });
  }
  res.json({
    authenticated: true,
    user: {
      email: req.oidc.user.email,
      name: req.oidc.user.name,
      groups: req.oidc.user.groups || []
    }
  });
});
```

### 2.5 Update Board Schema

Update `server/models/Board.js` to include access control:
```javascript
const boardSchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: { type: String },
  // Access control
  isPublic: { type: Boolean, default: false },
  allowedGroups: [{ type: String }],  // Authentik group names
  allowedUsers: [{ type: String }],   // Specific user emails
  owner: { type: String },            // Email of board creator
}, { timestamps: true });
```

### 2.6 Protect Board Routes

Update `server/routes/boards.js`:
```javascript
const { requiresAuth, requireBoardAccess } = require('../middleware/auth');

// Get all boards (filtered by user access)
router.get('/', requiresAuth(), async (req, res, next) => {
  try {
    const userGroups = req.oidc.user.groups || [];
    const userEmail = req.oidc.user.email;

    let boards;
    if (userGroups.includes('hicks-admins')) {
      // Admins see all boards
      boards = await Board.find().sort({ createdAt: -1 });
    } else {
      // Users see only boards they have access to
      boards = await Board.find({
        $or: [
          { isPublic: true },
          { owner: userEmail },
          { allowedUsers: userEmail },
          { allowedGroups: { $in: userGroups } }
        ]
      }).sort({ createdAt: -1 });
    }

    res.json({ success: true, data: boards });
  } catch (error) {
    next(error);
  }
});

// Board-specific routes require board access
router.get('/:id', requiresAuth(), requireBoardAccess, async (req, res, next) => {
  // ... existing code
});
```

## Phase 3: Update Hicks Frontend (React)

### 3.1 Install Dependencies

```bash
cd /home/jakes/TNB/Hicks/client
npm install oidc-client-ts react-oidc-context
```

### 3.2 Create Auth Configuration

Create `client/src/auth/authConfig.js`:
```javascript
export const oidcConfig = {
  authority: import.meta.env.VITE_OIDC_AUTHORITY,
  client_id: import.meta.env.VITE_OIDC_CLIENT_ID,
  redirect_uri: `${window.location.origin}/callback`,
  post_logout_redirect_uri: window.location.origin,
  scope: 'openid profile email groups',
  response_type: 'code',
};
```

### 3.3 Environment Variables

Create `client/.env`:
```
VITE_OIDC_AUTHORITY=https://auth.yourdomain.com/application/o/hicks/
VITE_OIDC_CLIENT_ID=your-client-id
VITE_API_URL=http://localhost:5000/api
```

### 3.4 Wrap App with Auth Provider

Update `client/src/main.jsx`:
```javascript
import { AuthProvider } from 'react-oidc-context';
import { oidcConfig } from './auth/authConfig';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AuthProvider {...oidcConfig}>
      <App />
    </AuthProvider>
  </React.StrictMode>
);
```

### 3.5 Create Auth Components

Create `client/src/components/Auth/LoginButton.jsx`:
```javascript
import { useAuth } from 'react-oidc-context';

export default function LoginButton() {
  const auth = useAuth();

  if (auth.isLoading) {
    return <span>Loading...</span>;
  }

  if (auth.isAuthenticated) {
    return (
      <div className="user-menu">
        <span>{auth.user?.profile.name || auth.user?.profile.email}</span>
        <button onClick={() => auth.removeUser()}>Log out</button>
      </div>
    );
  }

  return <button onClick={() => auth.signinRedirect()}>Log in</button>;
}
```

Create `client/src/components/Auth/ProtectedRoute.jsx`:
```javascript
import { useAuth } from 'react-oidc-context';

export default function ProtectedRoute({ children }) {
  const auth = useAuth();

  if (auth.isLoading) {
    return <div className="loading">Loading...</div>;
  }

  if (!auth.isAuthenticated) {
    return (
      <div className="login-required">
        <h2>Login Required</h2>
        <p>Please log in to access Hicks Bug Hunt</p>
        <button onClick={() => auth.signinRedirect()}>Log in with Authentik</button>
      </div>
    );
  }

  return children;
}
```

Create `client/src/components/Auth/Callback.jsx`:
```javascript
import { useEffect } from 'react';
import { useAuth } from 'react-oidc-context';
import { useNavigate } from 'react-router-dom';

export default function Callback() {
  const auth = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (auth.isAuthenticated) {
      navigate('/');
    }
  }, [auth.isAuthenticated, navigate]);

  return <div className="loading">Completing login...</div>;
}
```

### 3.6 Update App Component

Update `client/src/App.jsx`:
```javascript
import { useAuth } from 'react-oidc-context';
import ProtectedRoute from './components/Auth/ProtectedRoute';
import LoginButton from './components/Auth/LoginButton';

function App() {
  const auth = useAuth();

  return (
    <AppProvider>
      <div className="app">
        <header className="app-header">
          <h1>Hicks Bug Hunt</h1>
          <BoardSelector />
          <LoginButton />
        </header>
        <ProtectedRoute>
          <FilterPanel />
          <main className="app-main">
            <Board />
          </main>
        </ProtectedRoute>
      </div>
    </AppProvider>
  );
}
```

### 3.7 Update API Calls to Include Token

Update `client/src/services/api.js`:
```javascript
import { User } from 'oidc-client-ts';

const getAccessToken = () => {
  const oidcStorage = sessionStorage.getItem(
    `oidc.user:${import.meta.env.VITE_OIDC_AUTHORITY}:${import.meta.env.VITE_OIDC_CLIENT_ID}`
  );
  if (oidcStorage) {
    const user = User.fromStorageString(oidcStorage);
    return user?.access_token;
  }
  return null;
};

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000/api'
});

// Add auth header to all requests
api.interceptors.request.use((config) => {
  const token = getAccessToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});
```

## Phase 4: Board Access Management UI

### 4.1 Create Board Settings Component

Create `client/src/components/BoardSettings/BoardSettings.jsx`:
```javascript
import { useState } from 'react';
import { useApp } from '../../context/AppContext';

export default function BoardSettings({ board, onClose }) {
  const { updateBoard } = useApp();
  const [settings, setSettings] = useState({
    isPublic: board.isPublic || false,
    allowedGroups: board.allowedGroups || [],
    allowedUsers: board.allowedUsers || []
  });

  const handleSave = async () => {
    await updateBoard(board._id, settings);
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <h2>Board Access Settings</h2>

        <div className="form-group">
          <label>
            <input
              type="checkbox"
              checked={settings.isPublic}
              onChange={e => setSettings(s => ({ ...s, isPublic: e.target.checked }))}
            />
            Public board (all authenticated users can access)
          </label>
        </div>

        <div className="form-group">
          <label>Allowed Groups (comma-separated)</label>
          <input
            type="text"
            value={settings.allowedGroups.join(', ')}
            onChange={e => setSettings(s => ({
              ...s,
              allowedGroups: e.target.value.split(',').map(g => g.trim()).filter(Boolean)
            }))}
            placeholder="hicks-team-alpha, hicks-team-beta"
          />
        </div>

        <div className="form-group">
          <label>Allowed Users (comma-separated emails)</label>
          <input
            type="text"
            value={settings.allowedUsers.join(', ')}
            onChange={e => setSettings(s => ({
              ...s,
              allowedUsers: e.target.value.split(',').map(u => u.trim()).filter(Boolean)
            }))}
            placeholder="user@example.com, another@example.com"
          />
        </div>

        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave}>Save</button>
        </div>
      </div>
    </div>
  );
}
```

## Phase 5: Testing

### 5.1 Test Authentication Flow

1. Start Hicks app locally
2. Navigate to `http://localhost:5173`
3. Should redirect to Authentik login
4. Log in with test user
5. Should redirect back to Hicks with user info visible

### 5.2 Test Board Access Control

1. Create board as admin user
2. Set allowed groups/users
3. Log in as different user
4. Verify only accessible boards are shown
5. Verify direct URL access is blocked for unauthorized boards

### 5.3 Test Token Refresh

1. Log in and use app
2. Wait for token expiration (or manually expire)
3. Verify token is refreshed automatically
4. Verify app continues working

## Security Checklist

- [ ] HTTPS enforced for all connections
- [ ] Client secret stored securely (never in frontend code)
- [ ] Token validation on backend for all protected routes
- [ ] CORS configured correctly
- [ ] Session cookies are httpOnly and secure
- [ ] Logout properly clears all tokens
- [ ] Board access checked on every request (not just UI)
- [ ] Audit logging for access attempts

## Troubleshooting

### "Invalid redirect URI" error
- Verify redirect URI in Authentik matches exactly
- Check for trailing slashes
- Ensure protocol matches (http vs https)

### Token not included in API calls
- Check sessionStorage for OIDC user data
- Verify VITE_OIDC_AUTHORITY matches Authentik URL
- Check browser console for errors

### User groups not available
- Verify groups scope is requested
- Check Authentik property mapping is configured
- Verify user is assigned to groups in Authentik

### CORS errors
- Configure CORS in Express to allow Authentik domain
- Ensure credentials: 'include' in fetch requests

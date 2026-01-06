const express = require('express');
const cors = require('cors');
const path = require('path');
const { auth } = require('express-openid-connect');
require('dotenv').config();

const connectDB = require('./config/db');
const errorHandler = require('./middleware/errorHandler');

// Route files
const boardRoutes = require('./routes/boards');
const columnRoutes = require('./routes/columns');
const taskRoutes = require('./routes/tasks');
const userRoutes = require('./routes/users');
const fileRoutes = require('./routes/files');
const emailRuleRoutes = require('./routes/emailRules');
const emailConfigRoutes = require('./routes/emailConfig');

// Connect to database
connectDB();

const app = express();

// Body parser
app.use(express.json());

// Enable CORS
app.use(cors({
  origin: process.env.NODE_ENV === 'production'
    ? false
    : ['http://localhost:5173', 'http://127.0.0.1:5173'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Authentik OIDC authentication
const baseUrl = process.env.BASE_URL || 'http://localhost:5000';
const authConfig = {
  authRequired: false,
  auth0Logout: false,
  issuerBaseURL: process.env.OIDC_ISSUER_URL,
  baseURL: baseUrl,
  clientID: process.env.OIDC_CLIENT_ID,
  clientSecret: process.env.OIDC_CLIENT_SECRET,
  secret: process.env.SESSION_SECRET,
  idpLogout: false,
  routes: {
    login: false,
    logout: false
  },
  authorizationParams: {
    response_type: 'code',
    scope: 'openid profile email groups'
  }
};

app.use(auth(authConfig));

// Custom login route
app.get('/login', (req, res) => {
  if (req.oidc.isAuthenticated()) {
    return res.redirect('/');
  }
  res.oidc.login({ returnTo: '/' });
});

// Custom logout route
app.get('/logout', (req, res) => {
  const returnUrl = process.env.NODE_ENV === 'production' ? '/' : 'http://localhost:5173';
  res.oidc.logout({ returnTo: returnUrl });
});

// In development, redirect root to frontend
if (process.env.NODE_ENV !== 'production') {
  app.get('/', (req, res) => {
    res.redirect('http://localhost:5173');
  });
}

// Helper to fetch user from Authentik API
async function getAuthentikUser(email) {
  try {
    const response = await fetch(
      `${process.env.AUTHENTIK_API_URL}/api/v3/core/users/?search=${encodeURIComponent(email)}`,
      {
        headers: {
          'Authorization': `Bearer ${process.env.AUTHENTIK_API_TOKEN}`,
          'Content-Type': 'application/json'
        }
      }
    );
    if (!response.ok) return null;
    const data = await response.json();
    return data.results?.find(u => u.email === email) || null;
  } catch (error) {
    console.error('Error fetching Authentik user:', error);
    return null;
  }
}

// User info endpoint
app.get('/api/me', async (req, res) => {
  if (!req.oidc.isAuthenticated()) {
    return res.json({ authenticated: false });
  }

  const groups = req.oidc.user.groups || [];
  const isAdmin = groups.some(g => g.toLowerCase().replace(/\s+/g, '-') === 'hicks-admins');

  // Fetch user attributes from Authentik for permissions
  const authentikUser = await getAuthentikUser(req.oidc.user.email);
  const attributes = authentikUser?.attributes || {};

  res.json({
    authenticated: true,
    user: {
      email: req.oidc.user.email,
      name: req.oidc.user.name || req.oidc.user.preferred_username,
      groups: groups,
      isAdmin: isAdmin,
      permissions: {
        canAdminBoards: isAdmin || attributes.hicks_can_admin_boards || false,
        canDeleteTasks: isAdmin || attributes.hicks_can_delete_tasks || false,
        canManageEmailRules: isAdmin || attributes.hicks_can_manage_email_rules || false,
        allowedBoards: attributes.hicks_allowed_boards || []
      }
    }
  });
});

// Custom middleware to check auth for API routes (returns 401 instead of redirect)
const requireApiAuth = (req, res, next) => {
  if (!req.oidc.isAuthenticated()) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  next();
};

// Admin-only middleware
const requireAdmin = (req, res, next) => {
  if (!req.oidc.isAuthenticated()) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  const groups = req.oidc.user.groups || [];
  const isAdmin = groups.some(g => g.toLowerCase().replace(/\s+/g, '-') === 'hicks-admins');
  if (!isAdmin) {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
};

// Health check endpoint (public) - must be before protected routes
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API routes (protected)
app.use('/api/boards', requireApiAuth, boardRoutes);
app.use('/api', requireApiAuth, columnRoutes);
app.use('/api', requireApiAuth, taskRoutes);
app.use('/api/users', requireAdmin, userRoutes);
app.use('/api', requireApiAuth, fileRoutes);
app.use('/api', requireApiAuth, emailRuleRoutes);
app.use('/api/email-config', requireAdmin, emailConfigRoutes);

// Serve static assets in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../client/dist')));

  app.get('/{*path}', (req, res) => {
    res.sendFile(path.join(__dirname, '../client/dist/index.html'));
  });
}

// Error handler middleware
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running in ${process.env.NODE_ENV} mode on port ${PORT}`);
});

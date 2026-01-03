const express = require('express');
const cors = require('cors');
const path = require('path');
const { auth, requiresAuth } = require('express-openid-connect');
require('dotenv').config();

const connectDB = require('./config/db');
const errorHandler = require('./middleware/errorHandler');

// Route files
const boardRoutes = require('./routes/boards');
const columnRoutes = require('./routes/columns');
const taskRoutes = require('./routes/tasks');

// Connect to database
connectDB();

const app = express();

// Body parser
app.use(express.json());

// Enable CORS
app.use(cors({
  origin: process.env.NODE_ENV === 'production'
    ? false  // In production, serve from same origin
    : ['http://localhost:5173', 'http://127.0.0.1:5173'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Authentik OIDC authentication
const authConfig = {
  authRequired: false,
  auth0Logout: false,
  issuerBaseURL: process.env.OIDC_ISSUER_URL,
  baseURL: process.env.BASE_URL || 'http://localhost:5000',
  clientID: process.env.OIDC_CLIENT_ID,
  clientSecret: process.env.OIDC_CLIENT_SECRET,
  secret: process.env.SESSION_SECRET,
  idpLogout: true,
  authorizationParams: {
    response_type: 'code',
    scope: 'openid profile email'
  },
  afterCallback: (req, res, session) => {
    // In development, redirect to frontend
    if (process.env.NODE_ENV !== 'production') {
      res.returnTo = 'http://localhost:5173';
    }
    return session;
  }
};

app.use(auth(authConfig));

// In development, redirect root to frontend
if (process.env.NODE_ENV !== 'production') {
  app.get('/', (req, res) => {
    res.redirect('http://localhost:5173');
  });
}

// User info endpoint
app.get('/api/me', (req, res) => {
  if (!req.oidc.isAuthenticated()) {
    return res.json({ authenticated: false });
  }
  res.json({
    authenticated: true,
    user: {
      email: req.oidc.user.email,
      name: req.oidc.user.name || req.oidc.user.preferred_username
    }
  });
});

// API routes (protected)
app.use('/api/boards', requiresAuth(), boardRoutes);
app.use('/api', requiresAuth(), columnRoutes);
app.use('/api', requiresAuth(), taskRoutes);

// Health check endpoint (public)
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

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

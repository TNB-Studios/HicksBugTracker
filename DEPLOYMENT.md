# Production Deployment Guide

This document explains how to deploy the Task Manager application to a production server where users can access it via their browsers.

---

## Overview: Development vs Production

| Aspect | Development | Production |
|--------|-------------|------------|
| Frontend server | Vite dev server (hot reload) | Static files served by Express or Nginx |
| Backend server | Nodemon (auto-restart) | Node.js with process manager (PM2) |
| Database | Local MongoDB or Atlas | Remote MongoDB (Atlas or self-hosted) |
| URL | http://localhost:5173 | https://yourdomain.com |
| Access | Only your machine | Anyone with network access |

---

## Production Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Production Server                        │
│                                                              │
│  ┌─────────────┐     ┌─────────────┐     ┌──────────────┐   │
│  │   Nginx     │────▶│   Express   │────▶│   MongoDB    │   │
│  │  (Reverse   │     │   Backend   │     │  (Database)  │   │
│  │   Proxy)    │     │  Port 5000  │     │  Port 27017  │   │
│  │  Port 80/443│     │             │     │              │   │
│  └─────────────┘     └─────────────┘     └──────────────┘   │
│         │                   │                               │
│         │            Serves API at                          │
│         │            /api/*                                 │
│         │                                                   │
│         └──── Serves static React                           │
│               files from dist/                              │
└─────────────────────────────────────────────────────────────┘
         ▲
         │ HTTPS (port 443)
         │
    ┌────┴────┐
    │ Browser │  Users access via: https://yourdomain.com
    └─────────┘
```

---

## Server Requirements

### Minimum Hardware
- **CPU:** 1 core
- **RAM:** 1 GB (2 GB recommended)
- **Storage:** 20 GB SSD
- **OS:** Ubuntu 22.04 LTS or newer

### Software to Install on Production Server

1. **Node.js** (v20.x or higher)
2. **npm** (comes with Node.js)
3. **MongoDB** (v7.x) - or use MongoDB Atlas
4. **PM2** - Process manager for Node.js
5. **Nginx** - Reverse proxy and static file server
6. **Certbot** - SSL certificates (optional but recommended)

---

## Step-by-Step Deployment

### Step 1: Prepare the Production Server

SSH into your server:
```bash
ssh user@your-server-ip
```

Install required software:
```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js 20.x
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Verify installation
node --version  # Should show v20.x.x
npm --version

# Install PM2 globally
sudo npm install -g pm2

# Install Nginx
sudo apt install -y nginx

# Install MongoDB (or skip if using Atlas)
# See: https://www.mongodb.com/docs/manual/tutorial/install-mongodb-on-ubuntu/
```

### Step 2: Transfer Application Files

From your development machine:
```bash
# Option A: Using rsync (recommended)
rsync -avz --exclude 'node_modules' --exclude '.env' \
  ~/TNB/Hicks/ user@your-server-ip:/var/www/task-manager/

# Option B: Using git (if repo exists)
# On server:
cd /var/www
git clone https://github.com/yourusername/task-manager.git
```

### Step 3: Install Dependencies on Server

```bash
cd /var/www/task-manager

# Install backend dependencies
cd server
npm install --production

# Install frontend dependencies and build
cd ../client
npm install
npm run build
```

### Step 4: Configure Environment Variables

Create production environment file:
```bash
nano /var/www/task-manager/server/.env
```

Add production settings:
```env
PORT=5000
NODE_ENV=production

# Use MongoDB Atlas or your production MongoDB
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/task-manager

# Future: Authentication settings
# SESSION_SECRET=generate-a-long-random-string-here
```

**Important:** Generate a secure session secret:
```bash
openssl rand -hex 32
```

### Step 5: Configure Express to Serve Frontend

The backend server needs to serve the built React files in production. This should already be configured in `server/server.js`:

```javascript
// In production, serve React static files
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../client/dist')));

  // Handle React routing - return index.html for unknown routes
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../client/dist/index.html'));
  });
}
```

### Step 6: Start Application with PM2

```bash
cd /var/www/task-manager/server

# Start the application
pm2 start server.js --name "task-manager"

# Save PM2 process list (survives reboot)
pm2 save

# Set PM2 to start on system boot
pm2 startup systemd
# Follow the command it outputs (copy/paste and run it)
```

PM2 Commands Reference:
```bash
pm2 status              # Check running processes
pm2 logs task-manager   # View application logs
pm2 restart task-manager # Restart application
pm2 stop task-manager   # Stop application
pm2 delete task-manager # Remove from PM2
```

### Step 7: Configure Nginx Reverse Proxy

Create Nginx configuration:
```bash
sudo nano /etc/nginx/sites-available/task-manager
```

Add this configuration:
```nginx
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;
    # Or use server IP: server_name 192.168.1.100;

    location / {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Enable the site:
```bash
# Create symbolic link
sudo ln -s /etc/nginx/sites-available/task-manager /etc/nginx/sites-enabled/

# Remove default site (optional)
sudo rm /etc/nginx/sites-enabled/default

# Test configuration
sudo nginx -t

# Reload Nginx
sudo systemctl reload nginx
```

### Step 8: Configure Firewall

```bash
# Allow HTTP and HTTPS
sudo ufw allow 'Nginx Full'

# Allow SSH (important!)
sudo ufw allow OpenSSH

# Enable firewall
sudo ufw enable

# Check status
sudo ufw status
```

### Step 9: Set Up SSL Certificate (Recommended)

Using Let's Encrypt with Certbot:
```bash
# Install Certbot
sudo apt install certbot python3-certbot-nginx

# Get certificate (replace with your domain)
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com

# Auto-renewal is set up automatically
# Test it with:
sudo certbot renew --dry-run
```

---

## Accessing the Production Application

After deployment, users can access the application at:

- **With domain:** `https://yourdomain.com`
- **With IP only:** `http://your-server-ip`

Anyone with network access to the server can use the application.

---

## Updating the Application

When you make changes and need to deploy updates:

### On Development Machine:
```bash
# Build new frontend
cd ~/TNB/Hicks/client
npm run build

# Transfer files to server
rsync -avz --exclude 'node_modules' --exclude '.env' \
  ~/TNB/Hicks/ user@your-server-ip:/var/www/task-manager/
```

### On Production Server:
```bash
cd /var/www/task-manager

# Install any new dependencies
cd server && npm install --production
cd ../client && npm install && npm run build

# Restart the application
pm2 restart task-manager
```

---

## MongoDB in Production

### Option A: MongoDB Atlas (Recommended)

1. Create account at https://cloud.mongodb.com
2. Create a free M0 cluster (or paid for production)
3. Create database user with password
4. Whitelist your server's IP address
5. Get connection string and add to `.env`

**Advantages:**
- No server maintenance
- Automatic backups
- Easy scaling
- Free tier available

### Option B: Self-Hosted MongoDB

Install on your production server:
```bash
# Follow MongoDB installation guide for Ubuntu
# https://www.mongodb.com/docs/manual/tutorial/install-mongodb-on-ubuntu/

# Start MongoDB service
sudo systemctl start mongod
sudo systemctl enable mongod

# Secure MongoDB (required for production)
mongosh
> use admin
> db.createUser({
    user: "admin",
    pwd: "secure-password-here",
    roles: ["root"]
  })
> exit

# Enable authentication in /etc/mongod.conf:
# security:
#   authorization: enabled

sudo systemctl restart mongod
```

Update `.env` for authenticated MongoDB:
```env
MONGODB_URI=mongodb://admin:secure-password-here@localhost:27017/task-manager?authSource=admin
```

---

## Monitoring and Maintenance

### View Logs
```bash
# Application logs
pm2 logs task-manager

# Nginx access logs
sudo tail -f /var/log/nginx/access.log

# Nginx error logs
sudo tail -f /var/log/nginx/error.log
```

### Monitor Resources
```bash
# PM2 monitoring dashboard
pm2 monit

# System resources
htop
```

### Backup Database
```bash
# MongoDB dump
mongodump --uri="your-mongodb-uri" --out=/backup/$(date +%Y%m%d)

# Restore if needed
mongorestore --uri="your-mongodb-uri" /backup/20240115/
```

---

## Security Checklist

- [ ] SSL certificate installed (HTTPS)
- [ ] Firewall configured (only ports 80, 443, 22 open)
- [ ] MongoDB authentication enabled
- [ ] Environment variables secured (not in git)
- [ ] Strong passwords for all services
- [ ] Regular security updates: `sudo apt update && sudo apt upgrade`
- [ ] PM2 running as non-root user
- [ ] Nginx rate limiting configured (optional)

---

## Quick Reference: Key Differences from Development

| Task | Development | Production |
|------|-------------|------------|
| Start frontend | `npm run dev` | `npm run build` (once) |
| Start backend | `npm run dev` | `pm2 start server.js` |
| View app | http://localhost:5173 | https://yourdomain.com |
| Serves frontend | Vite dev server | Express/Nginx serves static `dist/` |
| Code changes | Hot reload | Rebuild & restart PM2 |
| Database | Local MongoDB | Atlas or secured MongoDB |
| Process management | Manual (Ctrl+C) | PM2 (auto-restart) |

---

## Troubleshooting

### Application not accessible
```bash
# Check if PM2 is running
pm2 status

# Check Nginx status
sudo systemctl status nginx

# Check if ports are open
sudo netstat -tlnp | grep -E '80|443|5000'
```

### 502 Bad Gateway
- Backend not running: `pm2 restart task-manager`
- Wrong port in Nginx config
- Check logs: `pm2 logs task-manager`

### MongoDB connection failed
- Check connection string in `.env`
- Verify MongoDB is running: `sudo systemctl status mongod`
- Check IP whitelist (Atlas)

### SSL certificate issues
```bash
# Renew certificate manually
sudo certbot renew

# Check certificate status
sudo certbot certificates
```

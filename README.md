# Hicks Bug Hunt

A modern, self-hosted bug tracking and task management application built with React and Node.js.

## Features

- Kanban-style board view and list view
- Drag-and-drop task management
- Task dependencies
- File attachments (images, videos, audio, documents)
- Email notifications with configurable rules (Gmail, Outlook, Yahoo, or Google Workspace)
- User authentication via Authentik (OIDC)
- Role-based permissions
- Multiple boards support

## Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** (v18 or higher) - [Download](https://nodejs.org/)
- **npm** (comes with Node.js)
- **MongoDB** (v6 or higher)
- **Authentik** (for authentication)
- **just** (command runner) - [Installation](https://github.com/casey/just#installation)

## Installation

### 1. Install MongoDB

#### Windows
1. Download MongoDB Community Server from [mongodb.com/try/download/community](https://www.mongodb.com/try/download/community)
2. Run the installer and follow the setup wizard
3. Choose "Complete" installation
4. Install MongoDB as a Windows Service (recommended)
5. Optionally install MongoDB Compass (GUI tool)

#### Linux (Ubuntu/Debian)
```bash
# Import MongoDB public GPG key
curl -fsSL https://www.mongodb.org/static/pgp/server-7.0.asc | sudo gpg -o /usr/share/keyrings/mongodb-server-7.0.gpg --dearmor

# Add MongoDB repository
echo "deb [ signed-by=/usr/share/keyrings/mongodb-server-7.0.gpg ] http://repo.mongodb.org/apt/ubuntu jammy/mongodb-org/7.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-7.0.list

# Install MongoDB
sudo apt update
sudo apt install -y mongodb-org

# Start MongoDB
sudo systemctl start mongod
sudo systemctl enable mongod
```

#### macOS
```bash
brew tap mongodb/brew
brew install mongodb-community
brew services start mongodb-community
```

#### Configure MongoDB

1. Connect to MongoDB:
```bash
mongosh
```

2. Create a database user:
```javascript
use admin
db.createUser({
  user: "hicksAppUser",
  pwd: "your-secure-password",
  roles: [
    { role: "readWrite", db: "hicks-dev" },
    { role: "readWrite", db: "hicks-prod" }
  ]
})
```

3. Enable authentication by editing `/etc/mongod.conf` (Linux) or the MongoDB config file:
```yaml
security:
  authorization: enabled
```

4. Restart MongoDB after enabling authentication.

---

### 2. Install Authentik

Authentik is used for user authentication via OIDC.

#### Using Docker (Recommended)

1. Install Docker and Docker Compose - [Get Docker](https://docs.docker.com/get-docker/)

2. Create a directory for Authentik:
```bash
mkdir authentik && cd authentik
```

3. Download the docker-compose file:
```bash
curl -O https://raw.githubusercontent.com/goauthentik/authentik/main/docker-compose.yml
curl -O https://raw.githubusercontent.com/goauthentik/authentik/main/.env
```

4. Edit the `.env` file and set:
```env
PG_PASS=your-postgres-password
AUTHENTIK_SECRET_KEY=your-secret-key
AUTHENTIK_ERROR_REPORTING__ENABLED=false
```

5. Start Authentik:
```bash
docker-compose up -d
```

6. Access Authentik at `http://localhost:9000/if/flow/initial-setup/` to create your admin account.

#### Configure Authentik for Hicks

1. Log in to Authentik admin interface
2. Go to **Applications** → **Providers** → **Create**
3. Select **OAuth2/OpenID Provider**
4. Configure:
   - Name: `Hicks Bug Hunt`
   - Authorization flow: `default-provider-authorization-implicit-consent`
   - Client ID: (auto-generated, copy this)
   - Client Secret: (auto-generated, copy this)
   - Redirect URIs:
     - `http://localhost:5000/callback` (development)
     - `https://your-domain.com/callback` (production)
   - Scopes: `openid`, `profile`, `email`, `groups`

5. Go to **Applications** → **Applications** → **Create**
   - Name: `Hicks Bug Hunt`
   - Slug: `hicks`
   - Provider: Select the provider you just created

6. Create an API Token for server-side user lookups:
   - Go to **Directory** → **Tokens and App passwords**
   - Create a new token with appropriate permissions
   - Copy the token value

7. Create a group called `Hicks Admins` for admin users:
   - Go to **Directory** → **Groups** → **Create**
   - Name: `Hicks Admins`
   - Add admin users to this group

---

### 3. Install Hicks Bug Hunt

1. Clone the repository:
```bash
git clone https://github.com/TNB-Studios/HicksBugTracker.git
cd HicksBugTracker
```

2. Install dependencies:
```bash
just install
```

3. Create the server environment file:
```bash
cp server/.env.example server/.env
```

Or create `server/.env` manually with the following content:

```env
# Node environment
NODE_ENV=development

# Server
PORT=5000
BASE_URL=http://localhost:5000

# MongoDB
MONGODB_URI_DEV=mongodb://hicksAppUser:your-password@localhost:27017/hicks-dev?authSource=admin
MONGODB_URI_PROD=mongodb://hicksAppUser:your-password@localhost:27017/hicks-prod?authSource=admin

# Authentik OIDC
OIDC_ISSUER_URL=http://localhost:9000/application/o/hicks/
OIDC_CLIENT_ID=your-client-id
OIDC_CLIENT_SECRET=your-client-secret

# Authentik API (for user lookups)
AUTHENTIK_API_URL=http://localhost:9000
AUTHENTIK_API_TOKEN=your-api-token

# Session secret (generate a random string)
SESSION_SECRET=your-random-session-secret-at-least-32-characters
```

4. Start the development servers:
```bash
just dev
```

5. Open `http://localhost:5173` in your browser

---

## Just Commands

This project uses [just](https://github.com/casey/just) as a command runner. Here are the available commands:

### Development

| Command | Description |
|---------|-------------|
| `just dev` | Start both backend (port 5000) and frontend (port 5173) servers |
| `just backend` | Start only the backend server |
| `just frontend` | Start only the frontend server |
| `just dev-stop` | Stop all development servers |

### Installation & Building

| Command | Description |
|---------|-------------|
| `just install` | Install all npm dependencies for both server and client |
| `just reinstall` | Clean and reinstall all dependencies |
| `just build` | Build the frontend for production |

### Production (Server)

| Command | Description |
|---------|-------------|
| `just deploy` | Deploy latest code (install deps, build, restart service) |
| `just prod` | Start the production server via systemd |
| `just prod-stop` | Stop the production server |
| `just prod-restart` | Restart the production server |
| `just prod-status` | Check production server status |

### Database

| Command | Description |
|---------|-------------|
| `just copy_from_dev` | Copy dev database to production (overwrites production!) |
| `just copy_from_prod` | Copy production database to dev (overwrites dev!) |

---

## Production Deployment

### Setting up systemd service

1. Create a systemd service file at `/etc/systemd/system/hicks.service`:

```ini
[Unit]
Description=Hicks Bug Hunt
After=network.target mongod.service

[Service]
Type=simple
User=your-user
WorkingDirectory=/path/to/HicksBugTracker/server
ExecStart=/usr/bin/node server.js
Restart=on-failure
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```

2. Enable and start the service:
```bash
sudo systemctl daemon-reload
sudo systemctl enable hicks
sudo systemctl start hicks
```

### Nginx Reverse Proxy (Recommended)

```nginx
server {
    listen 80;
    server_name your-domain.com;

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

---

## Email Configuration

Hicks supports email notifications via two methods:

### SMTP (Gmail, Outlook/Hotmail, Yahoo)

The simplest option for personal email accounts:

1. Go to **Settings** (admin only)
2. In the **Email Configuration** section, select **SMTP**
3. Choose your email provider (Gmail, Outlook/Hotmail, Yahoo, or Custom)
4. Enter your email address and an **App Password** (not your regular password)
   - [Gmail App Passwords](https://myaccount.google.com/apppasswords)
   - [Outlook App Passwords](https://account.live.com/proofs/AppPassword)
   - [Yahoo App Passwords](https://login.yahoo.com/account/security/app-passwords)

**Note:** You must have 2-Step Verification enabled on your account to create App Passwords.

### Google Workspace OAuth2

For business accounts using Google Workspace:

1. Go to **Settings** (admin only)
2. In the **Email Configuration** section, select **Google Workspace OAuth2**
3. Click **Show Setup Guide** and follow the steps to:
   - Create a Google Cloud Project
   - Enable Gmail API
   - Create a Service Account with Domain-Wide Delegation
   - Authorize the service account in Google Workspace Admin

---

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## Credits

Created by **TNB Studios**

# Authentik Installation and Configuration Plan

This document outlines the steps to install and configure Authentik as an identity provider on a self-hosted Ubuntu server.

## Overview

Authentik is an open-source Identity Provider (IdP) that supports:
- Single Sign-On (SSO)
- OAuth2/OpenID Connect
- SAML
- LDAP
- User management and groups
- Multi-factor authentication (MFA)

## Prerequisites

- Ubuntu server (22.04 or 24.04 LTS)
- Docker and Docker Compose installed
- Domain name pointing to the server (e.g., auth.yourdomain.com)
- SSL certificate (Let's Encrypt recommended)
- Minimum 2GB RAM, 2 CPU cores

## Phase 1: Install Docker (if not already installed)

```bash
# Install Docker
curl -fsSL https://get.docker.com | sudo sh

# Add your user to docker group
sudo usermod -aG docker $USER

# Install Docker Compose plugin
sudo apt install docker-compose-plugin

# Verify
docker --version
docker compose version
```

## Phase 2: Prepare Authentik Installation

1. Create directory structure:
   ```bash
   sudo mkdir -p /opt/authentik
   cd /opt/authentik
   ```

2. Download official docker-compose file:
   ```bash
   wget https://goauthentik.io/docker-compose.yml
   ```

3. Generate secrets:
   ```bash
   # Generate secret key
   echo "AUTHENTIK_SECRET_KEY=$(openssl rand -base64 60 | tr -d '\n')" >> .env

   # Generate PostgreSQL password
   echo "PG_PASS=$(openssl rand -base64 36 | tr -d '\n')" >> .env
   ```

4. Add additional environment variables to `.env`:
   ```bash
   # Email settings (optional but recommended)
   AUTHENTIK_EMAIL__HOST=smtp.yourprovider.com
   AUTHENTIK_EMAIL__PORT=587
   AUTHENTIK_EMAIL__USERNAME=your-email
   AUTHENTIK_EMAIL__PASSWORD=your-password
   AUTHENTIK_EMAIL__USE_TLS=true
   AUTHENTIK_EMAIL__FROM=authentik@yourdomain.com
   ```

## Phase 3: Configure Reverse Proxy (Recommended)

Option A: Using Nginx as reverse proxy

```nginx
server {
    listen 80;
    server_name auth.yourdomain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name auth.yourdomain.com;

    ssl_certificate /etc/letsencrypt/live/auth.yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/auth.yourdomain.com/privkey.pem;

    location / {
        proxy_pass http://localhost:9000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

Option B: Let Authentik handle SSL directly (edit docker-compose.yml ports)

## Phase 4: Start Authentik

```bash
cd /opt/authentik

# Pull images
docker compose pull

# Start services
docker compose up -d

# Check status
docker compose ps

# View logs
docker compose logs -f
```

Services started:
- PostgreSQL database
- Redis cache
- Authentik server (port 9000)
- Authentik worker

## Phase 5: Initial Authentik Setup

1. Navigate to `https://auth.yourdomain.com/if/flow/initial-setup/`

2. Create the initial admin account:
   - Username: akadmin (or your choice)
   - Email: your-email@domain.com
   - Password: (strong password)

3. Log in to admin interface: `https://auth.yourdomain.com/if/admin/`

## Phase 6: Configure Authentik

### Create Groups for Access Control

1. Go to Directory > Groups
2. Create groups:
   - `hicks-admins` - Full access to all boards
   - `hicks-users` - Access to assigned boards only
   - Create board-specific groups as needed (e.g., `hicks-board-projectA`)

### Create Users

1. Go to Directory > Users
2. Create users and assign to appropriate groups
3. Or enable self-registration (Flows > Enrollment)

### Configure Password Policies

1. Go to Policies > Policies
2. Create password policy:
   - Minimum length: 12
   - Require uppercase, lowercase, numbers
   - Check against breached passwords (optional)

### Enable MFA (Optional but recommended)

1. Go to Flows > Stages
2. Add TOTP or WebAuthn authenticator stage to login flow

## Phase 7: Verify Installation

1. Test login at `https://auth.yourdomain.com/`
2. Verify admin access at `https://auth.yourdomain.com/if/admin/`
3. Check all services healthy: `docker compose ps`

## Maintenance

### Backups

```bash
# Backup PostgreSQL
docker compose exec postgresql pg_dump -U authentik authentik > backup.sql

# Backup entire data directory
sudo tar -czvf authentik-backup.tar.gz /opt/authentik
```

### Updates

```bash
cd /opt/authentik

# Pull latest images
docker compose pull

# Restart with new images
docker compose up -d

# Check logs for migration issues
docker compose logs -f
```

### Logs and Monitoring

```bash
# View all logs
docker compose logs -f

# View specific service
docker compose logs -f server

# Check resource usage
docker stats
```

## Troubleshooting

### Container won't start
- Check logs: `docker compose logs server`
- Verify .env file has required secrets
- Check disk space: `df -h`

### Can't access web interface
- Verify port 9000 is not blocked
- Check nginx/reverse proxy config
- Verify DNS is pointing correctly

### Database issues
- Check PostgreSQL logs: `docker compose logs postgresql`
- Verify PG_PASS matches in all places

## Security Checklist

- [ ] Strong admin password set
- [ ] SSL/TLS configured
- [ ] Firewall configured (only 443 exposed)
- [ ] Regular backups configured
- [ ] Password policy enabled
- [ ] MFA enabled for admin accounts
- [ ] Email configured for password resets
- [ ] Logs being monitored

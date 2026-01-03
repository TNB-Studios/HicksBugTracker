# MongoDB Self-Hosted Installation Plan

This document outlines the steps to install and configure MongoDB on a self-hosted Ubuntu server for the Hicks Bug Hunt application.

## Prerequisites

- Ubuntu server (22.04 or 24.04 LTS recommended)
- Root/sudo access
- Static IP or domain name for the server
- SSH access to the server

## Phase 1: Install MongoDB

1. Import MongoDB GPG key
2. Add MongoDB apt repository (matching Ubuntu version)
3. Update apt and install `mongodb-org` package
4. Verify installation with `mongod --version`

## Phase 2: Configure MongoDB Service

1. Enable MongoDB to start on boot: `sudo systemctl enable mongod`
2. Start the service: `sudo systemctl start mongod`
3. Verify it's running: `sudo systemctl status mongod`
4. Test local connection: `mongosh`

## Phase 3: Create Database Users

Connect to MongoDB shell and create:

1. **Admin user** (for database administration)
   - Database: `admin`
   - Role: `userAdminAnyDatabase`, `readWriteAnyDatabase`

2. **Application user** (for Hicks app)
   - Database: `admin` (authSource)
   - Role: `readWrite` on `hicks-dev` and `hicks-prod`

Example commands:
```javascript
use admin
db.createUser({
  user: "adminUser",
  pwd: "SECURE_ADMIN_PASSWORD",
  roles: [
    { role: "userAdminAnyDatabase", db: "admin" },
    { role: "readWriteAnyDatabase", db: "admin" }
  ]
})

db.createUser({
  user: "hicksAppUser",
  pwd: "SECURE_APP_PASSWORD",
  roles: [
    { role: "readWrite", db: "hicks-dev" },
    { role: "readWrite", db: "hicks-prod" }
  ]
})
```

## Phase 4: Enable Authentication

1. Edit `/etc/mongod.conf`
2. Add/uncomment security section:
   ```yaml
   security:
     authorization: enabled
   ```
3. Restart MongoDB: `sudo systemctl restart mongod`
4. Test auth: `mongosh -u adminUser -p --authenticationDatabase admin`

## Phase 5: Enable Remote Access

1. Edit `/etc/mongod.conf`
2. Change bindIp from `127.0.0.1` to `0.0.0.0` (or specific IPs):
   ```yaml
   net:
     port: 27017
     bindIp: 0.0.0.0
   ```
3. Restart MongoDB: `sudo systemctl restart mongod`

## Phase 6: Configure Firewall

Using UFW (Uncomplicated Firewall):

```bash
# Allow SSH (important - don't lock yourself out!)
sudo ufw allow ssh

# Allow MongoDB from specific IP only (recommended)
sudo ufw allow from YOUR_DEV_IP to any port 27017

# Or allow from anywhere (less secure)
# sudo ufw allow 27017

# Enable firewall
sudo ufw enable
sudo ufw status
```

## Phase 7: Update Hicks Application

1. Update `/home/jakes/TNB/Hicks/server/.env`:
   ```
   MONGODB_URI_DEV=mongodb://hicksAppUser:SECURE_APP_PASSWORD@SERVER_IP:27017/hicks-dev?authSource=admin
   MONGODB_URI_PROD=mongodb://hicksAppUser:SECURE_APP_PASSWORD@SERVER_IP:27017/hicks-prod?authSource=admin
   ```

2. Test connection from development machine

## Phase 8: Optional Enhancements

### Enable TLS/SSL (Recommended for production)
1. Obtain SSL certificate (Let's Encrypt or self-signed)
2. Configure in `/etc/mongod.conf`:
   ```yaml
   net:
     tls:
       mode: requireTLS
       certificateKeyFile: /path/to/mongodb.pem
   ```

### Set Up Backups
1. Create backup script using `mongodump`
2. Schedule with cron (e.g., daily backups)
3. Store backups offsite or in separate location

Example backup script:
```bash
#!/bin/bash
BACKUP_DIR="/var/backups/mongodb"
DATE=$(date +%Y%m%d_%H%M%S)
mongodump --uri="mongodb://hicksAppUser:PASSWORD@localhost:27017" --out="$BACKUP_DIR/$DATE"
# Keep only last 7 days
find $BACKUP_DIR -type d -mtime +7 -exec rm -rf {} +
```

### Monitoring
- Check logs: `sudo journalctl -u mongod`
- Monitor with `mongostat` or `mongotop`
- Consider setting up alerts for disk space and memory

## Troubleshooting

### MongoDB won't start
- Check logs: `sudo journalctl -u mongod -n 50`
- Verify config syntax: `mongod --config /etc/mongod.conf --validate`
- Check permissions on data directory: `ls -la /var/lib/mongodb`

### Can't connect remotely
- Verify bindIp is set correctly
- Check firewall: `sudo ufw status`
- Test port is open: `nc -zv SERVER_IP 27017`
- Verify authentication credentials

### Authentication fails
- Ensure user was created in correct database
- Check authSource in connection string
- Verify password has no special characters that need escaping

## Security Checklist

- [ ] MongoDB authentication enabled
- [ ] Strong passwords for all users
- [ ] Firewall configured (only allow necessary IPs)
- [ ] MongoDB not running as root
- [ ] Regular backups configured
- [ ] Logs being monitored
- [ ] TLS/SSL enabled (for production)
- [ ] Keep MongoDB updated

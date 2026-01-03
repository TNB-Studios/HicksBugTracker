# Hicks Bug Hunt - Development Commands

# MongoDB connection strings
MONGO_DEV := "mongodb+srv://tnbdev_db_user:VgCNZL4qWs6hLZFp@hicksdb.m2fcubr.mongodb.net/hicks-dev"
MONGO_PROD := "mongodb+srv://tnbdev_db_user:VgCNZL4qWs6hLZFp@hicksdb.m2fcubr.mongodb.net/hicks-prod"

# Start both backend and frontend servers for development
dev:
    #!/usr/bin/env bash
    echo "Starting Task Manager..."
    echo "Backend API on port 5000"
    echo "Frontend UI on port 5173"
    echo ""
    echo ">>> Open http://localhost:5173 in your browser <<<"
    echo ""
    echo "Press Ctrl+C to stop both servers"
    echo ""
    # Start backend in background
    cd server && npm run dev &
    BACKEND_PID=$!
    # Start frontend in foreground
    cd client && npm run dev &
    FRONTEND_PID=$!
    # Wait for both and handle Ctrl+C
    trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null" EXIT
    wait

# Start only the backend server
backend:
    cd server && npm run dev

# Start only the frontend server
frontend:
    cd client && npm run dev

# Install all dependencies
install:
    cd server && npm install
    cd client && npm install

# Clean and reinstall all dependencies
reinstall:
    rm -rf server/node_modules client/node_modules
    cd server && npm install
    cd client && npm install

# Build frontend for production
build:
    cd client && npm run build

# Start production server (after building)
prod:
    cd client && npm run build
    cd server && NODE_ENV=production npm start

# Copy data FROM Dev TO Production (overwrites production!)
copy_from_dev:
    #!/usr/bin/env bash
    echo "WARNING: This will OVERWRITE all production data with dev data!"
    echo ""
    read -p "Are you sure? Type 'yes' to confirm: " confirm
    if [ "$confirm" != "yes" ]; then
        echo "Aborted."
        exit 1
    fi
    echo ""
    echo "Dumping dev database..."
    rm -rf .db_backup
    mongodump --uri="{{MONGO_DEV}}" --out=.db_backup
    echo ""
    echo "Restoring to production..."
    mongorestore --uri="{{MONGO_PROD}}" --drop .db_backup/hicks-dev --nsFrom="hicks-dev.*" --nsTo="hicks-prod.*"
    rm -rf .db_backup
    echo ""
    echo "Done! Production now has a copy of dev data."

# Copy data FROM Production TO Dev (overwrites dev!)
copy_from_prod:
    #!/usr/bin/env bash
    echo "WARNING: This will OVERWRITE all dev data with production data!"
    echo ""
    read -p "Are you sure? Type 'yes' to confirm: " confirm
    if [ "$confirm" != "yes" ]; then
        echo "Aborted."
        exit 1
    fi
    echo ""
    echo "Dumping production database..."
    rm -rf .db_backup
    mongodump --uri="{{MONGO_PROD}}" --out=.db_backup
    echo ""
    echo "Restoring to dev..."
    mongorestore --uri="{{MONGO_DEV}}" --drop .db_backup/hicks-prod --nsFrom="hicks-prod.*" --nsTo="hicks-dev.*"
    rm -rf .db_backup
    echo ""
    echo "Done! Dev now has a copy of production data."

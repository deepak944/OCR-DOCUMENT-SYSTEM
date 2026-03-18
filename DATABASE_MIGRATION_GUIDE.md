# Database Migration Guide

## Overview

This guide will help you migrate from in-memory storage to a persistent database (PostgreSQL or MySQL). The current architecture is designed to make this transition smooth and straightforward.

## Why Migrate to a Database?

Current limitations with in-memory storage:
- ❌ Data is lost on server restart
- ❌ Cannot scale horizontally
- ❌ No data persistence
- ❌ Limited query capabilities
- ❌ No data backup/recovery

Benefits of database integration:
- ✅ Persistent data storage
- ✅ Scalable architecture
- ✅ Advanced querying
- ✅ Data relationships
- ✅ Backup and recovery
- ✅ Transaction support

## Step-by-Step Migration

### Step 1: Choose Your Database

#### Option A: PostgreSQL (Recommended)
```bash
npm install sequelize pg pg-hstore
```

#### Option B: MySQL
```bash
npm install sequelize mysql2
```

### Step 2: Set Up Database Configuration

Create `backend/src/config/database.js`:

```javascript
const { Sequelize } = require('sequelize');

const sequelize = new Sequelize(
  process.env.DB_NAME || 'ocr_system',
  process.env.DB_USER || 'postgres',
  process.env.DB_PASSWORD || 'password',
  {
    host: process.env.DB_HOST || 'localhost',
    dialect: process.env.DB_DIALECT || 'postgres',
    logging: process.env.NODE_ENV === 'development' ? console.log : false,
    pool: {
      max: 5,
      min: 0,
      acquire: 30000,
      idle: 10000,
    },
  }
);

// Test connection
sequelize.authenticate()
  .then(() => console.log('✅ Database connected'))
  .catch(err => console.error('❌ Database connection failed:', err));

module.exports = sequelize;
```

### Step 3: Create Database Models

#### User Model

Replace `backend/src/models/User.js`:

```javascript
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const User = sequelize.define('User', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  name: {
    type: DataTypes.STRING(100),
    allowNull: false,
  },
  email: {
    type: DataTypes.STRING(255),
    allowNull: false,
    unique: true,
    validate: {
      isEmail: true,
    },
  },
  password: {
    type: DataTypes.STRING(255),
    allowNull: false,
  },
  googleId: {
    type: DataTypes.STRING(255),
    unique: true,
    allowNull: true,
  },
  isEmailVerified: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  emailVerificationToken: {
    type: DataTypes.STRING(255),
    allowNull: true,
  },
  resetPasswordToken: {
    type: DataTypes.STRING(255),
    allowNull: true,
  },
  resetPasswordExpires: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  lastLoginAt: {
    type: DataTypes.DATE,
    allowNull: true,
  },
}, {
  tableName: 'users',
  timestamps: true,
  indexes: [
    { fields: ['email'] },
    { fields: ['googleId'] },
  ],
});

module.exports = User;
```

#### Activity Model

Replace `backend/src/models/Activity.js`:

```javascript
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Activity = sequelize.define('Activity', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  userId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'users',
      key: 'id',
    },
    onDelete: 'CASCADE',
  },
  action: {
    type: DataTypes.STRING(50),
    allowNull: false,
  },
  fileName: {
    type: DataTypes.STRING(255),
    allowNull: true,
  },
  fileSize: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  status: {
    type: DataTypes.ENUM('success', 'failed'),
    allowNull: false,
  },
  error: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  metadata: {
    type: DataTypes.JSON,
    allowNull: true,
  },
}, {
  tableName: 'activities',
  timestamps: true,
  indexes: [
    { fields: ['userId'] },
    { fields: ['action'] },
    { fields: ['createdAt'] },
  ],
});

module.exports = Activity;
```

#### Session Model

Replace `backend/src/models/Session.js`:

```javascript
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Session = sequelize.define('Session', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  userId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'users',
      key: 'id',
    },
    onDelete: 'CASCADE',
  },
  token: {
    type: DataTypes.TEXT,
    allowNull: false,
  },
  expiresAt: {
    type: DataTypes.DATE,
    allowNull: false,
  },
  isBlacklisted: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  ipAddress: {
    type: DataTypes.STRING(45),
    allowNull: true,
  },
  userAgent: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
}, {
  tableName: 'sessions',
  timestamps: true,
  indexes: [
    { fields: ['userId'] },
    { fields: ['token'] },
    { fields: ['expiresAt'] },
  ],
});

module.exports = Session;
```

### Step 4: Define Model Relationships

Create `backend/src/models/index.js`:

```javascript
const sequelize = require('../config/database');
const User = require('./User');
const Activity = require('./Activity');
const Session = require('./Session');

// Define relationships
User.hasMany(Activity, {
  foreignKey: 'userId',
  as: 'activities',
});

Activity.belongsTo(User, {
  foreignKey: 'userId',
  as: 'user',
});

User.hasMany(Session, {
  foreignKey: 'userId',
  as: 'sessions',
});

Session.belongsTo(User, {
  foreignKey: 'userId',
  as: 'user',
});

module.exports = {
  sequelize,
  User,
  Activity,
  Session,
};
```

### Step 5: Update Controllers

#### Auth Controller

Update `backend/src/controllers/authController.js`:

```javascript
const bcrypt = require("bcryptjs");
const { User, Session } = require("../models");
const { generateToken } = require("../utils/jwt");

const register = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ error: "All fields are required" });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: "Password must be at least 6 characters" });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: "Invalid email format" });
    }

    // Check if user exists
    const existingUser = await User.findOne({ where: { email: email.toLowerCase() } });
    if (existingUser) {
      return res.status(409).json({ error: "User already exists with this email" });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user
    const user = await User.create({
      name,
      email: email.toLowerCase(),
      password: hashedPassword,
    });

    // Return user without password — no token, user must log in manually
    const userResponse = user.toJSON();
    delete userResponse.password;

    res.status(201).json({
      message: "User registered successfully. Please log in.",
      user: userResponse,
    });
  } catch (error) {
    console.error("Register error:", error);
    res.status(500).json({ error: "Registration failed" });
  }
};

const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }

    // Find user
    const user = await User.findOne({ where: { email: email.toLowerCase() } });
    if (!user) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    // Update last login
    await user.update({ lastLoginAt: new Date() });

    // Generate token
    const token = generateToken({
      userId: user.id,
      email: user.email,
    });

    // Create session
    await Session.create({
      userId: user.id,
      token,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });

    // Return user without password
    const userResponse = user.toJSON();
    delete userResponse.password;

    res.json({
      message: "Login successful",
      user: userResponse,
      token,
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ error: "Login failed" });
  }
};

const logout = async (req, res) => {
  try {
    const token = req.token;

    // Blacklist the token
    await Session.update(
      { isBlacklisted: true },
      { where: { token } }
    );

    res.json({ message: "Logout successful" });
  } catch (error) {
    console.error("Logout error:", error);
    res.status(500).json({ error: "Logout failed" });
  }
};

const getProfile = async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id, {
      attributes: { exclude: ['password'] },
    });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json({ user });
  } catch (error) {
    console.error("Get profile error:", error);
    res.status(500).json({ error: "Failed to fetch profile" });
  }
};

const verifyTokenEndpoint = (req, res) => {
  res.json({
    valid: true,
    user: req.user,
  });
};

module.exports = {
  register,
  login,
  logout,
  getProfile,
  verifyTokenEndpoint,
};
```

#### Activity Controller

Update `backend/src/controllers/activityController.js`:

```javascript
const { Activity, User } = require("../models");

const getUserActivities = async (req, res) => {
  try {
    const userId = req.user.id;
    const limit = parseInt(req.query.limit) || 50;

    const activities = await Activity.findAll({
      where: { userId },
      order: [['createdAt', 'DESC']],
      limit,
      attributes: ['id', 'action', 'fileName', 'fileSize', 'status', 'error', 'createdAt'],
    });

    res.json({
      activities,
      count: activities.length,
    });
  } catch (error) {
    console.error("Get activities error:", error);
    res.status(500).json({ error: "Failed to fetch activities" });
  }
};

module.exports = {
  getUserActivities,
};
```

#### Document Controller

Update `backend/src/controllers/documentController.js`:

```javascript
const { Activity } = require("../models");

// In uploadDocument function, replace:
// activityStore.create({...})
// with:
await Activity.create({
  userId: req.user.id,
  action: "OCR_PROCESS",
  fileName: req.file.originalname,
  fileSize: req.file.size,
  status: "success",
});

// Similar changes for downloadWordDocument and error cases
```

### Step 6: Update Auth Middleware

Update `backend/src/middleware/authMiddleware.js`:

```javascript
const { verifyToken } = require("../utils/jwt");
const { Session, User } = require("../models");

const authMiddleware = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "No token provided" });
    }

    const token = authHeader.substring(7);

    // Check if token is blacklisted
    const session = await Session.findOne({ where: { token } });
    if (!session || session.isBlacklisted) {
      return res.status(401).json({ error: "Token has been invalidated" });
    }

    // Check if token expired
    if (new Date() > session.expiresAt) {
      return res.status(401).json({ error: "Token has expired" });
    }

    // Verify token
    const decoded = verifyToken(token);
    if (!decoded) {
      return res.status(401).json({ error: "Invalid token" });
    }

    // Check if user still exists
    const user = await User.findByPk(decoded.userId);
    if (!user) {
      return res.status(401).json({ error: "User not found" });
    }

    // Attach user info to request
    req.user = {
      id: decoded.userId,
      email: decoded.email,
      name: user.name,
    };
    req.token = token;

    next();
  } catch (error) {
    console.error("Auth middleware error:", error);
    return res.status(401).json({ error: "Authentication failed" });
  }
};

module.exports = authMiddleware;
```

### Step 7: Create Database Sync Script

Create `backend/src/scripts/syncDatabase.js`:

```javascript
const { sequelize } = require('../models');

async function syncDatabase() {
  try {
    console.log('🔄 Syncing database...');
    
    // This will create tables if they don't exist
    await sequelize.sync({ alter: true });
    
    console.log('✅ Database synced successfully');
    process.exit(0);
  } catch (error) {
    console.error('❌ Database sync failed:', error);
    process.exit(1);
  }
}

syncDatabase();
```

Add to `package.json`:

```json
{
  "scripts": {
    "db:sync": "node src/scripts/syncDatabase.js",
    "db:reset": "node src/scripts/syncDatabase.js --force"
  }
}
```

### Step 8: Update Server.js

Update `backend/server.js`:

```javascript
require("dotenv").config();

const express = require("express");
const cors = require("cors");
const path = require("path");
const { sequelize } = require("./src/models");

const authRoutes = require("./src/routes/authRoutes");
const documentRoutes = require("./src/routes/documentRoutes");
const activityRoutes = require("./src/routes/activityRoutes");

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

app.use("/uploads", express.static(path.join(__dirname, "uploads")));

app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/activities", activityRoutes);
app.use("/", documentRoutes);

// Start server
async function startServer() {
  try {
    // Test database connection
    await sequelize.authenticate();
    console.log('✅ Database connected');

    // Sync models (in development)
    if (process.env.NODE_ENV === 'development') {
      await sequelize.sync({ alter: true });
      console.log('✅ Database synced');
    }

    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

startServer();
```

### Step 9: Update Environment Variables

Update `backend/.env`:

```env
PORT=5000
AI_SERVICE_URL=http://localhost:8000

# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
JWT_EXPIRES_IN=24h

# Database Configuration
DB_HOST=localhost
DB_PORT=5432
DB_NAME=ocr_system
DB_USER=postgres
DB_PASSWORD=your_password
DB_DIALECT=postgres

# Environment
NODE_ENV=development
```

### Step 10: Update Docker Compose

Update `docker-compose.yml`:

```yaml
services:
  postgres:
    image: postgres:15-alpine
    container_name: ocr-postgres
    environment:
      POSTGRES_DB: ocr_system
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: ${DB_PASSWORD:-postgres}
    ports:
      - "5432:5432"
    volumes:
      - postgres-data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 10s
      timeout: 5s
      retries: 5

  ai-service:
    # ... existing config

  backend:
    image: ${DOCKERHUB_USERNAME:-local}/ocr-backend:${IMAGE_TAG:-latest}
    build:
      context: ./backend
      dockerfile: Dockerfile
    container_name: ocr-backend
    environment:
      - PORT=5000
      - AI_SERVICE_URL=http://ai-service:8000
      - JWT_SECRET=${JWT_SECRET:-your-super-secret-jwt-key}
      - JWT_EXPIRES_IN=24h
      - DB_HOST=postgres
      - DB_PORT=5432
      - DB_NAME=ocr_system
      - DB_USER=postgres
      - DB_PASSWORD=${DB_PASSWORD:-postgres}
      - DB_DIALECT=postgres
      - NODE_ENV=production
    depends_on:
      postgres:
        condition: service_healthy
      ai-service:
        condition: service_started
    ports:
      - "5000:5000"

  frontend:
    # ... existing config

volumes:
  postgres-data:
  paddlex-cache:
```

### Step 11: Run Migration

```bash
# Install dependencies
cd backend
npm install sequelize pg pg-hstore

# Set up database
docker compose up -d postgres

# Wait for database to be ready
sleep 5

# Sync database
npm run db:sync

# Start all services
docker compose up --build
```

## Testing the Migration

### 1. Verify Database Connection
```bash
docker compose logs backend | grep "Database connected"
```

### 2. Check Tables Created
```bash
docker compose exec postgres psql -U postgres -d ocr_system -c "\dt"
```

Expected output:
```
           List of relations
 Schema |    Name    | Type  |  Owner   
--------+------------+-------+----------
 public | activities | table | postgres
 public | sessions   | table | postgres
 public | users      | table | postgres
```

### 3. Test Registration
```bash
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Test User","email":"test@example.com","password":"password123"}'
```

### 4. Verify User in Database
```bash
docker compose exec postgres psql -U postgres -d ocr_system -c "SELECT id, name, email FROM users;"
```

## Rollback Plan

If something goes wrong:

1. Stop services:
```bash
docker compose down
```

2. Restore in-memory models:
```bash
git checkout backend/src/models/
git checkout backend/src/controllers/
```

3. Remove database dependency:
```bash
npm uninstall sequelize pg pg-hstore
```

4. Restart:
```bash
docker compose up --build
```

## Production Considerations

### 1. Database Migrations

Use Sequelize migrations for production:

```bash
npm install --save-dev sequelize-cli

# Initialize migrations
npx sequelize-cli init

# Create migration
npx sequelize-cli migration:generate --name create-users-table

# Run migrations
npx sequelize-cli db:migrate

# Rollback
npx sequelize-cli db:migrate:undo
```

### 2. Connection Pooling

Already configured in database.js:
```javascript
pool: {
  max: 5,        // Maximum connections
  min: 0,        // Minimum connections
  acquire: 30000, // Max time to get connection
  idle: 10000,   // Max idle time
}
```

### 3. Indexes

Already added in models for:
- User email
- Activity userId and action
- Session token and expiry

### 4. Backup Strategy

```bash
# Backup
docker compose exec postgres pg_dump -U postgres ocr_system > backup.sql

# Restore
docker compose exec -T postgres psql -U postgres ocr_system < backup.sql
```

### 5. Environment-Specific Configs

```javascript
// config/database.js
const config = {
  development: {
    dialect: 'postgres',
    logging: console.log,
  },
  production: {
    dialect: 'postgres',
    logging: false,
    pool: { max: 10, min: 2 },
  },
};

module.exports = config[process.env.NODE_ENV || 'development'];
```

## Summary

After migration, you'll have:
- ✅ Persistent data storage
- ✅ Scalable architecture
- ✅ Production-ready database
- ✅ Proper relationships
- ✅ Indexed queries
- ✅ Transaction support

The migration is designed to be:
- Non-breaking (same API)
- Reversible (can rollback)
- Testable (step-by-step)
- Production-ready (with best practices)

# Database Documentation: TextTrack AI

TextTrack AI utilizes **PostgreSQL**, a world-class relational database, to ensure all user data and processing history are stored securely and efficiently.

## 🛠 Why PostgreSQL & Sequelize?

### 1. Relational Integrity
- We use PostgreSQL because of its strict data integrity and powerful support for complex queries. For instance, every "Activity" in our system must be tied to a valid "User" via a Foreign Key.

### 2. Sequelize ORM (Object-Relational Mapping)
- **Translation Layer**: Sequelize allows us to write database logic in pure JavaScript. 
- **Security**: It automatically santizes inputs, protecting the system from **SQL Injection** attacks.
- **Model Synchronization**: When the application starts, Sequelize checks if the database tables exist (`sequelize.sync()`). If we add a new column to a model in the code, Sequelize can update the database table automatically without us writing manual SQL `ALTER` commands.

## 📂 Detailed Schema Design

### 1. Users Table (`User` Model)
| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Unique identifier (Primary Key) |
| `email` | String | User's unique email address (Indexed) |
| `password` | String | Hashed password (Bcrypt) |

### 2. Activities Table (`Activity` Model)
| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Unique identifier (Primary Key) |
| `userId` | UUID | link to the User (Foreign Key) |
| `action` | Enum | `OCR_PROCESS` or `WORD_EXPORT` |
| `fileName`| String | Name of the processed file |
| `status` | String | `success` or `failed` |

## 🕹️ CLI Management (For Developers)

To manually inspect the database inside the Docker container:
```bash
docker exec -it ocr-postgres psql -U postgres -d ocr_system
```

### Useful SQL Commands:
- **See all users**: `SELECT "email", "createdAt" FROM "Users";`
- **Count activities**: `SELECT COUNT(*) FROM "Activities";`
- **Find recent actions**: `SELECT * FROM "Activities" ORDER BY "createdAt" DESC LIMIT 5;`

## Migrations
Models are automatically synced in development mode via `sequelize.sync({ alter: true })`.

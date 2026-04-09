/**
 * Initialize database with admin user (first run)
 * Usage: node scripts/init-db.js
 */
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.join(__dirname, '..', 'data', 'webgpu-ai-studio.db');

fs.mkdirSync(path.dirname(dbPath), { recursive: true });

const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

console.log('🗄️  Initializing WebGPU AI Studio database...');

// Create tables
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    status TEXT DEFAULT 'pending',
    role TEXT DEFAULT 'user',
    approval_token TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_login DATETIME
  );

  CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    token TEXT UNIQUE NOT NULL,
    expires_at DATETIME NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS chat_history (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    tool TEXT NOT NULL,
    messages TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );
`);

console.log('✅ Tables created');

// Check if admin exists
const adminExists = db.prepare('SELECT id FROM users WHERE role = ?').get('admin');

if (!adminExists) {
  const adminId = uuidv4();
  const adminPassword = bcrypt.hashSync('admin123', 12);
  
  db.prepare(`
    INSERT INTO users (id, name, email, password_hash, role, status)
    VALUES (?, 'Admin', 'admin@webgpu-ai.studio', ?, 'admin', 'approved')
  `).run(adminId, adminPassword);

  console.log('✅ Default admin created:');
  console.log('   Email: admin@webgpu-ai.studio');
  console.log('   Password: admin123');
  console.log('   ⚠️  Change this password immediately!');
} else {
  console.log('✅ Admin user already exists');
}

db.close();
console.log('🎉 Database initialized successfully!');

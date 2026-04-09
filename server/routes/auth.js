import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import db from '../config/db.js';
import { notifyOwner, notifyUser } from '../config/mail.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();
const DEV_ADMIN_USERNAME = process.env.DEV_ADMIN_USERNAME || 'root';
const DEV_ADMIN_PASSWORD = process.env.DEV_ADMIN_PASSWORD || '08506412';
const DEV_ADMIN_EMAIL = process.env.DEV_ADMIN_EMAIL || '__dev_root_admin__@webgpu-ai.studio';
const DEV_ADMIN_ID = process.env.DEV_ADMIN_ID || 'dev-root-admin';
const DEV_ADMIN_NAME = process.env.DEV_ADMIN_NAME || 'Root Admin';
const JWT_SECRET = process.env.JWT_SECRET || 'dev-only-jwt-secret-change-in-production';

// Prepare database tables
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

function ensureDevAdminUser() {
  let adminUser = db.prepare('SELECT * FROM users WHERE id = ?').get(DEV_ADMIN_ID);
  if (adminUser) return adminUser;

  const passwordHash = bcrypt.hashSync(DEV_ADMIN_PASSWORD, 12);
  db.prepare(`
    INSERT INTO users (id, name, email, password_hash, role, status)
    VALUES (?, ?, ?, ?, 'admin', 'approved')
  `).run(DEV_ADMIN_ID, DEV_ADMIN_NAME, DEV_ADMIN_EMAIL, passwordHash);

  adminUser = db.prepare('SELECT * FROM users WHERE id = ?').get(DEV_ADMIN_ID);
  return adminUser;
}

ensureDevAdminUser();

// ==================== REGISTRATION ====================
router.post('/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Name, email, and password are required' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    // Check if user exists
    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
    if (existing) {
      return res.status(409).json({ error: 'Email already registered' });
    }

    const userId = uuidv4();
    const approvalToken = uuidv4();
    const passwordHash = await bcrypt.hash(password, 12);

    db.prepare(`
      INSERT INTO users (id, name, email, password_hash, approval_token)
      VALUES (?, ?, ?, ?, ?)
    `).run(userId, name, email, passwordHash, approvalToken);

    const user = { id: userId, name, email, status: 'pending' };

    // Send approval emails
    try {
      const approvalLink = `${process.env.FRONTEND_URL}/approve/${approvalToken}`;
      await notifyOwner({ user, approvalLink });
      await notifyUser({ user, status: 'pending' });
    } catch (emailErr) {
      console.error('Email notification failed:', emailErr.message);
      // Don't fail registration if email fails
    }

    res.status(201).json({
      message: 'Registration successful! Check your email for confirmation.',
      status: 'pending',
    });
  } catch (err) {
    console.error('Registration error:', err);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// ==================== LOGIN ====================
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const identifier = String(email || '').trim();

    if (!identifier || !password) {
      return res.status(400).json({ error: 'Username/email and password are required' });
    }

    if (identifier === DEV_ADMIN_USERNAME && password === DEV_ADMIN_PASSWORD) {
      const adminUser = ensureDevAdminUser();
      db.prepare('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?').run(adminUser.id);

      const token = jwt.sign(
        { id: adminUser.id, email: adminUser.email, name: adminUser.name, role: adminUser.role },
        JWT_SECRET,
        { expiresIn: '7d' }
      );

      return res.json({
        token,
        user: {
          id: adminUser.id,
          name: adminUser.name,
          email: adminUser.email,
          role: adminUser.role,
          status: adminUser.status,
        },
      });
    }

    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(identifier);
    if (!user) {
      return res.status(401).json({ error: 'Invalid username/email or password' });
    }

    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid username/email or password' });
    }

    if (user.status === 'pending') {
      return res.status(403).json({
        error: 'Account pending approval. Please wait for admin approval.',
        status: 'pending',
      });
    }

    if (user.status === 'rejected') {
      return res.status(403).json({
        error: 'Your registration was not approved.',
        status: 'rejected',
      });
    }

    // Update last login
    db.prepare('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?').run(user.id);

    // Generate JWT
    const token = jwt.sign(
      { id: user.id, email: user.email, name: user.name, role: user.role },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        status: user.status,
      },
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Login failed' });
  }
});

// ==================== APPROVAL (Admin) ====================
router.get('/approve/:token', async (req, res) => {
  try {
    const { token } = req.params;
    const user = db.prepare('SELECT * FROM users WHERE approval_token = ? AND status = ?').get(token, 'pending');

    if (!user) {
      return res.status(404).json({ error: 'Invalid or expired approval token' });
    }

    db.prepare('UPDATE users SET status = ?, approval_token = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
      .run('approved', user.id);

    // Notify user
    try {
      await notifyUser({ user: { name: user.name, email: user.email }, status: 'approved' });
    } catch (e) {
      console.error('User notification failed:', e.message);
    }

    // If accessed from browser, redirect to login
    if (req.accepts('html')) {
      return res.redirect(`${process.env.FRONTEND_URL}/login?approved=1`);
    }

    res.json({ message: 'User approved successfully' });
  } catch (err) {
    console.error('Approval error:', err);
    res.status(500).json({ error: 'Approval failed' });
  }
});

// ==================== GET CURRENT USER ====================
router.get('/me', authenticateToken, (req, res) => {
  const user = db.prepare('SELECT id, name, email, role, status, created_at, last_login FROM users WHERE id = ?')
    .get(req.user.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json(user);
});

// ==================== ADMIN: LIST USERS ====================
router.get('/admin/users', authenticateToken, (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  const users = db.prepare('SELECT id, name, email, status, role, created_at, last_login FROM users ORDER BY created_at DESC').all();
  res.json(users);
});

// ==================== ADMIN: REJECT USER ====================
router.post('/admin/users/:id/reject', authenticateToken, async (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
  if (!user) return res.status(404).json({ error: 'User not found' });

  db.prepare('UPDATE users SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run('rejected', req.params.id);

  try {
    await notifyUser({ user: { name: user.name, email: user.email }, status: 'rejected' });
  } catch (e) {
    console.error('Rejection notification failed:', e.message);
  }

  res.json({ message: 'User rejected' });
});

export default router;

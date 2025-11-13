import jwt from 'jsonwebtoken'
import bcrypt from 'bcryptjs'
import { db } from './db'

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me'

export function signToken(payload: any) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' })
}

export function verifyToken(token: string) {
  return jwt.verify(token, JWT_SECRET)
}

export function findUserByEmail(email: string) {
  return db.prepare('SELECT * FROM users WHERE email = ?').get(email) as any
}

export function createUser(email: string, password: string, role: 'user'|'admin'='user') {
  const hash = bcrypt.hashSync(password, 10)
  const info = db.prepare('INSERT INTO users (email,password_hash,role,created_at) VALUES (?,?,?,?)').run(
    email,
    hash,
    role,
    new Date().toISOString()
  )
  return info.lastInsertRowid
}

export function ensureAdminSeed() {
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@aviator.local'
  const adminPass = process.env.ADMIN_PASSWORD || 'admin123'
  const exists = findUserByEmail(adminEmail)
  if (!exists) {
    createUser(adminEmail, adminPass, 'admin')
  }
}

export function comparePassword(password: string, hash: string) {
  return bcrypt.compareSync(password, hash)
}

// Password reset helpers
export function generateResetCode(): string {
  // 6-digit numeric code
  return String(Math.floor(100000 + Math.random() * 900000))
}

export function createPasswordReset(userId: number, code: string, ttlMinutes = 10) {
  const codeHash = bcrypt.hashSync(code, 10)
  const now = new Date()
  const expires = new Date(now.getTime() + ttlMinutes * 60 * 1000)
  const info = db.prepare(
    'INSERT INTO password_resets (user_id, code_hash, expires_at, used, created_at) VALUES (?,?,?,?,?)'
  ).run(userId, codeHash, expires.toISOString(), 0, now.toISOString())
  return info.lastInsertRowid
}

export function getLatestActiveReset(userId: number) {
  return db
    .prepare(
      'SELECT * FROM password_resets WHERE user_id = ? AND used = 0 ORDER BY created_at DESC LIMIT 1'
    )
    .get(userId) as any
}

export function markResetUsed(id: number) {
  db.prepare('UPDATE password_resets SET used = 1 WHERE id = ?').run(id)
}

export function updateUserPassword(userId: number, newPassword: string) {
  const hash = bcrypt.hashSync(newPassword, 10)
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hash, userId)
}
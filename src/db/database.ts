import fs from 'fs';
import path from 'path';
import Database from 'better-sqlite3';
import crypto from 'crypto';

export type Sender = 'user' | 'ava';

type ChatRow = {
	sender: Sender;
	message: string;
	created_at: string;
};

export type UserRecord = {
	id: number;
	name: string;
	first_name: string;
	last_name: string;
	is_admin: 0 | 1;
	user_code: string;
	pin: string;
	created_at: string;
};

const dataDir = path.resolve(process.cwd(), 'data');
const dbPath = path.join(dataDir, 'ava.db');

fs.mkdirSync(dataDir, { recursive: true });

// Open (or create) the SQLite database file
const db = new Database(dbPath);

// Keep WAL enabled for safer concurrent writes
db.pragma('journal_mode = WAL');

db.exec(`
CREATE TABLE IF NOT EXISTS users (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	name TEXT NOT NULL UNIQUE,
	created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS chat_history (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	user_id INTEGER NOT NULL,
	sender TEXT NOT NULL CHECK(sender IN ('user', 'ava')),
	message TEXT NOT NULL,
	reason TEXT NOT NULL,
	parameters TEXT NOT NULL,
	created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
	FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS sessions (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	user_id INTEGER NOT NULL,
	token TEXT NOT NULL UNIQUE,
	created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
	last_active DATETIME DEFAULT CURRENT_TIMESTAMP,
	FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS schema_migrations (
	id TEXT PRIMARY KEY,
	applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS user_notes (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	user_id INTEGER NOT NULL,
	title TEXT NOT NULL DEFAULT '',
	body TEXT NOT NULL DEFAULT '',
	position INTEGER NOT NULL DEFAULT 0,
	updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
	FOREIGN KEY (user_id) REFERENCES users(id)
);
`);

function ensureColumn(table: string, column: string, definition: string) {
	const columns = db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
	if (!columns.some((col) => col.name === column)) {
		db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
	}
}

// Ensure newer user columns exist for richer profile data
ensureColumn('users', 'first_name', "TEXT DEFAULT ''");
ensureColumn('users', 'last_name', "TEXT DEFAULT ''");
ensureColumn('users', 'is_admin', 'INTEGER NOT NULL DEFAULT 0');
ensureColumn('users', 'user_code', "TEXT DEFAULT ''");
ensureColumn('users', 'pin', "TEXT DEFAULT ''");
ensureColumn('chat_history', 'reason', "TEXT DEFAULT ''");
ensureColumn('chat_history', 'parameters', "TEXT DEFAULT ''");
ensureColumn('user_notes', 'position', 'INTEGER NOT NULL DEFAULT 0');

const insertMessageStmt = db.prepare('INSERT INTO chat_history (user_id, sender, message, mode, tool, reason, parameters) VALUES (@userId, @sender, @message, @mode, @tool, @reason, @parameters)');
const recentMessagesStmt = db.prepare(`SELECT sender, message, created_at FROM chat_history WHERE user_id = ? ORDER BY created_at DESC, id DESC LIMIT ?`);
const pagedMessagesStmt = db.prepare(`SELECT sender, message, created_at FROM chat_history WHERE user_id = ? ORDER BY id DESC LIMIT ? OFFSET ?`);
const messageCountStmt = db.prepare('SELECT COUNT(*) as count FROM chat_history WHERE user_id = ?');
const insertSessionStmt = db.prepare('INSERT INTO sessions (user_id, token) VALUES (@userId, @token)');
const sessionByTokenStmt = db.prepare('SELECT * FROM sessions WHERE token = ?');
const updateSessionActivityStmt = db.prepare('UPDATE sessions SET last_active = CURRENT_TIMESTAMP WHERE id = ?');
const deleteSessionStmt = db.prepare('DELETE FROM sessions WHERE id = ?');
const deleteSessionsForUserStmt = db.prepare('DELETE FROM sessions WHERE user_id = ?');
const hasMigrationStmt = db.prepare('SELECT 1 FROM schema_migrations WHERE id = ?');
const insertMigrationStmt = db.prepare('INSERT INTO schema_migrations (id) VALUES (?)');
const userCountStmt = db.prepare('SELECT COUNT(*) as count FROM users');
const firstUserStmt = db.prepare('SELECT * FROM users ORDER BY id ASC LIMIT 1');
const adminUserExistsStmt = db.prepare('SELECT 1 FROM users WHERE is_admin = 1 LIMIT 1');
const userByIdStmt = db.prepare('SELECT * FROM users WHERE id = ?');
const userByCodeStmt = db.prepare('SELECT * FROM users WHERE user_code = ?');
const missingCodesStmt = db.prepare("SELECT id FROM users WHERE user_code IS NULL OR user_code = ''");
const setUserCodeStmt = db.prepare('UPDATE users SET user_code = @code WHERE id = @id');
const insertUserStmt = db.prepare(`INSERT INTO users (name, first_name, last_name, is_admin, user_code, pin) VALUES (@name, @firstName, @lastName, @isAdmin, @userCode, @pin)`);
const listNotesStmt = db.prepare(`SELECT id, user_id, title, body, position, updated_at FROM user_notes WHERE user_id = ? ORDER BY position ASC, id ASC`);
const insertNoteStmt = db.prepare(`INSERT INTO user_notes (user_id, title, body, position) VALUES (@userId, @title, @body, @position)`);
const updateNoteStmt = db.prepare(`UPDATE user_notes SET title = @title, body = @body, position = @position, updated_at = CURRENT_TIMESTAMP WHERE id = @id AND user_id = @userId`);
const deleteNoteStmt = db.prepare(`DELETE FROM user_notes WHERE id = ? AND user_id = ?`);

export function hasUsers(): boolean {
	const row = userCountStmt.get() as { count: number };
	return Number(row?.count ?? 0) > 0;
}

export function hasAdminUser(): boolean {
	return !!adminUserExistsStmt.get();
}

export function getFirstUser(): UserRecord | undefined {
	return firstUserStmt.get() as UserRecord | undefined;
}

export function getPrimaryUserId(userId?: number): number | undefined {
	if (userId) return userId;
	const user = getFirstUser();
	return user?.id;
}

function generateUserCode(): string {
	for (let i = 0; i < 20000; i += 1) {
		const code = Math.floor(Math.random() * 1_000_000)
			.toString()
			.padStart(6, '0');
		const existing = userByCodeStmt.get(code) as UserRecord | undefined;
		if (!existing) return code;
	}
	throw new Error('Unable to generate unique user code');
}

function backfillUserCodes() {
	const missing = missingCodesStmt.all() as { id: number }[];
	for (const row of missing) {
		const code = generateUserCode();
		setUserCodeStmt.run({ code, id: row.id });
	}
}

backfillUserCodes();

function ensureUniqueIndex(name: string, table: string, column: string) {
	const existing = db.prepare(`PRAGMA index_list(${table})`).all() as { name: string }[];
	if (!existing.some((idx) => idx.name === name)) {
		db.exec(`CREATE UNIQUE INDEX ${name} ON ${table}(${column})`);
	}
}

ensureUniqueIndex('idx_users_user_code', 'users', 'user_code');

export function createUser(firstName: string, lastName: string, pin: string, isAdmin = false): UserRecord {
	const cleanFirst = firstName.trim();
	const cleanLast = lastName.trim();
	const cleanPin = (pin || '').trim();
	if (!cleanFirst || !cleanLast) {
		throw new Error('First name and last name are required');
	}
	if (!/^[0-9]{4}$/.test(cleanPin)) {
		throw new Error('PIN must be 4 digits');
	}
	const displayName = `${cleanFirst} ${cleanLast}`.trim();
	const userCode = generateUserCode();
	const result = insertUserStmt.run({
		name: displayName,
		firstName: cleanFirst,
		lastName: cleanLast,
		isAdmin: isAdmin ? 1 : 0,
		userCode,
		pin: cleanPin,
	});
	const id = Number(result.lastInsertRowid);
	const user = userByIdStmt.get(id) as UserRecord | undefined;
	if (!user) {
		throw new Error('User creation failed');
	}
	return user;
}

export function verifyUser(code: string, pin: string): UserRecord | undefined {
	const cleanCode = (code || '').trim();
	const cleanPin = (pin || '').trim();
	if (!cleanCode || !cleanPin) return undefined;
	const user = userByCodeStmt.get(cleanCode) as UserRecord | undefined;
	if (!user) return undefined;
	if (user.pin !== cleanPin) return undefined;
	return user;
}

export function recordMessage(sender: Sender, message: string, userId?: number, mode?: string, tool?: string, reason?: string, parameters?: string): void {
	const resolvedUserId = getPrimaryUserId(userId);
	if (!resolvedUserId) {
		throw new Error('No user configured to record messages');
	}
	if (!reason) reason = '';
	if (!parameters) parameters = '';
	insertMessageStmt.run({ userId: resolvedUserId, sender, message, mode, tool, reason, parameters });
}

export function getRecentMessages(limit = 10, userId?: number): ChatRow[] {
	const resolvedUserId = getPrimaryUserId(userId);
	if (!resolvedUserId) return [];
	const rows = recentMessagesStmt.all(resolvedUserId, limit) as ChatRow[];
	// Reverse so the oldest of the set is first
	return rows.reverse();
}

export function getMessagesPage(offset: number, limit: number, userId?: number): { rows: ChatRow[]; total: number } {
	const resolvedUserId = getPrimaryUserId(userId);
	if (!resolvedUserId) return { rows: [], total: 0 };
	const cleanLimit = Math.max(1, Math.min(limit, 200));
	const cleanOffset = Math.max(0, offset);
	const rows = pagedMessagesStmt.all(resolvedUserId, cleanLimit, cleanOffset) as ChatRow[];
	const totalRow = messageCountStmt.get(resolvedUserId) as { count: number } | undefined;
	const total = Number(totalRow?.count ?? 0);
	// We queried DESC, so put back into chronological order
	rows.reverse();
	return { rows, total };
}

function generateSessionToken(): string {
	return crypto.randomBytes(32).toString('hex');
}

export function createSession(userId: number): string {
	const token = generateSessionToken();
	insertSessionStmt.run({ userId, token });
	return token;
}

export function getSessionByToken(token?: string): UserRecord | undefined {
	if (!token) return undefined;
	const session = sessionByTokenStmt.get(token) as { id: number; user_id: number } | undefined;
	if (!session) return undefined;
	updateSessionActivityStmt.run(session.id);
	const user = userByIdStmt.get(session.user_id) as UserRecord | undefined;
	return user;
}

export function revokeSession(token?: string): void {
	if (!token) return;
	const session = sessionByTokenStmt.get(token) as { id: number } | undefined;
	if (!session) return;
	deleteSessionStmt.run(session.id);
}

export function revokeAllSessionsForUser(userId: number): void {
	deleteSessionsForUserStmt.run(userId);
}

export type NoteRecord = {
	id: number;
	user_id: number;
	title: string;
	body: string;
	position: number;
	updated_at: string;
};

export function getNotes(userId: number): NoteRecord[] {
	return listNotesStmt.all(userId) as NoteRecord[];
}

export function createNote(userId: number, title: string, body: string, position: number): NoteRecord {
	const cleanTitle = (title ?? '').toString();
	const cleanBody = (body ?? '').toString();
	const cleanPos = Number.isFinite(position) ? position : 0;
	const result = insertNoteStmt.run({ userId, title: cleanTitle, body: cleanBody, position: cleanPos });
	const id = Number(result.lastInsertRowid);
	const rows = listNotesStmt.all(userId) as NoteRecord[];
	return rows.find((n) => n.id === id) as NoteRecord;
}

export function updateNote(userId: number, id: number, title: string, body: string, position: number): boolean {
	const cleanTitle = (title ?? '').toString();
	const cleanBody = (body ?? '').toString();
	const cleanPos = Number.isFinite(position) ? position : 0;
	const res = updateNoteStmt.run({ id, userId, title: cleanTitle, body: cleanBody, position: cleanPos });
	return res.changes > 0;
}

export function deleteNote(userId: number, id: number): boolean {
	const res = deleteNoteStmt.run(id, userId);
	return res.changes > 0;
}

type Migration = { id: string; up: () => void };

const migrations: Migration[] = [
	{
		id: '2025-02-03-users-and-sessions',
		up: () => {
			// Make sure user schema and unique user codes exist
			ensureColumn('users', 'first_name', "TEXT DEFAULT ''");
			ensureColumn('users', 'last_name', "TEXT DEFAULT ''");
			ensureColumn('users', 'is_admin', 'INTEGER NOT NULL DEFAULT 0');
			ensureColumn('users', 'user_code', "TEXT DEFAULT ''");
			ensureColumn('users', 'pin', "TEXT DEFAULT ''");
			ensureUniqueIndex('idx_users_user_code', 'users', 'user_code');

			ensureColumn('chat_history', 'mode', "TEXT DEFAULT ''");
			ensureColumn('chat_history', 'tool', "TEXT DEFAULT ''");
			ensureColumn('chat_history', 'reason', "TEXT DEFAULT ''");
			ensureColumn('chat_history', 'parameters', "TEXT DEFAULT ''");

			// Ensure sessions table/index exist (idempotent)
			db.exec(`
				CREATE TABLE IF NOT EXISTS sessions (
					id INTEGER PRIMARY KEY AUTOINCREMENT,
					user_id INTEGER NOT NULL,
					token TEXT NOT NULL UNIQUE,
					created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
					last_active DATETIME DEFAULT CURRENT_TIMESTAMP,
					FOREIGN KEY (user_id) REFERENCES users(id)
				);
			`);
			ensureUniqueIndex('idx_sessions_token', 'sessions', 'token');
		},
	},
	{
		id: '2025-02-10-user-notes',
		up: () => {
			db.exec(`
				CREATE TABLE IF NOT EXISTS user_notes (
					id INTEGER PRIMARY KEY AUTOINCREMENT,
					user_id INTEGER NOT NULL,
					title TEXT NOT NULL DEFAULT '',
					body TEXT NOT NULL DEFAULT '',
					position INTEGER NOT NULL DEFAULT 0,
					updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
					FOREIGN KEY (user_id) REFERENCES users(id)
				);
			`);
			ensureColumn('user_notes', 'position', 'INTEGER NOT NULL DEFAULT 0');
		},
	},
];

function runMigrations() {
	for (const migration of migrations) {
		const applied = hasMigrationStmt.get(migration.id) as { 1: number } | undefined;
		if (applied) continue;
		migration.up();
		insertMigrationStmt.run(migration.id);
	}
}

runMigrations();

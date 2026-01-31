import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

/**
 * Chat History Database
 * Stores chat conversations with persistence
 */

class ChatHistoryDB {
    constructor() {
        const dbPath = process.env.SQLITE_DB_PATH || path.resolve(process.cwd(), 'data', 'chat_history.db');
        const dir = path.dirname(dbPath);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

        this.db = new Database(dbPath);
        this.initialized = false;
    }

    async initialize() {
        if (this.initialized) return;

        this.db.exec(`
      CREATE TABLE IF NOT EXISTS chat_sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        userId TEXT NOT NULL,
        title TEXT,
        createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
        updatedAt TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);

        this.db.exec(`
      CREATE TABLE IF NOT EXISTS chat_messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        sessionId INTEGER NOT NULL,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        timestamp TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (sessionId) REFERENCES chat_sessions(id)
      )
    `);

        this.db.exec(`CREATE INDEX IF NOT EXISTS idx_userId ON chat_sessions(userId)`);
        this.db.exec(`CREATE INDEX IF NOT EXISTS idx_sessionId ON chat_messages(sessionId)`);

        this.initialized = true;
        console.log('Chat History DB initialized');
    }

    async createSession(userId, title = 'New Chat') {
        await this.initialize();

        const stmt = this.db.prepare(`
      INSERT INTO chat_sessions (userId, title)
      VALUES (?, ?)
    `);

        const result = stmt.run(userId, title);
        return result.lastInsertRowid;
    }

    async addMessage(sessionId, role, content) {
        await this.initialize();

        const stmt = this.db.prepare(`
      INSERT INTO chat_messages (sessionId, role, content)
      VALUES (?, ?, ?)
    `);

        stmt.run(sessionId, role, content);

        // Update session timestamp
        const updateStmt = this.db.prepare(`
      UPDATE chat_sessions
      SET updatedAt = CURRENT_TIMESTAMP
      WHERE id = ?
    `);
        updateStmt.run(sessionId);
    }

    async getSession(sessionId) {
        await this.initialize();

        const session = this.db.prepare(`
      SELECT * FROM chat_sessions WHERE id = ?
    `).get(sessionId);

        if (!session) return null;

        const messages = this.db.prepare(`
      SELECT * FROM chat_messages
      WHERE sessionId = ?
      ORDER BY timestamp ASC
    `).all(sessionId);

        return {
            ...session,
            messages
        };
    }

    async getUserSessions(userId, limit = 20) {
        await this.initialize();

        const sessions = this.db.prepare(`
      SELECT s.*, COUNT(m.id) as messageCount
      FROM chat_sessions s
      LEFT JOIN chat_messages m ON s.id = m.sessionId
      WHERE s.userId = ?
      GROUP BY s.id
      ORDER BY s.updatedAt DESC
      LIMIT ?
    `).all(userId, limit);

        return sessions;
    }

    async deleteSession(sessionId) {
        await this.initialize();

        // Delete messages first
        this.db.prepare('DELETE FROM chat_messages WHERE sessionId = ?').run(sessionId);

        // Delete session
        const result = this.db.prepare('DELETE FROM chat_sessions WHERE id = ?').run(sessionId);

        return { deleted: result.changes };
    }

    async updateSessionTitle(sessionId, title) {
        await this.initialize();

        const stmt = this.db.prepare(`
      UPDATE chat_sessions
      SET title = ?, updatedAt = CURRENT_TIMESTAMP
      WHERE id = ?
    `);

        stmt.run(title, sessionId);
    }
}

const chatHistoryDb = new ChatHistoryDB();
export default chatHistoryDb;

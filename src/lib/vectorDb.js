import fs from 'fs';
import path from 'path';
import Database from 'better-sqlite3';

const VECTOR_SIZE = 384; // MiniLM embedding size

class VectorDB {
  constructor() {
    const dbPath = process.env.SQLITE_DB_PATH || path.resolve(process.cwd(), 'data', 'vectors.db');
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    this.db = new Database(dbPath);
    this.initialized = false;
  }

  async initialize() {
    if (this.initialized) return;

    try {
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS documents (
          id TEXT PRIMARY KEY,
          vector TEXT NOT NULL,
          text TEXT,
          source TEXT,
          chunkId TEXT,
          page INTEGER,
          tags TEXT,
          created_at INTEGER
        );
      `);
      this.db.exec('CREATE INDEX IF NOT EXISTS idx_documents_source ON documents(source);');

      // Ensure tags column exists for older DBs
      const cols = this.db.prepare("PRAGMA table_info(documents)").all();
      const hasTags = cols.some(c => c.name === 'tags');
      if (!hasTags) {
        try {
          this.db.exec('ALTER TABLE documents ADD COLUMN tags TEXT');
        } catch (e) {
          console.warn('Could not add tags column:', e?.message || e);
        }
      }

      this.initialized = true;
    } catch (error) {
      console.error('Error initializing SQLite vector DB:', error);
      throw error;
    }
  }

  async addVectors(vectors) {
    await this.initialize();

    const insert = this.db.prepare(`INSERT OR REPLACE INTO documents (id, vector, text, source, chunkId, page, tags, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`);
    const now = Date.now();

    const rows = vectors.map((vec, idx) => ({
      id: `${vec.metadata.source}_${vec.metadata.chunkId}_${Date.now()}_${idx}`,
      vector: vec.embedding,
      text: vec.text,
      source: vec.metadata.source,
      chunkId: vec.metadata.chunkId,
      page: vec.metadata.page || null,
      tags: JSON.stringify(vec.tags || {}),
      created_at: now,
    }));

    const insertMany = this.db.transaction((items) => {
      for (const it of items) {
        insert.run(it.id, JSON.stringify(it.vector), it.text, it.source, it.chunkId, it.page, it.tags, it.created_at);
      }
    });

    try {
      insertMany(rows);
      return { success: true, count: rows.length };
    } catch (error) {
      console.error('Error adding vectors to SQLite:', error);
      throw error;
    }
  }

  _cosine(a, b) {
    let dot = 0;
    let na = 0;
    let nb = 0;
    for (let i = 0; i < a.length; i++) {
      dot += a[i] * b[i];
      na += a[i] * a[i];
      nb += b[i] * b[i];
    }
    const denom = Math.sqrt(na) * Math.sqrt(nb) || 1e-10;
    return dot / denom;
  }

  async search(queryVector, limit = 5, filter = null) {
    await this.initialize();

    try {
      let rows;
      // Support simple filter by source (filename)
      let source = null;
      if (filter && filter.must && Array.isArray(filter.must) && filter.must.length > 0) {
        const m = filter.must[0];
        if (m.key === 'source' && m.match && typeof m.match.value === 'string') {
          source = m.match.value;
        }
      }

      if (source) {
        rows = this.db.prepare('SELECT id, vector, text, source, chunkId, page FROM documents WHERE source = ?').all(source);
      } else {
        rows = this.db.prepare('SELECT id, vector, text, source, chunkId, page FROM documents').all();
      }

      // Compute similarities
      const qVec = queryVector;
      const scored = rows.map((r) => {
        const vec = JSON.parse(r.vector);
        const score = this._cosine(qVec, vec);
        return { text: r.text, source: r.source, chunkId: r.chunkId, page: r.page, score };
      });

      scored.sort((a, b) => b.score - a.score);
      return scored.slice(0, limit);
    } catch (error) {
      console.error('Error searching SQLite vectors:', error);
      throw error;
    }
  }

  async deleteBySource(source) {
    await this.initialize();
    try {
      this.db.prepare('DELETE FROM documents WHERE source = ?').run(source);
      return { success: true };
    } catch (error) {
      console.error('Error deleting vectors by source in SQLite:', error);
      throw error;
    }
  }

  async getAllBySource(source) {
    await this.initialize();
    try {
      const rows = this.db.prepare('SELECT text, source, chunkId, page FROM documents WHERE source = ?').all(source);
      return rows.map((r) => ({ text: r.text, source: r.source, chunkId: r.chunkId, page: r.page }));
    } catch (error) {
      console.error('Error getting all vectors by source from SQLite:', error);
      throw error;
    }
  }

  async getSourceStats() {
    await this.initialize();
    try {
      const rows = this.db.prepare(`SELECT source, COUNT(*) as count, SUM(CASE WHEN tags LIKE '%"is_predatory":true%' THEN 1 ELSE 0 END) as predatory_count FROM documents GROUP BY source ORDER BY count DESC`).all();
      return rows.map((r) => ({ source: r.source, count: r.count, predatory_count: r.predatory_count || 0 }));
    } catch (error) {
      console.error('Error getting source stats from SQLite:', error);
      throw error;
    }
  }
}

// Singleton instance
const vectorDb = new VectorDB();

export default vectorDb;

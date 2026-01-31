import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

/**
 * Enhanced Vector Database with Admin Feedback and Fine-Tuning
 * Supports RAG pipeline with learning capabilities
 */

class EnhancedVectorDB {
    constructor() {
        // Use separate database file to preserve existing vectors.db data
        const dbPath = process.env.ENHANCED_SQLITE_DB_PATH || path.resolve(process.cwd(), 'data', 'enhanced_vectors.db');
        const dir = path.dirname(dbPath);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

        this.db = new Database(dbPath);
        this.initialized = false;
    }

    async initialize() {
        if (this.initialized) return;

        // Enhanced schema with metadata for admin feedback
        this.db.exec(`
      CREATE TABLE IF NOT EXISTS documents (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        text TEXT NOT NULL,
        embedding TEXT NOT NULL,
        source TEXT,
        chunkId INTEGER,
        page INTEGER,
        category TEXT,
        predatory INTEGER DEFAULT 0,
        userId TEXT,
        adminReviewed INTEGER DEFAULT 0,
        adminFeedback TEXT,
        qualityScore INTEGER,
        embeddingVersion INTEGER DEFAULT 1,
        createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
        updatedAt TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);

        // Index for faster retrieval
        this.db.exec(`CREATE INDEX IF NOT EXISTS idx_source ON documents(source)`);
        this.db.exec(`CREATE INDEX IF NOT EXISTS idx_userId ON documents(userId)`);
        this.db.exec(`CREATE INDEX IF NOT EXISTS idx_adminReviewed ON documents(adminReviewed)`);
        this.db.exec(`CREATE INDEX IF NOT EXISTS idx_qualityScore ON documents(qualityScore)`);

        // Admin feedback table
        this.db.exec(`
      CREATE TABLE IF NOT EXISTS admin_feedback (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        documentId INTEGER,
        adminEmail TEXT,
        originalAnalysis TEXT,
        correctedAnalysis TEXT,
        qualityScore INTEGER,
        comments TEXT,
        createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (documentId) REFERENCES documents(id)
      )
    `);

        this.initialized = true;
        console.log('Enhanced Vector DB initialized with admin feedback support');
    }

    async addVectors(vectors, userId = null) {
        await this.initialize();

        const stmt = this.db.prepare(`
      INSERT INTO documents (text, embedding, source, chunkId, page, category, predatory, userId)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

        const insert = this.db.transaction((vecs) => {
            for (const vec of vecs) {
                stmt.run(
                    vec.text,
                    JSON.stringify(vec.embedding),
                    vec.metadata?.source || '',
                    vec.metadata?.chunkId ?? null,
                    vec.metadata?.page ?? null,
                    vec.tags?.category || null,
                    vec.tags?.predatory ? 1 : 0,
                    userId
                );
            }
        });

        insert(vectors);
        return { count: vectors.length };
    }

    async addWithFeedback(vectors, feedback, userId = null) {
        await this.initialize();

        const result = await this.addVectors(vectors, userId);

        // Mark as admin reviewed with high quality
        if (feedback) {
            const stmt = this.db.prepare(`
        UPDATE documents 
        SET adminReviewed = 1, 
            adminFeedback = ?, 
            qualityScore = ?,
            embeddingVersion = embeddingVersion + 1,
            updatedAt = CURRENT_TIMESTAMP
        WHERE userId = ? AND source = ?
      `);

            stmt.run(
                JSON.stringify(feedback),
                feedback.qualityScore || 5,
                userId,
                vectors[0]?.metadata?.source
            );
        }

        return result;
    }

    _cosine(a, b) {
        let dotProduct = 0;
        let normA = 0;
        let normB = 0;
        for (let i = 0; i < a.length; i++) {
            dotProduct += a[i] * b[i];
            normA += a[i] * a[i];
            normB += b[i] * b[i];
        }
        return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
    }

    async search(queryVector, limit = 5, filter = null) {
        await this.initialize();

        let query = 'SELECT * FROM documents';
        const params = [];

        if (filter) {
            const conditions = [];
            if (filter.source) {
                conditions.push('source = ?');
                params.push(filter.source);
            }
            if (filter.userId) {
                conditions.push('userId = ?');
                params.push(filter.userId);
            }
            if (filter.adminReviewed !== undefined) {
                conditions.push('adminReviewed = ?');
                params.push(filter.adminReviewed ? 1 : 0);
            }
            if (filter.minQualityScore) {
                conditions.push('qualityScore >= ?');
                params.push(filter.minQualityScore);
            }

            if (conditions.length > 0) {
                query += ' WHERE ' + conditions.join(' AND ');
            }
        }

        const stmt = this.db.prepare(query);
        const rows = stmt.all(...params);

        const results = rows.map(row => {
            const embedding = JSON.parse(row.embedding);
            const similarity = this._cosine(queryVector, embedding);

            // Boost similarity for admin-reviewed high-quality content
            const qualityBoost = row.adminReviewed && row.qualityScore >= 4 ? 0.1 : 0;

            return {
                id: row.id,
                text: row.text,
                similarity: similarity + qualityBoost,
                metadata: {
                    source: row.source,
                    chunkId: row.chunkId,
                    page: row.page,
                    userId: row.userId,
                    adminReviewed: row.adminReviewed === 1,
                    qualityScore: row.qualityScore,
                },
                tags: {
                    category: row.category,
                    predatory: row.predatory === 1,
                },
                adminFeedback: row.adminFeedback ? JSON.parse(row.adminFeedback) : null,
            };
        });

        results.sort((a, b) => b.similarity - a.similarity);
        return results.slice(0, limit);
    }

    async getUnreviewedAnalyses(limit = 20) {
        await this.initialize();

        const stmt = this.db.prepare(`
      SELECT DISTINCT source, userId, COUNT(*) as chunkCount, MIN(createdAt) as uploadedAt
      FROM documents
      WHERE adminReviewed = 0
      GROUP BY source, userId
      ORDER BY uploadedAt DESC
      LIMIT ?
    `);

        return stmt.all(limit);
    }

    async updateWithFeedback(source, userId, feedback) {
        await this.initialize();

        const stmt = this.db.prepare(`
      UPDATE documents
      SET adminReviewed = 1,
          adminFeedback = ?,
          qualityScore = ?,
          embeddingVersion = embeddingVersion + 1,
          updatedAt = CURRENT_TIMESTAMP
      WHERE source = ? AND userId = ?
    `);

        const result = stmt.run(
            JSON.stringify(feedback),
            feedback.qualityScore || 5,
            source,
            userId
        );

        // Store in feedback history
        const feedbackStmt = this.db.prepare(`
      INSERT INTO admin_feedback (documentId, adminEmail, originalAnalysis, correctedAnalysis, qualityScore, comments)
      SELECT id, ?, ?, ?, ?, ?
      FROM documents
      WHERE source = ? AND userId = ?
      LIMIT 1
    `);

        feedbackStmt.run(
            feedback.adminEmail,
            JSON.stringify(feedback.original),
            JSON.stringify(feedback.corrected),
            feedback.qualityScore,
            feedback.comments,
            source,
            userId
        );

        return { updated: result.changes };
    }

    async getQualityMetrics() {
        await this.initialize();

        const metrics = this.db.prepare(`
      SELECT 
        COUNT(*) as totalDocuments,
        SUM(CASE WHEN adminReviewed = 1 THEN 1 ELSE 0 END) as reviewedCount,
        AVG(CASE WHEN adminReviewed = 1 THEN qualityScore ELSE NULL END) as avgQualityScore,
        COUNT(DISTINCT userId) as uniqueUsers
      FROM documents
    `).get();

        const recentFeedback = this.db.prepare(`
      SELECT qualityScore, createdAt
      FROM admin_feedback
      ORDER BY createdAt DESC
      LIMIT 100
    `).all();

        return {
            ...metrics,
            recentFeedback,
            improvementTrend: this._calculateTrend(recentFeedback),
        };
    }

    _calculateTrend(feedback) {
        if (feedback.length < 10) return 'insufficient_data';

        const recent = feedback.slice(0, 50).reduce((sum, f) => sum + f.qualityScore, 0) / 50;
        const older = feedback.slice(50).reduce((sum, f) => sum + f.qualityScore, 0) / (feedback.length - 50);

        if (recent > older + 0.5) return 'improving';
        if (recent < older - 0.5) return 'declining';
        return 'stable';
    }

    async deleteBySource(source) {
        await this.initialize();
        const stmt = this.db.prepare('DELETE FROM documents WHERE source = ?');
        const result = stmt.run(source);
        return { deleted: result.changes };
    }

    async getAllBySource(source) {
        await this.initialize();
        const stmt = this.db.prepare('SELECT * FROM documents WHERE source = ?');
        return stmt.all(source);
    }
}

const enhancedVectorDb = new EnhancedVectorDB();
export default enhancedVectorDb;

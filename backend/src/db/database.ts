import sqlite3 from 'sqlite3';
import { open, Database } from 'sqlite';
import path from 'path';
import fs from 'fs';

let db: Database | null = null;

function getDbPath(): string {
  return process.env.DB_PATH || path.join(process.cwd(), 'data', 'knowledge.db');
}

export async function getDatabase(): Promise<Database> {
  if (!db) {
    throw new Error('Database not initialized');
  }
  return db;
}

export async function initializeDatabase(): Promise<Database> {
  if (db) return db;

  const dbPath = getDbPath();
  if (dbPath !== ':memory:' && !dbPath.startsWith('/tmp')) {
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  db = await open({
    filename: dbPath,
    driver: sqlite3.Database,
  });

  await createTables();
  return db;
}

export async function closeDatabase(): Promise<void> {
  if (db) {
    await db.close();
    db = null;
  }
}

async function createTables(): Promise<void> {
  const database = await getDatabase();

  // Notes table
  await database.exec(`
    CREATE TABLE IF NOT EXISTS notes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      content TEXT NOT NULL DEFAULT '',
      html_content TEXT,
      tags TEXT,
      backlinks TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Tags table (for quick tag lookup)
  await database.exec(`
    CREATE TABLE IF NOT EXISTS tags (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      color TEXT DEFAULT '#6366f1',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Note tags junction
  await database.exec(`
    CREATE TABLE IF NOT EXISTS note_tags (
      note_id INTEGER NOT NULL,
      tag_id INTEGER NOT NULL,
      PRIMARY KEY (note_id, tag_id),
      FOREIGN KEY (note_id) REFERENCES notes(id) ON DELETE CASCADE,
      FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
    )
  `);

  // Voice notes table
  await database.exec(`
    CREATE TABLE IF NOT EXISTS voice_notes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      note_id INTEGER NOT NULL,
      filename TEXT NOT NULL,
      original_filename TEXT,
      mime_type TEXT NOT NULL,
      duration_seconds INTEGER,
      transcription TEXT,
      file_size_bytes INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (note_id) REFERENCES notes(id) ON DELETE CASCADE
    )
  `);

  // Embeddings table for semantic search
  await database.exec(`
    CREATE TABLE IF NOT EXISTS note_embeddings (
      note_id INTEGER PRIMARY KEY,
      embedding BLOB NOT NULL,
      model TEXT DEFAULT 'nomic-embed-text',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (note_id) REFERENCES notes(id) ON DELETE CASCADE
    )
  `);

  // Indexes
  await database.exec(`CREATE INDEX IF NOT EXISTS idx_notes_title ON notes(title)`);
  await database.exec(`CREATE INDEX IF NOT EXISTS idx_notes_content ON notes(content)`);
  await database.exec(`CREATE INDEX IF NOT EXISTS idx_notes_updated ON notes(updated_at DESC)`);
  await database.exec(`CREATE INDEX IF NOT EXISTS idx_voice_notes_note_id ON voice_notes(note_id)`);
  await database.exec(`CREATE INDEX IF NOT EXISTS idx_embeddings_note_id ON note_embeddings(note_id)`);
}

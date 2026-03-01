"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDatabase = getDatabase;
exports.initializeDatabase = initializeDatabase;
exports.closeDatabase = closeDatabase;
const sqlite3_1 = __importDefault(require("sqlite3"));
const sqlite_1 = require("sqlite");
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
let db = null;
function getDbPath() {
    return process.env.DB_PATH || path_1.default.join(process.cwd(), 'data', 'knowledge.db');
}
async function getDatabase() {
    if (!db) {
        throw new Error('Database not initialized');
    }
    return db;
}
async function initializeDatabase() {
    if (db)
        return db;
    const dbPath = getDbPath();
    if (dbPath !== ':memory:' && !dbPath.startsWith('/tmp')) {
        const dir = path_1.default.dirname(dbPath);
        if (!fs_1.default.existsSync(dir)) {
            fs_1.default.mkdirSync(dir, { recursive: true });
        }
    }
    db = await (0, sqlite_1.open)({
        filename: dbPath,
        driver: sqlite3_1.default.Database,
    });
    await createTables();
    return db;
}
async function closeDatabase() {
    if (db) {
        await db.close();
        db = null;
    }
}
async function createTables() {
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
    // Indexes
    await database.exec(`CREATE INDEX IF NOT EXISTS idx_notes_title ON notes(title)`);
    await database.exec(`CREATE INDEX IF NOT EXISTS idx_notes_content ON notes(content)`);
    await database.exec(`CREATE INDEX IF NOT EXISTS idx_notes_updated ON notes(updated_at DESC)`);
}
//# sourceMappingURL=database.js.map
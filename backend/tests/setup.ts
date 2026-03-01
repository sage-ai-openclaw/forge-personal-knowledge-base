import { beforeAll, afterAll, beforeEach } from 'vitest';
import { initializeDatabase, closeDatabase, getDatabase } from '../src/db/database';

process.env.DB_PATH = ':memory:';

beforeAll(async () => {
  await initializeDatabase();
});

afterAll(async () => {
  await closeDatabase();
});

beforeEach(async () => {
  const db = await getDatabase();
  await db.run('DELETE FROM note_tags');
  await db.run('DELETE FROM notes');
  await db.run('DELETE FROM tags');
});

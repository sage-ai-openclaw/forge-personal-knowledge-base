import { getDatabase } from '../db/database';
import type { Note, CreateNoteInput, UpdateNoteInput } from '../types';
import { marked } from 'marked';

export class NoteModel {
  static async create(input: CreateNoteInput): Promise<Note> {
    const db = await getDatabase();
    
    // Convert markdown to HTML
    const htmlContent = await marked(input.content || '');
    
    // Extract tags from content (#tag)
    const extractedTags = this.extractTags(input.content);
    const allTags = [...new Set([...(input.tags || []), ...extractedTags])];
    
    // Extract backlinks ([[Note Title]])
    const backlinks = this.extractBacklinks(input.content);
    
    const result = await db.run(`
      INSERT INTO notes (title, content, html_content, tags, backlinks)
      VALUES (?, ?, ?, ?, ?)
    `, [
      input.title,
      input.content || '',
      htmlContent,
      JSON.stringify(allTags),
      JSON.stringify(backlinks),
    ]);

    // Save tags
    for (const tag of allTags) {
      await db.run(`INSERT OR IGNORE INTO tags (name) VALUES (?)`, tag);
      const tagRow = await db.get(`SELECT id FROM tags WHERE name = ?`, tag);
      if (tagRow) {
        await db.run(`INSERT OR IGNORE INTO note_tags (note_id, tag_id) VALUES (?, ?)`, 
          result.lastID, tagRow.id);
      }
    }

    return (await this.findById(result.lastID!))!;
  }

  static async findById(id: number): Promise<Note | null> {
    const db = await getDatabase();
    const row = await db.get('SELECT * FROM notes WHERE id = ?', id);
    if (!row) return null;
    return this.mapRow(row);
  }

  static async findAll(): Promise<Note[]> {
    const db = await getDatabase();
    const rows = await db.all('SELECT * FROM notes ORDER BY updated_at DESC');
    return rows.map(row => this.mapRow(row));
  }

  static async search(query: string): Promise<Note[]> {
    const db = await getDatabase();
    const searchTerm = `%${query}%`;
    const rows = await db.all(`
      SELECT * FROM notes 
      WHERE title LIKE ? OR content LIKE ?
      ORDER BY updated_at DESC
    `, searchTerm, searchTerm);
    return rows.map(row => this.mapRow(row));
  }

  static async update(id: number, input: UpdateNoteInput): Promise<Note | null> {
    const db = await getDatabase();
    
    const existing = await this.findById(id);
    if (!existing) return null;

    const updates: string[] = [];
    const values: any[] = [];

    if (input.title !== undefined) {
      updates.push('title = ?');
      values.push(input.title);
    }
    
    if (input.content !== undefined) {
      updates.push('content = ?');
      values.push(input.content);
      
      // Update HTML content
      const htmlContent = await marked(input.content);
      updates.push('html_content = ?');
      values.push(htmlContent);
      
      // Update tags and backlinks
      const extractedTags = this.extractTags(input.content);
      const allTags = [...new Set([...(input.tags || existing.tags || []), ...extractedTags])];
      const backlinks = this.extractBacklinks(input.content);
      
      updates.push('tags = ?');
      values.push(JSON.stringify(allTags));
      updates.push('backlinks = ?');
      values.push(JSON.stringify(backlinks));
      
      // Update tags
      for (const tag of allTags) {
        await db.run(`INSERT OR IGNORE INTO tags (name) VALUES (?)`, tag);
        const tagRow = await db.get(`SELECT id FROM tags WHERE name = ?`, tag);
        if (tagRow) {
          await db.run(`INSERT OR IGNORE INTO note_tags (note_id, tag_id) VALUES (?, ?)`, 
            id, tagRow.id);
        }
      }
    } else if (input.tags !== undefined) {
      updates.push('tags = ?');
      values.push(JSON.stringify(input.tags));
    }

    if (updates.length === 0) return existing;

    updates.push('updated_at = CURRENT_TIMESTAMP');
    values.push(id);

    await db.run(`UPDATE notes SET ${updates.join(', ')} WHERE id = ?`, values);
    return this.findById(id);
  }

  static async delete(id: number): Promise<boolean> {
    const db = await getDatabase();
    const result = await db.run('DELETE FROM notes WHERE id = ?', id);
    return result.changes! > 0;
  }

  private static extractTags(content: string): string[] {
    const tagRegex = /#(\w+)/g;
    const tags: string[] = [];
    let match;
    while ((match = tagRegex.exec(content)) !== null) {
      tags.push(match[1].toLowerCase());
    }
    return tags;
  }

  private static extractBacklinks(content: string): string[] {
    const linkRegex = /\[\[([^\]]+)\]\]/g;
    const links: string[] = [];
    let match;
    while ((match = linkRegex.exec(content)) !== null) {
      links.push(match[1]);
    }
    return links;
  }

  private static mapRow(row: any): Note {
    return {
      id: row.id,
      title: row.title,
      content: row.content,
      htmlContent: row.html_content,
      tags: row.tags ? JSON.parse(row.tags) : [],
      backlinks: row.backlinks ? JSON.parse(row.backlinks) : [],
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}

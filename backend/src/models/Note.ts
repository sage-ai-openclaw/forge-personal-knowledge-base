import { getDatabase } from '../db/database';
import type { Note, CreateNoteInput, UpdateNoteInput, SearchResult } from '../types';
import { marked } from 'marked';
import { EmbeddingService } from '../services/EmbeddingService';

export class NoteModel {
  static async create(input: CreateNoteInput): Promise<Note> {
    const db = await getDatabase();
    
    // Convert markdown to HTML
    const rawHtmlContent = await marked(input.content || '');
    
    // Convert wiki links to clickable HTML links
    const htmlContent = this.processWikiLinksToHtml(rawHtmlContent);
    
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

    const noteId = result.lastID!;

    // Save tags
    for (const tag of allTags) {
      await db.run(`INSERT OR IGNORE INTO tags (name) VALUES (?)`, tag);
      const tagRow = await db.get(`SELECT id FROM tags WHERE name = ?`, tag);
      if (tagRow) {
        await db.run(`INSERT OR IGNORE INTO note_tags (note_id, tag_id) VALUES (?, ?)`, 
          noteId, tagRow.id);
      }
    }

    // Generate and store embedding asynchronously (don't block on failure)
    this.generateAndStoreEmbedding(noteId, input.title, input.content || '').catch(err => {
      console.error('Failed to generate embedding for new note:', err);
    });

    return (await this.findById(noteId))!;
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

  /**
   * Semantic search using embeddings and cosine similarity
   */
  static async semanticSearch(query: string, topK: number = 10): Promise<SearchResult[]> {
    const db = await getDatabase();

    // Generate embedding for the query
    const queryEmbedding = await EmbeddingService.generateEmbedding(query);

    // Get all notes with embeddings
    const rows = await db.all(`
      SELECT n.*, ne.embedding, ne.model
      FROM notes n
      JOIN note_embeddings ne ON n.id = ne.note_id
    `);

    if (rows.length === 0) {
      return [];
    }

    // Calculate cosine similarity for each note
    const results: SearchResult[] = rows.map(row => {
      const noteEmbedding = EmbeddingService.bufferToEmbedding(row.embedding);
      const similarity = EmbeddingService.cosineSimilarity(queryEmbedding, noteEmbedding);
      
      return {
        note: this.mapRow(row),
        similarity,
      };
    });

    // Sort by similarity (highest first) and return top K
    return results
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, topK);
  }

  /**
   * Hybrid search: combine semantic and text search
   */
  static async hybridSearch(query: string, topK: number = 10): Promise<SearchResult[]> {
    const db = await getDatabase();

    // Try semantic search first
    const semanticResults = await this.semanticSearch(query, topK * 2);

    // Also do text search for fallback
    const searchTerm = `%${query}%`;
    const textRows = await db.all(`
      SELECT * FROM notes 
      WHERE title LIKE ? OR content LIKE ?
      ORDER BY updated_at DESC
    `, searchTerm, searchTerm);

    // Combine results (semantic results take precedence)
    const seenIds = new Set(semanticResults.map(r => r.note.id));
    const textResults: SearchResult[] = textRows
      .filter(row => !seenIds.has(row.id))
      .map(row => ({
        note: this.mapRow(row),
        similarity: 0.5, // Default lower score for text matches
      }));

    return [...semanticResults, ...textResults].slice(0, topK);
  }

  static async findByTitle(title: string): Promise<Note | null> {
    const db = await getDatabase();
    const row = await db.get('SELECT * FROM notes WHERE title = ? COLLATE NOCASE', title);
    if (!row) return null;
    return this.mapRow(row);
  }

  static async findBacklinks(noteTitle: string): Promise<Note[]> {
    const db = await getDatabase();
    const rows = await db.all(`
      SELECT * FROM notes 
      WHERE json_extract(backlinks, '$') LIKE ?
      ORDER BY updated_at DESC
    `, `%${noteTitle}%`);
    return rows.map(row => this.mapRow(row)).filter(note => 
      note.backlinks?.some(link => link.toLowerCase() === noteTitle.toLowerCase())
    );
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
      const rawHtmlContent = await marked(input.content);
      // Convert wiki links to clickable HTML links
      const htmlContent = this.processWikiLinksToHtml(rawHtmlContent);
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

      // Regenerate embedding
      const newTitle = input.title !== undefined ? input.title : existing.title;
      this.generateAndStoreEmbedding(id, newTitle, input.content).catch(err => {
        console.error('Failed to regenerate embedding for updated note:', err);
      });
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

  /**
   * Generate and store embedding for a note
   */
  private static async generateAndStoreEmbedding(
    noteId: number, 
    title: string, 
    content: string
  ): Promise<void> {
    const db = await getDatabase();

    // Combine title and content for embedding
    const textToEmbed = `${title}\n\n${content}`.slice(0, 8000);

    try {
      const embedding = await EmbeddingService.generateEmbedding(textToEmbed);
      const embeddingBuffer = EmbeddingService.embeddingToBuffer(embedding);

      await db.run(`
        INSERT INTO note_embeddings (note_id, embedding, model, updated_at)
        VALUES (?, ?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(note_id) DO UPDATE SET
          embedding = excluded.embedding,
          model = excluded.model,
          updated_at = CURRENT_TIMESTAMP
      `, noteId, embeddingBuffer, 'nomic-embed-text');
    } catch (error) {
      console.error(`Failed to store embedding for note ${noteId}:`, error);
      throw error;
    }
  }

  /**
   * Regenerate embeddings for all notes (useful for migration)
   */
  static async regenerateAllEmbeddings(): Promise<{ processed: number; failed: number }> {
    const db = await getDatabase();
    const notes = await this.findAll();
    
    let processed = 0;
    let failed = 0;

    for (const note of notes) {
      try {
        await this.generateAndStoreEmbedding(note.id, note.title, note.content);
        processed++;
      } catch (error) {
        console.error(`Failed to regenerate embedding for note ${note.id}:`, error);
        failed++;
      }
    }

    return { processed, failed };
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

  private static processWikiLinksToHtml(html: string): string {
    // Convert [[Note Title]] in the HTML to clickable links
    // First, we need to handle any escaped versions that might appear
    return html.replace(/\[\[([^\]]+)\]\]/g, (match, title) => {
      const encodedTitle = encodeURIComponent(title);
      return `<a href="/notes/${encodedTitle}" class="wiki-link" data-wiki-title="${title}">${title}</a>`;
    });
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

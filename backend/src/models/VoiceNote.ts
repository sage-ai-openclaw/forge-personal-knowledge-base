import { getDatabase } from '../db/database';

export interface VoiceNote {
  id: number;
  noteId: number;
  filename: string;
  originalFilename?: string;
  mimeType: string;
  durationSeconds?: number;
  transcription?: string;
  fileSizeBytes?: number;
  createdAt: string;
}

export interface CreateVoiceNoteInput {
  noteId: number;
  filename: string;
  originalFilename?: string;
  mimeType: string;
  durationSeconds?: number;
  transcription?: string;
  fileSizeBytes?: number;
}

export class VoiceNoteModel {
  static async create(input: CreateVoiceNoteInput): Promise<VoiceNote> {
    const db = await getDatabase();
    
    const result = await db.run(`
      INSERT INTO voice_notes (note_id, filename, original_filename, mime_type, duration_seconds, transcription, file_size_bytes)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [
      input.noteId,
      input.filename,
      input.originalFilename || null,
      input.mimeType,
      input.durationSeconds || null,
      input.transcription || null,
      input.fileSizeBytes || null,
    ]);

    return (await this.findById(result.lastID!))!;
  }

  static async findById(id: number): Promise<VoiceNote | null> {
    const db = await getDatabase();
    const row = await db.get('SELECT * FROM voice_notes WHERE id = ?', id);
    if (!row) return null;
    return this.mapRow(row);
  }

  static async findByNoteId(noteId: number): Promise<VoiceNote[]> {
    const db = await getDatabase();
    const rows = await db.all('SELECT * FROM voice_notes WHERE note_id = ? ORDER BY created_at DESC', noteId);
    return rows.map(row => this.mapRow(row));
  }

  static async updateTranscription(id: number, transcription: string): Promise<VoiceNote | null> {
    const db = await getDatabase();
    
    await db.run(`
      UPDATE voice_notes 
      SET transcription = ?
      WHERE id = ?
    `, [transcription, id]);

    return this.findById(id);
  }

  static async delete(id: number): Promise<boolean> {
    const db = await getDatabase();
    const result = await db.run('DELETE FROM voice_notes WHERE id = ?', id);
    return result.changes! > 0;
  }

  static async deleteByNoteId(noteId: number): Promise<void> {
    const db = await getDatabase();
    await db.run('DELETE FROM voice_notes WHERE note_id = ?', noteId);
  }

  private static mapRow(row: any): VoiceNote {
    return {
      id: row.id,
      noteId: row.note_id,
      filename: row.filename,
      originalFilename: row.original_filename,
      mimeType: row.mime_type,
      durationSeconds: row.duration_seconds,
      transcription: row.transcription,
      fileSizeBytes: row.file_size_bytes,
      createdAt: row.created_at,
    };
  }
}

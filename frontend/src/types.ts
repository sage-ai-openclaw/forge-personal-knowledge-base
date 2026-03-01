export interface Note {
  id: number;
  title: string;
  content: string;
  htmlContent?: string;
  tags?: string[];
  backlinks?: string[];
  createdAt: string;
  updatedAt: string;
}

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

export interface CreateNoteInput {
  title: string;
  content: string;
  tags?: string[];
}

export interface UpdateNoteInput {
  title?: string;
  content?: string;
  tags?: string[];
}

export interface SaveNoteResponse {
  note: Note;
  suggestedTags?: string[];
}

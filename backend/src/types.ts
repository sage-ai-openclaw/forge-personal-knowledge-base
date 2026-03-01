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

export interface Tag {
  id: number;
  name: string;
  color?: string;
  createdAt: string;
}

export interface TagSuggestionResponse {
  suggestions: string[];
}

export interface SaveNoteResponse {
  note: Note;
  suggestedTags?: string[];
}

export interface SearchResult {
  note: Note;
  similarity: number;
}

export interface NoteEmbedding {
  noteId: number;
  embedding: number[];
  model: string;
  createdAt: string;
  updatedAt: string;
}

export interface SearchRequest {
  query: string;
  topK?: number;
}

export interface SearchResponse {
  results: SearchResult[];
  query: string;
}

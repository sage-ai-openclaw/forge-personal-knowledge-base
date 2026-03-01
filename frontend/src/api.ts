import type { Note, CreateNoteInput, UpdateNoteInput, SaveNoteResponse, VoiceNote, SearchResponse } from './types';

const API_URL = '/api';

export async function fetchNotes(): Promise<Note[]> {
  const res = await fetch(`${API_URL}/notes`);
  if (!res.ok) throw new Error('Failed to fetch notes');
  return res.json();
}

export async function fetchNote(id: number): Promise<Note> {
  const res = await fetch(`${API_URL}/notes/${id}`);
  if (!res.ok) throw new Error('Failed to fetch note');
  return res.json();
}

export async function createNote(input: CreateNoteInput): Promise<SaveNoteResponse> {
  const res = await fetch(`${API_URL}/notes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error('Failed to create note');
  return res.json();
}

export async function updateNote(id: number, input: UpdateNoteInput): Promise<SaveNoteResponse> {
  const res = await fetch(`${API_URL}/notes/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error('Failed to update note');
  return res.json();
}

export async function deleteNote(id: number): Promise<void> {
  const res = await fetch(`${API_URL}/notes/${id}`, {
    method: 'DELETE',
  });
  if (!res.ok) throw new Error('Failed to delete note');
}

export async function fetchBacklinks(id: number): Promise<Note[]> {
  const res = await fetch(`${API_URL}/notes/${id}/backlinks`);
  if (!res.ok) throw new Error('Failed to fetch backlinks');
  return res.json();
}

export async function findOrCreateNote(input: CreateNoteInput): Promise<{ note: Note; created: boolean }> {
  const res = await fetch(`${API_URL}/notes/find-or-create`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error('Failed to find or create note');
  return res.json();
}

export async function fetchNoteByTitle(title: string): Promise<Note | null> {
  const res = await fetch(`${API_URL}/notes/by-title/${encodeURIComponent(title)}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error('Failed to fetch note by title');
  return res.json();
}

export async function suggestTags(id: number, title: string, content: string, existingTags: string[] = []): Promise<{ suggestions: string[] }> {
  const res = await fetch(`${API_URL}/notes/${id}/suggest-tags`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title, content, existingTags }),
  });
  if (!res.ok) throw new Error('Failed to suggest tags');
  return res.json();
}

// Voice notes API
export async function fetchVoiceNotes(noteId: number): Promise<VoiceNote[]> {
  const res = await fetch(`${API_URL}/notes/${noteId}/voice`);
  if (!res.ok) throw new Error('Failed to fetch voice notes');
  return res.json();
}

export async function uploadVoiceNote(
  noteId: number, 
  audioBlob: Blob, 
  duration: number,
  transcribe = true
): Promise<{ voiceNote: VoiceNote; transcription?: string; transcribed: boolean }> {
  const formData = new FormData();
  formData.append('audio', audioBlob, `recording-${Date.now()}.webm`);
  formData.append('duration', String(duration));
  formData.append('transcribe', String(transcribe));

  const res = await fetch(`${API_URL}/notes/${noteId}/voice`, {
    method: 'POST',
    body: formData,
  });
  if (!res.ok) throw new Error('Failed to upload voice note');
  return res.json();
}

export async function transcribeVoiceNote(voiceNoteId: number): Promise<{ transcription: string }> {
  const res = await fetch(`${API_URL}/voice/${voiceNoteId}/transcribe`, {
    method: 'POST',
  });
  if (!res.ok) throw new Error('Failed to transcribe voice note');
  return res.json();
}

export async function deleteVoiceNote(voiceNoteId: number): Promise<void> {
  const res = await fetch(`${API_URL}/voice/${voiceNoteId}`, {
    method: 'DELETE',
  });
  if (!res.ok) throw new Error('Failed to delete voice note');
}

export function getVoiceNoteAudioUrl(voiceNoteId: number): string {
  return `${API_URL}/voice/${voiceNoteId}/audio`;
}

export async function checkVoiceHealth(): Promise<{ whisperAvailable: boolean; error?: string }> {
  const res = await fetch(`${API_URL}/voice/health`);
  if (!res.ok) throw new Error('Failed to check voice health');
  return res.json();
}

// Search API
export interface SearchParams {
  query: string;
  topK?: number;
  mode?: 'semantic' | 'text' | 'hybrid';
}

export async function searchNotes(params: SearchParams): Promise<{
  results: { note: Note; similarity: number }[];
  query: string;
  mode: string;
  count: number;
}> {
  const res = await fetch(`${API_URL}/search`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  if (!res.ok) throw new Error('Failed to search notes');
  return res.json();
}

export async function checkSearchHealth(): Promise<{
  status: string;
  embeddingModel?: string;
  embeddingDimension?: number;
  error?: string;
}> {
  const res = await fetch(`${API_URL}/search/health`);
  if (!res.ok) throw new Error('Failed to check search health');
  return res.json();
}

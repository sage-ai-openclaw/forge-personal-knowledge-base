import type { Note, CreateNoteInput, UpdateNoteInput, SaveNoteResponse } from './types';

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

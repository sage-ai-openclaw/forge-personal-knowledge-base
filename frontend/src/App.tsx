import { useState, useEffect, useCallback } from 'react';
import { NoteList } from './components/NoteList';
import { NoteEditor } from './components/NoteEditor';
import { fetchNotes, createNote } from './api';
import type { Note } from './types';

function App() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [activeNote, setActiveNote] = useState<Note | null>(null);
  const [loading, setLoading] = useState(true);

  const loadNotes = useCallback(async () => {
    try {
      const data = await fetchNotes();
      setNotes(data);
    } catch (err) {
      console.error('Failed to load notes:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadNotes();
  }, [loadNotes]);

  const handleCreateNote = async () => {
    try {
      const newNote = await createNote({
        title: 'New Note',
        content: '',
      });
      setNotes((prev) => [newNote, ...prev]);
      setActiveNote(newNote);
    } catch (err) {
      console.error('Failed to create note:', err);
    }
  };

  const handleSelectNote = (note: Note) => {
    setActiveNote(note);
  };

  const handleNoteChange = useCallback((updatedNote: Note) => {
    // If it's a new note (navigated via wiki link), refresh the list
    const existingNote = notes.find(n => n.id === updatedNote.id);
    if (!existingNote) {
      setNotes((prev) => [updatedNote, ...prev]);
    } else {
      // Update in list
      setNotes((prev) =>
        prev.map((n) => (n.id === updatedNote.id ? updatedNote : n))
      );
    }
    setActiveNote(updatedNote);
  }, [notes]);

  const handleNoteDeleted = useCallback((id: number) => {
    setNotes((prev) => prev.filter((n) => n.id !== id));
    setActiveNote(null);
  }, []);

  if (loading) {
    return <div className="loading">Loading...</div>;
  }

  return (
    <div className="app">
      <NoteList
        notes={notes}
        activeNoteId={activeNote?.id || null}
        onSelectNote={handleSelectNote}
        onCreateNote={handleCreateNote}
      />
      <NoteEditor
        note={activeNote}
        onNoteChange={handleNoteChange}
        onNoteDeleted={handleNoteDeleted}
      />
    </div>
  );
}

export default App;

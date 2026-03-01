import { useState, useEffect, useCallback } from 'react';
import { NoteList } from './components/NoteList';
import { NoteEditor } from './components/NoteEditor';
import { SearchBar } from './components/SearchBar';
import { fetchNotes, createNote, searchNotes } from './api';
import type { Note, SearchResult } from './types';

function App() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [activeNote, setActiveNote] = useState<Note | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);

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
      const response = await createNote({
        title: 'New Note',
        content: '',
      });
      setNotes((prev) => [response.note, ...prev]);
      setActiveNote(response.note);
    } catch (err) {
      console.error('Failed to create note:', err);
    }
  };

  const handleSelectNote = (note: Note) => {
    setActiveNote(note);
  };

  const handleSearch = useCallback(async (query: string) => {
    setSearchLoading(true);
    try {
      const response = await searchNotes(query, 'hybrid', 10);
      setSearchResults(response.results);
    } catch (err) {
      console.error('Failed to search notes:', err);
      setSearchResults([]);
    } finally {
      setSearchLoading(false);
    }
  }, []);

  const handleSelectSearchResult = useCallback((noteId: number) => {
    const note = notes.find(n => n.id === noteId);
    if (note) {
      setActiveNote(note);
    } else {
      // If note not in current list (edge case), refresh notes
      loadNotes().then(() => {
        const refreshedNote = notes.find(n => n.id === noteId);
        if (refreshedNote) {
          setActiveNote(refreshedNote);
        }
      });
    }
    setSearchResults([]);
  }, [notes, loadNotes]);

  const handleCloseSearch = useCallback(() => {
    setSearchResults([]);
  }, []);

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
      <div className="main-content">
        <div className="search-bar-wrapper">
          <SearchBar
            onSearch={handleSearch}
            results={searchResults}
            loading={searchLoading}
            onSelectResult={handleSelectSearchResult}
            onClose={handleCloseSearch}
          />
        </div>
        <NoteEditor
          note={activeNote}
          onNoteChange={handleNoteChange}
          onNoteDeleted={handleNoteDeleted}
        />
      </div>
    </div>
  );
}

export default App;

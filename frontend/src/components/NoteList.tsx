import type { Note } from '../types';

interface NoteListProps {
  notes: Note[];
  activeNoteId: number | null;
  onSelectNote: (note: Note) => void;
  onCreateNote: () => void;
}

export function NoteList({ notes, activeNoteId, onSelectNote, onCreateNote }: NoteListProps) {
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  return (
    <div className="sidebar">
      <div className="sidebar-header">
        <h1>📚 Knowledge Base</h1>
        <button className="new-note-btn" onClick={onCreateNote}>
          + New Note
        </button>
      </div>
      <div className="note-list">
        {notes.length === 0 ? (
          <div className="loading">No notes yet</div>
        ) : (
          notes.map((note) => (
            <div
              key={note.id}
              className={`note-item ${activeNoteId === note.id ? 'active' : ''}`}
              onClick={() => onSelectNote(note)}
            >
              <div className="note-item-title">{note.title || 'Untitled'}</div>
              <div className="note-item-date">{formatDate(note.updatedAt)}</div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

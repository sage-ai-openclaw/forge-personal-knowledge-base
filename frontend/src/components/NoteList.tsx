import type { Note } from '../types';

interface NoteListProps {
  notes: Note[];
  activeNoteId: number | null;
  onSelectNote: (note: Note) => void;
  searchResults?: { note: Note; similarity: number }[];
}

export function NoteList({ notes, activeNoteId, onSelectNote, onCreateNote, searchResults }: NoteListProps) {
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const formatSimilarity = (score: number) => {
    return Math.round(score * 100) + '%';
  };

  return (
    <div className="note-list">
      {notes.length === 0 ? (
        <div className="loading">{searchResults ? 'No results found' : 'No notes yet'}</div>
      ) : (
        notes.map((note) => {
          const searchResult = searchResults?.find(r => r.note.id === note.id);
          return (
            <div
              key={note.id}
              className={`note-item ${activeNoteId === note.id ? 'active' : ''}`}
              onClick={() => onSelectNote(note)}
            >
              <div className="note-item-header">
                <div className="note-item-title">{note.title || 'Untitled'}</div>
                {searchResult && (
                  <div className="note-item-similarity" title={`Similarity: ${formatSimilarity(searchResult.similarity)}`}>
                    {formatSimilarity(searchResult.similarity)}
                  </div>
                )}
              </div>
              <div className="note-item-date">{formatDate(note.updatedAt)}</div>
            </div>
          );
        })
      )}
    </div>
  );
}

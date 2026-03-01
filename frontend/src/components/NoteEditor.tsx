import { useState, useCallback, useEffect } from 'react';
import type { Note } from '../types';
import { fetchBacklinks, findOrCreateNote, deleteNote, updateNote } from '../api';

interface NoteEditorProps {
  note: Note | null;
  onNoteChange: (note: Note) => void;
  onNoteDeleted: (id: number) => void;
}

export function NoteEditor({ note, onNoteChange, onNoteDeleted }: NoteEditorProps) {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [backlinks, setBacklinks] = useState<Note[]>([]);
  const [htmlContent, setHtmlContent] = useState('');
  const [isDirty, setIsDirty] = useState(false);
  const [saveTimeout, setSaveTimeout] = useState<ReturnType<typeof setTimeout> | null>(null);

  // Load note data when note changes
  useEffect(() => {
    if (note) {
      setTitle(note.title);
      setContent(note.content);
      setHtmlContent(note.htmlContent || '');
      setIsDirty(false);
      loadBacklinks(note.id);
    }
  }, [note?.id]);

  const loadBacklinks = async (noteId: number) => {
    try {
      const bl = await fetchBacklinks(noteId);
      setBacklinks(bl);
    } catch (err) {
      console.error('Failed to load backlinks:', err);
    }
  };

  // Auto-save with debounce
  const saveNote = useCallback(async (newTitle: string, newContent: string) => {
    if (!note) return;

    try {
      const updated = await updateNote(note.id, {
        title: newTitle,
        content: newContent,
      });
      setHtmlContent(updated.htmlContent || '');
      onNoteChange(updated);
      setIsDirty(false);
      
      // Reload backlinks since they might have changed
      loadBacklinks(note.id);
    } catch (err) {
      console.error('Failed to save note:', err);
    }
  }, [note, onNoteChange]);

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTitle = e.target.value;
    setTitle(newTitle);
    setIsDirty(true);

    if (saveTimeout) clearTimeout(saveTimeout);
    setSaveTimeout(setTimeout(() => saveNote(newTitle, content), 1000));
  };

  const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newContent = e.target.value;
    setContent(newContent);
    setIsDirty(true);

    if (saveTimeout) clearTimeout(saveTimeout);
    setSaveTimeout(setTimeout(() => saveNote(title, newContent), 1000));
  };

  const handleDelete = async () => {
    if (!note || !confirm('Are you sure you want to delete this note?')) return;

    try {
      await deleteNote(note.id);
      onNoteDeleted(note.id);
    } catch (err) {
      console.error('Failed to delete note:', err);
    }
  };

  const handleWikiLinkClick = async (e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    if (target.classList.contains('wiki-link')) {
      e.preventDefault();
      const wikiTitle = target.getAttribute('data-wiki-title');
      if (wikiTitle) {
        // Find or create the note
        const result = await findOrCreateNote({ title: wikiTitle, content: '' });
        // The parent will handle navigation to this note
        onNoteChange(result.note);
      }
    }
  };

  const handleBacklinkClick = (backlinkNote: Note) => {
    onNoteChange(backlinkNote);
  };

  if (!note) {
    return (
      <div className="main-content">
        <div className="empty-state">
          <h2>Welcome to Knowledge Base</h2>
          <p>Select a note from the sidebar or create a new one</p>
        </div>
      </div>
    );
  }

  return (
    <div className="main-content">
      <div className="editor-container">
        <div className="editor-header">
          <input
            type="text"
            value={title}
            onChange={handleTitleChange}
            placeholder="Note Title"
          />
          {isDirty && <span style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>Unsaved</span>}
          <button className="delete-btn" onClick={handleDelete}>
            Delete
          </button>
        </div>

        <div className="editor-body">
          <textarea
            className="markdown-editor"
            value={content}
            onChange={handleContentChange}
            placeholder="Write your note here... Use [[Note Title]] to link to other notes."
          />
          
          <div 
            className="preview-pane"
            onClick={handleWikiLinkClick}
            dangerouslySetInnerHTML={{ __html: htmlContent || '<p>Preview will appear here...</p>' }}
          />
        </div>

        <div className="backlinks-section">
          <h3>🔗 Linked from ({backlinks.length})</h3>
          {backlinks.length === 0 ? (
            <p className="no-backlinks">No notes link to this one yet</p>
          ) : (
            <div className="backlinks-list">
              {backlinks.map((bl) => (
                <button
                  key={bl.id}
                  className="backlink-item"
                  onClick={() => handleBacklinkClick(bl)}
                >
                  {bl.title}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

import { useState, useCallback, useEffect } from 'react';
import type { Note } from '../types';
import { fetchBacklinks, findOrCreateNote, deleteNote, updateNote, suggestTags } from '../api';

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
  const [suggestedTags, setSuggestedTags] = useState<string[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [isSuggesting, setIsSuggesting] = useState(false);

  // Load note data when note changes
  useEffect(() => {
    if (note) {
      setTitle(note.title);
      setContent(note.content);
      setHtmlContent(note.htmlContent || '');
      setTags(note.tags || []);
      setSuggestedTags([]); // Clear suggestions when switching notes
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
      const response = await updateNote(note.id, {
        title: newTitle,
        content: newContent,
      });
      
      setHtmlContent(response.note.htmlContent || '');
      setTags(response.note.tags || []);
      onNoteChange(response.note);
      setIsDirty(false);
      
      // Show AI suggested tags if available
      if (response.suggestedTags && response.suggestedTags.length > 0) {
        setSuggestedTags(response.suggestedTags);
      }
      
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

  const handleAcceptTag = async (tag: string) => {
    if (!note) return;
    
    const newTags = [...new Set([...tags, tag])];
    setTags(newTags);
    setSuggestedTags(prev => prev.filter(t => t !== tag));
    
    try {
      const response = await updateNote(note.id, { tags: newTags });
      onNoteChange(response.note);
    } catch (err) {
      console.error('Failed to add tag:', err);
    }
  };

  const handleAcceptAllTags = async () => {
    if (!note || suggestedTags.length === 0) return;
    
    const newTags = [...new Set([...tags, ...suggestedTags])];
    setTags(newTags);
    setSuggestedTags([]);
    
    try {
      const response = await updateNote(note.id, { tags: newTags });
      onNoteChange(response.note);
    } catch (err) {
      console.error('Failed to add tags:', err);
    }
  };

  const handleRejectTag = (tag: string) => {
    setSuggestedTags(prev => prev.filter(t => t !== tag));
  };

  const handleDismissAllSuggestions = () => {
    setSuggestedTags([]);
  };

  const handleRequestSuggestions = async () => {
    if (!note) return;
    
    setIsSuggesting(true);
    try {
      const result = await suggestTags(note.id, title, content, tags);
      if (result.suggestions.length > 0) {
        setSuggestedTags(result.suggestions);
      }
    } catch (err) {
      console.error('Failed to get suggestions:', err);
    } finally {
      setIsSuggesting(false);
    }
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

        {/* Tags Section */}
        <div className="tags-section">
          <div className="current-tags">
            <h4>🏷️ Tags</h4>
            {tags.length === 0 ? (
              <span className="no-tags">No tags yet</span>
            ) : (
              <div className="tags-list">
                {tags.map((tag) => (
                  <span key={tag} className="tag">
                    #{tag}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* AI Suggested Tags */}
        {(suggestedTags.length > 0 || isSuggesting) && (
          <div className="suggested-tags-section">
            <div className="suggested-tags-header">
              <h4>🤖 AI Suggested Tags</h4>
              <div className="suggested-tags-actions">
                {suggestedTags.length > 0 && (
                  <>
                    <button 
                      className="accept-all-btn" 
                      onClick={handleAcceptAllTags}
                      title="Accept all suggestions"
                    >
                      Accept All
                    </button>
                    <button 
                      className="dismiss-btn" 
                      onClick={handleDismissAllSuggestions}
                      title="Dismiss all suggestions"
                    >
                      ✕
                    </button>
                  </>
                )}
              </div>
            </div>
            
            {isSuggesting ? (
              <div className="suggesting-indicator">Thinking... 🤔</div>
            ) : (
              <div className="suggested-tags-list">
                {suggestedTags.map((tag) => (
                  <div key={tag} className="suggested-tag-item">
                    <span className="suggested-tag-name">#{tag}</span>
                    <div className="suggested-tag-actions">
                      <button 
                        className="accept-tag-btn" 
                        onClick={() => handleAcceptTag(tag)}
                        title="Add this tag"
                      >
                        ✓
                      </button>
                      <button 
                        className="reject-tag-btn" 
                        onClick={() => handleRejectTag(tag)}
                        title="Ignore this suggestion"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Manual suggest button when no suggestions */}
        {suggestedTags.length === 0 && !isSuggesting && content.length > 20 && (
          <div className="suggest-tags-action">
            <button 
              className="suggest-tags-btn" 
              onClick={handleRequestSuggestions}
              disabled={isSuggesting}
            >
              🤖 Suggest Tags
            </button>
          </div>
        )}

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

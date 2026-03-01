import { useState, useCallback, useEffect, useRef } from 'react';
import type { Note, VoiceNote } from '../types';
import { fetchBacklinks, findOrCreateNote, deleteNote, updateNote, suggestTags, fetchVoiceNotes, getVoiceNoteAudioUrl, deleteVoiceNote } from '../api';
import { VoiceRecorder } from './VoiceRecorder';

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
  const [voiceNotes, setVoiceNotes] = useState<VoiceNote[]>([]);
  const [playingVoiceId, setPlayingVoiceId] = useState<number | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

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
      loadVoiceNotes(note.id);
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

  const loadVoiceNotes = async (noteId: number) => {
    try {
      const vn = await fetchVoiceNotes(noteId);
      setVoiceNotes(vn);
    } catch (err) {
      console.error('Failed to load voice notes:', err);
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

  // Insert transcription at cursor position
  const handleTranscription = (transcription: string) => {
    const textarea = textareaRef.current;
    if (!textarea) {
      // Fallback: append to end
      const newContent = content ? `${content}\n\n${transcription}` : transcription;
      setContent(newContent);
      setIsDirty(true);
      saveNote(title, newContent);
      return;
    }

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    
    // Determine if we need to add newlines
    const before = content.substring(0, start);
    const after = content.substring(end);
    
    // Add newlines if needed for clean insertion
    let prefix = '';
    let suffix = '';
    
    if (before.length > 0 && !before.endsWith('\n') && !before.endsWith(' ')) {
      prefix = '\n\n';
    } else if (before.length > 0 && before.endsWith('\n') && !before.endsWith('\n\n')) {
      prefix = '\n';
    }
    
    if (after.length > 0 && !after.startsWith('\n')) {
      suffix = '\n\n';
    }
    
    const newContent = before + prefix + transcription + suffix + after;
    setContent(newContent);
    setIsDirty(true);
    
    // Reset cursor position after insertion
    const newCursorPosition = start + prefix.length + transcription.length;
    
    // Use setTimeout to set cursor position after React updates the textarea
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(newCursorPosition, newCursorPosition);
    }, 0);
    
    // Trigger auto-save
    if (saveTimeout) clearTimeout(saveTimeout);
    setSaveTimeout(setTimeout(() => saveNote(title, newContent), 1000));
  };

  const handlePlayVoice = (voiceNoteId: number) => {
    if (playingVoiceId === voiceNoteId) {
      // Stop playing
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      setPlayingVoiceId(null);
    } else {
      // Start playing
      if (audioRef.current) {
        audioRef.current.pause();
      }
      
      const audio = new Audio(getVoiceNoteAudioUrl(voiceNoteId));
      audio.onended = () => setPlayingVoiceId(null);
      audio.onerror = () => {
        console.error('Failed to play audio');
        setPlayingVoiceId(null);
      };
      
      audio.play();
      audioRef.current = audio;
      setPlayingVoiceId(voiceNoteId);
    }
  };

  const handleDeleteVoice = async (voiceNoteId: number) => {
    if (!confirm('Are you sure you want to delete this voice recording?')) return;
    
    try {
      await deleteVoiceNote(voiceNoteId);
      setVoiceNotes(prev => prev.filter(vn => vn.id !== voiceNoteId));
      
      if (playingVoiceId === voiceNoteId && audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
        setPlayingVoiceId(null);
      }
    } catch (err) {
      console.error('Failed to delete voice note:', err);
    }
  };

  const formatDuration = (seconds?: number): string => {
    if (!seconds) return '--:--';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatDate = (dateStr: string): string => {
    const date = new Date(dateStr);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
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
          <div className="header-actions">
            {isDirty && <span style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>Unsaved</span>}
            
            {/* Voice Recorder Button */}
            <VoiceRecorder 
              noteId={note.id} 
              onTranscription={handleTranscription}
              disabled={!note}
            />
            
            <button className="delete-btn" onClick={handleDelete}>
              Delete
            </button>
          </div>
        </div>

        <div className="editor-body">
          <textarea
            ref={textareaRef}
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

        {/* Voice Notes Section */}
        {voiceNotes.length > 0 && (
          <div className="voice-notes-section">
            <h4>🎙️ Voice Recordings ({voiceNotes.length})</h4>
            <div className="voice-notes-list">
              {voiceNotes.map((vn) => (
                <div key={vn.id} className="voice-note-item">
                  <button 
                    className={`play-btn ${playingVoiceId === vn.id ? 'playing' : ''}`}
                    onClick={() => handlePlayVoice(vn.id)}
                    title={playingVoiceId === vn.id ? 'Pause' : 'Play'}
                  >
                    {playingVoiceId === vn.id ? (
                      <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                        <rect x="6" y="4" width="4" height="16" />
                        <rect x="14" y="4" width="4" height="16" />
                      </svg>
                    ) : (
                      <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                        <path d="M8 5v14l11-7z" />
                      </svg>
                    )}
                  </button>
                  
                  <div className="voice-note-info">
                    <span className="voice-note-date">{formatDate(vn.createdAt)}</span>
                    <span className="voice-note-duration">{formatDuration(vn.durationSeconds)}</span>
                  </div>
                  
                  {vn.transcription && (
                    <button 
                      className="transcription-btn"
                      onClick={() => handleTranscription(vn.transcription!)}
                      title="Insert transcription"
                    >
                      📝
                    </button>
                  )}
                  
                  <button 
                    className="delete-voice-btn"
                    onClick={() => handleDeleteVoice(vn.id)}
                    title="Delete recording"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

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

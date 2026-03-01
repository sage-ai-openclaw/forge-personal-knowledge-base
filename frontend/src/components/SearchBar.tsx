import { useState, useRef, useEffect } from 'react';
import type { SearchResult } from '../types';

interface SearchBarProps {
  onSearch: (query: string) => void;
  results: SearchResult[];
  loading: boolean;
  onSelectResult: (noteId: number) => void;
  onClose: () => void;
}

export function SearchBar({ onSearch, results, loading, onSelectResult, onClose }: SearchBarProps) {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Focus input when opened
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  // Handle click outside to close
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        onClose();
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  // Handle keyboard shortcut (Cmd/Ctrl + K)
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key === 'k') {
        event.preventDefault();
        setIsOpen(true);
      }
      if (event.key === 'Escape') {
        setIsOpen(false);
        onClose();
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setQuery(value);
    if (value.length >= 2) {
      onSearch(value);
    }
  };

  const handleSelectResult = (noteId: number) => {
    onSelectResult(noteId);
    setIsOpen(false);
    setQuery('');
    onClose();
  };

  const toggleSearch = () => {
    setIsOpen(!isOpen);
    if (isOpen) {
      onClose();
    }
  };

  const formatScore = (score: number): string => {
    return (score * 100).toFixed(1) + '%';
  };

  const getScoreColor = (score: number): string => {
    if (score >= 0.8) return 'high';
    if (score >= 0.6) return 'medium';
    return 'low';
  };

  return (
    <div className="search-bar-container" ref={containerRef}>
      <button 
        className="search-toggle-button"
        onClick={toggleSearch}
        title="Search notes (Cmd/Ctrl + K)"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="11" cy="11" r="8" />
          <path d="m21 21-4.3-4.3" />
        </svg>
        <span>Search</span>
        <kbd className="shortcut-hint">⌘K</kbd>
      </button>

      {isOpen && (
        <div className="search-modal">
          <div className="search-input-wrapper">
            <svg className="search-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.3-4.3" />
            </svg>
            <input
              ref={inputRef}
              type="text"
              className="search-input"
              placeholder="Search notes... (type at least 2 characters)"
              value={query}
              onChange={handleInputChange}
            />
            {loading && <div className="search-spinner" />}
            <button className="search-close" onClick={() => { setIsOpen(false); onClose(); }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 6 6 18" />
                <path d="m6 6 12 12" />
              </svg>
            </button>
          </div>

          {query.length >= 2 && (
            <div className="search-results">
              {results.length === 0 && !loading ? (
                <div className="search-no-results">
                  <p>No results found for "{query}"</p>
                  <p className="search-hint">Try different keywords or check your spelling</p>
                </div>
              ) : (
                <ul className="search-results-list">
                  {results.map(({ note, similarity }) => (
                    <li
                      key={note.id}
                      className="search-result-item"
                      onClick={() => handleSelectResult(note.id)}
                    >
                      <div className="search-result-header">
                        <h4 className="search-result-title">{note.title}</h4>
                        <span className={`search-result-score ${getScoreColor(similarity)}`}>
                          {formatScore(similarity)}
                        </span>
                      </div>
                      <p className="search-result-preview">
                        {note.content.slice(0, 150)}
                        {note.content.length > 150 ? '...' : ''}
                      </p>
                      {note.tags && note.tags.length > 0 && (
                        <div className="search-result-tags">
                          {note.tags.slice(0, 3).map((tag) => (
                            <span key={tag} className="search-result-tag">#{tag}</span>
                          ))}
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

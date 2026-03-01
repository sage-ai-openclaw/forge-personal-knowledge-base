import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TagSuggestionService } from '../src/services/TagSuggestionService';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('TagSuggestionService', () => {
  beforeEach(() => {
    mockFetch.mockClear();
  });

  describe('suggestTags', () => {
    it('should return suggested tags from Ollama', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          response: 'javascript, programming, tutorial'
        })
      });

      const result = await TagSuggestionService.suggestTags(
        'JavaScript Basics',
        'Learn about variables and functions in JavaScript',
        []
      );

      expect(result.suggestions).toContain('javascript');
      expect(result.suggestions).toContain('programming');
      expect(result.suggestions).toContain('tutorial');
    });

    it('should filter out existing tags', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          response: 'javascript, coding, web'
        })
      });

      const result = await TagSuggestionService.suggestTags(
        'JavaScript Guide',
        'Content about JavaScript',
        ['javascript']
      );

      expect(result.suggestions).not.toContain('javascript');
      expect(result.suggestions).toContain('coding');
      expect(result.suggestions).toContain('web');
    });

    it('should handle case-insensitive existing tag matching', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          response: 'JavaScript, Coding'
        })
      });

      const result = await TagSuggestionService.suggestTags(
        'JS Guide',
        'Content',
        ['javascript']
      );

      expect(result.suggestions).not.toContain('javascript');
    });

    it('should return empty array when API fails', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error'
      });

      const result = await TagSuggestionService.suggestTags('Title', 'Content');

      expect(result.suggestions).toEqual([]);
    });

    it('should return empty array on network error', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const result = await TagSuggestionService.suggestTags('Title', 'Content');

      expect(result.suggestions).toEqual([]);
    });

    it('should limit suggestions to 5 tags', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          response: 'one, two, three, four, five, six, seven'
        })
      });

      const result = await TagSuggestionService.suggestTags('Title', 'Content');

      expect(result.suggestions.length).toBeLessThanOrEqual(5);
    });

    it('should deduplicate suggestions', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          response: 'javascript, javascript, coding, coding'
        })
      });

      const result = await TagSuggestionService.suggestTags('Title', 'Content');

      expect(result.suggestions).toEqual(['javascript', 'coding']);
    });

    it('should clean up tags (remove #, - prefixes)', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          response: '#javascript, -coding, --tutorial'
        })
      });

      const result = await TagSuggestionService.suggestTags('Title', 'Content');

      expect(result.suggestions).toContain('javascript');
      expect(result.suggestions).toContain('coding');
      expect(result.suggestions).toContain('tutorial');
    });

    it('should filter out tags with spaces', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          response: 'javascript, web development, coding'
        })
      });

      const result = await TagSuggestionService.suggestTags('Title', 'Content');

      expect(result.suggestions).toContain('javascript');
      expect(result.suggestions).toContain('coding');
      expect(result.suggestions).not.toContain('web development');
    });

    it('should filter out tags that are too long', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          response: 'js, thisisaverylongtagthatshouldbefilteredout'
        })
      });

      const result = await TagSuggestionService.suggestTags('Title', 'Content');

      expect(result.suggestions).toContain('js');
      expect(result.suggestions).not.toContain('thisisaverylongtagthatshouldbefilteredout');
    });
  });

  describe('hasSignificantChange', () => {
    it('should return true for large character difference', () => {
      const result = TagSuggestionService.hasSignificantChange('short', 'this is a much longer text');
      expect(result).toBe(true);
    });

    it('should return true for percentage change > 10%', () => {
      const oldContent = 'a'.repeat(100);
      const newContent = 'a'.repeat(89); // 11% shorter
      const result = TagSuggestionService.hasSignificantChange(oldContent, newContent);
      expect(result).toBe(true);
    });

    it('should return false for small changes', () => {
      const result = TagSuggestionService.hasSignificantChange('hello world', 'hello worlds');
      expect(result).toBe(false);
    });

    it('should return true when going from empty to content', () => {
      const result = TagSuggestionService.hasSignificantChange('', 'some content');
      expect(result).toBe(true);
    });
  });
});

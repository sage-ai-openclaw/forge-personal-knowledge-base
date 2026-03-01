import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../src/index';

// Mock fetch for Ollama API
const mockFetch = vi.fn();
global.fetch = mockFetch as unknown as typeof fetch;

describe('AI Tag Suggestions (US3)', () => {
  beforeEach(() => {
    mockFetch.mockClear();
  });

  describe('POST /api/notes', () => {
    it('should create note and return AI suggested tags', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          response: 'javascript, tutorial, programming'
        })
      });

      const res = await request(app)
        .post('/api/notes')
        .send({
          title: 'JavaScript Guide',
          content: 'Learn JavaScript basics with this comprehensive tutorial.',
        });

      expect(res.status).toBe(201);
      expect(res.body.note).toBeDefined();
      expect(res.body.suggestedTags).toBeDefined();
      expect(res.body.suggestedTags).toContain('javascript');
      expect(res.body.suggestedTags).toContain('tutorial');
    });

    it('should create note without suggestions when Ollama fails', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Ollama unavailable'));

      const res = await request(app)
        .post('/api/notes')
        .send({
          title: 'Test Note',
          content: 'Some content',
        });

      expect(res.status).toBe(201);
      expect(res.body.note).toBeDefined();
      expect(res.body.suggestedTags).toBeUndefined();
    });
  });

  describe('PATCH /api/notes/:id', () => {
    it('should update note and return suggestions on significant content change', async () => {
      // Create initial note with mock for create
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ response: '' })
      });
      
      const createRes = await request(app)
        .post('/api/notes')
        .send({
          title: 'Original Note',
          content: 'Original content here.',
        });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          response: 'react, hooks, frontend'
        })
      });

      // Update with significant change
      const updateRes = await request(app)
        .patch(`/api/notes/${createRes.body.note.id}`)
        .send({
          content: 'Completely rewritten content about React hooks and frontend development. This is a much longer text that describes useState and useEffect.',
        });

      expect(updateRes.status).toBe(200);
      expect(updateRes.body.note).toBeDefined();
      expect(updateRes.body.suggestedTags).toBeDefined();
      expect(updateRes.body.suggestedTags).toContain('react');
    });

    it('should update note without suggestions on minor change', async () => {
      // Create initial note with mock for create
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ response: '' })
      });
      
      const createRes = await request(app)
        .post('/api/notes')
        .send({
          title: 'Original Note',
          content: 'This is a note about programming concepts and software development practices.',
        });

      // Update with minor change
      const updateRes = await request(app)
        .patch(`/api/notes/${createRes.body.note.id}`)
        .send({
          content: 'This is a note about programming concepts and software development practices!', // Just added exclamation
        });

      expect(updateRes.status).toBe(200);
      expect(updateRes.body.note).toBeDefined();
      expect(updateRes.body.suggestedTags).toBeUndefined();
    });

    it('should not suggest existing tags', async () => {
      // Create note with mock for create
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ response: '' })
      });
      
      const createRes = await request(app)
        .post('/api/notes')
        .send({
          title: 'Tagged Note',
          content: 'Content about #javascript and web development.',
        });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          response: 'javascript, coding, webdev'
        })
      });

      // Update with significant change
      const updateRes = await request(app)
        .patch(`/api/notes/${createRes.body.note.id}`)
        .send({
          content: 'Completely new content about JavaScript programming and web development tutorials.',
        });

      expect(updateRes.status).toBe(200);
      expect(updateRes.body.suggestedTags).toBeDefined();
      expect(updateRes.body.suggestedTags).not.toContain('javascript'); // Already exists
      expect(updateRes.body.suggestedTags).toContain('coding');
    });
  });

  describe('GET /api/notes/:id/suggest-tags', () => {
    it('should return suggestions for existing note', async () => {
      // Mock for create
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ response: '' })
      });
      
      const createRes = await request(app)
        .post('/api/notes')
        .send({
          title: 'Test Note',
          content: 'Content for testing.',
        });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          response: 'testing, automation'
        })
      });

      const res = await request(app)
        .get(`/api/notes/${createRes.body.note.id}/suggest-tags`);

      expect(res.status).toBe(200);
      expect(res.body.suggestions).toBeDefined();
    });

    it('should return 404 for non-existent note', async () => {
      const res = await request(app).get('/api/notes/99999/suggest-tags');
      expect(res.status).toBe(404);
    });
  });

  describe('POST /api/notes/:id/suggest-tags', () => {
    it('should suggest tags for provided content', async () => {
      // Mock for create
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ response: '' })
      });
      
      const createRes = await request(app)
        .post('/api/notes')
        .send({
          title: 'Draft Note',
          content: 'Initial.',
        });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          response: 'ai, machine-learning, python'
        })
      });

      const res = await request(app)
        .post(`/api/notes/${createRes.body.note.id}/suggest-tags`)
        .send({
          title: 'AI and ML',
          content: 'Learn about artificial intelligence and machine learning with Python.',
          existingTags: ['python']
        });

      expect(res.status).toBe(200);
      expect(res.body.suggestions).toContain('ai');
      expect(res.body.suggestions).toContain('machine-learning');
      expect(res.body.suggestions).not.toContain('python'); // Filtered out
    });

    it('should require content parameter', async () => {
      // Mock for create
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ response: '' })
      });
      
      const createRes = await request(app)
        .post('/api/notes')
        .send({
          title: 'Test',
          content: 'Content.',
        });

      const res = await request(app)
        .post(`/api/notes/${createRes.body.note.id}/suggest-tags`)
        .send({});

      expect(res.status).toBe(400);
    });
  });
});

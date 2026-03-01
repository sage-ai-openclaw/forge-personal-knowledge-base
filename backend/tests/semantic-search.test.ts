import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../src/index';

// Mock fetch for Ollama API
const mockFetch = vi.fn();
global.fetch = mockFetch as unknown as typeof fetch;

describe('Semantic Search API (US5)', () => {
  beforeAll(() => {
    // Mock Ollama embedding API
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ 
        embedding: [0.1, 0.2, 0.3, 0.4, 0.5] // Mock 5-dimensional embedding
      })
    });
  });

  beforeEach(() => {
    mockFetch.mockClear();
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ 
        embedding: [0.1, 0.2, 0.3, 0.4, 0.5]
      })
    });
  });

  afterAll(() => {
    mockFetch.mockReset();
  });

  describe('POST /api/search', () => {
    it('should perform semantic search', async () => {
      // Create a note first
      await request(app).post('/api/notes').send({
        title: 'JavaScript Programming Guide',
        content: 'Learn JavaScript basics and advanced concepts.',
      });

      const response = await request(app)
        .post('/api/search')
        .send({ query: 'programming tutorials', mode: 'semantic', topK: 10 });

      expect(response.status).toBe(200);
      expect(response.body.results).toBeDefined();
      expect(response.body.query).toBe('programming tutorials');
      expect(response.body.mode).toBe('semantic');
      expect(Array.isArray(response.body.results)).toBe(true);
    });

    it('should support hybrid search mode', async () => {
      await request(app).post('/api/notes').send({
        title: 'React Hooks Tutorial',
        content: 'Understanding useState and useEffect.',
      });

      const response = await request(app)
        .post('/api/search')
        .send({ query: 'react', mode: 'hybrid' });

      expect(response.status).toBe(200);
      expect(response.body.mode).toBe('hybrid');
      expect(response.body.results.length).toBeGreaterThan(0);
    });

    it('should return results with similarity scores', async () => {
      await request(app).post('/api/notes').send({
        title: 'Machine Learning Basics',
        content: 'Introduction to ML algorithms and neural networks.',
      });

      const response = await request(app)
        .post('/api/search')
        .send({ query: 'AI and machine learning', mode: 'semantic' });

      expect(response.status).toBe(200);
      expect(response.body.results.length).toBeGreaterThan(0);
      
      const result = response.body.results[0];
      expect(result.note).toBeDefined();
      expect(result.similarity).toBeDefined();
      expect(typeof result.similarity).toBe('number');
      expect(result.similarity).toBeGreaterThanOrEqual(0);
      expect(result.similarity).toBeLessThanOrEqual(1);
    });

    it('should reject empty query', async () => {
      const response = await request(app)
        .post('/api/search')
        .send({ query: '' });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Invalid input');
    });

    it('should limit results to topK', async () => {
      // Create multiple notes
      for (let i = 0; i < 5; i++) {
        await request(app).post('/api/notes').send({
          title: `Note ${i}`,
          content: `Content for note ${i}`,
        });
      }

      const response = await request(app)
        .post('/api/search')
        .send({ query: 'test', topK: 3 });

      expect(response.status).toBe(200);
      expect(response.body.results.length).toBeLessThanOrEqual(3);
    });

    it('should support text-only search mode', async () => {
      await request(app).post('/api/notes').send({
        title: 'TypeScript Best Practices',
        content: 'Tips for writing better TypeScript code.',
      });

      const response = await request(app)
        .post('/api/search')
        .send({ query: 'typescript', mode: 'text' });

      expect(response.status).toBe(200);
      expect(response.body.mode).toBe('text');
      expect(Array.isArray(response.body.results)).toBe(true);
    });

    it('should default to hybrid mode', async () => {
      const response = await request(app)
        .post('/api/search')
        .send({ query: 'test' });

      expect(response.status).toBe(200);
      expect(response.body.mode).toBe('hybrid');
    });
  });

  describe('GET /api/search/health', () => {
    it('should return embedding service status', async () => {
      const response = await request(app).get('/api/search/health');

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('healthy');
      expect(response.body.embeddingModel).toBe('nomic-embed-text');
      expect(response.body.embeddingDimension).toBe(5);
    });

    it('should return unhealthy when embedding service fails', async () => {
      // Mock a failed fetch
      mockFetch.mockRejectedValueOnce(new Error('Connection failed'));

      const response = await request(app).get('/api/search/health');

      expect(response.status).toBe(503);
      expect(response.body.status).toBe('unhealthy');
    });
  });

  describe('POST /api/search/regenerate-embeddings', () => {
    it('should regenerate embeddings for all notes', async () => {
      // Create some notes
      await request(app).post('/api/notes').send({
        title: 'Note 1',
        content: 'Content 1',
      });
      await request(app).post('/api/notes').send({
        title: 'Note 2',
        content: 'Content 2',
      });

      const response = await request(app)
        .post('/api/search/regenerate-embeddings');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.processed).toBeGreaterThan(0);
      expect(typeof response.body.failed).toBe('number');
    });
  });

  describe('Note creation with embeddings', () => {
    it('should generate embedding when creating a note', async () => {
      const createResponse = await request(app)
        .post('/api/notes')
        .send({
          title: 'Test Note',
          content: 'This is test content.',
        });

      expect(createResponse.status).toBe(201);
      
      // Wait a bit for async embedding generation
      await new Promise(resolve => setTimeout(resolve, 100));

      // Verify that fetch was called for embedding
      expect(mockFetch).toHaveBeenCalled();
    });

    it('should regenerate embedding when updating note content', async () => {
      const createRes = await request(app)
        .post('/api/notes')
        .send({
          title: 'Original Title',
          content: 'Original content.',
        });

      const noteId = createRes.body.note.id;

      // Wait for initial embedding
      await new Promise(resolve => setTimeout(resolve, 100));
      mockFetch.mockClear();

      // Update the note
      await request(app)
        .patch(`/api/notes/${noteId}`)
        .send({ content: 'Updated content with new keywords.' });

      // Wait for embedding regeneration
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(mockFetch).toHaveBeenCalled();
    });
  });

  describe('Search result structure', () => {
    it('should return note with all required fields', async () => {
      await request(app).post('/api/notes').send({
        title: 'Complete Note',
        content: 'Full content here with #tag',
      });

      const response = await request(app)
        .post('/api/search')
        .send({ query: 'complete' });

      expect(response.status).toBe(200);
      expect(response.body.results.length).toBeGreaterThan(0);

      const result = response.body.results[0];
      expect(result.note.id).toBeDefined();
      expect(result.note.title).toBe('Complete Note');
      expect(result.note.content).toBeDefined();
      expect(result.note.tags).toBeDefined();
      expect(result.note.createdAt).toBeDefined();
      expect(result.note.updatedAt).toBeDefined();
    });
  });
});

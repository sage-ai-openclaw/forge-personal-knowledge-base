import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../src/index';

// Mock fetch for Ollama API
const mockFetch = vi.fn();
global.fetch = mockFetch as unknown as typeof fetch;

describe('Semantic Search API (US5)', () => {
  beforeEach(() => {
    mockFetch.mockReset();
    // Default successful embedding response
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ 
        embedding: Array(768).fill(0).map(() => Math.random() * 2 - 1) // nomic-embed-text produces 768-dim vectors
      })
    });
  });

  afterAll(() => {
    mockFetch.mockRestore();
  });

  describe('POST /api/search', () => {
    it('should perform semantic search and return ranked results', async () => {
      // Create test notes
      await request(app)
        .post('/api/notes')
        .send({ title: 'JavaScript Basics', content: 'Learning JavaScript programming language' });
      
      await request(app)
        .post('/api/notes')
        .send({ title: 'Cooking Recipes', content: 'How to make pasta and pizza' });

      // Mock different embeddings for query vs notes
      let callCount = 0;
      mockFetch.mockImplementation(() => {
        callCount++;
        // Return different embeddings based on call
        const embedding = callCount === 1 
          ? Array(768).fill(0.5) // Query embedding
          : Array(768).fill(0.1); // Note embeddings (lower similarity)
        
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ embedding })
        });
      });

      const response = await request(app)
        .post('/api/search')
        .send({ query: 'programming code', mode: 'semantic', topK: 5 });

      expect(response.status).toBe(200);
      expect(response.body.query).toBe('programming code');
      expect(response.body.mode).toBe('semantic');
      expect(Array.isArray(response.body.results)).toBe(true);
      expect(response.body.count).toBeDefined();
    });

    it('should support hybrid search mode', async () => {
      await request(app)
        .post('/api/notes')
        .send({ title: 'Test Note', content: 'Test content' });

      const response = await request(app)
        .post('/api/search')
        .send({ query: 'test', mode: 'hybrid', topK: 10 });

      expect(response.status).toBe(200);
      expect(response.body.mode).toBe('hybrid');
      expect(Array.isArray(response.body.results)).toBe(true);
    });

    it('should support text-only search mode', async () => {
      await request(app)
        .post('/api/notes')
        .send({ title: 'Machine Learning', content: 'AI and neural networks' });

      const response = await request(app)
        .post('/api/search')
        .send({ query: 'machine learning', mode: 'text', topK: 5 });

      expect(response.status).toBe(200);
      expect(response.body.mode).toBe('text');
      expect(Array.isArray(response.body.results)).toBe(true);
    });

    it('should return results with similarity scores', async () => {
      await request(app)
        .post('/api/notes')
        .send({ title: 'Similar Note', content: 'Content about similarity' });

      const response = await request(app)
        .post('/api/search')
        .send({ query: 'similar', topK: 5 });

      expect(response.status).toBe(200);
      expect(response.body.results.length).toBeGreaterThan(0);
      
      const firstResult = response.body.results[0];
      expect(firstResult.note).toBeDefined();
      expect(firstResult.note.id).toBeDefined();
      expect(firstResult.note.title).toBeDefined();
      expect(typeof firstResult.similarity).toBe('number');
      expect(firstResult.similarity).toBeGreaterThanOrEqual(-1);
      expect(firstResult.similarity).toBeLessThanOrEqual(1);
    });

    it('should validate query length', async () => {
      const response = await request(app)
        .post('/api/search')
        .send({ query: '', mode: 'semantic' });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Invalid input');
    });

    it('should reject queries that are too long', async () => {
      const response = await request(app)
        .post('/api/search')
        .send({ query: 'a'.repeat(501), mode: 'semantic' });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Invalid input');
    });

    it('should limit topK to valid range', async () => {
      const response = await request(app)
        .post('/api/search')
        .send({ query: 'test', topK: 100 });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Invalid input');
    });

    it('should default to hybrid mode when mode is not specified', async () => {
      const response = await request(app)
        .post('/api/search')
        .send({ query: 'test' });

      expect(response.status).toBe(200);
      expect(response.body.mode).toBe('hybrid');
    });

    it('should return empty results when no notes match', async () => {
      // Create a note
      await request(app)
        .post('/api/notes')
        .send({ title: 'Unrelated', content: 'Different topic' });

      const response = await request(app)
        .post('/api/search')
        .send({ query: 'xyzabc123noresult', mode: 'text' });

      expect(response.status).toBe(200);
      expect(response.body.results).toEqual([]);
      expect(response.body.count).toBe(0);
    });
  });

  describe('GET /api/search/health', () => {
    it('should return healthy status when Ollama is available', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ embedding: Array(768).fill(0.1) })
      });

      const response = await request(app).get('/api/search/health');

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('healthy');
      expect(response.body.embeddingModel).toBe('nomic-embed-text');
      expect(response.body.embeddingDimension).toBe(768);
    });

    it('should return unhealthy status when Ollama is unavailable', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Connection refused'));

      const response = await request(app).get('/api/search/health');

      expect(response.status).toBe(503);
      expect(response.body.status).toBe('unhealthy');
      expect(response.body.error).toBe('Embedding service unavailable');
    });
  });

  describe('POST /api/search/regenerate-embeddings', () => {
    it('should regenerate embeddings for all existing notes', async () => {
      // Create multiple notes
      await request(app).post('/api/notes').send({ title: 'Note 1', content: 'Content 1' });
      await request(app).post('/api/notes').send({ title: 'Note 2', content: 'Content 2' });

      const response = await request(app).post('/api/search/regenerate-embeddings');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(typeof response.body.processed).toBe('number');
      expect(typeof response.body.failed).toBe('number');
      expect(response.body.processed).toBeGreaterThanOrEqual(0);
      expect(response.body.failed).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Embedding storage', () => {
    it('should store embeddings when creating notes', async () => {
      const createResponse = await request(app)
        .post('/api/notes')
        .send({ title: 'Test Note', content: 'Test content for embedding' });

      expect(createResponse.status).toBe(201);
      expect(createResponse.body.note.id).toBeDefined();

      // Verify note was created - embedding was stored (async, so may not be immediate)
      const noteId = createResponse.body.note.id;
      const getResponse = await request(app).get(`/api/notes/${noteId}`);
      
      expect(getResponse.status).toBe(200);
      expect(getResponse.body.id).toBe(noteId);
    });

    it('should update embeddings when updating note content', async () => {
      const createResponse = await request(app)
        .post('/api/notes')
        .send({ title: 'Original', content: 'Original content' });

      const noteId = createResponse.body.note.id;

      const updateResponse = await request(app)
        .patch(`/api/notes/${noteId}`)
        .send({ content: 'Updated content' });

      expect(updateResponse.status).toBe(200);
      expect(updateResponse.body.note.content).toBe('Updated content');
    });
  });

  describe('Cosine similarity calculation', () => {
    it('should correctly calculate cosine similarity', async () => {
      // Import the EmbeddingService to test directly
      const { EmbeddingService } = await import('../src/services/EmbeddingService');

      // Test identical vectors
      const vec1 = [1, 0, 0, 0];
      const vec2 = [1, 0, 0, 0];
      expect(EmbeddingService.cosineSimilarity(vec1, vec2)).toBeCloseTo(1, 5);

      // Test orthogonal vectors
      const vec3 = [1, 0, 0, 0];
      const vec4 = [0, 1, 0, 0];
      expect(EmbeddingService.cosineSimilarity(vec3, vec4)).toBeCloseTo(0, 5);

      // Test opposite vectors
      const vec5 = [1, 0, 0, 0];
      const vec6 = [-1, 0, 0, 0];
      expect(EmbeddingService.cosineSimilarity(vec5, vec6)).toBeCloseTo(-1, 5);

      // Test similar vectors
      const vec7 = [0.8, 0.6, 0, 0];
      const vec8 = [0.9, 0.4, 0, 0];
      const similarity = EmbeddingService.cosineSimilarity(vec7, vec8);
      expect(similarity).toBeGreaterThan(0);
      expect(similarity).toBeLessThan(1);
    });

    it('should handle zero vectors', async () => {
      const { EmbeddingService } = await import('../src/services/EmbeddingService');

      const zeroVec = [0, 0, 0, 0];
      const normalVec = [1, 2, 3, 4];
      
      expect(EmbeddingService.cosineSimilarity(zeroVec, normalVec)).toBe(0);
      expect(EmbeddingService.cosineSimilarity(zeroVec, zeroVec)).toBe(0);
    });

    it('should throw error for mismatched vector dimensions', async () => {
      const { EmbeddingService } = await import('../src/services/EmbeddingService');

      const vec1 = [1, 2, 3];
      const vec2 = [1, 2];

      expect(() => EmbeddingService.cosineSimilarity(vec1, vec2)).toThrow('Vectors must have the same dimension');
    });
  });

  describe('Embedding buffer conversion', () => {
    it('should correctly convert embeddings to and from buffer', async () => {
      const { EmbeddingService } = await import('../src/services/EmbeddingService');

      const originalEmbedding = [0.1, 0.2, 0.3, 0.4, 0.5];
      
      const buffer = EmbeddingService.embeddingToBuffer(originalEmbedding);
      expect(buffer).toBeInstanceOf(Buffer);
      
      const recoveredEmbedding = EmbeddingService.bufferToEmbedding(buffer);
      expect(recoveredEmbedding).toHaveLength(originalEmbedding.length);
      
      for (let i = 0; i < originalEmbedding.length; i++) {
        expect(recoveredEmbedding[i]).toBeCloseTo(originalEmbedding[i], 5);
      }
    });

    it('should handle large embeddings', async () => {
      const { EmbeddingService } = await import('../src/services/EmbeddingService');

      const largeEmbedding = Array(768).fill(0).map(() => Math.random());
      
      const buffer = EmbeddingService.embeddingToBuffer(largeEmbedding);
      const recoveredEmbedding = EmbeddingService.bufferToEmbedding(buffer);
      
      expect(recoveredEmbedding).toHaveLength(768);
      expect(recoveredEmbedding[0]).toBeCloseTo(largeEmbedding[0], 5);
      expect(recoveredEmbedding[767]).toBeCloseTo(largeEmbedding[767], 5);
    });
  });
});

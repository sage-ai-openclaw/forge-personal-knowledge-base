import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../src/index';

// Mock fetch for Ollama API
const mockFetch = vi.fn();
global.fetch = mockFetch as unknown as typeof fetch;

describe('Wiki Links (US2)', () => {
  beforeEach(() => {
    // Mock Ollama to return empty suggestions for these tests
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ response: '' })
    });
  });

  describe('GET /api/notes/:id/backlinks', () => {
    it('should return notes that link to the current note', async () => {
      // Create a target note
      const targetRes = await request(app)
        .post('/api/notes')
        .send({
          title: 'Target Note',
          content: 'This is the target note.',
        });
      expect(targetRes.status).toBe(201);

      // Create a note that links to the target
      const linkingRes = await request(app)
        .post('/api/notes')
        .send({
          title: 'Linking Note',
          content: 'See [[Target Note]] for more details.',
        });
      expect(linkingRes.status).toBe(201);

      // Get backlinks for target note
      const backlinksRes = await request(app)
        .get(`/api/notes/${targetRes.body.note.id}/backlinks`);
      
      expect(backlinksRes.status).toBe(200);
      expect(backlinksRes.body).toHaveLength(1);
      expect(backlinksRes.body[0].title).toBe('Linking Note');
    });

    it('should return empty array when no notes link to current note', async () => {
      const noteRes = await request(app)
        .post('/api/notes')
        .send({
          title: 'Orphan Note',
          content: 'This note has no backlinks.',
        });

      const backlinksRes = await request(app)
        .get(`/api/notes/${noteRes.body.note.id}/backlinks`);
      
      expect(backlinksRes.status).toBe(200);
      expect(backlinksRes.body).toEqual([]);
    });

    it('should return 404 for non-existent note', async () => {
      const res = await request(app).get('/api/notes/99999/backlinks');
      expect(res.status).toBe(404);
    });
  });

  describe('GET /api/notes/by-title/:title', () => {
    it('should find note by exact title', async () => {
      const createRes = await request(app)
        .post('/api/notes')
        .send({
          title: 'Unique Title',
          content: 'Content',
        });

      const findRes = await request(app)
        .get('/api/notes/by-title/Unique%20Title');
      
      expect(findRes.status).toBe(200);
      expect(findRes.body.title).toBe('Unique Title');
      expect(findRes.body.id).toBe(createRes.body.note.id);
    });

    it('should find note by title case-insensitively', async () => {
      await request(app)
        .post('/api/notes')
        .send({
          title: 'Mixed Case',
          content: 'Content',
        });

      const findRes = await request(app)
        .get('/api/notes/by-title/mixed%20case');
      
      expect(findRes.status).toBe(200);
      expect(findRes.body.title).toBe('Mixed Case');
    });

    it('should return 404 for non-existent title', async () => {
      const res = await request(app)
        .get('/api/notes/by-title/NonExistentTitle');
      
      expect(res.status).toBe(404);
    });
  });

  describe('POST /api/notes/find-or-create', () => {
    it('should create new note when title does not exist', async () => {
      const res = await request(app)
        .post('/api/notes/find-or-create')
        .send({
          title: 'New Note via FindOrCreate',
          content: 'Created content',
        });

      expect(res.status).toBe(201);
      expect(res.body.created).toBe(true);
      expect(res.body.note.title).toBe('New Note via FindOrCreate');
      expect(res.body.note.content).toBe('Created content');
    });

    it('should return existing note when title already exists', async () => {
      // Create note first
      await request(app)
        .post('/api/notes')
        .send({
          title: 'Existing Note',
          content: 'Original content',
        });

      // Try to find-or-create with same title
      const res = await request(app)
        .post('/api/notes/find-or-create')
        .send({
          title: 'Existing Note',
          content: 'Different content',
        });

      expect(res.status).toBe(200);
      expect(res.body.created).toBe(false);
      expect(res.body.note.title).toBe('Existing Note');
    });

    it('should reject empty title', async () => {
      const res = await request(app)
        .post('/api/notes/find-or-create')
        .send({ title: '' });

      expect(res.status).toBe(400);
    });
  });

  describe('HTML content with wiki links', () => {
    it('should convert [[Wiki Links]] to clickable links in HTML', async () => {
      const res = await request(app)
        .post('/api/notes')
        .send({
          title: 'Note With WikiLinks',
          content: 'See [[Related Topic]] for more info.',
        });

      expect(res.status).toBe(201);
      expect(res.body.note.htmlContent).toContain('wiki-link');
      expect(res.body.note.htmlContent).toContain('href="/notes/Related%20Topic"');
      expect(res.body.note.htmlContent).toContain('data-wiki-title="Related Topic"');
    });

    it('should convert multiple wiki links in content', async () => {
      const res = await request(app)
        .post('/api/notes')
        .send({
          title: 'Multiple Links Note',
          content: 'See [[First Link]] and [[Second Link]] for details.',
        });

      expect(res.status).toBe(201);
      expect(res.body.note.htmlContent).toContain('href="/notes/First%20Link"');
      expect(res.body.note.htmlContent).toContain('href="/notes/Second%20Link"');
    });

    it('should update HTML when wiki links are modified', async () => {
      const createRes = await request(app)
        .post('/api/notes')
        .send({
          title: 'Note To Update',
          content: 'Link to [[Old Target]].',
        });

      const updateRes = await request(app)
        .patch(`/api/notes/${createRes.body.note.id}`)
        .send({ content: 'Now link to [[New Target]].' });

      expect(updateRes.status).toBe(200);
      expect(updateRes.body.note.htmlContent).toContain('href="/notes/New%20Target"');
      expect(updateRes.body.note.htmlContent).not.toContain('href="/notes/Old%20Target"');
    });
  });

  describe('Backlink tracking in updates', () => {
    it('should track backlinks when creating notes', async () => {
      const res = await request(app)
        .post('/api/notes')
        .send({
          title: 'Note With Backlinks',
          content: 'Links to [[Note A]] and [[Note B]].',
        });

      expect(res.body.note.backlinks).toContain('Note A');
      expect(res.body.note.backlinks).toContain('Note B');
      expect(res.body.note.backlinks).toHaveLength(2);
    });

    it('should update backlinks when content changes', async () => {
      const createRes = await request(app)
        .post('/api/notes')
        .send({
          title: 'Backlink Test',
          content: 'Only [[One Link]].',
        });

      const updateRes = await request(app)
        .patch(`/api/notes/${createRes.body.note.id}`)
        .send({ content: 'Now [[Link A]] and [[Link B]].' });

      expect(updateRes.body.note.backlinks).toContain('Link A');
      expect(updateRes.body.note.backlinks).toContain('Link B');
      expect(updateRes.body.note.backlinks).not.toContain('One Link');
      expect(updateRes.body.note.backlinks).toHaveLength(2);
    });
  });
});

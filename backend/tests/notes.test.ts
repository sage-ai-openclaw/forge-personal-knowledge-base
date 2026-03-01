import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../src/index';

describe('Notes API (US1)', () => {
  describe('POST /api/notes', () => {
    it('should create a note with markdown content', async () => {
      const response = await request(app)
        .post('/api/notes')
        .send({
          title: 'My First Note',
          content: '# Hello World\n\nThis is a test note.',
        });

      expect(response.status).toBe(201);
      expect(response.body.title).toBe('My First Note');
      expect(response.body.content).toBe('# Hello World\n\nThis is a test note.');
      expect(response.body.htmlContent).toContain('<h1>');
      expect(response.body.id).toBeDefined();
    });

    it('should extract tags from content', async () => {
      const response = await request(app)
        .post('/api/notes')
        .send({
          title: 'Tagged Note',
          content: 'This note has #ideas and #projects tags.',
        });

      expect(response.status).toBe(201);
      expect(response.body.tags).toContain('ideas');
      expect(response.body.tags).toContain('projects');
    });

    it('should extract backlinks from content', async () => {
      const response = await request(app)
        .post('/api/notes')
        .send({
          title: 'Linked Note',
          content: 'See also [[Related Note]] and [[Another Note]].',
        });

      expect(response.status).toBe(201);
      expect(response.body.backlinks).toContain('Related Note');
      expect(response.body.backlinks).toContain('Another Note');
    });

    it('should reject empty title', async () => {
      const response = await request(app)
        .post('/api/notes')
        .send({ title: '', content: 'Content' });

      expect(response.status).toBe(400);
    });
  });

  describe('GET /api/notes', () => {
    it('should return empty array when no notes', async () => {
      const response = await request(app).get('/api/notes');
      expect(response.status).toBe(200);
      expect(response.body).toEqual([]);
    });

    it('should return all notes ordered by updated_at', async () => {
      await request(app).post('/api/notes').send({ title: 'Note 1', content: 'Content 1' });
      await request(app).post('/api/notes').send({ title: 'Note 2', content: 'Content 2' });

      const response = await request(app).get('/api/notes');
      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(2);
    });
  });

  describe('GET /api/notes/search', () => {
    it('should search notes by title', async () => {
      await request(app).post('/api/notes').send({ title: 'JavaScript Tips', content: 'Content' });
      await request(app).post('/api/notes').send({ title: 'Python Guide', content: 'Content' });

      const response = await request(app).get('/api/notes/search?q=javascript');
      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(1);
      expect(response.body[0].title).toBe('JavaScript Tips');
    });

    it('should search notes by content', async () => {
      await request(app).post('/api/notes').send({ title: 'Note A', content: 'Learn about React hooks' });
      await request(app).post('/api/notes').send({ title: 'Note B', content: 'Learn about Vue composition' });

      const response = await request(app).get('/api/notes/search?q=react');
      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(1);
      expect(response.body[0].title).toBe('Note A');
    });
  });

  describe('PATCH /api/notes/:id', () => {
    it('should update note content', async () => {
      const createRes = await request(app)
        .post('/api/notes')
        .send({ title: 'Original', content: 'Original content' });

      const updateRes = await request(app)
        .patch(`/api/notes/${createRes.body.id}`)
        .send({ content: 'Updated content' });

      expect(updateRes.status).toBe(200);
      expect(updateRes.body.content).toBe('Updated content');
      expect(updateRes.body.htmlContent).toContain('Updated content');
    });
  });

  describe('DELETE /api/notes/:id', () => {
    it('should delete note', async () => {
      const createRes = await request(app)
        .post('/api/notes')
        .send({ title: 'To Delete', content: 'Content' });

      const delRes = await request(app).delete(`/api/notes/${createRes.body.id}`);
      expect(delRes.status).toBe(204);

      const getRes = await request(app).get(`/api/notes/${createRes.body.id}`);
      expect(getRes.status).toBe(404);
    });
  });
});

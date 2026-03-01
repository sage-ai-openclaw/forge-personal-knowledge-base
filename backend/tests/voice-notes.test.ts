import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../src/index';
import fs from 'fs';
import path from 'path';
import { getDatabase } from '../src/db/database';

// Mock fetch for Whisper API and Ollama
const mockFetch = vi.fn();
global.fetch = mockFetch as unknown as typeof fetch;

describe('Voice Notes API (US4)', () => {
  const createTestNote = async () => {
    // Mock Ollama to return empty suggestions for note creation
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ response: '' })
    });

    const response = await request(app)
      .post('/api/notes')
      .send({
        title: 'Voice Test Note',
        content: 'This note will have voice recordings.',
      });
    
    return response.body.note.id;
  };

  beforeEach(() => {
    mockFetch.mockReset();
  });

  describe('GET /api/voice/health', () => {
    it('should return Whisper API health status', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ data: [] }),
      });

      const response = await request(app).get('/api/voice/health');
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('whisperAvailable');
    });

    it('should handle Whisper API unavailability', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Connection refused'));

      const response = await request(app).get('/api/voice/health');
      
      expect(response.status).toBe(200);
      expect(response.body.whisperAvailable).toBe(false);
    });
  });

  describe('GET /api/notes/:id/voice', () => {
    it('should return empty array for note with no voice recordings', async () => {
      const noteId = await createTestNote();
      
      const response = await request(app)
        .get(`/api/notes/${noteId}/voice`);

      expect(response.status).toBe(200);
      expect(response.body).toEqual([]);
    });

    it('should return 404 for non-existent note', async () => {
      const response = await request(app)
        .get('/api/notes/99999/voice');

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Note not found');
    });
  });

  describe('POST /api/notes/:id/voice', () => {
    it('should upload audio file without transcription', async () => {
      const noteId = await createTestNote();
      
      // Create a dummy audio file
      const audioBuffer = Buffer.from('fake audio data');
      const tempFile = path.join('/tmp', `test-audio-${Date.now()}.webm`);
      fs.writeFileSync(tempFile, audioBuffer);

      const response = await request(app)
        .post(`/api/notes/${noteId}/voice`)
        .attach('audio', tempFile, 'test.webm')
        .field('duration', '30')
        .field('transcribe', 'false');

      // Clean up temp file
      fs.unlinkSync(tempFile);

      expect(response.status).toBe(201);
      expect(response.body.voiceNote).toBeDefined();
      expect(response.body.voiceNote.noteId).toBe(noteId);
      expect(response.body.voiceNote.mimeType).toBeDefined();
      expect(response.body.transcribed).toBe(false);
    });

    it('should upload audio file with transcription', async () => {
      const noteId = await createTestNote();
      
      // Mock Whisper API response (mock after note creation)
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ text: 'This is a test transcription.' }),
      });

      // Create a dummy audio file
      const audioBuffer = Buffer.from('fake audio data for transcription');
      const tempFile = path.join('/tmp', `test-audio-${Date.now()}.webm`);
      fs.writeFileSync(tempFile, audioBuffer);

      const response = await request(app)
        .post(`/api/notes/${noteId}/voice`)
        .attach('audio', tempFile, 'test.webm')
        .field('duration', '15')
        .field('transcribe', 'true');

      // Clean up temp file
      fs.unlinkSync(tempFile);

      expect(response.status).toBe(201);
      expect(response.body.transcribed).toBe(true);
      expect(response.body.transcription).toBeDefined();
      expect(response.body.transcription).toBe('This is a test transcription.');
    });

    it('should return 404 when note does not exist', async () => {
      const audioBuffer = Buffer.from('fake audio data');
      const tempFile = path.join('/tmp', `test-audio-${Date.now()}.webm`);
      fs.writeFileSync(tempFile, audioBuffer);

      const response = await request(app)
        .post('/api/notes/99999/voice')
        .attach('audio', tempFile, 'test.webm');

      fs.unlinkSync(tempFile);

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Note not found');
    });

    it('should return 400 when no audio file is provided', async () => {
      const noteId = await createTestNote();
      
      const response = await request(app)
        .post(`/api/notes/${noteId}/voice`)
        .field('duration', '30');

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('No audio file provided');
    });
  });

  describe('POST /api/voice/:id/transcribe', () => {
    it('should re-transcribe an existing voice note', async () => {
      const noteId = await createTestNote();
      
      // First create a voice note
      const audioBuffer = Buffer.from('fake audio data');
      const tempFile = path.join('/tmp', `test-audio-${Date.now()}.webm`);
      fs.writeFileSync(tempFile, audioBuffer);

      const uploadResponse = await request(app)
        .post(`/api/notes/${noteId}/voice`)
        .attach('audio', tempFile, 'test.webm')
        .field('transcribe', 'false');

      fs.unlinkSync(tempFile);

      expect(uploadResponse.status).toBe(201);
      const voiceNoteId = uploadResponse.body.voiceNote.id;

      // Mock Whisper API for re-transcription
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ text: 'Re-transcribed text.' }),
      });

      const response = await request(app)
        .post(`/api/voice/${voiceNoteId}/transcribe`);

      expect(response.status).toBe(200);
      expect(response.body.transcription).toBe('Re-transcribed text.');
    });

    it('should return 404 for non-existent voice note', async () => {
      const response = await request(app)
        .post('/api/voice/99999/transcribe');

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Voice note not found');
    });
  });

  describe('DELETE /api/voice/:id', () => {
    it('should delete a voice note', async () => {
      const noteId = await createTestNote();
      
      // First create a voice note
      const audioBuffer = Buffer.from('fake audio data for deletion');
      const tempFile = path.join('/tmp', `test-audio-${Date.now()}.webm`);
      fs.writeFileSync(tempFile, audioBuffer);

      const uploadResponse = await request(app)
        .post(`/api/notes/${noteId}/voice`)
        .attach('audio', tempFile, 'test.webm')
        .field('transcribe', 'false');

      fs.unlinkSync(tempFile);

      expect(uploadResponse.status).toBe(201);
      const voiceNoteId = uploadResponse.body.voiceNote.id;

      // Delete it
      const deleteResponse = await request(app)
        .delete(`/api/voice/${voiceNoteId}`);

      expect(deleteResponse.status).toBe(204);

      // Verify it's gone by trying to transcribe
      const getResponse = await request(app)
        .post(`/api/voice/${voiceNoteId}/transcribe`);

      expect(getResponse.status).toBe(404);
    });
  });

  describe('GET /api/voice/:id/audio', () => {
    it('should stream audio file', async () => {
      const noteId = await createTestNote();
      
      // First create a voice note with actual file
      const audioBuffer = Buffer.from('fake audio data for streaming');
      const tempFile = path.join('/tmp', `test-audio-${Date.now()}.webm`);
      fs.writeFileSync(tempFile, audioBuffer);

      const uploadResponse = await request(app)
        .post(`/api/notes/${noteId}/voice`)
        .attach('audio', tempFile, 'test.webm')
        .field('transcribe', 'false');

      fs.unlinkSync(tempFile);

      expect(uploadResponse.status).toBe(201);
      const voiceNoteId = uploadResponse.body.voiceNote.id;

      // Stream it
      const response = await request(app)
        .get(`/api/voice/${voiceNoteId}/audio`);

      expect(response.status).toBe(200);
      // The content type might be detected as application/octet-stream for test files
      expect(response.headers['content-type']).toBeDefined();
    });

    it('should return 404 for non-existent voice note', async () => {
      const response = await request(app)
        .get('/api/voice/99999/audio');

      expect(response.status).toBe(404);
    });
  });
});

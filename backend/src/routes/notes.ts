import { Router } from 'express';
import { z } from 'zod';
import { NoteModel } from '../models/Note';

const router = Router();

const createNoteSchema = z.object({
  title: z.string().min(1).max(200),
  content: z.string(),
  tags: z.array(z.string()).optional(),
});

const updateNoteSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  content: z.string().optional(),
  tags: z.array(z.string()).optional(),
});

// GET /api/notes - List all notes
router.get('/notes', async (_req, res) => {
  try {
    const notes = await NoteModel.findAll();
    res.json(notes);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch notes' });
  }
});

// GET /api/notes/search - Search notes
router.get('/notes/search', async (req, res) => {
  try {
    const { q } = req.query;
    if (!q || typeof q !== 'string') {
      return res.status(400).json({ error: 'Search query required' });
    }
    const notes = await NoteModel.search(q);
    res.json(notes);
  } catch (error) {
    res.status(500).json({ error: 'Failed to search notes' });
  }
});

// GET /api/notes/:id - Get single note
router.get('/notes/:id', async (req, res) => {
  try {
    const note = await NoteModel.findById(Number(req.params.id));
    if (!note) {
      return res.status(404).json({ error: 'Note not found' });
    }
    res.json(note);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch note' });
  }
});

// POST /api/notes - Create note
router.post('/notes', async (req, res) => {
  try {
    const result = createNoteSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ error: 'Invalid input', details: result.error.issues });
    }
    
    const note = await NoteModel.create(result.data);
    res.status(201).json(note);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create note' });
  }
});

// PATCH /api/notes/:id - Update note
router.patch('/notes/:id', async (req, res) => {
  try {
    const result = updateNoteSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ error: 'Invalid input', details: result.error.issues });
    }
    
    const note = await NoteModel.update(Number(req.params.id), result.data);
    if (!note) {
      return res.status(404).json({ error: 'Note not found' });
    }
    res.json(note);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update note' });
  }
});

// DELETE /api/notes/:id - Delete note
router.delete('/notes/:id', async (req, res) => {
  try {
    const success = await NoteModel.delete(Number(req.params.id));
    if (!success) {
      return res.status(404).json({ error: 'Note not found' });
    }
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete note' });
  }
});

export default router;

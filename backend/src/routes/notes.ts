import { Router } from 'express';
import { z } from 'zod';
import { NoteModel } from '../models/Note';
import { TagSuggestionService } from '../services/TagSuggestionService';

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

const findOrCreateSchema = z.object({
  title: z.string().min(1).max(200),
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

// GET /api/notes/:id/backlinks - Get notes that link to this note
router.get('/notes/:id/backlinks', async (req, res) => {
  try {
    const note = await NoteModel.findById(Number(req.params.id));
    if (!note) {
      return res.status(404).json({ error: 'Note not found' });
    }
    
    const backlinks = await NoteModel.findBacklinks(note.title);
    res.json(backlinks);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch backlinks' });
  }
});

// GET /api/notes/:id/suggest-tags - Get AI-suggested tags for a note
router.get('/notes/:id/suggest-tags', async (req, res) => {
  try {
    const note = await NoteModel.findById(Number(req.params.id));
    if (!note) {
      return res.status(404).json({ error: 'Note not found' });
    }

    const suggestions = await TagSuggestionService.suggestTags(
      note.title,
      note.content,
      note.tags || []
    );

    res.json(suggestions);
  } catch (error) {
    console.error('Failed to suggest tags:', error);
    res.status(500).json({ error: 'Failed to suggest tags' });
  }
});

// POST /api/notes/:id/suggest-tags - Get AI-suggested tags for content (before save)
router.post('/notes/:id/suggest-tags', async (req, res) => {
  try {
    const { title, content, existingTags } = req.body;
    
    if (!content || typeof content !== 'string') {
      return res.status(400).json({ error: 'Content is required' });
    }

    const suggestions = await TagSuggestionService.suggestTags(
      title || '',
      content,
      existingTags || []
    );

    res.json(suggestions);
  } catch (error) {
    console.error('Failed to suggest tags:', error);
    res.status(500).json({ error: 'Failed to suggest tags' });
  }
});

// GET /api/notes/by-title/:title - Get note by title
router.get('/notes/by-title/:title', async (req, res) => {
  try {
    const title = decodeURIComponent(req.params.title);
    const note = await NoteModel.findByTitle(title);
    if (!note) {
      return res.status(404).json({ error: 'Note not found' });
    }
    res.json(note);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch note' });
  }
});

// POST /api/notes/find-or-create - Find by title or create new note
router.post('/notes/find-or-create', async (req, res) => {
  try {
    const result = findOrCreateSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ error: 'Invalid input', details: result.error.issues });
    }
    
    const { title, content, tags } = result.data;
    
    // Try to find existing note
    let note = await NoteModel.findByTitle(title);
    
    if (note) {
      return res.json({ note, created: false });
    }
    
    // Create new note if not found
    note = await NoteModel.create({ 
      title, 
      content: content || '', 
      tags 
    });
    res.status(201).json({ note, created: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to find or create note' });
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
      return res.status(404).json({ error: 'Not found' });
    }
    res.json(note);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch note' });
  }
});

// POST /api/notes - Create note with AI tag suggestions
router.post('/notes', async (req, res) => {
  try {
    const result = createNoteSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ error: 'Invalid input', details: result.error.issues });
    }
    
    const note = await NoteModel.create(result.data);
    
    // Get AI tag suggestions for new notes
    const { suggestions } = await TagSuggestionService.suggestTags(
      note.title,
      note.content,
      note.tags || []
    );
    
    res.status(201).json({ 
      note,
      suggestedTags: suggestions.length > 0 ? suggestions : undefined
    });
  } catch (error) {
    console.error('Failed to create note:', error);
    res.status(500).json({ error: 'Failed to create note' });
  }
});

// PATCH /api/notes/:id - Update note with AI tag suggestions
router.patch('/notes/:id', async (req, res) => {
  try {
    const result = updateNoteSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ error: 'Invalid input', details: result.error.issues });
    }
    
    const existingNote = await NoteModel.findById(Number(req.params.id));
    if (!existingNote) {
      return res.status(404).json({ error: 'Not found' });
    }
    
    // Check if content changed significantly
    const contentChanged = result.data.content !== undefined && 
      TagSuggestionService.hasSignificantChange(existingNote.content, result.data.content);
    
    const note = await NoteModel.update(Number(req.params.id), result.data);
    if (!note) {
      return res.status(404).json({ error: 'Not found' });
    }
    
    // Get AI tag suggestions if content changed significantly
    let suggestedTags: string[] | undefined;
    if (contentChanged) {
      const { suggestions } = await TagSuggestionService.suggestTags(
        note.title,
        note.content,
        note.tags || []
      );
      if (suggestions.length > 0) {
        suggestedTags = suggestions;
      }
    }
    
    res.json({ 
      note,
      suggestedTags
    });
  } catch (error) {
    console.error('Failed to update note:', error);
    res.status(500).json({ error: 'Failed to update note' });
  }
});

// DELETE /api/notes/:id - Delete note
router.delete('/notes/:id', async (req, res) => {
  try {
    const success = await NoteModel.delete(Number(req.params.id));
    if (!success) {
      return res.status(404).json({ error: 'Not found' });
    }
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete note' });
  }
});

export default router;

"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const zod_1 = require("zod");
const Note_1 = require("../models/Note");
const router = (0, express_1.Router)();
const createNoteSchema = zod_1.z.object({
    title: zod_1.z.string().min(1).max(200),
    content: zod_1.z.string(),
    tags: zod_1.z.array(zod_1.z.string()).optional(),
});
const updateNoteSchema = zod_1.z.object({
    title: zod_1.z.string().min(1).max(200).optional(),
    content: zod_1.z.string().optional(),
    tags: zod_1.z.array(zod_1.z.string()).optional(),
});
const findOrCreateSchema = zod_1.z.object({
    title: zod_1.z.string().min(1).max(200),
    content: zod_1.z.string().optional(),
    tags: zod_1.z.array(zod_1.z.string()).optional(),
});
// GET /api/notes - List all notes
router.get('/notes', async (_req, res) => {
    try {
        const notes = await Note_1.NoteModel.findAll();
        res.json(notes);
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to fetch notes' });
    }
});
// GET /api/notes/:id/backlinks - Get notes that link to this note
router.get('/notes/:id/backlinks', async (req, res) => {
    try {
        const note = await Note_1.NoteModel.findById(Number(req.params.id));
        if (!note) {
            return res.status(404).json({ error: 'Note not found' });
        }
        const backlinks = await Note_1.NoteModel.findBacklinks(note.title);
        res.json(backlinks);
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to fetch backlinks' });
    }
});
// GET /api/notes/by-title/:title - Get note by title
router.get('/notes/by-title/:title', async (req, res) => {
    try {
        const title = decodeURIComponent(req.params.title);
        const note = await Note_1.NoteModel.findByTitle(title);
        if (!note) {
            return res.status(404).json({ error: 'Note not found' });
        }
        res.json(note);
    }
    catch (error) {
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
        let note = await Note_1.NoteModel.findByTitle(title);
        if (note) {
            return res.json({ note, created: false });
        }
        // Create new note if not found
        note = await Note_1.NoteModel.create({
            title,
            content: content || '',
            tags
        });
        res.status(201).json({ note, created: true });
    }
    catch (error) {
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
        const notes = await Note_1.NoteModel.search(q);
        res.json(notes);
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to search notes' });
    }
});
// GET /api/notes/:id - Get single note
router.get('/notes/:id', async (req, res) => {
    try {
        const note = await Note_1.NoteModel.findById(Number(req.params.id));
        if (!note) {
            return res.status(404).json({ error: 'Note not found' });
        }
        res.json(note);
    }
    catch (error) {
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
        const note = await Note_1.NoteModel.create(result.data);
        res.status(201).json(note);
    }
    catch (error) {
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
        const note = await Note_1.NoteModel.update(Number(req.params.id), result.data);
        if (!note) {
            return res.status(404).json({ error: 'Note not found' });
        }
        res.json(note);
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to update note' });
    }
});
// DELETE /api/notes/:id - Delete note
router.delete('/notes/:id', async (req, res) => {
    try {
        const success = await Note_1.NoteModel.delete(Number(req.params.id));
        if (!success) {
            return res.status(404).json({ error: 'Note not found' });
        }
        res.status(204).send();
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to delete note' });
    }
});
exports.default = router;
//# sourceMappingURL=notes.js.map
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const multer_1 = __importDefault(require("multer"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const VoiceNote_1 = require("../models/VoiceNote");
const Note_1 = require("../models/Note");
const WhisperService_1 = require("../services/WhisperService");
const router = (0, express_1.Router)();
// Ensure uploads directory exists
const uploadsDir = process.env.UPLOADS_DIR || path_1.default.join(process.cwd(), 'uploads', 'voice');
if (!fs_1.default.existsSync(uploadsDir)) {
    fs_1.default.mkdirSync(uploadsDir, { recursive: true });
}
// Configure multer for audio file uploads
const storage = multer_1.default.diskStorage({
    destination: (_req, _file, cb) => {
        cb(null, uploadsDir);
    },
    filename: (_req, file, cb) => {
        const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
        const ext = path_1.default.extname(file.originalname) || '.webm';
        cb(null, `voice-${uniqueSuffix}${ext}`);
    },
});
const upload = (0, multer_1.default)({
    storage,
    limits: {
        fileSize: 50 * 1024 * 1024, // 50MB limit
    },
    fileFilter: (_req, file, cb) => {
        // Accept audio files or files with audio extension (for tests)
        const isAudioMime = file.mimetype.startsWith('audio/');
        const isAudioExt = /\.(webm|mp3|wav|ogg|m4a|mp4)$/i.test(file.originalname);
        const isOctetStream = file.mimetype === 'application/octet-stream'; // Common for binary uploads
        if (isAudioMime || isAudioExt || isOctetStream) {
            cb(null, true);
        }
        else {
            cb(new Error('Only audio files are allowed'));
        }
    },
});
// GET /api/voice/health - Check Whisper API availability
router.get('/voice/health', async (_req, res) => {
    try {
        const health = await WhisperService_1.WhisperService.healthCheck();
        res.json({
            whisperAvailable: health.available,
            error: health.error,
        });
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to check Whisper health' });
    }
});
// GET /api/notes/:id/voice - Get all voice notes for a note
router.get('/notes/:id/voice', async (req, res) => {
    try {
        const noteId = Number(req.params.id);
        const note = await Note_1.NoteModel.findById(noteId);
        if (!note) {
            return res.status(404).json({ error: 'Note not found' });
        }
        const voiceNotes = await VoiceNote_1.VoiceNoteModel.findByNoteId(noteId);
        res.json(voiceNotes);
    }
    catch (error) {
        console.error('Failed to fetch voice notes:', error);
        res.status(500).json({ error: 'Failed to fetch voice notes' });
    }
});
// POST /api/notes/:id/voice - Upload voice recording
router.post('/notes/:id/voice', upload.single('audio'), async (req, res) => {
    try {
        const noteId = Number(req.params.id);
        const note = await Note_1.NoteModel.findById(noteId);
        if (!note) {
            // Clean up uploaded file if note doesn't exist
            if (req.file) {
                fs_1.default.unlinkSync(req.file.path);
            }
            return res.status(404).json({ error: 'Note not found' });
        }
        if (!req.file) {
            return res.status(400).json({ error: 'No audio file provided' });
        }
        const { duration, transcribe = 'true' } = req.body;
        // Create voice note record
        const voiceNote = await VoiceNote_1.VoiceNoteModel.create({
            noteId,
            filename: req.file.filename,
            originalFilename: req.file.originalname,
            mimeType: req.file.mimetype,
            fileSizeBytes: req.file.size,
            durationSeconds: duration ? parseInt(duration, 10) : undefined,
        });
        let transcription;
        // Transcribe if requested
        if (transcribe === 'true') {
            const result = await WhisperService_1.WhisperService.transcribe(req.file.path);
            if (result.success) {
                transcription = result.text;
                await VoiceNote_1.VoiceNoteModel.updateTranscription(voiceNote.id, transcription);
            }
            else {
                console.error('Transcription failed:', result.error);
            }
        }
        res.status(201).json({
            voiceNote: {
                ...voiceNote,
                transcription: transcription || voiceNote.transcription,
            },
            transcription,
            transcribed: transcribe === 'true',
        });
    }
    catch (error) {
        // Clean up uploaded file on error
        if (req.file) {
            try {
                fs_1.default.unlinkSync(req.file.path);
            }
            catch {
                // Ignore cleanup errors
            }
        }
        console.error('Failed to upload voice note:', error);
        res.status(500).json({ error: 'Failed to upload voice note' });
    }
});
// POST /api/voice/:id/transcribe - Re-transcribe a voice note
router.post('/voice/:id/transcribe', async (req, res) => {
    try {
        const voiceNoteId = Number(req.params.id);
        const voiceNote = await VoiceNote_1.VoiceNoteModel.findById(voiceNoteId);
        if (!voiceNote) {
            return res.status(404).json({ error: 'Voice note not found' });
        }
        const filePath = path_1.default.join(uploadsDir, voiceNote.filename);
        const result = await WhisperService_1.WhisperService.transcribe(filePath);
        if (result.success) {
            await VoiceNote_1.VoiceNoteModel.updateTranscription(voiceNoteId, result.text);
            res.json({ transcription: result.text });
        }
        else {
            res.status(500).json({ error: result.error || 'Transcription failed' });
        }
    }
    catch (error) {
        console.error('Failed to transcribe voice note:', error);
        res.status(500).json({ error: 'Failed to transcribe voice note' });
    }
});
// GET /api/voice/:id/audio - Stream audio file
router.get('/voice/:id/audio', async (req, res) => {
    try {
        const voiceNoteId = Number(req.params.id);
        const voiceNote = await VoiceNote_1.VoiceNoteModel.findById(voiceNoteId);
        if (!voiceNote) {
            return res.status(404).json({ error: 'Voice note not found' });
        }
        const filePath = path_1.default.join(uploadsDir, voiceNote.filename);
        if (!fs_1.default.existsSync(filePath)) {
            return res.status(404).json({ error: 'Audio file not found' });
        }
        res.setHeader('Content-Type', voiceNote.mimeType);
        res.setHeader('Content-Disposition', `inline; filename="${voiceNote.originalFilename || voiceNote.filename}"`);
        const stream = fs_1.default.createReadStream(filePath);
        stream.pipe(res);
    }
    catch (error) {
        console.error('Failed to stream audio:', error);
        res.status(500).json({ error: 'Failed to stream audio' });
    }
});
// DELETE /api/voice/:id - Delete a voice note
router.delete('/voice/:id', async (req, res) => {
    try {
        const voiceNoteId = Number(req.params.id);
        const voiceNote = await VoiceNote_1.VoiceNoteModel.findById(voiceNoteId);
        if (!voiceNote) {
            return res.status(404).json({ error: 'Voice note not found' });
        }
        // Delete file
        const filePath = path_1.default.join(uploadsDir, voiceNote.filename);
        if (fs_1.default.existsSync(filePath)) {
            fs_1.default.unlinkSync(filePath);
        }
        // Delete record
        await VoiceNote_1.VoiceNoteModel.delete(voiceNoteId);
        res.status(204).send();
    }
    catch (error) {
        console.error('Failed to delete voice note:', error);
        res.status(500).json({ error: 'Failed to delete voice note' });
    }
});
exports.default = router;
//# sourceMappingURL=voice.js.map
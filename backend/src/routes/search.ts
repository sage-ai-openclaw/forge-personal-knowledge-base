import { Router } from 'express';
import { z } from 'zod';
import { NoteModel } from '../models/Note';
import { EmbeddingService } from '../services/EmbeddingService';

const router = Router();

const searchSchema = z.object({
  query: z.string().min(1).max(500),
  topK: z.number().int().min(1).max(50).optional().default(10),
  mode: z.enum(['semantic', 'text', 'hybrid']).optional().default('hybrid'),
});

// POST /api/search - Semantic search over notes
router.post('/search', async (req, res) => {
  try {
    const result = searchSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ 
        error: 'Invalid input', 
        details: result.error.issues 
      });
    }

    const { query, topK, mode } = result.data;

    let searchResults;
    
    switch (mode) {
      case 'semantic':
        searchResults = await NoteModel.semanticSearch(query, topK);
        break;
      case 'text':
        const textNotes = await NoteModel.search(query);
        searchResults = textNotes.map(note => ({
          note,
          similarity: 0.5, // Default score for text matches
        }));
        break;
      case 'hybrid':
      default:
        searchResults = await NoteModel.hybridSearch(query, topK);
        break;
    }

    res.json({
      results: searchResults,
      query,
      mode,
      count: searchResults.length,
    });
  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({ error: 'Failed to search notes' });
  }
});

// GET /api/search/health - Check if embedding service is available
router.get('/search/health', async (_req, res) => {
  try {
    // Test with a simple embedding
    const testEmbedding = await EmbeddingService.generateEmbedding('test');
    res.json({
      status: 'healthy',
      embeddingModel: 'nomic-embed-text',
      embeddingDimension: testEmbedding.length,
    });
  } catch (error) {
    console.error('Embedding health check failed:', error);
    res.status(503).json({
      status: 'unhealthy',
      error: 'Embedding service unavailable',
    });
  }
});

// POST /api/search/regenerate-embeddings - Regenerate all embeddings (admin/migration)
router.post('/search/regenerate-embeddings', async (_req, res) => {
  try {
    const result = await NoteModel.regenerateAllEmbeddings();
    res.json({
      success: true,
      processed: result.processed,
      failed: result.failed,
    });
  } catch (error) {
    console.error('Failed to regenerate embeddings:', error);
    res.status(500).json({ error: 'Failed to regenerate embeddings' });
  }
});

export default router;

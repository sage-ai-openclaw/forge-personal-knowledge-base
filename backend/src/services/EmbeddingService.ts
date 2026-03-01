import type { NoteEmbedding, SearchResult } from '../types';

const OLLAMA_URL = process.env.OLLAMA_URL || 'http://truenas-scale:30068/api/embeddings';
const EMBEDDING_MODEL = process.env.EMBEDDING_MODEL || 'nomic-embed-text';

export class EmbeddingService {
  /**
   * Generate embedding for text using Ollama
   */
  static async generateEmbedding(text: string): Promise<number[]> {
    try {
      // Truncate text to avoid token limits (nomic-embed-text has 2048 token limit)
      const truncatedText = text.slice(0, 8000);

      const response = await fetch(OLLAMA_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: EMBEDDING_MODEL,
          prompt: truncatedText,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Ollama embedding API error:', response.status, errorText);
        throw new Error(`Failed to generate embedding: ${response.statusText}`);
      }

      const data = await response.json() as { embedding?: number[] };
      
      if (!data.embedding || !Array.isArray(data.embedding)) {
        throw new Error('Invalid embedding response from Ollama');
      }

      return data.embedding;
    } catch (error) {
      console.error('Embedding generation error:', error);
      throw error;
    }
  }

  /**
   * Calculate cosine similarity between two vectors
   */
  static cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) {
      throw new Error('Vectors must have the same dimension');
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    if (normA === 0 || normB === 0) {
      return 0;
    }

    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  /**
   * Convert embedding array to Buffer for storage
   */
  static embeddingToBuffer(embedding: number[]): Buffer {
    // Store as Float32 array for efficiency
    const floatArray = new Float32Array(embedding);
    return Buffer.from(floatArray.buffer);
  }

  /**
   * Convert Buffer back to embedding array
   */
  static bufferToEmbedding(buffer: Buffer): number[] {
    const floatArray = new Float32Array(buffer.buffer, buffer.byteOffset, buffer.byteLength / 4);
    return Array.from(floatArray);
  }
}

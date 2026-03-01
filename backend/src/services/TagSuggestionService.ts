import type { TagSuggestionResponse } from '../types';

const OLLAMA_URL = process.env.OLLAMA_URL || 'http://truenas-scale:30068/api/generate';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'llama3.2';

export class TagSuggestionService {
  /**
   * Suggest tags for a note based on its content
   */
  static async suggestTags(title: string, content: string, existingTags: string[] = []): Promise<TagSuggestionResponse> {
    try {
      const prompt = this.buildPrompt(title, content, existingTags);
      
      const response = await fetch(OLLAMA_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: OLLAMA_MODEL,
          prompt: prompt,
          stream: false,
          options: {
            temperature: 0.3,
            num_predict: 100,
          },
        }),
      });

      if (!response.ok) {
        console.error('Ollama API error:', response.status, response.statusText);
        return { suggestions: [] };
      }

      const data = await response.json() as { response?: string };
      const suggestions = this.parseResponse(data.response || '');
      
      // Filter out existing tags and duplicates
      const filteredSuggestions = suggestions
        .filter(tag => !existingTags.some(existing => existing.toLowerCase() === tag.toLowerCase()))
        .slice(0, 5);

      return { suggestions: filteredSuggestions };
    } catch (error) {
      console.error('Tag suggestion error:', error);
      return { suggestions: [] };
    }
  }

  /**
   * Check if content has changed significantly (more than 10 chars or 10% change)
   */
  static hasSignificantChange(oldContent: string, newContent: string): boolean {
    const charDiff = Math.abs(oldContent.length - newContent.length);
    const minLength = Math.min(oldContent.length, newContent.length);
    const percentDiff = minLength > 0 ? charDiff / minLength : 1;
    
    return charDiff > 10 || percentDiff > 0.1;
  }

  private static buildPrompt(title: string, content: string, existingTags: string[]): string {
    const existingTagsText = existingTags.length > 0 
      ? `Existing tags: ${existingTags.join(', ')}\n` 
      : '';

    return `Analyze this note and suggest 3-5 relevant tags.

Title: ${title}
Content: ${content.slice(0, 2000)}
${existingTagsText}
Rules:
- Suggest tags that capture the main topics and themes
- Use lowercase, single-word tags when possible
- Avoid generic tags like "note" or "document"
- Don't suggest tags that already exist

Respond with ONLY a comma-separated list of tags. Example: programming, javascript, tutorial

Tags:`;
  }

  private static parseResponse(response: string): string[] {
    // Clean up the response and split by comma
    return response
      .trim()
      .toLowerCase()
      .split(/[,\n]+/)
      .map(tag => tag.trim().replace(/^[#\-]+/, '')) // Remove #, - prefixes
      .filter(tag => tag.length > 0 && tag.length < 30) // Reasonable length
      .filter(tag => !tag.includes(' ')) // No spaces in tags
      .filter((tag, index, arr) => arr.indexOf(tag) === index); // Deduplicate
  }
}

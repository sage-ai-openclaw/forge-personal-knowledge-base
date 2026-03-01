import type { TagSuggestionResponse } from '../types';
export declare class TagSuggestionService {
    /**
     * Suggest tags for a note based on its content
     */
    static suggestTags(title: string, content: string, existingTags?: string[]): Promise<TagSuggestionResponse>;
    /**
     * Check if content has changed significantly (more than 10 chars or 10% change)
     */
    static hasSignificantChange(oldContent: string, newContent: string): boolean;
    private static buildPrompt;
    private static parseResponse;
}
//# sourceMappingURL=TagSuggestionService.d.ts.map
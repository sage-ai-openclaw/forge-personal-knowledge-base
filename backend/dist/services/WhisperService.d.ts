export interface TranscriptionResult {
    text: string;
    success: boolean;
    error?: string;
}
export declare class WhisperService {
    /**
     * Transcribe audio file using Whisper API
     */
    static transcribe(audioFilePath: string): Promise<TranscriptionResult>;
    /**
     * Check if Whisper API is available
     */
    static healthCheck(): Promise<{
        available: boolean;
        error?: string;
    }>;
}
//# sourceMappingURL=WhisperService.d.ts.map
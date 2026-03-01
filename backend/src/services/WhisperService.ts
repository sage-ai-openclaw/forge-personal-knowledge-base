import FormData from 'form-data';
import fs from 'fs';

const WHISPER_API_URL = process.env.WHISPER_API_URL || 'http://truenas-scale:5555';

export interface TranscriptionResult {
  text: string;
  success: boolean;
  error?: string;
}

export class WhisperService {
  /**
   * Transcribe audio file using Whisper API
   */
  static async transcribe(audioFilePath: string): Promise<TranscriptionResult> {
    try {
      // Check if file exists
      if (!fs.existsSync(audioFilePath)) {
        return {
          success: false,
          text: '',
          error: 'Audio file not found',
        };
      }

      // Create form data
      const formData = new FormData();
      formData.append('file', fs.createReadStream(audioFilePath));
      formData.append('model', 'whisper-1');
      formData.append('language', 'es'); // Default to Spanish, can be made configurable
      formData.append('response_format', 'json');

      // Call Whisper API
      const response = await fetch(`${WHISPER_API_URL}/v1/audio/transcriptions`, {
        method: 'POST',
        body: formData as any,
        // @ts-ignore - headers are set by form-data
        headers: formData.getHeaders(),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Whisper API error:', errorText);
        return {
          success: false,
          text: '',
          error: `Whisper API error: ${response.status} ${response.statusText}`,
        };
      }

      const result = await response.json() as { text?: string };
      
      return {
        success: true,
        text: result.text || '',
      };
    } catch (error) {
      console.error('Transcription error:', error);
      return {
        success: false,
        text: '',
        error: error instanceof Error ? error.message : 'Unknown transcription error',
      };
    }
  }

  /**
   * Check if Whisper API is available
   */
  static async healthCheck(): Promise<{ available: boolean; error?: string }> {
    try {
      const response = await fetch(`${WHISPER_API_URL}/v1/models`, {
        method: 'GET',
        signal: AbortSignal.timeout(5000),
      });

      if (response.ok) {
        return { available: true };
      }

      return {
        available: false,
        error: `Whisper API returned ${response.status}`,
      };
    } catch (error) {
      return {
        available: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}

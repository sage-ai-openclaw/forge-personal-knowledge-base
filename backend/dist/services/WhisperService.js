"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WhisperService = void 0;
const form_data_1 = __importDefault(require("form-data"));
const fs_1 = __importDefault(require("fs"));
const WHISPER_API_URL = process.env.WHISPER_API_URL || 'http://truenas-scale:5555';
class WhisperService {
    /**
     * Transcribe audio file using Whisper API
     */
    static async transcribe(audioFilePath) {
        try {
            // Check if file exists
            if (!fs_1.default.existsSync(audioFilePath)) {
                return {
                    success: false,
                    text: '',
                    error: 'Audio file not found',
                };
            }
            // Create form data
            const formData = new form_data_1.default();
            formData.append('file', fs_1.default.createReadStream(audioFilePath));
            formData.append('model', 'whisper-1');
            formData.append('language', 'es'); // Default to Spanish, can be made configurable
            formData.append('response_format', 'json');
            // Call Whisper API
            const response = await fetch(`${WHISPER_API_URL}/v1/audio/transcriptions`, {
                method: 'POST',
                body: formData,
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
            const result = await response.json();
            return {
                success: true,
                text: result.text || '',
            };
        }
        catch (error) {
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
    static async healthCheck() {
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
        }
        catch (error) {
            return {
                available: false,
                error: error instanceof Error ? error.message : 'Unknown error',
            };
        }
    }
}
exports.WhisperService = WhisperService;
//# sourceMappingURL=WhisperService.js.map
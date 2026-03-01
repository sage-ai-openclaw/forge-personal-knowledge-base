export interface VoiceNote {
    id: number;
    noteId: number;
    filename: string;
    originalFilename?: string;
    mimeType: string;
    durationSeconds?: number;
    transcription?: string;
    fileSizeBytes?: number;
    createdAt: string;
}
export interface CreateVoiceNoteInput {
    noteId: number;
    filename: string;
    originalFilename?: string;
    mimeType: string;
    durationSeconds?: number;
    transcription?: string;
    fileSizeBytes?: number;
}
export declare class VoiceNoteModel {
    static create(input: CreateVoiceNoteInput): Promise<VoiceNote>;
    static findById(id: number): Promise<VoiceNote | null>;
    static findByNoteId(noteId: number): Promise<VoiceNote[]>;
    static updateTranscription(id: number, transcription: string): Promise<VoiceNote | null>;
    static delete(id: number): Promise<boolean>;
    static deleteByNoteId(noteId: number): Promise<void>;
    private static mapRow;
}
//# sourceMappingURL=VoiceNote.d.ts.map
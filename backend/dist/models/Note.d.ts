import type { Note, CreateNoteInput, UpdateNoteInput } from '../types';
export declare class NoteModel {
    static create(input: CreateNoteInput): Promise<Note>;
    static findById(id: number): Promise<Note | null>;
    static findAll(): Promise<Note[]>;
    static search(query: string): Promise<Note[]>;
    static findByTitle(title: string): Promise<Note | null>;
    static findBacklinks(noteTitle: string): Promise<Note[]>;
    static update(id: number, input: UpdateNoteInput): Promise<Note | null>;
    static delete(id: number): Promise<boolean>;
    private static extractTags;
    private static extractBacklinks;
    private static processWikiLinksToHtml;
    private static mapRow;
}
//# sourceMappingURL=Note.d.ts.map
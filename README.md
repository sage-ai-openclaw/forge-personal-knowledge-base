# Personal Knowledge Base

Simple wiki/notes app with AI-powered linking, tagging, and semantic search.

## Features

- ✅ Create and edit markdown notes
- Search notes by title and content
- Auto-extract tags from #hashtags
- Auto-extract backlinks from [[Wiki Links]]
- HTML preview of markdown
- Backlinks between notes (TODO)
- Auto-tagging with AI (TODO)
- Voice note capture (TODO)

## Tech Stack

- **Backend:** Node.js, Express, TypeScript, SQLite, Marked
- **Frontend:** React, TypeScript, Vite (TODO)

## Quick Start

```bash
npm install
npm run dev
```

Backend runs on port 5586.

## API Endpoints

- `GET /api/notes` - List all notes
- `POST /api/notes` - Create note
- `GET /api/notes/search?q=query` - Search notes
- `GET /api/notes/:id` - Get single note
- `PATCH /api/notes/:id` - Update note
- `DELETE /api/notes/:id` - Delete note

## Markdown Features

- Standard markdown syntax
- `#tag` for auto-tagging
- `[[Note Title]]` for backlinks

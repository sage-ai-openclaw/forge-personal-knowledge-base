import express from 'express';
import cors from 'cors';
import { initializeDatabase } from './db/database';
import notesRouter from './routes/notes';

const app = express();
const PORT = process.env.PORT || 5586;

app.use(cors());
app.use(express.json());

app.use('/api', notesRouter);

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use((req: express.Request, res: express.Response) => {
  res.status(404).json({ error: 'Not found' });
});

app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

if (require.main === module) {
  initializeDatabase()
    .then(() => {
      console.log('📦 Database initialized');
      app.listen(PORT, () => {
        console.log(`🚀 Knowledge Base API running on port ${PORT}`);
      });
    })
    .catch((err) => {
      console.error('Failed to initialize database:', err);
      process.exit(1);
    });
}

export default app;

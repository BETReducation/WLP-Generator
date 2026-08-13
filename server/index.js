// Minimal server for Railway deploy: serves the built React app and a tiny JSON
// API that replaces public/ai-import.json, so AI Fill works without a local dev server.
import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(express.json({ limit: '2mb' }));

// Railway volumes mount at a fixed path — point DATA_DIR there in production so
// generated content survives restarts/redeploys. Falls back to a local folder for dev.
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
const DATA_FILE = path.join(DATA_DIR, 'ai-import.json');
const SECRET = process.env.AI_IMPORT_SECRET;

fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(DATA_FILE)) {
  fs.writeFileSync(DATA_FILE, JSON.stringify({ lessons: [] }, null, 2));
}

app.get('/api/ai-import', (req, res) => {
  res.type('application/json').send(fs.readFileSync(DATA_FILE, 'utf-8'));
});

app.post('/api/ai-import', (req, res) => {
  if (!SECRET || req.headers['x-ai-import-secret'] !== SECRET) {
    return res.status(401).json({ error: 'unauthorized' });
  }
  fs.writeFileSync(DATA_FILE, JSON.stringify(req.body, null, 2));
  res.json({ ok: true });
});

const distDir = path.join(__dirname, '..', 'dist');
app.use(express.static(distDir));
app.get('*', (req, res) => {
  res.sendFile(path.join(distDir, 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`WLP Generator server listening on :${PORT}`));

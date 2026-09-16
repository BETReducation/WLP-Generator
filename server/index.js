// Minimal server for Railway deploy: serves the built React app and a tiny JSON
// API that replaces public/ai-import.json, so AI Fill works without a local dev server.
import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import pg from 'pg';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(express.json({ limit: '5mb' }));

// Railway volumes mount at a fixed path — point DATA_DIR there in production so
// generated content survives restarts/redeploys. Falls back to a local folder for dev.
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
const DATA_FILE = path.join(DATA_DIR, 'ai-import.json');
const SECRET = process.env.AI_IMPORT_SECRET;

fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(DATA_FILE)) {
  fs.writeFileSync(DATA_FILE, JSON.stringify({ lessons: [] }, null, 2));
}

// Single-row table holding the whole AppState as JSONB — this app has exactly one
// user and one plan, so there's no need for per-user rows or a normalised schema.
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

async function ensureSchema() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS app_state (
      id SMALLINT PRIMARY KEY DEFAULT 1,
      data JSONB NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      CONSTRAINT single_row CHECK (id = 1)
    );
  `);
}
const schemaReady = ensureSchema();

app.get('/api/state', async (req, res) => {
  try {
    await schemaReady;
    const result = await pool.query('SELECT data FROM app_state WHERE id = 1');
    res.json(result.rows[0]?.data ?? null);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'failed to load state' });
  }
});

app.put('/api/state', async (req, res) => {
  if (!SECRET || req.headers['x-ai-import-secret'] !== SECRET) {
    return res.status(401).json({ error: 'unauthorized' });
  }
  try {
    await schemaReady;
    await pool.query(
      `INSERT INTO app_state (id, data, updated_at) VALUES (1, $1, now())
       ON CONFLICT (id) DO UPDATE SET data = $1, updated_at = now()`,
      [req.body],
    );
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'failed to save state' });
  }
});

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

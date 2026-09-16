# WLP Generator — Project Context

A React/TypeScript/Vite app for generating Weekly Learning Plans (WLPs) for teaching, with a
small Express backend (`server/index.js`) so it can run hosted, not just locally.
- **Local dev:** `npm run dev` → http://localhost:5173 (Vite only, hot reload)
- **Hosted:** https://wlp-generator-production.up.railway.app (Railway; see "Deployment" below)
- **Repo:** https://github.com/BETReducation/WLP-Generator

## What this app does
Teachers fill in a weekly planning grid with Learning Objectives, Learning Activities, Lesson Consolidation, and Homework for each lesson. Content can be copied to Excel. An AI Fill feature generates lesson content from textbooks.

## Subjects and classes
- **IG1:** IG1 Computer Science (4 lessons)
- **IG2:** IG2 Computer Science, IG2 Economics (4 lessons each)
- **A-Level:** A-Level Economics, A-Level Computer Science (7 lessons each)

## Key files
- `src/defaultData.ts` — subjects list and default dropdown options (4 per category)
- `src/storage.ts` — localStorage persistence and reconcile logic
- `src/store/planReducer.ts` — all state mutations including `IMPORT_AI_CONTENT`
- `src/components/CategoryCell.tsx` — cell editing (uses auto-expanding textarea)
- `src/components/AiFillButton.tsx` — AI Fill modal with prompt builder and import
- `src/components/OptionsManager.tsx` — manage dropdown lists per subject
- `server/index.js` — Express server: serves the built app + `/api/ai-import` GET/POST, replaces the old `public/ai-import.json` static file

## Textbooks (in /textbooks folder)
- `Economics A-Level/` — Cambridge International AS & A Level Economics Coursebook (4th Ed)
- `Economics GCSE/` — Cambridge IGCSE and O Level Economics
- `Computer Science A-Level/` — A-Level Computer Science (2023)
- `Computer Science GCSE/` — Cambridge IGCSE Computer Science (2nd Edition)

PDF text is extracted using `pdftotext` (installed via `brew install poppler`).

## AI Fill workflow
1. User clicks **✦ AI Fill** on a subject in the app
2. Modal lets them select textbook, type chapter, set number of lessons
3. App generates a ready-made prompt (via `buildPrompt()`) — user copies it and pastes into Claude Code
4. Claude reads the PDF chapter using `pdftotext`, generates lesson content, and **POSTs it** to
   `<app origin>/api/ai-import` with header `X-AI-Import-Secret` (curl command included in the
   prompt). The secret is baked into the frontend at build time from Railway's
   `VITE_AI_IMPORT_SECRET` env var — it's not a real security boundary (visible in page source),
   just a filter against random POSTs to the endpoint
5. User clicks **Import AI Content** to preview and confirm — this step doesn't require having
   generated a prompt in the current session first; it always GETs whatever is currently stored
   at `/api/ai-import`, so previously generated content can be (re-)imported directly
   - Locally (`npm run dev`), `/api/ai-import` 404s unless the Express server is also running
     (`npm run build && npm start`) — for pure frontend dev, generate against the hosted URL instead

### Lessons beyond a class's weekly period count (overflow)
Classes have a fixed weekly lesson count (`subject.periods` — 4 for IG1/IG2, 7 for A-Level). If
`ai-import.json` contains more lessons than that, the import preview splits them into **one
chunk per week** (`Math.ceil(totalLessons / periods)` chunks total), not just a single overflow
batch — e.g. 12 lessons for a 4-lesson/week class becomes 3 separate chunks of 4. This matters:
an earlier version only split once, so a 12-lesson generation would dump all 8 overflow lessons
into a single destination week, silently losing the last 4 in slots the UI doesn't render — the
same class of bug as the original single-week overflow issue, just recurring one level deeper.
- The first chunk (`lesson 0..periods-1`) goes into the current week (overwriting existing
  content there)
- Each subsequent chunk gets its own independent destination control: a brand-new week (name
  editable, defaults to the next guessed sequential name — `"Week 1"` → `"Week 2"` → `"Week 3"`,
  incrementing a trailing number if the current week's name has one, else appending `" N"`), an
  **existing** week (picked by name, auto-selected if one already matches the guessed name), or
  skipped entirely
- A warning only appears for a chunk's destination if that week already has content in the
  relevant lesson range for that subject — an empty or brand-new destination gets a neutral
  status message instead
See `guessWeekName()` and the `overflowChunks`/`overflowChunkInfo` logic in `AiFillButton.tsx`.

### Flipped-classroom model (from week 5, 2026)
As of week 5, homework comes *before* the lesson and delivers new content; lessons are spent
practising and deepening what homework already covered. Students must complete homework to
participate in the lesson. The `buildPrompt()` template in `AiFillButton.tsx` reflects this:
- **Homework**: a specific textbook note-making task, plus an occasional relevant video —
  grounded in the chapter, not invented
- **Activities**: still exactly 3 bullet points following the "I do / We do / You do" gradual-release
  model, but each one assumes students already have the homework's baseline knowledge — it's
  practice/deepening, not first teaching. Keep this structure (both the flipped framing and I do/We
  do/You do) if editing the prompt template.

## Backup / restore
Data now lives in Postgres (see "State and storage" below), not localStorage, but the header
still has **Export Backup** / **Import Backup** buttons (`src/components/BackupControls.tsx`) —
useful as an off-server snapshot and for the kind of bulk restore/merge done from old source
files:
- **Export** downloads the full `AppState` (subjects, library, weeks) as `wlp-backup-<date>.json`
- **Import** reads a backup file, validates it (`parseBackupState()` in `storage.ts`, reusing
  `reconcile()`), and — after a confirm dialog, since it's destructive — replaces the entire live
  state via the `REPLACE_STATE` reducer action, which is then persisted to Postgres like any
  other change
Recommend the user save exports into a folder that syncs to OneDrive/iCloud/Google Drive so a
backup exists outside the database too.

## Default dropdown options
Each category has 4 defaults (same across all subjects):
- **LO:** sentences ending with `on: ` so teachers can type the specific topic
- **Activities:** think-pair-share, structured note-taking, exam practice, group task
- **Consolidation:** exit ticket, cold-call Q&A, traffic light self-assessment, knowledge organiser
- **Homework:** exam question, flashcard revision, read & annotate, past paper timed

## State and storage
- State lives in Postgres, single row (`app_state`, id=1, one `data JSONB` column holding the
  whole `AppState`) — this app has exactly one user, so there's no per-user schema
- `src/storage.ts`: `loadState()` GETs `/api/state` on app start, `saveState()` PUTs the whole
  state (debounced ~800ms after any change, see `PlanContext.tsx`) — both async now, no
  localStorage involved
- `server/index.js`: `GET /api/state` (public), `PUT /api/state` (needs `X-AI-Import-Secret`,
  same secret/header as `/api/ai-import` — reused rather than adding a second env var since the
  trust model is identical: single user, not a real security boundary)
- `ensureSchema()` in `server/index.js` runs `CREATE TABLE IF NOT EXISTS` on server start, so no
  separate migration step is needed after a fresh Postgres provision
- No offline fallback by design — if `/api/state` is unreachable the app shows a load error
  instead of silently using stale/empty local data
- `reconcile()` in `storage.ts` still runs on every load — strips old example items, syncs
  default item text, seeds defaults for empty categories
- To reset all data: `DELETE FROM app_state WHERE id = 1;` via `railway connect Postgres`, or PUT
  a fresh default state to `/api/state`

## Deployment
Hosted on Railway (project `WLP-Generator`, under `betreducation` workspace), two services:
- **WLP-Generator** — the app
  - Build: `npm run build` (tsc + vite build → `dist/`)
  - Start: `npm start` → `node server/index.js`, serves `dist/`, `/api/state`, `/api/ai-import`
  - Env vars: `AI_IMPORT_SECRET` (server-side check for both `/api/state` PUT and `/api/ai-import`
    POST), `VITE_AI_IMPORT_SECRET` (same value, baked into the frontend build), `DATA_DIR=/data`,
    `DATABASE_URL` (Railway reference variable — `${{Postgres.DATABASE_URL}}` — do not hardcode)
- **Postgres** — Railway-managed Postgres plugin, private networking only (no public proxy
  configured); `DATABASE_URL` is only reachable from other services in this project, not from a
  local machine — use `railway run` or hit the app's own `/api/state` endpoint instead of
  connecting directly from outside Railway
- `/api/ai-import` storage is still a JSON file on local disk — ephemeral unless a Railway volume
  is mounted at `/data` (not currently mounted). Fine since imported content only needs to
  survive until the user clicks "Import AI Content" — long-term storage is Postgres, per "State
  and storage" above
- Redeploy: `railway up` from the project root (or push to GitHub + connect a Railway auto-deploy
  if that's set up later — currently deploys are manual via CLI)
- GitHub repo (`gbyatt`/`BETReducation` account) is separate from Railway — pushing to GitHub does
  **not** auto-deploy; run `railway up` to actually redeploy

## Decisions made
- No external API key required — AI generation uses Claude Code reading local PDF files
- Vertical alignment clipboard feature was tried and reverted (broke Excel formatting)
- Cell editing uses `<textarea>` (auto-expanding) instead of `<input>` for better UX

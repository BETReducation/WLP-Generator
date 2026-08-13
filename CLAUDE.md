# WLP Generator — Project Context

A locally-run React/TypeScript/Vite app for generating Weekly Learning Plans (WLPs) for teaching. Runs at http://localhost:5173 via `npm run dev`.

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
- `public/ai-import.json` — written by Claude when generating lesson content; imported via AI Fill button

## Textbooks (in /textbooks folder)
- `Economics A-Level/` — Cambridge International AS & A Level Economics Coursebook (4th Ed)
- `Economics GCSE/` — Cambridge IGCSE and O Level Economics
- `Computer Science A-Level/` — A-Level Computer Science (2023)
- `Computer Science GCSE/` — Cambridge IGCSE Computer Science (2nd Edition)

PDF text is extracted using `pdftotext` (installed via `brew install poppler`).

## AI Fill workflow
1. User clicks **✦ AI Fill** on a subject in the app
2. Modal lets them select textbook, type chapter, set number of lessons
3. App generates a ready-made prompt — user copies it and pastes into Claude Code
4. Claude reads the PDF chapter using `pdftotext`, generates lesson content, writes it to `public/ai-import.json`
5. User clicks **Import AI Content** to preview and confirm — this step doesn't require having
   generated a prompt in the current session first; it always reads whatever is currently in
   `public/ai-import.json`, so previously generated content can be (re-)imported directly

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

### Activities format (I do / We do / You do)
The AI Fill prompt template (`buildPrompt()` in `AiFillButton.tsx`) requires the **Activities**
field to be exactly 3 bullet points following the gradual-release model: `"I do: ..."` (teacher-led
demonstration), `"We do: ..."` (guided practice), `"You do: ..."` (independent practice, referencing
a specific textbook activity/question). This applies to all future AI Fill generations, whether
processed by Claude Code directly in a session or via the CLI — keep this structure if editing the
prompt template.

## Backup / restore
Since all data lives only in browser localStorage (per browser profile/origin — see "State and
storage" below), the header has **Export Backup** / **Import Backup** buttons
(`src/components/BackupControls.tsx`) so data survives a browser reset, profile switch, or
"clear browsing data":
- **Export** downloads the full `AppState` (subjects, library, weeks) as `wlp-backup-<date>.json`
- **Import** reads a backup file, validates it (`parseBackupState()` in `storage.ts`, reusing
  `reconcile()`), and — after a confirm dialog, since it's destructive — replaces the entire live
  state via the `REPLACE_STATE` reducer action
Recommend the user save exports into a folder that syncs to OneDrive/iCloud/Google Drive so a
local backup exists off-browser too.

## Default dropdown options
Each category has 4 defaults (same across all subjects):
- **LO:** sentences ending with `on: ` so teachers can type the specific topic
- **Activities:** think-pair-share, structured note-taking, exam practice, group task
- **Consolidation:** exit ticket, cold-call Q&A, traffic light self-assessment, knowledge organiser
- **Homework:** exam question, flashcard revision, read & annotate, past paper timed

## State and storage
- State saved to `localStorage` key `wlp-generator-state-v1`
- `reconcile()` in `storage.ts` handles migrations — strips old example items, syncs default item text, seeds defaults for empty categories
- To reset all data: run `localStorage.clear(); location.reload()` in browser console

## Decisions made
- No external API key required — AI generation uses Claude Code reading local PDF files
- Vertical alignment clipboard feature was tried and reverted (broke Excel formatting)
- Cell editing uses `<textarea>` (auto-expanding) instead of `<input>` for better UX

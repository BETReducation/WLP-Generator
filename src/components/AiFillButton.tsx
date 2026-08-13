import { useRef, useState } from 'react';
import { usePlan } from '../store/PlanContext';
import type { AiLessonContent } from '../store/planReducer';
import type { Subject } from '../types';
import { newId } from '../utils/id';
import { guessWeekName } from '../utils/weekName';
import { Modal } from './Modal';

interface AiImportData {
  source: string;
  subjectId: string;
  generatedAt: string;
  lessons: AiLessonContent[];
}

interface Textbook {
  id: string;
  name: string;
  path: string;
  subjectIds: string[];
}

const TEXTBOOKS: Textbook[] = [
  {
    id: 'al-econ-tb',
    name: 'Cambridge A-Level Economics (4th Ed)',
    path: 'textbooks/Economics A-Level/Cambridge International AS  A level Economics Coursebook 4th Edition (Colin Bamford  Susan Grant).pdf',
    subjectIds: ['al-econ'],
  },
  {
    id: 'al-cs-tb',
    name: 'A-Level Computer Science (2023)',
    path: 'textbooks/Computer Science A-Level/A-Level Computer Science 2023.pdf',
    subjectIds: ['al-cs'],
  },
  {
    id: 'igcse-cs-tb',
    name: 'Cambridge IGCSE Computer Science (2nd Ed)',
    path: 'textbooks/Computer Science GCSE/Cambridge IGCSE Computer Science 2nd Edition Course Book.pdf',
    subjectIds: ['ig1-cs', 'ig2-cs'],
  },
  {
    id: 'igcse-econ-tb',
    name: 'Cambridge IGCSE & O Level Economics',
    path: 'textbooks/Economics GCSE/cambridge igcse and o level economics v2.pdf',
    subjectIds: ['ig2-econ'],
  },
];

function buildPrompt(subject: Subject, textbook: Textbook, chapter: string, lessons: number): string {
  return `Generate WLP lesson content for the following:

**Textbook:** ${textbook.name}
**File:** ${textbook.path}
**Chapter:** ${chapter}
**Lessons to generate:** ${lessons} (lesson 0 to lesson ${lessons - 1})
**Subject ID:** ${subject.id}
**Subject name:** ${subject.name}

Read the chapter from the textbook file, then POST the content as JSON to:
${window.location.origin}/api/ai-import
with header: X-AI-Import-Secret: ${AI_IMPORT_SECRET || '<set VITE_AI_IMPORT_SECRET and redeploy>'}

Use this exact JSON structure as the POST body:
{
  "source": "${textbook.name} — ${chapter}",
  "subjectId": "${subject.id}",
  "generatedAt": "${new Date().toISOString().slice(0, 10)}",
  "lessons": [
    { "lesson": 0, "LO": "...", "Activities": "...", "Consolidation": "...", "Homework": "..." }
  ]
}

This is a flipped-classroom model: homework comes BEFORE the lesson and delivers the new
content; the lesson itself is spent practising and deepening what homework already covered.
Students are expected to have done the homework before the lesson, so lesson activities must
assume that knowledge rather than reteach it from scratch.

For each lesson entry:
- **Homework**: the prerequisite for the lesson (set the lesson before, covering that lesson's
  content) — a specific note-making task from the chapter ("make notes on section X covering...")
  plus, where genuinely relevant to the topic, a specific video to watch (name the topic/search
  term if you can't give a real URL). Do not invent a homework task that isn't grounded in the
  chapter content.
- **LO**: 1–2 specific learning objectives drawn directly from the chapter content, framed as what
  students will practise/deepen in the lesson, building on the homework
- **Activities**: starts with a line identifying the specific sub-chapter/section the content is
  drawn from, with its page range in the textbook, in the form
  "<section number> - <section title> (p<start>-<end>)" (e.g. "1.2.2 - Representation of sound (p29-30)"),
  followed by exactly 3 bullet points following the "I do / We do / You do" gradual release
  model, each grounded in the chapter's specific examples, figures and textbook activities, and
  each assuming students already have the homework's baseline knowledge (this is practice and
  deepening, not first teaching):
  - "I do: ..." — teacher briefly recaps/checks the homework content, then models applying it to a harder example
  - "We do: ..." — teacher and students work through a practice question together that extends beyond the homework (guided practice)
  - "You do: ..." — students independently practise/deepen the skill, referencing a specific textbook activity/question
- **Consolidation**: a specific end-of-lesson check or task confirming the practice/deepening landed
- Note: students must have completed the homework to participate in the lesson — Activities should
  read as though that's a given, not optional

Use curl, e.g.:
curl -X POST ${window.location.origin}/api/ai-import \\
  -H "Content-Type: application/json" \\
  -H "X-AI-Import-Secret: ${AI_IMPORT_SECRET || '<set VITE_AI_IMPORT_SECRET and redeploy>'}" \\
  -d @/path/to/generated.json

When done, tell me to click ✦ AI Fill on ${subject.name} in the app.`;
}

// Baked in at build time from Railway's VITE_AI_IMPORT_SECRET so the prompt can tell
// Claude Code what to send — this is a shared secret to keep randoms from POSTing
// junk to the endpoint, not a real security boundary (it's visible in the page source).
const AI_IMPORT_SECRET = import.meta.env.VITE_AI_IMPORT_SECRET as string | undefined;

export function AiFillButton({ subject }: { subject: Subject }) {
  const { state, currentWeek, dispatch } = usePlan();

  const defaultTextbook = TEXTBOOKS.find((tb) => tb.subjectIds.includes(subject.id)) ?? TEXTBOOKS[0];
  const periods = subject.periods;

  const [open, setOpen] = useState(false);
  const [textbookId, setTextbookId] = useState(defaultTextbook.id);
  const [chapter, setChapter] = useState('');
  const [lessonCount, setLessonCount] = useState(subject.periods);
  const [prompt, setPrompt] = useState('');
  const [copied, setCopied] = useState(false);
  const [importStatus, setImportStatus] = useState<'idle' | 'loading' | 'preview' | 'error'>('idle');
  const [importData, setImportData] = useState<AiImportData | null>(null);
  const [importError, setImportError] = useState('');
  // One entry per week's worth of overflow lessons beyond the current week. Each is 'new'
  // (create a fresh week), 'none' (skip), or the id of an existing week to import into.
  const [overflowTargets, setOverflowTargets] = useState<string[]>([]);
  const [overflowNewWeekNames, setOverflowNewWeekNames] = useState<string[]>([]);
  const promptRef = useRef<HTMLTextAreaElement>(null);

  const selectedTextbook = TEXTBOOKS.find((tb) => tb.id === textbookId) ?? defaultTextbook;

  // A week's grid only has room for `periods` lessons, so a generated batch longer than that
  // needs to be split one week's worth at a time — not just once, however many weeks it spans.
  const rawChunks: AiLessonContent[][] = [];
  if (importData) {
    for (let i = 0; i < importData.lessons.length; i += periods) {
      rawChunks.push(importData.lessons.slice(i, i + periods));
    }
  }
  const inWeekLessons = rawChunks[0] ?? [];
  const overflowChunks = rawChunks.slice(1).map((chunk) => ({
    startLesson: chunk[0].lesson + 1,
    endLesson: chunk[chunk.length - 1].lesson + 1,
    lessons: chunk.map((l) => ({ ...l, lesson: l.lesson % periods })),
  }));

  const overflowChunkInfo = overflowChunks.map((chunk, i) => {
    const target = overflowTargets[i] ?? 'new';
    const existingWeek = target !== 'new' && target !== 'none' ? state.weeks.find((w) => w.id === target) : undefined;
    const weekName =
      target === 'none' ? null : target === 'new' ? overflowNewWeekNames[i]?.trim() || 'New week' : (existingWeek?.name ?? 'Unknown week');
    // Only warn about overwriting when the target week actually has content there already —
    // a brand-new or still-empty week doesn't need an alarming "this will overwrite" message.
    const hasContent = existingWeek
      ? chunk.lessons.some((l) => {
          const cell = existingWeek.grid[subject.id]?.[l.lesson];
          return cell && Object.values(cell).some((lines) => lines && lines.length > 0);
        })
      : false;
    return { ...chunk, target, weekName, hasContent };
  });

  function updateOverflowTarget(index: number, value: string) {
    setOverflowTargets((prev) => prev.map((t, i) => (i === index ? value : t)));
  }

  function updateOverflowNewWeekName(index: number, value: string) {
    setOverflowNewWeekNames((prev) => prev.map((n, i) => (i === index ? value : n)));
  }

  function handleOpen() {
    setTextbookId(defaultTextbook.id);
    setChapter('');
    setLessonCount(subject.periods);
    setPrompt('');
    setCopied(false);
    setImportStatus('idle');
    setImportData(null);
    setOpen(true);
  }

  function handleClose() {
    setOpen(false);
    setPrompt('');
    setImportStatus('idle');
    setImportData(null);
  }

  function handleGenerate() {
    if (!chapter.trim()) return;
    setPrompt(buildPrompt(subject, selectedTextbook, chapter.trim(), lessonCount));
  }

  async function handleCopy() {
    if (!prompt) return;
    await navigator.clipboard.writeText(prompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleImport() {
    setImportStatus('loading');
    try {
      const res = await fetch('/api/ai-import?t=' + Date.now());
      if (!res.ok) throw new Error('No AI content found — paste the prompt into Claude Code and try again.');
      const json = (await res.json()) as AiImportData;
      if (!json.lessons || !json.subjectId) throw new Error('The JSON file does not look like valid AI content.');
      if (json.subjectId !== subject.id) {
        throw new Error(
          `This content was generated for "${json.subjectId}", not "${subject.id}".\nRegenerate the prompt for the correct subject.`,
        );
      }

      const overflowChunkCount = Math.max(0, Math.ceil(json.lessons.length / periods) - 1);
      const targets: string[] = [];
      const names: string[] = [];
      for (let i = 0; i < overflowChunkCount; i++) {
        const guessedName = guessWeekName(currentWeek.name, i + 1);
        const matchingWeek = state.weeks.find(
          (w) => w.id !== currentWeek.id && w.name.trim().toLowerCase() === guessedName.trim().toLowerCase(),
        );
        targets.push(matchingWeek ? matchingWeek.id : 'new');
        names.push(guessedName);
      }

      setImportData(json);
      setOverflowTargets(targets);
      setOverflowNewWeekNames(names);
      setImportStatus('preview');
    } catch (e) {
      setImportError(e instanceof Error ? e.message : 'Unknown error');
      setImportStatus('error');
    }
  }

  function handleConfirmImport() {
    if (!importData) return;
    const originalWeekId = currentWeek.id;
    if (inWeekLessons.length > 0) {
      dispatch({ type: 'IMPORT_AI_CONTENT', weekId: originalWeekId, subjectId: subject.id, lessons: inWeekLessons });
    }
    let createdNewWeek = false;
    overflowChunkInfo.forEach((chunk, i) => {
      if (chunk.lessons.length === 0) return;
      if (chunk.target === 'new') {
        const weekId = newId();
        dispatch({
          type: 'NEW_WEEK',
          id: weekId,
          name: overflowNewWeekNames[i]?.trim() || guessWeekName(currentWeek.name, i + 1),
        });
        dispatch({ type: 'IMPORT_AI_CONTENT', weekId, subjectId: subject.id, lessons: chunk.lessons });
        createdNewWeek = true;
      } else if (chunk.target !== 'none') {
        dispatch({ type: 'IMPORT_AI_CONTENT', weekId: chunk.target, subjectId: subject.id, lessons: chunk.lessons });
      }
    });
    if (createdNewWeek) {
      // NEW_WEEK switches the current week to the one it just created — stay on the week the
      // user was actually working in instead of yanking them onto the last overflow week.
      dispatch({ type: 'SWITCH_WEEK', weekId: originalWeekId });
    }
    handleClose();
  }

  return (
    <>
      <button type="button" className="btn-ai" onClick={handleOpen} title="Generate AI lesson content">
        ✦ AI Fill
      </button>

      {open && (
        <Modal title={`AI Fill — ${subject.name}`} onClose={handleClose} wide>
          <div className="ai-modal">

            {/* ── Step 1: Configure ── */}
            <section className="ai-step">
              <h3 className="ai-step-title">1. Configure</h3>
              <div className="ai-form">
                <label>
                  Textbook
                  <select value={textbookId} onChange={(e) => setTextbookId(e.target.value)}>
                    {TEXTBOOKS.map((tb) => (
                      <option key={tb.id} value={tb.id}>
                        {tb.name}{tb.subjectIds.includes(subject.id) ? ' ★' : ''}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Chapter
                  <input
                    type="text"
                    placeholder="e.g. Chapter 30 — Utility"
                    value={chapter}
                    onChange={(e) => setChapter(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleGenerate(); }}
                  />
                </label>
                <label>
                  Number of lessons
                  <input
                    type="number"
                    min={1}
                    max={40}
                    value={lessonCount}
                    onChange={(e) => setLessonCount(Math.max(1, Number(e.target.value)))}
                  />
                </label>
              </div>
              <p className="ai-status-msg">
                {subject.name} has {periods} lesson{periods !== 1 ? 's' : ''} per week. If you generate more than
                that, the extra lessons will be split one week's worth at a time — on import you'll be offered a
                destination week for each batch.
              </p>
              <button
                type="button"
                className="btn-primary"
                onClick={handleGenerate}
                disabled={!chapter.trim()}
              >
                Generate Prompt
              </button>
            </section>

            {/* ── Step 2: Copy prompt ── */}
            {prompt && (
              <section className="ai-step">
                <h3 className="ai-step-title">2. Copy &amp; paste into Claude Code</h3>
                <textarea
                  ref={promptRef}
                  className="ai-prompt-output"
                  readOnly
                  value={prompt}
                  rows={8}
                  onClick={() => promptRef.current?.select()}
                />
                <button type="button" className="btn-primary" onClick={handleCopy}>
                  {copied ? 'Copied ✓' : 'Copy Prompt'}
                </button>
              </section>
            )}

            {/* ── Step 3: Import ── */}
            <section className="ai-step">
              <h3 className="ai-step-title">3. Import after Claude generates the content</h3>
              <p className="ai-status-msg">
                Already have content generated for {subject.name} (from this session or an earlier one)? You can
                import it directly — no need to regenerate the prompt above first.
              </p>

                {importStatus === 'idle' && (
                  <button type="button" className="btn-secondary" onClick={handleImport}>
                    Import AI Content
                  </button>
                )}

                {importStatus === 'loading' && (
                  <p className="ai-status-msg">Loading…</p>
                )}

                {importStatus === 'error' && (
                  <div>
                    <p className="ai-fill-error-msg">{importError}</p>
                    <button type="button" className="btn-secondary" onClick={() => setImportStatus('idle')}>
                      Try Again
                    </button>
                  </div>
                )}

                {importStatus === 'preview' && importData && (
                  <div className="ai-fill-preview">
                    <p className="ai-fill-source"><strong>Source:</strong> {importData.source}</p>

                    {inWeekLessons.length > 0 && (
                      <>
                        <p className="ai-fill-warning">
                          This will <strong>overwrite</strong> existing content in {inWeekLessons.length} lesson
                          {inWeekLessons.length !== 1 ? 's' : ''} for <strong>{subject.name}</strong> in the
                          current week ("{currentWeek.name}").
                        </p>
                        <div className="ai-fill-lesson-list">
                          {inWeekLessons.map((l) => (
                            <div key={l.lesson} className="ai-fill-lesson">
                              <h4>Lesson {l.lesson + 1}</h4>
                              <dl>
                                <dt>LO</dt><dd>{l.LO}</dd>
                                <dt>Activities</dt><dd>{l.Activities}</dd>
                                <dt>Consolidation</dt><dd>{l.Consolidation}</dd>
                                <dt>Homework</dt><dd>{l.Homework}</dd>
                              </dl>
                            </div>
                          ))}
                        </div>
                      </>
                    )}

                    {overflowChunkInfo.length > 0 && (
                      <p className="ai-fill-warning">
                        {subject.name} only has {periods} lesson{periods !== 1 ? 's' : ''} per week, so the
                        remaining {importData.lessons.length - inWeekLessons.length} lessons span{' '}
                        {overflowChunkInfo.length} more week{overflowChunkInfo.length !== 1 ? 's' : ''}. Choose a
                        destination for each below.
                      </p>
                    )}

                    {overflowChunkInfo.map((chunk, i) => (
                      <div key={i} className="ai-step" style={{ background: 'transparent' }}>
                        <h3 className="ai-step-title">
                          Lessons {chunk.startLesson}
                          {chunk.endLesson !== chunk.startLesson ? `-${chunk.endLesson}` : ''}
                        </h3>
                        <label className="ai-fill-new-week-name">
                          Put these {chunk.lessons.length} lesson{chunk.lessons.length !== 1 ? 's' : ''} into
                          <select value={chunk.target} onChange={(e) => updateOverflowTarget(i, e.target.value)}>
                            <option value="new">A new week</option>
                            {state.weeks
                              .filter((w) => w.id !== currentWeek.id)
                              .map((w) => (
                                <option key={w.id} value={w.id}>
                                  {w.name} (existing)
                                </option>
                              ))}
                            <option value="none">Don't import these</option>
                          </select>
                        </label>
                        {chunk.target === 'new' && (
                          <label className="ai-fill-new-week-name">
                            New week name
                            <input
                              type="text"
                              value={overflowNewWeekNames[i] ?? ''}
                              onChange={(e) => updateOverflowNewWeekName(i, e.target.value)}
                            />
                          </label>
                        )}
                        {chunk.target !== 'none' && chunk.target !== 'new' && chunk.hasContent && (
                          <p className="ai-fill-warning">
                            "{chunk.weekName}" already has content in this range — this will{' '}
                            <strong>overwrite</strong> the existing {chunk.lessons.length} lesson
                            {chunk.lessons.length !== 1 ? 's' : ''} of <strong>{subject.name}</strong> there.
                          </p>
                        )}
                        {chunk.target !== 'none' && chunk.target !== 'new' && !chunk.hasContent && (
                          <p className="ai-status-msg">
                            "{chunk.weekName}" doesn't have any {subject.name} content in this range yet — these
                            lessons will be added there safely.
                          </p>
                        )}
                        <div className="ai-fill-lesson-list">
                          {chunk.lessons.map((l) => (
                            <div key={l.lesson} className="ai-fill-lesson">
                              <h4>
                                {chunk.weekName ?? 'Not imported'} — Lesson {l.lesson + 1}
                              </h4>
                              <dl>
                                <dt>LO</dt><dd>{l.LO}</dd>
                                <dt>Activities</dt><dd>{l.Activities}</dd>
                                <dt>Consolidation</dt><dd>{l.Consolidation}</dd>
                                <dt>Homework</dt><dd>{l.Homework}</dd>
                              </dl>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}

                    <div className="ai-fill-actions">
                      <button type="button" className="btn-primary" onClick={handleConfirmImport}>
                        Confirm Import
                      </button>
                      <button type="button" className="btn-secondary" onClick={() => setImportStatus('idle')}>
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
            </section>

          </div>
        </Modal>
      )}
    </>
  );
}

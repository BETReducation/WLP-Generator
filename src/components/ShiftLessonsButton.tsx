import { useMemo, useState } from 'react';
import { usePlan } from '../store/PlanContext';
import type { LessonSlot, LessonSlotValue } from '../store/planReducer';
import type { Category, Subject } from '../types';
import { newId } from '../utils/id';
import { guessWeekName } from '../utils/weekName';
import { Modal } from './Modal';

type Direction = 'delay' | 'compress';

const EMPTY_VALUE: LessonSlotValue = { LO: [], Activities: [], Consolidation: [], Homework: [] };

function isEmptyValue(v: LessonSlotValue): boolean {
  return (Object.keys(v) as Category[]).every((cat) => v[cat].length === 0);
}

function summarize(v: LessonSlotValue): string {
  const firstLine = v.LO[0]?.text || v.Activities[0]?.text || v.Consolidation[0]?.text || v.Homework[0]?.text;
  return firstLine ? firstLine.slice(0, 70) + (firstLine.length > 70 ? '…' : '') : '(empty)';
}

interface ExtraWeek {
  id: string;
  name: string;
}

export function ShiftLessonsButton({ subject }: { subject: Subject }) {
  const { state, currentWeek, dispatch } = usePlan();
  const periods = subject.periods;

  const [open, setOpen] = useState(false);
  const [anchorWeekId, setAnchorWeekId] = useState(currentWeek.id);
  const [anchorLesson, setAnchorLesson] = useState(0);
  const [direction, setDirection] = useState<Direction>('delay');
  const [count, setCount] = useState(1);
  const [previewing, setPreviewing] = useState(false);
  const [extraWeeks, setExtraWeeks] = useState<ExtraWeek[]>([]);

  function handleOpen() {
    setAnchorWeekId(currentWeek.id);
    setAnchorLesson(0);
    setDirection('delay');
    setCount(1);
    setPreviewing(false);
    setOpen(true);
  }

  function handleClose() {
    setOpen(false);
    setPreviewing(false);
  }

  // The ordered sequence of slots for this subject, starting at the anchor lesson in the anchor
  // week and running through every lesson of every subsequent week (existing weeks only).
  const baseSlots: LessonSlot[] = useMemo(() => {
    const anchorIndex = state.weeks.findIndex((w) => w.id === anchorWeekId);
    if (anchorIndex === -1) return [];
    const slots: LessonSlot[] = [];
    for (let lesson = anchorLesson; lesson < periods; lesson++) {
      slots.push({ weekId: anchorWeekId, lesson });
    }
    for (let wi = anchorIndex + 1; wi < state.weeks.length; wi++) {
      for (let lesson = 0; lesson < periods; lesson++) {
        slots.push({ weekId: state.weeks[wi].id, lesson });
      }
    }
    return slots;
  }, [state.weeks, anchorWeekId, anchorLesson, periods]);

  const content = useMemo(
    () =>
      baseSlots.map((s) => {
        const week = state.weeks.find((w) => w.id === s.weekId);
        const cell = week?.grid[subject.id]?.[s.lesson];
        return {
          LO: cell?.LO ?? [],
          Activities: cell?.Activities ?? [],
          Consolidation: cell?.Consolidation ?? [],
          Homework: cell?.Homework ?? [],
        };
      }),
    [baseSlots, state.weeks, subject.id],
  );

  const clampedCount = direction === 'compress' ? Math.min(count, content.length) : count;

  // How many brand-new weeks (each holding `periods` lessons) are needed to hold the overflow
  // pushed off the end when delaying. Compressing never needs new weeks — it only frees slots.
  // `content` has exactly one entry per slot in `baseSlots` (empty or not) — a delay only needs
  // extra weeks if the slots it would push past the end of the existing weeks actually hold
  // something; if the tail is empty there's nothing to lose by just letting it drop off.
  const overflowCount = direction === 'delay' ? clampedCount : 0;
  const overflowTail = overflowCount > 0 ? content.slice(content.length - overflowCount) : [];
  const overflowHasContent = overflowTail.some((v) => !isEmptyValue(v));
  const extraWeeksNeeded = overflowHasContent ? Math.ceil(overflowCount / periods) : 0;

  const computedExtraWeeks: ExtraWeek[] = useMemo(() => {
    if (extraWeeksNeeded === 0) return [];
    const lastWeek = state.weeks[state.weeks.length - 1];
    return Array.from({ length: extraWeeksNeeded }, (_, i) => ({
      id: newId(),
      name: guessWeekName(lastWeek.name, i + 1),
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [extraWeeksNeeded, previewing]);

  const allSlots: LessonSlot[] = useMemo(() => {
    const extra = extraWeeks.length ? extraWeeks : computedExtraWeeks;
    const generated: LessonSlot[] = [];
    for (const w of extra) {
      for (let lesson = 0; lesson < periods; lesson++) {
        generated.push({ weekId: w.id, lesson });
      }
    }
    return [...baseSlots, ...generated];
  }, [baseSlots, extraWeeks, computedExtraWeeks, periods]);

  const newValues: LessonSlotValue[] = useMemo(() => {
    if (direction === 'delay') {
      const gap = Array.from({ length: clampedCount }, () => EMPTY_VALUE);
      const combined = [...gap, ...content];
      // Pad in case computedExtraWeeks hasn't caught up with allSlots.length yet (shouldn't happen,
      // but keeps the arrays parallel and safe if the effect ordering is ever off).
      while (combined.length < allSlots.length) combined.push(EMPTY_VALUE);
      return combined.slice(0, allSlots.length);
    }
    const kept = content.slice(clampedCount);
    const tailGap = Array.from({ length: clampedCount }, () => EMPTY_VALUE);
    return [...kept, ...tailGap];
  }, [direction, clampedCount, content, allSlots.length]);

  function weekName(weekId: string): string {
    if (state.weeks.some((w) => w.id === weekId)) return state.weeks.find((w) => w.id === weekId)!.name;
    const extra = (extraWeeks.length ? extraWeeks : computedExtraWeeks).find((w) => w.id === weekId);
    return extra?.name ?? 'New week';
  }

  // Rows describing where each piece of non-empty content moves to, for the preview.
  const moveRows = useMemo(() => {
    const rows: { from: LessonSlot; to: LessonSlot | null; text: string }[] = [];
    if (direction === 'delay') {
      content.forEach((v, i) => {
        if (isEmptyValue(v)) return;
        rows.push({ from: baseSlots[i], to: allSlots[i + clampedCount] ?? null, text: summarize(v) });
      });
    } else {
      content.forEach((v, i) => {
        if (isEmptyValue(v)) return;
        const to = i < clampedCount ? null : allSlots[i - clampedCount];
        rows.push({ from: baseSlots[i], to, text: summarize(v) });
      });
    }
    return rows;
  }, [direction, content, baseSlots, allSlots, clampedCount]);

  const lostRows = moveRows.filter((r) => r.to === null);

  function handlePreview() {
    setExtraWeeks(computedExtraWeeks);
    setPreviewing(true);
  }

  function updateExtraWeekName(id: string, name: string) {
    setExtraWeeks((prev) => prev.map((w) => (w.id === id ? { ...w, name } : w)));
  }

  function handleConfirm() {
    extraWeeks.forEach((w) => {
      dispatch({ type: 'NEW_WEEK', id: w.id, name: w.name.trim() || 'New week' });
    });
    dispatch({ type: 'SHIFT_LESSONS', subjectId: subject.id, slots: allSlots, values: newValues });
    if (extraWeeks.length > 0) {
      // NEW_WEEK switches the current week to the one it just created — stay on the week the
      // user was actually looking at instead of yanking them onto the last new week.
      dispatch({ type: 'SWITCH_WEEK', weekId: currentWeek.id });
    }
    handleClose();
  }

  const anchorWeek = state.weeks.find((w) => w.id === anchorWeekId) ?? currentWeek;
  const canCompress = content.length > 0;

  return (
    <>
      <button type="button" className="btn-secondary" onClick={handleOpen} title="Push lessons back or pull them forward">
        ⇄ Shift Lessons
      </button>

      {open && (
        <Modal title={`Shift Lessons — ${subject.name}`} onClose={handleClose} wide>
          <div className="ai-modal">
            {!previewing && (
              <section className="ai-step">
                <h3 className="ai-step-title">1. Choose where to shift from</h3>
                <div className="ai-form">
                  <label>
                    From week
                    <select value={anchorWeekId} onChange={(e) => setAnchorWeekId(e.target.value)}>
                      {state.weeks.map((w) => (
                        <option key={w.id} value={w.id}>
                          {w.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    From lesson
                    <select value={anchorLesson} onChange={(e) => setAnchorLesson(Number(e.target.value))}>
                      {Array.from({ length: periods }, (_, i) => (
                        <option key={i} value={i}>
                          Lesson {i + 1}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    What happened
                    <select value={direction} onChange={(e) => setDirection(e.target.value as Direction)}>
                      <option value="delay">We're delayed — push this lesson and everything after it later</option>
                      <option value="compress">
                        We got ahead — pull everything after this lesson forward (this lesson's slot is discarded)
                      </option>
                    </select>
                  </label>
                  <label>
                    Number of lessons
                    <input
                      type="number"
                      min={1}
                      max={direction === 'compress' ? Math.max(1, content.length) : 20}
                      value={count}
                      onChange={(e) => setCount(Math.max(1, Number(e.target.value)))}
                    />
                  </label>
                </div>
                <p className="ai-status-msg">
                  {direction === 'delay'
                    ? `Lesson ${anchorLesson + 1} in "${anchorWeek.name}" and every ${subject.name} lesson after it moves forward by ${clampedCount} lesson${clampedCount !== 1 ? 's' : ''}. The freed slot${clampedCount !== 1 ? 's' : ''} at Lesson ${anchorLesson + 1} become${clampedCount !== 1 ? '' : 's'} empty for you to fill in.`
                    : `Lesson ${anchorLesson + 1} in "${anchorWeek.name}" and the next ${clampedCount - 1} lesson${clampedCount - 1 !== 1 ? 's' : ''} after it are removed — every ${subject.name} lesson after that moves back to fill the gap.`}
                  {extraWeeksNeeded > 0 && (
                    <> This will need {extraWeeksNeeded} new week{extraWeeksNeeded !== 1 ? 's' : ''} to hold the lessons pushed past your last existing week.</>
                  )}
                </p>
                <button type="button" className="btn-primary" onClick={handlePreview} disabled={!canCompress}>
                  Preview Shift
                </button>
              </section>
            )}

            {previewing && (
              <section className="ai-step">
                <h3 className="ai-step-title">2. Review &amp; confirm</h3>

                {extraWeeks.length > 0 && (
                  <>
                    <p className="ai-status-msg">These new weeks will be created to hold the shifted lessons:</p>
                    {extraWeeks.map((w) => (
                      <label key={w.id} className="ai-fill-new-week-name">
                        New week name
                        <input type="text" value={w.name} onChange={(e) => updateExtraWeekName(w.id, e.target.value)} />
                      </label>
                    ))}
                  </>
                )}

                {lostRows.length > 0 && (
                  <p className="ai-fill-warning">
                    {direction === 'compress'
                      ? `This will permanently delete content in ${lostRows.length} lesson${lostRows.length !== 1 ? 's' : ''} — there's nothing after them to pull forward to fill the gap:`
                      : `${lostRows.length} lesson${lostRows.length !== 1 ? 's' : ''} could not be placed:`}
                  </p>
                )}
                {lostRows.length > 0 && (
                  <ul className="ai-fill-lesson-list">
                    {lostRows.map((r, i) => (
                      <li key={i} className="ai-fill-lesson">
                        Lesson {r.from.lesson + 1}, {weekName(r.from.weekId)} — {r.text}
                      </li>
                    ))}
                  </ul>
                )}

                {moveRows.filter((r) => r.to).length > 0 && (
                  <>
                    <p className="ai-status-msg">Lessons moving:</p>
                    <ul className="ai-fill-lesson-list">
                      {moveRows
                        .filter((r) => r.to)
                        .map((r, i) => (
                          <li key={i} className="ai-fill-lesson">
                            Lesson {r.from.lesson + 1}, {weekName(r.from.weekId)} → Lesson {r.to!.lesson + 1}, {weekName(r.to!.weekId)}
                            {' — '}
                            {r.text}
                          </li>
                        ))}
                    </ul>
                  </>
                )}

                {moveRows.length === 0 && (
                  <p className="ai-status-msg">No lesson content exists after this point, so nothing will actually move.</p>
                )}

                <div className="ai-fill-actions">
                  <button type="button" className="btn-primary" onClick={handleConfirm}>
                    Confirm Shift
                  </button>
                  <button type="button" className="btn-secondary" onClick={() => setPreviewing(false)}>
                    Back
                  </button>
                </div>
              </section>
            )}
          </div>
        </Modal>
      )}
    </>
  );
}

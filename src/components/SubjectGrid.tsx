import { useState } from 'react';
import { usePlan } from '../store/PlanContext';
import { CATEGORIES, CATEGORY_LABELS, type Subject } from '../types';
import { subjectToTSV } from '../utils/tsv';
import { AiFillButton } from './AiFillButton';
import { CategoryCell } from './CategoryCell';
import { ConfirmDialog } from './ConfirmDialog';
import { CopyButton } from './CopyButton';
import { ShiftLessonsButton } from './ShiftLessonsButton';

interface SubjectGridProps {
  subject: Subject;
  onManageOptions: (subjectId: string) => void;
}

export function SubjectGrid({ subject, onManageOptions }: SubjectGridProps) {
  const { currentWeek, dispatch } = usePlan();
  const lessons = Array.from({ length: subject.periods }, (_, i) => i);
  const [confirmingClear, setConfirmingClear] = useState(false);

  function handleConfirmClear() {
    dispatch({ type: 'CLEAR_SUBJECT_CONTENT', weekId: currentWeek.id, subjectId: subject.id });
    setConfirmingClear(false);
  }

  return (
    <section className="subject-grid">
      <div className="subject-grid-toolbar">
        <h2>{subject.name}</h2>
        <div className="subject-grid-toolbar-actions">
          <button type="button" className="btn-secondary" onClick={() => onManageOptions(subject.id)}>
            Manage dropdown lists
          </button>
          <AiFillButton subject={subject} />
          <ShiftLessonsButton subject={subject} />
          <CopyButton label="Copy for Excel" getText={() => subjectToTSV(subject, currentWeek)} />
          <button type="button" className="btn-danger" onClick={() => setConfirmingClear(true)}>
            Clear content
          </button>
        </div>
      </div>

      {confirmingClear && (
        <ConfirmDialog
          title="Clear content"
          message={`Clear all lesson content for ${subject.name} in "${currentWeek.name}"? This removes every LO, Activity, Consolidation and Homework entry for this class in the current week — other classes and other weeks are not affected. This cannot be undone.`}
          confirmLabel="Clear content"
          onConfirm={handleConfirmClear}
          onCancel={() => setConfirmingClear(false)}
        />
      )}
      <table className="wlp-table">
        <thead>
          <tr>
            <th className="corner-cell" colSpan={2} />
            {lessons.map((lesson) => (
              <th key={lesson} className="lesson-header">
                Lesson {lesson + 1}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {CATEGORIES.map((category, idx) => (
            <tr key={category}>
              {idx === 0 && (
                <td className="subject-label" rowSpan={CATEGORIES.length}>
                  {subject.name}
                </td>
              )}
              <td className="category-label">{CATEGORY_LABELS[category]}</td>
              {lessons.map((lesson) => (
                <td key={lesson} className="grid-cell">
                  <CategoryCell subject={subject} lesson={lesson} category={category} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

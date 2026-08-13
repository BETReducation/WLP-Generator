import { useState } from 'react';
import { usePlan } from '../store/PlanContext';
import { ConfirmDialog } from './ConfirmDialog';
import { PromptDialog } from './PromptDialog';

type DialogMode = 'new' | 'duplicate' | 'rename' | 'delete' | null;

export function WeekBar() {
  const { state, currentWeek, dispatch } = usePlan();
  const [dialogMode, setDialogMode] = useState<DialogMode>(null);

  function closeDialog() {
    setDialogMode(null);
  }

  function handleSubmit(name: string) {
    if (dialogMode === 'new') {
      dispatch({ type: 'NEW_WEEK', name });
    } else if (dialogMode === 'duplicate') {
      dispatch({ type: 'DUPLICATE_WEEK', sourceWeekId: currentWeek.id, name });
    } else if (dialogMode === 'rename') {
      dispatch({ type: 'RENAME_WEEK', weekId: currentWeek.id, name });
    }
    closeDialog();
  }

  function confirmDelete() {
    dispatch({ type: 'DELETE_WEEK', weekId: currentWeek.id });
    closeDialog();
  }

  return (
    <div className="week-bar">
      <label className="week-select-label">
        Week:
        <select
          value={currentWeek.id}
          onChange={(e) => dispatch({ type: 'SWITCH_WEEK', weekId: e.target.value })}
        >
          {state.weeks.map((week) => (
            <option key={week.id} value={week.id}>
              {week.name}
            </option>
          ))}
        </select>
      </label>
      <div className="week-actions">
        <button className="btn-secondary" onClick={() => setDialogMode('new')}>
          + New Week
        </button>
        <button className="btn-secondary" onClick={() => setDialogMode('duplicate')}>
          Duplicate
        </button>
        <button className="btn-secondary" onClick={() => setDialogMode('rename')}>
          Rename
        </button>
        <button className="btn-danger" onClick={() => setDialogMode('delete')} disabled={state.weeks.length <= 1}>
          Delete
        </button>
      </div>

      {dialogMode === 'new' && (
        <PromptDialog
          title="New week"
          label="Week name"
          initialValue="Week of "
          confirmLabel="Create"
          onSubmit={handleSubmit}
          onCancel={closeDialog}
        />
      )}
      {dialogMode === 'duplicate' && (
        <PromptDialog
          title="Duplicate week"
          label="Name for the new week"
          initialValue={`${currentWeek.name} (copy)`}
          confirmLabel="Duplicate"
          onSubmit={handleSubmit}
          onCancel={closeDialog}
        />
      )}
      {dialogMode === 'rename' && (
        <PromptDialog
          title="Rename week"
          label="Week name"
          initialValue={currentWeek.name}
          confirmLabel="Rename"
          onSubmit={handleSubmit}
          onCancel={closeDialog}
        />
      )}
      {dialogMode === 'delete' && (
        <ConfirmDialog
          title="Delete week"
          message={`Delete "${currentWeek.name}"? This cannot be undone.`}
          onConfirm={confirmDelete}
          onCancel={closeDialog}
        />
      )}
    </div>
  );
}

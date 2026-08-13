import { useRef, useState } from 'react';
import { usePlan } from '../store/PlanContext';
import type { Category, Subject } from '../types';
import { newId } from '../utils/id';

interface CategoryCellProps {
  subject: Subject;
  lesson: number;
  category: Category;
}

export function CategoryCell({ subject, lesson, category }: CategoryCellProps) {
  const { state, currentWeek, dispatch } = usePlan();
  const detailsRef = useRef<HTMLDetailsElement>(null);
  const [newText, setNewText] = useState('');
  const [editingLineId, setEditingLineId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState('');

  const lines = currentWeek.grid[subject.id]?.[lesson]?.[category] ?? [];
  const libraryItems = state.library[subject.id]?.[category] ?? [];

  function closePopover() {
    if (detailsRef.current) detailsRef.current.open = false;
  }

  function toggleItem(itemId: string) {
    dispatch({
      type: 'TOGGLE_LIBRARY_ITEM_IN_CELL',
      weekId: currentWeek.id,
      subjectId: subject.id,
      lesson,
      category,
      itemId,
    });
  }

  function addAndInsert() {
    const text = newText.trim();
    if (!text) return;
    const id = newId();
    dispatch({ type: 'ADD_LIBRARY_ITEM', id, subjectId: subject.id, category, text });
    dispatch({
      type: 'TOGGLE_LIBRARY_ITEM_IN_CELL',
      weekId: currentWeek.id,
      subjectId: subject.id,
      lesson,
      category,
      itemId: id,
    });
    setNewText('');
  }

  function insertOnce() {
    const text = newText.trim();
    if (!text) return;
    dispatch({ type: 'ADD_CUSTOM_LINE', weekId: currentWeek.id, subjectId: subject.id, lesson, category, text });
    setNewText('');
  }

  function removeLine(lineId: string) {
    dispatch({ type: 'REMOVE_CELL_LINE', weekId: currentWeek.id, subjectId: subject.id, lesson, category, lineId });
  }

  function startEdit(lineId: string, text: string) {
    setEditingLineId(lineId);
    setEditingText(text);
  }

  function saveEdit() {
    if (editingLineId) {
      dispatch({
        type: 'EDIT_CELL_LINE_TEXT',
        weekId: currentWeek.id,
        subjectId: subject.id,
        lesson,
        category,
        lineId: editingLineId,
        text: editingText,
      });
    }
    setEditingLineId(null);
  }

  return (
    <div className="category-cell">
      {lines.length > 0 && (
        <ul className="cell-lines">
          {lines.map((line) => (
            <li key={line.id}>
              {editingLineId === line.id ? (
                <textarea
                  autoFocus
                  className="cell-line-edit-input"
                  value={editingText}
                  onChange={(e) => {
                    setEditingText(e.target.value);
                    e.target.style.height = 'auto';
                    e.target.style.height = e.target.scrollHeight + 'px';
                  }}
                  ref={(el) => {
                    if (el) {
                      el.style.height = 'auto';
                      el.style.height = el.scrollHeight + 'px';
                    }
                  }}
                  onBlur={saveEdit}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); saveEdit(); }
                    if (e.key === 'Escape') setEditingLineId(null);
                  }}
                />
              ) : (
                <>
                  <span className="cell-line-text" onClick={() => startEdit(line.id, line.text)}>
                    {line.text}
                  </span>
                  <button className="cell-line-remove" onClick={() => removeLine(line.id)} aria-label="Remove">
                    ×
                  </button>
                </>
              )}
            </li>
          ))}
        </ul>
      )}

      <details className="cell-popover" ref={detailsRef}>
        <summary>+ Add</summary>
        <div className="cell-popover-body">
          {libraryItems.length === 0 && <p className="popover-empty">No saved options yet — add one below.</p>}
          <ul className="popover-options">
            {libraryItems.map((item) => {
              const checked = lines.some((line) => line.libraryItemId === item.id);
              return (
                <li key={item.id}>
                  <label>
                    <input type="checkbox" checked={checked} onChange={() => toggleItem(item.id)} />
                    <span>{item.text}</span>
                  </label>
                </li>
              );
            })}
          </ul>
          <div className="popover-new">
            <input
              type="text"
              placeholder="Type new text..."
              value={newText}
              onChange={(e) => setNewText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') addAndInsert();
              }}
            />
            <div className="popover-new-actions">
              <button
                type="button"
                className="btn-secondary"
                onClick={insertOnce}
                title="Use this text in this cell only, without saving it to the dropdown list"
              >
                Insert once
              </button>
              <button
                type="button"
                className="btn-primary"
                onClick={addAndInsert}
                title="Save to the dropdown list and insert it here"
              >
                Add to list &amp; insert
              </button>
            </div>
          </div>
          <button type="button" className="popover-done" onClick={closePopover}>
            Done
          </button>
        </div>
      </details>
    </div>
  );
}

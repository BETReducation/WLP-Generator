import { useState } from 'react';
import { usePlan } from '../store/PlanContext';
import { CATEGORIES, CATEGORY_LABELS, type Category } from '../types';
import { newId } from '../utils/id';
import { ConfirmDialog } from './ConfirmDialog';
import { Modal } from './Modal';

interface OptionsManagerProps {
  initialSubjectId: string;
  onClose: () => void;
}

export function OptionsManager({ initialSubjectId, onClose }: OptionsManagerProps) {
  const { state, dispatch } = usePlan();
  const [subjectId, setSubjectId] = useState(initialSubjectId);
  const [category, setCategory] = useState<Category>('LO');
  const [newText, setNewText] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const items = state.library[subjectId]?.[category] ?? [];

  function addItem() {
    const text = newText.trim();
    if (!text) return;
    dispatch({ type: 'ADD_LIBRARY_ITEM', id: newId(), subjectId, category, text });
    setNewText('');
  }

  function startEdit(id: string, text: string) {
    setEditingId(id);
    setEditingText(text);
  }

  function saveEdit() {
    if (editingId) {
      dispatch({ type: 'EDIT_LIBRARY_ITEM', subjectId, category, itemId: editingId, text: editingText });
    }
    setEditingId(null);
  }

  function confirmDelete() {
    if (deletingId) {
      dispatch({ type: 'DELETE_LIBRARY_ITEM', subjectId, category, itemId: deletingId });
    }
    setDeletingId(null);
  }

  return (
    <Modal title="Manage dropdown lists" onClose={onClose} wide>
      <div className="options-manager">
        <div className="options-manager-selectors">
          <label>
            Class
            <select value={subjectId} onChange={(e) => setSubjectId(e.target.value)}>
              {state.subjects.map((subject) => (
                <option key={subject.id} value={subject.id}>
                  {subject.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Row
            <select value={category} onChange={(e) => setCategory(e.target.value as Category)}>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {CATEGORY_LABELS[c]}
                </option>
              ))}
            </select>
          </label>
        </div>

        <ul className="options-manager-list">
          {items.length === 0 && <li className="options-manager-empty">No options yet for this list.</li>}
          {items.map((item) => (
            <li key={item.id}>
              {editingId === item.id ? (
                <input
                  autoFocus
                  value={editingText}
                  onChange={(e) => setEditingText(e.target.value)}
                  onBlur={saveEdit}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') saveEdit();
                    if (e.key === 'Escape') setEditingId(null);
                  }}
                />
              ) : (
                <>
                  <span className="options-manager-text" onClick={() => startEdit(item.id, item.text)}>
                    {item.text}
                  </span>
                  <button type="button" className="btn-danger-text" onClick={() => setDeletingId(item.id)}>
                    Delete
                  </button>
                </>
              )}
            </li>
          ))}
        </ul>

        <div className="options-manager-add">
          <input
            type="text"
            placeholder={`Add new ${CATEGORY_LABELS[category]} option...`}
            value={newText}
            onChange={(e) => setNewText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') addItem();
            }}
          />
          <button type="button" className="btn-primary" onClick={addItem}>
            Add
          </button>
        </div>
      </div>

      {deletingId && (
        <ConfirmDialog
          title="Delete option"
          message="Delete this option from the dropdown list? Lessons that already use it will keep their text."
          onConfirm={confirmDelete}
          onCancel={() => setDeletingId(null)}
        />
      )}
    </Modal>
  );
}

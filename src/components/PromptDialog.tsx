import { useState, type FormEvent } from 'react';
import { Modal } from './Modal';

interface PromptDialogProps {
  title: string;
  label: string;
  initialValue?: string;
  confirmLabel?: string;
  onSubmit: (value: string) => void;
  onCancel: () => void;
}

export function PromptDialog({ title, label, initialValue = '', confirmLabel = 'Save', onSubmit, onCancel }: PromptDialogProps) {
  const [value, setValue] = useState(initialValue);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = value.trim();
    if (!trimmed) return;
    onSubmit(trimmed);
  }

  return (
    <Modal title={title} onClose={onCancel}>
      <form onSubmit={handleSubmit} className="prompt-form">
        <label className="prompt-label">
          {label}
          <input
            autoFocus
            type="text"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onFocus={(e) => e.target.select()}
          />
        </label>
        <div className="prompt-actions">
          <button type="button" className="btn-secondary" onClick={onCancel}>
            Cancel
          </button>
          <button type="submit" className="btn-primary">
            {confirmLabel}
          </button>
        </div>
      </form>
    </Modal>
  );
}

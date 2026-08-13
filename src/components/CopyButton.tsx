import { useState } from 'react';
import { copyToClipboard } from '../utils/tsv';

interface CopyButtonProps {
  getText: () => string;
  label: string;
}

type Status = 'idle' | 'copied' | 'error';

export function CopyButton({ getText, label }: CopyButtonProps) {
  const [status, setStatus] = useState<Status>('idle');

  async function handleClick() {
    try {
      await copyToClipboard(getText());
      setStatus('copied');
    } catch {
      setStatus('error');
    }
    setTimeout(() => setStatus('idle'), 1800);
  }

  return (
    <button type="button" className="btn-copy" onClick={handleClick}>
      {status === 'copied' ? 'Copied ✓' : status === 'error' ? 'Could not copy ✕' : label}
    </button>
  );
}

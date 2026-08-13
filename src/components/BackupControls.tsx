import { useRef, useState, type ChangeEvent } from 'react';
import { usePlan } from '../store/PlanContext';
import type { AppState } from '../types';
import { downloadBackup, readBackupFile } from '../utils/backup';
import { ConfirmDialog } from './ConfirmDialog';

export function BackupControls() {
  const { state, dispatch } = usePlan();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pendingImport, setPendingImport] = useState<{ fileName: string; state: AppState } | null>(null);
  const [importError, setImportError] = useState('');
  const [exported, setExported] = useState(false);

  function handleExport() {
    downloadBackup(state);
    setExported(true);
    setTimeout(() => setExported(false), 1800);
  }

  function handleImportClick() {
    setImportError('');
    fileInputRef.current?.click();
  }

  async function handleFileSelected(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow re-selecting the same file later
    if (!file) return;
    try {
      const imported = await readBackupFile(file);
      setPendingImport({ fileName: file.name, state: imported });
    } catch (err) {
      setImportError(err instanceof Error ? err.message : 'Could not read that backup file.');
    }
  }

  function confirmImport() {
    if (!pendingImport) return;
    dispatch({ type: 'REPLACE_STATE', state: pendingImport.state });
    setPendingImport(null);
  }

  return (
    <div className="backup-controls">
      <button type="button" className="btn-secondary" onClick={handleExport} title="Save all weeks and dropdown lists to a file on your computer">
        {exported ? 'Saved ✓' : '⬇ Export Backup'}
      </button>
      <button type="button" className="btn-secondary" onClick={handleImportClick} title="Restore from a previously exported backup file">
        ⬆ Import Backup
      </button>
      <input
        ref={fileInputRef}
        type="file"
        accept="application/json"
        style={{ display: 'none' }}
        onChange={handleFileSelected}
      />
      {importError && <p className="backup-error">{importError}</p>}

      {pendingImport && (
        <ConfirmDialog
          title="Import backup"
          message={`Replace everything currently in the app — all weeks and dropdown lists — with the contents of "${pendingImport.fileName}"? This cannot be undone.`}
          confirmLabel="Replace"
          onConfirm={confirmImport}
          onCancel={() => setPendingImport(null)}
        />
      )}
    </div>
  );
}

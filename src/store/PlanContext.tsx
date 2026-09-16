import { createContext, useContext, useEffect, useMemo, useRef, useState, type Dispatch, type ReactNode } from 'react';
import { loadState, saveState } from '../storage';
import type { AppState, Week } from '../types';
import { planReducer, type PlanAction } from './planReducer';

interface PlanContextValue {
  state: AppState;
  dispatch: Dispatch<PlanAction>;
  currentWeek: Week;
  saveError: string | null;
}

const PlanContext = createContext<PlanContextValue | null>(null);

const SAVE_DEBOUNCE_MS = 800;

export function PlanProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const skipNextSave = useRef(true);

  useEffect(() => {
    loadState()
      .then(setState)
      .catch((err) => setLoadError(err instanceof Error ? err.message : 'Failed to load plan'));
  }, []);

  function dispatch(action: PlanAction) {
    setState((prev) => (prev ? planReducer(prev, action) : prev));
  }

  useEffect(() => {
    if (!state) return;
    if (skipNextSave.current) {
      // Don't write straight back after the initial load — nothing has changed yet.
      skipNextSave.current = false;
      return;
    }
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      saveState(state)
        .then(() => setSaveError(null))
        .catch((err) => setSaveError(err instanceof Error ? err.message : 'Failed to save plan'));
    }, SAVE_DEBOUNCE_MS);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [state]);

  const currentWeek = useMemo(
    () => state?.weeks.find((w) => w.id === state.currentWeekId) ?? state?.weeks[0],
    [state],
  );

  const value = useMemo(
    () => (state && currentWeek ? { state, dispatch, currentWeek, saveError } : null),
    [state, currentWeek, saveError],
  );

  if (loadError) {
    return <div className="plan-load-error">Couldn't load your plan: {loadError}. Try reloading the page.</div>;
  }
  if (!value) {
    return <div className="plan-loading">Loading plan…</div>;
  }

  return <PlanContext.Provider value={value}>{children}</PlanContext.Provider>;
}

export function usePlan(): PlanContextValue {
  const ctx = useContext(PlanContext);
  if (!ctx) throw new Error('usePlan must be used within a PlanProvider');
  return ctx;
}

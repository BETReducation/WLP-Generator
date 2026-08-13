import { createContext, useContext, useEffect, useMemo, useReducer, type Dispatch, type ReactNode } from 'react';
import { loadState, saveState } from '../storage';
import type { AppState, Week } from '../types';
import { planReducer, type PlanAction } from './planReducer';

interface PlanContextValue {
  state: AppState;
  dispatch: Dispatch<PlanAction>;
  currentWeek: Week;
}

const PlanContext = createContext<PlanContextValue | null>(null);

export function PlanProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(planReducer, undefined, loadState);

  useEffect(() => {
    saveState(state);
  }, [state]);

  const currentWeek = useMemo(
    () => state.weeks.find((w) => w.id === state.currentWeekId) ?? state.weeks[0],
    [state.weeks, state.currentWeekId],
  );

  const value = useMemo(() => ({ state, dispatch, currentWeek }), [state, currentWeek]);

  return <PlanContext.Provider value={value}>{children}</PlanContext.Provider>;
}

export function usePlan(): PlanContextValue {
  const ctx = useContext(PlanContext);
  if (!ctx) throw new Error('usePlan must be used within a PlanProvider');
  return ctx;
}

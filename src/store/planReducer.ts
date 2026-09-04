import { emptyGrid } from '../defaultData';
import type { AppState, CellLine, Category, Week } from '../types';
import { newId } from '../utils/id';

export interface AiLessonContent {
  lesson: number;
  LO: string;
  Activities: string;
  Consolidation: string;
  Homework: string;
}

/** A single lesson slot's full cell content — one per category. */
export type LessonSlotValue = Record<Category, CellLine[]>;

/** A lesson slot's address: which week, which lesson index within it. */
export interface LessonSlot {
  weekId: string;
  lesson: number;
}

export type PlanAction =
  | { type: 'ADD_LIBRARY_ITEM'; id: string; subjectId: string; category: Category; text: string }
  | { type: 'EDIT_LIBRARY_ITEM'; subjectId: string; category: Category; itemId: string; text: string }
  | { type: 'DELETE_LIBRARY_ITEM'; subjectId: string; category: Category; itemId: string }
  | { type: 'TOGGLE_LIBRARY_ITEM_IN_CELL'; weekId: string; subjectId: string; lesson: number; category: Category; itemId: string }
  | { type: 'ADD_CUSTOM_LINE'; weekId: string; subjectId: string; lesson: number; category: Category; text: string }
  | { type: 'EDIT_CELL_LINE_TEXT'; weekId: string; subjectId: string; lesson: number; category: Category; lineId: string; text: string }
  | { type: 'REMOVE_CELL_LINE'; weekId: string; subjectId: string; lesson: number; category: Category; lineId: string }
  | { type: 'IMPORT_AI_CONTENT'; weekId: string; subjectId: string; lessons: AiLessonContent[] }
  | { type: 'CLEAR_SUBJECT_CONTENT'; weekId: string; subjectId: string }
  | { type: 'SHIFT_LESSONS'; subjectId: string; slots: LessonSlot[]; values: LessonSlotValue[] }
  | { type: 'NEW_WEEK'; id?: string; name: string }
  | { type: 'DUPLICATE_WEEK'; sourceWeekId: string; name: string }
  | { type: 'RENAME_WEEK'; weekId: string; name: string }
  | { type: 'DELETE_WEEK'; weekId: string }
  | { type: 'SWITCH_WEEK'; weekId: string }
  | { type: 'REPLACE_STATE'; state: AppState };

function touchWeek(week: Week): Week {
  return { ...week, updatedAt: new Date().toISOString() };
}

// Weeks are matched by id everywhere, but the week picker only shows names — two weeks sharing
// a name are indistinguishable in the dropdown, which reads as a week having "disappeared".
// Appends " (2)", " (3)", etc. until the name is unique among the other weeks.
function uniqueWeekName(name: string, weeks: Week[], excludeId?: string): string {
  const others = weeks.filter((w) => w.id !== excludeId).map((w) => w.name);
  if (!others.includes(name)) return name;
  let n = 2;
  while (others.includes(`${name} (${n})`)) n++;
  return `${name} (${n})`;
}

function updateWeekGrid(
  state: AppState,
  weekId: string,
  subjectId: string,
  lesson: number,
  category: Category,
  updateLines: (lines: CellLine[]) => CellLine[],
): AppState {
  const weeks = state.weeks.map((week) => {
    if (week.id !== weekId) return week;
    const currentLines = week.grid[subjectId]?.[lesson]?.[category] ?? [];
    const nextLines = updateLines(currentLines);
    const grid = {
      ...week.grid,
      [subjectId]: {
        ...week.grid[subjectId],
        [lesson]: {
          ...week.grid[subjectId][lesson],
          [category]: nextLines,
        },
      },
    };
    return touchWeek({ ...week, grid });
  });
  return { ...state, weeks };
}

export function planReducer(state: AppState, action: PlanAction): AppState {
  switch (action.type) {
    case 'ADD_LIBRARY_ITEM': {
      const item = { id: action.id, text: action.text.trim() };
      if (!item.text) return state;
      const subjectLib = state.library[action.subjectId];
      const library = {
        ...state.library,
        [action.subjectId]: {
          ...subjectLib,
          [action.category]: [...subjectLib[action.category], item],
        },
      };
      return { ...state, library };
    }

    case 'EDIT_LIBRARY_ITEM': {
      const subjectLib = state.library[action.subjectId];
      const text = action.text.trim();
      if (!text) return state;
      const library = {
        ...state.library,
        [action.subjectId]: {
          ...subjectLib,
          [action.category]: subjectLib[action.category].map((item) =>
            item.id === action.itemId ? { ...item, text } : item,
          ),
        },
      };
      return { ...state, library };
    }

    case 'DELETE_LIBRARY_ITEM': {
      const subjectLib = state.library[action.subjectId];
      const library = {
        ...state.library,
        [action.subjectId]: {
          ...subjectLib,
          [action.category]: subjectLib[action.category].filter((item) => item.id !== action.itemId),
        },
      };
      return { ...state, library };
    }

    case 'TOGGLE_LIBRARY_ITEM_IN_CELL': {
      const item = state.library[action.subjectId]?.[action.category].find((i) => i.id === action.itemId);
      if (!item) return state;
      return updateWeekGrid(state, action.weekId, action.subjectId, action.lesson, action.category, (lines) => {
        const exists = lines.some((line) => line.libraryItemId === action.itemId);
        if (exists) return lines.filter((line) => line.libraryItemId !== action.itemId);
        return [...lines, { id: newId(), libraryItemId: item.id, text: item.text }];
      });
    }

    case 'ADD_CUSTOM_LINE': {
      const text = action.text.trim();
      if (!text) return state;
      return updateWeekGrid(state, action.weekId, action.subjectId, action.lesson, action.category, (lines) => [
        ...lines,
        { id: newId(), text },
      ]);
    }

    case 'EDIT_CELL_LINE_TEXT': {
      const text = action.text.trim();
      return updateWeekGrid(state, action.weekId, action.subjectId, action.lesson, action.category, (lines) =>
        lines.map((line) => (line.id === action.lineId ? { ...line, text } : line)),
      );
    }

    case 'REMOVE_CELL_LINE': {
      return updateWeekGrid(state, action.weekId, action.subjectId, action.lesson, action.category, (lines) =>
        lines.filter((line) => line.id !== action.lineId),
      );
    }

    case 'IMPORT_AI_CONTENT': {
      const weeks = state.weeks.map((week) => {
        if (week.id !== action.weekId) return week;
        let grid = { ...week.grid };
        for (const lessonData of action.lessons) {
          const { lesson, ...categories } = lessonData;
          const cellUpdates: Partial<Record<Category, CellLine[]>> = {};
          for (const [cat, text] of Object.entries(categories) as [Category, string][]) {
            cellUpdates[cat] = text.trim()
              ? text.split('\n').filter(Boolean).map((t) => ({ id: newId(), text: t.trim() }))
              : [];
          }
          grid = {
            ...grid,
            [action.subjectId]: {
              ...grid[action.subjectId],
              [lesson]: { ...grid[action.subjectId]?.[lesson], ...cellUpdates },
            },
          };
        }
        return touchWeek({ ...week, grid });
      });
      return { ...state, weeks };
    }

    case 'CLEAR_SUBJECT_CONTENT': {
      const subject = state.subjects.find((s) => s.id === action.subjectId);
      if (!subject) return state;
      const clearedSubjectGrid = emptyGrid([subject])[subject.id];
      const weeks = state.weeks.map((week) => {
        if (week.id !== action.weekId) return week;
        const grid = { ...week.grid, [subject.id]: clearedSubjectGrid };
        return touchWeek({ ...week, grid });
      });
      return { ...state, weeks };
    }

    case 'SHIFT_LESSONS': {
      // `slots` and `values` are parallel arrays computed by the caller (which already knows
      // about delay-vs-compress and any newly-created weeks) — this just writes each value into
      // its slot for the given subject, leaving every other subject/week untouched.
      const targetWeekIds = new Set(action.slots.map((s) => s.weekId));
      const weeks = state.weeks.map((week) => {
        if (!targetWeekIds.has(week.id)) return week;
        let subjectGrid = { ...week.grid[action.subjectId] };
        action.slots.forEach((slot, i) => {
          if (slot.weekId !== week.id) return;
          subjectGrid = { ...subjectGrid, [slot.lesson]: action.values[i] };
        });
        const grid = { ...week.grid, [action.subjectId]: subjectGrid };
        return touchWeek({ ...week, grid });
      });
      return { ...state, weeks };
    }

    case 'NEW_WEEK': {
      const week: Week = {
        id: action.id ?? newId(),
        name: uniqueWeekName(action.name.trim() || 'New Week', state.weeks),
        grid: emptyGrid(state.subjects),
        updatedAt: new Date().toISOString(),
      };
      return { ...state, weeks: [...state.weeks, week], currentWeekId: week.id };
    }

    case 'DUPLICATE_WEEK': {
      const source = state.weeks.find((w) => w.id === action.sourceWeekId);
      if (!source) return state;
      const week: Week = {
        id: newId(),
        name: uniqueWeekName(action.name.trim() || `${source.name} (copy)`, state.weeks),
        grid: JSON.parse(JSON.stringify(source.grid)),
        updatedAt: new Date().toISOString(),
      };
      return { ...state, weeks: [...state.weeks, week], currentWeekId: week.id };
    }

    case 'RENAME_WEEK': {
      const name = action.name.trim();
      if (!name) return state;
      const uniqueName = uniqueWeekName(name, state.weeks, action.weekId);
      const weeks = state.weeks.map((w) => (w.id === action.weekId ? { ...w, name: uniqueName } : w));
      return { ...state, weeks };
    }

    case 'DELETE_WEEK': {
      if (state.weeks.length <= 1) return state;
      const weeks = state.weeks.filter((w) => w.id !== action.weekId);
      const currentWeekId = state.currentWeekId === action.weekId ? weeks[0].id : state.currentWeekId;
      return { ...state, weeks, currentWeekId };
    }

    case 'SWITCH_WEEK': {
      if (!state.weeks.some((w) => w.id === action.weekId)) return state;
      return { ...state, currentWeekId: action.weekId };
    }

    case 'REPLACE_STATE': {
      return action.state;
    }

    default:
      return state;
  }
}

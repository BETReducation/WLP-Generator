export type TabId = 'IG1' | 'IG2' | 'A-Level';

export type Category = 'LO' | 'Activities' | 'Consolidation' | 'Homework';

export const CATEGORIES: Category[] = ['LO', 'Activities', 'Consolidation', 'Homework'];

export const CATEGORY_LABELS: Record<Category, string> = {
  LO: 'LO',
  Activities: 'Learning Activities',
  Consolidation: 'Lesson Consolidation',
  Homework: 'Homework',
};

export interface Subject {
  id: string;
  name: string;
  tab: TabId;
  periods: number;
}

export interface LibraryItem {
  id: string;
  text: string;
}

/** subjectId -> category -> ordered list of library items available in that cell's dropdown */
export type Library = Record<string, Record<Category, LibraryItem[]>>;

export interface CellLine {
  id: string;
  /** set when this line was inserted from a library item; text is kept in sync via lookup, falling back to this snapshot if the item is later deleted */
  libraryItemId?: string;
  text: string;
}

/** subjectId -> lessonIndex -> category -> ordered bullet lines */
export type WeekGrid = Record<string, Record<number, Record<Category, CellLine[]>>>;

export interface Week {
  id: string;
  name: string;
  grid: WeekGrid;
  updatedAt: string;
}

export interface AppState {
  subjects: Subject[];
  library: Library;
  weeks: Week[];
  currentWeekId: string;
}

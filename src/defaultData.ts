import { CATEGORIES, type AppState, type Category, type Library, type Subject, type WeekGrid } from './types';

export const SUBJECTS: Subject[] = [
  { id: 'ig1-cs', name: 'IG1 Computer Science', tab: 'IG1', periods: 4 },
  { id: 'ig2-cs', name: 'IG2 Computer Science', tab: 'IG2', periods: 4 },
  { id: 'ig2-econ', name: 'IG2 Economics', tab: 'IG2', periods: 4 },
  { id: 'al-econ', name: 'A-Level Economics', tab: 'A-Level', periods: 7 },
  { id: 'al-cs', name: 'A-Level Computer Science', tab: 'A-Level', periods: 7 },
];

export const DEFAULT_LIBRARY_ITEMS: Record<Category, string[]> = {
  LO: [
    'Students will be able to define and explain key terminology on: ',
    'Students will be able to apply their knowledge to exam-style questions on: ',
    'Students will be able to analyse and evaluate: ',
    'Students will be able to compare and contrast: ',
  ],
  Activities: [
    'Think-pair-share discussion on the topic.',
    'Structured note-taking with teacher-led explanation.',
    'Exam question practice — individual and timed.',
    'Group task / collaborative activity.',
  ],
  Consolidation: [
    'Exit ticket — 3 to 5 quick-fire questions.',
    'Cold-call Q&A recap of key learning points.',
    'Traffic light self-assessment against lesson LOs.',
    'Knowledge organiser / mind map completion.',
  ],
  Homework: [
    'Complete an exam-style question from the textbook.',
    'Revise today\'s key terms using flashcards or revision notes.',
    'Read and annotate the relevant textbook chapter.',
    'Attempt a past paper question under timed conditions.',
  ],
};

export function emptyGrid(subjects: Subject[]): WeekGrid {
  const grid: WeekGrid = {};
  for (const subject of subjects) {
    grid[subject.id] = {};
    for (let lesson = 0; lesson < subject.periods; lesson++) {
      grid[subject.id][lesson] = { LO: [], Activities: [], Consolidation: [], Homework: [] };
    }
  }
  return grid;
}

function buildDefaultLibrary(subjects: Subject[]): Library {
  const library: Library = {};
  for (const subject of subjects) {
    library[subject.id] = { LO: [], Activities: [], Consolidation: [], Homework: [] };
    for (const category of CATEGORIES) {
      DEFAULT_LIBRARY_ITEMS[category].forEach((text, i) => {
        library[subject.id][category].push({ id: `${subject.id}-${category}-default-${i}`, text });
      });
    }
  }
  return library;
}

export function buildDefaultState(): AppState {
  const library = buildDefaultLibrary(SUBJECTS);
  const grid = emptyGrid(SUBJECTS);

  return {
    subjects: SUBJECTS,
    library,
    weeks: [
      {
        id: 'week-example',
        name: 'Example Week',
        grid,
        updatedAt: new Date().toISOString(),
      },
    ],
    currentWeekId: 'week-example',
  };
}

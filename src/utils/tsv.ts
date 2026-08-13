import { CATEGORIES } from '../types';
import type { CellLine, Subject, Week } from '../types';

function escapeCell(text: string): string {
  if (text.includes('\t') || text.includes('\n') || text.includes('"')) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

export function linesToCellText(lines: CellLine[]): string {
  if (lines.length === 0) return '';
  if (lines.length === 1) return lines[0].text;
  return lines.map((line) => `• ${line.text}`).join('\n');
}

/** 4 rows (LO/Activities/Consolidation/Homework) x N lesson columns, ready to paste
 *  directly under the "Lesson 1..N" headers of an existing Excel template. */
export function subjectToTSV(subject: Subject, week: Week): string {
  const rows = CATEGORIES.map((category) => {
    const cells: string[] = [];
    for (let lesson = 0; lesson < subject.periods; lesson++) {
      const lines = week.grid[subject.id]?.[lesson]?.[category] ?? [];
      cells.push(escapeCell(linesToCellText(lines)));
    }
    return cells.join('\t');
  });
  return rows.join('\n');
}

export function tabToTSV(subjects: Subject[], week: Week): string {
  return subjects.map((subject) => `${subject.name}\n${subjectToTSV(subject, week)}`).join('\n\n');
}

export async function copyToClipboard(text: string): Promise<void> {
  await navigator.clipboard.writeText(text);
}

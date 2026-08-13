const MONTH_ALIASES: Record<string, number> = {
  jan: 0, january: 0,
  feb: 1, february: 1,
  mar: 2, march: 2,
  apr: 3, april: 3,
  may: 4,
  jun: 5, june: 5,
  jul: 6, july: 6,
  aug: 7, august: 7,
  sep: 8, sept: 8, september: 8,
  oct: 9, october: 9,
  nov: 10, november: 10,
  dec: 11, december: 11,
};

const SHORT_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const FULL_MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

// Matches a day-of-month + ordinal suffix + month name, e.g. "24th Aug", "1st September".
const DATE_RE =
  /(\d{1,2})(st|nd|rd|th)(\s+)(January|February|March|April|May|June|July|August|September|Sept|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\b/i;

function ordinalSuffix(n: number): string {
  const rem100 = n % 100;
  if (rem100 >= 11 && rem100 <= 13) return 'th';
  switch (n % 10) {
    case 1: return 'st';
    case 2: return 'nd';
    case 3: return 'rd';
    default: return 'th';
  }
}

// Re-render a month index in whatever style the original text used — full name, or the
// 3-letter abbreviation, with the "Sept" 4-letter spelling preserved only when it still lands
// on September (so "1st Sept" + a month rollover into October becomes "Oct", not "Septt").
function formatMonth(monthIndex: number, originalText: string): string {
  if (originalText.length > 4) return FULL_MONTHS[monthIndex];
  if (originalText.toLowerCase() === 'sept' && monthIndex === 8) return 'Sept';
  return SHORT_MONTHS[monthIndex];
}

// Bumps a standalone trailing number in `prefix` (e.g. "Week 4 " -> "Week 5 ") by `offset`,
// leaving the prefix unchanged if it doesn't end in a number.
function bumpTrailingNumber(prefix: string, offset: number): string {
  const match = prefix.match(/^(.*?)(\d+)(\D*)$/);
  if (!match) return prefix;
  const [, head, num, tail] = match;
  return `${head}${Number(num) + offset}${tail}`;
}

/**
 * Guesses the name for a week that comes `offset` calendar weeks after `name`.
 *
 * If `name` contains a real date (e.g. "Week 4 - 1st Sept"), advances it by `offset * 7` actual
 * days using proper date arithmetic — so month/year rollovers and ordinal suffixes (1st/2nd/3rd/
 * 4th/11th/21st/31st…) come out correct — and also bumps any standalone week-counter number that
 * appears before the date (e.g. "Week 4" -> "Week 5").
 *
 * Falls back to simply incrementing the last number found in the string when there's no
 * recognisable date, e.g. guessWeekName("Week 1", 1) -> "Week 2".
 */
export function guessWeekName(name: string, offset: number): string {
  const dateMatch = name.match(DATE_RE);
  if (dateMatch) {
    const [full, dayStr, , spacer, monthText] = dateMatch;
    const monthIndex = MONTH_ALIASES[monthText.toLowerCase()];
    if (monthIndex !== undefined) {
      const date = new Date(new Date().getFullYear(), monthIndex, Number(dayStr));
      date.setDate(date.getDate() + offset * 7);
      const newDay = date.getDate();
      const newMonthText = formatMonth(date.getMonth(), monthText);
      const newDateStr = `${newDay}${ordinalSuffix(newDay)}${spacer}${newMonthText}`;

      const dateStart = dateMatch.index ?? name.indexOf(full);
      const prefix = bumpTrailingNumber(name.slice(0, dateStart), offset);
      const rest = name.slice(dateStart + full.length);
      return `${prefix}${newDateStr}${rest}`;
    }
  }

  // No date found — fall back to the old "increment the last number" behaviour, e.g. for plain
  // names like "Week 1" that AI Fill's overflow naming relies on.
  const match = name.match(/^(.*?)(\d+)(\D*)$/);
  if (match) {
    const [, prefix, num, suffix] = match;
    return `${prefix}${Number(num) + offset}${suffix}`;
  }
  return `${name} ${offset + 1}`;
}

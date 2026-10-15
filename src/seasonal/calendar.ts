export type SeasonId = 'halloween' | 'christmas' | 'easter' | 'thanksgiving';
export type Season = { id: SeasonId; name: string; accent: string; tint: string };
export const DECORATIONS_KEY = 'degen-tracker.decorations.v1';
export const SEASONS: Record<SeasonId, Season> = {
  halloween: { id: 'halloween', name: 'Halloween', accent: '#ffad5c', tint: '#29212d' },
  christmas: { id: 'christmas', name: 'Christmas', accent: '#a0e8b0', tint: '#1b2a28' },
  easter: { id: 'easter', name: 'Easter', accent: '#d2b5ff', tint: '#262235' },
  thanksgiving: { id: 'thanksgiving', name: 'Thanksgiving', accent: '#efbf79', tint: '#2c2520' },
};

// Gregorian Easter (Meeus/Jones/Butcher). Construct dates in the device's timezone.
export function easterSunday(year: number): Date {
  const a = year % 19, b = Math.floor(year / 100), c = year % 100;
  const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451), n = h + l - 7 * m + 114;
  return new Date(year, Math.floor(n / 31) - 1, n % 31 + 1);
}

const dayKey = (date: Date) => date.getFullYear() * 10000 + (date.getMonth() + 1) * 100 + date.getDate();
export function seasonWindows(year: number) {
  const month = (season: Season, index: number) => ({ season, start: new Date(year, index, 1), end: new Date(year, index + 1, 0) });
  return [
    month(SEASONS.halloween, 9),
    month(SEASONS.thanksgiving, 10),
    month(SEASONS.christmas, 11),
    month(SEASONS.easter, easterSunday(year).getMonth()),
  ];
}

export function seasonForDate(date: Date): Season | null {
  if (!Number.isFinite(date.getTime())) return null;
  const key = dayKey(date), year = date.getFullYear();
  const windows = seasonWindows(year);
  return windows.find(window => key >= dayKey(window.start) && key <= dayKey(window.end))?.season ?? null;
}

export function nextLocalMidnight(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1).getTime();
}

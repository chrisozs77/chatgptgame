import test from 'node:test';
import assert from 'node:assert/strict';
import { easterSunday, nextLocalMidnight, seasonForDate, seasonWindows } from '../src/seasonal/calendar';

const local = (year: number, month: number, day: number, hour = 12) => new Date(year, month - 1, day, hour);
const key = (date: Date) => `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
test('Halloween and Christmas include their boundaries and switch back automatically', () => {
  for (const [date, expected] of [
    [local(2026, 9, 30), null], [local(2026, 10, 1, 0), 'halloween'],
    [local(2026, 10, 31, 23), 'halloween'], [local(2026, 11, 1, 0), 'thanksgiving'],
    [local(2026, 11, 30, 23), 'thanksgiving'], [local(2026, 12, 1, 0), 'christmas'],
    [local(2026, 12, 31, 23), 'christmas'], [local(2027, 1, 1, 0), null],
  ] as const) assert.equal(seasonForDate(date)?.id ?? null, expected, key(date));
  assert.equal(seasonForDate(new Date(NaN)), null);
});
test('Easter follows the Gregorian calendar, including early and late years', () => {
  for (const [year, expected] of [[1954,'1954-4-18'],[1981,'1981-4-19'],[2000,'2000-4-23'],
    [2024,'2024-3-31'],[2025,'2025-4-20'],[2026,'2026-4-5'],[2027,'2027-3-28'],[2038,'2038-4-25']] as const) {
    assert.equal(key(easterSunday(year)), expected);
  }
  assert.equal(seasonForDate(local(2026,3,31)), null);
  assert.equal(seasonForDate(local(2026,4,1))?.id, 'easter');
  assert.equal(seasonForDate(local(2026,4,30,23))?.id, 'easter');
  assert.equal(seasonForDate(local(2026,5,1,0)), null);
  assert.equal(seasonForDate(local(2027,3,1))?.id,'easter');
  assert.equal(seasonForDate(local(2027,4,1)),null);
});
test('Thanksgiving occupies all of November, between Halloween and Christmas', () => {
  for (const year of [2018,2024,2026,2027]) {
    assert.equal(seasonForDate(local(year,11,1))?.id,'thanksgiving');
    assert.equal(seasonForDate(local(year,11,30,23))?.id,'thanksgiving');
    assert.equal(seasonForDate(local(year,10,31))?.id,'halloween');
    assert.equal(seasonForDate(local(year,12,1))?.id,'christmas');
  }
});
test('every season occupies one whole calendar month, with no overlapping dates', () => {
  for (let year=2000; year<=2100; year++) {
    const occupied = new Set<string>();
    for (const window of [...seasonWindows(year-1),...seasonWindows(year)]) {
      let days=0;
      for (const date=new Date(window.start); date<=window.end; date.setDate(date.getDate()+1)) {
        const day=key(date);
        assert.ok(!occupied.has(day),`Overlapping season on ${day}`);
        occupied.add(day); days++;
      }
      assert.equal(window.start.getDate(),1);
      assert.equal(window.start.getMonth(),window.end.getMonth());
      assert.equal(days,new Date(window.start.getFullYear(),window.start.getMonth()+1,0).getDate());
    }
  }
});
test('refresh deadline follows the next local calendar day across DST and New Year', () => {
  for (const date of [local(2026,3,8,1),local(2026,11,1,1),local(2026,12,31,23)]) {
    const expected=new Date(date); expected.setDate(date.getDate()+1); expected.setHours(0,0,0,0);
    assert.equal(nextLocalMidnight(date),expected.getTime());
    assert.ok(nextLocalMidnight(date)>date.getTime());
  }
});

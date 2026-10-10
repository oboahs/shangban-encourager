import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  classifyShift,
  formatYuan,
  parseClock,
  parseSalary,
  secondsUntilOff,
  shiftLengthSec,
  wageSnapshot,
} from "./wage.ts";

const at = (h: number, m: number, s = 0, ms = 0) => new Date(2026, 9, 10, h, m, s, ms);

describe("wage", () => {
  it("parses clocks and salaries", () => {
    assert.equal(parseClock("10:00"), 10 * 3600);
    assert.equal(parseClock("10:00:00"), 10 * 3600);
    assert.equal(parseClock("19:00"), 19 * 3600);
    assert.equal(parseClock("24:00"), null);
    assert.equal(parseSalary("15,000"), 15000);
    assert.equal(parseSalary("¥21000"), 21000);
    assert.equal(parseSalary("１５０００"), 15000);
    assert.equal(parseSalary("0"), null);
    assert.equal(parseSalary(""), null);
  });

  it("pays a same-day shift by the second and caps after hours", () => {
    const start = parseClock("10:00")!;
    const end = parseClock("19:00")!;
    assert.equal(shiftLengthSec(start, end), 9 * 3600);
    const before = wageSnapshot(21000, start, end, at(3, 3, 0));
    assert.equal(before.status, "before");
    assert.equal(before.earned, 0);
    assert.equal(before.daily, 1000);

    const mid = wageSnapshot(21000, start, end, at(10, 0, 30, 0));
    assert.equal(mid.status, "working");
    assert.ok(Math.abs(mid.earned - 1000 * (30 / (9 * 3600))) < 1e-9);

    const done = wageSnapshot(21000, start, end, at(19, 0, 0));
    assert.equal(done.status, "after");
    assert.equal(done.earned, 1000);

    const overtime = wageSnapshot(21000, start, end, at(22, 0, 0));
    assert.equal(overtime.status, "after");
    assert.equal(overtime.earned, 1000);
  });

  it("handles an overnight shift", () => {
    const start = parseClock("22:00")!;
    const end = parseClock("06:00")!;
    assert.equal(shiftLengthSec(start, end), 8 * 3600);
    assert.equal(classifyShift(23 * 3600, start, end), "working");
    assert.equal(classifyShift(3 * 3600, start, end), "working");
    assert.equal(classifyShift(7 * 3600, start, end), "after");
    assert.equal(classifyShift(20 * 3600, start, end), "before");
    const morning = wageSnapshot(21000, start, end, at(2, 0, 0));
    assert.equal(morning.status, "working");
    assert.ok(morning.earned > 0 && morning.earned < morning.daily);
  });

  it("formats five decimal places", () => {
    assert.equal(formatYuan(0), "0.00000");
    assert.equal(formatYuan(1000), "1,000.00000");
    assert.equal(formatYuan(15000 / 21), "714.28571");
    assert.equal(formatYuan(15000 / 21, 4), "714.2857");
  });

  it("counts seconds until clock-out and stops after the shift", () => {
    const start = parseClock("10:00")!;
    const end = parseClock("19:00")!;
    assert.equal(secondsUntilOff(9 * 3600, start, end), 10 * 3600);
    assert.equal(secondsUntilOff(10 * 3600 + 30, start, end), 9 * 3600 - 30);
    assert.equal(secondsUntilOff(19 * 3600, start, end), 0);
    assert.equal(secondsUntilOff(22 * 3600, start, end), 0);

    const nightStart = parseClock("22:00")!;
    const nightEnd = parseClock("06:00")!;
    assert.equal(secondsUntilOff(23 * 3600, nightStart, nightEnd), 7 * 3600);
    assert.equal(secondsUntilOff(2 * 3600, nightStart, nightEnd), 4 * 3600);
    assert.equal(secondsUntilOff(20 * 3600, nightStart, nightEnd), 10 * 3600);
    assert.equal(secondsUntilOff(7 * 3600, nightStart, nightEnd), 0);
  });
});

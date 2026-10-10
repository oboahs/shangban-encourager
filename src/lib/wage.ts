export const WORK_DAYS = 21;
const DAY = 24 * 60 * 60;

export type ShiftStatus = "before" | "working" | "after";

export type WageSnapshot = {
  status: ShiftStatus;
  earned: number;
  daily: number;
  perSecond: number;
  elapsedSec: number;
  shiftSec: number;
  progress: number;
};

export function parseClock(value: string): number | null {
  const match = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(value.trim());
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  const seconds = match[3] ? Number(match[3]) : 0;
  if (!Number.isInteger(hours) || !Number.isInteger(minutes) || !Number.isInteger(seconds)) return null;
  if (hours > 23 || minutes > 59 || seconds > 59) return null;
  return hours * 3600 + minutes * 60 + seconds;
}

export function parseSalary(raw: string): number | null {
  const cleaned = raw
    .replace(/[０-９]/g, (digit) => String.fromCharCode(digit.charCodeAt(0) - 0xfee0))
    .replace(/[．。]/g, ".")
    .replace(/[,，\s¥￥元]/g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null;
  const value = Number(cleaned);
  if (!Number.isFinite(value) || value <= 0 || value > 1_000_000_000) return null;
  return value;
}

export function shiftLengthSec(startSec: number, endSec: number): number {
  if (endSec === startSec) return 0;
  if (endSec > startSec) return endSec - startSec;
  return DAY - startSec + endSec;
}

export function secondsOfDay(date: Date): number {
  return (
    date.getHours() * 3600 +
    date.getMinutes() * 60 +
    date.getSeconds() +
    date.getMilliseconds() / 1000
  );
}

function insideShift(now: number, start: number, end: number): boolean {
  if (end > start) return now >= start && now < end;
  return now >= start || now < end;
}

function elapsedInShift(now: number, start: number, end: number): number {
  if (end > start) return now - start;
  if (now >= start) return now - start;
  return DAY - start + now;
}

export function classifyShift(nowSec: number, startSec: number, endSec: number): ShiftStatus {
  if (endSec === startSec) return "before";
  if (insideShift(nowSec, startSec, endSec)) return "working";
  if (endSec > startSec) return nowSec < startSec ? "before" : "after";
  const sinceEnd = nowSec >= endSec ? nowSec - endSec : 0;
  const untilStart = startSec - nowSec;
  return sinceEnd <= untilStart ? "after" : "before";
}

export function wageSnapshot(
  monthly: number,
  startSec: number,
  endSec: number,
  now: Date,
): WageSnapshot {
  const shiftSec = shiftLengthSec(startSec, endSec);
  const daily = shiftSec > 0 && monthly > 0 ? monthly / WORK_DAYS : 0;
  const perSecond = shiftSec > 0 ? daily / shiftSec : 0;
  const status = classifyShift(secondsOfDay(now), startSec, endSec);
  const elapsedSec =
    status === "working"
      ? elapsedInShift(secondsOfDay(now), startSec, endSec)
      : status === "after"
        ? shiftSec
        : 0;
  const earned = perSecond * elapsedSec;
  return {
    status,
    earned,
    daily,
    perSecond,
    elapsedSec,
    shiftSec,
    progress: shiftSec > 0 ? Math.min(1, Math.max(0, elapsedSec / shiftSec)) : 0,
  };
}

export function secondsUntilOff(nowSec: number, startSec: number, endSec: number): number {
  const status = classifyShift(nowSec, startSec, endSec);
  if (status === "after" || endSec === startSec) return 0;
  if (endSec > startSec) return Math.max(0, endSec - nowSec);
  if (nowSec >= startSec) return DAY - nowSec + endSec;
  if (nowSec < endSec) return endSec - nowSec;
  return DAY - nowSec + endSec;
}

export function formatYuanParts(amount: number, digits = 5): { int: string; frac: string } {
  const places = Math.max(0, digits);
  const safe = Number.isFinite(amount) ? Math.max(0, amount) : 0;
  const [intRaw, frac = "0".repeat(places)] = safe.toFixed(places).split(".");
  const grouped = intRaw.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return { int: grouped, frac };
}

export function formatYuan(amount: number, digits = 5): string {
  const { int, frac } = formatYuanParts(amount, digits);
  return digits > 0 ? `${int}.${frac}` : int;
}

export function formatDuration(sec: number): string {
  const total = Math.max(0, Math.floor(sec));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  if (hours > 0) return `${hours}小时${minutes}分${seconds}秒`;
  if (minutes > 0) return `${minutes}分${seconds}秒`;
  return `${seconds}秒`;
}

export function formatPlain(amount: number): string {
  return amount.toLocaleString("zh-CN", { maximumFractionDigits: 2 });
}

export function formatHoursLabel(sec: number): string {
  const hours = sec / 3600;
  const rounded = Math.round(hours * 10) / 10;
  return Number.isInteger(rounded) ? `${rounded}` : rounded.toFixed(1);
}

export function formatClock(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

const TREATS = [
  { name: "楼下包子", unit: "个", price: 2.5 },
  { name: "罐装可乐", unit: "罐", price: 3.5 },
  { name: "豪华泡面", unit: "桶", price: 6.5 },
  { name: "食堂鸡腿", unit: "只", price: 8 },
  { name: "瑞幸美式", unit: "杯", price: 15 },
  { name: "地铁来回", unit: "天", price: 8 },
] as const;

export function treatLine(amount: number): string {
  if (amount < 0.01) return "这点钱，自动售货机看都不会看你一眼。";
  let best: (typeof TREATS)[number] = TREATS[0];
  let bestScore = -Infinity;
  for (const treat of TREATS) {
    const count = amount / treat.price;
    if (count < 0.8) continue;
    const score = count > 80 ? 80 / count : count;
    if (score > bestScore) {
      best = treat;
      bestScore = score;
    }
  }
  const count = amount / best.price;
  if (count < 0.8) {
    return `还差一点点才够 1 ${best.unit}${best.name}。`;
  }
  const shown = count >= 10 ? String(Math.round(count)) : count.toFixed(1);
  return `约等于 ${shown} ${best.unit}${best.name}。别告诉自己这就是意义。`;
}

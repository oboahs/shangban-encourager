const WORK_DAYS = 21;
const DAY = 24 * 60 * 60;

function parseClock(value) {
  const match = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(String(value || "").trim());
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  const seconds = match[3] ? Number(match[3]) : 0;
  if (!Number.isInteger(hours) || !Number.isInteger(minutes) || !Number.isInteger(seconds)) return null;
  if (hours > 23 || minutes > 59 || seconds > 59) return null;
  return hours * 3600 + minutes * 60 + seconds;
}

function parseSalary(raw) {
  const cleaned = String(raw || "")
    .replace(/[０-９]/g, (digit) => String.fromCharCode(digit.charCodeAt(0) - 0xfee0))
    .replace(/[．。]/g, ".")
    .replace(/[,，\s¥￥元]/g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null;
  const value = Number(cleaned);
  if (!Number.isFinite(value) || value <= 0 || value > 1000000000) return null;
  return value;
}

function shiftLengthSec(startSec, endSec) {
  if (endSec === startSec) return 0;
  if (endSec > startSec) return endSec - startSec;
  return DAY - startSec + endSec;
}

function secondsOfDay(date) {
  return date.getHours() * 3600 + date.getMinutes() * 60 + date.getSeconds() + date.getMilliseconds() / 1000;
}

function insideShift(now, start, end) {
  if (end > start) return now >= start && now < end;
  return now >= start || now < end;
}

function elapsedInShift(now, start, end) {
  if (end > start) return now - start;
  if (now >= start) return now - start;
  return DAY - start + now;
}

function classifyShift(nowSec, startSec, endSec) {
  if (endSec === startSec) return "before";
  if (insideShift(nowSec, startSec, endSec)) return "working";
  if (endSec > startSec) return nowSec < startSec ? "before" : "after";
  const sinceEnd = nowSec >= endSec ? nowSec - endSec : 0;
  const untilStart = startSec - nowSec;
  return sinceEnd <= untilStart ? "after" : "before";
}

function wageSnapshot(monthly, startSec, endSec, now) {
  const shiftSec = shiftLengthSec(startSec, endSec);
  const daily = shiftSec > 0 && monthly > 0 ? monthly / WORK_DAYS : 0;
  const perSecond = shiftSec > 0 ? daily / shiftSec : 0;
  const status = classifyShift(secondsOfDay(now), startSec, endSec);
  const elapsedSec =
    status === "working" ? elapsedInShift(secondsOfDay(now), startSec, endSec) : status === "after" ? shiftSec : 0;
  return {
    status,
    earned: perSecond * elapsedSec,
    daily,
    perSecond,
    elapsedSec,
    shiftSec,
  };
}

function secondsUntilOff(nowSec, startSec, endSec) {
  const status = classifyShift(nowSec, startSec, endSec);
  if (status === "after" || endSec === startSec) return 0;
  if (endSec > startSec) return Math.max(0, endSec - nowSec);
  if (nowSec >= startSec) return DAY - nowSec + endSec;
  if (nowSec < endSec) return endSec - nowSec;
  return DAY - nowSec + endSec;
}

function formatYuanParts(amount, digits) {
  const places = Math.max(0, digits);
  const safe = Number.isFinite(amount) ? Math.max(0, amount) : 0;
  const parts = safe.toFixed(places).split(".");
  const intRaw = parts[0];
  const frac = parts[1] || "";
  const grouped = intRaw.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return { int: grouped, frac };
}

module.exports = {
  parseClock,
  parseSalary,
  wageSnapshot,
  secondsOfDay,
  secondsUntilOff,
  formatYuanParts,
};

import "@fontsource/zcool-kuaile/chinese-simplified-400.css";
import "@fontsource/zcool-kuaile/latin-400.css";
import { ChevronLeft } from "lucide-react";
import { memo, useEffect, useLayoutEffect, useRef, useState, type RefObject } from "react";
import {
  formatYuan,
  formatYuanParts,
  parseClock,
  parseSalary,
  secondsOfDay,
  secondsUntilOff,
  wageSnapshot,
  type ShiftStatus,
  type WageSnapshot,
} from "@/lib/wage";

const STORAGE_KEY = "shangban-encourager-v1";

const PRESETS = [
  ["实习魂", "4500"],
  ["普通人", "12000"],
  ["还行", "25000"],
  ["传说同事", "50000"],
] as const;

const QUIPS: Record<ShiftStatus, string[]> = {
  before: [
    "班还没开始。钱在被窝里，建议你也考虑一下。",
    "现在的进账是零，但零很稳定，从不下跌。",
    "提早坐到工位不会让数字提前跑。本机很守时，不像你。",
    "太阳还没把工位晒热，工资单也还在睡觉。",
  ],
  working: [
    "你不是在上班，你是在把时间兑换成小数点。汇率还行。",
    "发呆也计薪。这是今天最划算的发呆，请保持。",
    "键盘可以停，这列数字不会。它比你勤奋。",
    "深呼吸。吸进去的是空气，呼出来的是税前收入。",
    "老板以为你在开会，其实你在围观一个数字爬坡。",
    "这一秒买不了房，但买得起一粒芝麻。芝麻也是钱。",
    "工位是印钞机，你是那台看起来不想转、其实一直在转的齿轮。",
    "你的咖啡因正在以人民币的形式缓慢回流。请续杯。",
  ],
  after: [
    "今日份额已用完。再坐属于纯爱，本机不鼓励纯爱加班。",
    "钱不再涨了。不是机器坏了，是今天的二十一分之一用完了。",
    "你可以下班了。这个数字已经骄傲到不肯再动。",
    "加班的每一秒，在这台机器里价值为零。残酷，但是诚实。",
  ],
};

type Screen = "setup" | "live" | "result";

type Result = {
  kind: "early" | "done";
  earned: number;
  wasBefore: boolean;
};

type Saved = { salary: string; start: string; end: string };

function loadSaved(): Saved | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as Partial<Saved>;
    if (typeof data.salary !== "string") return null;
    if (typeof data.start !== "string" || parseClock(data.start) == null) return null;
    if (typeof data.end !== "string" || parseClock(data.end) == null) return null;
    return { salary: data.salary, start: data.start, end: data.end };
  } catch {
    return null;
  }
}

function saveSettings(value: Saved) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
  } catch {
    /* private mode can refuse; the session still works */
  }
}

const Ticker = memo(function Ticker({
  monthly,
  startSec,
  endSec,
}: {
  monthly: number;
  startSec: number;
  endSec: number;
}) {
  const intRef = useRef<HTMLSpanElement>(null);
  const fracRef = useRef<HTMLSpanElement>(null);
  const rootRef = useRef<HTMLParagraphElement>(null);
  const untilRef = useRef<HTMLParagraphElement>(null);

  useLayoutEffect(() => {
    let frame = 0;
    const paint = (now: Date) => {
      const snap = wageSnapshot(monthly, startSec, endSec, now);
      const parts = formatYuanParts(snap.earned, 4);
      if (intRef.current) intRef.current.textContent = parts.int;
      if (fracRef.current) fracRef.current.textContent = `.${parts.frac}`;
      if (rootRef.current) rootRef.current.dataset.earned = snap.earned.toFixed(4);
      const left = secondsUntilOff(secondsOfDay(now), startSec, endSec);
      const seconds = left <= 0 ? 0 : Math.ceil(left);
      if (untilRef.current) untilRef.current.textContent = `离下班还有${seconds}秒`;
    };
    const loop = () => {
      paint(new Date());
      frame = requestAnimationFrame(loop);
    };
    paint(new Date());
    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
  }, [monthly, startSec, endSec]);

  return (
    <>
      <p className="earned-line">今天已赚</p>
      <p className="money" ref={rootRef} data-testid="earned" aria-hidden="true">
        <span className="yen">¥</span>
        <span ref={intRef} />
        <span className="frac" ref={fracRef} />
      </p>
      <p className="until-line" ref={untilRef} data-testid="until-off">
        离下班还有0秒
      </p>
    </>
  );
});

function CountUp({ value }: { value: number }) {
  const intRef = useRef<HTMLSpanElement>(null);
  const fracRef = useRef<HTMLSpanElement>(null);

  useLayoutEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const duration = reduce ? 0 : 680;
    const started = performance.now();
    let frame = 0;
    const paint = (now: number) => {
      const progress = duration === 0 ? 1 : Math.min(1, (now - started) / duration);
      const eased = 1 - (1 - progress) ** 3;
      const parts = formatYuanParts(value * eased);
      if (intRef.current) intRef.current.textContent = parts.int;
      if (fracRef.current) fracRef.current.textContent = `.${parts.frac}`;
      if (progress < 1) frame = requestAnimationFrame(paint);
    };
    frame = requestAnimationFrame(paint);
    return () => cancelAnimationFrame(frame);
  }, [value]);

  return (
    <p className="money" aria-label={`${formatYuan(value)} 元`}>
      <span className="yen" aria-hidden="true">
        ¥
      </span>
      <span ref={intRef} aria-hidden="true" />
      <span className="frac" ref={fracRef} aria-hidden="true" />
    </p>
  );
}

function Bar({ onBack }: { onBack?: () => void }) {
  if (!onBack) return null;
  return (
    <header className="nav">
      <button type="button" className="icon-btn press" onClick={onBack} aria-label="返回">
        <ChevronLeft aria-hidden="true" />
      </button>
    </header>
  );
}

export function Encourager() {
  const [salary, setSalary] = useState("");
  const [start, setStart] = useState("10:00");
  const [end, setEnd] = useState("19:00");
  const [error, setError] = useState("");
  const [screen, setScreen] = useState<Screen>("setup");
  const [result, setResult] = useState<Result | null>(null);
  const [ask, setAsk] = useState<WageSnapshot | null>(null);
  const salaryRef = useRef<HTMLInputElement>(null);
  const startRef = useRef<HTMLInputElement>(null);
  const endRef = useRef<HTMLInputElement>(null);
  const stayRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const saved = loadSaved();
    if (saved) {
      if (salaryRef.current && salaryRef.current.value.trim() === "") {
        salaryRef.current.value = saved.salary;
      }
      if (startRef.current && saved.start) startRef.current.value = saved.start;
      if (endRef.current && saved.end) endRef.current.value = saved.end;
      setSalary(salaryRef.current?.value || saved.salary);
      setStart(startRef.current?.value || saved.start);
      setEnd(endRef.current?.value || saved.end);
    }
  }, []);

  useEffect(() => {
    if (!ask) return;
    stayRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setAsk(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [ask]);

  function fieldText(ref: RefObject<HTMLInputElement | null>, fallback: string) {
    return ref.current?.value.trim() || fallback.trim();
  }

  function encourage() {
    const salaryValue = fieldText(salaryRef, salary);
    const startValue = fieldText(startRef, start);
    const endValue = fieldText(endRef, end);
    const startParsed = parseClock(startValue);
    const endParsed = parseClock(endValue);
    const monthlyValue = parseSalary(salaryValue);
    if (salaryValue !== salary) setSalary(salaryValue);
    if (startValue !== start) setStart(startValue);
    if (endValue !== end) setEnd(endValue);
    if (startParsed == null || endParsed == null) {
      setError("时间没看懂。");
      return;
    }
    if (startParsed === endParsed) {
      setError("上下班不能是同一个点。");
      return;
    }
    if (monthlyValue == null) {
      setError("先填月薪。");
      salaryRef.current?.focus();
      return;
    }
    setError("");
    saveSettings({ salary: salaryValue, start: startValue, end: endValue });
    setResult(null);
    setScreen("live");
  }

  const monthly = parseSalary(salary);
  const startSec = parseClock(start);
  const endSec = parseClock(end);

  function leave(snapshot: WageSnapshot) {
    if (snapshot.status === "after") {
      setResult({ kind: "done", earned: snapshot.daily, wasBefore: false });
      setScreen("result");
      return;
    }
    setAsk(snapshot);
  }

  function confirmLeave() {
    if (!ask) return;
    setResult({
      kind: "early",
      earned: ask.earned,
      wasBefore: ask.status === "before",
    });
    setAsk(null);
    setScreen("result");
  }

  return (
    <div className="desk-app">
      <main className="shell" data-screen={screen} inert={ask ? true : undefined}>
        {screen === "setup" ? (
          <>
            <Bar />
            <h1 className="brand">上班鼓励器</h1>
            <form
              className="panel"
              noValidate
              autoComplete="off"
              onSubmit={(event) => {
                event.preventDefault();
                encourage();
              }}
            >
              <div className="pair">
                <label className="field-label">
                  上班
                  <input
                    ref={startRef}
                    className="field"
                    type="time"
                    step={60}
                    defaultValue={start}
                    onChange={(event) => setStart(event.target.value)}
                  />
                </label>
                <label className="field-label">
                  下班
                  <input
                    ref={endRef}
                    className="field"
                    type="time"
                    step={60}
                    defaultValue={end}
                    onChange={(event) => setEnd(event.target.value)}
                  />
                </label>
              </div>
              <label className="field-label">
                月薪
                <span className="salary-wrap">
                  <span className="yen-prefix" aria-hidden="true">
                    ¥
                  </span>
                  <input
                    ref={salaryRef}
                    className="field"
                    type="text"
                    inputMode="decimal"
                    enterKeyHint="go"
                    autoComplete="off"
                    autoCorrect="off"
                    autoCapitalize="off"
                    spellCheck={false}
                    defaultValue={salary}
                    onChange={(event) => setSalary(event.target.value)}
                    aria-label="月薪"
                  />
                </span>
              </label>
              <div className="chips" role="group" aria-label="月薪快捷填入">
                {PRESETS.map(([label, value]) => (
                  <button
                    key={value}
                    type="button"
                    className="chip press"
                    aria-pressed={salary === value}
                    onClick={() => {
                      if (salaryRef.current) salaryRef.current.value = value;
                      setSalary(value);
                      setError("");
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>
              {error ? (
                <p className="alert" role="alert">
                  {error}
                </p>
              ) : null}
              <button
                className="btn btn-primary press"
                type="button"
                onMouseDown={(event) => event.preventDefault()}
                onClick={encourage}
              >
                获取鼓励
              </button>
            </form>
          </>
        ) : null}

        {screen === "live" && monthly != null && startSec != null && endSec != null ? (
          <LiveBoard
            monthly={monthly}
            startSec={startSec}
            endSec={endSec}
            onBack={() => setScreen("setup")}
            onLeave={leave}
          />
        ) : null}

        {screen === "result" && result ? (
          <ResultBoard result={result} onBack={() => setScreen("setup")} onWatch={() => setScreen("live")} />
        ) : null}
      </main>

      {ask ? (
        <div
          className="scrim"
          onClick={(event) => {
            if (event.target === event.currentTarget) setAsk(null);
          }}
        >
          <div className="dialog" role="dialog" aria-modal="true" aria-labelledby="leave-title">
            <h2 id="leave-title">{ask.status === "before" ? "班还没上，就要走？" : "真的要提早下班吗？"}</h2>
            <div className="actions">
              <button ref={stayRef} type="button" className="btn btn-ink press" onClick={() => setAsk(null)}>
                {ask.status === "before" ? "去上班" : "再赚一会儿"}
              </button>
              <button type="button" className="btn btn-ghost press" onClick={confirmLeave}>
                确定
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function LiveBoard({
  monthly,
  startSec,
  endSec,
  onBack,
  onLeave,
}: {
  monthly: number;
  startSec: number;
  endSec: number;
  onBack: () => void;
  onLeave: (snapshot: WageSnapshot) => void;
}) {
  const [snap, setSnap] = useState(() => wageSnapshot(monthly, startSec, endSec, new Date()));
  const [quipIndex, setQuipIndex] = useState(0);
  const [announcement, setAnnouncement] = useState("");
  const announcedAt = useRef(0);

  useEffect(() => {
    const id = window.setInterval(() => {
      const next = wageSnapshot(monthly, startSec, endSec, new Date());
      setSnap(next);
      const at = Date.now();
      if (at - announcedAt.current > 10000) {
        announcedAt.current = at;
        const left = secondsUntilOff(secondsOfDay(new Date()), startSec, endSec);
        const seconds = left <= 0 ? 0 : Math.ceil(left);
        setAnnouncement(`今天已赚 ${formatYuan(next.earned, 4)} 元。离下班还有 ${seconds} 秒`);
      }
    }, 250);
    return () => window.clearInterval(id);
  }, [monthly, startSec, endSec]);

  useEffect(() => {
    const id = window.setInterval(() => setQuipIndex((index) => index + 1), 4500);
    return () => window.clearInterval(id);
  }, []);

  const quips = QUIPS[snap.status];
  const quip = quips[quipIndex % quips.length] ?? quips[0];

  return (
    <>
      <Bar onBack={onBack} />
      <h1 className="brand brand-live">上班鼓励器</h1>
      <p className="sr-only" aria-live="polite">
        {announcement}
      </p>
      <div className="receipt-wrap">
        <article className="receipt">
          <Ticker monthly={monthly} startSec={startSec} endSec={endSec} />
        </article>
      </div>
      <aside className="quip" key={`${snap.status}-${quipIndex}`}>
        <p>{quip}</p>
      </aside>
      <div className="actions">
        <button
          type="button"
          className="btn btn-primary press"
          onClick={() => onLeave(wageSnapshot(monthly, startSec, endSec, new Date()))}
        >
          我要下班
        </button>
      </div>
    </>
  );
}

function ResultBoard({
  result,
  onBack,
  onWatch,
}: {
  result: Result;
  onBack: () => void;
  onWatch: () => void;
}) {
  const stamp = result.kind === "done" ? "下班" : result.wasBefore ? "零" : "早退";

  return (
    <>
      <Bar onBack={onBack} />
      <h1 className="brand brand-live">上班鼓励器</h1>
      <div className="receipt-wrap">
        <article className="receipt">
          <div className="stamp-row">
            <CountUp value={result.earned} />
            <div className="stamp" aria-hidden="true">
              {stamp}
            </div>
          </div>
        </article>
      </div>
      <div className="actions">
        <button type="button" className="btn btn-primary press" onClick={onWatch}>
          继续看
        </button>
        <button type="button" className="btn btn-ghost press" onClick={onBack}>
          返回
        </button>
      </div>
    </>
  );
}

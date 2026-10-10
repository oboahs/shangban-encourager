const wage = require("../../utils/wage");

const STORAGE_KEY = "shangban-encourager-v1";

const QUIPS = {
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

Page({
  data: {
    screen: "setup",
    salary: "",
    start: "10:00",
    end: "19:00",
    error: "",
    presets: [
      { label: "实习魂", value: "4500" },
      { label: "普通人", value: "12000" },
      { label: "还行", value: "25000" },
      { label: "传说同事", value: "50000" },
    ],
    earnedInt: "0",
    earnedFrac: "0000",
    untilText: "离下班还有0秒",
    quip: "",
    ask: false,
    askTitle: "",
    askStay: "",
    resultInt: "0",
    resultFrac: "0000",
    stamp: "",
  },

  onLoad() {
    try {
      const saved = wx.getStorageSync(STORAGE_KEY);
      if (!saved || typeof saved !== "object") return;
      const next = {};
      if (typeof saved.salary === "string") next.salary = saved.salary;
      if (typeof saved.start === "string" && wage.parseClock(saved.start) != null) next.start = saved.start;
      if (typeof saved.end === "string" && wage.parseClock(saved.end) != null) next.end = saved.end;
      if (Object.keys(next).length) this.setData(next);
    } catch (err) {
      /* storage can be unavailable */
    }
  },

  onHide() {
    this.stopLive();
  },

  onShow() {
    if (this.data.screen === "live") this.startLive();
  },

  onUnload() {
    this.stopLive();
  },

  noop() {},

  onSalary(event) {
    this.setData({ salary: event.detail.value, error: "" });
  },

  onStart(event) {
    this.setData({ start: event.detail.value, error: "" });
  },

  onEnd(event) {
    this.setData({ end: event.detail.value, error: "" });
  },

  onPreset(event) {
    this.setData({ salary: event.currentTarget.dataset.value, error: "" });
  },

  encourage() {
    const salary = String(this.data.salary || "").trim();
    const start = this.data.start;
    const end = this.data.end;
    const startSec = wage.parseClock(start);
    const endSec = wage.parseClock(end);
    const monthly = wage.parseSalary(salary);
    if (startSec == null || endSec == null) {
      this.setData({ error: "时间没看懂。" });
      return;
    }
    if (startSec === endSec) {
      this.setData({ error: "上下班不能是同一个点。" });
      return;
    }
    if (monthly == null) {
      this.setData({ error: "先填月薪。" });
      return;
    }
    try {
      wx.setStorageSync(STORAGE_KEY, { salary, start, end });
    } catch (err) {
      /* ignore */
    }
    this.monthly = monthly;
    this.startSec = startSec;
    this.endSec = endSec;
    this.quipIndex = 0;
    this._status = "";
    this.setData({ error: "", screen: "live" });
    this.startLive();
  },

  startLive() {
    this.stopLive();
    this.paint();
    this._tick = setInterval(() => this.paint(), 80);
    this._quip = setInterval(() => this.nextQuip(), 4500);
  },

  stopLive() {
    if (this._tick) clearInterval(this._tick);
    if (this._quip) clearInterval(this._quip);
    this._tick = 0;
    this._quip = 0;
  },

  paint() {
    if (this.monthly == null || this.startSec == null || this.endSec == null) return;
    const now = new Date();
    const snap = wage.wageSnapshot(this.monthly, this.startSec, this.endSec, now);
    this._snap = snap;
    const parts = wage.formatYuanParts(snap.earned, 4);
    const left = wage.secondsUntilOff(wage.secondsOfDay(now), this.startSec, this.endSec);
    const seconds = left <= 0 ? 0 : Math.ceil(left);
    const untilText = `离下班还有${seconds}秒`;
    const patch = {};
    if (parts.int !== this.data.earnedInt) patch.earnedInt = parts.int;
    if (parts.frac !== this.data.earnedFrac) patch.earnedFrac = parts.frac;
    if (untilText !== this.data.untilText) patch.untilText = untilText;
    if (snap.status !== this._status) {
      this._status = snap.status;
      this.quipIndex = 0;
      patch.quip = QUIPS[snap.status][0];
    }
    if (Object.keys(patch).length) this.setData(patch);
  },

  nextQuip() {
    const status = this._status || "working";
    const list = QUIPS[status];
    this.quipIndex = (this.quipIndex || 0) + 1;
    this.setData({ quip: list[this.quipIndex % list.length] });
  },

  onLeave() {
    const snap = this._snap || wage.wageSnapshot(this.monthly, this.startSec, this.endSec, new Date());
    if (snap.status === "after") {
      this.showResult("done", snap.daily, false);
      return;
    }
    this.setData({
      ask: true,
      askTitle: snap.status === "before" ? "班还没上，就要走？" : "真的要提早下班吗？",
      askStay: snap.status === "before" ? "去上班" : "再赚一会儿",
    });
  },

  stay() {
    this.setData({ ask: false });
  },

  confirmLeave() {
    const snap = this._snap;
    if (!snap) return;
    this.showResult("early", snap.earned, snap.status === "before");
  },

  showResult(kind, earned, wasBefore) {
    this.stopLive();
    const stamp = kind === "done" ? "下班" : wasBefore ? "零" : "早退";
    const parts = wage.formatYuanParts(earned, 4);
    this.setData({
      ask: false,
      screen: "result",
      stamp,
      resultInt: parts.int,
      resultFrac: parts.frac,
    });
  },

  watchAgain() {
    this.setData({ screen: "live" });
    this.startLive();
  },

  back() {
    this.stopLive();
    this.setData({ screen: "setup", ask: false });
  },
});

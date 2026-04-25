import React, { useState, useEffect, useLayoutEffect, useMemo, useCallback, useRef } from "react";
import { ChevronDown, ChevronRight, Star, Activity, BarChart3, RefreshCw, Search, SlidersHorizontal, X, Layers, Zap, TrendingUp, AlertTriangle, Trophy, Landmark, Minimize2, Clock, ExternalLink, FlaskConical } from "lucide-react";
import { useReactTable, getCoreRowModel, flexRender } from "@tanstack/react-table";
import useMarketStore from "./useMarketStore";
import GlobalAlertBanner from "./GlobalAlertBanner";
import MarketBreadthMonitor from "./MarketBreadthMonitor";

// eslint-disable-next-line no-unused-vars
const MOCK_DATA = {
  last_updated: "2026-03-13",
  spy_benchmarks: { perf_1w: 1.2, perf_1m: 3.5, perf_3m: 8.2 },
  themes: [
    {
      name: "Semiconductors",
      subthemes: [
        {
          name: "AI Chips & Accelerators",
          stocks: [
            { ticker: "NVDA", company: "NVIDIA Corp", price: 142.50, change_pct: 3.21, volume: 58000000, dollar_volume: 8265000000, adr_pct: 5.1, rs_52w: 92, perf_1d: 3.21, perf_1w: 6.8, perf_1m: 12.5, perf_3m: 18.2, perf_6m: 35.1, sparkline: [118,125,121,130,128,135,138,132,140,142.5], pure_play: true },
            { ticker: "AVGO", company: "Broadcom Inc", price: 186.30, change_pct: 1.85, volume: 22000000, dollar_volume: 4098600000, adr_pct: 4.8, rs_52w: 88, perf_1d: 1.85, perf_1w: 4.2, perf_1m: 9.8, perf_3m: 22.5, perf_6m: 42.3, sparkline: [160,165,158,170,175,172,178,180,183,186.3], pure_play: false },
          ]
        },
        {
          name: "Memory & Storage",
          stocks: [
            { ticker: "TSM", company: "Taiwan Semiconductor", price: 192.80, change_pct: 1.42, volume: 18000000, dollar_volume: 3470400000, adr_pct: 4.3, rs_52w: 80, perf_1d: 1.42, perf_1w: 3.8, perf_1m: 8.5, perf_3m: 15.2, perf_6m: 24.1, sparkline: [155,160,165,168,172,175,180,185,189,192.8], pure_play: true },
            { ticker: "AMAT", company: "Applied Materials", price: 178.50, change_pct: 0.95, volume: 7200000, dollar_volume: 1285200000, adr_pct: 4.6, rs_52w: 55, perf_1d: 0.95, perf_1w: 2.1, perf_1m: 4.2, perf_3m: 5.8, perf_6m: 8.1, sparkline: [165,168,170,172,170,174,175,176,177,178.5], pure_play: false },
          ]
        }
      ]
    },
    {
      name: "Quantum Computing",
      subthemes: [
        {
          name: "Quantum Computing",
          stocks: [
            { ticker: "IONQ", company: "IonQ Inc", price: 38.50, change_pct: 6.80, volume: 18000000, dollar_volume: 693000000, adr_pct: 10.5, rs_52w: 85, perf_1d: 6.80, perf_1w: 15.2, perf_1m: 32.5, perf_3m: 68.1, perf_6m: 220.8, sparkline: [12,15,18,22,25,28,30,33,36,38.5], pure_play: true },
            { ticker: "RGTI", company: "Rigetti Computing", price: 14.20, change_pct: 8.40, volume: 35000000, dollar_volume: 497000000, adr_pct: 12.1, rs_52w: 80, perf_1d: 8.40, perf_1w: 18.5, perf_1m: 38.2, perf_3m: 78.5, perf_6m: 255.0, sparkline: [4,5,6.5,8,9,10,11,12.5,13.2,14.2], pure_play: true },
          ]
        }
      ]
    }
  ]
};

const PERF_KEYS = [
  { key: "perf_1d", label: "1D" },
  { key: "perf_1w", label: "1W" },
  { key: "perf_1m", label: "1M" },
  { key: "perf_3m", label: "3M" },
  { key: "perf_6m", label: "6M" },
];

const LB_KEYS = [
  { key: "perf_1d", label: "1D" },
  { key: "perf_1w", label: "1W" },
  { key: "perf_1m", label: "1M" },
  { key: "perf_3m", label: "3M" },
  { key: "perf_6m", label: "6M" },
];

function sparklineSeries(s) {
  if (Array.isArray(s.sparkline) && s.sparkline.length >= 2) return s.sparkline;
  if (Array.isArray(s.candles_10d) && s.candles_10d.length >= 2)
    return s.candles_10d.map((row) => row.c);
  return [];
}

const Sparkline = ({ data, width = 72, height = 26 }) => {
  if (!data || data.length < 2) return null;
  const min = Math.min(...data), max = Math.max(...data);
  const r = max - min || 1;
  const pts = data.map((v, i) => `${(i/(data.length-1))*width},${height-((v-min)/r)*(height-4)-2}`).join(" ");
  const c = data[data.length-1] >= data[0] ? "#22c55e" : "#ef4444";
  const gid = `g${Math.random().toString(36).slice(2,7)}`;
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <defs><linearGradient id={gid} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={c} stopOpacity="0.2"/><stop offset="100%" stopColor={c} stopOpacity="0"/></linearGradient></defs>
      <path d={`M0,${height} L${pts.split(" ").map(p=>p).join(" L")} L${width},${height} Z`} fill={`url(#${gid})`}/>
      <polyline points={pts} fill="none" stroke={c} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
};

const PerfCell = ({ value, ticker }) => {
  if (value == null) return <td className="text-center py-3 px-2 text-[13px] text-zinc-600">—</td>;
  const v = parseFloat(value);
  let bg, txt;
  if (v >= 20) { bg = "bg-emerald-500/30"; txt = "text-emerald-300"; }
  else if (v >= 10) { bg = "bg-emerald-500/20"; txt = "text-emerald-400"; }
  else if (v >= 5) { bg = "bg-emerald-500/10"; txt = "text-emerald-400"; }
  else if (v >= 0) { bg = "bg-emerald-500/5"; txt = "text-emerald-400/80"; }
  else if (v >= -5) { bg = "bg-red-500/5"; txt = "text-red-400/80"; }
  else if (v >= -10) { bg = "bg-red-500/10"; txt = "text-red-400"; }
  else if (v >= -20) { bg = "bg-red-500/20"; txt = "text-red-400"; }
  else { bg = "bg-red-500/30"; txt = "text-red-300"; }
  return (
    <td className="text-center py-3 px-1">
      <span
        className={`inline-block rounded-md px-2 py-1.5 text-[13px] font-mono font-medium ${txt} ${bg}`}
        {...(ticker ? { "data-chg-cell": ticker } : {})}
      >
        {v >= 0 ? "+" : ""}{v.toFixed(1)}%
      </span>
    </td>
  );
};

function getRSTrend(s) {
  const m1 = s.perf_1m, m3 = s.perf_3m;
  if (m1 == null || m3 == null) return null;
  // Compare this month vs average monthly rate over last 3 months
  return m1 > m3 / 3 ? "up" : "down";
}

const RSBadge = ({ value, trend }) => {
  let cl;
  if (value >= 80) cl = "bg-emerald-500/15 text-emerald-400 border-emerald-500/20";
  else if (value >= 60) cl = "bg-blue-500/15 text-blue-400 border-blue-500/20";
  else if (value >= 40) cl = "bg-amber-500/15 text-amber-400 border-amber-500/20";
  else cl = "bg-red-500/15 text-red-400 border-red-500/20";
  return (
    <span className="inline-flex items-center gap-0.5">
      <span className={`inline-flex items-center px-1.5 py-0.5 text-[12px] font-semibold rounded border ${cl}`}>{value}</span>
      {trend === "up"   && <span className="text-[11px] font-bold text-cyan-400" title="RS Improving">▲</span>}
      {trend === "down" && <span className="text-[11px] font-bold text-rose-400" title="RS Declining">▼</span>}
    </span>
  );
};

const fmtVol = n => n >= 1e9 ? `$${(n/1e9).toFixed(1)}B` : n >= 1e6 ? `$${(n/1e6).toFixed(0)}M` : `$${(n/1e3).toFixed(0)}K`;
const fmtNum = n => n >= 1e6 ? `${(n/1e6).toFixed(1)}M` : n >= 1e3 ? `${(n/1e3).toFixed(0)}K` : `${n}`;

const Dist52wCell = ({ value }) => {
  if (value == null) return <td className="text-center py-3 px-2 text-[13px] text-zinc-600">—</td>;
  const v = parseFloat(value);
  let txt;
  if (v >= -3) txt = "text-emerald-300 font-semibold";
  else if (v >= -8) txt = "text-emerald-400";
  else if (v >= -15) txt = "text-amber-400";
  else txt = "text-zinc-500";
  return <td className={`text-center py-3 px-2 text-[13px] font-mono ${txt}`}>{v.toFixed(1)}%</td>;
};

/* ──────────────────────────────────────────────────────── HOOKS ── */
function useHoverDelay(delay = 2000) {
  const [active, setActive] = useState(false);
  const timerRef = useRef(null);
  const onEnter = () => { timerRef.current = setTimeout(() => setActive(true), delay); };
  const onLeave = () => { clearTimeout(timerRef.current); setActive(false); };
  return { active, onEnter, onLeave };
}

const RVolCell = ({ value }) => {
  if (value == null) return <td className="text-center py-3 px-2 text-[13px] text-zinc-600">—</td>;
  const v = parseFloat(value);
  let txt;
  if (v >= 2) txt = "text-emerald-300 font-semibold";
  else if (v >= 1.5) txt = "text-emerald-400";
  else if (v >= 1) txt = "text-zinc-300";
  else txt = "text-zinc-500";
  return <td className={`text-center py-3 px-2 text-[13px] font-mono ${txt}`}>{v.toFixed(2)}x</td>;
};

/* Instant tooltip — no browser delay */
const TIP_COLORS = {
  amber:   'border-amber-500/60 text-amber-200',
  blue:    'border-blue-500/60 text-blue-200',
  emerald: 'border-emerald-500/60 text-emerald-200',
  violet:  'border-violet-500/60 text-violet-200',
  fuchsia: 'border-fuchsia-500/60 text-fuchsia-200',
  slate:   'border-slate-500/60 text-slate-200',
  zinc:    'border-zinc-700 text-zinc-200',
};
const Tip = ({ text, color = 'zinc', width = "w-56", children }) => {
  const [pos, setPos] = React.useState(null);
  const handleEnter = (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    const tipW = 224; // w-56
    const rawLeft = (r.right + 6 + tipW > window.innerWidth ? r.left - tipW - 6 : r.right + 6) - 113;
    const top = Math.max(8, r.top - 76);
    setPos({
      left:      Math.max(8, Math.min(rawLeft, window.innerWidth - tipW - 8)),
      top,
      maxHeight: window.innerHeight - top - 8,
    });
  };
  return (
    <span onMouseEnter={handleEnter} onMouseLeave={() => setPos(null)} className="cursor-pointer inline-flex">
      {children}
      {pos && (
        <span
          className={`${width} bg-zinc-900 border rounded-lg shadow-2xl px-2 py-1.5 text-[11px] leading-snug pointer-events-none ${TIP_COLORS[color] ?? TIP_COLORS.zinc}`}
          style={{ position: "fixed", zIndex: 9999, left: pos.left, top: pos.top, maxHeight: pos.maxHeight, overflowY: "auto" }}
        >
          {text}
        </span>
      )}
    </span>
  );
};

// ── Elite Badge System ──
const BADGE_CONFIG = {
  triple_crown:     { Icon: Trophy,   color: "text-amber-400",   bg: "bg-amber-500/10 border-amber-500/25",   tip: "Triple Crown: #1 Theme + ADR >5% + Pure Play",          tipColor: "amber"   },
  volatility_king:  { Icon: Zap,      color: "text-blue-400",    bg: "bg-blue-500/10 border-blue-500/25",     tip: "Volatility King: ADR in top 10% of dataset",            tipColor: "blue"    },
  liquidity_monster:{ Icon: Landmark, color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/25", tip: "Liquidity Monster: Daily Dollar Vol >$500M",          tipColor: "emerald" },
  vcp_tightening:   { Icon: Minimize2,color: "text-violet-400",  bg: "bg-violet-500/10 border-violet-500/25", tip: "VCP Tightening: <2% range last 3 days + Volume dry-up", tipColor: "violet"  },
};

const EliteBadge = ({ type }) => {
  const { Icon, color, bg, tip, tipColor } = BADGE_CONFIG[type];
  return (
    <Tip text={tip} color={tipColor}>
      <span className={`inline-flex items-center justify-center w-4 h-4 rounded border backdrop-blur-sm cursor-pointer ${bg}`}>
        <Icon size={9} className={color}/>
      </span>
    </Tip>
  );
};

const GRADE_STYLE = {
  "A+": "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
  "A":  "bg-blue-500/20 text-blue-300 border-blue-500/30",
  "B":  "bg-zinc-700/40 text-zinc-400 border-zinc-600/30",
};

const GRADE_TIP = {
  "A+": "A+ — Above all SMAs (20/50/200) + RS ≥ 90",
  "A":  "A  — Above SMA50 & SMA200 + RS ≥ 80",
  "B":  "B  — Above SMA200",
};
const GRADE_TIP_COLOR = { "A+": "emerald", "A": "blue", "B": "zinc" };
const GradeBadge = ({ grade }) => {
  if (!grade) return null;
  return <Tip text={GRADE_TIP[grade]} color={GRADE_TIP_COLOR[grade]}><span className={`inline-flex items-center px-1 py-0.5 text-[11px] font-bold rounded border backdrop-blur-sm cursor-pointer ${GRADE_STYLE[grade]}`}>{grade}</span></Tip>;
};

function isVDU(s) {
  const bars = s.bars_30d;
  if (bars && bars.length >= 10) {
    const vol10avg = bars.slice(-10, -1).reduce((sum, b) => sum + b.v, 0) / 9;
    const todayVol = bars[bars.length - 1]?.v || 0;
    return vol10avg > 0 && todayVol < vol10avg * 0.5;
  }
  return (s.rvol || 1) < 0.5;
}

function isTight(s) {
  const bars = s.bars_30d;
  if (bars && bars.length >= 3) {
    const last3 = bars.slice(-3);
    const range = (Math.max(...last3.map(b => b.h)) - Math.min(...last3.map(b => b.l))) / Math.min(...last3.map(b => b.l));
    return range < 0.015;
  }
  const sp = s.sparkline;
  if (!sp || sp.length < 3) return false;
  const last3 = sp.slice(-3);
  return (Math.max(...last3) - Math.min(...last3)) / Math.min(...last3) < 0.015;
}

function isInsideDay(s) {
  const bars = s.bars_30d;
  if (!bars || bars.length < 2) return false;
  const today = bars[bars.length - 1];
  const prev  = bars[bars.length - 2];
  return today.h <= prev.h && today.l >= prev.l;
}

function isVCPStage1(s) {
  if (s.dist_52w_high == null || s.dist_52w_high < -5) return false;
  const bars = s.bars_30d;
  if (!bars || bars.length < 10) return false;
  const avgRange = arr => arr.reduce((sum, b) => sum + (b.h - b.l) / b.l, 0) / arr.length;
  return avgRange(bars.slice(-5)) < avgRange(bars.slice(-10, -5)) * 0.8 && isVDU(s);
}

function isVCPTightening(s) {
  return isTight(s) && isVDU(s);
}

function getEliteGrade(s) {
  const sp = s.sparkline;
  const aboveSMA10 = sp && sp.length >= 5
    ? s.price > sp.reduce((a, b) => a + b, 0) / sp.length
    : null;
  const above20  = s.sma20_pct  != null ? s.sma20_pct  > 0 : null;
  const above50  = s.sma50_pct  != null ? s.sma50_pct  > 0 : null;
  const above200 = s.sma200_pct != null ? s.sma200_pct > 0 : null;
  if (s.rs_52w >= 90 && above200 && above50 && above20 && aboveSMA10) return "A+";
  if (s.rs_52w >= 80 && above200 && above50) return "A";
  if (above200) return "B";
  return null;
}

function getEliteBadges(s, { isTopTheme, isTopADR }) {
  const badges = [];
  if (isTopTheme && s.adr_pct > 5 && s.pure_play) badges.push("triple_crown");
  if (isTopADR) badges.push("volatility_king");
  if ((s.avg_dollar_volume || s.dollar_volume || 0) >= 500e6) badges.push("liquidity_monster");
  if (isVCPTightening(s)) badges.push("vcp_tightening");
  return badges;
}

// ── Helpers ──
function pearson(a, b) {
  const n = Math.min(a.length, b.length);
  if (n < 3) return 0;
  const as = a.slice(-n), bs = b.slice(-n);
  const ma = as.reduce((s, v) => s + v, 0) / n;
  const mb = bs.reduce((s, v) => s + v, 0) / n;
  let num = 0, da2 = 0, db2 = 0;
  for (let i = 0; i < n; i++) {
    const da = as[i] - ma, db = bs[i] - mb;
    num += da * db; da2 += da * da; db2 += db * db;
  }
  return da2 && db2 ? num / Math.sqrt(da2 * db2) : 0;
}

function getThemeDailyReturns(theme) {
  const norm = normalizeTheme ? normalizeTheme(theme) : theme;
  const sparklines = (norm.subthemes || []).flatMap(s => s.stocks).map(s => s.sparkline || []).filter(sp => sp.length >= 3);
  if (!sparklines.length) return [];
  const len = Math.min(...sparklines.map(sp => sp.length));
  const returns = [];
  for (let i = 1; i < len; i++) {
    const day = sparklines.map(sp => (sp[i] - sp[i-1]) / sp[i-1]);
    returns.push(day.reduce((s, v) => s + v, 0) / day.length);
  }
  return returns;
}


// ── RS vs SPY Badge ──
const RS_SPY_KEYS = [
  { key: "perf_1w", label: "1W" },
  { key: "perf_1m", label: "1M" },
  { key: "perf_3m", label: "3M" },
  { key: "perf_6m", label: "6M" },
];

const RSvsSPYBadge = ({ stockPerf, spyPerf }) => {
  if (stockPerf == null || spyPerf == null)
    return <span className="text-[11px] text-zinc-700">—</span>;
  const diff = stockPerf - spyPerf;
  if (diff > 5) return <span className="px-1 py-0.5 text-[10px] font-bold rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/20">Leader</span>;
  if (diff < -5) return <span className="px-1 py-0.5 text-[10px] font-bold rounded bg-orange-500/15 text-orange-400 border border-orange-500/20">Lagging</span>;
  return <span className="px-1 py-0.5 text-[10px] font-bold rounded bg-zinc-700/40 text-zinc-500 border border-zinc-600/30">In-Line</span>;
};

// ── Market Condition ──
// eslint-disable-next-line no-unused-vars
const MarketCondition = ({ mc }) => {
  if (!mc) return null;
  const { signal } = mc;
  const cfg = {
    green:  { dot: "bg-emerald-400", ring: "border-emerald-500/40 bg-emerald-500/8",  label: "🟢 Market Uptrend",    sub: "SPY & QQQ 站上 SMA50 & SMA200，200SMA 向上，正常執行突破單" },
    yellow: { dot: "bg-amber-400",   ring: "border-amber-500/40 bg-amber-500/8",   label: "🟡 Market Correction", sub: "SPY 或 QQQ 跌破 SMA50，暫停常規突破，只做 RS 最強的少數股票" },
    red:    { dot: "bg-red-400",     ring: "border-red-500/40 bg-red-500/8",       label: "🔴 Market Downtrend",  sub: "停止所有新倉突破單" },
  }[signal] || {};

  const fmtChg = (v) => {
    if (v == null) return "—";
    const s = `${v > 0 ? "+" : ""}${v.toFixed(2)}%`;
    return v > 0 ? <span className="text-emerald-400">{s}</span> : v < 0 ? <span className="text-red-400">{s}</span> : <span>{s}</span>;
  };
  const statusColor = (st) =>
    st === "Strong"   ? "text-emerald-400"
    : st === "Weak"   ? "text-red-500"
    : st === "Lagging"  ? "text-red-400"
    : st === "Mediocre" ? "text-yellow-400"
    : "text-zinc-400";
  // eslint-disable-next-line no-unused-vars
  const IndexTag = ({ label, d }) => (
    <span className="flex items-center gap-1">
      <span className="text-zinc-400">{label}</span>
      {d?.price != null && <span className="text-zinc-300">${d.price.toFixed(2)}</span>}
      {fmtChg(d?.change_pct)}
      {d?.index_status && <span className={`${statusColor(d.index_status)}`}>{d.index_status}</span>}
    </span>
  );
  const { adv_dec, new_hl, sma50_counts, sma200_counts } = mc;

  const BreadthCard = ({ leftLabel, leftVal, leftCount, rightLabel, rightVal, rightCount, centerLabel }) => {
    const leftPct = leftVal ?? 0;
    const rightPct = rightVal ?? 0;
    return (
      <div className="flex-1 min-w-[160px] bg-zinc-900/60 border border-zinc-700/40 rounded-lg px-3 py-2">
        <div className="flex justify-between items-baseline mb-1.5">
          <span className="text-[11px] font-semibold text-emerald-400">{leftLabel}</span>
          {centerLabel && <span className="text-[10px] text-zinc-500 font-medium">{centerLabel}</span>}
          <span className="text-[11px] font-semibold text-red-400">{rightLabel}</span>
        </div>
        <div className="flex justify-between items-baseline mb-1">
          <span className="text-[13px] font-bold text-emerald-300">{leftPct.toFixed(1)}%{leftCount != null ? ` (${leftCount})` : ""}</span>
          <span className="text-[13px] font-bold text-red-500">{rightPct.toFixed(1)}%{rightCount != null ? ` (${rightCount})` : ""}</span>
        </div>
        <div className="flex gap-0.5 h-1.5 rounded-full overflow-hidden">
          <div className="bg-emerald-500 rounded-l-full transition-all" style={{ width: `${leftPct}%` }}/>
          <div className="bg-red-500 rounded-r-full transition-all" style={{ width: `${rightPct}%` }}/>
        </div>
      </div>
    );
  };

  return (
    <div className={`mb-4 rounded-lg border ${cfg.ring}`}>
      <div className="px-4 py-2 flex flex-wrap items-center gap-3 border-b border-zinc-700/30">
        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${cfg.dot}`}/>
        <span className="text-[13px] font-semibold text-zinc-200">{cfg.label}</span>
        <span className="text-[12px] text-zinc-500 hidden sm:block">{cfg.sub}</span>
      </div>
      {(adv_dec || new_hl || sma50_counts || sma200_counts) && (
        <div className="px-3 py-2.5 flex flex-wrap gap-2">
          {adv_dec && (
            <BreadthCard
              leftLabel="Advancing" leftVal={adv_dec.adv_pct} leftCount={adv_dec.advancing}
              rightLabel="Declining" rightVal={adv_dec.dec_pct} rightCount={adv_dec.declining}
            />
          )}
          {new_hl && (
            <BreadthCard
              leftLabel="New High" leftVal={new_hl.nh_pct} leftCount={new_hl.new_high}
              rightLabel="New Low" rightVal={new_hl.nl_pct} rightCount={new_hl.new_low}
            />
          )}
          {sma50_counts && (
            <BreadthCard
              leftLabel="Above" leftVal={sma50_counts.above_pct} leftCount={sma50_counts.above}
              centerLabel="SMA50"
              rightLabel="Below" rightVal={sma50_counts.below_pct} rightCount={sma50_counts.below}
            />
          )}
          {sma200_counts && (
            <BreadthCard
              leftLabel="Above" leftVal={sma200_counts.above_pct} leftCount={sma200_counts.above}
              centerLabel="SMA200"
              rightLabel="Below" rightVal={sma200_counts.below_pct} rightCount={sma200_counts.below}
            />
          )}
        </div>
      )}
    </div>
  );
};

// ── Earnings helpers ──
function earningsDaysAway(s) {
  if (!s || s === "-") return null;
  const m = s.match(/([A-Za-z]+ \d+)/);
  if (!m) return null;
  const year = new Date().getFullYear();
  const d = new Date(`${m[1]} ${year}`);
  if (isNaN(d.getTime())) return null;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const diff = Math.round((d - today) / 86400000);
  return diff < 0 ? null : diff;
}

const EarningsCell = ({ value }) => {
  const days = earningsDaysAway(value);
  const label = value ? value.replace(/\s+(AMC|BMO|--)/i, "") : null;
  if (!label || days == null) return <td className="text-center py-3 px-2 text-[13px] text-zinc-700">—</td>;
  if (days <= 7)
    return <td className="text-center py-3 px-2"><span className="text-[11px] font-bold text-red-400 bg-red-500/15 border border-red-500/30 px-1 py-0.5 rounded">⚠ {label}</span></td>;
  if (days <= 14)
    return <td className="text-center py-3 px-2"><span className="text-[11px] font-medium text-amber-400">{label}</span></td>;
  return <td className="text-center py-3 px-2 text-[11px] text-zinc-600 font-mono">{label}</td>;
};

// ── Counter-Trend Warning ──
const CounterTrendWarning = ({ themes }) => {
  const warnings = useMemo(() => {
    const themeAvg = (t, key) => {
      const norm = normalizeThemeRaw(t);
      const vals = norm.subthemes.flatMap(s => s.stocks).map(s => s[key]).filter(v => v != null);
      return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
    };
    const ranked1d = [...themes]
      .map(t => ({ name: normalizeThemeRaw(t).name, avg1d: themeAvg(t, "perf_1d"), avg6m: themeAvg(t, "perf_6m") }))
      .filter(t => t.avg1d != null && t.avg6m != null)
      .sort((a, b) => b.avg1d - a.avg1d);
    return ranked1d.filter((t, i) => i === 0 && t.avg6m <= -15);
  }, [themes]);

  if (!warnings.length) return null;
  return (
    <div className="mb-4 px-4 py-3 bg-rose-500/10 border border-rose-500/30 rounded-lg flex items-start gap-2">
      <AlertTriangle size={13} className="text-rose-400 flex-shrink-0 mt-0.5"/>
      <div>
        <span className="text-[13px] font-semibold text-rose-400">⚠ Counter-Trend Alert</span>
        {warnings.map(t => (
          <p key={t.name} className="text-[12px] text-rose-400/70 mt-0.5">
            <span className="font-medium text-rose-400">{t.name}</span> is{" "}
            <span className="font-medium">#1 Flash Momentum today (+{t.avg1d?.toFixed(1)}%)</span> but in a{" "}
            <span className="font-medium">Structural Downtrend ({t.avg6m?.toFixed(1)}% over 6M)</span> — likely a dead-cat bounce, not a real breakout.
          </p>
        ))}
      </div>
    </div>
  );
};

// ── Correlation Guard ──
const CorrelationGuard = ({ themes }) => {
  const warning = useMemo(() => {
    const top5 = themes.slice(0, 5);
    const tr = top5.map(t => ({ name: (t.subthemes ? t : { ...t, subthemes: [{ name: t.name, stocks: t.stocks || [] }] }).name, returns: getThemeDailyReturns(t) })).filter(t => t.returns.length >= 3);
    for (let i = 0; i < tr.length; i++)
      for (let j = i + 1; j < tr.length; j++)
        for (let k = j + 1; k < tr.length; k++) {
          const len = Math.min(tr[i].returns.length, tr[j].returns.length, tr[k].returns.length);
          if (pearson(tr[i].returns.slice(-len), tr[j].returns.slice(-len)) > 0.80 &&
              pearson(tr[i].returns.slice(-len), tr[k].returns.slice(-len)) > 0.80 &&
              pearson(tr[j].returns.slice(-len), tr[k].returns.slice(-len)) > 0.80)
            return [tr[i].name, tr[j].name, tr[k].name];
        }
    return null;
  }, [themes]);

  if (!warning) return null;
  return (
    <div className="mb-4 px-4 py-3 bg-orange-500/10 border border-orange-500/30 rounded-lg flex items-start gap-2">
      <AlertTriangle size={13} className="text-orange-400 flex-shrink-0 mt-0.5"/>
      <div>
        <span className="text-[13px] font-semibold text-orange-400">Concentration Warning</span>
        <p className="text-[12px] text-orange-400/70 mt-0.5">High correlation detected. Risk concentrated in: <span className="font-medium text-orange-400">{warning.join(', ')}</span></p>
      </div>
    </div>
  );
};

function normalizeThemeRaw(t) {
  if (t.subthemes) return t;
  return { ...t, subthemes: [{ name: t.name, stocks: t.stocks || [] }] };
}

function formatSubthemeName(name) {
  const idx = name.indexOf(' - ');
  if (idx === -1) return name;
  return '- ' + name.slice(idx + 3);
}

const PerfCellLB = ({ val }) => {
  if (val == null) return <td className="px-1 py-1.5 text-center text-[11px] text-zinc-600">—</td>;
  const color = val > 0 ? 'text-emerald-400' : val < 0 ? 'text-red-400' : 'text-zinc-400';
  const bg = val > 5 ? 'bg-emerald-500/10' : val < -5 ? 'bg-red-500/10' : '';
  return (
    <td className="px-1 py-1.5 text-center">
      <span className={`inline-block rounded-md px-1 py-0.5 text-[11px] font-mono font-medium ${color} ${bg}`}>{val > 0 ? '+' : ''}{val.toFixed(1)}%</span>
    </td>
  );
};

const LB_PERF_COLS = new Set(['perf_1d','perf_1w','perf_1m','perf_3m','perf_6m']);


const IbkrGatesBadge = ({ passed }) => {
  const total = 5;
  const cls = passed === 5 ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
            : passed === 4 ? 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30'
            :                'bg-red-500/15 text-red-400 border-red-500/30';
  return (
    <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-bold rounded border font-mono ${cls}`}>
      ✓ {passed}/{total}
    </span>
  );
};

const IbkrSourceBadge = ({ source }) => {
  const isIbkr = source === 'ibkr';
  return (
    <span className={`px-1.5 py-0.5 text-[10px] font-bold rounded border font-mono ${isIbkr ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' : 'bg-zinc-700/40 text-zinc-500 border-zinc-600/40'}`}>
      {isIbkr ? 'IBKR' : 'Finviz'}
    </span>
  );
};

const ThematicSpotlight = ({ lbView, spotlightThemeName, data, ibkrThemesData }) => {
  const [hovered, setHovered] = useState(null);
  const fmtMktCap = (v) => {
    if (!v) return '—';
    if (v >= 1e12) return `$${(v/1e12).toFixed(1)}T`;
    if (v >= 1e9)  return `$${(v/1e9).toFixed(1)}B`;
    if (v >= 1e6)  return `$${(v/1e6).toFixed(0)}M`;
    return `$${v}`;
  };
  const setupCls = (label) => {
    if (label === 'Flag') return 'text-amber-400 bg-amber-500/10 border-amber-500/30';
    if (label === 'Base') return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30';
    if (label === 'Watch') return 'text-blue-400 bg-blue-500/10 border-blue-500/30';
    return 'text-zinc-500 bg-zinc-800/60 border-zinc-700/40';
  };

  const { themeName, stocks, themeRS, analysis } = useMemo(() => {
    const name = spotlightThemeName
      || (lbView === 'ibkr' ? ibkrThemesData?.power_themes?.[0]?.name : data?.themes?.[0]?.name)
      || null;
    if (!name) return { themeName: null, stocks: [], themeRS: null, analysis: null };

    // Try ibkr data first (regardless of lbView), then fall back to thematic_data
    const pt = (ibkrThemesData?.power_themes || []).find(t => t.name === name);
    if (pt) {
      return {
        themeName: name,
        stocks: (pt.leaders || []).map(l => ({ ...l, float_shares: null, short_pct: null })),
        themeRS: pt.theme_rs,
        analysis: null,
      };
    }

    const theme = (data?.themes || []).find(t => t.name === name);
    if (!theme) return { themeName: name, stocks: [], themeRS: null, analysis: null };
    const allStocks = (theme.subthemes || []).flatMap(s => s.stocks || []);
    const sorted = [...allStocks].sort((a, b) => (b.rs_52w || 0) - (a.rs_52w || 0)).slice(0, 10);
    const avgRS = sorted.length ? Math.round(sorted.reduce((s, x) => s + (x.rs_52w || 0), 0) / sorted.length) : null;
    const topAnalysis = sorted[0]?.analysis_details || sorted[0]?.reasoning || null;
    return { themeName: name, stocks: sorted, themeRS: avgRS, analysis: topAnalysis };
  }, [spotlightThemeName, lbView, data, ibkrThemesData]);

  if (!themeName) return null;

  return (
    <div className="mb-4 bg-zinc-900/60 border border-zinc-800/60 rounded-xl p-4">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-[13px] font-semibold text-emerald-400">
          ✦ Thematic Spotlight — {themeName}{themeRS != null ? ` · RS ${themeRS}` : ''}
        </span>
        {lbView === 'ibkr' && (
          <span className={`px-1.5 py-0.5 text-[10px] font-bold rounded border font-mono ${ibkrThemesData?.data_source === 'ibkr' ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/40' : 'bg-orange-500/15 text-orange-400 border-orange-500/40'}`}>
            {ibkrThemesData?.data_source === 'ibkr' ? '● LIVE' : '◐ DELAYED'}
          </span>
        )}
      </div>

      {analysis && (
        <div className="mb-3 border border-emerald-800/40 bg-emerald-900/10 rounded-lg p-3">
          <div className="flex items-center gap-1.5 mb-1.5">
            <span className="text-[10px] font-bold text-emerald-500 uppercase tracking-wider">✦ GEMINI CATALYST</span>
          </div>
          <p className="text-[12px] text-zinc-300 leading-relaxed">{analysis}</p>
        </div>
      )}

      {stocks.length > 0 ? (
        <div className="overflow-x-auto overflow-y-auto" style={{ maxHeight: '240px' }}>
          <table className="w-full text-left">
            <thead className="sticky top-0 z-10" style={{ background: '#18181b' }}>
              <tr className="border-b border-zinc-800/60">
                <th className="px-2 py-1.5 text-[11px] font-semibold text-zinc-500 uppercase tracking-wider whitespace-nowrap">Ticker</th>
                <th className="px-2 py-1.5 text-[11px] font-semibold text-zinc-500 uppercase tracking-wider text-right">Price</th>
                <th className="px-2 py-1.5 text-[11px] font-semibold text-zinc-500 uppercase tracking-wider text-right">ADR%</th>
                <th className="px-2 py-1.5 text-[11px] font-semibold text-zinc-500 uppercase tracking-wider text-right">RS</th>
                <th className="px-2 py-1.5 text-[11px] font-semibold text-zinc-500 uppercase tracking-wider text-right whitespace-nowrap">Vol Surge</th>
                <th className="px-2 py-1.5 text-[11px] font-semibold text-zinc-500 uppercase tracking-wider text-right whitespace-nowrap">Mkt Cap</th>
                <th className="px-2 py-1.5 text-[11px] font-semibold text-zinc-500 uppercase tracking-wider text-right">Float</th>
                <th className="px-2 py-1.5 text-[11px] font-semibold text-zinc-500 uppercase tracking-wider text-right">Short%</th>
                <th className="px-2 py-1.5 text-[11px] font-semibold text-zinc-500 uppercase tracking-wider text-center">Gates</th>
                <th className="px-2 py-1.5 text-[11px] font-semibold text-zinc-500 uppercase tracking-wider text-center">Setup</th>
              </tr>
            </thead>
            <tbody>
              {stocks.map(s => {
                const gp = s.gates_passed ?? 5;
                const gatesCls = gp === 5 ? 'text-emerald-400' : gp >= 4 ? 'text-yellow-400' : 'text-zinc-500';
                const rsCls = (s.rs_52w || 0) >= 85 ? 'text-emerald-400' : (s.rs_52w || 0) >= 70 ? 'text-yellow-400' : 'text-red-400';
                return (
                  <tr key={s.ticker} className="border-b border-zinc-800/20 hover:bg-zinc-800/30 transition-colors">
                    <td className="px-2 py-1.5"><span className="text-[12px] font-mono font-semibold text-blue-400 hover:text-blue-300 cursor-pointer transition-colors" onClick={e => { const rect = e.currentTarget.getBoundingClientRect(); setHovered(prev => prev?.ticker === s.ticker ? null : { ticker: s.ticker, rect }); }}>{s.ticker}</span></td>
                    <td className="px-2 py-1.5 text-[12px] font-mono text-zinc-300 text-right">{s.price ? `$${Number(s.price).toFixed(2)}` : '—'}</td>
                    <td className="px-2 py-1.5 text-[12px] font-mono text-zinc-300 text-right">{s.adr_pct ? `${Number(s.adr_pct).toFixed(1)}%` : '—'}</td>
                    <td className={`px-2 py-1.5 text-[12px] font-mono font-bold text-right ${rsCls}`}>{s.rs_52w ?? '—'}</td>
                    <td className="px-2 py-1.5 text-[12px] font-mono text-zinc-300 text-right">
                      {(s.vol_surge || s.rvol) ? `${Number(s.vol_surge || s.rvol).toFixed(1)}x` : '—'}
                    </td>
                    <td className="px-2 py-1.5 text-[12px] font-mono text-zinc-300 text-right">{fmtMktCap(s.mkt_cap)}</td>
                    <td className="px-2 py-1.5 text-[12px] font-mono text-zinc-500 text-right">{s.float_shares ? fmtMktCap(s.float_shares) : '—'}</td>
                    <td className="px-2 py-1.5 text-[12px] font-mono text-zinc-500 text-right">{s.short_pct != null ? `${Number(s.short_pct).toFixed(1)}%` : '—'}</td>
                    <td className={`px-2 py-1.5 text-[12px] font-mono font-bold text-center ${gatesCls}`}>{gp === 5 ? '✓ 5/5' : `${gp}/5`}</td>
                    <td className="px-2 py-1.5 text-center">
                      {s.setup_label
                        ? <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${setupCls(s.setup_label)}`}>{s.setup_label}</span>
                        : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="text-center py-6 text-zinc-600 text-[12px]">No stocks found for this theme</div>
      )}
      {hovered && <TVPopup ticker={hovered.ticker} anchorRect={hovered.rect} onClose={() => setHovered(null)}/>}
    </div>
  );
};

const IbkrLeaderboard = ({ ibkrThemesData, onTickerHover, onThemeSelect }) => {
  const powerThemes = ibkrThemesData?.power_themes || [];
  const isLive = ibkrThemesData?.data_source === 'ibkr';

  if (!ibkrThemesData) {
    return (
      <div className="flex items-center justify-center py-12 text-zinc-600 text-[12px]">
        IBKR themes not yet generated — run ibkr_themes.py
      </div>
    );
  }

  if (powerThemes.length === 0) {
    return (
      <div className="flex items-center justify-center py-12 text-zinc-600 text-[12px]">
        No power themes found in current scan
      </div>
    );
  }

  return (
    <div>
      {/* Data source status bar */}
      <div className="flex items-center gap-2 px-2 pb-2 border-b border-zinc-800/40 mb-1">
        <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full border font-mono ${isLive ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/40' : 'bg-orange-500/15 text-orange-400 border-orange-500/40'}`}>
          {isLive ? '● LIVE' : '◐ DELAYED'}
        </span>
        <span className="text-[10px] text-zinc-600">{ibkrThemesData.data_source} · {powerThemes.length} themes · {powerThemes.reduce((n, t) => n + t.leaders.length, 0)} leaders</span>
        {ibkrThemesData.generated_at && (
          <span className="text-[10px] text-zinc-700 ml-auto">
            {new Date(ibkrThemesData.generated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
        )}
      </div>
      <table className="w-full text-left">
        <thead style={{ position: 'sticky', top: 0, zIndex: 1, background: '#18181b' }}>
          <tr className="border-b border-zinc-800/60">
            <th className="px-2 py-2 w-6 text-[11px] text-zinc-600 select-none">#</th>
            <th className="px-2 py-2 text-[11px] font-semibold text-zinc-500 uppercase tracking-wider whitespace-nowrap">Theme</th>
            <th className="px-2 py-2 text-[11px] font-semibold text-zinc-500 uppercase tracking-wider text-center whitespace-nowrap">Leaders</th>
            <th className="px-2 py-2 w-14 text-[11px] font-semibold text-zinc-500 uppercase tracking-wider text-center">1D</th>
            <th className="px-2 py-2 w-14 text-[11px] font-semibold text-zinc-500 uppercase tracking-wider text-center">RS</th>
            <th className="px-2 py-2 w-16 text-[11px] font-semibold text-zinc-500 uppercase tracking-wider text-center">Gates</th>
            <th className="px-2 py-2 w-16 text-[11px] font-semibold text-zinc-500 uppercase tracking-wider text-center">Src</th>
          </tr>
        </thead>
        <tbody>
          {powerThemes.map((theme, i) => {
            const perf1d = theme.perf_1d;
            const perfCls = perf1d == null ? 'text-zinc-600' : perf1d > 0 ? 'text-emerald-400' : perf1d < 0 ? 'text-red-400' : 'text-zinc-500';
            const rsCls = (theme.theme_rs || 0) >= 85 ? 'text-emerald-400' : 'text-red-400';
            const leaders = theme.leaders || [];
            const topLeaders = leaders.slice(0, 3);
            // Gates: use the min gates_passed among leaders as the theme-level indicator
            const minGates = topLeaders.reduce((m, l) => Math.min(m, l.gates_passed ?? 5), 5);
            // Secondary themes: collect unique secondary themes across top leaders
            const secThemes = [...new Set(topLeaders.flatMap(l => l.secondary_themes || []))].slice(0, 3);
            // Source: theme-level is live/fallback from ibkrThemesData
            const themeSource = ibkrThemesData?.data_source || 'fallback';

            return (
              <tr key={theme.name}
                onClick={() => onThemeSelect && onThemeSelect(theme.name)}
                className={`border-b border-zinc-800/30 transition-colors cursor-pointer ${i === 0 ? 'bg-blue-500/5' : 'hover:bg-zinc-800/40'}`}>
                <td className={`px-1 py-2 text-[12px] font-bold font-mono whitespace-nowrap ${i === 0 ? 'text-blue-400' : 'text-zinc-600'}`}>{i + 1}</td>
                <td className="px-2 py-2 min-w-0">
                  <div className="text-[12px] font-semibold text-zinc-200 whitespace-nowrap">{theme.name}</div>
                  {secThemes.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-0.5">
                      {secThemes.map(s => (
                        <span key={s} className="text-[9px] text-zinc-600 bg-zinc-800/60 px-1 py-0.5 rounded leading-none">{s}</span>
                      ))}
                    </div>
                  )}
                </td>
                <td className="px-2 py-1.5">
                  <div className="flex flex-wrap gap-1">
                    {topLeaders.map(l => {
                      const setupCls = l.setup_label === 'Flag' ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
                                     : l.setup_label === 'Base' ? 'text-blue-400 bg-blue-500/10 border-blue-500/20'
                                     : l.setup_label === 'Watch' ? 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20'
                                     : 'text-zinc-500 bg-zinc-800/60 border-zinc-700/40';
                      return (
                        <span key={l.ticker}
                          className={`text-[11px] font-mono font-semibold px-1.5 py-0.5 rounded border cursor-pointer transition-colors hover:opacity-80 ${setupCls}`}
                          onClick={e => onTickerHover && onTickerHover(l.ticker, e.currentTarget.getBoundingClientRect())}>
                          {l.ticker}
                        </span>
                      );
                    })}
                  </div>
                </td>
                <td className={`px-1 py-1.5 text-center text-[11px] font-mono font-bold ${perfCls}`}>
                  {perf1d != null ? `${perf1d > 0 ? '+' : ''}${perf1d.toFixed(1)}%` : '—'}
                </td>
                <td className={`px-1 py-1.5 text-center text-[11px] font-mono font-bold ${rsCls}`}>
                  {theme.theme_rs != null ? Math.round(theme.theme_rs) : '—'}
                </td>
                <td className="px-1 py-1.5 text-center">
                  <IbkrGatesBadge passed={minGates} />
                </td>
                <td className="px-1 py-1.5 text-center">
                  <IbkrSourceBadge source={themeSource} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

const ThemeHeatmap = ({ themes, finvizThemeRankings }) => {
  const heatData = useMemo(() => {
    const rankings = finvizThemeRankings || [];
    if (rankings.length === 0) {
      // fallback: compute from themes data
      return (themes || []).map(t => {
        const norm = t.subthemes ? t : { ...t, subthemes: [{ stocks: t.stocks || [] }] };
        const stocks = norm.subthemes.flatMap(s => s.stocks);
        const vals = stocks.map(s => s.perf_1d).filter(v => v != null);
        const avg1d = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
        return { name: norm.name, perf_1d: avg1d };
      });
    }
    return rankings.map(r => ({ name: r.name, perf_1d: r.perf_1d }));
  }, [themes, finvizThemeRankings]);

  const { topBottom, hasEnough } = useMemo(() => {
    const withVal = heatData.filter(h => h.perf_1d != null);
    const sorted = [...withVal].sort((a, b) => (b.perf_1d ?? -99) - (a.perf_1d ?? -99));
    if (sorted.length <= 10) return { topBottom: sorted, hasEnough: false };
    const top5 = sorted.slice(0, 5);
    const bottom5 = sorted.slice(-5);
    return { topBottom: [...top5, ...bottom5], hasEnough: true };
  }, [heatData]);

  const getColor = (v) => {
    if (v == null) return { bg: 'bg-zinc-800/60', text: 'text-zinc-500' };
    if (v >= 3)  return { bg: 'bg-emerald-500/60', text: 'text-emerald-100' };
    if (v >= 1.5) return { bg: 'bg-emerald-500/40', text: 'text-emerald-200' };
    if (v >= 0.5) return { bg: 'bg-emerald-500/25', text: 'text-emerald-300' };
    if (v >= 0)   return { bg: 'bg-emerald-500/12', text: 'text-emerald-400' };
    if (v >= -0.5) return { bg: 'bg-red-500/12', text: 'text-red-400' };
    if (v >= -1.5) return { bg: 'bg-red-500/25', text: 'text-red-300' };
    if (v >= -3)  return { bg: 'bg-red-500/40', text: 'text-red-200' };
    return { bg: 'bg-red-500/60', text: 'text-red-100' };
  };

  if (!topBottom.length) return null;

  return (
    <div className="mb-3 bg-zinc-900/40 border border-zinc-800/50 rounded-xl p-3">
      <div className="flex items-center justify-between mb-2">
        <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-[0.18em]">
          Theme Heatmap — 1D RS Performance
        </div>
        {hasEnough && (
          <div className="text-[9px] text-zinc-600 uppercase tracking-wider">Top 5 · Bottom 5</div>
        )}
      </div>
      <div className="grid gap-1" style={{ gridTemplateColumns: 'repeat(5, 1fr)' }}>
        {topBottom.map((item, idx) => {
          const { bg, text } = getColor(item.perf_1d);
          return (
            <div key={`${item.name}-${idx}`} className={`rounded-lg p-2 ${bg} text-center`}>
              <div className={`text-[11px] font-semibold leading-tight truncate ${text}`}>{item.name}</div>
              <div className={`text-[12px] font-bold font-mono mt-0.5 ${text}`}>
                {item.perf_1d != null ? `${item.perf_1d >= 0 ? '+' : ''}${item.perf_1d.toFixed(1)}%` : '—'}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const SubThemeStocksModal = ({ subthemeName, stocks, onClose }) => {
  const sorted = useMemo(() => [...stocks].sort((a, b) => (b.rs_52w ?? 0) - (a.rs_52w ?? 0)), [stocks]);
  const [hovered, setHovered] = useState(null); // { ticker, rect }

  useEffect(() => {
    const handler = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[9998] flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="relative w-full max-w-2xl max-h-[80vh] bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800 shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-zinc-100">{subthemeName}</span>
            <span className="text-xs text-zinc-500 bg-zinc-800 px-1.5 py-0.5 rounded">{sorted.length} stocks · sorted by RS</span>
          </div>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-300 transition-colors p-1 rounded hover:bg-zinc-800">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M1 1l12 12M13 1L1 13" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>
          </button>
        </div>
        {/* Table */}
        <div className="overflow-y-auto flex-1 px-2 py-1">
          <table className="w-full border-collapse text-left text-xs">
            <thead className="sticky top-0 bg-zinc-900 z-10">
              <tr className="border-b border-zinc-800 text-zinc-500">
                <th className="w-8 py-2 pr-2 text-right font-medium">#</th>
                <th className="px-2 py-2 font-medium">Ticker</th>
                <th className="px-2 py-2 font-medium">Company</th>
                <th className="px-2 py-2 font-medium text-right">RS</th>
                <th className="px-2 py-2 font-medium text-right">ADR%</th>
                <th className="px-2 py-2 font-medium text-right">$ Vol</th>
                <th className="px-2 py-2 font-medium text-right">1D Change%</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((s, i) => {
                const rsCls = s.rs_52w >= 90 ? "text-emerald-300" : s.rs_52w >= 70 ? "text-emerald-400" : s.rs_52w >= 50 ? "text-zinc-300" : "text-red-400";
                const chgCls = (s.change_pct ?? 0) > 0 ? "text-emerald-400" : (s.change_pct ?? 0) < 0 ? "text-red-400" : "text-zinc-400";
                const fmtVol = (v) => { if (v == null) return "—"; if (v >= 1e9) return `$${(v/1e9).toFixed(1)}B`; if (v >= 1e6) return `$${(v/1e6).toFixed(0)}M`; return `$${(v/1e3).toFixed(0)}K`; };
                const fmtPct = (v) => v == null ? "—" : `${v > 0 ? "+" : ""}${v.toFixed(2)}%`;
                return (
                  <tr key={s.ticker} className="border-b border-zinc-800/50 hover:bg-zinc-800/30 cursor-pointer"
                    onClick={e => {
                      const rect = e.currentTarget.getBoundingClientRect();
                      setHovered(h => h?.ticker === s.ticker ? null : { ticker: s.ticker, rect });
                    }}>
                    <td className="py-1.5 pr-2 text-right font-mono text-zinc-600">{i + 1}</td>
                    <td className="px-2 py-1.5 font-mono font-semibold text-cyan-400">{s.ticker}</td>
                    <td className="px-2 py-1.5 text-zinc-300 max-w-[180px] truncate">{s.company || "—"}</td>
                    <td className={`px-2 py-1.5 text-right font-mono font-bold ${rsCls}`}>{s.rs_52w ?? "—"}</td>
                    <td className="px-2 py-1.5 text-right font-mono text-zinc-300">{s.adr_pct != null ? `${s.adr_pct.toFixed(1)}%` : "—"}</td>
                    <td className="px-2 py-1.5 text-right font-mono text-zinc-400">{fmtVol(s.dollar_volume)}</td>
                    <td className={`px-2 py-1.5 text-right font-mono font-semibold ${chgCls}`}>{fmtPct(s.change_pct)}</td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t border-zinc-700 text-zinc-600 text-xs">
                <td colSpan={7} className="py-1.5 pr-2 text-right font-mono">{sorted.length} stocks</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
      {hovered && <TVPopup ticker={hovered.ticker} anchorRect={hovered.rect} onClose={() => setHovered(null)}/>}
    </div>
  );
};

const RS_MODES = [
  { key: '1d',  label: '1D',  perfKey: 'perf_1d',  spyKey: null       },
  { key: '1w',  label: '1W',  perfKey: 'perf_1w',  spyKey: 'perf_1w'  },
  { key: '1m',  label: '1M',  perfKey: 'perf_1m',  spyKey: 'perf_1m'  },
  { key: '3m',  label: '3M',  perfKey: 'perf_3m',  spyKey: 'perf_3m'  },
  { key: '6m',  label: '6M',  perfKey: 'perf_6m',  spyKey: 'perf_6m'  },
  { key: '52w', label: '52W', perfKey: 'rs_52w',   spyKey: null       },
];

const Leaderboard = ({ themeRankings, industryRankings, finvizThemeRankings, themes = [], themeSparklines = {}, ibkrThemesData, spyBenchmarks, onViewChange, onThemeSelect }) => {
  const [sortPriority, setSortPriority] = useState([{ key: 'rs_score', direction: 'desc' }]);
  const [expanded, setExpanded] = useState(null);
  const [view, setView] = useState("themes"); // "themes" (Finviz map) or "industry"
  const [themeHover, setThemeHover] = useState(null); // { ticker, rect }
  const [themeStats, setThemeStats] = useState(null); // { themeName, anchorRect }
  const [subThemeModal, setSubThemeModal] = useState(null); // { subthemeName, stocks }
  const [rsMode, setRsMode] = useState('52w');

  const activeData = view === "themes" ? finvizThemeRankings : themeRankings;

  const handleLBSort = (key, isShift) => {
    if (isShift) {
      const primary = sortPriority[0];
      if (primary && LB_PERF_COLS.has(primary.key) && LB_PERF_COLS.has(key)) return;
      setSortPriority(prev => {
        const existing = prev.findIndex((p, i) => i > 0 && p.key === key);
        if (existing > 0) return prev.map((p, i) => i === existing ? { ...p, direction: p.direction === 'desc' ? 'asc' : 'desc' } : p);
        return [prev[0], { key, direction: 'desc' }];
      });
    } else {
      setSortPriority(prev => {
        const cur = prev.find(p => p.key === key);
        if (cur && prev[0].key === key) return [{ key, direction: cur.direction === 'desc' ? 'asc' : 'desc' }, ...prev.slice(1)];
        return [{ key, direction: 'desc' }];
      });
    }
  };

  const primaryKey = sortPriority[0]?.key;
  const secondaryKey = sortPriority[1]?.key;

  // Build theme name → avg rs_52w map from actual stock data
  const themeAvgRS = useMemo(() => {
    const map = {};
    const mode = RS_MODES.find(m => m.key === rsMode) ?? RS_MODES[RS_MODES.length - 1];
    const spyVal = mode.spyKey ? (spyBenchmarks?.[mode.spyKey] ?? null) : null;
    for (const theme of (themes || [])) {
      const norm = normalizeTheme(theme);
      const stocks = norm.subthemes.flatMap(s => s.stocks);
      if (rsMode === '52w') {
        const vals = stocks.map(s => s.rs_52w).filter(v => v != null);
        map[norm.name.toLowerCase()] = vals.length ? Math.round(vals.reduce((a, v) => a + v, 0) / vals.length) : null;
      } else {
        const vals = stocks.map(s => s[mode.perfKey]).filter(v => v != null);
        if (!vals.length) { map[norm.name.toLowerCase()] = null; continue; }
        const avg = vals.reduce((a, v) => a + v, 0) / vals.length;
        map[norm.name.toLowerCase()] = spyVal != null ? Math.round((avg - spyVal) * 10) / 10 : Math.round(avg * 10) / 10;
      }
    }
    return map;
  }, [themes, rsMode, spyBenchmarks]);

  const ranked = useMemo(() => {
    if (!activeData || !activeData.length) return [];
    return [...activeData].sort((a, b) => {
      for (let i = 0; i < sortPriority.length; i++) {
        const { key, direction } = sortPriority[i];
        let va = key === 'rs_score' ? (themeAvgRS[a.name?.toLowerCase()] ?? 0) : (a[key] ?? 0);
        let vb = key === 'rs_score' ? (themeAvgRS[b.name?.toLowerCase()] ?? 0) : (b[key] ?? 0);
        if (i === 0 && LB_PERF_COLS.has(key)) {
          va = Math.round(va * 10) / 10;
          vb = Math.round(vb * 10) / 10;
        }
        if (va === vb) continue;
        const cmp = va > vb ? 1 : -1;
        return direction === 'desc' ? -cmp : cmp;
      }
      return 0;
    });
  }, [activeData, sortPriority, themeAvgRS]);


  const industryMap = useMemo(() => {
    if (!industryRankings) return {};
    const m = {};
    for (const ind of industryRankings) {
      const p = ind.parent_theme;
      if (!m[p]) m[p] = [];
      m[p].push(ind);
    }
    for (const k of Object.keys(m)) {
      m[k].sort((a, b) => {
        const sa = (a.perf_1w||0)*0.2 + (a.perf_1m||0)*0.3 + (a.perf_3m||0)*0.3 + (a.perf_6m||0)*0.2;
        const sb = (b.perf_1w||0)*0.2 + (b.perf_1m||0)*0.3 + (b.perf_3m||0)*0.3 + (b.perf_6m||0)*0.2;
        return sb - sa;
      });
    }
    return m;
  }, [industryRankings]);

  const LBSortHeader = ({ k, label, w }) => {
    const priIdx = sortPriority.findIndex(p => p.key === k);
    const isActive = priIdx >= 0;
    const dir = isActive ? sortPriority[priIdx].direction : null;
    const isPrimary = priIdx === 0;
    const isSecondary = priIdx === 1;
    const isBlocked = LB_PERF_COLS.has(k) && LB_PERF_COLS.has(primaryKey) && !isPrimary;
    return (
      <th onClick={e => handleLBSort(k, e.shiftKey)}
        className={`px-1 py-2 text-center cursor-pointer select-none ${w || 'w-12'} ${isActive ? (isPrimary ? 'text-blue-400' : 'text-violet-400') : isBlocked ? 'text-zinc-700' : 'text-zinc-500 hover:text-zinc-300'}`}>
        <span className="inline-flex items-center justify-center gap-0.5 text-[11px] font-semibold uppercase tracking-wider">
          {label}
          {isPrimary   && <span className="text-[9px] text-blue-400/70">①{dir === 'desc' ? '▼' : '▲'}</span>}
          {isSecondary && <span className="text-[9px] text-violet-400/70">②{dir === 'desc' ? '▼' : '▲'}</span>}
        </span>
      </th>
    );
  };

  return (
    <>
    <div className="p-4 bg-zinc-900/60 rounded-xl border border-zinc-800/60 w-full min-w-0">
      <div className="flex items-center mb-3 gap-2">
        <BarChart3 size={13} className="text-blue-400 flex-shrink-0"/>
        <span className="text-[13px] font-semibold text-zinc-300 whitespace-nowrap">Theme Leaderboard</span>
        <span className="text-[11px] text-zinc-600">Top 5 of {ranked.length} themes</span>
        {secondaryKey && (
          <button onClick={() => setSortPriority([{ key: 'rs_score', direction: 'desc' }])}
            className="text-[10px] text-zinc-600 hover:text-zinc-400 px-1.5 py-0.5 border border-zinc-700/50 rounded transition-colors">
            ✕ Reset
          </button>
        )}
        <div className="flex-1"></div>
        <div className="flex bg-zinc-800/60 rounded-lg p-0.5 border border-zinc-700/40 flex-shrink-0">
          {[{k:"themes",l:"Themes Map"},{k:"industry",l:"Industry"},{k:"ibkr",l:"IBKR Power"}].map(v => (
            <button key={v.k} onClick={() => { setView(v.k); setExpanded(null); onViewChange && onViewChange(v.k); }}
              className={`px-2.5 py-1 text-[11px] font-medium rounded-md transition-all flex items-center gap-1 ${view === v.k ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' : 'text-zinc-500 hover:text-zinc-300 border border-transparent'}`}>
              {v.l}
              {v.k === "ibkr" && (
                ibkrThemesData?.data_source === "ibkr"
                  ? <span className="px-1 py-0.5 text-[9px] font-bold rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 leading-none">LIVE</span>
                  : <span className="px-1 py-0.5 text-[9px] font-bold rounded bg-orange-500/20 text-orange-400 border border-orange-500/30 leading-none">DELAYED</span>
              )}
            </button>
          ))}
        </div>
      </div>
      <div className="overflow-y-auto overflow-x-auto" style={{ maxHeight: '497px' }}>
        {view === "ibkr" ? (
          <IbkrLeaderboard
            ibkrThemesData={ibkrThemesData}
            onTickerHover={(ticker, rect) => setThemeHover(prev => prev?.ticker === ticker ? null : { ticker, rect })}
            onThemeSelect={onThemeSelect}
          />
        ) : (
        <table className="w-full text-left">
          <thead style={{ position: 'sticky', top: 0, zIndex: 1, background: '#18181b' }}>
            <tr className="border-b border-zinc-800/60">
              <th className="px-2 py-2 w-6 text-[11px] text-zinc-600 select-none whitespace-nowrap">#</th>
              <th className="px-2 py-2 text-[11px] font-semibold text-zinc-500 uppercase tracking-wider whitespace-nowrap">Theme</th>
              {view === "themes" && (
                <>
                  <th className="px-2 py-2 text-[11px] font-semibold text-zinc-500 uppercase tracking-wider whitespace-nowrap">Sub-Themes</th>
                  <th className="px-2 py-2 text-[11px] font-semibold text-zinc-500 uppercase tracking-wider whitespace-nowrap">Leaders</th>
                </>
              )}
              {LB_KEYS.map(k => <LBSortHeader key={k.key} k={k.key} label={k.label} />)}
              <th onClick={e => handleLBSort('rs_score', e.shiftKey)}
                className={`px-1 py-2 text-center cursor-pointer select-none w-14 ${sortPriority[0]?.key === 'rs_score' ? 'text-blue-400' : 'text-zinc-500 hover:text-zinc-300'}`}>
                <div className="flex flex-col items-center gap-0.5">
                  <span className="inline-flex items-center gap-0.5 text-[11px] font-semibold uppercase tracking-wider">
                    RS
                    {sortPriority[0]?.key === 'rs_score' && <span className="text-[9px] text-blue-400/70">①{sortPriority[0].direction === 'desc' ? '▼' : '▲'}</span>}
                  </span>
                  <div className="flex gap-0.5" onClick={e => e.stopPropagation()}>
                    {RS_MODES.map(m => (
                      <button key={m.key}
                        onClick={() => { setRsMode(m.key); setSortPriority([{ key: 'rs_score', direction: 'desc' }]); }}
                        className={`text-[8px] px-0.5 py-px rounded leading-none transition-colors ${rsMode === m.key ? 'bg-blue-500/30 text-blue-300' : 'text-zinc-600 hover:text-zinc-400'}`}>
                        {m.label}
                      </button>
                    ))}
                  </div>
                </div>
              </th>
              {view === "themes" && (
                <th className="px-2 py-2 text-[11px] font-semibold text-zinc-500 uppercase tracking-wider whitespace-nowrap text-center">Source</th>
              )}
            </tr>
          </thead>
          <tbody>
            {ranked.slice(0, 5).map((t, i) => {
              const isIndustryView = view === "industry";
              const isExpanded = isIndustryView && expanded === t.name;
              const industries = isIndustryView ? (industryMap[t.name] || []) : [];

              // Sub-themes & leaders for themes view
              let subThemeNames = [];
              let leaderTickers = [];
              let hasIbkrSource = false;
              if (view === "themes") {
                const matchedTheme = themes.find(th => (th.name || '').toLowerCase() === (t.name || '').toLowerCase());
                if (matchedTheme) {
                  subThemeNames = (matchedTheme.subthemes || []).slice(0, 3).map(s => s.name);
                }
                const ibkrPT = ibkrThemesData?.power_themes?.find(pt => pt.name?.toLowerCase() === t.name?.toLowerCase());
                if (ibkrPT) {
                  hasIbkrSource = true;
                  leaderTickers = (ibkrPT.leaders || []).slice(0, 3).map(l => ({ ticker: l.ticker, setupCls: l.setup_label === 'Flag' ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' : l.setup_label === 'Base' ? 'text-blue-400 bg-blue-500/10 border-blue-500/20' : 'text-zinc-400 bg-zinc-800/60 border-zinc-700/40' }));
                } else if (matchedTheme) {
                  const allStocks = (matchedTheme.subthemes || []).flatMap(s => s.stocks || []);
                  leaderTickers = [...allStocks].sort((a, b) => (b.rs_52w || 0) - (a.rs_52w || 0)).slice(0, 3).map(s => ({ ticker: s.ticker, setupCls: 'text-zinc-400 bg-zinc-800/60 border-zinc-700/40' }));
                }
              }

              return (<React.Fragment key={`lb-${t.name}`}>
                <tr
                  onClick={e => {
                    if (isIndustryView) { setExpanded(isExpanded ? null : t.name); return; }
                    onThemeSelect && onThemeSelect(t.name);
                  }}
                  className={`border-b border-zinc-800/30 transition-colors cursor-pointer ${i === 0 ? 'bg-blue-500/5' : 'hover:bg-zinc-800/40'}`}>
                  <td className={`px-1 py-2 text-[12px] font-bold font-mono whitespace-nowrap ${i === 0 ? 'text-blue-400' : 'text-zinc-600'}`}>{i + 1}</td>
                  <td className="px-2 py-2">
                    <div className="flex items-center gap-1.5">
                      <span
                        className="text-[12px] font-semibold text-zinc-200 hover:text-blue-400 transition-colors cursor-pointer"
                        onClick={e => {
                          e.stopPropagation();
                          const row = e.currentTarget.closest('tr');
                          const rect = row ? row.getBoundingClientRect() : e.currentTarget.getBoundingClientRect();
                          const sameTheme = themeStats?.themeName === t.name;
                          if (sameTheme) {
                            setThemeStats(null);
                            setThemeHover(null);
                          } else {
                            setThemeStats({ themeName: t.name, anchorRect: rect });
                            const etf = THEME_ETF_MAP[t.name];
                            if (etf) {
                              // Pin the chart's left edge flush to the right side of the
                              // clicked theme name — the stats popup will stack directly
                              // BELOW the chart so they never overlap.
                              const zoomVal = parseFloat(getComputedStyle(document.body).zoom) || 1;
                              const nameRight = e.currentTarget.getBoundingClientRect().right;
                              const pinLeft = nameRight / zoomVal + 8;
                              setThemeHover({ ticker: etf, rect: {
                                left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom,
                                width: rect.width, height: rect.height, pinLeft,
                              }});
                            } else {
                              setThemeHover(null);
                            }
                          }
                          onThemeSelect && onThemeSelect(t.name);
                        }}
                      >{t.name}</span>
                      {t.stage2_momentum && <span className="px-1.5 py-0.5 text-[9px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-full leading-none">STAGE 2</span>}
                      {t.n_industries && <span className="text-[10px] text-zinc-600">{t.n_industries} ind</span>}
                    </div>
                  </td>
                  {view === "themes" && (
                    <>
                      <td className="px-2 py-1.5 min-w-[120px]">
                        <div className="text-[11px] text-zinc-400 leading-tight flex flex-wrap gap-x-1 gap-y-0.5">
                          {subThemeNames.length === 0
                            ? <span className="text-zinc-600">—</span>
                            : subThemeNames.map((sn, si) => {
                                const matchedTheme = themes.find(th => (th.name || '').toLowerCase() === (t.name || '').toLowerCase());
                                const subObj = matchedTheme?.subthemes?.find(s => s.name === sn);
                                return (
                                  <React.Fragment key={sn}>
                                    {si > 0 && <span className="text-zinc-700">·</span>}
                                    <button
                                      className="hover:text-blue-400 hover:underline transition-colors cursor-pointer"
                                      onClick={e => {
                                        e.stopPropagation();
                                        if (subObj) setSubThemeModal({ subthemeName: sn, stocks: subObj.stocks || [] });
                                      }}
                                    >{sn}</button>
                                  </React.Fragment>
                                );
                              })
                          }
                        </div>
                      </td>
                      <td className="px-2 py-1.5">
                        <div className="flex flex-wrap gap-1">
                          {leaderTickers.map(l => (
                            <span key={l.ticker} className={`text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded border ${l.setupCls}`}>{l.ticker}</span>
                          ))}
                          {leaderTickers.length === 0 && <span className="text-zinc-600 text-[11px]">—</span>}
                        </div>
                      </td>
                    </>
                  )}
                  {LB_KEYS.map(k => <PerfCellLB key={k.key} val={t[k.key]}/>)}
                  {(() => {
                    const rsVal = themeAvgRS[t.name?.toLowerCase()];
                    const cls = rsVal == null ? 'text-zinc-600'
                      : rsMode === '52w' ? (rsVal >= 85 ? 'text-emerald-400' : 'text-red-400')
                      : (rsVal > 0 ? 'text-emerald-400' : rsVal < 0 ? 'text-red-400' : 'text-zinc-400');
                    const display = rsVal == null ? '—'
                      : rsMode === '52w' ? rsVal
                      : (rsVal > 0 ? `+${rsVal}` : `${rsVal}`);
                    return <td className={`px-1 py-1.5 text-center text-[11px] font-mono font-bold ${cls}`}>{display}</td>;
                  })()}
                  {view === "themes" && (
                    <td className="px-1 py-1.5 text-center">
                      <IbkrSourceBadge source={hasIbkrSource ? 'ibkr' : 'fallback'} />
                    </td>
                  )}
                </tr>
                {isExpanded && industries.map(ind => (
                  <tr key={ind.name} className="bg-zinc-800/20 border-b border-zinc-800/20">
                    <td className="px-2 py-1.5"></td>
                    <td className="px-2 py-1.5 pl-4 whitespace-nowrap">
                      <span className="text-[11px] text-zinc-400">{ind.name}</span>
                    </td>
                    {LB_KEYS.map(k => <PerfCellLB key={k.key} val={ind[k.key]}/>)}
                    <td className="px-2 py-1.5"></td>
                  </tr>
                ))}
              </React.Fragment>);
            })}
          </tbody>
        </table>
        )}
      </div>
    </div>
    {themeHover && <TVPopup ticker={themeHover.ticker} anchorRect={themeHover.rect} onClose={() => { setThemeHover(null); setThemeStats(null); }}/>}
    {themeStats && <ThemeStatsPopup themeName={themeStats.themeName} themes={themes} anchorRect={themeStats.anchorRect} chartAnchor={themeHover?.rect} onClose={() => { setThemeStats(null); setThemeHover(null); }}/>}
    {subThemeModal && <SubThemeStocksModal subthemeName={subThemeModal.subthemeName} stocks={subThemeModal.stocks} onClose={() => setSubThemeModal(null)}/>}
    </>
  );
};

function computeTVPopupRect(anchorRect, opts = {}) {
  if (!anchorRect) return null;
  const MAX_W = 600, MAX_H = 200;
  // Inline styles (left/width/top/height) live in pre-zoom CSS px, while
  // getBoundingClientRect / window.innerWidth report visual (post-zoom) px when
  // body { zoom: N } is in effect. Convert everything to pre-zoom CSS px so
  // all the math below stays in one coordinate space.
  const zoom = parseFloat(getComputedStyle(document.body).zoom) || 1;
  const vw = window.innerWidth / zoom;
  const vh = window.innerHeight / zoom;
  const aLeft   = anchorRect.left   / zoom;
  const aRight  = anchorRect.right  / zoom;
  const aTop    = anchorRect.top    / zoom;
  const aWidth  = anchorRect.width  / zoom;
  const edgeX = 8, edgeBot = 8;
  const navEl = document.getElementById("app-navbar");
  const edgeTop = navEl ? (navEl.getBoundingClientRect().bottom / zoom + 8) : 110;
  const forceRight = opts.forceRight || anchorRect.forceRight;
  const pinRight = opts.pinRight ?? anchorRect.pinRight; // CSS x to align chart's right edge to
  const pinLeft = opts.pinLeft ?? anchorRect.pinLeft;   // CSS x to align chart's left edge to
  let W, H, left;
  if (pinLeft != null) {
    // Pin chart's left edge to a specific x (used to flush popup against the theme name text)
    W = MAX_W; H = MAX_H;
    left = pinLeft;
  } else if (pinRight != null) {
    // Pin chart's right edge to a specific x (used to flush popup against the theme leaderboard's right edge)
    W = MAX_W; H = MAX_H;
    left = pinRight - W;
  } else if (forceRight) {
    // Pin chart to the right edge of the viewport (used when stacking with stats popup)
    W = MAX_W; H = MAX_H;
    left = vw - W - edgeX;
  } else {
    const anchorCenterX = aLeft + aWidth / 2;
    const useLeft = anchorCenterX > vw / 2;
    if (useLeft) {
      // panelLeft captured at hover time (most reliable — avoids render-time layout issues)
      const panelLeftRaw = anchorRect.panelLeft != null
        ? anchorRect.panelLeft
        : (document.getElementById("search-result-panel")?.getBoundingClientRect().left ?? anchorRect.left);
      const panelLeft = panelLeftRaw / zoom;
      const maxRight = panelLeft - 20;         // chart right edge stays 20px left of panel
      W = Math.max(220, Math.min(MAX_W, maxRight - edgeX));
      H = Math.round(W * MAX_H / MAX_W);
      left = Math.max(edgeX, maxRight - W);
    } else {
      W = MAX_W; H = MAX_H;
      left = Math.min(aRight + 4, vw - W - edgeX);
      left = Math.max(edgeX, left);
    }
  }
  // When pinLeft is set (leaderboard click that also opens the stats popup),
  // pin the chart to the top of the content area so the stats popup can stack
  // directly beneath it without overflowing the viewport.
  let top;
  if (pinLeft != null) {
    top = edgeTop;
  } else {
    top = aTop;
    top = Math.max(edgeTop, Math.min(top, vh - H - edgeBot));
  }
  return { left, top, width: W, height: H };
}

const TVPopup = ({ ticker, anchorRect, chartUrl, onClose }) => {
  const [topAdj, setTopAdj] = React.useState(0);
  const chartRef = React.useRef(null);
  const rect = computeTVPopupRect(anchorRect);

  // After render, measure actual position and clamp to viewport using real getBoundingClientRect
  // This is zoom-agnostic: getBoundingClientRect always returns true visual coordinates.
  React.useLayoutEffect(() => {
    if (!chartRef.current) return;
    const el = chartRef.current;
    const bounding = el.getBoundingClientRect();
    const overflow = bounding.bottom - (window.innerHeight - 8);
    setTopAdj(overflow > 0 ? -overflow : 0);
  }, [rect?.top, rect?.height]);

  if (!ticker || !anchorRect || !rect) return null;
  const { left, top, width: W, height: H } = rect;
  const src = chartUrl || `https://finviz.com/chart.ashx?t=${encodeURIComponent(ticker)}&ty=c&ta=1&p=d&s=l`;
  return (
    <>
      {onClose && <div style={{ position:"fixed", inset:0, zIndex:9998 }} onClick={onClose}/>}
      <div ref={chartRef} id="tv-popup-chart" style={{ position:"fixed", left, top: top + topAdj, width:W, height:H, zIndex:9999, borderRadius:8, overflow:"hidden", border:"1px solid #27272a", boxShadow:"0 24px 64px rgba(0,0,0,0.85)", pointerEvents:"none", background:"#fff" }}>
        <img src={src} alt={ticker} referrerPolicy="no-referrer" style={{ width:"100%", height:"100%", objectFit:"fill", display:"block" }}/>
      </div>
    </>
  );
};

const ThemeStatsPopup = ({ themeName, themes, anchorRect, chartAnchor, onClose }) => {
  const stocks = useMemo(() => {
    if (!themeName || !themes) return [];
    const theme = themes.find(t => normalizeTheme(t).name.toLowerCase() === themeName.toLowerCase());
    if (!theme) return [];
    const norm = normalizeTheme(theme);
    const all = norm.subthemes.flatMap(s => s.stocks);
    const seen = new Set();
    return all.filter(s => { if (seen.has(s.ticker)) return false; seen.add(s.ticker); return true; });
  }, [themeName, themes]);

  const mean = (arr) => arr.length ? arr.reduce((a, v) => a + v, 0) / arr.length : 0;
  const avgPrice  = mean(stocks.map(s => s.price).filter(v => v != null));
  const avg1m     = mean(stocks.map(s => s.perf_1m).filter(v => v != null));
  const avgRS     = Math.round(mean(stocks.map(s => s.rs_52w).filter(v => v != null)));
  const avg1d     = mean(stocks.map(s => s.perf_1d).filter(v => v != null));
  const sorted    = [...stocks].sort((a, b) => (b.perf_1d ?? 0) - (a.perf_1d ?? 0));
  const best      = sorted.filter(s => (s.perf_1d ?? 0) > 0).slice(0, 3);
  const worst     = sorted.filter(s => (s.perf_1d ?? 0) < 0).slice(-3).reverse();

  const popupRef = useRef(null);
  const [stacked, setStacked] = useState(null); // { top, left } in CSS px (matches chart popup's inline coords)

  // When the chart popup is also open, place this popup directly BELOW the chart
  // (chart on top, stats data beneath) with a small gap so the two never overlap.
  // All math is done in pre-zoom CSS px (same coord space as the inline left/top
  // styles we set below). When body { zoom: N } is in effect, getBoundingClientRect
  // and innerWidth/innerHeight report visual (post-zoom) px, so we divide by zoom.
  useLayoutEffect(() => {
    if (!chartAnchor || !popupRef.current) { setStacked(null); return; }
    const chartEl = document.getElementById("tv-popup-chart");
    if (!chartEl) { setStacked(null); return; }
    const zoom = parseFloat(getComputedStyle(document.body).zoom) || 1;
    const chartBoundV = chartEl.getBoundingClientRect();
    const popupBoundV = popupRef.current.getBoundingClientRect();
    const chartLeft   = chartBoundV.left   / zoom;
    const chartBottom = chartBoundV.bottom / zoom;
    const popupW = popupBoundV.width  / zoom;
    const popupH = popupBoundV.height / zoom;
    const gap = 8;
    const edgeX = 8;
    const navEl = document.getElementById("app-navbar");
    const minTop = navEl ? (navEl.getBoundingClientRect().bottom / zoom + gap) : 80;
    const vw = window.innerWidth  / zoom;
    const vh = window.innerHeight / zoom;

    // Align the stats popup's left edge with the chart's left edge (keeps them
    // in the same column). Place it directly below the chart's bottom edge.
    let desiredLeft = chartLeft;
    let desiredTop  = chartBottom + gap;

    // Clamp vertically to the viewport — if it doesn't fit below, fall back to
    // placing above. This should rarely happen unless the chart sits near the
    // bottom of the viewport.
    if (desiredTop + popupH > vh - 8) {
      const aboveTop = (chartBoundV.top / zoom) - gap - popupH;
      if (aboveTop >= minTop) {
        desiredTop = aboveTop;
      } else {
        desiredTop = Math.max(minTop, vh - popupH - 8);
      }
    }
    // Clamp horizontally inside the viewport.
    desiredLeft = Math.max(edgeX, Math.min(desiredLeft, vw - popupW - edgeX));
    setStacked({ top: Math.max(8, desiredTop), left: Math.max(8, desiredLeft) });
  }, [chartAnchor, themeName, stocks.length]);

  if (!anchorRect) return null;
  const MAX_W = 420, EDGE = 12;
  // Inline styles below are pre-zoom CSS px; convert visual-px sources to match.
  const zoom = parseFloat(getComputedStyle(document.body).zoom) || 1;
  const vw = window.innerWidth  / zoom;
  const vh = window.innerHeight / zoom;
  const aLeft  = anchorRect.left  / zoom;
  const aRight = anchorRect.right / zoom;
  const aTop   = anchorRect.top   / zoom;
  const navEl = document.getElementById("app-navbar");
  const edgeTop = navEl ? navEl.getBoundingClientRect().bottom / zoom + 8 : 72;

  let left;
  if (stacked) {
    left = stacked.left;
  } else {
    const spaceRight = vw - aRight - EDGE;
    const spaceLeft  = aLeft - EDGE;
    if (spaceRight >= MAX_W) {
      left = aRight + 8;
    } else if (spaceLeft >= MAX_W) {
      left = aLeft - MAX_W - 8;
    } else {
      left = Math.max(EDGE, Math.min(aLeft, vw - MAX_W - EDGE));
    }
  }
  const top = stacked
    ? stacked.top
    : Math.max(edgeTop, Math.min(aTop, vh - EDGE - 300));

  const rsColor = avgRS >= 70 ? 'text-emerald-400' : avgRS >= 50 ? 'text-yellow-400' : 'text-red-400';
  const perfColor = (v) => v >= 0 ? 'text-emerald-400' : 'text-red-400';
  const fmt = (v) => `${v >= 0 ? '+' : ''}${v.toFixed(1)}%`;

  // Use an all-sided shadow when placed next to the chart so it doesn't paint a
  // dark band onto the chart on whichever side they're adjacent.
  const popupShadow = stacked
    ? '0 0 32px rgba(0,0,0,0.7)'
    : '0 24px 64px rgba(0,0,0,0.85)';

  return (
    <>
      <div style={{ position:'fixed', inset:0, zIndex:9998 }} onClick={onClose}/>
      <div ref={popupRef} style={{ position:'fixed', left, top, width:MAX_W, zIndex:9999, borderRadius:10, border:'1px solid rgba(63,63,70,0.7)', boxShadow:popupShadow, background:'#18181b', overflow:'hidden' }}
        onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div style={{ background: avg1d >= 0 ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.12)', borderBottom:'1px solid rgba(63,63,70,0.5)' }}
          className="px-4 py-3 flex items-start justify-between gap-2">
          <div>
            <div className="text-[13px] font-bold text-zinc-100 leading-tight">{themeName}</div>
            <div className={`text-[18px] font-bold font-mono mt-0.5 ${avg1d >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {avg1d >= 0 ? '▲' : '▼'} {fmt(avg1d)}
            </div>
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-[11px] text-zinc-500 bg-zinc-800 px-2 py-0.5 rounded font-mono">{stocks.length} stocks</span>
            <button onClick={onClose} className="text-zinc-500 hover:text-zinc-300 transition-colors"><X size={14}/></button>
          </div>
        </div>
        {/* Stats row */}
        <div className="grid grid-cols-3 divide-x divide-zinc-700/50 border-b border-zinc-700/50">
          {[
            { label:'AVG PRICE',   val:`$${avgPrice.toFixed(2)}`,          cls:'text-zinc-200' },
            { label:'AVG 1-MONTH', val:fmt(avg1m),                         cls:perfColor(avg1m) },
            { label:'AVG RS',      val:String(avgRS || '—'),                cls:rsColor },
          ].map(({ label, val, cls }) => (
            <div key={label} className="px-3 py-2.5 text-center">
              <div className="text-[9px] font-semibold text-zinc-500 uppercase tracking-widest mb-1">{label}</div>
              <div className={`text-[15px] font-bold font-mono ${cls}`}>{val}</div>
            </div>
          ))}
        </div>
        {/* Movers */}
        <div className="px-4 py-3 border-b border-zinc-700/50">
          <div className="text-[10px] font-semibold text-zinc-500 uppercase tracking-widest mb-2">TODAY'S MOVERS</div>
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-2">
              <TrendingUp size={11} className="text-emerald-400 flex-shrink-0"/>
              <span className="text-[11px] text-zinc-500 w-9 flex-shrink-0">Best</span>
              <div className="flex gap-1.5 flex-wrap">
                {best.length ? best.map(s => (
                  <span key={s.ticker} className="text-[11px] font-mono font-semibold text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded">
                    {s.ticker} {fmt(s.perf_1d)}
                  </span>
                )) : <span className="text-[11px] text-zinc-600">—</span>}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <TrendingUp size={11} className="text-red-400 flex-shrink-0 rotate-180"/>
              <span className="text-[11px] text-zinc-500 w-9 flex-shrink-0">Worst</span>
              <div className="flex gap-1.5 flex-wrap">
                {worst.length ? worst.map(s => (
                  <span key={s.ticker} className="text-[11px] font-mono font-semibold text-red-400 bg-red-500/10 px-1.5 py-0.5 rounded">
                    {s.ticker} {fmt(s.perf_1d)}
                  </span>
                )) : <span className="text-[11px] text-zinc-600">—</span>}
              </div>
            </div>
          </div>
        </div>
        {/* Ticker pills */}
        <div className="px-4 py-3">
          <div className="flex flex-wrap gap-1.5">
            {stocks.map(s => (
              <span key={s.ticker} className="text-[11px] font-mono px-2 py-0.5 bg-zinc-700/60 text-zinc-300 rounded cursor-default hover:bg-zinc-600/60 transition-colors">
                {s.ticker}
              </span>
            ))}
          </div>
        </div>
      </div>
    </>
  );
};

// ── MagicSort constants ──
const SORT_PERF_COLS = new Set(['perf_1d','perf_1w','perf_1m','perf_3m','perf_6m']);
const SORT_TECH_COLS = new Set(['rs_52w','rvol','avg_dollar_volume','adr_pct','dist_52w_high','volume','price','52w_high','ticker']);

function getAlphaGrade(s, spyPerf1d = 0) {
  const rs = s.rs_52w || 0;
  if (rs > 97 && (s.perf_1m||0) > 0 && (s.perf_1d||0) > 0) return 'A+';
  if (rs > 95 && (s.perf_1m||0) > 0) return 'A';
  if (rs > 90 || (s.perf_1d||0) > spyPerf1d) return 'B';
  return null;
}

// Returns true if stock "fits" a given sort key (used for dynamic badge)
function fitsSortKey(stock, key) {
  if (SORT_PERF_COLS.has(key)) return (stock[key] || 0) > 0;
  if (key === 'rs_52w') return (stock.rs_52w || 0) > 95;
  return true;
}

const AlphaLeaderBadge = ({ stock, sortPriority = [], spyPerf1d = 0 }) => {
  const grade = getAlphaGrade(stock, spyPerf1d);
  if (!grade || grade === 'B') return null;
  if ((stock.perf_1d||0) <= 0) return null;
  // Dynamic: must fit the current top-2 sort priorities
  const fits = sortPriority.slice(0, 2).every(p => fitsSortKey(stock, p.key));
  if (!fits) return null;
  const style = grade === 'A+'
    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
    : 'bg-blue-500/20 text-blue-300 border-blue-500/40';
  return <span className={`inline-flex items-center gap-0.5 px-1 py-0.5 text-[10px] font-bold rounded border ${style}`}>🔥 {grade}</span>;
};

const StockTable = ({ stocks, spyPerf, rsSPYKey, isTopTheme, topADRTickers, themeName, subthemeName }) => {
  const [hovered, setHovered] = useState(null);
  const [sortPriority, setSortPriority] = useState([{ key: 'rs_52w', direction: 'desc' }]);

  const handleSort = (key, isShift) => {
    if (isShift) {
      const primary = sortPriority[0];
      if (primary && SORT_PERF_COLS.has(primary.key) && SORT_PERF_COLS.has(key)) return;
      setSortPriority(prev => {
        const existing = prev.findIndex((p, i) => i > 0 && p.key === key);
        if (existing > 0) {
          return prev.map((p, i) => i === existing ? { ...p, direction: p.direction === 'desc' ? 'asc' : 'desc' } : p);
        }
        return [prev[0], { key, direction: 'desc' }];
      });
    } else {
      setSortPriority(prev => {
        const cur = prev.find(p => p.key === key);
        if (cur && prev[0].key === key) {
          return [{ key, direction: cur.direction === 'desc' ? 'asc' : 'desc' }, ...prev.slice(1)];
        }
        return [{ key, direction: 'desc' }];
      });
    }
  };

  const sorted = useMemo(() => {
    const withVsSpy = stocks.map(s => ({
      ...s,
      vs_spy: spyPerf != null ? (s[rsSPYKey] ?? 0) - spyPerf : null,
    }));
    return [...withVsSpy].sort((a, b) => {
      for (let i = 0; i < sortPriority.length; i++) {
        const { key, direction } = sortPriority[i];
        let va = key === 'ticker' ? (a.ticker||'') : (a[key]||0);
        let vb = key === 'ticker' ? (b.ticker||'') : (b[key]||0);
        // Bucketing: round to 1 decimal for performance cols when primary sort
        if (i === 0 && SORT_PERF_COLS.has(key)) {
          va = Math.round(va * 10) / 10;
          vb = Math.round(vb * 10) / 10;
        }
        if (va === vb) continue;
        const cmp = key === 'ticker' ? va.localeCompare(vb) : (va > vb ? 1 : -1);
        return direction === 'desc' ? -cmp : cmp;
      }
      return 0;
    });
  }, [stocks, sortPriority]);

  const primaryKey = sortPriority[0]?.key;
  const secondaryKey = sortPriority[1]?.key;

  const SH = ({ k, label, align = "center", w }) => {
    const priIdx = sortPriority.findIndex(p => p.key === k);
    const isActive = priIdx >= 0;
    const dir = isActive ? sortPriority[priIdx].direction : null;
    const isPrimary = priIdx === 0;
    const isSecondary = priIdx === 1;
    const isBlocked = SORT_PERF_COLS.has(k) && SORT_PERF_COLS.has(primaryKey) && !isPrimary;
    return (
      <th onClick={e => handleSort(k, e.shiftKey)}
        className={`py-3 px-2 font-medium cursor-pointer select-none hover:text-zinc-300 transition-colors text-${align} ${w || ''} ${isActive ? (isPrimary ? 'text-blue-400' : 'text-violet-400') : isBlocked ? 'text-zinc-700' : 'text-zinc-500'}`}>
        <span className="inline-flex items-center gap-0.5">
          {label}
          {isPrimary && <span className="text-[9px] text-blue-400/70 ml-0.5">①{dir === 'desc' ? '▼' : '▲'}</span>}
          {isSecondary && <span className="text-[9px] text-violet-400/70 ml-0.5">②{dir === 'desc' ? '▼' : '▲'}</span>}
        </span>
      </th>
    );
  };

  return (
    <>
    {secondaryKey && (
      <div className="flex items-center gap-2 mb-1">
        <span className="text-[11px] text-zinc-500">
          <span className="text-blue-400">①{primaryKey}</span>
          {' → '}<span className="text-violet-400">②{secondaryKey}</span>
        </span>
        <button onClick={() => setSortPriority([{ key: 'rs_52w', direction: 'desc' }])} className="text-[10px] text-zinc-600 hover:text-zinc-400 px-1.5 py-0.5 border border-zinc-700/50 rounded transition-colors">✕ Reset</button>
      </div>
    )}
    <div className="overflow-x-auto overflow-y-auto rounded-lg border border-zinc-700/40" style={{maxHeight:'520px'}}>
      <table className="w-full text-sm table-fixed min-w-[1280px]">
        <thead className="sticky top-0 z-10">
          <tr className="text-[12px] uppercase tracking-wider bg-zinc-900">
            <th className="text-left py-3 px-4 font-medium w-[160px] text-zinc-500">Ticker</th>
            <SH k="price" label="Price" w="w-[80px]"/>
            {PERF_KEYS.map(p => <SH key={p.key} k={p.key} label={p.label} w="w-[64px]"/>)}
            <th className="text-center py-3 px-2 font-medium w-[84px] text-zinc-500">Earnings</th>
            <th className="text-center py-3 px-2 font-medium w-[84px] text-zinc-500">6M</th>
            <SH k="52w_high" label="52W Hi" w="w-[80px]"/>
            <SH k="52w_low" label="52W Lo" w="w-[80px]"/>
            <SH k="dist_52w_high" label="Dist" w="w-[64px]"/>
            <SH k="volume" label="Vol" w="w-[68px]"/>
            <SH k="rvol" label="RVol" w="w-[64px]"/>
            <SH k="avg_dollar_volume" label="Avg $V" w="w-[72px]"/>
            <SH k="adr_pct" label="ADR" w="w-[56px]"/>
            <SH k="rs_52w" label="RS" align="center" w="w-[60px]"/>
            <SH k="vs_spy" label="vs SPY" w="w-[84px]"/>
          </tr>
        </thead>
        <tbody>
          {sorted.map((s, i) => (
            <tr key={s.ticker+i} className="border-t border-zinc-800/50 hover:bg-zinc-800/30 transition-colors">
              <td className="py-3 px-4">
                <div className="flex items-center gap-2">
                  {s.pure_play
                    ? <Tip text="Pure Play — appears in only one sub-theme" color="amber"><Star size={11} className="text-amber-400 fill-amber-400 flex-shrink-0 cursor-pointer"/></Tip>
                    : <Tip text="Legacy Leader — appears across multiple sub-themes" color="zinc"><TrendingUp size={11} className="text-zinc-600 flex-shrink-0 cursor-pointer"/></Tip>}
                  <div>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span
                        className="font-semibold text-zinc-100 text-[13px] cursor-pointer hover:text-blue-400 transition-colors"
                        onClick={e => { const rect = e.currentTarget.getBoundingClientRect(); setHovered(prev => prev?.ticker === s.ticker ? null : { ticker: s.ticker, rect }); }}
                      >{s.ticker}</span>
                      <GradeBadge grade={getEliteGrade(s)}/>
                      <AlphaLeaderBadge stock={s} sortPriority={sortPriority} spyPerf1d={spyPerf || 0}/>
                      {isVCPStage1(s) && <Tip text="Narrowing consolidation + VDU + near 52W high" color="violet"><span className="text-[10px] font-bold text-violet-400 bg-violet-500/15 border border-violet-500/30 px-1 py-0.5 rounded cursor-pointer">🎯 VCP S1</span></Tip>}
                      {!isVCPStage1(s) && isVDU(s) && <Tip text="Volume below 50% of 10-day avg — selling pressure exhausted" color="blue"><span className="text-[10px] font-bold text-blue-400 bg-blue-500/15 border border-blue-500/30 px-1 py-0.5 rounded cursor-pointer">VDU</span></Tip>}
                      {isTight(s) && <Tip text="Last 3 days range < 1.5% — extremely tight" color="fuchsia"><span className="text-[10px] font-bold text-fuchsia-400 bg-fuchsia-500/15 border border-fuchsia-500/30 px-1 py-0.5 rounded cursor-pointer">Tight</span></Tip>}
                      {isInsideDay(s) && <Tip text="Today's range inside yesterday's range" color="slate"><span className="text-[10px] font-bold text-slate-400 bg-slate-500/15 border border-slate-500/30 px-1 py-0.5 rounded cursor-pointer">ID</span></Tip>}
                      <span className="hidden sm:flex items-center gap-0.5">
                        {getEliteBadges(s, { isTopTheme, isTopADR: topADRTickers?.has(s.ticker) }).map(b => <EliteBadge key={b} type={b}/>)}
                      </span>
                    </div>
                    <p className="text-[11px] text-zinc-500 leading-tight truncate max-w-[160px]">{s.company}</p>
                  </div>
                </div>
              </td>
              <td className="text-center py-3 px-2 font-mono text-zinc-200 text-[13px]" data-price-cell={s.ticker}>${s.price.toFixed(2)}</td>
              {PERF_KEYS.map(p => <PerfCell key={p.key} value={s[p.key]} ticker={p.key === 'perf_1d' ? s.ticker : undefined}/>)}
              <EarningsCell value={s.earnings}/>
              <td className="text-center py-3 px-2"><div className="flex justify-center"><Sparkline data={sparklineSeries(s)}/></div></td>
              <td className="text-center py-3 px-2 font-mono text-zinc-400 text-[13px]">{s["52w_high"] ? `$${s["52w_high"].toFixed(2)}` : "—"}</td>
              <td className="text-center py-3 px-2 font-mono text-zinc-500 text-[13px]">{s["52w_low"] ? `$${s["52w_low"].toFixed(2)}` : "—"}</td>
              <Dist52wCell value={s.dist_52w_high}/>
              <td className="text-center py-3 px-2 text-zinc-500 text-[13px] font-mono">{fmtNum(s.volume)}</td>
              <RVolCell value={s.rvol}/>
              <td className="text-center py-3 px-2 text-zinc-500 text-[13px] font-mono">{fmtVol(s.avg_dollar_volume || s.dollar_volume)}</td>
              <td className="text-center py-3 px-2 text-zinc-400 text-[13px] font-mono">{s.adr_pct.toFixed(1)}%</td>
              <td className="text-center py-3 px-2"><RSBadge value={s.rs_52w} trend={getRSTrend(s)}/></td>
              <td className="text-center py-3 px-2"><RSvsSPYBadge stockPerf={s[rsSPYKey]} spyPerf={spyPerf}/></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
    {hovered && <TVPopup ticker={hovered.ticker} anchorRect={hovered.rect} onClose={() => setHovered(null)}/>}
    </>
  );
};

function normalizeTheme(t) {
  if (t.subthemes) return t;
  return { ...t, subthemes: [{ name: t.name, stocks: t.stocks || [] }] };
}

const SubThemeSection = ({ subtheme, parentAvg, lbPerfKey, spyPerf, rsSPYKey, isTopTheme, topADRTickers, themeName }) => {
  const [open, setOpen] = useState(false);
  const avg = (k) => subtheme.stocks.length
    ? subtheme.stocks.reduce((s, x) => s + (x[k] || 0), 0) / subtheme.stocks.length
    : 0;
  const subAvg = avg(lbPerfKey);
  const hasDivergence = parentAvg != null && subAvg > parentAvg + 3;

  return (
    <div className="ml-4 mb-2">
      <button onClick={() => setOpen(!open)} className="w-full flex items-center justify-between px-3 py-2 bg-zinc-800/40 hover:bg-zinc-800/60 rounded-md border border-zinc-700/30 transition-colors">
        <div className="flex items-center gap-2">
          {open ? <ChevronDown size={12} className="text-zinc-500"/> : <ChevronRight size={12} className="text-zinc-500"/>}
          <span className="text-[13px] font-medium text-zinc-300">{formatSubthemeName(subtheme.name)}</span>
          <span className="text-[11px] text-zinc-600 bg-zinc-700/30 px-1.5 py-0.5 rounded">{subtheme.stocks.length}</span>
          {hasDivergence && (
            <span className="flex items-center gap-0.5 px-1.5 py-0.5 bg-yellow-500/15 border border-yellow-500/30 rounded text-[11px] text-yellow-400 font-medium">
              <Zap size={9} className="fill-yellow-400"/> +{(subAvg - parentAvg).toFixed(1)}%
            </span>
          )}
        </div>
        <div className="flex items-center gap-2.5 text-[11px]">
          {PERF_KEYS.map(p => {
            const v = avg(p.key);
            return (
              <span key={p.key} className="hidden lg:flex items-center gap-1">
                <span className="text-zinc-600">{p.label}</span>
                <span className={`font-mono font-medium ${v >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{v >= 0 ? '+' : ''}{v.toFixed(1)}%</span>
              </span>
            );
          })}
        </div>
      </button>
      {open && (
        <div className="mt-1">
          <StockTable stocks={subtheme.stocks} spyPerf={spyPerf} rsSPYKey={rsSPYKey} isTopTheme={isTopTheme} topADRTickers={topADRTickers} themeName={themeName} subthemeName={subtheme.name}/>
        </div>
      )}
    </div>
  );
};

const ThemeSection = ({ theme, lbPerfKey, spyPerf, rsSPYKey, isTopTheme, topADRTickers, themeRankings, finvizThemeRankings }) => {
  const [open, setOpen] = useState(false);
  const norm = normalizeTheme(theme);
  const allStocks = norm.subthemes.flatMap(s => s.stocks);

  const avg = (k) => allStocks.length
    ? allStocks.reduce((s, x) => s + (x[k] || 0), 0) / allStocks.length
    : 0;

  // Look up ranking data for this theme (use finviz first, fallback to theme_rankings)
  const rankingEntry = useMemo(() => {
    const name = norm.name.toLowerCase();
    const search = (arr) => arr?.find(r => r.name?.toLowerCase() === name);
    return search(finvizThemeRankings) || search(themeRankings) || null;
  }, [norm.name, finvizThemeRankings, themeRankings]);

  const perfVal = (key) => rankingEntry ? (rankingEntry[key] ?? null) : avg(key);
  const rsVal = avg("rs_52w");
  const parentAvg = rankingEntry ? (rankingEntry[lbPerfKey] ?? avg(lbPerfKey)) : avg(lbPerfKey);

  return (
    <div className="mb-4">
      <button onClick={() => setOpen(!open)} className="w-full flex items-center justify-between px-4 py-2.5 bg-zinc-800/60 hover:bg-zinc-800/80 rounded-lg border border-zinc-700/50 transition-colors">
        <div className="flex items-center gap-3">
          {open ? <ChevronDown size={14} className="text-zinc-400"/> : <ChevronRight size={14} className="text-zinc-400"/>}
          <Layers size={13} className="text-blue-400"/>
          <span className="font-semibold text-sm text-zinc-100">{norm.name}</span>
          <span className="text-[12px] text-zinc-500 bg-zinc-700/40 px-1.5 py-0.5 rounded">
            {norm.subthemes.length} sub · {allStocks.length} stocks
          </span>
          {allStocks.length > 0 && (
            <span
              title="Open Finviz MultiChart"
              onClick={e => { e.stopPropagation(); const tickers = [...new Set(allStocks.map(s => s.ticker))]; window.open(`https://finviz.com/screener.ashx?v=340&t=${tickers.join(',')}`, '_blank'); }}
              className="px-2 py-0.5 text-[11px] font-semibold bg-zinc-700/50 text-zinc-400 hover:bg-blue-500/20 hover:text-blue-400 border border-zinc-600/30 hover:border-blue-500/30 rounded cursor-pointer transition-all"
            >MultiChart</span>
          )}
        </div>
        <div className="flex items-center gap-3 text-[12px]">
          {PERF_KEYS.map(p => {
            const v = perfVal(p.key);
            if (v == null) return null;
            return (
              <span key={p.key} className="hidden lg:flex items-center gap-1">
                <span className="text-zinc-600">{p.label}</span>
                <span className={`font-mono font-medium ${v >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{v >= 0 ? '+' : ''}{v.toFixed(1)}%</span>
              </span>
            );
          })}
          <span className="text-zinc-500">RS <span className="text-zinc-300 font-medium">{rsVal.toFixed(0)}</span></span>
        </div>
      </button>
      {open && (
        <div className="mt-1.5 space-y-1.5">
          {norm.subthemes.map((sub, i) => (
            <SubThemeSection key={sub.name + i} subtheme={sub} parentAvg={parentAvg} lbPerfKey={lbPerfKey} spyPerf={spyPerf} rsSPYKey={rsSPYKey} isTopTheme={isTopTheme} topADRTickers={topADRTickers} themeName={norm.name}/>
          ))}
        </div>
      )}
    </div>
  );
};

// ── Gapper Filter Input ──
const FInput = ({ label, value, onChange, hint }) => {
  const [local, setLocal] = useState(String(value));
  // Sync when parent resets (e.g. Reset button)
  useEffect(() => { setLocal(String(value)); }, [value]);
  return (
    <div className="flex flex-col gap-1 min-w-0">
      <label className="text-[11px] text-zinc-500 whitespace-nowrap">{label}</label>
      <input
        type="number"
        value={local}
        onChange={e => {
          setLocal(e.target.value);
          const n = parseFloat(e.target.value);
          if (!isNaN(n)) onChange(n);
        }}
        className="w-full px-2 py-1.5 text-[13px] font-mono bg-zinc-900 border border-zinc-700/60 rounded text-zinc-200 focus:outline-none focus:border-blue-500/50"
      />
      <span className="text-[11px] text-zinc-600 h-3">{hint || ""}</span>
    </div>
  );
};

// ── Gapper Scanner UI ──
const fmtCap = n => n >= 1e12 ? `$${(n/1e12).toFixed(1)}T` : n >= 1e9 ? `$${(n/1e9).toFixed(1)}B` : `$${(n/1e6).toFixed(0)}M`;

const POS_WORDS = new Set(["beat","beats","beating","surpassed","exceeded","surpassing","exceeding","raised","raise","above","approved","approval","strong","won","outperformed","record"]);
const NEG_WORDS = new Set(["miss","missed","missing","below","decline","declined","declining","cut","weak","rejected","rejection","loss","fell","failed","disappointing","missed"]);

const renderStyledText = (text) => {
  if (!text) return null;
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      const inner = part.slice(2, -2);
      const lower = inner.toLowerCase().trim();
      const isPos = POS_WORDS.has(lower) || [...POS_WORDS].some(w => lower.includes(w));
      const isNeg = NEG_WORDS.has(lower) || [...NEG_WORDS].some(w => lower.includes(w));
      const cls = isPos ? "text-emerald-400 font-semibold" : isNeg ? "text-red-400 font-semibold" : "text-zinc-200 font-semibold";
      return <strong key={i} className={cls}>{inner}</strong>;
    }
    return <span key={i}>{part}</span>;
  });
};

const AnalysisCell = ({ text }) => {
  const [expanded, setExpanded] = useState(false);
  if (!text) return <span className="text-zinc-600 text-[12px]">—</span>;
  const sections = text.split(/\n\n(?=•)/).map(s => s.trim()).filter(Boolean);
  const visible = expanded ? sections : sections.slice(0, 1);
  return (
    <div className="text-[12px] leading-relaxed min-w-0 max-w-full">
      {visible.map((sec, i) => {
        const nl = sec.indexOf("\n");
        const header = nl > -1 ? sec.slice(0, nl) : sec;
        const body   = nl > -1 ? sec.slice(nl + 1) : "";
        return (
          <div key={i} className={i > 0 ? "mt-2 pt-2 border-t border-zinc-800/60" : ""}>
            <div className="text-zinc-200 font-medium mb-0.5">{renderStyledText(header)}</div>
            {body && <div className="text-zinc-400">{renderStyledText(body)}</div>}
          </div>
        );
      })}
      {sections.length > 1 && (
        <button
          onClick={e => { e.stopPropagation(); setExpanded(x => !x); }}
          className="mt-2 flex items-center justify-center w-5 h-5 rounded-full border border-zinc-600/60 text-zinc-500 hover:border-zinc-400 hover:text-zinc-300 transition-colors text-[11px] font-bold"
        >
          {expanded ? "−" : "+"}
        </button>
      )}
    </div>
  );
};

const CATEGORY_STYLE = {
  "Earnings":                 "bg-emerald-500/15 text-emerald-400 border-emerald-500/25",
  "New Contract/Partnership": "bg-blue-500/15 text-blue-400 border-blue-500/25",
  "Thematic Narratives":      "bg-violet-500/15 text-violet-400 border-violet-500/25",
  "Government Policy":        "bg-amber-500/15 text-amber-400 border-amber-500/25",
  "Institutional Buying":     "bg-cyan-500/15 text-cyan-400 border-cyan-500/25",
  "Insider Buying":           "bg-fuchsia-500/15 text-fuchsia-400 border-fuchsia-500/25",
  "Upgrade":                  "bg-zinc-700/40 text-zinc-400 border-zinc-600/30",
  "FDA":                      "bg-rose-500/15 text-rose-400 border-rose-500/25",
  "Others":                   "bg-zinc-700/40 text-zinc-500 border-zinc-600/30",
};

// eslint-disable-next-line no-unused-vars
const ConvictionBar = ({ value }) => {
  const color = value >= 70 ? "bg-emerald-500" : value >= 50 ? "bg-amber-500" : "bg-rose-500";
  return (
    <div className="flex items-center gap-1.5">
      <div className="w-16 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${value}%` }}/>
      </div>
      <span className="text-[11px] font-mono text-zinc-400">{value}%</span>
    </div>
  );
};

const gradeStyle = (g) => {
  if (g === "A+") return "text-emerald-300 border-emerald-500/40 bg-emerald-500/10";
  if (g === "A")  return "text-blue-300 border-blue-500/40 bg-blue-500/10";
  if (g === "B")  return "text-zinc-400 border-zinc-600/40 bg-zinc-700/20";
  return "text-red-400 border-red-500/40 bg-red-500/10";
};

const VerificationBadge = ({ verification, headlines }) => {
  const [tooltipPos, setTooltipPos] = useState(null);
  if (!verification) return null;
  const { status, confidence_score, primary_claim, discrepancy_note } = verification;

  const cfg = {
    Verified:    { icon: "✓", color: "text-emerald-400", bg: "bg-emerald-500/15 border-emerald-500/30", label: "Verified" },
    Discrepancy: { icon: "⚠", color: "text-amber-400",   bg: "bg-amber-500/15 border-amber-500/30",   label: "Discrepancy" },
    Unconfirmed: { icon: "✕", color: "text-red-400",     bg: "bg-red-500/15 border-red-500/30",       label: "Unconfirmed" },
  }[status] || { icon: "?", color: "text-zinc-500", bg: "bg-zinc-700/20 border-zinc-600/30", label: status };

  const handleEnter = (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    const tipW = 288; // w-72
    const rawLeft = (r.right + 6 + tipW > window.innerWidth ? r.left - tipW - 6 : r.right + 6) - 113;
    const top = Math.max(8, r.top - 76);
    setTooltipPos({
      left:      Math.max(8, Math.min(rawLeft, window.innerWidth - tipW - 8)),
      top,
      maxHeight: window.innerHeight - top - 8,
    });
  };

  return (
    <div className="relative inline-block">
      <button
        onMouseEnter={handleEnter}
        onMouseLeave={() => setTooltipPos(null)}
        className={`inline-flex items-center gap-0.5 px-1 py-0.5 rounded border text-[11px] font-bold cursor-pointer ${cfg.color} ${cfg.bg}`}
      >
        {cfg.icon}
      </button>
      {tooltipPos && (
        <div
          className="w-72 bg-zinc-900 border border-zinc-700 rounded-lg shadow-2xl p-3 text-left pointer-events-none"
          style={{
            position: "fixed",
            zIndex: 9999,
            left: tooltipPos.left,
            top: tooltipPos.top,
            maxHeight: tooltipPos.maxHeight,
            overflowY: "auto",
          }}
        >
          <div className={`text-[11px] font-bold mb-1 ${cfg.color}`}>{cfg.icon} {cfg.label} · {confidence_score}% confidence</div>
          {primary_claim && <div className="text-[11px] text-zinc-300 mb-1.5 leading-snug">"{primary_claim}"</div>}
          {discrepancy_note && <div className="text-[11px] text-amber-300 mb-1.5 leading-snug">⚠ {discrepancy_note}</div>}
          {headlines?.length > 0 && (
            <div className="border-t border-zinc-800 pt-1.5 space-y-1">
              <div className="text-[10px] text-zinc-600 uppercase tracking-widest mb-1">Sources</div>
              {headlines.map((h, i) => (
                <div key={i} className="text-[11px] text-zinc-400 leading-snug">
                  <span className="text-zinc-600">[{h.source}]</span>{" "}
                  {h.url
                    ? <a href={h.url} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">{h.title}</a>
                    : h.title}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const DailyChg = ({ val }) => {
  if (val == null) return <span className="text-zinc-600 text-[13px]">—</span>;
  const pos = val >= 0;
  return <span className={`text-[13px] font-mono font-bold ${pos ? "text-emerald-400" : "text-red-400"}`}>{pos ? "+" : ""}{val.toFixed(2)}%</span>;
};

/* ─────────────────────────────────────────────────────────── VIX GAUGE ── */
const VIX_ZONES = [
  { name: "Extreme Complacency", range: "VIX < 12",  color: "#00e676", vMin: 0,  vMax: 12, aStart: 180, aEnd: 126, label: ["EXTREME","COMPLACENCY"], impact: 'Markets are dangerously calm. High performance and steady grind higher — watch for sharp "rug pull" corrections as complacency peaks.' },
  { name: "Healthy / Normal",    range: "VIX 12–20", color: "#ffee58", vMin: 12, vMax: 20, aStart: 126, aEnd: 90,  label: ["HEALTHY","NORMAL"],       impact: "Markets thrive in stable macro environments. SPX sees consistent, sustainable growth with minimal headline risk." },
  { name: "Elevated Concern",    range: "VIX 20–30", color: "#ff9100", vMin: 20, vMax: 30, aStart: 90,  aEnd: 45,  label: ["ELEVATED","CONCERN"],      impact: "Choppy, headline-driven trading. SPX often struggles to hold gains. Reduce position size and tighten stops." },
  { name: "Extreme Panic",       range: "VIX 30+",   color: "#ff1744", vMin: 30, vMax: 40, aStart: 45,  aEnd: 0,   label: ["EXTREME","PANIC"],         impact: "Maximum fear. While painful initially, extreme VIX spikes are historically the best entry points for massive SPX rallies." },
];

const VixGauge = ({ initialVix }) => {
  const vix = initialVix ?? 18;

  const VMAX = 40;
  const zoneOf = v => VIX_ZONES.find(z => v >= z.vMin && v < z.vMax) ?? VIX_ZONES[VIX_ZONES.length - 1];
  const active = zoneOf(vix);
  const expectedMovePct = vix / 16;
  const arrowPct = Math.min(Math.max(vix, 0), VMAX) / VMAX * 100;

  /* Glow color for ambient effect */
  const glowRgb = active.color === '#00e676' ? '0,230,118'
    : active.color === '#ffee58' ? '255,238,88'
    : active.color === '#ff9100' ? '255,145,0'
    : '255,23,68';

  return (
    <div className="px-5 pt-3 pb-4 rounded-2xl h-[240px] flex flex-col relative overflow-hidden"
      style={{
        background: 'linear-gradient(145deg, #141414 0%, #0f0f0f 100%)',
        border: `1px solid rgba(${glowRgb},0.18)`,
        boxShadow: `0 0 32px rgba(${glowRgb},0.07), inset 0 1px 0 rgba(255,255,255,0.04)`,
      }}>

      {/* Ambient glow blob */}
      <div className="absolute -top-8 -right-8 w-32 h-32 rounded-full pointer-events-none"
        style={{ background: `radial-gradient(circle, rgba(${glowRgb},0.12) 0%, transparent 70%)` }} />

      {/* Header */}
      <div className="flex items-center justify-between mb-2 relative z-10">
        <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-[0.18em]">VIX Fear Gauge</span>
        <span className="text-[9px] text-zinc-700 border border-zinc-800/80 rounded-md px-1.5 py-0.5 font-mono tracking-wider">CBOE · SPX</span>
      </div>

      {/* VIX number + badge */}
      <div className="flex items-end gap-3 mb-2 relative z-10">
        <div>
          <span className="text-[32px] font-black font-mono tabular-nums leading-none"
            style={{
              color: active.color,
              textShadow: `0 0 24px rgba(${glowRgb},0.55), 0 0 8px rgba(${glowRgb},0.3)`,
              letterSpacing: '-0.02em',
            }}>
            {vix.toFixed(1)}
          </span>
        </div>
        <div className="mb-1.5 flex flex-col gap-0.5">
          <span className="text-[9px] font-bold uppercase tracking-[0.15em] leading-none"
            style={{ color: active.color, opacity: 0.6 }}>VIX Index</span>
          <span className="text-[11px] font-extrabold uppercase tracking-wider leading-tight"
            style={{ color: active.color }}>{active.name}</span>
        </div>
      </div>

      {/* Gradient bar section */}
      <div className="relative mt-3 mb-1 z-10">
        {/* Arrow marker */}
        <div className="relative h-3 mb-1">
          <div className="absolute transition-all duration-500" style={{ left: `calc(${arrowPct}% - 6px)` }}>
            <svg width="12" height="9" viewBox="0 0 12 9">
              <defs>
                <filter id="arrow-glow">
                  <feGaussianBlur stdDeviation="1.5" result="blur"/>
                  <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
                </filter>
              </defs>
              <polygon points="6,9 0,0 12,0" fill={active.color} filter="url(#arrow-glow)" />
            </svg>
          </div>
        </div>

        {/* Bar with inner shadow and segment dividers */}
        <div className="relative h-2.5 rounded-full overflow-hidden"
          style={{
            background: 'linear-gradient(to right, #00e676 0%, #39e07a 30%, #ffee58 30%, #ffd600 50%, #ff9100 50%, #ff6d00 75%, #ff1744 75%, #d50000 100%)',
            boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.5), inset 0 -1px 0 rgba(255,255,255,0.06)',
          }}>
          {/* Segment dividers */}
          {[30, 50, 75].map(p => (
            <div key={p} className="absolute top-0 bottom-0 w-px"
              style={{ left: `${p}%`, background: 'rgba(0,0,0,0.4)' }} />
          ))}
          {/* Gloss overlay */}
          <div className="absolute inset-0 rounded-full"
            style={{ background: 'linear-gradient(to bottom, rgba(255,255,255,0.12) 0%, transparent 60%)' }} />
        </div>

        {/* Tick labels */}
        <div className="flex mt-1">
          {VIX_ZONES.map((z, i) => (
            <div key={i} className="flex-shrink-0 text-[9px] font-mono text-zinc-700"
              style={{ width: `${(z.vMax - z.vMin) / VMAX * 100}%` }}>
              {z.vMin}
            </div>
          ))}
          <span className="text-[9px] font-mono text-zinc-700">40</span>
        </div>
      </div>

      {/* Expected move + description */}
      <div className="mt-2 pt-2 border-t z-10 relative" style={{ borderColor: `rgba(${glowRgb},0.12)` }}>
        <div className="flex items-center gap-2 mb-0.5">
          <span className="text-[9px] font-bold text-zinc-600 uppercase tracking-[0.14em]">Expected Move</span>
          <span className="text-[9px] text-zinc-700 font-mono">$SPX</span>
          <span className="text-[13px] font-extrabold font-mono tabular-nums ml-auto"
            style={{ color: active.color }}>±{expectedMovePct.toFixed(2)}%</span>
        </div>
        <p className="text-[10px] leading-relaxed text-zinc-600">{active.impact}</p>
      </div>

    </div>
  );
};

/* ──────────────────────────────────────────────── POSITION CALCULATOR ── */
const PositionCalc = ({ ibkrThemesData, thematicData }) => {
  const [equity, setEquity] = React.useState('');
  const [entry, setEntry] = React.useState('');
  const [atr, setAtr] = React.useState('');
  const [riskPct, setRiskPct] = React.useState('1');
  const [stopStrategy, setStopStrategy] = React.useState('3');
  const [stopMode, setStopMode] = React.useState('atr');
  const [manualStop, setManualStop] = React.useState('');
  const [lodTicker, setLodTicker] = React.useState('');
  const [lod, setLod] = React.useState(null);
  const [lodLoading, setLodLoading] = React.useState(false);
  const [lodError, setLodError] = React.useState(false);

  const accountEquity = ibkrThemesData?.account_equity ?? null;
  const effectiveEquity = accountEquity != null ? accountEquity : (parseFloat(equity) || 0);

  const e = parseFloat(entry) || 0;
  const a = parseFloat(atr) || 0;
  const r = parseFloat(riskPct) || 1;

  const fetchTickerData = React.useCallback(async (sym) => {
    const s = sym.trim().toUpperCase();
    if (!s) return;
    setLodLoading(true);
    setLodError(false);
    setLod(null);

    // Try local thematic data first — has bars_30d (HLCV) and is always available
    let stockMatch = null;
    if (thematicData?.themes) {
      outer: for (const t of thematicData.themes) {
        for (const sub of (t.subthemes || [])) {
          for (const stk of (sub.stocks || [])) {
            if (stk.ticker?.toUpperCase() === s) { stockMatch = stk; break outer; }
          }
        }
      }
    }

    if (stockMatch?.bars_30d?.length >= 15) {
      const bars = stockMatch.bars_30d;
      const trs = [];
      for (let i = 1; i < bars.length; i++) {
        trs.push(Math.max(bars[i].h - bars[i].l, Math.abs(bars[i].h - bars[i - 1].c), Math.abs(bars[i].l - bars[i - 1].c)));
      }
      const seedLen = Math.min(14, trs.length);
      let atr14 = trs.slice(0, seedLen).reduce((x, y) => x + y, 0) / seedLen;
      for (let i = seedLen; i < trs.length; i++) atr14 = (atr14 * 13 + trs[i]) / 14;
      setAtr(atr14.toFixed(2));
      const last = bars[bars.length - 1];
      if (last?.l > 0) setLod(parseFloat(last.l.toFixed(2)));
      setLodLoading(false);
      return;
    }

    // Fall back to Finnhub quote (LOD) + Yahoo Finance via corsproxy (ATR-14)
    try {
      const yahooUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${s}?range=30d&interval=1d`;
      const [quoteRes, yahooRes] = await Promise.all([
        fetch(`https://finnhub.io/api/v1/quote?symbol=${s}&token=${FINNHUB_KEY}`),
        fetch(`https://corsproxy.io/?${encodeURIComponent(yahooUrl)}`)
      ]);
      const quoteData = await quoteRes.json();
      const yahooData = await yahooRes.json().catch(() => null);

      const low = quoteData?.l;
      const prevClose = quoteData?.pc;
      if (low != null && low > 0) setLod(parseFloat(low.toFixed(2)));
      else if (prevClose != null && prevClose > 0) setLod(parseFloat(prevClose.toFixed(2)));

      const q = yahooData?.chart?.result?.[0]?.indicators?.quote?.[0];
      if (q?.high?.length >= 15) {
        const { high: h, low: l, close: c } = q;
        const trs = [];
        for (let i = 1; i < h.length; i++) {
          if (h[i] == null || l[i] == null || c[i - 1] == null) continue;
          trs.push(Math.max(h[i] - l[i], Math.abs(h[i] - c[i - 1]), Math.abs(l[i] - c[i - 1])));
        }
        if (trs.length >= 14) {
          let atr14 = trs.slice(0, 14).reduce((a, b) => a + b, 0) / 14;
          for (let i = 14; i < trs.length; i++) atr14 = (atr14 * 13 + trs[i]) / 14;
          setAtr(atr14.toFixed(2));
        }
      }
    } catch {
      // silent — leave ATR/LOD blank
    } finally {
      setLodLoading(false);
    }
  }, [thematicData]);

  // risk unit: entry − LOD (LOD mode), entry − manualStop (manual mode), ATR (ATR mode)
  const lodRisk = lod != null && e > lod ? e - lod : 0;
  const ms = parseFloat(manualStop);
  const manualRisk = stopMode === 'manual' && ms > 0 && e > ms ? e - ms : 0;
  const riskUnit = stopMode === 'lod' ? lodRisk : stopMode === 'manual' ? manualRisk : a;

  const shares = (effectiveEquity > 0 && riskUnit > 0)
    ? Math.floor((effectiveEquity * r / 100) / riskUnit)
    : null;

  let stops = [];
  if (e > 0) {
    if (stopMode === 'manual') {
      if (ms > 0) stops = [ms];
    } else if (stopMode === 'lod') {
      if (lod != null && lod > 0 && e > lod) {
        const n = parseInt(stopStrategy, 10);
        const dist = e - lod;
        stops = Array.from({ length: n }, (_, i) => e - dist * (i + 1) / n);
      }
    } else if (a > 0) {
      stops = stopStrategy === '3'
        ? [e - a, e - 2 * a, e - 3 * a]
        : [e - 1.5 * a, e - 3 * a];
    }
  }

  const maxLossBudget = effectiveEquity > 0 && r > 0 ? effectiveEquity * r / 100 : null;
  const dollarRisk = shares != null && riskUnit > 0 ? shares * riskUnit : null;
  const positionValue = shares != null && e > 0 ? shares * e : null;

  const fmtPrice = v => v != null ? `$${v.toFixed(2)}` : '—';
  const fmtDollar = v => v != null ? `$${v.toLocaleString('en-US', { maximumFractionDigits: 0 })}` : '—';

  const Tog = ({ active, onClick, children }) => (
    <button onClick={onClick}
      className={`flex-1 text-[10px] font-bold py-1 rounded transition-colors ${active ? 'bg-zinc-700 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}>
      {children}
    </button>
  );

  const numInput = (val, onChange, placeholder) => (
    <input type="number" value={val} onChange={ev => onChange(ev.target.value)} placeholder={placeholder}
      className="w-full bg-zinc-800/60 border border-zinc-700/50 rounded px-1.5 py-1 text-[11px] font-mono text-zinc-200 placeholder-zinc-700 outline-none focus:border-zinc-600"/>
  );

  return (
    <div className="bg-zinc-900/60 rounded-xl border border-zinc-800/60 p-3">
      <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-[0.18em] mb-2">Position Calc</div>

      {/* Equity row */}
      <div className="mb-2">
        {accountEquity != null ? (
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-zinc-500">Account Equity</span>
            <span className="text-[12px] font-mono font-bold text-zinc-200">
              {accountEquity.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })}
            </span>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-zinc-500 flex-shrink-0">Equity $</span>
            <input type="number" value={equity} onChange={ev => setEquity(ev.target.value)} placeholder="e.g. 25000"
              className="flex-1 bg-zinc-800/60 border border-zinc-700/50 rounded px-2 py-1 text-[11px] font-mono text-zinc-200 placeholder-zinc-700 outline-none focus:border-zinc-600"/>
          </div>
        )}
      </div>

      {/* Ticker input — above Entry; auto-fetches ATR-14 + LOD from Finnhub */}
      <div className="flex items-center gap-2 mb-2">
        <span className="text-[10px] text-zinc-500 flex-shrink-0">Ticker</span>
        <input
          type="text" value={lodTicker}
          onChange={ev => { setLodTicker(ev.target.value.toUpperCase()); setLod(null); setLodError(false); }}
          onBlur={ev => fetchTickerData(ev.target.value)}
          onKeyDown={ev => ev.key === 'Enter' && fetchTickerData(ev.target.value)}
          placeholder="e.g. AAPL"
          className="flex-1 bg-zinc-800/60 border border-zinc-700/50 rounded px-2 py-1 text-[11px] font-mono text-zinc-200 placeholder-zinc-700 outline-none focus:border-zinc-600 uppercase"/>
        <span className="text-[11px] font-mono min-w-[48px] text-right">
          {lodLoading ? <span className="text-zinc-500">...</span>
            : lodError ? <span className="text-red-400">ERR</span>
            : lod != null ? <span className="text-amber-400">${lod.toFixed(2)}</span>
            : null}
        </span>
      </div>

      {/* Entry / ATR / Risk % */}
      <div className="grid grid-cols-3 gap-1.5 mb-2">
        <div>
          <div className="text-[9px] text-zinc-600 mb-0.5">Entry</div>
          {numInput(entry, setEntry, '0.00')}
          <div className="mt-0.5 leading-tight">
            <div className="text-[8px] text-zinc-600 uppercase tracking-wider">Position</div>
            <div className="text-[10px] font-mono font-bold text-zinc-300">{positionValue != null ? fmtDollar(positionValue) : <span className="text-zinc-700">—</span>}</div>
          </div>
        </div>
        <div>
          <div className="text-[9px] text-zinc-600 mb-0.5">ATR-14</div>
          {numInput(atr, setAtr, '0.00')}
          <div className="mt-0.5 leading-tight">
            <div className="text-[8px] text-zinc-600 uppercase tracking-wider">ATR %</div>
            <div className="text-[10px] font-mono font-bold text-zinc-300">{(a > 0 && e > 0) ? `${(a / e * 100).toFixed(2)}%` : <span className="text-zinc-700">—</span>}</div>
          </div>
        </div>
        <div>
          <div className="text-[9px] text-zinc-600 mb-0.5">Risk %</div>
          {numInput(riskPct, setRiskPct, '1')}
          <div className="mt-0.5 leading-tight">
            <div className="text-[8px] text-zinc-600 uppercase tracking-wider">Max Loss</div>
            <div className="text-[10px] font-mono font-bold text-red-400/90">{maxLossBudget != null ? `−${fmtDollar(maxLossBudget)}` : <span className="text-zinc-700">—</span>}</div>
          </div>
        </div>
      </div>

      {/* Stop Strategy toggle */}
      <div className="flex gap-0.5 bg-zinc-800/40 rounded p-0.5 mb-1.5">
        <Tog active={stopStrategy === '3'} onClick={() => setStopStrategy('3')}>3-Stop</Tog>
        <Tog active={stopStrategy === '2'} onClick={() => setStopStrategy('2')}>2-Stop</Tog>
      </div>

      {/* Stop Mode toggle */}
      <div className="flex gap-0.5 bg-zinc-800/40 rounded p-0.5 mb-2">
        <Tog active={stopMode === 'atr'} onClick={() => setStopMode('atr')}>ATR Auto</Tog>
        <Tog active={stopMode === 'lod'} onClick={() => setStopMode('lod')}>LOD</Tog>
        <Tog active={stopMode === 'manual'} onClick={() => setStopMode('manual')}>Manual</Tog>
      </div>

      {/* Manual stop price input */}
      {stopMode === 'manual' && (
        <div className="flex items-center gap-2 mb-2">
          <span className="text-[10px] text-zinc-500 flex-shrink-0">Stop $</span>
          <input type="number" value={manualStop} onChange={ev => setManualStop(ev.target.value)} placeholder="0.00"
            className="flex-1 bg-zinc-800/60 border border-zinc-700/50 rounded px-2 py-1 text-[11px] font-mono text-zinc-200 placeholder-zinc-700 outline-none focus:border-zinc-600"/>
        </div>
      )}

      {/* Results grid */}
      <div className="pt-2 border-t border-zinc-800/60 space-y-2">
        <div className="grid grid-cols-2 gap-x-3">
          <div>
            <div className="text-[9px] text-zinc-600 mb-0.5">Shares</div>
            <div className="text-[14px] font-mono font-bold text-zinc-100">{shares ?? '—'}</div>
          </div>
          <div>
            <div className="text-[9px] text-zinc-600 mb-0.5">$ at Risk</div>
            <div className="text-[14px] font-mono font-bold text-red-400">{fmtDollar(dollarRisk)}</div>
          </div>
        </div>
        {stops.length > 0 && (
          <div>
            <div className="text-[9px] text-zinc-600 mb-1 uppercase tracking-wider">
              {stopMode === 'lod' ? 'LOD Stop' : stopMode === 'manual' ? 'Manual Stop' : `${stopStrategy}-Stop Levels`}
            </div>
            <div className={`grid gap-2 ${stops.length === 3 ? 'grid-cols-3' : stops.length === 2 ? 'grid-cols-2' : 'grid-cols-1'}`}>
              {stops.map((s, i) => {
                const lossPerShare = e > 0 && s > 0 ? e - s : 0;
                const lossPct = e > 0 && lossPerShare > 0 ? (lossPerShare / e * 100) : 0;
                return (
                  <div key={i} className="bg-zinc-800/40 rounded px-2 py-1.5">
                    <div className="text-[8px] text-zinc-500 uppercase">
                      {stopMode === 'atr'
                        ? (stopStrategy === '3' ? `−${i + 1}× ATR` : (i === 0 ? '−1.5× ATR' : '−3× ATR'))
                        : stopMode === 'lod'
                          ? (i === stops.length - 1 ? 'LOD' : `${Math.round((i + 1) / stops.length * 100)}% LOD`)
                          : `Stop ${i + 1}`}
                    </div>
                    <div className="text-[12px] font-mono font-bold text-zinc-200">{fmtPrice(s)}</div>
                    {lossPct > 0 && <div className="text-[9px] font-mono text-red-400/80">−{lossPct.toFixed(2)}%</div>}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Compact widgets for the new Thematic Scanner v2 layout (matches screenshot)
// ─────────────────────────────────────────────────────────────────────────────

const PanelLabel = ({ children, badge, badgeClass = "bg-emerald-500/10 text-emerald-400 border-emerald-500/30" }) => (
  <div className="flex items-center justify-between mb-2">
    <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-[0.15em]">{children}</div>
    {badge && <span className={`px-1.5 py-0.5 text-[9px] font-bold rounded border ${badgeClass}`}>{badge}</span>}
  </div>
);

const VixFearGaugeV2 = ({ vix }) => {
  const v = vix ?? 0;
  const cfg =
    v >= 30 ? { label: "EXTREME FEAR", cls: "text-red-400" } :
    v >= 24 ? { label: "ELEVATED CONCERN", cls: "text-amber-400" } :
    v >= 18 ? { label: "CAUTION", cls: "text-yellow-400" } :
    v >= 14 ? { label: "NORMAL", cls: "text-emerald-400" } :
              { label: "COMPLACENT", cls: "text-blue-400" };
  const expectedMove = v ? (v / 16).toFixed(2) : "—";
  const geminiText =
    v >= 30 ? "VIX > 30 = panic regime. Cash heavy, only A+ setups, half size."
    : v >= 24 ? "VIX > 24 = institutional hedging active. Reduce size, tighten stops. Avoid chasing."
    : v >= 18 ? "VIX in caution zone. Trade selectively — favor RS leaders only."
    : "Low VIX = trend friendly. Standard entries on RS leaders OK.";
  return (
    <div className="bg-zinc-900/60 border border-zinc-800/60 rounded-xl p-3">
      <PanelLabel badge="IBKR">VIX Fear Gauge</PanelLabel>
      <div className="text-[28px] leading-none font-bold font-mono text-zinc-100">{v ? v.toFixed(1) : "—"}</div>
      <div className={`text-[11px] font-semibold mt-1 ${cfg.cls}`}>⚠ {cfg.label}</div>
      <div className="mt-2 pt-2 border-t border-zinc-800/60">
        <div className="text-[10px] text-zinc-500">SPX Expected Move</div>
        <div className="text-[14px] font-bold font-mono text-zinc-200">±{expectedMove}%</div>
      </div>
      <div className="mt-2 pt-2 border-t border-zinc-800/60">
        <div className="flex items-center gap-1.5 mb-1">
          <span className="text-[11px] text-blue-400">✦</span>
          <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-[0.15em]">Gemini</div>
        </div>
        <div className="text-[11px] leading-snug text-zinc-300">{geminiText}</div>
      </div>
    </div>
  );
};

const INTERNALS_NOTES = [
  {
    label: "ADV/DEC",
    desc: "Advancing / Declining stocks ratio",
    lines: [
      { text: "≥60% advancing → healthy breadth", active: v => v >= 60, signal: "green" },
      { text: "40–60% → neutral, be selective", active: v => v >= 40 && v < 60, signal: "yellow" },
      { text: "<40% → bad breadth, avoid chasing", active: v => v < 40, signal: "red" },
    ],
  },
  {
    label: "SMA50 ↑",
    desc: "% of stocks above 50-day MA",
    lines: [
      { text: "≥60% → bull momentum healthy", active: v => v >= 60, signal: "green" },
      { text: "40–60% → borderline, buy leaders only", active: v => v >= 40 && v < 60, signal: "yellow" },
      { text: "<40% → weak market internals", active: v => v < 40, signal: "red" },
    ],
  },
  {
    label: "SMA200 ↑",
    desc: "% of stocks above 200-day MA",
    lines: [
      { text: "≥60% → long-term bull structure", active: v => v >= 60, signal: "green" },
      { text: "50–60% → caution zone", active: v => v >= 50 && v < 60, signal: "yellow" },
      { text: "<50% → majority in downtrend", active: v => v < 50, signal: "red" },
    ],
  },
  {
    label: "52W Hi",
    desc: "Stocks making 52-week highs",
    lines: [
      { text: "More highs = stronger bull momentum" },
      { text: "Healthy: Hi/Lo ratio >5", active: v => v > 5, signal: "green" },
    ],
  },
  {
    label: "52W Lo",
    desc: "Stocks making 52-week lows",
    lines: [
      { text: "Low number = limited panic", active: v => v < 50, signal: "green" },
      { text: "Sudden spike in Lo → market breakdown", active: v => v >= 100, signal: "red" },
    ],
  },
  {
    label: "TICK",
    desc: "NYSE intraday upticks minus downticks",
    lines: [
      { text: ">+800 → institutional buying, very strong", active: v => v > 800, signal: "green" },
      { text: "+200 to +800 → bullish", active: v => v >= 200 && v <= 800, signal: "green" },
      { text: "-200 to +200 → neutral", active: v => v > -200 && v < 200, signal: "yellow" },
      { text: "<-800 → panic selling", active: v => v < -800, signal: "red" },
    ],
  },
  {
    label: "TRIN",
    desc: "Arms Index — volume-weighted adv/dec ratio",
    lines: [
      { text: "<0.7 → volume in advancing stocks → Buy", active: v => v < 0.7, signal: "green" },
      { text: "0.7–1.3 → neutral", active: v => v >= 0.7 && v <= 1.3, signal: "yellow" },
      { text: ">1.3 → volume in declining stocks → Sell", active: v => v > 1.3 && v <= 2.0, signal: "red" },
      { text: ">2.0 → extreme panic, oversold bounce possible", active: v => v > 2.0, signal: "red" },
    ],
  },
  {
    label: "T2108",
    desc: "% of stocks above 40-day MA (Worden)",
    lines: [
      { text: "<20% → oversold, look for bounce", active: v => v < 20, signal: "yellow" },
      { text: "20–70% → normal range", active: v => v >= 20 && v <= 70, signal: "green" },
      { text: ">70% → overbought, watch for pullback", active: v => v > 70, signal: "red" },
    ],
  },
];

const MarketInternalsV2 = ({ mc, internalsData }) => {
  const [showNotes, setShowNotes] = React.useState(false);
  if (!mc) return null;
  const { adv_dec, new_hl, sma50_counts, sma200_counts } = mc;
  const advTxt = adv_dec ? `${adv_dec.advancing}/${adv_dec.declining}` : "—";
  const advPct = adv_dec ? (adv_dec.adv_pct ?? 0) : 0;
  const sma50pct = sma50_counts?.above_pct ?? 0;
  const sma200pct = sma200_counts?.above_pct ?? 0;
  const advCls = advPct >= 60 ? "text-emerald-400" : advPct >= 40 ? "text-amber-400" : "text-red-500";
  const sma50cls = sma50pct >= 60 ? "text-emerald-400" : sma50pct >= 40 ? "text-amber-400" : "text-red-500";
  const sma200cls = sma200pct >= 60 ? "text-emerald-400" : sma200pct >= 40 ? "text-amber-400" : "text-red-500";
  const advBar = advPct >= 60 ? "bg-emerald-500" : advPct >= 40 ? "bg-amber-500" : "bg-red-500";
  const sma50bar = sma50pct >= 60 ? "bg-emerald-500" : sma50pct >= 40 ? "bg-amber-500" : "bg-red-500";
  const sma200bar = sma200pct >= 60 ? "bg-emerald-500" : sma200pct >= 40 ? "bg-amber-500" : "bg-red-500";
  const newHigh = new_hl?.new_high ?? 0;
  const newLow = new_hl?.new_low ?? 0;
  const tick = internalsData?.tick;
  const trin = internalsData?.trin;
  const t2108 = internalsData?.t2108;
  const interpret = (k, v) => {
    if (v == null) return "—";
    if (k === "trin") return v < 0.7 ? "Buy" : v > 1.3 ? "Sell" : "Neutral";
    if (k === "t2108") return v < 20 ? "Oversold" : v > 80 ? "Overbought" : "Neutral";
    return "";
  };
  return (
    <div className="relative bg-zinc-900/60 border border-zinc-800/60 rounded-xl p-3">
      <div className="flex items-center justify-between mb-2">
        <PanelLabel badge="IBKR">Market Internals</PanelLabel>
        <button
          onClick={() => setShowNotes(v => !v)}
          className={`text-[10px] px-2 py-0.5 rounded border transition-colors ${
            showNotes
              ? "border-zinc-500 text-zinc-300 bg-zinc-800"
              : "border-zinc-700 text-zinc-500 hover:text-zinc-300 hover:border-zinc-500"
          }`}
        >
          {showNotes ? "▲ Notes" : "▼ Notes"}
        </button>
      </div>
      <div className="space-y-1.5">
        <div>
          <div className="flex items-baseline justify-between text-[10px]">
            <span className="text-zinc-500">ADV/DEC</span>
            {adv_dec ? (
              <span className="font-mono font-semibold">
                <span className="text-emerald-300">{adv_dec.adv_pct?.toFixed(1)}%</span>
                <span className="text-emerald-300"> ({adv_dec.advancing})</span>
                <span className="text-zinc-300"> / </span>
                <span className="text-red-500">{adv_dec.dec_pct?.toFixed(1)}%</span>
                <span className="text-red-500"> ({adv_dec.declining})</span>
              </span>
            ) : <span className={`font-mono font-semibold ${advCls}`}>—</span>}
          </div>
          <div className="h-1.5 rounded-full bg-zinc-800 overflow-hidden mt-0.5"><div className={`h-full ${advBar}`} style={{ width: `${Math.min(100, Math.max(0, advPct))}%` }}/></div>
        </div>
        <div>
          <div className="flex items-baseline justify-between text-[10px]"><span className="text-zinc-500">SMA50 ↑</span><span className={`font-mono font-semibold ${sma50cls}`}>{sma50pct.toFixed(0)}%</span></div>
          <div className="h-1.5 rounded-full bg-zinc-800 overflow-hidden mt-0.5"><div className={`h-full ${sma50bar}`} style={{ width: `${Math.min(100, sma50pct)}%` }}/></div>
        </div>
        <div>
          <div className="flex items-baseline justify-between text-[10px]"><span className="text-zinc-500">SMA200 ↑</span><span className={`font-mono font-semibold ${sma200cls}`}>{sma200pct.toFixed(0)}%</span></div>
          <div className="h-1.5 rounded-full bg-zinc-800 overflow-hidden mt-0.5"><div className={`h-full ${sma200bar}`} style={{ width: `${Math.min(100, sma200pct)}%` }}/></div>
        </div>
        <div>
          <div className="flex items-baseline justify-between text-[10px]"><span className="text-zinc-500">52W Hi</span><span className="font-mono font-semibold text-blue-400">{newHigh}</span></div>
          <div className="h-1.5 rounded-full bg-zinc-800 overflow-hidden mt-0.5"><div className="h-full bg-blue-500" style={{ width: `${Math.min(100, (newHigh / 500) * 100)}%` }}/></div>
        </div>
        <div>
          <div className="flex items-baseline justify-between text-[10px]"><span className="text-zinc-500">52W Lo</span><span className="font-mono font-semibold text-red-500">{newLow}</span></div>
          <div className="h-1.5 rounded-full bg-zinc-800 overflow-hidden mt-0.5"><div className="h-full bg-red-500" style={{ width: `${Math.min(100, (newLow / 500) * 100)}%` }}/></div>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-x-2 gap-y-0.5 mt-2 pt-2 border-t border-zinc-800/60 text-[10px] font-mono">
        <span className="text-zinc-500">TICK</span><span className={`text-right ${tick == null ? "text-zinc-600" : tick >= 0 ? "text-emerald-400" : "text-red-500"}`}>{tick == null ? "—" : (tick > 0 ? "+" : "") + tick}</span>
        <span className="text-zinc-500">TRIN</span><span className="text-zinc-300 text-right">{trin == null ? "—" : `${trin.toFixed(2)} ${interpret("trin", trin)}`}</span>
        <span className="text-zinc-500">T2108</span><span className="text-zinc-300 text-right">{t2108 == null ? "—" : `${t2108.toFixed(2)} ${interpret("t2108", t2108)}`}</span>
      </div>
      {showNotes && (
        <>
        <div className="fixed inset-0 z-40" onClick={() => setShowNotes(false)} />
        <div className="absolute top-0 left-full ml-1 z-50 w-64 bg-zinc-900 border border-zinc-700 rounded-xl p-3 shadow-xl space-y-2 overflow-y-auto max-h-[80vh]">
          {(() => {
            const hiLoRatio = newLow > 0 ? newHigh / newLow : null;
            const noteVals = {
              "ADV/DEC":  { raw: adv_dec ? advPct : null,  display: adv_dec ? `${advPct.toFixed(0)}% (${advTxt})` : null },
              "SMA50 ↑":  { raw: sma50pct,                 display: `${sma50pct.toFixed(0)}%` },
              "SMA200 ↑": { raw: sma200pct,                display: `${sma200pct.toFixed(0)}%` },
              "52W Hi":   { raw: hiLoRatio,                 display: `${newHigh} (Hi/Lo ${newLow > 0 ? `ratio ${hiLoRatio?.toFixed(1)}` : "—"})` },
              "52W Lo":   { raw: newLow,                   display: `${newLow}` },
              "TICK":     { raw: tick,                     display: tick != null ? (tick > 0 ? `+${tick}` : `${tick}`) : null },
              "TRIN":     { raw: trin,                     display: trin != null ? trin.toFixed(2) : null },
              "T2108":    { raw: t2108,                    display: t2108 != null ? `${t2108.toFixed(1)}%` : null },
            };
            return INTERNALS_NOTES.map(n => {
              const { raw, display } = noteVals[n.label] || {};
              return (
                <div key={n.label} className="border-b border-zinc-800/40 pb-1.5 last:border-0 last:pb-0">
                  {(() => {
                    const activeLine = raw != null ? n.lines.find(l => l.active && l.active(raw)) : null;
                    const sig = activeLine?.signal;
                    const sigCls = sig === "green" ? "text-emerald-400" : sig === "yellow" ? "text-amber-400" : sig === "red" ? "text-red-400" : "text-zinc-500";
                    const dotCls = sig === "green" ? "before:text-emerald-400" : sig === "yellow" ? "before:text-amber-400" : sig === "red" ? "before:text-red-400" : "before:text-amber-400";
                    return (
                      <>
                      <div className="flex items-baseline justify-between mb-0.5">
                        <span className="text-[10px] font-semibold text-zinc-200">{n.label}</span>
                        {display != null && <span className={`text-[9px] font-mono ${sigCls}`}>{display}</span>}
                      </div>
                      <ul className="space-y-0.5">
                        {n.lines.map((l, i) => {
                          const isActive = raw != null && l.active && l.active(raw);
                          const lineDot = isActive ? dotCls : "before:text-zinc-700";
                          return (
                            <li key={i} className={`text-[9px] leading-snug pl-1 before:content-['·'] before:mr-1 ${
                              isActive ? `font-semibold ${sigCls} ${lineDot}` : "text-zinc-500 before:text-zinc-700"
                            }`}>{l.text}</li>
                          );
                        })}
                      </ul>
                      </>
                    );
                  })()}
                </div>
              );
            });
          })()}
        </div>
        </>
      )}
    </div>
  );
};

const AlertRulesCard = () => (
  <div className="bg-zinc-900/60 border border-zinc-800/60 rounded-xl p-3">
    <PanelLabel badge="ntfy.sh" badgeClass="bg-blue-500/10 text-blue-400 border-blue-500/30">Alert Rules</PanelLabel>
    <div className="space-y-1.5">
      <div className="bg-emerald-500/[0.06] border border-emerald-500/20 rounded-md px-2 py-1.5">
        <div className="text-[11px] font-semibold text-emerald-400">AI &amp; Semi RS &gt; 95</div>
        <div className="text-[9px] text-zinc-500 mt-0.5">Push · ntfy.sh · Active</div>
      </div>
      <div className="bg-amber-500/[0.06] border border-amber-500/20 rounded-md px-2 py-1.5">
        <div className="text-[11px] font-semibold text-amber-400">Gapper T1 Catalyst</div>
        <div className="text-[9px] text-zinc-500 mt-0.5">Push · Pushover · Active</div>
      </div>
      <button className="w-full text-left text-[11px] text-zinc-500 hover:text-zinc-300 px-2 py-1.5 border border-dashed border-zinc-800 rounded-md">
        + Add Rule
        <div className="text-[9px] text-zinc-700">Theme RS · Grade · ADR · RS cross</div>
      </button>
    </div>
  </div>
);

const LeadersAllThemesCard = ({ themes }) => {
  const all = (themes || []).flatMap(t => (t.subthemes || []).flatMap(s => s.stocks || []));
  const seen = new Set();
  const dedup = [];
  for (const s of all) { if (!seen.has(s.ticker)) { seen.add(s.ticker); dedup.push(s); } }
  const filtered = dedup
    .filter(s => (s.rs_52w ?? 0) >= 85 && (s.price ?? 0) >= 12 && (s.adr_pct ?? 0) >= 4)
    .sort((a, b) => (b.rs_52w ?? 0) - (a.rs_52w ?? 0))
    .slice(0, 12);
  return (
    <div className="bg-zinc-900/60 border border-zinc-800/60 rounded-xl p-3">
      <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-[0.15em] mb-1">Leaders — All Themes</div>
      <div className="text-[9px] text-zinc-600 mb-2 leading-tight">RS&gt;85 · Price&gt;$12 · Vol&gt;$100M · Cap&gt;$2B · ADR≥4%</div>
      {filtered.length === 0 ? (
        <div className="text-[10px] text-zinc-600 italic">No qualifiers</div>
      ) : (
        <div className="space-y-0.5">
          <div className="flex items-center justify-between text-[9px] text-zinc-600 pb-0.5 mb-0.5 border-b border-zinc-800/60">
            <span>Ticker · Price · Chg</span>
            <span>RS</span>
          </div>
          {filtered.map(s => {
            const chg = s.change_pct ?? s.perf_1d ?? null;
            return (
              <div key={s.ticker} className="flex items-center justify-between text-[12px] py-1 border-b border-zinc-800/40 last:border-0">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="font-bold text-blue-400 font-mono">{s.ticker}</span>
                  {s.price != null && <span className="text-[9px] font-mono text-zinc-500">${s.price.toFixed(2)}</span>}
                  {chg != null && <span className={`text-[9px] font-mono font-bold ${chg >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{chg >= 0 ? '+' : ''}{chg.toFixed(1)}%</span>}
                </div>
                <span className="font-mono text-emerald-400 font-semibold">{s.rs_52w}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

const ActiveAlertsCardV2 = () => (
  <div className="bg-zinc-900/60 border border-zinc-800/60 rounded-xl p-3">
    <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-[0.15em] mb-2">Active Alerts</div>
    <div className="space-y-1.5">
      <div className="bg-emerald-500/[0.06] border border-emerald-500/20 rounded-md px-2 py-1.5">
        <div className="text-[11px] font-semibold text-emerald-400">AI Semi RS &gt; 95</div>
        <div className="text-[9px] text-zinc-500 mt-0.5">Fired · ntfy.sh ✓</div>
      </div>
      <div className="bg-amber-500/[0.06] border border-amber-500/20 rounded-md px-2 py-1.5">
        <div className="text-[11px] font-semibold text-amber-400">RKLB T1 Gapper</div>
        <div className="text-[9px] text-zinc-500 mt-0.5">Fired · Pushover ✓</div>
      </div>
    </div>
  </div>
);

const IBKRTWSScannerCard = ({ ibkrData }) => {
  const scanner = ibkrData?.scanner || [];
  const top = scanner.slice(0, 5);
  return (
    <div className="bg-zinc-900/60 border border-zinc-800/60 rounded-xl p-3">
      <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-[0.15em] mb-1">IBKR TWS Scanner</div>
      <div className="text-[9px] text-zinc-600 mb-2">Mirroring: Top Pre-Mkt Gainers</div>
      {top.length === 0 ? (
        <div className="text-[10px] text-zinc-600 italic">TWS offline</div>
      ) : (
        <div className="space-y-0.5">
          {top.map(s => {
            const chg = s.change_pct ?? 0;
            const cls = chg >= 10 ? "text-emerald-400" : chg >= 0 ? "text-amber-400" : "text-red-400";
            return (
              <div key={s.ticker} className="flex items-center justify-between text-[12px] py-1 border-b border-zinc-800/40 last:border-0">
                <span className="font-bold text-blue-400 font-mono">{s.ticker}</span>
                <span className={`font-mono font-semibold ${cls}`}>{chg >= 0 ? "+" : ""}{chg.toFixed(1)}%</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

const DataSourcesCard = ({ ibkrData }) => {
  const ibkrLive = ibkrData?.connected;
  return (
    <div className="bg-zinc-900/60 border border-zinc-800/60 rounded-xl p-3">
      <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-[0.15em] mb-2">Data Sources</div>
      <div className="space-y-1 text-[10px]">
        <div className="flex items-center justify-between">
          <span className="text-zinc-500">Primary</span>
          <span className={`px-1.5 py-0.5 text-[9px] font-bold rounded border ${ibkrLive ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30" : "bg-zinc-800 text-zinc-500 border-zinc-700"}`}>IBKR TWS</span>
        </div>
        <div className="flex items-center justify-between"><span className="text-zinc-500">Fallback 1</span><span className="text-zinc-400">Finviz</span></div>
        <div className="flex items-center justify-between"><span className="text-zinc-500">Fallback 2</span><span className="text-zinc-400">yfinance</span></div>
        <div className="flex items-center justify-between"><span className="text-zinc-500">News</span><span className="text-zinc-400">IBKR→Benzinga</span></div>
      </div>
    </div>
  );
};


const BottomStatusBar = ({ ibkrData, briefData }) => {
  const ibkrLive = ibkrData?.connected;
  return (
    <div className="border-t border-zinc-800/60 bg-zinc-950/80 px-4 py-1.5 mt-3 flex items-center justify-between text-[10px] font-mono text-zinc-500 flex-wrap gap-2">
      <div className="flex items-center gap-3 flex-wrap">
        <span className="flex items-center gap-1">
          <span className={`w-1.5 h-1.5 rounded-full ${ibkrLive ? "bg-emerald-400" : "bg-zinc-600"}`}/>
          {ibkrLive ? "IBKR Connected · TWS 10.19" : "IBKR Offline"}
        </span>
        <span className="flex items-center gap-1">
          <span className={`w-1.5 h-1.5 rounded-full ${briefData ? "bg-emerald-400" : "bg-zinc-600"}`}/>
          Gemini API {briefData ? "Active" : "—"}
        </span>
        <span className="flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"/>
          ntfy.sh Alerts Live
        </span>
        <span className="text-zinc-700">|</span>
        <span>Fallback: Finviz · yfinance · Benzinga · TradingView Screener</span>
      </div>
      <div>Backend: localhost:8000 · Frontend: Render</div>
    </div>
  );
};

// Color-coded keyword categories for breaking news highlighting
const _KW_CATEGORIES = [
  // Geopolitical / conflict — orange
  { cls: "text-orange-400", words: [
    "war", "wars", "invasion", "invade", "military", "airstrike", "missile", "nuclear",
    "troops", "bomb", "conflict", "coup", "assassination", "hostage", "ceasefire",
    "sanctions", "sanction", "iran", "russia", "ukraine", "north korea",
    "israel", "hamas", "hezbollah", "taiwan", "china", "venezuela", "nato",
    "strike", "strikes", "attack", "attacked", "invades", "invaded", "troops deployed",
    "military operation", "escalation", "escalate", "retaliation", "retaliates",
    "bombing", "blockade", "occupied", "occupation", "proxy war", "regime change",
  ]},
  // Trade / tariff / policy — amber
  { cls: "text-amber-400", words: [
    "tariff", "tariffs", "trade war", "trade deal", "import duty", "export ban",
    "ban", "embargo", "executive order", "veto", "legislation", "bill", "stimulus",
    "subsidy", "subsides", "restriction", "restrictions", "retaliatory", "retaliation",
    "trump", "biden", "white house", "congress", "senate", "executive", "decree",
    "25%", "50%", "100%", "tariff rate", "import tax", "trade bloc", "wto",
    "decouple", "decoupling", "supply chain",
  ]},
  // Fed / monetary policy — sky blue
  { cls: "text-sky-400", words: [
    "fed", "federal reserve", "fomc", "powell", "rate cut", "rate hike",
    "interest rate", "basis points", "quantitative easing", "quantitative tightening",
    "taper", "tapering", "yield curve", "cpi", "ppi", "inflation", "deflation",
    "monetary policy", "balance sheet",
    "rate decision", "basis point", "bps", "dot plot", "pivot", "hold", "pause",
    "emergency cut", "emergency hike", "jerome powell", "chair powell",
    "ecb", "boj", "pboc", "bank of japan", "european central bank",
    "treasury yield", "10-year", "2-year", "inverted", "inversion", "spread",
  ]},
  // Market risk / crisis — rose
  { cls: "text-rose-400", words: [
    "crash", "collapse", "circuit breaker", "trading halt", "halt", "emergency",
    "recession", "depression", "bear market", "selloff", "sell-off", "plunge",
    "panic", "contagion", "systemic risk", "liquidity crisis", "margin call",
    "downgrade", "credit watch", "default", "bankruptcy", "bankrupt", "chapter 11",
    "insolvency", "shutdown", "debt ceiling",
    "halted", "suspended trading", "black swan", "flash crash",
    "mass layoffs", "bank run", "bank failure", "fdic", "seized", "nationalized",
    "sovereign default", "imf bailout", "credit downgrade", "junk", "speculative grade",
  ]},
  // Corporate / earnings events — yellow
  { cls: "text-yellow-300", words: [
    "merger", "acquisition", "acquire", "takeover", "buyout", "spinoff", "spin-off",
    "ipo", "earnings", "beat", "miss", "guidance", "outlook", "forecast",
    "layoff", "layoffs", "restructuring", "job cuts", "headcount",
    "record", "all-time high",
    "surprise", "shock", "miss by", "beat by", "raised guidance", "cut guidance",
    "profit warning", "revenue warning", "Chapter 7", "Chapter 11", "delisted",
  ]},
  // Positive / approval — emerald
  { cls: "text-emerald-400", words: [
    "approval", "approved", "fda approval", "fda", "breakthrough",
    "upgrade", "deal signed", "partnership", "contract", "ceasefire deal",
    "peace deal", "rate cut", "stimulus package",
    "ceasefire", "peace", "de-escalation", "rate cut announced", "stimulus approved",
    "trade deal signed", "sanctions lifted", "recovery", "rebound", "relief rally",
  ]},
];

// Build a single map: lowercase word → css class (longer phrases first to match greedily)
const _kwMap = new Map();
_KW_CATEGORIES.forEach(({ cls, words }) => {
  words.slice().sort((a, b) => b.length - a.length).forEach(w => {
    if (!_kwMap.has(w.toLowerCase())) _kwMap.set(w.toLowerCase(), cls);
  });
});
const _sortedKws = [..._kwMap.keys()].sort((a, b) => b.length - a.length);
const _kwRe = new RegExp(
  `\\b(${_sortedKws.map(k => k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})\\b`,
  "gi"
);

function highlightText(text) {
  if (!text) return text;
  return text.split(_kwRe).map((part, i) => {
    const cls = _kwMap.get(part.toLowerCase());
    return cls ? <span key={i} className={cls}>{part}</span> : part;
  });
}

function formatAlertTime(ts) {
  if (!ts) return null;
  try {
    const d = new Date(ts);
    const time = d.toLocaleTimeString("en-US", {
      timeZone: "America/New_York", hour: "numeric", minute: "2-digit", hour12: true,
    });
    const date = d.toLocaleDateString("en-US", {
      timeZone: "America/New_York", month: "short", day: "numeric",
    });
    return `${date} ${time} ET`;
  } catch { return null; }
}

/** Breaking News Alert — shown globally above tab content when grade >= 8 news detected */
const BreakingNewsAlert = ({ newsData }) => {
  const [dismissed, setDismissed] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("bn_dismissed") || "[]");
    } catch { return []; }
  });
  const [expanded, setExpanded] = useState(false);
  const [pos, setPos] = useState(null); // null = default CSS position
  const drag = useRef({ active: false, ox: 0, oy: 0, sx: 0, sy: 0, moved: false });
  const containerRef = useRef(null);

  // Document-level mouse listeners so drag works even if cursor leaves the element
  useEffect(() => {
    const onMove = (e) => {
      if (!drag.current.active) return;
      e.preventDefault();                  // prevent text selection while dragging
      const dx = e.clientX - drag.current.sx;
      const dy = e.clientY - drag.current.sy;
      if (!drag.current.moved && (Math.abs(dx) > 4 || Math.abs(dy) > 4)) drag.current.moved = true;
      if (!drag.current.moved) return;
      setPos({ x: Math.max(0, drag.current.ox + dx), y: Math.max(0, drag.current.oy + dy) });
    };
    const onUp = () => { drag.current.active = false; };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    return () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (!newsData || !newsData.has_alert) return null;

  const visible = (newsData.alerts || []).filter(
    a => !dismissed.includes(a.headline)
  );
  if (!visible.length) return null;

  const sorted = visible.sort((a, b) => (b.grade || 0) - (a.grade || 0));
  const [top, ...rest] = sorted;
  const dismiss = headline => setDismissed(prev => {
    const next = [...prev, headline];
    try { localStorage.setItem("bn_dismissed", JSON.stringify(next.slice(-50))); } catch {}
    return next;
  });

  const onDragDown = (e) => {
    if (e.button !== 0) return;
    e.preventDefault();                    // prevent native drag / text selection
    const rect = containerRef.current?.getBoundingClientRect();
    const ox = rect ? rect.left : 0;
    const oy = rect ? rect.top  : 0;
    drag.current = { active: true, ox, oy, sx: e.clientX, sy: e.clientY, moved: false };
  };

  const posStyle = pos ? { left: pos.x, top: pos.y, right: 'auto' } : {};

  return (
    <div ref={containerRef} className="fixed top-[108px] right-4 z-50" style={{ width: expanded ? 420 : 'auto', ...posStyle }}>
      {/* Collapsed pill */}
      {!expanded && (
        <button
          onClick={() => { if (!drag.current.moved) setExpanded(true); }}
          onMouseDown={onDragDown}
          className="flex items-center gap-2 bg-black border-2 border-red-600 px-3 py-2 shadow-[0_0_20px_rgba(220,38,38,0.4)] animate-pulse hover:border-red-400 transition-colors cursor-grab active:cursor-grabbing"
          style={{ animationDuration: "2s" }}
        >
          <span className="text-red-600 font-black text-xs tracking-widest italic">⚡ BREAKING NEWS</span>
          <span className="bg-red-600 text-white text-[10px] font-black rounded-full w-4 h-4 flex items-center justify-center">
            {visible.length}
          </span>
        </button>
      )}

      {/* Expanded panel */}
      {expanded && (
        <div className="bg-black border-2 border-red-600 shadow-[0_0_40px_rgba(220,38,38,0.3)] flex flex-col" style={{ maxHeight: "calc(100vh - 124px)" }}>
          {/* Panel header — drag handle */}
          <div
            onMouseDown={onDragDown}
            className="flex items-center justify-between px-4 py-2 border-b border-red-900 flex-shrink-0 cursor-grab active:cursor-grabbing select-none"
          >
            <div className="flex items-center gap-2">
              <span className="text-red-600 font-black text-sm tracking-widest italic animate-pulse" style={{ animationDuration: "2s" }}>
                ⚡ BREAKING NEWS
              </span>
              <span className="text-red-800 text-[10px] font-bold border border-red-900 px-1">{visible.length}</span>
            </div>
            <button
              onClick={() => setExpanded(false)}
              onMouseDown={e => e.stopPropagation()}
              className="text-zinc-500 hover:text-zinc-300 text-lg leading-none ml-3"
              aria-label="Minimize"
            >−</button>
          </div>

          {/* Scrollable alerts */}
          <div className="overflow-y-auto flex-1 min-h-0">
            {/* Primary alert */}
            <div className="relative px-4 pt-4 pb-3 border-b border-red-900/40">
              <button
                onClick={() => dismiss(top.headline)}
                className="absolute top-3 right-3 text-red-700 hover:text-red-400 text-base font-black leading-none"
                aria-label="Dismiss"
              >×</button>
              <div className="flex items-center gap-2 mb-2 pr-5">
                <span className="text-red-700 font-black text-[11px] border border-red-700 px-1">{top.grade}/10</span>
                <span className="text-red-900 text-[10px] font-semibold uppercase tracking-widest">{top.source}</span>
                {formatAlertTime(top.pub_time || top.timestamp) && (
                  <span className="text-zinc-600 text-[9px] font-mono">{formatAlertTime(top.pub_time || top.timestamp)}</span>
                )}
              </div>
              <p className="text-red-500 font-extrabold text-sm uppercase leading-snug">
                {highlightText(top.headline)}
              </p>
            </div>

            {/* Secondary alerts */}
            {rest.map(alert => (
              <div key={alert.headline} className="relative px-4 pt-3 pb-3 border-b border-red-900/20">
                <button
                  onClick={() => dismiss(alert.headline)}
                  className="absolute top-3 right-3 text-red-900 hover:text-red-500 text-base font-black leading-none"
                  aria-label="Dismiss"
                >×</button>
                <div className="flex items-center gap-2 mb-1 pr-5">
                  <span className="text-red-800 text-[10px] font-bold border border-red-900 px-1">{alert.grade}/10</span>
                  <span className="text-red-900 text-[10px] font-semibold uppercase tracking-widest">{alert.source}</span>
                  {formatAlertTime(alert.pub_time || alert.timestamp) && (
                    <span className="text-zinc-600 text-[9px] font-mono">{formatAlertTime(alert.pub_time || alert.timestamp)}</span>
                  )}
                </div>
                <p className="text-red-700 font-bold text-xs uppercase leading-snug">{highlightText(alert.headline)}</p>
              </div>
            ))}

            {newsData.last_checked && (
              <p className="text-[10px] text-zinc-700 text-right px-3 py-2">
                Last checked: {newsData.last_checked}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

/** Returns the next Gapper scan time as a display string. */
function getNextGapperScanTime(scanTime) {
  const now = new Date();
  // Gapper window: 8:00 AM – 12:00 PM ET, triggers every 5 min via cron
  const utcDay = now.getUTCDay();
  const isWeekday = utcDay >= 1 && utcDay <= 5;
  // Check ET time: before 8:00 AM ET means scan hasn't started yet
  const etHour = parseInt(now.toLocaleString("en-US", { timeZone: "America/New_York", hour: "numeric", hour12: false }));
  const beforeWindow = etHour < 8;
  // Check if already scanned today (scan_time format: "2026-03-20 10:33 ET")
  const etTodayParts = now.toLocaleDateString("en-US", { timeZone: "America/New_York" }).split("/");
  const etTodayISO = `${etTodayParts[2]}-${etTodayParts[0].padStart(2,"0")}-${etTodayParts[1].padStart(2,"0")}`;
  const alreadyScannedToday = scanTime && scanTime.slice(0, 10) === etTodayISO;
  if (isWeekday && beforeWindow && !alreadyScannedToday) return "Today ~8:00 AM ET";
  const next = new Date(now);
  for (let i = 1; i <= 7; i++) {
    next.setUTCDate(next.getUTCDate() + 1);
    if (next.getUTCDay() >= 1 && next.getUTCDay() <= 5) {
      return next.toLocaleDateString("en-US", { timeZone: "America/New_York", weekday: "short", month: "short", day: "numeric" }) + " ~8:00 AM ET";
    }
  }
  return "Next weekday ~8:00 AM ET";
}

/** Returns the next Market Brief update time as a display string (ET). */
function getNextBriefTime() {
  const now = new Date();
  const todayUTC = new Date(now);
  todayUTC.setUTCHours(0, 0, 0, 0);
  // Brief runs at 12:17 UTC and 21:03 UTC, Mon–Fri
  const am = new Date(todayUTC.getTime() + (12 * 60 + 17) * 60000);
  const pm = new Date(todayUTC.getTime() + (21 * 60 + 3) * 60000);
  const nextBusinessDay = (base) => {
    const d = new Date(base);
    do { d.setUTCDate(d.getUTCDate() + 1); } while (d.getUTCDay() === 0 || d.getUTCDay() === 6);
    return d;
  };
  const isWeekend = now.getUTCDay() === 0 || now.getUTCDay() === 6;
  let next;
  if (!isWeekend && now < am) {
    next = am;
  } else if (!isWeekend && now < pm) {
    next = pm;
  } else {
    const nextDay = nextBusinessDay(todayUTC);
    next = new Date(nextDay.getTime() + (12 * 60 + 30) * 60000);
  }
  const etTime = next.toLocaleTimeString("en-US", { timeZone: "America/New_York", hour: "numeric", minute: "2-digit", hour12: true });
  const sameDay = next.toDateString() === now.toDateString();
  return `${etTime} ET${sameDay ? "" : " (tomorrow)"}`;
}

/** Thematic Scanner 側欄：以 Market Brief（market_brief.json）取代原 macro_news 列表 */
const ScannerBriefFeed = ({ briefData, newsData }) => {
  const [showFullBrief, setShowFullBrief] = useState(false);
  const [showBreakingNews, setShowBreakingNews] = useState(false);
  const [dismissedNews, setDismissedNews] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("bn_dismissed") || "[]");
    } catch { return []; }
  });

  const session       = briefData?.session || "";
  const generated_at  = briefData?.generated_at;
  const global_snapshot  = briefData?.global_snapshot  || [];
  const global_indices   = briefData?.global_indices   || {};
  const macro_breadth    = briefData?.macro_breadth    || {};
  const reversal_signals = briefData?.reversal_signals || {};
  const mood    = briefData?.mood    || "";
  const analysis = briefData?.analysis || {};
  const error   = briefData?.error;

  const sessionEmoji = { "Pre-Market": "🌅", "Market Hours": "☀️", "Post-Market": "🌙" }[session] || "📊";
  const sessionLabel = session === "Pre-Market" ? "Pre-Market Brief"
    : session === "Post-Market" ? "Post-Market Brief"
    : "Market Brief";
  const priceLabel = session === "Pre-Market" ? "Futures" : "Close";

  const regimeCls = r => ({ Complacent: "text-emerald-400", "Yellow Flag": "text-amber-400", Stress: "text-red-400" }[r] || "text-zinc-400");
  const gradeCls = g => (g || "").startsWith("A")
    ? "text-emerald-400 border-emerald-500/40 bg-emerald-500/10"
    : (g || "").startsWith("B")
    ? "text-amber-400 border-amber-500/40 bg-amber-500/10"
    : "text-red-400 border-red-500/40 bg-red-500/10";

  const visibleAlerts = (newsData?.has_alert ? (newsData.alerts || []) : [])
    .filter(a => !dismissedNews.includes(a.headline))
    .sort((a, b) => (b.grade || 0) - (a.grade || 0));

  // Shared content renderer (used in both the card and the full-brief modal)
  const briefContent = (maxH) => !briefData ? (
    <div className="flex-1 flex items-center justify-center" style={{ minHeight: 120 }}>
      <span className="text-[11px] text-zinc-600">載入簡報中…</span>
    </div>
  ) : (
    <div className="overflow-y-auto flex-1 space-y-3" style={maxH ? { maxHeight: maxH } : {}}>
      {error && <div className="text-[11px] text-red-400 bg-red-500/10 rounded p-2">{String(error)}</div>}
      {mood && <div className="text-[11px] text-zinc-400 italic">Mood: <span className="text-zinc-300 not-italic font-medium">{mood}</span></div>}
      {reversal_signals.signal_detected && (
        <div className="flex items-start gap-1.5 bg-amber-500/15 border border-amber-500/30 rounded p-2">
          <span className="text-sm flex-shrink-0">🔥</span>
          <div>
            <div className="text-[11px] font-bold text-amber-400">[REVERSAL SIGNAL DETECTED]</div>
            <div className="text-[10px] text-amber-300/70 mt-0.5">{reversal_signals.description}</div>
          </div>
        </div>
      )}
      {/* 1. Global Snapshot */}
      {global_snapshot.length > 0 && (
        <div>
          <div className="text-[10px] text-zinc-600 uppercase tracking-widest mb-1.5 font-semibold">1. Global Snapshot</div>
          <table className="w-full text-[10px]">
            <thead>
              <tr className="text-zinc-600 border-b border-zinc-800/60">
                <th className="text-left py-0.5 font-medium">Asset</th>
                <th className="text-left py-0.5 font-medium pl-2">{priceLabel}</th>
                <th className="text-left py-0.5 font-medium pl-2">Chg</th>
                <th className="text-left py-0.5 font-medium pl-2">%</th>
              </tr>
            </thead>
            <tbody>
              {global_snapshot.map((row, i) => {
                const chg = row.change ?? 0;
                const isYield = row.label === "10Y Yield";
                const isVix   = row.label === "VIX";
                const pctDisp = row.zone_label || row.trend_label
                  || (row.change_pct != null ? `${row.change_pct >= 0 ? "+" : ""}${row.change_pct.toFixed(2)}%` : "—");
                return (
                  <tr key={i} className="border-b border-zinc-800/30 last:border-0">
                    <td className="py-0.5 text-zinc-300 font-medium">{row.label}</td>
                    <td className="py-0.5 pl-2 font-mono text-zinc-200">
                      {row.price != null
                        ? isYield ? `${row.price.toFixed(2)}%` : row.price.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                        : "—"}
                    </td>
                    <td className={`py-0.5 pl-2 font-mono ${chg >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                      {row.change != null ? `${chg >= 0 ? "+" : ""}${chg.toFixed(2)}` : "—"}
                    </td>
                    <td className={`py-0.5 pl-2 font-mono ${
                      (row.zone_label || row.trend_label)
                        ? (isVix && (row.zone_label || "").includes("Fear") ? "text-red-400" : isVix ? "text-amber-400" : chg >= 0 ? "text-amber-400" : "text-emerald-400")
                        : (row.change_pct ?? 0) >= 0 ? "text-emerald-400" : "text-red-400"
                    }`}>
                      {pctDisp}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {Object.values(global_indices).some(g => g?.change_pct != null) && (
            <div className="flex gap-2 mt-1.5 flex-wrap">
              {Object.entries(global_indices).map(([k, g]) => g?.change_pct != null && (
                <span key={k} className="text-[10px]">
                  <span className="text-zinc-600">{g.label?.split(" ")[0]}</span>
                  <span className={`ml-0.5 font-mono ${g.change_pct >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                    {g.change_pct >= 0 ? "+" : ""}{g.change_pct.toFixed(2)}%
                  </span>
                </span>
              ))}
            </div>
          )}
        </div>
      )}
      {/* 2. Macro Risk & Breadth */}
      {(macro_breadth.credit_spread != null || macro_breadth.s5fi != null) && (
        <div>
          <div className="text-[10px] text-zinc-600 uppercase tracking-widest mb-1.5 font-semibold">2. Macro Risk &amp; Breadth</div>
          <div className="space-y-1">
            {macro_breadth.credit_spread != null && (
              <div className="text-[11px] text-zinc-400">
                <span className="text-zinc-500">• Credit Spread (HY Master II): </span>
                <span className="text-zinc-200 font-mono">{macro_breadth.credit_spread.toFixed(2)}%</span>
                {macro_breadth.credit_regime && (
                  <> <span className="text-zinc-600">|</span> <span className={`font-semibold ${regimeCls(macro_breadth.credit_regime)}`}>Regime: {macro_breadth.credit_regime}</span></>
                )}
              </div>
            )}
            {macro_breadth.s5fi != null && (
              <div className="text-[11px] text-zinc-400">
                <span className="text-zinc-500">• Market Breadth: </span>
                <span className="font-mono text-zinc-200">S5FI {macro_breadth.s5fi.toFixed(1)}%</span>
                {macro_breadth.mmth != null && (
                  <> <span className="text-zinc-600">·</span> <span className="font-mono text-zinc-200">MMTH {macro_breadth.mmth.toFixed(1)}%</span></>
                )}
              </div>
            )}
            {macro_breadth.breadth_status && (
              <div className={`text-[11px] font-bold mt-0.5 ${
                macro_breadth.generational ? "text-orange-400" : macro_breadth.breadth_flush ? "text-red-400" : "text-amber-400"
              }`}>
                • Status: [{macro_breadth.breadth_status}]
              </div>
            )}
          </div>
        </div>
      )}
      {/* 3. Analysis & Lessons */}
      {(analysis.analysis_para1 || analysis.analysis_para2) && (
        <div>
          <div className="text-[10px] text-zinc-600 uppercase tracking-widest mb-1.5 font-semibold">3. Analysis &amp; Lessons</div>
          <div className="space-y-2">
            {analysis.analysis_para1 && <p className="text-[11px] text-zinc-300 leading-relaxed">{analysis.analysis_para1}</p>}
            {analysis.analysis_para2 && <p className="text-[11px] text-zinc-400 leading-relaxed">{analysis.analysis_para2}</p>}
          </div>
        </div>
      )}
      {/* 4. Ticker Intelligence */}
      {analysis.ticker_intel?.length > 0 && (
        <div>
          <div className="text-[10px] text-zinc-600 uppercase tracking-widest mb-1.5 font-semibold">4. Ticker Intel</div>
          <div className="space-y-1.5">
            {analysis.ticker_intel.map((t, i) => (
              <div key={i} className="flex gap-1.5 items-start">
                <span className={`text-[10px] font-bold px-1 py-0.5 rounded border flex-shrink-0 mt-0.5 ${gradeCls(t.grade)}`}>{t.grade}</span>
                <div>
                  <span className="text-[11px] font-bold text-zinc-200 font-mono">${t.ticker}</span>
                  {t.company && <span className="text-[10px] text-zinc-500 ml-1">({t.company})</span>}
                  {t.reason && <p className="text-[10px] text-zinc-400 leading-snug mt-0.5">{t.reason}</p>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  return (
    <>
      {/* Full Brief Modal */}
      {showFullBrief && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm" onClick={() => setShowFullBrief(false)}>
          <div className="bg-zinc-950 border border-zinc-700/60 rounded-xl shadow-2xl w-full max-w-xl max-h-[88vh] overflow-y-auto mx-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-3 border-b border-zinc-800 sticky top-0 bg-zinc-950 z-10">
              <div className="flex items-center gap-2">
                <span className="text-base">{sessionEmoji}</span>
                <span className="text-sm font-bold text-zinc-200 uppercase tracking-wide">{sessionLabel}</span>
                {generated_at && <span className="text-[10px] text-zinc-500 ml-1">{generated_at}</span>}
              </div>
              <button onClick={() => setShowFullBrief(false)} className="text-zinc-500 hover:text-zinc-300 text-xl leading-none ml-4">×</button>
            </div>
            <div className="px-5 py-4">
              {briefContent(null)}
            </div>
          </div>
        </div>
      )}

      {/* Breaking News Modal */}
      {showBreakingNews && visibleAlerts.length > 0 && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm" onClick={() => setShowBreakingNews(false)}>
          <div className="bg-zinc-950 border border-red-900/60 rounded-xl shadow-2xl w-full max-w-xl max-h-[88vh] overflow-y-auto mx-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-3 border-b border-red-900/40 sticky top-0 bg-zinc-950 z-10">
              <div className="flex items-center gap-2">
                <span className="text-red-600 font-black text-sm tracking-widest italic animate-pulse" style={{ animationDuration: "2s" }}>⚡ BREAKING NEWS</span>
                <span className="bg-red-600 text-white text-[10px] font-black rounded-full w-4 h-4 flex items-center justify-center">{visibleAlerts.length}</span>
              </div>
              <button onClick={() => setShowBreakingNews(false)} className="text-zinc-500 hover:text-zinc-300 text-xl leading-none ml-4">×</button>
            </div>
            <div className="px-5 py-4 space-y-4">
              {visibleAlerts.map((alert, i) => (
                <div key={alert.headline} className={i > 0 ? "pt-4 border-t border-red-900/20" : ""}>
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    {alert.grade != null && <span className="text-red-700 font-black text-[11px] border border-red-700 px-1">{alert.grade}/10</span>}
                    {alert.source && <span className="text-red-900 text-[10px] font-semibold uppercase tracking-widest">{alert.source}</span>}
                    {formatAlertTime(alert.pub_time || alert.timestamp) && <span className="text-zinc-600 text-[9px] font-mono">{formatAlertTime(alert.pub_time || alert.timestamp)}</span>}
                  </div>
                  <p className={`font-extrabold text-sm uppercase leading-snug ${i === 0 ? "text-red-500" : "text-red-700"}`}>
                    {highlightText(alert.headline)}
                  </p>
                </div>
              ))}
              {newsData?.last_checked && (
                <p className="text-[10px] text-zinc-700 text-right pt-2 border-t border-zinc-800/60">Last checked: {newsData.last_checked}</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Card */}
      <div className="px-3 pt-3 pb-3 bg-zinc-900/60 border border-zinc-800/50 rounded-xl flex flex-col flex-1 min-h-0">
        {/* Header */}
        <div className="mb-3 pb-2 border-b border-zinc-800/60">
          <div className="flex items-start gap-2 mb-1.5">
            <div className="flex items-center gap-1.5">
              <span className="text-sm">{sessionEmoji}</span>
              <span className="text-[11px] font-bold text-zinc-300 uppercase tracking-wide">{session ? `${session} Brief` : "Market Brief"}</span>
            </div>
            <div className="flex-shrink-0 ml-2">
              {generated_at && <div className="text-[10px] text-zinc-600">{generated_at}</div>}
              <div className="text-[10px] text-zinc-500">Next: {getNextBriefTime()}</div>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            {/* Full brief expand button */}
            <button
              onClick={() => setShowFullBrief(true)}
              className="text-[10px] text-zinc-500 hover:text-zinc-300 border border-zinc-700/50 rounded px-1.5 py-0.5 transition-colors flex items-center gap-1"
            >
              {sessionLabel} <ExternalLink size={9}/>
            </button>
            {/* Breaking News button */}
            {visibleAlerts.length > 0 && (
              <button
                onClick={() => setShowBreakingNews(true)}
                className="flex items-center gap-1 bg-black border border-red-400/30 px-2 py-0.5 text-[10px] font-semibold italic tracking-wider text-red-400/70 hover:border-red-400/50 hover:text-red-400 transition-colors"
              >
                ⚡ NEWS
                <span className="bg-red-400/40 text-red-200 text-[9px] font-semibold rounded-full w-3.5 h-3.5 flex items-center justify-center">
                  {visibleAlerts.length}
                </span>
              </button>
            )}
          </div>
        </div>

        {briefContent("237px")}
      </div>
    </>
  );
};


const IBKRScannerTable = ({ ibkrScanner, onTickerClick }) => {
  const hoverTimer = useRef(null);

  const startHover = (ticker, rect) => {
    clearTimeout(hoverTimer.current);
    hoverTimer.current = setTimeout(() => onTickerClick && onTickerClick(ticker, rect), 2000);
  };
  const cancelHover = () => clearTimeout(hoverTimer.current);

  const isEmpty = !ibkrScanner || ibkrScanner.length === 0;

  return (
    <div className="mt-6">
      {/* Section header */}
      <div className="flex items-center gap-2 mb-2">
        <Activity size={12} className="text-emerald-400 flex-shrink-0"/>
        <span className="text-[12px] font-bold text-zinc-300 uppercase tracking-wide">
          IBKR TWS Scanner — Pre-Market <span className="normal-case">(mirrored)</span>
        </span>
        <span className="px-1.5 py-0.5 text-[9px] font-bold rounded border bg-emerald-500/15 text-emerald-400 border-emerald-500/30 font-mono leading-none">
          IBKR
        </span>
      </div>

      {isEmpty ? (
        <p className="text-[12px] text-zinc-600 py-3 px-1">
          IBKR TWS scanner data unavailable — connect IB Gateway
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-zinc-700/40">
          <table className="w-full text-left text-[12px]">
            <thead>
              <tr className="text-[11px] text-zinc-500 uppercase tracking-wider bg-zinc-900/80 border-b border-zinc-700/40">
                <th className="py-2 px-3 font-medium text-center">Ticker</th>
                <th className="py-2 px-3 font-medium text-center">Last</th>
                <th className="py-2 px-3 font-medium text-center">Chg%</th>
                <th className="py-2 px-3 font-medium text-center">Vol</th>
                <th className="py-2 px-3 font-medium text-center">RS</th>
                <th className="py-2 px-3 font-medium text-center">Gate Status</th>
                <th className="py-2 px-3 font-medium text-center">Source</th>
              </tr>
            </thead>
            <tbody>
              {ibkrScanner.map((row, i) => {
                const ticker = row.ticker || '—';
                const failedGates = row.gates_detail
                  ? Object.entries(row.gates_detail)
                      .filter(([, v]) => !v)
                      .map(([k]) => k.replace('gate_', ''))
                  : [];
                const passed = row.gates_passed ?? (5 - failedGates.length);

                return (
                  <tr key={ticker + i}
                    className="border-t border-zinc-800/40 hover:bg-zinc-800/20 transition-colors align-middle">
                    {/* Ticker */}
                    <td className="py-2 px-3 text-center">
                      <span
                        className="font-bold text-[13px] text-zinc-100 hover:text-blue-400 transition-colors cursor-pointer"
                        onClick={e => {
                          cancelHover();
                          const rect = e.currentTarget.getBoundingClientRect();
                          onTickerClick && onTickerClick(ticker, rect);
                        }}
                        onMouseEnter={e => startHover(ticker, e.currentTarget.getBoundingClientRect())}
                        onMouseLeave={cancelHover}
                      >
                        {ticker}
                      </span>
                    </td>
                    {/* Last */}
                    <td className="py-2 px-3 text-center font-mono text-zinc-300">
                      {row.price != null && row.price !== 0 ? `$${Number(row.price).toFixed(2)}` : '—'}
                    </td>
                    {/* Chg% */}
                    <td className="py-2 px-3 text-center font-mono">
                      {row.change_pct != null
                        ? <span className={row.change_pct >= 0 ? 'text-emerald-400' : 'text-red-400'}>
                            {row.change_pct >= 0 ? '+' : ''}{Number(row.change_pct).toFixed(2)}%
                          </span>
                        : <span className="text-zinc-600">—</span>}
                    </td>
                    {/* Vol */}
                    <td className="py-2 px-3 text-center font-mono text-zinc-400">
                      {row.volume != null ? fmtNum(row.volume) : '—'}
                    </td>
                    {/* RS */}
                    <td className="py-2 px-3 text-center font-mono">
                      {row.rs_placeholder != null
                        ? <span className={row.rs_placeholder >= 85 ? 'text-emerald-400 font-bold' : 'text-zinc-400'}>
                            {row.rs_placeholder}
                          </span>
                        : <span className="text-zinc-600">—</span>}
                    </td>
                    {/* Gate Status */}
                    <td className="py-2 px-3 text-center">
                      {row.meets_all_gates ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded border text-[11px] font-bold font-mono bg-emerald-500/15 text-emerald-400 border-emerald-500/30">
                          ✓ All 5
                        </span>
                      ) : (
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded border text-[11px] font-bold font-mono ${passed >= 4 ? 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30' : 'bg-red-500/15 text-red-400 border-red-500/30'}`}>
                          {passed}/5
                          {failedGates.length > 0 && (
                            <span className="font-normal text-[10px] opacity-80">
                              · {failedGates.join(', ')} fail
                            </span>
                          )}
                        </span>
                      )}
                    </td>
                    {/* Source */}
                    <td className="py-2 px-3 text-center">
                      <span className="px-1.5 py-0.5 text-[10px] font-bold rounded border bg-emerald-500/15 text-emerald-400 border-emerald-500/30 font-mono leading-none">
                        IBKR
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

const EarningsStrip = ({ earningsData, gapperTickers = new Set(), onTickerClick }) => {
  const _now = new Date();
  const todayStr = `${_now.getFullYear()}-${String(_now.getMonth()+1).padStart(2,"0")}-${String(_now.getDate()).padStart(2,"0")}`;
  // Support both new flat {earnings:[]} schema and legacy {today:[]} schema
  const today = earningsData?.earnings
    ? earningsData.earnings.filter(e => e.date === todayStr)
    : (earningsData?.today || []);
  if (!today?.length) return null;

  return (
    <div className="mb-3 bg-zinc-900/60 border border-zinc-800/50 rounded-lg px-3 py-2">
      <div className="flex items-center gap-1.5 mb-1.5">
        <Clock size={11} className="text-zinc-500 flex-shrink-0"/>
        <span className="text-[10px] font-semibold text-zinc-500 uppercase tracking-widest">Earnings Today</span>
        <span className="text-[10px] text-zinc-700">{today.length} co.</span>
      </div>
      <div className="flex gap-2 overflow-x-auto pb-0.5" style={{ scrollbarWidth: 'none' }}>
        {today.map(entry => {
          const isGapper = gapperTickers.has(entry.ticker);
          const timeCls  = entry.time_of_day === 'BMO'
            ? 'bg-sky-500/15 text-sky-400 border-sky-500/30'
            : entry.time_of_day === 'AMC'
            ? 'bg-violet-500/15 text-violet-400 border-violet-500/30'
            : 'bg-zinc-700/40 text-zinc-500 border-zinc-600/40';
          return (
            <div key={entry.ticker}
              className={`flex-shrink-0 flex items-center gap-1.5 bg-zinc-800/60 rounded-lg px-3 py-1.5 border transition-colors ${isGapper ? 'border-blue-500/60 bg-blue-500/5' : 'border-zinc-700/40'}`}>
              <span
                className="text-[13px] font-bold font-mono text-blue-400 hover:text-blue-300 cursor-pointer transition-colors leading-none"
                onClick={e => onTickerClick && onTickerClick(entry.ticker, e.currentTarget.getBoundingClientRect())}>
                {entry.ticker}
              </span>
              {entry.time_of_day && (
                <span className={`px-1 py-0.5 text-[9px] font-bold rounded border leading-none ${timeCls}`}>
                  {entry.time_of_day}
                </span>
              )}
              {entry.eps_estimate != null && (
                <span className="text-[11px] font-mono text-zinc-400 leading-none">
                  EPS&nbsp;{entry.eps_estimate > 0 ? '+' : ''}{entry.eps_estimate.toFixed(2)}
                </span>
              )}
              {isGapper && (
                <span className="text-[9px] font-bold text-blue-400 leading-none">⚡GAP</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ── Trade Journal Tab ─────────────────────────────────────────────────────────

const JOURNAL_KEY     = "power_theme_journal";
const JOURNAL_AI_KEY  = process.env.REACT_APP_GEMINI_KEY || "";

const EMPTY_TRADE = {
  id: "", date: "", ticker: "", theme: "", entry_price: "", exit_price: "",
  shares: "", stop_used: "ATR", stop_price: "", pnl_dollars: "", pnl_pct: "",
  r_multiple: "", grade: "", notes: "",
};

function loadTrades() {
  try { return JSON.parse(localStorage.getItem(JOURNAL_KEY) || "[]"); } catch { return []; }
}
function saveTrades(arr) {
  try { localStorage.setItem(JOURNAL_KEY, JSON.stringify(arr)); } catch { /* quota */ }
}
function newId() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

function calcDerived(t) {
  const entry = parseFloat(t.entry_price);
  const exit  = parseFloat(t.exit_price);
  const sh    = parseFloat(t.shares);
  const stop  = parseFloat(t.stop_price);
  const out   = { ...t };
  if (!isNaN(entry) && !isNaN(exit) && !isNaN(sh)) {
    out.pnl_dollars = ((exit - entry) * sh).toFixed(2);
    out.pnl_pct     = (((exit - entry) / entry) * 100).toFixed(2);
  }
  if (!isNaN(entry) && !isNaN(stop) && Math.abs(entry - stop) > 0 &&
      !isNaN(parseFloat(out.pnl_dollars))) {
    const risk = Math.abs(entry - stop) * (isNaN(sh) ? 1 : sh);
    out.r_multiple = risk > 0 ? (parseFloat(out.pnl_dollars) / risk).toFixed(2) : "";
  }
  return out;
}

const STOP_OPTS = ["ATR", "LOD", "Manual"];
const GRADE_OPTS = ["A", "B", "C", "D"];
const GRADE_CLS = { A: "text-emerald-400 bg-emerald-500/10 border-emerald-500/30", B: "text-blue-400 bg-blue-500/10 border-blue-500/30", C: "text-amber-400 bg-amber-500/10 border-amber-500/30", D: "text-red-400 bg-red-500/10 border-red-500/30" };

const InlineSelect = ({ value, options, onChange, placeholder, cls }) => {
  const [editing, setEditing] = useState(false);
  if (!editing) return (
    <span onClick={() => setEditing(true)} className={`cursor-pointer hover:opacity-70 transition-opacity ${cls || "text-zinc-400"} text-[11px]`}>
      {value || <span className="text-zinc-700 italic">{placeholder || "—"}</span>}
    </span>
  );
  return (
    <select autoFocus value={value || ""} onBlur={() => setEditing(false)}
      onChange={e => { onChange(e.target.value); setEditing(false); }}
      className="text-[11px] bg-zinc-800 border border-zinc-600 rounded px-1 py-0.5 text-zinc-200 outline-none">
      <option value="">—</option>
      {options.map(o => <option key={o} value={o}>{o}</option>)}
    </select>
  );
};

const InlineText = ({ value, onChange, placeholder, mono, cls }) => {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft]     = useState(value || "");
  if (!editing) return (
    <span onClick={() => { setDraft(value || ""); setEditing(true); }}
      className={`cursor-pointer hover:opacity-70 transition-opacity ${cls || "text-zinc-400"} text-[11px] ${mono ? "font-mono" : ""} whitespace-normal break-words max-w-[160px] block`}>
      {value || <span className="text-zinc-700 italic">{placeholder || "—"}</span>}
    </span>
  );
  return (
    <input autoFocus value={draft} onChange={e => setDraft(e.target.value)}
      onBlur={() => { onChange(draft); setEditing(false); }}
      onKeyDown={e => { if (e.key === "Enter") { onChange(draft); setEditing(false); } if (e.key === "Escape") setEditing(false); }}
      className="text-[11px] bg-zinc-800 border border-zinc-600 rounded px-1.5 py-0.5 text-zinc-200 outline-none w-full min-w-[80px]"
      placeholder={placeholder}/>
  );
};

const TradeJournalTab = ({ data }) => {
  const [trades, setTrades]         = useState(() => loadTrades());
  const [filter, setFilter]         = useState("all");
  const [showForm, setShowForm]     = useState(false);
  const [draft, setDraft]           = useState({ ...EMPTY_TRADE, id: newId() });
  const [aiResult, setAiResult]     = useState(null);
  const [aiLoading, setAiLoading]   = useState(false);

  const persist = (arr) => { setTrades(arr); saveTrades(arr); };

  const updateField = (id, field, value) => {
    const updated = trades.map(t => t.id === id ? calcDerived({ ...t, [field]: value }) : t);
    persist(updated);
  };

  const addTrade = () => {
    const filled = calcDerived({ ...draft, id: draft.id || newId() });
    persist([filled, ...trades]);
    setDraft({ ...EMPTY_TRADE, id: newId() });
    setShowForm(false);
  };

  const deleteTrade = (id) => { if (window.confirm("Delete this trade?")) persist(trades.filter(t => t.id !== id)); };

  // ── Summary cards ────────────────────────────────────────────────────────────
  const closed = trades.filter(t => t.exit_price !== "" && t.exit_price != null);
  const open   = trades.filter(t => !t.exit_price);
  const today  = new Date();
  const mtd    = closed.filter(t => {
    if (!t.date) return false;
    const d = new Date(t.date);
    return d.getFullYear() === today.getFullYear() && d.getMonth() === today.getMonth();
  });
  const pnlMTD   = mtd.reduce((s, t) => s + (parseFloat(t.pnl_dollars) || 0), 0);
  const rMults   = closed.map(t => parseFloat(t.r_multiple)).filter(v => !isNaN(v) && v !== 0);
  const avgR     = rMults.length ? (rMults.reduce((a, v) => a + v, 0) / rMults.length) : null;
  const holdDays = closed.map(t => {
    if (!t.date || !t.exit_date) return null;
    return (new Date(t.exit_date) - new Date(t.date)) / 86400000;
  }).filter(v => v != null && v >= 0);
  const avgHold  = holdDays.length ? (holdDays.reduce((a, v) => a + v, 0) / holdDays.length) : null;

  // ── Filtered trades ──────────────────────────────────────────────────────────
  const visible = trades.filter(t => {
    const r = parseFloat(t.r_multiple);
    if (filter === "winners") return !isNaN(r) && r > 0;
    if (filter === "losers")  return !isNaN(r) && r < 0;
    if (filter === "open")    return !t.exit_price;
    return true;
  });

  // ── Performance by theme ─────────────────────────────────────────────────────
  const byTheme = useMemo(() => {
    const m = {};
    for (const t of closed) {
      const th = t.theme || "Unthemed";
      if (!m[th]) m[th] = { pnl: 0, count: 0, wins: 0 };
      m[th].pnl   += parseFloat(t.pnl_dollars) || 0;
      m[th].count += 1;
      if ((parseFloat(t.r_multiple) || 0) > 0) m[th].wins += 1;
    }
    return Object.entries(m).sort((a, b) => b[1].pnl - a[1].pnl);
  }, [trades]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Gemini analysis ──────────────────────────────────────────────────────────
  const runAI = async () => {
    if (!JOURNAL_AI_KEY) { setAiResult("Set REACT_APP_GEMINI_KEY to enable AI analysis."); return; }
    setAiLoading(true);
    try {
      const last20 = trades.slice(0, 20).map(t => ({
        ticker: t.ticker, theme: t.theme, stop_used: t.stop_used,
        pnl_dollars: t.pnl_dollars, r_multiple: t.r_multiple, grade: t.grade,
      }));
      const url  = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${JOURNAL_AI_KEY}`;
      const prompt = `You are a trading coach analysing a trader's journal. Given the last 20 trades as JSON, provide: (1) Win rate and avg R-multiple by theme, (2) avg R-multiple by stop mode (ATR / LOD / Manual), (3) a concise one-paragraph actionable recommendation. Be specific.\n\nTrades:\n${JSON.stringify(last20, null, 2)}`;
      const body = { contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: 0.3, maxOutputTokens: 400 } };
      const res  = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const json = await res.json();
      setAiResult(json?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "No response from Gemini.");
    } catch (e) {
      setAiResult("Error calling Gemini: " + e.message);
    } finally {
      setAiLoading(false);
    }
  };

  // ── Row bg ────────────────────────────────────────────────────────────────────
  const rowBg = (t) => {
    if (!t.exit_price) return "bg-blue-500/5 hover:bg-blue-500/10";
    const r = parseFloat(t.r_multiple);
    if (!isNaN(r) && r > 0) return "bg-emerald-500/5 hover:bg-emerald-500/8";
    if (!isNaN(r) && r < 0) return "bg-red-500/5 hover:bg-red-500/8";
    return "hover:bg-zinc-800/30";
  };

  // Theme options from thematic_data for the form
  const themeOptions = useMemo(() => {
    const names = (data?.themes || []).map(t => t.name);
    const extra = [...new Set(trades.map(t => t.theme).filter(Boolean))];
    return [...new Set([...names, ...extra])].sort();
  }, [data, trades]);

  const pnlCls  = (v) => { const n = parseFloat(v); return isNaN(n) ? "text-zinc-500" : n > 0 ? "text-emerald-400 font-semibold" : n < 0 ? "text-red-400 font-semibold" : "text-zinc-400"; };
  const rCls    = (v) => { const n = parseFloat(v); return isNaN(n) ? "text-zinc-500" : n >= 2 ? "text-emerald-400 font-bold" : n > 0 ? "text-emerald-400" : n < 0 ? "text-red-400" : "text-zinc-500"; };

  const TH = ({ children, w }) => (
    <th className={`px-2 py-2 text-[10px] font-semibold text-zinc-500 uppercase tracking-wider whitespace-nowrap ${w || ""}`}>{children}</th>
  );

  return (
    <div className="max-w-[1560px] mx-auto px-4 pt-4 pb-8">

      {/* ── Summary cards ────────────────────────────────────────────────── */}
      <div className="grid grid-cols-4 gap-3 mb-5">
        {[
          { label: "Realized P&L MTD", value: pnlMTD !== 0 || mtd.length ? `${pnlMTD >= 0 ? "+" : ""}$${pnlMTD.toFixed(0)}` : "—", cls: pnlMTD >= 0 ? "text-emerald-400" : "text-red-400", sub: `${mtd.length} closed trades` },
          { label: "Open Positions",   value: open.length,   cls: open.length > 0 ? "text-blue-400" : "text-zinc-400", sub: `${trades.length} total trades` },
          { label: "Avg R:R",          value: avgR != null ? avgR.toFixed(2) + "R" : "—", cls: avgR != null && avgR >= 1 ? "text-emerald-400" : avgR != null && avgR < 0 ? "text-red-400" : "text-zinc-400", sub: `${rMults.length} closed with R` },
          { label: "Avg Hold",         value: avgHold != null ? `${avgHold.toFixed(1)}d` : "—", cls: "text-zinc-300", sub: `${holdDays.length} trades with exit date` },
        ].map(m => (
          <div key={m.label} className="bg-zinc-900/60 border border-zinc-800/60 rounded-xl p-4">
            <div className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1.5">{m.label}</div>
            <div className={`text-[22px] font-bold font-mono leading-none mb-1 ${m.cls}`}>{m.value}</div>
            <div className="text-[11px] text-zinc-600">{m.sub}</div>
          </div>
        ))}
      </div>

      {/* ── Filter tabs + Add button ─────────────────────────────────────── */}
      <div className="flex items-center gap-3 mb-3">
        <div className="flex bg-zinc-800/60 rounded-lg p-0.5 border border-zinc-700/40">
          {[{k:"all",l:"All"},{k:"winners",l:"Winners"},{k:"losers",l:"Losers"},{k:"open",l:"Open"}].map(v => (
            <button key={v.k} onClick={() => setFilter(v.k)}
              className={`px-2.5 py-1 text-[11px] font-medium rounded-md transition-all ${filter === v.k ? "bg-blue-500/20 text-blue-400 border border-blue-500/30" : "text-zinc-500 hover:text-zinc-300 border border-transparent"}`}>
              {v.l}
            </button>
          ))}
        </div>
        <span className="text-[11px] text-zinc-600">{visible.length} trades</span>
        <div className="flex-1"/>
        <button onClick={() => setShowForm(f => !f)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-medium bg-blue-500/20 text-blue-400 border border-blue-500/30 rounded-lg hover:bg-blue-500/30 transition-colors">
          {showForm ? "✕ Cancel" : "+ Add Trade"}
        </button>
      </div>

      {/* ── Trade table ──────────────────────────────────────────────────── */}
      <div className="bg-zinc-900/60 border border-zinc-800/60 rounded-xl overflow-hidden mb-5">
        <div className="overflow-x-auto">
          <table className="w-full text-left min-w-[1100px]">
            <thead className="border-b border-zinc-800/60 bg-zinc-900/80">
              <tr>
                <TH w="w-8"/>
                <TH>Date</TH>
                <TH>Ticker</TH>
                <TH>Theme</TH>
                <TH>Entry</TH>
                <TH>Exit</TH>
                <TH>Shares</TH>
                <TH>Stop</TH>
                <TH>P&L $</TH>
                <TH>P&L %</TH>
                <TH>R</TH>
                <TH>Grade</TH>
                <TH w="w-48">Notes</TH>
              </tr>
            </thead>
            <tbody>
              {/* ── Inline add form row ── */}
              {showForm && (
                <tr className="border-b border-zinc-700/60 bg-blue-500/5">
                  <td className="px-2 py-2"/>
                  {[
                    { f:"date",        type:"date",   ph:"Date"    },
                    { f:"ticker",      type:"text",   ph:"NVDA"    },
                    { f:"theme",       type:"text",   ph:"AI"      },
                    { f:"entry_price", type:"number", ph:"Entry"   },
                    { f:"exit_price",  type:"number", ph:"Exit"    },
                    { f:"shares",      type:"number", ph:"Shares"  },
                  ].map(({ f, type, ph }) => (
                    <td key={f} className="px-1.5 py-2">
                      <input type={type} placeholder={ph} value={draft[f] || ""}
                        onChange={e => setDraft(d => ({ ...d, [f]: e.target.value }))}
                        className="w-full text-[11px] bg-zinc-800 border border-zinc-700/60 rounded px-1.5 py-1 text-zinc-200 outline-none focus:border-blue-500/60 min-w-[60px]"/>
                    </td>
                  ))}
                  <td className="px-1.5 py-2">
                    <select value={draft.stop_used} onChange={e => setDraft(d => ({ ...d, stop_used: e.target.value }))}
                      className="text-[11px] bg-zinc-800 border border-zinc-700/60 rounded px-1 py-1 text-zinc-200 outline-none w-full">
                      {STOP_OPTS.map(o => <option key={o} value={o}>{o}</option>)}
                    </select>
                  </td>
                  <td className="px-1.5 py-2 text-[11px] text-zinc-500 font-mono" colSpan={3}>auto-calc</td>
                  <td className="px-1.5 py-2">
                    <select value={draft.grade} onChange={e => setDraft(d => ({ ...d, grade: e.target.value }))}
                      className="text-[11px] bg-zinc-800 border border-zinc-700/60 rounded px-1 py-1 text-zinc-200 outline-none w-full">
                      <option value="">—</option>
                      {GRADE_OPTS.map(o => <option key={o} value={o}>{o}</option>)}
                    </select>
                  </td>
                  <td className="px-1.5 py-2">
                    <input type="text" placeholder="Notes…" value={draft.notes || ""}
                      onChange={e => setDraft(d => ({ ...d, notes: e.target.value }))}
                      className="w-full text-[11px] bg-zinc-800 border border-zinc-700/60 rounded px-1.5 py-1 text-zinc-200 outline-none focus:border-blue-500/60"/>
                  </td>
                  <td className="px-1.5 py-2">
                    <button onClick={addTrade} className="text-[11px] px-2 py-1 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded hover:bg-emerald-500/30 transition-colors whitespace-nowrap">
                      Save
                    </button>
                  </td>
                </tr>
              )}

              {/* ── Existing trades ── */}
              {visible.length === 0 ? (
                <tr><td colSpan={13} className="py-12 text-center text-zinc-600 text-[12px] italic">No trades yet — click "+ Add Trade" to begin</td></tr>
              ) : visible.map(t => (
                <tr key={t.id} className={`border-b border-zinc-800/30 transition-colors ${rowBg(t)}`}>
                  <td className="px-2 py-2">
                    <button onClick={() => deleteTrade(t.id)} className="text-zinc-700 hover:text-red-400 transition-colors text-[11px]">✕</button>
                  </td>
                  <td className="px-2 py-1.5 text-[11px] font-mono text-zinc-500 whitespace-nowrap">{t.date || "—"}</td>
                  <td className="px-2 py-1.5 text-[12px] font-mono font-semibold text-zinc-100 whitespace-nowrap">{t.ticker || "—"}</td>
                  <td className="px-2 py-1.5">
                    <InlineText value={t.theme} onChange={v => updateField(t.id, "theme", v)} placeholder="Theme"/>
                  </td>
                  <td className="px-2 py-1.5 text-[11px] font-mono text-zinc-300">{t.entry_price ? `$${t.entry_price}` : "—"}</td>
                  <td className="px-2 py-1.5 text-[11px] font-mono text-zinc-300">{t.exit_price ? `$${t.exit_price}` : <span className="text-blue-400 text-[10px]">Open</span>}</td>
                  <td className="px-2 py-1.5 text-[11px] font-mono text-zinc-400">{t.shares || "—"}</td>
                  <td className="px-2 py-1.5">
                    <InlineSelect value={t.stop_used} options={STOP_OPTS} onChange={v => updateField(t.id, "stop_used", v)}
                      cls="text-[10px] font-mono text-zinc-500"/>
                  </td>
                  <td className={`px-2 py-1.5 text-[11px] font-mono ${pnlCls(t.pnl_dollars)}`}>
                    {t.pnl_dollars ? `${parseFloat(t.pnl_dollars) >= 0 ? "+" : ""}$${parseFloat(t.pnl_dollars).toFixed(0)}` : "—"}
                  </td>
                  <td className={`px-2 py-1.5 text-[11px] font-mono ${pnlCls(t.pnl_pct)}`}>
                    {t.pnl_pct ? `${parseFloat(t.pnl_pct) >= 0 ? "+" : ""}${parseFloat(t.pnl_pct).toFixed(2)}%` : "—"}
                  </td>
                  <td className={`px-2 py-1.5 text-[12px] font-mono font-bold ${rCls(t.r_multiple)}`}>
                    {t.r_multiple ? `${parseFloat(t.r_multiple) >= 0 ? "+" : ""}${t.r_multiple}R` : "—"}
                  </td>
                  <td className="px-2 py-1.5">
                    <InlineSelect value={t.grade} options={GRADE_OPTS} onChange={v => updateField(t.id, "grade", v)}
                      cls={`text-[11px] font-bold px-1.5 py-0.5 rounded border leading-none ${GRADE_CLS[t.grade] || "text-zinc-600"}`}/>
                  </td>
                  <td className="px-2 py-1.5 min-w-[120px] max-w-[200px]">
                    <InlineText value={t.notes} onChange={v => updateField(t.id, "notes", v)} placeholder="Add notes…"/>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Performance by theme ─────────────────────────────────────────── */}
      {byTheme.length > 0 && (
        <div className="bg-zinc-900/60 border border-zinc-800/60 rounded-xl overflow-hidden mb-5">
          <div className="px-4 py-2.5 border-b border-zinc-800/60">
            <span className="text-[12px] font-semibold text-zinc-300">Performance by Theme</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="border-b border-zinc-800/40">
                <tr>
                  {["Theme","Trades","Wins","Win %","Total P&L","Avg P&L"].map(h => (
                    <th key={h} className="px-3 py-2 text-[10px] font-semibold text-zinc-600 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {byTheme.map(([theme, s]) => (
                  <tr key={theme} className="border-b border-zinc-800/20 hover:bg-zinc-800/20 transition-colors">
                    <td className="px-3 py-2 text-[12px] font-medium text-zinc-200">{theme}</td>
                    <td className="px-3 py-2 text-[12px] font-mono text-zinc-400">{s.count}</td>
                    <td className="px-3 py-2 text-[12px] font-mono text-zinc-400">{s.wins}</td>
                    <td className="px-3 py-2 text-[12px] font-mono text-zinc-300">{s.count ? `${((s.wins/s.count)*100).toFixed(0)}%` : "—"}</td>
                    <td className={`px-3 py-2 text-[12px] font-mono font-semibold ${s.pnl >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                      {s.pnl >= 0 ? "+" : ""}${s.pnl.toFixed(0)}
                    </td>
                    <td className={`px-3 py-2 text-[12px] font-mono ${s.count ? (s.pnl/s.count >= 0 ? "text-emerald-400" : "text-red-400") : "text-zinc-500"}`}>
                      {s.count ? `${s.pnl/s.count >= 0 ? "+" : ""}$${(s.pnl/s.count).toFixed(0)}` : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Gemini Journal Analysis ──────────────────────────────────────── */}
      <div className="border border-emerald-800/40 bg-emerald-900/10 rounded-xl p-4">
        <div className="flex items-center gap-3 mb-2">
          <span className="text-[10px] font-bold text-emerald-500 uppercase tracking-wider">✦ GEMINI JOURNAL ANALYSIS</span>
          <button onClick={runAI} disabled={aiLoading || trades.length === 0}
            className="flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-medium bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-lg hover:bg-emerald-500/30 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
            {aiLoading ? <><RefreshCw size={10} className="animate-spin"/> Analysing…</> : "Analyse Journal"}
          </button>
          {!JOURNAL_AI_KEY && <span className="text-[10px] text-zinc-600">Set REACT_APP_GEMINI_KEY to enable</span>}
        </div>
        {aiResult
          ? <pre className="text-[12px] text-zinc-200 leading-relaxed whitespace-pre-wrap font-sans">{aiResult}</pre>
          : <p className="text-[12px] text-zinc-600 italic">Click "Analyse Journal" to get AI feedback on your last 20 trades.</p>
        }
      </div>

    </div>
  );
};

// ── Calendar Tab ─────────────────────────────────────────────────────────────

// Currency → country flag + name (for economic calendar)
const CURRENCY_COUNTRY = {
  USD: { flag: "🇺🇸", name: "United States" },
  EUR: { flag: "🇪🇺", name: "European Union" },
  GBP: { flag: "🇬🇧", name: "United Kingdom" },
  JPY: { flag: "🇯🇵", name: "Japan" },
  CAD: { flag: "🇨🇦", name: "Canada" },
  AUD: { flag: "🇦🇺", name: "Australia" },
  NZD: { flag: "🇳🇿", name: "New Zealand" },
  CHF: { flag: "🇨🇭", name: "Switzerland" },
  CNY: { flag: "🇨🇳", name: "Mainland China" },
  CNH: { flag: "🇨🇳", name: "Mainland China" },
  HKD: { flag: "🇭🇰", name: "Hong Kong" },
  SGD: { flag: "🇸🇬", name: "Singapore" },
  KRW: { flag: "🇰🇷", name: "South Korea" },
  INR: { flag: "🇮🇳", name: "India" },
  BRL: { flag: "🇧🇷", name: "Brazil" },
  MXN: { flag: "🇲🇽", name: "Mexico" },
  ZAR: { flag: "🇿🇦", name: "South Africa" },
  SEK: { flag: "🇸🇪", name: "Sweden" },
  NOK: { flag: "🇳🇴", name: "Norway" },
  DKK: { flag: "🇩🇰", name: "Denmark" },
  PLN: { flag: "🇵🇱", name: "Poland" },
  TRY: { flag: "🇹🇷", name: "Turkey" },
  DEU: { flag: "🇩🇪", name: "Germany" },
};

const CAL_DAY_NAMES   = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];
const CAL_MONTH_NAMES = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const CAL_MONTH_FULL  = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const CAL_DAY_FULL    = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];

function calGetWeekDays(weekOffset = 0) {
  const now = new Date();
  const day = now.getDay(); // 0=Sun
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const monday = new Date(now);
  monday.setDate(now.getDate() + diffToMonday + weekOffset * 7);
  monday.setHours(0, 0, 0, 0);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });
}

// Use local date parts — toISOString() returns UTC which shifts the date in non-UTC timezones
function calToDateStr(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}

function calFmtWeekRange(days) {
  const first = days[0], last = days[6];
  const m1 = CAL_MONTH_NAMES[first.getMonth()], m2 = CAL_MONTH_NAMES[last.getMonth()];
  const y  = last.getFullYear();
  return m1 === m2
    ? `${m1} ${first.getDate()} — ${last.getDate()}, ${y}`
    : `${m1} ${first.getDate()} — ${m2} ${last.getDate()}, ${y}`;
}

function calFmtDateHeader(dateStr) {
  const d = new Date(dateStr + "T12:00:00");
  return `${CAL_DAY_FULL[d.getDay()]}, ${CAL_MONTH_FULL[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

function calFmtMktCap(v) {
  if (v == null) return "—";
  if (v >= 1e12) return `$${(v/1e12).toFixed(2)}T`;
  if (v >= 1e9)  return `$${(v/1e9).toFixed(2)}B`;
  if (v >= 1e6)  return `$${(v/1e6).toFixed(0)}M`;
  return `$${v.toFixed(0)}`;
}

function calFmtRev(v) {
  if (v == null) return "—";
  if (v >= 1e12) return `$${(v/1e12).toFixed(2)}T`;
  if (v >= 1e9)  return `$${(v/1e9).toFixed(2)}B`;
  if (v >= 1e6)  return `$${(v/1e6).toFixed(0)}M`;
  if (v >= 1e3)  return `$${(v/1e3).toFixed(0)}K`;
  return `$${v.toFixed(0)}`;
}

function calSurpCls(v) {
  if (v == null) return "text-zinc-600";
  return v > 0 ? "text-emerald-400" : "text-rose-400";
}

function calFmtSurp(v) {
  if (v == null) return "—";
  return `${v > 0 ? "+" : ""}${v.toFixed(2)}%`;
}

// 3-bar impact indicator
const ImpactBars = ({ impact }) => {
  const h = (impact || "").toLowerCase();
  const count = h === "high" ? 3 : h === "medium" ? 2 : 1;
  const color = h === "high" ? "bg-red-500" : h === "medium" ? "bg-amber-400" : "bg-zinc-500";
  return (
    <div className="flex items-end gap-[2px] h-3.5 flex-shrink-0">
      {[1,2,3].map(i => (
        <div key={i} className={`w-[3px] rounded-[1px] ${i <= count ? color : "bg-zinc-700"}`}
             style={{ height: `${33 * i}%` }} />
      ))}
    </div>
  );
};

const EARNINGS_GEMINI_KEY = process.env.REACT_APP_GEMINI_KEY || "";

async function fetchEarningsAnalysis(ticker, company, eps_estimate, eps_act, eps_surp_pct, rev_est, rev_act, rev_surp_pct, mkt_cap) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${EARNINGS_GEMINI_KEY}`;
  const fmtV = v => v != null ? v : "N/A";
  const hasActuals = eps_act != null || rev_act != null;
  const dataNote = hasActuals
    ? "Use the REPORTED FINANCIALS above as the primary source."
    : "The REPORTED FINANCIALS above are not yet available (N/A). Use Google Search to find the most recent actual earnings data for this company, then write the brief based on what you find.";

  const prompt = `You are an experienced buy-side analyst writing a concise post-earnings brief for ${company} (${ticker}).

REPORTED FINANCIALS:
- EPS Estimate: ${fmtV(eps_estimate)} | EPS Actual: ${fmtV(eps_act)} | EPS Surprise: ${fmtV(eps_surp_pct)}%
- Revenue Estimate: ${fmtV(rev_est)} | Revenue Actual: ${fmtV(rev_act)} | Revenue Surprise: ${fmtV(rev_surp_pct)}%
- Market Cap: ${mkt_cap ? `$${(mkt_cap/1e9).toFixed(1)}B` : "N/A"}

${dataNote}

OUTPUT STRICT JSON ONLY — no markdown, no code fences, no explanation outside the JSON. Do NOT include search citations or footnotes.

Return this exact structure:
{
  "en": [
    { "title": "EARNINGS SUMMARY", "summary": "one concise sentence with actual numbers", "keywords": ["tag1","tag2","tag3","tag4","tag5"] },
    { "title": "STORY & CATALYSTS", "summary": "one concise sentence", "keywords": ["tag1","tag2","tag3","tag4","tag5"] },
    { "title": "MANAGEMENT TONE", "summary": "one concise sentence", "keywords": ["tag1","tag2","tag3","tag4","tag5"] },
    { "title": "Q&A HIGHLIGHTS", "summary": "one concise sentence", "keywords": ["tag1","tag2","tag3","tag4","tag5"] },
    { "title": "RISKS & SOFT SPOTS", "summary": "one concise sentence", "keywords": ["tag1","tag2","tag3","tag4","tag5"] },
    { "title": "MARKET REACTION", "summary": "one concise sentence", "keywords": ["tag1","tag2","tag3","tag4","tag5"] },
    { "title": "TRADER VERDICT", "summary": "one concise sentence", "keywords": ["tag1","tag2","tag3","tag4","tag5"] }
  ],
  "zh": [
    { "title": "財報摘要", "summary": "一句話摘要，含實際數字", "keywords": ["標籤1","標籤2","標籤3","標籤4","標籤5"] },
    { "title": "故事與催化劑", "summary": "一句話摘要", "keywords": ["標籤1","標籤2","標籤3","標籤4","標籤5"] },
    { "title": "管理層語氣", "summary": "一句話摘要", "keywords": ["標籤1","標籤2","標籤3","標籤4","標籤5"] },
    { "title": "Q&A 重點", "summary": "一句話摘要", "keywords": ["標籤1","標籤2","標籤3","標籤4","標籤5"] },
    { "title": "風險與弱點", "summary": "一句話摘要", "keywords": ["標籤1","標籤2","標籤3","標籤4","標籤5"] },
    { "title": "市場反應", "summary": "一句話摘要", "keywords": ["標籤1","標籤2","標籤3","標籤4","標籤5"] },
    { "title": "交易判斷", "summary": "一句話摘要", "keywords": ["標籤1","標籤2","標籤3","標籤4","標籤5"] }
  ]
}

Rules for keywords: each is a short phrase (2–4 words), factual, no fluff. Mix numbers, sentiment words, and category labels.`;

  const body = {
    contents: [{ parts: [{ text: prompt }] }],
    tools: [{ google_search: {} }],
    generationConfig: { temperature: 0.3, maxOutputTokens: 4000, thinkingConfig: { thinkingBudget: 0 } },
  };
  const res  = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  if (!res.ok) throw new Error(`Gemini API error ${res.status}`);
  const json = await res.json();
  // Concatenate all text parts (search grounding may split into multiple parts)
  const parts = json?.candidates?.[0]?.content?.parts || [];
  const raw = parts.map(p => p.text || "").join("").trim();
  if (!raw) throw new Error("Gemini returned an empty response — please retry");
  // Strip markdown code fences
  const cleaned = raw.replace(/```(?:json)?\n?/g, "").replace(/\n?```/g, "").trim();
  // Use balanced brace counting to extract the first complete JSON object
  // (greedy regex fails when google_search grounding appends citation footnotes)
  const start = cleaned.indexOf("{");
  if (start === -1) throw new Error("Could not find JSON in Gemini response — please retry");
  let depth = 0, end = -1;
  for (let i = start; i < cleaned.length; i++) {
    if (cleaned[i] === "{") depth++;
    else if (cleaned[i] === "}") { depth--; if (depth === 0) { end = i; break; } }
  }
  if (end === -1) throw new Error("Incomplete JSON from Gemini — please retry");
  try { return JSON.parse(cleaned.slice(start, end + 1)); }
  catch { throw new Error("Invalid JSON from Gemini — please retry"); }
}

// Simple markdown bold renderer (for **text** patterns)
function renderMarkdown(text) {
  return text.split(/(\*\*[^*]+\*\*)/).map((seg, i) => {
    if (seg.startsWith("**") && seg.endsWith("**")) {
      return <strong key={i} className="text-zinc-100 font-semibold">{seg.slice(2, -2)}</strong>;
    }
    return <span key={i}>{seg}</span>;
  });
}

const EarningsAnalysisDrawer = ({ stock, onClose, themeName }) => {
  const [analysis, setAnalysis] = useState(null);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState(null);
  const [lang,     setLang]     = useState("en");
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    if (!EARNINGS_GEMINI_KEY) {
      setError("Set REACT_APP_GEMINI_KEY to enable AI analysis.");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    setAnalysis(null);
    fetchEarningsAnalysis(
      stock.ticker, stock.company,
      stock.eps_estimate, stock.eps_act, stock.eps_surp_pct,
      stock.rev_est, stock.rev_act, stock.rev_surp_pct,
      stock.mkt_cap,
    )
      .then(data => { setAnalysis(data); setLoading(false); })
      .catch(e  => { setError(e.message); setLoading(false); });
  }, [stock.ticker, retryKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // Escape key closes drawer
  useEffect(() => {
    const h = e => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);

  const sections = analysis?.[lang] || [];

  // Keyword chip colour palette (cycles by index)
  const chipColors = [
    "bg-sky-500/10 border-sky-500/25 text-sky-400",
    "bg-violet-500/10 border-violet-500/25 text-violet-400",
    "bg-amber-500/10 border-amber-500/25 text-amber-400",
    "bg-emerald-500/10 border-emerald-500/25 text-emerald-400",
    "bg-rose-500/10 border-rose-500/25 text-rose-400",
  ];

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 backdrop-blur-sm"
         onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="relative flex flex-col w-full max-w-2xl max-h-[85vh] rounded-xl border border-zinc-600 bg-zinc-950 shadow-2xl">

        {/* Header */}
        <div className="flex items-center gap-3 border-b border-zinc-800 px-4 py-3 flex-shrink-0">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-mono text-[15px] font-bold text-white">{stock.ticker}</span>
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 leading-none">✦ AI ANALYSIS</span>
              {themeName && <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-sky-500/10 border border-sky-500/25 text-sky-400 leading-none">{themeName}</span>}
            </div>
            <span className="text-[11px] text-zinc-500 truncate block">{stock.company}</span>
          </div>
          {/* Quick stats */}
          <div className="flex items-center gap-3 text-[11px] font-mono flex-shrink-0">
            {stock.eps_act != null && (
              <span>EPS <span className={stock.eps_surp_pct > 0 ? "text-emerald-400" : "text-rose-400"}>{stock.eps_act.toFixed(2)}</span></span>
            )}
            {stock.eps_surp_pct != null && (
              <span className={`font-bold ${stock.eps_surp_pct > 0 ? "text-emerald-400" : "text-rose-400"}`}>
                {stock.eps_surp_pct > 0 ? "+" : ""}{stock.eps_surp_pct.toFixed(2)}%
              </span>
            )}
          </div>
          {/* Language tabs */}
          <div className="flex items-center rounded-md border border-zinc-700 overflow-hidden flex-shrink-0">
            {[["en","EN"],["zh","中文"]].map(([key,label]) => (
              <button key={key} onClick={() => setLang(key)}
                className={`px-2.5 py-1 text-[11px] font-semibold transition-colors ${lang===key ? "bg-zinc-700 text-white" : "text-zinc-500 hover:text-zinc-300"}`}>
                {label}
              </button>
            ))}
          </div>
          <button onClick={onClose} className="rounded p-1 text-zinc-500 hover:bg-zinc-700 hover:text-zinc-200" aria-label="Close">
            <X size={16}/>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <RefreshCw size={20} className="text-emerald-500 animate-spin"/>
              <p className="text-[12px] text-zinc-500">Gemini is analysing {stock.ticker} earnings…</p>
            </div>
          ) : error ? (
            <div className="py-10 text-center flex flex-col items-center gap-3">
              <p className="text-[13px] text-rose-400">{error}</p>
              <button onClick={() => setRetryKey(k => k + 1)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-zinc-800 hover:bg-zinc-700 text-[11px] text-zinc-300 transition-colors">
                <RefreshCw size={11}/> Retry
              </button>
            </div>
          ) : sections.length > 0 ? (
            <div className="space-y-3">
              {sections.map((sec, i) => (
                <div key={i} className="rounded-lg border border-zinc-800 bg-zinc-900/50 px-3 py-2.5">
                  <div className="text-[10px] font-bold tracking-widest text-zinc-500 uppercase mb-1">{sec.title}</div>
                  <p className="text-[12px] text-zinc-300 leading-snug mb-2">{sec.summary}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {(sec.keywords || []).map((kw, ki) => (
                      <span key={ki} className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${chipColors[ki % chipColors.length]}`}>
                        {kw}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : null}
        </div>

        {/* Footer */}
        <div className="border-t border-zinc-800/60 px-4 py-2 flex-shrink-0 flex items-center justify-between">
          <span className="text-[10px] text-zinc-700">Powered by Gemini 2.5 Flash · Based on latest available earnings data</span>
          <a href={`https://www.tradingview.com/chart/?symbol=${stock.ticker}`}
             target="_blank" rel="noopener noreferrer"
             className="text-[10px] text-zinc-500 hover:text-cyan-400 transition-colors flex items-center gap-1">
            Open chart <ExternalLink size={9}/>
          </a>
        </div>
      </div>
    </div>
  );
};

const CalendarTab = ({ econData, earningsData, thematicData }) => {
  const _todayD = new Date();
  const todayStr = `${_todayD.getFullYear()}-${String(_todayD.getMonth()+1).padStart(2,"0")}-${String(_todayD.getDate()).padStart(2,"0")}`;
  const [calSubTab, setCalSubTab] = useState("economic");  // "economic" | "earnings"
  const [selectedDay, setSelectedDay] = useState(todayStr);
  const [weekOffset, setWeekOffset]   = useState(0);
  const [analysisStock, setAnalysisStock] = useState(null); // stock object for AI drawer

  const tickerThemeMap = useMemo(() => {
    const m = {};
    for (const theme of thematicData?.themes || [])
      for (const sub of theme.subthemes || [])
        for (const s of sub.stocks || [])
          if (s.ticker && !m[s.ticker]) m[s.ticker] = theme.name;
    return m;
  }, [thematicData]);

  const weekDays = useMemo(() => calGetWeekDays(weekOffset), [weekOffset]);

  const goToToday = () => { setWeekOffset(0); setSelectedDay(todayStr); };

  // ── Normalise all econ events into flat array ──────────────────────────────
  // Supports both {events:[]} (new schema from econ_calendar.py) and
  // legacy {today:[], upcoming:[]} fallback.
  const allEconEvents = useMemo(() => {
    const raw = econData?.events
      ?? [...(econData?.today || []), ...(econData?.upcoming || [])];
    return raw.map(e => ({
      ...e,
      date:    e.date    ?? (e.datetime_et ? e.datetime_et.slice(0, 10) : null),
      time_et: e.time_et ?? (e.datetime_et ? e.datetime_et.slice(11, 16) : null),
      event:   e.event   ?? e.event_name ?? e.name ?? "",
    }));
  }, [econData]);

  // ── Normalise all earnings ─────────────────────────────────────────────────
  // Support both new flat schema {earnings:[]} and legacy {today:[], upcoming:[]}
  const allEarnings = useMemo(() =>
    earningsData?.earnings
      ?? [...(earningsData?.today || []), ...(earningsData?.upcoming || [])],
  [earningsData]);

  // ── Count by day (for weekly strip badges) ────────────────────────────────
  const econCountByDay = useMemo(() => {
    const m = {};
    for (const e of allEconEvents) if (e.date) m[e.date] = (m[e.date] || 0) + 1;
    return m;
  }, [allEconEvents]);

  const earnCountByDay = useMemo(() => {
    const m = {};
    for (const e of allEarnings) if (e.date) m[e.date] = (m[e.date] || 0) + 1;
    return m;
  }, [allEarnings]);

  // Days with at least one high-impact econ event (red dot in strip)
  const highImpactDays = useMemo(() => {
    const s = new Set();
    for (const e of allEconEvents)
      if (e.date && (e.impact || "").toLowerCase() === "high") s.add(e.date);
    return s;
  }, [allEconEvents]);

  // ── Filtered events for selected day ──────────────────────────────────────
  const dayEconEvents = useMemo(() =>
    allEconEvents
      .filter(e => e.date === selectedDay)
      .sort((a, b) => (a.time_et || "").localeCompare(b.time_et || "")),
  [allEconEvents, selectedDay]);

  const dayEarnings = useMemo(() => {
    const ORDER = { BMO: 0, AMC: 1 };
    return allEarnings
      .filter(e => e.date === selectedDay)
      .sort((a, b) => {
        const aHasTheme = tickerThemeMap[a.ticker] ? 0 : 1;
        const bHasTheme = tickerThemeMap[b.ticker] ? 0 : 1;
        if (aHasTheme !== bHasTheme) return aHasTheme - bHasTheme;
        return (ORDER[a.time_of_day] ?? 2) - (ORDER[b.time_of_day] ?? 2);
      });
  }, [allEarnings, selectedDay, tickerThemeMap]);

  // ── Group econ events by time slot ────────────────────────────────────────
  const econByTime = useMemo(() => {
    const groups = {};
    for (const e of dayEconEvents) {
      const t = e.time_et || "—";
      (groups[t] = groups[t] || []).push(e);
    }
    return groups;
  }, [dayEconEvents]);

  // index of first upcoming time slot (for red pill highlight)
  const nowTimeStr = new Date().toTimeString().slice(0, 5);
  const timeKeys   = Object.keys(econByTime);
  const nextTimeIdx = selectedDay === todayStr
    ? timeKeys.findIndex(t => t !== "—" && t >= nowTimeStr)
    : -1;

  // ── Earnings row sub-component ────────────────────────────────────────────
  const EarningsRow = ({ e }) => {
    const tod    = e.time_of_day || "";
    // TIME label: amber pill for BMO, violet for AMC, gray dash if unknown
    const todLabel = tod === "BMO" ? "BMO" : tod === "AMC" ? "AMC" : "—";
    const todCls   = tod === "BMO"
      ? "text-amber-400 bg-amber-500/10 border-amber-500/30"
      : tod === "AMC"
        ? "text-violet-400 bg-violet-500/10 border-violet-500/30"
        : "text-zinc-600";
    return (
      <div className="grid gap-0 items-center px-3 py-2.5 border-b border-zinc-800/30 last:border-b-0 hover:bg-zinc-800/20 transition-colors min-w-[900px]"
           style={{ gridTemplateColumns: "90px 1fr 90px 90px 80px 80px 90px 90px 90px 90px" }}>

        {/* Ticker */}
        <a href={`https://www.tradingview.com/chart/?symbol=${e.ticker}`} target="_blank" rel="noopener noreferrer"
           className="text-[13px] font-mono font-bold text-sky-400 hover:text-sky-300 transition-colors">{e.ticker}</a>

        {/* Company + theme tag + AI icon */}
        <div className="flex items-center gap-1.5 min-w-0 pr-2">
          <span className="text-[12px] text-zinc-300 truncate">{e.company || "—"}</span>
          {tickerThemeMap[e.ticker] && (
            <span className="flex-shrink-0 text-[9px] font-medium px-1 py-0.5 rounded bg-sky-500/10 border border-sky-500/25 text-sky-400 leading-none truncate max-w-[90px]">{tickerThemeMap[e.ticker]}</span>
          )}
          <button
            onClick={() => setAnalysisStock(e)}
            title="Gemini AI earnings analysis"
            className="flex-shrink-0 w-4 h-4 flex items-center justify-center rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 hover:bg-emerald-500/25 hover:border-emerald-500/50 transition-colors leading-none text-[9px] font-bold"
            aria-label="AI analysis">
            ✦
          </button>
        </div>

        {/* Time — pill badge */}
        <div className="flex justify-start">
          {tod
            ? <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border leading-none ${todCls}`}>{todLabel}</span>
            : <span className="text-[12px] text-zinc-600">—</span>}
        </div>

        <span className="text-[12px] text-zinc-400 text-right font-mono">{calFmtMktCap(e.mkt_cap)}</span>
        <span className="text-[12px] text-zinc-400 text-right font-mono">{e.eps_estimate != null ? e.eps_estimate.toFixed(2) : "—"}</span>
        <span className="text-[12px] font-bold text-zinc-200 text-right font-mono">{e.eps_act != null ? e.eps_act.toFixed(2) : "—"}</span>
        <span className={`text-[12px] text-right font-mono ${calSurpCls(e.eps_surp_pct)}`}>{calFmtSurp(e.eps_surp_pct)}</span>
        <span className="text-[12px] text-zinc-400 text-right font-mono">{calFmtRev(e.rev_est)}</span>
        <span className="text-[12px] font-bold text-zinc-200 text-right font-mono">{calFmtRev(e.rev_act)}</span>
        <span className={`text-[12px] text-right font-mono ${calSurpCls(e.rev_surp_pct)}`}>{calFmtSurp(e.rev_surp_pct)}</span>
      </div>
    );
  };

  return (
    <div className="max-w-[1400px] mx-auto px-4 pt-4 pb-8">

      {/* ── Weekly strip ──────────────────────────────────────────────────── */}
      <div className="mb-4 bg-zinc-900/60 border border-zinc-800/60 rounded-xl overflow-hidden">
        {/* Title bar */}
        <div className="flex items-center gap-2 px-3 py-2 border-b border-zinc-800/60">
          <button onClick={goToToday}
            className="px-2.5 py-1 text-[11px] font-semibold rounded-md bg-zinc-700/60 border border-zinc-600/40 text-zinc-300 hover:bg-zinc-600/60 transition-colors">
            Today
          </button>
          <button onClick={() => setWeekOffset(w => w - 1)}
            className="w-6 h-6 flex items-center justify-center rounded text-lg text-zinc-400 hover:bg-zinc-700/60 hover:text-zinc-200 transition-colors leading-none">
            ‹
          </button>
          <button onClick={() => setWeekOffset(w => w + 1)}
            className="w-6 h-6 flex items-center justify-center rounded text-lg text-zinc-400 hover:bg-zinc-700/60 hover:text-zinc-200 transition-colors leading-none">
            ›
          </button>
          <span className="text-[13px] font-semibold text-zinc-200 ml-1">{calFmtWeekRange(weekDays)}</span>
        </div>

        {/* 7-column day grid — responsive: all 7 on lg, Mon-Fri on md, 3 days on sm */}
        <div className="grid grid-cols-3 md:grid-cols-5 lg:grid-cols-7">
          {weekDays.map((d, i) => {
            const ds      = calToDateStr(d);
            const isToday = ds === todayStr;
            const isSel   = ds === selectedDay;
            const econCnt = econCountByDay[ds] || 0;
            const earnCnt = earnCountByDay[ds]  || 0;
            const hasHigh = highImpactDays.has(ds);
            const isWeekend = i >= 5;
            // sm: show Mon/Thu only · md: Mon–Fri · lg: all 7
            const hideSm = (i === 1 || i === 2 || i === 4 || i === 5 || i === 6) ? "hidden md:flex" : "flex";
            return (
              <button key={ds} onClick={() => setSelectedDay(ds)}
                className={`flex-col gap-1 px-2 py-3 text-left transition-colors border-r border-zinc-800/40 last:border-r-0
                  ${hideSm} ${isWeekend ? "lg:flex" : ""}
                  ${isSel   ? "bg-zinc-700/60" : isWeekend ? "bg-zinc-900/20 hover:bg-zinc-800/30" : "hover:bg-zinc-800/40"}
                  ${isToday ? "ring-1 ring-inset ring-blue-500/40" : ""}`}>
                <div className="flex items-center gap-1.5">
                  <span className={`text-[11px] font-semibold ${isToday ? "text-blue-400" : isSel ? "text-zinc-200" : "text-zinc-500"}`}>
                    {CAL_DAY_NAMES[i]}
                  </span>
                  <span className={`text-[14px] font-bold ${isToday ? "text-blue-400" : isSel ? "text-zinc-100" : "text-zinc-400"}`}>
                    {d.getDate()}
                  </span>
                  {hasHigh && <span className="w-1.5 h-1.5 rounded-full bg-red-500 flex-shrink-0 ml-0.5"/>}
                </div>
                <div className="flex flex-col gap-0.5 w-full">
                  {econCnt > 0 && (
                    <div className="flex items-center justify-between">
                      <span className="text-[9px] text-zinc-600">Economic</span>
                      <span className="text-[9px] font-mono text-zinc-400">{econCnt}</span>
                    </div>
                  )}
                  {earnCnt > 0 && (
                    <div className="flex items-center justify-between">
                      <span className="text-[9px] text-zinc-600">Earnings</span>
                      <span className="text-[9px] font-mono text-zinc-400">{earnCnt}</span>
                    </div>
                  )}
                  {econCnt === 0 && earnCnt === 0 && (
                    <span className="text-[9px] text-zinc-700">—</span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Sub-tabs ──────────────────────────────────────────────────────── */}
      <div className="flex gap-2 mb-4">
        {[{k:"economic",l:"Economic"},{k:"earnings",l:"Earnings"}].map(({k,l}) => (
          <button key={k} onClick={() => setCalSubTab(k)}
            className={`px-4 py-1.5 text-[12px] font-semibold rounded-full border transition-colors
              ${calSubTab===k
                ? "bg-blue-500/20 border-blue-500/40 text-blue-400"
                : "border-zinc-700/40 text-zinc-500 hover:text-zinc-300 hover:border-zinc-600"}`}>
            {l}
          </button>
        ))}
      </div>

      {/* ── ECONOMIC SUB-TAB ──────────────────────────────────────────────── */}
      {calSubTab === "economic" && (
        <div>
          <div className="text-[11px] font-semibold text-zinc-500 mb-3 uppercase tracking-wider">
            {calFmtDateHeader(selectedDay)}
            {dayEconEvents.length > 0 && <span className="text-zinc-700 font-normal normal-case ml-2">· {dayEconEvents.length} events</span>}
          </div>

          {dayEconEvents.length === 0 ? (
            <div className="py-16 text-center rounded-xl border border-zinc-800/40">
              <p className="text-[13px] text-zinc-600 italic">No economic events for this day</p>
              {!econData && <p className="text-[11px] text-zinc-700 mt-1.5">Run <code className="bg-zinc-800 px-1 py-0.5 rounded text-zinc-400">econ_calendar.py</code> to generate data</p>}
            </div>
          ) : (
            <div className="rounded-xl border border-zinc-800/60 overflow-hidden">
              {/* Table header */}
              <div className="grid items-center border-b border-zinc-800/60 bg-zinc-800/40 px-4 py-2"
                   style={{ gridTemplateColumns: "72px 180px 20px 1fr 110px 100px 100px" }}>
                <span className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">Time</span>
                <span className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">Country</span>
                <span/>
                <span className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider pl-2">Event</span>
                <span className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider text-right">Actual</span>
                <span className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider text-right">Forecast</span>
                <span className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider text-right">Prior</span>
              </div>

              {timeKeys.map((time, gi) => {
                const events  = econByTime[time];
                const isPast  = time !== "—" && time < nowTimeStr && selectedDay <= todayStr;
                const isNextSlot = gi === nextTimeIdx;
                return (
                  <div key={time} className={isNextSlot ? "bg-red-950/10" : ""}>
                    {events.map((ev, j) => {
                      const cc       = CURRENCY_COUNTRY[ev.currency] || { flag: "🌐", name: ev.currency || "" };
                      const actual   = ev.actual   ?? null;
                      const forecast = ev.forecast  ?? null;
                      const prior    = ev.previous  ?? null;
                      const actualColor =
                        actual == null ? "" :
                        forecast != null && parseFloat(actual) > parseFloat(forecast) ? "text-emerald-400" :
                        forecast != null && parseFloat(actual) < parseFloat(forecast) ? "text-rose-400" :
                        "text-zinc-200";
                      return (
                        <div key={j}
                          className="grid items-center px-4 py-2.5 border-b border-zinc-800/30 last:border-b-0 hover:bg-zinc-800/20 transition-colors"
                          style={{ gridTemplateColumns: "72px 180px 20px 1fr 110px 100px 100px" }}>

                          {/* Time — only show on first row of time group */}
                          {j === 0 ? (
                            isNextSlot
                              ? <span className="inline-flex w-fit items-center px-1.5 py-0.5 rounded bg-red-500 text-white text-[10px] font-bold leading-none">{time}</span>
                              : <span className={`text-[12px] font-mono font-semibold ${isPast ? "text-zinc-600" : "text-amber-400"}`}>{time}</span>
                          ) : <span/>}

                          {/* Flag + country */}
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span className="text-[15px] leading-none">{cc.flag}</span>
                            <span className={`text-[11px] truncate ${isPast ? "text-zinc-600" : "text-zinc-400"}`}>{cc.name}</span>
                          </div>

                          {/* Impact bars */}
                          <div className="flex justify-center">
                            <ImpactBars impact={ev.impact}/>
                          </div>

                          {/* Event name */}
                          <div className={`text-[12px] font-medium truncate pl-2 ${isPast ? "text-zinc-500" : "text-zinc-200"}`}>
                            {ev.event}
                          </div>

                          {/* Actual */}
                          <div className="text-right">
                            {actual == null
                              ? <span className="text-[10px] text-amber-500/70 font-medium">Coming soon</span>
                              : <span className={`text-[12px] font-mono font-semibold ${actualColor}`}>{actual}</span>}
                          </div>

                          {/* Forecast */}
                          <div className="text-[12px] font-mono text-zinc-500 text-right">{forecast ?? "—"}</div>

                          {/* Prior */}
                          <div className="text-[12px] font-mono text-zinc-600 text-right">{prior ?? "—"}</div>
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── EARNINGS SUB-TAB ──────────────────────────────────────────────── */}
      {calSubTab === "earnings" && (
        <div>
          <div className="text-[11px] font-semibold text-zinc-500 mb-3 uppercase tracking-wider">
            {calFmtDateHeader(selectedDay)}
            {dayEarnings.length > 0 && <span className="text-zinc-700 font-normal normal-case ml-2">· {dayEarnings.length} companies</span>}
          </div>

          {dayEarnings.length === 0 ? (
            <div className="py-16 text-center rounded-xl border border-zinc-800/40">
              <p className="text-[13px] text-zinc-600 italic">No earnings for this day</p>
              {!earningsData && <p className="text-[11px] text-zinc-700 mt-1.5">Run <code className="bg-zinc-800 px-1 py-0.5 rounded text-zinc-400">earnings_calendar.py</code> to generate data</p>}
            </div>
          ) : (
            <div className="rounded-xl border border-zinc-800/60 overflow-x-auto">
              {/* Table header */}
              <div className="grid items-center border-b border-zinc-800/60 bg-zinc-800/40 px-3 py-2 min-w-[900px]"
                   style={{ gridTemplateColumns: "90px 1fr 90px 90px 80px 80px 90px 90px 90px 90px" }}>
                {["Ticker","Company","Time","Mkt Cap","EPS Est","EPS Act","EPS Surp","Rev Est","Rev Act","Rev Surp"].map((col, ci) => (
                  <span key={ci} className={`text-[10px] font-semibold text-zinc-500 uppercase tracking-wider ${ci >= 3 ? "text-right" : ""} ${ci === 2 ? "!text-left" : ""}`}>{col}</span>
                ))}
              </div>

              {/* Thematic Scanner stocks first */}
              {(() => {
                const thematic = dayEarnings.filter(e => tickerThemeMap[e.ticker]);
                const rest     = dayEarnings.filter(e => !tickerThemeMap[e.ticker]);
                const bmo      = rest.filter(e => e.time_of_day === "BMO");
                const amc      = rest.filter(e => e.time_of_day === "AMC");
                const unk      = rest.filter(e => !e.time_of_day || (e.time_of_day !== "BMO" && e.time_of_day !== "AMC"));
                return <>
                  {thematic.length > 0 && <>
                    <div className="px-3 py-1.5 bg-sky-900/20 border-b border-sky-800/30">
                      <span className="text-[9px] text-sky-500 uppercase tracking-widest font-semibold">Thematic Scanner</span>
                    </div>
                    {thematic.map((e, i) => <EarningsRow key={`th-${i}`} e={e}/>)}
                  </>}
                  {bmo.length > 0 && <>
                    <div className="px-3 py-1.5 bg-zinc-800/30 border-y border-zinc-800/60">
                      <span className="text-[9px] text-zinc-600 uppercase tracking-widest font-semibold">Before Market Open</span>
                    </div>
                    {bmo.map((e, i) => <EarningsRow key={`bmo-${i}`} e={e}/>)}
                  </>}
                  {amc.length > 0 && <>
                    <div className="px-3 py-1.5 bg-zinc-800/30 border-y border-zinc-800/60">
                      <span className="text-[9px] text-zinc-600 uppercase tracking-widest font-semibold">After Market Close</span>
                    </div>
                    {amc.map((e, i) => <EarningsRow key={`amc-${i}`} e={e}/>)}
                  </>}
                  {unk.map((e, i) => <EarningsRow key={`unk-${i}`} e={e}/>)}
                </>;
              })()}
            </div>
          )}
        </div>
      )}

      {/* ── AI Earnings Analysis Drawer ────────────────────────────────── */}
      {analysisStock && (
        <EarningsAnalysisDrawer
          stock={analysisStock}
          onClose={() => setAnalysisStock(null)}
          themeName={tickerThemeMap[analysisStock.ticker] || null}
        />
      )}
    </div>
  );
};

// ── Market Breadth Tab ────────────────────────────────────────────────────────

const BREADTH_GEMINI_KEY = process.env.REACT_APP_GEMINI_KEY || "";
const BREADTH_CACHE_KEY  = "gemini_breadth_v1";

async function fetchGeminiBreadthAnalysis(payload) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${BREADTH_GEMINI_KEY}`;
  const body = {
    contents: [{
      parts: [{
        text: `You are a concise stock market analyst. Given these market breadth numbers, write exactly 3 sentences: (1) current breadth regime, (2) key risk or opportunity, (3) tactical stance for swing traders. Be direct and specific.\n\nData: ${JSON.stringify(payload)}`,
      }],
    }],
    generationConfig: { temperature: 0.4, maxOutputTokens: 180 },
  };
  const res  = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const json = await res.json();
  return json?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || null;
}

const GeminiBreathAnalysis = ({ mc, internalsData }) => {
  const [text, setText] = useState(null);
  const [loading, setLoading] = useState(false);
  const todayKey = new Date().toISOString().slice(0, 10);

  useEffect(() => {
    const cached = (() => { try { const r = JSON.parse(localStorage.getItem(BREADTH_CACHE_KEY)); return r?.date === todayKey ? r.text : null; } catch { return null; } })();
    if (cached) { setText(cached); return; }
    if (!BREADTH_GEMINI_KEY || !mc) return;
    setLoading(true);
    const payload = {
      signal:        mc.signal,
      adv_pct:       mc.adv_dec?.adv_pct,
      dec_pct:       mc.adv_dec?.dec_pct,
      new_high:      mc.new_hl?.new_high,
      new_low:       mc.new_hl?.new_low,
      above_sma50:   mc.sma50_counts?.above_pct,
      above_sma200:  mc.sma200_counts?.above_pct,
      breadth_50d:   mc.breadth_50d,
      breadth_200d:  mc.breadth_200d,
      vix:           internalsData?.vix,
      t2108:         internalsData?.t2108,
      yield_10y:     internalsData?.yield_10y,
    };
    fetchGeminiBreadthAnalysis(payload)
      .then(t => {
        if (t) { setText(t); try { localStorage.setItem(BREADTH_CACHE_KEY, JSON.stringify({ date: todayKey, text: t })); } catch { /* quota */ } }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [mc, internalsData, todayKey]);

  if (!mc) return null;

  return (
    <div className="mb-4 border border-emerald-800/40 bg-emerald-900/10 rounded-xl p-4">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-[10px] font-bold text-emerald-500 uppercase tracking-wider">✦ GEMINI BREADTH READ</span>
        {loading && <RefreshCw size={10} className="text-emerald-600 animate-spin"/>}
        {!BREADTH_GEMINI_KEY && <span className="text-[10px] text-zinc-600">Set REACT_APP_GEMINI_KEY to enable</span>}
      </div>
      {text
        ? <p className="text-[13px] text-zinc-200 leading-relaxed">{text}</p>
        : !loading && <p className="text-[12px] text-zinc-600 italic">{BREADTH_GEMINI_KEY ? "Awaiting data…" : "API key not configured"}</p>
      }
    </div>
  );
};

const MarketBreadthTab = ({ data, internalsData, econData }) => {
  const mc  = data?.market_condition || {};
  const adv = mc.adv_dec;
  const hl  = mc.new_hl;
  const s50 = mc.sma50_counts;
  const s200= mc.sma200_counts;

  // ── 8 metric cards ──────────────────────────────────────────────────────────
  const metrics = [
    {
      label: "UP 4%+",
      value: mc.up4_pct  != null ? `${mc.up4_pct.toFixed(1)}%`  : adv ? `${adv.adv_pct.toFixed(1)}%` : "—",
      sub:   mc.up4_count != null ? `${mc.up4_count} stocks` : adv ? `${adv.advancing} adv` : null,
      color: (mc.up4_pct ?? adv?.adv_pct ?? 0) >= 50 ? "text-emerald-400" : "text-red-400",
    },
    {
      label: "DN 4%+",
      value: mc.dn4_pct  != null ? `${mc.dn4_pct.toFixed(1)}%`  : adv ? `${adv.dec_pct.toFixed(1)}%` : "—",
      sub:   mc.dn4_count != null ? `${mc.dn4_count} stocks` : adv ? `${adv.declining} dec` : null,
      color: (mc.dn4_pct ?? adv?.dec_pct ?? 0) >= 25 ? "text-red-400" : "text-zinc-400",
    },
    {
      label: "T2108",
      value: internalsData?.t2108 != null ? `${internalsData.t2108.toFixed(1)}%` : "—",
      sub:   internalsData?.t2108 != null
               ? internalsData.t2108 >= 60 ? "Overbought" : internalsData.t2108 <= 20 ? "Oversold" : "Neutral"
               : null,
      color: internalsData?.t2108 >= 60 ? "text-amber-400" : internalsData?.t2108 <= 20 ? "text-emerald-400" : "text-zinc-300",
    },
    {
      label: "S&P 500 Signal",
      value: mc.signal ? mc.signal.charAt(0).toUpperCase() + mc.signal.slice(1) : "—",
      sub:   mc.spy?.sma200_pct != null ? `SMA200: ${mc.spy.sma200_pct > 0 ? "+" : ""}${mc.spy.sma200_pct.toFixed(1)}%` : null,
      color: mc.signal === "green" ? "text-emerald-400" : mc.signal === "yellow" ? "text-amber-400" : mc.signal === "red" ? "text-red-400" : "text-zinc-400",
    },
    {
      label: "SMA50 Above",
      value: s50?.above_pct != null ? `${s50.above_pct.toFixed(1)}%`
           : mc.breadth_50d  != null ? `${mc.breadth_50d.toFixed(1)}%`
           : internalsData?.s5fi_50d != null ? `${internalsData.s5fi_50d.toFixed(1)}%` : "—",
      sub:   s50?.above != null ? `${s50.above} / ${(s50.above + (s50.below || 0))}` : null,
      color: (s50?.above_pct ?? mc.breadth_50d ?? internalsData?.s5fi_50d ?? 0) >= 60 ? "text-emerald-400"
           : (s50?.above_pct ?? mc.breadth_50d ?? internalsData?.s5fi_50d ?? 0) >= 40 ? "text-yellow-400" : "text-red-400",
    },
    {
      label: "SMA200 Above",
      value: s200?.above_pct != null ? `${s200.above_pct.toFixed(1)}%`
           : mc.breadth_200d  != null ? `${mc.breadth_200d.toFixed(1)}%`
           : internalsData?.mmth_200d != null ? `${internalsData.mmth_200d.toFixed(1)}%` : "—",
      sub:   s200?.above != null ? `${s200.above} / ${(s200.above + (s200.below || 0))}` : null,
      color: (s200?.above_pct ?? mc.breadth_200d ?? internalsData?.mmth_200d ?? 0) >= 60 ? "text-emerald-400"
           : (s200?.above_pct ?? mc.breadth_200d ?? internalsData?.mmth_200d ?? 0) >= 40 ? "text-yellow-400" : "text-red-400",
    },
    {
      label: "UP 25% (Qtrly)",
      value: mc.up25_pct != null ? `${mc.up25_pct.toFixed(1)}%` : hl ? `${hl.nh_pct.toFixed(1)}%` : "—",
      sub:   mc.up25_count != null ? `${mc.up25_count} stocks` : hl ? `${hl.new_high} new highs` : null,
      color: (mc.up25_pct ?? hl?.nh_pct ?? 0) >= 20 ? "text-emerald-400" : "text-zinc-400",
    },
    {
      label: "10Y Yield",
      value: internalsData?.yield_10y != null ? `${internalsData.yield_10y.toFixed(2)}%` : "—",
      sub:   internalsData?.yield_10y != null
               ? internalsData.yield_10y >= 4.5 ? "Elevated — risk-off pressure" : internalsData.yield_10y <= 3.8 ? "Low — growth supportive" : "Moderate"
               : null,
      color: internalsData?.yield_10y >= 4.5 ? "text-red-400" : internalsData?.yield_10y <= 3.8 ? "text-emerald-400" : "text-zinc-300",
    },
  ];

  // ── Right sidebar verdicts ───────────────────────────────────────────────────
  const sma50Val  = s50?.above_pct ?? mc.breadth_50d ?? internalsData?.s5fi_50d;
  const sma200Val = s200?.above_pct ?? mc.breadth_200d ?? internalsData?.mmth_200d;
  const t2108Val  = internalsData?.t2108;

  const shortTermVerdict = (() => {
    if (mc.signal === "green" && (sma50Val ?? 0) >= 55) return { label: "Bullish", cls: "text-emerald-400", detail: "Breadth expanding, momentum leaders valid" };
    if (mc.signal === "red"   || (sma50Val ?? 50) < 35) return { label: "Bearish", cls: "text-red-400",     detail: "Breadth contracting, avoid new longs" };
    return { label: "Neutral", cls: "text-yellow-400", detail: "Mixed signals — selective entries only" };
  })();
  const quarterlyVerdict = (() => {
    if ((sma200Val ?? 0) >= 65 && mc.signal !== "red") return { label: "Stage 2 Uptrend", cls: "text-emerald-400", detail: "Majority of S&P above 200D MA" };
    if ((sma200Val ?? 50) < 40) return { label: "Stage 4 Downtrend", cls: "text-red-400", detail: "Broad distribution, cash preservation" };
    return { label: "Transition Zone", cls: "text-yellow-400", detail: "Trend undefined — reduce size" };
  })();
  const t2108Verdict = (() => {
    if (t2108Val == null) return { label: "N/A", cls: "text-zinc-600", detail: "Data unavailable" };
    if (t2108Val >= 70) return { label: "Overbought", cls: "text-amber-400", detail: `${t2108Val.toFixed(1)}% — expect mean reversion` };
    if (t2108Val <= 20) return { label: "Oversold", cls: "text-emerald-400", detail: `${t2108Val.toFixed(1)}% — watch for reversal` };
    return { label: "Neutral", cls: "text-zinc-300", detail: `${t2108Val.toFixed(1)}% — no extreme` };
  })();

  // ── Macro risk flags from econData ──────────────────────────────────────────
  const macroFlags = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    const events = [...(econData?.today || []), ...(econData?.upcoming || [])]
      .filter(e => e.date === today && (e.impact === "High" || e.impact === "🔴") && (e.currency === "USD" || !e.currency));
    return events.slice(0, 5);
  }, [econData]);

  // ── Leading themes ───────────────────────────────────────────────────────────
  const leadingThemes = useMemo(() => {
    const rankings = data?.finviz_theme_rankings || data?.theme_rankings || [];
    return [...rankings]
      .filter(t => t.perf_1d != null)
      .sort((a, b) => (b.perf_1d || 0) - (a.perf_1d || 0))
      .slice(0, 5);
  }, [data]);

  // ── Internals block ──────────────────────────────────────────────────────────
  const internals = [
    { label: "VIX",    value: internalsData?.vix      != null ? internalsData.vix.toFixed(2)      : "—", color: internalsData?.vix >= 25 ? "text-red-400" : internalsData?.vix <= 15 ? "text-emerald-400" : "text-zinc-300" },
    { label: "TICK",   value: internalsData?.tick     != null ? internalsData.tick.toFixed(0)     : "—", color: internalsData?.tick > 600 ? "text-emerald-400" : internalsData?.tick < -600 ? "text-red-400" : "text-zinc-300" },
    { label: "TRIN",   value: internalsData?.trin     != null ? internalsData.trin.toFixed(2)     : "—", color: internalsData?.trin > 1.5 ? "text-red-400" : internalsData?.trin < 0.7 ? "text-emerald-400" : "text-zinc-300" },
    { label: "S5FI",   value: internalsData?.s5fi_50d  != null ? `${internalsData.s5fi_50d.toFixed(1)}%`  : mc.breadth_50d  != null ? `${mc.breadth_50d.toFixed(1)}%`  : "—", color: "text-zinc-300" },
    { label: "MMTH",   value: internalsData?.mmth_200d != null ? `${internalsData.mmth_200d.toFixed(1)}%` : mc.breadth_200d != null ? `${mc.breadth_200d.toFixed(1)}%` : "—", color: "text-zinc-300" },
    { label: "10Y",    value: internalsData?.yield_10y != null ? `${internalsData.yield_10y.toFixed(2)}%` : "—", color: internalsData?.yield_10y >= 4.5 ? "text-red-400" : "text-zinc-300" },
  ];

  // ── Breadth bar table rows ───────────────────────────────────────────────────
  const breadthRows = [
    adv  && { label: "Advancing / Declining", leftPct: adv.adv_pct,  rightPct: adv.dec_pct,  leftCount: adv.advancing,  rightCount: adv.declining },
    hl   && { label: "New High / New Low",    leftPct: hl.nh_pct,   rightPct: hl.nl_pct,   leftCount: hl.new_high,    rightCount: hl.new_low },
    s50  && { label: "Above SMA50",           leftPct: s50.above_pct, rightPct: s50.below_pct, leftCount: s50.above, rightCount: s50.below },
    s200 && { label: "Above SMA200",          leftPct: s200.above_pct, rightPct: s200.below_pct, leftCount: s200.above, rightCount: s200.below },
  ].filter(Boolean);

  return (
    <div className="max-w-[1560px] mx-auto px-4 pt-4 pb-8 flex items-start gap-5">
      {/* ── Left main area ────────────────────────────────────────────────── */}
      <div className="flex-1 min-w-0">
        <GeminiBreathAnalysis mc={mc} internalsData={internalsData} />

        {/* 8 metric chips — compact single row */}
        <div className="flex flex-wrap gap-2 mb-4">
          {metrics.map(m => (
            <div key={m.label} className="flex-1 min-w-[100px] bg-zinc-900/60 border border-zinc-800/60 rounded-lg px-2.5 py-1.5">
              <div className="text-[9px] text-zinc-500 uppercase tracking-wider">{m.label}</div>
              <div className={`text-[15px] font-bold font-mono leading-tight ${m.color}`}>{m.value}</div>
              {m.sub && <div className="text-[9px] text-zinc-600 truncate">{m.sub}</div>}
            </div>
          ))}
        </div>

        {/* ── Unified breadth + index row card ──────────────────────────── */}
        {(breadthRows.length > 0 || mc.spy || mc.qqq) && (
          <div className="bg-zinc-900/60 border border-zinc-800/60 rounded-xl overflow-hidden mb-5">
            {/* Title header */}
            <div className="px-4 py-2 border-b border-zinc-800/60 flex items-center gap-2">
              <span className="text-[11px] font-semibold text-zinc-300">Market Breadth — NYSE / S&P 500</span>
              {data?.last_updated && <span className="text-[10px] text-zinc-600">{data.last_updated}</span>}
            </div>

            {/* Single horizontal row */}
            <div className="flex flex-wrap lg:flex-nowrap divide-y lg:divide-y-0 lg:divide-x divide-zinc-800/60">

              {/* Breadth columns 1–4 */}
              {breadthRows.map((row, i) => {
                const lp = row.leftPct ?? 0;
                const rp = row.rightPct ?? 0;
                return (
                  <div key={row.label}
                    className="flex-1 min-w-[140px] px-3 py-2.5 flex flex-col justify-between gap-1">
                    <div className="text-[9px] text-zinc-500 uppercase tracking-wide truncate">{row.label}</div>
                    <div className="flex items-baseline gap-1 text-[12px] font-mono font-semibold leading-none">
                      <span className="text-emerald-400">{lp.toFixed(1)}%</span>
                      {row.leftCount  != null && <span className="text-[9px] text-zinc-600">({row.leftCount})</span>}
                      <span className="text-zinc-300 mx-0.5">/</span>
                      <span className="text-red-500">{rp.toFixed(1)}%</span>
                      {row.rightCount != null && <span className="text-[9px] text-zinc-600">({row.rightCount})</span>}
                    </div>
                    <div className="flex h-[4px] rounded-full overflow-hidden gap-px">
                      <div className="bg-emerald-500/70 rounded-l-full" style={{ width: `${lp}%` }} />
                      <div className="bg-red-500/70 rounded-r-full"     style={{ width: `${rp}%` }} />
                    </div>
                  </div>
                );
              })}

              {/* Prominent divider before index columns */}
              {(mc.spy || mc.qqq) && breadthRows.length > 0 && (
                <div className="hidden lg:block w-px bg-zinc-600/60 self-stretch" />
              )}

              {/* SPY / QQQ columns */}
              {[["SPY", mc.spy], ["QQQ", mc.qqq]].map(([name, idx]) => idx && (
                <div key={name} className="flex-1 min-w-[130px] px-3 py-2.5 flex flex-col gap-1">
                  <div className="text-[10px] font-semibold text-zinc-300">{name}</div>
                  <div className="flex gap-4">
                    {[
                      { k: "sma50_pct",  l: "vs SMA50"  },
                      { k: "sma200_pct", l: "vs SMA200" },
                      { k: "ema10_pct",  l: "vs EMA10"  },
                    ].filter(({ k }) => idx[k] != null).map(({ k, l }) => (
                      <div key={k}>
                        <div className="text-[9px] text-zinc-600">{l}</div>
                        <div className={`text-[12px] font-mono font-bold ${idx[k] > 0 ? "text-emerald-400" : "text-red-400"}`}>
                          {idx[k] > 0 ? "+" : ""}{idx[k].toFixed(2)}%
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}

            </div>
          </div>
        )}

        {/* ── Stockbee Market Monitor table ─────────────────────────────── */}
        <div className="mt-5">
          <MarketBreadthMonitor />
        </div>
      </div>

      {/* ── Right sidebar ─────────────────────────────────────────────────── */}
      <div className="w-52 flex-shrink-0 flex flex-col gap-4">

        {/* Daily Brief cards */}
        <div className="bg-zinc-900/60 border border-zinc-800/60 rounded-xl p-3">
          <div className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mb-2.5">Daily Brief</div>
          <div className="flex flex-col gap-2.5">
            {[
              { label: "Short-term",  verdict: shortTermVerdict },
              { label: "Quarterly",   verdict: quarterlyVerdict },
              { label: "T2108",       verdict: t2108Verdict },
            ].map(({ label, verdict }) => (
              <div key={label}>
                <div className="text-[10px] text-zinc-600 mb-0.5">{label}</div>
                <div className={`text-[12px] font-semibold ${verdict.cls} leading-tight`}>{verdict.label}</div>
                <div className="text-[10px] text-zinc-600 leading-tight mt-0.5">{verdict.detail}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Internals block */}
        <div className="bg-zinc-900/60 border border-zinc-800/60 rounded-xl p-3">
          <div className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mb-2">Internals</div>
          <div className="flex flex-col gap-1">
            {internals.map(({ label, value, color }) => (
              <div key={label} className="flex items-center justify-between">
                <span className="text-[11px] text-zinc-500">{label}</span>
                <span className={`text-[12px] font-mono font-semibold ${color}`}>{value}</span>
              </div>
            ))}
          </div>
          {internalsData?.generated_at && (
            <div className="text-[9px] text-zinc-700 mt-2 border-t border-zinc-800/40 pt-1.5">
              {new Date(internalsData.generated_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </div>
          )}
        </div>

        {/* Leading Themes */}
        {leadingThemes.length > 0 && (
          <div className="bg-zinc-900/60 border border-zinc-800/60 rounded-xl p-3">
            <div className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mb-2">Leading Themes · 1D</div>
            <div className="flex flex-col gap-1.5">
              {leadingThemes.map((t, i) => (
                <div key={t.name} className="flex items-center gap-1.5">
                  <span className="text-[10px] text-zinc-700 font-mono w-4 text-right">{i + 1}</span>
                  <span className="text-[11px] text-zinc-300 flex-1 truncate leading-tight">{t.name}</span>
                  <span className={`text-[11px] font-mono font-bold flex-shrink-0 ${(t.perf_1d || 0) > 0 ? "text-emerald-400" : "text-red-400"}`}>
                    {(t.perf_1d || 0) > 0 ? "+" : ""}{(t.perf_1d || 0).toFixed(1)}%
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Macro Risk Flags */}
        <div className="bg-zinc-900/60 border border-zinc-800/60 rounded-xl p-3">
          <div className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mb-2">Macro Risk · Today</div>
          {macroFlags.length > 0 ? (
            <div className="flex flex-col gap-2">
              {macroFlags.map((e, i) => (
                <div key={i} className="flex items-start gap-1.5">
                  <span className="text-[9px] font-bold text-red-400 mt-0.5 flex-shrink-0">●</span>
                  <div>
                    <div className="text-[11px] text-zinc-300 leading-tight">{e.event || e.name}</div>
                    {e.time && <div className="text-[9px] text-zinc-600">{e.time} ET</div>}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-[11px] text-zinc-600 italic">No high-impact USD events today</div>
          )}
        </div>

      </div>
    </div>
  );
};

const LeaderColumn = ({ ibkrThemesData, gapperData, mode }) => {
  // mode: "scanner" (ibkr power leaders) | "gapper" (gate-passing gappers + peers)
  const hoverTimer = useRef(null);
  const [hovered, setHovered] = useState(null);

  const startHover = (ticker, rect) => {
    hoverTimer.current = setTimeout(() => setHovered({ ticker, rect }), 2000);
  };
  const cancelHover = () => {
    clearTimeout(hoverTimer.current);
  };

  const leaders = useMemo(() => {
    if (mode === "gapper") {
      const gappers = gapperData?.gappers || [];
      const rows = [];
      const seen = new Set();
      for (const g of gappers) {
        if (g.meets_all_gates) {
          if (!seen.has(g.ticker)) { seen.add(g.ticker); rows.push({ ticker: g.ticker, rs: g.rs_52w ?? null, isPeer: false, price: g.price ?? null, gap_pct: g.gap_pct ?? null }); }
          for (const p of (g.peer_tickers || [])) {
            if (!seen.has(p)) { seen.add(p); rows.push({ ticker: p, rs: null, isPeer: true, price: null, gap_pct: null }); }
          }
        }
      }
      return rows.slice(0, 12);
    }
    // scanner mode: collect all leaders that pass all 5 gates
    const rows = [];
    const seen = new Set();
    for (const pt of (ibkrThemesData?.power_themes || [])) {
      for (const l of (pt.leaders || [])) {
        if ((l.gates_passed ?? 0) === 5 && !seen.has(l.ticker)) {
          seen.add(l.ticker);
          rows.push({ ticker: l.ticker, rs: l.rs_52w ?? null, isPeer: false });
        }
      }
    }
    return rows.sort((a, b) => (b.rs ?? 0) - (a.rs ?? 0)).slice(0, 12);
  }, [ibkrThemesData, gapperData, mode]);

  const isLive = ibkrThemesData?.data_source === "ibkr";
  const dataSource = ibkrThemesData?.data_source || null;

  return (
    <div className="w-48 flex-shrink-0 flex flex-col gap-0 bg-zinc-900/60 border border-zinc-800/60 rounded-xl p-3 self-start sticky top-[60px]">
      {/* Header */}
      <div className="mb-2">
        <div className="text-[12px] font-semibold text-zinc-200 mb-0.5">
          {mode === "gapper" ? "Gate Leaders" : "Leaders — All Themes"}
        </div>
        <div className="text-[9px] text-zinc-600 leading-tight">
          {mode === "gapper"
            ? "Gappers passing all 5 gates + peers"
            : "RS>85 · Price>$12 · Vol>$100M · Cap>$2B · ADR≥4%"}
        </div>
      </div>

      {/* Leaders list */}
      <div className="flex flex-col gap-0.5 mb-3">
        {leaders.length > 0 && (
          <div className="flex items-center justify-between text-[9px] text-zinc-600 pb-0.5 mb-0.5 border-b border-zinc-800/60">
            <span>Ticker · Price · Chg</span>
            <span>RS</span>
          </div>
        )}
        {leaders.length === 0 ? (
          <div className="text-[11px] text-zinc-600 py-2 text-center">No qualifying leaders</div>
        ) : leaders.map(({ ticker, rs, isPeer, price, gap_pct }) => {
          const rsCls = rs != null && rs >= 90 ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
                      : rs != null && rs >= 85 ? "bg-yellow-500/20 text-yellow-400 border-yellow-500/30"
                      : "bg-zinc-800/60 text-zinc-500 border-zinc-700/40";
          return (
            <div key={ticker}
              className={`flex items-center justify-between px-1.5 py-1 rounded hover:bg-zinc-800/50 transition-colors ${isPeer ? "opacity-60" : ""}`}>
              <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
                <span
                  className="text-[12px] font-mono font-semibold text-blue-400 cursor-pointer hover:text-blue-300 transition-colors leading-none"
                  onClick={e => { clearTimeout(hoverTimer.current); const rect = e.currentTarget.getBoundingClientRect(); setHovered(prev => prev?.ticker === ticker ? null : { ticker, rect }); }}
                  onMouseEnter={e => startHover(ticker, e.currentTarget.getBoundingClientRect())}
                  onMouseLeave={cancelHover}
                >
                  {ticker}
                  {isPeer && <span className="text-[8px] text-zinc-600 ml-0.5">peer</span>}
                </span>
                {price != null && <span className="text-[9px] font-mono text-zinc-500">${price.toFixed(2)}</span>}
                {gap_pct != null && <span className="text-[9px] font-mono font-bold text-emerald-400">+{gap_pct.toFixed(1)}%</span>}
              </div>
              {rs != null && (
                <span className={`text-[9px] font-bold font-mono px-1 py-0.5 rounded border leading-none flex-shrink-0 ${rsCls}`}>
                  {rs}
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* Separator */}
      <div className="border-t border-zinc-800/60 mb-2"/>

      {/* Active Alerts */}
      <div className="mb-3">
        <div className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mb-1.5">Active Alerts</div>
        {ibkrThemesData?.power_themes?.slice(0, 2).map(pt => pt.theme_rs >= 90 ? (
          <div key={pt.name} className="mb-1 p-1.5 rounded-lg bg-emerald-500/5 border border-emerald-500/15">
            <div className="text-[10px] font-bold text-emerald-400">{pt.name.split(' ')[0]} {pt.name.split(' ')[1] || ''} RS &gt; 90</div>
            <div className="text-[9px] text-zinc-600 mt-0.5 font-mono">
              {isLive ? '● ntfy.sh ✓' : '◐ Pending'}
            </div>
          </div>
        ) : null).filter(Boolean)}
        {(!ibkrThemesData?.power_themes?.some(pt => pt.theme_rs >= 90)) && (
          <div className="text-[11px] text-zinc-600 py-1">No active alerts</div>
        )}
      </div>

      {/* Separator */}
      <div className="border-t border-zinc-800/60 mb-2"/>

      {/* IBKR TWS Scanner */}
      <div>
        <div className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mb-1.5">
          IBKR TWS Scanner
        </div>
        {ibkrThemesData?.ibkr_scanner?.length > 0 ? (
          <div className="flex flex-col gap-0.5">
            <div className="text-[9px] text-zinc-600 mb-1">Mirroring: Top Pre-Mkt Gainers</div>
            {ibkrThemesData.ibkr_scanner.slice(0, 4).map(row => (
              <div key={row.ticker} className="flex items-center justify-between px-1 py-0.5 rounded hover:bg-zinc-800/40 transition-colors">
                <span className="text-[11px] font-mono font-semibold text-zinc-200">{row.ticker}</span>
                {row.change_pct != null && (
                  <span className={`text-[10px] font-mono font-bold ${row.change_pct >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {row.change_pct >= 0 ? '+' : ''}{Number(row.change_pct).toFixed(1)}%
                  </span>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="text-[11px] text-zinc-600">
            {isLive ? 'No scanner data' : 'Connect IB Gateway'}
          </div>
        )}
      </div>

      {hovered && <TVPopup ticker={hovered.ticker} anchorRect={hovered.rect} onClose={() => setHovered(null)}/>}
    </div>
  );
};

const GapperScanner = ({ earningsData, ibkrThemesData }) => {
  const creditRegime = useMarketStore((s) => s.creditRegime);
  const [gapperData, setGapperData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [hovered, setHovered] = useState(null);
  const [tickerDb, setTickerDb] = useState({});

  // Filter state — human-friendly units: PMVol/AvgVol in K, MktCap in $B, DolVol in $M
  const [fMinGap,    setFMinGap]    = useState(0);
  const [fMinPMVol,  setFMinPMVol]  = useState(0);    // K
  const [fMinPrice,  setFMinPrice]  = useState(0);
  const [fMinAvgVol, setFMinAvgVol] = useState(0);    // K
  const [fMinMktCap, setFMinMktCap] = useState(0);      // $B
  const [fMinDolVol, setFMinDolVol] = useState(0);     // $M
  const [modalData, setModalData] = useState(null);
  const [chartAnchorRect, setChartAnchorRect] = useState(null);

  useEffect(() => {
    fetch(`${process.env.PUBLIC_URL}/stock_db.json`)
      .catch(() => fetch(`${process.env.PUBLIC_URL}/all_tickers.json`))
      .then(r => r.json())
      .then(arr => {
        const map = {};
        arr.forEach(t => { map[t.ticker] = t; });
        setTickerDb(map);
      })
      .catch(() => {});
  }, []);

  // Gapper data — poll every 5 min
  useEffect(() => {
    const load = () => {
      setLoading(true);
      fetch(process.env.PUBLIC_URL + "/gapper_data.json?v=" + Date.now())
        .then(r => r.ok ? r.json() : null)
        .then(d => { if (d) setGapperData(d); setLoading(false); })
        .catch(() => setLoading(false));
    };
    load();
    const id = setInterval(load, 5 * 60 * 1000);
    return () => clearInterval(id);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const gapperTickerSet = useMemo(
    () => new Set((gapperData?.gappers || []).map(g => g.ticker)),
    [gapperData]
  );

  if (loading) return <div className="flex items-center justify-center py-20"><RefreshCw size={20} className="text-zinc-500 animate-spin"/></div>;

  if (!gapperData || !gapperData.gappers?.length) return (
    <div className="text-center py-20 text-zinc-500">
      <Clock size={28} className="mx-auto mb-3 opacity-40"/>
      <p className="text-sm font-medium">No pre-market data available</p>
      <p className="text-[13px] mt-1 text-zinc-600">Scanner runs weekdays 08:05 AM ET</p>
    </div>
  );

  const GRADE_RANK = { "A+": 4, "A": 3, "B": 2, "C": 1 };
  const filtered = gapperData.gappers.filter(g =>
    g.gap_pct   >= fMinGap &&
    g.pm_volume >= fMinPMVol * 1000 &&
    g.price     >= fMinPrice &&
    (g.avg_vol_10d || 0)     >= fMinAvgVol * 1000 &&
    (g.mkt_cap   || 0)       >= fMinMktCap * 1e9 &&
    (g.avg_dollar_vol || g.price * (g.avg_vol_10d || 0)) >= fMinDolVol * 1e6 &&
    // In Stress regime: hide C-grade gappers to reduce noise
    (creditRegime !== "Stress" || (g.grade && g.grade !== "C"))
  ).sort((a, b) => (GRADE_RANK[b.grade] || 0) - (GRADE_RANK[a.grade] || 0));

  const resetFilters = () => {
    setFMinGap(5); setFMinPMVol(200); setFMinPrice(5);
    setFMinAvgVol(500); setFMinMktCap(2); setFMinDolVol(50);
  };

  return (
    <>
    <div className="max-w-[1900px] mx-auto px-4 py-4 flex items-start gap-4">
      <div className="flex-1 min-w-0">
      <EarningsStrip
        earningsData={earningsData}
        gapperTickers={gapperTickerSet}
        onTickerClick={(ticker, rect) => setHovered(prev => prev?.ticker === ticker ? null : { ticker, rect })}
      />
      {/* Filter Bar */}
      <div className="mb-4 p-3 bg-zinc-800/40 border border-zinc-700/40 rounded-lg">
        <div className="grid grid-cols-6 gap-3 mb-2">
          <FInput label="Min Gap (%)"          value={fMinGap}    onChange={setFMinGap}    hint="e.g. 5 = 5%"/>
          <FInput label="Min PM Vol (K)"       value={fMinPMVol}  onChange={setFMinPMVol}  hint={`= ${fmtNum(fMinPMVol * 1000)}`}/>
          <FInput label="Min Price ($)"        value={fMinPrice}  onChange={setFMinPrice}/>
          <FInput label="Min Avg Vol 10d (K)"  value={fMinAvgVol} onChange={setFMinAvgVol} hint={`= ${fmtNum(fMinAvgVol * 1000)}`}/>
          <FInput label="Min Mkt Cap ($B)"     value={fMinMktCap} onChange={setFMinMktCap} hint={`= ${fmtCap(fMinMktCap * 1e9)}`}/>
          <FInput label="Min Avg $ Vol ($M)"   value={fMinDolVol} onChange={setFMinDolVol} hint={`= ${fmtVol(fMinDolVol * 1e6)}`}/>
        </div>
        <div className="flex items-center justify-between pt-1 border-t border-zinc-700/30">
          <button onClick={resetFilters} className="text-[12px] px-2.5 py-1 bg-zinc-700/50 border border-zinc-600/40 rounded text-zinc-400 hover:text-zinc-200 hover:border-zinc-500 transition-colors">
            Reset
          </button>
          <span className="text-[12px] text-zinc-500">
            Scanned: <span className="text-zinc-400">{gapperData.scan_time}</span>
            <span className="ml-3 text-zinc-600">{filtered.length} / {gapperData.gappers.length} shown</span>
            <span className="ml-3 text-zinc-600">· Next: <span className="text-zinc-500">{getNextGapperScanTime(gapperData.scan_time)}</span></span>
          </span>
        </div>
      </div>

      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-bold text-zinc-100 tracking-wide uppercase">Institutional Gappers</h2>
        {filtered.length === 0 && (
          <p className="text-[13px] text-zinc-500">No gappers match current filters — try loosening the criteria</p>
        )}
      </div>

      <div className="overflow-x-auto rounded-lg border border-zinc-700/40">
        <table className="w-full table-fixed min-w-[1300px]">
          <colgroup>
            <col style={{width:"80px"}}/>
            <col style={{width:"80px"}}/>
            <col style={{width:"70px"}}/>
            <col style={{width:"55px"}}/>
            <col style={{width:"60px"}}/>
            <col style={{width:"55px"}}/>
            <col style={{width:"65px"}}/>
            <col style={{width:"90px"}}/>
            <col style={{width:"110px"}}/>
            <col style={{width:"90px"}}/>
            <col style={{width:"45px"}}/>
            <col style={{width:"150px"}}/>
            <col style={{width:"170px"}}/>
          </colgroup>
          <thead>
            <tr className="text-[11px] text-zinc-500 uppercase tracking-wider bg-zinc-900/80 border-b border-zinc-700/40 align-middle">
              <th className="text-center py-1.5 px-2 font-medium align-middle">Ticker</th>
              <th className="text-center py-1.5 px-2 font-medium align-middle leading-tight">Premkt<br/>Price<br/>Chg %</th>
              <th className="text-center py-1.5 px-2 font-medium align-middle leading-tight">Premkt<br/>Vol</th>
              <th className="text-center py-1.5 px-2 font-medium align-middle"><Tip text="Relative Volume：今日成交量 ÷ 過去10天平均量。🟢 ≥5x 極強  🟡 ≥3x 強  ⚪ ≥2x 中等  灰色 &lt;2x 弱">RVol</Tip></th>
              <th className="text-center py-1.5 px-2 font-medium align-middle"><Tip text="Daily %：昨日收盤漲跌幅（非盤前）">Daily %</Tip></th>
              <th className="text-center py-1.5 px-2 font-medium align-middle leading-tight"><Tip text="Short Interest：放空股數佔流通股比例。>20% 有軋空 (Short Squeeze) 潛力，但也代表市場看空">Short<br/>Int</Tip></th>
              <th className="text-center py-1.5 px-2 font-medium align-middle"><Tip text="Float：市場上可自由買賣的流通股數。Float 越小，股價越容易被大幅推動">Float</Tip></th>
              <th className="text-center py-1.5 px-2 font-medium align-middle">Sector</th>
              <th className="text-center py-1.5 px-2 font-medium align-middle">Industry</th>
              <th className="text-center py-1.5 px-2 font-medium align-middle"><Tip width="w-72" text="催化劑分類：Earnings 財報｜Upgrade 分析師升評｜FDA 藥品審批｜Government Policy 政策｜Contract/Partnership 合約｜Institutional/Insider Buying 機構/內部人買入｜Thematic Narratives 主題敘事｜Technical/Flow 無明確催化劑">Category</Tip></th>
              <th className="text-center py-1.5 px-2 font-medium align-middle"><Tip width="w-64" text="Gemini 信心評分：A+ 極高 (90+)｜A 高 (75-89)｜B 中 (50-74)｜C 低 (&lt;50)。Pass/Fail = 技術門檻 ($Vol >$100M 且 ADR >4%)">Grade</Tip></th>
              <th className="text-center py-1.5 px-2 font-medium align-middle">Reasoning</th>
              <th className="text-center py-1.5 px-2 font-medium align-middle">Analysis Details</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((g, i) => {
              const techFail   = (g.technical_status || "").startsWith("Fail");
              if (techFail) return null;
              const flowTheme  = (g.theme || g.category || "") === "Technical / Flow";
              const rowCls     = [
                "border-t align-middle transition-colors",
                "border-zinc-800/40 hover:bg-zinc-800/20",
                flowTheme ? "border-dashed border-amber-800/40" : "",
              ].join(" ");
              return (
              <tr key={g.ticker + i} className={rowCls}>
                {/* Ticker */}
                <td className="py-1 px-2 align-middle text-center">
                  <span
                    className="font-bold text-zinc-100 text-[13px] hover:text-blue-400 transition-colors cursor-pointer"
                    onClick={e => { const rect = e.currentTarget.getBoundingClientRect(); setHovered(prev => prev?.ticker === g.ticker ? null : { ticker: g.ticker, rect }); }}
                  >
                    {g.ticker}
                  </span>
                  <a href={`https://www.tradingview.com/chart/?symbol=${g.ticker}`} target="_blank" rel="noreferrer" className="ml-1">
                    <ExternalLink size={8} className="inline text-zinc-600 hover:text-blue-400"/>
                  </a>
                  <div className="text-[11px] font-mono text-zinc-500">${g.price.toFixed(2)}</div>
                </td>
                {/* Premkt % */}
                <td className="py-1 px-2 align-middle text-center">
                  <div className="text-[12px] font-mono text-zinc-300">${g.price.toFixed(2)}</div>
                  <span className="text-[13px] font-bold font-mono text-emerald-400">+{g.gap_pct.toFixed(1)}%</span>
                </td>
                {/* Premkt Vol */}
                <td className="py-1 px-2 align-middle text-center text-[12px] font-mono text-zinc-400">{fmtNum(g.pm_volume)}</td>
                {/* RVol */}
                <td className="py-1 px-2 align-middle text-center">
                  <span className={`text-[12px] font-bold font-mono ${g.rvol >= 5 ? "text-emerald-300" : g.rvol >= 3 ? "text-emerald-400" : g.rvol >= 2 ? "text-amber-400" : "text-zinc-500"}`}>
                    {g.rvol.toFixed(2)}x
                  </span>
                </td>
                {/* Daily % */}
                <td className="py-1 px-2 align-middle text-center"><DailyChg val={g.daily_pct}/></td>
                {/* Short Int */}
                <td className="py-1 px-2 align-middle text-center text-[12px] font-mono text-zinc-400">{g.short_float || "—"}</td>
                {/* Float */}
                <td className="py-1 px-2 align-middle text-center text-[12px] font-mono text-zinc-400">{g.float_shares || "—"}</td>
                {/* Sector / Industry */}
                {(() => {
                  const db = tickerDb[g.ticker] || {};
                  const sector = db.sector || "";
                  const industry = db.industry || g.industry || "";
                  return (
                    <>
                      <td className="py-1 px-2 align-middle text-center text-[11px] text-zinc-200">{sector || <span className="text-zinc-600">—</span>}</td>
                      <td className="py-1 px-2 align-middle text-center text-[11px] text-zinc-200">{industry || <span className="text-zinc-600">—</span>}</td>
                    </>
                  );
                })()}
                {/* Category */}
                <td className="py-1 px-2 align-middle text-center">
                  <span className={`text-[11px] font-semibold px-1.5 py-0.5 rounded-full border ${CATEGORY_STYLE[g.category] || CATEGORY_STYLE["Others"]}`}>
                    {g.category}
                  </span>
                </td>
                {/* Grade + Technical Status + Verification */}
                <td className="py-1 px-2 align-middle text-center">
                  <div className="flex flex-col items-center gap-0.5">
                    <div className="flex items-center gap-1">
                      {g.grade
                        ? <Tip text={{ "A+": "極高信心 (90+)：催化劑強、成交量爆發、技術全達標。Gap & Go 策略首選", A: "高信心 (75-89)：催化劑明確，技術面佳，可積極參與", B: "中等信心 (50-74)：催化劑存在但強度不足，或技術面稍弱，謹慎操作", C: "低信心 (<50)：催化劑不明確或技術不達標，建議觀望" }[g.grade] || `信心評分：${g.grade}`}><span className={`text-[11px] font-bold px-1 py-0.5 rounded border ${gradeStyle(g.grade)}`}>{g.grade}</span></Tip>
                        : <span className="text-zinc-600">—</span>}
                      <VerificationBadge verification={g.verification} headlines={g.headlines}/>
                    </div>
                    {g.technical_status && (
                      <Tip text={(g.technical_status || "").startsWith("Fail")
                        ? `✗ 未通過技術門檻：${g.technical_status.replace("Fail — ", "")}。整排灰色 = 不建議交易`
                        : "✓ 通過技術門檻：平均日成交金額 >$100M 且 ADR >4%，具備足夠流動性與波動性"}>
                        <span className={`text-[9px] font-semibold px-1 py-0.5 rounded leading-none ${
                          (g.technical_status || "").startsWith("Fail")
                            ? "text-red-400 bg-red-500/10 border border-red-500/20"
                            : "text-emerald-400 bg-emerald-500/10 border border-emerald-500/20"
                        }`}>
                          {(g.technical_status || "").startsWith("Fail") ? "✗ Fail" : "✓ Pass"}
                        </span>
                      </Tip>
                    )}
                    {(g.theme || g.category) === "Technical / Flow" && (
                      <Tip text="找不到明確催化劑（無財報、合約、政策等新聞）。歸類為資金流向/技術突破。自動降為 C 級，風險較高，謹慎操作">
                        <span className="text-[9px] text-amber-500 font-semibold">🔍 Flow</span>
                      </Tip>
                    )}
                  </div>
                </td>
                {/* Reasoning */}
                <td className="py-1 px-2 align-middle">
                  <span className="line-clamp-2 text-[11px] text-zinc-400 block">
                    {g.reasoning || "—"}
                  </span>
                </td>
                {/* Analysis Details */}
                <td className="py-1 px-2 align-middle">
                  {(() => {
                    const d = g.analysis_detail;
                    const catalyst = typeof d === "object"
                      ? d?.catalyst
                      : (typeof d === "string" ? d.split(" | Impact: ")[0].replace(/^Catalyst:\s*/i, "") : null);
                    return (
                      <div>
                        <span className="line-clamp-1 text-[11px] text-zinc-300 block">{catalyst || "—"}</span>
                        <button
                          onClick={(e) => { e.stopPropagation(); setModalData(g); }}
                          className="text-[10px] text-blue-400 hover:text-blue-300 mt-0.5"
                        >•••</button>
                      </div>
                    );
                  })()}
                </td>
              </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <IBKRScannerTable
        ibkrScanner={gapperData?.ibkr_scanner}
        onTickerClick={(ticker, rect) => setHovered(prev => prev?.ticker === ticker ? null : { ticker, rect })}
      />
      </div>
      <LeaderColumn ibkrThemesData={ibkrThemesData} gapperData={gapperData} mode="gapper" />
    </div>
    {hovered && <TVPopup ticker={hovered.ticker} anchorRect={hovered.rect} onClose={() => setHovered(null)}/>}
    {modalData && (
      <div
        className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center"
        onClick={() => { setModalData(null); setChartAnchorRect(null); }}
      >
        <div
          className="bg-zinc-900 border border-zinc-700 rounded-xl p-6 max-w-2xl w-full mx-4 shadow-2xl relative flex flex-col max-h-[85vh] overflow-y-auto"
          onClick={e => e.stopPropagation()}
        >
          <button
            onClick={() => { setModalData(null); setChartAnchorRect(null); }}
            className="absolute top-3 right-3 text-zinc-400 hover:text-zinc-100 transition-colors"
          >
            <X size={16}/>
          </button>
          <div className="flex items-center gap-2 mb-5 flex-wrap">
            <button
              onClick={(e) => {
                e.stopPropagation();
                const rect = e.currentTarget.getBoundingClientRect();
                setChartAnchorRect(rect);
              }}
              className="text-xl font-bold font-mono text-zinc-100 hover:text-blue-400 transition-colors"
            >
              {modalData.ticker} ↗
            </button>
            <span className={`text-[11px] font-semibold px-1.5 py-0.5 rounded-full border ${CATEGORY_STYLE[modalData.category] || CATEGORY_STYLE["Others"]}`}>
              {modalData.category}
            </span>
            {modalData.grade && (
              <span className={`text-[11px] font-bold px-1 py-0.5 rounded border ${gradeStyle(modalData.grade)}`}>
                {modalData.grade}
              </span>
            )}
          </div>
          {(() => {
            const d = modalData.analysis_detail;
            let catalyst = null, impact = null;
            if (d && typeof d === "object") {
              catalyst = d.catalyst;
              impact = d.impact;
            } else if (typeof d === "string") {
              const parts = d.split(" | Impact: ");
              catalyst = parts[0]?.replace(/^Catalyst:\s*/i, "") || null;
              impact = parts[1] || null;
            }
            catalyst = catalyst || modalData.category;
            const hypothesis = [modalData.hypothesis, modalData.hypothesis_detail].filter(Boolean).join("\n\n") || null;
            const sections = [
              { label: "CATALYST",   value: catalyst },
              { label: "IMPACT",     value: impact },
              { label: "REASONING",  value: modalData.reasoning },
              { label: "HYPOTHESIS", value: hypothesis },
            ];
            return (
              <div className="space-y-4">
                {sections.map(({ label, value }) => value ? (
                  <div key={label}>
                    <div className="text-[11px] uppercase text-zinc-500 mb-1 font-semibold tracking-wider">{label}</div>
                    <p className="text-[13px] text-zinc-200 leading-relaxed whitespace-pre-line">{renderMarkdown(value)}</p>
                  </div>
                ) : null)}
              </div>
            );
          })()}
        </div>
      </div>
    )}
    {chartAnchorRect && modalData && (
      <TVPopup
        ticker={modalData.ticker}
        anchorRect={chartAnchorRect}
        onClose={() => setChartAnchorRect(null)}
      />
    )}
    </>
  );
};

// ── Multi-theme overrides: legacy frontend fallback (now mostly handled by scraper's ticker_extra_subthemes) ──
// Only add entries here for themes the scraper doesn't cover yet.
const TICKER_EXTRA_THEMES = {};

// Industries that map to custom themes not in INDUSTRY_TO_THEME
const THEME_INDUSTRY_MAP = {
  "Autonomous Vehicles": ["Auto Manufacturers", "Auto Parts", "Auto & Truck Dealerships"],
};

// Representative ETF or ticker per Finviz theme name — used to fetch real 6M sparklines
const THEME_ETF_MAP = {
  // ── Finviz Themes Map names ──
  "Artificial Intelligence":       "AIQ",
  "Semiconductors":                "SOXX",
  "Cloud Computing":               "WCLD",
  "Cybersecurity":                 "CIBR",
  "Electric Vehicles":             "LIT",
  "Autonomous Systems":            "DRIV",
  "Defense & Aerospace":           "ITA",
  "Healthcare & Biotech":          "XBI",
  "FinTech":                       "FINX",
  "Crypto & Blockchain":           "MSTR",
  "Space Tech":                    "UFO",
  "Quantum Computing":             "QTUM",
  "Robotics":                      "BOTZ",
  "Energy Renewable":              "ICLN",
  "Energy Traditional":            "XLE",
  "Software":                      "IGV",
  "E-commerce":                    "IBUY",
  "Social Media":                  "SOCL",
  "Real Estate & REITs":           "VNQ",
  "Internet of Things":            "SNSR",
  "Industrial Automation":         "IRBO",
  "Big Data":                      "META",
  "Consumer Goods":                "XLY",
  "Commodities Metals":            "GDX",
  "Commodities Energy":            "USO",
  "Commodities Agriculture":       "DBA",
  "Transportation & Logistics":    "XTN",
  "Telecommunications":            "XLC",
  "Virtual & Augmented Reality":   "METV",
  "Agriculture & FoodTech":        "MOO",
  "Environmental Sustainability":  "ESGU",
  "Hardware":                      "AMAT",
  "Smart Home":                    "AAPL",
  "Wearables":                     "AAPL",
  "Digital Entertainment":         "HERO",
  "Aging Population & Longevity":  "IHF",
  "Healthy Food & Nutrition":      "MOO",
  "Education Technology":          "INST",
  "Biometrics":                    "MSFT",
  "Nanotechnology":                "NVDA",
  // ── Industry view theme names ──
  "Telecom":                       "FCOM",
  "Clean Energy & Utilities":      "ICLN",
  "Industrials":                   "XLI",
  "Consumer Staples":              "XLP",
  "Consumer Discretionary":        "XLY",
  "Financials":                    "XLF",
  "Real Estate":                   "VNQ",
  "Software & Cloud":              "IGV",
  "Internet & E-Commerce":         "IBUY",
  "Media & Entertainment":         "SOCL",
  "Materials & Mining":            "XLB",
  "Agriculture & Food":            "MOO",
  "E-Commerce":                    "IBUY",
  "Fintech":                       "FINX",
};

// ── Finnhub Catalyst Feed ──
const FINNHUB_KEY = process.env.REACT_APP_FINNHUB_KEY || "";

const CATALYST_CATEGORIES = [
  {
    key: "fda",
    label: "FDA",
    color: "text-violet-400 bg-violet-500/10 border-violet-500/30",
    keywords: [
      "fda approved", "fda approval", "fda rejected", "fda rejection",
      "fda grants", "fda accepts", "fda refuses", "complete response letter",
      "nda approved", "bla approved", "nda submitted", "bla submitted",
      "pdufa date", "fast track designation", "breakthrough therapy designation",
      "accelerated approval", "priority review granted",
    ],
  },
  {
    key: "clinical",
    label: "Clinical Trial",
    color: "text-blue-400 bg-blue-500/10 border-blue-500/30",
    keywords: [
      "phase 3 trial", "phase iii trial", "phase 2 trial", "phase ii trial",
      "phase 3 results", "phase 3 data", "phase 2 results",
      "met primary endpoint", "failed to meet", "missed primary endpoint",
      "interim analysis", "overall survival benefit", "progression-free survival",
      "trial discontinued", "trial halted",
    ],
  },
  {
    key: "earnings",
    label: "Earnings",
    color: "text-yellow-400 bg-yellow-500/10 border-yellow-500/30",
    keywords: [
      // result beats/misses — published on earnings day
      "beats estimates", "misses estimates", "beat expectations", "missed expectations",
      "beats earnings", "earnings beat", "earnings miss",
      "tops q1", "tops q2", "tops q3", "tops q4",
      "beats q1", "beats q2", "beats q3", "beats q4",
      "misses q1", "misses q2", "misses q3", "misses q4",
      "reports q1", "reports q2", "reports q3", "reports q4",
      "earnings flash", "quarterly results", "quarterly earnings",
      "fiscal q1 results", "fiscal q2 results", "fiscal q3 results", "fiscal q4 results",
      "eps beat", "eps miss", "revenue beat", "revenue miss",
      "profit warning", "revenue warning", "preliminary results", "restates earnings",
      "guides higher", "guides lower",
      // reaction headlines published same day
      "plunging after earnings", "climbs after earnings", "rallies after earnings",
      "surges after earnings", "falls after earnings", "drops after earnings",
    ],
  },
  {
    key: "ma",
    label: "M&A",
    color: "text-orange-400 bg-orange-500/10 border-orange-500/30",
    keywords: [
      "agrees to acquire", "to be acquired", "acquisition agreement",
      "merger agreement", "definitive agreement to acquire",
      "takeover bid", "buyout offer", "tender offer",
      "strategic review", "exploring sale",
    ],
  },
  {
    key: "partnership",
    label: "Partnership",
    color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/30",
    keywords: [
      "license agreement", "licensing deal", "collaboration agreement",
      "co-development agreement", "milestone payment", "royalty agreement",
      "exclusive license", "joint development", "strategic collaboration",
      // broader commercial partnership signals
      "partners with", "partnership with", "strategic partnership",
      "signs agreement", "signs deal", "announces deal",
      "agreement with", "agreement to supply", "power purchase agreement",
      "supply agreement", "offtake agreement", "memorandum of understanding",
    ],
  },
  {
    key: "contract",
    label: "Contract",
    color: "text-cyan-400 bg-cyan-500/10 border-cyan-500/30",
    keywords: [
      "awarded contract", "wins contract", "government contract awarded",
      "defense contract", "multi-year contract", "exclusive supply agreement",
      "selected as supplier", "awarded $", "contract worth $",
      "secures contract", "signs contract", "long-term contract",
    ],
  },
  {
    key: "index",
    label: "Index Change",
    color: "text-pink-400 bg-pink-500/10 border-pink-500/30",
    keywords: [
      "added to s&p 500", "removed from s&p 500", "joins s&p 500",
      "added to russell", "removed from russell", "index addition",
      "index removal", "s&p 500 inclusion", "s&p 500 constituent",
    ],
  },
  {
    key: "analyst",
    label: "Analyst",
    color: "text-amber-400 bg-amber-500/10 border-amber-500/30",
    keywords: [
      "upgrades to buy", "upgrades to overweight", "upgrades to outperform",
      "downgrades to sell", "downgrades to underweight", "downgrades to underperform",
      "downgrades to neutral", "initiates with buy", "initiates with overweight",
    ],
  },
  {
    key: "short",
    label: "Short Report",
    color: "text-red-400 bg-red-500/10 border-red-500/30",
    keywords: [
      "hindenburg research", "citron research", "muddy waters",
      "gotham city research", "grizzly research", "short report",
      "short seller report", "fraud allegations", "accounting fraud",
      "accounting irregularities",
    ],
  },
  {
    key: "buyback",
    label: "Buyback / Dividend",
    color: "text-teal-400 bg-teal-500/10 border-teal-500/30",
    keywords: [
      "share repurchase program", "buyback program", "stock repurchase",
      "dividend increase", "raises dividend", "special dividend declared",
      "initiates dividend", "accelerated share repurchase",
    ],
  },
];

function detectCatalyst(headline, summary) {
  const text = ((headline || "") + " " + (summary || "")).toLowerCase();
  for (const cat of CATALYST_CATEGORIES) {
    if (cat.keywords.some(kw => text.includes(kw))) return cat;
  }
  return null;
}

const CATALYST_SENTIMENT = {
  fda: "good",
  clinical: "good",
  earnings: "good",
  ma: "good",
  partnership: "good",
  contract: "good",
  index: "good",
  analyst: "neutral",
  short: "bad",
  buyback: "good",
};

// ── Merged Search + Ticker Lookup ──
const SearchBar = ({ data, search, setSearch }) => {
  const [open, setOpen] = useState(false);
  const [allTickers, setAllTickers] = useState([]);
  const [livePrice, setLivePrice] = useState(null); // { price, change_pct } for non-scanner stocks
  const [livePriceLoading, setLivePriceLoading] = useState(false);
  const [priceCache, setPriceCache] = useState({});
  useEffect(() => {
    fetch(`${process.env.PUBLIC_URL}/prices.json`)
      .then(r => r.json())
      .then(setPriceCache)
      .catch(() => {});
  }, []);
  const [tickerHover, setTickerHover] = useState(null); // { ticker, rect } for TVPopup
  const [selectedTheme, setSelectedTheme] = useState(null); // theme name to expand stock list
  const [activeTab, setActiveTab]     = useState("info");
  const [news, setNews]               = useState([]);
  const [newsLoading, setNewsLoading] = useState(false);
  const [newsError, setNewsError]     = useState(false);
  const [selectedSubTheme, setSelectedSubTheme] = useState(null); // subtheme name to expand stock list
  const [searchHistory, setSearchHistory] = useState(() => {
    try { return JSON.parse(localStorage.getItem('searchHistory') || '[]'); } catch { return []; }
  });

  const saveToHistory = (term) => {
    if (!term.trim()) return;
    const next = [term, ...searchHistory.filter(h => h !== term)].slice(0, 8);
    setSearchHistory(next);
    localStorage.setItem('searchHistory', JSON.stringify(next));
  };

  useEffect(() => {
    fetch(`${process.env.PUBLIC_URL}/stock_db.json`)
      .then(r => r.json())
      .then(setAllTickers)
      .catch(() => {
        // fallback to all_tickers.json
        fetch(`${process.env.PUBLIC_URL}/all_tickers.json`)
          .then(r => r.json())
          .then(setAllTickers)
          .catch(() => {});
      });
  }, []);

  // Scanner index — stocks in current scan with theme/subtheme info
  const index = useMemo(() => {
    if (!data) return {};
    const map = {};
    data.themes.forEach(t => {
      const norm = normalizeTheme(t);
      norm.subthemes.forEach(sub => {
        sub.stocks.forEach(s => {
          if (!map[s.ticker]) map[s.ticker] = { ticker: s.ticker, company: s.company, sector: s.sector || "", industry: s.industry || "", price: s.price ?? null, change_pct: s.change_pct ?? s.perf_1d ?? null, appearances: [] };
          map[s.ticker].appearances.push({ theme: norm.name, subtheme: sub.name });
        });
      });
    });
    return map;
  }, [data]);

  const q = search.trim();
  const upper = q.toUpperCase();
  const lower = q.toLowerCase();

  // Exact match for detail panel
  const result = upper.length >= 1 ? (index[upper] || null) : null;

  // Suggestions: search all US tickers + scanner stocks
  const suggestions = useMemo(() => {
    if (q.length < 1) return [];
    const seen = new Set();
    // Buckets: ticker-prefix > company-starts-with > company-contains
    const bucketTicker = [], bucketStarts = [], bucketContains = [];
    // Scanner stocks first (have theme info)
    for (const s of Object.values(index)) {
      seen.add(s.ticker);
      const item = { ...s, inScanner: true };
      if (s.ticker.startsWith(upper)) bucketTicker.push(item);
      else if (s.company?.toLowerCase().startsWith(lower)) bucketStarts.push(item);
      else if (s.company?.toLowerCase().includes(lower)) bucketContains.push(item);
    }
    // Then all tickers — iterate fully so ranked sort works
    for (const s of allTickers) {
      if (seen.has(s.ticker)) continue;
      const item = { ticker: s.ticker, company: s.company, appearances: [], inScanner: false };
      if (s.ticker.startsWith(upper)) bucketTicker.push(item);
      else if (s.company?.toLowerCase().startsWith(lower)) bucketStarts.push(item);
      else if (s.company?.toLowerCase().includes(lower)) bucketContains.push(item);
    }
    return [...bucketTicker, ...bucketStarts, ...bucketContains].slice(0, 8);
  }, [index, allTickers, upper, lower, q]);

  // Map theme name → all stocks, and subtheme name → stocks (from scanner data)
  const [themeStocksMap, subThemeStocksMap] = useMemo(() => {
    if (!data) return [{}, {}];
    const tMap = {}, sMap = {};
    data.themes.forEach(t => {
      const norm = normalizeTheme(t);
      const stocks = [];
      norm.subthemes.forEach(sub => {
        sub.stocks.forEach(s => stocks.push(s));
        sMap[sub.name] = sub.stocks;
      });
      tMap[norm.name] = stocks;
    });
    return [tMap, sMap];
  }, [data]);

  // Also check stock_db for exact match if not in scanner
  const allTickerMatch = upper.length >= 1 ? allTickers.find(t => t.ticker === upper) : null;
  const fullResult = (() => {
    const base = result || (allTickerMatch ? {
      ticker: allTickerMatch.ticker,
      company: allTickerMatch.company,
      sector: allTickerMatch.sector || "",
      industry: allTickerMatch.industry || "",
      appearances: allTickerMatch.theme ? [{ theme: allTickerMatch.theme, subtheme: allTickerMatch.subtheme || "" }] : [],
      inScanner: false,
    } : null);
    if (!base) return null;
    const existingKeys = new Set(base.appearances.map(a => `${a.theme}||${a.subtheme}`));
    // Extra appearances from scraper-generated ticker_extra_subthemes (backend source of truth)
    const scraperExtras = ((data?.ticker_extra_subthemes || {})[base.ticker] || [])
      .filter(a => !existingKeys.has(`${a.theme}||${a.subtheme}`));
    scraperExtras.forEach(a => existingKeys.add(`${a.theme}||${a.subtheme}`));
    // Legacy frontend overrides (for themes not yet in scraper data)
    const extraThemes = TICKER_EXTRA_THEMES[base.ticker] || [];
    const extraAppearances = extraThemes
      .map(t => typeof t === "string" ? { theme: t, subtheme: "" } : t)
      .filter(a => !existingKeys.has(`${a.theme}||${a.subtheme}`));
    const merged = [...base.appearances, ...scraperExtras, ...extraAppearances];
    return { ...base, appearances: merged };
  })();

  // Fetch live price: try local API first, fallback to Yahoo Finance. Polls every 30s.
  useEffect(() => {
    setLivePrice(null);
    if (!fullResult) return;
    const ticker = fullResult.ticker;
    let cancelled = false;
    const doFetch = () => {
      const fetchYahoo = () => {
        setLivePriceLoading(true);
        fetch(`https://query2.finance.yahoo.com/v7/finance/quote?symbols=${ticker}&fields=regularMarketPrice,regularMarketChangePercent`)
          .then(r => r.json())
          .then(d => {
            if (cancelled) return;
            const q = d?.quoteResponse?.result?.[0];
            if (q?.regularMarketPrice != null) {
              setLivePrice({ price: q.regularMarketPrice, change_pct: q.regularMarketChangePercent ?? null });
            }
          })
          .catch(() => {
            // fallback: v8 chart
            fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?interval=1d&range=1d`)
              .then(r => r.json())
              .then(d => {
                if (cancelled) return;
                const meta = d?.chart?.result?.[0]?.meta;
                if (meta?.regularMarketPrice != null) {
                  const price = meta.regularMarketPrice;
                  const prev = meta.chartPreviousClose || meta.previousClose;
                  setLivePrice({ price, change_pct: prev ? ((price - prev) / prev) * 100 : null });
                }
              })
              .catch(() => {});
          })
          .finally(() => { if (!cancelled) setLivePriceLoading(false); });
      };
      fetch(`http://localhost:5001/price/${ticker}`)
        .then(r => r.json())
        .then(d => {
          if (cancelled) return;
          if (d.price != null) { setLivePrice({ price: d.price, change_pct: d.change_pct }); setLivePriceLoading(false); }
          else fetchYahoo();
        })
        .catch(() => fetchYahoo());
    };
    doFetch();
    const interval = setInterval(doFetch, 30000); // refresh every 30s
    return () => { cancelled = true; clearInterval(interval); };
  }, [fullResult?.ticker]); // eslint-disable-line react-hooks/exhaustive-deps

  const cachedPrice = fullResult ? priceCache[fullResult.ticker] : null;
  const displayPrice = livePrice || (fullResult?.price != null ? { price: fullResult.price, change_pct: fullResult.change_pct } : null) || cachedPrice;

  // Reset news state when ticker changes
  useEffect(() => {
    setActiveTab("info");
    setNews([]);
    setNewsError(false);
  }, [fullResult?.ticker]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchNews = async (ticker) => {
    if (!FINNHUB_KEY) { setNewsError(true); return; }
    setNewsLoading(true);
    setNewsError(false);
    try {
      const to   = new Date();
      const from = new Date(to.getTime() - 1825 * 24 * 60 * 60 * 1000); // 5 years
      const fmt  = d => d.toISOString().split("T")[0];
      const res  = await fetch(
        `https://finnhub.io/api/v1/company-news?symbol=${ticker}` +
        `&from=${fmt(from)}&to=${fmt(to)}&token=${FINNHUB_KEY}`
      );
      if (!res.ok) throw new Error(res.status);
      const articles = await res.json();
      // Dedup: extract significant words (4+ chars, not stopwords) from headline
      const STOPWORDS = new Set([
        "that","this","with","from","have","will","been","were","they",
        "their","said","says","after","before","report","stock","shares",
        "company","says","over","more","than","about","into","would",
      ]);
      const sigWords = (text) =>
        (text || "").toLowerCase()
          .replace(/[^a-z0-9 ]/g, " ")
          .split(/\s+/)
          .filter(w => w.length >= 4 && !STOPWORDS.has(w));

      // Company relevance keywords — ticker substring catches "goog" inside "google"
      const companyStopWords = new Set(["inc", "corp", "corporation", "ltd", "llc", "co", "group", "holdings", "the", "and"]);
      const companyKeywords = [
        ticker.toLowerCase(),
        ...(fullResult?.company || "")
          .toLowerCase()
          .replace(/[^a-z0-9 ]/g, " ")
          .split(/\s+/)
          .filter(w => w.length >= 4 && !companyStopWords.has(w)),
      ];
      // Roundup articles mention many companies in one headline (e.g. "Apple, Amazon, Nvidia And More On CNBC...")
      const isRoundup = (headline) => {
        const h = (headline || "").toLowerCase();
        return h.includes("and more") && h.includes(",");
      };
      // Clickbait / opinion / preview articles — not confirmed events
      const CLICKBAIT_PHRASES = [
        "time to buy", "hold or sell", "buy or sell", "should you buy", "should investors",
        "is it a buy", "is a buy", "is now a buy",
        "what you should know", "what's going on", "what to expect",
        "ahead of earnings", "before earnings", "earnings preview",
        "will it beat", "will report", "could report",
        "recovers some", "recovers losses", "bounce back",
        "post q1", "post q2", "post q3", "post q4",
        "what happened", "here's why", "here is why",
        "stock picks", "top picks", "week of", "stocks to watch",
        "best stocks", "top stocks", "final trades",
      ];
      const isClickbait = (headline) => {
        const h = (headline || "").trim().toLowerCase();
        if (h.endsWith("?")) return true; // question headlines are almost always clickbait
        return CLICKBAIT_PHRASES.some(p => h.includes(p));
      };
      const isRelevant = (a) => {
        if (isRoundup(a.headline)) return false;
        if (isClickbait(a.headline)) return false;
        const text = ((a.headline || "") + " " + (a.summary || "")).toLowerCase();
        return companyKeywords.some(kw => text.includes(kw));
      };

      const dedupedGroups = []; // Each entry = { article, words, timestamp }
      for (const a of (Array.isArray(articles) ? articles : [])) {
        if (!isRelevant(a)) continue; // skip articles not mentioning this company
        const cat = detectCatalyst(a.headline, a.summary);
        if (!cat) continue;
        const words = new Set(sigWords(a.headline));
        if (words.size === 0) continue;

        // Dedup: same category within 48h uses lower threshold (25%) to catch
        // same-event articles with different headlines (e.g. 3 outlets covering
        // the same trial result). Cross-category keeps stricter 45%.
        const isDuplicate = dedupedGroups.some(({ article: existing, words: exWords }) => {
          const diffSec = Math.abs(a.datetime - existing.datetime);
          const sameCategory = cat.key === existing.catalyst.key;
          const windowSec = sameCategory ? 172800 : 86400; // 48h same-cat, 24h otherwise
          if (diffSec > windowSec) return false;
          const overlap = [...words].filter(w => exWords.has(w)).length;
          const similarity = overlap / Math.max(words.size, exWords.size);
          const threshold = sameCategory ? 0.25 : 0.45;
          return similarity >= threshold;
        });

        if (!isDuplicate) {
          const sentiment = CATALYST_SENTIMENT[cat.key] || "neutral";
          dedupedGroups.push({ article: { ...a, catalyst: cat, sentiment }, words, timestamp: a.datetime });
        }
      }

      const filtered = dedupedGroups
        .map(g => g.article)
        .sort((a, b) => b.datetime - a.datetime)
        .slice(0, 50); // keep up to 50 high-impact catalysts after dedup

      setNews(filtered);
    } catch {
      setNewsError(true);
    } finally {
      setNewsLoading(false);
    }
  };

  const showSuggestions = open && q.length >= 1 && !fullResult && suggestions.length > 0;
  const noMatch = open && q.length >= 2 && !fullResult && suggestions.length === 0;

  return (
    <div className="relative">
      <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-500"/>
      <input
        type="text"
        value={search}
        onChange={e => { setSearch(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onKeyDown={e => { if (e.key === 'Enter' && search.trim()) saveToHistory(search.trim()); }}
        onBlur={() => { if (search.trim()) saveToHistory(search.trim()); setTimeout(() => { setOpen(false); setSelectedTheme(null); setSelectedSubTheme(null); setTickerHover(null); }, 150); }}
        placeholder="Search ticker or company…"
        className="w-52 pl-7 pr-7 py-1.5 text-[13px] bg-zinc-800/60 border border-zinc-700/50 rounded-md text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-blue-500/50"
      />
      {search && <button onMouseDown={e => { e.preventDefault(); setSearch(""); setOpen(false); }} className="absolute right-2 top-1/2 -translate-y-1/2"><X size={11} className="text-zinc-500"/></button>}

      {/* Search history dropdown */}
      {open && q.length === 0 && searchHistory.length > 0 && (
        <div className="absolute top-full right-0 mt-1.5 w-72 bg-zinc-900 border border-zinc-700/60 rounded-lg shadow-2xl z-50 py-1">
          <div className="px-3 py-1 flex items-center justify-between">
            <span className="text-[10px] text-zinc-600 uppercase tracking-widest">最近搜尋</span>
            <button onMouseDown={e => { e.preventDefault(); setSearchHistory([]); localStorage.removeItem('searchHistory'); }} className="text-[10px] text-zinc-600 hover:text-zinc-400">清除</button>
          </div>
          {searchHistory.map(h => (
            <button key={h} onMouseDown={e => { e.preventDefault(); setSearch(h); setOpen(true); }}
              className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-zinc-800 text-left">
              <Clock size={10} className="text-zinc-600 flex-shrink-0"/>
              <span className="text-[13px] text-zinc-300">{h}</span>
            </button>
          ))}
        </div>
      )}

      {/* Suggestions dropdown */}
      {showSuggestions && (
        <div className="absolute top-full right-0 mt-1.5 w-72 bg-zinc-900 border border-zinc-700/60 rounded-lg shadow-2xl z-50 py-1">
          {suggestions.map(s => (
            <button key={s.ticker} onMouseDown={e => { e.preventDefault(); saveToHistory(s.ticker); setSearch(s.ticker); setOpen(true); }}
              className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-zinc-800 text-left">
              <span className="text-[13px] font-bold text-zinc-200 w-14 flex-shrink-0">{s.ticker}</span>
              <span className="text-[12px] text-zinc-500 truncate flex-1">{s.company}</span>
              {s.inScanner && <span className="text-[10px] text-blue-400 flex-shrink-0">in scanner</span>}
            </button>
          ))}
        </div>
      )}

      {/* Detail panel for exact match */}
      {open && fullResult && (
        <div id="search-result-panel" className="absolute top-full right-0 mt-1.5 w-72 bg-zinc-900 border border-zinc-700/60 rounded-lg shadow-2xl z-50 p-3 space-y-2">
          <div className="flex items-baseline gap-2 flex-wrap">
            <span
              className="text-sm font-bold text-zinc-100 cursor-pointer hover:text-blue-400 transition-colors"
              onClick={e => { const panel = e.currentTarget.closest('[class*="shadow-2xl"]') || e.currentTarget; const rect = panel.getBoundingClientRect(); setTickerHover(prev => prev?.ticker === fullResult.ticker ? null : { ticker: fullResult.ticker, rect }); }}
            >{fullResult.ticker}</span>
            {livePriceLoading && !displayPrice && (
              <span className="text-[13px] text-zinc-600 animate-pulse">載入中…</span>
            )}
            {displayPrice?.price != null && (
              <span className="flex items-baseline gap-1.5">
                <span className="text-sm font-semibold text-zinc-200">${displayPrice.price.toFixed(2)}</span>
                {displayPrice.change_pct != null && (
                  <span className={`text-[13px] font-medium ${displayPrice.change_pct >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {displayPrice.change_pct >= 0 ? '+' : ''}{displayPrice.change_pct.toFixed(2)}%
                  </span>
                )}
              </span>
            )}
            {fullResult.company && <span className="text-[12px] text-zinc-500 truncate w-full">{fullResult.company}</span>}
          </div>

          {/* Tab bar */}
          <div className="flex border-b border-zinc-800 -mx-3 px-3">
            {[{ key: "info", label: "Info" }, { key: "news", label: "Catalysts" }].map(tab => (
              <button
                key={tab.key}
                onMouseDown={e => e.preventDefault()}
                onClick={() => {
                  setActiveTab(tab.key);
                  if (tab.key === "news" && news.length === 0 && !newsLoading) fetchNews(fullResult.ticker);
                }}
                className={`text-[12px] px-3 py-1.5 border-b-2 transition-colors ${activeTab === tab.key ? "border-blue-500 text-blue-400" : "border-transparent text-zinc-500 hover:text-zinc-300"}`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Info tab */}
          {activeTab === "info" && (
            <div className="space-y-1.5">
              {[{ label: "Sector", value: fullResult.sector }, { label: "Industry", value: fullResult.industry }].map(({ label, value }) => value ? (
                <div key={label} className="flex gap-2 text-[13px]">
                  <span className="text-zinc-500 w-16 flex-shrink-0">{label}</span>
                  <span className="text-zinc-200">{value}</span>
                </div>
              ) : null)}
              {fullResult.appearances.length > 0 && (
                <div className="mt-2 pt-2 border-t border-zinc-800 space-y-1.5">
                  {/* Single "Theme" row — display only, not expandable */}
                  <div className="flex gap-2 text-[13px] items-start">
                    <span className="text-zinc-500 w-16 flex-shrink-0">Theme</span>
                    <div className="flex flex-wrap gap-x-2 gap-y-1">
                      {fullResult.appearances.map((a, i) => (
                        <span key={i} className="text-blue-300 font-medium">{a.theme}</span>
                      ))}
                    </div>
                  </div>
                  {/* Sub-theme for scanner stocks */}
                  {fullResult.appearances.some(a => a.subtheme) && (
                    <div className="flex gap-2 text-[13px] items-start">
                      <span className="text-zinc-500 w-16 flex-shrink-0">Sub-Theme</span>
                      <div className="flex flex-wrap gap-x-2 gap-y-1">
                        {fullResult.appearances.filter(a => a.subtheme).map((a, i) => {
                          const isOpen = selectedSubTheme === a.subtheme;
                          return (
                            <button key={i}
                              className="text-violet-300 font-medium hover:text-violet-200 flex items-center gap-0.5 text-left"
                              onMouseDown={e => e.preventDefault()}
                              onClick={() => setSelectedSubTheme(isOpen ? null : a.subtheme)}
                            >
                              {a.subtheme}
                              <span className="text-zinc-500 text-[10px] ml-0.5">{isOpen ? '▲' : '▼'}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                  {/* Expanded stock list for selected subtheme */}
                  {selectedSubTheme && (() => {
                    const scannerStocks = subThemeStocksMap[selectedSubTheme] || [];
                    // Also find tickers that have this subtheme as an extra (from ticker_extra_subthemes)
                    const extraTickers = data?.ticker_extra_subthemes
                      ? Object.entries(data.ticker_extra_subthemes)
                          .filter(([, extras]) => extras.some(e => e.subtheme === selectedSubTheme))
                          .map(([t]) => t)
                      : [];
                    const extraStocks = extraTickers.map(t => allTickers.find(s => s.ticker === t)).filter(Boolean);
                    const primaryStocks = allTickers.filter(s => s.subtheme === selectedSubTheme);
                    const combined = [...new Map([...primaryStocks, ...extraStocks].map(s => [s.ticker, s])).values()];
                    const stocks = scannerStocks.length > 0 ? scannerStocks : combined.slice(0, 50);
                    if (stocks.length === 0) return null;
                    return (
                      <div className="mt-1 border border-zinc-700/50 rounded-md overflow-hidden">
                        <div className="overflow-y-auto" style={{ maxHeight: '200px' }}>
                          {[...stocks].sort((a, b) => (b.rs_52w || 0) - (a.rs_52w || 0) || a.ticker.localeCompare(b.ticker)).map(s => (
                            <button key={s.ticker}
                              className="w-full flex items-center gap-2 px-2 py-1 hover:bg-zinc-800 text-left border-b border-zinc-800 last:border-0"
                              onMouseDown={e => { e.preventDefault(); setSearch(s.ticker); setSelectedSubTheme(null); }}
                            >
                              <span
                                className="text-[12px] font-bold text-zinc-200 w-12 flex-shrink-0 hover:text-blue-400 cursor-pointer"
                                onClick={e => { e.stopPropagation(); const panelEl = document.getElementById('search-result-panel'); const panelLeft = panelEl ? panelEl.getBoundingClientRect().left : null; const sr = e.currentTarget.getBoundingClientRect(); setTickerHover(prev => prev?.ticker === s.ticker ? null : { ticker: s.ticker, rect: { ...sr, panelLeft } }); }}
                              >{s.ticker}</span>
                              <span className="text-[11px] text-zinc-500 truncate flex-1">{s.company}</span>
                              {s.change_pct != null && (
                                <span className={`text-[11px] font-medium flex-shrink-0 ${s.change_pct >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                  {s.change_pct >= 0 ? '+' : ''}{s.change_pct.toFixed(1)}%
                                </span>
                              )}
                            </button>
                          ))}
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>
          )}

          {/* News / Catalysts tab */}
          {activeTab === "news" && (
            <div>
              {newsLoading && (
                <p className="text-[12px] text-zinc-600 animate-pulse py-3 text-center">
                  Loading catalysts…
                </p>
              )}
              {newsError && (
                <p className="text-[12px] text-red-500/70 py-3 text-center">
                  Failed to load — check API key
                </p>
              )}
              {!newsLoading && !newsError && news.length === 0 && (
                <p className="text-[12px] text-zinc-600 py-3 text-center">
                  No catalyst news in the last 6 months.
                </p>
              )}
              <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1">
                {news.map((item, i) => {
                  const date = item.datetime
                    ? new Date(item.datetime * 1000).toLocaleDateString("en-US", {
                        month: "short", day: "numeric", year: "numeric",
                      })
                    : null;
                  return (
                    <a
                      key={i}
                      href={item.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block group"
                      onMouseDown={e => e.preventDefault()}
                    >
                      <div className="flex items-center gap-1.5 mb-1">
                        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border ${item.catalyst.color}`}>
                          {item.catalyst.label}
                        </span>
                        {item.sentiment && (
                          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border ${item.sentiment === "good" ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/30" : item.sentiment === "bad" ? "text-red-400 bg-red-500/10 border-red-500/30" : "text-zinc-400 bg-zinc-700/20 border-zinc-600/30"}`}>
                            {item.sentiment}
                          </span>
                        )}
                        {date && (
                          <span className="text-[10px] text-zinc-600">{date}</span>
                        )}
                      </div>
                      <p className="text-[12px] text-zinc-300 group-hover:text-blue-400 leading-snug transition-colors">
                        {item.headline}
                      </p>
                      {item.source && (
                        <p className="text-[10px] text-zinc-700 mt-0.5">{item.source}</p>
                      )}
                    </a>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {open && noMatch && (
        <div className="absolute top-full right-0 mt-1.5 w-72 bg-zinc-900 border border-zinc-700/60 rounded-lg shadow-2xl z-50 p-3">
          <p className="text-[13px] text-zinc-500">"{q}" not found in scanner data</p>
        </div>
      )}
      {tickerHover && <TVPopup ticker={tickerHover.ticker} anchorRect={tickerHover.rect} onClose={() => setTickerHover(null)}/>}
    </div>
  );
};


// ── Snapshot Markdown Table ────────────────────────────────────────────────────

const SnapshotMdTable = ({ md }) => {
  if (!md) return null;
  const lines = md.split('\n').map(l => l.trim()).filter(Boolean);
  const tableLines = lines.filter(l => l.startsWith('|'));
  // separator rows contain only pipes, dashes, colons, spaces
  const isSep = l => /^\|[\s\|\-\:]+\|$/.test(l);
  const dataLines = tableLines.filter(l => !isSep(l));
  if (dataLines.length < 2) return null;
  const parseRow = l => l.split('|').slice(1, -1).map(c => c.trim());
  const [headerRow, ...bodyRows] = dataLines;
  const headers = parseRow(headerRow);
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[11px] border-collapse">
        <thead>
          <tr>
            {headers.map((h, i) => (
              <th key={i} className="text-left py-1 px-2 text-zinc-500 font-semibold border-b border-zinc-700/50 uppercase tracking-wide whitespace-nowrap">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {bodyRows.map((row, ri) => (
            <tr key={ri} className="border-b border-zinc-800/30 hover:bg-zinc-800/20">
              {parseRow(row).map((cell, ci) => (
                <td key={ci} className="py-0.5 px-2 font-mono text-zinc-300 whitespace-nowrap">{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};


// ── Macro Risk Card (Market Intelligence) ─────────────────────────────────────

const MacroRiskCard = () => {
  const [intel, setIntel] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${process.env.PUBLIC_URL}/market_intelligence.json?v=${Date.now()}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { setIntel(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="flex items-center justify-center py-20 text-zinc-500">
      <RefreshCw size={16} className="animate-spin mr-2"/> Loading Market Intelligence…
    </div>
  );
  if (!intel) return (
    <div className="text-center py-20 text-zinc-600 text-sm">
      No data — run <code className="text-zinc-400">python market_intelligence.py</code> first
    </div>
  );

  const { indices = {}, credit = {}, breadth = {}, global: gl = {},
          reversal_signals: rev = {}, analysis: ana = {}, session, generated_at } = intel;
  const spy = indices.spy || {};
  const qqq = indices.qqq || {};
  const vix = indices.vix || {};
  const hasReversal   = rev.signal_detected;
  const isGenerational = breadth.generational_buy_zone;

  const PctChange = ({ v }) => v == null ? <span className="text-zinc-600">—</span> : (
    <span className={v >= 0 ? "text-emerald-400" : "text-red-400"}>{v >= 0 ? "+" : ""}{v.toFixed(2)}%</span>
  );

  const regimeCls = r => ({
    Complacent:    "text-emerald-400 border-emerald-500/30 bg-emerald-500/10",
    "Yellow Flag": "text-amber-400  border-amber-500/30  bg-amber-500/10",
    Stress:        "text-red-400    border-red-500/30    bg-red-500/10",
  }[r] || "text-zinc-400 border-zinc-700/40 bg-zinc-800/40");

  return (
    <div className="max-w-[1400px] mx-auto px-4 py-4 space-y-4">

      {/* Header */}
      <div className="flex items-center gap-3">
        <Activity size={14} className="text-orange-400"/>
        <span className="text-sm font-semibold text-zinc-200">Market Intelligence</span>
        {session && (
          <span className={`text-[11px] px-2 py-0.5 rounded-full border font-medium
            ${session === "Pre-Market"
              ? "bg-blue-500/15 border-blue-500/30 text-blue-400"
              : session === "Post-Market"
              ? "bg-violet-500/15 border-violet-500/30 text-violet-400"
              : "bg-emerald-500/15 border-emerald-500/30 text-emerald-400"}`}>
            {session}
          </span>
        )}
        {generated_at && <span className="text-[11px] text-zinc-600 ml-auto">{generated_at}</span>}
      </div>

      {/* Reversal / Generational Buy Banner */}
      {hasReversal && (
        <div className={`flex items-center gap-3 rounded-lg border p-3
          ${isGenerational
            ? "bg-orange-500/20 border-orange-500/40"
            : "bg-amber-500/15 border-amber-500/35"}`}>
          <span className="text-2xl flex-shrink-0">{isGenerational ? "🔥" : "🕯"}</span>
          <div>
            <div className={`font-bold text-sm ${isGenerational ? "text-orange-400" : "text-amber-400"}`}>
              {isGenerational ? "GENERATIONAL BUY ZONE DETECTED" : "[🔥 REVERSAL SIGNAL DETECTED]"}
            </div>
            {rev.signal_description && (
              <div className="text-[12px] text-amber-300/70 mt-0.5">{rev.signal_description}</div>
            )}
          </div>
        </div>
      )}

      {/* Index Cards */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "ES1!", d: spy },
          { label: "NQ1!", d: qqq },
          { label: "VIX", d: vix, isVix: true },
        ].map(({ label, d, isVix }) => !d.price ? null : (
          <div key={label} className="bg-zinc-900/60 border border-zinc-800/50 rounded-lg p-3">
            <div className="text-[11px] text-zinc-500 font-semibold uppercase tracking-wider mb-1">{label}</div>
            <div className="font-mono text-xl font-bold text-zinc-100">
              {isVix ? d.price.toFixed(2) : `$${d.price.toFixed(2)}`}
            </div>
            <PctChange v={d.change_pct}/>
            {!isVix && d.open != null && (
              <div className="text-[10px] text-zinc-700 mt-1 font-mono">
                O:{d.open.toFixed(2)} H:{d.high?.toFixed(2)} L:{d.low?.toFixed(2)}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Credit + Breadth + Global Row */}
      <div className="grid grid-cols-3 gap-3">

        {/* Credit Regime */}
        <div className="bg-zinc-900/60 border border-zinc-800/50 rounded-lg p-3">
          <div className="text-[11px] text-zinc-500 uppercase tracking-wider mb-2 font-semibold">
            Credit Risk · BAML HY
          </div>
          {credit.baml_hy != null ? (
            <>
              <div className="font-mono text-2xl font-bold text-zinc-100">{credit.baml_hy.toFixed(2)}%</div>
              <span className={`text-[11px] font-bold px-2 py-0.5 rounded border mt-1 inline-block ${regimeCls(credit.regime)}`}>
                {credit.regime}
              </span>
              {credit.date && <div className="text-[10px] text-zinc-700 mt-1.5">FRED · {credit.date}</div>}
            </>
          ) : <div className="text-zinc-600 text-[13px]">No data</div>}
        </div>

        {/* Breadth */}
        <div className="bg-zinc-900/60 border border-zinc-800/50 rounded-lg p-3">
          <div className="text-[11px] text-zinc-500 uppercase tracking-wider mb-2 font-semibold">
            Market Breadth
          </div>
          {breadth.s5fi != null ? (
            <div className="space-y-2.5">
              {[
                { label: "S5FI  >50DMA",  val: breadth.s5fi },
                { label: "MMTH >200DMA",  val: breadth.mmth },
              ].map(({ label, val }) => val != null && (
                <div key={label}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[11px] text-zinc-400 font-mono">{label}</span>
                    <span className={`font-mono text-sm font-bold
                      ${val < 10 ? "text-orange-400" : val < 20 ? "text-amber-400" : val < 40 ? "text-yellow-400" : "text-emerald-400"}`}>
                      {val.toFixed(1)}%
                    </span>
                  </div>
                  <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full transition-all
                      ${val < 20 ? "bg-amber-500" : "bg-emerald-500"}`}
                      style={{ width: `${val}%` }}/>
                  </div>
                </div>
              ))}
              {breadth.breadth_flush && (
                <div className="text-[11px] text-amber-400 font-semibold mt-1">⚠ Breadth Flush Active</div>
              )}
            </div>
          ) : <div className="text-zinc-600 text-[13px]">No data</div>}
        </div>

        {/* Global Indices */}
        <div className="bg-zinc-900/60 border border-zinc-800/50 rounded-lg p-3">
          <div className="text-[11px] text-zinc-500 uppercase tracking-wider mb-2 font-semibold">Global</div>
          <div className="space-y-2">
            {[
              { label: "Nikkei 225", key: "nikkei" },
              { label: "DAX",        key: "dax" },
              { label: "FTSE 100",   key: "ftse" },
            ].map(({ label, key }) => {
              const g = gl[key];
              return (
                <div key={key} className="flex items-center justify-between">
                  <span className="text-[11px] text-zinc-400">{label}</span>
                  {g?.change_pct != null
                    ? <span className={`font-mono text-[13px] font-medium ${g.change_pct >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                        {g.change_pct >= 0 ? "+" : ""}{g.change_pct.toFixed(2)}%
                      </span>
                    : <span className="text-zinc-600 text-[13px]">—</span>
                  }
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Gemini Analysis */}
      {ana && !ana.error && (
        <div className="bg-zinc-900/40 border border-zinc-800/50 rounded-lg divide-y divide-zinc-800/60">

          {ana.snapshot_md && (
            <div className="p-4">
              <div className="text-[11px] text-zinc-500 uppercase tracking-wider mb-1.5 font-semibold">Snapshot</div>
              <SnapshotMdTable md={ana.snapshot_md}/>
            </div>
          )}

          {ana.macro_section && (
            <div className="p-4">
              <div className="text-[11px] text-zinc-500 uppercase tracking-wider mb-1.5 font-semibold">Macro Overview</div>
              <p className="text-[13px] text-zinc-300 leading-relaxed">{ana.macro_section}</p>
            </div>
          )}

          {(ana.analysis_para1 || ana.analysis_para2) && (
            <div className="p-4">
              <div className="text-[11px] text-zinc-500 uppercase tracking-wider mb-2 font-semibold">
                Analysis &amp; Lessons
              </div>
              <div className="space-y-3">
                {ana.analysis_para1 && (
                  <p className="text-[13px] text-zinc-300 leading-relaxed">{ana.analysis_para1}</p>
                )}
                {ana.analysis_para2 && (
                  <div>
                    <div className="text-[10px] text-zinc-600 uppercase tracking-wide mb-1">Mechanical Catalyst</div>
                    <p className="text-[13px] text-zinc-300 leading-relaxed">{ana.analysis_para2}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {ana.technical_signal && (
            <div className={`p-4 ${hasReversal ? "bg-amber-500/5" : ""}`}>
              <div className="text-[11px] text-zinc-500 uppercase tracking-wider mb-1.5 font-semibold">
                Technical Signal
              </div>
              <p className={`text-[13px] leading-relaxed ${hasReversal ? "text-amber-300" : "text-zinc-400"}`}>
                {ana.technical_signal}
              </p>
            </div>
          )}

          {ana.ticker_intel && (
            <div className="p-4">
              <div className="text-[11px] text-zinc-500 uppercase tracking-wider mb-2 font-semibold">
                Ticker Intel
              </div>
              <div className="grid grid-cols-2 gap-2">
                {(ana.ticker_intel.a_grade || []).map((t, i) => (
                  <div key={i} className="bg-emerald-500/10 border border-emerald-500/20 rounded p-2 flex gap-2 items-start">
                    <span className="text-[10px] font-bold text-emerald-500 border border-emerald-500/40 rounded px-1 mt-0.5 flex-shrink-0">A</span>
                    <div>
                      <div className="font-mono text-[13px] font-bold text-zinc-200">{t.ticker}</div>
                      <div className="text-[11px] text-zinc-400 leading-tight mt-0.5">{t.reason}</div>
                    </div>
                  </div>
                ))}
                {(ana.ticker_intel.c_grade || []).map((t, i) => (
                  <div key={i} className="bg-red-500/10 border border-red-500/20 rounded p-2 flex gap-2 items-start">
                    <span className="text-[10px] font-bold text-red-400 border border-red-500/40 rounded px-1 mt-0.5 flex-shrink-0">C</span>
                    <div>
                      <div className="font-mono text-[13px] font-bold text-zinc-200">{t.ticker}</div>
                      <div className="text-[11px] text-zinc-400 leading-tight mt-0.5">{t.reason}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>
      )}
      {ana?.error && (
        <div className="text-red-400 text-[13px] bg-red-500/10 border border-red-500/20 rounded p-3">{ana.error}</div>
      )}
    </div>
  );
};


// ── Momentum Catalyst Analyst Cockpit ────────────────────────────────────────

const MomentumCockpit = () => {
  const [gapperData, setGapperData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedTicker, setSelectedTicker] = useState(null);
  const [analysis, setAnalysis] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [modalData, setModalData] = useState(null);

  // Gapper data — poll every 5 min (matches scanner schedule)
  useEffect(() => {
    const fetchGapper = () => {
      fetch(process.env.PUBLIC_URL + "/gapper_data.json?v=" + Date.now())
        .then(r => r.ok ? r.json() : null)
        .then(d => { setGapperData(d); setLoading(false); })
        .catch(() => setLoading(false));
    };
    fetchGapper();
    const id = setInterval(fetchGapper, 5 * 60 * 1000);
    return () => clearInterval(id);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchAnalysis = useCallback(async (ticker, row) => {
    setSelectedTicker(ticker);
    setAnalysis(null);
    setAnalyzing(true);
    try {
      const params = new URLSearchParams({
        gap: row.gap_pct || 0, pm_vol: row.pm_volume || 0,
        rvol: row.rvol || 0, price: row.price || 0, mkt_cap: row.mkt_cap || 0,
      });
      const r = await fetch(`http://localhost:5002/analyze/${ticker}?${params}`);
      if (r.ok) setAnalysis(await r.json());
      else setAnalysis({ error: `API error ${r.status}` });
    } catch {
      setAnalysis({ error: "Analyst API offline — run: python3 momentum_cockpit.py" });
    }
    setAnalyzing(false);
  }, []);

  const columns = useMemo(() => [
    {
      id: "ticker", header: "Ticker",
      cell: ({ row }) => {
        const g = row.original;
        return (
          <div>
            <div className="font-bold font-mono text-[13px] text-zinc-100 hover:text-blue-400 cursor-pointer" onClick={() => fetchAnalysis(g.ticker, g)}>{g.ticker}</div>
            <div className="text-[10px] text-zinc-500 truncate max-w-[90px]">{g.company || ""}</div>
          </div>
        );
      }
    },
    {
      id: "price", header: "Price / Chg",
      cell: ({ row }) => {
        const g = row.original;
        return (
          <div className="text-right">
            <div className="font-mono text-[13px] text-zinc-200">{g.price != null ? `$${g.price.toFixed(2)}` : "—"}</div>
            <div className={`text-[11px] font-mono ${(g.daily_pct || 0) >= 0 ? "text-emerald-400" : "text-red-400"}`}>
              {g.daily_pct != null ? `${g.daily_pct >= 0 ? "+" : ""}${g.daily_pct.toFixed(2)}%` : "—"}
            </div>
          </div>
        );
      }
    },
    {
      id: "gap", header: "Gap %",
      cell: ({ row }) => <span className="font-mono text-[13px] text-emerald-400">+{(row.original.gap_pct || 0).toFixed(1)}%</span>
    },
    {
      id: "adr", header: "ADR", accessorKey: "adr_pct",
      cell: ({ getValue }) => {
        const v = getValue();
        return <span className={`font-mono text-[13px] ${v >= 5 ? "text-emerald-400" : v >= 4 ? "text-amber-400" : "text-zinc-500"}`}>{v != null ? `${v.toFixed(1)}%` : "—"}</span>;
      }
    },
    {
      id: "rvol", header: "RVOL", accessorKey: "rvol",
      cell: ({ getValue }) => {
        const v = getValue();
        return <span className={`font-mono text-[13px] font-bold ${v >= 5 ? "text-emerald-300" : v >= 3 ? "text-emerald-400" : v >= 2 ? "text-amber-400" : "text-zinc-500"}`}>{v != null ? `${v.toFixed(2)}x` : "—"}</span>;
      }
    },
    {
      id: "industry", header: "Industry",
      cell: ({ row }) => <span className="text-[11px] text-zinc-300">{row.original.industry || "—"}</span>
    },
    {
      id: "theme", header: "Theme",
      cell: ({ row }) => <span className="text-[11px] text-blue-300">{row.original.finviz_theme || row.original.theme || "—"}</span>
    },
    {
      id: "grade", header: "Grade", accessorKey: "grade",
      cell: ({ getValue }) => {
        const g = getValue();
        return g ? <span className={`text-[11px] font-bold px-1.5 py-0.5 rounded border ${gradeStyle(g)}`}>{g}</span> : <span className="text-zinc-600">—</span>;
      }
    },
    {
      id: "reasoning", header: "Reasoning", accessorKey: "reasoning",
      cell: ({ getValue }) => (
        <span className="text-[11px] text-zinc-400 line-clamp-2 leading-tight block max-w-[150px]">
          {getValue() || "—"}
        </span>
      )
    },
    {
      id: "analysis", header: "Analysis Detail",
      cell: ({ row }) => {
        const d = row.original.analysis_detail;
        const text = d?.catalyst || d?.impact || "";
        if (!text) return <span className="text-zinc-600 text-[10px]">—</span>;
        return (
          <div className="flex flex-col gap-0.5">
            <span className="text-[11px] text-zinc-300 line-clamp-1 leading-tight">
              {text}
            </span>
            <button
              onClick={(e) => { e.stopPropagation(); setModalData(row.original); }}
              className="text-[10px] text-blue-400 hover:text-blue-300 self-start"
            >
              ••• more
            </button>
          </div>
        );
      }
    },
  ], [fetchAnalysis]);

  const table = useReactTable({
    data: gapperData?.gappers || [],
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  if (loading) return <div className="flex items-center justify-center py-20 text-zinc-500"><RefreshCw size={20} className="animate-spin"/></div>;
  if (!gapperData?.gappers?.length) return <div className="text-center py-16 text-zinc-500 text-sm">No gapper data — run gapper_service.py first</div>;

  return (
    <div className="relative flex min-h-0">
      {/* Main Table */}
      <div className={`flex-1 overflow-x-auto transition-all duration-300 ${selectedTicker ? "mr-[440px]" : ""}`}>
        <div className="flex items-center justify-between px-4 py-2 border-b border-zinc-800/60">
          <span className="text-[13px] text-zinc-500">
            {gapperData.gappers.length} gappers · {gapperData.scan_time ? `Scanned ${gapperData.scan_time}` : ""}
          </span>
          <span className="text-[11px] text-zinc-600">Click any row to fetch live Gemini analysis →</span>
        </div>
        <table className="w-full min-w-[1100px] text-left border-collapse">
          <thead>
            {table.getHeaderGroups().map(hg => (
              <tr key={hg.id} className="text-[10px] text-zinc-500 uppercase tracking-wider bg-zinc-900/80 border-b border-zinc-700/40">
                {hg.headers.map(h => (
                  <th key={h.id} className="py-2 px-2 font-medium whitespace-nowrap">
                    {flexRender(h.column.columnDef.header, h.getContext())}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map(row => {
              const g = row.original;
              const isFail = g.technical_status === "Fail";
              const isSelected = selectedTicker === g.ticker;
              return (
                <tr key={row.id}
                  className={`border-b border-zinc-800/40 transition-colors cursor-pointer h-[56px]
                    ${isSelected ? "bg-blue-500/10" : "hover:bg-zinc-800/20"}
                    ${isFail ? "opacity-40" : ""}
                  `}
                  onClick={() => fetchAnalysis(g.ticker, g)}
                >
                  {row.getVisibleCells().map(cell => (
                    <td key={cell.id} className={`py-1 px-2 align-top max-h-[56px] overflow-hidden ${cell.column.id === "analysis" ? "min-w-[280px]" : ""}`}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Slide-out Analysis Panel */}
      <div className={`fixed right-0 top-0 h-full w-[440px] bg-zinc-950 border-l border-zinc-800 shadow-2xl z-30 flex flex-col transition-transform duration-300 ${selectedTicker ? "translate-x-0" : "translate-x-full"}`}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800 flex-shrink-0">
          <div className="flex items-center gap-2">
            <span className="font-bold font-mono text-zinc-100">{selectedTicker}</span>
            {analysis?.grade && <span className={`text-[13px] font-bold px-1.5 py-0.5 rounded border ${gradeStyle(analysis.grade)}`}>{analysis.grade}</span>}
            {analysis?.technical_status && (
              <span className={`text-[10px] px-1.5 py-0.5 rounded ${analysis.technical_status === "Pass" ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30" : "bg-red-500/20 text-red-400 border border-red-500/30"}`}>
                {analysis.technical_status}
              </span>
            )}
          </div>
          <button onClick={() => { setSelectedTicker(null); setAnalysis(null); }} className="text-zinc-500 hover:text-zinc-200 transition-colors text-lg leading-none">✕</button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
          {analyzing && (
            <div className="flex items-center gap-2 text-zinc-500 text-sm py-12 justify-center">
              <RefreshCw size={16} className="animate-spin"/> Fetching live analysis…
            </div>
          )}
          {analysis?.error && <div className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded p-3">{analysis.error}</div>}
          {analysis && !analysis.error && (
            <>
              {/* Stats Grid */}
              <div className="grid grid-cols-3 gap-1.5">
                {[
                  { label: "Price",    value: analysis.price    != null ? `$${analysis.price.toFixed(2)}` : "—" },
                  { label: "Gap",      value: analysis.gap_pct  != null ? `+${analysis.gap_pct.toFixed(1)}%` : "—" },
                  { label: "PM Vol",   value: analysis.pm_volume != null ? `${(analysis.pm_volume/1000).toFixed(0)}K` : "—" },
                  { label: "ADR(20)",  value: analysis.adr_pct  != null ? `${analysis.adr_pct.toFixed(1)}%` : "—" },
                  { label: "RVOL",     value: analysis.rvol     != null ? `${analysis.rvol.toFixed(2)}x` : "—" },
                  { label: "Mkt Cap",  value: analysis.mkt_cap  != null ? `$${(analysis.mkt_cap/1e9).toFixed(2)}B` : "—" },
                  { label: "Float",    value: analysis.float_shares || "—" },
                  { label: "Short",    value: analysis.short_float || "—" },
                  { label: "Avg Vol",  value: analysis.avg_vol_10d != null ? `${(analysis.avg_vol_10d/1000).toFixed(0)}K` : "—" },
                ].map(({ label, value }) => (
                  <div key={label} className="bg-zinc-900 rounded p-2">
                    <div className="text-[10px] text-zinc-500 uppercase tracking-wide">{label}</div>
                    <div className="font-mono text-[13px] text-zinc-200 mt-0.5">{value}</div>
                  </div>
                ))}
              </div>

              {/* Category + Conviction */}
              <div className="flex gap-2">
                <div className="flex-1 bg-zinc-900 rounded p-2">
                  <div className="text-[10px] text-zinc-500 uppercase mb-0.5">Category</div>
                  <div className="text-[13px] text-zinc-200">{analysis.category || "—"}</div>
                </div>
                <div className="bg-zinc-900 rounded p-2 text-center w-20">
                  <div className="text-[10px] text-zinc-500 uppercase mb-0.5">Conviction</div>
                  <div className={`text-base font-bold ${analysis.conviction >= 70 ? "text-emerald-400" : analysis.conviction >= 50 ? "text-amber-400" : "text-zinc-500"}`}>{analysis.conviction ?? "—"}</div>
                </div>
              </div>

              {/* Reasoning */}
              {analysis.reasoning && (
                <div>
                  <div className="text-[10px] text-zinc-500 uppercase tracking-wide mb-1">Mechanical Trigger</div>
                  <div className="text-[13px] text-zinc-300 bg-zinc-900 rounded p-2.5 leading-relaxed">{analysis.reasoning}</div>
                </div>
              )}

              {/* Catalyst + Impact */}
              {analysis.analysis_detail && (
                <div>
                  <div className="text-[10px] text-zinc-500 uppercase tracking-wide mb-1">Catalyst Breakdown</div>
                  <div className="bg-zinc-900 rounded p-3 space-y-2">
                    {analysis.analysis_detail.catalyst && (
                      <div className="text-[12px] text-zinc-300 leading-relaxed"
                        dangerouslySetInnerHTML={{ __html: analysis.analysis_detail.catalyst.replace(/\*\*(.*?)\*\*/g, '<strong class="text-zinc-100">$1</strong>') }}/>
                    )}
                    {analysis.analysis_detail.impact && (
                      <div className="text-[12px] text-zinc-500 italic border-t border-zinc-800 pt-2 leading-relaxed">{analysis.analysis_detail.impact}</div>
                    )}
                  </div>
                </div>
              )}

              {/* Full Analysis markdown */}
              {analysis.analysis_details && (
                <div>
                  <div className="text-[10px] text-zinc-500 uppercase tracking-wide mb-1">Full Analysis</div>
                  <div className="text-[12px] text-zinc-400 bg-zinc-900 rounded p-3 leading-relaxed whitespace-pre-line"
                    dangerouslySetInnerHTML={{ __html: analysis.analysis_details
                      .replace(/\*\*(.*?)\*\*/g, '<strong class="text-zinc-200">$1</strong>') }}/>
                </div>
              )}

              {/* Trade Hypothesis */}
              {analysis.hypothesis && (
                <div className="bg-blue-500/10 border border-blue-500/30 rounded p-3">
                  <div className="text-[10px] text-blue-400 uppercase tracking-wide mb-1">Trade Hypothesis</div>
                  <div className="text-[12px] text-blue-300 leading-relaxed">{analysis.hypothesis}</div>
                </div>
              )}

              {/* Headlines */}
              {analysis.headlines?.length > 0 && (
                <div>
                  <div className="text-[10px] text-zinc-500 uppercase tracking-wide mb-1">Recent Headlines</div>
                  <div className="space-y-1">
                    {analysis.headlines.map((h, i) => (
                      <div key={i} className="text-[11px] text-zinc-400 bg-zinc-900/60 rounded px-2 py-1.5 leading-snug">· {h}</div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

// ── Market Brief Panel (RSS 全文 + Gemini：可信度、交叉驗證、突破單建議) ──
const MarketBriefPanel = ({ data }) => {
  if (!data) {
    return (
      <div className="max-w-[1400px] mx-auto px-4 py-16 text-center">
        <Landmark size={28} className="mx-auto mb-3 text-zinc-600"/>
        <p className="text-sm text-zinc-500">Brief not yet generated</p>
        <p className="text-[13px] text-zinc-600 mt-1">Runs at 8:00 AM and 4:00 PM ET on trading days</p>
      </div>
    );
  }

  const { generated_at, session, brief, article_count, fulltext_articles, fulltext_success_count } = data;
  const b = brief || {};

  const renderBold = (text) => {
    if (!text) return null;
    const parts = text.split(/\*\*(.+?)\*\*/g);
    return parts.map((part, i) =>
      i % 2 === 1 ? <strong key={i} className="text-white font-semibold">{part}</strong> : part
    );
  };

  const credStyle = (c) => {
    const x = (c || "").toLowerCase();
    if (x === "high") return "bg-emerald-500/15 text-emerald-300 border-emerald-500/35";
    if (x === "low") return "bg-red-500/15 text-red-300 border-red-500/35";
    return "bg-amber-500/15 text-amber-200 border-amber-500/35";
  };

  const isPendingSetup = b.pending_setup === true;
  const isLegacyBrief = !b.error && !isPendingSetup && !b.top_market_views && (b.macro_news?.length > 0 || b.sentiment);

  return (
    <div className="max-w-[1400px] mx-auto px-4 py-6">
      <div className="flex flex-wrap items-center gap-3 mb-5">
        <span className="text-[12px] text-zinc-500">
          {generated_at}
          {article_count != null && ` · RSS ${article_count} 則`}
          {fulltext_articles != null && fulltext_success_count != null
            && ` · 全文 ${fulltext_success_count}/${fulltext_articles} 篇`}
        </span>
      </div>

      {isPendingSetup && (
        <div className="text-sm text-zinc-300 bg-zinc-800/50 border border-zinc-600/50 rounded-lg p-4 mb-5 leading-relaxed">
          {b.pending_message || "尚未產生簡報。請設定 GEMINI_API_KEY 並執行 python market_brief.py。"}
        </div>
      )}
      {b.error && !isPendingSetup && (
        <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg p-4 mb-5">
          分析錯誤：{b.error}
        </div>
      )}

      {isLegacyBrief && (
        <p className="text-[13px] text-amber-400/90 bg-amber-500/10 border border-amber-500/25 rounded-lg px-3 py-2 mb-5">
          此檔為舊版格式。請重新執行 <code className="text-amber-200">python market_brief.py</code> 以產生新聞全文分析與突破單建議。
        </p>
      )}

      {/* 交叉驗證 */}
      {b.cross_check_note && (
        <div className="mb-5 bg-zinc-900/80 border border-zinc-700/50 rounded-xl p-4">
          <h3 className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider mb-2">交叉驗證</h3>
          <p className="text-sm text-zinc-300 leading-relaxed">{b.cross_check_note}</p>
        </div>
      )}

      {/* 三大市場觀點 */}
      {b.top_market_views?.length > 0 && (
        <div className="mb-5">
          <h3 className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider mb-3">波動主因（精簡）</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {b.top_market_views.map((line, i) => (
              <div key={i} className="bg-zinc-900 border border-zinc-800/60 rounded-lg p-4">
                <div className="text-[11px] font-mono text-zinc-600 mb-1">#{i + 1}</div>
                <p className="text-sm text-zinc-200 leading-snug">{line}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 突破單建議 */}
      {b.breakout_trading_advice && (
        <div className="mb-5 rounded-xl border border-amber-500/30 bg-amber-500/5 p-4">
          <h3 className="text-[11px] font-semibold text-amber-400/90 uppercase tracking-wider mb-2">突破單建議</h3>
          <p className="text-sm text-zinc-200 leading-relaxed whitespace-pre-wrap">{renderBold(b.breakout_trading_advice)}</p>
        </div>
      )}

      {/* 各則可信度 */}
      {b.articles_reviewed?.length > 0 && (
        <div className="mb-5">
          <h3 className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider mb-3">新聞可信度（逐則）</h3>
          <div className="space-y-2">
            {b.articles_reviewed.map((row, i) => (
              <div key={i} className="bg-zinc-900/60 border border-zinc-800/50 rounded-lg px-3 py-2.5 flex flex-wrap gap-2 items-start">
                <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded border shrink-0 ${credStyle(row.credibility)}`}>
                  {row.credibility || "—"}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-[11px] text-zinc-500 mb-0.5">{row.source}</div>
                  <div className="text-[13px] font-medium text-zinc-200 leading-snug">{row.title}</div>
                  {row.credibility_note && (
                    <p className="text-[12px] text-zinc-500 mt-1 leading-relaxed">{row.credibility_note}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 舊版 fallback 顯示 */}
      {isLegacyBrief && b.macro_news?.length > 0 && (
        <div className="mb-5">
          <h3 className="text-[13px] font-semibold text-zinc-500 uppercase tracking-wider mb-3">Macro（舊版）</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {b.macro_news.map((item, i) => (
              <div key={i} className="bg-zinc-900 border border-zinc-800/60 rounded-lg p-4">
                <div className="text-[13px] font-semibold text-amber-400 mb-2">{item.title}</div>
                <p className="text-[13px] text-zinc-300 leading-relaxed">{renderBold(item.summary)}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default function App() {
  const [tab, setTab] = useState("scanner");
  const [data, setData] = useState(null);
  const [briefData, setBriefData] = useState(null);
  const [newsData, setNewsData]   = useState(null);
  const [ibkrThemesData, setIbkrThemesData] = useState(null);
  const [earningsData, setEarningsData]     = useState(null);
  const [econData, setEconData]             = useState(null);
  const [internalsData, setInternalsData]   = useState(null);
  const [lbView, setLbView]                 = useState("themes");
  const [spotlightThemeName, setSpotlightThemeName] = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filtersOn, setFiltersOn] = useState(false);
  const [filterDolVol, setFilterDolVol] = useState("100");
  const [filterADR, setFilterADR] = useState("4");
  const [filterRS, setFilterRS] = useState("85");
  const [filterDist52w, setFilterDist52w] = useState("20");
  const [showFP, setShowFP] = useState(false);
  // eslint-disable-next-line no-unused-vars
  const [lbPerfKey, setLbPerfKey] = useState("perf_1m");
  const [rsSPYKey, setRsSPYKey] = useState("perf_1m");
  const [fetchedAt, setFetchedAt] = useState(null);
  const [countdown, setCountdown] = useState(null);
  const nextFetchAt = useRef(null);
  const lastGeneratedAt = useRef(null);
  const [macroHover, setMacroHover] = useState(null);
  const [ibkrData, setIbkrData] = useState(null);

  // ── IBKR WebSocket live price stream ──────────────────────────────────────
  // livePricesRef: { TICKER: { price, change_pct } } — mutated directly, no re-render
  // wsStatus: drives the ⚡ LIVE badge only ("connecting" | "live" | "offline")
  const [wsStatus, setWsStatus] = useState("offline");
  const livePricesRef = useRef({});
  const wsRef = useRef(null);

  // ── Market store (global macro alerts + reversal) ─────────────────────────
  // Use separate selectors — object selectors create new refs every render → infinite loop
  const updateFromIntel = useMarketStore((s) => s.updateFromIntel);
  const creditRegime    = useMarketStore((s) => s.creditRegime);
  const prevReversal = useRef(false);

  // Poll market_intelligence.json every 60 seconds to keep the store fresh.
  // On reversal flip (false → true), trigger a browser notification.
  useEffect(() => {
    const INTERVAL = 60 * 1000;
    const poll = async () => {
      try {
        const r = await fetch(
          `${process.env.PUBLIC_URL}/market_intelligence.json?v=${Date.now()}`
        );
        if (!r.ok) return;
        const data = await r.json();
        updateFromIntel(data);

        // Reversal flip notification
        const isNowReversal =
          data.regime?.reversal?.signal_detected ||
          data.reversal_signals?.signal_detected ||
          false;
        if (!prevReversal.current && isNowReversal) {
          const desc =
            data.regime?.reversal?.signal_description ||
            data.reversal_signals?.signal_description ||
            "Reversal pattern detected";
          if ("Notification" in window && Notification.permission === "granted") {
            new Notification("🚨 Reversal Signal Detected", { body: desc, icon: "/favicon.ico" });
          } else if ("Notification" in window && Notification.permission !== "denied") {
            Notification.requestPermission().then((p) => {
              if (p === "granted")
                new Notification("🚨 Reversal Signal Detected", { body: desc, icon: "/favicon.ico" });
            });
          }
        }
        prevReversal.current = isNowReversal;
      } catch {}
    };
    poll();
    const id = setInterval(poll, INTERVAL);
    return () => clearInterval(id);
  }, [updateFromIntel]); // eslint-disable-line react-hooks/exhaustive-deps

  // Countdown ticker — counts down to next actual data update
  useEffect(() => {
    const tick = () => {
      if (nextFetchAt.current == null) return;
      const remaining = Math.max(0, Math.ceil((nextFetchAt.current - Date.now()) / 1000));
      setCountdown(remaining);
    };
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  // Thematic data — poll every 5 min (matches scraper schedule)
  useEffect(() => {
    const INTERVAL = 5 * 60 * 1000;
    const fetchThematic = async () => {
      try {
        const r = await fetch(process.env.PUBLIC_URL + "/thematic_data.json?v=" + Date.now());
        if (r.ok) {
          const json = await r.json();
          // Only reset countdown when data actually changed
          if (json.generated_at !== lastGeneratedAt.current) {
            lastGeneratedAt.current = json.generated_at;
            setFetchedAt(Date.now());
            nextFetchAt.current = Date.now() + INTERVAL;
          }
          for (const theme of (json.themes || []))
            for (const sub of (theme.subthemes || []))
              for (const stock of (sub.stocks || []))
                if (stock.perf_1d == null) stock.perf_1d = stock.change_pct ?? null;
          setData(json);
        }
      } catch (err) { console.error("[ThematicScanner] fetch failed:", err); }
      setLoading(false);
    };
    setLoading(true);
    fetchThematic();
    const id = setInterval(fetchThematic, INTERVAL);
    return () => clearInterval(id);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Supplementary JSON files — fetched once on mount (no polling needed;
  // these are regenerated by the same nightly workflow as thematic_data.json).
  // 404s are treated as "not yet generated" and silently set state to null.
  useEffect(() => {
    const safeFetch = (filename) =>
      fetch(`${process.env.PUBLIC_URL}/${filename}`)
        .then(r => r.ok ? r.json() : null)
        .catch(() => null);

    const v = Date.now();
    Promise.all([
      safeFetch(`ibkr_themes.json?v=${v}`),
      safeFetch(`earnings_calendar.json?v=${v}`),
      safeFetch(`econ_calendar.json?v=${v}`),
      safeFetch(`market_internals.json?v=${v}`),
    ]).then(([ibkrThemes, earnings, econ, internals]) => {
      setIbkrThemesData(ibkrThemes);
      setEarningsData(earnings);
      setEconData(econ);
      setInternalsData(internals);
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Market brief — poll every 5 min
  useEffect(() => {
    const fetchBrief = () => {
      fetch(process.env.PUBLIC_URL + "/market_brief.json?v=" + Date.now())
        .then(r => r.ok ? r.json() : null)
        .then(d => { if (d) setBriefData(d); })
        .catch(() => {});
    };
    fetchBrief();
    const id = setInterval(fetchBrief, 5 * 60 * 1000);
    return () => clearInterval(id);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Breaking news — poll every 5 min
  useEffect(() => {
    const fetchNews = () => {
      fetch(process.env.PUBLIC_URL + "/breaking_news.json?v=" + Date.now())
        .then(r => r.ok ? r.json() : null)
        .then(d => { if (d) setNewsData(d); })
        .catch(() => {});
    };
    fetchNews();
    const id = setInterval(fetchNews, 5 * 60 * 1000);
    return () => clearInterval(id);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // IBKR themes — poll every 5 min (fallback to null when TWS offline)
  useEffect(() => {
    const fetchIbkr = () => {
      fetch(process.env.PUBLIC_URL + "/ibkr_themes.json?v=" + Date.now())
        .then(r => r.ok ? r.json() : null)
        .then(d => { if (d) setIbkrData(d); })
        .catch(() => {});
    };
    fetchIbkr();
    const id = setInterval(fetchIbkr, 5 * 60 * 1000);
    return () => clearInterval(id);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── IBKR TWS WebSocket price stream (ibkr_ws_server.py on port 5003) ──────
  // Receives live prices every ~1 second and patches the DOM directly for zero
  // re-render overhead. Falls back silently if the server is not running.
  useEffect(() => {
    let ws = null;
    let reconnectTimer = null;
    let alive = true;

    const applyPrices = (data) => {
      // Store in ref (no re-render)
      Object.assign(livePricesRef.current, data);
      // DOM-patch visible price + 1D change cells directly
      for (const [ticker, info] of Object.entries(data)) {
        if (info == null) continue;
        // Price cell: data-price-cell="TICKER"
        const priceEl = document.querySelector(`[data-price-cell="${ticker}"]`);
        if (priceEl && info.price != null) {
          priceEl.textContent = `$${Number(info.price).toFixed(2)}`;
        }
        // 1D change cell: data-chg-cell="TICKER"
        const chgEl = document.querySelector(`[data-chg-cell="${ticker}"]`);
        if (chgEl && info.change_pct != null) {
          const v = info.change_pct;
          chgEl.textContent = `${v >= 0 ? "+" : ""}${v.toFixed(2)}%`;
          // Update color class
          chgEl.className = `inline-block rounded-md px-2 py-1.5 text-[13px] font-mono font-medium ${
            v >= 20 ? "text-emerald-300 bg-emerald-500/30"
            : v >= 10 ? "text-emerald-400 bg-emerald-500/20"
            : v >= 5  ? "text-emerald-400 bg-emerald-500/10"
            : v >= 0  ? "text-emerald-400/80 bg-emerald-500/5"
            : v >= -5 ? "text-red-400/80 bg-red-500/5"
            : v >= -10? "text-red-400 bg-red-500/10"
            : v >= -20? "text-red-400 bg-red-500/20"
            :           "text-red-300 bg-red-500/30"
          }`;
        }
        // Navbar ticker tape: data-tape-price="SPY" / data-tape-price="QQQ"
        const tapeEl = document.querySelector(`[data-tape-price="${ticker}"]`);
        if (tapeEl && info.price != null) {
          tapeEl.textContent = Number(info.price).toFixed(ticker === "QQQ" || ticker === "SPY" ? 2 : 2);
        }
        const tapeChgEl = document.querySelector(`[data-tape-chg="${ticker}"]`);
        if (tapeChgEl && info.change_pct != null) {
          const v = info.change_pct;
          tapeChgEl.textContent = `${v >= 0 ? "+" : ""}${v.toFixed(2)}%`;
          tapeChgEl.className = v >= 0 ? "text-emerald-400" : "text-red-400";
        }
      }
    };

    const connect = () => {
      if (!alive) return;
      setWsStatus("connecting");
      try {
        ws = new WebSocket("ws://localhost:5003");
        wsRef.current = ws;
      } catch {
        setWsStatus("offline");
        reconnectTimer = setTimeout(connect, 5000);
        return;
      }

      ws.onopen = () => {
        if (!alive) { ws.close(); return; }
        setWsStatus("live");
        // Apply any pre-existing cached prices from livePricesRef immediately
      };

      ws.onmessage = (evt) => {
        try {
          const msg = JSON.parse(evt.data);
          // Both "snapshot" and "prices" messages carry a "data" dict
          if ((msg.type === "snapshot" || msg.type === "prices") && msg.data) {
            applyPrices(msg.data);
          }
        } catch { /* ignore malformed */ }
      };

      ws.onerror = () => {}; // onclose will handle reconnect

      ws.onclose = () => {
        if (!alive) return;
        setWsStatus("offline");
        reconnectTimer = setTimeout(connect, 5000); // retry every 5 s
      };
    };

    connect();

    return () => {
      alive = false;
      clearTimeout(reconnectTimer);
      if (ws) { try { ws.close(); } catch {} }
      wsRef.current = null;
      setWsStatus("offline");
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

const filtered = useMemo(() => {
    if (!data) return [];
    return data.themes.map(t => {
      const norm = normalizeTheme(t);
      const filteredSubs = norm.subthemes.map(sub => {
        let st = sub.stocks;
        if (search) {
          const q = search.toLowerCase();
          st = st.filter(s => s.ticker.toLowerCase().includes(q) || (s.company || "").toLowerCase().includes(q));
        }
        if (filtersOn) {
          st = st.filter(s =>
            s.avg_dollar_volume >= (parseFloat(filterDolVol) || 0) * 1e6 &&
            s.adr_pct >= (parseFloat(filterADR) || 0) &&
            s.rs_52w >= (parseFloat(filterRS) || 0) &&
            (s.dist_52w_high == null || s.dist_52w_high >= -(parseFloat(filterDist52w) || 0))
          );
        }
        // In Stress regime: only show A/A+ grade stocks to reduce noise
        if (creditRegime === "Stress") {
          st = st.filter(s => {
            const g = getEliteGrade(s);
            return g === "A+" || g === "A";
          });
        }
        return { ...sub, stocks: st };
      }).filter(sub => sub.stocks.length > 0);
      return { ...norm, subthemes: filteredSubs };
    }).filter(t => t.subthemes.length > 0)
    .sort((a, b) => {
      const getRankingRS = (theme) => {
        const name = theme.name.toLowerCase();
        const entry =
          data.finviz_theme_rankings?.find(r => r.name?.toLowerCase() === name) ||
          data.theme_rankings?.find(r => r.name?.toLowerCase() === name);
        if (entry?.rs_score != null) return entry.rs_score;
        const stocks = theme.subthemes.flatMap(s => s.stocks);
        const vals = stocks.map(s => s.rs_52w).filter(v => v != null);
        return vals.length ? vals.reduce((s, v) => s + v, 0) / vals.length : 0;
      };
      return getRankingRS(b) - getRankingRS(a);
    });
  }, [data, search, filtersOn, filterDolVol, filterADR, filterRS, filterDist52w, creditRegime]);

  const unique = [...new Set(filtered.flatMap(t => t.subthemes.flatMap(s => s.stocks.map(st => st.ticker))))];
  const totalSubs = filtered.reduce((n, t) => n + t.subthemes.length, 0);

  const topADRTickers = useMemo(() => {
    if (!data) return new Set();
    const all = data.themes.flatMap(t => normalizeTheme(t).subthemes.flatMap(s => s.stocks));
    const sorted = [...all].sort((a, b) => (b.adr_pct || 0) - (a.adr_pct || 0));
    return new Set(sorted.slice(0, Math.ceil(sorted.length * 0.1)).map(s => s.ticker));
  }, [data]);



  if (loading) return <div className="min-h-screen bg-zinc-950 flex items-center justify-center"><RefreshCw size={24} className="text-zinc-500 animate-spin"/></div>;

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <GlobalAlertBanner />
      <div id="app-navbar" className="border-b border-zinc-800/60 bg-zinc-950/80 backdrop-blur-sm sticky top-0 z-20">
        <div className="max-w-[1400px] mx-auto px-4 py-2">
          {/* Row 1: Logo + Full Ticker Tape + IBKR badge */}
          <div className="flex items-center gap-2 mb-1">
            <div className="flex items-center gap-2 flex-shrink-0">
              <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center"><Zap size={14} className="text-white"/></div>
              <span className="text-[14px] font-bold tracking-tight whitespace-nowrap">Power Theme</span>
            </div>
            {/* Full ticker tape */}
            <div className="flex-1 min-w-0 overflow-hidden">
              {data?.market_condition && (() => {
                const { spy, qqq, iwm, btc, gld, oil, dxy, breadth_50d, breadth_200d, credit_spread } = data.market_condition;
                const fmtChg = v => v == null ? null : v > 0
                  ? <span className="text-emerald-400">+{v.toFixed(2)}%</span>
                  : <span className="text-red-400">{v.toFixed(2)}%</span>;
                const TV_SYMBOLS = { "NQ!": "CME_MINI:NQ1!", "ES!": "CME_MINI:ES1!", "RTY!": "CME_MINI:RTY1!" };
                const CHART = { btc: 'IBIT', gld: 'GLD', oil: 'USO', dxy: 'UUP', breadth_50d: '$SPXA50R', breadth_200d: '$SPXA200R', credit_spread: 'HYG' };
                const mkClick = (key, e) => { const ticker = CHART[key]; const rect = e.currentTarget.getBoundingClientRect(); setMacroHover(prev => prev?.ticker === ticker ? null : { ticker, rect }); };
                const breadthColor = v => v >= 60 ? "text-emerald-400" : v >= 40 ? "text-yellow-400" : "text-red-400";
                const Sep = () => <span className="text-zinc-700 mx-1">|</span>;
                return (
                  <div className="hidden lg:flex items-center gap-1 text-[11px] font-mono flex-wrap overflow-hidden">
                    {qqq && (
                      <span className="flex items-center gap-1 cursor-pointer hover:bg-zinc-800/50 rounded px-1 transition-colors"
                        onClick={() => window.open(`https://www.tradingview.com/chart/?symbol=${encodeURIComponent(TV_SYMBOLS["NQ!"])}`, "_blank")}>
                        <span className="text-zinc-500">NQ!</span>
                        {qqq.price != null && <span className="text-zinc-300">{qqq.price.toFixed(0)}</span>}
                        {fmtChg(qqq.change_pct)}
                      </span>
                    )}
                    {spy && <><Sep/><span className="flex items-center gap-1 cursor-pointer hover:bg-zinc-800/50 rounded px-1 transition-colors"
                        onClick={() => window.open(`https://www.tradingview.com/chart/?symbol=${encodeURIComponent(TV_SYMBOLS["ES!"])}`, "_blank")}>
                        <span className="text-zinc-500">ES!</span>
                        {spy.price != null && <span className="text-zinc-300">{spy.price.toFixed(0)}</span>}
                        {fmtChg(spy.change_pct)}
                      </span></>}
                    {iwm && <><Sep/><span className="flex items-center gap-1 cursor-pointer hover:bg-zinc-800/50 rounded px-1 transition-colors"
                        onClick={() => window.open(`https://www.tradingview.com/chart/?symbol=CME_MINI:RTY1!`, "_blank")}>
                        <span className="text-zinc-500">RTY!</span>
                        {iwm.price != null && <span className="text-zinc-300">{iwm.price.toFixed(0)}</span>}
                        {fmtChg(iwm.change_pct)}
                      </span></>}
                    {breadth_50d != null && <><Sep/><span className="flex items-center gap-1 cursor-pointer hover:bg-zinc-800/50 rounded px-1 transition-colors" onClick={e => mkClick('breadth_50d', e)}>
                        <span className="text-zinc-600">S5FI</span>
                        <span className={breadthColor(breadth_50d)}>{breadth_50d.toFixed(1)}%</span>
                      </span></>}
                    {btc && <><Sep/><span className="flex items-center gap-1 cursor-pointer hover:bg-zinc-800/50 rounded px-1 transition-colors" onClick={e => mkClick('btc', e)}>
                        <span className="text-zinc-600">BTC</span>
                        {btc.price != null && <span className="text-zinc-300">{btc.price.toLocaleString('en-US', { maximumFractionDigits: 0 })}</span>}
                        {fmtChg(btc.change_pct)}
                      </span></>}
                    {gld && <><Sep/><span className="flex items-center gap-1 cursor-pointer hover:bg-zinc-800/50 rounded px-1 transition-colors" onClick={e => mkClick('gld', e)}>
                        <span className="text-zinc-600">GC1!</span>
                        {gld.price != null && <span className="text-zinc-300">{gld.price.toFixed(0)}</span>}
                        {fmtChg(gld.change_pct)}
                      </span></>}
                    {oil && <><Sep/><span className="flex items-center gap-1 cursor-pointer hover:bg-zinc-800/50 rounded px-1 transition-colors" onClick={e => mkClick('oil', e)}>
                        <span className="text-zinc-600">CL1!</span>
                        {oil.price != null && <span className="text-zinc-300">${oil.price.toFixed(2)}</span>}
                        {fmtChg(oil.change_pct)}
                      </span></>}
                    {dxy && <><Sep/><span className="flex items-center gap-1 cursor-pointer hover:bg-zinc-800/50 rounded px-1 transition-colors" onClick={e => mkClick('dxy', e)}>
                        <span className="text-zinc-600">DXY</span>
                        {dxy.price != null && <span className={dxy.change_pct > 0 ? "text-red-400" : dxy.change_pct < 0 ? "text-emerald-400" : "text-zinc-300"}>{dxy.price.toFixed(2)}</span>}
                        {dxy.change_pct != null && <span className={dxy.change_pct > 0 ? "text-red-400" : dxy.change_pct < 0 ? "text-emerald-400" : "text-zinc-400"}>{dxy.change_pct > 0 ? "+" : ""}{dxy.change_pct.toFixed(2)}%</span>}
                      </span></>}
                    {breadth_200d != null && <><Sep/><span className="flex items-center gap-1 cursor-pointer hover:bg-zinc-800/50 rounded px-1 transition-colors" onClick={e => mkClick('breadth_200d', e)}>
                        <span className="text-zinc-600">MMTH 200D</span>
                        <span className={breadthColor(breadth_200d)}>{breadth_200d.toFixed(1)}%</span>
                      </span></>}
                    {credit_spread != null && <><Sep/><span className="flex items-center gap-1 cursor-pointer hover:bg-zinc-800/50 rounded px-1 transition-colors" onClick={e => mkClick('credit_spread', e)}>
                        <span className="text-zinc-600">HY Spread</span>
                        <span className="text-zinc-300">{credit_spread.value.toFixed(2)}%</span>
                      </span></>}
                  </div>
                );
              })()}
            </div>
            {/* IBKR Live badge + Updated time */}
            <div className="flex items-center gap-2 flex-shrink-0">
              {wsStatus === "live" && (
                <span className="px-2 py-0.5 text-[10px] font-bold rounded-full border font-mono bg-blue-500/15 text-blue-400 border-blue-500/40 whitespace-nowrap animate-pulse">⚡ LIVE</span>
              )}
              {wsStatus === "connecting" && (
                <span className="px-2 py-0.5 text-[10px] font-bold rounded-full border font-mono bg-yellow-500/10 text-yellow-500 border-yellow-500/30 whitespace-nowrap">◌ WS...</span>
              )}
              {ibkrThemesData?.data_source === "ibkr" ? (
                <span className="px-2 py-0.5 text-[10px] font-bold rounded-full border font-mono bg-emerald-500/15 text-emerald-400 border-emerald-500/40 whitespace-nowrap">● IBKR Live</span>
              ) : (
                <span className="px-2 py-0.5 text-[10px] font-bold rounded-full border font-mono bg-zinc-800/60 text-zinc-500 border-zinc-700/40 whitespace-nowrap">◐ IBKR Offline</span>
              )}
              {data && (
                <div className="text-right leading-tight">
                  <div className="text-[11px] font-medium text-emerald-400 whitespace-nowrap">
                    {data.generated_at || data.last_updated}
                  </div>
                  {countdown != null && (
                    <div className="text-[10px] text-zinc-500">
                      <span className="font-mono">{countdown >= 60 ? `${Math.floor(countdown/60)}m ${countdown%60}s` : `${countdown}s`}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Row 2: ECON TODAY bar */}
          {econData?.events?.length > 0 && (() => {
            const Sep = () => <span className="text-zinc-800 mx-1">|</span>;
            const todayEvents = (econData?.events || []).filter(e => {
              if (!e.date) return false;
              const today = new Date().toISOString().slice(0, 10);
              return e.date === today;
            }).slice(0, 3);
            if (!todayEvents.length) return null;
            return (
              <div className="hidden lg:flex items-center gap-1 text-[11px] font-mono py-0.5 border-t border-zinc-800/40 flex-wrap overflow-hidden">
                <span className="text-amber-400 font-bold mr-1 whitespace-nowrap tracking-wide">ECON TODAY</span>
                <span className="text-zinc-600 mr-1">→</span>
                {todayEvents.map((ev, idx) => (
                  <React.Fragment key={idx}>
                    <span className="flex items-center gap-1 whitespace-nowrap">
                      {ev.time && <span className="text-zinc-500">{ev.time}</span>}
                      <span className="text-zinc-300">{(ev.event || ev.name || '').replace(/\s+Index$/i, '')}</span>
                      {ev.estimate != null && <span className="text-zinc-500">Est {ev.estimate}</span>}
                    </span>
                    {idx < todayEvents.length - 1 && <Sep/>}
                  </React.Fragment>
                ))}
              </div>
            );
          })()}


          {/* Row 3: Tabs + right-side actions */}
          <div className="flex items-center border-t border-zinc-800/50 pt-1 mt-0.5">
            <div className="flex items-center gap-0 flex-1">
              <button onClick={() => setTab("scanner")} className={`px-3 py-1.5 text-[13px] font-medium border-b-2 -mb-px transition-colors whitespace-nowrap ${tab === "scanner" ? "border-blue-400 text-white" : "border-transparent text-zinc-500 hover:text-zinc-300"}`}>
                Thematic Scanner
              </button>
              <button onClick={() => setTab("gapper")} className={`px-3 py-1.5 text-[13px] font-medium border-b-2 -mb-px transition-colors whitespace-nowrap ${tab === "gapper" ? "border-blue-400 text-white" : "border-transparent text-zinc-500 hover:text-zinc-300"}`}>
                Pre-Market Gappers
              </button>
              <button onClick={() => setTab("breadth")} className={`px-3 py-1.5 text-[13px] font-medium border-b-2 -mb-px transition-colors whitespace-nowrap ${tab === "breadth" ? "border-blue-400 text-white" : "border-transparent text-zinc-500 hover:text-zinc-300"}`}>
                Market Breadth
              </button>
              <button onClick={() => setTab("news")} className={`px-3 py-1.5 text-[13px] font-medium border-b-2 -mb-px transition-colors whitespace-nowrap ${tab === "news" ? "border-blue-400 text-white" : "border-transparent text-zinc-500 hover:text-zinc-300"}`}>
                Calendar
              </button>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => setTab("journal")} className={`px-2.5 py-1 text-[12px] font-medium rounded-md border transition-colors whitespace-nowrap ${tab === "journal" ? "bg-blue-500/15 border-blue-500/30 text-blue-400" : "bg-zinc-800/60 border-zinc-700/50 text-zinc-400 hover:text-zinc-300"}`}>
                Trade Journal
              </button>
              <SearchBar data={data} search={search} setSearch={setSearch}/>
              <button className="flex items-center gap-1 px-2.5 py-1 text-[12px] rounded-md border bg-zinc-800/60 border-zinc-700/50 text-zinc-400 hover:text-zinc-300 transition-colors whitespace-nowrap">
                Alerts
              </button>
            </div>
          </div>

          {tab === "scanner" && (
            <>
            <div className="flex flex-wrap items-center gap-3 mt-1.5">
              {(() => {
                const signal = data?.market_condition?.signal;
                const signalLabel = signal === "green" ? "Market Uptrend" : signal === "yellow" ? "Market Correction" : "Market Downtrend";
                const signalArrow = signal === "green" ? "↑" : signal === "yellow" ? "→" : "↓";
                const signalCls = signal === "green" ? "text-emerald-400" : signal === "yellow" ? "text-amber-400" : "text-red-400";
                return (
                  <div className="flex items-center gap-2 text-[12px] font-mono flex-1 min-w-0 overflow-hidden">
                    <span className={`font-semibold whitespace-nowrap ${signalCls}`}>{signalArrow} {signalLabel}</span>
                    <span className="text-zinc-700">|</span>
                    <span className="text-zinc-500 whitespace-nowrap">{filtered.length} themes · {unique.length} tickers</span>
                    <span className="text-zinc-700">|</span>
                    <span className="text-zinc-600 whitespace-nowrap">Superperf gate: RS&gt;85 · Price&gt;$12 · Vol&gt;$100M · MCap&gt;$2B · ADR≥4%</span>
                  </div>
                );
              })()}
              <button onClick={()=>setShowFP(!showFP)} className={`flex items-center gap-1.5 px-2.5 py-1.5 text-[13px] rounded-md border transition-colors ${filtersOn?'bg-blue-500/15 border-blue-500/30 text-blue-400':'bg-zinc-800/60 border-zinc-700/50 text-zinc-400'}`}>
                <SlidersHorizontal size={12}/> Filters
              </button>
            </div>
            {showFP && (
              <div className="mt-2.5 p-3 bg-zinc-800/40 rounded-lg border border-zinc-700/40 flex flex-wrap items-end gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={filtersOn} onChange={()=>setFiltersOn(!filtersOn)} className="rounded"/>
                  <span className="text-[13px] text-zinc-300">Enable</span>
                </label>
                <div>
                  <label className="text-[11px] text-zinc-500 block mb-1">Min Avg $ Vol (30D)</label>
                  <div className="flex items-center gap-1">
                    <input type="number" min="0" value={filterDolVol} onChange={e=>setFilterDolVol(e.target.value)} className="text-[13px] bg-zinc-900 border border-zinc-700/50 rounded px-2 py-1 text-zinc-300 w-20"/>
                    <span className="text-[12px] text-zinc-500">M</span>
                  </div>
                </div>
                <div>
                  <label className="text-[11px] text-zinc-500 block mb-1">Min ADR%</label>
                  <div className="flex items-center gap-1">
                    <input type="number" min="0" step="0.5" value={filterADR} onChange={e=>setFilterADR(e.target.value)} className="text-[13px] bg-zinc-900 border border-zinc-700/50 rounded px-2 py-1 text-zinc-300 w-16"/>
                    <span className="text-[12px] text-zinc-500">%</span>
                  </div>
                </div>
                <div>
                  <label className="text-[11px] text-zinc-500 block mb-1">Min RS</label>
                  <input type="number" min="0" max="99" value={filterRS} onChange={e=>setFilterRS(e.target.value)} className="text-[13px] bg-zinc-900 border border-zinc-700/50 rounded px-2 py-1 text-zinc-300 w-16"/>
                </div>
                <div>
                  <label className="text-[11px] text-zinc-500 block mb-1">Max Dist 52W Hi</label>
                  <div className="flex items-center gap-1">
                    <input type="number" min="0" value={filterDist52w} onChange={e=>setFilterDist52w(e.target.value)} className="text-[13px] bg-zinc-900 border border-zinc-700/50 rounded px-2 py-1 text-zinc-300 w-16"/>
                    <span className="text-[12px] text-zinc-500">%</span>
                  </div>
                </div>
              </div>
            )}
            </>
          )}
        </div>
      </div>

      {tab === "journal" ? <TradeJournalTab data={data}/> : tab === "news" ? <CalendarTab econData={econData} earningsData={earningsData} thematicData={data}/> : tab === "breadth" ? <MarketBreadthTab data={data} internalsData={internalsData} econData={econData}/> : tab === "gapper" ? <GapperScanner finvizThemeRankings={data?.finviz_theme_rankings || []} themeRankings={data?.theme_rankings || []} earningsData={earningsData} ibkrThemesData={ibkrThemesData}/> : (
        <>
        <div className="max-w-[1560px] mx-auto px-4 pt-2 pb-4 flex items-start gap-3">
          {/* ── LEFT SIDEBAR ─────────────────────────────────────── */}
          <aside className="w-[260px] flex-shrink-0 flex flex-col gap-3">
            <VixFearGaugeV2 vix={briefData?.global_snapshot?.find(r => r.label === "VIX")?.price ?? data?.vix}/>
            <MarketInternalsV2 mc={data?.market_condition} internalsData={internalsData}/>
            <PositionCalc ibkrThemesData={ibkrData} thematicData={data}/>
            <AlertRulesCard/>
          </aside>

          {/* ── CENTER MAIN CONTENT ──────────────────────────────── */}
          <main className="flex-1 min-w-0 flex flex-col gap-3">
            <ThemeHeatmap themes={data?.themes} finvizThemeRankings={data?.finviz_theme_rankings}/>
            {data && <Leaderboard
              themeRankings={data.theme_rankings}
              industryRankings={data.industry_rankings}
              finvizThemeRankings={data.finviz_theme_rankings}
              themes={data.themes}
              spyBenchmarks={data.spy_benchmarks}
              ibkrThemesData={ibkrThemesData}
              onViewChange={v => { setLbView(v); setSpotlightThemeName(null); }}
              onThemeSelect={name => setSpotlightThemeName(name)}
            />}
            {data && <CorrelationGuard themes={data.themes}/>}
            {data && <CounterTrendWarning themes={data.themes}/>}
            <ThematicSpotlight lbView={lbView} spotlightThemeName={spotlightThemeName} data={data} ibkrThemesData={ibkrThemesData}/>
          </main>

          {/* ── RIGHT SIDEBAR ────────────────────────────────────── */}
          <aside className="w-[200px] flex-shrink-0 flex flex-col gap-3">
            <LeadersAllThemesCard themes={data?.themes}/>
            <ActiveAlertsCardV2/>
            <IBKRTWSScannerCard ibkrData={ibkrData}/>
            <DataSourcesCard ibkrData={ibkrData}/>
          </aside>
        </div>

        {/* ── FULL THEME DETAIL SECTIONS (collapsible deep dive) ── */}
        {filtered.length > 0 && (
          <div className="max-w-[1560px] mx-auto px-4 pb-4">
            {filtered.map((t,i) => (
              <ThemeSection
                key={t.name+i}
                theme={t}
                lbPerfKey={lbPerfKey}
                spyPerf={data?.spy_benchmarks?.[rsSPYKey]}
                rsSPYKey={rsSPYKey}
                isTopTheme={i===0}
                topADRTickers={topADRTickers}
                themeRankings={data?.theme_rankings}
                finvizThemeRankings={data?.finviz_theme_rankings}
              />
            ))}
          </div>
        )}
        {filtered.length === 0 && data && (
          <div className="max-w-[1560px] mx-auto text-center py-8 text-zinc-500">
            <BarChart3 size={24} className="mx-auto mb-2 opacity-40"/>
            <p className="text-sm">No themes match current filters</p>
            <button onClick={()=>{setFiltersOn(false);setSearch("");}} className="mt-2 text-[13px] text-blue-400 hover:underline">Reset</button>
          </div>
        )}

        <BottomStatusBar ibkrData={ibkrData} briefData={briefData}/>
        </>
      )}
      {macroHover && <TVPopup ticker={macroHover.ticker} anchorRect={macroHover.rect} chartUrl={macroHover.chartUrl} onClose={() => setMacroHover(null)}/>}
    </div>
  );
}

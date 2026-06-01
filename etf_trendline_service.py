"""
etf_trendline_service.py — ETF 主題趨勢線突破／拉回偵測

Algorithm:
  1. yfinance 抓 6 個月日線 OHLC
  2. Swing point 偵測（視窗 W=5，尾端放寬）
  3. 外包絡線：阻力/支撐線在 P1~P2 區間不允許 bar 突出（P2 後不驗證）
     每個方向最多選「前兩名」線（P1 相差 ≥15 根、今日值相差 >1×ATR）
  4. 延伸到最後一個交易日 → 判斷 breakout / near_resistance / near_support
  5. 診斷輸出 — 不寫 JSON，不動前端

禁用 SMA/EMA 做突破/拉回判斷。
"""

import json
import logging
import sys
from pathlib import Path
from datetime import datetime, timedelta

import numpy as np
import pandas as pd
import yfinance as yf

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    stream=sys.stderr,
)
logger = logging.getLogger(__name__)

# ─── 可調參數 ─────────────────────────────────────────────────────────────────
SWING_WINDOW       = 5     # W — swing point 偵測左右各看幾根
MIN_BARS           = 60    # 資料筆數下限（6 個月 ≈ 126 根）
ATR_TOUCH_TOL      = 0.5   # ±N×ATR 容許誤差，算作「觸及」線
MIN_TOUCH_COUNT    = 2     # 至少幾個 swing 點觸及線才合格
ATR_PERIOD         = 14    # ATR 計算天數
LOOKBACK_MONTHS    = 6     # 回看月數
ENVELOPE_CLOSE_TOL = 0.5   # bar high/low 突出線外 ≤ N×ATR 算可接受（與 ATR_TOUCH_TOL 統一）
MAX_P2_AGE_BARS    = 30    # P2 距今超過此根數視為過時的線
MIN_LINE_P1_SEP    = 15    # 兩條線 P1 至少相差幾根（避免幾乎重疊的線）

# Signal 門檻（純趨勢線，禁用 SMA）
BREAKOUT_MAX_DIST        = 0.04  # 0 < (close - resistance) / resistance ≤ 4%
NEAR_RESISTANCE_MAX_DIST = 0.02  # -2% ≤ (close - resistance) / resistance < 0
SUPPORT_MAX_DIST         = 0.03  # 0 < (close - support) / support ≤ 3%
BREAKOUT_SCAN_BARS       = 5     # 往回掃幾根找突破日（0 或 1 天前才發訊號）


# ─── 載入白名單 ───────────────────────────────────────────────────────────────
def load_universe() -> list:
    p = Path(__file__).parent / "etf_universe.json"
    with open(p, encoding="utf-8") as f:
        return json.load(f)


# ─── OHLC 抓取 ────────────────────────────────────────────────────────────────
def fetch_ohlc(ticker: str, months: int = LOOKBACK_MONTHS) -> "pd.DataFrame | None":
    try:
        end   = datetime.today()
        start = end - timedelta(days=months * 31 + 10)
        df = yf.download(
            ticker,
            start=start.strftime("%Y-%m-%d"),
            end=end.strftime("%Y-%m-%d"),
            auto_adjust=True,
            progress=False,
        )
        if df is None or df.empty:
            return None
        if isinstance(df.columns, pd.MultiIndex):
            df.columns = df.columns.get_level_values(0)
        df = df.dropna(subset=["Open", "High", "Low", "Close"])
        for col in ["Open", "High", "Low", "Close"]:
            if isinstance(df[col], pd.DataFrame):
                df[col] = df[col].iloc[:, 0]
        return df
    except Exception as e:
        logger.error(f"{ticker}: fetch_ohlc failed — {e}")
        return None


# ─── ATR ──────────────────────────────────────────────────────────────────────
def calc_atr(df: pd.DataFrame, period: int = ATR_PERIOD) -> float:
    high  = df["High"].values
    low   = df["Low"].values
    close = df["Close"].values
    if len(high) < 2:
        return float(np.nanmean(high - low)) if len(high) > 0 else 1.0
    tr = np.maximum(
        high[1:] - low[1:],
        np.maximum(
            np.abs(high[1:] - close[:-1]),
            np.abs(low[1:]  - close[:-1]),
        ),
    )
    window = min(period, len(tr))
    return float(np.nanmean(tr[-window:])) if window > 0 else 1.0


# ─── Swing Point 偵測 ─────────────────────────────────────────────────────────
def detect_swings(df: pd.DataFrame, W: int = SWING_WINDOW):
    """
    回傳 (swing_high_indices, swing_low_indices)。
    尾端（右側 < W 根）改用非嚴格比較，確保最新轉折點不被漏掉。
    """
    highs = df["High"].values
    lows  = df["Low"].values
    n     = len(highs)

    swing_high_idx: list[int] = []
    swing_low_idx:  list[int] = []

    for i in range(n):
        left_avail  = min(W, i)
        right_avail = min(W, n - 1 - i)
        is_tail     = (n - 1 - i) < W

        if left_avail == 0 or right_avail == 0:
            continue

        if is_tail:
            lh = all(highs[i] >= highs[i - j] for j in range(1, left_avail  + 1))
            rh = all(highs[i] >= highs[i + j] for j in range(1, right_avail + 1))
            ll = all(lows[i]  <= lows[i - j]  for j in range(1, left_avail  + 1))
            rl = all(lows[i]  <= lows[i + j]  for j in range(1, right_avail + 1))
        else:
            lh = all(highs[i] > highs[i - j] for j in range(1, W + 1))
            rh = all(highs[i] > highs[i + j] for j in range(1, W + 1))
            ll = all(lows[i]  < lows[i - j]  for j in range(1, W + 1))
            rl = all(lows[i]  < lows[i + j]  for j in range(1, W + 1))

        if lh and rh:
            swing_high_idx.append(i)
        if ll and rl:
            swing_low_idx.append(i)

    return swing_high_idx, swing_low_idx


# ─── 工具 ─────────────────────────────────────────────────────────────────────
def line_y(fit: dict, x: int) -> float:
    return fit["slope"] * x + fit["intercept"]


def find_breakout_day(
    closes: np.ndarray,
    last_i: int,
    res_fit: dict,
    scan_bars: int = BREAKOUT_SCAN_BARS,
) -> "tuple[int, int] | tuple[None, None]":
    """往回掃最多 scan_bars 根，找第一根收盤 > 阻力線的 bar。"""
    scan_start = max(0, last_i - scan_bars + 1)
    for j in range(scan_start, last_i + 1):
        if closes[j] > line_y(res_fit, j):
            return j, last_i - j
    return None, None


def _build_candidates(
    idx_list:    list[int],
    price_list:  list[float],
    bar_array:   np.ndarray,  # highs（阻力）或 lows（支撐）
    atr:         float,
    is_resistance: bool,
) -> list[dict]:
    """
    枚舉所有 (P1, P2) 組合，回傳合格候選 list（已按 score DESC 排序）。
    is_resistance=True 時檢查 bar_array[k] ≤ line+tol（阻力不被突破）
    is_resistance=False 時檢查 bar_array[k] ≥ line-tol（支撐不被跌穿）
    """
    n = len(idx_list)
    if n < 2:
        return []

    tol_env   = ENVELOPE_CLOSE_TOL * atr
    tol_touch = ATR_TOUCH_TOL * atr
    last_i    = len(bar_array) - 1
    candidates: list[dict] = []

    for i in range(n):
        for j in range(i + 1, n):
            p1_x, p1_y = idx_list[i], price_list[i]
            p2_x, p2_y = idx_list[j], price_list[j]

            if last_i - p2_x > MAX_P2_AGE_BARS:
                continue

            slope     = (p2_y - p1_y) / (p2_x - p1_x)
            intercept = p1_y - slope * p1_x

            # P1~P2 區間驗證
            valid = True
            for k in range(p1_x, p2_x + 1):
                lv = slope * k + intercept
                if is_resistance:
                    if bar_array[k] > lv + tol_env:
                        valid = False; break
                else:
                    if bar_array[k] < lv - tol_env:
                        valid = False; break
            if not valid:
                continue

            # 觸及計數（P1~P2 區間內）
            touches = sum(
                1 for idx, price in zip(idx_list, price_list)
                if p1_x <= idx <= p2_x
                and abs(price - (slope * idx + intercept)) <= tol_touch
            )
            if touches < MIN_TOUCH_COUNT:
                continue

            span  = p2_x - p1_x
            score = touches * 2 + span * 0.05
            candidates.append({
                "slope":       float(slope),
                "intercept":   float(intercept),
                "r2":          1.0,
                "touches":     touches,
                "combo_pos":   [i, j],
                "combo_bars":  [p1_x, p2_x],
                "x_start":     p1_x,
                "x_end":       p2_x,
                "score":       score,
                "today_value": float(slope * last_i + intercept),
            })

    candidates.sort(key=lambda c: -c["score"])
    return candidates


def _select_top2(candidates: list[dict], atr: float) -> list[dict]:
    """
    從排好序的候選清單中挑出「前兩名」：
    - 兩條線 P1 相差 ≥ MIN_LINE_P1_SEP 根
    - 今日延伸值相差 > 1×ATR
    """
    if not candidates:
        return []
    selected = [candidates[0]]
    for c in candidates[1:]:
        if len(selected) >= 2:
            break
        ok = all(
            abs(c["x_start"] - s["x_start"]) >= MIN_LINE_P1_SEP
            and abs(c["today_value"] - s["today_value"]) > atr
            for s in selected
        )
        if ok:
            selected.append(c)
    return selected


# ─── 阻力線（最多 2 條）──────────────────────────────────────────────────────
def find_upper_envelope(
    sh_idx: list[int], sh_prices: list[float], highs: np.ndarray, atr: float
) -> list[dict]:
    return _select_top2(_build_candidates(sh_idx, sh_prices, highs, atr, True), atr)


# ─── 支撐線（最多 2 條）──────────────────────────────────────────────────────
def find_lower_envelope(
    sl_idx: list[int], sl_prices: list[float], lows: np.ndarray, atr: float
) -> list[dict]:
    return _select_top2(_build_candidates(sl_idx, sl_prices, lows, atr, False), atr)


# ─── 單一 ETF 分析 ────────────────────────────────────────────────────────────
def analyze_etf(ticker: str, theme: str, debug: bool = False) -> dict:
    base = {"ticker": ticker, "theme": theme, "rejected": None, "signal": None}

    # ── 1. 抓資料 ────────────────────────────────────────────────────────────
    df = fetch_ohlc(ticker)
    if df is None:
        return {**base, "rejected": "fetch failed"}
    if len(df) < MIN_BARS:
        return {**base, "rejected": f"資料不足 ({len(df)} bars < {MIN_BARS})"}

    atr    = calc_atr(df)
    dates  = df.index
    highs  = df["High"].values
    lows   = df["Low"].values
    closes = df["Close"].values
    n      = len(closes)

    # ── 2. Swing Points ──────────────────────────────────────────────────────
    sh_idx, sl_idx = detect_swings(df)
    sh_prices = [highs[i] for i in sh_idx]
    sl_prices = [lows[i]  for i in sl_idx]

    if debug:
        print(f"\n{'='*68}")
        print(f"  ★ DEBUG: {ticker}  (theme={theme})  bars={n}  ATR={atr:.4f}")
        print(f"  {'─'*65}")
        print(f"  Swing Highs — {len(sh_idx)} 個:")
        for i in sh_idx:
            print(f"    bar[{i:3d}]  {dates[i].date()}  H = {highs[i]:.4f}")
        print(f"  Swing Lows  — {len(sl_idx)} 個:")
        for i in sl_idx:
            print(f"    bar[{i:3d}]  {dates[i].date()}  L = {lows[i]:.4f}")

    # ── 3. 外包絡線（最多各 2 條）────────────────────────────────────────────
    res_fits = find_upper_envelope(sh_idx, sh_prices, highs, atr) if len(sh_idx) >= 2 else []
    sup_fits = find_lower_envelope(sl_idx, sl_prices, lows,  atr) if len(sl_idx) >= 2 else []

    res_ok = len(res_fits) > 0
    sup_ok = len(sup_fits) > 0

    # ── 4. 品質驗證 ──────────────────────────────────────────────────────────
    if not res_ok and not sup_ok:
        reasons = []
        for label, idx_list in [("阻力線", sh_idx), ("支撐線", sl_idx)]:
            if len(idx_list) < 2:
                reasons.append(f"{label}: swing 點不足 ({len(idx_list)} < 2)")
            else:
                reasons.append(f"{label}: 無合格組合（touches<{MIN_TOUCH_COUNT} 或 bar 突出）")
        return {**base, "rejected": " | ".join(reasons)}

    # ── 5. 今日延伸值 ────────────────────────────────────────────────────────
    last_i    = n - 1
    last_date = dates[last_i]
    close_now = float(closes[last_i])

    # 主線今日值（第一條、分數最高的）
    resistance_today = res_fits[0]["today_value"] if res_ok else None
    support_today    = sup_fits[0]["today_value"] if sup_ok else None

    # ── 6. 形態分類（用主線斜率）────────────────────────────────────────────
    if res_ok and sup_ok:
        rs, ss = res_fits[0]["slope"], sup_fits[0]["slope"]
        if rs < 0 and ss > 0:
            pattern = "triangle_converging"
        elif rs > 0 and ss < 0:
            pattern = "triangle_expanding"
        elif rs > 0 and ss > 0:
            pattern = "channel_up"
        else:
            pattern = "channel_down"
    elif res_ok:
        pattern = "resistance_only"
    else:
        pattern = "support_only"

    # ── [過濾 A] 單線參考 ────────────────────────────────────────────────────
    if not (res_ok and sup_ok):
        spark_len2       = min(60, n)
        spark_start_abs2 = n - spark_len2
        sparkline2       = [round(float(c), 2) for c in closes[-spark_len2:]]

        def fmt_line_ref(fit):
            p1b  = fit["x_start"]
            p1_s = p1b - spark_start_abs2
            if p1_s < 0:
                return None
            sv = fit["slope"] * (spark_start_abs2 + p1_s) + fit["intercept"]
            return {
                "p1":              [str(dates[p1b].date()), round(line_y(fit, p1b), 2)],
                "p2":              [str(dates[fit["x_end"]].date()), round(line_y(fit, fit["x_end"]), 2)],
                "today_value":     round(fit["today_value"], 2),
                "p1_spark_bar":    p1_s,
                "spark_start_val": round(float(sv), 2),
                "touches":         fit["touches"],
                "slope":           fit["slope"],
                "intercept":       fit["intercept"],
            }

        if debug:
            print(f"\n  ⚠ 單線（{pattern}）：不發訊號，供參考。")
            print(f"{'='*68}")
        return {
            **base,
            "pattern":           pattern,
            "reference_only":    True,
            "close":             close_now,
            "atr":               round(float(atr), 4),
            "sparkline":         sparkline2,
            "resistance_today":  resistance_today,
            "support_today":     support_today,
            "resistance_lines":  [r for r in (fmt_line_ref(rf) for rf in res_fits) if r is not None],
            "support_lines":     [s for s in (fmt_line_ref(sf) for sf in sup_fits) if s is not None],
            "res_fits":          res_fits,
            "sup_fits":          sup_fits,
            "last_date":         str(last_date.date()),
        }

    # ── [過濾 B] 通道顛倒（只比主線，避免次線外插誤判）──────────────────────
    if support_today >= resistance_today:
        reason = (f"通道顛倒 support({support_today:.2f}) >= "
                  f"resistance({resistance_today:.2f})")
        if debug:
            print(f"\n  ✗ {reason}")
            print(f"{'='*68}")
        return {**base, "rejected": reason}

    # ── 7. 訊號判斷 ──────────────────────────────────────────────────────────
    signal        = None
    dist_pct      = None
    line_ref      = None
    breakout_date = None

    # 分組：「尚未被突破」的阻力線、「價格仍站上」的支撐線
    res_above   = [r for r in res_fits if line_y(r, last_i) > close_now]
    res_crossed = [r for r in res_fits
                   if 0 < (close_now - line_y(r, last_i)) / line_y(r, last_i)
                   <= BREAKOUT_MAX_DIST]
    sup_below   = [s for s in sup_fits if line_y(s, last_i) < close_now]

    # Breakout：最低的「剛被突破」阻力線（0~4%）
    if res_crossed:
        res_low_fit = min(res_crossed, key=lambda r: line_y(r, last_i))
        res_low_val = line_y(res_low_fit, last_i)
        dist_res_low = (close_now - res_low_val) / res_low_val
        bo_bar, days_since = find_breakout_day(closes, last_i, res_low_fit)
        if bo_bar is not None and days_since <= 1:
            signal        = "breakout"
            dist_pct      = dist_res_low * 100
            line_ref      = "resistance"
            breakout_date = str(dates[bo_bar].date())

    # Near resistance：距任何「尚未突破」阻力線 ≤2%（取最近的那條）
    if signal is None and res_above:
        best_nr_dist = None
        for rf in res_above:
            rv = line_y(rf, last_i)
            d  = (close_now - rv) / rv  # 負值（在線下方）
            if -NEAR_RESISTANCE_MAX_DIST <= d < 0:
                if best_nr_dist is None or abs(d) < abs(best_nr_dist):
                    best_nr_dist = d
        if best_nr_dist is not None:
            signal   = "near_resistance"
            dist_pct = best_nr_dist * 100
            line_ref = "resistance"

    # Near support：最高的「價格仍站上」支撐線（0~3%）
    if signal is None and sup_below:
        sup_high_fit = max(sup_below, key=lambda s: line_y(s, last_i))
        sup_high_val = line_y(sup_high_fit, last_i)
        dist_sup     = (close_now - sup_high_val) / sup_high_val
        if 0 < dist_sup <= SUPPORT_MAX_DIST:
            signal   = "near_support"
            dist_pct = dist_sup * 100
            line_ref = "support"

    # ── Debug 詳細輸出 ───────────────────────────────────────────────────────
    if debug:
        tol = ATR_TOUCH_TOL * atr
        print(f"\n  外包絡線結果（最多 2 條，P1 相差≥{MIN_LINE_P1_SEP} bars，今日值差>1×ATR）:")

        for dir_label, fits, all_bar_idx, all_prices_list, is_res in [
            ("阻力線(Resistance)", res_fits, sh_idx, sh_prices, True),
            ("支撐線(Support)",    sup_fits, sl_idx, sl_prices, False),
        ]:
            if not fits:
                print(f"    {dir_label}: 無合格組合")
                continue
            for k_idx, fit in enumerate(fits, 1):
                tag = f"#{k_idx}"
                x0, x1 = fit["x_start"], fit["x_end"]
                y0, y1 = line_y(fit, x0), line_y(fit, x1)
                d0, d1 = dates[x0].date(), dates[x1].date()
                cb     = fit["combo_bars"]
                cp     = [highs[b] if is_res else lows[b] for b in cb]
                print(f"    {dir_label} {tag}  [touches={fit['touches']}, score={fit['score']:.2f}]")
                print(f"      P1: ({d0}, {y0:.4f})  P2: ({d1}, {y1:.4f})  斜率={fit['slope']:.6f}")
                print(f"      今日延伸 [{last_date.date()}]: {fit['today_value']:.4f}")
                print(f"      觸及點:")
                for bi, pr in zip(all_bar_idx, all_prices_list):
                    pred = line_y(fit, bi)
                    err  = pr - pred
                    mark = "✓" if abs(err) <= tol else " "
                    star = "★" if bi in cb else " "
                    print(f"       {star} {mark}  bar[{bi:3d}]  {dates[bi].date()}"
                          f"  price={pr:.4f}  line={pred:.4f}  err={err:+.4f}")

        print(f"\n  收盤價 [{last_date.date()}]: {close_now:.4f}")
        for k_idx, rf in enumerate(res_fits, 1):
            rv   = line_y(rf, last_i)
            dist = (close_now - rv) / rv * 100
            drct = "↑" if dist > 0 else "↓"
            bo_bar, ds = find_breakout_day(closes, last_i, rf)
            bo_s = (f"突破 {dates[bo_bar].date()}({ds}天前) "
                    f"{'✓' if ds <= 1 else '✗'}" if bo_bar else "未突破")
            print(f"  阻力線#{k_idx}: {rv:.4f}  dist={dist:+.2f}% {drct}  {bo_s}")
        for k_idx, sf in enumerate(sup_fits, 1):
            sv   = line_y(sf, last_i)
            dist = (close_now - sv) / sv * 100
            drct = "↑" if dist > 0 else "↓"
            print(f"  支撐線#{k_idx}: {sv:.4f}  dist={dist:+.2f}% {drct}")

        sig_str  = signal or "（無訊號）"
        dist_str = f"{dist_pct:+.2f}%" if dist_pct is not None else "—"
        bo_str   = f"  breakout_day={breakout_date}" if breakout_date else ""
        print(f"  形態: {pattern}  →  訊號: {sig_str}  dist={dist_str}{bo_str}")
        print(f"{'='*68}")

    # ── 觸及點（供 TradingView 比對）────────────────────────────────────────
    tol = ATR_TOUCH_TOL * atr

    def touch_pts(fit, bar_idx_list, price_list):
        return [(str(dates[bi].date()), round(float(pr), 4))
                for bi, pr in zip(bar_idx_list, price_list)
                if abs(pr - line_y(fit, bi)) <= tol]

    res_touch_pts_all = [touch_pts(rf, sh_idx, sh_prices) for rf in res_fits]
    sup_touch_pts_all = [touch_pts(sf, sl_idx, sl_prices) for sf in sup_fits]

    # ── Sparkline（取最後 60 根收盤價）──────────────────────────────────────
    spark_len       = min(60, n)
    spark_start_abs = n - spark_len
    sparkline       = [round(float(c), 2) for c in closes[-spark_len:]]

    # ── JSON 格式線段資訊（含 sparkline 座標錨點）───────────────────────────
    def fmt_line(fit):
        p1b, p2b = fit["x_start"], fit["x_end"]
        p1_spark = p1b - spark_start_abs
        # P1 在 sparkline 範圍外 → 不畫此線（左邊沒有連接點，視覺浮空）
        if p1_spark < 0:
            return None
        spark_sv = fit["slope"] * (spark_start_abs + p1_spark) + fit["intercept"]
        return {
            "p1":             [str(dates[p1b].date()), round(line_y(fit, p1b), 2)],
            "p2":             [str(dates[p2b].date()), round(line_y(fit, p2b), 2)],
            "today_value":    round(fit["today_value"], 2),
            "p1_spark_bar":   p1_spark,
            "spark_start_val": round(float(spark_sv), 2),
            "touches":        fit["touches"],
            "slope":          fit["slope"],
            "intercept":      fit["intercept"],
        }

    resistance_lines = [r for r in (fmt_line(rf) for rf in res_fits) if r is not None]
    support_lines    = [s for s in (fmt_line(sf) for sf in sup_fits) if s is not None]

    return {
        "ticker":            ticker,
        "theme":             theme,
        "pattern":           pattern,
        "signal":            signal,
        "dist_pct":          dist_pct,
        "line_ref":          line_ref,
        "close":             close_now,
        "atr":               round(float(atr), 4),
        "sparkline":         sparkline,
        "resistance_today":  resistance_today,
        "support_today":     support_today,
        "breakout_date":     breakout_date,
        "res_fits":          res_fits,
        "sup_fits":          sup_fits,
        "res_touch_pts":     res_touch_pts_all,
        "sup_touch_pts":     sup_touch_pts_all,
        "resistance_lines":  resistance_lines,
        "support_lines":     support_lines,
        "last_date":         str(last_date.date()),
        "rejected":          None,
        "reference_only":    False,
    }


# ─── Main ─────────────────────────────────────────────────────────────────────
def main():
    universe = load_universe()

    print(f"\n{'='*68}")
    print(f"  ETF 趨勢線掃描器  ({len(universe)} ETFs in universe)")
    print(f"  W={SWING_WINDOW}  ATR_TOUCH=±{ATR_TOUCH_TOL}×ATR  ENVELOPE_TOL={ENVELOPE_CLOSE_TOL}×ATR"
          f"  P2_AGE≤{MAX_P2_AGE_BARS}  P1_SEP≥{MIN_LINE_P1_SEP}  回看={LOOKBACK_MONTHS}月")
    print(f"  🟢 Breakout       : 0 ~ +{BREAKOUT_MAX_DIST*100:.0f}%（最低阻力線）")
    print(f"  🔵 Near_Resistance: -{NEAR_RESISTANCE_MAX_DIST*100:.0f}% ~ 0（最近阻力線）")
    print(f"  🟡 Near_Support   : 0 ~ +{SUPPORT_MAX_DIST*100:.0f}%（最高支撐線）")
    print(f"{'='*68}")

    signals:   list[dict]  = []
    no_signal: list[dict]  = []
    ref_only:  list[dict]  = []
    rejected:  list[tuple] = []

    for entry in universe:
        ticker   = entry["ticker"]
        theme    = entry["theme"]
        is_debug = ticker in {"DRNZ", "XBI", "IBB"}

        try:
            result = analyze_etf(ticker, theme, debug=is_debug)
        except Exception as e:
            logger.error(f"{ticker}: 意外錯誤 — {e}", exc_info=True)
            result = {"ticker": ticker, "theme": theme,
                      "rejected": f"意外錯誤: {e}", "signal": None}

        if result.get("rejected"):
            rejected.append((ticker, theme, result["rejected"]))
        elif result.get("reference_only"):
            ref_only.append(result)
        elif result.get("signal"):
            signals.append(result)
        else:
            no_signal.append(result)

    # ── 有訊號 ETF ──────────────────────────────────────────────────────────
    print(f"\n{'─'*68}")
    print(f"  📊 有訊號的 ETF（{len(signals)} 支）")
    print(f"{'─'*68}")
    if signals:
        hdr = (f"  {'Sig':16s} {'ETF':6s} {'Theme':14s} {'Pattern':22s}"
               f" {'Close':>8s} {'Resist₁':>8s} {'Support₁':>9s} {'Dist%':>7s}")
        print(hdr)
        print(f"  {'─'*92}")
        for s in signals:
            sig = s["signal"]
            tag = {"breakout": "🟢 BREAKOUT      ",
                   "near_resistance": "🔵 NEAR_RESIST   ",
                   "near_support":    "🟡 NEAR_SUPPORT  "}.get(sig, "?")
            bo  = (f"  breakout={s['breakout_date']}" if sig == "breakout"
                   and s.get("breakout_date") else "")
            r1  = (f"{s['resistance_lines'][0]['today_value']:8.3f}"
                   if s.get("resistance_lines") else "       —")
            s1  = (f"{s['support_lines'][0]['today_value']:9.3f}"
                   if s.get("support_lines") else "        —")
            dist = s["dist_pct"]
            print(f"  {tag} {s['ticker']:6s} {s['theme']:14s} {s['pattern']:22s}"
                  f" {s['close']:8.3f} {r1} {s1} {dist:+7.2f}%{bo}")
    else:
        print("  （無）")

    # ── TradingView 比對 ─────────────────────────────────────────────────────
    tv_targets = signals + [r for r in no_signal
                            if r["ticker"] in {"DRNZ", "XBI", "IBB", "PPA"}]
    if tv_targets:
        print(f"\n{'─'*68}")
        print(f"  📐 TradingView 手動比對資料")
        print(f"{'─'*68}")
        for s in tv_targets:
            print(f"\n  ETF: {s['ticker']}  ({s['theme']})  close={s['close']:.2f}"
                  f"  signal={s.get('signal') or '—'}  pattern={s['pattern']}")

            for k, (rl, tpts) in enumerate(
                zip(s.get("resistance_lines", []), s.get("res_touch_pts", [])), 1
            ):
                label = f"阻力線#{k}"
                touch_str = ", ".join(f"({d}, ${p:.2f})" for d, p in tpts)
                print(f"  {label}: {rl['p1'][0]} ${rl['p1'][1]:.2f}"
                      f" → {rl['p2'][0]} ${rl['p2'][1]:.2f}"
                      f"  今日=${rl['today_value']:.2f}  touches={rl['touches']}")
                print(f"    觸及點: [{touch_str}]")

            for k, (sl_line, tpts) in enumerate(
                zip(s.get("support_lines", []), s.get("sup_touch_pts", [])), 1
            ):
                label = f"支撐線#{k}"
                touch_str = ", ".join(f"({d}, ${p:.2f})" for d, p in tpts)
                print(f"  {label}: {sl_line['p1'][0]} ${sl_line['p1'][1]:.2f}"
                      f" → {sl_line['p2'][0]} ${sl_line['p2'][1]:.2f}"
                      f"  今日=${sl_line['today_value']:.2f}  touches={sl_line['touches']}")
                print(f"    觸及點: [{touch_str}]")

    # ── 雙線合格、無訊號 ─────────────────────────────────────────────────────
    print(f"\n{'─'*68}")
    print(f"  ⚪ 雙線合格、無訊號（{len(no_signal)} 支）")
    print(f"{'─'*68}")
    for s in no_signal:
        n_res = len(s.get("resistance_lines", []))
        n_sup = len(s.get("support_lines",   []))
        r1v = (s["resistance_lines"][0]["today_value"] if n_res else None)
        r2v = (s["resistance_lines"][1]["today_value"] if n_res >= 2 else None)
        s1v = (s["support_lines"][0]["today_value"]    if n_sup else None)
        s2v = (s["support_lines"][1]["today_value"]    if n_sup >= 2 else None)
        r_str = (f"{r1v:.2f}" + (f"/{r2v:.2f}" if r2v else "")) if r1v else "—"
        s_str = (f"{s1v:.2f}" + (f"/{s2v:.2f}" if s2v else "")) if s1v else "—"
        print(f"  {s['ticker']:6s} ({s['theme']:14s}) {s['pattern']:24s}"
              f"  close={s['close']:.2f}  res={r_str}  sup={s_str}")

    # ── 單線參考 ────────────────────────────────────────────────────────────
    print(f"\n{'─'*68}")
    print(f"  📋 單線（不發訊號，供參考）（{len(ref_only)} 支）")
    print(f"{'─'*68}")
    for s in ref_only:
        res_s = f"{s['resistance_today']:.3f}" if s.get("resistance_today") is not None else "—"
        sup_s = f"{s['support_today']:.3f}"    if s.get("support_today")    is not None else "—"
        print(f"  {s['ticker']:6s} ({s['theme']:14s}) {s['pattern']:24s}"
              f"  close={s['close']:.3f}  res={res_s}  sup={sup_s}")

    # ── 淘汰 ────────────────────────────────────────────────────────────────
    print(f"\n{'─'*68}")
    print(f"  ❌ 淘汰 / 跳過（{len(rejected)} 支）")
    print(f"{'─'*68}")
    for ticker, theme, reason in rejected:
        print(f"  {ticker:6s} ({theme:14s}) → {reason}")

    print(f"\n{'='*68}")
    print(f"  完成。signals={len(signals)}  no_signal={len(no_signal)}"
          f"  ref_only={len(ref_only)}  rejected={len(rejected)}")
    print(f"{'='*68}\n")

    # ── 寫出 public/etf_trendline.json ─────────────────────────────────────
    def _etf_record(r):
        return {
            "ticker":           r["ticker"],
            "theme":            r["theme"],
            "pattern":          r.get("pattern"),
            "signal":           r.get("signal"),
            "dist_pct":         r.get("dist_pct"),
            "close":            r.get("close"),
            "atr":              r.get("atr"),
            "sparkline":        r.get("sparkline", []),
            "resistance_lines": r.get("resistance_lines", []),
            "support_lines":    r.get("support_lines", []),
            "last_date":        r.get("last_date"),
        }

    out_path = Path(__file__).parent / "public" / "etf_trendline.json"
    out_data = {
        "last_updated":  datetime.today().strftime("%Y-%m-%d"),
        "total_scanned": len(universe),
        "total_signals": len(signals),
        "etfs": (
            [_etf_record(s) for s in signals] +
            [_etf_record(s) for s in no_signal] +
            [_etf_record(s) for s in ref_only]
        ),
    }
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(out_data, f, ensure_ascii=False, separators=(",", ":"))
    print(f"  → 已寫入 {out_path}\n")


if __name__ == "__main__":
    main()

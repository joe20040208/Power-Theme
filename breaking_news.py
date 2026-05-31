#!/usr/bin/env python3
from __future__ import annotations
"""
Emergency News Monitor — High-Impact Breaking News Alerts

Runs every 5 min on weekdays via GitHub Actions.
Sources: CNBC, Finviz

Logic:
  1. Fetch headlines from the last 90 min
  2. Grade each 1-10 via Gemini for market impact
  3. Alert only if grade >= 8
  4. Rolling store: keep last 6 alerts, expire after 12 hours

Output: public/breaking_news.json
Telegram: Immediate push per new alert
"""

import json
import os
import re
import xml.etree.ElementTree as ET
from datetime import datetime, timezone, timedelta
from pathlib import Path
from zoneinfo import ZoneInfo

import requests
from dotenv import load_dotenv

load_dotenv()

ET_TZ           = ZoneInfo("America/New_York")
GEMINI_API_KEY  = os.getenv("GEMINI_API_KEY", "")
TELEGRAM_TOKEN  = os.getenv("TELEGRAM_BOT_TOKEN", "")
TELEGRAM_CHAT   = os.getenv("TELEGRAM_CHAT_ID", "")

ALERT_THRESHOLD = 9    # Gemini grade >= 9 triggers alert
HOURS_LOOKBACK  = 1.5  # Only consider headlines from last 90 min (covers 30-60 min run gaps)
MAX_ALERTS      = 6    # Keep at most N alerts in rolling store
ALERT_TTL_HOURS = 12   # Expire alerts older than N hours

RSS_FEEDS = [
    ("CNBC",        "https://www.cnbc.com/id/100003114/device/rss/rss.html"),
    ("CNBC Markets","https://www.cnbc.com/id/10000664/device/rss/rss.html"),
]


# ── RSS Fetch ───────────────────────────────────────────────────────────────

def fetch_headlines() -> list[dict]:
    from email.utils import parsedate_to_datetime
    headlines = []
    now_utc = datetime.now(timezone.utc)

    for source, url in RSS_FEEDS:
        try:
            r = requests.get(url, timeout=10, headers={"User-Agent": "Mozilla/5.0"})
            r.raise_for_status()
            root = ET.fromstring(r.content)

            for item in root.findall(".//item")[:15]:
                title_el   = item.find("title")
                pubdate_el = item.find("pubDate")
                if title_el is None:
                    continue
                title = (title_el.text or "").strip()
                if not title:
                    continue

                # Recency filter
                pub_time = None
                if pubdate_el is not None and pubdate_el.text:
                    try:
                        pub_dt = parsedate_to_datetime(pubdate_el.text)
                        age_h  = (now_utc - pub_dt.astimezone(timezone.utc)).total_seconds() / 3600
                        if age_h > HOURS_LOOKBACK:
                            continue
                        pub_time = pub_dt.astimezone(ET_TZ).isoformat()
                    except Exception:
                        pass

                headlines.append({"title": title, "source": source, "pub_time": pub_time})
        except Exception as e:
            print(f"  RSS [{source}]: {e}")

    # Deduplicate
    seen, unique = set(), []
    for h in headlines:
        key = h["title"][:60].lower()
        if key not in seen:
            seen.add(key)
            unique.append(h)

    print(f"  Fetched {len(unique)} unique headlines (last {HOURS_LOOKBACK}h)")
    return unique


# ── Finviz News Scraper ──────────────────────────────────────────────────────

def fetch_finviz_headlines() -> list[dict]:
    """Scrape market news from Finviz news page (no RSS available)."""
    from bs4 import BeautifulSoup
    now_utc = datetime.now(timezone.utc)
    headlines = []

    try:
        r = requests.get(
            "https://finviz.com/news.ashx",
            timeout=10,
            headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"},
        )
        r.raise_for_status()
        soup  = BeautifulSoup(r.content, "html.parser")
        table = soup.find("table", id="news-table")
        if not table:
            print("  Finviz: news-table not found")
            return []

        current_date = None
        for row in table.find_all("tr"):
            cells = row.find_all("td")
            if len(cells) < 2:
                continue

            time_text = cells[0].get_text(strip=True)
            # Full date rows look like "Mar-24-26 07:23AM"; time-only rows "07:23AM"
            if re.match(r"[A-Z][a-z]{2}-\d{2}-\d{2}", time_text):
                current_date = time_text[:9]      # "Mar-24-26"
                time_part    = time_text[10:].strip()
            else:
                time_part    = time_text

            # Recency filter
            pub_time = None
            if current_date and time_part:
                try:
                    pub_dt = datetime.strptime(
                        f"{current_date} {time_part}", "%b-%d-%y %I:%M%p"
                    ).replace(tzinfo=ET_TZ)
                    if (now_utc - pub_dt.astimezone(timezone.utc)).total_seconds() / 3600 > HOURS_LOOKBACK:
                        continue
                    pub_time = pub_dt.isoformat()
                except Exception:
                    pass

            a_tag = cells[1].find("a")
            if not a_tag:
                continue
            title = a_tag.get_text(strip=True)
            if title:
                headlines.append({"title": title, "source": "Finviz", "pub_time": pub_time})

    except Exception as e:
        print(f"  Finviz: {e}")

    print(f"  Finviz: {len(headlines)} headline(s) (last {HOURS_LOOKBACK}h)")
    return headlines


# ── Government Policy Fast-Track ────────────────────────────────────────────
# Headlines matching these keyword patterns are sent to Telegram immediately,
# bypassing Gemini scoring entirely.

_GOV_ACTORS = [
    "white house", "president", "trump", "congress", "senate", "house of representatives",
    "pentagon", "dod", "department of defense", "department of energy", "doe",
    "department of commerce", "darpa", "nasa", "faa", "fda", "epa", "sec",
    "treasury", "federal reserve", "fed ", "fomc",
    "european union", "eu ", "china", "beijing", "japan", "south korea",
    "uk government", "g7", "g20", "nato",
]

_GOV_ACTIONS = [
    "invest", "fund", "allocat", "spend", "budget", "billion", "trillion",
    "contract", "program", "initiative", "mandate", "policy", "law", "bill",
    "executive order", "regulation", "deregulat", "approv", "ban", "sanction",
    "subsid", "grant", "procure", "deploy", "launch", "creat", "expand",
    "national strategy", "strategic reserve", "defense authorization",
]

# Patterns that signal an analysis/narrative article rather than a direct news fact.
# Headlines matching any of these are NOT self-explanatory from the title alone.
_ARTICLE_PATTERNS = re.compile(
    r"\bhow\b"           # "How X happened / How NASA ETF turned..."
    r"|\bwhy\b"          # "Why the Fed's move matters"
    r"|:\s*how\b"        # "TITLE: How something works"
    r"|:\s*why\b"
    r"|:\s*what\b"
    r"|\binside\b"       # "Inside Trump's drone push"
    r"|\bbehind\b"       # "Behind the $10B deal"
    r"|\bexplain"        # "Explaining the tariffs"
    r"|\bunderstand"     # "Understanding the new policy"
    r"|\bthe story\b"    # "The story of..."
    r"|\bwhat to know\b"
    r"|\bwhat you need\b",
    re.IGNORECASE,
)

def _is_article_headline(title: str) -> bool:
    """Return True if the headline is analysis/narrative rather than a direct news statement."""
    if title.rstrip().endswith("?"):
        return True
    return bool(_ARTICLE_PATTERNS.search(title))


def is_gov_policy_headline(title: str) -> bool:
    """Return True if the headline is a direct government policy/investment news fact."""
    if _is_article_headline(title):
        return False
    t = title.lower()
    has_actor  = any(kw in t for kw in _GOV_ACTORS)
    has_action = any(kw in t for kw in _GOV_ACTIONS)
    return has_actor and has_action


def send_telegram_gov_policy(headline: dict) -> None:
    """Send a fast-track government policy alert (no Gemini grade)."""
    if not TELEGRAM_TOKEN or not TELEGRAM_CHAT:
        return
    title  = headline.get("title", "")
    source = headline.get("source", "")
    lines = [
        "🏛️ *GOVERNMENT POLICY ALERT* 🏛️",
        "",
        f"*{_esc(title.upper())}*",
        f"_{_esc(source)}_",
    ]
    text = "\n".join(lines)[:4090]
    chat_ids = [cid.strip() for cid in TELEGRAM_CHAT.split(",")]
    for chat_id in chat_ids:
        try:
            r = requests.post(
                f"https://api.telegram.org/bot{TELEGRAM_TOKEN}/sendMessage",
                json={"chat_id": chat_id, "text": text, "parse_mode": "MarkdownV2",
                      "disable_web_page_preview": True},
                timeout=15,
            )
            r.raise_for_status()
            print(f"  Telegram [GOV]: sent to {chat_id} — {title[:60]}")
        except Exception as e:
            print(f"  Telegram [GOV] failed for {chat_id}: {e}")


# ── Gemini Grading ──────────────────────────────────────────────────────────

ALLOWED_SOURCES = {"CNBC", "CNBC Markets", "Finviz"}


def grade_with_gemini(headlines: list[dict]) -> list[dict]:
    if not GEMINI_API_KEY or not headlines:
        return []

    # Map normalized headline → original feed source so we can restore it after Gemini
    source_map = {h["title"]: h["source"] for h in headlines}

    headlines_text = "\n".join(
        f"{i+1}. [{h['source']}] {h['title']}"
        for i, h in enumerate(headlines[:30])
    )

    prompt = f"""You are a senior equity trader. Grade each headline 1–10 for likelihood of \
causing an immediate large market move.

GRADE 9–10 — BEARISH macro shocks:
  - Fed emergency action / surprise rate hike or cut outside scheduled FOMC
  - Declared war or military strikes between major nations (US, China, Russia, Iran, Israel, NATO)
  - Major country sovereign default or IMF bailout (G20 level)
  - Surprise tariff announcement affecting entire industries
  - Stock market circuit breaker triggered
  - Major central bank emergency meeting / policy reversal
  - Catastrophic natural disaster disrupting global supply chain

GRADE 9–10 — BULLISH macro catalysts:
  - Major ceasefire or peace deal signed between warring nations
  - Surprise tariff removal or landmark trade deal (US-China, US-EU, etc.)
  - Fed surprise rate cut or QE announcement outside scheduled FOMC

GRADE 9 — Single company earnings pre-market surge ≥10% (BULLISH):
  - Headline confirms a specific stock is up ≥10% pre-market or after-hours due to earnings
  - ONLY if: (1) move is explicitly stated as ≥10%, AND (2) cause is earnings/results/guidance

GRADE 9 — Single company catastrophic event (BEARISH):
  - A specific company suffers a confirmed major operational disaster likely to crash its stock:
    rocket/launch/spacecraft explosion, plant or factory explosion, major fire, fatal vehicle
    or aircraft crash, refinery/pipeline disaster, mine collapse, large product recall, plane
    grounding, major data breach, accounting fraud exposed, sudden bankruptcy filing,
    plant shutdown from an accident
  - ONLY if: (1) the event is a CONFIRMED real incident (not speculation, lawsuit, or rumor),
    AND (2) it clearly maps to a specific named company or its stock

AUTOMATICALLY GRADE 7 OR BELOW — DO NOT INCLUDE:
  - Any government policy, spending, investment, contract, or mandate (handled separately)
  - Individual company earnings with no stated ≥10% price move
  - Upgrades, downgrades, analyst price targets
  - Speculative headlines: "could", "may", "expected to", "concerns about", "fears of"
  - Nuclear threats or military posturing unless confirmed action is taken
  - Oil price moves unless caused by a confirmed supply disruption
  - Economic data releases (CPI, PPI, NFP) unless they trigger an emergency Fed response
  - Routine geopolitical commentary with no direct trade/supply-chain impact
  - Election results unless they immediately enact a major economic policy change

Headlines:
{headlines_text}

Return ONLY a valid JSON array. Include ONLY headlines graded 8+.
For each include a "direction" field: "bullish" or "bearish".
Use EXACTLY the source label shown in brackets:
{{
  "headline": "exact headline text",
  "source": "source label from brackets",
  "grade": 9,
  "direction": "bullish"
}}

If NO headlines score 8+, return: []
Output ONLY the JSON array. No markdown, no explanation."""

    try:
        from google import genai
        client   = genai.Client(api_key=GEMINI_API_KEY)
        response = client.models.generate_content(
            model="gemini-2.5-flash", contents=prompt
        )
        raw    = response.text.strip().replace("```json", "").replace("```", "").strip()
        alerts = json.loads(raw)
        if not isinstance(alerts, list):
            return []

        result = []
        for a in alerts:
            if not isinstance(a, dict) or a.get("grade", 0) < ALERT_THRESHOLD:
                continue
            # Restore original feed source (overrides anything Gemini may have derived)
            original_source = source_map.get(a.get("headline", ""), a.get("source", ""))
            a["source"] = original_source
            # Drop alerts whose feed source is not in our approved list
            if a["source"] not in ALLOWED_SOURCES:
                print(f"  Filtered non-approved source: {a['source']}")
                continue
            result.append(a)
        return result
    except Exception as e:
        print(f"  Gemini grading failed: {e}")
        return []


# ── State Management ────────────────────────────────────────────────────────

def load_existing() -> dict:
    path = Path("public/breaking_news.json")
    if path.exists():
        try:
            return json.loads(path.read_text(encoding="utf-8"))
        except Exception:
            pass
    return {"alerts": [], "seen_keys": []}


def _headline_key(text: str) -> str:
    """Normalize a headline to a dedup key (strip punctuation, lowercase, first 100 chars)."""
    import string
    t = text.lower()[:100]
    t = "".join(c for c in t if c not in string.punctuation)
    return " ".join(t.split())


def is_seen(headline: str, existing: dict) -> bool:
    """True if this headline was already processed in a recent run."""
    known = {s["k"] for s in existing.get("seen_keys", [])}
    return _headline_key(headline) in known


def is_duplicate_alert(headline: str, existing: dict) -> bool:
    """True if this headline already exists as an active alert."""
    known = {_headline_key(a.get("headline", "")) for a in existing.get("alerts", [])}
    return _headline_key(headline) in known


def expire_seen_keys(seen: list[dict]) -> list[dict]:
    """Expire seen keys older than 7 days."""
    cutoff = datetime.now(timezone.utc) - timedelta(hours=168)
    result = []
    for s in seen:
        try:
            if datetime.fromisoformat(s["ts"]).astimezone(timezone.utc) >= cutoff:
                result.append(s)
        except Exception:
            result.append(s)
    return result


def expire_old_alerts(alerts: list[dict]) -> list[dict]:
    now_utc   = datetime.now(timezone.utc)
    cutoff    = now_utc - timedelta(hours=ALERT_TTL_HOURS)
    today_et  = datetime.now(ET_TZ).date()
    fresh     = []
    for a in alerts:
        ts = a.get("timestamp")
        if not ts:
            fresh.append(a)
            continue
        try:
            dt     = datetime.fromisoformat(ts)
            dt_utc = dt.astimezone(timezone.utc)
            dt_et  = dt.astimezone(ET_TZ)
            # Expire if older than TTL OR from a previous ET calendar day
            if dt_utc >= cutoff and dt_et.date() == today_et:
                fresh.append(a)
        except Exception:
            fresh.append(a)
    return fresh


# ── Telegram ────────────────────────────────────────────────────────────────

_MD2 = re.compile(r"([_*\[\]()~`>#+=|{}.!\-\\])")

def _esc(t: str) -> str:
    return _MD2.sub(r"\\\1", str(t))


def send_telegram(alert: dict) -> bool:
    if not TELEGRAM_TOKEN or not TELEGRAM_CHAT:
        print("  Telegram: not configured — skipping")
        return False

    grade     = alert.get("grade", 0)
    headline  = alert.get("headline", "")
    source    = alert.get("source", "")
    direction = alert.get("direction", "")

    if direction == "bullish":
        icon = "🟢 *BULLISH*"
    elif direction == "bearish":
        icon = "🔴 *BEARISH*"
    else:
        icon = ""

    lines = [
        "🚨 *BREAKING NEWS ALERT* 🚨",
        f"*Grade: {grade}/10*  {icon}",
        "",
        f"*{_esc(headline.upper())}*",
        f"_{_esc(source)}_",
    ]
    text = "\n".join(lines)[:4090]

    chat_ids = [cid.strip() for cid in TELEGRAM_CHAT.split(",")]
    success = False
    for chat_id in chat_ids:
        try:
            r = requests.post(
                f"https://api.telegram.org/bot{TELEGRAM_TOKEN}/sendMessage",
                json={"chat_id": chat_id, "text": text, "parse_mode": "MarkdownV2", "disable_web_page_preview": True},
                timeout=15,
            )
            r.raise_for_status()
            print(f"  Telegram: sent to {chat_id} — Grade {grade}")
            success = True
        except Exception as e:
            print(f"  Telegram failed for {chat_id}: {e}")
    return success


# ── Main ────────────────────────────────────────────────────────────────────

def main():
    now_et = datetime.now(ET_TZ)
    print(f"Emergency News Monitor — {now_et.strftime('%Y-%m-%d %H:%M ET')}")

    existing = load_existing()

    print("  [1/2] Fetching headlines…")
    headlines  = fetch_headlines()          # CNBC + Yahoo Finance RSS
    headlines += fetch_finviz_headlines()   # Finviz scrape

    # Deduplicate across sources
    seen_titles, deduped = set(), []
    for h in headlines:
        key = h["title"][:60].lower()
        if key not in seen_titles:
            seen_titles.add(key)
            deduped.append(h)
    headlines = deduped

    # ── Dedup: skip anything already processed in last 6 hours ──────────────
    ts_now = datetime.now(timezone.utc).isoformat()
    fresh_headlines = [h for h in headlines if not is_seen(h["title"], existing)]
    skipped = len(headlines) - len(fresh_headlines)
    if skipped:
        print(f"  Dedup: skipped {skipped} already-seen headline(s)")

    # Mark all fetched headlines as seen (regardless of grade)
    new_seen = [{"k": _headline_key(h["title"]), "ts": ts_now} for h in fresh_headlines]
    all_seen = expire_seen_keys(existing.get("seen_keys", []) + new_seen)

    ts = now_et.isoformat()
    pub_time_map = {h["title"]: h.get("pub_time") for h in deduped}
    new_alerts: list[dict] = []

    # ── Fast-track: government policy headlines bypass Gemini ────────────────
    gov_hits = [
        h for h in fresh_headlines
        if is_gov_policy_headline(h["title"])
        and not is_duplicate_alert(h["title"], existing)
    ]
    if gov_hits:
        print(f"  [GOV] {len(gov_hits)} government policy headline(s) → direct Telegram")
    for h in gov_hits:
        send_telegram_gov_policy(h)
        new_alerts.append({
            "headline":  h["title"],
            "source":    h["source"],
            "grade":     "GOV",
            "direction": "bullish",
            "timestamp": ts,
            "pub_time":  h.get("pub_time"),
        })

    # Exclude gov-policy hits from Gemini batch (already handled)
    gov_titles   = {h["title"] for h in gov_hits}
    gemini_batch = [h for h in fresh_headlines if h["title"] not in gov_titles]

    # ── Gemini grading for remaining headlines ────────────────────────────────
    if gemini_batch:
        print(f"  [2/2] Grading {len(gemini_batch)} headline(s) with Gemini…")
        candidates = grade_with_gemini(gemini_batch)
        graded = [
            a for a in candidates
            if not is_duplicate_alert(a.get("headline", ""), existing)
        ]
        new_alerts += graded
    else:
        print("  [2/2] All headlines already seen or handled — skipping Gemini")
        graded = []

    # Timestamp and send Telegram for Gemini-graded alerts
    for a in graded:
        a["timestamp"] = ts
        a["pub_time"] = pub_time_map.get(a.get("headline", ""))
        send_telegram(a)

    # Merge, expire old, cap
    merged = new_alerts + expire_old_alerts(existing.get("alerts", []))
    merged = merged[:MAX_ALERTS]

    result = {
        "last_checked": now_et.strftime("%B %d, %Y (%H:%M EST)"),
        "has_alert":    len(merged) > 0,
        "alerts":       merged,
        "seen_keys":    all_seen,   # persisted for cross-run dedup
    }

    out = Path("public/breaking_news.json")
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(result, indent=2, ensure_ascii=False), encoding="utf-8")

    if new_alerts:
        max_grade = max(a.get("grade", 0) for a in new_alerts)
        print(f"  ⚡ {len(new_alerts)} NEW alert(s) — top grade: {max_grade}/10")
    else:
        print(f"  No new high-impact headlines (threshold: {ALERT_THRESHOLD}+)")
    print(f"  Saved → {out}  ({len(merged)} active alerts)")


if __name__ == "__main__":
    main()

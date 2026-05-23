"""
scraper.py — 美股強勢主題篩選器數據爬蟲 v4
Theme → Sub-theme → Stocks  hierarchical scan from Finviz Screener
產出 public/thematic_data.json
"""

import json
import os
import time
import random
import logging
from datetime import date, datetime, timedelta
from zoneinfo import ZoneInfo
from pathlib import Path

import requests
from bs4 import BeautifulSoup
import exchange_calendars as xcals

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                  "AppleWebKit/537.36 (KHTML, like Gecko) "
                  "Chrome/120.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml",
    "Accept-Language": "en-US,en;q=0.9",
}

CI = os.environ.get("CI") == "true"

TOP_THEMES = 5
TOP_SUBTHEMES_PER_THEME = 5
TOP_STOCKS_PER_SUBTHEME = 10

def _load_config_json(filename: str) -> dict:
    p = Path(__file__).parent / "config" / filename
    with open(p, encoding="utf-8") as f:
        return json.load(f)


# Hardcoded themes not available as Finviz industry groups — edit config/hardcoded_themes.json
HARDCODED_THEMES: dict[str, list[str]] = _load_config_json("hardcoded_themes.json")

_NYSE = xcals.get_calendar("XNYS")


def is_trading_day(d: date | None = None) -> bool:
    if d is None:
        d = date.today()
    try:
        return _NYSE.is_session(d.isoformat())
    except Exception:
        return d.weekday() < 5


def last_trading_date(d: date | None = None) -> date:
    if d is None:
        d = date.today()
    try:
        prev = _NYSE.previous_session(d.isoformat())
        return prev.date()
    except Exception:
        d -= timedelta(days=1)
        while not is_trading_day(d):
            d -= timedelta(days=1)
        return d


def parse_pct(s: str) -> float | None:
    if not s or s == "-":
        return None
    try:
        return float(s.replace("%", "").replace(",", "").strip())
    except ValueError:
        return None


def parse_vol(s: str) -> int:
    s = s.strip().upper()
    try:
        if s.endswith("B"):
            return int(float(s[:-1]) * 1e9)
        if s.endswith("M"):
            return int(float(s[:-1]) * 1e6)
        if s.endswith("K"):
            return int(float(s[:-1]) * 1e3)
        return int(float(s.replace(",", "")))
    except ValueError:
        return 0


def _sleep():
    lo, hi = (0.35, 0.7) if CI else (0.8, 1.6)
    time.sleep(random.uniform(lo, hi))


# ──────────────────────────────────────────────────────────────
# Industry → Parent Theme Mapping  (144 Finviz industries → ~20 themes)
# ──────────────────────────────────────────────────────────────

INDUSTRY_TO_THEME = {
    # ── Artificial Intelligence ──
    "Internet Content & Information": "Artificial Intelligence",
    "Advertising Agencies": "Artificial Intelligence",

    # ── Cloud Computing ──
    "Software - Infrastructure": "Cloud Computing",
    "Information Technology Services": "Cloud Computing",

    # ── Software ──
    "Software - Application": "Software",
    "Electronic Gaming & Multimedia": "Software",

    # ── Semiconductors ──
    "Semiconductors": "Semiconductors",
    "Semiconductor Equipment & Materials": "Semiconductors",

    # ── Hardware ──
    "Computer Hardware": "Hardware",
    "Consumer Electronics": "Hardware",

    # ── Cybersecurity ──
    "Security & Protection Services": "Cybersecurity",

    # ── Communication Equipment / Telecom ──
    "Communication Equipment": "Telecommunications",
    "Telecom Services": "Telecommunications",

    # ── Electric Vehicles ──
    "Auto Manufacturers": "Electric Vehicles",
    "Auto Parts": "Electric Vehicles",

    # ── Defense & Aerospace ──
    "Aerospace & Defense": "Defense & Aerospace",

    # ── Healthcare & Biotech ──
    "Biotechnology": "Healthcare & Biotech",
    "Drug Manufacturers - General": "Healthcare & Biotech",
    "Drug Manufacturers - Specialty & Generic": "Healthcare & Biotech",
    "Medical Devices": "Healthcare & Biotech",
    "Medical Instruments & Supplies": "Healthcare & Biotech",
    "Health Information Services": "Healthcare & Biotech",
    "Diagnostics & Research": "Healthcare & Biotech",

    # ── Healthcare Services ──
    "Healthcare Plans": "Healthcare Services",
    "Pharmaceutical Retailers": "Healthcare Services",
    "Medical Care Facilities": "Healthcare Services",
    "Medical Distribution": "Healthcare Services",

    # ── Fintech ──
    "Banks - Diversified": "Fintech",
    "Banks - Regional": "Fintech",
    "Capital Markets": "Fintech",
    "Financial Data & Stock Exchanges": "Fintech",
    "Asset Management": "Fintech",
    "Credit Services": "Fintech",
    "Financial Conglomerates": "Fintech",
    "Mortgage Finance": "Fintech",

    # ── Insurance ──
    "Insurance - Life": "Insurance",
    "Insurance - Property & Casualty": "Insurance",
    "Insurance - Diversified": "Insurance",
    "Insurance - Reinsurance": "Insurance",
    "Insurance - Specialty": "Insurance",
    "Insurance Brokers": "Insurance",

    # ── Energy Traditional ──
    "Oil & Gas E&P": "Energy Traditional",
    "Oil & Gas Integrated": "Energy Traditional",
    "Oil & Gas Midstream": "Energy Traditional",
    "Oil & Gas Refining & Marketing": "Energy Traditional",
    "Oil & Gas Equipment & Services": "Energy Traditional",
    "Oil & Gas Drilling": "Energy Traditional",

    # ── Nuclear & Coal ──
    "Uranium": "Nuclear & Coal",
    "Thermal Coal": "Nuclear & Coal",
    "Coking Coal": "Nuclear & Coal",

    # ── Utilities ──
    "Utilities - Regulated Electric": "Utilities",
    "Utilities - Regulated Gas": "Utilities",
    "Utilities - Diversified": "Utilities",
    "Utilities - Independent Power Producers": "Utilities",

    # ── Energy Renewable ──
    "Solar": "Energy Renewable",
    "Utilities - Renewable": "Energy Renewable",

    # ── Commodities Metals ──
    "Gold": "Commodities Metals",
    "Silver": "Commodities Metals",
    "Copper": "Commodities Metals",
    "Steel": "Commodities Metals",
    "Aluminum": "Commodities Metals",
    "Other Industrial Metals & Mining": "Commodities Metals",
    "Other Precious Metals & Mining": "Commodities Metals",

    # ── Materials & Mining ──
    "Specialty Chemicals": "Materials & Mining",
    "Chemicals": "Materials & Mining",
    "Building Materials": "Materials & Mining",
    "Lumber & Wood Production": "Materials & Mining",
    "Paper & Paper Products": "Materials & Mining",
    "Packaging & Containers": "Materials & Mining",
    "Metal Fabrication": "Materials & Mining",

    # ── Agriculture & Food ──
    "Farm Products": "Agriculture & Food",
    "Agricultural Inputs": "Agriculture & Food",
    "Packaged Foods": "Agriculture & Food",
    "Confectioners": "Agriculture & Food",
    "Food Distribution": "Agriculture & Food",
    "Grocery Stores": "Agriculture & Food",

    # ── Consumer Goods ──
    "Specialty Retail": "Consumer Goods",
    "Apparel Retail": "Consumer Goods",
    "Home Improvement Retail": "Consumer Goods",
    "Luxury Goods": "Consumer Goods",
    "Apparel Manufacturing": "Consumer Goods",
    "Footwear & Accessories": "Consumer Goods",
    "Department Stores": "Consumer Goods",
    "Furnishings, Fixtures & Appliances": "Consumer Goods",
    "Personal Services": "Consumer Goods",
    "Textile Manufacturing": "Consumer Goods",
    "Household & Personal Products": "Consumer Goods",
    "Beverages - Non-Alcoholic": "Consumer Goods",
    "Beverages - Brewers": "Consumer Goods",
    "Beverages - Wineries & Distilleries": "Consumer Goods",
    "Discount Stores": "Consumer Goods",
    "Tobacco": "Consumer Goods",

    # ── Digital Entertainment ──
    "Entertainment": "Digital Entertainment",
    "Gambling": "Digital Entertainment",
    "Resorts & Casinos": "Digital Entertainment",
    "Publishing": "Digital Entertainment",
    "Broadcasting": "Digital Entertainment",

    # ── Transportation & Logistics ──
    "Railroads": "Transportation & Logistics",
    "Trucking": "Transportation & Logistics",
    "Airlines": "Transportation & Logistics",
    "Airports & Air Services": "Transportation & Logistics",
    "Marine Shipping": "Transportation & Logistics",
    "Integrated Freight & Logistics": "Transportation & Logistics",

    # ── Industrial Automation ──
    "Specialty Industrial Machinery": "Industrial Automation",
    "Farm & Heavy Construction Machinery": "Industrial Automation",

    # ── Industrials ──
    "Industrial Distribution": "Industrials",
    # moved from Semiconductors (electronic components/distribution ≠ chip design)
    "Electronic Components": "Industrials",
    "Scientific & Technical Instruments": "Industrials",
    "Electronics & Computer Distribution": "Industrials",
    "Electrical Equipment & Parts": "Industrials",
    "Building Products & Equipment": "Industrials",
    "Engineering & Construction": "Industrials",
    "Conglomerates": "Industrials",
    "Rental & Leasing Services": "Industrials",
    "Consulting Services": "Industrials",
    "Staffing & Employment Services": "Industrials",
    "Tools & Accessories": "Industrials",
    "Business Equipment & Supplies": "Industrials",
    "Specialty Business Services": "Industrials",
    "Education & Training Services": "Industrials",

    # ── Environmental Sustainability ──
    "Waste Management": "Environmental Sustainability",
    "Pollution & Treatment Controls": "Environmental Sustainability",
    "Utilities - Regulated Water": "Environmental Sustainability",

    # ── Real Estate & REITs ──
    "REIT - Diversified": "Real Estate & REITs",
    "REIT - Industrial": "Real Estate & REITs",
    "REIT - Office": "Real Estate & REITs",
    "REIT - Residential": "Real Estate & REITs",
    "REIT - Retail": "Real Estate & REITs",
    "REIT - Healthcare Facilities": "Real Estate & REITs",
    "REIT - Hotel & Motel": "Real Estate & REITs",
    "REIT - Mortgage": "Real Estate & REITs",
    "REIT - Specialty": "Real Estate & REITs",
    "Real Estate Services": "Real Estate & REITs",
    "Real Estate - Development": "Real Estate & REITs",
    "Real Estate - Diversified": "Real Estate & REITs",
    "Residential Construction": "Real Estate & REITs",

    # ── Media & Entertainment (legacy) ──
    "Internet Retail": "E-Commerce",
    "Leisure": "Consumer Goods",

    # moved from Electric Vehicles (dealerships/RVs ≠ EV pure-play)
    "Auto & Truck Dealerships": "Consumer Goods",
    "Recreational Vehicles": "Consumer Goods",

    # moved from Transportation & Logistics (hospitality ≠ freight)
    "Travel Services": "Consumer Goods",
    "Lodging": "Consumer Goods",
    "Restaurants": "Consumer Goods",

    # ── Shell ──
    "Shell Companies": "Other",
}

INDUSTRY_TO_SUBTHEME = {
    # Artificial Intelligence
    "Internet Content & Information": "Cloud",
    "Advertising Agencies": "Ads & Search",

    # Cloud Computing
    "Software - Infrastructure": "Infrastructure",
    "Information Technology Services": "Data Centers",

    # Software
    "Software - Application": "Enterprise",
    "Electronic Gaming & Multimedia": "Gaming",

    # Semiconductors
    "Semiconductors": "Compute",
    "Semiconductor Equipment & Materials": "Foundries",
    # moved to Industrials
    "Electronic Components": "Electronic Components",
    "Scientific & Technical Instruments": "Instruments",
    "Electronics & Computer Distribution": "Distribution",
    "Electrical Equipment & Parts": "Electronic Components",

    # Hardware
    "Computer Hardware": "Computing",
    "Consumer Electronics": "Consumer",

    # Cybersecurity
    "Security & Protection Services": "Physical Security",

    # Telecom
    "Communication Equipment": "Wireless",
    "Telecom Services": "Wireless",

    # Electric Vehicles
    "Auto Manufacturers": "Manufacturers",
    "Auto Parts": "Suppliers",
    # moved to Consumer Goods
    "Auto & Truck Dealerships": "Auto Retail",
    "Recreational Vehicles": "Leisure",

    # Defense & Aerospace
    "Aerospace & Defense": "Aviation",

    # Healthcare & Biotech
    "Biotechnology": "Genomics",
    "Drug Manufacturers - General": "Therapeutics",
    "Drug Manufacturers - Specialty & Generic": "Therapeutics",
    "Medical Devices": "Devices",
    "Medical Instruments & Supplies": "Devices",
    "Health Information Services": "Diagnostics",
    "Healthcare Plans": "Healthcare Plans",
    "Diagnostics & Research": "Diagnostics",
    "Pharmaceutical Retailers": "Therapeutics",
    "Medical Care Facilities": "Oncology",
    "Medical Distribution": "Diagnostics",

    # Fintech
    "Banks - Diversified": "Neobanks",
    "Banks - Regional": "Neobanks",
    "Capital Markets": "Trading",
    "Financial Data & Stock Exchanges": "Exchanges",
    "Asset Management": "Trading",
    "Insurance - Life": "Insurance",
    "Insurance - Property & Casualty": "Insurance",
    "Insurance - Diversified": "Insurance",
    "Insurance - Reinsurance": "Insurance",
    "Insurance - Specialty": "Insurance",
    "Insurance Brokers": "Insurance",
    "Credit Services": "Payments",
    "Financial Conglomerates": "IT & Data",
    "Mortgage Finance": "Lending",

    # Energy Traditional
    "Oil & Gas E&P": "Oil Production",
    "Oil & Gas Integrated": "Majors",
    "Oil & Gas Midstream": "Gas & LNG",
    "Oil & Gas Refining & Marketing": "Oil Refining",
    "Oil & Gas Equipment & Services": "Oil Services",
    "Oil & Gas Drilling": "Oil Production",
    "Uranium": "Nuclear",
    "Thermal Coal": "Thermal",
    "Coking Coal": "Thermal",
    "Utilities - Regulated Electric": "Utilities",
    "Utilities - Regulated Gas": "Utilities",
    "Utilities - Diversified": "Utilities",
    "Utilities - Independent Power Producers": "Utilities",

    # Energy Renewable
    "Solar": "Solar",
    "Utilities - Renewable": "Utilities",

    # Commodities Metals
    "Gold": "Gold",
    "Silver": "Silver",
    "Copper": "Industrial",
    "Steel": "Industrial",
    "Aluminum": "Industrial",
    "Other Industrial Metals & Mining": "Industrial",
    "Other Precious Metals & Mining": "Precious",

    # Materials & Mining
    "Specialty Chemicals": "Chemicals",
    "Chemicals": "Chemicals",
    "Building Materials": "Materials",
    "Lumber & Wood Production": "Materials",
    "Paper & Paper Products": "Materials",
    "Packaging & Containers": "Packaging",
    "Metal Fabrication": "Metals",

    # Agriculture & Food
    "Farm Products": "Farming",
    "Agricultural Inputs": "Crop Inputs",
    "Packaged Foods": "Food",
    "Confectioners": "Food",
    "Food Distribution": "Food",
    "Grocery Stores": "Grocery",

    # Consumer Goods
    "Specialty Retail": "Retail",
    "Apparel Retail": "Apparel",
    "Home Improvement Retail": "Household",
    "Luxury Goods": "Luxury",
    "Apparel Manufacturing": "Apparel",
    "Footwear & Accessories": "Apparel",
    "Department Stores": "Retail",
    "Furnishings, Fixtures & Appliances": "Household",
    "Personal Services": "Services",
    "Textile Manufacturing": "Apparel",
    "Household & Personal Products": "Household",
    "Beverages - Non-Alcoholic": "Food",
    "Beverages - Brewers": "Food",
    "Beverages - Wineries & Distilleries": "Food",
    "Discount Stores": "Retail",
    "Tobacco": "Consumer",
    "Leisure": "Leisure",
    "Internet Retail": "E-Commerce",

    # Digital Entertainment
    "Entertainment": "Video",
    "Gambling": "Gambling",
    "Resorts & Casinos": "Gambling",
    "Publishing": "Media",
    "Broadcasting": "Media",

    # Transportation & Logistics
    "Railroads": "Rail",
    "Trucking": "Trucking",
    "Airlines": "Air Travel",
    "Airports & Air Services": "Air Travel",
    "Marine Shipping": "Maritime",
    "Integrated Freight & Logistics": "Logistics",
    # moved to Consumer Goods
    "Travel Services": "Travel",
    "Lodging": "Lodging",
    "Restaurants": "Food",

    # Industrial Automation
    "Specialty Industrial Machinery": "Robotics",
    "Farm & Heavy Construction Machinery": "Robotics",

    # Industrials
    "Industrial Distribution": "Distribution",
    "Building Products & Equipment": "Construction",
    "Engineering & Construction": "Construction",
    "Conglomerates": "Conglomerates",
    "Rental & Leasing Services": "Services",
    "Consulting Services": "Services",
    "Staffing & Employment Services": "Services",
    "Tools & Accessories": "Tools",
    "Business Equipment & Supplies": "Office",
    "Specialty Business Services": "Services",
    "Education & Training Services": "EdTech",

    # Environmental Sustainability
    "Waste Management": "Waste",
    "Pollution & Treatment Controls": "Air Quality",
    "Utilities - Regulated Water": "Water",

    # Real Estate & REITs
    "REIT - Diversified": "Diversified",
    "REIT - Industrial": "Industrial",
    "REIT - Office": "Office",
    "REIT - Residential": "Residential",
    "REIT - Retail": "Retail",
    "REIT - Healthcare Facilities": "Healthcare",
    "REIT - Hotel & Motel": "Hotel",
    "REIT - Mortgage": "Mortgage",
    "REIT - Specialty": "Specialty",
    "Real Estate Services": "Services",
    "Real Estate - Development": "Development",
    "Real Estate - Diversified": "Diversified",
    "Residential Construction": "Residential",
}


# ──────────────────────────────────────────────────────────────
# Ticker-level overrides — edit config/ticker_theme_override.json
# ──────────────────────────────────────────────────────────────
TICKER_THEME_OVERRIDE: dict[str, tuple[str, str]] = {
    k: tuple(v) for k, v in _load_config_json("ticker_theme_override.json").items()
}

# ──────────────────────────────────────────────────────────────
# Ticker extra sub-themes — edit config/ticker_extra_subthemes.json
# ──────────────────────────────────────────────────────────────
TICKER_EXTRA_SUBTHEMES: dict[str, list[tuple[str, str]]] = {
    k: [tuple(pair) for pair in pairs]
    for k, pairs in _load_config_json("ticker_extra_subthemes.json").items()
}

# ──────────────────────────────────────────────────────────────
# Finviz Themes Map — 40 parent themes from map.ashx?t=themes
# ──────────────────────────────────────────────────────────────

# Node ID prefix → parent theme name (from Finviz themes map JS bundle)
_THEME_MAP_PREFIXES = {
    "energyclean": "Energy Renewable",
    "energybase": "Energy Traditional",
    "commenergy": "Commodities Energy",
    "commmetals": "Commodities Metals",
    "commagri": "Commodities Agriculture",
    "cybersecurity": "Cybersecurity",
    "entertainment": "Digital Entertainment",
    "environmental": "Environmental Sustainability",
    "transportation": "Transportation & Logistics",
    "agriculture": "Agriculture & FoodTech",
    "realestate": "Real Estate & REITs",
    "blockchain": "Crypto & Blockchain",
    "automation": "Industrial Automation",
    "autonomous": "Autonomous Systems",
    "healthcare": "Healthcare & Biotech",
    "longevity": "Aging Population & Longevity",
    "nutrition": "Healthy Food & Nutrition",
    "biometrics": "Biometrics",
    "smarthome": "Smart Home",
    "wearables": "Wearables",
    "education": "Education Technology",
    "ecommerce": "E-commerce",
    "hardware": "Hardware",
    "software": "Software",
    "consumer": "Consumer Goods",
    "robotics": "Robotics",
    "nanotech": "Nanotechnology",
    "quantum": "Quantum Computing",
    "vareality": "Virtual & Augmented Reality",
    "bigdata": "Big Data",
    "defense": "Defense & Aerospace",
    "fintech": "FinTech",
    "telecom": "Telecommunications",
    "social": "Social Media",
    "cloud": "Cloud Computing",
    "space": "Space Tech",
    "semis": "Semiconductors",
    "evs": "Electric Vehicles",
    "iot": "Internet of Things",
    "ai": "Artificial Intelligence",
}

# URL param for each timeframe on Finviz themes map
_THEME_MAP_TIMEFRAMES = {
    "perf_1d": "",            # default (no param) = 1-day
    "perf_1w": "&st=w1",
    "perf_1m": "&st=w4",
    "perf_3m": "&st=w13",
    "perf_6m": "&st=w26",
}


def fetch_themes_map_performance() -> list[dict]:
    """Fetch all ~40 Finviz parent themes with 1D/1W/1M/3M/6M performance.

    Scrapes finviz.com/map.ashx?t=themes for each timeframe (5 HTTP requests).
    Returns list of dicts with name, perf_1d..perf_6m, rs_score, stage2_momentum.
    """
    import re

    base_url = "https://finviz.com/map.ashx?t=themes"
    # {theme_name: {perf_1d: float, ...}}
    theme_data: dict[str, dict[str, float]] = {}

    for perf_key, url_param in _THEME_MAP_TIMEFRAMES.items():
        url = base_url + url_param
        try:
            r = requests.get(url, headers=HEADERS, timeout=15)
            r.raise_for_status()
            # Extract nodes JSON from FinvizInitCanvas({..., initialPerf: {"nodes": {...}, ...}})
            m = re.search(r'"nodes":(\{[^}]+\})', r.text)
            if not m:
                logger.warning(f"  Themes map: no nodes found for {perf_key}")
                continue
            nodes = json.loads(m.group(1))

            # Aggregate sub-theme nodes into parent themes
            parent_sums: dict[str, list[float]] = {}
            for node_id, perf_val in nodes.items():
                parent_name = None
                # Match longest prefix first (sorted by length desc)
                for prefix, name in sorted(_THEME_MAP_PREFIXES.items(), key=lambda x: -len(x[0])):
                    if node_id.startswith(prefix):
                        parent_name = name
                        break
                if parent_name is None:
                    continue
                if parent_name not in parent_sums:
                    parent_sums[parent_name] = []
                parent_sums[parent_name].append(perf_val)

            for name, vals in parent_sums.items():
                if name not in theme_data:
                    theme_data[name] = {}
                theme_data[name][perf_key] = round(sum(vals) / len(vals), 3)

            logger.info(f"  Themes map {perf_key}: {len(parent_sums)} themes from {len(nodes)} nodes")
        except Exception as e:
            logger.warning(f"  Themes map fetch failed for {perf_key}: {e}")
        _sleep()

    # Build results with RS score + Stage 2 badge
    perf_keys = ["perf_1d", "perf_1w", "perf_1m", "perf_3m", "perf_6m"]
    results = []
    for name, perfs in theme_data.items():
        # RS Score: 5% 1D + 15% 1W + 25% 1M + 30% 3M + 25% 6M
        rs_score = round(
            perfs.get("perf_1d", 0) * 0.05 +
            perfs.get("perf_1w", 0) * 0.15 +
            perfs.get("perf_1m", 0) * 0.25 +
            perfs.get("perf_3m", 0) * 0.30 +
            perfs.get("perf_6m", 0) * 0.25, 2)
        stage2 = all(perfs.get(k, 0) > 0 for k in perf_keys)
        results.append({
            "name": name,
            "rs_score": rs_score,
            "stage2_momentum": stage2,
            **{k: perfs.get(k, 0) for k in perf_keys},
        })

    results.sort(key=lambda t: t["rs_score"], reverse=True)
    logger.info(f"  Themes map: {len(results)} parent themes with performance data")
    return results


# ──────────────────────────────────────────────────────────────
# Fetch Industry Performance + Industry Codes
# ──────────────────────────────────────────────────────────────

def fetch_industry_performance() -> list[dict]:
    """Fetch performance data for all ~144 Finviz industries (single HTTP request)."""
    url = "https://finviz.com/groups.ashx?g=industry&v=140"
    r = requests.get(url, headers=HEADERS, timeout=15)
    r.raise_for_status()
    soup = BeautifulSoup(r.text, "html.parser")

    for t in soup.find_all("table"):
        rows = t.find_all("tr")
        if len(rows) < 5:
            continue
        header = [td.get_text(strip=True) for td in rows[0].find_all(["td", "th"])]
        if "Name" not in header:
            continue
        # v=140 columns: No, Name, PerfW, PerfM, PerfQ, PerfHY, PerfY, PerfYTD, AvgVol, RelVol, Change, Volume
        industries = []
        for row in rows[1:]:
            cells = [td.get_text(strip=True) for td in row.find_all("td")]
            if len(cells) < 12:
                continue
            name = cells[1]
            parent = INDUSTRY_TO_THEME.get(name)
            if parent is None:
                logger.warning(f"  Unmapped industry: {name}")
                parent = "Other"
            industries.append({
                "name": name,
                "parent_theme": parent,
                "perf_1w": parse_pct(cells[2]),
                "perf_1m": parse_pct(cells[3]),
                "perf_3m": parse_pct(cells[4]),
                "perf_6m": parse_pct(cells[5]),
                "perf_1y": parse_pct(cells[6]),
                "perf_ytd": parse_pct(cells[7]),
                "perf_1d": parse_pct(cells[10]),  # "Change" column = today's %
            })
        logger.info(f"  Fetched {len(industries)} industries from Finviz groups")
        return industries
    return []


def discover_industry_codes() -> dict[str, str]:
    """Return {display_name: filter_code} for all Finviz industries from screener dropdown."""
    url = "https://finviz.com/screener.ashx?v=141"
    r = requests.get(url, headers=HEADERS, timeout=15)
    r.raise_for_status()
    soup = BeautifulSoup(r.text, "html.parser")
    sel = soup.find("select", {"data-filter": "ind"})
    codes = {}
    if sel:
        for opt in sel.find_all("option"):
            v = opt.get("value", "")
            if v:
                codes[opt.get_text(strip=True)] = v
    logger.info(f"  Discovered {len(codes)} industry filter codes")
    return codes


def aggregate_theme_performance(industries: list[dict]) -> list[dict]:
    """Group industries by parent theme, compute avg performance + RS score."""
    from collections import defaultdict
    theme_groups = defaultdict(list)
    for ind in industries:
        theme_groups[ind["parent_theme"]].append(ind)

    perf_keys = ["perf_1d", "perf_1w", "perf_1m", "perf_3m", "perf_6m"]
    results = []
    for theme_name, inds in theme_groups.items():
        if theme_name == "Other":
            continue
        avg_perfs = {}
        for k in perf_keys:
            vals = [i[k] for i in inds if i.get(k) is not None]
            avg_perfs[k] = round(sum(vals) / len(vals), 2) if vals else 0

        # Weighted RS Score: 5% 1D + 15% 1W + 25% 1M + 30% 3M + 25% 6M
        rs_score = round(
            avg_perfs.get("perf_1d", 0) * 0.05 +
            avg_perfs.get("perf_1w", 0) * 0.15 +
            avg_perfs.get("perf_1m", 0) * 0.25 +
            avg_perfs.get("perf_3m", 0) * 0.30 +
            avg_perfs.get("perf_6m", 0) * 0.25, 2)

        # Stage 2 Momentum: positive across ALL 5 timeframes
        stage2 = all(avg_perfs.get(k, 0) > 0 for k in perf_keys)

        results.append({
            "name": theme_name,
            "industries": [i["name"] for i in inds],
            "n_industries": len(inds),
            "rs_score": rs_score,
            "stage2_momentum": stage2,
            **avg_perfs,
        })

    results.sort(key=lambda t: t["rs_score"], reverse=True)
    return results


def _build_hardcoded_theme_entry(theme_name: str, tickers: list[str]) -> dict | None:
    """Build a theme_rankings-style entry for a hardcoded ticker list using yfinance."""
    try:
        import yfinance as yf
        hist = yf.download(tickers, period="7mo", interval="1d",
                           auto_adjust=True, progress=False, group_by="ticker")

        perf_keys = ["perf_1d", "perf_1w", "perf_1m", "perf_3m", "perf_6m"]
        trading_days = {"perf_1d": 2, "perf_1w": 5, "perf_1m": 21, "perf_3m": 63, "perf_6m": 126}

        all_perfs: dict[str, list[float]] = {k: [] for k in perf_keys}
        for ticker in tickers:
            try:
                col = hist[ticker]["Close"].dropna() if len(tickers) > 1 else hist["Close"].dropna()
                if len(col) < 3:
                    continue
                for k, days in trading_days.items():
                    if len(col) >= days:
                        pct = (col.iloc[-1] / col.iloc[-days] - 1) * 100
                        all_perfs[k].append(float(pct))
            except Exception:
                continue

        avg_perfs = {}
        for k in perf_keys:
            vals = all_perfs[k]
            avg_perfs[k] = round(sum(vals) / len(vals), 2) if vals else 0.0

        rs_score = round(
            avg_perfs.get("perf_1d", 0) * 0.05 +
            avg_perfs.get("perf_1w", 0) * 0.15 +
            avg_perfs.get("perf_1m", 0) * 0.25 +
            avg_perfs.get("perf_3m", 0) * 0.30 +
            avg_perfs.get("perf_6m", 0) * 0.25, 2)

        stage2 = all(avg_perfs.get(k, 0) > 0 for k in perf_keys)

        logger.info(f"  Hardcoded '{theme_name}': RS={rs_score:+.2f}  "
                    f"1D={avg_perfs['perf_1d']:+.1f}%  1W={avg_perfs['perf_1w']:+.1f}%  "
                    f"1M={avg_perfs['perf_1m']:+.1f}%  3M={avg_perfs['perf_3m']:+.1f}%  "
                    f"6M={avg_perfs['perf_6m']:+.1f}%")
        return {
            "name": theme_name,
            "industries": [theme_name],
            "n_industries": 1,
            "rs_score": rs_score,
            "stage2_momentum": stage2,
            "_hardcoded": True,
            "_tickers": tickers,
            **avg_perfs,
        }
    except Exception as e:
        logger.warning(f"  Hardcoded theme '{theme_name}' failed: {e}")
        return None


# ──────────────────────────────────────────────────────────────
# Screener table parser
# ──────────────────────────────────────────────────────────────

def _parse_screener_table(soup) -> list[dict]:
    for t in soup.find_all("table"):
        rows = t.find_all("tr")
        if len(rows) < 2:
            continue
        header = [td.get_text(strip=True) for td in rows[0].find_all(["td", "th"])]
        if "No." not in header or "Ticker" not in header:
            continue
        stocks = []
        for row in rows[1:]:
            cells = [td.get_text(strip=True) for td in row.find_all("td")]
            if len(cells) < 18:
                continue
            # Finviz v=141 columns (18 total):
            # 0:No 1:Ticker 2:PerfW 3:PerfM 4:PerfQ 5:PerfHY 6:PerfYTD
            # 7:PerfY 8:Perf3Y 9:Perf5Y 10:Perf10Y 11:VolW 12:VolM
            # 13:AvgVol 14:RelVol 15:Price 16:Change 17:Volume
            stocks.append({
                "ticker": cells[1],
                "perf_1w": parse_pct(cells[2]),
                "perf_1m": parse_pct(cells[3]),
                "perf_3m": parse_pct(cells[4]),
                "perf_6m": parse_pct(cells[5]),
                "perf_ytd": parse_pct(cells[6]),
                "avg_volume": parse_vol(cells[13]),
                "price": float(cells[15].replace(",", "").replace("-", "0") or "0"),
                "change_pct": parse_pct(cells[16]) or 0,
                "volume": parse_vol(cells[17]),
            })
        return stocks
    return []


def fetch_screener_stocks(filter_key: str, filter_val: str, max_pages: int = 10) -> list[dict]:
    all_stocks: list[dict] = []
    for page in range(1, max_pages + 1):
        offset = (page - 1) * 20 + 1
        url = f"https://finviz.com/screener.ashx?v=141&f={filter_key}_{filter_val}&r={offset}"
        try:
            r = requests.get(url, headers=HEADERS, timeout=15)
            r.raise_for_status()
        except requests.RequestException as e:
            logger.warning(f"    Screener fail: {e}")
            break
        page_stocks = _parse_screener_table(BeautifulSoup(r.text, "html.parser"))
        all_stocks.extend(page_stocks)
        if len(page_stocks) < 20:
            break
        _sleep()
    return all_stocks


# ──────────────────────────────────────────────────────────────
# Individual stock detail + sparkline
# ──────────────────────────────────────────────────────────────

PERF_MAP = {
    "Perf Day": "perf_1d", "Perf Week": "perf_1w", "Perf Month": "perf_1m",
    "Perf Quarter": "perf_3m", "Perf Half Y": "perf_6m", "Perf YTD": "perf_ytd",
}


def fetch_stock_detail(ticker: str) -> dict | None:
    url = f"https://finviz.com/quote.ashx?t={ticker}&ty=c&p=d&b=1"
    try:
        resp = requests.get(url, headers=HEADERS, timeout=15)
        resp.raise_for_status()
    except requests.RequestException:
        return None

    soup = BeautifulSoup(resp.text, "html.parser")
    table = soup.find("table", class_="snapshot-table2")
    if not table:
        return None

    snap = {}
    for row in table.find_all("tr"):
        cells = row.find_all("td")
        for i in range(0, len(cells) - 1, 2):
            snap[cells[i].get_text(strip=True)] = cells[i + 1].get_text(strip=True)

    # Sector and Industry are in tab-link anchors with hrefs like f=sec_* and f=ind_*
    sector = ""
    industry = ""
    for a in soup.find_all("a", class_="tab-link"):
        href = a.get("href", "")
        if "f=sec_" in href:
            sector = a.get_text(strip=True)
        elif "f=ind_" in href:
            industry = a.get_text(strip=True)

    try:
        price = float(snap.get("Price", "0").replace(",", ""))
        if price <= 0:
            return None
        volume = parse_vol(snap.get("Volume", "0"))
        atr_s = (snap.get("ATR (14)") or snap.get("ATR") or "0").strip()
        try:
            atr = float(atr_s.replace(",", "") or "0")
        except ValueError:
            atr = 0.0
        adr_pct = round((atr / price) * 100, 2) if price > 0 and atr > 0 else 0.0

        company = ""
        for sel in ["a.tab-link", "h1"]:
            tag = soup.select_one(sel)
            if tag and tag.get_text(strip=True):
                company = tag.get_text(strip=True)
                break

        import re as _re
        def _parse_52w(s):
            # Finviz format: "71.54-1.12%" or "31.03127.97%" — extract leading number only
            m = _re.match(r"^([\d,]+\.\d{2})", (s or "").strip())
            try:
                return float(m.group(1).replace(",", "")) if m else 0.0
            except ValueError:
                return 0.0
        h52 = _parse_52w(snap.get("52W High"))
        l52 = _parse_52w(snap.get("52W Low"))
        avg_vol = parse_vol(snap.get("Avg Volume") or "0")
        dist_52w_high = round((price / h52 - 1) * 100, 2) if h52 > 0 else None
        rvol = round(volume / avg_vol, 2) if avg_vol > 0 else None

        result = {
            "ticker": ticker, "company": company, "price": round(price, 2),
            "change_pct": parse_pct(snap.get("Change", "0%")) or 0,
            "volume": volume, "dollar_volume": round(price * volume),
            "avg_dollar_volume": round(price * avg_vol) if avg_vol > 0 else 0,
            "adr_pct": adr_pct,
            "52w_high": round(h52, 2) if h52 > 0 else None,
            "52w_low": round(l52, 2) if l52 > 0 else None,
            "avg_volume": avg_vol,
            "dist_52w_high": dist_52w_high,
            "rvol": rvol,
            "sector": sector,
            "industry": industry,
        }
        for fk, jk in PERF_MAP.items():
            result[jk] = parse_pct(snap.get(fk, ""))
        for fk, jk in [("SMA20", "sma20_pct"), ("SMA50", "sma50_pct"), ("SMA200", "sma200_pct")]:
            result[jk] = parse_pct(snap.get(fk, "") or "")

        # Finviz snapshot-table2 has no "Perf Day" field; always fall back to Change%
        if result.get("perf_1d") is None:
            result["perf_1d"] = result["change_pct"]
        return result
    except (ValueError, TypeError):
        return None


def fetch_sparkline(ticker: str) -> dict:
    try:
        import yfinance as yf
        hist = yf.Ticker(ticker).history(period="6mo", interval="1d")
        if hist.empty or len(hist) < 2:
            return {"sparkline": [], "bars_30d": []}
        import math
        closes = [round(float(c), 2) for c in hist["Close"].tolist() if not math.isnan(c)]
        bars_30d = [
            {"h": round(float(r["High"]), 2), "l": round(float(r["Low"]), 2),
             "c": round(float(r["Close"]), 2), "v": int(r["Volume"])}
            for _, r in hist.tail(30).iterrows()
            if not (math.isnan(r["High"]) or math.isnan(r["Low"]) or math.isnan(r["Close"]))
        ]
        return {"sparkline": closes, "bars_30d": bars_30d}
    except Exception:
        return {"sparkline": [], "bars_30d": []}


# ──────────────────────────────────────────────────────────────
# Market Condition (SPY + QQQ indicators)
# ──────────────────────────────────────────────────────────────

def _ema(closes: list, period: int):
    if len(closes) < period:
        return None
    k = 2.0 / (period + 1)
    val = sum(closes[:period]) / period
    for p in closes[period:]:
        val = p * k + val * (1 - k)
    return val


def _rsi(closes: list, period: int = 14) -> float | None:
    if len(closes) < period + 1:
        return None
    deltas = [closes[i] - closes[i - 1] for i in range(1, len(closes))]
    gains  = [d if d > 0 else 0.0 for d in deltas[-period:]]
    losses = [-d if d < 0 else 0.0 for d in deltas[-period:]]
    avg_gain = sum(gains) / period
    avg_loss = sum(losses) / period
    if avg_loss == 0:
        return 100.0
    return round(100 - 100 / (1 + avg_gain / avg_loss), 2)


def _elite_status(price, sma10, sma20, sma50, sma200, rsi, breadth) -> str:
    """Classify index into Strong / Mediocre / Lagging / Weak per Elite Rubric."""
    # Strong: price > SMA10 > SMA20 > SMA50, breadth > 70%, RSI 60–80
    strong_smas = sma10 and sma20 and sma50 and price > sma10 > sma20 > sma50
    if strong_smas and (breadth is None or breadth > 70) and (rsi is None or 60 <= rsi <= 80):
        return "Strong"

    # Weak: price below SMA10, SMA20, SMA50 AND SMA200
    if (sma10 and price < sma10) and (sma20 and price < sma20) and \
       (sma50 and price < sma50) and (sma200 and price < sma200):
        return "Weak"

    # Lagging: price below SMA10, SMA20, SMA50 but still above SMA200, breadth < 40%
    if (sma10 and price < sma10) and (sma20 and price < sma20) and \
       (sma50 and price < sma50) and (sma200 and price > sma200) and \
       (breadth is None or breadth < 40):
        return "Lagging"

    # Mediocre: SMA10 has crossed below SMA20, but price still above SMA50 and SMA200
    if sma10 and sma20 and sma50 and sma200 and \
       sma10 < sma20 and price > sma50 and price > sma200:
        return "Mediocre"

    return "Neutral"


# Index / futures symbols → (TV symbol, scanner endpoint)
_TV_SCAN_URL         = "https://scanner.tradingview.com/america/scan"
_TV_FUTURES_SCAN_URL = "https://scanner.tradingview.com/futures/scan"
_TV_INDEX_SYMBOL = {
    "SPY": ("CME_MINI:ES1!",  _TV_FUTURES_SCAN_URL),
    "QQQ": ("CME_MINI:NQ1!",  _TV_FUTURES_SCAN_URL),
    "IWM": ("CME_MINI:RTY1!", _TV_FUTURES_SCAN_URL),
}
# Macro futures symbols for BTC / Gold / Oil via TradingView
_TV_MACRO_SYMBOL = {
    "btc": ("CME:BTC1!",   _TV_FUTURES_SCAN_URL),
    "gld": ("COMEX:GC1!",  _TV_FUTURES_SCAN_URL),
    "oil": ("NYMEX:CL1!",  _TV_FUTURES_SCAN_URL),
    "dxy": ("TVC:DXY",     _TV_SCAN_URL),
}


def _fetch_tradingview_index_snapshot(tv_symbol: str, scan_url: str = _TV_SCAN_URL) -> dict[str, float] | None:
    """Single-row snapshot: close, change%, RSI, SMAs, EMAs from TradingView."""
    try:
        resp = requests.post(
            scan_url,
            json={
                "symbols": {"tickers": [tv_symbol]},
                "columns": [
                    "close",
                    "change",
                    "RSI",
                    "SMA10",
                    "SMA20",
                    "SMA50",
                    "SMA200",
                    "EMA10",
                    "EMA20",
                ],
            },
            headers={"Content-Type": "application/json"},
            timeout=12,
        )
        resp.raise_for_status()
        rows = resp.json().get("data") or []
        if not rows or not rows[0].get("d"):
            return None
        d = rows[0]["d"]
        if len(d) < 9:
            return None
        keys = (
            "price",
            "change_pct",
            "rsi14",
            "sma10",
            "sma20",
            "sma50",
            "sma200",
            "ema10",
            "ema20",
        )
        out: dict[str, float] = {}
        for k, v in zip(keys, d):
            if v is None:
                return None
            out[k] = float(v)
        return out
    except Exception as e:
        logger.warning(f"  TradingView index scan failed [{tv_symbol}]: {e}")
        return None


def _fetch_market_indicators_yfinance(ticker: str, breadth: float | None = None) -> dict:
    """Legacy path: 1y daily history from yfinance (SMA200 slope + EMA cross persistence)."""
    try:
        import yfinance as yf

        hist = yf.Ticker(ticker).history(period="1y", interval="1d")
        if hist.empty or len(hist) < 50:
            return {}
        closes = [float(c) for c in hist["Close"].tolist()]
        price = closes[-1]
        sma10 = sum(closes[-10:]) / 10 if len(closes) >= 10 else None
        sma20 = sum(closes[-20:]) / 20 if len(closes) >= 20 else None
        sma50 = sum(closes[-50:]) / 50 if len(closes) >= 50 else None
        sma200 = sum(closes[-200:]) / 200 if len(closes) >= 200 else None
        sma200_20d = sum(closes[-220:-20]) / 200 if len(closes) >= 220 else None
        ema10 = _ema(closes, 10)
        ema20 = _ema(closes, 20)
        ema10_prev = _ema(closes[:-1], 10)
        ema20_prev = _ema(closes[:-1], 20)
        rsi14 = _rsi(closes, 14)
        change_pct = round((closes[-1] / closes[-2] - 1) * 100, 2) if len(closes) >= 2 else None
        sma50_pct = round((price / sma50 - 1) * 100, 2) if sma50 else None
        sma200_pct = round((price / sma200 - 1) * 100, 2) if sma200 else None
        slope_up = bool(sma200 > sma200_20d) if sma200 and sma200_20d else None

        index_status = _elite_status(price, sma10, sma20, sma50, sma200, rsi14, breadth)

        return {
            "price": round(price, 2),
            "change_pct": change_pct,
            "index_status": index_status,
            "breadth": breadth,
            "rsi14": rsi14,
            "sma50_pct": sma50_pct,
            "sma200_pct": sma200_pct,
            "sma200_slope_up": slope_up,
            "ema10_above_ema20": bool(ema10 > ema20) if ema10 and ema20 else None,
            "ema10_ema20_both_down": bool(ema10 < ema10_prev and ema20 < ema20_prev)
            if all([ema10, ema10_prev, ema20, ema20_prev])
            else None,
        }
    except Exception as e:
        logger.warning(f"  Market indicators (yfinance) for {ticker} failed: {e}")
        return {}


def fetch_market_indicators(ticker: str, breadth: float | None = None) -> dict:
    """Index ETF metrics + Elite Regime. Primary: TradingView scanner; fallback: yfinance."""
    sym = (ticker or "").upper()
    tv_entry = _TV_INDEX_SYMBOL.get(sym)
    if tv_entry:
        tv_sym, scan_url = tv_entry
        raw = _fetch_tradingview_index_snapshot(tv_sym, scan_url)
        if raw:
            price = raw["price"]
            sma10, sma20, sma50, sma200 = raw["sma10"], raw["sma20"], raw["sma50"], raw["sma200"]
            rsi14 = raw["rsi14"]
            ema10, ema20 = raw["ema10"], raw["ema20"]
            sma50_pct = round((price / sma50 - 1) * 100, 2) if sma50 else None
            sma200_pct = round((price / sma200 - 1) * 100, 2) if sma200 else None
            index_status = _elite_status(price, sma10, sma20, sma50, sma200, rsi14, breadth)

            display_price = round(price, 2)
            display_change = round(raw["change_pct"], 2)
            logger.info(f"  {sym} market indicators (TradingView): price={display_price} chg={display_change:.2f}%")
            return {
                "price": display_price,
                "change_pct": display_change,
                "index_status": index_status,
                "breadth": breadth,
                "rsi14": round(rsi14, 2),
                "sma50_pct": sma50_pct,
                "sma200_pct": sma200_pct,
                "sma200_slope_up": None,
                "ema10_above_ema20": bool(ema10 > ema20) if ema10 and ema20 else None,
                "ema10_ema20_both_down": None,
            }
    return _fetch_market_indicators_yfinance(ticker, breadth)


def fetch_macro_assets() -> dict:
    """Fetch BTC / Gold / Oil futures via TradingView + Credit Spreads from FRED."""
    result: dict = {}
    for key, (tv_sym, scan_url) in _TV_MACRO_SYMBOL.items():
        try:
            raw = _fetch_tradingview_index_snapshot(tv_sym, scan_url)
            if raw:
                result[key] = {
                    "price": round(raw["price"], 2),
                    "change_pct": round(raw["change_pct"], 2),
                }
                logger.info(f"  {key.upper()} ({tv_sym}): {raw['price']:.2f} {raw['change_pct']:+.2f}%")
            else:
                logger.warning(f"  Macro asset {tv_sym}: no data from TradingView")
        except Exception as e:
            logger.warning(f"  Macro asset {tv_sym} failed: {e}")

    # Credit Spreads: ICE BofA HY Index OAS from FRED (BAMLH0A0HYM2)
    try:
        resp = requests.get(
            "https://fred.stlouisfed.org/graph/fredgraph.csv?id=BAMLH0A0HYM2",
            timeout=15,
        )
        resp.raise_for_status()
        lines = [
            l.strip() for l in resp.text.strip().split("\n")
            if l.strip() and not l.startswith("DATE")
        ]
        valid_lines = [l for l in lines if "." in l.split(",")[-1]]
        if len(valid_lines) >= 2:
            latest_val = float(valid_lines[-1].split(",")[1])
            prev_val = float(valid_lines[-2].split(",")[1])
            result["credit_spread"] = {
                "value": round(latest_val, 2),
                "change": round(latest_val - prev_val, 3),
            }
            logger.info(f"  Credit Spread (BAMLH0A0HYM2): {latest_val}% ({result['credit_spread']['change']:+.3f})")
    except Exception as e:
        logger.warning(f"  Credit spreads (FRED) failed: {e}")

    return result


def _market_signal(spy: dict, qqq: dict) -> str:
    def is_red(d):
        broke_200 = (d.get("sma200_pct") or 0) < 0
        ema_cross_down = (d.get("ema10_above_ema20") is False
                          and d.get("ema10_ema20_both_down") is True)
        return broke_200 or ema_cross_down

    if is_red(spy) or is_red(qqq):
        return "red"

    spy_above_50 = (spy.get("sma50_pct") or 0) > 0
    qqq_above_50 = (qqq.get("sma50_pct") or 0) > 0
    spy_200_up   = spy.get("sma200_slope_up") is not False
    qqq_200_up   = qqq.get("sma200_slope_up") is not False

    if spy_above_50 and qqq_above_50 and spy_200_up and qqq_200_up:
        return "green"
    return "yellow"


# ──────────────────────────────────────────────────────────────
# RS Universe (S&P 500)
# ──────────────────────────────────────────────────────────────

def _build_sp500_rs_universe() -> tuple[dict[str, float], float | None, float | None, dict, dict | None, dict | None, dict | None, dict | None]:
    """Download S&P 500 1-year data. Returns (rs_dict, breadth_50d_pct, breadth_200d_pct, price_data)."""
    try:
        import pandas as pd
        import yfinance as yf
        from io import StringIO
        try:
            resp = requests.get(
                "https://en.wikipedia.org/wiki/List_of_S%26P_500_companies",
                headers=HEADERS, timeout=15
            )
            resp.raise_for_status()
            tables = pd.read_html(StringIO(resp.text))
            tickers = tables[0]["Symbol"].str.replace(".", "-", regex=False).tolist()
        except Exception:
            # Fallback: use GitHub-hosted CSV
            csv_resp = requests.get(
                "https://raw.githubusercontent.com/datasets/s-and-p-500-companies/main/data/constituents.csv",
                timeout=15
            )
            lines = csv_resp.text.strip().split("\n")[1:]
            tickers = [line.split(",")[0].strip().replace(".", "-") for line in lines if line]
        logger.info(f"  Downloading {len(tickers)} S&P 500 stocks (15mo for 52W NH/NL + 200D breadth)...")
        data = yf.download(tickers, period="15mo", interval="1d", auto_adjust=True, progress=False)
        closes = data["Close"]
        valid = closes.dropna(thresh=int(len(closes) * 0.5), axis=1)

        # 6M RS performance: use last ~126 trading days to preserve RS calculation
        six_months_ago = pd.Timestamp.now(tz="UTC") - pd.DateOffset(months=6)
        idx = valid.index.tz_localize("UTC") if valid.index.tz is None else valid.index
        six_m = valid[idx >= six_months_ago]
        if len(six_m) >= 2:
            perf = ((six_m.iloc[-1] - six_m.iloc[0]) / six_m.iloc[0] * 100).dropna()
        else:
            perf = ((valid.iloc[-1] - valid.iloc[0]) / valid.iloc[0] * 100).dropna()

        # Compute S&P 500 breadth: % above SMA50/200 (used for SPY/QQQ breadth indicators)
        above_50 = above_200 = total_50 = total_200 = 0
        for col in valid.columns:
            col_data = valid[col].dropna()
            last = float(col_data.iloc[-1])
            if len(col_data) >= 50:
                total_50 += 1
                if last > float(col_data.iloc[-50:].mean()):
                    above_50 += 1
            if len(col_data) >= 200:
                total_200 += 1
                if last > float(col_data.iloc[-200:].mean()):
                    above_200 += 1
        breadth_50 = round(above_50 / total_50 * 100, 1) if total_50 > 0 else None
        breadth_200 = round(above_200 / total_200 * 100, 1) if total_200 > 0 else None
        logger.info(f"  S&P 500 breadth: {breadth_50}% above SMA50, {breadth_200}% above SMA200")
        # Also extract latest price + 1D change for prices.json
        price_data = {}
        for col in valid.columns:
            col_data = valid[col].dropna()
            if len(col_data) >= 2:
                price = float(col_data.iloc[-1])
                prev  = float(col_data.iloc[-2])
                price_data[str(col)] = {
                    "price": round(price, 2),
                    "change_pct": round((price - prev) / prev * 100, 2) if prev else None,
                }
        return perf.to_dict(), breadth_50, breadth_200, price_data
    except Exception as e:
        logger.warning(f"  S&P 500 RS universe failed: {e}")
        return {}, None, None, {}


def _fetch_finviz_market_breadth() -> tuple[dict | None, dict | None, dict | None, dict | None]:
    """Fetch full-market Adv/Dec, NH/NL, SMA50, SMA200 counts from Finviz screener.

    Uses NYSE+NASD+AMEX universe (~11000 stocks) via Finviz filter codes.
    Returns (adv_dec, new_hl, sma50_counts, sma200_counts).
    """
    import re as _re
    import time as _time

    def _get_count(filt: str) -> int | None:
        try:
            url = f"https://finviz.com/screener.ashx?v=111&f={filt}" if filt else "https://finviz.com/screener.ashx?v=111"
            r = requests.get(url, headers=HEADERS, timeout=15)
            m = _re.search(r"(\d[\d,]+)\s+Total", r.text)
            return int(m.group(1).replace(",", "")) if m else None
        except Exception as e:
            logger.warning(f"  Finviz breadth count failed ({filt}): {e}")
            return None

    try:
        total    = _get_count("") or 0;                  _time.sleep(1.0)
        adv      = _get_count("ta_change_u");             _time.sleep(1.0)
        dec      = _get_count("ta_change_d");             _time.sleep(1.0)
        nh       = _get_count("ta_highlow52w_nh");        _time.sleep(1.0)
        nl       = _get_count("ta_highlow52w_nl");        _time.sleep(1.0)
        above50  = _get_count("ta_sma50_pa");             _time.sleep(1.0)
        above200 = _get_count("ta_sma200_pa")

        if not total:
            return None, None, None, None

        adv_dec = {
            "advancing": adv, "declining": dec, "total": total,
            "adv_pct": round(adv / total * 100, 1) if adv is not None else None,
            "dec_pct": round(dec / total * 100, 1) if dec is not None else None,
        } if adv is not None and dec is not None else None

        nh_nl_total = (nh or 0) + (nl or 0)
        new_hl = {
            "new_high": nh, "new_low": nl, "total": nh_nl_total,
            "nh_pct": round(nh / nh_nl_total * 100, 1) if nh_nl_total > 0 and nh is not None else None,
            "nl_pct": round(nl / nh_nl_total * 100, 1) if nh_nl_total > 0 and nl is not None else None,
        } if nh is not None and nl is not None else None

        sma50_counts = {
            "above": above50, "below": total - above50 if above50 is not None else None, "total": total,
            "above_pct": round(above50 / total * 100, 1) if above50 is not None else None,
            "below_pct": round((total - above50) / total * 100, 1) if above50 is not None else None,
        } if above50 is not None else None

        sma200_counts = {
            "above": above200, "below": total - above200 if above200 is not None else None, "total": total,
            "above_pct": round(above200 / total * 100, 1) if above200 is not None else None,
            "below_pct": round((total - above200) / total * 100, 1) if above200 is not None else None,
        } if above200 is not None else None

        logger.info(f"  Finviz market breadth: Adv/Dec={adv}/{dec} | NH/NL={nh}/{nl} | SMA50 above={above50} | SMA200 above={above200} | total={total}")
        return adv_dec, new_hl, sma50_counts, sma200_counts
    except Exception as e:
        logger.warning(f"  Finviz market breadth failed: {e}")
        return None, None, None, None


def _fetch_nasdaq100_breadth() -> float | None:
    """Compute % of Nasdaq 100 stocks above their 50-day SMA."""
    try:
        import pandas as pd
        import yfinance as yf
        from io import StringIO
        resp = requests.get(
            "https://en.wikipedia.org/wiki/Nasdaq-100",
            headers=HEADERS, timeout=15
        )
        resp.raise_for_status()
        tables = pd.read_html(StringIO(resp.text))
        # Find the table with a 'Ticker' or 'Symbol' column
        tickers = None
        for t in tables:
            cols = [str(c).lower() for c in t.columns]
            if "ticker" in cols:
                tickers = t[t.columns[[i for i, c in enumerate(cols) if c == "ticker"][0]]].tolist()
                break
            if "symbol" in cols:
                tickers = t[t.columns[[i for i, c in enumerate(cols) if c == "symbol"][0]]].tolist()
                break
        if not tickers:
            return None
        tickers = [str(t).replace(".", "-") for t in tickers if str(t) not in ("nan", "")]
        logger.info(f"  Downloading {len(tickers)} Nasdaq-100 stocks for breadth...")
        data = yf.download(tickers, period="3mo", interval="1d", auto_adjust=True, progress=False)
        closes = data["Close"]
        valid = closes.dropna(thresh=int(len(closes) * 0.5), axis=1)
        above_50 = 0
        total = 0
        for col in valid.columns:
            col_data = valid[col].dropna()
            if len(col_data) >= 50:
                total += 1
                if float(col_data.iloc[-1]) > float(col_data.iloc[-50:].mean()):
                    above_50 += 1
        breadth = round(above_50 / total * 100, 1) if total > 0 else None
        logger.info(f"  Nasdaq-100 breadth (% above SMA50): {breadth}%")
        return breadth
    except Exception as e:
        logger.warning(f"  Nasdaq-100 breadth failed: {e}")
        return None


# ──────────────────────────────────────────────────────────────
# Scoring
# ──────────────────────────────────────────────────────────────

def _avg(stocks, key):
    vals = [s.get(key) for s in stocks if s.get(key) is not None]
    return sum(vals) / len(vals) if vals else 0


def _composite(stocks):
    return (_avg(stocks, "perf_1w") * 0.20 + _avg(stocks, "perf_1m") * 0.30
            + _avg(stocks, "perf_3m") * 0.30 + _avg(stocks, "perf_6m") * 0.20)


def _stock_score(s):
    v = 0
    for k, w in [("perf_1w", 0.2), ("perf_1m", 0.3), ("perf_3m", 0.3), ("perf_6m", 0.2)]:
        if s.get(k) is not None:
            v += s[k] * w
    return v


def _composite_ind(ind: dict) -> float:
    """Composite score for a single industry dict (from groups page)."""
    return ((ind.get("perf_1w") or 0) * 0.20 + (ind.get("perf_1m") or 0) * 0.30
            + (ind.get("perf_3m") or 0) * 0.30 + (ind.get("perf_6m") or 0) * 0.20)


# ──────────────────────────────────────────────────────────────
# Build pipeline
# ──────────────────────────────────────────────────────────────

def build_data() -> dict:
    logger.info("=" * 60)
    logger.info("Thematic Scanner v5 — Industry → Parent Theme → Stocks")
    if not is_trading_day():
        logger.info(f"⚠ Non-trading day — using last session ({last_trading_date().isoformat()})")
    logger.info("=" * 60)

    # ── Step 0: Fetch Finviz themes map (40 parent themes, 5 timeframes) ──
    logger.info("Step 0: Fetching Finviz themes map performance...")
    finviz_theme_rankings = fetch_themes_map_performance()
    for t in finviz_theme_rankings[:10]:
        badge = " ★ Stage2" if t["stage2_momentum"] else ""
        logger.info(f"  {t['name']:35} RS={t['rs_score']:+7.2f}  1D={t['perf_1d']:+.2f}%  1W={t['perf_1w']:+.2f}%  1M={t['perf_1m']:+.2f}%  3M={t['perf_3m']:+.2f}%  6M={t['perf_6m']:+.2f}%{badge}")

    # ── Step 1: Fetch all industry performance (single request) ──
    logger.info("Step 1: Fetching industry performance from Finviz groups...")
    industries = fetch_industry_performance()
    if not industries:
        logger.error("  Failed to fetch industry performance!")
        industries = []
    _sleep()

    # ── Step 1b: Discover industry filter codes for stock fetching ──
    logger.info("Step 1b: Discovering industry filter codes...")
    ind_codes = discover_industry_codes()
    _sleep()

    # ── Step 2: Aggregate into parent themes ──
    logger.info("Step 2: Aggregating into parent themes...")
    theme_rankings = aggregate_theme_performance(industries)
    for t in theme_rankings:
        badge = " ★ Stage2" if t["stage2_momentum"] else ""
        logger.info(f"  {t['name']:30} RS={t['rs_score']:+7.2f}  1D={t['perf_1d']:+.1f}%  1W={t['perf_1w']:+.1f}%  1M={t['perf_1m']:+.1f}%  3M={t['perf_3m']:+.1f}%  6M={t['perf_6m']:+.1f}%{badge}")

    # ── Step 2b: Inject hardcoded themes (e.g., Quantum Computing not in Finviz) ──
    logger.info("Step 2b: Injecting hardcoded themes...")
    for hname, htickers in HARDCODED_THEMES.items():
        entry = _build_hardcoded_theme_entry(hname, htickers)
        if entry:
            theme_rankings.append(entry)
    theme_rankings.sort(key=lambda t: t["rs_score"], reverse=True)

    # ── Step 3: For top themes, drill into industries → stocks ──
    top_themes = theme_rankings[:TOP_THEMES]
    logger.info(f"\nStep 3: Drilling into top {len(top_themes)} themes for stock details...")
    all_detail_cache: dict[str, dict | None] = {}
    output_themes = []

    for theme in top_themes:
        theme_name = theme["name"]
        logger.info(f"\n{'─'*50}")
        logger.info(f"Theme: {theme_name} ({theme['n_industries']} industries)")

        # Hardcoded themes: fetch stock details directly from ticker list
        if theme.get("_hardcoded"):
            picks = [{"ticker": t} for t in theme["_tickers"]]
            sub_stocks = _fetch_details(picks, all_detail_cache)
            if sub_stocks:
                output_themes.append({
                    "name": theme_name,
                    "subthemes": [{"name": theme_name, "stocks": sub_stocks}],
                })
            continue

        # Sort industries within this theme by their composite perf
        theme_industries = [i for i in industries if i["parent_theme"] == theme_name]
        theme_industries.sort(key=lambda i: _composite_ind(i), reverse=True)
        top_industries = theme_industries[:TOP_SUBTHEMES_PER_THEME]

        theme_subthemes = []
        for ind in top_industries:
            ind_name = ind["name"]
            ind_code = ind_codes.get(ind_name)
            if not ind_code:
                logger.warning(f"  No filter code for industry: {ind_name}")
                continue

            logger.info(f"  Industry: {ind_name} (code={ind_code})")
            stocks = fetch_screener_stocks("ind", ind_code)
            if not stocks:
                continue
            stocks.sort(key=_stock_score, reverse=True)
            picks = stocks[:TOP_STOCKS_PER_SUBTHEME]
            sub_stocks = _fetch_details(picks, all_detail_cache)
            if sub_stocks:
                theme_subthemes.append({"name": ind_name, "stocks": sub_stocks})

        if theme_subthemes:
            output_themes.append({"name": theme_name, "subthemes": theme_subthemes})

    # ── Step 3b: Fetch stocks for remaining heatmap themes (top5 + bottom5 by 1D) ──
    # Map finviz map theme names that don't exist in theme_rankings to industry names
    _HEATMAP_FALLBACK_INDUSTRIES: dict[str, list[str]] = {
        "Education Technology":        ["Education & Training Services"],
        "Social Media":                ["Internet Content & Information"],
        "Biometrics":                  ["Security & Protection Services"],
        "Nanotechnology":              ["Specialty Chemicals"],
        "Crypto & Blockchain":         ["Financial Data & Stock Exchanges", "Capital Markets"],
        "Virtual & Augmented Reality": ["Electronic Gaming & Multimedia", "Computer Hardware"],
        "Wearables":                   ["Consumer Electronics"],
        "Smart Home":                  ["Consumer Electronics", "Specialty Industrial Machinery"],
        "Aging Population & Longevity":["Biotechnology", "Medical Devices"],
        "Healthy Food & Nutrition":    ["Packaged Foods", "Farm Products"],
        "Agriculture & FoodTech":      ["Agricultural Inputs", "Farm Products"],
    }

    # Build theme_name → industries lookup from theme_rankings
    _tr_industries = {t["name"]: t.get("industries", []) for t in theme_rankings}

    output_theme_names = {t["name"] for t in output_themes}
    sorted_1d = sorted(finviz_theme_rankings, key=lambda x: x.get("perf_1d", 0))
    heatmap_extra_names = [t["name"] for t in sorted_1d[:5] + sorted_1d[-5:]
                           if t["name"] not in output_theme_names]

    logger.info(f"\nStep 3b: Fetching stocks for {len(heatmap_extra_names)} remaining heatmap themes...")
    heatmap_themes: list[dict] = []
    for theme_name in heatmap_extra_names:
        # Prefer industry codes from theme_rankings, fall back to HEATMAP_FALLBACK_INDUSTRIES
        ind_names = _tr_industries.get(theme_name) or _HEATMAP_FALLBACK_INDUSTRIES.get(theme_name, [])
        if not ind_names:
            logger.warning(f"  No industry mapping for heatmap theme: {theme_name}")
            continue

        logger.info(f"  Fetching: {theme_name} via industries: {ind_names}")
        theme_subthemes = []
        for ind_name in ind_names[:TOP_SUBTHEMES_PER_THEME]:
            ind_code = ind_codes.get(ind_name)
            if not ind_code:
                logger.warning(f"    No filter code for: {ind_name}")
                continue
            stocks = fetch_screener_stocks("ind", ind_code, max_pages=3)
            if not stocks:
                continue
            stocks.sort(key=_stock_score, reverse=True)
            picks = stocks[:TOP_STOCKS_PER_SUBTHEME]
            sub_stocks = _fetch_details(picks, all_detail_cache)
            if sub_stocks:
                theme_subthemes.append({"name": ind_name, "stocks": sub_stocks})
            _sleep()

        if theme_subthemes:
            heatmap_themes.append({"name": theme_name, "subthemes": theme_subthemes})

    # ── Step 4: Mark pure_play (appears in only one subtheme across all themes) ──
    ticker_count: dict[str, int] = {}
    for th in output_themes:
        for sub in th.get("subthemes", []):
            for stock in sub["stocks"]:
                ticker_count[stock["ticker"]] = ticker_count.get(stock["ticker"], 0) + 1
    for th in output_themes:
        for sub in th.get("subthemes", []):
            for stock in sub["stocks"]:
                stock["pure_play"] = ticker_count.get(stock["ticker"], 1) == 1

    # ── Step 5: Compute RS vs S&P 500 universe + breadth ──
    logger.info("\nStep 5: Building RS universe from S&P 500...")
    rs_universe, sp500_breadth, sp500_breadth_200, sp500_prices = _build_sp500_rs_universe()
    logger.info(f"  RS universe: {len(rs_universe)} stocks | S&P 500 breadth 50D: {sp500_breadth}% | 200D: {sp500_breadth_200}%")

    # Build market internals now — reuse the breadth values already computed above
    # so market_internals.py doesn't re-download the entire S&P 500 universe.
    logger.info("  Building market internals (VIX, TICK, TRIN, T2108, 10Y yield)...")
    try:
        from market_internals import build_internals
        market_internals_data = build_internals(s5fi=sp500_breadth, mmth=sp500_breadth_200)
    except Exception as _mi_err:
        logger.warning(f"  market_internals failed (non-fatal): {_mi_err}")
        market_internals_data = None

    logger.info("  Fetching full-market breadth from Finviz screener...")
    finviz_adv_dec, finviz_new_hl, finviz_sma50, finviz_sma200 = _fetch_finviz_market_breadth()

    all_stocks_flat = []
    for th in output_themes + heatmap_themes:
        for sub in th.get("subthemes", []):
            all_stocks_flat.extend(sub["stocks"])

    if rs_universe and all_stocks_flat:
        sorted_perfs = sorted(rs_universe.values())
        n = len(sorted_perfs)
        for stock in all_stocks_flat:
            perf = stock.get("perf_6m") or stock.get("perf_3m") or 0
            rank = sum(1 for v in sorted_perfs if v <= perf)
            stock["rs_52w"] = max(1, min(99, int((rank / max(n, 1)) * 98) + 1))
    elif all_stocks_flat:
        # Fallback: internal ranking if S&P 500 fetch failed
        perfs = [(i, s.get("perf_6m") or s.get("perf_3m") or 0) for i, s in enumerate(all_stocks_flat)]
        perfs.sort(key=lambda x: x[1])
        n = len(perfs)
        for rank, (idx, _) in enumerate(perfs):
            all_stocks_flat[idx]["rs_52w"] = max(1, min(99, int((rank / max(n - 1, 1)) * 98) + 1))

    for th in output_themes + heatmap_themes:
        for sub in th.get("subthemes", []):
            sub["stocks"].sort(key=lambda s: s.get("rs_52w", 0), reverse=True)

    # ── Step 6: Fetch SPY benchmark + market condition ──
    logger.info("\nStep 6: Fetching SPY & QQQ market condition...")
    _sleep()
    spy_detail = fetch_stock_detail("SPY")
    spy_benchmarks = {}
    if spy_detail:
        for k in ["perf_1w", "perf_1m", "perf_3m", "perf_6m"]:
            spy_benchmarks[k] = spy_detail.get(k)

    # Fetch Nasdaq-100 breadth for QQQ (S&P 500 reused as proxy for SPY and IWM)
    qqq_breadth = _fetch_nasdaq100_breadth()
    _sleep()

    spy_ind = fetch_market_indicators("SPY", breadth=sp500_breadth)
    _sleep()
    qqq_ind = fetch_market_indicators("QQQ", breadth=qqq_breadth)
    _sleep()
    iwm_ind = fetch_market_indicators("IWM", breadth=sp500_breadth)  # S&P 500 as proxy
    _sleep()
    macro_assets = fetch_macro_assets()
    signal = _market_signal(spy_ind, qqq_ind) if spy_ind and qqq_ind else "yellow"
    market_condition = {
        "signal": signal,
        "spy": spy_ind,
        "qqq": qqq_ind,
        "iwm": iwm_ind,
        "breadth_50d": sp500_breadth,
        "breadth_200d": sp500_breadth_200,
        "adv_dec": finviz_adv_dec,
        "new_hl": finviz_new_hl,
        "sma50_counts": finviz_sma50,
        "sma200_counts": finviz_sma200,
        **macro_assets,
    }
    logger.info(
        f"  Market signal: {signal} | "
        f"SPY sma50={spy_ind.get('sma50_pct')} status={spy_ind.get('index_status')} breadth={sp500_breadth}% | "
        f"QQQ sma50={qqq_ind.get('sma50_pct')} status={qqq_ind.get('index_status')} breadth={qqq_breadth}%"
    )

    # Fetch VIX from TradingView scanner API
    vix_value = None
    try:
        vix_resp = requests.post(
            "https://scanner.tradingview.com/global/scan",
            json={"symbols": {"tickers": ["CBOE:VIX"]}, "columns": ["close"]},
            headers={"Content-Type": "application/json"},
            timeout=10,
        )
        vix_resp.raise_for_status()
        rows = vix_resp.json().get("data", [])
        if rows and rows[0].get("d"):
            vix_value = round(float(rows[0]["d"][0]), 2)
            logger.info(f"  VIX (TradingView): {vix_value}")
    except Exception as e:
        logger.warning(f"  VIX TradingView fetch failed: {e}")

    updated = date.today() if is_trading_day() else last_trading_date()

    # Build industry_rankings (raw per-industry data with parent_theme tag)
    industry_rankings = [
        {k: v for k, v in ind.items() if k != "perf_1y"}
        for ind in industries
        if ind.get("parent_theme") != "Other"
    ]

    logger.info("Fetching macro news...")
    macro_news = fetch_macro_news()

    # Convert TICKER_EXTRA_SUBTHEMES tuples to JSON-serialisable dicts
    ticker_extra_subthemes = {
        t: [{"theme": th, "subtheme": sub} for th, sub in pairs]
        for t, pairs in TICKER_EXTRA_SUBTHEMES.items()
    }

    generated_at = datetime.now(ZoneInfo("America/New_York")).strftime("%Y-%m-%d %H:%M ET")

    return {
        "last_updated": updated.isoformat(),
        "generated_at": generated_at,
        "themes": output_themes,
        "heatmap_themes": heatmap_themes,
        "theme_rankings": theme_rankings,
        "industry_rankings": industry_rankings,
        "finviz_theme_rankings": finviz_theme_rankings,
        "spy_benchmarks": spy_benchmarks,
        "market_condition": market_condition,
        "vix": vix_value,
        "macro_news": macro_news,
        "ticker_extra_subthemes": ticker_extra_subthemes,
        "market_internals": market_internals_data,
        "_sp500_prices": sp500_prices,
    }


def fetch_earnings_yf(ticker: str) -> str | None:
    """Return next earnings date as 'MMM DD' string using yfinance, or None."""
    try:
        import yfinance as yf
        from datetime import date as _date
        cal = yf.Ticker(ticker).calendar
        if not cal:
            return None
        dates = cal.get("Earnings Date")
        if not dates:
            return None
        # calendar returns a list of timestamps
        if not isinstance(dates, list):
            dates = [dates]
        today = _date.today()
        upcoming = []
        for d in dates:
            # yfinance returns datetime.date or Timestamp
            d_date = d.date() if hasattr(d, "date") and callable(d.date) else d
            if d_date >= today:
                upcoming.append(d_date)
        if not upcoming:
            return None
        return upcoming[0].strftime("%b %-d")
    except Exception:
        return None


def _fetch_details(picks: list[dict], cache: dict) -> list[dict]:
    result = []
    for s in picks:
        t = s["ticker"]
        if t not in cache:
            logger.info(f"      {t}...")
            detail = fetch_stock_detail(t)
            if detail:
                price_data = fetch_sparkline(t)
                detail["sparkline"] = price_data.get("sparkline", [])
                detail["bars_30d"] = price_data.get("bars_30d", [])
                detail["earnings"] = fetch_earnings_yf(t)
            cache[t] = detail
            _sleep()
        d = cache.get(t)
        if d is None:
            continue
        stock = d.copy()
        stock["pure_play"] = False
        stock.pop("perf_ytd", None)
        result.append(stock)
    return result


MACRO_QUERIES = [
    "Federal Reserve interest rate",
    "FOMC Fed rate decision",
    "US jobs report nonfarm payroll",
    "US unemployment CPI inflation",
    "US GDP recession",
    "US China trade war tariff",
    "war conflict geopolitical",
    "US debt ceiling Treasury",
    "oil price OPEC",
]

MACRO_KEYWORDS = [
    "fed", "federal reserve", "fomc", "rate hike", "rate cut", "interest rate",
    "nonfarm", "payroll", "unemployment", "jobs report", "cpi", "ppi", "inflation",
    "gdp", "recession", "tariff", "trade war", "sanction",
    "war", "conflict", "invasion", "military", "nato",
    "debt ceiling", "shutdown", "opec", "oil price",
]

def fetch_macro_news() -> list[dict]:
    """Fetch high-impact macro news via Alpaca (if key available) or Google News RSS."""
    alpaca_key    = os.environ.get("ALPACA_API_KEY", "")
    alpaca_secret = os.environ.get("ALPACA_SECRET_KEY", "")

    if alpaca_key and alpaca_secret:
        return _fetch_alpaca_macro_news(alpaca_key, alpaca_secret)
    return _fetch_rss_macro_news()


def _fetch_alpaca_macro_news(api_key: str, secret: str) -> list[dict]:
    """Fetch macro news from Alpaca News API, filtered to high-impact stories."""
    from datetime import datetime, timezone, timedelta
    try:
        cutoff = datetime.now(timezone.utc) - timedelta(hours=24)
        url = "https://data.alpaca.markets/v1beta1/news"
        params = {
            "symbols": "SPY,QQQ,GLD,USO,TLT",
            "limit": 50,
            "start": cutoff.strftime("%Y-%m-%dT%H:%M:%SZ"),
            "sort": "desc",
        }
        resp = requests.get(url, params=params,
                            headers={"APCA-API-KEY-ID": api_key, "APCA-API-SECRET-KEY": secret},
                            timeout=15)
        resp.raise_for_status()
        articles = resp.json().get("news", [])
        results = []
        seen = set()
        for a in articles:
            title = a.get("headline", "")
            summary = a.get("summary", "")
            text = (title + " " + summary).lower()
            if not any(kw in text for kw in MACRO_KEYWORDS):
                continue
            url_link = a.get("url", "")
            key = title[:60].lower()
            if key in seen:
                continue
            seen.add(key)
            results.append({
                "title": title,
                "summary": summary[:180] if summary else "",
                "url": url_link,
                "date": a.get("created_at", "")[:16].replace("T", " "),
                "source": a.get("source", ""),
            })
            if len(results) >= 15:
                break
        logger.info(f"  Alpaca macro news: {len(results)} articles")
        return results
    except Exception as e:
        logger.warning(f"  Alpaca news failed: {e}")
        return _fetch_rss_macro_news()


def _fetch_rss_macro_news() -> list[dict]:
    """Fetch macro news from Google News RSS using macro keyword queries."""
    from xml.etree import ElementTree as ET
    from email.utils import parsedate_to_datetime
    from datetime import datetime, timezone, timedelta
    cutoff = datetime.now(timezone.utc) - timedelta(hours=24)
    seen = set()
    results = []
    for query in MACRO_QUERIES[:5]:
        try:
            q = query.replace(" ", "+")
            url = f"https://news.google.com/rss/search?q={q}&hl=en-US&gl=US&ceid=US:en"
            resp = requests.get(url, timeout=10, headers={"User-Agent": "Mozilla/5.0"})
            resp.raise_for_status()
            root = ET.fromstring(resp.content)
            for item in root.findall(".//item"):
                title = item.findtext("title", "")
                link  = item.findtext("link", "")
                desc  = item.findtext("description", "")
                pub   = item.findtext("pubDate", "")
                if not title:
                    continue
                text = (title + " " + desc).lower()
                if not any(kw in text for kw in MACRO_KEYWORDS):
                    continue
                try:
                    pub_dt = parsedate_to_datetime(pub)
                    if pub_dt < cutoff:
                        continue
                    date_label = pub_dt.strftime("%Y-%m-%d %H:%M")
                except Exception:
                    continue
                key = title[:60].lower()
                if key in seen:
                    continue
                seen.add(key)
                # Strip HTML from description
                import re
                summary = re.sub(r"<[^>]+>", "", desc).strip()[:180]
                results.append({
                    "title": title,
                    "summary": summary,
                    "url": link,
                    "date": date_label,
                    "source": "Google News",
                })
                if len(results) >= 15:
                    break
        except Exception as e:
            logger.warning(f"  RSS macro news failed for query '{query}': {e}")
        if len(results) >= 15:
            break
    results.sort(key=lambda x: x["date"], reverse=True)
    logger.info(f"  RSS macro news: {len(results)} articles")
    return results


def _build_price_cache(scanner_prices: dict) -> dict:
    """Build prices.json: S&P 500 + Russell 2000 closing prices + today's scanner stocks."""
    import yfinance as yf
    import pandas as pd

    prices = dict(scanner_prices)  # start with today's scanner stocks

    def _fetch_tickers_prices(tickers: list[str]) -> dict:
        if not tickers:
            return {}
        try:
            data = yf.download(tickers, period="5d", interval="1d", auto_adjust=True, progress=False)
            closes = data["Close"].dropna(thresh=2, axis=1)
            result = {}
            for col in closes.columns:
                col_data = closes[col].dropna()
                if len(col_data) >= 2:
                    price = float(col_data.iloc[-1])
                    prev  = float(col_data.iloc[-2])
                    result[str(col)] = {
                        "price": round(price, 2),
                        "change_pct": round((price - prev) / prev * 100, 2) if prev else None,
                    }
            return result
        except Exception as e:
            logger.warning(f"  Price batch failed: {e}")
            return {}

    # S&P 500
    try:
        r = requests.get(
            "https://raw.githubusercontent.com/datasets/s-and-p-500-companies/main/data/constituents.csv",
            timeout=15
        )
        sp500 = [line.split(",")[0].strip().replace(".", "-") for line in r.text.strip().split("\n")[1:] if line]
        logger.info(f"  Fetching prices for {len(sp500)} S&P 500 tickers...")
        prices.update(_fetch_tickers_prices(sp500))
        logger.info(f"  prices.json now: {len(prices)} tickers")
    except Exception as e:
        logger.warning(f"  S&P 500 price fetch failed: {e}")

    # Russell 2000 (IWM holdings from iShares)
    try:
        r = requests.get(
            "https://www.ishares.com/us/products/239714/IWM/1467271812596.ajax?fileType=csv&fileName=IWM_holdings&dataType=fund",
            headers={"User-Agent": "Mozilla/5.0"}, timeout=20
        )
        r2k = []
        for line in r.text.strip().split("\n"):
            parts = line.split(",")
            if len(parts) >= 2:
                t = parts[0].strip().strip('"')
                # Valid US stock ticker: 1-5 alpha chars, no $ or special prefix
                if 1 <= len(t) <= 5 and t.replace("-", "").isalpha() and t[0].isalpha():
                    r2k.append(t.replace(".", "-"))
        new_tickers = [t for t in r2k if t not in prices]
        logger.info(f"  Fetching prices for {len(new_tickers)} Russell 2000 tickers...")
        prices.update(_fetch_tickers_prices(new_tickers))
        logger.info(f"  prices.json now: {len(prices)} tickers")
    except Exception as e:
        logger.warning(f"  Russell 2000 price fetch failed: {e}")

    return prices


def fetch_all_tickers() -> list[dict]:
    """Fetch complete US stock ticker list from SEC EDGAR (free, no API key)."""
    try:
        url = "https://www.sec.gov/files/company_tickers.json"
        resp = requests.get(url, timeout=15, headers={"User-Agent": "thematic-scanner research@example.com"})
        resp.raise_for_status()
        data = resp.json()
        tickers = [
            {"ticker": v["ticker"].upper(), "company": v["title"]}
            for v in data.values()
            if v.get("ticker") and v.get("title")
        ]
        logger.info(f"  SEC ticker list: {len(tickers)} tickers")
        return tickers
    except Exception as e:
        logger.warning(f"  SEC ticker fetch failed: {e}")
        return []


# ETF → theme mapping (mirrors THEME_ETF_MAP in App.js)
_THEME_ETF_MAP = {
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
}


def fetch_etf_holdings(etf_ticker: str) -> list:
    """Fetch top holdings for an ETF via yfinance. Returns [] on any failure."""
    try:
        import yfinance as yf
        t = yf.Ticker(etf_ticker)
        fd = t.get_funds_data()
        if fd is None:
            return []
        th = fd.top_holdings
        if th is None or th.empty:
            return []
        rows = []
        for sym, row in th.iterrows():
            name = str(row.get("Name", "")).strip()
            pct = float(row.get("Holding Percent", 0)) * 100
            rows.append({"ticker": str(sym).strip(), "name": name, "weight": round(pct, 2)})
        rows.sort(key=lambda x: x["weight"], reverse=True)
        logger.info(f"  ETF holdings: {etf_ticker} → {len(rows)} holdings")
        return rows
    except Exception as e:
        logger.warning(f"  ETF holdings failed for {etf_ticker}: {e}")
        return []


def _classify_etf_signal(detail: dict, closes: list) -> tuple:
    """Classify a theme ETF as a breakout or support setup.

    breakout — fresh ~5-week closing high while holding above SMA50 & SMA200
    support  — price hugging a rising key MA with the long-term trend intact
    Returns (signal, level): signal is 'breakout' | 'support' | None.
    """
    s20 = detail.get("sma20_pct")
    s50 = detail.get("sma50_pct")
    s200 = detail.get("sma200_pct")

    if closes and len(closes) >= 35 and s50 is not None and s200 is not None:
        last = closes[-1]
        recent_high = max(closes[-6:])
        base_high = max(closes[-35:-6])
        # Require a tight "launch pad" in the 2.5 weeks before the break.
        # If the ETF was still strongly trending in that window (>10% range),
        # it is extended rather than fresh, so skip it.
        launch_pad = closes[-18:-6]
        pad_lo = min(launch_pad) if launch_pad else 0
        pad_hi = max(launch_pad) if launch_pad else 0
        pad_range_pct = (pad_hi - pad_lo) / pad_lo * 100 if pad_lo > 0 else 999
        if (s50 > 0 and s200 > 0
                and last >= recent_high * 0.985
                and recent_high > base_high
                and pad_range_pct <= 10):
            return ("breakout", None)

    if s200 is not None and s200 > 0:
        for pct, name, tol in ((s20, "SMA20", 2.5), (s50, "SMA50", 2.5), (s200, "SMA200", 3.5)):
            if pct is not None and -tol <= pct <= tol:
                return ("support", name)

    return (None, None)


def build_etf_signals(unique_etfs: list) -> list:
    """Fetch technicals for each theme ETF and flag breakout / support setups.

    Returns a list (breakouts first, then supports) telling the dashboard
    which themes are worth watching next.
    """
    etf_theme = {}
    for theme, etf in _THEME_ETF_MAP.items():
        etf_theme.setdefault(etf, theme)

    signals = []
    for etf in unique_etfs:
        detail = fetch_stock_detail(etf)
        _sleep()
        if not detail:
            logger.warning(f"  ETF signal: no detail for {etf}")
            continue
        closes = fetch_sparkline(etf).get("sparkline", [])
        _sleep()
        signal, level = _classify_etf_signal(detail, closes)
        if signal is None:
            continue
        # Require positive 3M momentum to qualify as a "hot theme" ETF
        perf_3m = detail.get("perf_3m") or 0
        if perf_3m <= 0:
            logger.info(f"  ETF signal: {etf} skipped (3M perf {perf_3m:.1f}% ≤ 0)")
            continue
        signals.append({
            "etf": etf,
            "theme": etf_theme.get(etf, etf),
            "signal": signal,
            "level": level,
            "price": detail.get("price"),
            "perf_1d": detail.get("perf_1d"),
            "perf_1w": detail.get("perf_1w"),
            "perf_1m": detail.get("perf_1m"),
            "perf_3m": detail.get("perf_3m"),
            "perf_6m": detail.get("perf_6m"),
            "sma20_pct": detail.get("sma20_pct"),
            "sma50_pct": detail.get("sma50_pct"),
            "sma200_pct": detail.get("sma200_pct"),
        })
        logger.info(f"  ETF signal: {etf} → {signal}{(' @ ' + level) if level else ''}")

    signals.sort(key=lambda x: ({"breakout": 0, "support": 1}.get(x["signal"], 9),
                                -(x.get("perf_1d") or 0)))
    return signals


def main():
    output = build_data()
    sp500_prices = output.pop("_sp500_prices", {})

    # Pre-fetch ETF holdings for all unique ETFs in the theme map
    unique_etfs = sorted(set(_THEME_ETF_MAP.values()))
    logger.info(f"Fetching ETF holdings for {len(unique_etfs)} ETFs...")
    etf_holdings = {}
    for etf in unique_etfs:
        etf_holdings[etf] = fetch_etf_holdings(etf)
    output["etf_holdings"] = etf_holdings

    # Only build ETF signals for ETFs whose themes were selected as top themes this run
    top_theme_names = {t["name"] for t in output.get("themes", [])}
    hot_etfs = sorted({
        etf for theme, etf in _THEME_ETF_MAP.items()
        if theme in top_theme_names
    })
    logger.info(f"Building ETF breakout / support signals for {len(hot_etfs)} hot-theme ETFs: {hot_etfs}")
    output["etf_signals"] = build_etf_signals(hot_etfs)

    out_path = Path("public/thematic_data.json")
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(output, indent=2, ensure_ascii=False, allow_nan=False), encoding="utf-8")

    # Write public/ibkr_themes.json — non-fatal if IBKR is unavailable
    try:
        from ibkr_themes import build_ibkr_themes
        logger.info("Running ibkr_themes pipeline...")
        build_ibkr_themes()
    except Exception as _ibt_err:
        logger.warning(f"ibkr_themes failed (non-fatal): {_ibt_err}")

    logger.info("Fetching SEC ticker list...")
    all_tickers = fetch_all_tickers()
    ticker_path = Path("public/all_tickers.json")
    ticker_path.write_text(json.dumps(all_tickers, ensure_ascii=False), encoding="utf-8")
    logger.info(f"Output → {ticker_path}")

    # Build prices.json — scanner stocks + S&P 500 + Russell 2000
    scanner_prices = {}
    for th in output["themes"]:
        for sub in th.get("subthemes", []):
            for s in sub.get("stocks", []):
                if s.get("ticker") and s.get("price") is not None:
                    scanner_prices[s["ticker"]] = {
                        "price": s["price"],
                        "change_pct": s.get("change_pct") if s.get("change_pct") is not None else s.get("perf_1d"),
                    }
    logger.info(f"Building price cache (S&P 500 + Russell 2000 + scanner)...")
    prices = _build_price_cache(scanner_prices)
    prices_path = Path("public/prices.json")
    prices_path.write_text(json.dumps(prices, ensure_ascii=False), encoding="utf-8")
    logger.info(f"Prices → {prices_path} ({len(prices)} tickers)")

    total = sum(len(sub["stocks"]) for th in output["themes"] for sub in th.get("subthemes", []))
    subs = sum(len(th.get("subthemes", [])) for th in output["themes"])
    logger.info("=" * 60)
    logger.info(f"Done! {len(output['themes'])} themes · {subs} sub-themes · {total} stocks")
    logger.info(f"Output → {out_path}")
    logger.info("=" * 60)


if __name__ == "__main__":
    main()

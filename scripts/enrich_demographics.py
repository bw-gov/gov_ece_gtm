"""
enrich_demographics.py — Enriches districts.json with performance and
demographic data from multiple public sources.

Data collected per district:
  demographics.ellPercent      — % English Language Learners
  demographics.frlPercent      — % Free/Reduced-Price Lunch (poverty proxy)
  demographics.enrollmentByRace — % breakdown by race/ethnicity
  demographics.year            — data year
  demographics.src             — source URL
  nicheGrade                   — Niche.com overall district grade (A–F)
  nicheSrc                     — Niche.com district page URL
  kindergartenReadiness        — Short string with readiness score + year
  kindergartenReadinessSrc     — Source URL for K-readiness

Sources used (all free, no API key required):
  1. Urban Institute Education Data API  — demographics for districts with nces_leaid
  2. Niche.com                           — district letter grade + diversity grade
  3. Google News RSS                     — kindergarten readiness news

Re-runnable: skips districts that already have a non-empty demographics block.

Usage:
    python scripts/enrich_demographics.py           # all Tier 1+2
    python scripts/enrich_demographics.py --all     # every district
"""

import json
import re
import sys
import time
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from datetime import date, datetime
from html.parser import HTMLParser

DATA_PATH = "data/districts.json"

CURRENT_YEAR = date.today().year

# Urban Institute Education Data API (free, no key needed)
URBAN_BASE = "https://educationdata.urban.org/api/v1/school-districts/ccd"


# ── HTML helpers ──────────────────────────────────────────────────────────────
class TextExtractor(HTMLParser):
    def __init__(self):
        super().__init__()
        self.text_parts = []
        self._skip = 0
        self._skip_tags = {"script", "style", "nav", "footer"}

    def handle_starttag(self, tag, attrs):
        if tag in self._skip_tags:
            self._skip += 1

    def handle_endtag(self, tag):
        if tag in self._skip_tags and self._skip > 0:
            self._skip -= 1

    def handle_data(self, data):
        if self._skip == 0 and data.strip():
            self.text_parts.append(data.strip())

    def get_text(self):
        return " ".join(self.text_parts)


def html_to_text(html: str) -> str:
    p = TextExtractor()
    try:
        p.feed(html)
    except Exception:
        pass
    return p.get_text()


# ── Network helpers ───────────────────────────────────────────────────────────
def fetch_json(url: str, timeout: int = 12) -> dict | None:
    try:
        req = urllib.request.Request(
            url,
            headers={"User-Agent": "Mozilla/5.0", "Accept": "application/json"},
        )
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            return json.loads(resp.read())
    except Exception as e:
        print(f"    JSON fetch failed ({url[:60]}): {e}")
        return None


def fetch_html(url: str, timeout: int = 12) -> str:
    try:
        req = urllib.request.Request(
            url,
            headers={
                "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                              "AppleWebKit/537.36 (KHTML, like Gecko) "
                              "Chrome/120.0.0.0 Safari/537.36",
                "Accept": "text/html,application/xhtml+xml,*/*",
                "Accept-Language": "en-US,en;q=0.9",
            },
        )
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            raw = resp.read(300_000)
        charset = "utf-8"
        ct = resp.headers.get("Content-Type", "")
        if "charset=" in ct:
            charset = ct.split("charset=")[-1].strip().split(";")[0]
        return raw.decode(charset, errors="replace")
    except Exception as e:
        print(f"    HTML fetch failed ({url[:60]}): {e}")
        return ""


def fetch_rss(query: str, max_results: int = 6) -> list:
    encoded = urllib.parse.quote(query)
    url = f"https://news.google.com/rss/search?q={encoded}&hl=en-US&gl=US&ceid=US:en"
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, timeout=12) as resp:
            raw = resp.read()
        root = ET.fromstring(raw)
        items = []
        for item in root.findall(".//item")[:max_results]:
            items.append({
                "title": item.findtext("title") or "",
                "link": item.findtext("link") or "",
                "published": item.findtext("pubDate") or "",
            })
        return items
    except Exception as e:
        print(f"    RSS error for '{query[:50]}': {e}")
        return []


def is_recent(pub_str: str, days: int = 730) -> bool:
    try:
        dt = datetime.strptime(pub_str[:25].strip(), "%a, %d %b %Y %H:%M:%S")
        return (datetime.utcnow() - dt).days <= days
    except Exception:
        return True


# ── Slug helpers ──────────────────────────────────────────────────────────────
def niche_slug(district_name: str) -> str:
    """Convert district name to Niche.com URL slug."""
    # Strip state prefix like "CA — " or "FL — "
    name = re.sub(r"^[A-Z]{2}\s*[—\-–]\s*", "", district_name).strip()
    # Remove parenthetical suffixes  e.g. "(M-DCPS)"
    name = re.sub(r"\s*\(.*?\)", "", name).strip()
    # Lowercase, replace non-alphanumeric runs with single dash
    slug = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")
    return slug


# ── Source 1: Urban Institute Education Data API ──────────────────────────────
RACE_CODES = {
    1: "white",
    2: "black",
    3: "hispanic",
    4: "asian",
    5: "nativeAmerican",
    6: "pacificIslander",
    7: "twoOrMore",
    8: "unknown",
    9: "nonResident",
    20: "total",
    99: "total",
}


def fetch_urban_demographics(leaid: str) -> dict | None:
    """
    Fetch district demographics from Urban Institute Education Data API.
    Uses the CCD directory endpoint for ELL + FRL, and the enrollment/race
    endpoint for racial breakdown.
    Returns a demographics dict or None on failure.
    """
    # Try most recent years, working backwards
    for year in (2022, 2021, 2020, 2019):
        url = f"{URBAN_BASE}/directory/{year}/?leaid={leaid}"
        data = fetch_json(url)
        if not data or not data.get("results"):
            continue

        rec = data["results"][0]
        enr = rec.get("enrollment") or 0
        if enr == 0:
            continue

        ell = rec.get("english_language_learners") or rec.get("lep_students") or 0
        frl = rec.get("free_or_reduced_price_lunch") or 0

        ell_pct = round(ell / enr * 100, 1) if enr else None
        frl_pct = round(frl / enr * 100, 1) if enr else None

        demo = {
            "totalEnrollment": enr,
            "ellCount":   int(ell) if ell else None,
            "ellPercent": ell_pct,
            "frlCount":   int(frl) if frl else None,
            "frlPercent": frl_pct,
            "enrollmentByRace": {},
            "year": year,
            "src": f"https://educationdata.urban.org/api/v1/school-districts/ccd/directory/{year}/?leaid={leaid}",
        }

        # Fetch race/ethnicity breakdown (separate endpoint)
        race_url = f"{URBAN_BASE}/enrollment/{year}/race/99/sex/99/?leaid={leaid}"
        race_data = fetch_json(race_url)
        time.sleep(0.5)

        if race_data and race_data.get("results"):
            totals = {}
            for row in race_data["results"]:
                race_code = row.get("race")
                count = row.get("enrollment") or 0
                if race_code and race_code not in (20, 99):
                    label = RACE_CODES.get(race_code, f"race_{race_code}")
                    totals[label] = totals.get(label, 0) + count
            # Convert to percentages
            grand_total = sum(totals.values())
            if grand_total > 0:
                demo["enrollmentByRace"] = {
                    k: round(v / grand_total * 100, 1)
                    for k, v in sorted(totals.items(), key=lambda x: -x[1])
                    if v > 0
                }

        return demo

    return None


# ── Source 2: Niche.com ───────────────────────────────────────────────────────
# Patterns for extracting grade from Niche.com HTML
NICHE_GRADE_PATTERNS = [
    # JSON-LD / meta
    re.compile(r'"ratingValue"\s*:\s*"([A-F][+\-]?)"', re.I),
    # Overall grade heading
    re.compile(r'Overall Niche Grade[^A-F<]{0,30}([A-F][+\-]?)', re.I),
    # Grade badge class names like "niche__grade--a-minus" → "A-"
    re.compile(r'niche__grade--([a-f](?:-minus|-plus)?)', re.I),
    # Data attributes
    re.compile(r'data-overall-grade="([A-F][+\-]?)"', re.I),
    # Plain text fallback: "Grade: A-" near keyword
    re.compile(r'grade[:\s]+([A-F][+\-]?)\b', re.I),
]

# CSS class suffix → letter grade
CSS_GRADE_MAP = {
    "a-plus": "A+", "a-minus": "A-", "a": "A",
    "b-plus": "B+", "b-minus": "B-", "b": "B",
    "c-plus": "C+", "c-minus": "C-", "c": "C",
    "d-plus": "D+", "d-minus": "D-", "d": "D",
    "f": "F",
}


def fetch_niche_grade(district_name: str) -> tuple[str | None, str]:
    """Return (grade, url) from Niche.com or (None, url)."""
    slug = niche_slug(district_name)
    url = f"https://www.niche.com/k12/d/{slug}/"

    html = fetch_html(url)
    if not html:
        return None, url

    # CSS class pattern (most reliable on Niche.com)
    css_m = re.search(r'niche__grade--([a-f](?:-minus|-plus)?)', html, re.I)
    if css_m:
        grade = CSS_GRADE_MAP.get(css_m.group(1).lower())
        if grade:
            return grade, url

    # Try other patterns
    for pat in NICHE_GRADE_PATTERNS:
        m = pat.search(html)
        if m:
            raw = m.group(1).strip()
            # Normalise CSS suffix format if needed
            if "-" in raw and raw not in ("A-", "B-", "C-", "D-"):
                raw = CSS_GRADE_MAP.get(raw.lower(), raw)
            if re.match(r"^[A-F][+\-]?$", raw, re.I):
                return raw.upper(), url

    return None, url


# ── Source 3: Kindergarten readiness via Google News ─────────────────────────
K_READY_KEYWORDS = [
    "kindergarten readiness", "kinder readiness", "school readiness",
    "ready for kindergarten", "kready", "k-readiness",
    "kindergarten assessment", "early learning benchmark",
]

K_SCORE_PATTERNS = [
    # "67 percent" / "67%" / "67.3%"
    re.compile(r"(\d{1,2}(?:\.\d)?)\s*(?:%|percent)\s+(?:of\s+)?(?:students|children|kids)?"
               r"[^.]{0,50}(?:ready|readiness|benchmark|proficient)", re.I),
    re.compile(r"(?:ready|readiness|benchmark)[^.]{0,50}(\d{1,2}(?:\.\d)?)\s*(?:%|percent)", re.I),
    re.compile(r"(\d{1,2}(?:\.\d)?)\s*(?:%|percent)\s+kindergarten\s+readiness", re.I),
]


def fetch_kindergarten_readiness(district_name: str, state: str) -> tuple[str | None, str]:
    """Return (readiness_string, src_url) or (None, "")."""
    search_name = re.sub(r"^[A-Z]{2}\s*[—\-–]\s*", "", district_name).split("(")[0].strip()
    state_name = {
        "FL": "Florida", "AL": "Alabama", "GA": "Georgia", "MI": "Michigan",
        "ID": "Idaho", "UT": "Utah", "CO": "Colorado", "NV": "Nevada",
        "NM": "New Mexico", "AZ": "Arizona", "CA": "California",
        "OR": "Oregon", "WA": "Washington",
    }.get(state, state)

    queries = [
        f'"{search_name}" kindergarten readiness 2024 OR 2025',
        f'{state_name} "kindergarten readiness" 2024 OR 2025 report',
    ]

    for query in queries:
        items = fetch_rss(query)
        time.sleep(0.8)
        for item in items:
            if not is_recent(item["published"], days=730):
                continue
            title = item["title"].lower()
            if not any(kw in title for kw in K_READY_KEYWORDS):
                continue

            # Try to extract a percentage from the headline
            for pat in K_SCORE_PATTERNS:
                m = pat.search(item["title"])
                if m:
                    pct = m.group(1)
                    pub_year = item["published"][12:16] if len(item["published"]) > 15 else str(CURRENT_YEAR)
                    result = f"{pct}% met readiness benchmark ({pub_year})"
                    return result, item["link"]

            # No number found but headline is clearly about readiness — save title
            pub_year = item["published"][12:16] if len(item["published"]) > 15 else str(CURRENT_YEAR)
            snippet = re.sub(r"\s*-\s*Google News$", "", item["title"]).strip()
            return snippet[:100], item["link"]

    return None, ""


# ── Per-district enrichment ───────────────────────────────────────────────────
def enrich_district(d: dict) -> bool:
    """Run all demographic enrichment for one district. Returns True if changed."""
    changed = False
    district_name = d.get("district", "")
    state = d.get("state", "FL")
    leaid = d.get("nces_leaid", "")

    # ── 1. Urban Institute demographics ──
    if not d.get("demographics"):
        if leaid:
            print(f"    Fetching Urban Institute demographics (leaid={leaid})...")
            demo = fetch_urban_demographics(leaid)
            time.sleep(1.0)
            if demo:
                d["demographics"] = demo
                changed = True
                ell = f"{demo['ellPercent']}% ELL" if demo.get("ellPercent") is not None else "ELL unknown"
                frl = f"{demo['frlPercent']}% FRL" if demo.get("frlPercent") is not None else ""
                print(f"    ✓ Demographics: {ell}, {frl} (year {demo['year']})")

                # Auto-flag multilingual buying signal
                ell_pct = demo.get("ellPercent") or 0
                if ell_pct >= 15:
                    signal = f"🌐 {ell_pct}% English Language Learners — multilingual family communication is a key differentiator"
                    existing = d.get("buyingSignals", [])
                    if not any("multilingual" in s.lower() or "english language learner" in s.lower()
                               for s in existing):
                        d.setdefault("buyingSignals", []).append(signal)
                        print(f"    + Multilingual buying signal added ({ell_pct}% ELL)")
            else:
                print(f"    – No demographic data found via Urban Institute API")
        else:
            print(f"    – No nces_leaid, skipping Urban Institute lookup")

    # ── 2. Niche.com grade ──
    if not d.get("nicheGrade"):
        print(f"    Fetching Niche.com grade...")
        grade, url = fetch_niche_grade(district_name)
        time.sleep(1.5)
        if grade:
            d["nicheGrade"] = grade
            d["nicheSrc"] = url
            changed = True
            print(f"    ✓ Niche grade: {grade}")
        else:
            # Write empty sentinel so we don't retry every run
            d["nicheGrade"] = ""
            d["nicheSrc"] = url
            print(f"    – No Niche grade found")

    # ── 3. Kindergarten readiness ──
    if not d.get("kindergartenReadiness"):
        print(f"    Searching kindergarten readiness news...")
        readiness, src = fetch_kindergarten_readiness(district_name, state)
        if readiness:
            d["kindergartenReadiness"] = readiness
            d["kindergartenReadinessSrc"] = src
            changed = True
            print(f"    ✓ K-readiness: {readiness[:60]}")
        else:
            print(f"    – No K-readiness data found")

    return changed


# ── Main ──────────────────────────────────────────────────────────────────────
def main():
    run_all = "--all" in sys.argv
    print(f"Starting demographics enrichment — {date.today()}")
    print(f"Mode: {'all districts' if run_all else 'Tier 1+2 only'}")

    with open(DATA_PATH) as f:
        districts = json.load(f)

    total    = 0
    enriched = 0

    for i, d in enumerate(districts):
        if d.get("isTest"):
            continue
        tier = d.get("priorityTier", "Tier 3")
        if not run_all and tier not in ("Tier 1", "Tier 2"):
            continue

        # Skip if already fully enriched
        demo = d.get("demographics") or {}
        already_done = (
            demo.get("ellPercent") is not None
            and d.get("nicheGrade") is not None
        )
        if already_done:
            continue

        total += 1
        name = d.get("district", "?")[:55]
        print(f"\n[{i+1}/{len(districts)}] {name} ({tier})")

        changed = enrich_district(d)
        if changed:
            d["lastUpdated"] = str(date.today())
            enriched += 1

        # Save checkpoint every 10 districts
        if total % 10 == 0:
            with open(DATA_PATH, "w") as f:
                json.dump(districts, f, indent=2)
            print(f"  (checkpoint — {enriched}/{total} enriched)")

        time.sleep(2)

    with open(DATA_PATH, "w") as f:
        json.dump(districts, f, indent=2)

    print(f"\nDone. {enriched}/{total} districts enriched → {DATA_PATH}")


if __name__ == "__main__":
    main()

#!/usr/bin/env python3

from pathlib import Path
from html.parser import HTMLParser
from urllib.parse import urlsplit, unquote
from collections import Counter
import re
import sys
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parent.parent
HTML_FILES = sorted(ROOT.glob("*.html"))

errors = []


def fail(path, message):
    errors.append(f"{path}: {message}")


class Parser(HTMLParser):
    VOID = {
        "area", "base", "br", "col", "embed", "hr",
        "img", "input", "link", "meta", "param",
        "source", "track", "wbr"
    }

    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.ids = []
        self.images = []
        self.links = []
        self.stack = []

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)

        if "id" in attrs:
            self.ids.append(attrs["id"])

        if tag == "img":
            self.images.append(attrs)

        if tag == "a":
            parent = self.stack[-1] if self.stack else None
            self.links.append((attrs, parent))

        if tag not in self.VOID:
            self.stack.append(tag)

    def handle_endtag(self, tag):
        for i in range(len(self.stack) - 1, -1, -1):
            if self.stack[i] == tag:
                del self.stack[i:]
                return


for path in HTML_FILES:
    text = path.read_text(errors="replace")
    lower = text.lower()

    # Fundamental document structure.
    for tag in ("html", "head", "body"):
        opens = len(re.findall(rf"<{tag}(?:\s|>)", lower))
        closes = len(re.findall(rf"</{tag}\s*>", lower))

        if opens != 1 or closes != 1:
            fail(path.name, f"{tag} count is opens={opens}, closes={closes}")

    for required in (
        r'<meta[^>]+name=["\']viewport["\']',
        r'<meta[^>]+name=["\']description["\']',
        r'<link[^>]+rel=["\']canonical["\']',
        r'<meta[^>]+property=["\']og:title["\']',
        r'<meta[^>]+property=["\']og:description["\']',
        r'<meta[^>]+property=["\']og:url["\']',
        r'<meta[^>]+name=["\']twitter:card["\']',
    ):
        if not re.search(required, text, re.I):
            fail(path.name, f"missing metadata matching {required}")

    parser = Parser()
    parser.feed(text)

    ids = Counter(parser.ids)

    for value, count in ids.items():
        if count > 1:
            fail(path.name, f'duplicate id="{value}"')

    for attrs in parser.images:
        if "alt" not in attrs:
            fail(
                path.name,
                f'image missing alt: {attrs.get("src", "(unknown)")}'
            )

    for attrs, parent in parser.links:
        href = (attrs.get("href") or "").strip()

        if not href:
            fail(path.name, "anchor has empty href")

        if parent in {"ul", "ol"}:
            fail(path.name, f"anchor directly inside <{parent}>: {href}")

        if attrs.get("target") == "_blank":
            rel = attrs.get("rel", "")

            if "noopener" not in rel.split():
                fail(path.name, f"_blank link lacks noopener: {href}")

        if href.startswith("http://"):
            fail(path.name, f"insecure external URL: {href}")

    # Check local href/src targets.
    for attr, value in re.findall(
        r'\b(href|src)=["\']([^"\']+)["\']',
        text,
        re.I
    ):
        value = value.strip()

        if not value or value.startswith((
            "#",
            "https://",
            "mailto:",
            "tel:",
            "javascript:",
            "data:",
        )):
            continue

        parsed = urlsplit(value)
        rel = unquote(parsed.path)

        if not rel:
            continue

        target = ROOT / rel.lstrip("/")

        if rel == "/":
            target = ROOT / "index.html"

        if not target.exists():
            fail(
                path.name,
                f'missing local resource {attr}="{value}"'
            )


# JS syntax assumptions / expected files.
stats = ROOT / "functions" / "stats.js"

if not stats.exists():
    fail("functions/stats.js", "missing stats endpoint")


# robots.txt
robots = ROOT / "robots.txt"

if not robots.exists():
    fail("robots.txt", "missing")
else:
    robots_text = robots.read_text()

    if "Sitemap:" not in robots_text:
        fail("robots.txt", "missing Sitemap declaration")


# sitemap.xml
sitemap = ROOT / "sitemap.xml"

if not sitemap.exists():
    fail("sitemap.xml", "missing")
else:
    try:
        ET.parse(sitemap)
    except ET.ParseError as exc:
        fail("sitemap.xml", f"invalid XML: {exc}")


if errors:
    print("SITE AUDIT FAILED")
    print()

    for error in errors:
        print(f"- {error}")

    print()
    print(f"{len(errors)} issue(s) found.")
    sys.exit(1)

print(
    f"SITE AUDIT PASSED: "
    f"{len(HTML_FILES)} HTML pages checked with 0 issues."
)

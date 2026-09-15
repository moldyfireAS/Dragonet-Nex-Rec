#!/usr/bin/env python3

from pathlib import Path
from html.parser import HTMLParser
from urllib.parse import urlsplit
import re
import sys

ROOT = Path(__file__).resolve().parent.parent

IMAGE_EXTS = {".png", ".jpg", ".jpeg", ".webp", ".gif", ".svg"}
MEDIA_EXTS = {".mp4", ".webm"}
HTML_LIMIT = 100 * 1024
CSS_LIMIT = 150 * 1024
JS_LIMIT = 150 * 1024
IMAGE_WARN = 750 * 1024
IMAGE_FAIL = 2 * 1024 * 1024
MEDIA_WARN = 10 * 1024 * 1024
MEDIA_FAIL = 25 * 1024 * 1024
PAGE_WARN = 4 * 1024 * 1024
PAGE_FAIL = 8 * 1024 * 1024

warnings = []
errors = []


def human(n):
    for unit in ("B", "KiB", "MiB", "GiB"):
        if n < 1024 or unit == "GiB":
            return f"{n:.1f} {unit}"
        n /= 1024


class AssetParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.assets = []

    def add_asset(self, value):
        if not value:
            return

        if value.startswith((
            "http://",
            "https://",
            "data:",
            "#",
            "mailto:",
            "tel:",
        )):
            return

        path = urlsplit(value).path.lstrip("/")

        if path:
            self.assets.append(path)

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        tag = tag.lower()

        # Resources loaded through src.
        if tag in {
            "img",
            "script",
            "video",
            "audio",
            "source",
            "iframe",
            "embed",
            "input",
        }:
            self.add_asset(attrs.get("src"))

        # Video poster images are separate resources.
        if tag == "video":
            self.add_asset(attrs.get("poster"))

        # Only resource-bearing <link> elements should count.
        # Ordinary <a href="..."> navigation does not download
        # the destination page and must not contribute to page weight.
        if tag == "link":
            rel = {
                value.lower()
                for value in attrs.get("rel", "").split()
            }

            resource_rels = {
                "stylesheet",
                "icon",
                "manifest",
                "preload",
                "modulepreload",
            }

            if rel & resource_rels:
                self.add_asset(attrs.get("href"))


print("=== FILE SIZE AUDIT ===")

for path in ROOT.rglob("*"):
    if not path.is_file() or ".git" in path.parts:
        continue

    size = path.stat().st_size
    ext = path.suffix.lower()
    rel = path.relative_to(ROOT)

    if ext == ".html" and size > HTML_LIMIT:
        warnings.append(f"{rel}: HTML is {human(size)}")

    if ext == ".css" and size > CSS_LIMIT:
        warnings.append(f"{rel}: CSS is {human(size)}")

    if ext == ".js" and size > JS_LIMIT:
        warnings.append(f"{rel}: JavaScript is {human(size)}")

    if ext in IMAGE_EXTS:
        if size > IMAGE_FAIL:
            errors.append(f"{rel}: image is {human(size)}")
        elif size > IMAGE_WARN:
            warnings.append(f"{rel}: large image is {human(size)}")

    if ext in MEDIA_EXTS:
        if size > MEDIA_FAIL:
            errors.append(f"{rel}: media is {human(size)}")
        elif size > MEDIA_WARN:
            warnings.append(f"{rel}: large media is {human(size)}")


print()
print("=== APPROXIMATE PAGE WEIGHT ===")

for page in sorted(ROOT.glob("*.html")):
    parser = AssetParser()
    parser.feed(page.read_text(errors="replace"))

    assets = set(parser.assets)
    total = page.stat().st_size

    for asset in assets:
        p = ROOT / asset
        if p.exists() and p.is_file():
            total += p.stat().st_size

    print(f"{page.name:24} {human(total)}")

    if total > PAGE_FAIL:
        errors.append(f"{page.name}: approx page weight {human(total)}")
    elif total > PAGE_WARN:
        warnings.append(f"{page.name}: approx page weight {human(total)}")


print()
print("=== SIMPLE CSS SELECTOR USAGE ===")

css_path = ROOT / "style.css"

if css_path.exists():
    css = css_path.read_text(errors="replace")
    html = "\n".join(
        p.read_text(errors="replace")
        for p in ROOT.glob("*.html")
    )

    selectors = sorted(set(
        re.findall(r'\.([A-Za-z_][A-Za-z0-9_-]*)', css)
    ))

    used_classes = set()

    for match in re.finditer(
        r'class=["\']([^"\']+)["\']',
        html,
        re.I
    ):
        used_classes.update(match.group(1).split())

    ignored = {
        "btn",
        "card",
        "section",
        "nav-block",
        "visually-hidden",
        "status-ok",
        "status-warn",
        "status-bad",
        "status-unknown",
        "support-checklist-status--ready",
        "panic-button",
    }

    unused = [
        selector
        for selector in selectors
        if selector not in used_classes
        and selector not in ignored
    ]

    if unused:
        warnings.append(
            "Possible unused CSS classes: " + ", ".join(unused)
        )


print("=== CACHE CONFIG ===")

headers = ROOT / "_headers"

if not headers.exists():
    errors.append("_headers is missing")
else:
    text = headers.read_text()

    if "Cache-Control" not in text:
        errors.append("_headers has no Cache-Control rules")
    else:
        print("Cloudflare cache rules found")


if warnings:
    print()
    print("WARNINGS")
    for item in warnings:
        print(f"- {item}")

if errors:
    print()
    print("ERRORS")
    for item in errors:
        print(f"- {item}")

    print()
    print(f"Performance audit failed with {len(errors)} error(s).")
    sys.exit(1)

print()
print("Performance audit passed.")

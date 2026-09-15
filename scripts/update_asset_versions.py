#!/usr/bin/env python3

from pathlib import Path
from urllib.parse import urlsplit, urlunsplit, parse_qsl, urlencode
import hashlib
import re
import sys

ROOT = Path(__file__).resolve().parent.parent

ASSET_EXTENSIONS = {
    ".css",
    ".js",
    ".mjs",
}

HTML_FILES = sorted(ROOT.glob("*.html"))


def asset_hash(path: Path) -> str:
    digest = hashlib.sha256(path.read_bytes()).hexdigest()
    return digest[:10]


def version_url(value: str) -> str:
    if not value.startswith("/"):
        return value

    split = urlsplit(value)
    relative = split.path.lstrip("/")
    asset = ROOT / relative

    if not asset.is_file():
        return value

    if asset.suffix.lower() not in ASSET_EXTENSIONS:
        return value

    params = dict(parse_qsl(split.query, keep_blank_values=True))
    params["v"] = asset_hash(asset)

    return urlunsplit((
        split.scheme,
        split.netloc,
        split.path,
        urlencode(params),
        split.fragment,
    ))


PATTERN = re.compile(
    r'(?P<prefix>\b(?:href|src)=["\'])(?P<url>[^"\']+)(?P<suffix>["\'])',
    re.I,
)


def update_html(path: Path, check_only=False) -> bool:
    original = path.read_text()

    def replace(match):
        old_url = match.group("url")
        new_url = version_url(old_url)

        return (
            match.group("prefix")
            + new_url
            + match.group("suffix")
        )

    updated = PATTERN.sub(replace, original)

    if updated == original:
        return False

    if not check_only:
        path.write_text(updated)

    return True


def main():
    check_only = "--check" in sys.argv

    changed = []

    for page in HTML_FILES:
        if update_html(page, check_only=check_only):
            changed.append(page.name)

    if check_only:
        if changed:
            print("Stale asset versions detected:")
            for name in changed:
                print(f" - {name}")
            print()
            print("Run: python scripts/update_asset_versions.py")
            return 1

        print("Asset cache versions are current.")
        return 0

    if changed:
        print(f"Updated asset versions in {len(changed)} page(s):")
        for name in changed:
            print(f" - {name}")
    else:
        print("Asset cache versions already current.")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())

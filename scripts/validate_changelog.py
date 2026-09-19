#!/usr/bin/env python3

import json
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CHANGELOG_FILE = ROOT / "changelog.json"

VALID_CHANNELS = {
    "alpha",
    "beta",
    "stable",
    "EA",
}

VALID_STATUSES = {
    "available",
    "deprecated",
    "withdrawn",
    "Unavailable",
    "unavailable",
}


def fail(message):
    raise SystemExit(
        f"CHANGELOG ERROR: {message}"
    )


def main():
    try:
        data = json.loads(
            CHANGELOG_FILE.read_text()
        )
    except FileNotFoundError:
        fail("changelog.json is missing")
    except json.JSONDecodeError as exc:
        fail(f"invalid JSON: {exc}")

    if not isinstance(data, dict):
        fail("root must be an object")

    releases = data.get("releases")

    if not isinstance(releases, list):
        fail("releases must be an array")

    versions = set()

    for index, release in enumerate(releases):
        prefix = f"release #{index + 1}"

        if not isinstance(release, dict):
            fail(f"{prefix} must be an object")

        version = release.get("version")

        if not isinstance(version, str) or not version.strip():
            fail(f"{prefix} requires a version")

        if version in versions:
            fail(f"duplicate version: {version}")

        versions.add(version)

        channel = release.get("channel")

        if channel not in VALID_CHANNELS:
            fail(
                f"{version}: invalid channel"
            )

        status = release.get("status")

        if status not in VALID_STATUSES:
            fail(
                f"{version}: invalid status"
            )

        released_at = release.get("released_at")

        if not isinstance(released_at, str):
            fail(
                f"{version}: released_at must be a string"
            )

        if released_at == "Unreleased":
            if status.lower() != "unavailable":
                fail(
                    f"{version}: an unreleased version "
                    "cannot be marked available"
                )
        else:
            try:
                parsed_date = date.fromisoformat(released_at)
            except ValueError:
                fail(
                    f"{version}: released_at must be "
                    "YYYY-MM-DD or Unreleased"
                )

            if parsed_date.isoformat() != released_at:
                fail(
                    f"{version}: released_at must be "
                    "YYYY-MM-DD"
                )

        summary = release.get("summary")

        if not isinstance(summary, str) or not summary.strip():
            fail(
                f"{version}: summary is required"
            )

        for field in (
            "highlights",
            "known_issues",
        ):
            value = release.get(field)

            if not isinstance(value, list):
                fail(
                    f"{version}: {field} must be an array"
                )

            if not all(
                isinstance(item, str)
                for item in value
            ):
                fail(
                    f"{version}: {field} entries must be strings"
                )

    print(
        f"Changelog configuration is valid: "
        f"{len(releases)} release(s)."
    )


if __name__ == "__main__":
    main()

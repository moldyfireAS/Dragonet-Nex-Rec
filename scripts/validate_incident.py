#!/usr/bin/env python3

import json
from datetime import datetime
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parent.parent
INCIDENT_FILE = ROOT / "incident.json"

VALID_SEVERITIES = {
    "info",
    "degraded",
    "maintenance",
    "critical",
}


def fail(message):
    raise SystemExit(
        f"INCIDENT CONFIG ERROR: {message}"
    )


def parse_optional_timestamp(
    value,
    field,
):
    if value is None:
        return None

    if not isinstance(value, str):
        fail(
            f"{field} must be a string or null"
        )

    try:
        parsed = value.replace(
            "Z",
            "+00:00",
        )

        return datetime.fromisoformat(
            parsed
        )
    except ValueError:
        fail(
            f"{field} must be valid ISO-8601"
        )


def main():
    try:
        data = json.loads(
            INCIDENT_FILE.read_text()
        )
    except FileNotFoundError:
        fail("incident.json is missing")
    except json.JSONDecodeError as exc:
        fail(
            f"invalid JSON: {exc}"
        )

    if not isinstance(data, dict):
        fail(
            "root value must be an object"
        )

    active = data.get("active")

    if not isinstance(active, bool):
        fail(
            "active must be true or false"
        )

    severity = data.get(
        "severity"
    )

    if severity not in VALID_SEVERITIES:
        fail(
            "severity must be one of: "
            + ", ".join(
                sorted(
                    VALID_SEVERITIES
                )
            )
        )

    title = data.get(
        "title",
        "",
    )

    message = data.get(
        "message",
        "",
    )

    if not isinstance(title, str):
        fail("title must be a string")

    if not isinstance(
        message,
        str,
    ):
        fail("message must be a string")

    if active:
        if not title.strip():
            fail(
                "active incidents require a title"
            )

        if not message.strip():
            fail(
                "active incidents require a message"
            )

    link = data.get(
        "link",
        "/status.html",
    )

    if not isinstance(link, str):
        fail("link must be a string")

    parsed_link = urlparse(link)

    if (
        parsed_link.scheme and
        parsed_link.scheme not in {
            "http",
            "https",
        }
    ):
        fail(
            "link must use http, https, or a local path"
        )

    starts = parse_optional_timestamp(
        data.get("starts_at"),
        "starts_at",
    )

    expires = parse_optional_timestamp(
        data.get("expires_at"),
        "expires_at",
    )

    parse_optional_timestamp(
        data.get("updated_at"),
        "updated_at",
    )

    if (
        starts is not None and
        expires is not None and
        expires <= starts
    ):
        fail(
            "expires_at must be after starts_at"
        )

    print(
        "Incident configuration is valid."
    )


if __name__ == "__main__":
    main()

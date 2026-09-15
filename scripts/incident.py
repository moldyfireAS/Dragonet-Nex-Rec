#!/usr/bin/env python3

import argparse
import json
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
INCIDENT_FILE = ROOT / "incident.json"
VALIDATOR = ROOT / "scripts" / "validate_incident.py"

SEVERITIES = (
    "info",
    "degraded",
    "maintenance",
    "critical",
)


def utc_now():
    return (
        datetime.now(timezone.utc)
        .replace(microsecond=0)
        .isoformat()
        .replace("+00:00", "Z")
    )


def load():
    try:
        return json.loads(INCIDENT_FILE.read_text())
    except FileNotFoundError:
        raise SystemExit("incident.json not found")
    except json.JSONDecodeError as exc:
        raise SystemExit(
            f"incident.json contains invalid JSON: {exc}"
        )


def write(data):
    previous = (
        INCIDENT_FILE.read_text()
        if INCIDENT_FILE.exists()
        else None
    )

    INCIDENT_FILE.write_text(
        json.dumps(
            data,
            indent=2,
            ensure_ascii=False,
        )
        + "\n"
    )

    result = subprocess.run(
        [
            sys.executable,
            str(VALIDATOR),
        ],
        cwd=ROOT,
    )

    if result.returncode != 0:
        if previous is None:
            INCIDENT_FILE.unlink(
                missing_ok=True
            )
        else:
            INCIDENT_FILE.write_text(
                previous
            )

        raise SystemExit(
            "Incident update failed validation. "
            "Previous configuration restored."
        )


def print_incident(data):
    print(
        json.dumps(
            data,
            indent=2,
            ensure_ascii=False,
        )
    )


def publish(args):
    data = {
        "active": True,
        "severity": args.severity,
        "title": args.title,
        "message": args.message,
        "link": args.link,
        "starts_at": None,
        "expires_at": args.expires,
        "updated_at": utc_now(),
    }

    write(data)

    print()
    print("Incident published locally:")
    print_incident(data)


def schedule(args):
    data = {
        "active": True,
        "severity": args.severity,
        "title": args.title,
        "message": args.message,
        "link": args.link,
        "starts_at": args.start,
        "expires_at": args.expires,
        "updated_at": utc_now(),
    }

    write(data)

    print()
    print("Incident scheduled locally:")
    print_incident(data)


def clear(_args):
    data = {
        "active": False,
        "severity": "info",
        "title": "",
        "message": "",
        "link": "/status.html",
        "starts_at": None,
        "expires_at": None,
        "updated_at": utc_now(),
    }

    write(data)

    print()
    print("Incident cleared locally.")
    print_incident(data)


def show(_args):
    print_incident(load())


def build_parser():
    parser = argparse.ArgumentParser(
        description=(
            "Manage N3XI0M manual incident notices."
        )
    )

    subparsers = parser.add_subparsers(
        dest="command",
        required=True,
    )

    show_parser = subparsers.add_parser(
        "show",
        help="Show the current incident configuration.",
    )
    show_parser.set_defaults(
        handler=show
    )

    publish_parser = subparsers.add_parser(
        "publish",
        help="Publish an incident immediately.",
    )

    publish_parser.add_argument(
        "severity",
        choices=SEVERITIES,
    )

    publish_parser.add_argument(
        "title",
    )

    publish_parser.add_argument(
        "message",
    )

    publish_parser.add_argument(
        "--link",
        default="/status.html",
    )

    publish_parser.add_argument(
        "--expires",
        default=None,
        help=(
            "Optional ISO-8601 expiry, "
            "for example 2026-09-15T18:00:00Z"
        ),
    )

    publish_parser.set_defaults(
        handler=publish
    )

    schedule_parser = subparsers.add_parser(
        "schedule",
        help="Schedule an incident for later.",
    )

    schedule_parser.add_argument(
        "severity",
        choices=SEVERITIES,
    )

    schedule_parser.add_argument(
        "title",
    )

    schedule_parser.add_argument(
        "message",
    )

    schedule_parser.add_argument(
        "--start",
        required=True,
        help=(
            "ISO-8601 start time, "
            "for example 2026-09-15T19:00:00Z"
        ),
    )

    schedule_parser.add_argument(
        "--expires",
        default=None,
        help="Optional ISO-8601 expiry.",
    )

    schedule_parser.add_argument(
        "--link",
        default="/status.html",
    )

    schedule_parser.set_defaults(
        handler=schedule
    )

    clear_parser = subparsers.add_parser(
        "clear",
        help="Disable the current manual incident.",
    )

    clear_parser.set_defaults(
        handler=clear
    )

    return parser


def main():
    parser = build_parser()
    args = parser.parse_args()
    args.handler(args)


if __name__ == "__main__":
    main()

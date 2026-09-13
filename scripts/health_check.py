#!/usr/bin/env python3

import sys
import time
import urllib.error
import urllib.request

BASE = "https://dragonet-recnet.pages.dev"

CRITICAL_CHECKS = [
    ("/", {200}, "Homepage"),
    ("/health", {200}, "Health endpoint"),
    ("/favicon.svg", {200}, "Static assets"),
    (
        "/this-route-should-not-exist-health-check",
        {404},
        "404 handling",
    ),
]

RETRIES = 3
TIMEOUT = 15


def request(path):
    separator = "&" if "?" in path else "?"
    url = (
        BASE
        + path
        + separator
        + f"health={time.time_ns()}"
    )

    req = urllib.request.Request(
        url,
        headers={
            "User-Agent": "N3XI0M-Health-Monitor/1.1",
            "Cache-Control": "no-cache",
        },
    )

    try:
        with urllib.request.urlopen(
            req,
            timeout=TIMEOUT,
        ) as response:
            return response.status, dict(response.headers)
    except urllib.error.HTTPError as exc:
        return exc.code, dict(exc.headers)


def retry(path, expected):
    status = None
    headers = {}

    for attempt in range(RETRIES):
        try:
            status, headers = request(path)
        except Exception as exc:
            status = f"error: {exc}"
            headers = {}

        if status in expected:
            break

        if attempt < RETRIES - 1:
            time.sleep(3)

    return status, headers


failures = []

for path, expected, name in CRITICAL_CHECKS:
    status, _ = retry(path, expected)
    expected_text = "/".join(map(str, sorted(expected)))

    if status in expected:
        print(f"PASS {name}: {status}")
    else:
        print(
            f"FAIL {name}: received {status}, "
            f"expected {expected_text}"
        )
        failures.append(name)

stats_status, stats_headers = retry(
    "/stats",
    {200, 502, 503},
)

stats_mode = stats_headers.get(
    "x-n3xi0m-stats-status",
    "",
).lower()

if stats_status == 200 and stats_mode == "degraded":
    print(
        "WARN Discord Stats API: serving cached fallback data"
    )
elif stats_status == 200:
    print("PASS Discord Stats API: 200")
elif stats_status == 502:
    print(
        "WARN Discord Stats API: Discord upstream unavailable"
    )
elif stats_status == 503:
    print(
        "WARN Discord Stats API: intentionally restricted"
    )
else:
    print(
        f"WARN Discord Stats API: unexpected status "
        f"{stats_status}"
    )

if failures:
    print()
    print("Production health check failed:")
    for failure in failures:
        print(f"- {failure}")

    sys.exit(1)

print()
print("Critical production health checks passed.")

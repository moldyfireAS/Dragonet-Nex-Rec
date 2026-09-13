#!/usr/bin/env python3

import sys
import time
import urllib.error
import urllib.request

BASE = "https://dragonet-recnet.pages.dev"

CHECKS = [
    ("/", {200}, "Homepage"),
    ("/stats", {200}, "Discord Stats API"),
    ("/favicon.svg", {200}, "Static assets"),
    ("/this-route-should-not-exist-health-check", {404}, "404 handling"),
]

RETRIES = 3
TIMEOUT = 15


def request(path):
    req = urllib.request.Request(
        BASE + path,
        headers={
            "User-Agent": "N3XI0M-Health-Monitor/1.0",
            "Cache-Control": "no-cache",
        },
    )

    try:
        with urllib.request.urlopen(req, timeout=TIMEOUT) as response:
            return response.status
    except urllib.error.HTTPError as exc:
        return exc.code


failures = []

for path, expected, name in CHECKS:
    status = None

    for attempt in range(RETRIES):
        try:
            status = request(
                f"{path}{'&' if '?' in path else '?'}health={int(time.time())}"
            )
        except Exception as exc:
            status = f"error: {exc}"

        if status in expected:
            break

        if attempt < RETRIES - 1:
            time.sleep(3)

    expected_text = "/".join(map(str, sorted(expected)))

    if status in expected:
        print(f"PASS {name}: {status}")
    else:
        print(
            f"FAIL {name}: received {status}, expected {expected_text}"
        )
        failures.append(name)

if failures:
    print()
    print("Production health check failed:")
    for failure in failures:
        print(f"- {failure}")

    sys.exit(1)

print()
print("All production health checks passed.")

# N3XI0M Incident Response

This document defines the basic operational response procedure for the
N3XI0M website hosted on Cloudflare Pages.

## Operating Modes

### Normal

    TRAFFIC_MODE=normal
    SITE_MODE=normal

This is the normal production state.

### Restricted Traffic Mode

    TRAFFIC_MODE=restricted

Use this only when dynamic services need to be restricted during unusually
high traffic or a suspected denial-of-service incident.

Static site content should remain available where possible.

Do not publicly expose the emergency access token.

### Maintenance Mode

    SITE_MODE=maintenance

Maintenance mode is separate from traffic protection.

Use it for planned maintenance, deployments, or other situations where the
public website should temporarily return a maintenance response.

The maintenance response uses HTTP 503 and Retry-After.

## Initial Assessment

Before declaring an incident:

1. Check the production homepage.
2. Check `/health`.
3. Check `/stats`.
4. Review Cloudflare deployment status.
5. Review GitHub Actions health-monitor results.
6. Determine whether the problem affects only Discord statistics or the
   entire website.
7. Avoid assuming high traffic is malicious without supporting evidence.

## Useful Checks

Homepage:

    curl -i https://dragonet-recnet.pages.dev/

Health:

    curl -i "https://dragonet-recnet.pages.dev/health?cb=$(date +%s)"

Discord stats:

    curl -i "https://dragonet-recnet.pages.dev/stats?cb=$(date +%s)"

Custom 404:

    curl -i https://dragonet-recnet.pages.dev/definitely-not-a-real-page

## Severity

### Degraded

Examples:

- Discord statistics temporarily unavailable
- one non-essential feature failing
- increased latency without widespread outage

Keep the public site online.

### Major

Examples:

- repeated production errors
- significant service instability
- sustained unusual traffic
- dynamic services becoming unreliable

Consider restricted traffic mode.

### Critical

Examples:

- widespread service outage
- confirmed active attack materially affecting availability
- urgent maintenance required to protect service integrity

Use restricted traffic mode or maintenance mode as appropriate.

## During an Incident

Record:

- UTC timestamp
- observed symptoms
- HTTP response codes
- affected routes
- relevant Cloudflare information
- relevant GitHub deployment or workflow information
- changes made during mitigation

Do not publish authentication secrets, private tokens, or sensitive logs.

## Recovery

Before returning to normal:

1. Confirm the homepage responds normally.
2. Confirm `/health` reports expected modes.
3. Confirm `/stats` is healthy.
4. Confirm automated health checks pass.
5. Restore:

       TRAFFIC_MODE=normal
       SITE_MODE=normal

6. Redeploy if required by Cloudflare.
7. Verify production again.
8. Document what happened and what was changed.

## Cloudflare

The project currently uses the `pages.dev` hostname and receives Cloudflare's
platform-level network protection.

Application-level controls complement Cloudflare protection but do not replace
network-level denial-of-service mitigation.

## Access

Cloudflare configuration should only be changed by authorized project
administrators.

The `EMERGENCY_ACCESS_TOKEN` must remain stored as a Cloudflare secret and
must never be committed to GitHub.

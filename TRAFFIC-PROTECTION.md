# N3XI0M Traffic Protection

N3XI0M uses Cloudflare edge protection and application-level degraded modes to maintain availability during unusually high traffic or suspected denial-of-service activity.

## Modes

### normal

Normal public operation.

Static pages remain publicly available.

The Discord statistics endpoint is publicly available and cached.

### elevated

Intended for periods of suspicious or unusually high traffic.

Cloudflare rate limiting and managed challenges should be tightened while keeping the public website available.

### restricted

Emergency mode.

Static pages remain available.

Non-essential dynamic functionality may return HTTP 503.

Authorized staff or infrastructure requests may access protected dynamic functionality using the emergency bearer token.

## Environment Variables

Cloudflare should provide:

    TRAFFIC_MODE=normal

Optional emergency authorization secret:

    EMERGENCY_ACCESS_TOKEN=<secret>

Never commit `EMERGENCY_ACCESS_TOKEN` to GitHub.

## Visitor Notice

Visitors may experience:

- slower responses
- temporary rate limits
- verification challenges
- temporary restrictions on non-essential features

These controls are intended to preserve service availability for legitimate users.

## Important

Application code is not a replacement for Cloudflare's network-level DDoS protection.

Rate limiting, managed challenges, bot controls, and emergency firewall rules should be enforced at Cloudflare's edge.

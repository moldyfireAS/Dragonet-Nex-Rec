const INVITE_CODE = "9bFfM7Ppsz";
const DISCORD_TIMEOUT_MS = 5000;

function secureHeaders(headers = {}) {
  const result = new Headers(headers);

  result.set("X-Content-Type-Options", "nosniff");
  result.set("Referrer-Policy", "same-origin");
  result.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  result.set("X-Frame-Options", "DENY");

  return result;
}

function json(data, init = {}, cacheControl = "no-store") {
  const headers = secureHeaders(init.headers || {});

  headers.set("Content-Type", "application/json; charset=utf-8");
  headers.set("Cache-Control", cacheControl);

  return new Response(JSON.stringify(data), {
    ...init,
    headers,
  });
}

function timingSafeEqual(a, b) {
  if (typeof a !== "string" || typeof b !== "string") {
    return false;
  }

  const encoder = new TextEncoder();
  const aa = encoder.encode(a);
  const bb = encoder.encode(b);

  if (aa.length !== bb.length) {
    return false;
  }

  let result = 0;

  for (let i = 0; i < aa.length; i++) {
    result |= aa[i] ^ bb[i];
  }

  return result === 0;
}

function isEmergencyAuthorized(request, env) {
  const secret = env?.EMERGENCY_ACCESS_TOKEN;

  if (!secret) {
    return false;
  }

  const provided = request.headers.get("Authorization");
  const expected = `Bearer ${secret}`;

  return timingSafeEqual(provided, expected);
}

export async function onRequest({ request, env }) {
  if (!["GET", "HEAD"].includes(request.method)) {
    return json(
      {
        error: "method_not_allowed",
        message: "Only GET and HEAD requests are supported.",
      },
      {
        status: 405,
        headers: {
          Allow: "GET, HEAD",
        },
      }
    );
  }

  const trafficMode = String(env?.TRAFFIC_MODE || "normal").toLowerCase();

  if (trafficMode === "restricted" && !isEmergencyAuthorized(request, env)) {
    return json(
      {
        error: "traffic_restriction",
        message:
          "Discord statistics are temporarily restricted due to unusually high traffic.",
        retry_after_seconds: 120,
      },
      {
        status: 503,
        headers: {
          "Retry-After": "120",
          "X-N3XI0M-Traffic-Mode": "restricted",
        },
      }
    );
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DISCORD_TIMEOUT_MS);

  try {
    const response = await fetch(
      `https://discord.com/api/v10/invites/${INVITE_CODE}?with_counts=true`,
      {
        headers: {
          Accept: "application/json",
        },
        signal: controller.signal,
      }
    );

    if (!response.ok) {
      return json(
        {
          error: "discord_upstream_error",
          message: "Discord stats are temporarily unavailable.",
        },
        { status: 502 }
      );
    }

    let data;

    try {
      data = await response.json();
    } catch {
      return json(
        {
          error: "invalid_discord_response",
          message: "Discord returned an invalid response.",
        },
        { status: 502 }
      );
    }

    const total = Number(data.approximate_member_count);
    const online = Number(data.approximate_presence_count);

    if (!Number.isFinite(total) || !Number.isFinite(online)) {
      return json(
        {
          error: "missing_discord_counts",
          message: "Discord did not provide member counts.",
        },
        { status: 502 }
      );
    }

    const authorizedRestrictedRequest =
      trafficMode === "restricted" &&
      isEmergencyAuthorized(request, env);

    const cacheControl = authorizedRestrictedRequest
      ? "private, no-store"
      : "public, max-age=60, stale-while-revalidate=300";

    const payload = {
      total_members: total,
      online_members: online,
      traffic_mode: trafficMode,
    };

    if (request.method === "HEAD") {
      const headers = secureHeaders({
        "Cache-Control": cacheControl,
        "Content-Type": "application/json; charset=utf-8",
        "X-N3XI0M-Traffic-Mode": trafficMode,
      });

      return new Response(null, {
        status: 200,
        headers,
      });
    }

    return json(
      payload,
      {
        headers: {
          "X-N3XI0M-Traffic-Mode": trafficMode,
        },
      },
      cacheControl
    );
  } catch (error) {
    const timedOut = error?.name === "AbortError";

    return json(
      {
        error: timedOut ? "discord_timeout" : "discord_fetch_failed",
        message: timedOut
          ? "Discord stats request timed out."
          : "Unable to contact Discord.",
      },
      { status: 502 }
    );
  } finally {
    clearTimeout(timeout);
  }
}

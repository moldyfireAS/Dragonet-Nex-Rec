const INVITE_CODE = "9bFfM7Ppsz";
const DISCORD_TIMEOUT_MS = 5000;
const FALLBACK_CACHE_SECONDS = 1800;

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

function fallbackCacheKey(request) {
  const url = new URL(request.url);

  url.pathname = "/__n3xi0m_internal_stats_cache";
  url.search = "";

  return new Request(url.toString(), {
    method: "GET",
  });
}

async function readFallback(request) {
  try {
    const cached = await caches.default.match(fallbackCacheKey(request));

    if (!cached) {
      return null;
    }

    const data = await cached.json();

    const total = Number(data.total_members);
    const online = Number(data.online_members);

    if (!Number.isFinite(total) || !Number.isFinite(online)) {
      return null;
    }

    return {
      total_members: total,
      online_members: online,
      cached_at: data.cached_at || null,
    };
  } catch {
    return null;
  }
}

async function writeFallback(request, payload, waitUntil) {
  const cachedPayload = {
    total_members: payload.total_members,
    online_members: payload.online_members,
    cached_at: new Date().toISOString(),
  };

  const response = new Response(JSON.stringify(cachedPayload), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": `public, max-age=${FALLBACK_CACHE_SECONDS}`,
    },
  });

  const operation = caches.default.put(
    fallbackCacheKey(request),
    response
  );

  if (typeof waitUntil === "function") {
    waitUntil(operation);
  } else {
    await operation;
  }
}

function degradedResponse(cached, trafficMode, reason) {
  return json(
    {
      total_members: cached.total_members,
      online_members: cached.online_members,
      traffic_mode: trafficMode,
      degraded: true,
      source: "stale_cache",
      cached_at: cached.cached_at,
      degraded_reason: reason,
    },
    {
      status: 200,
      headers: {
        "X-N3XI0M-Traffic-Mode": trafficMode,
        "X-N3XI0M-Stats-Status": "degraded",
        Warning: '110 - "Response is stale"',
      },
    },
    "no-store"
  );
}

async function upstreamFailure(request, trafficMode, error, message) {
  const cached = await readFallback(request);

  if (cached) {
    return degradedResponse(
      cached,
      trafficMode,
      error
    );
  }

  return json(
    {
      error,
      message,
      degraded: true,
    },
    {
      status: 502,
      headers: {
        "X-N3XI0M-Traffic-Mode": trafficMode,
        "X-N3XI0M-Stats-Status": "unavailable",
      },
    }
  );
}

export async function onRequest({ request, env, waitUntil }) {
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

  const trafficMode = String(
    env?.TRAFFIC_MODE || "normal"
  ).toLowerCase();

  if (
    trafficMode === "restricted" &&
    !isEmergencyAuthorized(request, env)
  ) {
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
          "X-N3XI0M-Stats-Status": "restricted",
        },
      }
    );
  }

  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    DISCORD_TIMEOUT_MS
  );

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
      return upstreamFailure(
        request,
        trafficMode,
        "discord_upstream_error",
        "Discord stats are temporarily unavailable."
      );
    }

    let data;

    try {
      data = await response.json();
    } catch {
      return upstreamFailure(
        request,
        trafficMode,
        "invalid_discord_response",
        "Discord returned an invalid response."
      );
    }

    const total = Number(data.approximate_member_count);
    const online = Number(data.approximate_presence_count);

    if (!Number.isFinite(total) || !Number.isFinite(online)) {
      return upstreamFailure(
        request,
        trafficMode,
        "missing_discord_counts",
        "Discord did not provide member counts."
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
      degraded: false,
      source: "discord",
    };

    if (!authorizedRestrictedRequest) {
      await writeFallback(
        request,
        payload,
        waitUntil
      );
    }

    if (request.method === "HEAD") {
      const headers = secureHeaders({
        "Cache-Control": cacheControl,
        "Content-Type": "application/json; charset=utf-8",
        "X-N3XI0M-Traffic-Mode": trafficMode,
        "X-N3XI0M-Stats-Status": "operational",
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
          "X-N3XI0M-Stats-Status": "operational",
        },
      },
      cacheControl
    );
  } catch (error) {
    const timedOut = error?.name === "AbortError";

    return upstreamFailure(
      request,
      trafficMode,
      timedOut ? "discord_timeout" : "discord_fetch_failed",
      timedOut
        ? "Discord stats request timed out."
        : "Unable to contact Discord."
    );
  } finally {
    clearTimeout(timeout);
  }
}

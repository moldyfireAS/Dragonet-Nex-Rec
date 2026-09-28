const TIMEOUT_MS = 5000;

function secureHeaders(headers = {}) {
  const result = new Headers(headers);

  result.set("X-Content-Type-Options", "nosniff");
  result.set("Referrer-Policy", "same-origin");
  result.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=()"
  );
  result.set("X-Frame-Options", "DENY");

  return result;
}

function json(data, init = {}, cacheControl = "no-store") {
  const headers = secureHeaders(init.headers || {});

  headers.set(
    "Content-Type",
    "application/json; charset=utf-8"
  );
  headers.set("Cache-Control", cacheControl);

  return new Response(JSON.stringify(data), {
    ...init,
    headers,
  });
}

async function checkHttp(url) {
  const controller = new AbortController();

  const timeout = setTimeout(
    () => controller.abort(),
    TIMEOUT_MS
  );

  const started = performance.now();

  try {
    const response = await fetch(url, {
      method: "GET",
      cache: "no-store",
      redirect: "follow",
      headers: {
        Accept: "application/json,text/plain,*/*",
      },
      signal: controller.signal,
    });

    const latency = Math.round(
      performance.now() - started
    );

    let status = "operational";

    if (response.status >= 500) {
      status = "unavailable";
    } else if (response.status >= 400) {
      status = "degraded";
    }

    return {
      status,
      reachable: true,
      http_status: response.status,
      latency_ms: latency,
      checked_at: new Date().toISOString(),
    };
  } catch (error) {
    return {
      status: "unavailable",
      reachable: false,
      http_status: null,
      latency_ms: null,
      error:
        error?.name === "AbortError"
          ? "timeout"
          : "connection_failed",
      checked_at: new Date().toISOString(),
    };
  } finally {
    clearTimeout(timeout);
  }
}

function overallStatus(services) {
  const monitored = Object.values(services)
    .filter(service =>
      !["unmonitored", "unreleased"].includes(
        service.status
      )
    );

  if (
    monitored.some(
      service => service.status === "unavailable"
    )
  ) {
    return "partial_outage";
  }

  if (
    monitored.some(
      service => service.status === "degraded"
    )
  ) {
    return "degraded";
  }

  return "operational";
}

export async function onRequest({ request, env }) {
  if (!["GET", "HEAD"].includes(request.method)) {
    return json(
      {
        error: "method_not_allowed",
        message:
          "Only GET and HEAD requests are supported.",
      },
      {
        status: 405,
        headers: {
          Allow: "GET, HEAD",
        },
      }
    );
  }

  const origin = new URL(request.url).origin;

  /*
   * Check endpoints we actually know exist.
   *
   * RecNet remains unmonitored until its real
   * production endpoint is configured.
   */

  const [website, discordStats] =
    await Promise.all([
      checkHttp(`${origin}/health`),
      checkHttp(`${origin}/stats`),
    ]);

  const services = {
    website: {
      name: "N3XI0M Website",
      ...website,
    },

    discord_stats: {
      name: "Discord Stats API",
      ...discordStats,
    },

    recnet: {
      name: "Dragonet RecNet",
      status: env?.RECNET_HEALTH_URL
        ? "checking"
        : "unmonitored",
      reachable: null,
      http_status: null,
      latency_ms: null,
      checked_at: new Date().toISOString(),
    },

    release: {
      name: "N3XI0M Client",
      status: "unreleased",
      reachable: null,
      http_status: null,
      latency_ms: null,
      checked_at: new Date().toISOString(),
    },
  };

  if (env?.RECNET_HEALTH_URL) {
    services.recnet = {
      name: "Dragonet RecNet",
      ...(await checkHttp(
        String(env.RECNET_HEALTH_URL)
      )),
    };
  }

  const payload = {
    status: overallStatus(services),
    generated_at: new Date().toISOString(),
    services,
  };

  if (request.method === "HEAD") {
    return new Response(null, {
      status: 200,
      headers: secureHeaders({
        "Cache-Control": "no-store",
        "X-N3XI0M-Services-Status":
          payload.status,
      }),
    });
  }

  return json(
    payload,
    {
      headers: {
        "X-N3XI0M-Services-Status":
          payload.status,
      },
    },
    "public, max-age=30, stale-while-revalidate=60"
  );
}

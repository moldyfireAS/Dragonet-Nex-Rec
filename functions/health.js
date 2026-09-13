function json(data, init = {}) {
  const headers = new Headers(init.headers || {});

  headers.set("Content-Type", "application/json; charset=utf-8");
  headers.set("Cache-Control", "no-store");
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("Referrer-Policy", "same-origin");
  headers.set("X-Frame-Options", "DENY");

  return new Response(JSON.stringify(data), {
    ...init,
    headers,
  });
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

  const siteMode = String(env?.SITE_MODE || "normal").toLowerCase();
  const trafficMode = String(env?.TRAFFIC_MODE || "normal").toLowerCase();

  const payload = {
    status: siteMode === "maintenance" ? "maintenance" : "operational",
    site_mode: siteMode,
    traffic_mode: trafficMode,
    generated_at: new Date().toISOString(),
  };

  if (request.method === "HEAD") {
    return new Response(null, {
      status: 200,
      headers: {
        "Cache-Control": "no-store",
        "X-N3XI0M-Site-Mode": siteMode,
        "X-N3XI0M-Traffic-Mode": trafficMode,
      },
    });
  }

  return json(payload, {
    headers: {
      "X-N3XI0M-Site-Mode": siteMode,
      "X-N3XI0M-Traffic-Mode": trafficMode,
    },
  });
}

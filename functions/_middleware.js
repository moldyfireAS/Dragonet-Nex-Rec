function maintenancePage() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="robots" content="noindex">
  <title>N3XI0M Maintenance</title>
  <style>
    :root {
      color-scheme: dark;
      font-family: system-ui, sans-serif;
    }

    * {
      box-sizing: border-box;
    }

    body {
      margin: 0;
      min-height: 100vh;
      display: grid;
      place-items: center;
      padding: 24px;
      background:
        radial-gradient(circle at top, #28134f, transparent 45%),
        #090a10;
      color: #f4f2ff;
    }

    main {
      width: min(620px, 100%);
      padding: 32px;
      border: 1px solid rgba(170, 130, 255, .3);
      border-radius: 18px;
      background: rgba(18, 18, 30, .92);
      box-shadow: 0 20px 60px rgba(0, 0, 0, .35);
    }

    .badge {
      display: inline-block;
      margin-bottom: 14px;
      padding: 6px 10px;
      border-radius: 999px;
      background: rgba(168, 116, 255, .14);
      color: #cbb5ff;
      font-weight: 700;
    }

    h1 {
      margin: 0 0 12px;
    }

    p {
      line-height: 1.6;
      color: #c8c6d4;
    }

    a {
      color: #cbb5ff;
    }
  </style>
</head>
<body>
  <main>
    <span class="badge">Scheduled maintenance</span>
    <h1>N3XI0M is temporarily unavailable</h1>
    <p>
      We're carrying out maintenance and some services are temporarily
      unavailable. This is separate from N3XI0M's traffic-protection system.
    </p>
    <p>
      Please try again shortly. Service will return automatically when
      maintenance mode is disabled.
    </p>
  </main>
</body>
</html>`;
}

export async function onRequest(context) {
  const siteMode = String(context.env?.SITE_MODE || "normal").toLowerCase();

  if (siteMode !== "maintenance") {
    return context.next();
  }

  const url = new URL(context.request.url);

  const allowedDuringMaintenance = [
    "/health",
    "/stats",
  ];

  if (allowedDuringMaintenance.includes(url.pathname)) {
    return context.next();
  }

  if (!["GET", "HEAD"].includes(context.request.method)) {
    return context.next();
  }

  const headers = {
    "Content-Type": "text/html; charset=utf-8",
    "Cache-Control": "no-store",
    "Retry-After": "300",
    "X-N3XI0M-Site-Mode": "maintenance",
    "X-Robots-Tag": "noindex",
  };

  if (context.request.method === "HEAD") {
    return new Response(null, {
      status: 503,
      headers,
    });
  }

  return new Response(maintenancePage(), {
    status: 503,
    headers,
  });
}

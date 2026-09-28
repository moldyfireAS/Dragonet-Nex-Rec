(() => {
  "use strict";

  const SERVICES_URL = "/services";
  const RELEASE_URL = "/release.json";
  const REFRESH_MS = 60_000;

  const SERVICE_ORDER = [
    "website",
    "discord_stats",
    "recnet",
    "release",
  ];

  const LABELS = {
    operational: "Operational",
    degraded: "Degraded",
    unavailable: "Unavailable",
    unmonitored: "Unmonitored",
    unreleased: "Unreleased",
    checking: "Checking…",
  };

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function cssState(status) {
    switch (status) {
      case "operational":
        return "ok";

      case "degraded":
      case "unreleased":
        return "warn";

      case "unavailable":
        return "bad";

      default:
        return "unknown";
    }
  }

  function statusLabel(status) {
    return LABELS[status] || "Unknown";
  }

  function latencyLabel(service) {
    if (!Number.isFinite(service?.latency_ms)) {
      return "";
    }

    return `${service.latency_ms} ms`;
  }

  function renderOverall(status) {
    const element =
      document.querySelector("[data-services-overall]");

    if (!element) return;

    const labels = {
      operational: "All monitored systems operational",
      degraded: "Some systems are degraded",
      partial_outage: "Some systems are unavailable",
    };

    element.textContent =
      labels[status] || "Service state unknown";

    element.dataset.state =
      status === "operational"
        ? "ok"
        : status === "degraded"
          ? "warn"
          : "bad";
  }

  function renderService(key, service, release) {
    const container =
      document.querySelector(
        `[data-service="${key}"]`
      );

    if (!container) return;

    const dot =
      container.querySelector("[data-service-dot]");

    const state =
      container.querySelector("[data-service-state]");

    const latency =
      container.querySelector("[data-service-latency]");

    let label =
      statusLabel(service.status);

    if (key === "release" && release) {
      const version =
        release.version
          ? `v${release.version}`
          : "";

      const channel =
        release.channel || "";

      const releaseStatus =
        release.status
          ? statusLabel(
              String(release.status).toLowerCase()
            )
          : label;

      label = [
        version,
        channel,
        releaseStatus,
      ].filter(Boolean).join(" · ");
    }

    if (dot) {
      dot.className =
        `status-dot status-${cssState(service.status)}`;
    }

    if (state) {
      state.textContent = label;
    }

    if (latency) {
      latency.textContent =
        latencyLabel(service);
    }

    container.dataset.state =
      service.status;
  }

  async function fetchJson(url) {
    const response = await fetch(
      `${url}?cb=${Date.now()}`,
      {
        cache: "no-store",
        headers: {
          Accept: "application/json",
        },
      }
    );

    if (!response.ok) {
      throw new Error(
        `${url} returned ${response.status}`
      );
    }

    return response.json();
  }

  async function refresh() {
    const checked =
      document.querySelector(
        "[data-services-checked]"
      );

    try {
      const [servicesResult, releaseResult] =
        await Promise.allSettled([
          fetchJson(SERVICES_URL),
          fetchJson(RELEASE_URL),
        ]);

      if (servicesResult.status !== "fulfilled") {
        throw servicesResult.reason;
      }

      const data = servicesResult.value;

      const release =
        releaseResult.status === "fulfilled"
          ? releaseResult.value
          : null;

      renderOverall(data.status);

      for (const key of SERVICE_ORDER) {
        const service =
          data.services?.[key];

        if (!service) continue;

        renderService(
          key,
          service,
          release
        );
      }

      if (checked) {
        checked.textContent =
          new Date(
            data.generated_at || Date.now()
          ).toLocaleString();
      }
    } catch (error) {
      renderOverall("unavailable");

      for (const key of SERVICE_ORDER) {
        renderService(
          key,
          {
            status:
              key === "recnet"
                ? "unmonitored"
                : key === "release"
                  ? "unreleased"
                  : "unavailable",
            latency_ms: null,
          },
          null
        );
      }

      if (checked) {
        checked.textContent =
          "Unable to verify";
      }

      console.error(
        "N3XI0M service status refresh failed:",
        error
      );
    }
  }

  function start() {
    refresh();

    window.setInterval(
      refresh,
      REFRESH_MS
    );
  }

  if (document.readyState === "loading") {
    document.addEventListener(
      "DOMContentLoaded",
      start
    );
  } else {
    start();
  }
})();

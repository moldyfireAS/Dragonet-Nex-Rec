(() => {
  "use strict";

  const HEALTH_URL = "/health";
  const REFRESH_MS = 60_000;
  const CACHE_TTL_MS = 30_000;
  const CACHE_KEY = "n3xi0m-health-status";

  const VALID_STATES = new Set([
    "operational",
    "degraded",
    "maintenance",
    "unavailable",
  ]);

  function normalizeState(data) {
    const siteMode = String(data?.site_mode || "").toLowerCase();
    const trafficMode = String(data?.traffic_mode || "").toLowerCase();
    const status = String(data?.status || "").toLowerCase();

    if (siteMode === "maintenance") {
      return "maintenance";
    }

    if (
      trafficMode === "restricted" ||
      trafficMode === "emergency"
    ) {
      return "degraded";
    }

    if (
      status === "ok" ||
      status === "healthy" ||
      status === "operational"
    ) {
      return "operational";
    }

    if (status) {
      return "degraded";
    }

    return "unavailable";
  }

  function stateLabel(state) {
    switch (state) {
      case "operational":
        return "Operational";
      case "degraded":
        return "Degraded";
      case "maintenance":
        return "Maintenance";
      default:
        return "Unavailable";
    }
  }

  function getBadge() {
    return document.querySelector("[data-live-status]");
  }

  function render(state) {
    const badge = getBadge();

    if (!badge) {
      return;
    }

    if (!VALID_STATES.has(state)) {
      state = "unavailable";
    }

    badge.dataset.state = state;

    const text = badge.querySelector("[data-live-status-text]");

    if (text) {
      text.textContent = stateLabel(state);
    }

    badge.setAttribute(
      "aria-label",
      `N3XI0M service status: ${stateLabel(state)}`
    );
  }

  function readCache() {
    try {
      const raw = sessionStorage.getItem(CACHE_KEY);

      if (!raw) {
        return null;
      }

      const cached = JSON.parse(raw);

      if (
        !cached ||
        typeof cached.savedAt !== "number" ||
        !VALID_STATES.has(cached.state)
      ) {
        return null;
      }

      if (Date.now() - cached.savedAt > CACHE_TTL_MS) {
        return null;
      }

      return cached.state;
    } catch (_) {
      return null;
    }
  }

  function writeCache(state) {
    try {
      sessionStorage.setItem(
        CACHE_KEY,
        JSON.stringify({
          state,
          savedAt: Date.now(),
        })
      );
    } catch (_) {
      // Status still works when sessionStorage is unavailable.
    }
  }

  async function refreshStatus() {
    try {
      const response = await fetch(
        `${HEALTH_URL}?cb=${Date.now()}`,
        {
          method: "GET",
          cache: "no-store",
          headers: {
            Accept: "application/json",
          },
        }
      );

      if (!response.ok) {
        render("unavailable");
        return;
      }

      const data = await response.json();
      const state = normalizeState(data);

      render(state);
      writeCache(state);
    } catch (_) {
      render("unavailable");
    }
  }

  function start() {
    const badge = getBadge();

    if (!badge) {
      return;
    }

    const cached = readCache();

    if (cached) {
      render(cached);
    }

    refreshStatus();

    window.setInterval(refreshStatus, REFRESH_MS);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
  } else {
    start();
  }
})();

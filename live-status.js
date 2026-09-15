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

  function incidentMessage(state) {
    switch (state) {
      case "degraded":
        return {
          title: "Service degradation detected",
          text: "Some N3XI0M services may be slower or temporarily unavailable.",
        };

      case "maintenance":
        return {
          title: "Maintenance in progress",
          text: "N3XI0M is currently undergoing maintenance. Some features may be unavailable.",
        };

      case "unavailable":
        return {
          title: "Service interruption",
          text: "N3XI0M is currently unable to confirm normal service availability.",
        };

      default:
        return null;
    }
  }

  function getBadge() {
    return document.querySelector("[data-live-status]");
  }

  function createIncidentBanner() {
    let banner = document.querySelector("[data-incident-banner]");

    if (banner) {
      return banner;
    }

    banner = document.createElement("aside");
    banner.className = "site-incident-banner";
    banner.hidden = true;
    banner.dataset.incidentBanner = "";
    banner.setAttribute("role", "status");
    banner.setAttribute("aria-live", "polite");

    banner.innerHTML = `
      <div class="site-incident-banner__inner">
        <div class="site-incident-banner__content">
          <span
            class="site-incident-banner__indicator"
            aria-hidden="true"
          ></span>

          <div>
            <strong data-incident-title></strong>
            <span data-incident-text></span>
          </div>
        </div>

        <a
          class="site-incident-banner__link"
          href="/status.html"
        >
          View status
        </a>
      </div>
    `;

    const header = document.querySelector("header");

    if (header?.nextSibling) {
      header.parentNode.insertBefore(
        banner,
        header.nextSibling
      );
    } else if (header?.parentNode) {
      header.parentNode.appendChild(banner);
    } else {
      document.body.prepend(banner);
    }

    return banner;
  }

  function renderIncident(state) {
    const banner = createIncidentBanner();

    if (state === "operational") {
      banner.hidden = true;
      banner.removeAttribute("data-state");
      return;
    }

    const message = incidentMessage(state);

    if (!message) {
      banner.hidden = true;
      return;
    }

    const title = banner.querySelector("[data-incident-title]");
    const text = banner.querySelector("[data-incident-text]");

    if (title) {
      title.textContent = message.title;
    }

    if (text) {
      text.textContent = message.text;
    }

    banner.dataset.state = state;
    banner.hidden = false;
  }

  function render(state) {
    const badge = getBadge();

    if (!VALID_STATES.has(state)) {
      state = "unavailable";
    }

    if (badge) {
      badge.dataset.state = state;

      const text = badge.querySelector(
        "[data-live-status-text]"
      );

      if (text) {
        text.textContent = stateLabel(state);
      }

      badge.setAttribute(
        "aria-label",
        `N3XI0M service status: ${stateLabel(state)}`
      );
    }

    renderIncident(state);
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
    const cached = readCache();

    if (cached) {
      render(cached);
    }

    refreshStatus();

    window.setInterval(refreshStatus, REFRESH_MS);
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

(() => {
  "use strict";

  const HEALTH_URL = "/health";
  const INCIDENT_URL = "/incident.json";

  const REFRESH_MS = 60_000;
  const CACHE_TTL_MS = 30_000;
  const CACHE_KEY = "n3xi0m-health-status";

  const VALID_STATES = new Set([
    "operational",
    "degraded",
    "maintenance",
    "unavailable",
  ]);

  const VALID_INCIDENT_SEVERITIES = new Set([
    "info",
    "degraded",
    "maintenance",
    "critical",
  ]);

  function normalizeState(data) {
    const siteMode = String(
      data?.site_mode || ""
    ).toLowerCase();

    const trafficMode = String(
      data?.traffic_mode || ""
    ).toLowerCase();

    const status = String(
      data?.status || ""
    ).toLowerCase();

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

  function automaticIncident(state) {
    switch (state) {
      case "degraded":
        return {
          severity: "degraded",
          title: "Service degradation detected",
          message:
            "Some N3XI0M services may be slower or temporarily unavailable.",
          link: "/status.html",
        };

      case "maintenance":
        return {
          severity: "maintenance",
          title: "Maintenance in progress",
          message:
            "N3XI0M is currently undergoing maintenance. Some features may be unavailable.",
          link: "/status.html",
        };

      case "unavailable":
        return {
          severity: "critical",
          title: "Service interruption",
          message:
            "N3XI0M is currently unable to confirm normal service availability.",
          link: "/status.html",
        };

      default:
        return null;
    }
  }

  function parseDate(value) {
    if (!value) {
      return null;
    }

    const time = Date.parse(value);

    return Number.isFinite(time)
      ? time
      : null;
  }

  function normalizeManualIncident(data) {
    if (!data || data.active !== true) {
      return null;
    }

    const severity = String(
      data.severity || ""
    ).toLowerCase();

    if (!VALID_INCIDENT_SEVERITIES.has(severity)) {
      return null;
    }

    const title = String(
      data.title || ""
    ).trim();

    const message = String(
      data.message || ""
    ).trim();

    if (!title || !message) {
      return null;
    }

    const now = Date.now();
    const startsAt = parseDate(data.starts_at);
    const expiresAt = parseDate(data.expires_at);

    if (
      startsAt !== null &&
      now < startsAt
    ) {
      return null;
    }

    if (
      expiresAt !== null &&
      now >= expiresAt
    ) {
      return null;
    }

    return {
      severity,
      title,
      message,
      link:
        typeof data.link === "string" &&
        data.link.trim()
          ? data.link.trim()
          : "/status.html",
    };
  }

  function getBadge() {
    return document.querySelector(
      "[data-live-status]"
    );
  }

  function createIncidentBanner() {
    let banner = document.querySelector(
      "[data-incident-banner]"
    );

    if (banner) {
      return banner;
    }

    banner = document.createElement("aside");

    banner.className =
      "site-incident-banner";

    banner.hidden = true;

    banner.dataset.incidentBanner = "";

    banner.setAttribute(
      "role",
      "status"
    );

    banner.setAttribute(
      "aria-live",
      "polite"
    );

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
          data-incident-link
          href="/status.html"
        >
          View status
        </a>
      </div>
    `;

    const header =
      document.querySelector("header");

    if (header?.nextSibling) {
      header.parentNode.insertBefore(
        banner,
        header.nextSibling
      );
    } else if (header?.parentNode) {
      header.parentNode.appendChild(
        banner
      );
    } else {
      document.body.prepend(banner);
    }

    return banner;
  }

  function hideIncident() {
    const banner =
      createIncidentBanner();

    banner.hidden = true;

    banner.removeAttribute(
      "data-state"
    );

    banner.removeAttribute(
      "data-source"
    );
  }

  function showIncident(
    incident,
    source = "automatic"
  ) {
    const banner =
      createIncidentBanner();

    const title =
      banner.querySelector(
        "[data-incident-title]"
      );

    const text =
      banner.querySelector(
        "[data-incident-text]"
      );

    const link =
      banner.querySelector(
        "[data-incident-link]"
      );

    if (title) {
      title.textContent =
        incident.title;
    }

    if (text) {
      text.textContent =
        incident.message;
    }

    if (link) {
      link.href =
        incident.link ||
        "/status.html";

      link.textContent =
        source === "manual"
          ? "More information"
          : "View status";
    }

    banner.dataset.state =
      incident.severity;

    banner.dataset.source =
      source;

    banner.hidden = false;
  }

  function renderBadge(state) {
    const badge = getBadge();

    if (!badge) {
      return;
    }

    if (!VALID_STATES.has(state)) {
      state = "unavailable";
    }

    badge.dataset.state = state;

    const text =
      badge.querySelector(
        "[data-live-status-text]"
      );

    if (text) {
      text.textContent =
        stateLabel(state);
    }

    badge.setAttribute(
      "aria-label",
      `N3XI0M service status: ${stateLabel(state)}`
    );
  }

  function render(
    healthState,
    manualIncident
  ) {
    renderBadge(healthState);

    if (manualIncident) {
      showIncident(
        manualIncident,
        "manual"
      );

      return;
    }

    const automatic =
      automaticIncident(
        healthState
      );

    if (automatic) {
      showIncident(
        automatic,
        "automatic"
      );

      return;
    }

    hideIncident();
  }

  function readCache() {
    try {
      const raw =
        sessionStorage.getItem(
          CACHE_KEY
        );

      if (!raw) {
        return null;
      }

      const cached =
        JSON.parse(raw);

      if (
        !cached ||
        typeof cached.savedAt !==
          "number" ||
        !VALID_STATES.has(
          cached.state
        )
      ) {
        return null;
      }

      if (
        Date.now() -
          cached.savedAt >
        CACHE_TTL_MS
      ) {
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
      // Health display still works without sessionStorage.
    }
  }

  async function fetchHealth() {
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
      throw new Error(
        `Health request returned ${response.status}`
      );
    }

    return response.json();
  }

  async function fetchIncident() {
    try {
      const response = await fetch(
        `${INCIDENT_URL}?cb=${Date.now()}`,
        {
          method: "GET",
          cache: "no-store",
          headers: {
            Accept: "application/json",
          },
        }
      );

      if (!response.ok) {
        return null;
      }

      const data =
        await response.json();

      return normalizeManualIncident(
        data
      );
    } catch (_) {
      return null;
    }
  }

  async function refreshStatus() {
    const incidentPromise =
      fetchIncident();

    let healthState =
      "unavailable";

    try {
      const health =
        await fetchHealth();

      healthState =
        normalizeState(health);

      writeCache(
        healthState
      );
    } catch (_) {
      healthState =
        "unavailable";
    }

    const manualIncident =
      await incidentPromise;

    render(
      healthState,
      manualIncident
    );
  }

  function start() {
    const cached =
      readCache();

    if (cached) {
      renderBadge(cached);
    }

    refreshStatus();

    window.setInterval(
      refreshStatus,
      REFRESH_MS
    );
  }

  if (
    document.readyState ===
    "loading"
  ) {
    document.addEventListener(
      "DOMContentLoaded",
      start
    );
  } else {
    start();
  }
})();

const INVITE_CODE = "9bFfM7Ppsz";
const DISCORD_TIMEOUT_MS = 5000;

function json(data, init = {}) {
  const headers = new Headers(init.headers || {});
  headers.set("Content-Type", "application/json; charset=utf-8");
  headers.set("Cache-Control", "public, max-age=60, stale-while-revalidate=300");

  return new Response(JSON.stringify(data), {
    ...init,
    headers,
  });
}

export async function onRequest() {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DISCORD_TIMEOUT_MS);

  try {
    const res = await fetch(
      `https://discord.com/api/v10/invites/${INVITE_CODE}?with_counts=true`,
      {
        headers: {
          Accept: "application/json",
        },
        signal: controller.signal,
      }
    );

    if (!res.ok) {
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
      data = await res.json();
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

    return json({
      total_members: total,
      online_members: online,
    });
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

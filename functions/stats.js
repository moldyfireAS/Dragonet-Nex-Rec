export async function onRequest() {
  const INVITE_CODE = "9bFfM7Ppsz";

  const res = await fetch(
    `https://discord.com/api/v10/invites/${INVITE_CODE}?with_counts=true`
  );
  const data = await res.json();

  return new Response(JSON.stringify({
    total_members: data.approximate_member_count,
    online_members: data.approximate_presence_count
  }), {
    headers: { "Content-Type": "application/json" }
  });
}

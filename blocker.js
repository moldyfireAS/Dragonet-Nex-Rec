window.addEventListener("DOMContentLoaded", () => {
    const path = window.location.pathname;

    // Allow homepage
    if (path === "/") return;

    // Allow any HTML page with .html
    if (path.endsWith(".html")) return;
    if (path.endsWith(".htm")) return;
    // Allow extensionless pages (Cloudflare Pages routing)
    // Example: /about, /contact, /info
    if (!path.includes(".")) return;

    // Allow CSS
    if (path.endsWith(".css")) return;

    // Block everything else
    window.location.href = "/403.html";
});

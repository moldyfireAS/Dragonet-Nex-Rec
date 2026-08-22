window.addEventListener("DOMContentLoaded", () => {
    const path = window.location.pathname.toLowerCase();

    // SPECIAL EXCEPTION: always allow rec.net.html
    if (path.endsWith("rec.net.html")) return;

    // Allow homepage
    if (path === "/") return;

    // Allow ANY HTML page (even with dots)
    if (path.endsWith(".html")) return;

    // Allow extensionless pages (Cloudflare Pages routing)
    // Example: /about, /contact, /info
    if (!path.includes(".")) return;

    // Allow CSS
    if (path.endsWith(".css")) return;

    // BLOCK ALL ASSETS (png, jpg, js, json, mp4, etc.)
    // Even if Cloudflare hides the extension
    if (path.includes("/assets/")) {
        window.location.href = "/403.html";
        return;
    }

    // Block everything else
    window.location.href = "/403.html";
});

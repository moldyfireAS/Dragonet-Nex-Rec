window.addEventListener("DOMContentLoaded", () => {
    const path = window.location.pathname.toLowerCase();

    if (path.endsWith("rec.net.html")) return;

    if (path === "/") return;

    if (path.endsWith(".html")) return;

    if (!path.includes(".")) return;

        if (!path.includes(".htm")) return;

    if (path.endsWith(".css")) return;
    window.location.href = "/403.html";
});

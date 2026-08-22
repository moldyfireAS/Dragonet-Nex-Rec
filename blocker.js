// Run as soon as the page finishes loading
window.addEventListener("DOMContentLoaded", () => {
    const path = window.location.pathname;

    // Allow homepage (/) and any .html file
    if (path === "/" || path.endsWith(".html")) {
        return; // allowed
    }

    // Allow any .css file
    if (path.endsWith(".css")) {
        return; // allowed
    }

    // Everything else → redirect to 403.html
    window.location.href = "/403.html";
});

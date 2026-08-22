// Get the current URL path
const path = window.location.pathname;

// If the URL does NOT end with .html or .css → redirect to 403
if (
    !path.endsWith(".html") &&
    !path.endsWith(".css")
) {
    window.location.href = "/403.html";
}

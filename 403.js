// Fake 403: redirect ANY direct access to 403.html
if (
    document.referrer === "" ||                     // opened directly
    document.referrer === window.location.href ||   // self-referrer
    !document.referrer.includes(window.location.host) // referrer not from your site
) {
    window.location.href = "/403.html";
}

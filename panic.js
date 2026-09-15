(() => {
  "use strict";

  const EXIT_URL = "https://www.google.com/";

  function panicExit() {
    if (document.documentElement.dataset.panicActive === "true") {
      return;
    }

    document.documentElement.dataset.panicActive = "true";

    document.documentElement.innerHTML = `
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Loading...</title>
        <style>
          html, body {
            margin: 0;
            width: 100%;
            height: 100%;
            background: #fff;
          }
        </style>
      </head>
      <body></body>
    `;

    try {
      history.replaceState(null, "", "/");
    } catch (_) {
      // Continue with the external quick exit.
    }

    window.location.replace(EXIT_URL);
  }

  function createPanicButton() {
    if (document.getElementById("n3xi0m-panic-button")) {
      return;
    }

    const button = document.createElement("button");

    button.id = "n3xi0m-panic-button";
    button.className = "panic-button";
    button.type = "button";
    button.textContent = "PANIC";
    button.setAttribute(
      "aria-label",
      "Quickly leave the N3XI0M website"
    );
    button.setAttribute(
      "title",
      "Quick Exit"
    );

    button.addEventListener("click", panicExit);

    document.body.appendChild(button);
  }

  document.addEventListener("keydown", event => {
    if (
      event.altKey &&
      event.shiftKey &&
      event.key.toLowerCase() === "x"
    ) {
      event.preventDefault();
      panicExit();
    }
  });

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", createPanicButton);
  } else {
    createPanicButton();
  }
})();

"use strict";

/**
 * @type {HTMLFormElement}
 */
const form = document.getElementById("uv-form");
/**
 * @type {HTMLInputElement}
 */
const address = document.getElementById("uv-address");
/**
 * @type {HTMLInputElement}
 */
const searchEngine = document.getElementById("uv-search-engine");
/**
 * @type {HTMLParagraphElement}
 */
const error = document.getElementById("uv-error");
/**
 * @type {HTMLPreElement}
 */
const errorCode = document.getElementById("uv-error-code");
const connection = new BareMux.BareMuxConnection("/baremux/worker.js");

function getParameterByName(name, url = window.location.href) {
    name = name.replace(/[\[\]]/g, '\\$&');
    var regex = new RegExp('[?&]' + name + '(=([^&#]*)|&|#|$)'),
        results = regex.exec(url);
    if (!results) return null;
    if (!results[2]) return '';
    return decodeURIComponent(results[2].replace(/\+/g, ' '));
}

async function loadInitialURL() {
    try {
        await registerSW();
    } catch (err) {
        error.textContent = "Failed to register service worker.";
        errorCode.textContent = err.toString();
        throw err;
    }

    let frame = document.getElementById("uv-frame");

    let wispUrl = (location.protocol === "https:" ? "wss" : "ws") + "://" + location.host + "/wisp/";
    if (await connection.getTransport() !== "/epoxy/index.mjs") {
        await connection.setTransport("/epoxy/index.mjs", [{ wisp: wispUrl }]);
    }

    const initialURLParam = getParameterByName("url") || getParameterByName("test");

    if (initialURLParam) {
        const encodedURL = __uv$config.encodeUrl(initialURLParam);
        frame.src = __uv$config.prefix + encodedURL;
        frame.style.display = "block"; // Make iframe visible
    } else {
        frame.src = ""; // Leave the iframe empty
        frame.style.display = "none"; // Keep the iframe hidden
    }

    form.style.display = "none";
    address.style.display = "none";
    searchEngine.style.display = "none";
}

loadInitialURL();

form.addEventListener("submit", async (event) => {
    event.preventDefault();

    try {
        await registerSW();
    } catch (err) {
        error.textContent = "Failed to register service worker.";
        errorCode.textContent = err.toString();
        throw err;
    }

    const enteredURL = address.value;
    const encodedURL = __uv$config.encodeUrl(enteredURL);

    let frame = document.getElementById("uv-frame");
    let wispUrl = (location.protocol === "https:" ? "wss" : "ws") + "://" + location.host + "/wisp/";
    if (await connection.getTransport() !== "/epoxy/index.mjs") {
        await connection.setTransport("/epoxy/index.mjs", [{ wisp: wispUrl }]);
    }
    frame.src = __uv$config.prefix + encodedURL;
    frame.style.display = "block"; // Make iframe visible (if it wasn't already)


    window.history.pushState({}, "", "?url=" + enteredURL);
});
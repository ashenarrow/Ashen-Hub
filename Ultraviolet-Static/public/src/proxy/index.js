const http = require("http");
const fetch = require("node-fetch");
const { URL } = require("url");
const PORT = 8080;

let targetWebsite = "https://easyfun.gg";

const server = http.createServer(async (req, res) => {
  try {
    console.log(`Request received: ${req.url}`);

    if (req.url === "/") {
      res.writeHead(200, { "Content-Type": "text/html" });
      return res.end(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Website Proxy</title>
          <style>
            body {
              font-family: sans-serif;
              background-color: #222;
              color: #eee;
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              min-height: 100vh;
              margin: 0;
              background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100%25' height='100%25'%3E%3Cdefs%3E%3ClinearGradient id='gradient0' x1='0%25' y1='0%25' x2='0%25' y2='100%25'%3E%3Cstop offset='0%25' stop-color='%23FF8C00'/%3E%3Cstop offset='100%25' stop-color='%23FF2800'/%3E%3C/linearGradient%3E%3C/defs%3E%3Crect fill='url(%23gradient0)' height='100%25' width='100%25' fill-opacity='0.1'/%3E%3C/svg%3E");
            }
            h1 {
              color: #ffcc00;
              margin-bottom: 20px;
            }
            form {
              display: flex;
              gap: 10px;
            }
            input[type="text"] {
              padding: 10px;
              border: 1px solid #666;
              background-color: #333;
              color: #eee;
              border-radius: 5px;
              width: 300px;
            }
            button {
              padding: 10px 20px;
              background-color: #ff6600;
              color: #eee;
              border: none;
              border-radius: 5px;
              cursor: pointer;
              transition: background-color 0.3s;
            }
            button:hover {
              background-color: #ff9933;
            }
          </style>
        </head>
        <body>
          <h1>Website Proxy</h1>
          <form id="targetForm">
            <input type="text" id="targetUrl" value="${targetWebsite}">
            <button type="submit">Go</button>
          </form>

          <script>
            const form = document.getElementById('targetForm');
            form.addEventListener('submit', (event) => {
              event.preventDefault();
              const newTarget = document.getElementById('targetUrl').value;
              window.location.href = "/?target=" + encodeURIComponent(newTarget);
            });
          </script>
        </body>
        </html>
      `);
    }

    const url = new URL(req.url, `http://${req.headers.host}`);
    if (url.searchParams.has("target")) {
      targetWebsite = url.searchParams.get("target");
      console.log("Target website changed to:", targetWebsite);
    }

    let targetPath = req.url;
    if (req.url.includes("target=")) {
      targetPath = req.url.split("&target=")[0];
    }
    let targetUrl = new URL(targetPath, targetWebsite).href;

    const targetOrigin = new URL(targetWebsite).origin;

    console.log(`Target URL: ${targetUrl}`);

    let response = await fetch(targetUrl, { redirect: "manual" });
    let redirectCount = 0;

    while (response.status >= 300 && response.status < 400) {
      const redirectUrl = response.headers.get("location");

      if (!redirectUrl) {
        throw new Error(
          `Redirect without location header: ${response.status} for ${targetUrl}`
        );
      }

      targetUrl = new URL(redirectUrl, targetOrigin).href;
      console.log(`Redirected URL: ${targetUrl}`);
      response = await fetch(targetUrl, { redirect: "manual" });
      redirectCount++;
    }

    if (!response.ok) {
      console.error(`Error fetching ${targetUrl}: ${response.status}`);

      if (response.status === 404) {
        res.writeHead(404, { "Content-Type": "text/plain" });
        return res.end("Not Found");
      } else {
        res.writeHead(response.status, { "Content-Type": "text/plain" });
        return res.end(
          `Proxy Error: ${response.status} - ${response.statusText}`
        );
      }
    }

    const contentType = response.headers.get("content-type");

    if (contentType && contentType.includes("text/html")) {
      let data = await response.text();

      data = data.replace(/<head>/i, `<head><base href="${targetOrigin}/">`);

      const urlRegex = /(href|src|srcset|action)="(.*?)"/gi;

      data = data.replace(urlRegex, (match, p1, p2) => {
        try {
          let absoluteUrl;

          if (p2.startsWith("//")) {
            absoluteUrl = new URL(p2, window.location.protocol + targetOrigin)
              .href;
          } else if (p2.startsWith("http")) {
            absoluteUrl = p2;
          } else {
            absoluteUrl = new URL(p2, targetOrigin).href;
          }

          console.log(`Rewriting ${p2} to ${absoluteUrl}`);

          return `${p1}="${absoluteUrl}"`;
        } catch (urlError) {
          console.error("Error rewriting URL:", p2, urlError);
          return match;
        }
      });

      const formRegex = /<form(.*?)action="(.*?)"(.*?)>/gi;

      data = data.replace(formRegex, (match, p1, p2, p3) => {
        try {
          const absoluteAction = new URL(p2, targetOrigin).href;

          console.log(`Rewriting form action ${p2} to ${absoluteAction}`);

          return `<form${p1}action="${absoluteAction}"${p3}>`;
        } catch (formError) {
          console.error("Error rewriting form action:", p2, formError);
          return match;
        }
      });

      res.writeHead(200, { "Content-Type": contentType });
      res.end(data);
    } else {
      const buffer = await response.buffer();
      res.writeHead(200, { "Content-Type": contentType });
      res.end(buffer);
    }
  } catch (error) {
    console.error("Proxy error:", error);
    res.writeHead(500, { "Content-Type": "text/plain" });
    res.end("Proxy error");
  }
});

server.listen(PORT, () => {
  console.log(`Proxy server listening on port ${PORT}`);
});

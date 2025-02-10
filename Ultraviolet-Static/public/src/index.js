const http = require("http");
const fs = require("fs");
const path = require("path");

const hostname = "127.0.0.1";
const port = 8080;

const server = http.createServer((req, res) => {
  let filePath = path.join(__dirname, req.url === "/" ? "games.html" : req.url);

  // Handle requests for just the directory (e.g., http://localhost:8080/)
  if (req.url === "/") {
    filePath = path.join(__dirname, "games.html"); // Explicitly set to index.html
  }

  const extname = path.extname(filePath);
  const contentType =
    {
      ".html": "text/html",
      ".js": "text/javascript",
      ".css": "text/css",
    }[extname] || "text/plain";

  fs.readFile(filePath, (err, content) => {
    if (err) {
      if (err.code === "ENOENT") {
        res.writeHead(404);
        res.end("<h1>404: File Not Found</h1>");
      } else {
        res.writeHead(500);
        res.end("<h1>500: Internal Server Error</h1>");
        console.error(err);
      }
    } else {
      res.writeHead(200, { "Content-Type": contentType });
      res.end(content);
    }
  });
});

server.listen(port, hostname, () => {
  console.log(`Server running at http://${hostname}:${port}/`);
});

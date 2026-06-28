// Tiny web server so you can play Pixel Obby on your phone.
// Run with: node server.js   (or double-click play-on-phone.bat)
"use strict";

const http = require("http");
const fs = require("fs");
const path = require("path");
const os = require("os");

const ROOT = __dirname;
const PORT = 8000;

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".png": "image/png",
  ".webmanifest": "application/manifest+json",
  ".json": "application/json",
  ".md": "text/plain; charset=utf-8",
};

const server = http.createServer((req, res) => {
  let urlPath;
  try {
    urlPath = decodeURIComponent(req.url.split("?")[0]);
  } catch (e) {
    res.writeHead(400); res.end("Bad request"); return;
  }
  if (urlPath === "/") urlPath = "/index.html";

  const file = path.normalize(path.join(ROOT, urlPath));
  if (!file.startsWith(ROOT)) { res.writeHead(403); res.end("Forbidden"); return; }

  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); res.end("Not found"); return; }
    res.writeHead(200, { "Content-Type": MIME[path.extname(file).toLowerCase()] || "application/octet-stream" });
    res.end(data);
  });
});

server.listen(PORT, "0.0.0.0", () => {
  console.log("");
  console.log("  PIXEL OBBY is running!");
  console.log("");
  console.log("  On this computer:  http://localhost:" + PORT);
  console.log("");
  console.log("  On your phone (must be on the same Wi-Fi), open:");
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === "IPv4" && !net.internal) {
        console.log("    http://" + net.address + ":" + PORT);
      }
    }
  }
  console.log("");
  console.log("  Keep this window open while playing. Press Ctrl+C to stop.");
});

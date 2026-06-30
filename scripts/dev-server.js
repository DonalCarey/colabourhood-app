const fs = require("fs");
const http = require("http");
const path = require("path");

const root = path.resolve(__dirname, "..");
const port = Number(process.env.PORT || 4173);

const contentTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
};

const server = http.createServer((request, response) => {
  const requestUrl = new URL(request.url, `http://${request.headers.host}`);
  const pathname = requestUrl.pathname === "/" ? "/index.html" : decodeURIComponent(requestUrl.pathname);
  const filePath = path.resolve(root, `.${pathname}`);

  if (!filePath.startsWith(root)) {
    response.writeHead(403);
    response.end("Forbidden");
    return;
  }

  fs.stat(filePath, (statError, stat) => {
    const resolvedFilePath = !statError && stat.isDirectory() ? path.join(filePath, "index.html") : filePath;

    fs.stat(resolvedFilePath, (resolvedStatError, resolvedStat) => {
      if (resolvedStatError || !resolvedStat.isFile()) {
      response.writeHead(404);
      response.end("Not found");
      return;
      }

      response.writeHead(200, {
        "Content-Type": contentTypes[path.extname(resolvedFilePath)] || "application/octet-stream",
      });
      fs.createReadStream(resolvedFilePath).pipe(response);
    });
  });
});

server.listen(port, "127.0.0.1", () => {
  console.log(`Colabourhood dev server running at http://127.0.0.1:${port}`);
});

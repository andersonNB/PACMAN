import { createServer } from "node:http";
import { createReadStream, existsSync } from "node:fs";
import { stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");
const port = 4173;

const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".map": "application/json; charset=utf-8"
};

const server = createServer(async (request, response) => {
  const requestUrl = new URL(request.url ?? "/", `http://${request.headers.host ?? "127.0.0.1"}`);
  const pathname = requestUrl.pathname === "/" ? "/browser-demo.html" : requestUrl.pathname;
  const safePath = path.normalize(path.join(rootDir, pathname));

  if (!safePath.startsWith(rootDir)) {
    response.writeHead(403, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Forbidden");
    return;
  }

  if (!existsSync(safePath)) {
    response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Not found");
    return;
  }

  const fileStats = await stat(safePath);

  if (fileStats.isDirectory()) {
    response.writeHead(403, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Directory listing is disabled");
    return;
  }

  const extension = path.extname(safePath);
  response.writeHead(200, {
    "Content-Type": contentTypes[extension] ?? "application/octet-stream"
  });

  createReadStream(safePath).pipe(response);
});

server.listen(port, "127.0.0.1", () => {
  console.log(`Browser demo available at http://127.0.0.1:${port}`);
});

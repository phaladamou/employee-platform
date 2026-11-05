import { createServer, type IncomingMessage, type Server } from "node:http";

import {
  createEmployeeHandler,
  type EmployeeHttpRequest,
  type EmployeeServerDeps,
} from "./employee-server";

const MAX_BODY_BYTES = 1_000_000;

function readBodyText(
  req: IncomingMessage
): Promise<{ ok: true; text: string } | { ok: false }> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    let tooLarge = false;

    req.on("data", (chunk: Buffer) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        // Draine sans stocker : la 413 part sur une connexion propre
        // (un destroy brutal ferait echouer le client en ECONNRESET).
        tooLarge = true;
        return;
      }
      if (!tooLarge) {
        chunks.push(chunk);
      }
    });
    req.on("end", () =>
      resolve(
        tooLarge
          ? { ok: false }
          : { ok: true, text: Buffer.concat(chunks).toString("utf8") }
      )
    );
    req.on("error", reject);
  });
}

export interface ServeEmployeeApiOptions {
  readonly port?: number;
  readonly host?: string;
}

/**
 * Adaptateur node:http : expose le handler pur sur une socket locale.
 * Corps limites a 1 Mo (413 au-dela), SSE en streaming chunked.
 */
export async function serveEmployeeApi(
  deps: EmployeeServerDeps,
  options: ServeEmployeeApiOptions = {}
): Promise<{ url: string; close(): Promise<void> }> {
  const handle = createEmployeeHandler(deps);

  const server: Server = createServer((req, res) => {
    void (async () => {
      try {
        const fullUrl = new URL(
          req.url ?? "/",
          `http://${req.headers.host ?? "localhost"}`
        );
        const body = await readBodyText(req);
        if (!body.ok) {
          res.writeHead(413, { "content-type": "application/json" });
          res.end(
            JSON.stringify({ error: "too_large", message: "Body too large" })
          );
          return;
        }

        const headers: Record<string, string | undefined> = {};
        for (const [key, value] of Object.entries(req.headers)) {
          headers[key.toLowerCase()] = Array.isArray(value)
            ? value.join(", ")
            : value;
        }

        const request: EmployeeHttpRequest = {
          method: req.method ?? "GET",
          pathname: fullUrl.pathname,
          searchParams: fullUrl.searchParams,
          headers,
          bodyText: body.text,
        };

        const response = await handle(request);

        if ("stream" in response) {
          res.writeHead(response.status, {
            "content-type": "text/event-stream",
            "cache-control": "no-cache",
            connection: "keep-alive",
          });
          try {
            for await (const chunk of response.stream) {
              if (res.destroyed) {
                break;
              }
              res.write(chunk);
            }
          } catch {
            // Client parti : fin silencieuse du flux.
          }
          res.end();
          return;
        }

        res.writeHead(response.status, { "content-type": "application/json" });
        res.end(response.body);
      } catch {
        if (!res.headersSent) {
          res.writeHead(500, { "content-type": "application/json" });
        }
        res.end(
          JSON.stringify({ error: "internal", message: "Internal error" })
        );
      }
    })();
  });

  const host = options.host ?? "127.0.0.1";
  const port = options.port ?? 0;

  await new Promise<void>((resolve) => {
    server.listen(port, host, resolve);
  });

  const address = server.address();
  const boundPort =
    typeof address === "object" && address ? address.port : port;

  return {
    url: `http://${host}:${boundPort}`,
    close: () =>
      new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      }),
  };
}

import path from "path";
import fs from "fs";
import os from "os";
import { logEvent } from "./logger.js";
import config from "./config.js";
import basicAuth from "express-basic-auth";
import crypto from "crypto";

export async function startHealthServer(
  client,
  port = process.env.HEALTH_PORT || config.HEALTH_PORT || 3000
) {
  // Try to load Express; if missing, instruct the user
  let express;
  try {
    express = (await import("express")).default;
  } catch (e) {
    logEvent(
      "ERROR",
      `Express not installed. Health server requires express. Install with: npm i express`
    );
    throw new Error(
      "Express not installed. Run: npm i express, also keep in mind you need express-basic-auth"
    );
  }

  const app = express();
  const LOG_DIR = path.join(process.cwd(), "logs");
  const ARCHIVE_DIR = path.join(LOG_DIR, "archive");

  // Helper to escape HTML for safe display
  function escapeHtml(str) {
    if (typeof str !== "string") return "";
    return str.replace(
      /[&<>"']/g,
      (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
    );
  }

  const USERNAME = "admin";
  const PASSWORD = process.env.EXPRESS_SERVER_ADMINPASSWORD || "453278_changeme_093578";
  const BLOCK_AFTER = 5;
  const failedAttempts = {};
  // Helper to parse Basic Auth header
  function parseBasicAuth(header) {
    if (!header || !header.startsWith("Basic ")) return null;
    const base64Credentials = header.slice(6);
    const credentials = Buffer.from(base64Credentials, "base64").toString("utf8");
    const [user, pass] = credentials.split(":", 2);
    return { user, pass };
  }
  // Middleware to get client IP
  app.use((req, res, next) => {
    req._clientIp = req.headers["x-forwarded-for"] || req.socket.remoteAddress || "unknown";
    next();
  });
  // Middleware to block clients after too many failed attempts
  app.use((req, res, next) => {
    const ip = req._clientIp;
    if ((failedAttempts[ip] || 0) >= BLOCK_AFTER) {
      logEvent("IP_BLOCKED", `ip= ${ip} path=${req.originalUrl}`);
      return res.destroy();
    }
    next();
  });
  // Basic Auth Middleware
  app.use((req, res, next) => {
    const ip = req._clientIp;
    const auth = parseBasicAuth(req.headers.authorization);
    if (auth && auth.user === USERNAME && auth.pass === PASSWORD) {
      // Success: reset failed attempts
      failedAttempts[ip] = 0;
      logEvent("AUTH_SUCCESS", `user=${auth.user} ip=${ip}`);
      return next();
    }
    // Failure
    failedAttempts[ip] = (failedAttempts[ip] || 0) + 1;
    logEvent(
      "AUTH_FAILURE",
      `user=${auth?.user || "none"} ip=${ip} failures=${failedAttempts[ip]}`
    );
    // Respond with 401 + standard Basic Auth challenge
    res.set("WWW-Authenticate", 'Basic realm="Private Page, Authorized Users Only"');
    return res
      .status(401)
      .send(
        "This system is for authorized users only. All access and activity is logged and monitored."
      );
  });

  app.get("/", (req, res) => {
    try {
      res.setHeader("Content-Type", "text/html");
      const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>johnbot — Admin</title>
    <meta name="viewport" content="width=device-width, initial-scale=1" />

    <style>
      body {
        font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI",
          Roboto, sans-serif;
        background: #0f1115;
        color: #e6e6e6;
        margin: 0;
        padding: 40px;
      }

      .container {
        max-width: 720px;
        margin: 0 auto;
      }

      h1 {
        margin-bottom: 8px;
        font-size: 2rem;
      }

      .notice {
        background: #161a22;
        border-left: 4px solid #3b82f6;
        padding: 16px;
        margin: 24px 0;
        font-size: 0.95rem;
        line-height: 1.5;
      }

      .links {
        margin: 24px 0;
      }

      .links a {
        display: block;
        margin-bottom: 10px;
        color: #93c5fd;
        text-decoration: none;
      }

      .links a:hover {
        text-decoration: underline;
      }

      .hint {
        margin-top: 32px;
        font-size: 0.85rem;
        color: #a1a1aa;
      }
    </style>
  </head>

  <body>
    <div class="container">
      <h1>johnbot</h1>
      <div>Administrative dashboard</div>

      <div class="notice">
        <strong>Authorized Access Only</strong><br />
        This system is intended for authorized users only. All access and activity
        may be logged and monitored.
      </div>

      <div class="links">
        <a href="/health">→ Server health</a>
        <a href="/logs">→ Server logs</a>
      </div>

      <div class="hint">
        Most endpoints return JSON by default.<br />
        Append <code>?format=html</code> to the URL for a readable HTML view.
      </div>
    </div>
  </body>
</html>`;
      logEvent("HEALTH", `Root requested from ${req.ip || req.socket.remoteAddress}`);
      res.send(html);
    } catch (e) {
      logEvent("ERROR", `Root handler failed | ${e.stack}`);
      res.status(500).send("Internal error");
    }
  });

  app.get("/health", (req, res) => {
    try {
      const body = {
        status: "ok",
        uptime: process.uptime(),
        node: process.version,
        platform: os.platform(),
        arch: os.arch(),
        memory: process.memoryUsage(),
        guildCount: client.guilds?.cache?.size ?? 0,
        userCount: client.users?.cache?.size ?? 0,
        timestamp: new Date().toISOString(),
      };
      logEvent("HEALTH", `Health requested from ${req.ip || req.socket.remoteAddress}`);
      return res.json(body);
    } catch (e) {
      logEvent("ERROR", `Health handler failed | ${e.stack}`);
      return res.status(500).json({ error: "Internal error" });
    }
  });

  // List logs. Use ?archive=true to list archived logs from logs/archive
  app.get("/logs", (req, res) => {
    try {
      const listDir = req.query.archive ? ARCHIVE_DIR : LOG_DIR;
      if (!fs.existsSync(listDir)) return res.json({ files: [] });
      const files = fs
        .readdirSync(listDir)
        .filter((f) => !f.startsWith("."))
        .map((f) => {
          const s = fs.statSync(path.join(listDir, f));
          return { name: f, size: s.size, mtime: s.mtime.toISOString() };
        });
      files.sort((a, b) => new Date(b.mtime) - new Date(a.mtime));
      logEvent(
        "HEALTH",
        `Logs list requested (${req.query.archive ? "archive" : "current"}) by ${
          req.ip || req.socket.remoteAddress
        }`
      );

      const wantsHtml = req.query.format === "html";
      if (wantsHtml) {
        res.setHeader("Content-Type", "text/html; charset=utf-8");
        const rows = files
          .map(
            (f) =>
              `<li><a href="/logs/${encodeURIComponent(f.name)}?format=html">${escapeHtml(
                f.name
              )}</a> — ${f.size} bytes — ${escapeHtml(f.mtime)} <a href="/logs/${encodeURIComponent(
                f.name
              )}?download=1">[download]</a></li>`
          )
          .join("");
        const html = `<!doctype html><html><head><meta charset="utf-8"><title>johnbot logs</title><style>body{font-family:system-ui,Segoe UI,Roboto,Helvetica,Arial;background:#f7f7f9;color:#111;padding:18px}pre{background:#0b1020;color:#dcdcdc;padding:12px;border-radius:6px;overflow:auto}table{border-collapse:collapse;width:100%}th,td{border:1px solid #ddd;padding:8px;text-align:left}tr:nth-child(even){background:#fff}tr:nth-child(odd){background:#f6f6f6}a{color:#0066cc}</style></head><body><h1>Logs (${
          req.query.archive ? "archive" : "current"
        })</h1><ul>${rows}</ul><p><a href="/">Home</a></p></body></html>`;
        return res.send(html);
      }

      res.json({ files });
    } catch (e) {
      logEvent("ERROR", `Logs list failed | ${e.stack}`);
      res.status(500).json({ error: "failed to list logs" });
    }
  });

  // View a single log file. ?lines=200 to tail last N lines. ?download=1 to force download
  app.get("/logs/:name", (req, res) => {
    try {
      const name = req.params.name;
      const archive = req.query.archive ? true : false;
      const base = archive ? ARCHIVE_DIR : LOG_DIR;
      const filePath = path.join(base, name);
      // Prevent path traversal
      if (!filePath.startsWith(base)) return res.status(400).send("Invalid filename");
      if (!fs.existsSync(filePath)) return res.status(404).send("Not found");

      const lines = req.query.lines ? parseInt(req.query.lines, 10) : null;
      const download = req.query.download ? true : false;

      if (download) {
        logEvent(
          "HEALTH",
          `Log download requested: ${name} by ${req.ip || req.socket.remoteAddress}`
        );
        return res.download(filePath);
      }

      const content = fs.readFileSync(filePath, "utf8");
      const isJsonl = name.endsWith(".jsonl");
      const wantsHtml = req.query.format === "html";
      if (!lines) {
        logEvent("HEALTH", `Log view requested: ${name} by ${req.ip || req.socket.remoteAddress}`);
        if (wantsHtml) {
          res.setHeader("Content-Type", "text/html; charset=utf-8");
          if (isJsonl) {
            const entries = content
              .split(/\r?\n/)
              .filter(Boolean)
              .map((l) => {
                try {
                  return JSON.parse(l);
                } catch (e) {
                  return { _parse_error: true, raw: l };
                }
              });

            const rows = entries
              .map((e) => {
                const ts = escapeHtml(e.timestamp || "");
                const type = escapeHtml(e.type || "");
                const details = escapeHtml(
                  typeof e.details === "string" ? e.details : JSON.stringify(e.details)
                );
                const extra = escapeHtml(
                  JSON.stringify(
                    Object.fromEntries(
                      Object.entries(e).filter(
                        ([k]) => !["timestamp", "type", "details"].includes(k)
                      )
                    )
                  )
                );
                return `<tr><td style="white-space:nowrap">${ts}</td><td>${type}</td><td style="max-width:60ch"><pre style="white-space:pre-wrap;margin:0">${details}</pre></td><td style="max-width:40ch"><pre style="white-space:pre-wrap;margin:0">${extra}</pre></td></tr>`;
              })
              .join("");

            const html = `<!doctype html><html><head><meta charset="utf-8"><title>Log: ${escapeHtml(
              name
            )}</title><style>body{font-family:system-ui,Segoe UI,Roboto,Helvetica,Arial;background:#f7f7f9;color:#111;padding:18px}table{border-collapse:collapse;width:100%}th,td{border:1px solid #ddd;padding:8px;text-align:left}pre{margin:0}tr:nth-child(even){background:#fff}tr:nth-child(odd){background:#f6f6f6}a{color:#0066cc}</style></head><body><h1>Log: ${escapeHtml(
              name
            )}</h1><p><a href="/logs?format=html">Back to logs</a> · <a href="/logs/${encodeURIComponent(
              name
            )}?download=1">Download</a></p><table><thead><tr><th>ts</th><th>type</th><th>details</th><th>extras</th></tr></thead><tbody>${rows}</tbody></table></body></html>`;
            return res.send(html);
          }

          // text file
          res.setHeader("Content-Type", "text/html; charset=utf-8");
          const html = `<!doctype html><html><head><meta charset="utf-8"><title>Log: ${escapeHtml(
            name
          )}</title><style>body{font-family:system-ui,Segoe UI,Roboto,Helvetica,Arial;background:#f7f7f9;color:#111;padding:18px}pre{background:#0b1020;color:#dcdcdc;padding:12px;border-radius:6px;overflow:auto}</style></head><body><h1>Log: ${escapeHtml(
            name
          )}</h1><p><a href="/logs?format=html">Back to logs</a> · <a href="/logs/${encodeURIComponent(
            name
          )}?download=1">Download</a></p><pre>${escapeHtml(content)}</pre></body></html>`;
          return res.send(html);
        }

        res.setHeader("Content-Type", "application/json; charset=utf-8");
        if (isJsonl) {
          const entries = content
            .split(/\r?\n/)
            .filter(Boolean)
            .map((l) => {
              try {
                return JSON.parse(l);
              } catch (e) {
                return { _parse_error: true, raw: l };
              }
            });
          return res.json({ entries });
        }
        return res.json({ content });
      }

      const arr = content.split(/\r?\n/).filter(Boolean);
      logEvent(
        "HEALTH",
        `Log tail requested: ${name} last=${lines} lines by ${req.ip || req.socket.remoteAddress}`
      );
      if (isJsonl) {
        const parsedTail = arr.slice(-Math.max(0, lines)).map((l) => {
          try {
            return JSON.parse(l);
          } catch (e) {
            return { _parse_error: true, raw: l };
          }
        });
        if (wantsHtml) {
          const rows = parsedTail
            .map(
              (e) =>
                `<tr><td>${escapeHtml(e.timestamp || "")}</td><td>${escapeHtml(
                  e.type || ""
                )}</td><td><pre style="white-space:pre-wrap;margin:0">${escapeHtml(
                  typeof e.details === "string" ? e.details : JSON.stringify(e.details)
                )}</pre></td><td><pre style="white-space:pre-wrap;margin:0">${escapeHtml(
                  JSON.stringify(
                    Object.fromEntries(
                      Object.entries(e).filter(
                        ([k]) => !["timestamp", "type", "details"].includes(k)
                      )
                    )
                  )
                )}</pre></td></tr>`
            )
            .join("");
          const html = `<!doctype html><html><head><meta charset="utf-8"><title>Log tail: ${escapeHtml(
            name
          )}</title><style>body{font-family:system-ui,Segoe UI,Roboto,Helvetica,Arial;background:#f7f7f9;color:#111;padding:18px}table{border-collapse:collapse;width:100%}th,td{border:1px solid #ddd;padding:8px;text-align:left}pre{margin:0}tr:nth-child(even){background:#fff}tr:nth-child(odd){background:#f6f6f6}a{color:#0066cc}</style></head><body><h1>Tail of ${escapeHtml(
            name
          )} (last ${lines} lines)</h1><p><a href="/logs?format=html">Back to logs</a> · <a href="/logs/${encodeURIComponent(
            name
          )}?download=1">Download</a></p><table><thead><tr><th>ts</th><th>type</th><th>details</th><th>extras</th></tr></thead><tbody>${rows}</tbody></table></body></html>`;
          return res.send(html);
        }
        res.setHeader("Content-Type", "application/json; charset=utf-8");
        return res.json({ tail: parsedTail });
      }
      const tail = arr.slice(-Math.max(0, lines));
      if (wantsHtml) {
        res.setHeader("Content-Type", "text/html; charset=utf-8");
        const html = `<!doctype html><html><head><meta charset="utf-8"><title>Tail: ${escapeHtml(
          name
        )}</title><style>body{font-family:system-ui,Segoe UI,Roboto,Helvetica,Arial;background:#f7f7f9;color:#111;padding:18px}pre{background:#0b1020;color:#dcdcdc;padding:12px;border-radius:6px;overflow:auto}</style></head><body><h1>Tail of ${escapeHtml(
          name
        )} (last ${lines} lines)</h1><p><a href="/logs?format=html">Back to logs</a> · <a href="/logs/${encodeURIComponent(
          name
        )}?download=1">Download</a></p><pre>${escapeHtml(tail.join("\n"))}</pre></body></html>`;
        return res.send(html);
      }
      res.setHeader("Content-Type", "text/plain; charset=utf-8");
      res.send(tail.join("\n"));
    } catch (e) {
      logEvent("ERROR", `Log view failed | ${e.stack}`);
      res.status(500).send("Internal error");
    }
  });

  // Error handler
  app.use((err, req, res, next) => {
    logEvent("ERROR", `Health server express error | ${err?.message || err}`);
    try {
      res.status(500).json({ error: "internal error" });
    } catch {}
  });

  const server = app.listen(port, () =>
    logEvent("INIT", `Health server (express) listening on :${port}`)
  );
  server.on("error", (e) => logEvent("ERROR", `Health server error | ${e.stack}`));
  return server;
}

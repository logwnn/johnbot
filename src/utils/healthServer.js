import path from "path";
import fs from "fs";
import os from "os";
import { logEvent } from "./logger.js";
import config from "./config.js";

export async function startHealthServer(client, port = process.env.HEALTH_PORT || config.HEALTH_PORT || 3000) {
  // Try to load Express; if missing, instruct the user
  let express;
  try {
    express = (await import("express")).default;
  } catch (e) {
    logEvent("ERROR", `Express not installed. Health server requires express. Install with: npm i express`);
    throw new Error("Express not installed. Run: npm i express");
  }

  const app = express();
  const LOG_DIR = path.join(process.cwd(), "logs");
  const ARCHIVE_DIR = path.join(LOG_DIR, "archive");

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
      logEvent("ERROR", `Health handler failed | ${e.message}`);
      return res.status(500).json({ error: "Internal error" });
    }
  });

  app.get("/", (req, res) => {
    try {
      res.setHeader("Content-Type", "text/html");
      const html = `<!doctype html><html><head><meta charset="utf-8"><title>johnbot health</title></head><body><h1>johnbot health server</h1><ul><li><a href="/health">/health</a></li><li><a href="/logs">/logs (list)</a></li></ul></body></html>`;
      logEvent("HEALTH", `Root requested from ${req.ip || req.socket.remoteAddress}`);
      res.send(html);
    } catch (e) {
      logEvent("ERROR", `Root handler failed | ${e.message}`);
      res.status(500).send("Internal error");
    }
  });

  // List logs. Use ?archive=true to list archived logs from logs/archive
  app.get("/logs", (req, res) => {
    try {
      const listDir = req.query.archive ? ARCHIVE_DIR : LOG_DIR;
      if (!fs.existsSync(listDir)) return res.json({ files: [] });
      const files = fs.readdirSync(listDir).filter((f) => !f.startsWith(".")).map((f) => {
        const s = fs.statSync(path.join(listDir, f));
        return { name: f, size: s.size, mtime: s.mtime.toISOString() };
      });
      files.sort((a, b) => new Date(b.mtime) - new Date(a.mtime));
      logEvent("HEALTH", `Logs list requested (${req.query.archive ? 'archive' : 'current'}) by ${req.ip || req.socket.remoteAddress}`);
      res.json({ files });
    } catch (e) {
      logEvent("ERROR", `Logs list failed | ${e.message}`);
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
        logEvent("HEALTH", `Log download requested: ${name} by ${req.ip || req.socket.remoteAddress}`);
        return res.download(filePath);
      }

      const content = fs.readFileSync(filePath, "utf8");
      if (!lines) {
        logEvent("HEALTH", `Log view requested: ${name} by ${req.ip || req.socket.remoteAddress}`);
        res.setHeader("Content-Type", "text/plain; charset=utf-8");
        return res.send(content);
      }

      const arr = content.split(/\r?\n/).filter(Boolean);
      const tail = arr.slice(-Math.max(0, lines));
      logEvent("HEALTH", `Log tail requested: ${name} last=${lines} lines by ${req.ip || req.socket.remoteAddress}`);
      res.setHeader("Content-Type", "text/plain; charset=utf-8");
      res.send(tail.join("\n"));
    } catch (e) {
      logEvent("ERROR", `Log view failed | ${e.message}`);
      res.status(500).send("Internal error");
    }
  });

  // Error handler
  app.use((err, req, res, next) => {
    logEvent("ERROR", `Health server express error | ${err?.message || err}`);
    try { res.status(500).json({ error: "internal error" }); } catch {}
  });

  const server = app.listen(port, () => logEvent("INIT", `Health server (express) listening on :${port}`));
  server.on("error", (e) => logEvent("ERROR", `Health server error | ${e.message}`));
  return server;
}

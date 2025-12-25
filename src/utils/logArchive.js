import fs from "fs";
import path from "path";
import zlib from "zlib";
import { logEvent } from "./logger.js";

const LOG_DIR = path.join(process.cwd(), "logs");
const ARCHIVE_DIR = path.join(LOG_DIR, "archive");

function ensureDirs() {
  if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });
  if (!fs.existsSync(ARCHIVE_DIR)) fs.mkdirSync(ARCHIVE_DIR, { recursive: true });
}

export async function archiveOldLogs(days = 7) {
  ensureDirs();
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  const files = fs.readdirSync(LOG_DIR).filter((f) => f.endsWith(".jsonl") || f.endsWith(".txt") || f.endsWith(".log.gz"));
  let archived = 0;
  for (const file of files) {
    const full = path.join(LOG_DIR, file);
    try {
      const stat = fs.statSync(full);
      if (!stat.isFile()) continue;
      if (stat.mtimeMs > cutoff) continue; // too new
      const outName = `${file}.gz`;
      const outPath = path.join(ARCHIVE_DIR, outName);
      // If already compressed in archive, skip
      if (fs.existsSync(outPath)) {
        try {
          fs.unlinkSync(full);
        } catch {}
        continue;
      }
      const inp = fs.createReadStream(full);
      const out = fs.createWriteStream(outPath);
      const gzip = zlib.createGzip({ level: zlib.constants.Z_BEST_COMPRESSION });
      await new Promise((res, rej) => {
        inp.pipe(gzip).pipe(out).on("finish", res).on("error", rej);
      });
      try {
        fs.unlinkSync(full);
      } catch {}
      archived++;
    } catch (e) {
      logEvent("WARN", `Archiving failed for ${file} | ${e.message}`);
    }
  }
  logEvent("INIT", `Archived ${archived} log files older than ${days} days`);
  return archived;
}

let archiveIntervalId = null;
export function startArchiveScheduler(days = 7, everyMs = 24 * 60 * 60 * 1000) {
  // run once immediately
  archiveOldLogs(days).catch(() => {});
  if (archiveIntervalId) clearInterval(archiveIntervalId);
  archiveIntervalId = setInterval(() => archiveOldLogs(days).catch(() => {}), everyMs);
}

export function stopArchiveScheduler() {
  if (archiveIntervalId) clearInterval(archiveIntervalId);
  archiveIntervalId = null;
}

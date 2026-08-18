import fs from "node:fs"
import path from "node:path"
import { randomBytes } from "node:crypto"
import {
  extractDesktopAsar,
  patchAndroidApk,
  patchDesktopAsar,
  replaceGuide,
  type ClientPlatform,
} from "@marekanite/client-patch"
import type { Config } from "./config.js"
import { ensureStockArtifact } from "./github-releases.js"

export type JobStatus = "queued" | "running" | "done" | "error"

export type PatchJob = {
  id: string;
  kind: "desktop" | "android";
  platform: ClientPlatform;
  status: JobStatus;
  logs: string[];
  error?: string;
  createdAt: number;
  finishedAt?: number;
  outputPath?: string;
  downloadName?: string;
  listeners: Set<(line: string) => void>;
}

const jobs = new Map<string, PatchJob>()

function jobsRoot(config: Config): string {
  return path.join(path.dirname(config.databasePath), "patch-jobs")
}

export function getJob(id: string): PatchJob | undefined {
  return jobs.get(id)
}

function appendLog(job: PatchJob, line: string) {
  job.logs.push(line)
  for (const l of job.listeners) {
    try {
      l(line)
    } catch {
      /* ignore */
    }
  }
}

function logGuide(job: PatchJob) {
  const guide = replaceGuide(job.platform)
  appendLog(job, "")
  appendLog(job, `What to do with ${guide.downloadName}:`)
  appendLog(job, guide.summary)
  guide.steps.forEach((step, i) => {
    appendLog(job, `${i + 1}. ${step}`)
  })
}

export function createPatchJob(
  config: Config,
  platform: ClientPlatform,
  uploadPath: string,
  opts: { apiBase: string; extraWsSuffix?: string; originalName: string },
): PatchJob {
  const id = randomBytes(8).toString("hex")
  const dir = path.join(jobsRoot(config), id)
  fs.mkdirSync(dir, { recursive: true })
  const guide = replaceGuide(platform)
  const outputPath = path.join(dir, guide.downloadName)
  const dataDir = path.dirname(config.databasePath)

  const job: PatchJob = {
    id,
    kind: platform === "android" ? "android" : "desktop",
    platform,
    status: "queued",
    logs: [],
    createdAt: Date.now(),
    listeners: new Set(),
    downloadName: guide.downloadName,
  }
  jobs.set(id, job)

  void (async() => {
    job.status = "running"
    appendLog(job, `job ${id} started (${platform})`)
    appendLog(job, `upload: ${opts.originalName}`)
    appendLog(job, `apiBase: ${opts.apiBase}`)
    try {
      const onLog = (line: string) => { appendLog(job, line) }
      if (platform === "android") {
        await patchAndroidApk(uploadPath, outputPath, {
          apiBase: opts.apiBase,
          extraWsSuffix: opts.extraWsSuffix,
          keystoreDir: dataDir,
          onLog,
        })
      } else {
        const asar = await extractDesktopAsar(uploadPath, dir, onLog)
        await patchDesktopAsar(asar, outputPath, {
          apiBase: opts.apiBase,
          extraWsSuffix: opts.extraWsSuffix,
          onLog,
        })
      }
      job.outputPath = outputPath
      job.status = "done"
      job.finishedAt = Date.now()
      appendLog(job, `done in ${job.finishedAt - job.createdAt}ms`)
      logGuide(job)
    } catch(err) {
      job.status = "error"
      job.finishedAt = Date.now()
      job.error = err instanceof Error ? err.message : String(err)
      appendLog(job, `error: ${job.error}`)
    } finally {
      try {
        fs.unlinkSync(uploadPath)
      } catch {
        /* ignore */
      }
    }
  })()

  return job
}

export function jobPublicView(job: PatchJob) {
  const guide = replaceGuide(job.platform)
  return {
    id: job.id,
    kind: job.kind,
    platform: job.platform,
    status: job.status,
    logs: job.logs,
    error: job.error,
    createdAt: job.createdAt,
    finishedAt: job.finishedAt,
    downloadName: job.downloadName,
    ready: job.status === "done" && !!job.outputPath,
    replaceGuide: guide,
  }
}

export function createFromReleaseJob(
  config: Config,
  opts: {
    version: string;
    platform: ClientPlatform;
    apiBase: string;
    extraWsSuffix?: string;
  },
): PatchJob {
  const id = randomBytes(8).toString("hex")
  const dir = path.join(jobsRoot(config), id)
  fs.mkdirSync(dir, { recursive: true })
  const dataDir = path.dirname(config.databasePath)
  const guide = replaceGuide(opts.platform)
  const outputPath = path.join(dir, guide.downloadName)

  const job: PatchJob = {
    id,
    kind: opts.platform === "android" ? "android" : "desktop",
    platform: opts.platform,
    status: "queued",
    logs: [],
    createdAt: Date.now(),
    listeners: new Set(),
    downloadName: guide.downloadName,
  }
  jobs.set(id, job)

  void (async() => {
    job.status = "running"
    appendLog(
      job,
      `job ${id} started (from-release ${opts.platform} ${opts.version})`,
    )
    appendLog(job, `apiBase: ${opts.apiBase}`)
    try {
      const onLog = (line: string) => { appendLog(job, line) }
      const stock = await ensureStockArtifact(
        config,
        opts.version,
        opts.platform,
        onLog,
      )
      appendLog(
        job,
        `stock ready: ${stock.path}${stock.cacheHit ? " (cache)" : ""}`,
      )

      if (opts.platform === "android") {
        await patchAndroidApk(stock.path, outputPath, {
          apiBase: opts.apiBase,
          extraWsSuffix: opts.extraWsSuffix,
          keystoreDir: dataDir,
          onLog,
        })
      } else {
        await patchDesktopAsar(stock.path, outputPath, {
          apiBase: opts.apiBase,
          extraWsSuffix: opts.extraWsSuffix,
          onLog,
        })
      }
      job.outputPath = outputPath
      job.status = "done"
      job.finishedAt = Date.now()
      appendLog(job, `done in ${job.finishedAt - job.createdAt}ms`)
      logGuide(job)
    } catch(err) {
      job.status = "error"
      job.finishedAt = Date.now()
      job.error = err instanceof Error ? err.message : String(err)
      appendLog(job, `error: ${job.error}`)
    }
  })()

  return job
}

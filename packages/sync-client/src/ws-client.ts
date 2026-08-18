import WebSocket from "ws"
import { PIECE_SIZE } from "@marekanite/sync-protocol"

export type PushMeta = {
  path: string;
  relatedpath?: string | null;
  extension?: string;
  hash?: string;
  ctime?: number;
  mtime?: number;
  folder: boolean;
  deleted: boolean;
  size?: number;
  pieces?: number;
}

export class SyncWsClient {
  private ws: WebSocket | null = null
  private queue: Array<(msg: Record<string, unknown>) => void> = []
  private dataQueue: Buffer[] = []
  private dataWaiters: Array<(b: Buffer) => void> = []
  readonly pushes: Record<string, unknown>[] = []
  userId = -1
  readyVersion = 0

  connect(url: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(url)
      this.ws = ws
      ws.binaryType = "nodebuffer"
      ws.on("open", () => { resolve() })
      ws.on("error", reject)
      ws.on("message", (data, isBinary) => {
        if (isBinary) {
          const buf = Buffer.isBuffer(data)
            ? data
            : Buffer.from(data as ArrayBuffer)
          const waiter = this.dataWaiters.shift()
          if (waiter) waiter(buf)
          else this.dataQueue.push(buf)
          return
        }
        const msg = JSON.parse(data.toString()) as Record<string, unknown>
        if (msg.op === "pong") return
        if (msg.op === "push") {
          this.pushes.push(msg)
          return
        }
        if (msg.op === "ready") {
          this.readyVersion = Number(msg.version ?? 0)
          return
        }
        const waiter = this.queue.shift()
        if (waiter) waiter(msg)
      })
    })
  }

  private waitJson(): Promise<Record<string, unknown>> {
    return new Promise((resolve) => this.queue.push(resolve))
  }

  private waitBinary(): Promise<Buffer> {
    if (this.dataQueue.length) {
      return Promise.resolve(this.dataQueue.shift()!)
    }
    return new Promise((resolve) => this.dataWaiters.push(resolve))
  }

  send(obj: unknown) {
    this.ws?.send(JSON.stringify(obj))
  }

  async init(opts: {
    token: string;
    id: string;
    keyhash: string;
    version?: number;
    initial?: boolean;
    device?: string;
    encryption_version?: number;
  }) {
    this.send({
      op: "init",
      token: opts.token,
      id: opts.id,
      keyhash: opts.keyhash,
      version: opts.version ?? 0,
      initial: opts.initial ?? true,
      device: opts.device ?? "test-client",
      encryption_version: opts.encryption_version ?? 3,
    })
    const res = await this.waitJson()
    if (res.res !== "ok") {
      throw new Error(String(res.msg ?? "init failed"))
    }
    this.userId = Number(res.userId ?? -1)
    // Drain inventory pushes until ready is seen (ready handled in onmessage)
    // Wait briefly for ready
    await new Promise((r) => setTimeout(r, 50))
    return res
  }

  async pushFile(path: string, ciphertext: Buffer, hash = "deadbeef") {
    const size = ciphertext.byteLength
    const pieces = size === 0 ? 0 : Math.ceil(size / PIECE_SIZE)
    this.send({
      op: "push",
      path,
      relatedpath: null,
      extension: path.includes(".") ? path.split(".").pop() : "",
      hash,
      ctime: Date.now(),
      mtime: Date.now(),
      folder: false,
      deleted: false,
      size,
      pieces,
    })
    const first = await this.waitJson()
    if (first.res === "ok") {
      return first
    }
    for (let i = 0; i < pieces; i++) {
      const start = i * PIECE_SIZE
      const end = Math.min(size, start + PIECE_SIZE)
      this.ws?.send(ciphertext.subarray(start, end))
      await this.waitJson()
    }
    return first
  }

  async pull(uid: number): Promise<Buffer | null> {
    this.send({ op: "pull", uid })
    const meta = await this.waitJson()
    if (meta.deleted) return null
    if (meta.err) throw new Error(String(meta.err))
    const size = Number(meta.size ?? 0)
    const pieces = Number(meta.pieces ?? 0)
    if (pieces === 0) return Buffer.alloc(0)
    const parts: Buffer[] = []
    for (let i = 0; i < pieces; i++) {
      parts.push(await this.waitBinary())
    }
    const buf = Buffer.concat(parts)
    if (buf.byteLength !== size) {
      throw new Error(`size mismatch ${buf.byteLength} != ${size}`)
    }
    return buf
  }

  close() {
    this.ws?.close()
    this.ws = null
  }
}

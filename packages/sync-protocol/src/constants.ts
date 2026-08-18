/** 2 MiB piece size used by the official client for push/pull binary frames. */
export const PIECE_SIZE = 2_097_152

/** Default max file size advertised by the official client (~199 MiB). */
export const DEFAULT_PER_FILE_MAX = 208_666_624

/** Client disconnects if no message for this long (ms). */
export const CLIENT_IDLE_TIMEOUT_MS = 120_000

/** Heartbeat interval the client uses (ms). */
export const CLIENT_HEARTBEAT_INTERVAL_MS = 20_000

/** Supported encryption versions in Obsidian 1.13.x. */
export const SUPPORTED_ENCRYPTION_VERSIONS = [0, 2, 3] as const

export type EncryptionVersion = (typeof SUPPORTED_ENCRYPTION_VERSIONS)[number]

/** Default storage limit stub (~10 GiB). */
export const DEFAULT_STORAGE_LIMIT_BYTES = 10 * 1024 * 1024 * 1024

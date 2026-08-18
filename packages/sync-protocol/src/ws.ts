import { z } from "zod"

export const WsInitSchema = z.object({
  op: z.literal("init"),
  token: z.string(),
  id: z.string(),
  keyhash: z.string(),
  version: z.number().int().nonnegative(),
  initial: z.boolean(),
  device: z.string().optional(),
  encryption_version: z.number().int().optional(),
})

export type WsInit = z.infer<typeof WsInitSchema>

export const WsPingSchema = z.object({
  op: z.literal("ping"),
})

export const WsPushSchema = z.object({
  op: z.literal("push"),
  path: z.string(),
  relatedpath: z.string().nullable().optional(),
  extension: z.string().optional(),
  hash: z.string().optional(),
  ctime: z.number().int().optional(),
  mtime: z.number().int().optional(),
  folder: z.boolean(),
  deleted: z.boolean(),
  size: z.number().int().nonnegative().optional(),
  pieces: z.number().int().nonnegative().optional(),
})

export type WsPush = z.infer<typeof WsPushSchema>

export const WsPullSchema = z.object({
  op: z.literal("pull"),
  uid: z.number().int().positive(),
})

export const WsHistorySchema = z.object({
  op: z.literal("history"),
  path: z.string(),
  last: z.number().int().optional(),
})

export const WsDeletedSchema = z.object({
  op: z.literal("deleted"),
  suppressrenames: z.boolean().optional(),
})

export const WsRestoreSchema = z.object({
  op: z.literal("restore"),
  uid: z.number().int().positive(),
})

export const WsSimpleOpSchema = z.object({
  op: z.enum(["purge", "size", "usernames"]),
})

export const ClientMessageSchema = z.discriminatedUnion("op", [
  WsInitSchema,
  WsPingSchema,
  WsPushSchema,
  WsPullSchema,
  WsHistorySchema,
  WsDeletedSchema,
  WsRestoreSchema,
  WsSimpleOpSchema,
])

export type ClientMessage = z.infer<typeof ClientMessageSchema>

/** Server → client push notification / inventory item. */
export const ServerPushSchema = z.object({
  op: z.literal("push"),
  uid: z.number().int().positive(),
  path: z.string(),
  hash: z.string().optional(),
  ctime: z.number().int().optional(),
  mtime: z.number().int().optional(),
  size: z.number().int().optional(),
  folder: z.boolean(),
  deleted: z.boolean(),
  device: z.string().optional(),
  user: z.number().int().optional(),
})

export type ServerPush = z.infer<typeof ServerPushSchema>

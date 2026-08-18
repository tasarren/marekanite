import { z } from "zod"

/** Official client errors use `{ error: string }` in the JSON body. */
export const ApiErrorSchema = z.object({
  error: z.string(),
})

export type ApiError = z.infer<typeof ApiErrorSchema>

export const SignUpBodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  name: z.string().min(1),
  next: z.string().optional(),
  pow: z.unknown().optional(),
})

export const SignInBodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  mfa: z.string().optional(),
})

export const TokenBodySchema = z.object({
  token: z.string().min(1),
})

export const AuthResponseSchema = z.object({
  token: z.string(),
  email: z.string(),
  name: z.string(),
  license: z.string(),
})

export type AuthResponse = z.infer<typeof AuthResponseSchema>

export const VaultListBodySchema = z.object({
  token: z.string().min(1),
  supported_encryption_version: z.number().int(),
})

export const VaultCreateBodySchema = z.object({
  token: z.string().min(1),
  name: z.string().min(1),
  keyhash: z.string().min(1),
  salt: z.string().min(1),
  region: z.string().optional(),
  encryption_version: z.number().int(),
})

export const VaultAccessBodySchema = z.object({
  token: z.string().min(1),
  vault_uid: z.string().min(1),
  keyhash: z.string().min(1),
  host: z.string().optional(),
  encryption_version: z.number().int().optional(),
})

export const VaultUidBodySchema = z.object({
  token: z.string().min(1),
  vault_uid: z.string().min(1),
})

export const VaultRenameBodySchema = VaultUidBodySchema.extend({
  name: z.string().min(1),
})

export const VaultShareInviteBodySchema = VaultUidBodySchema.extend({
  email: z.string().email(),
})

export const VaultShareRemoveBodySchema = VaultUidBodySchema.extend({
  share_uid: z.string().min(1),
})

export const VaultRegionsBodySchema = z.object({
  token: z.string().min(1),
  host: z.string().optional(),
})

export const VaultRecordSchema = z.object({
  id: z.string(),
  name: z.string(),
  salt: z.string(),
  host: z.string(),
  encryption_version: z.number().int(),
  password: z.string().optional(),
  created: z.number().optional(),
})

export type VaultRecord = z.infer<typeof VaultRecordSchema>

export const VaultListResponseSchema = z.object({
  limit: z.number().int(),
  vaults: z.array(VaultRecordSchema),
  shared: z.array(VaultRecordSchema),
})

export type VaultListResponse = z.infer<typeof VaultListResponseSchema>

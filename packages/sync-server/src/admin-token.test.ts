import { describe, it, expect } from "vitest"
import { resolveAdminToken, tokensEqual } from "./admin-token.js"

describe("admin token", () => {
  it("is open when env is empty", () => {
    expect(resolveAdminToken("")).toEqual({ token: null, source: "none" })
    expect(resolveAdminToken("   ")).toEqual({ token: null, source: "none" })
  })

  it("uses a non-empty env token", () => {
    expect(resolveAdminToken("from-env")).toEqual({
      token: "from-env",
      source: "env",
    })
  })

  it("compares tokens in constant time", () => {
    expect(tokensEqual("abc", "abc")).toBe(true)
    expect(tokensEqual("abc", "abd")).toBe(false)
    expect(tokensEqual("ab", "abcd")).toBe(false)
  })
})

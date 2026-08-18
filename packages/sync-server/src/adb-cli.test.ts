import { describe, expect, it } from "vitest"
import { AdbCliError, parseHostPort, parsePairingCode } from "./adb-cli.js"

describe("adb-cli parsing", () => {
  it("accepts a host and port", () => {
    expect(parseHostPort("192.168.1.20", "5555")).toBe("192.168.1.20:5555")
    expect(parseHostPort("phone.local", 37000)).toBe("phone.local:37000")
  })

  it("rejects junk hosts and ports", () => {
    expect(() => parseHostPort("192.168.1.20; rm -rf /", 5555)).toThrow(
      AdbCliError,
    )
    expect(() => parseHostPort("ok", 0)).toThrow(AdbCliError)
    expect(() => parseHostPort("ok", "nope")).toThrow(AdbCliError)
  })

  it("requires a six-digit pairing code", () => {
    expect(parsePairingCode("123456")).toBe("123456")
    expect(() => parsePairingCode("12 3456")).toThrow(AdbCliError)
    expect(() => parsePairingCode("abcdef")).toThrow(AdbCliError)
  })
})

import { describe, expect, it } from "vitest"
import {
  COMPAT_API_BASE,
  probePatched,
  probeStock,
  verdict,
} from "./compat-probe.js"

const STOCK_APP = `
  var x="https://"+[String.fromCharCode(97,112,105),"obsidian","md"].join(".");
  if(!tne.call(h,".obsidian.md")&&"127.0.0.1"!==h)throw 1;
  t.prototype.getHost=function(){var e=this.host||"127.0.0.1:3003";return e.startsWith("127.0.0.1")?"ws://"+e:"wss://"+e};
`
const STOCK_STARTER = "var x=\"https://\"+[String.fromCharCode(97,112,105),\"obsidian\",\"md\"].join(\".\");"
const STOCK_MAIN = "webPreferences:{nodeIntegration:!0}"

describe("compat-probe", () => {
  it("sees stock contracts", () => {
    const s = probeStock(
      { appJs: STOCK_APP, starterJs: STOCK_STARTER, mainJs: STOCK_MAIN },
      "desktop",
    )
    expect(s.missing).toEqual([])
    expect(s.found).toContain("api-charcode")
    expect(s.found).toContain("ws-gethost")
  })

  it("accepts a fully rewritten desktop bundle", () => {
    const appJs = `
      var x=${JSON.stringify(COMPAT_API_BASE)};
      if(!tne.call(h,".obsidian.md")&&"127.0.0.1"!==h&&"192.0.2.10"!==h)throw 1;
      t.prototype.getHost=function(){return"ws://192.0.2.10:8787"};
    `
    const p = probePatched(
      {
        appJs,
        starterJs: `var x=${JSON.stringify(COMPAT_API_BASE)};`,
        mainJs: "webPreferences:{allowRunningInsecureContent:!0,",
      },
      COMPAT_API_BASE,
      "desktop",
    )
    expect(p.failed).toEqual([])
    expect(p.ok).toBe(true)
  })

  it("marks missing API as unsupported", () => {
    const s = probeStock({ appJs: "console.log(1)" }, "android")
    const p = probePatched({ appJs: "console.log(1)" }, COMPAT_API_BASE, "android")
    expect(verdict({ stock: s, patched: p })).toBe("unsupported")
  })
})

import { describe, it, expect } from "vitest"
import { patchSignupUx, patchClientJs } from "./patch-js.js"

const CLOUD =
  "td.isIosApp&&Df?Df.open({url:\"https://obsidian.md/auth#signup\"}):window.open(\"https://obsidian.md/auth#signup\")"

describe("patchSignupUx", () => {
  it("rewires Account Sign up to Bee.openAsSignup", () => {
    const src =
      `var e={app:{}};e.accountSetting.addButton((function(t){return t.setButtonText(Ree.labelLogIn()).onClick((function(){new Bee(e.app).open()}))})).addButton((function(e){return e.setButtonText(Ree.labelSignUp()).onClick((function(){${CLOUD}}))}));` +
      // minimal Bee close so inject path can no-op without full login body
      "Bee=function(e){};"
    const r = patchSignupUx(src, "app.js")
    expect(r).toBeTruthy()
    expect(r!.code).toContain("openAsSignup")
    expect(r!.code).not.toContain("obsidian.md/auth#signup")
    expect(r!.code).not.toContain("prompt(")
  })

  it("is a no-op when cloud signup is absent", () => {
    expect(patchSignupUx("console.log(1)")).toBeNull()
  })
})

const STOCK_ALLOW =
  "!tne.call(h,\".obsidian.md\")&&\"127.0.0.1\"!==h"
const STOCK_GET_HOST =
  "t.prototype.getHost=function(){var e=this.host||\"127.0.0.1:3003\";return e.startsWith(\"127.0.0.1\")||e.startsWith(\"localhost\")?\"ws://\"+e:\"wss://\"+e}"

describe("patchClientJs", () => {
  it("rewrites stock API expr", () => {
    const expr =
      "\"https://\"+[String.fromCharCode(97,112,105),\"obsidian\",\"md\"].join(\".\")"
    const src = `var base=${expr};function x(){return base+"/user/signin"}`
    const r = patchClientJs(src, { apiBase: "http://127.0.0.1:8787" }, "app.js")
    expect(r).toBeTruthy()
    expect(r!.code).toContain("http://127.0.0.1:8787")
    expect(r!.code).not.toContain("String.fromCharCode(97,112,105)")
  })

  it("opens the Sync gate for a LAN http origin from the form", () => {
    const src = `var gate=${STOCK_ALLOW};${STOCK_GET_HOST}`
    const r = patchClientJs(
      src,
      { apiBase: "http://192.0.2.10:8787" },
      "app.js",
    )
    expect(r).toBeTruthy()
    expect(r!.code).toContain("\"192.0.2.10\"!==h")
    expect(r!.code).toContain("return\"ws://192.0.2.10:8787\"")
    expect(r!.code).not.toContain("this.host")
    expect(r!.code).not.toContain("wss://")
  })

  it("rewrites Sync getHost and leaves Publish getHost (3002) alone", () => {
    const publish =
      "e.prototype.getHost=function(){var e=this.host||\"127.0.0.1:3002\";return e.startsWith(\"127.0.0.1\")||e.startsWith(\"localhost\")?\"http://\"+e:\"https://\"+e}"
    const sync =
      "t.prototype.getHost=function(){var e=this.host||\"127.0.0.1:3003\";return e.startsWith(\"127.0.0.1\")||e.startsWith(\"localhost\")?\"ws://\"+e:\"wss://\"+e}"
    const src = `var gate=${STOCK_ALLOW};${publish}${sync}`
    const r = patchClientJs(src, { apiBase: "http://192.0.2.10:8787" }, "app.js")
    expect(r).toBeTruthy()
    expect(r!.code).toContain(publish)
    expect(r!.code).toContain("t.prototype.getHost=function(){return\"ws://192.0.2.10:8787\"}")
    expect(r!.code).not.toContain("\"127.0.0.1:3003\"")
  })

  it("uses wss and the form hostname for an https origin", () => {
    const src = `var gate=${STOCK_ALLOW};${STOCK_GET_HOST}`
    const r = patchClientJs(
      src,
      { apiBase: "https://mknt.example.com" },
      "app.js",
    )
    expect(r).toBeTruthy()
    expect(r!.code).toContain("\"mknt.example.com\"!==h")
    expect(r!.code).toContain("return\"wss://mknt.example.com\"")
    expect(r!.code).not.toContain("this.host")
  })
})

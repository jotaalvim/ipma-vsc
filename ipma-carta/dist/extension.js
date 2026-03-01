"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/extension.ts
var extension_exports = {};
__export(extension_exports, {
  activate: () => activate,
  deactivate: () => deactivate
});
module.exports = __toCommonJS(extension_exports);
var vscode = __toESM(require("vscode"));
var fs = __toESM(require("fs"));
var path = __toESM(require("path"));
var os = __toESM(require("os"));
var import_playwright = require("playwright");
function activate(context) {
  console.log('Congratulations, your extension "ipma-carta" is now active!');
  const disposable = vscode.commands.registerCommand("ipma-carta.showWeatherMap", () => {
    const panel = vscode.window.createWebviewPanel(
      "localVideo",
      "Extension Tutorial",
      vscode.ViewColumn.One,
      {
        enableScripts: true,
        localResourceRoots: [vscode.Uri.joinPath(context.extensionUri, "media")]
      }
    );
    const videoUri = panel.webview.asWebviewUri(
      vscode.Uri.joinPath(context.extensionUri, "media", "weather_output.mp4")
    );
    panel.webview.html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <style>
            html, body {
                background-color: transparent !important;
                margin: 0;
                padding: 0;
                overflow: hidden;
                display: flex;
                justify-content: center;
                align-items: center;
                height: 100vh;
            }
            video {
                max-width: 100%;
                max-height: 100%;
                background: transparent;
            }
        </style>
    </head>
    <body>
        <video autoplay muted loop playsinline>
            <source src="${videoUri}" type="video/webm">
            Your browser does not support transparent video.
        </video>
    </body>
    </html>`;
  });
  const reload = vscode.commands.registerCommand("ipma-carta.reloadIPMA", async () => {
    const link = "https://www.ipma.pt/pt/otempo/prev.numerica/index.jsp";
    const browser = await import_playwright.chromium.launch({ headless: false });
    const browserContext = await browser.newContext();
    const page = await browserContext.newPage();
    const storageDir = context.globalStorageUri ? context.globalStorageUri.fsPath : context.globalStoragePath || path.join(os.homedir(), ".ipma-carta-images");
    if (!fs.existsSync(storageDir)) fs.mkdirSync(storageDir, { recursive: true });
    const dataDir = storageDir;
    const downloadedUrls = /* @__PURE__ */ new Set();
    let counter = 0;
    page.on("response", async (response) => {
      const url = response.url();
      if (url.includes("/resources.www/data/previsao/numerica/cartas/") && url.endsWith(".png")) {
        if (!downloadedUrls.has(url) && response.status() === 200) {
          downloadedUrls.add(url);
          try {
            const buffer = await response.body();
            const filename = `img-${String(counter).padStart(3, "0")}.png`;
            const filepath = path.join(dataDir, filename);
            fs.writeFileSync(filepath, buffer);
            console.log(`Intercepted: ${filepath}`);
            vscode.window.showInformationMessage(`Downloaded: ${filepath}`);
            counter++;
          } catch (e) {
          }
        }
      }
    });
    try {
      console.log("Navigating to IPMA...");
      await page.goto(link, { waitUntil: "networkidle", timeout: 6e4 });
      const playButtonSelector = 'img[name="Image5"]';
      for (let i = 0; i < 78; i++) {
        await page.waitForSelector(playButtonSelector, { state: "attached" });
        await page.click(playButtonSelector);
        await page.waitForFunction(
          (selector) => {
            const img = document.querySelector(selector);
            return img && img.naturalWidth > 0;
          },
          playButtonSelector,
          { timeout: 3e4 }
        );
        await page.waitForTimeout(500);
      }
      vscode.window.showInformationMessage(`Successfully downloaded ${counter} map images!`);
    } catch (error) {
      console.error("Error during page navigation:", error);
      vscode.window.showErrorMessage("Failed to load IPMA website.");
    } finally {
      await browser.close();
      console.log("Browser closed.");
    }
  });
  context.subscriptions.push(disposable);
  context.subscriptions.push(reload);
}
function deactivate() {
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  activate,
  deactivate
});
//# sourceMappingURL=extension.js.map

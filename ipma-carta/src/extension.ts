import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { exec } from 'child_process';
import { promisify } from 'util';
import { chromium, Response } from 'playwright';

const execAsync = promisify(exec);
const baseStorage = path.join(os.homedir(), '.ipma-carta-images');
const storageDir = path.join(baseStorage, 'ipma-cartas');
const outputVideoNameMp4 = 'weather_output.mp4';
const videoMaxAgeMs = 20 * 60 * 60 * 1000;

async function ensureFfmpegAvailable(): Promise<boolean> {
    try {
        await execAsync('ffmpeg -version');
        return true;
    } catch {
        return false;
    }
}

async function convertFramesToMp4(dataDir: string, runId: string): Promise<string> {
    const inputPattern = path.join(dataDir, `${runId}-*.png`);
    const outputPath = path.join(dataDir, outputVideoNameMp4);

    const command = [
        'ffmpeg',
        '-y',
        '-framerate 6',
        `-pattern_type glob -i '${inputPattern}'`,
        '-c:v libx264',
        '-pix_fmt yuv420p',
        '-movflags +faststart',
        `'${outputPath}'`
    ].join(' ');

    await execAsync(command);
    return outputPath;
}

function removeOldPhotos(dataDir: string): void {
    if (!fs.existsSync(dataDir)) {
        return;
    }

    for (const entry of fs.readdirSync(dataDir)) {
        if (entry.toLowerCase().endsWith('.png')) {
            const filePath = path.join(dataDir, entry);
            try {
                fs.unlinkSync(filePath);
            } catch {
                // Ignore file deletion errors so a single locked file does not stop a refresh.
            }
        }
    }
}

function isVideoFresh(videoPath: string): boolean {
    if (!fs.existsSync(videoPath)) {
        return false;
    }

    try {
        const stats = fs.statSync(videoPath);
        const age = Date.now() - stats.mtimeMs;
        return age <= videoMaxAgeMs;
    } catch {
        return false;
    }
}

async function reloadIpmaData(showCompletionMessage: boolean): Promise<boolean> {
    const link = "https://www.ipma.pt/pt/otempo/prev.numerica/index.jsp";

    const browser = await chromium.launch({ headless: true });
    const browserContext = await browser.newContext();
    const page = await browserContext.newPage();

    if (!fs.existsSync(storageDir)) { fs.mkdirSync(storageDir, { recursive: true }); }
    const dataDir = storageDir;
    removeOldPhotos(dataDir);
    const runId = new Date().toISOString().replace(/[:.]/g, '-');

    const downloadedUrls = new Set<string>();
    let counter = 0;
    

    page.on('response', async (response: Response) => {
        const url = response.url();


        if (url.includes("/resources.www/data/previsao/numerica/cartas/") && url.endsWith(".png")) {
            if (!downloadedUrls.has(url) && response.status() === 200) {
                downloadedUrls.add(url);
                try {
                    const buffer = await response.body();
                    const filename = `${runId}-${String(counter).padStart(3, '0')}.png`;
                    const filepath = path.join(dataDir, filename);
                    fs.writeFileSync(filepath, buffer);
                    console.log(`Intercepted: ${filepath}`);
                    if (counter % 5 === 0) {
                    vscode.window.showWarningMessage(`Downloading weather map images (${counter + 1})/78 from IPMA. Please wait...`);
                    }
                    counter++;
                } catch {
                    // Ignore errors where the body might no longer be available.
                }
            }
        }
    });

    try {
        await page.goto(link, { waitUntil: 'networkidle', timeout: 60000 });

        const playButtonSelector = 'img[name="Image5"]';

        for (let i = 0; i < 78; i++) {
            await page.waitForSelector(playButtonSelector, { state: "attached" });
            await page.click(playButtonSelector);

            await page.waitForFunction(
                (selector) => {
                    const img = document.querySelector(selector) as HTMLImageElement;
                    return img && img.naturalWidth > 0;
                },
                playButtonSelector,
                { timeout: 30000 }
            );

            await page.waitForTimeout(500);
        }

        if (counter === 0) {
            vscode.window.showWarningMessage('No map images were downloaded from IPMA.');
            return false;
        }

        const ffmpegAvailable = await ensureFfmpegAvailable();
        if (!ffmpegAvailable) {
            vscode.window.showErrorMessage('ffmpeg is not installed or not in PATH. Install ffmpeg to convert PNG frames into video.');
            return false;
        }

        const outputPath = await convertFramesToMp4(dataDir, runId);
        if (showCompletionMessage) {
            vscode.window.showInformationMessage(`Downloaded ${counter} images and generated video: ${outputPath}`);
        }
        return true;
    } catch (error) {
        console.error("Error during page navigation:", error);
        vscode.window.showErrorMessage("Failed to load IPMA website.");
        return false;
    } finally {
        await browser.close();
        console.log("Browser closed.");
    }
}



export function activate(context: vscode.ExtensionContext) {

    const disposable = vscode.commands.registerCommand('ipma-carta.showWeatherMap', async () => {
        const videoPath = path.join(storageDir, outputVideoNameMp4);

        if (!isVideoFresh(videoPath)) {
            const reloaded = await reloadIpmaData(false);
            if (!reloaded || !fs.existsSync(videoPath)) {
                vscode.window.showWarningMessage('Unable to generate an up-to-date weather video.');
                return;
            }
        }

        const panel = vscode.window.createWebviewPanel(
            'localVideo',
            'IPMA Weather Map',
            vscode.ViewColumn.One,
            {
                enableScripts: true,
                localResourceRoots: [vscode.Uri.file(storageDir)]
            }
        );

        const videoUri = panel.webview.asWebviewUri(
            vscode.Uri.file(videoPath)
        );
        const videoType = 'video/mp4';

        panel.webview.onDidReceiveMessage(async (message) => {
            if (message?.command === 'openExternal') {
                await vscode.env.openExternal(vscode.Uri.file(videoPath));
            }
        });

        panel.webview.html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
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
            .container {
                width: 100%;
                height: 100%;
                display: flex;
                justify-content: center;
                align-items: center;
                position: relative;
            }
            video {
                max-width: 100%;
                max-height: 100%;
                background: transparent;
            }
            .error {
                display: none;
                position: absolute;
                inset: 0;
                align-items: center;
                justify-content: center;
                flex-direction: column;
                gap: 12px;
                color: #d4d4d4;
                background: rgba(0, 0, 0, 0.45);
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
                text-align: center;
                padding: 20px;
            }
            button {
                border: 0;
                border-radius: 6px;
                padding: 8px 12px;
                background: #0e639c;
                color: #ffffff;
                cursor: pointer;
            }
        </style>
    </head>
    <body>
        <div class="container">
            <video id="video" autoplay muted loop playsinline controls>
                <source src="${videoUri}" type="${videoType}">
                Your browser does not support this video format.
            </video>
            <div id="error" class="error">
                <div>Could not play the generated video in this webview.</div>
                <button id="openExternal">Open video externally</button>
            </div>
        </div>
        <script>
            const vscodeApi = acquireVsCodeApi();
            const video = document.getElementById('video');
            const error = document.getElementById('error');
            const openExternal = document.getElementById('openExternal');

            const showError = () => {
                error.style.display = 'flex';
            };

            video.addEventListener('error', showError);

            setTimeout(() => {
                if (video.readyState < 2) {
                    showError();
                }
            }, 2500);

            openExternal.addEventListener('click', () => {
                vscodeApi.postMessage({ command: 'openExternal' });
            });
        </script>
    </body>
    </html>`;
    });
    context.subscriptions.push(disposable);
}


// This method is called when your extension is deactivated
export function deactivate() { }

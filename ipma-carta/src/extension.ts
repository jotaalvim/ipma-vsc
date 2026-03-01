import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as puppeteer from 'puppeteer-core';
import { chromium, Response } from 'playwright';



export function activate(context: vscode.ExtensionContext) {


	console.log('Congratulations, your extension "ipma-carta" is now active!');

		
	const disposable = vscode.commands.registerCommand('ipma-carta.showWeatherMap', () => {
        const panel = vscode.window.createWebviewPanel(
            'localVideo',
            'Extension Tutorial',
            vscode.ViewColumn.One,
            { 
                enableScripts: true,
                localResourceRoots: [vscode.Uri.joinPath(context.extensionUri, 'media')]
            }
        );

        const videoUri = panel.webview.asWebviewUri(
            vscode.Uri.joinPath(context.extensionUri, 'media', 'weather_output.mp4')
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



	const reload = vscode.commands.registerCommand('ipma-carta.reloadIPMA', async () => {

        const link = "https://www.ipma.pt/pt/otempo/prev.numerica/index.jsp";


        const browser = await chromium.launch({ headless: false });
        const browserContext = await browser.newContext();
        const page = await browserContext.newPage();

        const storageDir = context.globalStorageUri
          ? context.globalStorageUri.fsPath
          : (context.globalStoragePath || path.join(os.homedir(), '.ipma-carta-images'));
        if (!fs.existsSync(storageDir)) fs.mkdirSync(storageDir, { recursive: true });
        const dataDir = storageDir;

        const downloadedUrls = new Set<string>();
        let counter = 0;

    page.on('response', async (response: Response) => {
        const url = response.url();
        
        if (url.includes("/resources.www/data/previsao/numerica/cartas/") && url.endsWith(".png")) {
            if (!downloadedUrls.has(url) && response.status() === 200) {
                downloadedUrls.add(url);
                try {
                  
                    const buffer = await response.body();
                    const filename = `img-${String(counter).padStart(3, '0')}.png`;
                    const filepath = path.join(dataDir, filename);
                    fs.writeFileSync(filepath, buffer);
                    console.log(`Intercepted: ${filepath}`);
                    vscode.window.showInformationMessage(`Downloaded: ${filepath}`);
                    counter++;
                } catch (e) {
                    // Ignore errors where the body might no longer be available
                }
            }
        }
    });


        try {
            console.log("Navigating to IPMA...");
            await page.goto(link, { waitUntil: 'networkidle', timeout: 60000 });
            
            const playButtonSelector = 'img[name="Image5"]';
            
            for (let i = 0; i < 78; i++) {
                await page.waitForSelector(playButtonSelector, { state: "attached" });
                await page.click(playButtonSelector);
                
                // Wait for the image to load by checking naturalWidth > 0
                await page.waitForFunction(
                    (selector) => {
                        const img = document.querySelector(selector) as HTMLImageElement;
                        return img && img.naturalWidth > 0;
                    },
                    playButtonSelector,
                    { timeout: 30000 }
                );
                
                // Small delay before next click
                await page.waitForTimeout(500);
            }
            
            
            vscode.window.showInformationMessage(`Successfully downloaded ${counter} map images!`);

        } catch (error) {
            console.error("Error during page navigation:", error);
            vscode.window.showErrorMessage("Failed to load IPMA website.");
        } finally {
            // 4. Clean up (Optional: comment this out if you want to keep the browser open to inspect it)
            await browser.close();
            console.log("Browser closed.");
        }

	});

	context.subscriptions.push(disposable);
	context.subscriptions.push(reload);
}


// This method is called when your extension is deactivated
export function deactivate() {}

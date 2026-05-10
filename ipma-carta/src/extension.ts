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
                    vscode.window.showWarningMessage(`Downloading weather map images ${counter + 3}/78 from IPMA. Please wait...`);
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
                height: 100vh;
            }
            .layout {
                width: 100%;
                height: 100%;
                display: flex;
                flex-direction: column;
                gap: 8px;
                box-sizing: border-box;
                padding: 10px;
            }
            .container {
                width: 100%;
                flex: 1 1 auto;
                position: relative;
                display: flex;
                justify-content: center;
                align-items: center;
            }
            video {
                max-width: 100%;
                max-height: 100%;
                background: transparent;
            }
            .chartPanel {
                width: 100%;
                height: 220px;
                max-height: 35vh;
                border-radius: 8px;
                border: 1px solid rgba(170, 190, 240, 0.45);
                padding: 8px 10px 6px;
                display: grid;
                grid-template-rows: auto 1fr auto;
                gap: 6px;
                background: rgba(8, 16, 30, 0.72);
                box-sizing: border-box;
            }
            .chartTitle {
                margin: 0;
                font-size: 13px;
                font-weight: 600;
                color: #eff6ff;
            }
            .chartBody {
                display: grid;
                grid-template-columns: 1fr 190px;
                gap: 10px;
                min-height: 0;
            }
            .chartCanvasWrap {
                min-height: 0;
            }
            canvas {
                width: 100%;
                height: 100%;
                display: block;
            }
            .chartStats {
                border-left: 1px solid rgba(180, 200, 255, 0.28);
                padding-left: 10px;
                font-size: 12px;
                color: #d7e3ff;
                display: grid;
                grid-template-rows: repeat(4, auto);
                align-content: start;
                gap: 6px;
            }
            .statLabel {
                color: #9fb6e8;
            }
            .statValue {
                font-weight: 700;
                color: #ffffff;
            }
            .chartStatus {
                font-size: 12px;
                color: #c8d9ff;
                min-height: 16px;
            }
            @media (max-width: 720px) {
                .chartBody {
                    grid-template-columns: 1fr;
                }
                .chartStats {
                    border-left: 0;
                    border-top: 1px solid rgba(180, 200, 255, 0.28);
                    padding-left: 0;
                    padding-top: 8px;
                    grid-template-columns: repeat(2, minmax(0, 1fr));
                    grid-template-rows: repeat(2, auto);
                }
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
        <div class="layout">
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
            <div class="chartPanel">
                <p class="chartTitle">Hourly Temperature Forecast (Open-Meteo)</p>
                <div class="chartBody">
                    <div class="chartCanvasWrap">
                        <canvas id="tempChart"></canvas>
                    </div>
                    <div class="chartStats" id="chartStats">
                        <div><span class="statLabel">Avg (09-18): </span><span class="statValue" id="statAvgDay">-</span></div>
                        <div><span class="statLabel">Min (09-18): </span><span class="statValue" id="statMinDay">-</span></div>
                        <div><span class="statLabel">Max (09-18): </span><span class="statValue" id="statMaxDay">-</span></div>
                        <div><span class="statLabel">Overall Avg: </span><span class="statValue" id="statAvgAll">-</span></div>
                    </div>
                </div>
                <div id="chartStatus" class="chartStatus">Loading forecast...</div>
            </div>
        </div>
        <script>
            const vscodeApi = acquireVsCodeApi();
            const video = document.getElementById('video');
            const error = document.getElementById('error');
            const openExternal = document.getElementById('openExternal');
            const tempChart = document.getElementById('tempChart');
            const chartStatus = document.getElementById('chartStatus');
            const statAvgDay = document.getElementById('statAvgDay');
            const statMinDay = document.getElementById('statMinDay');
            const statMaxDay = document.getElementById('statMaxDay');
            const statAvgAll = document.getElementById('statAvgAll');
            const temperatureApiUrl = 'https://api.open-meteo.com/v1/forecast?latitude=41.5503&longitude=-8.4200&hourly=temperature_2m';
            let cachedSeries = [];
            let cachedUnit = '°C';

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

            const parseTemperatureSeries = (payload) => {
                const times = payload?.hourly?.time;
                const temps = payload?.hourly?.temperature_2m;
                if (!Array.isArray(times) || !Array.isArray(temps) || times.length !== temps.length) {
                    throw new Error('Unexpected weather data format.');
                }

                return times
                    .map((time, index) => ({ time, temperature: Number(temps[index]) }))
                    .filter((point) => Number.isFinite(point.temperature));
            };

            const formatLabel = (isoDate) => {
                const date = new Date(isoDate + ':00Z');
                const day = String(date.getUTCDate()).padStart(2, '0');
                const month = String(date.getUTCMonth() + 1).padStart(2, '0');
                const hour = String(date.getUTCHours()).padStart(2, '0');
                return day + '/' + month + ' ' + hour + ':00';
            };

            const hourFromIso = (isoDate) => {
                const timePart = String(isoDate).split('T')[1] || '00:00';
                return Number(timePart.split(':')[0]);
            };

            const avg = (numbers) => {
                if (!numbers.length) {
                    return NaN;
                }
                return numbers.reduce((sum, value) => sum + value, 0) / numbers.length;
            };

            const drawTemperatureChart = () => {
                if (!tempChart || !cachedSeries.length) {
                    return;
                }

                const maxPoints = 72;
                const series = cachedSeries.slice(0, maxPoints);
                const rect = tempChart.getBoundingClientRect();
                const width = Math.max(320, Math.floor(rect.width));
                const height = Math.max(140, Math.floor(rect.height || 140));
                const dpr = window.devicePixelRatio || 1;

                tempChart.width = Math.floor(width * dpr);
                tempChart.height = Math.floor(height * dpr);

                const ctx = tempChart.getContext('2d');
                if (!ctx) {
                    return;
                }
                ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
                ctx.clearRect(0, 0, width, height);

                const paddingLeft = 38;
                const paddingRight = 10;
                const paddingTop = 14;
                const paddingBottom = 26;
                const chartWidth = width - paddingLeft - paddingRight;
                const chartHeight = height - paddingTop - paddingBottom;

                const values = series.map((item) => item.temperature);
                let minVal = Math.min(...values);
                let maxVal = Math.max(...values);
                if (maxVal - minVal < 2) {
                    maxVal += 1;
                    minVal -= 1;
                }
                const valuePad = (maxVal - minVal) * 0.1;
                minVal -= valuePad;
                maxVal += valuePad;

                const xForIndex = (index) => paddingLeft + (index / (series.length - 1 || 1)) * chartWidth;
                const yForValue = (value) => paddingTop + (1 - (value - minVal) / (maxVal - minVal || 1)) * chartHeight;

                ctx.strokeStyle = 'rgba(170, 196, 255, 0.35)';
                ctx.lineWidth = 1;
                for (let i = 0; i <= 4; i++) {
                    const y = paddingTop + (i / 4) * chartHeight;
                    ctx.beginPath();
                    ctx.moveTo(paddingLeft, y);
                    ctx.lineTo(width - paddingRight, y);
                    ctx.stroke();
                }

                ctx.fillStyle = '#d8e6ff';
                ctx.font = '11px Segoe UI, sans-serif';
                for (let i = 0; i <= 4; i++) {
                    const value = maxVal - (i / 4) * (maxVal - minVal);
                    const y = paddingTop + (i / 4) * chartHeight;
                    ctx.fillText(value.toFixed(1), 4, y + 4);
                }

                const daytimeIndexPairs = [];
                for (let i = 0; i < series.length; i++) {
                    const hour = hourFromIso(series[i].time);
                    if (hour === 9) {
                        const endIndex = series.findIndex((item, idx) => idx >= i && hourFromIso(item.time) === 18);
                        if (endIndex !== -1) {
                            daytimeIndexPairs.push([i, endIndex]);
                        }
                    }
                }

                ctx.fillStyle = 'rgba(255, 214, 112, 0.08)';
                daytimeIndexPairs.forEach(([startIndex, endIndex]) => {
                    const xStart = xForIndex(startIndex);
                    const xEnd = xForIndex(endIndex);
                    ctx.fillRect(xStart, paddingTop, xEnd - xStart, chartHeight);
                });

                ctx.setLineDash([5, 4]);
                daytimeIndexPairs.forEach(([startIndex, endIndex]) => {
                    const x9 = xForIndex(startIndex);
                    const x18 = xForIndex(endIndex);

                    ctx.strokeStyle = 'rgba(255, 227, 149, 0.95)';
                    ctx.beginPath();
                    ctx.moveTo(x9, paddingTop);
                    ctx.lineTo(x9, paddingTop + chartHeight);
                    ctx.stroke();

                    ctx.strokeStyle = 'rgba(255, 179, 122, 0.95)';
                    ctx.beginPath();
                    ctx.moveTo(x18, paddingTop);
                    ctx.lineTo(x18, paddingTop + chartHeight);
                    ctx.stroke();
                });
                ctx.setLineDash([]);

                if (daytimeIndexPairs.length > 0) {
                    const [firstStart, firstEnd] = daytimeIndexPairs[0];
                    ctx.font = '10px Segoe UI, sans-serif';
                    ctx.fillStyle = '#ffdea6';
                    ctx.textAlign = 'center';
                    ctx.fillText('09', xForIndex(firstStart), paddingTop - 3);
                    ctx.fillStyle = '#ffc39f';
                    ctx.fillText('18', xForIndex(firstEnd), paddingTop - 3);
                }

                const gradient = ctx.createLinearGradient(0, paddingTop, 0, paddingTop + chartHeight);
                gradient.addColorStop(0, 'rgba(92, 168, 255, 0.6)');
                gradient.addColorStop(1, 'rgba(92, 168, 255, 0.08)');

                ctx.beginPath();
                series.forEach((item, idx) => {
                    const x = xForIndex(idx);
                    const y = yForValue(item.temperature);
                    if (idx === 0) {
                        ctx.moveTo(x, y);
                    } else {
                        ctx.lineTo(x, y);
                    }
                });
                const lastX = xForIndex(series.length - 1);
                const firstX = xForIndex(0);
                ctx.lineTo(lastX, paddingTop + chartHeight);
                ctx.lineTo(firstX, paddingTop + chartHeight);
                ctx.closePath();
                ctx.fillStyle = gradient;
                ctx.fill();

                ctx.beginPath();
                series.forEach((item, idx) => {
                    const x = xForIndex(idx);
                    const y = yForValue(item.temperature);
                    if (idx === 0) {
                        ctx.moveTo(x, y);
                    } else {
                        ctx.lineTo(x, y);
                    }
                });
                ctx.strokeStyle = '#59beff';
                ctx.lineWidth = 2.4;
                ctx.stroke();

                series.forEach((item, idx) => {
                    const hour = hourFromIso(item.time);
                    if (hour === 9 || hour === 18) {
                        const x = xForIndex(idx);
                        const y = yForValue(item.temperature);
                        ctx.beginPath();
                        ctx.arc(x, y, 2.8, 0, Math.PI * 2);
                        ctx.fillStyle = hour === 9 ? '#ffe6ab' : '#ffc7a8';
                        ctx.fill();
                    }
                });

                const labelIndexes = [0, Math.floor((series.length - 1) / 2), series.length - 1];
                ctx.fillStyle = '#cadeff';
                ctx.textAlign = 'center';
                labelIndexes.forEach((index) => {
                    const x = xForIndex(index);
                    ctx.fillText(formatLabel(series[index].time), x, height - 7);
                });

                ctx.textAlign = 'left';
                const visibleTemps = series.map((point) => point.temperature);
                const minTemp = Math.min(...visibleTemps);
                const maxTemp = Math.max(...visibleTemps);
                const dayWindowTemps = series
                    .filter((point) => {
                        const hour = hourFromIso(point.time);
                        return hour >= 9 && hour <= 18;
                    })
                    .map((point) => point.temperature);
                const dayAvg = avg(dayWindowTemps);
                const allAvg = avg(visibleTemps);

                if (statAvgDay) {
                    statAvgDay.textContent = Number.isFinite(dayAvg) ? dayAvg.toFixed(1) + cachedUnit : 'n/a';
                }
                if (statMinDay) {
                    statMinDay.textContent = dayWindowTemps.length ? Math.min(...dayWindowTemps).toFixed(1) + cachedUnit : 'n/a';
                }
                if (statMaxDay) {
                    statMaxDay.textContent = dayWindowTemps.length ? Math.max(...dayWindowTemps).toFixed(1) + cachedUnit : 'n/a';
                }
                if (statAvgAll) {
                    statAvgAll.textContent = Number.isFinite(allAvg) ? allAvg.toFixed(1) + cachedUnit : 'n/a';
                }
                chartStatus.textContent =
                    'Showing next ' + series.length + ' hours  |  Min: ' + minTemp.toFixed(1) + cachedUnit + '  Max: ' + maxTemp.toFixed(1) + cachedUnit + '  |  Avg(09-18): ' + (Number.isFinite(dayAvg) ? dayAvg.toFixed(1) + cachedUnit : 'n/a');
            };

            const loadTemperatureData = async () => {
                chartStatus.textContent = 'Loading forecast...';
                try {
                    const response = await fetch(temperatureApiUrl);
                    if (!response.ok) {
                        throw new Error('Weather API request failed with status ' + response.status + '.');
                    }

                    const payload = await response.json();
                    cachedUnit = payload?.hourly_units?.temperature_2m || '°C';
                    cachedSeries = parseTemperatureSeries(payload);

                    if (!cachedSeries.length) {
                        throw new Error('No temperature points were returned.');
                    }

                    drawTemperatureChart();
                } catch (fetchError) {
                    console.error(fetchError);
                    chartStatus.textContent = 'Could not load temperature forecast.';
                }
            };

            window.addEventListener('resize', () => {
                drawTemperatureChart();
            });

            loadTemperatureData();
        </script>
    </body>
    </html>`;
    });
    context.subscriptions.push(disposable);
}


// This method is called when your extension is deactivated
export function deactivate() { }

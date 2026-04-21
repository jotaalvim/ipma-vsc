"use strict";var j=Object.create;var g=Object.defineProperty;var k=Object.getOwnPropertyDescriptor;var F=Object.getOwnPropertyNames;var $=Object.getPrototypeOf,C=Object.prototype.hasOwnProperty;var U=(e,t)=>{for(var o in t)g(e,o,{get:t[o],enumerable:!0})},x=(e,t,o,r)=>{if(t&&typeof t=="object"||typeof t=="function")for(let a of F(t))!C.call(e,a)&&a!==o&&g(e,a,{get:()=>t[a],enumerable:!(r=k(t,a))||r.enumerable});return e};var v=(e,t,o)=>(o=e!=null?j($(e)):{},x(t||!e||!e.__esModule?g(o,"default",{value:e,enumerable:!0}):o,e)),W=e=>x(g({},"__esModule",{value:!0}),e);var q={};U(q,{activate:()=>N,deactivate:()=>_});module.exports=W(q);var n=v(require("vscode")),i=v(require("fs")),c=v(require("path")),S=v(require("os")),E=require("child_process"),M=require("util"),P=require("playwright"),I=(0,M.promisify)(E.exec),T=c.join(S.homedir(),".ipma-carta-images"),f=c.join(T,"ipma-cartas"),A="weather_output.mp4",B=1200*60*1e3;async function D(){try{return await I("ffmpeg -version"),!0}catch{return!1}}async function O(e,t){let o=c.join(e,`${t}-*.png`),r=c.join(e,A),a=["ffmpeg","-y","-framerate 6",`-pattern_type glob -i '${o}'`,"-c:v libx264","-pix_fmt yuv420p","-movflags +faststart",`'${r}'`].join(" ");return await I(a),r}function R(e){if(i.existsSync(e)){for(let t of i.readdirSync(e))if(t.toLowerCase().endsWith(".png")){let o=c.join(e,t);try{i.unlinkSync(o)}catch{}}}}function V(e){if(!i.existsSync(e))return!1;try{let t=i.statSync(e);return Date.now()-t.mtimeMs<=B}catch{return!1}}async function L(e){let t="https://www.ipma.pt/pt/otempo/prev.numerica/index.jsp",o=await P.chromium.launch({headless:!0}),a=await(await o.newContext()).newPage();i.existsSync(f)||i.mkdirSync(f,{recursive:!0});let l=f;R(l);let p=new Date().toISOString().replace(/[:.]/g,"-"),y=new Set,d=0;a.on("response",async s=>{let m=s.url();if(m.includes("/resources.www/data/previsao/numerica/cartas/")&&m.endsWith(".png")&&!y.has(m)&&s.status()===200){y.add(m);try{let h=await s.body(),w=`${p}-${String(d).padStart(3,"0")}.png`,u=c.join(l,w);i.writeFileSync(u,h),console.log(`Intercepted: ${u}`),d%5===0&&n.window.showWarningMessage(`Downloading weather map images (${d+1})/78 from IPMA. Please wait...`),d++}catch{}}});try{await a.goto(t,{waitUntil:"networkidle",timeout:6e4});let s='img[name="Image5"]';for(let w=0;w<78;w++)await a.waitForSelector(s,{state:"attached"}),await a.click(s),await a.waitForFunction(u=>{let b=document.querySelector(u);return b&&b.naturalWidth>0},s,{timeout:3e4}),await a.waitForTimeout(500);if(d===0)return n.window.showWarningMessage("No map images were downloaded from IPMA."),!1;if(!await D())return n.window.showErrorMessage("ffmpeg is not installed or not in PATH. Install ffmpeg to convert PNG frames into video."),!1;let h=await O(l,p);return e&&n.window.showInformationMessage(`Downloaded ${d} images and generated video: ${h}`),!0}catch(s){return console.error("Error during page navigation:",s),n.window.showErrorMessage("Failed to load IPMA website."),!1}finally{await o.close(),console.log("Browser closed.")}}function N(e){let t=n.commands.registerCommand("ipma-carta.showWeatherMap",async()=>{let o=c.join(f,A);if(!V(o)&&(!await L(!1)||!i.existsSync(o))){n.window.showWarningMessage("Unable to generate an up-to-date weather video.");return}let r=n.window.createWebviewPanel("localVideo","IPMA Weather Map",n.ViewColumn.One,{enableScripts:!0,localResourceRoots:[n.Uri.file(f)]}),a=r.webview.asWebviewUri(n.Uri.file(o)),l="video/mp4";r.webview.onDidReceiveMessage(async p=>{p?.command==="openExternal"&&await n.env.openExternal(n.Uri.file(o))}),r.webview.html=`
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
                <source src="${a}" type="${l}">
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
    </html>`});e.subscriptions.push(t)}function _(){}0&&(module.exports={activate,deactivate});

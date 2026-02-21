import * as vscode from 'vscode';


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




	const reload = vscode.commands.registerCommand('ipma-carta.reloadIPMA', () => {
		vscode.window.showInformationMessage('RELOAD IPMA data!');
	});

	context.subscriptions.push(disposable);
	context.subscriptions.push(reload);
}

// This method is called when your extension is deactivated
export function deactivate() {}

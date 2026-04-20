# ipma-carta

Visual Studio Code extension that loads the IPMA weather forecast map sequence, builds an MP4 animation, and displays it directly in a VS Code webview.

## What It Does

- Adds the command `IPMA Weather Map` (`ipma-carta.showWeatherMap`).
- Downloads forecast map frames from IPMA (PNG sequence).
- Converts frames into `weather_output.mp4` using ffmpeg.
- Caches generated media locally and reuses it while still fresh.
- Opens the result in a VS Code webview with playback controls.

## How It Works

1. Command is triggered from Command Palette.
2. Extension checks whether a cached video already exists and is fresh.
3. If refresh is needed, it launches Chromium with Playwright, captures IPMA map frames, and saves them to local storage.
4. It runs ffmpeg to convert the image sequence into MP4.
5. The MP4 is shown inside VS Code.

## Requirements

- VS Code `1.109.0` or newer.
- Node.js `18+` (recommended for extension development).
- ffmpeg installed and available in `PATH`.

Install ffmpeg:

- macOS (Homebrew): `brew install ffmpeg`
- Ubuntu/Debian: `sudo apt-get install ffmpeg`
- Windows (winget): `winget install Gyan.FFmpeg`

Playwright should install browser binaries with dependencies, but if needed run:

`npx playwright install chromium`

## Storage Location

Generated files are saved at:

`~/.ipma-carta-images/ipma-cartas`

Main output file:

`weather_output.mp4`

## Usage

1. Open Command Palette.
2. Run `IPMA Weather Map`.
3. Wait for the first generation (may take longer on first run).
4. The animation opens in a VS Code panel.

If webview playback fails, use the fallback button to open the video externally.

## Development

Install dependencies:

```bash
npm install
```

Build once:

```bash
npm run compile
```

Watch mode (TypeScript + esbuild):

```bash
npm run watch
```

Package for publishing:

```bash
npm run package
```

## Testing

Compile tests:

```bash
npm run compile-tests
```

Run test suite:

```bash
npm test
```

Continuous test watch:

```bash
npm run watch-tests
```

## Extension Settings

This extension currently does not contribute custom VS Code settings.

## Troubleshooting

- Error: `ffmpeg is not installed or not in PATH`
	Install ffmpeg and restart VS Code.
- No frames downloaded
	The IPMA page structure or network responses may have changed; try again later and check logs.
- Browser launch issues
	Run `npx playwright install chromium` and retry.

## Known Limitations

- Depends on IPMA website structure and resource URLs.
- Requires external ffmpeg binary.
- Refresh behavior is time-based and local-cache dependent.

## Release Notes

See [CHANGELOG.md](CHANGELOG.md) for version history.

# ipma-carta

Visual Studio Code extension that loads the IPMA weather forecast map sequence, builds an MP4 animation, and displays it directly in a VS Code webview.

[gif](media/output.gif)

## Requirements

- VS Code `1.109.0` or newer.
- Node.js `18+` (for development).
- `ffpem`/`ffmpeg` installed and available in `PATH`.

This extension runs `ffmpeg` as a system command (`ffmpeg -version`). It is required on your machine and is not an npm dependency.

Install `ffmpeg`:

- macOS (Homebrew): `brew install ffmpeg`
- Ubuntu/Debian: `sudo apt-get install ffmpeg`
- Windows (winget): `winget install Gyan.FFmpeg`

If Chromium is missing for Playwright:

```bash
npx playwright install chromium
```

## What It Does

- Adds command `IPMA Weather Map` (`ipma-carta.showWeatherMap`).
- Downloads IPMA weather map frames.
- Creates `weather_output.mp4` with `ffmpeg`.
- Reuses a fresh local cache.
- Opens video in a VS Code webview.

## Usage

1. Open Command Palette.
2. Run `IPMA Weather Map`.
3. Wait for the first generation (may take longer on first run).
4. The animation opens in a VS Code panel.

If webview playback fails, use the fallback button to open the video externally.

Output location:

- `~/.ipma-carta-images/ipma-cartas/weather_output.mp4`

## Development

```bash
npm install
```

```bash
npm run compile
```

```bash
npm run watch
```

```bash
npm run package
```

## Testing

```bash
npm run compile-tests
```

```bash
npm test
```

```bash
npm run watch-tests
```

## Troubleshooting

- `ffmpeg is not installed or not in PATH`:
  install `ffmpeg` and restart VS Code.
- No frames downloaded:
  IPMA structure/network may have changed; retry later and check logs.
- Browser launch issues:
  run `npx playwright install chromium`.

## Release Notes

See [CHANGELOG.md](CHANGELOG.md) for version history.

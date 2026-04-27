# ipma-carta

Visual Studio Code extension that loads the IPMA weather forecast map sequence, builds an MP4 animation, and displays it directly in a VS Code webview.

![ipmagif](https://github.com/jotaalvim/ipma-vsc/blob/main/ipma-carta/media/output.gif)

## Requirements

- `ffpem`/`ffmpeg` installed and available in `PATH`.

It is required on your machine and is not an npm dependency.


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


## Troubleshooting

- `ffmpeg is not installed or not in PATH`:
  install `ffmpeg` and restart VS Code.
- No frames downloaded:
  IPMA structure/network may have changed; retry later and check logs.
- Browser launch issues:
  run `npx playwright install chromium`.


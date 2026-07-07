# dzc's translator

A Chrome extension for translating selected text or webpage content.

## Features

- Translate selected text on a webpage.
- Translate visible webpage content.
- Choose replacement mode or bilingual comparison mode.
- Use MyMemory as the default free translation provider.
- Configure an OpenAI-compatible model provider with a custom base URL, API key, model name, and API mode.
- Includes extension icons in multiple Chrome-ready sizes.

## Install Locally

1. Open Chrome and visit `chrome://extensions`.
2. Enable `Developer mode`.
3. Click `Load unpacked`.
4. Select this project folder.

After changing files, click `Reload` for this extension on `chrome://extensions`.

## Model Provider Setup

Open the extension popup and click `设置`.

For OpenAI-compatible providers, fill:

- `API Base URL`
- `API Key`
- `Model`
- `API Mode`: `Chat Completions` or `Responses API`

Do not commit real API keys or private proxy URLs to this repository.

## Files

- `manifest.json`: Chrome extension manifest.
- `popup.html` / `popup.js`: Extension popup UI.
- `options.html` / `options.js`: Provider settings UI.
- `content.js`: Webpage text collection and translation rendering.
- `background.js`: Translation provider requests and caching.
- `icons/`: Extension icon assets.

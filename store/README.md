# Chrome Web Store assets

`screenshots/en` and `screenshots/zh` hold 1280x800 24-bit PNGs (the store accepts up to 5 per language).

They are rendered from the real popup, options page and content script with fake data:

```bash
python3 -m http.server 8773            # from the repo root
# then, for each scene n in 1..3 and lang in en|zh:
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new --hide-scrollbars \
  --force-device-scale-factor=1 --window-size=1280,800 --virtual-time-budget=6000 \
  --screenshot=out.png "http://localhost:8773/store/scenes/shot$n.html?lang=$lang"
```

`scenes/stub.js` fakes the `chrome` API; `scenes/dark.js` forces the dark palette (headless Chrome ignores the OS theme).

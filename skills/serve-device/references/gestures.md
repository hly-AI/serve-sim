# Gestures

Same JSON shape as serve-sim. Coordinates are normalized **0..1**.

```bash
npx serve-device gesture '[
  {"type":"begin","x":0.5,"y":0.8},
  {"type":"move","x":0.5,"y":0.2},
  {"type":"end","x":0.5,"y":0.2}
]' -d <udid>
```

On device, gestures are executed via **WebDriverAgent** (drag collapsed from begin→end). Prefer `tap` for single taps:

```bash
npx serve-device tap 0.5 0.5 -d <udid>
```

Hardware buttons: only `home` is supported in v1 via WDA. `lock` / `siri` / `apple-pay` / `side-button` return an explicit unsupported error.

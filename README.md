# pm all in one

Local-first project manager: workspace data lives as Markdown and directories on disk; collaboration is git.

This repository is the **product** home (macOS app + `local-pm` CLI). Daily development currently still also lives inside a private vault checkout; this remote is the dedicated Release / packaging target.

## Develop

```sh
cd space/app
npm install
npm run dev   # Electron window — not the bare Vite tab
```

## Package

```sh
cd space/app
npm run package:mac
```

Artifacts land in `space/app/release/`.

## Names

| Surface | Value |
| --- | --- |
| Display | pm all in one |
| Repo / slug | `pm-all-in-one` |
| CLI | `local-pm` |

# pm-all-in-one (Cursor)

Open a **pm-all-in-one** project library inside Cursor. The workspace is a directory of files (issues, wiki, members, handoffs) next to your code. This extension is a Cursor host for that directory — not a clone of the macOS app.

Extension id: `wenchuanlilizhao.pm-all-in-one`  
Registry: Open VSX — https://open-vsx.org/extension/wenchuanlilizhao/pm-all-in-one (Cursor’s extension panel reads this registry, not the Visual Studio Marketplace)

## Install

In Cursor: Extensions → search **pm-all-in-one** → install **wenchuanlilizhao.pm-all-in-one**.

Sideload a local build: Command Palette → **Extensions: Install from VSIX…**, then **Developer: Reload Window**.

## Use

1. Open a folder that already is a pm-all-in-one workspace (it contains a `.pmws` marker at the root).
2. Command Palette → **pm-all-in-one: Open in pm-all-in-one**, or right-click `.pmws` / a node `README.md`.
3. To start a new library: Explorer → right-click a folder → **New PM Workspace…**

Left-click still navigates inside the current PM tab. Right-click a node row to open it in another Cursor tab.

## Not in this host

Cursor already owns the terminal, window chrome, and git UI. This extension does not ship the Electron terminal, Mac title bar, Lab window, or the `pm-all-in-one` CLI. Install the CLI from npm if you want allocator commands in a shell: [`pm-all-in-one`](https://www.npmjs.com/package/pm-all-in-one).

## License

MIT. Source: [WenchuanLiliZhao/pm-all-in-one](https://github.com/WenchuanLiliZhao/pm-all-in-one).

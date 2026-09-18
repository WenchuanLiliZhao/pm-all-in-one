const Module = require("node:module");
const path = require("node:path");
const fs = require("node:fs");

const extDir = path.resolve(__dirname, "..");
const vscode = {
  window: {
    registerCustomEditorProvider() {
      return { dispose() {} };
    },
    showErrorMessage() {},
    showWarningMessage: async () => undefined,
    showOpenDialog: async () => undefined,
  },
  commands: {
    registerCommand() {
      return { dispose() {} };
    },
    executeCommand: async () => undefined,
  },
  env: { openExternal: async () => true },
  Uri: {
    file: (p) => ({ fsPath: p }),
    joinPath: (base, ...rest) => ({
      fsPath: path.join(base.fsPath ?? base, ...rest),
    }),
  },
};

const orig = Module._load;
Module._load = function (request, parent, isMain) {
  if (request === "vscode") {
    return vscode;
  }
  return orig.apply(this, arguments);
};

const { activate } = require("../out/extension.js");
const storage = "/tmp/pm-ext-activate-storage";
fs.mkdirSync(storage, { recursive: true });
activate({
  globalStorageUri: { fsPath: storage },
  extensionPath: extDir,
  extensionUri: { fsPath: extDir },
  subscriptions: { push() {} },
});
console.log("activate ok");
console.log("LOCAL_PM_USER_DATA", process.env.LOCAL_PM_USER_DATA);
console.log("template", process.env.LOCAL_PM_WORKSPACE_TEMPLATE);
console.log(
  "template exists",
  fs.existsSync(process.env.LOCAL_PM_WORKSPACE_TEMPLATE),
);

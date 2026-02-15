import * as vscode from "vscode";

/**
 * Maximally distinct colors — spread across hue AND lightness.
 * No green, yellow, or red. Each pair is unmistakable at a glance.
 * Each entry: [background, foreground (for contrast)].
 */
const PALETTE: [string, string][] = [
  ["#0D0D6F", "#FFFFFF"], // midnight indigo (very dark blue)
  ["#FF6B00", "#000000"], // vivid orange (bright warm)
  ["#00E5FF", "#000000"], // electric cyan (bright cool)
  ["#99004D", "#FFFFFF"], // deep magenta (dark warm)
  ["#B388FF", "#000000"], // soft lavender (light purple)
  ["#004D40", "#FFFFFF"], // dark teal (very dark cool)
  ["#FF69B4", "#000000"], // hot pink (bright warm)
  ["#0055CC", "#FFFFFF"], // strong blue (medium dark)
  ["#FF9E00", "#000000"], // amber (light warm)
  ["#E040FB", "#000000"], // vivid fuchsia (bright cool-warm)
  ["#1A237E", "#FFFFFF"], // deep navy (very dark)
  ["#00BFA5", "#000000"], // bright teal (light cool)
];

const PALETTE_NAMES = [
  "Midnight Indigo",
  "Vivid Orange",
  "Electric Cyan",
  "Deep Magenta",
  "Soft Lavender",
  "Dark Teal",
  "Hot Pink",
  "Strong Blue",
  "Amber",
  "Vivid Fuchsia",
  "Deep Navy",
  "Bright Teal",
];

/**
 * Simple string hash (djb2). Deterministic, fast, no crypto needed.
 */
function hash(str: string): number {
  let h = 5381;
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) + h + str.charCodeAt(i)) >>> 0;
  }
  return h;
}

function getWorkspaceName(): string | undefined {
  const folders = vscode.workspace.workspaceFolders;
  if (!folders || folders.length === 0) {
    return undefined;
  }
  return folders[0].uri.path.split("/").pop();
}

function colorIndexForName(name: string): number {
  return hash(name) % PALETTE.length;
}

export function activate(context: vscode.ExtensionContext) {
  const name = getWorkspaceName();
  const override = context.workspaceState.get<number>("agentColor.override");
  const index =
    override !== undefined
      ? override
      : name
        ? colorIndexForName(name)
        : undefined;

  if (index === undefined) {
    return;
  }

  const [bg] = PALETTE[index % PALETTE.length];
  const colorName = PALETTE_NAMES[index % PALETTE.length];

  // --- 1. Colored top border on every editor (the "header" bar) ---
  const topBorderDecoration = vscode.window.createTextEditorDecorationType({
    isWholeLine: true,
    borderWidth: "6px 0 0 0",
    borderStyle: "solid",
    borderColor: bg,
  });
  context.subscriptions.push(topBorderDecoration);

  function applyDecorations(editor: vscode.TextEditor) {
    if (editor.document.uri.scheme === "output") {
      return;
    }
    const topLine = new vscode.Range(0, 0, 0, 0);
    editor.setDecorations(topBorderDecoration, [topLine]);
  }

  // Apply to all currently visible editors
  for (const editor of vscode.window.visibleTextEditors) {
    applyDecorations(editor);
  }

  // Apply when editors change
  context.subscriptions.push(
    vscode.window.onDidChangeVisibleTextEditors((editors) => {
      for (const editor of editors) {
        applyDecorations(editor);
      }
    })
  );

  // Re-apply when a document opens (covers new tabs)
  context.subscriptions.push(
    vscode.window.onDidChangeActiveTextEditor((editor) => {
      if (editor) {
        applyDecorations(editor);
      }
    })
  );

  // --- 2. Colored status bar indicator ---
  const statusItem = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Left,
    Number.MAX_SAFE_INTEGER // pin to far left
  );
  statusItem.text = `$(circle-filled) ${colorName}`;
  statusItem.color = bg;
  statusItem.tooltip = `Agent Color: ${colorName} (${bg})`;
  statusItem.command = "agentColor.reroll";
  statusItem.show();
  context.subscriptions.push(statusItem);

  // --- Commands ---
  context.subscriptions.push(
    vscode.commands.registerCommand("agentColor.reroll", () => {
      const base = name ? colorIndexForName(name) : 0;
      const offset = 1 + Math.floor(Math.random() * (PALETTE.length - 1));
      const newIndex = (base + offset) % PALETTE.length;
      context.workspaceState.update("agentColor.override", newIndex);
      vscode.window
        .showInformationMessage("Agent Color: switched — reload to apply", "Reload")
        .then((choice) => {
          if (choice === "Reload") {
            vscode.commands.executeCommand("workbench.action.reloadWindow");
          }
        });
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("agentColor.clear", () => {
      context.workspaceState.update("agentColor.override", undefined);
      vscode.window
        .showInformationMessage("Agent Color: cleared — reload to apply", "Reload")
        .then((choice) => {
          if (choice === "Reload") {
            vscode.commands.executeCommand("workbench.action.reloadWindow");
          }
        });
    })
  );
}

export function deactivate() {}

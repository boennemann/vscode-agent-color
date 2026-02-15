import * as vscode from "vscode";

/**
 * Vivid, highly distinct colors — no green, yellow, or red.
 * Each entry: [background, foreground (for contrast)].
 */
const PALETTE: [string, string][] = [
  ["#8B5CF6", "#FFFFFF"], // vivid purple
  ["#EC4899", "#FFFFFF"], // hot pink
  ["#06B6D4", "#000000"], // electric cyan
  ["#F97316", "#000000"], // burnt orange
  ["#6366F1", "#FFFFFF"], // indigo
  ["#D946EF", "#FFFFFF"], // fuchsia / magenta
  ["#0EA5E9", "#000000"], // sky blue
  ["#14B8A6", "#000000"], // teal
  ["#A855F7", "#FFFFFF"], // amethyst
  ["#F472B6", "#000000"], // flamingo pink
  ["#2563EB", "#FFFFFF"], // royal blue
  ["#E879F9", "#000000"], // orchid
];

const STATE_KEY = "agentColor.index";

function applyColor(
  index: number
): void {
  const [bg, fg] = PALETTE[index % PALETTE.length];

  // Slightly darken the title bar for the active state, lighten for inactive
  const config = vscode.workspace.getConfiguration("workbench");
  const colors: Record<string, string> = {
    "titleBar.activeBackground": bg,
    "titleBar.activeForeground": fg,
    "titleBar.inactiveBackground": bg + "CC", // 80% opacity
    "titleBar.inactiveForeground": fg + "AA",
    "statusBar.background": bg,
    "statusBar.foreground": fg,
    "statusBar.debuggingBackground": bg,
    "statusBar.debuggingForeground": fg,
    "statusBar.noFolderBackground": bg,
    "statusBar.noFolderForeground": fg,
  };

  config.update(
    "colorCustomizations",
    { ...getExistingCustomizations(), ...colors },
    vscode.ConfigurationTarget.Workspace
  );
}

function clearColor(): void {
  const config = vscode.workspace.getConfiguration("workbench");
  const existing = getExistingCustomizations();
  const keysToRemove = [
    "titleBar.activeBackground",
    "titleBar.activeForeground",
    "titleBar.inactiveBackground",
    "titleBar.inactiveForeground",
    "statusBar.background",
    "statusBar.foreground",
    "statusBar.debuggingBackground",
    "statusBar.debuggingForeground",
    "statusBar.noFolderBackground",
    "statusBar.noFolderForeground",
  ];
  for (const key of keysToRemove) {
    delete existing[key];
  }
  config.update(
    "colorCustomizations",
    Object.keys(existing).length > 0 ? existing : undefined,
    vscode.ConfigurationTarget.Workspace
  );
}

function getExistingCustomizations(): Record<string, string> {
  const config = vscode.workspace.getConfiguration("workbench");
  return { ...(config.get<Record<string, string>>("colorCustomizations") || {}) };
}

/**
 * Pick a random index that hasn't been used recently (best-effort).
 * We store used indices in global state so consecutive windows get different colors.
 */
function pickIndex(context: vscode.ExtensionContext): number {
  const used = context.globalState.get<number[]>("agentColor.usedIndices") || [];
  const available = Array.from({ length: PALETTE.length }, (_, i) => i).filter(
    (i) => !used.includes(i)
  );
  const pool = available.length > 0 ? available : Array.from({ length: PALETTE.length }, (_, i) => i);
  const index = pool[Math.floor(Math.random() * pool.length)];

  // Keep a rolling window of last N used indices
  const updatedUsed = [...used, index].slice(-Math.floor(PALETTE.length * 0.75));
  context.globalState.update("agentColor.usedIndices", updatedUsed);

  return index;
}

export function activate(context: vscode.ExtensionContext) {
  // Check if this workspace already has an assigned color
  let index = context.workspaceState.get<number>(STATE_KEY);

  if (index === undefined) {
    index = pickIndex(context);
    context.workspaceState.update(STATE_KEY, index);
  }

  applyColor(index);

  // Command: pick a new random color
  context.subscriptions.push(
    vscode.commands.registerCommand("agentColor.reroll", () => {
      const newIndex = pickIndex(context);
      context.workspaceState.update(STATE_KEY, newIndex);
      applyColor(newIndex);
      const [bg] = PALETTE[newIndex % PALETTE.length];
      vscode.window.showInformationMessage(`Agent Color: switched to ${bg}`);
    })
  );

  // Command: clear the color
  context.subscriptions.push(
    vscode.commands.registerCommand("agentColor.clear", () => {
      context.workspaceState.update(STATE_KEY, undefined);
      clearColor();
      vscode.window.showInformationMessage("Agent Color: cleared");
    })
  );
}

export function deactivate() {}

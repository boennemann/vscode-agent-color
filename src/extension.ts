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

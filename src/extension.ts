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
  // Use the last segment of the workspace folder path (the folder/worktree name)
  return folders[0].uri.path.split("/").pop();
}

function colorIndexForName(name: string): number {
  return hash(name) % PALETTE.length;
}

function applyColor(index: number): void {
  const [bg, fg] = PALETTE[index % PALETTE.length];

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

export function activate(context: vscode.ExtensionContext) {
  const name = getWorkspaceName();
  if (name) {
    applyColor(colorIndexForName(name));
  }

  // Command: clear the color
  context.subscriptions.push(
    vscode.commands.registerCommand("agentColor.clear", () => {
      clearColor();
      vscode.window.showInformationMessage("Agent Color: cleared");
    })
  );

  // Command: reroll — pick a random offset and persist it
  context.subscriptions.push(
    vscode.commands.registerCommand("agentColor.reroll", () => {
      const base = name ? colorIndexForName(name) : 0;
      const offset = 1 + Math.floor(Math.random() * (PALETTE.length - 1));
      const newIndex = (base + offset) % PALETTE.length;
      context.workspaceState.update("agentColor.override", newIndex);
      applyColor(newIndex);
      vscode.window.showInformationMessage("Agent Color: switched");
    })
  );

  // Check for a manual override from a previous reroll
  const override = context.workspaceState.get<number>("agentColor.override");
  if (override !== undefined) {
    applyColor(override);
  }
}

export function deactivate() {}

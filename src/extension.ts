import * as vscode from "vscode";
import { spawnSync } from "child_process";

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

const SETTINGS_PATH = ".vscode/settings.json";

const COLOR_KEYS = [
  "titleBar.activeBackground",
  "titleBar.activeForeground",
  "titleBar.inactiveBackground",
  "titleBar.inactiveForeground",
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

function getWorkspaceRoot(): string | undefined {
  const folders = vscode.workspace.workspaceFolders;
  if (!folders || folders.length === 0) {
    return undefined;
  }
  return folders[0].uri.fsPath;
}

function colorIndexForName(name: string): number {
  return hash(name) % PALETTE.length;
}

function getExistingCustomizations(): Record<string, string> {
  const config = vscode.workspace.getConfiguration("workbench");
  return {
    ...(config.get<Record<string, string>>("colorCustomizations") || {}),
  };
}

function applyTitleBarColor(bg: string, fg: string): void {
  const config = vscode.workspace.getConfiguration("workbench");
  const colors: Record<string, string> = {
    "titleBar.activeBackground": bg,
    "titleBar.activeForeground": fg,
    "titleBar.inactiveBackground": bg + "CC",
    "titleBar.inactiveForeground": fg + "AA",
  };
  config.update(
    "colorCustomizations",
    { ...getExistingCustomizations(), ...colors },
    vscode.ConfigurationTarget.Workspace
  );
}

function clearTitleBarColor(): void {
  const config = vscode.workspace.getConfiguration("workbench");
  const existing = getExistingCustomizations();
  for (const key of COLOR_KEYS) {
    delete existing[key];
  }
  config.update(
    "colorCustomizations",
    Object.keys(existing).length > 0 ? existing : undefined,
    vscode.ConfigurationTarget.Workspace
  );
}

/**
 * Make .vscode/settings.json invisible to git.
 *
 * - If the file is NOT tracked: add to .git/info/exclude
 * - If the file IS tracked: use skip-worktree to hide local changes
 *
 * Both approaches leave git status completely clean and preserve the
 * committed version of the file.
 */
function hideFromGit(workspaceRoot: string): void {
  try {
    const isTracked =
      spawnSync("git", ["ls-files", "--error-unmatch", SETTINGS_PATH], {
        cwd: workspaceRoot,
        stdio: "pipe",
      }).status === 0;

    if (isTracked) {
      // File is tracked — tell git to ignore our local modifications.
      // The committed version stays untouched; git status stays clean.
      spawnSync(
        "git",
        ["update-index", "--skip-worktree", SETTINGS_PATH],
        { cwd: workspaceRoot, stdio: "pipe" }
      );
    } else {
      // File is not tracked — add to .git/info/exclude (lives inside
      // .git/, never committed, never touches the working tree).
      const fs = require("fs") as typeof import("fs");
      const path = require("path") as typeof import("path");

      // Resolve gitdir (handles worktrees where .git is a file)
      const dotGit = path.join(workspaceRoot, ".git");
      let gitDir: string;
      const stat = fs.statSync(dotGit);
      if (stat.isDirectory()) {
        gitDir = dotGit;
      } else {
        const content = fs.readFileSync(dotGit, "utf8").trim();
        const match = content.match(/^gitdir:\s*(.+)$/);
        if (!match) {
          return;
        }
        gitDir = path.isAbsolute(match[1])
          ? match[1]
          : path.resolve(workspaceRoot, match[1]);
      }

      const infoDir = path.join(gitDir, "info");
      const excludePath = path.join(infoDir, "exclude");

      if (!fs.existsSync(infoDir)) {
        fs.mkdirSync(infoDir, { recursive: true });
      }

      let content = "";
      if (fs.existsSync(excludePath)) {
        content = fs.readFileSync(excludePath, "utf8");
      }

      if (
        !content.split("\n").some((line: string) => line.trim() === SETTINGS_PATH)
      ) {
        const nl = content.length > 0 && !content.endsWith("\n") ? "\n" : "";
        fs.appendFileSync(excludePath, `${nl}${SETTINGS_PATH}\n`);
      }
    }
  } catch {
    // Best-effort — don't break activation if git operations fail
  }
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

  const [bg, fg] = PALETTE[index % PALETTE.length];
  const colorName = PALETTE_NAMES[index % PALETTE.length];

  // --- 1. Color the title bar (writes to .vscode/settings.json) ---
  applyTitleBarColor(bg, fg);

  // --- 2. Hide .vscode/settings.json from git ---
  const root = getWorkspaceRoot();
  if (root) {
    hideFromGit(root);
  }

  // --- 3. Status bar indicator (click to reroll) ---
  const statusItem = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Left,
    Number.MAX_SAFE_INTEGER
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
      const [newBg, newFg] = PALETTE[newIndex % PALETTE.length];
      applyTitleBarColor(newBg, newFg);
      if (root) {
        hideFromGit(root);
      }
      statusItem.text = `$(circle-filled) ${PALETTE_NAMES[newIndex % PALETTE.length]}`;
      statusItem.color = newBg;
      vscode.window.showInformationMessage(
        `Agent Color: ${PALETTE_NAMES[newIndex % PALETTE.length]}`
      );
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("agentColor.clear", () => {
      context.workspaceState.update("agentColor.override", undefined);
      clearTitleBarColor();
      statusItem.hide();
      vscode.window.showInformationMessage("Agent Color: cleared");
    })
  );
}

export function deactivate() {}

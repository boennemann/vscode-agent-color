import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";
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

const EXCLUDE_ENTRY = ".vscode/settings.json";

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

function applyColor(index: number): void {
  const [bg, fg] = PALETTE[index % PALETTE.length];

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
 * Resolve the .git directory for the workspace. Handles both normal repos
 * (where .git is a directory) and worktrees (where .git is a file pointing
 * to the actual gitdir).
 */
function resolveGitDir(workspaceRoot: string): string | undefined {
  const dotGit = path.join(workspaceRoot, ".git");
  try {
    const stat = fs.statSync(dotGit);
    if (stat.isDirectory()) {
      return dotGit;
    }
    // Worktree: .git is a file like "gitdir: /path/to/.git/worktrees/name"
    const content = fs.readFileSync(dotGit, "utf8").trim();
    const match = content.match(/^gitdir:\s*(.+)$/);
    if (match) {
      const gitdir = match[1];
      return path.isAbsolute(gitdir) ? gitdir : path.resolve(workspaceRoot, gitdir);
    }
  } catch {
    // No .git — not a git repo
  }
  return undefined;
}

/**
 * Add .vscode/settings.json to .git/info/exclude so our color settings
 * never show up in git status. This file lives inside .git/ so it never
 * touches the working tree.
 */
function ensureGitExclude(workspaceRoot: string): void {
  const gitDir = resolveGitDir(workspaceRoot);
  if (!gitDir) {
    return;
  }

  const infoDir = path.join(gitDir, "info");
  const excludePath = path.join(infoDir, "exclude");

  try {
    // Check if the file is already tracked by git — if so, exclude won't help
    // and we shouldn't touch it
    const trackedCheck = spawnSync(
      "git",
      ["ls-files", "--error-unmatch", EXCLUDE_ENTRY],
      { cwd: workspaceRoot, stdio: "pipe" }
    );
    if (trackedCheck.status === 0) {
      // File is tracked, skip — exclude has no effect on tracked files
      return;
    }

    // Ensure info/ directory exists
    if (!fs.existsSync(infoDir)) {
      fs.mkdirSync(infoDir, { recursive: true });
    }

    // Read existing exclude file
    let content = "";
    if (fs.existsSync(excludePath)) {
      content = fs.readFileSync(excludePath, "utf8");
    }

    // Add our entry if not already present
    if (!content.split("\n").some((line) => line.trim() === EXCLUDE_ENTRY)) {
      const newline = content.length > 0 && !content.endsWith("\n") ? "\n" : "";
      fs.appendFileSync(excludePath, `${newline}${EXCLUDE_ENTRY}\n`);
    }
  } catch {
    // Best-effort — don't break activation if this fails
  }
}

export function activate(context: vscode.ExtensionContext) {
  const name = getWorkspaceName();
  const root = getWorkspaceRoot();

  if (root) {
    ensureGitExclude(root);
  }

  // Check for a manual override from a previous reroll
  const override = context.workspaceState.get<number>("agentColor.override");
  if (override !== undefined) {
    applyColor(override);
  } else if (name) {
    applyColor(colorIndexForName(name));
  }

  context.subscriptions.push(
    vscode.commands.registerCommand("agentColor.clear", () => {
      context.workspaceState.update("agentColor.override", undefined);
      clearColor();
      vscode.window.showInformationMessage("Agent Color: cleared");
    })
  );

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
}

export function deactivate() {}

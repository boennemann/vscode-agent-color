# Agent Color

Gives each VS Code / Cursor window a unique, vivid title bar and status bar color so you can instantly tell agent windows apart.

No more "wait, which window was that?" — each instance gets its own bold color identity.

## Palette

12 vivid colors, carefully chosen to be visually distinct. No green, yellow, or red — just colors that pop:

Vivid Purple · Hot Pink · Electric Cyan · Burnt Orange · Indigo · Fuchsia · Sky Blue · Teal · Amethyst · Flamingo · Royal Blue · Orchid

## How It Works

- On activation, the extension assigns a random color to your window's **title bar** and **status bar**
- The color sticks per workspace (persisted in workspace state)
- Consecutive windows automatically get different colors
- Colors are applied via `workbench.colorCustomizations` at the workspace level

## Commands

Open the Command Palette and run:

| Command | Description |
|---|---|
| `Agent Color: Pick a New Color` | Reroll to a different color |
| `Agent Color: Clear Color` | Remove the coloring entirely |

## Install

Install from the [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=boennemann.agent-color), or grab a `.vsix` from [GitHub Releases](https://github.com/boennemann/vscode-agent-color/releases) and install via *Extensions → ··· → Install from VSIX*.

## License

MIT

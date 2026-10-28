# PROTOTYPE, throwaway: the brand pane and status line (Mod)

Answers wayfinder ticket [#22](https://github.com/Ahmadnmic/Brand-OS-wayfinder/issues/22): what should the Brand OS Mod look like? This branch is never merged. Main keeps only the decisions.

## What it is

A Claude Code mod (`hooks/register.tsx`) plus a stub Brand OS MCP server (`server/stub-server.mjs`) serving a fictional brand, Fjord Studio. The pane has three variants you switch between with buttons:

- **A Brand card:** the logo, light and dark colour pairs, type, References, and a Brand Check summary.
- **B Health first:** on brand or N off-brand, the newer-version notice, findings with file:line, Re-check, and other brands, including a refused one.
- **C Token inspector:** a filter box and every token with its CSS variable and its light and dark values.

There are also three status-line styles (minimal, full, alerts) and two swatch renderings (Svg, Box `backgroundColor`). `check_brand` really scans the project for hex literals.

`server/fixture.json` is a snapshot of the stub's results. The mod falls back to it when the session's permission mode refuses the mod's own MCP calls (see the findings below). The snapshot's Brand Check was taken on this repo.

## Run it

Copy this folder to a mod folder (or start Claude Code with `--plugin-dir prototypes/brand-mod`), turn mods on, then type `/brand`. Check it with `claude plugin validate prototypes/brand-mod`.

## Verdict

Built and run in the desktop Code tab on Claude Code 2.1.304. Decisions Q73 to Q82 are on #22's resolution:

- One pane, top to bottom: Health, then the Brand card, then All tokens behind a toggle.
- The status line shows `◆ <Active Brand>`, with off-brand count and newer version appended only when present.
- Light and dark colours are shown as pairs, with no mode toggle.
- Findings are links, with no fix button.
- The pane shows only the Active Brand and offers no brand switching.
- The pane opens only through `/brand`.
- The Mod targets desktop, and the terminal gets a plain-text version.

## Findings

- `$.mcp.call` takes `plugin:<plugin>:<server>` for a plugin-shipped stdio server. Here that was `plugin:brand-os-proto:brand-os`, the string `$.mcp.connect` returned.
- In auto mode, a mod's own `$.mcp.call` goes through the permission classifier. This happens even though the API docs say a plugin's call needs no prompt. The classifier gave "no verdict" on `list_brands` twice, and the call was refused. A mod hook that answers `tool.check` with `allow` for its own tools is treated as an auto-mode bypass. Brand OS therefore needs an allow rule for its read-only tools at install.

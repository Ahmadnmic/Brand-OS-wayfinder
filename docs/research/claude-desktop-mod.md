# Research: what a Claude desktop Mod can do and how it ships

Ticket: [#11](https://github.com/Ahmadnmic/Brand-OS-wayfinder/issues/11). All
sources observed 2026-10-27. The mod API is marked "EARLY ACCESS: this surface
may change between releases without notice" [types], so re-check the version
floor before building.

Citation keys in square brackets are expanded under Sources. `[skill]` is the
text the `plugin-authoring` skill loaded in this session; `[reference.md]` its
long form; `[types]` the `claude-code.d.ts` the engine wrote beside it ("Written
by Claude Code 2.1.304"); `[ex:*]` its example files; `[nm-mods *]` the local
example repository, read only. `[overview]`, `[create]`, `[interface]`,
`[events]`, `[api]`, `[reference]`, `[troubleshoot]`, `[admin]`, `[install]`,
`[components]`, `[manifest]`, `[desktop]`, `[statusline]` are pages of
Anthropic's Claude Code docs at code.claude.com. The ticket's
`docs.claude.com/en/docs/claude-code/...` addresses redirect there (observed:
`https://docs.claude.com/en/docs/claude-code/plugins` served
`https://code.claude.com/docs/en/plugins`).

## Question

What can a Mod change in the Claude desktop app (panes or panels beside the chat
that stay and update, bands, status line, toasts, slash commands, hooks on tool
calls), how is one built (files, manifest, the hooks module, how a pane gets data
such as the current project's `brand-os.json` or an MCP result), how is it
packaged, and can it be distributed inside a Claude Code plugin (so one install
brings the Mod) or does it need a separate install step? What are its limits
(what it cannot see or do), and how does a Mod read project files or call tools?

## Summary

- A Mod is an ordinary Claude Code plugin whose `hooks/hooks.json` names a
  JavaScript/TypeScript "hooks module" under `modules`; its functions run inside
  Claude Code and are the one plugin component that can draw UI [overview]
  [reference]. It runs in the terminal, in the desktop app's Code tab (local and
  SSH sessions, not WSL) and in VS Code; in `claude -p`, the SDK and cloud
  sessions its hooks run but nothing it draws shows [overview].
- It can draw a Pane (sidebar beside the transcript, or a framed region above
  the prompt), the one shared band above the prompt, a per-plugin status line
  under the prompt (`$.ui.status`), toasts (`$.ui.toast`), a dim transcript line,
  and it can redraw engine sites (spinner, tool rows, messages, the question
  dialog). It cannot change the permission prompt [overview] [reference].
- It hooks events as middleware: `on('tool.call', { tool }, ($, e, next) => ...)`
  observes, rewrites (`next({ ...e, ... })`), denies (`{ deny }`) or answers
  (`{ result }`); `tool.check` returns `allow`/`ask`/`deny`; plus prompt, turn,
  session, UI and `classic.<SettingsHookEvent>` events, and every `$` call is
  itself an event [events] [reference].
- Three files make a Mod: `.claude-plugin/plugin.json`, `hooks/hooks.json`
  (`{ "modules": ["./register.tsx"] }`), `hooks/register.tsx` exporting
  `register(on, options)`; a fourth, `types/index.d.ts` named by `"types"` in
  the manifest, when it keeps values in `$.state`. No bundler or build step; no
  Node and no DOM, everything outside goes through `$` [skill] [create].
- A pane gets data through `$`: `$.fs.read/exists/stat/list/ancestors` (paths
  relative to the session's working directory, 4 MiB cap), `$.session.cwd()` and
  `$.session.root()`, `$.process.run`, `$.http.fetch`, and MCP via
  `$.mcp.call(server, tool, args)` (engine's own connection, no permission
  prompt) or `$.tool.call({ tool: 'mcp__...' })`. It refreshes through reactive
  `$.state` atoms, `$.ui.invalidate('ui.render')`, `$.clock.every`, and events
  such as `classic.CwdChanged`; the types declare no file watcher [types] [api].
- One install brings the Mod: "A plugin can hold all of them, so a mod can ship
  in the same plugin as a skill and an MCP server", and a plugin that contains a
  mod installs, scopes and updates like any other plugin, in the desktop app via
  "+ next to the prompt box, then Add plugins" [overview] [install] [desktop].
  A user-scope install is shared by the terminal, the desktop app's local
  sessions and VS Code on that machine [install].
- Version floor: terminal Claude Code 2.1.287+, the desktop app's own copy of
  Claude Code 2.1.286+ (`/status` in the Code tab shows it) [overview]. On this
  machine: terminal `claude --version` 2.1.294; the desktop-bundled build that
  wrote the types is 2.1.304 (observed).
- Limits: a Mod runs with the user's permissions and is not sandboxed (files,
  processes, network, env vars, every prompt and tool call); permission rules do
  not cover its own `$.fs`/`$.process` calls; a hook gets 10 s of its own time;
  trees are capped (32 levels, 20,000 elements); an org can block user mods
  (`allowManagedModsOnly`, `disableAllHooks`, `disableSideloadFlags`) [overview]
  [admin] [reference].
- Desktop drawing: the desktop element table is `Box, Text, Button, Input,
  Select, Svg, Link, Code, Markdown, Client` (no `Raster`/`Image`); a `Link`
  draws as plain text unless `https:` or `http://localhost`; `$.ui.notify`
  answers `no-surface` there [types] [interface] [api].
- Open points for Brand OS: the exact `server` string `$.mcp.call` takes for a
  plugin-shipped server, whether hex colours render as swatches on desktop, how
  the mod status line and toasts are placed on the desktop surface, and whether
  `/plugin` commands run in the current desktop build (sources disagree).

## Findings

### What a Mod is and what it can change

A mod is "a plugin that changes how Claude Code looks and behaves. It's made of
JavaScript or TypeScript event handlers: Claude Code calls one when an event
happens, such as a tool call, a submitted prompt, or a part of the interface
being drawn, and the handler can watch the event, change it, or take it over"
[overview]. The docs call both kinds "hooks": a mod's handler is a "hook", the
settings-file kind a "settings hook" [overview].

What it can do that settings hooks, skills, status lines and MCP servers cannot
("each one runs a script, or gives Claude text or tools" from outside; a mod
"runs inside Claude Code") [overview]:

- "Draw an interface you can use: a pane beside the transcript or a band above
  the prompt, with tabs, buttons, and text fields."
- "Redraw Claude Code's own interface: replace or restyle parts Claude Code draws
  itself, such as a tool call's row, the spinner, or the dialog Claude asks
  questions in."
- "Step into a tool call or a request", e.g. "hold a tool call while you ask the
  user a question, answer it without running the tool, or send one request to a
  different model."
- "Run your own code on a command: a `/command` that runs your function at once,
  with no Claude turn, even while Claude is working."
- "Share data between hooks."

Render sites a `ui.render` hook can draw, with the surfaces that render them
[reference, Render sites]: `Pane` (Terminal, Desktop, VS Code); `AbovePrompt`
(Terminal, Desktop); `UserMessage`, `AssistantMessage`, `ToolUse`/`ToolResult`/
`ToolGroup`, `AskUserQuestion`, `Spinner` (Terminal, Desktop, VS Code);
`CommandOutput`, `SessionMode`, `PromptHint` (Terminal, Desktop);
`ToolProgress`, `TurnDuration`, `InfoNotice` (Terminal only). "A mod can restyle
much of Claude Code's interface, but not the permission prompt. It can't change
what a prompt shows you" [overview].

Where mods run [overview, "Where mods run"]: terminal: hooks yes, draws yes; "The
Code tab of the Desktop app, except in a WSL session": hooks yes, draws "Yes,
except elements the elements table marks terminal-only"; WSL session in the
desktop app: no ("plugins aren't available in WSL sessions"); VS Code chat
panel: yes with extension 2.1.299+; `claude -p` and the Agent SDK: hooks yes,
draws no; cloud session: hooks yes "for a plugin that reaches the cloud
session", draws no. "A mod that draws can check which app it's running in, and
fall back to a line in the transcript or a command's text reply where nothing
draws" [overview].

The desktop app's Code tab "runs its own copy of Claude Code, which has its own
version number. The desktop app downloads and updates that copy, so it can
differ from the `claude` command in your terminal" [desktop, "Claude Code
version in the Code tab"]. Observed on this machine: terminal `claude --version`
printed `2.1.294 (Claude Code)`; the types file the skill laid down in this
desktop-hosted session begins "Written by Claude Code 2.1.304" [types].

In the Brand OS glossary a Mod is "Brand OS's change to the Claude desktop app
itself: a brand pane and a status-line indicator. Claude only" [GLOSSARY]. Both
pieces map onto the API above: a `Pane` plus `$.ui.status`.

### File layout and manifest

The skill states the layout exactly [skill, "WHERE TO WRITE IT"]:

- `.claude-plugin/plugin.json`:
  `{ "name": "<mod-name>", "version": "0.1.0", "description": "<one line>" }`
- `hooks/hooks.json`: `{ "modules": ["./register.tsx"] }`, "one path, relative
  to that file"
- `hooks/register.tsx` (or `.ts`): "the hooks module,
  `export const register: Register = (on, options) => { ... }`, the type
  imported from `'claude-code'`"
- "A mod that keeps values in `$.state` has a fourth file, `types/index.d.ts`:
  its type contract, declaring each value in `interface PluginState` under the
  mod's name, named in `plugin.json` as `"types": "./types/index.d.ts"`. The
  module imports its value types from `'../types'`, and `claude plugin validate`
  holds every `$.state` key the module names to that contract."

The docs' files table agrees [reference, Files]: `.claude-plugin/plugin.json`
required ("Mods add no required fields"); `hooks/hooks.json` required, `modules`
"an array with one path, relative to this file", and it "Can also hold settings
hooks under `hooks`"; the hooks module required, "Exports `register(on,
options)`. Named `.js`, `.mjs`, `.cjs`, `.jsx`, `.ts`, `.mts`, `.cts`, or
`.tsx`. An ES module"; `types/index.d.ts` "When the mod uses `$.state` or adds a
namespace to the mods API" ("To leave `types` out of the manifest, you need
v2.1.299 or later"); `*.test.ts`/`*.test.tsx` optional. "`options` holds the
values of the `userConfig` fields the manifest declares, with defaults filled
in" [reference].

Manifest fields that matter here [manifest, Fields]: `name` is the only required
key; `types` (Path): "A `.d.ts` file that declares the `$.state` values and `$`
nouns of a mod"; `dependencies`; `userConfig` ("Values Claude Code prompts the
user for when the plugin is enabled"); `hooks` ("Loaded together with
`hooks/hooks.json`"); `mcpServers` (".json MCP config files, `.mcpb` or `.dxt`
bundles, or inline server configs ... Loaded together with `.mcp.json`");
`skills` adds directories to the default `skills/` scan. "Put every other plugin
file at the plugin root, not inside `.claude-plugin/`. That includes `skills/`,
`commands/`, and `hooks/`" [manifest]. `userConfig` options appear in a dialog
at install/enable in `/plugin`; `"sensitive": true` masks the value and stores
it in secure storage; each non-sensitive option is also a row in `/config`
[components, "Ask the user for configuration values"] [manifest].

No toolchain: "You don't need Node.js, a bundler, or a build step, because
Claude Code loads `.js` and `.ts` files directly" [create]. JSX compiles against
the global `h`; the header of the types file gives a fitting `tsconfig.json`
(`"jsx": "react", "jsxFactory": "h", "jsxFragmentFactory": "Fragment"`,
`"lib": ["es2023"]` with no DOM) [skill] [types]. When the engine loads a mod
from a folder it hot-reloads, it writes `.claude-plugin/types/` beside it:
`claude-code/index.d.ts` (the API), `claude-code-tools/index.d.ts` (built-in
tools, so `e.tool === 'Bash'` narrows `e`), `claude-code-mcp/index.d.ts` ("The
inputs of the MCP tools that were connected the last time you saved a file in
the mod"), one directory per `dependencies` plugin, and a `tsconfig.json`
[create, "Get type definitions for your version"] [skill]. The nm-mods repo
ignores that folder in git (`mods/*/.claude-plugin/types/`) [nm-mods .gitignore].

Static checks: `claude plugin validate <dir>` "reads the manifest and the
module's source the way the engine will" and prints `hooks:` and `calls:` lines
(plus `env reads:`, `env writes:`, `state reads:`, `state writes:`, and one
`gating hook with/without .catch:` line per hook that can refuse something)
[skill] [create]. Rules it enforces: write each `$` call in full
(`$.store.get(...)`, never `const ui = $.ui`); event names as string literals;
no dynamic `import()`; imports only by relative path inside the plugin plus the
bare `claude-code`; ES modules only; don't shadow `on` [create]. Tests go in
`*.test.ts(x)` and run with `claude plugin test <dir>` against the engine's own
`$`, mounting a component per surface (`terminal`, `desktop`, `vscode`,
`mobile`) [ex:pane.test.tsx] [types header].

Second source, same shape [nm-mods]: each mod is
`mods/<name>/{.claude-plugin/plugin.json, hooks/hooks.json, hooks/register.tsx,
types/index.d.ts, tests/, README.md}`; `nm-projektkort/.claude-plugin/plugin.json`
holds `name`, `version` `"1.0.0"`, `description`, `"types": "./types/index.d.ts"`
and `author`; its `hooks/hooks.json` is `{ "modules": ["./register.tsx"] }`
[nm-mods projektkort]. The repo root carries `.claude-plugin/marketplace.json`
listing every mod with `"source": "./mods/<name>"`, `description`, `category`,
`tags` [nm-mods marketplace.json].

### The hooks module and tool-call hooks

"`on(event, matcher?, hook)` adds a hook, and every hook is `($, e, next)`: `$`
is the engine interface, each call spelled noun then method; `e` is the event's
input, a plain frozen value; `next(e)` runs the plugins beneath and then the
engine's own behaviour, resolving to the event's result. A hook that returns
without `next` answers for itself; `next({ ...e, x })` rewrites what the rest
sees. The module has no DOM or Node: `$` reaches everything outside it" [skill,
"A mod in one paragraph"]. `next` also carries `next.signal` (AbortSignal),
`next.origin` (`{ plugin, tier }`), `next.budget` (`ms`, `remainingMs`),
`next.called` and `next.error` in a `.catch` handler [reference, The hook
function].

Tool-call hooks [reference, Tools] [events, "Guard or change a tool call"]:

- `tool.call` fires when "A tool is about to run"; a hook returns `next(e)`,
  `{ deny: reason }`, or `{ result }`. It "fires when Claude Code is about to run
  a tool, including calls a subagent makes and calls to MCP tools. `e.tool` is
  the tool's name and the tool's arguments are fields of `e`, such as
  `e.command` for Bash." After `await next(e)` the result carries `deny` or
  `isError`; a hook may retry (`next(e)` again), answer itself (`{ result }`
  without `next`, "No permission prompt appears and the tool doesn't run"), or
  withhold a result (`{ deny }` after `next`).
- `tool.check` fires when "Claude Code decides whether a tool call may run, after
  the `tool.call` and `PreToolUse` hooks"; returns `next(e)` or `{ decision }`
  with `allow`, `ask` or `deny` and an optional `reason`; `e.isReadOnly` (v2.1.304+)
  is the tool's own report [reference].
- `tool.describe` rewrites a tool's description and can set `isDeferred`.
- Matchers: a string (`{ tool: 'Bash' }`), an array (`{ tool: ['Edit', 'Write'] }`),
  or a regex (`{ tool: /^mcp__github__/ }`) [events].
- A hook can hold a call and ask the user with `$.ui.ask(question, options)`;
  time inside a `$` call does not count against the hook's budget [events].
- A hook that throws, times out or returns the wrong shape is skipped and the
  call goes on; to fail closed, chain `.catch(($, e, next) => next.called ?
  next(e) : { deny: '...' })` [events] [reference.md]. The skill's example does
  exactly this for `Edit` calls on `.env` files and, in a second hook on `Bash`,
  rewrites `e.command` with `next({ ...e, command: e.command.trim() })` and
  then pins `$.ui.status(hasFailed ? ... : undefined)` [ex:tool-call.ts].

Other events a Brand OS mod would use [reference] [events] [types]:
`prompt.submit` (`next({ ...e, text })`, `next({ ...e, context })`, or
`{ drop }`); `prompt.compose`/`prompt.section` (system prompt; guarded for user
mods where the built-in guard loads, see Limits); `turn.start`, `turn.step`
(async generator), `turn.complete` (`e.agentId` set for subagents);
`session.start` ("Once for each loaded mod, before the first prompt, and again
after a reload of that mod. Not after `/clear`, `/resume`, or `/branch`"),
`session.end`; `command.run`; `ui.render`, `ui.press`, `ui.input`, `ui.select`,
`ui.close`, `ui.message`, `ui.fault`; `classic.<Event>` for every settings-hook
event with the JSON that hook would read on stdin, e.g. `classic.SessionStart`
with `e.source` (`clear`, `resume`, `fork`), `classic.Stop`, and
`classic.CwdChanged` with `old_cwd` and `new_cwd` [types,
`CwdChangedHookInput`]. "Every mods API method is also an event, named for its
namespace and method, such as `fs.read`, `model.complete`, or `ui.open`"
[reference]. Register each event once per matcher: a second bare
`on('session.start', ...)` fails the module load [events].

Order [events, "The order mods run in"]: the built-in guard and
`prependPlugins` first, then mods the user installed, then `appendPlugins`, then
other built-in mods; managed `PreToolUse` settings hooks run before any mod's
`tool.call`; other settings-file and plugin `PreToolUse` hooks run after the last
mod calls `next`. Settings hooks may sit in the same `hooks/hooks.json` under
`hooks`; a plugin's own MCP tools are matched there as
`mcp__plugin_<plugin>_<server>__<tool>` [components, Hooks].

Slash commands: `$.command.register({ name, description, argumentHint?,
immediate? })` in `session.start`, answered by `on('command.run', { command },
...)` returning `{ text }` (or `{}` to print nothing); `immediate: true` lets it
run while Claude works; a built-in's name is refused [api, "Add a command"]
[types `$.command`]. Tools for the model: `$.tool.register({ name, description,
inputSchema, isDeferred })`, served by a `tool.call` hook on
`mcp__<plugin>__<name>` [api, "Add a tool"].

### Panes: lifecycle, how they get and refresh data, what UI they can render

Lifecycle. A pane exists only once the mod opens it:
`$.ui.open({ id, title?, focus?, closeOnEscape?, holdToasts?, rows?, columns? })`
where `id` is "1-64 of letters, digits, `_` and `-`", one pane per id (opening an
open id retitles), and the three boolean fields "accept only `true`" [types
`PaneOpenArgs`] [interface, "Open a pane at the right time"]. It resolves
`{ isPlaced: true }` once drawn or `{ isPlaced: false, reason }` ("opened unasked
on a narrow terminal, or where no surface places panes, or none is attached")
[types `UiOpenResult`]. The mod draws it with
`on('ui.render', { component: 'Pane', requestId: id }, ...)` returning a tree
[skill table] [ex:pane.tsx]; the site's props are `title`, `isFocused`,
`bodyColumns` (draw to this width), `placement` (`'dock'` beside the transcript
or `'inline'` above the prompt), `scroll` (`bodyRows` is the room a docked pane
has) and `view` [reference, Render sites] [types `Pane`]. "A tree taller than
the pane scrolls as a whole" [reference]. `$.ui.close({ id })` closes it; a
`ui.close` event says whether `plugin`, `person` or `unload` closed it
[interface] [reference]. In the terminal a pane is "a sidebar beside the
transcript in a wide fullscreen terminal, or a framed region above the prompt
otherwise"; a pane the mod opens by itself (a timer, `turn.start`) shows only at
144+ columns (110 once the user has opened it), one opened by the user's command
or button at any width [interface]; in VS Code it docks in a panel 800 px or
wider [interface]. The desktop app's dock/inline rule is not stated in the pages
read (see Gaps). A command registered with `immediate: true` can open the pane
mid-turn [interface].

`session.start` "fires once when the session is ready and is awaited before the
first prompt" and is the place to register commands, open panes and start
timers [reference.md, "Work that outlives a dispatch"]. A reload (each save
while hot-reloading) "runs `register` and `session.start` again. `$.state` (the
session's) and `$.store` (across sessions) stay; the module's own variables
start over" [skill]. `/clear`, `/resume` and `/branch` reset `$.state` and do
not re-fire `session.start`; reload from `$.store` in a
`on('classic.SessionStart', { source: ['clear', 'resume', 'fork'] }, ...)` hook
[interface, "Load a saved value again after /clear"]. nm-projektkort registers
`/projekt` in `session.start` and again on `turn.start` ("after a hot reload
there is not always a session.start"), opens with `{ id, title, focus: true,
closeOnEscape: true }`, and falls back to a `{ text }` answer when
`$.session.surfaces()` is empty or `opened.isPlaced !== true` [nm-mods
projektkort register.tsx].

How a pane gets data (all through `$`; the module has no fs of its own [api]):

- Project files: `$.fs.read(path)` returns text (or `{ base64 }` with
  `{ as: 'bytes' }`); "a relative path is under the session's working
  directory"; "A read or write over 4 MiB rejects"; `$.fs.exists`, `$.fs.stat`
  (`{ kind, size, mtimeMs, isLink }`, plus `realPath` with `{ resolve: true }`),
  `$.fs.list` (one directory, not recursive), `$.fs.write` [types `$.fs`] [api].
  `$.fs.ancestors({ names, of?, below? })` "Reads the named instruction files in
  every directory above the session's original working directory, the way the
  engine reads CLAUDE.md", root first [types]. A file the plugin ships is under
  `$.plugin.root` [types]. The session's directory: `$.session.cwd()`; its
  project root (moves with `/cd`, a host directory change or a worktree move):
  `$.session.root()`; the git repo: `$.session.repo()` [types `$.session`].
  A directory change raises `classic.CwdChanged` (`old_cwd`, `new_cwd`) [types];
  nm-statuslinje refreshes on it [nm-mods statuslinje register.tsx]. nm-projektkort
  reads its marker file with `$.fs.stat(path)` then `$.fs.read(path)` and runs
  git with `$.process.run(argv, { cwd, timeoutMs, env })` [nm-mods projektkort].
- Watching: the types declare `fs.read`, `fs.write`, `fs.list`, `fs.exists`,
  `fs.stat`, `fs.ancestors` and no watch method (grep for `fs.watch` in the
  types: 0 matches, observed). Work that outlives one event runs on
  `$.clock.every(ms, fn)` / `$.clock.after` started from `session.start`;
  timers "run until cancelled or until the module reloads" [api] [reference.md].
- MCP results: `$.mcp.call(server, tool, args)` "Calls `tool` on one of the
  engine's connected MCP servers with the engine's own connection and
  credentials. A `cached` server is dialed on first use. No permission prompt:
  the plugin's call, seen by the hooks above it, is the grant. Positional, not
  the `{ tool: "mcp__server__tool", ... }` shape a `tool.call` hook sees";
  `server` is "the server's name as /mcp lists it"; it returns "the tool's
  result as MCP returns it: `content` blocks and `isError`" [types `$.mcp`].
  `$.mcp.connect(server)` "Connects one of the MCP servers this plugin's own
  manifest lists, if the session has not already: a listed server joins it at
  its start" [types]. A plugin-declared server is listed in `/mcp` as
  `plugin:<plugin>:<server>` and its tools are named
  `mcp__plugin_<plugin>_<server>__<tool>` [components, MCP servers]. The other
  road is `$.tool.call({ tool: 'mcp__...', ... })`, which "runs through every
  hook but the calling one ..., the permission check and its dialog, then the
  tool" [types `$.tool.call`]. Under `claude plugin validate`, `$.mcp.call`
  reads as "Calls a tool on a connected MCP server, under the session's
  permission rules" [admin, "Review what a mod can do"].
- Processes and network: `$.process.run(argv)` (no shell, 30 s default timeout,
  resolves `{ exitCode, stdout, stderr }`), `$.process.spawn` (streams),
  `$.http.fetch(url, init)` (`{ status, ok, headers, text }`, 4 MiB bodies, 30 s,
  5 redirects) [api] [reference, Limits].
- Persisted values: `$.store.get/set/delete/keys`, JSON, 4 MiB in all, "A JSON
  file of the plugin's own under the user's Claude Code configuration
  directory" (`~/.claude/plugins/store/` per [interface]); shared by every
  session on the machine, so re-read before writing [types `$.store`]
  [interface, "Save from more than one session"].
- Session-scoped reactive values: `$.state`, declared in `PluginState`, read in
  a render hook with `read($, atom)` and written from a handler or another event
  with `update($, atom, fn)`; "Refused while a `ui.render` hook draws"; "Any
  plugin reads any value; its owner alone writes it" [types `$.state`]
  [interface, "Keep a value in $.state"] [ex:pane-state.d.ts].

Refresh. "Claude Code runs your `ui.render` hook again when the site's props
change or the terminal's width changes ... It doesn't run the hook on a timer,
and it can't tell when a variable in your module changes" [interface]. Three
ways to redraw: write a `$.state` value a render hook read ("That read
subscribes the instance, and a later `$.state.set` draws exactly the readers
again, so nobody calls `$.ui.invalidate` for it" [reference.md]); call
`$.ui.invalidate('ui.render')` after changing module data (throttled to 10 a
second, 30 in the terminal for the visible pane, calls coalesce) [types]
[reference, Limits]; or a `$.clock.every(1000, () => $.ui.invalidate('ui.render'))`
timer from `session.start` [interface, "Redraw on a timer"]. The skill's pane
example feeds a pane from a `tool.call` hook: it `update`s a `calls` atom before
and after `await next(e)`, and the `Pane` hook `read`s it [ex:pane.tsx].

What it can render. Elements come from the surface's table,
`const { Box, Text, Button } = $.ui.resolve(e)`; the desktop table is `Box`,
`Text`, `Button`, `Input`, `Select`, `Svg`, `Link`, `Code`, `Markdown`, `Client`
("the six every surface here carries, `Input`, `Select`, `Svg` and `Client`");
the terminal has no `Svg` but `Raster` and `Image`; `vscode` has no `Client`;
`mobile` has no `Input`, `Select` or `Client` [types `Elements`] [reference,
Elements]. Element notes that matter for a brand pane:

- `Text` takes `color` and `backgroundColor` typed `Color = ThemeKey | (string & {})`
  (theme keys such as `success`, `warning`, `claude`, "Another key the theme
  holds resolves too, typed as any string is"), plus `size` (`caption` ...
  `title`), `weight`, `mono`, `tabular`, `dimColor`, `wrap`; the terminal has one
  size and is always monospaced [types `TextProps`, `Color`]. The docs' example of
  a non-theme colour is `'red'` [interface]; whether a hex string draws is not
  stated (see Gaps).
- `Svg`: `source` up to 131,072 characters, `alt` required, `width`/`height` in
  CSS pixels, `isInteractive` draws it "in a script-less sandboxed frame";
  Desktop and VS Code only [types `SvgProps`] [reference].
- `Link`: in the desktop app and VS Code it "draws as plain text unless its
  `href`" is "an `https:` URL, or an `http://localhost` URL such as
  `http://localhost:3000`", with no `@` and canonical spelling [interface,
  "Link in the Desktop app and VS Code"]. `Markdown` takes `text` (not
  children); a link "outside `https:`/`http:`/`file:` draws as text"
  [reference.md].
- `Code` (`source`, `language`, `path`, `format: 'diff'`), `Input`, `Select`,
  `Button` (`key`, `label`, `onPress`, `hotkey`, `plain`, `variant="primary"`,
  `role="dismiss"`, `action`) [reference, Elements] [reference.md].
- `Client`: "A region drawn by a second file of yours, for animation and pointer
  input. That file gets no mods API. It reaches your hooks by posting data,
  which arrives as a `ui.message` event"; `module` must be a string literal
  path inside the plugin; `props` at most 100,000 characters serialized;
  terminal and desktop [interface] [types `ClientProps`].
- Buttons, inputs and selects keep their handlers in the plugin and raise
  `ui.press`, `ui.input`, `ui.select`; keys reach a pane only while it has
  focus; Esc returns to the prompt [reference.md].
- A tree that does not validate is not drawn: the hook is skipped and the engine
  draws its own, with a `ui.render hook skipped: returned the wrong shape (...)`
  line in the transcript (hot-reloading session) or debug log [troubleshoot].
  Tree limits: 32 levels, 20,000 elements and text children, first 100,000
  characters of text drawn [reference, Limits].

nm-projektkort's pane is a working desktop-and-terminal example: `Box`/`Text`/
`Button`/`Link`, a `card` kept in `$.state`, an "Opdater" (refresh) primary
button and a "Luk" (close) `role="dismiss"` button, and a `.catch` on the render
hook that draws an error `Text` instead [nm-mods projektkort register.tsx].

### Status line and toasts

- `$.ui.status(text)`: "Pins `text` as this plugin's status line under the
  prompt, beside the engine's own pinned notices, until the next call replaces
  it. One per plugin; `undefined` removes it"; "its first 2000 characters drawn
  (10000 remotely)" [types `$.ui.status`]. The docs describe it as "One line
  under the prompt that stays until you change it. It starts with `⚠` and the
  mod's name, as in `⚠ my-mod: checks: 3 passing`" [api, "Show something
  without starting a turn"]. nm-statuslinje builds its whole line and calls
  `$.ui.status(line === '' ? undefined : line)`, refreshed from `session.start`,
  `turn.complete` (main turn only, `e.agentId === undefined`), `classic.CwdChanged`
  and a `$.clock.every` tick, with an on/off flag in `$.store` [nm-mods
  statuslinje register.tsx].
- `$.ui.toast(text, { timeoutMs })`: "Shows `text` for a few seconds under the
  plugin's name: a small box on the stack of plugin toasts over the transcript's
  top right corner ... Where the transcript is printed into scrollback (nothing
  to float over) it is one line on the notification bar"; default 4000 ms; held
  while a `holdToasts` pane shows; at most three drawn at a time in fullscreen
  [types `$.ui.toast`] [troubleshoot, "A toast doesn't appear"].
- `$.ui.log(text)` adds a dim transcript line Claude does not read (`{ to:
  'debug' }` for the debug log only); `$.ui.notify(text)` sends a native
  notification through the user's `preferredNotifChannel` and answers
  `{ isSent: false, reason: 'no-surface' }` where "The session has no terminal,
  as in a `claude -p` run, the Agent SDK, the desktop app, the VS Code extension,
  or a cloud session" [api] [types].
- In VS Code, "status lines and toasts show above the prompt box instead" in one
  stack, one status line per mod, cut at 200 characters or two rows, toasts at
  500 characters [api] [interface]. The desktop app's placement of a mod's
  status line and toasts is not described separately in the pages read; the
  overview only states that what a mod draws appears there except terminal-only
  elements (see Gaps).
- Not the same thing as the settings status line: that one "is a customizable
  bar at the bottom of Claude Code that runs any shell script you configure. It
  receives JSON session data on stdin and displays whatever your script prints",
  re-run on session start, each assistant message, `/compact`, mode changes or a
  `refreshInterval` [statusline]. The mods overview groups it with settings
  hooks, skills and MCP servers as things that "work from outside Claude Code"
  [overview]; `allowManagedModsOnly` blocks user mods but leaves "status lines"
  working, while `disableAllHooks` stops "Your settings hooks and custom status
  line" as well as mods [admin] [overview].

### Packaging and distribution

A Mod is a plugin, and ships as one:

- "A mod installs as a plugin, from a marketplace. Give the plugin's name, an
  `@`, and the marketplace's name": `/plugin install token-chart@your-org` in a
  session, `claude plugin install token-chart@your-org` in a shell. "Install
  plugins covers marketplaces, scopes, the VS Code extension and the Desktop
  app, and keeping plugins updated, all of which apply to a plugin that contains
  a mod without changes. If you install or update a mod from your shell while a
  session is open, run `/reload-plugins` in that session to load it" [overview,
  "Install or update a mod"].
- One plugin, all components: "A plugin can hold all of them, so a mod can ship
  in the same plugin as a skill and an MCP server" [overview]. The plugin's MCP
  server is declared in `.mcp.json` at the plugin root or under `mcpServers`
  (which also takes a packaged `.mcpb`/`.dxt` bundle) [components]. The install
  summary ends "Plugin is now active." or adds "Its bundled MCP server needs
  configuration before it can start", in which case the user picks Configure on
  the Installed tab [install]. So a Brand OS plugin can carry the Mod, the
  Skills and the local MCP server (ADR-0001) in one `plugin.json`, listed once in
  the single marketplace repo (ADR-0002) [ADR-0001] [ADR-0002].
- What the user does, and nothing more: add the marketplace once
  (`/plugin marketplace add <owner>/<repo>`, or `--marketplace <owner>/<repo>` on
  the install line, v2.1.275+ in a session, v2.1.292+ from the shell), then
  install and choose a scope; for "a mod that is a hooks module alone, a tick
  and `Installed <mod>. Plugin is now active.`, its hooks running in that
  session from then on with no reload, and under the user scope in each session
  started after" [reference.md, "Sharing a mod"] [install]. A `userConfig`
  dialog appears for unset options at install [components].
- In the desktop app: "You can install plugins from the desktop app without
  using the terminal. In a local session or an SSH session, click **+** next to
  the prompt box and select **Add plugins** to open the plugin browser. If the
  menu shows **Plugins** instead, select it, then **Browse plugins**, or
  **Manage plugins** to enable, disable, or uninstall plugins. You can scope
  plugins to your user account, a specific project, or local-only" [desktop,
  "Install plugins"]; the install page's Desktop tab says the same [install].
  The skill adds: "In the desktop app, where `/plugin` does not run: click +
  next to the prompt box, then Plugins, Add marketplace with `<owner>/<repo>`,
  then Add plugin" and "A mod installed from a terminal at the user scope loads
  in that local session too, and its `ui.render` hooks draw for the `desktop`
  surface" [reference.md]. The nm-mods README instead gives `/plugin marketplace
  add` and `/plugin install` as working "in Claude Code (terminal) or in the
  Code tab of the desktop app" [nm-mods README, translated]; which holds for the
  current desktop build was not verified (see Gaps).
- Scopes: user scope writes `enabledPlugins` in `~/.claude/settings.json`;
  project scope writes the committed `.claude/settings.json` but "doesn't
  download it to their machines, so each collaborator also runs `claude plugin
  install <name>@<marketplace> --scope project` once"; local scope writes
  `.claude/settings.local.json`. "The terminal, the desktop app's local sessions,
  and the VS Code extension on one computer read the same settings files, so a
  plugin you install at user scope in any of them is available in the other
  two" [install]. Cloud sessions load none of these and have no plugin browser;
  WSL sessions in the desktop app have no plugins [install] [desktop].
- Version floor: "In the terminal, use Claude Code v2.1.287 or later. The
  Desktop app includes its own copy of Claude Code, and mods work there from
  v2.1.286"; check with `claude --version` or `/status` in the Code tab
  [overview, "Turn mods on or off"]. To see whether mods can load at all without
  installing one, run `claude plugin test` in a directory with no mod: `no hooks
  module to load` means they can [troubleshoot]. Observed on this machine
  (terminal build 2.1.294): `claude plugin test: ...: no hooks module to load;
  there is no hooks/hooks.json naming one in "modules"`.
- Marketplace file: `.claude-plugin/marketplace.json` with `name`, `owner:
  { name }`, `plugins: [{ name, source }]`; the shortest marketplace is the
  mod's own repository with `"source": "./"` [reference.md]. nm-mods lists
  fifteen mods from one repo, each `"source": "./mods/<name>"` [nm-mods
  marketplace.json]. `claude plugin validate` fails a `name` that "looks like
  one of Anthropic's own, such as one that starts with `claude-`" [create].
- Updates: "Claude Code caches an installed plugin by version, so your edits
  don't reach the installed copy until you increment the version and install
  again" [create]; auto-update is on by default for Anthropic's marketplaces and
  off for every other, including third-party ones, and after an update the
  running session keeps its loaded version until `/reload-plugins` [install]. A
  marketplace that is a local folder with relative sources is read in place, so
  edits plus `/reload-plugins` reach the session without a reinstall
  [reference.md, "Developing one"].
- Developing against the desktop app, which takes no `--plugin-dir` flag:
  `CLAUDE_CODE_PLUGIN_DIRS` ("one or more absolute paths ... taken from the
  process environment or the `env` block of `~/.claude/settings.json`") loads
  and watches a folder "exactly as a `--plugin-dir`" [reference.md]
  [reference, Settings]; or ask Claude in a session, which writes the mod to
  `~/.claude/dev-mods/<session-id>/<mod>/` and asks once to enable hot reloading
  [create, "Ask Claude for a mod"] [skill].
- Other routes exist but are weaker for Brand OS: a plugin directory or `.zip`
  sent by hand [create, "Share your mod"]; organization-managed mods through
  managed settings, which count as the organization's only when the marketplace
  is a directory on the machine listed by absolute path [admin]; plugins synced
  from a claude.ai account appear as `<name>@synced` in terminal sessions
  [install] (whether their mods load is not stated; see Gaps).

### Limits and security boundaries

- Reach: "A mod runs with your permissions, so before you install one, know what
  it has access to. Once it loads, a mod can: Act on your machine as you ...
  Read your secrets: environment variables and settings files, including an API
  key you keep in either ... See your session: every prompt you send and every
  tool call Claude makes ... Change your session: rewrite a prompt or a tool
  call, submit a prompt as if you had typed it ... Act without asking you:
  approve a tool call before you're asked ... Spend your usage: call a model on
  your plan or API key" [overview, "What a mod can reach"]. "Mods aren't
  sandboxed. If you turn on sandboxing, the sandbox isolates the Bash commands
  Claude runs, and a process that a mod starts runs outside it" [overview].
  "Permission rules and `PreToolUse` hooks apply to Claude's tool calls, not to
  a mod's `$.fs` and `$.process` calls. With `Read(.env)` denied, a mod can still
  read that file with `$.fs.read`" [admin].
- Cannot: change the permission prompt [overview]; draw where no surface is
  attached (`-p`, SDK, cloud) [overview]; use Node APIs, timer globals such as
  `setTimeout`, or the DOM (only standard JS and web APIs such as `URL`,
  `TextEncoder`, `crypto.subtle`) [api] [types header]; `require` or dynamic
  `import()`; import from outside the plugin; write `$.state` while drawing;
  pass `false` to `focus`/`closeOnEscape`/`holdToasts`; open a pane unasked on a
  narrow terminal [create] [interface] [types].
- Budgets [reference, Limits]: a hook's own execution time 10 s per event (50 ms
  for `prompt.edit`), `.catch` handler 1 s, `$.process.run` 30 s default and 10
  min at most, `$.fs.read`/`write` 4 MiB, `$.http.fetch` 4 MiB and 30 s, `$.store`
  4 MiB, `$.model.complete` `maxTokens` 1024 by default, tree depth 32 and 20,000
  elements, `$.ui.invalidate` 10 redraws a second, toast 4 s, names up to 64
  characters, a test 5 s.
- Organization controls [admin] [overview]: a built-in guard
  `sec-default@builtin` (listed as `cc-plugin-sec-default`) loads on a machine
  with managed settings or a Team/Enterprise `/login`; with it, a user's mod
  cannot lift `deny` rules or `ask` prompts, and its hooks on `classic.<Event>`,
  `prompt.compose`, `prompt.section`, `prompt.context`, `prompt.attachment`,
  `skill.prompt`, `attribution.text`, `session.compact`, `settings.read` and
  some `session.append` doors never run. `allowManagedModsOnly` refuses every
  user mod; `allowManagedHooksOnly` and `disableAllHooks` go wider;
  `disableSideloadFlags` rejects `--plugin-dir` and keeps session-written mods
  from loading; a user can disable one mod in `/plugin`, all for a session with
  `--safe-mode`, or all with `disableAllHooks`. "In an interactive session in a
  directory the user hasn't trusted yet, no mod loads until they answer the
  trust prompt" [admin].
- Failure behaviour: a failing hook is skipped and the session continues
  [troubleshoot]; if the shared hooks worker crashes three times, Claude Code
  unloads every mod that is not built in until `/reload-plugins` [troubleshoot];
  "Claude Code refuses to load a mod that uses the mods API in a way this
  command can't read" (`claude plugin validate`) [admin].
- Stability: "EARLY ACCESS: this surface may change between releases without
  notice" [types]; the reference "Entries cover the Claude Code CLI and the
  Desktop app as of v2.1.290"; the GitHub copy of the declarations "can be
  older than the Claude Code version you have installed", so trust the copy the
  engine writes [reference]. The README of a shared mod should say which
  Claude Code version it was tested with [create].

### Sketch: how a brand pane could be fed

Options, each grounded above. The pane shows the Active Brand's tokens and its
References; the status line shows the Active Brand's name [GLOSSARY].

Option A, read the project's `brand-os.json` directly.

- Load: in `session.start`, resolve the file with
  `$.fs.ancestors({ names: ['brand-os.json'], of: await $.session.cwd(), below: await $.session.root() })`
  (root first, so take the last entry for the nearest) or plainly
  `$.fs.read('brand-os.json')` relative to the working directory; parse; write
  the result into a `$.state` atom declared in `types/index.d.ts` under
  `'brand-os'` [types `$.fs`, `$.state`] [interface]. Re-run the same loader on
  `classic.SessionStart` with `source` in `clear`/`resume`/`fork` and on
  `classic.CwdChanged` [interface] [types].
- Draw: `on('ui.render', { component: 'Pane', requestId: 'brand-os' }, ...)`
  reads the atom with `read($, brand)`; tokens as rows of `Text` with
  `backgroundColor` set to the token's value (the type accepts any string; hex
  rendering unverified) or, on `e.surface === 'desktop'`, an `Svg` swatch strip
  with `alt`; References as `Link`s only when they resolve to `https:` or
  `http://localhost:<port>` (a `file:` path draws as plain text on desktop), or
  inline as `Markdown`/`Code` from text the mod reads [types `Elements`,
  `TextProps`, `SvgProps`] [interface]. Fall back to a `{ text }` answer from
  the `/brand` command when `$.session.surfaces()` is empty or `isPlaced` is
  false [nm-mods projektkort] [types].
- Refresh: there is no file watcher, so poll `$.fs.stat(path).mtimeMs` on a
  `$.clock.every` timer and reload on change; also hook
  `on('tool.call', { tool: ['Edit', 'Write'] }, ...)` and, after `await next(e)`,
  reload when `e.file_path` ends in `brand-os.json`; and give the pane a Refresh
  `Button` plus a `/brand` command registered with `immediate: true` [api]
  [events] [interface]. Writing the atom redraws the pane; the status line is
  re-pinned with `$.ui.status(\`brand: ${name}\`)` from the same loader [types].
- Cost: nothing but file reads; works wherever the plugin loads, including
  `claude -p` (hooks only).

Option B, ask the Brand OS MCP server (the local stdio server of ADR-0001,
shipped in the same plugin's `.mcp.json`).

- Call: `$.mcp.call('<server as /mcp lists it>', 'get_tokens', { brand })` with
  the engine's connection and no permission prompt, or first
  `$.mcp.connect('<key in this plugin's manifest>')` and use the name it answers;
  the result is MCP `content` blocks [types `$.mcp`]. Or go through
  `$.tool.call({ tool: 'mcp__plugin_<plugin>_<server>__get_tokens', brand })`,
  which passes the permission check and every other mod's `tool.call` hooks
  [types `$.tool`] [components].
- Why: one source of truth, the pane shows exactly what the agent's Skills and
  MCP calls see; brand resolution (which package, which version) stays in the
  server. The `claude-code-mcp/index.d.ts` the engine writes beside the mod types
  the server's tool inputs for the hooks module [create].
- Open: the exact `server` string for a plugin-shipped server in `$.mcp.call`
  (the `/mcp` listing form is `plugin:<plugin>:<server>`; the `$.mcp.call`
  example uses a connector display name) is not confirmed by the sources read.

Option C, observe the agent instead of asking.

- Hook `on('tool.call', { tool: /^mcp__plugin_brand-os_/ }, ...)`, `await
  next(e)`, and update the atom from each result, so the pane reflects the brand
  the agent last resolved; `$.ui.toast('Active Brand: ...')` when it changes
  [events] [types `$.ui.toast`]. This needs no second read path but shows
  nothing until the agent has called the server; combine with A or B for the
  first draw.

Plugin shape for all three: `.claude-plugin/plugin.json` (`name`, `version`,
`description`, `"types": "./types/index.d.ts"`), `skills/<name>/SKILL.md`,
`.mcp.json` (the local server), `hooks/hooks.json` (`modules` plus any settings
hooks), `hooks/register.tsx`, `types/index.d.ts`, `tests/*.test.tsx`; one entry
in the marketplace repo [skill] [components] [reference.md] [ADR-0002]. The Codex
side of Brand OS gets no Mod (glossary: "Claude only").

## Gaps and open questions

- Desktop placement of `$.ui.status` and `$.ui.toast`: the pages read describe
  the terminal (under the prompt; top-right stack or notification bar) and VS
  Code (one stack above the prompt box). For the desktop app they only say what
  a mod draws appears there except terminal-only elements [overview]. Verify in
  the desktop Code tab before promising a "status-line indicator".
- Dock versus inline on desktop: the 110/144-column rule is the terminal's and
  the 800 px rule is VS Code's; the desktop app's rule and whether it honours
  `rows`/`columns` are not stated [interface] [reference].
- Hex colours: `Color` is typed as any string and the doc's example is `'red'`;
  whether `#RRGGBB` renders in `Text`/`Box` on desktop and terminal is unverified
  [types] [interface]. `Svg` on desktop is the safe fallback for swatches.
- `/plugin` in the desktop app: the skill says "where `/plugin` does not run"
  and points at the + menu; nm-mods' README says `/plugin ...` works in the Code
  tab. Both are dated; test on the current build.
- `$.mcp.call` server naming for a plugin-shipped stdio server (see Option B).
- Synced plugins: the admin page counts a mod in a plugin an organization "turns
  on for its members on claude.ai" as a user's mod [admin], which implies synced
  plugins can carry mods; no page read states it outright.
- `fs.watch`: absent from the 2.1.304 types; if a later build adds one, Option
  A's polling goes away. Re-grep the engine-written types after each update.
- The API is early access; the reference covers the desktop app "as of
  v2.1.290" and this session's types are 2.1.304 while the terminal is 2.1.294.
  Pin a tested version in the plugin README [create].
- Not researched: the sample mods in `anthropics/claude-code-playground` and the
  built-in mods' source in `anthropics/claude-code/mods` (linked from
  [overview]); `claude plugin eval`; the interface gallery page.

## Sources

All observed 2026-10-27.

- `[skill]`: the `plugin-authoring` skill (`cc-plugin-plugin-authoring`,
  Claude Code 2.1.304) as loaded by the Skill tool in this session; base
  directory `/private/tmp/claude-501/bundled-skills/2.1.304/25ac0f2d2da31588d198eb232a0343c9/plugin-authoring/`.
- `[reference.md]`: `.../plugin-authoring/reference.md` (255 lines).
- `[types]`: `.../plugin-authoring/types/claude-code.d.ts` (22,469 lines,
  "Written by Claude Code 2.1.304"); sections cited: header, `$.plugin`,
  `$.ui` (`status`, `toast`, `notify`, `log`, `invalidate`, `open`), `$.tool`,
  `$.mcp`, `$.fs`, `$.store`, `$.state`, `$.session`, `PaneOpenArgs`,
  `UiOpenResult`, `Pane` props, `Elements`, `TextProps`, `Color`, `SvgProps`,
  `ClientProps`, `SessionStartInput`, `CwdChangedHookInput`.
- `[ex:pane.tsx]`, `[ex:pane-state.d.ts]`, `[ex:pane.test.tsx]`,
  `[ex:band.tsx]`, `[ex:tool-call.ts]`: `.../plugin-authoring/examples/`.
- `[overview]`: https://code.claude.com/docs/en/plugins/mods/overview
- `[create]`: https://code.claude.com/docs/en/plugins/mods/create
- `[interface]`: https://code.claude.com/docs/en/plugins/mods/interface
- `[events]`: https://code.claude.com/docs/en/plugins/mods/events
- `[api]`: https://code.claude.com/docs/en/plugins/mods/api
- `[reference]`: https://code.claude.com/docs/en/plugins/mods/reference
- `[troubleshoot]`: https://code.claude.com/docs/en/plugins/mods/troubleshoot
- `[admin]`: https://code.claude.com/docs/en/plugins/mods/admin
- `[install]`: https://code.claude.com/docs/en/plugins/install
- `[components]`: https://code.claude.com/docs/en/plugins/components
- `[manifest]`: https://code.claude.com/docs/en/plugins-reference (reached from
  https://docs.claude.com/en/docs/claude-code/plugins-reference, which redirected
  there; the docs also link it as `/plugins/manifest-reference`)
- Plugins overview: https://code.claude.com/docs/en/plugins (reached from
  https://docs.claude.com/en/docs/claude-code/plugins)
- `[desktop]`: https://code.claude.com/docs/en/desktop
- `[statusline]`: https://code.claude.com/docs/en/statusline
- `[nm-mods README]`, `[nm-mods marketplace.json]`, `[nm-mods .gitignore]`,
  `[nm-mods projektkort]`, `[nm-mods statuslinje]`:
  `/Users/ahmed.taher/Projects/nm-mods/` (`README.md`,
  `.claude-plugin/marketplace.json`, `.gitignore`,
  `mods/nm-projektkort/{.claude-plugin/plugin.json,hooks/hooks.json,hooks/register.tsx,types/index.d.ts}`,
  `mods/nm-statuslinje/{.claude-plugin/plugin.json,hooks/hooks.json,hooks/register.tsx,README.md}`),
  read only, no code run.
- `[GLOSSARY]`: `GLOSSARY.md` in this repo. `[ADR-0001]`:
  `docs/adr/0001-one-local-mcp-server.md`. `[ADR-0002]`:
  `docs/adr/0002-one-marketplace-repo-packages-outside.md`.
- Local observations: `claude --version` → `2.1.294 (Claude Code)`;
  `claude plugin test` in an empty directory → `no hooks module to load`.

# Research: Claude Code plugin and marketplace format

Ticket: [#8](https://github.com/Ahmadnmic/Brand-OS-wayfinder/issues/8). Researched 2026-10-27 against Anthropic's Claude Code docs, local on-disk records of installed plugins, the official marketplace catalog, OpenAI's Codex plugin docs and source, and the `mattpocock/skills` repository. Local Claude Code version observed: `2.1.294` (`claude --version`, 2026-10-27). Every version-gated claim below is "as documented, observed 2026-10-27".

Citation labels in square brackets resolve in [Sources](#sources).

## Question

What exactly can a Claude Code plugin ship (skills, agents, hooks, commands, MCP server config, and whether a desktop "mod" can ride inside it)? What do `plugin.json` and `marketplace.json` require? What are the install, enable and update commands for a marketplace hosted in a public GitHub repo, how does auto-update work, how are plugin MCP servers declared and started, how are skills inside a plugin namespaced and invoked, and what constraints apply to a plugin that wants to be installed with as few commands as possible? Bonus: how can one repo serve both a Claude Code marketplace and a Codex marketplace (worked example: `mattpocock/skills`)?

## Summary

- A plugin is one directory. Manifest `.claude-plugin/plugin.json` is optional and `name` is its only required key; components live at the plugin root in fixed folders: `skills/`, `commands/`, `agents/`, `hooks/hooks.json`, `.mcp.json`, `.lsp.json`, `output-styles/`, `workflows/`, `themes/`, `monitors/monitors.json`, `bin/`, `settings.json` [manifest-ref]. A `CLAUDE.md` at the plugin root is not loaded [manifest-ref].
- A marketplace is a repo with `.claude-plugin/marketplace.json`; required keys are `name`, `owner.name`, `plugins[]`, and each entry needs `name` + `source` [mkt-ref]. The single-plugin pattern is one entry with `"source": "./"` beside `plugin.json`, with entry `name` equal to manifest `name` [publish] [create-mkt]. All four of this user's own marketplaces and `mattpocock/skills` use exactly that shape (local files, see Sources).
- Fewest commands from a public GitHub repo: one, `claude plugin install <plugin> --marketplace <owner>/<repo>` (shell, v2.1.292+; in-session `/plugin install <plugin> --marketplace <owner>/<repo>` v2.1.275+ but it opens the panel for scope choice). Otherwise two: `claude plugin marketplace add <owner>/<repo>` then `claude plugin install <plugin>@<marketplace-name>` [install] [cli-ref]. No marketplace field can install or enable a plugin for a user; only managed settings can force it [host].
- Auto-update is a per-user, per-marketplace toggle: on by default only for Anthropic's official marketplaces, off for every third-party marketplace, and `marketplace.json` has no field to turn it on. Users flip it in `/plugin` > Marketplaces, or an admin sets `"autoUpdate": true` under `extraKnownMarketplaces` [install] [host] [settings-ref]. When on, Claude Code refreshes after a random delay of up to ten minutes following the first message, updates the cache on disk, and the new version loads next session or on `/reload-plugins` [loading].
- Updates are detected by a computed version: `plugin.json` `version` first, then the entry's `version`, else the 12-char commit SHA. A pinned `version` that is not bumped keeps every user on the old copy; omitting it makes users track commits [loading] [host].
- Skills ship as `skills/<name>/SKILL.md` and are always namespaced `/<plugin>:<skill>`; frontmatter `name` replaces only the last segment. `disable-model-invocation: true` keeps the description out of context and makes the skill user-only; `user-invocable: false` hides it from `/`. Every model-invocable skill's name and description cost context on every turn in every session where the plugin is enabled [skills] [components] [overview].
- MCP servers are declared in `.mcp.json` at the plugin root or inline under `mcpServers` in `plugin.json` (also `.json` file paths and `.mcpb`/`.dxt` bundles). Claude Code starts them automatically at session start while the plugin is enabled; the server registers as `plugin:<plugin>:<server>` and its tools as `mcp__plugin_<plugin>_<server>__<tool>`; `${CLAUDE_PLUGIN_ROOT}` resolves in `command`, `args`, `env` [mcp] [components]. Local stdio servers do not run on claude.ai chat [platform].
- A "mod" is simply a plugin whose `hooks/hooks.json` has a `modules: ["./register.js"]` array; `plugin.json` adds no required field (optional `types` points at a `.d.ts`). Mods install like any plugin and run in the CLI, the Desktop app's Code tab (v2.1.286+) and VS Code, not in claude.ai chat [mods-ref] [mods-overview] [platform]. Depth is the sibling ticket's job.
- One repo can serve Claude Code and Codex at once: Codex's loader looks for `.agents/plugins/marketplace.json`, `.agents/plugins/api_marketplace.json`, `.claude-plugin/marketplace.json` and `.cursor-plugin/marketplace.json` [codex-src-mkt], and OpenAI's docs call `.claude-plugin/marketplace.json` a "legacy-compatible marketplace" and say "Claude-compatible manifests" are accepted [codex-build]. `mattpocock/skills` ships only `.claude-plugin/{plugin,marketplace}.json` plus a per-skill `agents/openai.yaml`, and its README installs on Codex with `codex plugin marketplace add mattpocock/skills` + `codex plugin add mattpocock-skills@mattpocock` [mp-readme] [mp-tree].
- The `$schema` URL the official catalog uses, `https://anthropic.com/claude-code/marketplace.schema.json`, returned HTTP 404 on 2026-10-27, and no `plugin.json` schema URL is published; the docs say `$schema` is ignored at load time and `claude plugin validate` is the authoritative check [mkt-ref] [manifest-ref] [schema-404].

## Findings

### Plugin layout and plugin.json

**What a plugin is.** "A Claude Code plugin is a directory of skills, agents, hooks, MCP servers, or other components that Claude Code installs and loads as one unit" [overview]. Component types listed on the overview: skills, agents, hooks, a hooks module (mod), MCP servers [overview]; the manifest reference adds commands, LSP servers, output styles, workflows, themes, monitors, executables (`bin/`), default settings, and channels [manifest-ref].

**Manifest.** `.claude-plugin/plugin.json` is optional; without it Claude Code loads what it finds in the standard layout and takes the name from the marketplace entry (or the directory name with `--plugin-dir`) [manifest-ref]. "Put every other plugin file at the plugin root, not inside `.claude-plugin/`" [manifest-ref]. `name` is the only required key; it must be kebab-case, no spaces, `@`, `:` or path separators, and "Every component is namespaced under it" [manifest-ref]. Names starting with `claude-`, `anthropic-`, `anthropics-` or `cc-plugin-`, or equal to `claude`, `anthropic`, `claude-code`, `claude-mods`, fail validation as impersonating Anthropic; a name containing `claude` as a whole word elsewhere (e.g. `mcp-for-claude`) only warns [manifest-ref]. Relevant to Brand OS: `brand-os` is clean; anything like `claude-brand-os` is refused.

**Top-level fields** (type in parentheses) [manifest-ref]: `$schema` (string, ignored at load), `name`, `displayName`, `version` ("not checked against semver. Setting it pins the plugin to that version until you change it"), `description`, `author` (`name` required, `email`/`url` optional), `homepage` (must parse as URL or the plugin fails to load), `repository`, `license` (SPDX), `keywords`, `metadata` (free-form, v2.1.222+), directory-listing fields `icon`/`documentationUrl`/`supportUrl`/`privacyPolicyUrl`/`termsOfServiceUrl` (read by Anthropic's directory only), `defaultEnabled` (default `true`), `dependencies`, `settings` (only `agent` and `subagentStatusLine` take effect), `userConfig`, `types` (a `.d.ts` for a mod), `channels`, and the component keys `skills`, `commands`, `agents`, `hooks`, `mcpServers`, `lspServers`, `outputStyles`, `workflows`, `experimental.{themes,monitors,evals}`.

**Unknown keys.** "An unrecognized top-level key is stripped, and an unrecognized key inside a `userConfig` option, `channels` entry, `lspServers` config, or `monitors` entry is rejected"; `claude plugin validate` warns on stripped keys and `--strict` turns warnings into failures [manifest-ref]. Validation also warns on a missing `version`, `description` or `author` [manifest-ref].

**Path rules.** Every component path is relative to the plugin root, must start with `./` (`skills` also accepts `"."`), must exist, and must resolve inside the root; `..` fails with "path traversal" [manifest-ref]. How each key combines with its default folder: `skills` *adds* to the `skills/` scan; `commands`, `agents`, `outputStyles`, `workflows`, `experimental.themes`, `experimental.monitors` *replace* their default scan; `hooks`, `mcpServers`, `lspServers` *merge* with `hooks/hooks.json`, `.mcp.json`, `.lsp.json` [manifest-ref].

**Standard layout** [manifest-ref]:

| Component | Default location |
| :- | :- |
| Manifest | `.claude-plugin/plugin.json` (optional) |
| Skills | `skills/<name>/SKILL.md` (a root `SKILL.md` with no `skills/` loads as one skill) |
| Commands | `commands/*.md` ("Prefer `skills/` for new plugins") |
| Agents | `agents/*.md` (subfolders become name segments) |
| Hooks | `hooks/hooks.json` |
| MCP servers | `.mcp.json` |
| LSP servers | `.lsp.json` |
| Output styles | `output-styles/` |
| Workflows | `workflows/*.js` |
| Themes | `themes/*.json` |
| Monitors | `monitors/monitors.json` |
| Executables | `bin/` (on the Bash tool's `PATH`; "claude.ai and Cowork don't install a plugin that has this directory") |
| Settings | `settings.json` (`agent`, `subagentStatusLine`) |

**Environment variables** available to components [manifest-ref]: `${CLAUDE_PLUGIN_ROOT}` (the installed version's absolute path; changes on every update, "don't write state there"), `${CLAUDE_PLUGIN_DATA}` (`~/.claude/plugins/data/<id>/`, kept across updates, for `node_modules`, caches), `${CLAUDE_PROJECT_DIR}`. They resolve inline in hook `command`/`args`, MCP `command`/`args`/`env`, LSP fields, and anywhere in skill/command/agent Markdown; they are exported to hook, MCP-stdio and LSP processes but "aren't present in the environment of commands Claude runs through the Bash tool" [manifest-ref].

**Node.js dependencies.** When Claude Code copies a plugin into its cache it installs the plugin's npm/Bun dependencies if, and only if, the plugin root holds both a `package.json` and a supported lockfile (`bun.lock`, `npm-shrinkwrap.json`, `package-lock.json`); registry packages only, exact pins, `--ignore-scripts`, 60-second timeout, cannot be disabled [loading]. The documented fallback for anything else is a `SessionStart` hook that runs `npm install` into `${CLAUDE_PLUGIN_DATA}` [components].

**Real layouts on this machine** (read-only, 2026-10-27):

- `hackkit@hackkit` (cache `~/.claude/plugins/cache/hackkit/hackkit/0.6.3/`): `.claude-plugin/plugin.json` (name, version, description, author, homepage, repository, license, keywords), `skills/{init,assets,gamify,prototype,pitch,deploy}/`, `hooks/hooks.json` with `SessionStart` and `Stop` command hooks that run `node "${CLAUDE_PLUGIN_ROOT}/scripts/hook.mjs" …`, plus `scripts/`, `template/`, `starters/`. No `.mcp.json`. The marketplace repo keeps it under `plugins/hackkit` and the entry's `source` is `./plugins/hackkit` [local-hackkit].
- `claude-project-sorter@claude-project-sorter` (`…/cache/claude-project-sorter/claude-project-sorter/1.0.0/`): `plugin.json` with inline `"mcpServers": {"claude-project-sorter": {"command": "node", "args": ["${CLAUDE_PLUGIN_ROOT}/mcp-server/server.js"]}}`, `skills/claude-project-sorter/SKILL.md`, `mcp-server/`, and a `.claude-plugin/marketplace.json` with one entry `"source": "./"` [local-sorter].
- `dispense-configurator@dispense-configurator` (`…/2.0.0/`): same pattern, `mcp-server/server.js` with its own `package.json` + `package-lock.json` *inside* `mcp-server/`, not at the plugin root, and no `node_modules` in the cache. By the loading rule above the automatic dependency install does not run for that layout; whether the server has runtime dependencies was not checked [local-dispense] [loading].
- `~/.claude/plugins/cache/<marketplace>/<plugin>/<version>/` is the documented cache path, `${CLAUDE_PLUGIN_ROOT}` points at it, and old versions are swept 14 days after an `.orphaned_at` marker [loading]. Each cache dir here also holds an undocumented `.in_use/<pid>` folder [local-hackkit].

**Where it loads.** The same plugin folder installs on claude.ai chat, Cowork and Claude Code, but each loads a subset [platform]:

| Component | Chat | Cowork | Claude Code |
| :- | :- | :- | :- |
| Skills | Loads | Loads | Loads |
| Commands | Loads as a skill | Loads | Loads |
| Agents | Ignored | Loads | Loads |
| Hooks (`hooks/hooks.json`) | Ignored | Loads | Loads |
| Remote MCP (http/sse) | Connectors tab | Loads | Loads |
| Local MCP (command, incl. `.mcpb`) | Ignored | Loads when the session runs locally | Loads |
| MCP with `${user_config.*}` | Ignored in URL | Ignored without default | Loads, prompts |
| `bin/` | Can't be installed | Can't be installed | Loads |

A cloud session (claude.ai/code) "doesn't load the plugins in your local settings" [overview] [install].

### marketplace.json and hosting on GitHub

**File and root.** "Save the marketplace file at `.claude-plugin/marketplace.json` in your marketplace's directory"; the directory containing `.claude-plugin/` is the marketplace root, and relative plugin sources resolve from it [mkt-ref]. The file can live elsewhere only if users declare it via `extraKnownMarketplaces` with `path`, "because `claude plugin marketplace add` has no option for it" [mkt-ref].

**Top-level fields** [mkt-ref]: `name` (required; letters, digits, `.`, `_`, `-`; what users type after `@`), `owner` (required; `name` required, `email`/`url` optional), `plugins` (required array), `$schema` (ignored at load), `description` (validate warns if missing), `version`, `metadata.description`/`metadata.version`, `metadata.pluginRoot` (v2.1.239+), `forceRemoveDeletedPlugins`, `allowCrossMarketplaceDependenciesOn`, `renames`. Unknown keys are ignored silently at load and warned on by `validate` [mkt-ref].

**Reserved marketplace names** include all official names (`claude-plugins-official`, `claude-code-plugins`, `anthropic-plugins`, …), community names, `inline`, `builtin`, `skills-dir`, `synced`, `npm`, `pip`, `uv`, `cargo`, `github`, `gh`, JavaScript object member names, anything starting `claudeai-`, impersonations such as `official-claude-plugins`, and "the download folder of a registered GitHub marketplace, `<owner>-<repo>`" [mkt-ref]. For Brand OS that last rule matters: a GitHub marketplace at `Ahmadnmic/brand-os` downloads through a folder `Ahmadnmic-brand-os`; naming a *different* marketplace that is refused (v2.1.290+) [mkt-ref].

**Plugin entry fields** [mkt-ref]: `name` (required), `source` (required), `description`, `version` (manifest wins and `validate` warns if both set), `category`, `tags`, `strict` (default `true`), `relevance`, `dependencies`, `defaultEnabled` (entry overrides manifest), `displayName`, `metadata` (v2.1.222+), `headers`, `headersHelper` (archive sources only), plus "every `plugin.json` field … such as `description`, `version`, `author`, `commands`, and `hooks`". With a `plugin.json` present and `strict: true`, the entry's `commands`/`agents`/`skills`/`outputStyles`/`themes` are appended to the manifest and entry `hooks` matchers replace the manifest's per event; with `strict: false` any entry component field is a conflict and the plugin fails to load; entry `mcpServers`, `lspServers`, `userConfig`, `channels` never apply when a `plugin.json` exists [mkt-ref] [manifest-ref]. The official catalog uses `strict: false` + `skills: [...]` on 14 entries whose source is a whole repo (e.g. `amd-skills`, `box`) to pick a subset of skill folders [official-mkt].

**Keep entry name and manifest name identical.** The entry name is the install id (`<entry>@<marketplace>`) and the `enabledPlugins` key; the manifest name is the skill prefix. "When the two names differ and someone installs by the manifest name, Claude Code reports `Plugin "<manifest-name>" not found`" [create-mkt].

**Plugin `source` types** [mkt-ref]:

| Type | Fields | Note |
| :- | :- | :- |
| relative path | the string | inside the marketplace; must start `./`; `"."`/`"./"` = root |
| `github` | `repo`, `ref`, `sha` | `owner/repo` |
| `url` | `url`, `ref`, `sha` | any git repo by URL |
| `git-subdir` | `url`, `path`, `ref`, `sha` | sparse checkout of one subdirectory |
| `npm` | `package`, `version`, `registry` | no install scripts run |
| `archive` | `url`, `sha256` | HTTPS zip, v2.1.224+ |
| `command` | `command`, `timeout`, `mode` | runs a local tool, v2.1.229+ |

`ref` defaults to the default branch; when `sha` is set Claude Code checks out that commit even if the ref is gone [mkt-ref]. The official catalog, observed 2026-10-27, has 315 entries: 164 `url`, 98 `git-subdir`, the rest relative paths, and `url`/`git-subdir` entries carry a pinned `sha` [official-mkt].

**The single-repo pattern.** "To publish from the plugin's own repository, save the marketplace file beside `plugin.json` in `.claude-plugin/`, with one entry whose `source` is `"./"`, the repository root" [publish]. Minimal file from the docs [publish]:

```json
{
  "name": "your-marketplace",
  "owner": { "name": "Your Name" },
  "plugins": [
    { "name": "deploy-helper", "source": "./" }
  ]
}
```

Run `claude plugin validate .` before pushing [publish]. Multi-plugin repos keep plugins under `plugins/` with `"source": "./plugins/<name>"` [create-mkt]; hackkit does that [local-hackkit].

**Hosting on GitHub.** "You push the directory to a git host, and anyone with access registers it in Claude Code with one command" [create-mkt]. Users run `claude plugin marketplace add <owner>/<repo>` (or `/plugin marketplace add …` in a session); append `#ref` or `@ref` to pin a branch or tag [install] [cli-ref]. The marketplace's registered name comes from the file's `name`, "not from the repository name" [host]. Requirements on the user's machine: `git`; for `owner/repo` shorthand Claude Code probes `ssh -T git@github.com` and falls back to HTTPS, and `CLAUDE_CODE_PLUGIN_PREFER_HTTPS=1` skips the probe [host]. Git LFS content is never fetched [host]. Only the submodules that hold plugin files are fetched (v2.1.295+) [create-mkt]. Private repos work with whatever credential helper or SSH key the machine already has; "Claude Code has no git token of its own, and `marketplace.json` has no field for one" [host]. For users with no git account, `archive` entries or a hosted `marketplace.json` URL are the alternatives, but a URL-hosted catalog cannot use relative-path entries [host] [mkt-ref].

**What the add writes locally** (observed 2026-10-27): `~/.claude/settings.json` gets `extraKnownMarketplaces.<name> = {"source": {"source": "github", "repo": "Ahmadnmic/claude-hackkit"}}` (or `{"source": "git", "url": "https://…git"}` when added by URL) and `enabledPlugins["hackkit@hackkit"] = true`; `~/.claude/plugins/known_marketplaces.json` records `source`, `installLocation` (`~/.claude/plugins/marketplaces/<name>`) and `lastUpdated`; `~/.claude/plugins/installed_plugins.json` (schema `version: 2`) records per `<plugin>@<marketplace>` an array of `{scope, installPath, version, installedAt, lastUpdated, gitCommitSha}` [local-settings] [local-records]. This matches the three-layer model (settings, disk, session) in the loading reference [loading].

**Schema.** The official catalog's first line is `"$schema": "https://anthropic.com/claude-code/marketplace.schema.json"` [official-mkt]. On 2026-10-27 that URL (and `www.`, and the analogous `plugin.schema.json`) returned HTTP 404 from Anthropic's Webflow site; `code.claude.com/…schema.json` variants redirect to the product page [schema-404]. The docs list `$schema` as "JSON Schema URL for editor autocomplete. Ignored at load time" in both files [mkt-ref] [manifest-ref], and the `anthropics/claude-plugins-official` repo contains no schema file (contents: `.claude-plugin`, `.github`, `LICENSE`, `README.md`, `external_plugins`, `plugins`) [official-repo]. Treat `claude plugin validate` as the schema.

### Install, enable and update commands, and auto-update

**Shell commands** (all documented; help text confirmed locally on 2.1.294) [cli-ref] [cli-help]:

| Action | Command |
| :- | :- |
| Register a GitHub marketplace | `claude plugin marketplace add <owner>/<repo>[#ref]` (`--scope user\|project\|local`, `--sparse <dirs…>`, `--json`) |
| Install | `claude plugin install <plugin>@<marketplace>` (`-s/--scope`, `--config k=v`, `-y`, `--accept-command`, `--json`, `--marketplace <source>`, `--registry`) |
| Add + install in one step | `claude plugin install <plugin> --marketplace <owner>/<repo>` (v2.1.292+; marketplace is declared in user settings even with `--scope project`) |
| Enable / disable | `claude plugin enable <plugin>@<marketplace>` / `claude plugin disable …` (`--scope` auto-detected: local, project, user) |
| Update one plugin | `claude plugin update <plugin>@<marketplace>` ("restart required to apply"; bare name allowed v2.1.246+) |
| Refresh catalog(s) | `claude plugin marketplace update [name]` (no name = every marketplace's listing; installed plugins stay at their versions) |
| Inspect | `claude plugin list`, `claude plugin details <name>` (component inventory, token cost), `claude plugin validate <path>` |
| Remove | `claude plugin uninstall <plugin>@<marketplace>`, `claude plugin marketplace remove <name>` (uninstalls its plugins) |

"There's no command that updates every plugin at once" [install]. In-session equivalents: `/plugin marketplace add …`, `/plugin install <plugin>@<marketplace>` (opens the plugin's details in the `/plugin` panel; you choose a scope there, nothing installs until you confirm), `/plugin enable|disable|uninstall`, `/reload-plugins` [install] [cli-ref]. `/plugin` is unavailable in `claude -p` [install].

**Scopes and files** [install]: user → `~/.claude/settings.json` `enabledPlugins`; project → committed `.claude/settings.json` (collaborators still run `claude plugin install <name>@<marketplace> --scope project` once each, because committing the entry "doesn't download it to their machines"); local → `.claude/settings.local.json`. `claude plugin marketplace add … --scope project` writes `extraKnownMarketplaces` into the committed file so teammates get the marketplace registered after they trust the folder [host] [settings-ref].

**When the plugin becomes usable.** From the shell, "plugins it installs load the next time you start Claude Code, or when you run `/reload-plugins`"; in-session installs print `Plugin is now active.` or `Run /reload-plugins to apply.` [install]. A `defaultEnabled: false` plugin is installed but off until `claude plugin enable` [install].

**Auto-update** [install] [loading] [host] [settings-ref]:

- Default on for `claude-plugins-official` and other official marketplace names (except `knowledge-work-plugins`, `first-party-plugins`) and for marketplaces added from claude.ai; "Off by default: every other marketplace, including the community marketplace, third-party marketplaces, and local development marketplaces".
- Precedence: `autoUpdate` on the `extraKnownMarketplaces` entry in a settings file, then `autoUpdate` in `known_marketplaces.json` (written by the `/plugin` > Marketplaces > "Enable auto-update" toggle), then the default. "`marketplace.json` has no field to turn it on."
- Timing: "after you send your first message, Claude Code waits a random delay of up to ten minutes. It then refreshes every marketplace with auto-update on and updates the plugins installed from them on disk." The running session keeps its versions; the user sees `Plugin updated: <name> · Run /reload-plugins to apply`, and the new version loads next launch regardless.
- `DISABLE_UPDATES=1`, `DISABLE_AUTOUPDATER=1` or `CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC=1` turn the pass off unless `FORCE_AUTOUPDATE_PLUGINS=1`.
- A `name@marketplace` install always refreshes that marketplace first (unless refreshed within 30 s or the source is local); a bare-name shell install reads cached catalogs only.

**Version computation** (what "new version" means) [loading]: 1) `plugin.json` `version`; 2) entry `version`; 3) by source type: 12-char commit SHA for `github`/`url`/`git-subdir` (plus a path hash for `git-subdir`), 12-char SHA-256 for `archive`, commit SHA of the installed directory for a relative path in a git-hosted marketplace, `unknown` for `npm` and non-git local dirs. "A manifest that pins `"version": "1.0.0"` keeps every user on the cached copy until its author changes the string, however many commits they push" [loading]. The publish checklist therefore says: increment `version` on every release or omit it [publish]. Don't set it in both places [host]. Plugins loaded in place from a locally-added marketplace ignore `version` entirely [loading].

**Fewest-commands constraints for Brand OS.**

1. From a third-party GitHub marketplace the floor is one shell command on v2.1.292+ (`claude plugin install brand-os --marketplace Ahmadnmic/<repo>`), two on older versions [install] [cli-ref]. In a session it is one command but the user still picks a scope in the panel [install].
2. No entry field installs or enables a plugin for a user; `defaultEnabled` only decides the state after install [host] [manifest-ref]. Only managed settings (`enabledPlugins` + `extraKnownMarketplaces` in `managed-settings.json`) pre-install for a fleet [host].
3. Auto-update stays off for the marketplace until each user toggles it or an admin sets `autoUpdate: true`; the plugin cannot flip it [host]. The only ways to get on-by-default auto-update are a listing in `claude-plugins-official` (which "doesn't take submissions through the directory portal"; "ask [an Anthropic partner contact]") or Anthropic's directory on claude.ai, whose plugins reach Claude Code as `<name>@synced` and update when Anthropic publishes a new version [publish] [install].
4. A `command`-source entry or a `headersHelper` adds a confirmation prompt (`-y` in scripts) and is excluded from auto-update, so avoid them [cli-ref] [loading].
5. Keep executables out of a top-level `bin/` if the same plugin should also install on claude.ai/Cowork [manifest-ref] [platform].
6. Without a `version` pin, every push to the branch is an update; with one, releases are deliberate. `mattpocock/skills` pins and syncs the field from `package.json` in CI [mp-sync].

### Skills in plugins (namespacing, frontmatter, disable-model-invocation)

**Location and name.** "Save each skill in its own directory under `skills/`"; after loading, `skills/review/SKILL.md` in `my-plugin` runs as `/my-plugin:review` [components]. "The command has the plugin's name as a prefix, as every plugin skill's name does" [create-mkt]. Frontmatter `name` "replaces the last segment and the plugin prefix stays" (`name: fancy` → `/my-plugin:fancy`); "The bare `/fancy` also invokes the skill unless another command already uses that name"; a `name` that already carries the prefix is not doubled on v2.1.246+ [skills]. Characters Claude Code refuses in skill folder names become hyphens for plugin skills instead of blocking the load [skills]. A plugin skill and a personal/project skill with the same name both load because plugin skills are namespaced [skills]. `skillOverrides` in settings does not apply to plugin skills; users manage them through `/plugin` [skills].

**Extra skill directories.** The `skills` manifest key lists directories "each a directory of `<name>/SKILL.md` folders or one folder holding `SKILL.md` directly"; it adds to the default `skills/` scan [manifest-ref]. A marketplace entry whose `source` is the root and which lists `skills` subdirectories loads only those, and the default `skills/` scan is skipped [manifest-ref]. `mattpocock/skills` uses the manifest key with 27 explicit paths under `skills/engineering/` and `skills/productivity/` so the non-promoted `skills/misc`, `in-progress`, `deprecated` buckets never ship [mp-plugin-json] [mp-adr2].

**Frontmatter fields** Claude Code reads in `SKILL.md` [skills]: `name`, `description` (recommended; combined with `when_to_use`, truncated at 1,536 characters in the listing), `when_to_use`, `argument-hint`, `arguments`, `disable-model-invocation`, `user-invocable`, `allowed-tools`, `disallowed-tools`, `model`, `effort`, `context` (`fork`), `agent`, `background`, `hooks`, `paths`, `shell`, `metadata`, `license`, `compatibility`. "All fields are optional"; unknown fields are ignored silently; a malformed YAML block loads the skill with no fields set [skills]. Only `name`, `description`, `license`, `compatibility`, `metadata`, `allowed-tools` are part of the Agent Skills spec and accepted by claude.ai uploads and the Skills API; the others cause a hard error there [skills]. Booleans accept `yes/no/on/off/1/0` (v2.1.218+) [skills].

**Who invokes** [skills]:

| Frontmatter | You can invoke | Claude can invoke | Loaded into context |
| :- | :- | :- | :- |
| default | Yes | Yes | Description always; body on invoke |
| `disable-model-invocation: true` | Yes | Not on its own | Description not in context; body on invoke |
| `user-invocable: false` | No | Yes | Description always; body on invoke |

`disable-model-invocation: true` also stops preloading into subagents and scheduled-task runs [skills]. If Claude tries anyway, "Claude Code blocks the call and instructs it not to reproduce the deploy steps another way" [skills]. The plugins overview adds the cost angle: "for each skill, agent, and command that Claude can invoke on its own, the name and description are in Claude's context on every turn … even in sessions where nothing from the plugin runs" [overview]. `claude plugin details <name>` and `/skill-doctor` report that cost [install] [skills].

**Paths inside a skill.** `${CLAUDE_SKILL_DIR}` is the skill's own folder ("For plugin skills, this is the skill's subdirectory within the plugin, not the plugin root"); `${CLAUDE_PLUGIN_ROOT}` and `${CLAUDE_PLUGIN_DATA}` are substituted only in plugin skills, both in the Markdown body and in `allowed-tools` Bash rules, which lets a skill run a bundled script without a permission prompt [skills]. Dynamic context injection (`` !`command` ``) is Claude Code-only [skills].

**Hooks in skill frontmatter** survive an organization's `strictPluginOnlyCustomization` lock only for plugin, bundled and managed skills [skills] [hooks].

**Codex side of the same `SKILL.md`.** `mattpocock/skills` keeps an `agents/openai.yaml` beside each `SKILL.md` with `interface.display_name`, `interface.short_description`, and for user-only skills `policy.allow_implicit_invocation: false`, which the repo's convention pairs with `disable-model-invocation: true` so "a skill is user-invoked in both harnesses or neither" [mp-invocation] [mp-skill-tdd] [mp-skill-grillme].

### MCP servers in plugins

**Declaration.** "Plugins define MCP servers in `.mcp.json` at the plugin root or inline in `plugin.json`" [mcp]. `.mcp.json` takes the same shape as a project `.mcp.json` (`{"mcpServers": {"db": {"command": "node", "args": ["${CLAUDE_PLUGIN_ROOT}/server.js"]}}}`; the wrapper may be omitted) [components]. The `mcpServers` manifest key accepts a `.json` file path, an inline map, an `.mcpb`/`.dxt` bundle path or `https://` URL, or an array mixing them; `.mcp.json` loads first and "A server name declared later replaces an earlier one" [manifest-ref]. Transports: stdio (`command`/`args`/`env`), `http`, `sse`, `ws` (`url`, `headers`, `headersHelper`) [manifest-ref]. A remote entry with an empty `url` shows `not configured` rather than an error, "A plugin can include a placeholder entry like this for a connector you configure later" [mcp].

**Start and lifecycle** [mcp] [components]: "When you enable a plugin, Claude Code starts its MCP servers automatically"; at session startup it connects the servers of enabled plugins; enabling/disabling mid-session connects/disconnects when the reload applies (not in non-interactive sessions); `/reload-plugins` keeps live connections for servers whose config is unchanged; a stdio server whose connection failed less than 15 minutes earlier is skipped (`claude -p` runs too); a remote server used before may start `cached` and connect on first tool call; in cloud sessions a call to a not-yet-connected plugin server starts it on demand. Users add/remove plugin servers by installing/uninstalling the plugin, "not with `/mcp` commands", though they can toggle one off in `/mcp` via `disabledMcpServers` [mcp].

**Names** [mcp] [components] [hooks]: the server registers as `plugin:<plugin>:<server>` (e.g. `plugin:my-plugin:db`); tools are `mcp__plugin_<plugin>_<server>__<tool>` with non-`[A-Za-z0-9_-]` characters replaced by `_`. Use the full tool name in permission rules, `allowed-tools`, subagent `tools`, and hook matchers; "A hook matcher written against the bare server key … never fires for a plugin-bundled server". On this machine the installed sorter plugin's tool shows up as `mcp__plugin_claude-project-sorter_claude-project-sorter__list_claude_projects`, matching the rule [local-tools].

**Substitution and secrets.** `${CLAUDE_PLUGIN_ROOT}`, `${CLAUDE_PLUGIN_DATA}`, `${CLAUDE_PROJECT_DIR}` resolve in `command`, `args`, `env` and are exported to stdio server processes [manifest-ref] [mcp]. `${user_config.KEY}` from the manifest's `userConfig` substitutes into MCP config (sensitive values go to the OS keychain) but not into `headersHelper`, which runs through a shell [manifest-ref] [mcp]. `claude mcp get` hides a plugin stdio server's values "because they can carry credentials" [mcp]. In a remote server's `url`/`headers`, credential-looking environment variables read as empty so a plugin can't exfiltrate `ANTHROPIC_API_KEY` [mcp].

**Validation.** `claude plugin validate` checks each server entry in `.mcp.json`, in a named `.json`, or inline, and reports as errors entries Claude Code would drop, `${user_config.KEY}` references to undeclared options, and invalid remote URLs (v2.1.281+) [manifest-ref] [components].

**Packaged servers.** `"mcpServers": "./servers/db.mcpb"` extracts an MCPB bundle into `.mcpb-cache/`; a bundle with required `user_config` doesn't start until configured (`/plugin` > Configure, or `claude plugin install --config <server>.<key>=<value>`, v2.1.285+) [components] [cli-ref]. For a plugin shared through a repository's `.claude/skills/`, bundle-based servers and servers from files outside the plugin are skipped, and each server goes through per-server approval [loading].

**Surfaces.** A local stdio server runs in Claude Code and in Cowork sessions on the user's machine, "but not on claude.ai"; to reach chat users, reference a remote `https://` server instead [components] [platform]. Tool exposure follows MCP tool search; a plugin server's tools stay deferred unless configured otherwise [overview] [mcp].

**Local evidence.** Both MCP-bundling plugins on this machine declare the server inline in `plugin.json` as `"command": "node", "args": ["${CLAUDE_PLUGIN_ROOT}/mcp-server/server.js"]` with no `.mcp.json` [local-sorter] [local-dispense]. Codex's compatibility layout also uses a root `.mcp.json` ("starts with an empty `mcpServers` object"), while its portable format uses `mcp.json` with a per-server `type` ("Don't just rename `.mcp.json`") [codex-build].

### Hooks, commands and agents

**Hooks.** `hooks/hooks.json` wraps the event map in a top-level `"hooks"` key, "in the same shape as the `hooks` object in `settings.json`", optionally with a `description`; the `hooks` manifest key (file path, inline event map, or array) merges with it [components] [manifest-ref] [hooks]. Handler types available to any hook include command, prompt, agent, HTTP and MCP-tool handlers [hooks]. Events (headings in the reference): `SessionStart`, `Setup`, `InstructionsLoaded`, `UserPromptSubmit`, `UserPromptExpansion`, `MessageDisplay`, `PreToolUse`, `PermissionRequest`, `PostToolUse`, `PostToolUseFailure`, `PostToolBatch`, `PermissionDenied`, `Notification`, `SubagentStart`, `SubagentStop`, `TaskCreated`, `TaskCompleted`, `Stop`, `StopFailure`, `TeammateIdle`, `ConfigChange`, `CwdChanged`, `DirectoryAdded`, `FileChanged`, `WorktreeCreate`, `WorktreeRemove`, `PreCompact`, `PostCompact`, `PreModelSwitch`, `PostModelSwitch`, `SessionEnd`, `Elicitation`, `ElicitationResult` [hooks]. Plugin hooks "don't wait for one of the plugin's skills or commands to be used. Claude Code registers them when a session loads the plugin, and they fire on their events from then on" [components]. Exec form (`args` present, no shell) vs shell form (quote `"${CLAUDE_PLUGIN_ROOT}"`); every hook process gets `CLAUDE_PLUGIN_ROOT`, `CLAUDE_PLUGIN_DATA`, `CLAUDE_PROJECT_DIR`, `CLAUDE_PLUGIN_OPTION_<KEY>` [components] [hooks]. Plugin hooks run inside subagents too; timeouts set on plugin hooks don't raise the overall budget; the `/hooks` menu labels each hook with its plugin; permission prompts from a plugin hook are labelled `[plugin:<name>]` [hooks]. hackkit's `hooks.json` (`SessionStart` 10 s, `Stop` 120 s, both `node "${CLAUDE_PLUGIN_ROOT}/scripts/hook.mjs" …`) is a working shell-form example [local-hackkit]. When two enabled plugins share a manifest name, only one registers its hooks [loading].

**Commands.** "Commands are the older format, and skills supersede them for new work." `commands/<file>.md` becomes `/<plugin>:<file>`, `commands/db/migrate.md` becomes `/my-plugin:db:migrate`, same frontmatter as skills; the `commands` manifest key can also define a command inline (`{"about": {"content": "...", "description": "..."}}`) with optional `argumentHint`, `model`, `allowedTools` [components] [manifest-ref]. `project-goals` and `plugin-creator` on this machine still ship `commands/*.md` next to `skills/` [local-caches].

**Agents.** `agents/<file>.md` with `name`, `description`, `model` frontmatter defines a subagent named `<plugin>:<name>`, invokable as `@agent-my-plugin:security-reviewer`; subfolders add colon-separated segments (`agents/review/security.md` → `my-plugin:review:security`) [components] [subagents]. Supported frontmatter: `name`, `description`, `model`, `effort`, `maxTurns`, `autoCompactWindow`, `tools`, `disallowedTools`, `skills`, `memory`, `background`, `omitClaudeMd`, `isolation` (`worktree` only), `color`, `experimental.cacheTtl`; ignored "for security reasons": `permissionMode`, `hooks`, `mcpServers`, `initialPrompt` [components] [subagents]. Plugin agents are the lowest-precedence source (5) and are listed in the @-mention typeahead under their scoped name [subagents]. A plugin can make one of its agents the main thread with `settings.json` `{"agent": "security-reviewer"}` at the plugin root [components]. `SubagentStart` matchers must be anchored for scoped names (`^my-plugin:reviewer$`) [hooks].

### Desktop mods (mechanism only)

The overview lists "A hooks module: hooks written as JavaScript functions, which can also draw panes and add commands. A plugin that has one is called a mod" [overview]. Files [mods-ref]:

| File | Required | Contents |
| :- | :- | :- |
| `.claude-plugin/plugin.json` | Yes | "Mods add no required fields." |
| `hooks/hooks.json` | Yes | `modules`: an array with one path relative to this file, e.g. `"modules": ["./register.js"]`; may also hold settings hooks under `hooks` |
| the hooks module (`hooks/register.js`, `.ts`, …) | Yes | ES module exporting `register(on, options)` |
| `types/index.d.ts` | when `$.state` or a namespace is used | or another path named by the manifest's `types` key (omitting `types` needs v2.1.299+) |
| `*.test.ts` | No | run by `claude plugin test` |

So the only `plugin.json` touchpoint is the optional `types` field ("A `.d.ts` file that declares the `$.state` values and `$` nouns of a mod") [manifest-ref]. `register` receives `options` holding the manifest's `userConfig` values [mods-ref]. "A mod installs as a plugin, from a marketplace" with the ordinary `claude plugin install token-chart@your-org`, and keeping plugins updated "apply to a plugin that contains a mod without changes" [mods-overview]. Where it runs: "Mods work in the Claude Code CLI, the Code tab of the Claude Desktop app, and the VS Code extension"; hooks run in every session kind, drawing only in those three; not in WSL sessions; terminal needs v2.1.287+, the Desktop app's bundled Claude Code v2.1.286+ [mods-overview]. `claude plugin validate` on the plugin directory lists the events a mod handles and the API calls it makes before you install it [mods-overview]. `disableAllHooks`, `--safe-mode` and an organization's `allowManagedModsOnly` stop a mod while leaving the plugin's skills, agents and MCP servers loaded [mods-overview]. The claude.ai directory "lists a mod … for Claude Code" and claude.ai chat ignores `hooks/hooks.json` entirely [platform]. The built-in `cc-plugin-plugin-authoring` mod provides the `plugin-authoring` skill for writing mods [mods-overview]. Whether the same plugin's skills and MCP server install on claude.ai chat while the mod silently does nothing there is answered by the platform table above; the depth is the sibling ticket's.

### One repo, two marketplaces: the mattpocock/skills worked example

**What each tool reads.**

- Claude Code: `.claude-plugin/marketplace.json` for the catalog and `.claude-plugin/plugin.json` for the manifest, both at the repo root [mkt-ref] [manifest-ref].
- Codex: the repo marketplace is `$REPO_ROOT/.agents/plugins/marketplace.json` and the personal one `~/.agents/plugins/marketplace.json`; the ChatGPT desktop app also reads "a legacy-compatible marketplace at `$REPO_ROOT/.claude-plugin/marketplace.json`" [codex-build]. The Codex source constant `MARKETPLACE_MANIFEST_RELATIVE_PATHS` lists, in order, `.agents/plugins/marketplace.json`, `.agents/plugins/api_marketplace.json`, `.claude-plugin/marketplace.json`, `.cursor-plugin/marketplace.json` (file sha `2199fe4…`, observed 2026-10-27) [codex-src-mkt]. The portable manifest is a root `plugin.json` declaring `"$schema": "https://agent-plugins.org/schemas/1.0.0/plugin.schema.json"` (that schema exists and allows only `$schema`, `name`, `version`, `description`, `author`, `homepage`, `repository`, `license`, `keywords`, `extensions`); `.codex-plugin/plugin.json` "remain[s] supported as a compatibility fallback"; and "OpenAI also accepts legacy and Claude-compatible manifests" [codex-build] [agent-plugins-schema]. Codex's raw manifest deserializes `skills` as either a single path string or an array of strings (`RawPluginManifestPaths::{Path, Paths}`), and `hooks`/`mcpServers` likewise accept path or inline forms [codex-src-manifest]. Codex marketplace entries carry `name`, `source` (`local` with `path`, or `url`/`git-subdir`/`npm`), `policy.installation` (`AVAILABLE`, `INSTALLED_BY_DEFAULT`, `NOT_AVAILABLE`), `policy.authentication` (`ON_INSTALL` or first use) and `category`, which the docs say to "Always include" [codex-build]. Codex caches installs under `~/.codex/plugins/cache/$MARKETPLACE/$PLUGIN/$VERSION/` and enables per repo via `.codex/config.toml` `[plugins."my-plugin@local-repo"] enabled = true` [codex-build]. Codex commands: `codex plugin marketplace add owner/repo [--ref main] [--sparse PATH]`, `codex plugin marketplace list|upgrade [name]|remove name`, `codex plugin add|list|remove` (the CLI reference documents `codex plugin add --json` output: `pluginId`, `name`, `marketplaceName`, `version`, `installedPath`, `authPolicy`), and `/plugins` inside the CLI [codex-build] [codex-cli-ref]. Plugins with lifecycle hooks aren't eligible for OpenAI's public directory [codex-build].

**The mattpocock/skills layout** (clone at HEAD `5beb35b…`, committed 2026-10-19; upstream `main` at the same SHA on 2026-10-27) [mp-tree] [mp-head]:

```
skills/
  engineering/<skill>/SKILL.md + agents/openai.yaml   (promoted)
  productivity/<skill>/SKILL.md + agents/openai.yaml  (promoted)
  misc/ in-progress/ deprecated/                       (not shipped)
.claude-plugin/
  plugin.json        name mattpocock-skills, version 1.3.1, skills: [27 explicit "./skills/<bucket>/<name>" paths]
  marketplace.json   name "mattpocock", owner, one entry {name mattpocock-skills, source "./", category, keywords}
.agents/             repo-level agent docs and ADRs only; NO .agents/plugins/marketplace.json
(no .codex-plugin/)
package.json         version 1.3.1 (private), changesets
scripts/sync-plugin-version.mjs   copies package.json version into .claude-plugin/plugin.json
.github/workflows/release.yml     changesets action; `version: npm run version` runs the sync
```

- Claude Code route: the plugin is listed in `claude-plugins-official` with `"source": {"source": "url", "url": "https://github.com/mattpocock/skills.git", "sha": "49dd158…"}`, so users run only `claude plugin install mattpocock-skills@claude-plugins-official` and get official-marketplace auto-update; the official listing reads `plugin.json` directly, and the repo's own `marketplace.json` "is retained only as a fallback for installing the repo directly" [official-mkt] [mp-adr2] [mp-readme]. The pinned `sha` means a release reaches users when Anthropic moves the pin, not when the tag lands; the ADR recorded the pin two commits behind `main` on 2026-08-05 [mp-adr2].
- Codex route: `codex plugin marketplace add mattpocock/skills` then `codex plugin add mattpocock-skills@mattpocock`, "Updates itself at startup" per the README; Codex reads the Claude files via the fallbacks above, which the repo's ADR update of 2026-10-07 attributes to Codex accepting "a `skills` string array and fall[ing] back to `.claude-plugin/` when there is no `.codex-plugin/`" [mp-readme] [mp-adr2]. The marketplace name users type after `@` is `mattpocock`, i.e. the `name` in `.claude-plugin/marketplace.json` [mp-mkt-json].
- Copilot route uses the same two files plus a one-time `extraKnownMarketplaces` entry in `~/.copilot/settings.json` with `autoUpdate: true` [mp-readme] [mp-install-block].
- Invariants the repo keeps: every promoted skill has an entry in the `skills` array; `plugin.json` `version` tracks `package.json` and "Those routes reinstall only when the `version` in `plugin.json` changes"; `marketplace.json` has no `version` field so it can't drift [mp-adr2] [mp-install-block].
- Why explicit `skills` paths rather than the default scan: the default `skills/` scan expects `<name>/SKILL.md` one level down [manifest-ref]; with bucket folders in between, only the explicit array selects the promoted subset, and Codex drops symlinks on install so a flat symlink farm was rejected [mp-adr2].

**What this means for Brand OS.** The two-manifest, single-repo shape (`.claude-plugin/plugin.json` + `.claude-plugin/marketplace.json`, `source: "./"`) is sufficient for Claude Code and, by OpenAI's documented fallback, for Codex; adding `.agents/plugins/marketplace.json` (with the Codex-required `policy` and `category` fields) and a root `plugin.json` with the Agent Plugins `$schema` would make the Codex side first-class rather than "legacy-compatible" [codex-build]. The per-skill `agents/openai.yaml` is how Codex gets display names and user-only policy [mp-invocation].

## Gaps and open questions

- **Schema URLs.** `https://anthropic.com/claude-code/marketplace.schema.json` is dead (404, 2026-10-27) and no `plugin.json` schema is published anywhere I could find; editor autocomplete therefore has nothing to point at. Only `claude plugin validate` is authoritative [schema-404] [manifest-ref].
- **Codex `.claude-plugin/plugin.json` fallback.** The docs sentence "OpenAI also accepts legacy and Claude-compatible manifests" and the Codex source constant `ALTERNATE_PLUGIN_MANIFEST_RELATIVE_PATH = ".claude-plugin/plugin.json"` (which appears inside a test module of `manifest.rs`) support it, but I did not trace the loader's search order (`find_plugin_manifest_path` lives in a file I did not fetch). The mattpocock ADR's 2026-10-07 claim is secondary evidence [codex-build] [codex-src-manifest] [mp-adr2].
- **Codex auto-update "at startup".** `startup_sync.rs` only syncs OpenAI's curated catalog; `marketplace_upgrade.rs` has an "auto-upgrade" path for configured git marketplaces, but I did not find the trigger that runs it at startup for a user-added marketplace. The README's "Updates itself at startup" is the repo author's claim, sourced to `manager.rs` on 2026-10-08 [codex-src-startup] [codex-src-upgrade] [mp-install-block].
- **`codex plugin add` options.** The CLI reference renders the `codex plugin` command table from a component that isn't in the Markdown export, so only the subcommand names (`add`, `list`, `remove`, `marketplace …`) and `--json` output are confirmed [codex-cli-ref].
- **Mods outside the Code tab.** Docs cover CLI, Desktop app Code tab and VS Code; the claude.ai directory says mods are "for Claude Code". Whether Cowork loads a hooks module is not stated (Cowork loads `hooks/hooks.json` per the platform table, but a `modules` entry is not mentioned) [mods-overview] [platform].
- **Official-marketplace listing path.** "Anthropic's official marketplace … doesn't take submissions through the directory portal. If you work with an Anthropic partner contact, ask them." No public process exists [publish]. Directory submission needs a paid claude.ai plan and reaches Claude Code only as `<name>@synced` [publish].
- **Nothing was executed.** I did not run `claude plugin validate`, install anything, or test the one-command install; version thresholds are as documented. The in-session `/plugin install` flow opens a panel, so scripted installs must use the shell form [install].
- **dispense-configurator dependency layout.** Its lockfile sits in `mcp-server/`, not the plugin root, so the automatic dependency install cannot have run and the cache has no `node_modules`; whether `server.js` needs any package was not checked [local-dispense] [loading].
- **Marketplace auto-update and private repos.** Background refresh never prompts; HTTPS helpers that would prompt fail quietly and keep the old checkout. Not relevant to a public repo, but relevant if Brand OS ever goes private [host].

## Sources

Anthropic Claude Code docs (fetched as Markdown via `https://docs.claude.com/en/docs/claude-code/<page>.md`, which redirects to `https://code.claude.com/docs/en/…`; all observed 2026-10-27):

- [overview] Plugins overview: https://code.claude.com/docs/en/plugins/overview.md
- [manifest-ref] Plugin manifest reference: https://code.claude.com/docs/en/plugins/manifest-reference.md
- [components] Add components to a plugin: https://code.claude.com/docs/en/plugins/components.md
- [create-mkt] Create a marketplace: https://code.claude.com/docs/en/plugins/create-marketplace.md
- [mkt-ref] Marketplace reference: https://code.claude.com/docs/en/plugins/marketplace-reference.md
- [host] Host and maintain a marketplace: https://code.claude.com/docs/en/plugins/host-marketplace.md
- [publish] Publish and distribute a plugin: https://code.claude.com/docs/en/plugins/publish.md
- [install] Install and manage plugins: https://code.claude.com/docs/en/plugins/install.md
- [loading] Plugin loading reference: https://code.claude.com/docs/en/plugins/loading.md
- [cli-ref] Plugin commands reference: https://code.claude.com/docs/en/plugins/cli-reference.md
- [skills] Extend Claude with skills: https://code.claude.com/docs/en/skills.md
- [mcp] Connect Claude Code to tools via MCP (section "Plugin-provided MCP servers"): https://code.claude.com/docs/en/mcp.md
- [hooks] Hooks reference: https://code.claude.com/docs/en/hooks.md
- [subagents] Subagents: https://code.claude.com/docs/en/sub-agents.md
- [settings-ref] Settings reference, `extraKnownMarketplaces`: https://code.claude.com/docs/en/settings-reference.md
- [mods-overview] Mods overview: https://code.claude.com/docs/en/plugins/mods/overview.md
- [mods-ref] Mods reference, "Files": https://code.claude.com/docs/en/plugins/mods/reference.md
- [anthropic-mkts] Anthropic's marketplaces: https://code.claude.com/docs/en/plugins/anthropic-marketplaces.md
- [platform] Plugin feature support across platforms (claude.com): https://claude.com/docs/plugins/platform-support.md
- Docs index used to find the pages: https://code.claude.com/docs/llms.txt

Schema checks:

- [schema-404] `https://anthropic.com/claude-code/marketplace.schema.json`, `https://www.anthropic.com/…`, `https://anthropic.com/claude-code/plugin.schema.json`: HTTP 404 (Webflow "Not Found" page), 2026-10-27; `https://code.claude.com/marketplace.schema.json` and `…/plugin.schema.json` redirect to `https://claude.com/product/claude-code`.
- [official-repo] `gh api repos/anthropics/claude-plugins-official/contents/` (top level: `.claude-plugin`, `.github`, `.gitignore`, `LICENSE`, `README.md`, `external_plugins`, `plugins`); code search for `marketplace.schema.json` in that repo matches only `.claude-plugin/marketplace.json`.
- [agent-plugins-schema] https://agent-plugins.org/schemas/1.0.0/plugin.schema.json (HTTP 200, JSON Schema 2020-12; `required: ["$schema","name"]`, `additionalProperties: false`); `…/marketplace.schema.json` at the same host returned 404.

Local primary files (read only, 2026-10-27):

- [official-mkt] `~/.claude/plugins/marketplaces/claude-plugins-official/.claude-plugin/marketplace.json` (315 entries; `$schema`, `name`, `description`, `owner`, `renames`, `plugins`; entry for `mattpocock-skills` with `url` source and pinned `sha 49dd158d1076134a641b33efb035946536778336`).
- [local-hackkit] `~/.claude/plugins/marketplaces/hackkit/.claude-plugin/marketplace.json`, `~/.claude/plugins/cache/hackkit/hackkit/0.6.3/{.claude-plugin/plugin.json,hooks/hooks.json,skills/,scripts/}`.
- [local-sorter] `~/.claude/plugins/cache/claude-project-sorter/claude-project-sorter/1.0.0/.claude-plugin/{plugin.json,marketplace.json}`.
- [local-dispense] `~/.claude/plugins/cache/dispense-configurator/dispense-configurator/2.0.0/{.claude-plugin/plugin.json,.claude-plugin/marketplace.json,mcp-server/}`.
- [local-caches] `~/.claude/plugins/cache/project-goals/project-goals/1.2.0/` and `~/.claude/plugins/cache/plugin-creator/plugin-creator/1.0.0/` (`commands/` + `skills/`).
- [local-records] `~/.claude/plugins/installed_plugins.json` (`version: 2`), `~/.claude/plugins/known_marketplaces.json`.
- [local-settings] `~/.claude/settings.json`, keys `enabledPlugins` and `extraKnownMarketplaces` only.
- [local-tools] Tool name `mcp__plugin_claude-project-sorter_claude-project-sorter__list_claude_projects` as exposed in this session's tool list.
- [cli-help] `claude --version` → `2.1.294 (Claude Code)`; `claude plugin --help`, `claude plugin marketplace --help`, `claude plugin marketplace add --help`, `claude plugin install --help`, `claude plugin update --help`.

mattpocock/skills (clone at `/private/tmp/claude-501/…/scratchpad/mattpocock-skills/repo`, HEAD `5beb35b040e3de97e54fa9e386d7e42d15c295c2`; upstream `main` same SHA via `gh api repos/mattpocock/skills/commits/main`, committed 2026-10-19T15:51:40Z):

- [mp-head] `.git/HEAD`, `.git/refs/heads/main`.
- [mp-tree] directory listing of the repo root, `.claude-plugin/`, `.agents/`, `skills/`, `scripts/`, `.github/workflows/`.
- [mp-plugin-json] `.claude-plugin/plugin.json`.
- [mp-mkt-json] `.claude-plugin/marketplace.json`.
- [mp-readme] `README.md`, section "Installation (30-second setup)".
- [mp-install-block] `.agents/install-block.md`.
- [mp-invocation] `.agents/invocation.md`.
- [mp-adr2] `.agents/adr/0002-ship-as-a-claude-code-plugin.md` (including updates dated 2026-08-05, 2026-10-07, 2026-10-08).
- [mp-skill-tdd] `skills/engineering/tdd/SKILL.md`, `skills/engineering/tdd/agents/openai.yaml`.
- [mp-skill-grillme] `skills/productivity/grill-me/SKILL.md`, `skills/productivity/grill-me/agents/openai.yaml`.
- [mp-sync] `scripts/sync-plugin-version.mjs`, `package.json`, `.github/workflows/release.yml`.
- Public repo: https://github.com/mattpocock/skills

OpenAI Codex (observed 2026-10-27):

- [codex-build] "Package your plugin": https://developers.openai.com/plugins/build/plugins.md (also reached from https://developers.openai.com/codex/plugins/build.md).
- [codex-overview] "Plugins": https://learn.chatgpt.com/docs/plugins.md (redirect from https://developers.openai.com/codex/plugins.md).
- [codex-cli-ref] Developer commands reference, sections `codex plugin` and `codex plugin marketplace`: https://learn.chatgpt.com/docs/developer-commands.md?surface=cli (redirect from https://developers.openai.com/codex/cli/reference.md).
- [codex-src-mkt] `codex-rs/core-plugins/src/marketplace.rs` in `openai/codex` `main`, blob sha `2199fe4e1e937e239304e0bf26ab56b793f8409c` (constant `MARKETPLACE_MANIFEST_RELATIVE_PATHS`).
- [codex-src-manifest] `codex-rs/core-plugins/src/manifest.rs`, blob sha `a532660ddee723fdd28f612357f05504f0ebec9c` (`RawPluginManifest`, `RawPluginManifestPaths`, test constant `ALTERNATE_PLUGIN_MANIFEST_RELATIVE_PATH`).
- [codex-src-startup] `codex-rs/core-plugins/src/startup_sync.rs`, blob sha `ee91e3efe45c13c2c89ab804f369c6c2e70dba79`.
- [codex-src-upgrade] `codex-rs/core-plugins/src/marketplace_upgrade.rs`, blob sha `ae062b62186ab80525ecdd85e548c7a799a07357`; `manager.rs` blob sha `96833721c87fae13f335600e9d9a54172c038c23`.
- Repo: https://github.com/openai/codex

# Research: Codex plugin and marketplace format

Ticket: [#9 Research: Codex plugin and marketplace format](https://github.com/Ahmadnmic/Brand-OS-wayfinder/issues/9).
Everything below was observed on 2026-10-27. Codex is not installed on the research machine;
nothing here was executed against a Codex binary. Source citations are tagged `[D*]` (OpenAI
docs), `[S*]` (openai/codex source at `main` commit `2cab11ca40aad193382348a7bda46da2fc47596a`,
2026-10-27T05:52Z; latest release tag `rust-v0.164.0`, 2026-10-23), `[P*]` (openai/plugins
example repo), `[M*]` (mattpocock/skills clone), `[C*]` (Claude Code docs), `[A*]` (open specs).
The full list is in **Sources**.

## Question

How does OpenAI Codex package and install plugins (`codex plugin marketplace add <owner/repo>`,
`codex plugin add <name>@<marketplace>`): the manifest file and its location, what a plugin can
ship (skills, MCP server config, hooks, commands), how skills are discovered and triggered
(including `agents/openai.yaml` next to `SKILL.md`), how updates happen ("updates itself at
startup"), how MCP servers are configured (`config.toml` `mcp_servers`) and whether a plugin can
declare them, and whether one GitHub repo can be a Codex marketplace and a Claude Code marketplace
at the same time without file or naming clashes.

## Summary

- Codex looks for a plugin manifest in this order: root `plugin.json` (only if its `$schema` is the
  Agent Plugins URI), then `.codex-plugin/plugin.json`, `.claude-plugin/plugin.json`,
  `.cursor-plugin/plugin.json`; the first regular file wins [S1][S2]. A repo with only
  `.claude-plugin/plugin.json` is therefore a valid Codex plugin.
- A marketplace is a JSON file at one of `.agents/plugins/marketplace.json`,
  `.agents/plugins/api_marketplace.json`, `.claude-plugin/marketplace.json`,
  `.cursor-plugin/marketplace.json` (checked in that order) [S7]. Install id is
  `<entry name>@<marketplace name>` [S9][D8].
- Codex reads from a legacy (`.codex-plugin`/`.claude-plugin`) manifest only: `name`, `version`,
  `description`, `keywords`, `skills` (string or array of `./` paths), `mcpServers` (path or inline
  object), `apps`, `hooks`, `interface`; unknown keys are ignored; `commands/*.md` are converted into
  skills at install time [S3][S12][S21]. Defaults: `skills/`, `.mcp.json`, `hooks/hooks.json`,
  `.app.json` [S6].
- CLI: `codex plugin marketplace add <owner/repo | owner/repo@ref | git URL | local dir> [--ref]
  [--sparse PATH]`, `marketplace list|upgrade [name]|remove <name>`, `codex plugin add
  PLUGIN[@MARKETPLACE] [-m NAME]`, `plugin list [--available --json]`, `plugin remove`. There is no
  `codex plugin update` [S9][S8][D8].
- Skills: a directory with `SKILL.md`; Codex reads only `name`, `description` and
  `metadata.short-description` from the frontmatter and ignores every other key, including Claude's
  `disable-model-invocation` [S14]. Codex-specific UI and policy live in `agents/openai.yaml`
  (`interface.*`, `policy.allow_implicit_invocation`, `dependencies.tools[]`) [S15][S16][D2].
- Skill roots outside plugins: `.agents/skills` in every directory from cwd up to the repo root,
  `$HOME/.agents/skills`, `/etc/codex/skills`, bundled system skills, and (source only) a project
  `.codex/skills` plus the deprecated `$CODEX_HOME/skills` [D2][S18]. Triggered by `$name`,
  `/skills`, or implicitly by description match; the initial list is capped at 2% of context [D2].
- MCP: user config is `[mcp_servers.<name>]` in `~/.codex/config.toml` (stdio `command/args/env`,
  or `url` + auth) [D3][D4]. A plugin bundles servers in `.mcp.json` (legacy) or `mcp.json`
  (portable); users can only toggle and set tool policy under `[plugins."name@mkt".mcp_servers.<s>]`
  [D3][D4][S6][S19]. Codex does **not** substitute `${CLAUDE_PLUGIN_ROOT}` in a legacy `.mcp.json`
  (no such code found; relative `cwd` is joined to the plugin root instead) [S19].
- Updates: at startup, when plugins are enabled, a background thread refreshes every configured Git
  marketplace (remote revision compared with the installed snapshot, re-cloned if different) and
  force-reinstalls the plugins from any marketplace that changed; a separate pass reinstalls a
  plugin only when its computed version changed [S10][S11][S6]. Codex copies the plugin tree into
  `~/.codex/plugins/cache/<marketplace>/<plugin>/<version>/` and **drops symlinks** while copying
  [S12][D5].
- One repo can serve both agents today: mattpocock/skills ships only `.claude-plugin/plugin.json` +
  `.claude-plugin/marketplace.json` + per-skill `agents/openai.yaml`, and documents
  `codex plugin marketplace add mattpocock/skills` / `codex plugin add mattpocock-skills@mattpocock`
  [M1][M2][M3]. The shared file must stick to the intersection: `./`-relative, `url`, `git-subdir`
  or `npm` plugin sources (Claude's `github` object source is not in Codex's parser) [S7][C2].
- Differences Brand OS must design around: Claude Code auto-update is **off** by default for
  third-party marketplaces while Codex refreshes at startup [C3][S10]; `${CLAUDE_PLUGIN_ROOT}` in
  `.mcp.json` is Claude-only [S19][C1]; hooks declared in a shared `.claude-plugin/plugin.json` are
  loaded by Codex too [S6]; Codex ignores `agents/`, `userConfig`, `lspServers`, `outputStyles` [S3].

## Findings

### Plugin manifest and layout

**Lookup order.** `find_plugin_manifest_path` first checks `<root>/plugin.json`: it is used only
when the file is a regular file (not a symlink) and its `$schema` starts with
`https://agent-plugins.org/schemas/` (exactly `.../1.0.0/plugin.schema.json` is the supported
value) [S2]. Otherwise Codex walks `DISCOVERABLE_PLUGIN_MANIFEST_PATHS` =
`[".codex-plugin/plugin.json", ".claude-plugin/plugin.json", ".cursor-plugin/plugin.json"]` and
takes the first that exists as a regular file; if a candidate's parent exists but is not a
directory, or the candidate exists but is not a regular file, lookup fails for the whole plugin
[S1][S2]. The loader reports a plugin without any manifest as "missing or invalid plugin.json"
[S6]. The developer docs say the same in prose: "OpenAI also accepts legacy and Claude-compatible
manifests, but new packages should use this format" (the root `plugin.json`) [D5].

**Two formats.** A root `plugin.json` is parsed as the portable *Agent Plugins* manifest
(`PluginManifestFormat::AgentPlugin`); any of the dot-directory manifests is parsed as *Legacy*
[S4]. The format changes behaviour: Legacy discovers `SKILL.md` recursively under each skill
root, AgentPlugin only among direct children; hooks are loaded only for Legacy manifests [S6].

**Legacy manifest fields** (`.codex-plugin/plugin.json` and, by fallback, `.claude-plugin/plugin.json`),
all camelCase, all optional [S3]:

| Field | Shape | Notes |
|---|---|---|
| `name` | string | Falls back to the plugin directory name when blank [S3]. Must be a valid path segment [S12]. |
| `version` | string | Trimmed; names the cache directory; blank is rejected [S12]. |
| `description`, `keywords` | string, string[] | Shown in listings [S3]. |
| `skills` | string **or** string[] | `./`-relative directories. Default `skills/` when absent [S3][S6]. |
| `mcpServers` | path string **or** inline object | Default `.mcp.json` when absent [S3][S6]. |
| `apps` | path string | Default `.app.json` [S3][S6]. |
| `hooks` | path, path[], inline hooks object, or array of them | Default `hooks/hooks.json` [S3][S6][D6]. |
| `interface` | object | `displayName`, `shortDescription`, `longDescription`, `developerName`, `category`, `capabilities[]`, `websiteURL`, `privacyPolicyURL`, `termsOfServiceURL`, `defaultPrompt` (string or up to 3 strings of ≤128 chars), `brandColor`, `composerIcon`, `logo`, `logoDark`, `screenshots[]` [S3]. |
| `extensions` | any JSON | Carried, not interpreted for legacy manifests [S3]. |
| `commands` | path or path[] | Read separately; default `commands/`; converted into skills at install (see below) [S3][S21]. |

`RawPluginManifest` does not set `deny_unknown_fields`, so Claude-only keys (`author`, `homepage`,
`agents`, `lspServers`, `userConfig`, `outputStyles`, `workflows`, `dependencies`, ...) are
silently ignored [S3]. Manifest paths must start with `./` and stay inside the plugin root [D5].

**Portable (Agent Plugins) root manifest.** Allowed keys: `$schema` (required), `name` (required,
`^[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$`, ≤64 chars, no `--`/`..`), `version`, `description`,
`author{name,email,url}`, `homepage`, `repository`, `license`, `keywords`, `extensions`; unknown
keys are dropped with a warning [S5][A1]. Codex applies fixed defaults: skills `./skills`, MCP
`./mcp.json`, `interface.displayName = name`, `category = "Other"` [S5]. OpenAI-specific settings
(`apps`, `hooks`, `onboardingSkill`, `interface`) come from `extensions["com.openai"]`; when that
object is absent Codex reads `.codex-plugin/plugin.json` as an overlay for exactly those four
things [S5][S4][D5]. Docs: "When `extensions.com.openai` is an object, it replaces the entire
`.codex-plugin/plugin.json` overlay... the two aren't merged" [D5].

**Example layout (openai/plugins, `plugins/figma`)**: `.codex-plugin/plugin.json`, `.mcp.json`,
`.app.json`, `hooks.json`, `skills/<name>/SKILL.md`, `commands/*.md`, `agents/*.md` +
`agents/openai.yaml`, `assets/`, `scripts/`, `plugin.lock.json`, `README.md` [P2]. The repo README
describes the required file as `.codex-plugin/plugin.json` with optional `skills/`, `.app.json`,
`.mcp.json`, `agents/`, `commands/`, `hooks.json`, `assets/` [P1]. The figma manifest uses
`"skills": "./skills/"`, `"apps": "./.app.json"` and a full `interface` block [P3].

**Install location and cache.** Installed plugins live under
`~/.codex/plugins/cache/$MARKETPLACE_NAME/$PLUGIN_NAME/$VERSION/`; local plugins use `$VERSION`
`local` [D5]. The store builds the path as `<root>/<marketplace>/<plugin>/<version>` and derives
`version` from the manifest's `version` string (a default constant when absent; for Agent Plugins
manifests an invalid version string is hashed into `agent-plugins-<12 hex>`) [S12]. Installation
copies the source tree with `copy_dir_recursive`, which copies only entries whose `file_type()` is
a directory or a regular file: **symlinks are skipped** [S12]. After copying, for non-Agent-Plugins
manifests, `migrate_plugin_commands` turns `commands/*.md` (or the manifest's `commands` paths)
into `SKILL.md` skills under `.codex-plugin/migrated-command-skills/` (max 4,000 bytes each, must
have a frontmatter `description`), and that directory is added as a skill root [S12][S21][S6][S23].

### Marketplaces and `codex plugin` commands

**Marketplace file.** `MARKETPLACE_MANIFEST_RELATIVE_PATHS` = `.agents/plugins/marketplace.json`,
`.agents/plugins/api_marketplace.json`, `.claude-plugin/marketplace.json`,
`.cursor-plugin/marketplace.json` [S7]. The docs name `$REPO_ROOT/.agents/plugins/marketplace.json`
(repo) and `~/.agents/plugins/marketplace.json` (personal), and say a "legacy-compatible
`$REPO_ROOT/.claude-plugin/marketplace.json`" is also read [D5]; the enterprise page lists both
layouts and says Claude-compatible plugins are supported in entries [D7].

**Schema** (`RawMarketplaceManifest`) [S7]:

```json
{
  "name": "openai-curated",
  "interface": { "displayName": "Codex official" },
  "plugins": [
    {
      "name": "linear",
      "source": { "source": "local", "path": "./plugins/linear" },
      "policy": { "installation": "AVAILABLE", "authentication": "ON_INSTALL" },
      "category": "Productivity"
    }
  ]
}
```

(verbatim from the openai/plugins marketplace [P4]). `name` and `plugins[]` are required;
`interface.displayName` is optional. Each entry needs `name` and `source`; `policy` defaults to
`installation: AVAILABLE` (values `NOT_AVAILABLE`, `AVAILABLE`, `INSTALLED_BY_DEFAULT`) and
`authentication: ON_INSTALL` (or `ON_USE`), optionally `products[]`; `category` is optional; every
other key on an entry is kept as a *fallback manifest* used when the plugin directory has no
manifest of its own [S7]. Unknown top-level keys (Claude's `owner`, `metadata`) are ignored because
the struct has no `deny_unknown_fields` [S7].

**Plugin source types** (`RawMarketplaceManifestPluginSource`) [S7]:

| Shape | Meaning |
|---|---|
| `"./path"` (plain string) | Local directory relative to the marketplace root; `.` or `./` = the root itself; must start with `./` and contain no `..` [S7]. |
| `{"source":"local","path":"./..."}` | Same as above [S7][D5]. |
| `{"source":"url","url":...,"path"?,"ref"?,"sha"?}` | Git repo (plugin at root or at `path`) [S7]. |
| `{"source":"git-subdir","url":...,"path":...,"ref"?,"sha"?}` | Git repo subdirectory [S7][D5]. |
| `{"source":"npm","package":...,"version"?,"registry"?}` | npm package; lifecycle scripts don't run [S7][D5]. |

An entry whose source matches none of these falls into an `Unsupported` variant; the docs say Codex
"skips that entry instead of failing the whole marketplace" [S7][D5]. The marketplace root is the
directory that contains `.agents/` or `.claude-plugin/`, and local paths resolve against it, not
against the `.agents/plugins/` folder [S7][D5].

**Commands** (clap definitions) [S9][S8][D8]:

```
codex plugin marketplace add <SOURCE> [--ref REF] [--sparse PATH]... [--json]
codex plugin marketplace list [--json]
codex plugin marketplace upgrade [MARKETPLACE] [--json]
codex plugin marketplace remove <MARKETPLACE> [--json]
codex plugin add    <PLUGIN[@MARKETPLACE]> [--marketplace|-m NAME] [--json]
codex plugin list   [--marketplace|-m NAME] [--available] [--json]   # --available requires --json
codex plugin remove <PLUGIN[@MARKETPLACE]> [--marketplace|-m NAME] [--json]
```

`SOURCE` accepts GitHub shorthand `owner/repo` or `owner/repo@ref`, an HTTP(S) or SSH Git URL, or a
local root directory; `--sparse` is accepted only for Git sources ("--sparse is only supported for
git marketplace sources") [D8][S8]. `marketplace upgrade` refreshes one or all Git marketplaces
[D8]. The `PluginSubcommand` enum contains only `Add`, `List`, `Marketplace`, `Remove`: there is no
`update`, `install`, `enable` or `disable` subcommand [S9]. Adding writes a `[marketplaces.<name>]`
entry to `config.toml` (`source`, `source_type = "git" | "local"`, `ref`, `sparse_paths`) [D4][S8];
the marketplace name is the `name` field of the marketplace file (the upgrade path re-validates
that the cloned root still reports the configured name) [S11][S7]. Installing writes
`[plugins."<plugin>@<marketplace>"] enabled = true`; a repo can set the same key to `false` in its
`.codex/config.toml` (trusted projects only) [D4][D5]. The TUI `/plugins` browser installs from
configured marketplaces too; "start a new session before using bundled skills or tools" [D1].

Alongside configured marketplaces Codex syncs OpenAI's curated catalogue: `startup_sync.rs` fetches
`https://github.com/openai/plugins.git` (via git, falling back to the GitHub HTTP API and then to a
ChatGPT export archive) into `$CODEX_HOME/.tmp/plugins` [S13]. That is the source of the "Codex
official" marketplace, separate from third-party ones.

### Skills in Codex (discovery, frontmatter, `agents/openai.yaml`)

**Discovery roots.** Docs table [D2]: `$CWD/.agents/skills`, `$CWD/../.agents/skills` (when inside
a Git repo), `$REPO_ROOT/.agents/skills` (REPO scope); `$HOME/.agents/skills` (USER);
`/etc/codex/skills` (ADMIN); bundled skills (SYSTEM). "Codex scans `.agents/skills` in every
directory from the current working directory up to the repository root"; same-named skills are not
merged; symlinked skill folders are followed; changes are detected automatically [D2]. Source
agrees and adds two roots the docs omit: the project config layer's `<repo>/.codex/skills` (Repo
scope) and the deprecated `$CODEX_HOME/skills` (User scope) [S18]. Plugin skill roots are appended
to the same list [S18][S6].

**`SKILL.md` frontmatter.** The parser struct has three fields: `name` (optional; defaults to the
directory name; ≤64 chars), `description` (required, non-empty, whitespace-collapsed) and
`metadata.short-description` [S14]. Everything else is ignored, so Claude Code's
`disable-model-invocation`, `user-invocable`, `allowed-tools`, `context`, `paths` and the rest have
no effect in Codex [S14][C4]. Docs: `name` and `description` are required and the description
"drives implicit matching" [D2]. The open spec Codex cites requires `name` to match the parent
directory and allows `license`, `compatibility`, `metadata`, `allowed-tools` [A2].

**`agents/openai.yaml`** (optional, next to `SKILL.md`) [S15][S16][S17][D2]:

```yaml
interface:
  display_name: "..."        # <= 64 chars
  short_description: "..."   # <= 1024 chars
  icon_small: "./assets/x.svg"   # relative, under assets/ (or ../ into the plugin's assets/)
  icon_large: "./assets/x.png"
  brand_color: "#RRGGBB"
  default_prompt: "..."      # <= 1024 chars
policy:
  allow_implicit_invocation: false   # default true
  products: []               # product restriction list
dependencies:
  tools:
    - type: "mcp"            # required
      value: "server-name"   # required
      description: "..."
      transport: "streamable_http"
      url: "https://..."
      command: "..."
      oauth: { callbackPort: 4321 }
```

Invalid individual dependency entries are dropped with a warning [S15]. `policy.allow_implicit_invocation:
false` means Codex will not pick the skill from a prompt; explicit `$skill` still works [D2][S17].
`features.skill_mcp_dependency_install` (on by default) lets Codex offer to install a declared MCP
dependency [D4].

**Triggering.** Explicit: `/skills` or a `$name` mention in Codex CLI/IDE, `@` in ChatGPT [D2][D10].
Implicit: Codex loads every skill's name, description and path into a list capped at 2% of the
model's context window (8,000 characters when unknown; `skills.max_context_tokens` raises it to at
most 10,000 tokens), shortens descriptions when crowded, and may omit skills with a warning; the
model then chooses a skill whose description matches [D2][D4]. Codex also treats a shell command
that reads a `SKILL.md` or runs a script under a skill's `scripts/` directory as an implicit
invocation of that skill [S24]. Per-skill enable/disable: `[[skills.config]] path = ".../SKILL.md"
enabled = false` in `config.toml` [D2][D4].

**Skills inside plugins.** Default root `skills/` (or the manifest's `skills` paths), recursive for
legacy manifests, direct children for Agent Plugins manifests [S6]. Plugin skills carry the plugin
id and a `plugin_id` on their metadata; icons may resolve into the plugin's shared `assets/` [S16].

### MCP servers in Codex and in plugins

**User/project config.** `~/.codex/config.toml` (and a trusted project's `.codex/config.toml`) hold
one `[mcp_servers.<name>]` table per server [D3]. Stdio: `command` (required), `args`, `env`,
`env_vars`, `cwd`, `experimental_environment`. Streamable HTTP: `url` (required), `auth`
(`oauth` default | `chatgpt`), `bearer_token_env_var`, `http_headers`, `env_http_headers`,
`http_headers_helper`, `oauth.*`, `scopes`. Common: `enabled`, `required`, `startup_timeout_sec`
(10), `tool_timeout_sec` (60), `enabled_tools`, `disabled_tools`, `default_tools_approval_mode`
(`auto|prompt|writes|approve`), `tools.<tool>.approval_mode`, `tools.<tool>.output_token_limit`
[D3][D4]. CLI: `codex mcp add <name> -- <command...>` or `--url`, `get`, `list`, `login`,
`logout`, `remove` [D3][D8].

**Plugins can declare servers.** "Installed plugins can bundle MCP servers in their plugin
manifest. The plugin launches these servers, so user config doesn't set their transport command"
[D3]. Users control only on/off and tool policy:

```toml
[plugins."sample@test".mcp_servers.sample]
enabled = true
default_tools_approval_mode = "prompt"
enabled_tools = ["read", "search"]
```

[D3][D4]. Enabled plugin servers are subject to the same sandbox and approval policy as
user-configured ones [D1].

**Legacy `.mcp.json`** (default file for `.codex-plugin`/`.claude-plugin` manifests, or the
manifest's `mcpServers` path/object) [S6]: the file is `{"mcpServers": {...}}` or a bare map; each
server object is deserialised directly into Codex's `McpServerConfig` (the same keys as the
`config.toml` table) after normalisation: a `type` key is removed (`http`, `streamable_http`,
`streamable-http`, `stdio` are known, others only warn), camelCase `oauth.{clientId,clientSecret,
callbackUrl,callbackPort}` are mapped to snake_case, and a relative `cwd` is joined to the plugin
root [S19][D3]. `ema_auth` is refused in plugin declarations [S19]. No `${CLAUDE_PLUGIN_ROOT}` or
`${PLUGIN_ROOT}` substitution appears anywhere in the legacy path that was read [S19][S6]. The
figma example declares `{"type":"http","url":"https://mcp.figma.com/mcp","oauth_resource":...}`
[P5].

**Portable `mcp.json`** (Agent Plugins format): `$schema`
`https://agent-plugins.org/schemas/1.0.0/mcp.schema.json`; each server has a required transport
`type` of `stdio`, `streamable-http` or `sse`; `${PLUGIN_ROOT}` and `${PLUGIN_DATA}` are substituted
and also injected into the stdio environment; stdio `cwd` defaults to `${PLUGIN_ROOT}` and must stay
under `./`, `${PLUGIN_ROOT}` or `${PLUGIN_DATA}` [S20][D5]. The docs warn: "Don't just rename
`.mcp.json`: the portable MCP format also declares a transport `type` for each server" [D5]. When
both a root manifest and a `.codex-plugin/plugin.json` exist, a Codex overlay may add `env_vars` to
portable stdio servers [S22].

### Updates

**At startup.** `PluginsManager::maybe_start_plugin_startup_tasks_for_config` runs when
`plugins_enabled`: (1) the curated openai/plugins sync; (2) a thread named
`plugins-marketplace-auto-upgrade` that calls `upgrade_configured_marketplaces_for_config_with_mode(
config, None, PluginGitMode::Automatic)`; (3) remote-catalogue refreshes [S10]. For each
configured Git marketplace the upgrade reads the remote revision for the configured ref, compares it
with the installed snapshot's recorded metadata, and if they differ re-clones into a staging
directory, re-validates the marketplace name, and atomically activates it [S11]. For every
marketplace root that changed, Codex then calls
`refresh_non_curated_plugin_cache_force_reinstall_detailed`, re-materialising and reinstalling each
configured plugin from that root [S10]. A second, lighter pass
(`NonCuratedCacheRefreshMode::IfVersionChanged`) reinstalls a plugin only when the version read from
its manifest differs from the active cache version [S6][S10]. Errors surface as "Codex could not
update marketplace `<name>`: ..." warnings [S10]. The config reference adds that marketplace refresh
"can still install or refresh configured plugins while disabled" [D4].

Consequences: a new commit on the marketplace's branch is picked up at the next Codex start without
user action; whether the plugin's files change then depends on the path taken (force reinstall after
a marketplace change vs. version-gated refresh). mattpocock's install notes (dated 2026-10-08) say
Codex reinstalls "only when the `version` in `plugin.json` changes" [M3]; the source read on
2026-10-27 force-reinstalls after a marketplace upgrade [S10]. Which behaviour the released
`0.164.0` binary shows was not verified (see Gaps).

**Manually.** `codex plugin marketplace upgrade [name]` refreshes Git marketplaces [D8]; local
plugins require editing the source and restarting the app [D5]. A running session does not see new
skills or tools: "Bundled skills and MCP tools become available only in new chats or new CLI
sessions after installation" [D1]. Workspace-level GitHub marketplaces (ChatGPT admin import) are a
different mechanism: they "check for updates daily" and admins can **Sync now** [D7].

**Versioning.** The cache directory is named after the manifest `version` [S12][D5]. Agent Plugins
manifests without a version get `1.0.0`; legacy ones get a default constant (the docs show `local`
for local plugins) [S12][D5].

### One repo serving Codex and Claude Code at once (mattpocock/skills as the worked example)

**What the repo ships** (clone at commit `5beb35b040e3de97e54fa9e386d7e42d15c295c2`, 2026-10-19)
[M1]:

- `.claude-plugin/plugin.json`: `name: mattpocock-skills`, `version: 1.3.1`, `description`,
  `author`, `homepage`, `repository`, `license`, `keywords`, and a `skills` **array** of 27
  `./skills/<bucket>/<name>` paths (buckets `engineering/` and `productivity/`; `misc/`,
  `in-progress/`, `deprecated/` are deliberately excluded) [M1][M4].
- `.claude-plugin/marketplace.json`: `name: mattpocock`, `owner{name,url}`, `description`, one
  entry `{name: mattpocock-skills, source: "./", description, category, keywords}` [M1].
- **No** `.codex-plugin/`, no root `plugin.json`, no `.agents/plugins/`, no `.mcp.json`, no
  `hooks/`, no `commands/` [M1].
- Every skill directory holds `SKILL.md` plus `agents/openai.yaml` with
  `interface.display_name` and `interface.short_description`; the 23 user-invoked skills add
  `policy.allow_implicit_invocation: false`, paired by repo rule with
  `disable-model-invocation: true` in the `SKILL.md` frontmatter [M1][M4].
- `package.json` `version` script runs `changeset version && node scripts/sync-plugin-version.mjs`,
  which copies `package.json`'s version into `.claude-plugin/plugin.json` so every managed install
  route sees a release; `marketplace.json` has no version field "so it can't drift" [M1][M5][M3].
- Install block (README and `.agents/install-block.md`): Claude Code
  `claude plugin install mattpocock-skills@claude-plugins-official` (the official marketplace reads
  `.claude-plugin/plugin.json` directly); Codex `codex plugin marketplace add mattpocock/skills` then
  `codex plugin add mattpocock-skills@mattpocock`, "Updates itself at startup"; Copilot CLI reads
  the same two files [M2][M3][M5].
- ADR 0002, update 2026-10-07: "Codex `main` accepts a `skills` string array and falls back to
  `.claude-plugin/` when there is no `.codex-plugin/`... Codex still drops symlinks. On Codex
  0.161.0, the `@mattpocock` marketplace install loads the promoted model-invoked skills and nothing
  from `misc/` or `in-progress/`" [M5]. Earlier, `.codex-plugin/plugin.json` accepted `skills` only
  as a single string and a curated directory of symlinks "does not survive install" [M5].

**How Codex reads it, traced through the source.** `marketplace add mattpocock/skills` clones the
repo and finds `.claude-plugin/marketplace.json` (third in the lookup list; the `.agents/plugins/`
files are absent), so the marketplace name is `mattpocock` [S7]. The single entry's source `"./"`
resolves to the marketplace root [S7]. `codex plugin add mattpocock-skills@mattpocock` copies the
tree (no symlinks) into `~/.codex/plugins/cache/mattpocock/mattpocock-skills/1.3.1/` [S12][D5].
`find_plugin_manifest_path` finds no root `plugin.json` and no `.codex-plugin/`, takes
`.claude-plugin/plugin.json`, Legacy format [S1][S2][S4]. The `skills` array gives 27 roots,
scanned recursively [S3][S6]; `author`/`homepage`/`repository`/`license` are ignored [S3]; no
`.mcp.json`, `hooks/hooks.json` or `commands/` exist, so nothing else loads [S6][S21]. Each skill's
`agents/openai.yaml` supplies the display name and invocation policy [S15]. Claude Code reads the
same two files per its own reference and ignores the `agents/openai.yaml` files inside skill
directories (a skill directory may contain any files) [C1][C2][A2].

**Where the two formats overlap and where they don't** (for a single shared file set):

| Concern | Codex | Claude Code | Shared-file verdict |
|---|---|---|---|
| Marketplace file | `.agents/plugins/marketplace.json` first, `.claude-plugin/marketplace.json` fallback [S7] | `.claude-plugin/marketplace.json` (default `path`) [C2] | One file at `.claude-plugin/marketplace.json` works for both. |
| Marketplace top level | `name`, `interface.displayName`, `plugins[]`; unknown keys ignored [S7] | `name`, `owner` (required), `plugins[]`, `description`, `metadata`...; unknown keys ignored, validator warns [C2] | Put `name`, `owner`, `description`, `plugins[]`; optionally `interface.displayName`. |
| Entry fields | `name`, `source`, `policy`, `category`; extras become a fallback manifest [S7] | `name`, `source`, `description`, `version`, `category`, `tags`, `strict`, ... [C2] | `name`, `source`, `description`, `category` are safe in both. |
| Entry source | `./path` string, `local`, `url`, `git-subdir`, `npm` [S7] | `./path`, `github`, `url`, `git-subdir`, `npm`, `archive`, `command` [C2] | Use `"./"` or `./plugins/<x>` for in-repo plugins; `url`/`git-subdir`/`npm` for external. Never `github`, `archive`, `command`. |
| Plugin manifest | root `plugin.json` → `.codex-plugin` → `.claude-plugin` [S1][S2] | `.claude-plugin/plugin.json` only [C1] | One `.claude-plugin/plugin.json` serves both. Adding `.codex-plugin/plugin.json` makes Codex prefer it and creates a second file to keep in sync. |
| Manifest `skills` | string or array of `./` dirs, recursive scan; default `skills/` [S3][S6] | path or array, adds to default `skills/` [C1] | Identical shape. |
| Manifest `version` | names the cache dir; drives version-gated refresh [S12][S6] | pins users until changed [C1][C3] | Bump on every release (mattpocock's sync script). |
| Manifest `hooks` | path/array/inline; default `hooks/hooks.json`; loaded for legacy manifests [S3][S6][D6] | same shapes; default `hooks/hooks.json` [C1] | A `hooks` key in the shared manifest runs in **both** agents. |
| Manifest `mcpServers` | path or inline object; default `.mcp.json` [S3][S6] | path, bundle, inline, array; default `.mcp.json` [C1] | Same default file. Variable substitution differs (below). |
| `commands/` | migrated into skills at install [S21] | slash commands; "Prefer `skills/` for new plugins" [C1] | Prefer skills. |
| `agents/*.md` | ignored [S3] | subagents [C1] | Claude-only; no clash. |
| `userConfig`, `lspServers`, `outputStyles`, `workflows`, `settings`, `bin/` | ignored [S3] | Claude features [C1] | Claude-only; no clash. |
| Symlinks | dropped on install [S12] | followed in skill dirs; limited inside plugins [C4][C3] | Avoid symlinks in the shipped tree. |
| Skill invocation policy | `agents/openai.yaml` `policy.allow_implicit_invocation` [S15] | `SKILL.md` `disable-model-invocation`, `user-invocable` [C4] | Set both, as mattpocock does [M4]. |
| Skill frontmatter | `name`, `description`, `metadata.short-description` only [S14] | many fields; unknown ignored [C4] | Keep Claude-specific keys; Codex ignores them. |

Naming: Codex plugin and marketplace names must be valid path segments [S12][S11]; Claude Code
names use letters, digits, `.`, `_`, `-`, start alphanumeric, and must not resemble Anthropic's
own (`claude-*`, `anthropic-*`, names containing "claude" warn) [C1][C2]. A kebab-case name
such as `brand-os` satisfies both. The Codex install id `brand-os@<marketplace>` and the Claude id
`brand-os@<marketplace>` coincide when the marketplace `name` field is the same file [S9][C3].

### Differences from Claude Code that Brand OS must design around

1. **Auto-update defaults differ.** Codex refreshes configured Git marketplaces at every startup
   [S10]. Claude Code's background auto-update is on only for Anthropic's official marketplaces and
   marketplaces added from claude.ai; it is **off** for every other marketplace unless the user
   toggles **Enable auto-update** or sets `autoUpdate` in `extraKnownMarketplaces`, and it runs up
   to ten minutes after the first message [C3]. ADR 0002's "the plugin updates itself" holds for
   Codex out of the box but needs an opt-in step (or a `claude plugin update` instruction) for
   Claude Code users, unless Brand OS is listed in `claude-plugins-official`.
2. **`${CLAUDE_PLUGIN_ROOT}` is Claude-only.** Claude resolves it in `.mcp.json` `command`, `args`,
   `env` [C1]; Codex's legacy `.mcp.json` parser does no substitution and only joins a relative
   `cwd` to the plugin root [S19]. For the one local stdio MCP server (ADR 0001) the shared
   `.mcp.json` must launch the server without an absolute path to the plugin, for example a command
   on `PATH` or a package runner (`npx`/`uvx`), or Brand OS must ship two MCP files (Claude's
   `.mcp.json` with `${CLAUDE_PLUGIN_ROOT}`, Codex's portable `mcp.json` with `${PLUGIN_ROOT}`
   under a root `plugin.json`, which then becomes the manifest Codex prefers [S1][S20]).
3. **Hooks are shared by default.** Because Codex loads `hooks` from the same legacy manifest and
   the same `hooks/hooks.json` [S6][D6], any hook Brand OS adds for Claude Code (for example to
   support the Mod) also reaches Codex users, who must review and trust it before it runs [D6].
   Keeping hooks Claude-only requires a separate `.codex-plugin/plugin.json` without `hooks` (Codex
   would prefer it) or no plugin hooks at all. Event names overlap (`PreToolUse`, `PostToolUse`,
   `SessionStart`, `SessionEnd`, `Stop`, `UserPromptSubmit`, `SubagentStart/Stop`, `PreCompact`,
   `PermissionRequest`) [D6][C1]; matcher semantics were not compared.
4. **Skill context budget.** Codex's skill list is capped at 2% of the context window and shortens
   descriptions when crowded [D2]; Claude truncates `description` + `when_to_use` at 1,536
   characters [C4]. Brand OS's "lean skills" should have short, front-loaded descriptions.
5. **Skill discovery scope.** Codex scans skill roots recursively for legacy manifests [S6]: any
   stray `SKILL.md` under `skills/` (for example inside a reference folder) becomes a skill. Keep
   `SKILL.md` only at skill roots. Project skills live in `.agents/skills` for Codex and
   `.claude/skills` for Claude [D2][C4]; a Brand OS project-level convention must write to both or
   rely on the plugin.
6. **Codex-only presentation.** `interface.*` in the manifest and `agents/openai.yaml` per skill
   give Codex/ChatGPT a display name, icon and brand colour [S3][S16]; Claude ignores them. They
   are cheap to ship and harmless.
7. **Marketplace source types.** Codex cannot parse Claude's `{"source":"github","repo":...}`
   plugin source [S7][C2]; use `"./"`-relative or `url`/`git-subdir` entries only. Claude's
   marketplace needs an `owner`; Codex ignores it [C2][S7].
8. **Symlinks and in-place loading.** Codex always copies into its cache and drops symlinks
   [S12]; Claude loads relative-path plugins from a local-path marketplace in place [C3]. Build the
   shipped tree with real files.
9. **Packages outside the repo** (ADR 0002) are unaffected: neither manifest needs to mention Brand
   Packages, which the MCP server finds at run time. Codex plugins also get a per-plugin data
   directory (`${PLUGIN_DATA}` for portable manifests) [S20]; the legacy path uses
   `<root>/.plugin-data` as a fallback [S6]. Claude's `${CLAUDE_PLUGIN_DATA}` is the analogue [C1].
10. **Validation.** Claude has `claude plugin validate` [C1]; no equivalent `codex plugin validate`
    subcommand exists [S9]. Codex only logs "failed to parse plugin manifest" warnings at load
    [S4].

## Gaps and open questions

- **Released behaviour not run.** Codex is not installed here; every behavioural claim comes from
  docs and `main` source, not from executing `0.164.0`. In particular: whether the startup upgrade
  force-reinstalls a plugin whose `version` did not change (source [S10]) or only reinstalls on a
  version change (mattpocock's 2026-10-08 note [M3]) should be checked on a binary.
- **Hooks under the portable manifest.** `load_plugin` skips hooks when the manifest format is
  AgentPlugin [S6], while the docs describe `extensions.com.openai.hooks` for root `plugin.json`
  [D5]. Either another code path loads them or the docs are ahead of the source; not resolved.
- **Variable substitution for legacy `.mcp.json`.** No `${...}` expansion was found in
  `codex-mcp/src/plugin_config.rs` or `core-plugins/src/loader.rs` [S19][S6]; `McpServerConfig`'s
  own deserialiser in the `codex-config` crate was not read, so a later expansion step cannot be
  ruled out. Whether Claude Code honours a `cwd` key in `.mcp.json` was not checked.
- **Default legacy version string.** `DEFAULT_PLUGIN_VERSION` lives in `core-plugin-common` and
  was not read; the docs show `local` for local plugins [S12][D5].
- **Marketplace name derivation** was inferred from `validate_marketplace_source_root` returning
  the name and from the `@mattpocock` example, not traced line by line [S11][M2].
- **Plugin-level `agents/openai.yaml`** in openai/plugins (`plugins/figma/agents/openai.yaml`) has
  no documented purpose in the pages read [P2].
- **Hook matcher semantics** (Codex tool names vs Claude's `Write|Edit`) were not compared.
- **`codex plugin marketplace add` default ref** when `--ref` is omitted was not verified (presumably
  the default branch).
- The `developers.openai.com/codex/*` URLs in the ticket now 308-redirect to `learn.chatgpt.com/docs/*`;
  the redirect targets are what was read.

## Sources

All observed 2026-10-27.

OpenAI documentation:

- [D1] https://learn.chatgpt.com/docs/plugins (redirect target of https://developers.openai.com/codex/plugins)
- [D2] https://learn.chatgpt.com/docs/build-skills (redirect target of https://developers.openai.com/codex/skills)
- [D3] https://learn.chatgpt.com/docs/extend/mcp?surface=cli (redirect target of https://developers.openai.com/codex/mcp)
- [D4] https://learn.chatgpt.com/docs/config-file/config-reference (redirect target of https://developers.openai.com/codex/config-reference)
- [D5] https://developers.openai.com/plugins/build/plugins ("Package your plugin")
- [D6] https://learn.chatgpt.com/docs/hooks
- [D7] https://learn.chatgpt.com/docs/enterprise/plugin-management
- [D8] https://learn.chatgpt.com/docs/developer-commands?surface=cli (redirect target of https://developers.openai.com/codex/cli/reference)
- [D9] https://developers.openai.com/plugins/build/skills
- [D10] https://learn.chatgpt.com/docs/skills-and-plugins
- [D11] https://developers.openai.com/plugins/concepts/plugins
- [D12] https://developers.openai.com/plugins/changelog (no entry about manifests or marketplaces)
- [D13] https://learn.chatgpt.com/docs/enterprise/managed-configuration
- [D14] https://raw.githubusercontent.com/openai/codex/main/docs/skills.md (three lines; points to the skills docs page)

openai/codex source, `main` at `2cab11ca40aad193382348a7bda46da2fc47596a` (2026-10-27T05:52Z);
latest release `rust-v0.164.0` (2026-10-23). Paths under `codex-rs/`:

- [S1] `exec-server-protocol/src/protocol.rs` (`DISCOVERABLE_PLUGIN_MANIFEST_PATHS`)
- [S2] `utils/plugins/src/plugin_namespace.rs` (`find_plugin_manifest_path`, `AGENT_PLUGIN_SCHEMA_URI`)
- [S3] `core-plugins/src/manifest.rs` (`RawPluginManifest`, `RawPluginManifestPaths`, `RawPluginManifestInterface`)
- [S4] `core-plugins/src/manifest/manifest_cache.rs` (`ManifestCache::load`)
- [S5] `core-plugins/src/agent_plugin_manifest.rs`
- [S6] `core-plugins/src/loader.rs` (`DEFAULT_*` constants, `load_plugin`, `plugin_skill_roots`, `default_mcp_config_paths`, `refresh_non_curated_plugin_cache_with_mode`, `load_mcp_servers_from_file`)
- [S7] `core-plugins/src/marketplace.rs` (`MARKETPLACE_MANIFEST_RELATIVE_PATHS`, `RawMarketplaceManifest*`, policies, local path rules)
- [S8] `core-plugins/src/marketplace_add.rs`
- [S9] `cli/src/plugin_cmd.rs` (`PluginSubcommand`, `AddPluginArgs`, `ListPluginsArgs`, `RemovePluginArgs`)
- [S10] `core-plugins/src/manager.rs` (`maybe_start_plugin_startup_tasks_for_config`, `upgrade_configured_marketplaces_for_config_with_mode`)
- [S11] `core-plugins/src/marketplace_upgrade.rs`
- [S12] `core-plugins/src/store.rs` (`plugin_root`, `plugin_manifest_version_for_source`, `copy_dir_recursive`, `replace_plugin_root_atomically`)
- [S13] `core-plugins/src/startup_sync.rs`
- [S14] `skills/src/parser.rs`
- [S15] `skills/src/metadata.rs`
- [S16] `skills/src/interface.rs`
- [S17] `skills/src/model.rs`
- [S18] `ext/skills/src/host_roots.rs`
- [S19] `codex-mcp/src/plugin_config.rs`
- [S20] `codex-mcp/src/agent_plugin_config.rs`
- [S21] `core-plugins/src/command_migration/plugin.rs` and `core-plugins/src/command_migration.rs`
- [S22] `core-plugins/src/agent_plugin_mcp_overlay.rs`
- [S23] `utils/plugins/src/lib.rs` (`PLUGIN_METADATA_DIR`, `MIGRATED_COMMAND_SKILLS_DIR`)
- [S24] `skills/src/invocation.rs`

openai/plugins example repo, `main` at `0722921d5542fc593105c27bd52630babd8b8c2a` (2026-10-08):

- [P1] https://github.com/openai/plugins/blob/main/README.md
- [P2] https://github.com/openai/plugins/tree/main/plugins/figma (directory listing)
- [P3] https://github.com/openai/plugins/blob/main/plugins/figma/.codex-plugin/plugin.json
- [P4] https://github.com/openai/plugins/blob/main/.agents/plugins/marketplace.json
- [P5] https://github.com/openai/plugins/blob/main/plugins/figma/.mcp.json

mattpocock/skills, local clone at
`/private/tmp/claude-501/-Users-ahmed-taher-Library-Application-Support-Claude-scratch-workspaces-32d28b34-8c36-4bb0-a3f4-7fbff257474a-dd8e3aa2-634e-4b00-a1ca-d0e948a1f4ca-scratch-2026-10-27-56dbca/9c3f3815-ea25-4feb-9ebf-59f53b225fbe/scratchpad/mattpocock-skills/repo`,
commit `5beb35b040e3de97e54fa9e386d7e42d15c295c2` (2026-10-19), remote https://github.com/mattpocock/skills:

- [M1] `.claude-plugin/plugin.json`, `.claude-plugin/marketplace.json`, repo tree, `skills/*/*/agents/openai.yaml`
- [M2] `README.md` ("Installation (30-second setup)")
- [M3] `.agents/install-block.md`
- [M4] `CLAUDE.md` / `AGENTS.md` (promoted-bucket and invocation rules)
- [M5] `.agents/adr/0002-ship-as-a-claude-code-plugin.md` (with updates dated 2026-08-05, 2026-10-07, 2026-10-08), `scripts/sync-plugin-version.mjs`, `package.json`

Claude Code documentation:

- [C1] https://code.claude.com/docs/en/plugins-reference (manifest reference)
- [C2] https://code.claude.com/docs/en/plugins/marketplace-reference
- [C3] https://code.claude.com/docs/en/plugins/loading
- [C4] https://code.claude.com/docs/en/skills

Open specifications:

- [A1] https://agent-plugins.org/schemas/1.0.0/plugin.schema.json
- [A2] https://agentskills.io/specification

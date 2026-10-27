# Research: packaging a local MCP server and reaching private GitHub repos

Ticket: [#12](https://github.com/Ahmadnmic/Brand-OS-wayfinder/issues/12). Researched 2026-10-27 against primary sources only; every version and observation below is "observed 2026-10-27" unless stated. Fetched content was treated as data. No token value was printed or copied.

## Question

(a) How is a local stdio MCP server distributed and started from a plugin (npx vs uvx vs bundled binary), how do Claude Code plugins and Codex declare MCP servers, and what does npx cost at startup? (b) How can that server read private GitHub repos (one per Brand Package) using the user's existing GitHub login, without new secrets? (c) What do the MCP spec and official SDKs say about stdio, tools, resources (could Brand Package files be resources as well as tools?) and versioning?

## Summary

- The current MCP revision is **2026-07-28**: stateless, no `initialize` handshake, protocol version carried per request in `_meta`, `server/discover` mandatory. Everything up to 2025-11-25 is the "legacy" handshake era. Both official SDK clients still default to the legacy handshake, and Claude Code 2.1.294 was observed running a v1-SDK (legacy) server; so build the server with a **dual-era** SDK server (TS v2 `serveStdio` serves legacy clients by default; Python `mcp` answers both). ([spec versioning](https://modelcontextprotocol.io/specification/versioning), [changelog](https://modelcontextprotocol.io/specification/2026-07-28/changelog), [TS protocol-versions](https://raw.githubusercontent.com/modelcontextprotocol/typescript-sdk/main/docs/protocol-versions.md))
- stdio contract: the client spawns the server as a subprocess; newline-delimited JSON-RPC; stdout carries only MCP messages; logs go to stderr; the server should exit on stdin EOF; shutdown is close-stdin, then SIGTERM, then SIGKILL. Neither spec revision says which environment variables the client passes. ([stdio 2026-07-28](https://modelcontextprotocol.io/specification/2026-07-28/basic/transports/stdio))
- Resources are a first-class spec feature with static URIs and RFC 6570 templates, text or base64 blob content and a MIME type; both SDKs expose them. Claude Code fetches `@server:uri` resources as attachments and auto-provides list/read tools; the Codex docs read never mention resources. So: **tools stay the primary surface (ADR-0001), resources are a cheap addition for Claude**. ([resources spec](https://modelcontextprotocol.io/specification/2026-07-28/server/resources), [Claude Code MCP](https://code.claude.com/docs/en/mcp))
- Claude Code plugin declaration: `.mcp.json` at the plugin root (`{"mcpServers": {...}}` or a bare map) or `mcpServers` in `plugin.json`; `${CLAUDE_PLUGIN_ROOT}` (per-version cache dir, changes on update) and `${CLAUDE_PLUGIN_DATA}` (persistent) are substituted in `command`/`args`/`env` and exported to the process; npm dependencies are auto-installed from a lockfile (registry packages only, no scripts, 60 s cap); Python dependencies are not. ([components](https://code.claude.com/docs/en/plugins/components), [loading](https://code.claude.com/docs/en/plugins/loading))
- Codex declaration: `[mcp_servers.<name>]` in `~/.codex/config.toml` (`command`, `args`, `env`, `env_vars` whitelist, `cwd`; startup timeout **10 s** default, tool timeout 60 s). Plugins bundle servers through a portable root `mcp.json` (`"type": "stdio"`, `${PLUGIN_ROOT}`) or the compatibility `.codex-plugin/plugin.json` + `.mcp.json`; Codex reads `.claude-plugin/marketplace.json` as a legacy-compatible marketplace and `codex plugin marketplace add owner/repo` accepts GitHub shorthand; local-MCP plugins install only from the ChatGPT desktop app. ([Codex MCP](https://learn.chatgpt.com/docs/extend/mcp?surface=cli), [Package your plugin](https://developers.openai.com/plugins/build/plugins), [desktop-only](https://developers.openai.com/plugins/deploy/desktop-only))
- Distribution: measured on this machine, a warm, offline `npx` start of a cached MCP server took **2.83 s** versus **0.24 s** for `node <file in plugin>`; `npx -y` installs into the npm cache and `--yes` is assumed when stdin is not a TTY; `uvx` needs `uv` on the machine and Claude's auto-install never covers Python; single binaries (Node SEA, stability "Active development"; Bun `--compile`) need per-platform builds and signing. Both installed local plugins and Codex's own desktop-only guidance use "ship the server inside the plugin and run it with the user's `node`". ([npm exec](https://docs.npmjs.com/cli/v11/commands/npm-exec), [uv tools](https://docs.astral.sh/uv/concepts/tools/), [Node SEA](https://nodejs.org/api/single-executable-applications.html))
- Private repos with the existing login: `gh auth token` prints the stored token (refreshing an expired one), `gh api` can request `Accept: application/vnd.github.raw+json`, `gh repo clone` and plain `git` work once `gh auth setup-git` has installed `gh auth git-credential` as the credential helper (observed on this machine; `git credential fill` returned `username`/`password` for github.com). Claude Code's own private-marketplace access uses exactly this: it "relies on whatever credentials that machine already holds" and recommends `gh auth login` then `gh auth setup-git`. The default `gh auth login` scope `repo` grants private-repo access. ([gh auth token](https://cli.github.com/manual/gh_auth_token), [gh auth setup-git](https://cli.github.com/manual/gh_auth_setup-git), [host a marketplace](https://code.claude.com/docs/en/plugins/host-marketplace), [scopes](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/scopes-for-oauth-apps))
- The OAuth device flow (OAuth App or GitHub App) needs only a public `client_id`, no secret, but it mints a **new** stored token (8 h access + 6-month refresh for GitHub Apps) and a GitHub App must be installed on every brand repo; keep it as the fallback for users without `gh`. ([device flow](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/authorizing-oauth-apps), [user access tokens](https://docs.github.com/en/apps/creating-github-apps/authenticating-with-a-github-app/generating-a-user-access-token-for-a-github-app))
- REST limits that shape a fetcher: contents API returns files up to 1 MB by default and up to 100 MB with the raw/object media types, directories up to 1,000 entries, `download_url` is single-use; tarball/zipball answer 302 with links that expire after five minutes for private repos; 5,000 requests/hour shared across everything the user's token does; conditional `304` responses are free. ([contents](https://docs.github.com/en/rest/repos/contents?apiVersion=2022-11-28), [rate limits](https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api?apiVersion=2022-11-28), [best practices](https://docs.github.com/en/rest/using-the-rest-api/best-practices-for-using-the-rest-api?apiVersion=2022-11-28))
- Caching/offline: Claude Code loads plugins from its cache at session start without network; a Brand Package clone kept in `${CLAUDE_PLUGIN_DATA}` (Codex: `${PLUGIN_DATA}`) with `git clone --depth=1 --single-branch`, refreshed by `git fetch` under `GIT_TERMINAL_PROMPT=0`, serves offline; the 2026-07-28 spec adds `ttlMs`/`cacheScope` so the server can tell clients how long tool and resource lists stay fresh. ([loading](https://code.claude.com/docs/en/plugins/loading), [git-clone](https://git-scm.com/docs/git-clone), [git env](https://git-scm.com/docs/git))

## Findings

### 1. stdio transport, tools and resources in the spec and SDKs

#### Protocol revisions and versioning

- Versions are `YYYY-MM-DD` strings marking "the last date backwards incompatible changes were made"; the version "will *not* be incremented" for backwards-compatible changes. "The **current** protocol version is **2026-07-28**." Deprecated features stay at least twelve months before removal. ([versioning](https://modelcontextprotocol.io/specification/versioning))
- 2026-07-28 "Key Changes" (previous revision 2025-11-25): removes protocol-level sessions and the `initialize`/`notifications/initialized` handshake; every request carries `io.modelcontextprotocol/protocolVersion`, `clientCapabilities` and (SHOULD) `clientInfo` in `_meta`; adds `server/discover`, which "servers MUST implement"; replaces `resources/subscribe` with `subscriptions/listen`; removes `ping`, `logging/setLevel`; deprecates Roots, Sampling and Logging ("log to `stderr` (stdio) or use OpenTelemetry instead of Logging"); requires `ttlMs` and `cacheScope` on `tools/list`, `resources/list`, `resources/read`, `resources/templates/list`; asks servers to return tools "in a deterministic order" for prompt-cache hits; changes resource-not-found from `-32002` to `-32602`; `UnsupportedProtocolVersionError` is `-32022`. ([changelog](https://modelcontextprotocol.io/specification/2026-07-28/changelog))
- Eras: "**Modern**: ... revision `2026-07-28` and later. **Legacy**: ... `initialize` handshake (`2025-11-25` and earlier). **Dual-era**: an implementation that supports both." Compatibility matrix: Modern client + Legacy server **fails**; Legacy client + Modern-only server **fails**; Legacy client + Dual-era server works; a dual-era server "MAY serve both eras concurrently on the same ... process". ([versioning 2026-07-28](https://modelcontextprotocol.io/specification/2026-07-28/basic/versioning))
- Legacy handshake (2025-06-18 page, still what legacy clients send): client sends `initialize` with `protocolVersion`, `capabilities`, `clientInfo`; server answers with its `capabilities`, `serverInfo` and optional `instructions`; client sends `notifications/initialized`. ([lifecycle 2025-06-18](https://modelcontextprotocol.io/specification/2025-06-18/basic/lifecycle))

#### stdio transport

- 2026-07-28 stdio page: "the client launches the MCP server as a subprocess"; "Messages are delimited by newlines, and **MUST NOT** contain embedded newlines"; "The server **MAY** write UTF-8 strings to `stderr` for any logging purposes"; the client "**SHOULD NOT** assume `stderr` output indicates error conditions"; "The server **MUST NOT** write anything to its `stdout` that is not a valid MCP message." Request metadata lives inline in `_meta`: "There is no header layer." Shutdown: close stdin, wait, then force-terminate ("On POSIX ... `SIGTERM` to `SIGKILL`"); "Servers **SHOULD** exit promptly when their standard input is closed". "If the server process exits unexpectedly, the client **SHOULD** restart it." Dual-era clients "**SHOULD** probe with `server/discover`" and fall back to `initialize` on any non-modern error or timeout. ([stdio 2026-07-28](https://modelcontextprotocol.io/specification/2026-07-28/basic/transports/stdio))
- The 2025-06-18 transports page states the same stdout/stderr/newline rules and "Clients **SHOULD** support stdio whenever possible." ([transports 2025-06-18](https://modelcontextprotocol.io/specification/2025-06-18/basic/transports))
- Neither revision says which environment variables the client passes to the subprocess. Claude Code's MCP page does not state it either in the parts read; Codex exposes an explicit `env_vars` whitelist (section 3). Treat the environment as **not guaranteed**: resolve `gh`, `git` and `node` via `PATH` and read nothing else from the environment that the plugin config did not set.

#### Tools

- Tools are "**model-controlled**"; a definition has `name`, `title`, `description`, `icons`, `inputSchema` (JSON Schema, default 2020-12, "**MUST** be a valid JSON Schema object"), optional `outputSchema` and `annotations` ("clients **MUST** consider tool annotations to be untrusted unless they come from trusted servers"). Results carry `content` (text, image, audio, `resource_link`, embedded `resource`) and optionally `structuredContent`; "a tool that returns structured content SHOULD also return the serialized JSON in a TextContent block"; execution errors use `isError: true`. Tool names: 1–128 chars, `A-Za-z0-9_-.`, unique per server; aggregating clients "**SHOULD** implement a disambiguation strategy such as prefixing tool names with a server identifier" (Claude Code does: `mcp__plugin_<plugin>_<server>__<tool>`). Stateful tools should return explicit opaque handles rather than rely on connection state. ([tools 2026-07-28](https://modelcontextprotocol.io/specification/2026-07-28/server/tools))
- "Resource links returned by tools are not guaranteed to appear in the results of a `resources/list` request", and "Servers that use embedded resources **SHOULD** implement the `resources` capability." (same page)
- OpenAI's build guide names the annotation hints Codex reads: `readOnlyHint`, `destructiveHint`, `openWorldHint`, and says "Annotations help ChatGPT and Codex choose appropriate confirmation and safety behavior." Brand OS tools are read-only and closed-world. ([Build an MCP server](https://developers.openai.com/plugins/build/mcp-server))

#### Resources: could Brand Package files be resources as well as tools?

- Resources are "**application-driven**, with host applications determining how to incorporate context"; servers declare the `resources` capability; `resources/list` (paginated), `resources/read` (may return several contents, e.g. a directory), `resources/templates/list` with RFC 6570 `uriTemplate` and completion support. Contents are `text` or base64 `blob` with `mimeType`; annotations `audience`, `priority`, `lastModified`. ([resources 2026-07-28](https://modelcontextprotocol.io/specification/2026-07-28/server/resources))
- URI guidance: `https://` only "when the client is able to fetch and load the resource directly from the web on its own"; otherwise "prefer ... a custom one, even if the server will itself be downloading resource contents over the internet". `file://` is for "resources that behave like a filesystem" and "Servers **MUST** sanitize file paths to prevent directory traversal attacks when serving `file://` resources". (same page) For Brand Packages in private repos a custom scheme such as `brand://<brand>/<path>` fits this guidance; `https://github.com/...` URIs would not, because the client cannot fetch them unauthenticated.
- Client support: Claude Code lets users type `@server:protocol://resource/path`; "Resources are automatically fetched and included as attachments when referenced"; "Claude Code automatically provides tools to list and read MCP resources when servers support them". ([Claude Code MCP](https://code.claude.com/docs/en/mcp)) The Codex MCP and config-reference pages read mention tools, approvals and OAuth but not resources; whether Codex surfaces resources is unverified (see Gaps).
- Conclusion for the decision: exposing each Brand Package file as a resource (plus `resources/templates/list` for `brand://{brand}/{path}`) is cheap in both SDKs and gives Claude Code users `@brand-os:brand://acme/tokens.json`; it must stay additive to tools because Codex support is unproven and resources are "application-driven" rather than model-invoked.

#### SDKs

- **TypeScript SDK**: `main` is v2, "the stable release line, implementing the 2026-07-28 MCP spec"; packages `@modelcontextprotocol/server` and `@modelcontextprotocol/client`; v1 (`@modelcontextprotocol/sdk`) lives on `v1.x`, "continues to receive bug fixes and security updates for at least six months after the v2 release (2026-07-27)", and "implements the MCP spec up to 2025-11-25". Runs on Node.js, Bun and Deno. Tools: `registerTool(name, config, handler)` with Zod v4 / Standard Schema `inputSchema`. ([v2 README](https://raw.githubusercontent.com/modelcontextprotocol/typescript-sdk/main/README.md), [v1 README](https://raw.githubusercontent.com/modelcontextprotocol/typescript-sdk/v1.x/README.md)) npm registry: `@modelcontextprotocol/server` 2.4.0 (modified 2026-10-23, `engines.node >=20`); `@modelcontextprotocol/sdk` 1.32.2 (2026-10-23, `node >=18`). GitHub latest release `v2.4.0` (2026-10-23).
- v2 stdio: `serveStdio` from `@modelcontextprotocol/server/stdio` takes a factory; "stdout is the JSON-RPC channel"; log with `console.error`; when the client closes stdin "the transport closes itself and the connection tears down"; a server "with nothing else keeping the event loop alive exits on its own". ([serving/stdio](https://raw.githubusercontent.com/modelcontextprotocol/typescript-sdk/main/docs/serving/stdio.md)) Era handling: `serveStdio` serves 2025-era clients by default (`legacy: 'stateless'`), `legacy: 'reject'` refuses them; the v2 **client** "uses the 2025 `initialize` handshake and sends no probe" by default, `mode: 'auto'` probes with `server/discover`. ([protocol-versions](https://raw.githubusercontent.com/modelcontextprotocol/typescript-sdk/main/docs/protocol-versions.md))
- v2 resources: `server.registerResource('config', 'config://app', { title, description, mimeType }, async uri => ({ contents: [{ uri: uri.href, text: '...' }] }))`; templates via `new ResourceTemplate('users://{userId}/profile', { list: undefined })` where "`list` is a required key — pass `undefined` when the instances are unbounded", and a `list` callback returning `{ resources: [...] }` makes instances appear in `resources/list`. ([servers/resources](https://raw.githubusercontent.com/modelcontextprotocol/typescript-sdk/main/docs/servers/resources.md))
- v1 (what the two local plugins use, `@modelcontextprotocol/sdk ^1.12.0`): `McpServer` from `@modelcontextprotocol/sdk/server/mcp.js`, `StdioServerTransport` from `@modelcontextprotocol/sdk/server/stdio.js`, `await server.connect(transport)`; `registerResource` with a static URI or `ResourceTemplate`; `registerTool` with `outputSchema` and `structuredContent`. ([v1 docs/server.md](https://raw.githubusercontent.com/modelcontextprotocol/typescript-sdk/v1.x/docs/server.md))
- **Python SDK**: package `mcp`, "Python 3.11+", `uv add "mcp[cli]"`; `MCPServer("Demo")`, `@mcp.tool()`, `@mcp.resource("greeting://{name}")`. ([README](https://raw.githubusercontent.com/modelcontextprotocol/python-sdk/main/README.md)) `mcp.run()` defaults to stdio and blocks; "In stdio mode, stdout is the wire"; the SDK diverts stdout to stderr during serving but output written before serving "still reaches the wire"; use `logging`. ([run](https://raw.githubusercontent.com/modelcontextprotocol/python-sdk/main/docs/run/index.md)) Resources: `@mcp.resource(uri)`, `mime_type` "defaults to `text/plain`", `bytes` become a base64 `blob`, templates appear in `resources/templates/list`. ([servers/resources](https://raw.githubusercontent.com/modelcontextprotocol/python-sdk/main/docs/servers/resources.md)) Era: the pinnable modern set is exactly `["2026-07-28"]`; the example server "answers `server/discover` on every transport" and "completes a legacy `initialize` handshake, negotiating `2025-11-25`". ([protocol-versions](https://raw.githubusercontent.com/modelcontextprotocol/python-sdk/main/docs/protocol-versions.md)) GitHub latest release `v2.3.0` (2026-10-02).
- Local observation: the `dispense-configurator` plugin's server (`@modelcontextprotocol/sdk ^1.12.0`, legacy era) is loaded by Claude Code 2.1.294 in this very session (its tool appears as `mcp__plugin_dispense-configurator_dispense-configurator__configure_dispense_system`), so Claude Code speaks the legacy handshake today. Whether it also speaks the modern era is not documented in the pages read.

### 2. Declaring MCP servers in Claude Code plugins

Claude Code 2.1.294 observed. The docs moved: `docs.claude.com/en/docs/claude-code/*` now 301-redirects to `code.claude.com/docs/en/*`.

- **Project/user config** (not plugins): `claude mcp add [options] <name> -- <command> [args...]`; "Everything after `--` is passed to the server untouched"; `--env KEY=value`, `--transport stdio`, `--scope`. Project scope is `.mcp.json` at the project root with a `mcpServers` map; "Claude Code reads an entry with no `type` as a stdio server"; Claude Code "prompts for approval in interactive sessions before using project-scoped servers from `.mcp.json`". Scopes: local and user in `~/.claude.json`, project in `.mcp.json`; precedence "Local scope, Project scope, User scope, Plugin-provided servers, claude.ai connectors". Expansion `${VAR}` and `${VAR:-default}` in `command`, `args`, `env`, `url`, `headers`; an unset variable without default is left as literal text. Timeouts: `MCP_TIMEOUT` (startup), `MCP_TOOL_TIMEOUT` or per-server `"timeout"` in ms; output over 25,000 tokens is cut unless `MAX_MCP_OUTPUT_TOKENS` is raised, with a warning at 10,000. ([Claude Code MCP](https://code.claude.com/docs/en/mcp))
- **Plugin declaration**: "Declare it in `.mcp.json` at the plugin root, in the same shape as a project `.mcp.json`":

  ```json
  {
    "mcpServers": {
      "db": {
        "command": "node",
        "args": ["${CLAUDE_PLUGIN_ROOT}/server.js"]
      }
    }
  }
  ```

  "You can also omit the `mcpServers` wrapper and put `db` at the top level of the file." Server name `plugin:<plugin>:<server>`; tool names `mcp__plugin_<plugin>_<server>__<tool>`; "`${CLAUDE_PLUGIN_ROOT}` and the other path variables are substituted in `command`, `args`, and `env`. No quoting is needed in `args`." The `mcpServers` manifest key also takes an inline map, a `.json` path, an `.mcpb`/`.dxt` bundle path or `https://` URL, or an array; `.mcp.json` loads first and "a server name declared later replaces an earlier one". `claude plugin validate` checks each MCP entry (v2.1.281+). ([components](https://code.claude.com/docs/en/plugins/components), [manifest reference](https://code.claude.com/docs/en/plugins/manifest-reference))
- **Variables**: `${CLAUDE_PLUGIN_ROOT}` = "Absolute path of the plugin's installed version" and "changes when the plugin updates, so don't write state there"; `${CLAUDE_PLUGIN_DATA}` = `~/.claude/plugins/data/<id>/`, "created on first reference and kept across plugin updates", deleted on uninstall from the last scope unless `--keep-data`; `${CLAUDE_PROJECT_DIR}`. For stdio servers the variables resolve in `command`, `args`, `env` and `CLAUDE_PLUGIN_ROOT`, `CLAUDE_PLUGIN_DATA` are exported to the process. `${user_config.KEY}` is substituted in MCP server config; a `sensitive` option "stores the value in secure storage instead of `settings.json`". ([manifest reference](https://code.claude.com/docs/en/plugins/manifest-reference))
- **On disk and dependencies**: plugins live in `~/.claude/plugins/cache/<marketplace>/<plugin>/<version>/`; "Plugins load at session start from `installed_plugins.json` and the cache without using the network." When Claude Code copies a plugin into the cache "it also installs the plugin's Node.js package dependencies there" if the root has `package.json` plus `package-lock.json`, `npm-shrinkwrap.json` or `bun.lock`; constraints: registry packages pinned in the lockfile only, `--ignore-scripts`, frozen resolution, 60-second timeout, "You can't turn the automatic install off." Python dependencies, git dependencies and anything needing lifecycle scripts must be installed "from a hook into the persistent data directory". Old version directories are removed 14 days after update. Versions: manifest `version` first, then entry `version`, else the commit SHA; auto-update is off by default for non-Anthropic marketplaces. ([loading](https://code.claude.com/docs/en/plugins/loading))
- **Marketplace**: `.claude-plugin/marketplace.json` with `name`, `owner`, `plugins[]`; sources: relative path, `github` (`repo`, `ref`, `sha`), `url`, `git-subdir`, `npm`, `archive`, `command`. Unknown entry keys are ignored with a validate warning, which matters for carrying Codex's extra entry fields in one file (section 3). ([marketplace reference](https://code.claude.com/docs/en/plugins/marketplace-reference))
- Local observations (shapes only):
  - Both installed local plugins declare the server inline in `.claude-plugin/plugin.json`: `"mcpServers": { "<name>": { "command": "node", "args": ["${CLAUDE_PLUGIN_ROOT}/mcp-server/server.js"] } }` (`~/.claude/plugins/cache/dispense-configurator/dispense-configurator/2.0.0/.claude-plugin/plugin.json`, `~/.claude/plugins/cache/claude-project-sorter/claude-project-sorter/1.0.0/.claude-plugin/plugin.json`).
  - Anthropic's official marketplace clone (`~/.claude/plugins/marketplaces/claude-plugins-official/`) uses bare-map `.mcp.json` files: `firebase` runs `npx -y firebase-tools@latest mcp`; `terraform` runs `docker run -i --rm -e TFE_TOKEN=${TFE_TOKEN} hashicorp/terraform-mcp-server:0.4.0`; `laravel-boost` runs `php artisan boost:mcp`; `github` and `example-plugin` are `"type": "http"` with a `url` (header values not reproduced).
  - `~/.claude.json` holds user-scope servers with `"command": "npx", "args": ["-y", "rea-agents@6.4.0", "mcp"]` plus `env` keys, a `"type": "stdio"` node server with an absolute path, and `"type": "http"` servers with an `Authorization` header (values not reproduced).

### 3. Declaring MCP servers in Codex

`codex` CLI is not installed on this machine; `~/.codex/config.toml` exists (written by the ChatGPT desktop app's Codex). `developers.openai.com/codex/mcp` 308-redirects to `learn.chatgpt.com/docs/extend/mcp`. Latest `openai/codex` release observed: `rust-v0.164.0` (2026-10-23).

- **config.toml**: user-level `~/.codex/config.toml`, project-scoped `.codex/config.toml` "loaded only when you trust the project". Stdio fields: `command` (required), `args`, `env` ("Environment variables forwarded to the MCP stdio server"), `env_vars` ("Additional environment variables to whitelist for an MCP stdio server. String entries default to `source = "local"`"), `cwd`, `experimental_environment`. Common: `startup_timeout_sec` "Override the default 10s startup timeout", `tool_timeout_sec` default 60, `enabled`, `required`, `enabled_tools`, `disabled_tools`, `default_tools_approval_mode` (`auto | prompt | writes | approve`), `tools.<tool>.approval_mode`, `tools.<tool>.output_token_limit`. HTTP: `url`, `bearer_token_env_var`, `http_headers`, `env_http_headers`, `http_headers_helper`, `auth` (`oauth | chatgpt`), `oauth.*`. Subprocess environment is governed by `shell_environment_policy.inherit` (`all | core | none`) and filters; "`ignore_default_excludes`: Keep variables containing KEY, SECRET, or TOKEN before other filters run (default: true)". The exact default set handed to MCP stdio servers is not stated on the pages read. ([config reference](https://learn.chatgpt.com/docs/config-file/config-reference), [Codex MCP](https://learn.chatgpt.com/docs/extend/mcp?surface=cli))
- CLI: `codex mcp add <server-name> --env VAR1=VALUE1 -- <stdio server-command>`, e.g. `codex mcp add context7 -- npx -y @upstash/context7-mcp`; `codex mcp list`; `codex mcp login <server-name>` for OAuth HTTP servers. Example TOML from the page:

  ```toml
  [mcp_servers.context7]
  command = "npx"
  args = ["-y", "@upstash/context7-mcp"]
  env_vars = ["LOCAL_TOKEN"]

  [mcp_servers.context7.env]
  MY_ENV_VAR = "MY_ENV_VALUE"
  ```

  ([Codex MCP](https://learn.chatgpt.com/docs/extend/mcp?surface=cli))
- **Plugins can declare servers**: "Installed plugins can bundle MCP servers in their plugin manifest." User config then only toggles them: `[plugins."sample@test".mcp_servers.sample]` with `enabled`, `default_tools_approval_mode`, `enabled_tools`, `disabled_tools`, `tools.<tool>.approval_mode`; managed `requirements.toml` can allowlist plugin servers by `identity.command` (exact executable and ordered argument matchers). ([Codex MCP](https://learn.chatgpt.com/docs/extend/mcp?surface=cli), [config reference](https://learn.chatgpt.com/docs/config-file/config-reference))
- **Plugin package formats** (OpenAI "Package your plugin"): the portable Agent Plugins layout is a root `plugin.json` (`"$schema": "https://agent-plugins.org/schemas/1.0.0/plugin.schema.json"`, `name`, `version`, `description`, OpenAI-specific settings under `extensions.com.openai`), `skills/`, and a root `mcp.json` with `"$schema": "https://agent-plugins.org/schemas/1.0.0/mcp.schema.json"` and a `mcpServers` map where every server declares a transport `type`. The compatibility layout `.codex-plugin/plugin.json` + `.mcp.json` "remains supported" and is what `@plugin-creator` still scaffolds; "Don't just rename `.mcp.json`: the portable MCP format also declares a transport `type` for each server." "OpenAI also accepts legacy and Claude-compatible manifests, but new packages should use this format." ([Package your plugin](https://developers.openai.com/plugins/build/plugins))
- **Stdio entry shape** (desktop-only page): in root `mcp.json`, `"type": "stdio"`, `"command": "node"`, `"args": ["${PLUGIN_ROOT}/server/dist/index.js"]`, `"cwd": "${PLUGIN_ROOT}"`; "The server can use any language or runtime that supports MCP over stdio"; "Include the server and its dependencies in the package." Plugins with a local MCP server are "Desktop only" and "can only be installed from the ChatGPT desktop app"; public-directory submission of local MCP plugins "is limited to approved partners", which does not restrict repo or personal marketplaces. ([desktop-only](https://developers.openai.com/plugins/deploy/desktop-only)) The `mcp.schema.json` confirms: `type` is one of `stdio`, `streamable-http`, `sse`; stdio allows `command`, `args`, `env` (keys may not be `PLUGIN_ROOT`/`PLUGIN_DATA`), `cwd` (must start with `./`, `${PLUGIN_ROOT}` or `${PLUGIN_DATA}`); no other keys. ([mcp.schema.json](https://agent-plugins.org/schemas/1.0.0/mcp.schema.json))
- **Variables**: hook commands receive `PLUGIN_ROOT` and `PLUGIN_DATA`, and "Codex also sets `CLAUDE_PLUGIN_ROOT` and `CLAUDE_PLUGIN_DATA` for compatibility with existing plugin hooks." Whether `${CLAUDE_PLUGIN_ROOT}` is also substituted inside a compatibility `.mcp.json`'s `args` is not stated (see Gaps). ([Package your plugin](https://developers.openai.com/plugins/build/plugins))
- **Marketplaces**: repo-scoped `$REPO_ROOT/.agents/plugins/marketplace.json`, personal `~/.agents/plugins/marketplace.json`, and "a legacy-compatible marketplace at `$REPO_ROOT/.claude-plugin/marketplace.json`". Entries: `name`, `source` (`local` path, `url`, `git-subdir` with `ref`/`sha`, `npm`), and "Always include `policy.installation`, `policy.authentication`, and `category` on each plugin entry." Installed copies go to `~/.codex/plugins/cache/$MARKETPLACE_NAME/$PLUGIN_NAME/$VERSION/`. CLI: `codex plugin marketplace add owner/repo` (also `owner/repo@ref`, HTTPS/SSH git URLs, local dirs; `--ref`, `--sparse`), `list`, `upgrade`, `remove`. Enable per repo with `[plugins."my-plugin@local-repo"] enabled = true` in `.codex/config.toml`. ([Package your plugin](https://developers.openai.com/plugins/build/plugins))
- Relevance to ADR-0002 (one public repo as both marketplaces): Codex reads `.claude-plugin/marketplace.json`, and Claude Code ignores unknown entry keys such as `policy` and `category` with only a validate warning, so one catalog file can serve both agents. ([marketplace reference](https://code.claude.com/docs/en/plugins/marketplace-reference))
- Local observations: `~/.codex/config.toml` contains `[mcp_servers.node_repl]` and `[mcp_servers.computer-use]` tables written by the app (`command`, `args`, `cwd`, `enabled`, `startup_timeout_sec`, `[mcp_servers.<name>.env]`), plus a `[mcp_servers.dispense_configurator]` table with `command = "node"` and an absolute `args` path, inserted by that plugin's `codex/setup.sh` between `# BEGIN/END` markers (the pre-plugin way of reaching Codex). `~/.codex/plugins/` holds `cache/` and `marketplace.json`.

### 4. Distribution options with trade-offs

Local baseline: node v24.19.0, npm 11.17.0, uv 0.12.8 (`uvx` on PATH), Bun not installed, 21 entries in `~/.npm/_npx`.

Measured on this machine (stdin closed so the server exits on EOF; wall clock, single run, Python `subprocess`):

| Start path | Wall time |
| :- | :- |
| `node -e ''` | 0.24 s |
| `npx --version` (CLI overhead only) | 0.73 s |
| `node <plugin>/mcp-server/server.js` (SDK v1 server, local file) | 0.24 s |
| `npx -y --offline rea-agents@6.4.0 mcp` (already cached) | 2.83 s |

A cold `npx` (package not cached) was not measured because it would download and run a new package; it is strictly slower than the warm figure and needs network.

- **npx (npm package)**: the canonical client config is `"command": "npx", "args": ["-y", "<package>", ...]` (MCP docs for Claude Desktop; Claude Code and Codex examples use the same). "`-y`: Automatically confirms the installation of the server package." ([connect local servers](https://modelcontextprotocol.io/docs/develop/connect-local-servers)) npm: packages missing from the local project "are installed to a folder in the npm cache"; a prompt precedes install unless `--yes`/`--no`, and "When standard input is not a TTY or a CI environment is detected, --yes is assumed"; `prefer-offline`/`offline` control staleness checks; unversioned names match "whatever version exists in the local project", so pin `name@version` for determinism. The `_npx` folder itself is not documented on the npm pages read. ([npm exec](https://docs.npmjs.com/cli/v11/commands/npm-exec), [npx](https://docs.npmjs.com/cli/v11/commands/npx), [npm cache](https://docs.npmjs.com/cli/v11/commands/npm-cache)) Trade-offs: one artefact serves Claude Code, Codex and Claude Desktop; needs network on first run and on every unpinned version change; 2–3 s warm start per session; Codex's 10 s default startup timeout leaves little room for a cold install; the plugin still needs Node on the machine.
- **uvx (Python)**: "`uvx` is provided as an alias for convenience" for `uv tool run`; tools run "into temporary, isolated environments"; after the first run `uvx` "will use the cached version of the tool unless a different version is requested, the cache is pruned, or the cache is refreshed"; `--from pkg` when the command name differs; `pkg@version` pins; `--python` picks an interpreter. Cache: `$XDG_CACHE_HOME/uv` or `~/.cache/uv`. ([uv tools guide](https://docs.astral.sh/uv/guides/tools/), [uv tools concept](https://docs.astral.sh/uv/concepts/tools/), [uv cache](https://docs.astral.sh/uv/concepts/cache/)) Trade-offs: requires `uv` (installed here, not guaranteed elsewhere) and Python 3.11+ for the `mcp` SDK; Claude Code's automatic dependency install covers npm/Bun lockfiles only, so a Python server inside a plugin must bootstrap its own environment from a hook into `${CLAUDE_PLUGIN_DATA}` ([loading](https://code.claude.com/docs/en/plugins/loading)); no offline guarantee is documented for `uvx`.
- **Bundled binary**: Node SEA is "Stability: 1.1 - Active development"; built with `node --build-sea sea-config.json` (v25.5.0+) or the older blob+postject flow; "The version of the Node.js binary used to produce the blob must be the same as the one to which the blob will be injected"; macOS needs `codesign`; bundled script must be self-contained ("module loading does not read from the file system"); CI-tested on Windows, macOS arm64 and most Linux. ([Node SEA](https://nodejs.org/api/single-executable-applications.html)) Bun `bun build --compile` bundles "a copy of the Bun runtime", cross-compiles to `bun-{linux,darwin,windows}-{x64,arm64}` (+musl), embeds assets, and recommends `codesign` on macOS; the docs themselves say "Bun's binary is still way too big". ([Bun executables](https://bun.sh/docs/bundler/executables)) Claude Code can also load a packaged `.mcpb` bundle (`manifest.json` with `server.type` `node`/`python`/`binary`/`uv`, `mcp_config.command/args/env`, `${__dirname}`), but OpenAI's portal "doesn't accept `.mcpb` files". ([components](https://code.claude.com/docs/en/plugins/components), [mcpb MANIFEST](https://raw.githubusercontent.com/anthropics/mcpb/main/MANIFEST.md), [submit Claude plugin](https://developers.openai.com/plugins/guides/submit-claude-plugin)) Trade-offs: no runtime dependency at all, fastest start, but one build and signature per OS/arch, large files in the marketplace repo, and Claude-only for the `.mcpb` route.
- **Server source inside the plugin, run by the user's `node`** (the fourth option, and the one in use locally): `"command": "node", "args": ["${CLAUDE_PLUGIN_ROOT}/server/dist/index.js"]` for Claude Code, `"${PLUGIN_ROOT}/server/dist/index.js"` for Codex. Claude Code installs lockfile dependencies at install time (no scripts, registry only, 60 s); Codex says "Include the server and its dependencies in the package", so a single-file bundle (no `node_modules`) is the form that works for both without an install step. ([components](https://code.claude.com/docs/en/plugins/components), [loading](https://code.claude.com/docs/en/plugins/loading), [desktop-only](https://developers.openai.com/plugins/deploy/desktop-only)) Trade-offs: 0.24 s start, offline from the first session, versions move with the plugin; requires Node on the machine (as npx does) and a build step in the marketplace repo.

### 5. Reaching private GitHub repos with the existing login

Local baseline: gh 2.100.0 (2026-09-03; latest cli/cli release v2.103.3 on 2026-10-26); `gh auth status` reports a keyring-stored token for `github.com` with scopes `gist`, `project`, `read:org`, `repo`, `workflow` (value not reproduced); `git config --global` shows `credential.https://github.com.helper = !/opt/homebrew/bin/gh auth git-credential` (and the same for `gist.github.com`); `printf 'protocol=https\nhost=github.com\n\n' | GIT_TERMINAL_PROMPT=0 git credential fill` returned the attributes `protocol`, `host`, `username`, `password` (values not printed).

#### Option A: shell out to `gh`

- **How**: `gh auth token` "outputs the authentication token for an account on a given GitHub host"; `--hostname`, `--user`; an expired token that supports refreshing is renewed before printing unless `--no-refresh`. ([gh auth token](https://cli.github.com/manual/gh_auth_token)) Then call REST yourself with `Authorization: Bearer`, or let `gh api` do it: "Makes an authenticated HTTP request to the GitHub API and prints the response", with `-H 'Accept: application/vnd.github.v3.raw+json'` in its own examples, `--jq`, `--paginate`, and `{owner}/{repo}` placeholders. ([gh api](https://cli.github.com/manual/gh_api)) `gh repo clone OWNER/REPO [dir] [-- --depth=1]` clones using the configured `git_protocol`. ([gh repo clone](https://cli.github.com/manual/gh_repo_clone))
- **What it needs**: `gh` on `PATH` and a prior `gh auth login`. The token for `--with-token` needs at least `repo`, `read:org`, `gist`; credentials go to "the system credential store", falling back to a plain-text file. ([gh auth login](https://cli.github.com/manual/gh_auth_login)) `repo` "Grants full access to public and private repositories". ([scopes](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/scopes-for-oauth-apps)) `GH_TOKEN`/`GITHUB_TOKEN` in the environment "takes precedence over previously stored credentials", which is how CI can supply a token without a login. ([gh environment](https://cli.github.com/manual/gh_help_environment))
- **Precedent**: Claude Code reaches private marketplaces the same way: "Claude Code runs `git` on their machine with interactive prompts turned off and relies on whatever credentials that machine already holds. Claude Code has no git token of its own"; "On GitHub, `gh auth login` followed by `gh auth setup-git` stores one"; a bare `GITHUB_TOKEN` "alone doesn't authenticate the background check. A token takes effect through a credential helper, such as the `gh` CLI's helper, which reads `GH_TOKEN` and `GITHUB_TOKEN`." ([host a marketplace](https://code.claude.com/docs/en/plugins/host-marketplace)) Brand OS users must already have this working to install the plugin from a private marketplace, so the MCP server inherits a working login for free.
- **Failure modes**: `gh` missing or not logged in (the manual does not say what `gh auth token` prints then; treat non-zero exit or empty output as "not logged in" and surface an `isError` tool result telling the user to run `gh auth login`); a token without `repo` (classic) or without `Contents: read` (fine-grained) cannot read the brand repo; SSO-enforced organisations and 403/404 semantics were not researched (Gaps); every call counts against the user's 5,000/hour budget; a stdio server under Codex may not receive `GH_TOKEN`, but `gh` reads its own store, so only `PATH` and `HOME` matter.

#### Option B: git credential helpers (`gh auth setup-git`, `git credential fill`)

- **How**: `gh auth setup-git` "configures `git` to use GitHub CLI as a credential helper" for all authenticated hosts (`--hostname` for one). ([gh auth setup-git](https://cli.github.com/manual/gh_auth_setup-git)) With a helper in place, `git clone https://github.com/<org>/<brand>.git` just works, and `git credential fill` returns `username`/`password` for a `protocol=`/`host=` description "by reading config files, by contacting any configured credential helpers, or by prompting the user"; `approve`/`reject` store or erase. ([git-credential](https://git-scm.com/docs/git-credential)) Helpers are consulted in order; a `!`-prefixed helper is a shell snippet; `credential.useHttpPath` decides whether the path matters; secure helpers include `osxkeychain`, `libsecret`, `wincred`, Git Credential Manager. ([gitcredentials](https://git-scm.com/docs/gitcredentials))
- **What it needs**: any working helper, not necessarily `gh`. Works for users who authenticate git with GCM or the macOS keychain instead of `gh`.
- **Failure modes**: with no stored credential, git prompts: `GIT_ASKPASS`, then `core.askPass`, then `SSH_ASKPASS`, then the terminal; a stdio server has no terminal, so set `GIT_TERMINAL_PROMPT=0` ("git will not prompt on the terminal (e.g., when asking for HTTP authentication)") and treat the failure as "not logged in". ([gitcredentials](https://git-scm.com/docs/gitcredentials), [git](https://git-scm.com/docs/git)) SSH remotes need a key loaded in `ssh-agent` and the host in `known_hosts` (Claude Code states the same constraints for marketplaces). `git credential fill` hands the server the raw password, so it must never log or persist it.

#### Option C: GitHub App or OAuth App device flow

- **How**: `POST https://github.com/login/device/code` with `client_id` (and `scope`), show the `user_code` and `https://github.com/login/device`, then poll `POST https://github.com/login/oauth/access_token` with `grant_type=urn:ietf:params:oauth:grant-type:device_code` at the returned `interval`; handle `authorization_pending`, `slow_down`, `expired_token`, `access_denied`. "The `client_secret` isn't needed for this flow." Device flow must be enabled in the app's settings. ([device flow](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/authorizing-oauth-apps)) For a GitHub App: "By default, the user access token expires after 8 hours", "The refresh token expires after 6 months", tokens `ghu_`/`ghr_`, and "a user access token can only access resources that both the user and app can access", so the App must be installed on each brand repository. ([user access tokens](https://docs.github.com/en/apps/creating-github-apps/authenticating-with-a-github-app/generating-a-user-access-token-for-a-github-app))
- **What it needs**: an app registration owned by the agency, the `client_id` shipped in the plugin (public), per-brand installation, and a place to store the issued token (a new secret on the machine, ideally the OS keychain). Rate limit: user access tokens share the user's 5,000/hour. ([rate limits](https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api?apiVersion=2022-11-28))
- **Failure modes**: 8-hour expiry means refresh logic and storage; users without a browser-reachable login cannot complete it; it duplicates a login the user already has through `gh`. It is the only option that works with **no** `gh`/`git` login at all.

#### REST endpoints and limits that matter

- `GET /repos/{owner}/{repo}/contents/{path}?ref=<branch|tag|sha>`: media types `application/vnd.github.raw+json` ("Returns the raw file contents"), `.html+json`, `.object+json`; "1 MB or smaller: All features of this endpoint are supported"; "1-100 MB: Only the raw or object custom media types are supported"; ">100 MB: This endpoint is not supported"; directories "upper limit of 1,000 files" (use the Git Trees API beyond that); "Download URLs expire and are meant to be used just once". Fine-grained tokens need "Contents" repository permissions (read); it works with GitHub App user access tokens, installation tokens and fine-grained PATs. ([contents](https://docs.github.com/en/rest/repos/contents?apiVersion=2022-11-28))
- `GET /repos/{owner}/{repo}/tarball/{ref}` and `/zipball/{ref}`: 302 to a download URL; "For private repositories, these links are temporary and expire after five minutes." (same page)
- Rate limits: "5,000 requests per hour" for an authenticated user, shared with "GitHub Apps or OAuth apps acting on your behalf"; 60/hour unauthenticated; secondary limits of 100 concurrent requests and 900 REST points per minute; `x-ratelimit-*` headers are authoritative. ([rate limits](https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api?apiVersion=2022-11-28)) "Making a conditional request does not count against your primary rate limit if a `304` response is returned"; send requests serially rather than in parallel. ([best practices](https://docs.github.com/en/rest/using-the-rest-api/best-practices-for-using-the-rest-api?apiVersion=2022-11-28)) Local observation: `gh api rate_limit` reports `limit: 5000` for this account.

### 6. Caching and offline use

- Claude Code: "Plugins load at session start from `installed_plugins.json` and the cache without using the network." `${CLAUDE_PLUGIN_DATA}` is "for `node_modules`, virtual environments, and caches", "survives updates", and is removed on uninstall by default. ([loading](https://code.claude.com/docs/en/plugins/loading), [components](https://code.claude.com/docs/en/plugins/components)) Codex gives plugins the equivalent `PLUGIN_DATA` ("the plugin's writable data directory"). ([Package your plugin](https://developers.openai.com/plugins/build/plugins))
- Git as the cache: `--depth=<n>` creates "a *shallow* clone with a history truncated" and "Implies `--single-branch`"; `--single-branch` means "Further fetches ... will only update the remote-tracking branch for the branch this option was used for"; `--filter=blob:none` "will filter out all blobs (file contents) until needed"; `--branch` accepts tags. ([git-clone](https://git-scm.com/docs/git-clone)) A per-brand `git clone --depth=1 --single-branch` into the data directory, refreshed by `git fetch` when online and read from the working tree otherwise, gives offline service, integrity, and one network round-trip per refresh instead of one per file; `GIT_TERMINAL_PROMPT=0` keeps a missing login from hanging the server. ([git](https://git-scm.com/docs/git))
- API-based caching instead: store `etag` per file and send `If-None-Match`; a `304` costs no quota ([best practices](https://docs.github.com/en/rest/using-the-rest-api/best-practices-for-using-the-rest-api?apiVersion=2022-11-28)); never cache `download_url` or tarball links, which expire ([contents](https://docs.github.com/en/rest/repos/contents?apiVersion=2022-11-28)).
- Protocol-level: 2026-07-28 requires `ttlMs` and `cacheScope` on `tools/list`, `resources/list`, `resources/read` and `resources/templates/list`, "a freshness hint ... allowing clients to cache responses and reduce polling" ([changelog](https://modelcontextprotocol.io/specification/2026-07-28/changelog)); a dual-era server can set these for modern clients and still answer legacy clients.
- npm/uv caches help only the *server binary*, not Brand Package content; both are keyed by exact version (npm: `name@version`; uv: "keyed by the fully resolved commit hash" for git deps, HTTP cache headers for registry deps). ([npm exec](https://docs.npmjs.com/cli/v11/commands/npm-exec), [uv cache](https://docs.astral.sh/uv/concepts/cache/))

### 7. Recommended shape, as options grounded in the sources

Nothing here contradicts ADR-0001 (one local stdio server, brand as a parameter) or ADR-0002 (one public repo as both marketplaces; Brand Packages outside it).

**Server packaging**

- **Option P1 (preferred by the evidence): TypeScript server built with `@modelcontextprotocol/server` v2, bundled to one file, shipped inside the plugin, started with the user's `node`.** Rationale: 0.24 s start vs 2.83 s warm npx; offline from first session; dual-era by default so legacy clients (what both SDK clients and Claude Code 2.1.294 use) and modern clients both work; Node `>=20` is the only runtime requirement, and the local plugins already rely on it. Declare twice in the same plugin directory: `.mcp.json` with `${CLAUDE_PLUGIN_ROOT}` for Claude Code and root `mcp.json` (`"type": "stdio"`, `${PLUGIN_ROOT}`, `cwd`) for Codex, next to `.claude-plugin/plugin.json` and a root `plugin.json`. Keep `@modelcontextprotocol/sdk` v1 as a fallback only if a client proves unable to talk to a v2 server (Gaps).
- **Option P2: also publish the same bundle to npm and run it via `npx -y @<scope>/brand-os-mcp@<pinned>`** for Claude Desktop and for users who want to add the server by hand (`claude mcp add` / `codex mcp add`). Costs: npx overhead and network on first run; the Codex 10 s startup timeout should be raised in the documented TOML.
- **Option P3: Python + `uvx`** only if the team prefers Python; it adds a `uv` prerequisite and loses Claude Code's automatic dependency install.
- **Option P4: single binaries (Node SEA / Bun)** deferred: per-platform builds and signing for a server whose runtime (Node) is already required by both agents.

**Reading private Brand Package repos**

- **Option G1 (preferred): use the user's `gh` login.** Resolve the token with `gh auth token` (or run `gh api`/`gh repo clone` directly), never store it, and tell the user to run `gh auth login` (+ `gh auth setup-git`) when it fails. This is the same prerequisite Claude Code imposes for installing from a private marketplace, so it adds no new secret and no new login.
- **Option G2: fall back to the git credential helper** (`git clone` over HTTPS or `git credential fill` with `GIT_TERMINAL_PROMPT=0`) for users whose git auth is GCM/keychain rather than `gh`.
- **Option G3: GitHub App device flow** as a last resort for machines with neither; it introduces an app registration, per-brand installation and a stored token with refresh handling.

**Fetching and caching**

- **Option C1 (preferred): clone each Brand Package shallowly into `${CLAUDE_PLUGIN_DATA}/packages/<brand>` (Codex: `${PLUGIN_DATA}`), refresh with `git fetch` on demand (a `refresh_brand` tool or on `list_brands`), serve files from the working tree.** One authenticated round-trip per refresh, offline reads, and no per-file quota use.
- **Option C2: contents API with ETag cache** when cloning is undesirable (very large asset repos): use the raw media type, respect the 100 MB and 1,000-entry limits, send `If-None-Match`.

**Surface**

- Keep the four tools from ADR-0001 (list brands, get tokens, get reference, get asset) as the primary, model-controlled surface in both agents; add `resources` with a `brand://{brand}/{path}` template and `resource_link`s in tool results so Claude Code users can `@brand-os:brand://acme/tokens.json`. Mark tools `readOnlyHint: true`, `openWorldHint: false`, `destructiveHint: false`, which Codex uses for approval behaviour.

## Gaps and open questions

- **Client eras**: whether Claude Code 2.1.294 and Codex can talk to a *modern-only* (2026-07-28) server is undocumented; only the legacy handshake is proven locally. Mitigation: keep the SDK's dual-era default. A prototype ticket could pin a v2 server and watch `/mcp`.
- **Codex `${CLAUDE_PLUGIN_ROOT}` in `.mcp.json`**: OpenAI documents `CLAUDE_PLUGIN_ROOT`/`CLAUDE_PLUGIN_DATA` as *environment variables for hooks* and `${PLUGIN_ROOT}` inside portable `mcp.json`; substitution of `${CLAUDE_PLUGIN_ROOT}` inside a compatibility `.mcp.json` is not stated. Shipping both files avoids the question.
- **Codex and MCP resources**: none of the Codex pages read mention resources; unverified whether Codex lists or reads them.
- **Codex default environment for stdio servers**: `env_vars` is documented as "Additional environment variables to whitelist", implying a restricted default, but the default set (does it include `PATH`, `HOME`?) was not found. If `HOME` is missing, `gh` cannot find its config; a prototype should test `gh auth token` from inside a Codex-launched server.
- **Codex CLI vs desktop**: the Codex CLI is not installed here; `.codex/config.toml` and `codex plugin marketplace` behaviour were read from docs only. Local-MCP plugins are documented as installable from the ChatGPT desktop app; whether the CLI loads a repo-marketplace plugin's stdio server unaided is not confirmed.
- **Plugin `.mcp.json` shape in Claude Code**: both the wrapped and bare-map forms are documented and the official marketplace uses the bare form; the wrapped form is what the docs show first. Either is fine; pick one and validate with `claude plugin validate`.
- **`gh auth token` when not logged in**: the manual does not say what it prints or exits with; needs an empirical check.
- **GitHub SSO-enforced organisations and 403 vs 404 for inaccessible private repos**: not researched; a client brand on GitHub Enterprise Cloud with SAML may need the token "authorized for SSO".
- **Cold `npx` cost**: not measured (would have downloaded a package); only warm (2.83 s) and in-plugin (0.24 s) figures exist, single runs on one machine.
- **Windows**: not examined (Claude Code's Windows `npx` caveats, Node SEA signing, path substitution with backslashes).
- **Python SDK release line**: the GitHub release tag `v2.3.0` was observed; which PyPI `mcp` version it corresponds to was not checked.

## Sources

MCP specification and SDKs (observed 2026-10-27):

- https://modelcontextprotocol.io/specification/versioning
- https://modelcontextprotocol.io/specification/2026-07-28/changelog
- https://modelcontextprotocol.io/specification/2026-07-28/basic/versioning
- https://modelcontextprotocol.io/specification/2026-07-28/basic/transports/stdio
- https://modelcontextprotocol.io/specification/2026-07-28/server/discover
- https://modelcontextprotocol.io/specification/2026-07-28/server/tools
- https://modelcontextprotocol.io/specification/2026-07-28/server/resources
- https://modelcontextprotocol.io/specification/2025-06-18/basic/transports
- https://modelcontextprotocol.io/specification/2025-06-18/basic/lifecycle
- https://modelcontextprotocol.io/specification/2025-06-18/server/tools
- https://modelcontextprotocol.io/specification/2025-06-18/server/resources
- https://modelcontextprotocol.io/docs/develop/connect-local-servers
- https://raw.githubusercontent.com/modelcontextprotocol/typescript-sdk/main/README.md
- https://raw.githubusercontent.com/modelcontextprotocol/typescript-sdk/main/docs/protocol-versions.md
- https://raw.githubusercontent.com/modelcontextprotocol/typescript-sdk/main/docs/serving/stdio.md
- https://raw.githubusercontent.com/modelcontextprotocol/typescript-sdk/main/docs/servers/resources.md
- https://raw.githubusercontent.com/modelcontextprotocol/typescript-sdk/v1.x/README.md
- https://raw.githubusercontent.com/modelcontextprotocol/typescript-sdk/v1.x/docs/server.md
- https://raw.githubusercontent.com/modelcontextprotocol/python-sdk/main/README.md
- https://raw.githubusercontent.com/modelcontextprotocol/python-sdk/main/docs/protocol-versions.md
- https://raw.githubusercontent.com/modelcontextprotocol/python-sdk/main/docs/run/index.md
- https://raw.githubusercontent.com/modelcontextprotocol/python-sdk/main/docs/servers/resources.md
- https://raw.githubusercontent.com/anthropics/mcpb/main/README.md
- https://raw.githubusercontent.com/anthropics/mcpb/main/MANIFEST.md
- npm registry via `npm view`: `@modelcontextprotocol/server` 2.4.0, `@modelcontextprotocol/sdk` 1.32.2; GitHub releases via `gh api`: typescript-sdk v2.4.0 (2026-10-23), python-sdk v2.3.0 (2026-10-02)

Claude Code (observed 2026-10-27; `docs.claude.com/en/docs/claude-code/*` redirects here):

- https://code.claude.com/docs/en/mcp
- https://code.claude.com/docs/en/plugins/components
- https://code.claude.com/docs/en/plugins/manifest-reference (reached from https://code.claude.com/docs/en/plugins-reference)
- https://code.claude.com/docs/en/plugins/loading
- https://code.claude.com/docs/en/plugins/host-marketplace
- https://code.claude.com/docs/en/plugins/marketplace-reference
- https://code.claude.com/docs/en/plugin-marketplaces

Codex / OpenAI (observed 2026-10-27; `developers.openai.com/codex/*` redirects to `learn.chatgpt.com`):

- https://learn.chatgpt.com/docs/extend/mcp?surface=cli (from https://developers.openai.com/codex/mcp)
- https://learn.chatgpt.com/docs/config-file/config-reference (from https://developers.openai.com/codex/config-reference)
- https://learn.chatgpt.com/docs/plugins (from https://developers.openai.com/codex/plugins)
- https://developers.openai.com/plugins/build/plugins (also served for https://developers.openai.com/codex/plugins/build/)
- https://developers.openai.com/plugins/build/mcp-server
- https://developers.openai.com/plugins/deploy/desktop-only
- https://developers.openai.com/plugins/guides/submit-claude-plugin
- https://agent-plugins.org/schemas/1.0.0/mcp.schema.json
- https://raw.githubusercontent.com/openai/codex/main/docs/config.md (now an index page pointing at the hosted docs); `docs/plugins.md` does not exist (404); GitHub release rust-v0.164.0 (2026-10-23)

GitHub CLI, git and GitHub REST (observed 2026-10-27):

- https://cli.github.com/manual/gh_auth
- https://cli.github.com/manual/gh_auth_login
- https://cli.github.com/manual/gh_auth_token
- https://cli.github.com/manual/gh_auth_setup-git
- https://cli.github.com/manual/gh_api
- https://cli.github.com/manual/gh_repo_clone
- https://cli.github.com/manual/gh_help_environment
- https://git-scm.com/docs/git-credential
- https://git-scm.com/docs/gitcredentials
- https://git-scm.com/docs/git-clone
- https://git-scm.com/docs/git (GIT_TERMINAL_PROMPT, GIT_ASKPASS)
- https://docs.github.com/en/rest/repos/contents?apiVersion=2022-11-28
- https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api?apiVersion=2022-11-28
- https://docs.github.com/en/rest/using-the-rest-api/best-practices-for-using-the-rest-api?apiVersion=2022-11-28
- https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/authorizing-oauth-apps
- https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/scopes-for-oauth-apps
- https://docs.github.com/en/apps/creating-github-apps/authenticating-with-a-github-app/generating-a-user-access-token-for-a-github-app
- GitHub release cli/cli v2.103.3 (2026-10-26) via `gh api`

Packaging runtimes (observed 2026-10-27):

- https://docs.npmjs.com/cli/v11/commands/npx
- https://docs.npmjs.com/cli/v11/commands/npm-exec
- https://docs.npmjs.com/cli/v11/commands/npm-cache
- https://docs.astral.sh/uv/guides/tools/
- https://docs.astral.sh/uv/concepts/tools/
- https://docs.astral.sh/uv/concepts/cache/
- https://nodejs.org/api/single-executable-applications.html
- https://bun.sh/docs/bundler/executables

Local primary examples on this machine (read only, shapes reported, no secret values):

- `~/.claude/plugins/cache/dispense-configurator/dispense-configurator/2.0.0/.claude-plugin/plugin.json`, `.../mcp-server/package.json`, `.../codex/setup.sh`, `.../codex/README.md`
- `~/.claude/plugins/cache/claude-project-sorter/claude-project-sorter/1.0.0/.claude-plugin/plugin.json`
- `~/.claude/plugins/marketplaces/claude-plugins-official/plugins/example-plugin/.mcp.json` and `external_plugins/{github,firebase,terraform,laravel-boost}/.mcp.json`
- `~/.claude.json` (`mcpServers` entries), `~/.claude/settings.json` (`enabledPlugins`)
- `~/.codex/config.toml` (`[mcp_servers.*]` tables), `~/.codex/plugins/`
- `git config --global --get-regexp '^credential'`; `git credential fill` attribute names; `gh auth status`; `gh api rate_limit`
- Tool versions: Claude Code 2.1.294, gh 2.100.0, node v24.19.0, npm 11.17.0, uv 0.12.8, Bun and `codex` not installed

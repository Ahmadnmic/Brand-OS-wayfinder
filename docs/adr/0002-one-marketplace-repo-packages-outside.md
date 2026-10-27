# One public marketplace repo; Brand Packages live outside it

Brand OS is distributed from a single public GitHub repo that is at once the
Claude Code marketplace and the Codex marketplace, so installing is two commands
per agent and the plugin updates itself. Brand Packages (a client's coded CVI)
never live in that repo: they are private, per brand, and reached by the MCP
server at run time. Mixing them in would make the public repo carry client data
and tie package updates to plugin releases.

Settled while charting the wayfinder map: see
[One public repo doubles as both marketplaces](https://github.com/Ahmadnmic/Brand-OS-wayfinder/issues/3).

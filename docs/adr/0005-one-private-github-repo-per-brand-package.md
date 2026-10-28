# Each Brand Package is a private GitHub repo; repo access is the only gate

Brand Packages could have lived in one monorepo holding every brand, behind a
hosted Brand OS service with its own accounts, or as one private repo per brand
on github.com. We chose one private repo per Brand Package, in any org, with
github.com only in v1. Who may read a brand is exactly who GitHub lets read its
repo: Brand OS adds no allow-list, roles or licence check, and granting or
revoking a brand means changing that repo's access. The MCP server reaches the
repos with the user's existing `gh` login and git credential helper, stores no
token, and only reads: it clones and fetches, never commits or pushes. When
GitHub explicitly denies access, the server stops serving that package and
drops its cache, so revocation takes effect locally too.

Considered and rejected: a monorepo (anyone who reads one brand reads all, and
every brand shares one version line); a hosted service (conflicts with ADR 0001
and adds an account system); a Brand OS access layer on top of GitHub (anyone
who can clone the repo bypasses it, so it would only duplicate GitHub);
a GitHub App with device flow (an app registration, an install on every brand
repo, and a stored token with refresh logic, for no gain over the existing
login). The cost we accept: GitHub Enterprise Server, GitLab and other hosts are
unsupported in v1, and every user needs a working `gh` login.

Settled in
[Where Brand Packages live and how the MCP server reaches them](https://github.com/Ahmadnmic/Brand-OS-wayfinder/issues/15).

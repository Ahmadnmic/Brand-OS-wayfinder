# DTCG 2025.10 token files are the source of truth; Terrazzo builds the outputs

A Brand Package could have carried hand-written CSS variables or a Tailwind
config as its truth, or a Brand OS-own JSON. We chose DTCG 2025.10 token files
plus exactly one resolver file as the only source of truth, with the Generated
Outputs (CSS variables, a Tailwind v4 theme, a font-face stylesheet) built by
Terrazzo, committed into the package and never hand-edited. The build
configuration ships with Brand OS, not with each package, so every package builds
the same way, which in turn fixes standard token group names; and the MCP server
never builds, so it stays a plain file reader that serves packages offline.

Considered and rejected: hand-written outputs (every brand would encode its CVI
differently and no tool could read it back, including from Figma or Penpot); a
Brand OS-own token format (no tooling, no design-tool path); Style Dictionary as
the build (no resolver support and no Tailwind output as of 5.7); building inside
the MCP server (a toolchain inside the single-file server, slower start, and a
package that fails to build cannot be served).

Settled in
[Token format for a Brand Package](https://github.com/Ahmadnmic/Brand-OS-wayfinder/issues/14).

# Brand OS

Brand OS gives coding agents (Claude Code and Codex) a brand's visual identity in a
form they can install once and apply on any project. This glossary holds the
language of that system, not its implementation.

## Language

**Brand OS**:
The installable toolkit (plugin, mod, skills, references, MCP server) that lets an
agent work on-brand.
_Avoid_: brand plugin, brand toolkit, BrandOS

**CVI**:
Corporate Visual Identity: a brand's visual rules (colour, type, logo, spacing,
imagery, components). The content a Brand Package encodes.
_Avoid_: brand guide, style guide, brand book

**Brand Package**:
One brand's CVI in coded form: machine-readable tokens, Reference pages and asset
files, kept together and served to agents.
_Avoid_: coded brand guide, brand repo, CVI package

**Reference**:
A rich HTML page an agent reads for the detail a Skill deliberately leaves out.
_Avoid_: docs, guide, manual

**Skill**:
A lean instruction set that tells an agent when and how to use Brand OS; it points
at References and the MCP server rather than restating them.
_Avoid_: prompt, command, playbook

**Mod**:
Brand OS's change to the Claude desktop app itself: a brand pane and a status-line
indicator. Claude only.
_Avoid_: extension, widget, UI plugin

**Active Brand**:
The Brand Package a project has selected; the one every Skill and MCP call applies
unless told otherwise.
_Avoid_: current brand, default brand, client

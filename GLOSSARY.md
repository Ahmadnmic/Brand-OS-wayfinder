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

**Package Manifest**:
The one document in a Brand Package that states the brand's identity and names
everything in the package a Skill or the MCP server can address.
_Avoid_: package config, index, brand.json, manifest file

**Asset**:
A file the brand supplies rather than describes: a logo variant, icon,
illustration, image or font, declared in the Package Manifest with the rules for
its use.
_Avoid_: file, resource, media, attachment

**Token**:
One named CVI value (a colour, a dimension, a type style, a shadow) in DTCG
form; the machine-readable layer of a Brand Package.
_Avoid_: variable, CSS variable, style value

**Mode**:
A context a Brand Package's tokens resolve under, such as light or dark. Every
package has at least one.
_Avoid_: theme, colour scheme, variant

**Generated Output**:
A file built from a Brand Package's tokens and Package Manifest (CSS variables,
a Tailwind theme, a font-face stylesheet), kept in the package, copied into
each project that uses the brand, and never hand-edited in either place.
_Avoid_: dist, build artifact, compiled tokens

**Guest Brand**:
A second Brand Package a project names beside its Active Brand, for co-branded
work; only its Assets and References are used, never its Tokens.
_Avoid_: secondary brand, partner brand, co-brand

**Package Validation**:
The check of a Brand Package against the Brand OS schema. Errors make the
package invalid; warnings mark it valid but incomplete.
_Avoid_: lint, Brand Check, audit

**Brand Check**:
The deterministic check of a project's code against its Active Brand: literal
values that should be Tokens, stale Generated Outputs, altered Assets.
_Avoid_: lint, audit, Package Validation, brand review

**Sub-brand**:
A variant of a Brand Package's CVI, such as a product line or campaign brand,
selected inside the parent package rather than kept as a package of its own.
_Avoid_: child brand, brand variant, sub-package

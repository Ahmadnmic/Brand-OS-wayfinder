# Research: Design Tokens format and tooling for a Brand Package

Ticket: [#10 Research: Design Tokens format and tooling for a Brand Package](https://github.com/Ahmadnmic/Brand-OS-wayfinder/issues/10).
Every URL below was observed on 2026-10-27 unless a different date is stated.
Version numbers come from the npm registry (`npm view`) and GitHub (`gh`) on that day.

## Question

What is the current status of the W3C Design Tokens Community Group (DTCG) format
(stable version, recent changes), which token and composite types it defines, how
`$value`/`$type`/`$description`/`$extensions` and aliasing work, how groups and
themes/modes are expressed, which tools turn it into CSS variables and Tailwind
config and how mature they are, and which parts of a CVI the format does not cover,
so Brand OS knows what a Brand Package must keep beside its tokens.

## Summary

- The DTCG format has a stable edition: **2025.10**, published 2025-10-28 as a
  "Final Community Group Report" in three modules (Format, Color, Resolver). The
  group calls it "the first stable version" and "production-ready"
  ([TR index](https://www.designtokens.org/TR/2025.10/),
  [announcement](https://www.w3.org/community/design-tokens/2025/10/28/design-tokens-specification-reaches-first-stable-version/)).
  No later edition exists; the only newer text is a preview draft (dated
  2026-09-08) carrying editorial fixes, and the repo's commit log since the release
  shows no new types or normative features.
- A token is any object with `$value`; `$type` (13 values), `$description`,
  `$extensions`, `$deprecated` are the other token properties. Groups nest tokens
  and may carry `$type`, `$description`, `$extensions`, `$deprecated`, `$extends`
  and a `$root` token
  ([Format 2025.10](https://www.designtokens.org/TR/2025.10/format/),
  [schema](https://www.designtokens.org/schemas/2025.10/format.json)).
- Types: `color` (object with `colorSpace`, `components`, `alpha`, optional
  6-digit `hex` fallback), `dimension` and `duration` (objects `{value, unit}`,
  units only `px`/`rem` and `ms`/`s`), `fontFamily`, `fontWeight`, `cubicBezier`,
  `number`; composites `strokeStyle`, `border`, `transition`, `shadow`,
  `gradient`, `typography`. Every token MUST have one of these types; tools MUST
  NOT guess a type from the value.
- Aliases: `"{group.token}"` targets whole tokens and resolves to their `$value`;
  JSON Pointer `{"$ref": "#/..."}` reaches sub-values. Circular references are
  errors. The format module has no theme or mode concept; the separate
  **Resolver module** (`*.resolver.json`, `sets` + `modifiers` + `resolutionOrder`)
  carries light/dark, density and brand contexts.
- File conventions: `.tokens` or `.tokens.json`, media type
  `application/design-tokens+json`. `$schema` is "not part of the official DTCG
  specification" but published schemas exist at
  `https://www.designtokens.org/schemas/2025.10/format.json` and `.../resolver.json`
  (both HTTP 200 on 2026-10-27).
- **Terrazzo** (`@terrazzo/cli` 2.10.0, 2026-10-21) is the only tool with
  "Full support for the DTCG v2025.10 spec, including resolvers" (2.0.0,
  2026-03-17). Its CSS plugin emits CSS variables with resolver permutations
  mapped to selectors; its Tailwind plugin emits a Tailwind v4 `@theme` file.
- **Style Dictionary** (5.7.1, 2026-10-24, Node >= 22) has had "first-class"
  DTCG support since v4 (2024-06-28); 2025.10 colour objects (5.3.0), dimension
  objects (5.4.0) and durations (5.7.0) are in, gradient and the resolver are
  still open in tracking issue #1590. It ships `css/variables` but no Tailwind
  format (issue #843 open since 2022; community package only).
- **Tokens Studio** (Figma plugin 2.13.2, 2026-10-23) can write `$value/$type`
  files but its own issue #3236 lists unresolved gaps against 2025.10 (string
  dimensions, legacy type names, `boxShadow`). Its themes live in Tokens
  Studio-specific `$themes.json`/`$metadata.json`, not in the resolver format.
  **Penpot** claims native adherence to the Format Module; **Figma** documents
  DTCG import per variable mode, not DTCG export.
- The format cannot express: files/assets (no `file` type; issue #132 open),
  logo variants, clear space and minimum-size rules, imagery style, layout grids
  (issue #222 open), relative units (`%`, `vw`, `em`), strings/booleans,
  component specs, do/don't examples or any usage rule. A Brand Package needs an
  asset manifest, font files, Reference pages and generated CSS/Tailwind outputs
  beside the token files.
- Recommended shape for Brand OS: author tokens in DTCG 2025.10 (`.tokens.json`
  + one `.resolver.json` for modes), build CSS variables and a Tailwind v4
  `@theme` file with Terrazzo at package-build time, and keep every non-token
  rule in Reference pages and a machine-readable asset manifest.

## Findings

### Spec status and versions

- **Editions.** The community-group README lists five editions: `2025.10`
  (2025-10-28, status "Stable"), `third-editors-draft` (2025-07-21, Draft),
  `second-editors-draft` (2022-06-14, Draft), `first-editors-draft` (2021-09-23,
  Draft) and `preview` (no date, "Experimental"). It adds that "tools can use the
  date as a version number to signify compliance. For example: `2025.10`"
  ([README](https://github.com/design-tokens/community-group)).
- **2025.10.** "Design Tokens Technical Reports 2025.10" is a "Final Community
  Group Report" dated 28 October 2025 with three modules, Format, Color and
  Resolver; the page says "This specification is considered stable" and also
  that it "was published by the DTCG as a Candidate Recommendation"
  ([TR index](https://www.designtokens.org/TR/2025.10/)). Each module's status
  text adds "It is not a W3C Standard nor is it on the W3C Standards Track"
  ([Format 2025.10](https://www.designtokens.org/TR/2025.10/format/)). Editors of
  the Format Module: Louis Chenais, Kathleen McMahon, Drew Powers, Matthew
  Ström-Awn, Donna Vitan (same page).
- **Announcement.** The W3C community-group post "Design Tokens specification
  reaches first stable version" (2025-10-28, Kaelig Deloumeau-Prigent, co-chair)
  calls 2025.10 "the first stable version of the Design Tokens Specification" and
  "production-ready", names Style Dictionary, Tokens Studio and Terrazzo as
  reference implementations and Penpot, Figma, Sketch, Framer, Knapsack,
  Supernova and zeroheight as supporting or implementing it. It gives no
  roadmap, cadence or backwards-compatibility promise
  ([post](https://www.w3.org/community/design-tokens/2025/10/28/design-tokens-specification-reaches-first-stable-version/)).
- **The URL in the ticket.** `https://tr.designtokens.org/format/` answers
  301 to `https://www.designtokens.org/TR/drafts/format/`, which is the preview
  draft, not the stable edition (observed 2026-10-27).
- **Preview draft.** `/TR/drafts/format/` is a "Draft Community Group Report"
  dated 08 September 2026 that says "This is a preview draft of in progress
  changes. Do not refer to this document directly, and do not implement anything
  in this document", and links "Latest published version:
  https://www.designtokens.org/TR/2025.10/format/"
  ([draft](https://www.designtokens.org/TR/drafts/format/)). Its table of
  contents is identical to 2025.10 (sections 1 to 9, appendices A and B).
- **What changed since 2025.10.** Commits touching `technical-reports/format`
  after the release are editorial: status statement fix (#350, 2025-11-15),
  Style Dictionary links (#353), JSON Pointer example fix (#369, 2025-12-30),
  resolver JSON Schema and schema links in examples (#356, #378, 2026-01-13),
  "use real token types in examples, remove light/dark examples" (#364,
  2026-01-13), broken-link fixes (#374, #394), a `$type` inheritance fix in
  Example 25 (#400, 2026-03-30), Penpot added to tool lists (#406, 2026-05-07)
  and "fix: conflicting MAY/MUST language for JSON Pointer support" (#442,
  2026-09-08). The resolver folder saw only version-field fixes (#352, #357,
  #408) and the schema addition (#356)
  (`gh api repos/design-tokens/community-group/commits?path=technical-reports/format&since=2025-10-28`,
  observed 2026-10-27). The repo has no milestones, no open issue with
  "release" in the title, 88 open issues, and its only tags are
  `first-public-draft`, `editors-drafts/1`, `editors-drafts/2` (`gh`, observed
  2026-10-27).
- **Known inconsistency in the published text.** In 2025.10 §6.6 says tools
  "MAY also support JSON Pointer notation" while §6.6.2 and §7.1.2 say they
  "MUST" ([Format 2025.10](https://www.designtokens.org/TR/2025.10/format/));
  commit #442 above resolves this in the draft only.

### Token types and composite types

Quotes are from the Format Module 2025.10 unless marked "schema", which means
the published JSON Schema at
[`schemas/2025.10/format.json`](https://www.designtokens.org/schemas/2025.10/format.json)
(JSON Schema draft-07, `$id` as given; definitions `format/values/*.json`).

- **Rule.** "This spec defines a number of design-focused types and every design
  token MUST use one of these types." "If no explicit type has been set for a
  token, tools MUST consider the token invalid." "Tools MUST NOT attempt to guess
  the type of a token by inspecting the contents of its value"
  ([Format §8, §5.2.2](https://www.designtokens.org/TR/2025.10/format/)).
- **Type list (schema `tokenType` enum):** `color`, `dimension`, `fontFamily`,
  `fontWeight`, `duration`, `cubicBezier`, `number`, `strokeStyle`, `border`,
  `transition`, `shadow`, `gradient`, `typography` (13 values).

| `$type` | `$value` shape (2025.10) | Source |
| --- | --- | --- |
| `color` | object `{colorSpace, components, alpha?, hex?}`; `colorSpace` one of `srgb`, `srgb-linear`, `hsl`, `hwb`, `lab`, `lch`, `oklab`, `oklch`, `display-p3`, `a98-rgb`, `prophoto-rgb`, `rec2020`, `xyz-d65`, `xyz-d50`; `components` array of numbers or `"none"`; `alpha` 0 to 1, default 1; `hex` optional fallback that "MUST be formatted in 6 digit CSS hex color notation". Required: `colorSpace`, `components` (schema). | [Color 2025.10](https://www.designtokens.org/TR/2025.10/color/) |
| `dimension` | object `{value: number, unit: "px" \| "rem"}`; both required, "`unit` is required even when `value` is 0". | Format §8.2 |
| `fontFamily` | string or array of strings "ordered by preference". | Format §8.3 |
| `fontWeight` | number 1 to 1000 or one of 18 case-sensitive aliases: thin, hairline, extra-light, ultra-light, light, normal, regular, book, medium, semi-bold, demi-bold, bold, extra-bold, ultra-bold, black, heavy, extra-black, ultra-black. | Format §8.4; schema |
| `duration` | object `{value: number, unit: "ms" \| "s"}`. | Format §8.5 |
| `cubicBezier` | array `[P1x, P1y, P2x, P2y]`, x values in [0, 1]. | Format §8.6 |
| `number` | JSON number. | Format §8.7 |
| `strokeStyle` | keyword `solid`, `dashed`, `dotted`, `double`, `groove`, `ridge`, `outset`, `inset`, or object `{dashArray: [dimension...], lineCap: "round" \| "butt" \| "square"}` (both required, schema). | Format §9.3 |
| `border` | object `{color, width, style}`, all required (schema). | Format §9.4 |
| `transition` | object `{duration, delay, timingFunction}`, all required (schema). | Format §9.5 |
| `shadow` | one shadow object or an array of shadow objects/references; object `{color, offsetX, offsetY, blur, spread, inset?}`; required: color, offsetX, offsetY, blur, spread; `inset` boolean, default false (schema). | Format §9.6; schema |
| `gradient` | array of stops `{color, position}` with `position` in [0, 1] ("Values outside that range are clamped"). | Format §9.7 |
| `typography` | object `{fontFamily, fontSize, fontWeight, letterSpacing, lineHeight}`, all five required, no extra properties (schema `additionalProperties: false`); `lineHeight` is a number that "SHOULD be interpreted as a multiplier of the fontSize". | Format §9.8; schema |

- **Sub-values** of composites "must be a valid <type> value or a reference to a
  <type> token"; references inside arrays "resolve to single values" and do not
  flatten (Format §9.1). "Groups are arbitrary containers, and tools must not
  infer meaning or typing from them"; a composite token with extra or wrongly
  typed sub-values is invalid (Format §9.2).
- **Not in the type system.** §8.8 "Additional types" (non-normative) lists what
  is "still to be documented": "Font style", "Percentage/ratio: e.g. for opacity
  values, relative dimensions, aspect ratios" and "File: for assets - might just
  be a relative file path / URL" ([Format §8.8](https://www.designtokens.org/TR/2025.10/format/)).
  Appendix A lists the open feedback issues for every composite type (#53, #98,
  #99, #100, #101, #102, #103).

### Aliasing, groups, themes/modes

- **Token properties.** "An object with a `$value` property is a token."
  `$type` is "optional" on the token; if absent, "the token's type is inherited
  from the closest parent group with a `$type` property", or, for an alias, "its
  type is the resolved type of the token being referenced". `$description` is "a
  plain text description". `$extensions` "is an object where tools MAY add
  proprietary, user-, team- or vendor-specific data". `$deprecated` "MAY be used
  to mark a token as deprecated, and optionally explain the reason" (boolean or
  string) ([Format §5](https://www.designtokens.org/TR/2025.10/format/)). The
  schema adds that a token may use `$ref` instead of `$value` and "Tokens cannot
  define both $value and $ref" (schema `token.json`).
- **Names.** Token and group names "must not begin with `$`" and "`{`, `}`, and
  `.` must not appear anywhere in a token or group name" (Format §5.1.1).
- **Groups.** Any object that is not a token is a group. Group properties:
  `$type` (default for descendants), `$description`, `$extensions`,
  `$deprecated` ("extends to all child tokens unless a child explicitly
  overrides it"), `$extends` and `$root` ("Groups support root tokens using the
  reserved name `$root` as the token name") (Format §6; schema `group.json`).
- **`$extends`.** A group "MAY include an optional `$extends` property to inherit
  tokens and properties from another group", e.g. `"$extends": "{button}"`; it
  "MUST NOT reference a token"; "Same path = override" (the whole token is
  replaced, not merged), "Different paths = merge"; circular chains are errors
  (Format §6.4).
- **Curly-brace aliases.** "Token paths are constructed by concatenating group
  names and token names with periods (`.`)"; the syntax "can ONLY target complete
  tokens (objects with `$value` properties)" and "always resolves to the `$value`
  property of the target token". Chained references are allowed; "References
  MUST NOT be circular" and tools "MUST detect and report this as an error"
  (Format §7.1.1, §7.2). Schema pattern:
  `^\{[^${}.][^{}.]*(\.[^${}.][^{}.]*)*\}$`.
- **JSON Pointer references.** Property-level references "require JSON Pointer
  syntax (`$ref`)" and "cannot be expressed using curly brace syntax"; examples
  cover colour components, dimension values and typography sub-values (Format
  §7.1.2, §7.3). Schema: `{"$ref": "#/path/to/target"}` (RFC 6901). Note the
  MAY/MUST inconsistency recorded above.
- **Themes and modes are not in the Format Module.** The format has no
  theme, mode or set construct; the editors even removed light/dark examples from
  it in January 2026 (#364 above). Contexts are the job of the **Resolver
  Module 2025.10**, a "Final Community Group Report" (2025-10-28) that is
  "considered stable". It "describes a mechanism for deduplicating all repeat
  values of tokens across all contexts" because alternate contexts "are
  susceptible to combinatorial explosion". A resolver document uses the
  `.resolver.json` extension, `Content-Type: application/json`, and these root
  properties: `name`, `version` (required, "must be `2025.10`"), `description`,
  `sets` (each with a `sources` array merged in order, last wins), `modifiers`
  (each a `contexts` map from context name to a sources array, optional
  `default`), `resolutionOrder` (required; "later items override earlier ones"),
  `$schema`, `$defs` (tools "MUST NOT throw an error on encountering it") and
  `$extensions`. Inputs are a map from modifier name to a context string
  ([Resolver 2025.10](https://www.designtokens.org/TR/2025.10/resolver/);
  [resolver schema](https://www.designtokens.org/schemas/2025.10/resolver.json)
  lists required `version`, `resolutionOrder`).
- **Pre-resolver conventions still in the wild.** Tokens Studio stores themes in
  a plugin-generated "themes configuration file" (`$themes.json`) and token-set
  order in a `$metadata` file, with sets in `Enabled`, `Disabled` or `Source
  (Reference Only)` state ([Themes](https://docs.tokens.studio/manage-themes/themes-overview),
  [Token Sets](https://docs.tokens.studio/manage-tokens/token-sets/)). Terrazzo's
  older `$extensions.mode` "legacy modes" are "still supported" and mapped to a
  hidden `tzMode` modifier ([Resolvers guide](https://terrazzo.app/docs/guides/resolvers/)).
  Figma imports one DTCG file per variable mode
  ([Figma help](https://help.figma.com/hc/en-us/articles/15343816063383-Modes-for-variables)).

### File conventions (`$schema`, extensions)

- **Extensions and media type.** "The following file extensions are
  recommended by this spec: `.tokens` and `.tokens.json`"; "the following MIME
  type SHOULD be used for design token files: `application/design-tokens+json`",
  files "MAY be served using the JSON media type: `application/json`", and tools
  "MUST support both media types" ([Format §4](https://www.designtokens.org/TR/2025.10/format/)).
  Resolver documents: `.resolver.json` and `application/json`
  ([Resolver §3](https://www.designtokens.org/TR/2025.10/resolver/)).
- **`$schema`.** The Format Module has no normative statement; an editor's note
  says "The group is currently exploring the addition of a JSON Schema to support
  the spec". The published schema itself comments "`$schema` is not part of the
  official DTCG specification" while accepting the property
  ([format.json](https://www.designtokens.org/schemas/2025.10/format.json)).
  The draft's examples and Terrazzo's resolver example use
  `"$schema": "https://www.designtokens.org/schemas/2025.10/format.json"` and
  `".../2025.10/resolver.json"` ([draft](https://www.designtokens.org/TR/drafts/format/),
  [Terrazzo](https://terrazzo.app/docs/guides/resolvers/)). Both URLs returned
  HTTP 200 `application/json` (56,523 and 70,725 bytes) on 2026-10-27; there is
  no separate `color.json` (HTTP 404), the colour value schema is embedded in
  `format.json`. Schema sources live in `schemas/src/2025.10/` of the repo
  ([schemas folder](https://github.com/design-tokens/community-group/tree/main/schemas)).
- **`$extensions` namespacing.** The spec asks for "vendor-specific keys"; in
  practice Figma prefixes its keys `com.figma` (e.g. `com.figma.type`,
  `com.figma.aliasData`) ([Figma help](https://help.figma.com/hc/en-us/articles/15343816063383-Modes-for-variables))
  and Tokens Studio's transforms keep the original type at
  `$extensions['studio.tokens'].originalType`
  ([sd-transforms README](https://github.com/tokens-studio/sd-transforms)).
  A Brand OS namespace would follow the same reverse-domain pattern.

### Tooling for CSS variables and Tailwind

#### Style Dictionary

- **Version.** `style-dictionary@5.7.1`, published 2026-10-24; dist-tag `latest`
  (`npm view`, observed 2026-10-27). v5.0.0 shipped 2025-05-16 with Node
  >= 22 and references restricted to real tokens, "aligned with the DTCG spec"
  ([v5.0.0 release](https://github.com/style-dictionary/style-dictionary/releases/tag/v5.0.0),
  `engines.node >=22.0.0` from npm). v4.0.0 shipped 2024-06-28
  ([releases](https://github.com/style-dictionary/style-dictionary/releases)).
- **DTCG support level.** "As of version 4, Style Dictionary has first-class
  support for the DTCG format", but "the latest format 2025.10 does not have full
  support yet in Style Dictionary", described as "a work in progress in v5"
  ([DTCG page](https://styledictionary.com/info/dtcg/)). Tracking issue #1590
  "Support for DTCG v2025.10" (open, created 2025-11-04, updated 2026-10-12)
  marks Color, Border, Shadow and Dimension done, Gradient and Resolvers open
  ([#1590](https://github.com/style-dictionary/style-dictionary/issues/1590)).
  Release notes confirm: 5.3.0 (2026-02-09) "Add support for DTCG v2025.10
  structured color format in color transformers" with "all 14 DTCG color spaces"
  and `hex` fallback; 5.4.0 (2026-03-22) "dimension token type object value"
  for "All built-in transforms"; 5.7.0 (2026-10-16) "DTCG v2025.10 `duration`
  token values" and `$root` handling in name transforms
  ([releases](https://github.com/style-dictionary/style-dictionary/releases)).
  Resolver support is still being designed in #1590 (September 2026 comments
  discuss per-permutation output paths). The config flag `usesDtcg` exists but
  "style-dictionary will auto-detect this format"
  ([config](https://styledictionary.com/reference/config/)).
- **How it runs.** `npm install -D style-dictionary`, then `npx style-dictionary
  build` in a folder with a config file, or the Node API
  `new StyleDictionary('config.json')` + `await sd.buildAllPlatforms()`
  ([installation](https://styledictionary.com/getting-started/installation/)).
  Config: `source` globs, `platforms.<name>.transformGroup`, `buildPath`,
  `files[{destination, format, options}]`; `expand` (default `false`) splits
  composite tokens using a built-in "DTCG type map" for `strokeStyle`, `border`,
  `transition`, `shadow`, `gradient`, `typography`
  ([config](https://styledictionary.com/reference/config/)).
- **CSS variables.** Format `css/variables` ("Creates a CSS file with variable
  definitions") with options `outputReferences`, `outputReferenceFallbacks`,
  `selector`, `showFileHeader`, `sort`, `formatting`
  ([formats](https://styledictionary.com/reference/hooks/formats/predefined/)).
  The `css` transform group runs `attribute/cti`, `name/kebab`, `time/seconds`,
  `html/icon`, `size/rem`, `color/css`, `asset/url`, `fontFamily/css`,
  `cubicBezier/css`, `strokeStyle/css/shorthand`, `border/css/shorthand`,
  `typography/css/shorthand`, `transition/css/shorthand`, `shadow/css/shorthand`
  ([transform groups](https://styledictionary.com/reference/hooks/transform-groups/predefined/)).
- **Other outputs.** SCSS/Less/Stylus, `javascript/*`, `typescript/*`, `json/*`,
  `android/*`, `compose/object`, `ios/*`, `ios-swift/*`, `flutter/class.dart`
  (same formats page).
- **Tailwind.** No predefined Tailwind format exists (formats page); issue #843
  "Tailwind format" has been open since 2022-07-09 with last activity 2023-06-07
  ([#843](https://github.com/style-dictionary/style-dictionary/issues/843)).
  The community package `sd-tailwindcss-transformer` (2.3.0, last modified
  2026-09-28 on npm) emits a `tailwind.config.js`-style module (`formatType`
  `js`/`cjs`) or a Tailwind v4 `@theme` stylesheet (`formatType: 'css'`); its
  README says "If you are using v4 of style-dictionary, install v2.1.0" and does
  not mention v5 or DTCG
  ([README](https://github.com/nado1001/style-dictionary-tailwindcss-transformer)).

#### Terrazzo

- **Version.** `@terrazzo/cli`, `@terrazzo/plugin-css` and
  `@terrazzo/plugin-tailwind` are all 2.10.0, published 2026-10-21 (`npm view`,
  [releases](https://github.com/terrazzoapp/terrazzo/releases)). Formerly
  "Cobalt" (started 2021); "not an official implementation of the design token
  format, though adherence to the spec is a goal"; maintainer Drew Powers is a
  spec editor; MIT ([About](https://terrazzo.app/docs/reference/about/)).
- **DTCG support level.** 2.0.0 (2026-03-17): "Full support for the DTCG
  v2025.10 spec, including resolvers"; breaking: "DTCG 2nd Editors draft format
  will throw errors by default", colours need `components`, dimensions and
  durations need object notation, typography requires all five properties
  ([cli@2.0.0](https://github.com/terrazzoapp/terrazzo/releases/tag/%40terrazzo%2Fcli%402.0.0)).
  Later minors: 2.4.0 orthogonality detection in the resolver API, 2.7.0 tolerate
  custom `$type`s and nested `$root` aliases, 2.8.0 Figma import fixes
  ([CHANGELOG](https://github.com/terrazzoapp/terrazzo/blob/main/packages/cli/CHANGELOG.md)).
  Note the docs home still says "support for resolvers and other 2025.10 features
  coming in 2.0!" ([docs](https://terrazzo.app/docs/)), stale wording.
- **How it runs.** `npm i -D @terrazzo/cli @terrazzo/plugin-css`; `npx tz init`
  scaffolds; `npx tz build` ("Generate code from `tokens.json` based on
  plugins", flags `--watch`, `--no-lint`); `tz check` validates and lints;
  `tz format` rewrites tokens "into the current DTCG standard"; `tz import
  <figma url> -o my-ds.resolver.json` exports Figma Variables and Styles to a
  resolver ([CLI](https://terrazzo.app/docs/reference/cli/)). Config
  `terrazzo.config.ts`: `tokens` (one file or an array, "merged in array order
  (last will take precedence)", JSON/JSONC/YAML), `outDir` (default `./dist/`),
  `plugins`, `lint.rules` ([config](https://terrazzo.app/docs/reference/config/)).
  Resolvers: `version` "has only one possible value: `2025.10`"; the resolver
  example uses `$schema`, `sets`, `modifiers.theme.contexts.{light,dark}`,
  `resolutionOrder` ([Resolvers guide](https://terrazzo.app/docs/guides/resolvers/)).
- **CSS variables.** `@terrazzo/plugin-css` "outputs standard CSS variables that
  correspond directly to your token IDs" (default `tokens/tokens.css`,
  `variableName` function), maps resolver contexts through `permutations:
  [{input: {theme: "dark"}, prepare: contents => ...}]` into any selector or
  media query, and "automatically downconverts colors so they're displayable on
  all hardware" with `@media (color-gamut: p3)` / `rec2020` blocks; options
  include `exclude`, `transform`, `utility`, `legacyHex`, `colorDepth`,
  `skipBuild` ([CSS plugin](https://terrazzo.app/docs/integrations/css/)).
- **Tailwind.** `@terrazzo/plugin-tailwind` "can generate a Tailwind v4 Theme
  from your design tokens": a template CSS file with `@tz` at-rules is filled
  into an `@theme` block (default output `tailwind-theme.css`); "theme mapping is
  up to you"; every permutation used must also be declared in `plugin-css`; the
  0.x `modeVariants` option was removed; Tailwind v3 is not mentioned
  ([Tailwind plugin](https://terrazzo.app/docs/integrations/tailwind/)).
- **Other outputs.** CSS-in-JS, Sass, JS/TS, Storybook, Swift, Vanilla Extract,
  Custom ([integrations](https://terrazzo.app/docs/integrations/)).

#### Tokens Studio (Figma plugin) and sd-transforms

- **Version.** Plugin release 2.13.2 on 2026-10-23 (`gh release list -R
  tokens-studio/figma-plugin`). It is "a Figma Plugin allowing you to integrate
  Tokens into your Figma designs" ([docs](https://docs.tokens.studio/)).
- **DTCG support level.** A setting switches between the "Current Tokens Studio
  'legacy' format" and the "W3C DTCG spec format"; DTCG mode writes `$value`,
  `$type`, `$description` and blocks names containing `{`, `}` or `$`; "The DTCG
  spec specifies additional token types and their accepted values, which we will
  support in future releases"; listed known issues include composition tokens
  (#2800), `boxShadow` x/y vs `offsetX`/`offsetY` (#2052) and group descriptions
  (#1811) ([Token Format](https://docs.tokens.studio/manage-settings/token-format)).
  The plugin's own issue #3236 "Future-proofing Changes from the DTCG
  Specifications" (open, created 2024-12-24, last updated 2025-03-18, no
  comments) lists the gaps: dimensions saved as strings instead of
  `{value, unit}`, opacity as string, durations, legacy types `spacing`,
  `sizing`, `borderRadius`, `borderWidth` instead of `dimension`, plural type
  names (`fontFamilies`), `boxShadow` instead of `shadow`
  ([#3236](https://github.com/tokens-studio/figma-plugin/issues/3236)). Whether
  2.13.x has closed any of these is not verified (see Gaps).
- **Themes and files.** Themes (Pro) "define combinations of Token Sets" and
  are written to a "themes configuration file"; multi-file sync (Pro) writes
  "Each Token Set ... as an individual JSON file" plus "Additional data files"
  such as the Themes configuration
  ([Themes](https://docs.tokens.studio/manage-themes/themes-overview),
  [Multi-file sync](https://docs.tokens.studio/token-storage/remote-multi-file-sync)).
  The `$themes.json` name appears in Tokens Studio's export docs and the
  `$metadata` file "may show a configuration change as adding, removing, and
  reordering Token Sets" ([Token Sets](https://docs.tokens.studio/manage-tokens/token-sets/)).
- **Asset type.** Tokens Studio's `asset` token "define[s] the location of
  assets ... as a URL" and "is not yet an official Token Type in the W3C DTCG
  specifications" ([Asset](https://docs.tokens.studio/manage-tokens/token-types/asset)).
- **sd-transforms.** `@tokens-studio/sd-transforms@2.0.3` (2026-10-14),
  `peerDependencies: style-dictionary ^5.0.0` (`npm view`); its preprocessor
  "aligns Tokens Studio token types with DTCG token types", keeps the original
  at `$extensions['studio.tokens'].originalType`, and exports `permutateThemes`
  for `$themes.json`; no Tailwind support
  ([README](https://github.com/tokens-studio/sd-transforms)).

#### Others

- **Penpot.** "Penpot Design Tokens adhere to the Design Tokens Format Module
  and its definitions, a draft by the W3C DTCG"; supports sets and
  multidimensional themes; imports/exports a single JSON or a multi-file folder
  with "`$themes.json` or `$metadata.json`" (the Tokens Studio convention);
  types: border radius, color, dimension, opacity, rotation, sizing, spacing,
  stroke width, number, shadow, font family/size/weight, letter spacing, text
  case, text decoration, typography; line height only inside typography
  ([Penpot help](https://help.penpot.app/user-guide/design-tokens/)). The spec
  repo added Penpot to its tool lists on 2026-05-07 (#406).
- **Figma.** Import: "Design tokens must be in a JSON file and follow the Design
  Tokens Community Group (DTCG) format", one file per mode; colours only HSL or
  sRGB, dimensions "must be set to px", durations in `s`, `fontFamily` a single
  name, Figma data under `$extensions` keys "prefixed with `com.figma`"; "String
  is not an officially defined DTCG token type, but is accepted on import".
  Export: "You can export variable modes to a JSON file", the article does not
  say that export is DTCG ([Figma help](https://help.figma.com/hc/en-us/articles/15343816063383-Modes-for-variables)).
- **Sketch, Framer, Knapsack, Supernova, zeroheight** are named in the
  announcement as supporting or implementing 2025.10; not verified individually
  here.

### What a CVI needs that tokens cannot express

The spec's scope is narrow by design: "Design tokens are a methodology for
expressing design decisions in a platform-agnostic way"; a token is "at minimum
a name/value pair" ([Format §2, §3.1](https://www.designtokens.org/TR/2025.10/format/)).
Measured against the glossary's CVI (colour, type, logo, spacing, imagery,
components), the format covers colour, type styles and spacing scales and little
else:

| CVI content | DTCG 2025.10 can express | Cannot express | Evidence |
| --- | --- | --- | --- |
| Colour palette, semantic colours, light/dark | Yes (`color` + resolver contexts) | Usage proportions, pairing rules, contrast requirements, "never on photography" rules | type list; §9.2 "tools must not infer meaning ... from" groups |
| Typography | Font names, weights, type styles | Font files and licences, hierarchy rules, measure, hyphenation, fallbacks per platform | `fontFamily` is a name only (§8.3) |
| Logo | Nothing; a group named `logo` carries no meaning | Logo files and variants, clear space (a ratio to the mark), minimum size, backgrounds allowed, misuse examples | no `file` type (§8.8 "still to be documented"; [#132](https://github.com/design-tokens/community-group/issues/132) open, last activity 2023-12-19) |
| Spacing, radii, borders, shadows | Yes (`dimension`, `border`, `shadow`) | Layout grids, columns, gutters, breakpoints, relative units (`%`, `vw`, `em`) | units only `px`/`rem` (§8.2); [#222 grid type](https://github.com/design-tokens/community-group/issues/222), [#188 fluid dimensions](https://github.com/design-tokens/community-group/issues/188), [#245 units](https://github.com/design-tokens/community-group/issues/245) open |
| Imagery and illustration | Nothing | Photography style, cropping, treatment, icon style, do/don't examples | no image/asset type |
| Motion | `duration`, `cubicBezier`, `transition` | Choreography, principles | [#429](https://github.com/design-tokens/community-group/issues/429) open |
| Components | Nothing beyond values a component reads | Anatomy, states, variants, accessibility specs, code | not a token concern; "component-level references" in the announcement means aliases |
| Text, booleans, opacity | `number` only | Strings, booleans, percentages | [#234](https://github.com/design-tokens/community-group/issues/234) open; §8.8 |
| Custom types | Not conformant ("every design token MUST use one of these types") | Vendor types such as Tokens Studio `asset` | §8; [#223](https://github.com/design-tokens/community-group/issues/223) open; Terrazzo 2.7.0 merely tolerates them |

Proposed non-token artifacts for a Brand Package (using the glossary's terms;
a proposal for the map, not a decision):

1. **Token files**: `tokens/*.tokens.json` in DTCG 2025.10 plus one
   `brand.resolver.json` for modes (light/dark, density, sub-brand). This is the
   only machine-readable layer tools agree on.
2. **Asset manifest**: a JSON file outside the DTCG format (for example
   `assets/manifest.json`) listing logo variants (primary, mono, reversed, mark),
   each with file paths per format (SVG, PNG), minimum size, clear-space rule
   (expressed as a multiplier of a named dimension), allowed backgrounds, and the
   same for icons and illustration. Values may reference token paths by name so
   the two layers stay linked; `$extensions` with a reverse-domain key (e.g.
   `org.brand-os`) could carry a pointer, but the rule itself does not fit a
   token.
3. **Font files** and licence terms, with an `@font-face` stylesheet; `fontFamily`
   tokens only name the family.
4. **Reference pages** (HTML): logo usage, colour usage and proportions,
   typography hierarchy, imagery style, layout grid and breakpoints, motion
   principles, do/don't examples with images. These are the glossary's
   References; the token files cannot hold prose or pictures.
5. **Component specs**: anatomy, states and accessibility rules as Reference
   pages, optionally with reference CSS or a Tailwind preset that consumes the
   generated variables.
6. **Generated outputs**: `tokens.css` (CSS variables, one permutation per mode)
   and `tailwind-theme.css` (Tailwind v4 `@theme`) built from the token files at
   package-build time with Terrazzo (or Style Dictionary once its resolver support
   lands), so agents never run a build.
7. **Skill text**: the lean rules an agent needs first (which token to use for
   what, which Reference to open), pointing at items 1 to 6.

### Minimal example token file for one brand

Valid against the 2025.10 rules above (object colours with `hex` fallback,
`dimension` objects, all five `typography` properties, aliases to whole tokens).
The `$schema` line is accepted by the published schema though not part of the
spec; the `org.brand-os` extension key is illustrative only.

```json
{
  "$schema": "https://www.designtokens.org/schemas/2025.10/format.json",
  "$description": "Example Brand: core tokens (colour, type, spacing)",
  "color": {
    "$type": "color",
    "brand": {
      "primary": {
        "$value": { "colorSpace": "srgb", "components": [0, 0.3412, 0.7216], "hex": "#0057b8" },
        "$description": "Primary brand blue. Buttons, links, the logo mark."
      },
      "accent": {
        "$value": { "colorSpace": "srgb", "components": [1, 0.4157, 0.0745], "hex": "#ff6a13" }
      }
    },
    "neutral": {
      "900": { "$value": { "colorSpace": "srgb", "components": [0.102, 0.102, 0.102], "hex": "#1a1a1a" } },
      "0":   { "$value": { "colorSpace": "srgb", "components": [1, 1, 1], "hex": "#ffffff" } }
    },
    "text": {
      "default": { "$value": "{color.neutral.900}" },
      "inverse": { "$value": "{color.neutral.0}" }
    },
    "surface": {
      "default": { "$value": "{color.neutral.0}" }
    },
    "action": {
      "primary": {
        "$value": "{color.brand.primary}",
        "$extensions": { "org.brand-os": { "reference": "references/colour.html#action" } }
      }
    }
  },
  "font": {
    "family": {
      "$type": "fontFamily",
      "sans": { "$value": ["Inter", "Helvetica Neue", "Arial", "sans-serif"] }
    },
    "weight": {
      "$type": "fontWeight",
      "regular": { "$value": 400 },
      "bold": { "$value": 700 }
    },
    "size": {
      "$type": "dimension",
      "body": { "$value": { "value": 1, "unit": "rem" } },
      "h1":   { "$value": { "value": 2.5, "unit": "rem" } }
    }
  },
  "type": {
    "$type": "typography",
    "body": {
      "$value": {
        "fontFamily": "{font.family.sans}",
        "fontSize": "{font.size.body}",
        "fontWeight": "{font.weight.regular}",
        "letterSpacing": { "value": 0, "unit": "px" },
        "lineHeight": 1.5
      }
    },
    "heading-1": {
      "$value": {
        "fontFamily": "{font.family.sans}",
        "fontSize": "{font.size.h1}",
        "fontWeight": "{font.weight.bold}",
        "letterSpacing": { "value": -0.02, "unit": "rem" },
        "lineHeight": 1.1
      }
    }
  },
  "space": {
    "$type": "dimension",
    "$description": "4px base scale",
    "1": { "$value": { "value": 4, "unit": "px" } },
    "2": { "$value": { "value": 8, "unit": "px" } },
    "4": { "$value": { "value": 16, "unit": "px" } },
    "8": { "$value": { "value": 32, "unit": "px" } },
    "gutter": { "$value": "{space.4}" }
  }
}
```

A companion resolver for a dark mode, following the Resolver Module and the
Terrazzo example (`theme/dark.tokens.json` would redefine only `color.text.*`
and `color.surface.*`):

```json
{
  "$schema": "https://www.designtokens.org/schemas/2025.10/resolver.json",
  "name": "Example Brand",
  "version": "2025.10",
  "sets": {
    "core": { "sources": [{ "$ref": "tokens/core.tokens.json" }] }
  },
  "modifiers": {
    "theme": {
      "default": "light",
      "contexts": {
        "light": [{ "$ref": "tokens/theme/light.tokens.json" }],
        "dark": [{ "$ref": "tokens/theme/dark.tokens.json" }]
      }
    }
  },
  "resolutionOrder": [{ "$ref": "#/sets/core" }, { "$ref": "#/modifiers/theme" }]
}
```

Both blocks parse as JSON (checked 2026-10-27) and were written against the
published JSON schemas' structure and the spec text quoted above; they were not
run through a schema validator or a build tool.

## Gaps and open questions

- **No successor edition.** Nothing after 2025.10 is published and the repo shows
  no milestone or release-planning issue; the cadence of future editions is
  unknown. The preview draft already fixes the JSON Pointer MAY/MUST conflict,
  so a 2025.10-conformant parser should treat JSON Pointer support as expected.
- **Style Dictionary resolver support** is unscheduled (#1590 open); until it
  lands, modes with Style Dictionary need a custom loop or Tokens Studio's
  `permutateThemes`. Gradient colour objects are also still open there.
- **Tokens Studio 2025.10 output** is unverified: issue #3236 lists string
  dimensions and legacy type names and has had no update since 2025-03-18; the
  docs still say the extra DTCG types "will" be supported. A Brand Package
  authored in Tokens Studio would need `tz format` or sd-transforms before it is
  2025.10-clean.
- **Figma native DTCG export** is not documented in the help article checked;
  only import is. Third-party plugins and Terrazzo's `tz import` fill the gap.
- **`sd-tailwindcss-transformer`** does not state Style Dictionary v5 or DTCG
  object-value compatibility; untested here.
- **Dimension units** are only `px` and `rem`; fluid or percentage layout rules
  cannot be tokens (#188, #245 open). Brand OS layout rules must live in
  References or a non-DTCG file.
- **File/asset type** is still "to be documented" (§8.8; #132 open since 2022).
  The asset manifest proposed above is a Brand OS convention, not a standard;
  the `$extensions` namespace for Brand OS is undecided.
- **Custom `$type`s** are non-conformant; tools differ (Terrazzo tolerates them,
  Figma accepts `string` on import). Brand OS should not rely on them.
- **Penpot** version and the exact schema of its `$themes.json`/`$metadata.json`
  files were not checked.
- **Terrazzo** docs home still advertises 2.0 as upcoming; the CLI reference
  does not document a `bundle` command even though the docs home mentions it.
  Not resolved here.

## Sources

Specification and community group
- https://www.designtokens.org/ (homepage; "First stable version 2025.10 now available")
- https://www.designtokens.org/TR/2025.10/ (Technical Reports 2025.10 index)
- https://www.designtokens.org/TR/2025.10/format/ (Format Module 2025.10)
- https://www.designtokens.org/TR/2025.10/color/ (Color Module 2025.10)
- https://www.designtokens.org/TR/2025.10/resolver/ (Resolver Module 2025.10)
- https://www.designtokens.org/TR/drafts/format/ (preview draft, 2026-09-08; target of the 301 from https://tr.designtokens.org/format/)
- https://www.designtokens.org/TR/drafts/resolver/ (preview draft of the resolver)
- https://www.designtokens.org/schemas/2025.10/format.json (published JSON Schema)
- https://www.designtokens.org/schemas/2025.10/resolver.json (published JSON Schema)
- https://www.w3.org/community/design-tokens/2025/10/28/design-tokens-specification-reaches-first-stable-version/ (announcement)
- https://github.com/design-tokens/community-group (README with edition table)
- https://github.com/design-tokens/community-group/tree/main/technical-reports
- https://github.com/design-tokens/community-group/tree/main/schemas
- https://github.com/design-tokens/community-group/issues/132 (file/asset type)
- https://github.com/design-tokens/community-group/issues/188 (fluid dimensions)
- https://github.com/design-tokens/community-group/issues/222 (grid type)
- https://github.com/design-tokens/community-group/issues/223 (custom types)
- https://github.com/design-tokens/community-group/issues/234 (string/boolean)
- https://github.com/design-tokens/community-group/issues/245 (dimension units)
- https://github.com/design-tokens/community-group/issues/429 (motion)
- GitHub API queries via `gh` on 2026-10-27: commits on `technical-reports/format`, `resolver`, `color` since 2025-10-28; tags; labels; open-issue count

Style Dictionary
- https://styledictionary.com/
- https://styledictionary.com/info/dtcg/
- https://styledictionary.com/info/tokens/
- https://styledictionary.com/getting-started/installation/
- https://styledictionary.com/reference/config/
- https://styledictionary.com/reference/hooks/formats/predefined/
- https://styledictionary.com/reference/hooks/transforms/predefined/
- https://styledictionary.com/reference/hooks/transform-groups/predefined/
- https://styledictionary.com/versions/v5/migration/
- https://github.com/style-dictionary/style-dictionary/releases (v4.0.0, v5.0.0, v5.3.0, v5.4.0, v5.7.0, v5.7.1)
- https://github.com/style-dictionary/style-dictionary/issues/1590 (Support for DTCG v2025.10)
- https://github.com/style-dictionary/style-dictionary/issues/843 (Tailwind format)
- https://github.com/nado1001/style-dictionary-tailwindcss-transformer
- npm registry: `style-dictionary`, `sd-tailwindcss-transformer`

Terrazzo
- https://terrazzo.app/
- https://terrazzo.app/docs/
- https://terrazzo.app/docs/reference/about/
- https://terrazzo.app/docs/reference/cli/
- https://terrazzo.app/docs/reference/config/
- https://terrazzo.app/docs/guides/resolvers/
- https://terrazzo.app/docs/integrations/
- https://terrazzo.app/docs/integrations/css/
- https://terrazzo.app/docs/integrations/tailwind/
- https://github.com/terrazzoapp/terrazzo/blob/main/packages/cli/CHANGELOG.md
- https://github.com/terrazzoapp/terrazzo/releases (cli@2.0.0 2026-03-17; 2.10.0 2026-10-21)
- npm registry: `@terrazzo/cli`, `@terrazzo/parser`, `@terrazzo/plugin-css`, `@terrazzo/plugin-tailwind`

Tokens Studio
- https://docs.tokens.studio/
- https://docs.tokens.studio/manage-settings/token-format
- https://docs.tokens.studio/manage-themes/themes-overview
- https://docs.tokens.studio/manage-tokens/token-sets/
- https://docs.tokens.studio/token-storage/remote-multi-file-sync
- https://docs.tokens.studio/manage-tokens/token-types/asset
- https://github.com/tokens-studio/figma-plugin/issues/3236
- https://github.com/tokens-studio/figma-plugin/releases (2.13.2, 2026-10-23)
- https://github.com/tokens-studio/sd-transforms
- npm registry: `@tokens-studio/sd-transforms`

Other tools
- https://help.penpot.app/user-guide/design-tokens/
- https://help.figma.com/hc/en-us/articles/15343816063383-Modes-for-variables

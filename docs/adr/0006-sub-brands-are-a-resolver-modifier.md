# Sub-brands are a resolver modifier in the parent Brand Package

A master brand with sub-brands (a product line, a division, a campaign brand)
could have been modelled as one Brand Package per sub-brand that inherits from
the parent across repos, or inside the parent package. We chose a second DTCG
resolver modifier, `subBrand`, in the parent's one resolver, with the parent
brand as its default. One repo, one version line, one Package Manifest: shared
tokens with per-sub-brand overrides, manifest entries that name the sub-brands
they apply to (a lookup prefers the sub-brand's entry and falls back to the
parent's), and one set of Generated Outputs per sub-brand under `generated/`.
`brand-os.json` and every MCP tool take an optional `subBrand`. This extends
ADR 0003, where `mode` was the only modifier the Brand OS build mapped.

Considered and rejected: a package per sub-brand inheriting from the parent
(the build would fetch and pin a second private repo, two version lines would
have to move together, and a parent change could break a child silently).
The cost we accept: every sub-brand shares the parent's readers and release
cadence. A sub-brand that needs different access becomes its own Brand Package
with copied tokens and no inheritance.

Settled in
[Sub-brands: a resolver modifier or a separate Brand Package](https://github.com/Ahmadnmic/Brand-OS-wayfinder/issues/24).

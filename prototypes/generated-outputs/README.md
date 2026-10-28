# PROTOTYPE, throwaway: Generated Output conventions

Answers wayfinder ticket
[Prototype: Generated Output conventions for CSS, modes and Tailwind](https://github.com/Ahmadnmic/Brand-OS-wayfinder/issues/25).
Never merged to main. The verdict lives on the ticket.

## Run

```sh
cd prototypes/generated-outputs
npm install
for v in A B C; do (cd variants/$v && npx tz build && npx tailwindcss -i input.css -o out.css); done
python3 -m http.server 8765   # then open http://localhost:8765/?variant=B
```

## What is here

- `fixture-package/`: a fictional Brand Package, "Fjord Studio": all seven standard groups,
  primitives in `color.palette.*`, semantic colours per mode, one resolver with `mode` light/dark,
  a manifest with one self-hosted and one provider font Asset.
- `brandos-build.mjs`: one parameterised Brand OS build (Terrazzo 2.10 + two small Brand OS
  plugins: a font-face output and a linked Tailwind theme) plus the `generated/build.json` stamp.
- `variants/{A,B,C}/`: three conventions built from the same package, each with
  `generated/` (the three Generated Outputs and the stamp) and a `demo.html` that uses
  Tailwind classes, a nested `data-mode="dark"` section, and a plain-CSS card.
- `index.html`: switch variants and modes, read the generated files.

## Verdict

Variant B, refined after the agent test, is the accepted convention. The full decision list is
the resolution comment on the ticket. In short: `--brand-` + DTCG path; light on `:root`, dark by
OS preference, `data-mode` overrides on any element; hex; an inline Tailwind theme pointing at the
CSS variables; Tailwind defaults cleared except numeric spacing; `color.palette` kept out of
Tailwind; spacing as `p-space-*`; type styles as `type-*` utilities only.

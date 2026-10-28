// PROTOTYPE, throwaway. One Brand OS build config, parameterised so three
// Generated Output conventions can be compared side by side (ticket #25).
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { defineConfig } from "@terrazzo/cli";
import css from "@terrazzo/plugin-css";
import tailwind from "@terrazzo/plugin-tailwind";

const PKG = new URL("./fixture-package/", import.meta.url);
const manifest = JSON.parse(fs.readFileSync(new URL("brand-package.json", PKG)));

// Standard group -> Tailwind v4 theme namespace. A and C use this as-is with the official plugin;
// the linked plugin (B, the accepted convention) applies the overrides in LINKED_TW below.
const TW_MAP = [
  ["color", "--color-"],          // semantic colours (palette excluded when hidePalette)
  ["font.family", "--font-"],
  ["font.weight", "--font-weight-"],
  ["type", "--text-"],            // composite -> --text-x, --text-x--line-height ...
  ["space", "--spacing-"],
  ["radius", "--radius-"],
  ["shadow", "--shadow-"],
  ["motion.ease", "--ease-"],
];

function fontsPlugin({ filename, fontDir }) {
  return {
    name: "brandos-fonts",
    async build({ outputFile }) {
      const imports = [], faces = [];
      for (const a of manifest.assets.filter((a) => a.kind === "font")) {
        if (a.provider) {
          imports.push(`/* ${a.family}: provider ${a.provider} */\n@import url("${a.stylesheet}");`);
          if (a.providerFamily && a.providerFamily !== a.family)
            imports.push(`/* WARNING: token family "${a.family}" != provider family "${a.providerFamily}"; the browser will never match it */`);
        } else {
          for (const f of a.files)
            faces.push(`@font-face {\n  font-family: "${a.family}";\n  src: url("${fontDir}${path.basename(f.src)}") format("woff2");\n  font-weight: ${f.weight};\n  font-style: ${f.style};\n  font-display: swap;\n}`);
          faces.push(`/* Licence (${a.family}): ${a.licence.text} ${a.licence.url} */`);
        }
      }
      outputFile(filename, [...imports, ...faces].join("\n\n") + "\n");
    },
  };
}

// Tailwind theme that points at the CSS variables instead of copying values,
// so the css output's mode selectors drive Tailwind too (variant B).
// Accepted convention (ticket #25): spacing gets its own name so brand sizes never hijack
// max-w-md and friends; type styles are type-* utilities only, not --text-*.
const LINKED_TW = TW_MAP.filter(([g]) => g !== "type").map(([g, ns]) => (g === "space" ? [g, "--spacing-space-"] : [g, ns]));

function linkedTailwindPlugin({ filename, hidePalette, clearDefaults: v_clear, typeUtilities }) {
  return {
    name: "brandos-tailwind-linked",
    enforce: "post",
    async build({ getTransforms, outputFile }) {
      const lines = [];
      for (const [group, ns] of LINKED_TW) {
        for (const t of getTransforms({ format: "css", id: `${group}.**`, input: { mode: "light" } })) {
          if (hidePalette && t.token.id.startsWith("color.palette.")) continue;
          const rel = t.token.id.slice(group.length + 1).replaceAll(".", "-");
          const v = t.localID;
          if (t.token.$type === "typography") {
            lines.push(`  ${ns}${rel}: var(${v}-font-size);`);
            for (const [sub, tw] of [["line-height", "line-height"], ["letter-spacing", "letter-spacing"], ["font-weight", "font-weight"]])
              lines.push(`  ${ns}${rel}--${tw}: var(${v}-${sub});`);
          } else lines.push(`  ${ns}${rel}: var(${v});`);
        }
      }
      if (v_clear) lines.unshift("  --font-*: initial;", "  --text-*: initial;", "  --radius-*: initial;", "  --shadow-*: initial;");
      lines.push(`  --default-transition-duration: var(--brand-motion-duration-base);`);
      lines.push(`  --default-transition-timing-function: var(--brand-motion-ease-standard);`);
      let utils = "";
      if (typeUtilities) for (const t of getTransforms({ format: "css", id: "type.**", input: { mode: "light" } })) {
        const n = t.token.id.slice(5).replaceAll(".", "-"), x = t.localID;
        utils += `\n@utility type-${n} {\n  font: var(${x});\n  letter-spacing: var(${x}-letter-spacing);\n}\n`;
      }
      outputFile(filename, `/* Brand OS Tailwind v4 theme. Generated, never hand-edit. Import after "tailwindcss" and brand.css. */\n@theme inline {\n  --color-*: initial;\n${lines.join("\n")}\n}\n${utils}`);
    },
  };
}

function modeTokenIds(ctx) {
  const resolver = JSON.parse(fs.readFileSync(new URL("tokens/brand.resolver.json", PKG)));
  const ids = [];
  const walk = (o, pre) => { for (const [k, val] of Object.entries(o)) { if (k.startsWith("$")) continue; if (val && typeof val === "object" && "$value" in val) ids.push(pre + k); else if (val && typeof val === "object") walk(val, pre + k + "."); } };
  for (const src of resolver.modifiers.mode.contexts[ctx]) walk(JSON.parse(fs.readFileSync(new URL("tokens/" + src.$ref, PKG))), "");
  return ids;
}

export function makeConfig(v) {
  const name = (t) => `--${v.prefix}${t.id.replaceAll(".", "-")}`;
  const light = { input: { mode: "light" }, prepare: (c) => `:root {\n  color-scheme: light;\n${c}\n}` };
  // Dark block lists only the tokens the dark context defines (Terrazzo's `only` did not filter).
  const darkOnly = v.darkDiffOnly ? { include: modeTokenIds("dark") } : {};
  const darkPerms = {
    attr: [{ input: { mode: "dark" }, ...darkOnly, prepare: (c) => `[data-mode="dark"] {\n  color-scheme: dark;\n${c}\n}` }],
    media: [{ input: { mode: "dark" }, ...darkOnly, prepare: (c) => `@media (prefers-color-scheme: dark) {\n  :root {\n    color-scheme: dark;\n${c}\n  }\n}` }],
    both: [
      ...(v.lightAttr ? [{ input: { mode: "light" }, include: modeTokenIds("light"), prepare: (c) => `[data-mode="light"] {\n  color-scheme: light;\n${c}\n}` }] : []),
      { input: { mode: "dark" }, ...darkOnly, prepare: (c) => `@media (prefers-color-scheme: dark) {\n  :root:not([data-mode="light"]) {\n    color-scheme: dark;\n${c}\n  }\n}` },
      { input: { mode: "dark" }, ...darkOnly, prepare: (c) => `[data-mode="dark"] {\n  color-scheme: dark;\n${c}\n}` },
    ],
  }[v.dark];
  const plugins = [
    css({ filename: "brand.css", variableName: name, legacyHex: v.hex, permutations: [light, ...darkPerms] }),
    fontsPlugin({ filename: "fonts.css", fontDir: "./fonts/" }),
  ];
  if (v.tailwind === "linked") plugins.push(linkedTailwindPlugin({ filename: "tailwind.css", hidePalette: v.hidePalette, clearDefaults: v.clearDefaults, typeUtilities: v.typeUtilities }));
  else {
    const theme = {};
    for (const [group, ns] of TW_MAP) {
      const key = ns.slice(2, -1);
      theme[key] = [`${group}.**`];
    }
    plugins.push(tailwind({ filename: "tailwind.css", template: "../tailwind.template.css", theme }));
  }
  return defineConfig({ tokens: [new URL("tokens/brand.resolver.json", PKG).pathname], outDir: "./generated/", plugins });
}

export function writeStamp(dir, formats) {
  const h = createHash("sha256");
  const inputs = ["tokens/base.tokens.json", "tokens/light.tokens.json", "tokens/dark.tokens.json", "tokens/brand.resolver.json"];
  for (const f of inputs) h.update(fs.readFileSync(new URL(f, PKG)));
  h.update(JSON.stringify(manifest.assets.filter((a) => a.kind === "font")));
  fs.writeFileSync(path.join(dir, "generated/build.json"), JSON.stringify({ brand: manifest.id, version: manifest.version, formats, inputsSha256: h.digest("hex"), buildVersion: "0.0.0-prototype" }, null, 2) + "\n");
}

// PROTOTYPE stub of the Brand OS MCP server (ticket #22). Fixture data only, newline-delimited JSON-RPC over stdio.
import { createInterface } from "node:readline";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, extname } from "node:path";

const light = { "color.surface.page": "#fbf8f3", "color.surface.raised": "#f6f7f8", "color.text.default": "#16191d", "color.text.muted": "#5b6570", "color.text.on-action": "#f6f7f8", "color.action.primary": "#1f6aa6", "color.action.primary-hover": "#185585", "color.border.default": "#d9dde1", "color.status.error": "#c8372d", "color.status.success": "#2f8a4e" };
const dark = { ...light, "color.surface.page": "#16191d", "color.surface.raised": "#2b3138", "color.text.default": "#f6f7f8", "color.text.muted": "#9aa3ad", "color.action.primary": "#7fb6dc", "color.action.primary-hover": "#d4e8f5", "color.border.default": "#5b6570" };
const type = { "type.display": "Fjord Display 700 · 3rem/1.1", "type.heading": "Fjord Display 700 · 1.75rem/1.2", "type.body": "Fjord Sans 400 · 1rem/1.5", "type.label": "Fjord Sans 500 · 0.875rem/1.3" };
const other = { "space.xs": "0.25rem", "space.sm": "0.5rem", "space.md": "1rem", "space.lg": "1.5rem", "space.xl": "2.5rem", "radius.sm": "0.25rem", "radius.md": "0.5rem", "radius.pill": "999px", "motion.duration.fast": "120ms", "motion.duration.base": "220ms" };
const tokens = (mode) => [
  ...Object.entries(mode === "dark" ? dark : light).map(([path, value]) => ({ path, type: "color", value, hex: value, cssVar: "--brand-" + path.replaceAll(".", "-") })),
  ...Object.entries(type).map(([path, value]) => ({ path, type: "typography", value, cssVar: "--brand-" + path.replaceAll(".", "-") })),
  ...Object.entries(other).map(([path, value]) => ({ path, type: path.startsWith("motion") ? "duration" : "dimension", value, cssVar: "--brand-" + path.replaceAll(".", "-") })),
];
const logo = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 32"><path d="M4 26 L16 6 L28 26 Z" fill="#1f6aa6"/><path d="M14 26 L22 13 L30 26 Z" fill="#7fb6dc"/><text x="36" y="22" font-family="Georgia,serif" font-weight="700" font-size="16" fill="#16191d">Fjord</text></svg>`;
const brand = { id: "fjord", name: "Fjord Studio", repo: "fjord-studio/brand-fjord", pinned: "1.0.0", latest: "1.1.0", latestIsMajor: false, stale: false, modes: ["light", "dark"],
  references: [{ name: "logo-usage", kind: "logo" }, { name: "colour", kind: "colour" }, { name: "typography", kind: "typography" }, { name: "button", kind: "component" }, { name: "imagery", kind: "imagery" }] };
const others = [{ id: "acme", name: "Acme Corp", pinned: null, latest: "2.3.0" }, { id: "nordlys", name: "Nordlys", refused: "invalid_package: color.action.primary has no hex" }];

const HEX = /#[0-9a-fA-F]{6}\b/g;
const known = new Map(Object.entries(light).map(([p, v]) => [v.toLowerCase(), p]));
function checkBrand(paths) {
  const findings = [];
  const walk = (p, depth) => {
    let st; try { st = statSync(p); } catch { return; }
    if (st.isDirectory()) { if (depth > 4 || /node_modules|\.git/.test(p)) return; for (const f of readdirSync(p)) walk(join(p, f), depth + 1); return; }
    if (![".css", ".tsx", ".jsx", ".html", ".vue", ".svelte"].includes(extname(p))) return;
    readFileSync(p, "utf8").split("\n").forEach((line, i) => {
      for (const m of line.matchAll(HEX)) {
        const tok = known.get(m[0].toLowerCase());
        findings.push(tok ? { file: p, line: i + 1, column: m.index + 1, rule: "literal-equals-token", severity: "warning", message: `${m[0]} is a brand colour written literally`, fix: `var(--brand-${tok.replaceAll(".", "-")})` }
                          : { file: p, line: i + 1, column: m.index + 1, rule: "off-brand-colour", severity: "error", message: `${m[0]} is not a brand colour`, fix: "use a color.* token" });
      }
    });
  };
  for (const p of paths) walk(p, 0);
  if (findings.length === 0) return { fixture: true, findings: [
    { file: "src/components/Hero.tsx", line: 14, column: 22, rule: "off-brand-colour", severity: "error", message: "#3b82f6 is not a brand colour", fix: "bg-action-primary" },
    { file: "src/styles/app.css", line: 8, column: 10, rule: "literal-equals-token", severity: "warning", message: "#1f6aa6 is a brand colour written literally", fix: "var(--brand-color-action-primary)" },
    { file: "src/brand/brand.css", line: 1, column: 1, rule: "stale-generated-output", severity: "warning", message: "copied Generated Outputs are 1.0.0; brand-os.json pins 1.0.0, newest is 1.1.0", fix: "/brand-os:use-brand" } ] };
  return { fixture: false, findings };
}

const tools = [
  { name: "list_brands", description: "List reachable Brand Packages and the Active Brand.", inputSchema: { type: "object", properties: {} } },
  { name: "get_tokens", description: "Resolved tokens for one mode.", inputSchema: { type: "object", properties: { mode: { type: "string" } } } },
  { name: "get_asset", description: "An Asset by id and variant.", inputSchema: { type: "object", properties: { id: { type: "string" } } } },
  { name: "check_brand", description: "Brand Check on paths.", inputSchema: { type: "object", properties: { paths: { type: "array", items: { type: "string" } } } } },
];
const call = (name, args = {}) => {
  if (name === "list_brands") return { active: brand, brands: [brand, ...others] };
  if (name === "get_tokens") return { brand: "fjord", mode: args.mode ?? "light", tokens: tokens(args.mode ?? "light") };
  if (name === "get_asset") return { id: "logo", variant: "primary", mediaType: "image/svg+xml", svg: logo, rules: { minSizePx: 24, clearSpace: "0.5x height", backgrounds: ["color.surface.page", "color.surface.raised"] } };
  if (name === "check_brand") return checkBrand(args.paths ?? ["."]);
  throw new Error("unknown tool " + name);
};
const send = (m) => process.stdout.write(JSON.stringify(m) + "\n");
createInterface({ input: process.stdin }).on("line", (line) => {
  let msg; try { msg = JSON.parse(line); } catch { return; }
  if (msg.id === undefined) return;
  try {
    if (msg.method === "initialize") return send({ jsonrpc: "2.0", id: msg.id, result: { protocolVersion: msg.params?.protocolVersion ?? "2025-06-18", capabilities: { tools: {} }, serverInfo: { name: "brand-os-stub", version: "0.0.1" } } });
    if (msg.method === "tools/list") return send({ jsonrpc: "2.0", id: msg.id, result: { tools } });
    if (msg.method === "tools/call") return send({ jsonrpc: "2.0", id: msg.id, result: { content: [{ type: "text", text: JSON.stringify(call(msg.params.name, msg.params.arguments)) }] } });
    if (msg.method === "ping") return send({ jsonrpc: "2.0", id: msg.id, result: {} });
    send({ jsonrpc: "2.0", id: msg.id, error: { code: -32601, message: "method not found" } });
  } catch (err) { send({ jsonrpc: "2.0", id: msg.id, result: { isError: true, content: [{ type: "text", text: JSON.stringify({ code: "not_found", message: String(err.message) }) }] } }); }
});

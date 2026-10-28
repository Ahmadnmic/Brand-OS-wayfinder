// B: Candidate. --brand- prefix, hex, light/dark by OS preference with [data-mode] override,
// dark block lists only what changes, Tailwind theme points at the CSS variables, palette hidden from Tailwind.
import { makeConfig } from "../../brandos-build.mjs";
export default makeConfig({ prefix: "brand-", dark: "both", hex: true, darkDiffOnly: true, tailwind: "linked", hidePalette: true, lightAttr: true, clearDefaults: true, typeUtilities: true });

// A: Terrazzo-default-ish. No prefix, [data-mode] only, rgb() percent values, full dark block,
// Tailwind via the official plugin with copied values and a dark: variant, palette exposed.
import { makeConfig } from "../../brandos-build.mjs";
export default makeConfig({ prefix: "", dark: "attr", hex: false, darkDiffOnly: false, tailwind: "official" });

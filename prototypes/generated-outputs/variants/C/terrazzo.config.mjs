// C: Brand-id prefix (--fjord-), hex, OS preference only, dark diff-only, Tailwind via the official plugin
// with copied values, palette exposed.
import { makeConfig } from "../../brandos-build.mjs";
export default makeConfig({ prefix: "fjord-", dark: "media", hex: true, darkDiffOnly: true, tailwind: "official" });

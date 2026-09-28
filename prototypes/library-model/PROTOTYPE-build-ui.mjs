// PROTOTYPE, throwaway. Inlines data.json into the UI template so the page opens by double-click (file:// can't fetch JSON).
// Run: node PROTOTYPE-fetch-data.mjs && node PROTOTYPE-build-ui.mjs
import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
const here = dirname(fileURLToPath(import.meta.url));
const data = readFileSync(join(here, "data.json"), "utf8");
const tpl = readFileSync(join(here, "PROTOTYPE-ui.template.html"), "utf8");
writeFileSync(join(here, "PROTOTYPE-library-ui.html"), tpl.replace("/*DATA*/null", data));
console.log("wrote PROTOTYPE-library-ui.html");

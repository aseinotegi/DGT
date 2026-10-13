#!/usr/bin/env node
// Uso: node analizar.mjs <host-o-url> [--visible] [--espera-ms 5000]
import { analyzeSite } from "./lib.mjs";

const args = process.argv.slice(2);
const target = args.find((a) => !a.startsWith("--"));
if (!target) {
  console.error("Uso: node analizar.mjs <host-o-url> [--visible] [--espera-ms 5000]");
  process.exit(2);
}
const waitIdx = args.indexOf("--espera-ms");

try {
  const { dir, summary } = await analyzeSite(target, {
    headless: !args.includes("--visible"),
    loadMs: waitIdx >= 0 ? Number(args[waitIdx + 1]) : undefined,
    log: (m) => console.error(`[rea] ${m}`),
  });
  console.log(summary);
  console.error(`\nInforme completo: ${dir}`);
} catch (e) {
  console.error(`Error: ${e.message}`);
  process.exit(1);
}

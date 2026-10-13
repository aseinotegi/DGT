#!/usr/bin/env node
// Servidor local: abre http://127.0.0.1:8787, escribe un host y genera el informe.
// API: GET /api/analizar?url=ejemplo.com  -> JSON { dir, files, summary }
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { basename, join, normalize, sep } from "node:path";
import { analyzeSite, reportsDir } from "./lib.mjs";

const PORT = Number(process.env.PORT ?? 8787);
// Solo loopback: REA lanza un navegador y escribe en disco, no debe exponerse a la red.
const HOST = "127.0.0.1";
let busy = false;

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

const page = (body = "") => `<!doctype html><html lang="es"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>REA local</title>
<style>body{font-family:system-ui,sans-serif;max-width:960px;margin:2rem auto;padding:0 1rem;color:#222;background:#fafafa}
input{width:70%;padding:.6rem;font-size:1rem}button{padding:.6rem 1.2rem;font-size:1rem}
pre{white-space:pre-wrap;background:#fff;border:1px solid #ddd;padding:1rem;border-radius:6px}
img{max-width:100%;border:1px solid #ddd}</style></head><body>
<h1>REA · análisis de webs en local</h1>
<form action="/analizar" method="get"><input name="url" placeholder="ejemplo.com o https://ejemplo.com" required autofocus>
<label><input type="checkbox" name="visible" style="width:auto"> navegador visible</label>
<button>Analizar</button></form><p><small>Tarda ~20 s. Los informes se guardan en ${esc(reportsDir)}</small></p>${body}</body></html>`;

const send = (res, code, type, body) => {
  res.writeHead(code, { "content-type": type, "x-content-type-options": "nosniff" });
  res.end(body);
};

const run = async (url, visible) => {
  if (busy) throw Object.assign(new Error("Ya hay un análisis en curso, espera a que termine."), { code: 409 });
  busy = true;
  try {
    return await analyzeSite(url, { headless: !visible, log: (m) => console.log(`[rea] ${m}`) });
  } finally {
    busy = false;
  }
};

createServer(async (req, res) => {
  const u = new URL(req.url, `http://${HOST}:${PORT}`);
  try {
    if (u.pathname === "/") return send(res, 200, "text/html; charset=utf-8", page());

    if (u.pathname === "/api/analizar") {
      const r = await run(u.searchParams.get("url"), u.searchParams.has("visible"));
      return send(res, 200, "application/json", JSON.stringify(r, null, 2));
    }

    if (u.pathname === "/analizar") {
      const r = await run(u.searchParams.get("url"), u.searchParams.has("visible"));
      const rel = encodeURIComponent(basename(r.dir));
      const links = r.files.map((f) => `<a href="/informes/${rel}/${f}">${esc(f)}</a>`).join(" · ");
      const img = r.files.includes("captura.png") ? `<img src="/informes/${rel}/captura.png" alt="captura">` : "";
      return send(res, 200, "text/html; charset=utf-8",
        page(`<h2>Informe</h2><p>${links}</p>${img}<pre>${esc(r.summary)}</pre>`));
    }

    if (u.pathname.startsWith("/informes/")) {
      const file = normalize(join(reportsDir, decodeURIComponent(u.pathname.slice("/informes/".length))));
      if (!file.startsWith(reportsDir + sep)) return send(res, 403, "text/plain", "Prohibido");
      const type = file.endsWith(".png") ? "image/png" : file.endsWith(".json") ? "application/json"
        : "text/plain; charset=utf-8";
      return send(res, 200, type, await readFile(file));
    }

    send(res, 404, "text/plain", "No encontrado");
  } catch (e) {
    const code = e.code === 409 ? 409 : e.code === "ENOENT" ? 404 : 500;
    if (u.pathname.startsWith("/api/")) return send(res, code, "application/json", JSON.stringify({ error: e.message }));
    send(res, code, "text/html; charset=utf-8", page(`<p style="color:#b00"><b>Error:</b> ${esc(e.message)}</p>`));
  }
}).listen(PORT, HOST, () => console.log(`REA escuchando en http://${HOST}:${PORT}`));

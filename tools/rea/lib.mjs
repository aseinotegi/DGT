// Analisis de una web con REA: lanza Chrome/Edge con CDP solo en loopback,
// abre la URL, ejecuta los comandos de REA y guarda un informe en disco.
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const reaScript = join(
  dirname(createRequire(import.meta.url).resolve("rea-agents/package.json")),
  "scripts",
  "rea.mjs",
);

export const reportsDir = process.env.REA_INFORMES ?? join(here, "informes");

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Busca Chrome o Edge. REA_BROWSER tiene prioridad. */
export const findBrowser = () => {
  const env = process.env;
  const candidates = [
    env.REA_BROWSER,
    env.REA_BROWSER_EXECUTABLE,
    env.PROGRAMFILES && join(env.PROGRAMFILES, "Google/Chrome/Application/chrome.exe"),
    env["PROGRAMFILES(X86)"] && join(env["PROGRAMFILES(X86)"], "Google/Chrome/Application/chrome.exe"),
    env.LOCALAPPDATA && join(env.LOCALAPPDATA, "Google/Chrome/Application/chrome.exe"),
    env["PROGRAMFILES(X86)"] && join(env["PROGRAMFILES(X86)"], "Microsoft/Edge/Application/msedge.exe"),
    env.PROGRAMFILES && join(env.PROGRAMFILES, "Microsoft/Edge/Application/msedge.exe"),
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/usr/bin/google-chrome",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
  ].filter(Boolean);
  const found = candidates.find((p) => existsSync(p));
  if (!found)
    throw new Error("No encuentro Chrome ni Edge. Define REA_BROWSER con la ruta del ejecutable.");
  return found;
};

export const normalizeUrl = (input) => {
  const raw = String(input ?? "").trim();
  if (!raw) throw new Error("Falta el host o la URL.");
  const url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
  if (url.protocol !== "http:" && url.protocol !== "https:")
    throw new Error("Solo se admiten URLs http(s).");
  return url.href;
};

const getJson = async (url, init) => {
  const res = await fetch(url, init);
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  return res.json();
};

/** Envia un comando CDP por WebSocket y espera su respuesta. */
const cdp = (wsUrl, method, params = {}) =>
  new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl);
    const timer = setTimeout(() => (ws.close(), reject(new Error(`CDP ${method}: timeout`))), 10_000);
    ws.onopen = () => ws.send(JSON.stringify({ id: 1, method, params }));
    ws.onmessage = (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.id !== 1) return;
      clearTimeout(timer);
      ws.close();
      msg.error ? reject(new Error(msg.error.message)) : resolve(msg.result);
    };
    ws.onerror = () => (clearTimeout(timer), reject(new Error(`CDP ${method}: error de conexion`)));
  });

/** Ejecuta `rea <args> --format json` y devuelve el JSON (o el error de REA). */
const rea = (args) =>
  new Promise((resolve) => {
    const child = spawn(process.execPath, [reaScript, ...args, "--format", "json"], {
      stdio: ["ignore", "pipe", "pipe"],
    });
    let out = "";
    let err = "";
    child.stdout.on("data", (d) => (out += d));
    child.stderr.on("data", (d) => (err += d));
    child.on("close", () => {
      // REA puede emitir lineas de progreso antes del resultado: nos quedamos con la ultima.
      const last = out.trim().split(/\r?\n/).filter(Boolean).at(-1);
      try {
        resolve(JSON.parse(last));
      } catch {
        resolve({ error: "Salida de REA no valida", stdout: out.slice(-2000), stderr: err.slice(-2000) });
      }
    });
  });

const launchBrowser = async ({ browserPath, port, headless, url }) => {
  const profile = await mkdtemp(join(tmpdir(), "rea-perfil-"));
  const args = [
    `--remote-debugging-port=${port}`,
    "--remote-debugging-address=127.0.0.1",
    `--user-data-dir=${profile}`,
    "--no-first-run",
    "--no-default-browser-check",
    "--disable-extensions",
    "--window-size=1366,900",
    ...(headless ? ["--headless=new"] : []),
    ...(process.env.REA_BROWSER_NO_SANDBOX === "true" ? ["--no-sandbox"] : []),
    url,
  ];
  const child = spawn(browserPath, args, { stdio: "ignore" });
  const endpoint = `http://127.0.0.1:${port}`;
  for (let i = 0; i < 100; i++) {
    try {
      const version = await getJson(`${endpoint}/json/version`);
      return { child, profile, endpoint, browserWs: version.webSocketDebuggerUrl };
    } catch {
      await sleep(150);
    }
  }
  child.kill();
  throw new Error(`El navegador no abrio el puerto de depuracion ${port} (¿ya esta ocupado?).`);
};

const closeBrowser = async ({ child, profile, browserWs }) => {
  await cdp(browserWs, "Browser.close").catch(() => child.kill());
  await new Promise((r) => (child.exitCode !== null ? r() : child.once("exit", r)));
  // En Windows el perfil puede seguir bloqueado unos instantes.
  await rm(profile, { recursive: true, force: true, maxRetries: 10, retryDelay: 300 }).catch(() => {});
};

const waitForPage = async (endpoint, ms) => {
  const deadline = Date.now() + ms;
  let page;
  while (Date.now() < deadline) {
    const targets = await getJson(`${endpoint}/json/list`);
    page = targets.find((t) => t.type === "page" && /^https?:/.test(t.url));
    if (page) break;
    await sleep(250);
  }
  if (!page) throw new Error("La pagina no llego a cargar (¿host inalcanzable o error de certificado?).");
  return page;
};

const stamp = () => new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);

/**
 * Analiza una URL y guarda el informe en informes/<host>-<fecha>/.
 * Devuelve { dir, summary, files }.
 */
export const analyzeSite = async (input, opts = {}) => {
  const url = normalizeUrl(input);
  const {
    port = Number(process.env.REA_CDP_PORT ?? 9333),
    headless = true,
    loadMs = 5000,
    observationMs = 2000,
    log = () => {},
  } = opts;
  const dir = join(reportsDir, `${new URL(url).hostname}-${stamp()}`);
  await mkdir(dir, { recursive: true });

  log(`Abriendo navegador en ${url}`);
  const browserPath = findBrowser();
  const browser = await launchBrowser({ browserPath, port, headless, url });
  const results = {};
  try {
    const first = await waitForPage(browser.endpoint, 30_000);
    await sleep(loadMs);
    const page = (await getJson(`${browser.endpoint}/json/list`)).find((t) => t.id === first.id) ?? first;
    log(`Pagina cargada: ${page.url}`);

    log("Analizando bundle JavaScript (analyze-web-bundle)...");
    results.bundle = await rea([
      "analyze-web-bundle", browser.endpoint, page.id,
      "--observation-ms", "2000", "--fetch-source-maps",
    ]);

    log("Inspeccionando pagina (inspect-web-page)...");
    results.inspect = await rea([
      "inspect-web-page", browser.endpoint, page.id,
      "--observation-ms", String(observationMs),
      "--include-console-text", "--include-storage-keys", "--include-json-body-shapes",
    ]);

    log("Capturando pantalla...");
    results.screenshot = await rea(["capture-web-screenshot", browser.endpoint, page.id]);
  } finally {
    await closeBrowser(browser);
  }

  // inspect-web-page solo ve lo que pasa tras conectarse (y rechaza recargas),
  // asi que la red completa de la carga se captura con un escenario en el que
  // REA lanza su propio navegador y observa desde antes de navegar.
  log("Capturando trafico de red de la carga (capture-browser-scenario)...");
  // Se pasa como fichero: evita problemas de comillas en la linea de comandos de Windows.
  const scenarioFile = join(dir, "escenario.json");
  await writeFile(
    scenarioFile,
    JSON.stringify(
      {
        browser: { mode: "launch", executable_path: browserPath, headless },
        start_url: { url },
        actions: [{ step_id: "carga", action: "wait_for_timeout", duration_ms: loadMs }],
        capture: { events: ["network", "console", "page-errors"] },
      },
      null,
      2,
    ),
  );
  results.red = await rea(["capture-browser-scenario", scenarioFile]);

  const files = [];
  for (const [name, data] of Object.entries(results)) {
    await writeFile(join(dir, `${name}.json`), JSON.stringify(data, null, 2));
    files.push(`${name}.json`);
  }
  const png = results.screenshot?.normalized_result?.artifact?.data_base64;
  if (png) {
    await writeFile(join(dir, "captura.png"), Buffer.from(png, "base64"));
    files.push("captura.png");
  }
  const summary = buildSummary(url, results, Boolean(png));
  await writeFile(join(dir, "resumen.md"), summary);
  files.unshift("resumen.md");
  log(`Informe guardado en ${dir}`);
  return { dir, summary, files };
};

const list = (items, fmt, max = 40) =>
  items.length
    ? items.slice(0, max).map((x) => `- ${fmt(x)}`).join("\n") +
      (items.length > max ? `\n- … y ${items.length - max} mas (ver JSON)` : "")
    : "- (ninguno)";

const errorLine = (r) =>
  r?.error
    ? `> Error de REA: ${r.error}${r.details?.reason ? ` (${r.details.reason})` : ""}` +
      (r.details?.reason === "target_not_allowed"
        ? " — la pagina no cargo (¿http vs https, certificado, host caido?) o salto a otro origen."
        : "") +
      "\n"
    : "";

export const buildSummary = (url, { bundle, inspect, red }, hasPng) => {
  const b = bundle?.normalized_result;
  const i = inspect?.normalized_result;
  const scripts = i?.scripts?.items ?? [];
  const events = red?.normalized_result?.events?.items ?? [];
  // Une peticion y respuesta por transaction_id.
  const tx = new Map();
  for (const e of events) {
    if (!e.transaction_id) continue;
    const t = tx.get(e.transaction_id) ?? {};
    if (e.kind === "request") Object.assign(t, { method: e.method, url: e.url?.url, type: e.resource_type });
    if (e.kind === "response") t.status = e.status;
    if (e.failure) t.status = `fallo: ${e.failure.error_text ?? e.failure.reason ?? JSON.stringify(e.failure)}`;
    tx.set(e.transaction_id, t);
  }
  const requests = [...tx.values()].filter((t) => t.url);
  const consoleEvents = events.filter((e) => e.kind === "console");
  const pageErrors = events.filter((e) => e.kind === "page-error" || e.kind === "page_error");
  const resources = i?.resources ?? [];
  const obs = b?.observations ?? {};
  const origins = [
    ...new Set([...scripts, ...resources].map((x) => x.origin).concat(requests.map((r) => new URL(r.url).origin)).filter(Boolean)),
  ];
  return `# Analisis REA de ${url}

Fecha: ${new Date().toISOString()}
${i?.target ? `Pagina final: ${i.target.url} — "${i.target.title}"` : ""}

## Inspeccion de pagina
${errorLine(inspect)}- Nodos DOM: ${i?.dom?.total_nodes ?? "?"}
- Scripts: ${i?.scripts?.total ?? "?"}
- Recursos: ${resources.length}
- Peticiones de red en la carga: ${requests.length}
- WebSockets: ${i?.network?.websocket_connections?.length ?? 0}
- Mensajes de consola en la carga: ${consoleEvents.length}
- Errores JavaScript en la carga: ${pageErrors.length}
- Workers: ${i?.workers?.length ?? i?.workers?.items?.length ?? 0}
- Completitud: ${i?.completeness?.status ?? "?"}

### Origenes de terceros y propios
${list(origins, (o) => o)}

### Scripts
${list(scripts, (s) => `${s.url || "(inline)"} — ${s.length} chars${s.is_module ? ", modulo" : ""}`)}

### Peticiones de red
${errorLine(red)}${list(requests, (r) => `${r.method} ${r.url} — ${r.type ?? "?"} — ${r.status ?? "sin respuesta"}`, 80)}

### Consola y errores JavaScript
${list([...pageErrors, ...consoleEvents], (e) => `[${e.kind === "console" ? e.level : "error"}] ${String(e.text ?? e.message ?? JSON.stringify(e)).slice(0, 200)}`, 30)}

## Analisis estatico del bundle
${errorLine(bundle)}- Scripts analizados: ${b?.capture?.scripts_analyzed ?? "?"}
- Chunks: ${obs.chunks?.nodes?.length ?? 0} (dependencias: ${obs.chunks?.edges?.length ?? 0})
- Source maps: ${obs.source_maps?.status ?? "?"} (${obs.source_maps?.processed ?? 0} procesados)
- Completitud: ${b?.completeness?.status ?? "?"}

### Endpoints candidatos
${list(obs.endpoints ?? [], (e) => e.value ?? e.url ?? e.path ?? JSON.stringify(e).slice(0, 160))}

### Rutas candidatas
${list(obs.routes ?? [], (r) => r.value ?? r.path ?? JSON.stringify(r).slice(0, 160))}

### Librerias y frameworks detectados
${list(b?.inferences ?? [], (x) => `${x.value} (${x.kind}, confianza ${x.confidence})`)}

### Declaraciones WebMCP
${list(obs.webmcp_declarations ?? [], (w) => w.name ?? JSON.stringify(w).slice(0, 160))}

## Limitaciones
${list([...(b?.limitations ?? []), ...(i?.limitations ?? [])], (l) => l)}

${hasPng ? "![captura](captura.png)\n" : ""}
Detalle completo en bundle.json, inspect.json, red.json y screenshot.json.
`;
};

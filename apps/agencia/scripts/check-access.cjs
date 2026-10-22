// Prueba técnica sin cuentas ni red: ejecuta la página y el layout reales con
// la sesión real de @nexo/auth (sesion.ts: contextoActual, sesionActual,
// misPermisos) y el motor real de @nexo/permissions (getPermisos →
// mis_permisos, con respaldo has_permission). Solo se sustituyen el cliente
// de Supabase, la URL del panel, la marca y los componentes visuales.
/* eslint-disable @typescript-eslint/no-require-imports -- Este arnés CommonJS carga la página TS real con dependencias aisladas. */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const ts = require("typescript");
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");

const appRoot = path.resolve(__dirname, "..");
const originalLoad = Module._load;
const originalResolve = Module._resolveFilename;
const COMPANY = "test-company";
process.env.NEXO_COMPANY_ID = COMPANY; // lo lee getCompanyId() de @nexo/auth

let grants = {};
let rpcError = false;
/** Simula una base sin public.mis_permisos (PGRST202): getPermisos cae a has_permission. */
let sinMisPermisos = false;
/** mis_permisos responde sin error pero con data null. */
let respuestaNula = false;
/** Listas pedidas a mis_permisos (códigos ordenados), para comprobar que layout y página piden la misma. */
let listasPedidas = [];

function falla(codigos) {
  return rpcError === true || (rpcError instanceof Set && codigos.some((c) => rpcError.has(c)));
}

const supabase = {
  auth: { getUser: async () => ({ data: { user: { email: "consulta@example.test" } } }) },
  rpc: (fn, args) => {
    assert.equal(args.p_company_id, COMPANY);
    if (fn === "mis_permisos") {
      const codigos = args.p_codigos;
      listasPedidas.push([...codigos].sort().join(","));
      if (sinMisPermisos) {
        return Promise.resolve({ data: null, error: { code: "PGRST202", message: "Could not find the function" } });
      }
      if (falla(codigos)) return Promise.resolve({ data: null, error: new Error("RPC unavailable") });
      if (respuestaNula) return Promise.resolve({ data: null, error: null });
      // Como la RPC real: devuelve solo los códigos concedidos (true estricto).
      return Promise.resolve({ data: codigos.filter((c) => grants[c] === true), error: null });
    }
    assert.equal(fn, "has_permission");
    const { p_code } = args;
    return Promise.resolve({
      data: Object.hasOwn(grants, p_code) ? grants[p_code] : false,
      error: falla([p_code]) ? new Error("RPC unavailable") : null,
    });
  },
};

// getPermisos registra sus fallas con console.error/console.warn: se guardan
// para no ensuciar la salida; el resto de los mensajes pasa igual.
const avisosDePermisos = [];
for (const nivel of ["error", "warn"]) {
  const original = console[nivel].bind(console);
  console[nivel] = (...args) => {
    if (typeof args[0] === "string" && args[0].startsWith("getPermisos")) avisosDePermisos.push(args);
    else original(...args);
  };
}

for (const extension of [".ts", ".tsx"]) {
  require.extensions[extension] = (module, filename) => {
    const { outputText } = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
      // target moderno: con el ES5 por defecto, `[...new Set(x)]` (sesion.ts,
      // getPermisos) se transpila a un arreglo VACÍO y todo quedaría denegado.
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
        jsx: ts.JsxEmit.ReactJSX,
        esModuleInterop: true,
      },
    });
    module._compile(outputText, filename);
  };
}
Module._resolveFilename = function (request, parent, ...args) {
  if (request.startsWith("@/")) request = path.join(appRoot, "src", request.slice(2));
  return originalResolve.call(this, request, parent, ...args);
};
Module._load = function (request, parent, ...args) {
  // @nexo/supabase usa next/headers: se reemplaza solo el cliente de servidor.
  if (request === "@nexo/supabase") return { createServerClient: async () => supabase };
  if (request === "@nexo/auth") return auth;
  if (request === "@nexo/ui") {
    return {
      PageHeader: ({ title, description }) => React.createElement("header", null, title, description),
      MetricCard: ({ label, value }) => React.createElement("div", { "data-metric": label }, value),
      EmptyState: ({ title, description }) => React.createElement("div", { "data-empty": true }, title, description),
      StatusBadge: ({ children }) => React.createElement("span", null, children),
      NexoShell: ({ children }) => React.createElement("main", { "data-shell": true }, children),
    };
  }
  return originalLoad.call(this, request, parent, ...args);
};

// @nexo/auth importa "server-only", que no carga fuera del servidor de Next:
// se arma con su sesion.ts REAL más dobles de lo que depende de la petición.
const sesionReal = require(path.join(appRoot, "node_modules", "@nexo", "auth", "sesion.ts"));
const auth = {
  ...sesionReal,
  getCompanyId: () => COMPANY,
  getPanelUrl: async () => "https://nexo.example.test",
  getPlatformSettings: async () => ({ copyrightText: "© Prueba", logoUrl: null, faviconUrl: null }),
  signOut: async () => {},
};

const Page = require("../src/app/(app)/dashboard/page.tsx").default;
const Home = require("../src/app/page.tsx").default;
const AppLayout = require("../src/app/(app)/layout.tsx").default;
const { getURLFromRedirectError } = require("next/dist/client/components/redirect");
const { addPathPrefix } = require("next/dist/shared/lib/router/utils/add-path-prefix");
const { basePath } = require("../next.config.ts").default;
assert.equal(basePath, "/agencia");
const modulePermission = "agencia.ver_modulo";
const resourcePermission = "agencia.dashboard.resumen.ver";

function preparar({ moduleGranted, resourceGranted, error = false, fallback = false, nula = false }) {
  grants = { [modulePermission]: moduleGranted, [resourcePermission]: resourceGranted };
  rpcError = error;
  sinMisPermisos = fallback;
  respuestaNula = nula;
}

async function check(label, moduleGranted, resourceGranted, error, allowed, opciones = {}) {
  preparar({ moduleGranted, resourceGranted, error, ...opciones });
  const html = renderToStaticMarkup(await Page());
  if (allowed) {
    assert.match(html, /data-metric/);
    assert.match(html, /role="note"/);
    assert.match(html, /Tickets asignados/);
    assert.doesNotMatch(html, /Sin acceso a este Dashboard/);
  } else {
    assert.match(html, /Sin acceso a este Dashboard/);
    assert.doesNotMatch(html, /data-metric|role="note"|Tickets asignados/);
    // Nunca se muestra el código de un permiso.
    assert.doesNotMatch(html, /agencia\.[a-z_.]+/);
  }
  console.log("OK:", label);
}

async function checkRedirect(label, run, expected) {
  let target;
  try {
    await run();
  } catch (error) {
    // Misma función de Next 16 usada por app-render al escribir Location.
    target = addPathPrefix(getURLFromRedirectError(error), basePath);
  }
  assert.equal(target, expected);
  console.log("OK:", label);
}

(async () => {
  // Camino normal: una consulta en lote (public.mis_permisos).
  await check("módulo y consulta concedidos", true, true, false, true);
  await check("sin permiso de módulo", false, true, false, false);
  await check("sin permiso de consulta", true, false, false, false);
  await check("ningún permiso", false, false, false, false);
  await check("error de RPC deniega", true, true, true, false);
  await check("error solo en permiso de módulo", true, true, new Set([modulePermission]), false);
  await check("error solo en permiso de consulta", true, true, new Set([resourcePermission]), false);
  await check("permiso nulo deniega", true, null, false, false);
  await check("respuesta nula de mis_permisos deniega", true, true, false, false, { nula: true });

  // Base sin mis_permisos: getPermisos cae a has_permission por código.
  await check("respaldo has_permission: concedidos", true, true, false, true, { fallback: true });
  await check("respaldo has_permission: sin permiso de consulta", true, false, false, false, { fallback: true });
  await check("respaldo has_permission: error deniega", true, true, new Set([modulePermission]), false, { fallback: true });
  await check("respaldo has_permission: permiso nulo deniega", true, null, false, false, { fallback: true });

  await checkRedirect("raíz sin duplicar basePath", () => Home(), "/agencia/dashboard");
  preparar({});
  grants = {};
  await checkRedirect("denegación sin duplicar basePath", () => AppLayout({ children: null }), "/agencia/sin-acceso");

  preparar({ moduleGranted: true, resourceGranted: true });
  listasPedidas = [];
  const layoutHtml = renderToStaticMarkup(await AppLayout({ children: "Contenido autorizado" }));
  assert.match(layoutHtml, /data-shell/);
  assert.match(layoutHtml, /Contenido autorizado/);
  console.log("OK: layout autorizado muestra contenido");

  // Layout y página piden la MISMA lista: en Next, misPermisos (cache de React
  // por request) la resuelve con una sola consulta. Aquí, fuera del servidor
  // de Next, no hay caché por request y se ven las dos llamadas.
  renderToStaticMarkup(await Page());
  assert.equal(listasPedidas.length, 2);
  assert.equal(new Set(listasPedidas).size, 1);
  assert.equal(listasPedidas[0], [modulePermission, resourcePermission].sort().join(","));
  console.log("OK: layout y página piden la misma lista de permisos");

  preparar({ moduleGranted: true, resourceGranted: true, error: true });
  await checkRedirect("error RPC en layout deniega", () => AppLayout({ children: null }), "/agencia/sin-acceso");
  assert.ok(avisosDePermisos.length > 0, "getPermisos debe registrar las fallas de la RPC");
})().catch((error) => {
  console.error(error);
  // Las fallas de getPermisos registradas hasta aquí ayudan a ver por qué se denegó.
  for (const args of avisosDePermisos) console.log("  [registro]", ...args);
  process.exitCode = 1;
});

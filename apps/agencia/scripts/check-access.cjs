// Prueba técnica sin cuentas ni red: ejecuta la página real y el wrapper
// compartido de permisos. Los componentes visuales se sustituyen por HTML.
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
let grants = {};
let rpcError = false;
const supabase = {
  rpc: async (fn, { p_code, p_company_id }) => {
    assert.equal(fn, "has_permission");
    assert.equal(p_company_id, "test-company");
    const failed = rpcError === true || (rpcError instanceof Set && rpcError.has(p_code));
    return {
      data: Object.hasOwn(grants, p_code) ? grants[p_code] : false,
      error: failed ? new Error("RPC unavailable") : null,
    };
  },
};

for (const extension of [".ts", ".tsx"]) {
  require.extensions[extension] = (module, filename) => {
    const { outputText } = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
    });
    module._compile(outputText, filename);
  };
}
Module._resolveFilename = function (request, parent, ...args) {
  if (request.startsWith("@/")) request = path.join(appRoot, "src", request.slice(2));
  return originalResolve.call(this, request, parent, ...args);
};
Module._load = function (request, parent, ...args) {
  if (request === "@/lib/supabase/server") return { createClient: async () => supabase };
  if (request === "@/lib/company") return { getCompanyId: () => "test-company" };
  if (request === "@nexo/ui") {
    return {
      PageHeader: ({ title, description }) => React.createElement("header", null, title, description),
      MetricCard: ({ label, value }) => React.createElement("div", { "data-metric": label }, value),
      EmptyState: ({ title, description }) => React.createElement("div", { "data-empty": true }, title, description),
      StatusBadge: ({ children }) => React.createElement("span", null, children),
    };
  }
  return originalLoad.call(this, request, parent, ...args);
};

const Page = require("../src/app/(app)/dashboard/page.tsx").default;
const Home = require("../src/app/page.tsx").default;
const AppLayout = require("../src/app/(app)/layout.tsx").default;
const { getURLFromRedirectError } = require("next/dist/client/components/redirect");
const { addPathPrefix } = require("next/dist/shared/lib/router/utils/add-path-prefix");
const modulePermission = "agencia.ver_modulo";
const resourcePermission = "agencia.dashboard.resumen.ver";
async function check(label, moduleGranted, resourceGranted, error, allowed) {
  grants = { [modulePermission]: moduleGranted, [resourcePermission]: resourceGranted };
  rpcError = error;
  const html = renderToStaticMarkup(await Page());
  if (allowed) {
    assert.match(html, /data-metric/);
    assert.match(html, /role="note"/);
    assert.match(html, /Tickets asignados/);
    assert.doesNotMatch(html, /Sin acceso a este Dashboard/);
  } else {
    assert.match(html, /Sin acceso a este Dashboard/);
    assert.doesNotMatch(html, /data-metric|role="note"|Tickets asignados/);
  }
  console.log("OK:", label);
}

async function checkRedirect(label, run, expected) {
  let target;
  try {
    await run();
  } catch (error) {
    // Misma función de Next 16 usada por app-render al escribir Location.
    target = addPathPrefix(getURLFromRedirectError(error), "/agencia");
  }
  assert.equal(target, expected);
  console.log("OK:", label);
}

(async () => {
  await check("módulo y consulta concedidos", true, true, false, true);
  await check("sin permiso de módulo", false, true, false, false);
  await check("sin permiso de consulta", true, false, false, false);
  await check("ningún permiso", false, false, false, false);
  await check("error de RPC deniega", true, true, true, false);
  await check("error solo en permiso de módulo", true, true, new Set([modulePermission]), false);
  await check("error solo en permiso de consulta", true, true, new Set([resourcePermission]), false);
  await check("permiso nulo deniega", true, null, false, false);
  await checkRedirect("raíz sin duplicar basePath", () => Home(), "/agencia/dashboard");
  grants = {};
  rpcError = false;
  await checkRedirect("denegación sin duplicar basePath", () => AppLayout({ children: null }), "/agencia/sin-acceso");
})().catch((error) => { console.error(error); process.exitCode = 1; });

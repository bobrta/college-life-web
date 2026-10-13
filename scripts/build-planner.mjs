import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
// Each source keeps its own scope. Flattening declarations caused collisions
// when two modules exported a helper with the same name (for example minutes).
const modules = new Map(),
  visiting = new Set(),
  sources = [];
const dependencyPattern =
  /^(import|export)\s+\{([\s\S]*?)\}\s+from\s*['"]([^'"]+)['"];?$/gm;
function bindings(text) {
  return text
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean)
    .map((x) => {
      const [source, alias = source] = x.split(/\s+as\s+/);
      if (
        !/^[A-Za-z_$][\w$]*$/.test(source) ||
        !/^[A-Za-z_$][\w$]*$/.test(alias)
      )
        throw Error("不支援的模組名稱");
      return { source, alias };
    });
}
async function visit(path) {
  if (visiting.has(path)) throw Error("單檔版本不支援循環模組依賴");
  if (modules.has(path)) return modules.get(path);
  visiting.add(path);
  let code = await readFile(path, "utf8");
  const dependencies = [...code.matchAll(dependencyPattern)],
    exports = [];
  for (const match of dependencies) {
    if (!match[3].startsWith(".")) throw Error("單檔版本只接受本地模組");
    const id = await visit(resolve(dirname(path), match[3]));
    const names = bindings(match[2]);
    if (match[1] === "import")
      code = code.replace(
        match[0],
        `const {${names.map((n) => (n.source === n.alias ? n.source : n.source + ":" + n.alias)).join(",")}}=__modules[${id}];`,
      );
    else {
      code = code.replace(match[0], "");
      exports.push(
        ...names.map((n) => `${n.alias}:__modules[${id}].${n.source}`),
      );
    }
  }
  code = code.replace(
    /\bexport\s+((?:async\s+)?(?:function|const|let|class))\s+([A-Za-z_$][\w$]*)/g,
    (_, kind, name) => {
      exports.push(name);
      return kind + " " + name;
    },
  );
  code = code.replace(/^export\s+\{([^}]+)\};?$/gm, (_, names) => {
    exports.push(...bindings(names).map((n) => n.alias + ":" + n.source));
    return "";
  });
  if (/^\s*(?:import|export)\s/m.test(code))
    throw Error("尚未處理的模組語法：" + path);
  const id = sources.length;
  modules.set(path, id);
  visiting.delete(path);
  sources.push(
    `__modules[${id}]=(()=>{\n${code}\nreturn {${exports.join(",")}};\n})();`,
  );
  return id;
}
await visit(resolve(root, "planner-ui.mjs"));
const js = "const __modules=[];\n" + sources.join("\n");
if (/<\/script/i.test(js)) throw Error("腳本包含不可內嵌的結束標記");
let html = await readFile(resolve(root, "planner.html"), "utf8");
const css = await readFile(resolve(root, "planner.css"), "utf8");
html = html.replace(
  /<link\s+rel="stylesheet"\s+href="planner.css"\s*\/?\s*>/,
  () => "<style>" + css + "</style>",
);
html = html.replace(
  /<script\s+type="module"\s+src="planner-ui.mjs"\s*>\s*<\/script>/,
  () => '<script type="module">' + js + "</script>",
);
html = html.replace(
  'href="index.html"',
  'href="https://bobrta.github.io/college-life-web/"',
);
if (
  html.includes('src="planner-ui.mjs"') ||
  html.includes('href="planner.css"')
)
  throw Error("單檔打包失敗");
await writeFile(resolve(root, "時間規劃_單檔版.html"), html);
console.log(
  "單檔版本已更新；" +
    modules.size +
    " 個模組，" +
    Buffer.byteLength(html) +
    " bytes",
);

import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const visited = new Set(),
  sources = [];
async function visit(path) {
  if (visited.has(path)) return;
  visited.add(path);
  let code = await readFile(path, "utf8");
  const dependencies = [
    ...code.matchAll(
      /^(?:import\s+[\s\S]*?from|export\s+\{[\s\S]*?\}\s+from)\s*['"]([^'"]+)['"];?$/gm,
    ),
  ];
  for (const match of dependencies) {
    if (!match[1].startsWith(".")) throw Error("單檔版本只接受本地模組");
    await visit(resolve(dirname(path), match[1]));
  }
  code = code
    .replace(
      /^(?:import\s+[\s\S]*?from|export\s+\{[\s\S]*?\}\s+from)\s*['"][^'"]+['"];?\s*$/gm,
      "",
    )
    .replace(/\bexport\s+(?=(?:async\s+)?(?:function|const|let|class)\b)/g, "");
  sources.push(code);
}
await visit(resolve(root, "planner-ui.mjs"));
const js = sources.join("\n");
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
    visited.size +
    " 個模組，" +
    Buffer.byteLength(html) +
    " bytes",
);

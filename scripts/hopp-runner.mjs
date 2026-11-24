import fs from "node:fs";
import vm from "node:vm";

const col = JSON.parse(fs.readFileSync("./hoppscotch-collection.json", "utf8"));
const env = JSON.parse(fs.readFileSync("./hoppscotch-env.json", "utf8"));
const vars = Object.fromEntries(env.variables.map(v => [v.key, v.value]));
const resolve = str => str.replace(/<<([^>]+)>>/g, (_, k) => vars[k] ?? "");

let failed = 0;
for (const req of col.requests) {
  const url = resolve(req.endpoint);
  const headers = Object.fromEntries(req.headers.filter(h => h.active).map(h => [h.key, resolve(h.value)]));
  const res = await fetch(url, { method: req.method, headers });
  const body = await res.json();
  console.log(`\nâ–¶ ${req.name} (${req.method} ${url}) -> ${res.status}`);

  const pw = {
    response: { status: res.status, body },
    test(name, fn) {
      try { fn(); console.log(`  âœ“ ${name}`); }
      catch (e) { failed++; console.error(`  âœ— ${name}: ${e.message}`); }
    },
    expect(actual) {
      return {
        toBe(expected) {
          if (actual !== expected) throw new Error(`Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
        }
      };
    }
  };
  vm.runInNewContext(req.testScript, { pw });
}
process.exitCode = failed ? 1 : 0;

// Service-worker regression tests. Run from the hours-app folder: node --test  (no dependencies)
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const SW_SOURCE = readFileSync(new URL("../sw.js", import.meta.url), "utf8");

// bitrazor.github.io serves several apps (/hours-app/, /meal-week/, /training/, ...) on ONE origin, and
// Cache Storage is per-origin, so this worker's caches.keys() also lists the other apps' offline caches.
// Run the REAL sw.js against a fake Cache Storage and record, in order, what it deletes and when it claims.
function runWorker(cacheNames) {
  const handlers = {};
  const log = [];
  const stored = new Set(cacheNames);
  vm.runInNewContext(SW_SOURCE, {
    self: {
      addEventListener: (type, fn) => { handlers[type] = fn; },
      skipWaiting: async () => {},
      clients: { claim: async () => { log.push("claim"); } }
    },
    caches: {
      keys: async () => [...stored],
      open: async name => { stored.add(name); return { addAll: async () => {} }; },
      // settles on a LATER tick and logs only then, so a delete nobody waits for shows up out of order
      delete: name => new Promise(resolve => setTimeout(() => {
        log.push("deleted " + name);
        resolve(stored.delete(name));
      }, 0))
    }
  });
  return { handlers, log, stored };
}

async function fire(handlers, type) {
  const work = [];
  handlers[type]({ waitUntil: p => { work.push(p); } });
  assert.equal(work.length, 1, `the ${type} handler hands its work to waitUntil`);
  await work[0];
}

// The cache the worker installs into, read from its behaviour so a version bump keeps these tests valid.
async function currentCache() {
  const { handlers, stored } = runWorker([]);
  await fire(handlers, "install");
  assert.equal(stored.size, 1, "install opens exactly one cache");
  const name = [...stored][0];
  assert.match(name, /^hours-/, "the hours app's cache names start with hours-");
  return name;
}

const OTHER_APPS = ["training-2026-07-04c", "training-2026-10-01", "meal-week-1-c7a8e463", "meal-week-1-a83d7f41"];

test("activate deletes only the hours app's own old caches; the other apps on the site keep theirs", async () => {
  const current = await currentCache();
  // an older version, and a rolled-back newer one whose name STARTS with the current name ("hours-v10")
  const ownOld = ["hours-v0", current + "0"];
  assert.ok(!ownOld.includes(current));
  const { handlers, log, stored } = runWorker([...OTHER_APPS, ...ownOld, current]);
  await fire(handlers, "activate");
  assert.deepEqual(log.filter(e => e.startsWith("deleted ")), ownOld.map(n => "deleted " + n));
  assert.deepEqual([...stored].sort(), [...OTHER_APPS, current].sort());
});

test("activate leaves lookalike names alone (hours- must START the name, dash and case exact)", async () => {
  const current = await currentCache();
  const lookalikes = ["hoursheet-v1", "old-hours-v0", "Hours-v0", "hours"];
  const { handlers, log, stored } = runWorker([...lookalikes, "hours-v0", current]);
  await fire(handlers, "activate");
  assert.deepEqual(log.filter(e => e.startsWith("deleted ")), ["deleted hours-v0"]);
  assert.deepEqual([...stored].sort(), [...lookalikes, current].sort());
});

test("activate finishes the cleanup before it takes control of open pages (clients.claim)", async () => {
  const current = await currentCache();
  const { handlers, log } = runWorker(["hours-v0", "hours-beta", current]);
  await fire(handlers, "activate");
  // exact order, read the moment waitUntil settles: both deletes done, then exactly one claim
  assert.deepEqual(log, ["deleted hours-v0", "deleted hours-beta", "claim"]);
});

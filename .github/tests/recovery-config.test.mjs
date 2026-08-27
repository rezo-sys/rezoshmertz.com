import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const read = (relativePath) => readFileSync(resolve(repositoryRoot, relativePath), "utf8");

test("daily snapshots are immutable and retain a downloadable archive for 60 days", () => {
  const workflow = read(".github/workflows/daily-snapshot.yml");

  assert.match(workflow, /cron: ['"]17 1 \* \* \*['"]/);
  assert.match(workflow, /workflow_dispatch:/);
  assert.match(workflow, /permissions:\s*\n\s+contents: write/);
  assert.match(workflow, /snapshot-\$\{snapshot_date\}/);
  assert.match(workflow, /git rev-parse -q --verify "refs\/tags\/\$\{snapshot_tag\}"/);
  assert.match(workflow, /git tag -a "\$\{snapshot_tag\}"/);
  assert.match(workflow, /git push origin "refs\/tags\/\$\{snapshot_tag\}"/);
  assert.match(workflow, /actions\/upload-artifact@v4/);
  assert.match(workflow, /retention-days: 60/);
});

test("snapshot restore validates the tag and creates an ordinary commit without rewriting history", () => {
  const workflow = read(".github/workflows/restore-snapshot.yml");

  assert.match(workflow, /snapshot_tag:/);
  assert.match(workflow, /apply:/);
  assert.match(workflow, /\^snapshot-\[0-9\]\{4\}-\[0-9\]\{2\}-\[0-9\]\{2\}\$/);
  assert.match(workflow, /git rev-parse -q --verify "refs\/tags\/\$\{snapshot_tag\}\^\{commit\}"/);
  assert.match(workflow, /git commit -m "Restore website to \$\{snapshot_tag\}"/);
  assert.match(workflow, /git push origin HEAD:main/);
  assert.doesNotMatch(workflow, /git push[^\n]*--force/);
  assert.match(workflow, /actions\/upload-artifact@v4/);
  assert.match(workflow, /retention-days: 60/);
});

test("vendor guide grants autonomous publishing while preserving access boundaries", () => {
  const guide = read("VENDOR-HANDOFF.md");

  assert.match(guide, /push directly to `main`/i);
  assert.match(guide, /without waiting for Rezo/i);
  assert.match(guide, /force-push/i);
  assert.match(guide, /Daily website snapshot/);
  assert.match(guide, /Restore website snapshot/);
  assert.match(guide, /60 days/i);
  assert.match(guide, /GoDaddy access is not included/i);
  assert.match(guide, /Firebase administration access is not included/i);
});

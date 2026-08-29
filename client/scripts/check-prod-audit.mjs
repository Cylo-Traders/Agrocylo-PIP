#!/usr/bin/env node
// Fails CI on any high/critical `npm audit --omit=dev` finding whose advisory
// is not present in audit-allowlist.json. New advisories always fail the
// build; deferring one requires adding a reviewed, reasoned entry to the
// allowlist rather than silencing the check.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const serverDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const allowlist = JSON.parse(
  readFileSync(path.join(serverDir, 'audit-allowlist.json'), 'utf8'),
).exceptions;
const allowedIds = new Set(allowlist.map((entry) => entry.id));

let report;
try {
  const out = execFileSync('npm', ['audit', '--omit=dev', '--json'], {
    cwd: serverDir,
    encoding: 'utf8',
  });
  report = JSON.parse(out);
} catch (err) {
  // npm audit exits non-zero when it finds vulnerabilities; stdout still has the report.
  report = JSON.parse(err.stdout);
}

const failures = [];
const allowed = [];

for (const vuln of Object.values(report.vulnerabilities ?? {})) {
  if (vuln.severity !== 'high' && vuln.severity !== 'critical') continue;
  for (const via of vuln.via) {
    if (typeof via !== 'object') continue;
    if (via.severity !== 'high' && via.severity !== 'critical') continue;
    const id = via.url?.split('/').pop();
    if (id && allowedIds.has(id)) {
      allowed.push(`${id} (${via.name ?? vuln.name})`);
    } else {
      failures.push(
        `${via.severity.toUpperCase()} ${vuln.name}: ${via.title ?? id} (${via.url ?? 'no advisory url'})`,
      );
    }
  }
}

if (allowed.length) {
  console.log(
    'Known, allowlisted production advisories (see audit-allowlist.json):',
  );
  for (const a of [...new Set(allowed)]) console.log(`  - ${a}`);
}

if (failures.length) {
  console.error(
    '\nUnallowlisted high/critical production-dependency vulnerabilities found:',
  );
  for (const f of [...new Set(failures)]) console.error(`  - ${f}`);
  console.error(
    '\nFix them, or add a reviewed entry with a reason to server/audit-allowlist.json.',
  );
  process.exit(1);
}

console.log(
  '\nNo unallowlisted high/critical production-dependency vulnerabilities.',
);

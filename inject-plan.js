#!/usr/bin/env node
/**
 * inject-plan.js — Our Table weekly plan injector
 *
 * Usage:
 *   node inject-plan.js                  (looks for pending-plan.json in same folder)
 *   node inject-plan.js path/to/plan.json (explicit path)
 *
 * What it does:
 *   1. Reads + validates the plan JSON
 *   2. Replaces `const PLAN={...};` in index.html with the new plan
 *   3. Reports the week and all 7 dinners so you can confirm before pushing
 *   4. Backs up index.html to index.html.bak first
 *   5. Does NOT delete the plan file — you delete it once you've verified the deploy
 */

const fs   = require('fs');
const path = require('path');

const ROOT = __dirname;
const HTML = path.join(ROOT, 'index.html');

// ── 1. Find the plan file ────────────────────────────────────────────────────
const planArg  = process.argv[2];
const planPath = planArg
  ? path.resolve(planArg)
  : path.join(ROOT, 'pending-plan.json');

if (!fs.existsSync(planPath)) {
  console.error(`\n❌  Plan file not found: ${planPath}`);
  console.error('    Drop pending-plan.json in this folder, or pass the path as an argument.\n');
  process.exit(1);
}

if (!fs.existsSync(HTML)) {
  console.error(`\n❌  index.html not found at: ${HTML}\n`);
  process.exit(1);
}

// ── 2. Parse + validate ──────────────────────────────────────────────────────
let plan;
try {
  plan = JSON.parse(fs.readFileSync(planPath, 'utf8'));
} catch (e) {
  console.error(`\n❌  Invalid JSON in ${planPath}:\n    ${e.message}\n`);
  process.exit(1);
}

const errs = [];
if (!plan.weekOf)    errs.push('Missing weekOf');
if (!plan.weekEnding) errs.push('Missing weekEnding');
if (!Array.isArray(plan.days) || plan.days.length !== 7) errs.push(`days must be array of 7 (got ${(plan.days||[]).length})`);
if (errs.length) {
  console.error('\n❌  Plan validation failed:');
  errs.forEach(e => console.error('    •', e));
  process.exit(1);
}

// ── 3. Inject ────────────────────────────────────────────────────────────────
const planJson = JSON.stringify(plan);
const html     = fs.readFileSync(HTML, 'utf8');

if (!/const PLAN=\{/.test(html)) {
  console.error('\n❌  Could not find `const PLAN={` in index.html. Is this the right file?\n');
  process.exit(1);
}

// Back up first
fs.writeFileSync(HTML + '.bak', html, 'utf8');

const updated = html.replace(/const PLAN=\{[\s\S]*?\};/, `const PLAN=${planJson};`);

if (updated === html) {
  console.error('\n❌  Replacement produced no change — pattern matched but content was identical.\n');
  process.exit(1);
}

fs.writeFileSync(HTML, updated, 'utf8');

// ── 4. Confirm ───────────────────────────────────────────────────────────────
const DAYS = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
console.log('\n✅  Plan injected successfully!\n');
console.log(`    Week of:   ${plan.weekOf}`);
console.log(`    Week ending: ${plan.weekEnding}`);
console.log(`    Backup:    index.html.bak\n`);
console.log('    Dinners:');
plan.days.forEach((d, i) => {
  const swapped = d.dinner?.substitutes?.length ? '' : '';
  console.log(`    ${(DAYS[i]||d.day).padEnd(3)}  ${d.date.padEnd(6)}  ${d.dinner?.name || '—'}`);
});

console.log('\n    Next steps:');
console.log('    git add index.html');
console.log(`    git commit -m "Week ending ${plan.weekEnding}"`);
console.log('    git push origin master:main\n');

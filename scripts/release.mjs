#!/usr/bin/env node
// Release tooling. One file, no dependencies, so it runs in CI and in a fresh
// clone.
//
//   node scripts/release.mjs bump patch|minor|major   cut a release
//   node scripts/release.mjs doctor                   check the policy holds
//   node scripts/release.mjs verify vX.Y.Z            CI gate, on a tag
//   node scripts/release.mjs notes X.Y.Z              CI, prints release notes
//
// The version lives in package.json, the entry for it lives in CHANGELOG.md,
// and `bump` keeps the two in step and tags the result. The tag is what makes
// the version real: `.github/workflows/release.yml` turns it into a GitHub
// release whose notes are the changelog section.

import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PKG_PATH = join(ROOT, 'package.json');
const LOG_PATH = join(ROOT, 'CHANGELOG.md');
const REPO = 'https://github.com/letterk/dsh-adhd-mode';
const LEVELS = ['patch', 'minor', 'major'];

function fail(message) {
  console.error('release: ' + message);
  process.exit(1);
}

function git(...args) {
  return execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).trim();
}

function readPkg() {
  return JSON.parse(readFileSync(PKG_PATH, 'utf8'));
}

function readLog() {
  return readFileSync(LOG_PATH, 'utf8');
}

// ---- semver ---------------------------------------------------------------

function parseSemver(text) {
  const m = /^(\d+)\.(\d+)\.(\d+)$/.exec(String(text).trim());
  if (!m) fail(`"${text}" is not a MAJOR.MINOR.PATCH version`);
  return { major: +m[1], minor: +m[2], patch: +m[3] };
}

function formatSemver(v) {
  return `${v.major}.${v.minor}.${v.patch}`;
}

function bumpVersion(current, level) {
  const v = parseSemver(current);
  if (level === 'major') return formatSemver({ major: v.major + 1, minor: 0, patch: 0 });
  if (level === 'minor') return formatSemver({ major: v.major, minor: v.minor + 1, patch: 0 });
  if (level === 'patch') return formatSemver({ major: v.major, minor: v.minor, patch: v.patch + 1 });
  fail(`"${level}" is not one of ${LEVELS.join(', ')}`);
}

function compare(a, b) {
  const x = parseSemver(a);
  const y = parseSemver(b);
  return x.major - y.major || x.minor - y.minor || x.patch - y.patch;
}

function latestTag() {
  try {
    return git('describe', '--tags', '--abbrev=0', '--match', 'v[0-9]*.[0-9]*.[0-9]*');
  } catch {
    return null;
  }
}

// ---- changelog ------------------------------------------------------------

/** The body under `## [version]`, or null when that heading is absent. */
function sectionBody(text, version) {
  const start = text.indexOf(`\n## [${version}]`);
  if (start === -1) return null;
  const rest = text.slice(start + 1);
  const end = rest.indexOf('\n## [', 1);
  return (end === -1 ? rest : rest.slice(0, end)).replace(/^## \[[^\]]+\][^\n]*\n?/, '');
}

/** Everything between `## [Unreleased]` and the next version heading. */
function unreleasedBody(text) {
  const start = text.indexOf('\n## [Unreleased]');
  if (start === -1) fail('CHANGELOG.md has no "## [Unreleased]" heading');
  const rest = text.slice(start + 1);
  const end = rest.indexOf('\n## [', 1);
  return (end === -1 ? rest : rest.slice(0, end)).replace(/^## \[Unreleased\][^\n]*\n?/, '');
}

function hasUnreleasedHeading(text) {
  return text.includes('\n## [Unreleased]');
}

function fileVersionHeading(text, version, date) {
  const heading = `## [${version}] - ${date}`;
  const anchor = '\n## [Unreleased]\n';
  const at = text.indexOf(anchor);
  if (at === -1) fail('CHANGELOG.md has no "## [Unreleased]" heading to freeze');
  return text.slice(0, at) + anchor + '\n' + heading + '\n' + text.slice(at + anchor.length);
}

function relinkVersions(text, version, previous) {
  const unreleased = `[Unreleased]: ${REPO}/compare/v${version}...HEAD`;
  const entry = `[${version}]: ${REPO}/releases/tag/v${version}`;
  const line = /^\[Unreleased\]: .*$/m;
  if (line.test(text)) {
    return text.replace(line, `${unreleased}\n${entry}`);
  }
  // No reference block yet: start one, keeping the previous entry if it exists.
  const tail = previous && !text.includes(`[${previous}]:`) ? `\n[${previous}]: ${REPO}/releases/tag/v${previous}` : '';
  return text.replace(/\s*$/, `\n\n${unreleased}\n${entry}${tail}\n`);
}

function releaseNotes(version) {
  const body = sectionBody(readLog(), version);
  if (body === null) fail(`CHANGELOG.md has no "## [${version}]" section`);
  if (body.trim() === '') fail(`the "## [${version}]" section is empty`);
  return body.trim();
}

// ---- commands -------------------------------------------------------------

function runTests() {
  execFileSync('npm', ['test'], { cwd: ROOT, stdio: 'inherit' });
}

function cmdBump(args) {
  const level = args[0];
  const dryRun = args.includes('--dry-run');
  const noPush = args.includes('--no-push');
  if (!level || level.startsWith('--')) fail('usage: release.mjs bump patch|minor|major [--dry-run] [--no-push]');

  const pkg = readPkg();
  const current = pkg.version;
  let next;
  if (LEVELS.includes(level)) next = bumpVersion(current, level);
  else if (/^\d+\.\d+\.\d+$/.test(level)) next = formatSemver(parseSemver(level));
  else fail(`"${level}" is not one of ${LEVELS.join(', ')} nor a MAJOR.MINOR.PATCH version`);
  if (compare(next, current) <= 0) fail(`next version ${next} is not greater than the current ${current}`);

  const log = readLog();
  if (!hasUnreleasedHeading(log)) fail('CHANGELOG.md has no "## [Unreleased]" heading');
  if (unreleasedBody(log).trim() === '') {
    fail('nothing under "## [Unreleased]" — write the entry before bumping');
  }

  const date = new Date().toISOString().slice(0, 10);
  const nextLog = relinkVersions(fileVersionHeading(log, next, date), next, current);

  console.log(`release: ${current} -> ${next} (${date})`);
  if (dryRun) {
    console.log(nextLog.split('\n').slice(0, 16).join('\n'));
    console.log('release: --dry-run, nothing written');
    return;
  }

  if (git('status', '--porcelain') !== '') fail('the working tree is dirty — commit or stash first');
  const branch = git('rev-parse', '--abbrev-ref', 'HEAD');
  if (branch !== 'main') fail(`on branch "${branch}", not main`);

  pkg.version = next;
  writeFileSync(PKG_PATH, JSON.stringify(pkg, null, 2) + '\n');
  writeFileSync(LOG_PATH, nextLog);
  runTests();

  git('add', '-A');
  git('commit', '-m', `release: ${next}`);
  git('tag', '-a', `v${next}`, '-m', next);
  console.log(`release: tagged v${next}`);

  if (noPush) {
    console.log('release: --no-push, run "git push origin HEAD --tags" to publish');
    return;
  }
  git('push', 'origin', 'HEAD');
  git('push', 'origin', `v${next}`);
  console.log(`release: pushed — release.yml will publish v${next}`);
}

function cmdDoctor() {
  const problems = [];
  const version = readPkg().version;
  parseSemver(version);
  const log = readLog();

  const tag = latestTag();
  if (tag) {
    const tagged = tag.replace(/^v/, '');
    parseSemver(tagged);
    if (compare(version, tagged) < 0) {
      problems.push(`package.json is ${version}, behind the latest tag ${tag}`);
    } else if (compare(version, tagged) > 0) {
      // A version that no tag carries has to be published, not just declared.
      const body = sectionBody(log, version);
      if (body === null) problems.push(`package.json is ${version} but CHANGELOG.md has no [${version}] section`);
      else if (body.trim() === '') problems.push(`the [${version}] section in CHANGELOG.md is empty`);
      if (!log.includes(`[${version}]: `)) problems.push(`CHANGELOG.md has no [${version}] link reference`);
    }
    const expect = `[Unreleased]: ${REPO}/compare/v${tagged}...HEAD`;
    if (!log.includes(expect)) problems.push(`the [Unreleased] link should be ${expect}`);
  }
  if (!hasUnreleasedHeading(log)) problems.push('CHANGELOG.md has no "## [Unreleased]" heading');

  if (problems.length) {
    problems.forEach((p) => console.error('release: ' + p));
    process.exit(1);
  }
  console.log(`release: version policy holds at ${version}${tag ? ` (latest tag ${tag})` : ''}`);
}

function cmdVerify(args) {
  const tag = args[0];
  if (!tag) fail('usage: release.mjs verify vX.Y.Z');
  if (!/^v\d+\.\d+\.\d+$/.test(tag)) fail(`"${tag}" is not a vMAJOR.MINOR.PATCH tag`);
  const version = tag.slice(1);
  const declared = readPkg().version;
  if (version !== declared) {
    fail(`tag ${tag} does not match package.json (${declared}) — the tag and the tree disagree`);
  }
  const body = sectionBody(readLog(), version);
  if (body === null) fail(`CHANGELOG.md has no "## [${version}]" section for tag ${tag}`);
  if (body.trim() === '') fail(`the "## [${version}]" section is empty`);
  console.log(`release: ${tag} matches package.json and CHANGELOG.md`);
}

function cmdNotes(args) {
  process.stdout.write(releaseNotes(args[0]) + '\n');
}

function main() {
  const [command, ...args] = process.argv.slice(2);
  if (command === 'bump') return cmdBump(args);
  if (command === 'doctor') return cmdDoctor();
  if (command === 'verify') return cmdVerify(args);
  if (command === 'notes') return cmdNotes(args);
  console.error('usage: release.mjs bump|doctor|verify|notes [args]');
  process.exit(1);
}

main();

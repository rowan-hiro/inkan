// Package smoke: pack the tarball, install it into a throwaway consumer, and
// drive the installed `inkan` and `ink` through init, begin, end, check, and
// log in a scratch git repository. Run under npm (`npm run test:package`) so
// the same npm that packs is the one that installs.

import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'inkan-package-smoke-'));
const packDirectory = path.join(temporary, 'pack');
const consumer = path.join(temporary, 'consumer');
const sandbox = path.join(temporary, 'sandbox');

function npmCli() {
  const npmJs = process.env.npm_execpath;
  assert.equal(typeof npmJs, 'string', 'package smoke expects to run under npm (npm_execpath)');
  assert.notEqual(npmJs, '', 'package smoke expects to run under npm (npm_execpath)');
  assert.match(path.basename(npmJs), /\.js$/i, 'npm_execpath must be the JavaScript CLI');
  assert.equal(fs.existsSync(npmJs), true, `npm_execpath exists: ${npmJs}`);
  return npmJs;
}

function run(command, args, options = {}) {
  return execFileSync(command, args, {
    cwd: root,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    ...options,
  });
}

function runNpm(args, options = {}) {
  return run(process.execPath, [npmCli(), ...args], options);
}

function git(args) {
  return run('git', args, { cwd: sandbox });
}

function runInstalled(name, args) {
  return runNpm(['exec', '--offline', '--prefix', consumer, '--', name, ...args], { cwd: sandbox });
}

try {
  fs.mkdirSync(packDirectory);
  fs.mkdirSync(consumer);
  fs.mkdirSync(sandbox);
  fs.writeFileSync(
    path.join(consumer, 'package.json'),
    `${JSON.stringify({ name: 'inkan-package-smoke', private: true }, null, 2)}\n`
  );

  const packed = JSON.parse(runNpm(['pack', '--json', '--pack-destination', packDirectory]));
  assert.equal(packed.length, 1);
  const tarball = path.join(packDirectory, packed[0].filename);
  runNpm(['install', '--ignore-scripts', '--no-audit', '--no-fund', tarball], { cwd: consumer });

  const installed = path.join(consumer, 'node_modules', 'inkan');
  for (const file of [
    'bin/inkan.js',
    'bin/ink.js',
    'src/api.js',
    'src/cli.js',
    'src/decisions.js',
    'src/fold.js',
    'src/git.js',
    'src/store.js',
    'skills/use-inkan/SKILL.md',
    'README.md',
    'LICENSE',
  ]) {
    assert.equal(fs.existsSync(path.join(installed, file)), true, `${file} is packaged`);
  }
  for (const file of ['test', 'bench', 'scripts', '.inkan', 'AGENTS.md', 'CLAUDE.md']) {
    assert.equal(fs.existsSync(path.join(installed, file)), false, `${file} is not packaged`);
  }
  for (const name of ['inkan', 'ink']) {
    const executable = process.platform === 'win32' ? `${name}.cmd` : name;
    assert.equal(
      fs.existsSync(path.join(consumer, 'node_modules', '.bin', executable)),
      true,
      `${name} is installed as an executable`
    );
  }

  const metadata = JSON.parse(fs.readFileSync(path.join(installed, 'package.json'), 'utf8'));
  for (const name of ['inkan', 'ink']) {
    assert.equal(runInstalled(name, ['--version']), `${metadata.version}\n`);
  }
  const help = runInstalled('inkan', ['help']);
  assert.match(help, /'ink' is an alias for 'inkan'/);
  assert.equal(runInstalled('ink', ['help']), help);

  git(['init', '-q']);
  git(['config', 'user.email', 'smoke@example.com']);
  git(['config', 'user.name', 'Package smoke']);
  fs.writeFileSync(path.join(sandbox, 'README.md'), '# smoke\n');
  git(['add', '-A']);
  git(['commit', '-q', '-m', 'init']);

  runInstalled('inkan', ['init']);
  assert.match(fs.readFileSync(path.join(sandbox, 'AGENTS.md'), 'utf8'), /<!-- inkan -->/);
  git(['add', '-A']);
  git(['commit', '-q', '-m', 'chore: add inkan']);

  const id = runInstalled('ink', ['begin', 'packaged smoke', '--accept', 'the packed CLI runs']).trim();
  assert.match(id, /^\d{4}-\d{2}-\d{2}-\d{4}-[0-9a-z]{4}$/);
  assert.match(runInstalled('inkan', ['status']), /packaged smoke/);
  fs.writeFileSync(path.join(sandbox, 'smoke.txt'), 'done\n');
  const ended = runInstalled('inkan', ['end', '--met', '1', '--note', 'packaged smoke']);
  assert.match(ended, new RegExp(`Inkan-Outcome: ${id}`));
  git(['add', '-A']);
  git(['commit', '-q', '-m', `feat: smoke\n\nInkan-Outcome: ${id}\n`]);
  assert.match(runInstalled('inkan', ['check', 'HEAD']), /consistent/);
  assert.match(runInstalled('ink', ['log', '-n', '1']), new RegExp(`^${id}  completed  packaged smoke`));

  process.stdout.write(`package smoke passed: ${packed[0].filename}\n`);
} finally {
  fs.rmSync(temporary, { recursive: true, force: true });
}

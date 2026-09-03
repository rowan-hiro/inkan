// Argument parsing, printing, and exit codes. Nothing here holds business
// logic; that all lives in src/api.js. Exit codes: 0 success, 1 refusal or
// error.

import { parseArgs } from 'node:util';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import * as api from './api.js';
import { InkanError } from './api.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(readFileSync(path.join(here, '..', 'package.json'), 'utf8'));

// Matches the current YYYY-MM-DD-HHMM-xxxx id form and the legacy YYYY-MM-DD-xxxx form.
const OUTCOME_ID_RE = /^\d{4}-\d{2}-\d{2}-(?:\d{4}-)?[0-9a-z]{4}$/;

const HELP = `Usage: inkan <command> [options]

Commands:
  init [--lang <tag>]
      Create .inkan/ and write the agent protocol block into AGENTS.md.
  begin "<outcome>" [--accept <text>]... [--decision <id>]... [--lane <tag>]
      Seal a new outcome; prints its id.
  amend --reason <text> [<addition>] [--accept <text>]... [--withdraw <n>]...
        [--decision <id>]... [<id>]
      Append an amendment to the open outcome; prints the new contract hash.
  end [<id>] [--met <n>]... [--unmet <n>]... [-s abandoned] --note <text>
      Record dispositions and close an outcome.
  status
      Print every open outcome.
  log [-n <count>] [--since <date>] [--grep <regex>] [--status <s>]
      [--decision <id>] [--lane <tag>] [<id>]
      Print the outcome log, newest first; <id> prints one outcome in full.
      Filters combine.
  check [<commit>]
      Read-only. Reports whether a commit's Inkan-Outcome trailers still
      match what was recorded. Exit 0 consistent, 1 mismatch, 2 no trailer.
  doctor
      Read-only. Reports corrupt outcomes, id mismatches, duplicate
      decision ids, and dangling decision links. Exit 0 clean, 1 problems.
  decision add "<title>" --context <text> --decision <text> [--driver <text>]...
               [--option <text>]... [--consequence <text>]... [-s <status>]
      Write a numbered MADR record; prints its file path.
  decision show <id>
      Print one decision record verbatim. <id> accepts 2, 02, or 0002.
  decision list [-s <status>]
      One line per record, ascending by id.
  decision update <id> --status <status> --reason <text> [--outcome <id>]
      Append a dated history entry and set the new status.

  help, --help, -h     show this help
  --version, -v        print the version

'ink' is an alias for 'inkan'; both accept identical arguments.`;

function fail(message) {
  process.stderr.write(`inkan: ${message}\n`);
  process.exitCode = 1;
}

function splitAmendPositionals(positionals) {
  let id;
  let addition;
  for (const p of positionals) {
    if (OUTCOME_ID_RE.test(p) && id === undefined) {
      id = p;
    } else if (addition === undefined) {
      addition = p;
    } else {
      throw new InkanError('usage: inkan amend --reason <text> [<addition>] [<id>]');
    }
  }
  return { id, addition };
}

function printCriterionLine(c, dispositionByIndex) {
  let line = `  ${c.index}. ${c.text}`;
  if (c.withdrawn) {
    line += ' (withdrawn)';
  } else {
    const d = dispositionByIndex.get(c.index);
    if (d) line += d.met ? ' (met)' : ` (unmet${d.note ? `: ${d.note}` : ''})`;
  }
  console.log(line);
}

/** Shared body for `status` and `log <id>`: the open-outcome shape, plus the
 * closed-only fields when the record has an end event. */
function printRecord(record) {
  console.log(`[${record.id}] ${record.closed ? record.status : 'open'}`);
  console.log(`  sealed: ${record.sealedAt}`);
  console.log(`  hash: ${record.contractHash}`);
  if (record.lane) console.log(`  lane: ${record.lane}`);
  console.log(`  outcome: ${record.outcome}`);

  const dispositionByIndex = new Map((record.dispositions ?? []).map((d) => [d.criterion, d]));
  for (const c of record.criteria) printCriterionLine(c, dispositionByIndex);
  for (const a of record.amendments) {
    console.log(`  amend ${a.ts}: ${a.reason}`);
    if (a.addition) console.log(`    ${a.addition}`);
  }
  if (record.decisionLinks.length > 0) {
    const links = record.decisionLinks.map((d) => `${d.id} (${d.status ?? 'missing'})`);
    console.log(`  decisions: ${links.join(', ')}`);
  }

  if (record.closed) {
    console.log(`  closed: ${record.closedAt}`);
    console.log(`  status: ${record.status}`);
    console.log(`  note: ${record.note}`);
    console.log(`  tree: ${record.tree ?? 'none'}`);
    console.log(`  head: ${record.head ?? 'none'}`);
  }
}

function printStatus(open) {
  if (open.length === 0) {
    console.log('no outcome open');
    return;
  }
  for (const record of open) printRecord(record);
}

function printCheck(result) {
  if (result.noTrailer) {
    console.log(`${result.shortSha}  no Inkan-Outcome trailer`);
    process.exitCode = 2;
    return;
  }
  for (const r of result.reports) {
    console.log(`${result.shortSha}  Inkan-Outcome: ${r.id}`);
    for (const line of r.lines) console.log(`  ${line}`);
  }
  if (result.consistent) {
    console.log('consistent');
  } else {
    console.log('mismatch');
    console.log('a mismatch is a fact about this commit; it is recorded, not repaired');
    process.exitCode = 1;
  }
}

function printDoctor(result) {
  if (result.problems.length === 0) {
    console.log(`ok: ${result.outcomeCount} outcomes, ${result.decisionCount} decisions`);
    return;
  }
  for (const p of result.problems) console.log(p);
  process.exitCode = 1;
}

function printLogLine(record) {
  const parts = [record.id, record.closed ? record.status : 'open'];
  if (record.lane) parts.push(`[${record.lane}]`);
  parts.push(record.outcome);
  if (record.closed && record.status !== 'abandoned') {
    const live = record.criteria.filter((c) => !c.withdrawn).length;
    const met = (record.dispositions ?? []).filter((d) => d.met).length;
    parts.push(`(${met}/${live} met)`);
  }
  console.log(parts.join('  '));
}

const DECISION_ADD_USAGE =
  'usage: inkan decision add "<title>" --context <text> --decision <text> ' +
  '[--driver <text>]... [--option <text>]... [--consequence <text>]... [-s <status>]';

function runDecision(root, rest) {
  const [sub, ...subRest] = rest;
  switch (sub) {
    case 'add': {
      const opts = {
        context: { type: 'string' },
        decision: { type: 'string' },
        driver: { type: 'string', multiple: true, default: [] },
        option: { type: 'string', multiple: true, default: [] },
        consequence: { type: 'string', multiple: true, default: [] },
        status: { type: 'string', short: 's' },
      };
      const { values, positionals } = parseArgs({ args: subRest, options: opts, allowPositionals: true });
      if (positionals.length !== 1) throw new InkanError(DECISION_ADD_USAGE);
      console.log(api.decisionAdd({ root, title: positionals[0], ...values }).file);
      break;
    }
    case 'show': {
      const { positionals } = parseArgs({ args: subRest, allowPositionals: true });
      if (positionals.length !== 1) throw new InkanError('usage: inkan decision show <id>');
      process.stdout.write(api.decisionShow({ root, id: positionals[0] }).content);
      break;
    }
    case 'list': {
      const { values } = parseArgs({ args: subRest, options: { status: { type: 'string', short: 's' } } });
      for (const r of api.decisionList({ root, status: values.status }).records) {
        console.log(`${r.id}  ${r.status}  ${r.title}`);
      }
      break;
    }
    case 'update': {
      const opts = { status: { type: 'string' }, reason: { type: 'string' }, outcome: { type: 'string' } };
      const { values, positionals } = parseArgs({ args: subRest, options: opts, allowPositionals: true });
      if (positionals.length !== 1) {
        throw new InkanError('usage: inkan decision update <id> --status <status> --reason <text> [--outcome <id>]');
      }
      const result = api.decisionUpdate({ root, id: positionals[0], ...values });
      console.log(`${result.id} ${result.from} -> ${result.to}`);
      break;
    }
    default:
      throw new InkanError(`unknown decision subcommand "${sub}"`);
  }
}

function run(argv) {
  const [command, ...rest] = argv;

  if (command === undefined || command === 'help' || command === '--help' || command === '-h') {
    console.log(HELP);
    return;
  }
  if (command === '--version' || command === '-v') {
    console.log(pkg.version);
    return;
  }

  const root = process.cwd();

  try {
    switch (command) {
      case 'init': {
        const { values } = parseArgs({ args: rest, options: { lang: { type: 'string' } } });
        const result = api.init({ root, lang: values.lang });
        const verb = result.changed ? 'Initialized' : 'Already initialized';
        console.log(`${verb} Inkan in ${result.root}`);
        break;
      }
      case 'begin': {
        const opts = {
          accept: { type: 'string', multiple: true, default: [] },
          decision: { type: 'string', multiple: true, default: [] },
          lane: { type: 'string' },
        };
        const { values, positionals } = parseArgs({ args: rest, options: opts, allowPositionals: true });
        if (positionals.length !== 1) throw new InkanError('usage: inkan begin "<outcome>" [--accept <text>]...');
        const result = api.begin({ root, outcome: positionals[0], ...values });
        console.log(result.id);
        break;
      }
      case 'amend': {
        const opts = {
          reason: { type: 'string' },
          accept: { type: 'string', multiple: true, default: [] },
          withdraw: { type: 'string', multiple: true, default: [] },
          decision: { type: 'string', multiple: true, default: [] },
        };
        const { values, positionals } = parseArgs({ args: rest, options: opts, allowPositionals: true });
        const { id, addition } = splitAmendPositionals(positionals);
        const result = api.amend({ root, id, addition, ...values });
        console.log(result.contractHash);
        break;
      }
      case 'end': {
        const opts = {
          met: { type: 'string', multiple: true, default: [] },
          unmet: { type: 'string', multiple: true, default: [] },
          status: { type: 'string', short: 's' },
          note: { type: 'string' },
        };
        const { values, positionals } = parseArgs({ args: rest, options: opts, allowPositionals: true });
        if (positionals.length > 1) {
          throw new InkanError('usage: inkan end [<id>] [--met <n>]... [--unmet <n>]... [-s abandoned] --note <text>');
        }
        const result = api.end({ root, id: positionals[0], ...values });
        console.log(`${result.id} ${result.status}`);
        console.log(`Inkan-Outcome: ${result.id}`);
        break;
      }
      case 'status': {
        parseArgs({ args: rest });
        printStatus(api.status({ root }).open);
        break;
      }
      case 'log': {
        const opts = {
          n: { type: 'string', short: 'n' },
          lane: { type: 'string' },
          since: { type: 'string' },
          grep: { type: 'string' },
          status: { type: 'string' },
          decision: { type: 'string' },
        };
        const { values, positionals } = parseArgs({ args: rest, options: opts, allowPositionals: true });
        if (positionals.length > 1) {
          throw new InkanError(
            'usage: inkan log [-n <count>] [--since <date>] [--grep <regex>] [--status <s>] [--decision <id>] [--lane <tag>] [<id>]'
          );
        }
        const n = values.n !== undefined ? Number(values.n) : undefined;
        const result = api.log({ root, ...values, n, id: positionals[0] });
        if (result.record) printRecord(result.record);
        else for (const record of result.records) printLogLine(record);
        break;
      }
      case 'check': {
        const { positionals } = parseArgs({ args: rest, allowPositionals: true });
        if (positionals.length > 1) throw new InkanError('usage: inkan check [<commit>]');
        printCheck(api.check({ root, commit: positionals[0] }));
        break;
      }
      case 'doctor': {
        parseArgs({ args: rest });
        printDoctor(api.doctor({ root }));
        break;
      }
      case 'decision': {
        runDecision(root, rest);
        break;
      }
      default:
        fail(`unknown command "${command}"`);
    }
  } catch (err) {
    fail(err instanceof InkanError ? err.message : (err.message ?? String(err)));
  }
}

run(process.argv.slice(2));

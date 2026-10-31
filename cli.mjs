// cli.mjs — Glyphguard on the command line. build.mjs bundles this with the KERNEL block of index.html into
// scripts/kar-glyphguard.mjs, the single file the Agensi skill runs. It scans text for the tricks that hide in
// characters (invisible characters, homoglyphs, bidi overrides, hidden Unicode-tag text, styled or fullwidth
// letters, variation selectors, mixed-script words) and prints a hashed report; or re-verifies a report.
// The report is written as pure ASCII: every non-ASCII character is a \u escape, so the report itself can
// never carry a hidden character into whatever reads it.
// Exit 0 = clean (or the report verified) · 1 = flagged (or it did not verify) · 2 = unusable input.
import { readFileSync } from 'node:fs';
import { makeReport, verifyExport } from './kernel.mjs';

const USAGE = `usage: node kar-glyphguard.mjs --file <path>         scan a text file as it is (or - for stdin)
       node kar-glyphguard.mjs <input.json | ->          input: {"text": "…"}
       node kar-glyphguard.mjs <input.json | ->          input: {"text": "…", "export": {…a report this tool printed…}}
                                                          re-runs the scan and checks the report and its hashes
output: a JSON report on stdout, ASCII only. exit 0 = clean / verified, 1 = flagged / not verified, 2 = bad input`;

class InputError extends Error {}
const fail = (msg) => { throw new InputError(msg); };

function readText(path) {
  try { return readFileSync(path === '-' ? 0 : path, 'utf8'); }
  catch (e) { return fail(`cannot read ${path === '-' ? 'stdin' : path}: ${e.code || e.message}`); }
}

function asciiJson(value) {
  return JSON.stringify(value, null, 2).replace(/[\u007f-\uFFFF]/g, (c) => '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0'));
}

async function main(args) {
  let text, exported;
  if (args.length === 2 && args[0] === '--file') {
    text = readText(args[1]);
  } else if (args.length === 1 && (args[0] === '-' || !args[0].startsWith('-'))) {
    let input;
    try { input = JSON.parse(readText(args[0])); } catch (e) { if (e instanceof InputError) throw e; fail(`the input is not valid JSON (${e.message})`); }
    if (!input || typeof input !== 'object' || typeof input.text !== 'string') fail('the input must be an object with "text" (a string)');
    text = input.text;
    if ('export' in input) exported = input.export;
  } else {
    process.stderr.write(USAGE + '\n');
    return 2;
  }
  if (exported !== undefined) {
    const v = await verifyExport(text, exported);
    process.stdout.write(asciiJson({ tool: 'kar-glyphguard', mode: 'verify', verdict: v.ok ? 'VERIFIED' : 'MISMATCH', ...v }) + '\n');
    return v.ok ? 0 : 1;
  }
  const exp = await makeReport(text);
  process.stdout.write(asciiJson(exp) + '\n');
  return exp.report.verdict.status === 'clean' ? 0 : 1;
}

try {
  process.exitCode = await main(process.argv.slice(2));
} catch (e) {
  process.stderr.write(`kar-glyphguard: ${e instanceof InputError ? e.message : 'internal error: ' + (e && e.message)}\n`);
  process.exitCode = e instanceof InputError ? 2 : 3;
}

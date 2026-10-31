// kernel.test.mjs — Glyphguard's kernel (the KERNEL block of index.html, generated into kernel.mjs).
// Every special character is written as a \u escape, so this file is plain ASCII. Expected values come from
// the Unicode code charts; witness v0.6 checks every test bites.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import {
  CONFUSABLES, INVISIBLE, BIDI, BIDI_HIGH_RISK, decodeMathAlnum, scriptOf, TAG_LO, TAG_HI, TAG_CANCEL, isVarSel, isFullwidth,
  stableStringify, cpHex, scan, sha256Hex, makeReport, verifyExport,
} from './kernel.mjs';

const nodeSha = (s) => createHash('sha256').update(s, 'utf8').digest('hex');
const tag = (s) => [...s].map((c) => String.fromCodePoint(0xE0000 + c.charCodeAt(0))).join('') + String.fromCodePoint(TAG_CANCEL);
const cats = (r) => r.findings.map((f) => `${f.pos}:${f.category}:${f.severity}`);

test('the tables: tag range, a sample of each list', () => {
  assert.deepEqual([TAG_LO, TAG_HI, TAG_CANCEL], [0xE0020, 0xE007E, 0xE007F]);
  assert.deepEqual(CONFUSABLES[0x0430], ['a', 'CYRILLIC SMALL LETTER A', 'Cyrillic']);
  assert.equal(INVISIBLE[0x200B], 'ZERO WIDTH SPACE');
  assert.equal(BIDI[0x202E], 'RIGHT-TO-LEFT OVERRIDE');
  assert.equal(BIDI_HIGH_RISK[0x202E], 1);
  assert.equal(BIDI_HIGH_RISK[0x200E], undefined);
});

test('decodeMathAlnum: styled letters and digits decode; everything else is null', () => {
  assert.equal(decodeMathAlnum(0x1D400), 'A');          // MATHEMATICAL BOLD CAPITAL A
  assert.equal(decodeMathAlnum(0x1D419), 'Z');
  assert.equal(decodeMathAlnum(0x1D41A), 'a');
  assert.equal(decodeMathAlnum(0x1D433), 'z');
  assert.equal(decodeMathAlnum(0x1D68A), 'a');          // the last style's lower-case run
  assert.equal(decodeMathAlnum(0x1D7CE), '0');          // MATHEMATICAL BOLD DIGIT ZERO
  assert.equal(decodeMathAlnum(0x1D7FF), '9');
  assert.equal(decodeMathAlnum(0x41), null);
  assert.equal(decodeMathAlnum(0x1D7CD), null);         // just below the digits
  assert.equal(decodeMathAlnum(0x1F600), null);
});

test('scriptOf, isVarSel, isFullwidth, cpHex', () => {
  assert.deepEqual([0x41, 0x7A, 0xE9, 0x0430, 0x03B1, 0x31, 0x20, 0x4E00].map(scriptOf),
    ['Latin', 'Latin', 'Latin', 'Cyrillic', 'Greek', 'Common', 'Common', 'Other']);
  assert.equal(isVarSel(0xFE0F), true);
  assert.equal(isVarSel(0xE0100), true);
  assert.equal(isVarSel(0xFE10), false);
  assert.equal(isFullwidth(0xFF21), true);
  assert.equal(isFullwidth(0xFF5F), false);
  assert.equal(cpHex(0x200B), 'U+200B');
  assert.equal(cpHex(0x41), 'U+0041');
  assert.equal(cpHex(0xE0041), 'U+E0041');
});

test('stableStringify: keys sorted at every depth', () => {
  assert.equal(stableStringify({ b: 1, a: [{ d: 2, c: null }] }), '{"a":[{"c":null,"d":2}],"b":1}');
  assert.equal(stableStringify('x'), '"x"');
});

test('scan: plain text is clean, with nothing decoded and no severity', () => {
  const r = scan('Plain text, nothing hidden.');
  assert.deepEqual(r.findings, []);
  assert.deepEqual(r.mixedScriptTokens, []);
  assert.deepEqual(r.verdict, { status: 'clean', highestSeverity: null });
  assert.deepEqual(r.counts, { confusable: 0, invisible: 0, bidi: 0, hiddenTag: 0, mathAlnum: 0, fullwidth: 0, variationSelector: 0 });
  assert.equal(r.hiddenTagText, null);
  assert.equal(r.mathAlnumDecoded, null);
  assert.equal(r.fullwidthDecoded, null);
  assert.deepEqual(r.normalization, { nfcChanged: false, nfkcChanged: false, nfcResult: null, nfkcResult: null });
  assert.equal(r.inputLength, 27);
});

test('scan: hidden Unicode-tag text is decoded and is high severity', () => {
  const r = scan('Hi' + tag('ok') + '!');
  assert.deepEqual(r.hiddenTagText, ['ok']);
  assert.equal(r.counts.hiddenTag, 3);
  assert.deepEqual(cats(r), ['2:hidden-tag:high', '3:hidden-tag:high', '4:hidden-tag:high']);
  assert.equal(r.findings[0].codepoint, 'U+E006F');
  assert.equal(r.findings[2].char, '[tag-end]');
  assert.deepEqual(r.verdict, { status: 'flagged', highestSeverity: 'high' });
  assert.equal(r.inputLength, 6);   // counted in code points, not UTF-16 units
  // an unterminated tag run is still reported
  assert.deepEqual(scan('x' + String.fromCodePoint(0xE0041)).hiddenTagText, ['A']);
});

test('scan: invisible, bidi, variation-selector findings and their severities', () => {
  assert.deepEqual(cats(scan('a\u200Bb')), ['1:invisible:low']);
  assert.deepEqual(scan('a\u200Bb').verdict, { status: 'flagged', highestSeverity: 'low' });
  assert.deepEqual(cats(scan('a\u202Eb\u200Ec')), ['1:bidi:high', '3:bidi:medium']);
  assert.deepEqual(cats(scan('a\uFE0F')), ['1:variation-selector:medium']);
  assert.match(scan('\u202E').findings[0].detail, /^RIGHT-TO-LEFT OVERRIDE \(can visually reorder/);
});

test('scan: a homoglyph is a medium finding, and mixing scripts in one word is flagged', () => {
  const r = scan('secure-b\u0430nk.example today');
  assert.deepEqual(cats(r), ['8:confusable:medium']);
  assert.equal(r.findings[0].detail, 'CYRILLIC SMALL LETTER A (Cyrillic) looks like Latin "a"');
  assert.deepEqual(r.mixedScriptTokens, [{ token: 'secure-b\u0430nk.example', scripts: ['Cyrillic', 'Latin', 'Other'] }]);
  assert.deepEqual(scan('\u0430\u0431\u0432').mixedScriptTokens, []);           // all Cyrillic: not mixed
  assert.deepEqual(scan('lambda \u03BB').mixedScriptTokens, []);                 // separate words
  assert.deepEqual(scan('pi\u03C0').mixedScriptTokens, [{ token: 'pi\u03C0', scripts: ['Greek', 'Latin'] }]);
});

test('scan: a mixed-script word with no other finding still raises the severity to medium', () => {
  const r = scan('pa\u0434');                           // CYRILLIC SMALL LETTER DE is not in the homoglyph list
  assert.deepEqual(r.findings, []);
  assert.deepEqual(r.verdict, { status: 'flagged', highestSeverity: 'medium' });
  const low = scan('pa\u0434 \u200B');                  // a low finding plus a mixed word: medium wins
  assert.deepEqual(low.verdict, { status: 'flagged', highestSeverity: 'medium' });
  const high = scan('pa\u0434 \u202E');                 // high stays high
  assert.equal(high.verdict.highestSeverity, 'high');
});

test('scan: styled and fullwidth letters are decoded to plain text', () => {
  const r = scan('\u{1D407}i \uFF21b');               // MATHEMATICAL BOLD CAPITAL H, i, space, FULLWIDTH A, b
  assert.equal(r.counts.mathAlnum, 1);
  assert.equal(r.counts.fullwidth, 1);
  assert.equal(r.mathAlnumDecoded, 'Hi \uFF21b');
  assert.equal(r.fullwidthDecoded, 'i Ab');
  assert.equal(r.findings[0].detail, 'Styled mathematical-alphanumeric character, decodes to plain "H"');
  assert.equal(r.findings[1].detail, 'Fullwidth form, decodes to plain "A"');
  assert.equal(r.normalization.nfkcChanged, true);
  assert.equal(r.normalization.nfkcResult, 'Hi Ab');
});

test('scan: normalisation changes are reported with the normalised text', () => {
  const r = scan('cafe\u0301');                          // e + COMBINING ACUTE ACCENT
  assert.deepEqual(r.normalization, { nfcChanged: true, nfkcChanged: true, nfcResult: 'café', nfkcResult: 'café' });
});

test('sha256Hex agrees with Node\'s SHA-256', async () => {
  assert.equal(await sha256Hex('abc'), nodeSha('abc'));
});

test('makeReport: the export the page offers, with both hashes', async () => {
  const text = 'a\u200Bb';
  const exp = await makeReport(text);
  assert.equal(exp.tool, 'glyphguard');
  assert.equal(exp.version, '1.0.0');
  assert.deepEqual(exp.report, scan(text));
  assert.equal(exp.inputHash, nodeSha(text));
  assert.equal(exp.reportHash, nodeSha(stableStringify(scan(text))));
});

test('verifyExport: a genuine export verifies; any edit, or the wrong text, does not', async () => {
  const text = 'secure-b\u0430nk.example';
  const exp = await makeReport(text);
  assert.deepEqual(await verifyExport(text, exp),
    { ok: true, notAnExport: false, contentMatches: true, inputHashMatches: true, reportHashSelfConsistent: true });
  const edited = JSON.parse(JSON.stringify(exp));
  edited.report.counts.confusable = 0;
  assert.deepEqual(await verifyExport(text, edited),
    { ok: false, notAnExport: false, contentMatches: false, inputHashMatches: true, reportHashSelfConsistent: true });
  const noHashes = { report: edited.report };
  assert.deepEqual(await verifyExport(text, noHashes),
    { ok: false, notAnExport: false, contentMatches: false, inputHashMatches: null, reportHashSelfConsistent: null });
  assert.equal((await verifyExport(text, { report: exp.report })).ok, true);
  const wrongInput = { ...exp, inputHash: '0'.repeat(64) };
  assert.deepEqual(await verifyExport(text, wrongInput),
    { ok: false, notAnExport: false, contentMatches: true, inputHashMatches: false, reportHashSelfConsistent: true });
  const wrongReportHash = { ...exp, reportHash: '0'.repeat(64) };
  assert.equal((await verifyExport(text, wrongReportHash)).reportHashSelfConsistent, false);
  assert.equal((await verifyExport(text, wrongReportHash)).ok, false);
  assert.equal((await verifyExport('other text', exp)).ok, false);
});

test('verifyExport never throws: anything that is not an export is reported as such', async () => {
  const not = { ok: false, notAnExport: true, contentMatches: false, inputHashMatches: null, reportHashSelfConsistent: null };
  assert.deepEqual(await verifyExport('t', null), not);
  assert.deepEqual(await verifyExport('t', 'a string'), not);
  assert.deepEqual(await verifyExport('t', { inputHash: 'x' }), not);
});

# Kar-Glyphguard

**Live:** https://sjgant80-hub.github.io/kar-glyphguard/

Deterministic Unicode integrity auditor — **no LLM judge**. Paste any text (a prompt, a model output, a
pasted document) and it scans for the tricks that hide in characters: invisible/zero-width characters,
homoglyph lookalikes, bidi overrides, hidden Unicode-tag payloads (ASCII smuggling), and styled/fullwidth
letter evasion. It emits a SHA-256-hashed, byte-for-byte re-runnable JSON report — a verdict a third party
can reproduce exactly — with a live self-test that proves the tamper-detection loop end-to-end.

One self-contained HTML file — no backend, no network, nothing sent anywhere, runs in your browser.

**Honest limit:** the homoglyph list (~40 entries) and mixed-script heuristic are curated, not the full
Unicode Confusables database. "Clean" means these specific known tricks weren't found — not that the text
is safe.

## Use it from an agent

`SKILL.md` makes this repository an agent skill in the open SKILL.md format (Claude Code, Codex CLI, Cursor and
others read it). The agent runs `scripts/kar-glyphguard.mjs`, one Node.js 20+ file with no dependencies and no network,
and gets the same verdicts and the same receipt hash as this page:

    node scripts/kar-glyphguard.mjs examples/hidden-tag-text.json

`node make-zip.mjs` checks the package against Agensi's published rules and builds `dist/kar-glyphguard.zip`, the
upload for the Agensi skill marketplace. CI builds the same ZIP on every push and prints its SHA-256.

## Proof

- **One source of truth:** the KERNEL block of `index.html` is the verifier. `node build.mjs` copies it
  byte-for-byte into `kernel.mjs` and into the skill script; CI fails if the three ever differ.
- **Tests:** `npm test` runs the kernel tests, and runs the skill script alone in an empty folder, the way
  Agensi runs it, against the expected outputs in `examples/`.
- **Mutation gate:** witness v0.6 made 39 single-operator mutants of `kernel.mjs` and the tests caught
  37; the other 2 are equivalent mutants, reasons in `witness.baseline.json`. Receipt: `receipts/witness.json` (kernel SHA-256 `e1acffa77316423b…`).
  CI re-runs the gate on every push: https://github.com/sjgant80-hub/kar-glyphguard/actions/workflows/ci.yml

Powered by the Konomi architecture, created by Thomas Frumkin. MIT licence (see `LICENSE`).

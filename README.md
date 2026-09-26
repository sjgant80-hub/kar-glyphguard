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

Built by **Kar** (karma-didy) on the FallForge estate.

# Website verification

This repository is the static production website, not the separate source project. Reconcile these changes before any later source-project deployment, as required by VENDOR-HANDOFF.md.

## Regression tests

No package installation or build step is required. With Node.js 22 or later:

```sh
node --test tests/btc-live.test.mjs
node tests/hero.test.mjs
node tests/navigation.test.mjs
git diff --check
```

The tracker tests use deterministic source-shaped fixtures and mocked requests/timers. They do not access or modify Firebase. The other suites exercise the actual navigation and headline scripts with event/DOM mocks.

## Manual preview

```sh
python -m http.server 8080 --bind 127.0.0.1
```

Check all changed pages at desktop and narrow phone widths, especially:

- About expansion, keyboard traversal, Escape, and child destinations.
- Homepage character-by-character typing/deletion, blinking caret, no Play/Pause control, reduced motion, and tab visibility. The hero suite compares exact character-change timestamps against Rezo's original animation over 30 seconds, not just completed phrases.
- Media modal cleanup and original-source links when a platform blocks embedding.
- Research summary refresh, per-field observation dates, dashboard navigation, and research downloads.
- Normal indexing on canonical pages; noindex only on aliases and 404.

## Bitcoin source contract

The public Firestore endpoint and backend configuration are unchanged. Only the research page polls it, every five minutes while visible, with request deduplication, a ten-second timeout, and resume handling. On failure the last rendered snapshot remains, with its original dates and an explanatory message.

The displayed status is always **Snapshot data**. The document update timestamp is separate from the price/drawdown observation dates. Missing, invalid, or future observation dates withhold the corresponding market value. A source success does not imply current market observations.

The recorded phase preserves the dashboard's existing indicator classification rules. This is not an independent validation of its financial methodology. Phase inputs can be older or differently dated. The elapsed-day clock matches the dashboard's nearest-day rounding from October 6, 2025 UTC; it changes at UTC noon, not midnight.

During September 6 integration QA (Manila time), the source returned market observations dated August 30 and reported a CoinGlass access-plan error for some inputs. That upstream limitation cannot be repaired in this repository. Firebase administration and provider subscription changes require the owner's separate action. No alternative market provider was substituted.

## Release boundaries

This integration is proposed on a branch for review. No production deployment is implied by local tests. Before merging, rerun the checks against the final branch and reconcile concurrent main changes. After an approved merge, verify the GitHub Pages deployment and the actual public pages. A provider outage, third-party embed restriction, native device/browser difference, or later source-project overwrite is not covered by mocked tests.

Use ordinary revert commits for rollback. Do not force-push, change domain/deployment controls, or modify owner-controlled recovery workflows.

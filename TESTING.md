# Website verification

This repository is the static production website, not the separate source project. Reconcile these changes before any later source-project deployment, as required by VENDOR-HANDOFF.md.

## Regression tests

No package installation or build step is required. With Node.js 22 or later:

```sh
node --test tests/btc-live.test.mjs
node tests/hero.test.mjs
node tests/navigation.test.mjs
node tests/links.test.mjs
node --test tests/home-editorial.test.mjs
git diff --check
```

The tracker tests use deterministic source-shaped fixtures and mocked requests/timers. They do not access or modify Firebase. The other suites exercise the actual navigation and headline scripts with event/DOM mocks.

The link suite checks internal HTML destinations and anchors against the case-sensitive repository inventory, parses structured data, and guards against retired summit URLs. It runs offline; external URLs still require a separate HTTP check. A social platform blocking automated access is not evidence that its link is broken.

The homepage editorial suite guards the approved excerpts, 12px footer, homepage-only CSS scope, indexing directives and fingerprints of the unchanged hero/navigation/research and media-player regions. Intentional future changes to those regions require an explicit fingerprint update after review, not removal of the protection. Desktop/mobile layout is checked separately in a browser.

Writing openings are retained source text, not generated summaries. The featured passage is explicitly from the original conclusion, not the opening. Preserve the source URL and label. Future content refreshes must verify the original text, stop before unrelated sections and cut openings at word boundaries; do not infer a new excerpt from the title. The media descriptions are short editorial context, not transcript quotations. No browser-time scraping or new automation is introduced by this release.

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

## AI Money interactive research page

Run `node --test tests/ai-money.test.mjs` alongside the existing suites. The test independently groups the 1,260 public CSV classifications, checks all four chart count vectors and all 20 model cells, including tied leaders, and checks static fallback content and the preserved navigation fingerprint.

The HTML contains the default chart and full model table. The page-only script progressively enables sorting and a mobile role picker; it does not fetch, regenerate or alter the research dataset. Without JavaScript, the labeled static chart, horizontally scrollable model table, methodology and downloads remain available.

Browser release checks: all four sort categories, all four mobile model roles, rapid switching, keyboard focus, native disclosures, About menu, 320px through 1920px viewports, doubled root text size, and readable no-script fallback. Automated checks do not certify every assistive technology or physical device.

## Writings archive

Run `node --test tests/writing-archive.test.mjs` or all suites with `node --test tests/*.test.mjs`.

The archive is static HTML in `writing/index.html`, with page-scoped styles and a progressive year-navigation script. It adds no dependency, browser-time source scraping or backend. Tests freeze the 18 approved source records and unchanged header/footer, and cover metadata, legacy anchors, scroll selection and absent ResizeObserver. All excerpts and source links remain available without JavaScript.

When adding a writing, verify the original text, truncate at a word boundary to no more than 400 Unicode characters including the continuation ellipsis, and retain its actual source date. The Non-Custodial passage is explicitly a conclusion excerpt. Update the visible year groups/counts and CollectionPage ItemList together. The 2023-and-earlier grouping retains actual years on entries. Update the frozen record digest only after reviewing the new records against their sources.

Keep the compatibility anchors for `/conversations/`, `/press/` and `/appearances/`; they lead to the existing Media handoff. Individual article/summary pages remain intact. Reconcile this static implementation into the separate source project before any later source-project deployment.

## Release boundaries

### Media archive maintenance

The Media page is generated from `data/media.json` with `node scripts/build-media.mjs`. Commit both the list and the generated `media/index.html`. Run `node scripts/build-media.mjs --check` and `node --test tests/*.test.mjs` before publishing. No new dependency, browser-time content fetch or automatic publishing is introduced.

For each addition, verify the original title, publisher, date, source URL and short factual description. These descriptions are editorial context, not transcript quotes. Dates use UTC publication dates; Episode 03 is July 13, 2026 UTC (July 14 in Manila). Never infer a video recording from an event photograph. Only verified recordings have durations and players. Keep original-source links even when embedding is available.

Use unique `featuredOrder` values from 1 to 6 to curate featured items, with genuine imagery and alt text. Featured entries are excluded from the regular lists. Additional podcasts and press records sort newest first. Adding an episode does not automatically feature it or alter the homepage. This release preserves all existing Media summary routes. Review source records and their test digest together when updating content.

Check desktop, tablet and phone layouts; all three player types; Escape and focus restoration; ordinary and modified-click source links; and platform-blocked fallback. Images are original publisher-hosted assets and may need a verified replacement if their URLs expire. The page uses static HTML and a CollectionPage ItemList reflecting the visible records. No fabricated video schema is added. The shared homepage player and site navigation are unchanged.

This integration is proposed on a branch for review. No production deployment is implied by local tests. Before merging, rerun the checks against the final branch and reconcile concurrent main changes. After an approved merge, verify the GitHub Pages deployment and the actual public pages. A provider outage, third-party embed restriction, native device/browser difference, or later source-project overwrite is not covered by mocked tests.

Use ordinary revert commits for rollback. Do not force-push, change domain/deployment controls, or modify owner-controlled recovery workflows.

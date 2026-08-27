# Rezo Shmertz Website — Vendor Handoff

This document defines the autonomous publishing and recovery workflow for the public website.

- Live website: <https://rezoshmertz.com>
- Production repository: <https://github.com/rezo-sys/rezoshmertz.com>
- Production branch: `main`
- GitHub collaborator: `writerzzub`

## Access and responsibility

`writerzzub` has permission to update the production repository and push directly to `main`. Routine website updates may be published without waiting for Rezo to review or approve them.

This access covers the static production website: HTML, CSS, client-side JavaScript, images, research pages, articles, links, structured data, and search metadata.

GoDaddy access is not included. DNS, domain ownership, nameservers, and registrar settings remain outside this handoff.

Firebase administration access is not included. The Bitcoin Cycle data source and its backend remain outside this handoff. The website may consume the existing public data interface, but its endpoint, permissions, and backend configuration must not be changed without separate written authorization.

## Important repository limitation

This repository contains the generated production version of the website, not the complete React/Vinext source project. Direct edits here are valid production edits and publish through GitHub Pages, but they can be overwritten by a later deployment from the source project.

Before any future source-project deployment, the person deploying must first review and reconcile production changes from this repository. Do not assume the separate source project already contains the latest copy, design, research, images, or metadata.

## Autonomous publishing workflow

Work in small, focused commits so every production change remains easy to inspect and reverse.

```bash
git clone https://github.com/rezo-sys/rezoshmertz.com.git
cd rezoshmertz.com
git pull --ff-only origin main

# Edit and test the website.

git status
git diff --check
git add <files-you-intend-to-publish>
git commit -m "Describe the website update"
git push origin main
```

A normal push to `main` publishes through GitHub Pages. Pull before every editing session and again before pushing if the session was long. If `git pull --ff-only` cannot complete, stop and reconcile the concurrent changes; never solve this with a force-push.

Do not:

- force-push or rewrite `main` history;
- delete or rename the `main` branch;
- commit passwords, API keys, private datasets, proprietary source files, or credentials;
- change `CNAME`, DNS assumptions, domain configuration, or Firebase endpoints without separate authorization;
- remove recovery workflows or snapshot tags;
- silently replace research claims, dates, sources, or live-data labels without verifying them.

## Local preview and checks

From the repository root:

```bash
python3 -m http.server 8080
```

Open <http://127.0.0.1:8080/> and inspect every page affected by the change. At minimum, check desktop and mobile widths, navigation links, images, browser console errors, title and description metadata, and the live Bitcoin readout when relevant.

After publishing, verify:

- <https://rezoshmertz.com/>
- <https://rezoshmertz.com/about/>
- <https://rezoshmertz.com/writing/>
- <https://rezoshmertz.com/research/>
- <https://rezoshmertz.com/research/ai-money/>
- every page, asset, or external link changed in the update.

GitHub Pages deployment status is available under **Actions** in the production repository. A green commit alone is not enough: confirm that the live URL contains the intended update.

## Automatic archives

The **Daily website snapshot** GitHub Actions workflow runs every day and can also be started manually.

Each successful run creates:

1. an immutable annotated tag named `snapshot-YYYY-MM-DD` pointing to that day's production commit; and
2. a downloadable ZIP archive plus a manifest retained by GitHub Actions for 60 days.

Snapshot tags remain in Git history unless a repository administrator deliberately removes them. This provides recovery points beyond the 60-day downloadable-artifact window.

To create an additional snapshot before a high-risk update:

1. Open the repository on GitHub.
2. Select **Actions**.
3. Select **Daily website snapshot**.
4. Select **Run workflow** on `main`.
5. Wait for the run to finish successfully before publishing the risky change.

## Recovery options

### Reverse one known commit

Use `git revert` when one specific commit caused the problem. This preserves history and publishes the reversal normally.

```bash
git pull --ff-only origin main
git revert <bad-commit-sha>
git push origin main
```

### Restore the full site from a daily snapshot

Use the **Restore website snapshot** workflow when the current production tree must be returned to a known daily state.

1. Open **Actions** → **Restore website snapshot** → **Run workflow**.
2. Enter an exact tag such as `snapshot-2026-08-27`.
3. Leave `apply` set to `false` and run the workflow.
4. Download and inspect the generated restore-preview artifact.
5. If the preview is correct, run the workflow again with the same tag and set `apply` to `true`.

The workflow creates and pushes an ordinary restore commit. It does not reset, erase, or force-push history. If the selected snapshot already matches production, it safely makes no commit.

## Escalation boundaries

Pause and contact Rezo before proceeding if a change requires any of the following:

- GoDaddy, DNS, nameserver, or domain ownership access;
- Firebase administration, private data, or backend permissions;
- GitHub billing, repository visibility, ownership, or collaborator changes;
- replacement of the deployment architecture or source repository;
- removal of recovery controls;
- publication of confidential or proprietary material.

Within the website-editing scope above, the collaborator is expected to work autonomously, publish directly, verify the live result, and use the recovery system when necessary.

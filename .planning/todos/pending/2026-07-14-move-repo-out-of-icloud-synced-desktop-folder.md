---
created: 2026-07-14T23:10:53Z
title: Move repo out of iCloud-synced Desktop folder
area: tooling
files:
  - scripts/sync-code.sh
  - glomalin-portal/public/sw 8.js (iCloud conflict-copy example)
---

## Problem

The repo lives at ~/Desktop/my-project-one, which is covered by iCloud "Desktop & Documents" sync. iCloud interferes with the working tree two ways:

1. **Build eviction (caused a prod outage):** on 2026-07-14, iCloud evicted a fresh `glomalin-portal/.next` build between `npm run build` and rsync — the deploy shipped a 236K husk with no BUILD_ID, and `rsync --delete` wiped the droplet's working build → portal crash-looped ~10 minutes until rebuilt.
2. **Conflict litter:** iCloud drops `name 2`-style duplicates into the tree (`sw 8.js`, `sw 9.js`, `sw 10.js`, `.next/server 2/`), which pollute git status and rsync payloads.

Interim mitigation is in place (deploy workflow now stages `.next` to `/private/tmp` before path-patching and rsync — see the portal deploy workflow memory), but the root cause remains.

## Solution

Options, roughly in order of preference:
- Move the repo to a non-synced location (e.g. `~/src/my-project-one`) and leave a symlink on Desktop if muscle memory needs it. Coordinate with docfoxtapus — both benches use this path, and open sessions/editors will hold stale paths.
- Or disable "Desktop & Documents Folders" in iCloud settings (affects everything on Desktop, not just this repo).
- Either way, delete the stray `sw 8/9/10.js` conflict copies afterward.

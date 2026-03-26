---
status: complete
phase: 48-grain-tickets-pwa-dashboard-caching
source: 48-01-SUMMARY.md, 48-02-SUMMARY.md
started: 2026-03-25T22:00:00Z
updated: 2026-03-25T22:15:00Z
---

## Current Test
<!-- OVERWRITE each test - shows where we are -->

[testing complete]

## Tests

### 1. Offline Banner (Grain Tickets)
expected: With network disabled, an amber banner appears fixed at the top of the grain-tickets page. Re-enabling network makes it disappear.
result: pass

### 2. Offline Ticket Entry
expected: With network disabled, fill out and submit the ticket form. It should show a "queued" toast confirmation, reset the form, and NOT show an error. The ticket should appear in the Ticket Log with an amber "pending sync" badge.
result: pass

### 3. Pending Ticket Sync on Reconnect
expected: After entering a ticket offline, re-enable network. The pending ticket should automatically sync (Background Sync or manual fallback). A brief toast shows the count of synced tickets. The pending badge disappears and the ticket appears as a normal entry.
result: pass

### 4. Pending Ticket Edit/Delete Before Sync
expected: While still offline with a pending ticket, click Edit on the pending row — the edit modal opens pre-filled. Make a change and save — it updates the pending entry. Click Delete on a pending row — it removes the entry from the list.
result: pass

### 5. Duplicate Ticket Conflict Resolution
expected: If a synced ticket returns a 409 (duplicate ticket number), the row turns red with a "conflict" badge. Expanding it shows a side-by-side comparison of your entry vs the existing one. Three options appear: "Keep Mine" (prompts for new ticket #), "Keep Existing" (discards yours), "Edit & Retry" (opens editor).
result: pass

### 6. Dashboard Loads Offline (Portal)
expected: Open the glomalin-portal dashboard (port 3010), let it load fully once. Then go offline. Refresh the page — the budget, FSA, and insurance summary cards should still render with cached data instead of showing an error or blank screen.
result: pass

### 7. Dashboard Staleness Indicator
expected: With the dashboard loaded from cache, it shows a "Last updated X ago" timestamp on the summary cards. If the cached data is older than 24 hours, a subtle warning appears indicating the data may be outdated.
result: pass

### 8. Dashboard Background Refresh
expected: With the dashboard showing cached/stale data, re-enable network. The dashboard should silently refresh in the background — summary card values update to current data and the "Last updated" timestamp resets.
result: pass

## Summary

total: 8
passed: 8
issues: 0
pending: 0
skipped: 0

## Gaps

[none yet]

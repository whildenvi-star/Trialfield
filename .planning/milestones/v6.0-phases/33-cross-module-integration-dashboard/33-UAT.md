---
status: testing
phase: 33-cross-module-integration-dashboard
source: [33-01-SUMMARY.md, 33-02-SUMMARY.md]
started: 2026-03-06T21:00:00Z
updated: 2026-03-06T21:00:00Z
---

## Current Test

number: 1
name: CLU Card Shows Insurance Policy Link
expected: |
  Expand a CLU card in the FSA module. After a brief load, you should see either a "View Insurance Policy" link (if a policy exists for that CLU's farm+crop) or a "No policy -- Add one" link. Clicking "View Insurance Policy" should navigate to the Insurance page with that policy highlighted.
awaiting: user response

## Tests

### 1. CLU Card Shows Insurance Policy Link
expected: Expand a CLU card in the FSA module. After a brief load, you should see either a "View Insurance Policy" link (if a policy exists for that CLU's farm+crop) or a "No policy -- Add one" link. Clicking "View Insurance Policy" should navigate to the Insurance page with that policy highlighted.
result: [pending]

### 2. Prevented Planting Checkbox
expected: In an expanded CLU card, you should see a "Prevented Planting" checkbox. Checking it should immediately show an amber/yellow inline banner prompting to create a claim.
result: [pending]

### 3. Prevented Planting Claim Creation
expected: When the amber prevented planting banner appears, clicking "Create Claim" should POST a new claim and navigate you to the Claims module. If no policy is linked, you should see an "Add Policy First" option instead.
result: [pending]

### 4. File Claim Button on Insurance Policy
expected: In the Insurance module, each policy row should have a "+ Claim" button in the Actions column. Clicking it should create a claim linked to that policy and navigate to the Claims module.
result: [pending]

### 5. Dashboard FSA Summary Card
expected: The portal dashboard should show an FSA card displaying the count of reported CLUs vs total (e.g., "312 / 444"). Clicking it should navigate to the FSA module.
result: [pending]

### 6. Dashboard Insurance Summary Card
expected: The dashboard should show an Insurance card with policy/alert counts. If there are claim alerts, the card should have a yellow/amber highlight. Clicking navigates to Insurance module.
result: [pending]

### 7. Dashboard Claims Summary Card
expected: The dashboard should show a Claims card with the open claims count. Clicking it navigates to the Claims module.
result: [pending]

### 8. Dashboard Graceful Degradation
expected: If one of the three database tables is unreachable or returns an error, the affected card should show a dash character (—) instead of crashing the entire dashboard. Other cards should still display their data normally.
result: [pending]

## Summary

total: 8
passed: 0
issues: 0
pending: 8
skipped: 0

## Gaps

[none yet]

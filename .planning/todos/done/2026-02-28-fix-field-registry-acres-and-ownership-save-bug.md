---
created: 2026-02-28T20:40:13.672Z
title: Fix field registry acres and ownership save bug
area: farm-registry
files:
  - farm-registry/
---

## Problem

In the farm-registry app (port 3005), editing a field's acres or ownership status does not persist after saving. The values revert to their previous state on save. This affects the admin UI's split-panel edit form (right side) — specifically the reportingAcres, organicAcres, and ownership fields.

Since farm-registry is the central source of truth for acres across all apps (grain-tickets, farm-budget, organic-cert), incorrect acre data here propagates downstream.

## Solution

Investigate the save handler in the admin UI and the corresponding API endpoint (likely PUT/PATCH on /api/fields/:id). Check:
1. Whether the form is sending the updated values in the request body
2. Whether the API route is reading and applying those fields during the update
3. Whether the response or re-fetch after save is overwriting with stale data
4. Possible field name mismatch between frontend form state and backend schema

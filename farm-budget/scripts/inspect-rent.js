#!/usr/bin/env node
'use strict';
var fs = require('fs');
var path = require('path');

var data = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'data.json'), 'utf8'));
var active = data.rent.filter(function(r) { return r.active !== false; });

console.log('Active rent parcels: ' + active.length);
console.log('Total rent parcels: ' + data.rent.length);
console.log('\n--- Active Rent Parcels ---');
var totalDollars = 0;
active.forEach(function(r) {
  var t = r.totalRent || (r.acres * r.rentRate) || 0;
  totalDollars += t;
  console.log(r.fieldName + ' | ' + r.acres + ' ac | $' + (r.rentRate || 0) + '/ac | $' + Math.round(t));
});
console.log('\nTotal annual rent: $' + Math.round(totalDollars).toLocaleString());

// Also check registry fields
var regData = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'farm-registry', 'data', 'data.json'), 'utf8'));
var regFields = regData.fields.filter(function(f) { return f.active !== false; });
console.log('\n--- Registry Fields: ' + regFields.length + ' ---');

// Match rent parcels to registry
console.log('\n--- Matching ---');
var matched = 0;
var unmatched = [];
active.forEach(function(r) {
  var name = (r.fieldName || '').trim().toLowerCase();
  var found = regFields.find(function(f) {
    return f.name.toLowerCase() === name ||
      (f.aliases || []).some(function(a) { return a.toLowerCase() === name; });
  });
  if (found) {
    matched++;
  } else {
    unmatched.push(r.fieldName);
  }
});
console.log('Matched: ' + matched + ' / ' + active.length);
console.log('Unmatched: ' + unmatched.length);
if (unmatched.length) {
  unmatched.forEach(function(n) { console.log('  - ' + n); });
}

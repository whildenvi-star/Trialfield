#!/usr/bin/env node
'use strict';
var fs = require('fs');
var path = require('path');
var data = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'farm-registry', 'data', 'data.json'), 'utf8'));
var active = data.fields.filter(function(f) { return f.active !== false; });
active.sort(function(a,b) { return a.name.localeCompare(b.name); });
active.forEach(function(f) {
  console.log(f.name + ' [' + (f.aliases || []).join(', ') + ']');
});

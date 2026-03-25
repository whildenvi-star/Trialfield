// Crop Colors — shared utility for consistent crop coloring across all views
var CropColors = (function () {
  'use strict';

  // Convert hex to HSL
  function hexToHsl(hex) {
    hex = hex.replace('#', '');
    var r = parseInt(hex.substring(0, 2), 16) / 255;
    var g = parseInt(hex.substring(2, 4), 16) / 255;
    var b = parseInt(hex.substring(4, 6), 16) / 255;
    var max = Math.max(r, g, b), min = Math.min(r, g, b);
    var h, s, l = (max + min) / 2;
    if (max === min) {
      h = s = 0;
    } else {
      var d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
      else if (max === g) h = ((b - r) / d + 2) / 6;
      else h = ((r - g) / d + 4) / 6;
    }
    return [Math.round(h * 360), Math.round(s * 100), Math.round(l * 100)];
  }

  // Convert HSL to hex
  function hslToHex(h, s, l) {
    h /= 360; s /= 100; l /= 100;
    var r, g, b;
    if (s === 0) {
      r = g = b = l;
    } else {
      function hue2rgb(p, q, t) {
        if (t < 0) t += 1;
        if (t > 1) t -= 1;
        if (t < 1/6) return p + (q - p) * 6 * t;
        if (t < 1/2) return q;
        if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
        return p;
      }
      var q = l < 0.5 ? l * (1 + s) : l + s - l * s;
      var p = 2 * l - q;
      r = hue2rgb(p, q, h + 1/3);
      g = hue2rgb(p, q, h);
      b = hue2rgb(p, q, h - 1/3);
    }
    var toHex = function (c) { var v = Math.round(c * 255).toString(16); return v.length === 1 ? '0' + v : v; };
    return '#' + toHex(r) + toHex(g) + toHex(b);
  }

  // Generate N shade variants from a base hex color
  function generateShades(hex, count) {
    if (count <= 1) return [hex];
    var hsl = hexToHsl(hex);
    var h = hsl[0], s = hsl[1], baseL = hsl[2];
    var shades = [];
    // Spread lightness from (baseL - 15) to (baseL + 20), clamped 15..85
    var minL = Math.max(15, baseL - 15);
    var maxL = Math.min(85, baseL + 20);
    var step = (maxL - minL) / (count - 1);
    for (var i = 0; i < count; i++) {
      var l = Math.round(minL + step * i);
      shades.push(hslToHex(h, s, l));
    }
    return shades;
  }

  // Cache for lookups
  var _cache = {};
  var _cacheVersion = 0;

  function invalidateCache() {
    _cache = {};
    _cacheVersion++;
  }

  // Find crop type containing a sub-crop name
  function findCropType(cropName) {
    if (!cropName) return null;
    var key = cropName.toLowerCase();
    if (_cache[key]) return _cache[key];

    var cropTypes = (window.refData && window.refData.cropTypes) || [];
    for (var i = 0; i < cropTypes.length; i++) {
      var ct = cropTypes[i];
      var subs = ct.subCrops || [];
      for (var j = 0; j < subs.length; j++) {
        if (subs[j].name.toLowerCase() === key) {
          var result = { cropType: ct, subCrop: subs[j], subIndex: j };
          _cache[key] = result;
          return result;
        }
      }
    }
    return null;
  }

  // Registry crop ID → color map (populated when registry crops are fetched)
  var _registryCropColors = {};

  /**
   * Set registry crop color map from fetched /api/registry/crops data.
   * Called by field-editor.js after fetching the registry crop list.
   */
  function setRegistryCropColors(registryCrops) {
    // Assign deterministic colors from cropTypes if available; otherwise generate from crop id
    _registryCropColors = {};
    registryCrops.forEach(function (c) {
      // Try to match by name to existing cropType for color continuity
      var found = findCropType(c.name);
      if (found) {
        var ct = found.cropType;
        var shadeIdx = found.subCrop.shadeIndex !== undefined ? found.subCrop.shadeIndex : found.subIndex;
        var shades = generateShades(ct.color, (ct.subCrops || []).length);
        _registryCropColors[c.id] = shades[shadeIdx % shades.length];
      }
      // If no match, a deterministic hue based on crop id provides a stable color
      else {
        var hashVal = 0;
        for (var k = 0; k < c.id.length; k++) hashVal = (hashVal * 31 + c.id.charCodeAt(k)) & 0xffffffff;
        _registryCropColors[c.id] = hslToHex(Math.abs(hashVal % 360), 45, 40);
      }
    });
  }

  // Get color for any sub-crop name; optionally pass registryCropId for canonical lookup
  function getCropColor(cropName, registryCropId) {
    // Prefer registry-based color when a canonical ID is available
    if (registryCropId && _registryCropColors[registryCropId]) {
      return _registryCropColors[registryCropId];
    }
    var found = findCropType(cropName);
    if (!found) return '#455a64';
    var ct = found.cropType;
    var shadeIdx = found.subCrop.shadeIndex !== undefined ? found.subCrop.shadeIndex : found.subIndex;
    var shades = generateShades(ct.color, (ct.subCrops || []).length);
    return shades[shadeIdx % shades.length];
  }

  // Get base color for a crop type name (not sub-crop)
  function getCropTypeColor(typeName) {
    if (!typeName) return '#455a64';
    var cropTypes = (window.refData && window.refData.cropTypes) || [];
    for (var i = 0; i < cropTypes.length; i++) {
      if (cropTypes[i].name.toLowerCase() === typeName.toLowerCase()) {
        return cropTypes[i].color;
      }
    }
    return '#455a64';
  }

  // Get crop type name for a sub-crop name
  function getCropTypeName(cropName) {
    var found = findCropType(cropName);
    return found ? found.cropType.name : null;
  }

  // Determine if text on this color should be white or dark
  function textColorFor(hex) {
    hex = hex.replace('#', '');
    var r = parseInt(hex.substring(0, 2), 16);
    var g = parseInt(hex.substring(2, 4), 16);
    var b = parseInt(hex.substring(4, 6), 16);
    var luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminance > 0.55 ? '#333' : '#fff';
  }

  return {
    generateShades: generateShades,
    getCropColor: getCropColor,
    getCropTypeColor: getCropTypeColor,
    getCropTypeName: getCropTypeName,
    findCropType: findCropType,
    textColorFor: textColorFor,
    invalidateCache: invalidateCache,
    setRegistryCropColors: setRegistryCropColors
  };
})();

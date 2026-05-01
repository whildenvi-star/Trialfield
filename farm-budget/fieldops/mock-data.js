'use strict';

// Mock FieldOps API responses — field names match real data.json entries
// for testing the sync matching logic. Coordinates are approximate central IL.

var MOCK_FIELDS = [
  {
    id: 'fo-field-001',
    name: 'Blues',
    farmName: 'Home Farm',
    boundary: {
      type: 'Feature',
      geometry: {
        type: 'Polygon',
        coordinates: [[[-89.052, 41.523], [-89.038, 41.523], [-89.038, 41.514], [-89.052, 41.514], [-89.052, 41.523]]]
      },
      properties: { area: { value: 134.6, unit: 'ac' } }
    },
    area: { value: 134.6, unit: 'ac' }
  },
  {
    id: 'fo-field-002',
    name: 'Carrol',
    farmName: 'Home Farm',
    boundary: {
      type: 'Feature',
      geometry: {
        type: 'Polygon',
        coordinates: [[[-89.071, 41.530], [-89.055, 41.530], [-89.055, 41.520], [-89.071, 41.520], [-89.071, 41.530]]]
      },
      properties: { area: { value: 151.67, unit: 'ac' } }
    },
    area: { value: 151.67, unit: 'ac' }
  },
  {
    id: 'fo-field-003',
    name: 'Cuffs',
    farmName: 'Home Farm',
    boundary: {
      type: 'Feature',
      geometry: {
        type: 'Polygon',
        coordinates: [[[-89.085, 41.518], [-89.070, 41.518], [-89.070, 41.508], [-89.085, 41.508], [-89.085, 41.518]]]
      },
      properties: { area: { value: 147.53, unit: 'ac' } }
    },
    area: { value: 147.53, unit: 'ac' }
  },
  {
    id: 'fo-field-004',
    name: 'Schultz',
    farmName: 'Home Farm',
    boundary: {
      type: 'Feature',
      geometry: {
        type: 'Polygon',
        coordinates: [[[-89.095, 41.535], [-89.083, 41.535], [-89.083, 41.527], [-89.095, 41.527], [-89.095, 41.535]]]
      },
      properties: { area: { value: 98.1, unit: 'ac' } }
    },
    area: { value: 98.1, unit: 'ac' }
  },
  {
    id: 'fo-field-005',
    name: 'Gessley',
    farmName: 'Home Farm',
    boundary: {
      type: 'Feature',
      geometry: {
        type: 'Polygon',
        coordinates: [[[-89.100, 41.510], [-89.080, 41.510], [-89.080, 41.498], [-89.100, 41.498], [-89.100, 41.510]]]
      },
      properties: { area: { value: 188, unit: 'ac' } }
    },
    area: { value: 188, unit: 'ac' }
  },
  {
    id: 'fo-field-099',
    name: 'New South 40',
    farmName: 'Home Farm',
    boundary: {
      type: 'Feature',
      geometry: {
        type: 'Polygon',
        coordinates: [[[-89.110, 41.505], [-89.103, 41.505], [-89.103, 41.500], [-89.110, 41.500], [-89.110, 41.505]]]
      },
      properties: { area: { value: 40.0, unit: 'ac' } }
    },
    area: { value: 40.0, unit: 'ac' }
  }
];

var MOCK_EQUIPMENT = [
  {
    id: 'fo-equip-001',
    name: '8250 Axial-Flow Combine',
    type: 'HARVESTER',
    model: '8250',
    make: 'Case IH',
    serialNumber: 'HAJ208345',
    telemetry: {
      totalEngineHours: 4520,
      fuelUsedGallons: 18200,
      lastReportedLocation: { lat: 41.51, lon: -89.04 },
      lastUpdated: '2026-02-20T14:30:00Z'
    }
  },
  {
    id: 'fo-equip-002',
    name: 'Magnum 340',
    type: 'TRACTOR',
    model: '340',
    make: 'Case IH',
    serialNumber: 'ZFRE05127',
    telemetry: {
      totalEngineHours: 6210,
      fuelUsedGallons: 31050,
      lastReportedLocation: { lat: 41.52, lon: -89.05 },
      lastUpdated: '2026-02-19T09:15:00Z'
    }
  },
  {
    id: 'fo-equip-003',
    name: 'Early Riser 2150',
    type: 'PLANTER',
    model: '2150',
    make: 'Case IH',
    serialNumber: 'YBT400891',
    telemetry: {
      totalEngineHours: 0,
      fuelUsedGallons: 0,
      lastReportedLocation: { lat: 41.52, lon: -89.05 },
      lastUpdated: '2025-05-10T16:00:00Z'
    }
  }
];

var MOCK_YIELD_DATA = [
  {
    fieldId: 'fo-field-001',
    fieldName: 'Blues',
    crop: 'Corn',
    season: '2025',
    yieldPerAcre: 198.5,
    totalYield: 26718.1,
    moisture: 17.2,
    harvestDate: '2025-10-15',
    area: { value: 134.6, unit: 'ac' }
  },
  {
    fieldId: 'fo-field-002',
    fieldName: 'Carrol',
    crop: 'Corn',
    season: '2025',
    yieldPerAcre: 211.3,
    totalYield: 32042.2,
    moisture: 18.8,
    harvestDate: '2025-10-18',
    area: { value: 151.67, unit: 'ac' }
  },
  {
    fieldId: 'fo-field-003',
    fieldName: 'Cuffs',
    crop: 'Corn',
    season: '2025',
    yieldPerAcre: 185.7,
    totalYield: 27401.1,
    moisture: 16.5,
    harvestDate: '2025-10-12',
    area: { value: 147.53, unit: 'ac' }
  },
  {
    fieldId: 'fo-field-004',
    fieldName: 'Schultz',
    crop: 'Corn',
    season: '2025',
    yieldPerAcre: 202.1,
    totalYield: 19826.0,
    moisture: 17.9,
    harvestDate: '2025-10-20',
    area: { value: 98.1, unit: 'ac' }
  },
  {
    fieldId: 'fo-field-005',
    fieldName: 'Gessley',
    crop: 'Corn',
    season: '2025',
    yieldPerAcre: 220.4,
    totalYield: 41435.2,
    moisture: 19.1,
    harvestDate: '2025-10-22',
    area: { value: 188, unit: 'ac' }
  }
];

var MOCK_APPLICATIONS = [
  // Blues — spring fertilizer
  {
    id: 'fo-app-001',
    fieldId: 'fo-field-001',
    fieldName: 'Blues',
    date: '2026-04-12',
    type: 'FERTILIZER',
    products: [
      { name: '46-0-0 Urea', rate: 220, unit: 'lbs/ac', totalApplied: 29612 },
      { name: '10-34-0', rate: 5, unit: 'gal/ac', totalApplied: 673 }
    ],
    area: { value: 134.6, unit: 'ac' },
    applicator: 'Self',
    notes: 'Pre-plant broadcast'
  },
  // Blues — herbicide
  {
    id: 'fo-app-002',
    fieldId: 'fo-field-001',
    fieldName: 'Blues',
    date: '2026-05-02',
    type: 'HERBICIDE',
    products: [
      { name: 'Resicore XL', rate: 2.75, unit: 'qt/ac', totalApplied: 370 }
    ],
    area: { value: 134.6, unit: 'ac' },
    applicator: 'Custom Hire',
    notes: 'Post-emerge herbicide'
  },
  // Carrol — nitrogen
  {
    id: 'fo-app-003',
    fieldId: 'fo-field-002',
    fieldName: 'Carrol',
    date: '2026-04-08',
    type: 'FERTILIZER',
    products: [
      { name: '28-0-0 UAN', rate: 50, unit: 'gal/ac', totalApplied: 7583 },
      { name: '0-0-60 Potash', rate: 150, unit: 'lbs/ac', totalApplied: 22750 }
    ],
    area: { value: 151.67, unit: 'ac' },
    applicator: 'Self',
    notes: 'Spring pre-plant'
  },
  // Carrol — insecticide
  {
    id: 'fo-app-004',
    fieldId: 'fo-field-002',
    fieldName: 'Carrol',
    date: '2026-06-15',
    type: 'INSECTICIDE',
    products: [
      { name: 'Besiege', rate: 10, unit: 'oz/ac', totalApplied: 1517 }
    ],
    area: { value: 151.67, unit: 'ac' },
    applicator: 'Aerial',
    notes: 'Western bean cutworm'
  },
  // Cuffs — fall fertilizer
  {
    id: 'fo-app-005',
    fieldId: 'fo-field-003',
    fieldName: 'Cuffs',
    date: '2025-11-05',
    type: 'FERTILIZER',
    products: [
      { name: 'DAP 18-46-0', rate: 200, unit: 'lbs/ac', totalApplied: 29506 },
      { name: '0-0-60 Potash', rate: 100, unit: 'lbs/ac', totalApplied: 14753 }
    ],
    area: { value: 147.53, unit: 'ac' },
    applicator: 'Self',
    notes: 'Fall dry spread'
  },
  // Schultz — herbicide
  {
    id: 'fo-app-006',
    fieldId: 'fo-field-004',
    fieldName: 'Schultz',
    date: '2026-05-10',
    type: 'HERBICIDE',
    products: [
      { name: 'Acuron', rate: 2.5, unit: 'qt/ac', totalApplied: 245 },
      { name: 'Roundup PowerMax 3', rate: 32, unit: 'oz/ac', totalApplied: 3139 }
    ],
    area: { value: 98.1, unit: 'ac' },
    applicator: 'Custom Hire',
    notes: 'Burndown + pre-emerge'
  },
  // Gessley — planting
  {
    id: 'fo-app-007',
    fieldId: 'fo-field-005',
    fieldName: 'Gessley',
    date: '2026-04-25',
    type: 'PLANTING',
    products: [
      { name: 'DKC 64-35', rate: 34000, unit: 'seeds/ac', totalApplied: 6392000 }
    ],
    area: { value: 188, unit: 'ac' },
    applicator: 'Self',
    notes: 'Corn planting — 34K pop'
  },
  // Gessley — fertilizer
  {
    id: 'fo-app-008',
    fieldId: 'fo-field-005',
    fieldName: 'Gessley',
    date: '2026-04-20',
    type: 'FERTILIZER',
    products: [
      { name: 'Anhydrous Ammonia', rate: 180, unit: 'lbs/ac', totalApplied: 33840 }
    ],
    area: { value: 188, unit: 'ac' },
    applicator: 'Self',
    notes: 'Spring anhydrous — knife'
  }
];

var MOCK_TELEMETRY = [
  {
    equipmentId: 'fo-equip-001',
    fieldId: 'fo-field-001',
    date: '2025-10-15',
    operationType: 'HARVEST',
    fuelUsed: 245,
    hoursOperated: 8.5,
    areaWorked: { value: 134.6, unit: 'ac' }
  },
  {
    equipmentId: 'fo-equip-002',
    fieldId: 'fo-field-002',
    date: '2026-04-08',
    operationType: 'TILLAGE',
    fuelUsed: 92,
    hoursOperated: 5.2,
    areaWorked: { value: 151.67, unit: 'ac' }
  },
  {
    equipmentId: 'fo-equip-003',
    fieldId: 'fo-field-005',
    date: '2026-04-25',
    operationType: 'PLANTING',
    fuelUsed: 78,
    hoursOperated: 6.8,
    areaWorked: { value: 188, unit: 'ac' }
  }
];

module.exports = {
  getFields: function () {
    return Promise.resolve(JSON.parse(JSON.stringify(MOCK_FIELDS)));
  },
  getFieldBoundary: function (fieldId) {
    var field = MOCK_FIELDS.find(function (f) { return f.id === fieldId; });
    return Promise.resolve(field ? JSON.parse(JSON.stringify(field.boundary)) : null);
  },
  getEquipment: function () {
    return Promise.resolve(JSON.parse(JSON.stringify(MOCK_EQUIPMENT)));
  },
  getYieldData: function () {
    return Promise.resolve(JSON.parse(JSON.stringify(MOCK_YIELD_DATA)));
  },
  getApplications: function () {
    return Promise.resolve(JSON.parse(JSON.stringify(MOCK_APPLICATIONS)));
  },
  getTelemetry: function () {
    return Promise.resolve(JSON.parse(JSON.stringify(MOCK_TELEMETRY)));
  }
};

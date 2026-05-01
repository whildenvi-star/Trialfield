'use strict';

var mockData = require('./mock-data');

var tokenCache = { accessToken: null, expiresAt: 0 };

function isConfigured() {
  return !!(process.env.FIELDOPS_CLIENT_ID &&
            process.env.FIELDOPS_CLIENT_SECRET &&
            process.env.FIELDOPS_SUBSCRIPTION_KEY);
}

function useMock() {
  return process.env.FIELDOPS_USE_MOCK === 'true' || !isConfigured();
}

async function getAccessToken() {
  // Return cached token if still valid (with 60s buffer)
  if (tokenCache.accessToken && Date.now() < tokenCache.expiresAt - 60000) {
    return tokenCache.accessToken;
  }

  var tokenUrl = process.env.FIELDOPS_TOKEN_URL ||
    'https://identity.cnhind.com/oauth/token';

  var params = new URLSearchParams({
    grant_type: 'client_credentials',
    scope: 'fields equipment yield applications telemetry'
  });

  var response = await fetch(tokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': 'Basic ' + Buffer.from(
        process.env.FIELDOPS_CLIENT_ID + ':' + process.env.FIELDOPS_CLIENT_SECRET
      ).toString('base64'),
      'Ocp-Apim-Subscription-Key': process.env.FIELDOPS_SUBSCRIPTION_KEY
    },
    body: params.toString()
  });

  if (!response.ok) {
    var errorBody = await response.text().catch(function () { return ''; });
    throw new Error('FieldOps token request failed (' + response.status + '): ' + errorBody);
  }

  var data = await response.json();
  tokenCache = {
    accessToken: data.access_token,
    expiresAt: Date.now() + (data.expires_in * 1000)
  };
  return tokenCache.accessToken;
}

async function apiGet(path, queryParams) {
  var token = await getAccessToken();
  var baseUrl = process.env.FIELDOPS_API_BASE || 'https://ag.api.cnhind.com';
  var url = new URL(path, baseUrl);
  if (queryParams) {
    Object.entries(queryParams).forEach(function (entry) {
      url.searchParams.set(entry[0], entry[1]);
    });
  }

  var response = await fetch(url.toString(), {
    headers: {
      'Authorization': 'Bearer ' + token,
      'Ocp-Apim-Subscription-Key': process.env.FIELDOPS_SUBSCRIPTION_KEY,
      'Accept': 'application/json'
    }
  });

  if (!response.ok) {
    throw new Error('FieldOps API ' + response.status + ' on ' + path);
  }
  return response.json();
}

module.exports = {
  isConfigured: isConfigured,
  useMock: useMock,

  getFields: function () {
    if (useMock()) return mockData.getFields();
    return apiGet('/v1/fields');
  },

  getFieldBoundary: function (fieldId) {
    if (useMock()) return mockData.getFieldBoundary(fieldId);
    return apiGet('/v1/fields/' + fieldId + '/boundary');
  },

  getEquipment: function () {
    if (useMock()) return mockData.getEquipment();
    return apiGet('/v1/equipment');
  },

  getYieldData: function (params) {
    if (useMock()) return mockData.getYieldData(params);
    return apiGet('/v1/yield', params);
  },

  getApplications: function (params) {
    if (useMock()) return mockData.getApplications(params);
    return apiGet('/v1/applications', params);
  },

  getTelemetry: function (params) {
    if (useMock()) return mockData.getTelemetry(params);
    return apiGet('/v1/telemetry', params);
  }
};

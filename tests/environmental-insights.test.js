const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const api = require('../weather-api.js');

test('builds a keyless Open-Meteo air quality request with local hourly data', () => {
  const url = new URL(api.buildAirQualityUrl(-1.2864, 36.8172));
  assert.equal(url.origin, 'https://air-quality-api.open-meteo.com');
  assert.equal(url.pathname, '/v1/air-quality');
  assert.equal(url.searchParams.get('hourly'), 'us_aqi,pm2_5,pm10');
  assert.equal(url.searchParams.get('forecast_hours'), '24');
  assert.equal(url.searchParams.get('timezone'), 'auto');
  assert.equal(url.searchParams.has('apikey'), false);
});

test('normalizes the nearest available air-quality hour and particulate values', () => {
  const result = api.normalizeAirQualityResponse({ hourly: {
    time: ['2026-11-19T11:00+03:00','2026-11-19T12:00+03:00'],
    us_aqi: [42, 78], pm2_5: [7.4, 12.2], pm10: [14, 23]
  } }, Date.parse('2026-11-19T12:05:00+03:00'));
  assert.equal(result.aqi, 78);
  assert.equal(result.pm25, 12.2);
  assert.equal(result.pm10, 23);
  assert.equal(result.category, 'Moderate');
});

test('maps US AQI breakpoints to clear health guidance', () => {
  assert.equal(api.airQualityCategory(25).label, 'Good');
  assert.equal(api.airQualityCategory(75).label, 'Moderate');
  assert.equal(api.airQualityCategory(125).label, 'Unhealthy for sensitive groups');
  assert.equal(api.airQualityCategory(175).label, 'Unhealthy');
  assert.equal(api.airQualityCategory(250).label, 'Very unhealthy');
  assert.equal(api.airQualityCategory(350).label, 'Hazardous');
});

test('returns a safe unavailable state when air-quality fields are missing', () => {
  const result = api.normalizeAirQualityResponse({ hourly: { time: ['2026-11-19T12:00+03:00'], us_aqi: [null], pm2_5: [null], pm10: [null] } });
  assert.equal(result.aqi, null);
  assert.equal(result.category, 'Unavailable');
  assert.match(result.advice, /not available/i);
});

test('includes UV and precipitation fields in forecast requests and normalized environmental data', () => {
  const url = new URL(api.buildForecastUrl(-1.2, 36.8));
  assert.match(url.searchParams.get('hourly'), /uv_index/);
  assert.match(url.searchParams.get('hourly'), /precipitation/);
  assert.match(url.searchParams.get('daily'), /uv_index_max/);
  assert.match(url.searchParams.get('daily'), /precipitation_sum/);
  const sample = {
    timezone: 'Africa/Nairobi',
    current: { time: '2026-11-19T12:00+03:00', temperature_2m: 23, weather_code: 1 },
    hourly: { time: ['2026-11-19T12:00+03:00'], temperature_2m: [23], relative_humidity_2m: [50], weather_code: [1], uv_index: [6.2], precipitation: [0.4], precipitation_probability: [35] },
    daily: { uv_index_max: [8.1], precipitation_sum: [2.5] }
  };
  const normalized = api.normalizeWeatherResponse(sample, { name: 'Nairobi', lat: -1.2, lon: 36.8 });
  assert.equal(normalized.fore.environment.hourly[0].uvIndex, 6.2);
  assert.equal(normalized.fore.environment.hourly[0].precipitation, 0.4);
  assert.equal(normalized.fore.environment.hourly[0].precipitationProbability, 35);
  assert.equal(normalized.fore.environment.dailyUvMax, 8.1);
  assert.equal(normalized.fore.environment.dailyPrecipitation, 2.5);
});

test('keeps environmental insights on the query-string route and in the offline app shell', () => {
  const root = path.join(__dirname, '..');
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const router = fs.readFileSync(path.join(root, 'features/page-router.js'), 'utf8');
  const worker = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');
  const moduleSource = fs.readFileSync(path.join(root, 'features/environmental-insights.js'), 'utf8');
  assert.match(html, /data-page-link="environment"/);
  assert.match(html, /features\/environmental-insights\.js/);
  assert.match(router, /environment:/);
  assert.match(router, /environmental insights/i);
  assert.match(worker, /features\/environmental-insights\.js/);
  assert.match(moduleSource, /aria-live="polite"/);
  assert.match(moduleSource, /modelled forecast/i);
  assert.match(moduleSource, /environment-rain-amount/);
  assert.match(moduleSource, /item\.precipitation===null/);
  assert.match(fs.readFileSync(path.join(root, 'style.css'), 'utf8'), /body\.theme-light \.environment-rain-amount/);
});

test('provides UV guidance for all exposure bands', () => {
  const { uvAdvice } = require('../features/environmental-insights.js');
  assert.match(uvAdvice(1), /Low exposure/);
  assert.match(uvAdvice(4), /Moderate exposure/);
  assert.match(uvAdvice(6), /High exposure/);
  assert.match(uvAdvice(9), /Very high exposure/);
  assert.match(uvAdvice(12), /Extreme exposure/);
});

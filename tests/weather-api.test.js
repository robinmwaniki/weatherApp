const test = require('node:test');
const assert = require('node:assert/strict');
const {
  requestJson,
  apiMessage,
  buildGeocodingUrl,
  normalizeGeocodingResults,
  buildForecastUrl,
  weatherCondition,
  normalizeWeatherResponse,
  isCurrentWeatherPayload,
  forecastList,
  createRequestGate
} = require('../weather-api.js');

const sample = {
  latitude: -1.2864,
  longitude: 36.8172,
  timezone: 'Africa/Nairobi',
  current: {
    time: '2026-11-19T12:00+03:00',
    temperature_2m: 24.5,
    relative_humidity_2m: 62,
    apparent_temperature: 25.1,
    is_day: 1,
    weather_code: 2,
    cloud_cover: 40,
    pressure_msl: 1012,
    surface_pressure: 990,
    visibility: 12000,
    wind_speed_10m: 3.5,
    wind_direction_10m: 120,
    wind_gusts_10m: 5.2
  },
  hourly: {
    time: ['2026-11-19T12:00+03:00', '2026-11-19T13:00+03:00'],
    temperature_2m: [24.5, 25],
    relative_humidity_2m: [62, 60],
    precipitation_probability: [20, 45],
    weather_code: [2, 61],
    visibility: [12000, 10000]
  },
  daily: {
    temperature_2m_max: [27],
    temperature_2m_min: [18],
    sunrise: ['2026-11-19T06:10+03:00'],
    sunset: ['2026-11-19T18:20+03:00']
  }
};

test('builds keyless Open-Meteo geocoding requests', () => {
  const url = new URL(buildGeocodingUrl('Nairobi', 5));
  assert.equal(url.origin, 'https://geocoding-api.open-meteo.com');
  assert.equal(url.searchParams.get('name'), 'Nairobi');
  assert.equal(url.searchParams.get('count'), '5');
  assert.equal(url.searchParams.has('apikey'), false);
});

test('normalizes Open-Meteo geocoding records for autocomplete and search', () => {
  const locations = normalizeGeocodingResults({
    results: [{
      name: 'Nairobi',
      admin1: 'Nairobi County',
      country: 'Kenya',
      country_code: 'KE',
      latitude: -1.2864,
      longitude: 36.8172,
      timezone: 'Africa/Nairobi'
    }]
  });
  assert.deepEqual(locations, [{
    name: 'Nairobi',
    state: 'Nairobi County',
    country: 'Kenya',
    countryCode: 'KE',
    lat: -1.2864,
    lon: 36.8172,
    timezone: 'Africa/Nairobi'
  }]);
  assert.deepEqual(normalizeGeocodingResults({}), []);
});

test('builds forecast requests with the selected temperature and wind units', () => {
  const metric = new URL(buildForecastUrl(-1.2, 36.8, 'metric'));
  assert.equal(metric.searchParams.get('temperature_unit'), 'celsius');
  assert.equal(metric.searchParams.get('wind_speed_unit'), 'ms');
  assert.equal(metric.searchParams.get('timezone'), 'auto');
  assert.equal(metric.searchParams.get('forecast_days'), '5');
  assert.ok(metric.searchParams.get('hourly').includes('visibility'));
  assert.equal(metric.searchParams.get('current').includes('visibility'), false);

  const imperial = new URL(buildForecastUrl(-1.2, 36.8, 'imperial'));
  assert.equal(imperial.searchParams.get('temperature_unit'), 'fahrenheit');
  assert.equal(imperial.searchParams.get('wind_speed_unit'), 'mph');
});

test('maps WMO weather codes into the dashboard condition categories', () => {
  assert.deepEqual(weatherCondition(0), { id: 800, description: 'clear sky' });
  assert.deepEqual(weatherCondition(61), { id: 500, description: 'light rain' });
  assert.deepEqual(weatherCondition(95), { id: 200, description: 'thunderstorm' });
  assert.deepEqual(weatherCondition(99), { id: 212, description: 'thunderstorm with heavy hail' });
});

test('normalizes current, hourly and daily data into the dashboard model', () => {
  const normalized = normalizeWeatherResponse(sample, {
    name: 'Nairobi', country: 'Kenya', countryCode: 'KE', lat: -1.2864, lon: 36.8172
  }, 'metric');
  assert.equal(normalized.cur.name, 'Nairobi');
  assert.equal(normalized.cur.timezone, 'Africa/Nairobi');
  assert.equal(normalized.cur.main.temp, 24.5);
  assert.equal(normalized.cur.main.temp_max, 27);
  assert.equal(normalized.cur.main.temp_min, 18);
  assert.equal(normalized.cur.main.humidity, 62);
  assert.equal(normalized.cur.wind.speed, 3.5);
  assert.equal(normalized.cur.visibility, 12000);
  assert.equal(normalized.cur.weather[0].id, 802);
  assert.equal(normalized.cur.sys.sunriseLabel, '06:10');
  assert.equal(normalized.fore.list.length, 2);
  assert.equal(normalized.fore.list[1].localTime, '13:00');
  assert.equal(normalized.fore.list[1].pop, 0.45);
  assert.equal(normalized.fore.list[0].weather[0].id, 802);
});

test('normalizes imperial API values without converting mph a second time', () => {
  const imperialSample = structuredClone(sample);
  imperialSample.current.temperature_2m = 76.1;
  imperialSample.current.wind_speed_10m = 12;
  const normalized = normalizeWeatherResponse(imperialSample, {
    name: 'Nairobi', country: 'KE', lat: -1.2864, lon: 36.8172
  }, 'imperial');
  assert.equal(normalized.cur.main.temp, 76.1);
  assert.equal(normalized.cur.wind.speed, 12);
  assert.equal(normalized.units, 'imperial');
});

test('rejects incomplete weather payloads and validates normalized current data', () => {
  assert.throws(() => normalizeWeatherResponse({}, { name: 'Nairobi' }, 'metric'), /incomplete weather data/i);
  const normalized = normalizeWeatherResponse(sample, {
    name: 'Nairobi', country: 'KE', lat: -1.2864, lon: 36.8172
  });
  assert.equal(isCurrentWeatherPayload(normalized.cur), true);
  assert.equal(isCurrentWeatherPayload({ cod: 200 }), false);
  assert.deepEqual(forecastList(normalized.fore), normalized.fore.list);
  assert.deepEqual(forecastList({}), []);
});

test('returns JSON for successful API responses and reports upstream errors', async () => {
  const value = await requestJson('/forecast', async () => ({
    ok: true, status: 200, json: async () => sample
  }));
  assert.equal(value.current.temperature_2m, 24.5);
  assert.match(apiMessage({ reason: 'Invalid parameter' }, 400), /Invalid parameter/);
  await assert.rejects(() => requestJson('/forecast', async () => ({
    ok: false, status: 429, json: async () => ({ reason: 'Too many requests' })
  })), /Too many requests/);
});

test('reports network and invalid JSON failures clearly', async () => {
  await assert.rejects(() => requestJson('/forecast', async () => {
    throw new Error('offline');
  }), /internet connection/i);
  await assert.rejects(() => requestJson('/forecast', async () => ({
    ok: true, status: 200, json: async () => { throw new Error('bad json'); }
  })), /unreadable response/i);
});

test('request gate ignores older asynchronous responses', () => {
  const gate = createRequestGate();
  const first = gate.next();
  const second = gate.next();
  assert.equal(gate.isLatest(first), false);
  assert.equal(gate.isLatest(second), true);
});


test('keeps current weather when sunrise and sunset are unavailable', () => {
  const polarSample = structuredClone(sample);
  polarSample.daily.sunrise = [null];
  polarSample.daily.sunset = [null];
  polarSample.hourly.visibility = [null, null];
  const normalized = normalizeWeatherResponse(polarSample, {
    name: 'Tromsø', country: 'Norway', lat: 69.6492, lon: 18.9553
  }, 'metric');
  assert.equal(normalized.cur.sys.sunrise, 0);
  assert.equal(normalized.cur.sys.sunset, 0);
  assert.equal(normalized.cur.sys.sunriseLabel, '');
  assert.equal(normalized.cur.sys.sunsetLabel, '');
  assert.equal(normalized.cur.visibility, null);
  assert.equal(normalized.cur.main.temp, 24.5);
});

test('accepts missing sunrise and sunset arrays when daily forecast data exists', () => {
  const polarSample = structuredClone(sample);
  delete polarSample.daily.sunrise;
  delete polarSample.daily.sunset;
  const normalized = normalizeWeatherResponse(polarSample, {
    name: 'Polar location', country: '', lat: 78, lon: 15
  }, 'metric');
  assert.equal(normalized.cur.sys.sunrise, 0);
  assert.equal(normalized.cur.sys.sunset, 0);
});

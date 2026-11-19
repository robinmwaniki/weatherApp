(function(root) {
  const FORECAST_URL = 'https://api.open-meteo.com/v1/forecast';
  const GEOCODING_URL = 'https://geocoding-api.open-meteo.com/v1/search';

  const WEATHER_CODES = {
    0: [800, 'clear sky'],
    1: [801, 'mainly clear'],
    2: [802, 'partly cloudy'],
    3: [804, 'overcast'],
    45: [741, 'fog'],
    48: [741, 'depositing rime fog'],
    51: [300, 'light drizzle'],
    53: [301, 'moderate drizzle'],
    55: [302, 'dense drizzle'],
    56: [511, 'light freezing drizzle'],
    57: [511, 'dense freezing drizzle'],
    61: [500, 'light rain'],
    63: [501, 'moderate rain'],
    65: [502, 'heavy rain'],
    66: [511, 'light freezing rain'],
    67: [511, 'heavy freezing rain'],
    71: [600, 'light snowfall'],
    73: [601, 'moderate snowfall'],
    75: [602, 'heavy snowfall'],
    77: [600, 'snow grains'],
    80: [520, 'light rain showers'],
    81: [521, 'moderate rain showers'],
    82: [522, 'violent rain showers'],
    85: [620, 'light snow showers'],
    86: [621, 'heavy snow showers'],
    95: [200, 'thunderstorm'],
    96: [202, 'thunderstorm with slight hail'],
    99: [212, 'thunderstorm with heavy hail']
  };

  function apiMessage(data, status) {
    if (data && data.reason) return String(data.reason);
    if (data && data.message) return String(data.message);
    if (status === 429) return 'Weather service rate limit reached. Please wait and try again.';
    if (status >= 500) return 'Weather service is temporarily unavailable. Please try again shortly.';
    if (status >= 400) return 'The weather service rejected the request (HTTP ' + status + '). Check the city and try again.';
    return 'Weather request failed. Please try again.';
  }

  async function requestJson(url, fetchImpl) {
    const doFetch = fetchImpl || root.fetch;
    let response;
    try {
      response = await doFetch(url);
    } catch {
      throw new Error('Unable to reach the weather service. Check your internet connection and try again.');
    }

    let data;
    try {
      data = await response.json();
    } catch {
      throw new Error('The weather service returned an unreadable response. Please try again.');
    }

    if (!response.ok || (data && data.error)) {
      throw new Error(apiMessage(data, response.status));
    }
    return data;
  }

  function buildGeocodingUrl(query, count = 5) {
    const url = new URL(GEOCODING_URL);
    url.searchParams.set('name', String(query || '').trim());
    url.searchParams.set('count', String(Math.max(1, Math.min(10, Number(count) || 5))));
    url.searchParams.set('language', 'en');
    url.searchParams.set('format', 'json');
    return url.toString();
  }

  function normalizeGeocodingResults(payload) {
    if (!payload || !Array.isArray(payload.results)) return [];
    return payload.results
      .filter(item => item && item.latitude !== null && item.latitude !== undefined && item.longitude !== null && item.longitude !== undefined && Number.isFinite(Number(item.latitude)) && Number.isFinite(Number(item.longitude)))
      .map(item => ({
        name: String(item.name || 'Unknown location'),
        state: String(item.admin1 || ''),
        country: String(item.country || item.country_code || ''),
        countryCode: String(item.country_code || ''),
        lat: Number(item.latitude),
        lon: Number(item.longitude),
        timezone: String(item.timezone || '')
      }));
  }

  function buildForecastUrl(latitude, longitude, units = 'metric') {
    const imperial = units === 'imperial';
    const url = new URL(FORECAST_URL);
    const params = {
      latitude,
      longitude,
      current: 'temperature_2m,relative_humidity_2m,apparent_temperature,is_day,weather_code,cloud_cover,pressure_msl,surface_pressure,wind_speed_10m,wind_direction_10m,wind_gusts_10m',
      hourly: 'temperature_2m,relative_humidity_2m,precipitation_probability,precipitation,uv_index,weather_code,visibility',
      daily: 'weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset,precipitation_probability_max,precipitation_sum,uv_index_max',
      temperature_unit: imperial ? 'fahrenheit' : 'celsius',
      wind_speed_unit: imperial ? 'mph' : 'ms',
      timezone: 'auto',
      forecast_days: 5
    };
    Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, String(value)));
    return url.toString();
  }

  function weatherCondition(code) {
    const entry = WEATHER_CODES[Number(code)];
    return entry ? { id: entry[0], description: entry[1] } : { id: 800, description: 'unknown conditions' };
  }

  function toTimestamp(value) {
    const timestamp = Date.parse(value);
    return Number.isFinite(timestamp) ? Math.floor(timestamp / 1000) : 0;
  }

  function optionalNumber(value) {
    return value !== null && value !== undefined && value !== '' && Number.isFinite(Number(value)) ? Number(value) : null;
  }

  function normalizeWeatherResponse(payload, location, units = 'metric') {
    const current = payload && payload.current;
    const hourly = payload && payload.hourly;
    const daily = payload && payload.daily;
    if (!current || !hourly || !Array.isArray(hourly.time) || !daily ||
        current.temperature_2m === null || current.temperature_2m === undefined || !Number.isFinite(Number(current.temperature_2m))) {
      throw new Error('The weather service returned incomplete weather data. Please try again.');
    }

    const currentCondition = weatherCondition(current.weather_code);
    const currentHourIndex = Math.max(0, hourly.time.findIndex(time => time === current.time));
    const currentTime = toTimestamp(current.time);
    const sunriseValue = Array.isArray(daily.sunrise) ? daily.sunrise[0] : null;
    const sunsetValue = Array.isArray(daily.sunset) ? daily.sunset[0] : null;
    const sunrise = toTimestamp(sunriseValue);
    const sunset = toTimestamp(sunsetValue);
    if (!currentTime) {
      throw new Error('The weather service returned an invalid current observation time. Please try again.');
    }
    const visibilityValue = hourly.visibility && hourly.visibility[currentHourIndex];
    const visibility = visibilityValue === null || visibilityValue === undefined || !Number.isFinite(Number(visibilityValue))
      ? null
      : Number(visibilityValue);

    const cur = {
      name: String((location && location.name) || 'Your location'),
      dt: currentTime,
      timezone: String(payload.timezone || ''),
      coord: {
        lat: Number((location && location.lat) ?? payload.latitude),
        lon: Number((location && location.lon) ?? payload.longitude)
      },
      sys: {
        country: String((location && location.country) || ''),
        sunrise,
        sunset,
        sunriseLabel: sunriseValue ? String(sunriseValue).slice(11, 16) : '',
        sunsetLabel: sunsetValue ? String(sunsetValue).slice(11, 16) : ''
      },
      main: {
        temp: Number(current.temperature_2m),
        temp_max: Number((daily.temperature_2m_max && daily.temperature_2m_max[0]) ?? current.temperature_2m),
        temp_min: Number((daily.temperature_2m_min && daily.temperature_2m_min[0]) ?? current.temperature_2m),
        feels_like: Number(current.apparent_temperature ?? current.temperature_2m),
        humidity: Number(current.relative_humidity_2m ?? 0),
        pressure: Number(current.pressure_msl ?? current.surface_pressure ?? 0),
        sea_level: Number(current.pressure_msl ?? 0),
        grnd_level: Number(current.surface_pressure ?? 0)
      },
      wind: {
        speed: Number(current.wind_speed_10m ?? 0),
        gust: Number(current.wind_gusts_10m ?? 0),
        deg: Number(current.wind_direction_10m ?? 0)
      },
      clouds: { all: Number(current.cloud_cover ?? 0) },
      visibility,
      weather: [currentCondition],
      is_day: Number(current.is_day ?? 1)
    };

    const hourlyTemps = hourly.temperature_2m || [];
    const hourlyHumidity = hourly.relative_humidity_2m || [];
    const hourlyPop = hourly.precipitation_probability || [];
    const hourlyCodes = hourly.weather_code || [];
    const forecastList = hourly.time
      .map((time, index) => ({
        time,
        dt: toTimestamp(time),
        localDate: String(time).slice(0, 10),
        localTime: String(time).slice(11, 16),
        main: {
          temp: Number(hourlyTemps[index] ?? current.temperature_2m),
          humidity: Number(hourlyHumidity[index] ?? current.relative_humidity_2m ?? 0)
        },
        weather: [weatherCondition(hourlyCodes[index] ?? current.weather_code)],
        pop: Number(hourlyPop[index] ?? 0) / 100,
        uvIndex: optionalNumber(hourly.uv_index && hourly.uv_index[index]),
        precipitation: optionalNumber(hourly.precipitation && hourly.precipitation[index]),
        precipitationProbability: optionalNumber(hourlyPop[index])
      }))
      .filter(item => item.dt >= currentTime)
      .slice(0, 120);

    if (!forecastList.length) {
      throw new Error('The weather service did not return hourly forecast data. Please try again.');
    }

    const dailyUv = Array.isArray(daily.uv_index_max) ? optionalNumber(daily.uv_index_max[0]) : null;
    const dailyPrecipitation = Array.isArray(daily.precipitation_sum) ? optionalNumber(daily.precipitation_sum[0]) : null;
    const environment = {
      hourly: forecastList.map(item => ({
        time: item.time, dt: item.dt, localTime: item.localTime,
        uvIndex: item.uvIndex, precipitation: item.precipitation,
        precipitationProbability: item.precipitationProbability
      })).slice(0, 24),
      dailyUvMax: dailyUv,
      dailyPrecipitation
    };
    return { cur, fore: { list: forecastList, environment }, units: units === 'imperial' ? 'imperial' : 'metric' };
  }

  function buildAirQualityUrl(latitude, longitude) {
    const url = new URL('https://air-quality-api.open-meteo.com/v1/air-quality');
    url.searchParams.set('latitude', String(latitude));
    url.searchParams.set('longitude', String(longitude));
    url.searchParams.set('hourly', 'us_aqi,pm2_5,pm10');
    url.searchParams.set('forecast_hours', '24');
    url.searchParams.set('timezone', 'auto');
    return url.toString();
  }

  function airQualityCategory(aqi) {
    if (aqi === null || aqi === undefined || aqi === '' || !Number.isFinite(Number(aqi))) return { label: 'Unavailable', advice: 'Air quality data is not available for this location right now.' };
    const value = Number(aqi);
    if (value <= 50) return { label: 'Good', advice: 'Air quality is satisfactory. Normal outdoor activity is suitable.' };
    if (value <= 100) return { label: 'Moderate', advice: 'Most people can enjoy outdoor activities. Unusually sensitive people may reduce prolonged exertion.' };
    if (value <= 150) return { label: 'Unhealthy for sensitive groups', advice: 'Children, older adults and people with heart or lung conditions should reduce prolonged outdoor exertion.' };
    if (value <= 200) return { label: 'Unhealthy', advice: 'Consider reducing prolonged outdoor exertion. Sensitive groups should avoid strenuous outdoor activity.' };
    if (value <= 300) return { label: 'Very unhealthy', advice: 'Reduce outdoor activity and consider keeping windows closed.' };
    return { label: 'Hazardous', advice: 'Avoid outdoor exertion and follow local public-health guidance.' };
  }

  function normalizeAirQualityResponse(payload, now = Date.now()) {
    const hourly = payload && payload.hourly;
    if (!hourly || !Array.isArray(hourly.time) || !hourly.time.length) {
      return { aqi: null, pm25: null, pm10: null, category: 'Unavailable', advice: 'Air quality data is not available for this location right now.', time: null };
    }
    const index = hourly.time.reduce((best, time, i) => {
      const distance = Math.abs(Date.parse(time) - Number(now));
      return Number.isFinite(distance) && distance < best.distance ? { index: i, distance } : best;
    }, { index: 0, distance: Infinity }).index;
    const read = key => {
      const value = hourly[key] && hourly[key][index];
      return value !== null && value !== undefined && value !== '' && Number.isFinite(Number(value)) ? Number(value) : null;
    };
    const aqi = read('us_aqi');
    const category = airQualityCategory(aqi);
    return { aqi, pm25: read('pm2_5'), pm10: read('pm10'), category: category.label, advice: category.advice, time: hourly.time[index] || null };
  }

  function isCurrentWeatherPayload(data) {
    return Boolean(data && data.main && data.sys && data.coord && data.wind && data.clouds &&
      Array.isArray(data.weather) && data.weather.length &&
      Number.isFinite(Number(data.main.temp)) &&
      Number.isFinite(Number(data.coord.lat)) &&
      Number.isFinite(Number(data.coord.lon)));
  }

  function forecastList(data) {
    return data && Array.isArray(data.list) ? data.list : [];
  }

  function createRequestGate() {
    let latest = 0;
    return {
      next() { latest += 1; return latest; },
      isLatest(id) { return id === latest; }
    };
  }

  const api = {
    apiMessage,
    requestJson,
    buildGeocodingUrl,
    normalizeGeocodingResults,
    buildForecastUrl,
    buildAirQualityUrl,
    airQualityCategory,
    normalizeAirQualityResponse,
    weatherCondition,
    normalizeWeatherResponse,
    isCurrentWeatherPayload,
    forecastList,
    createRequestGate
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.SkylineWeatherApi = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);

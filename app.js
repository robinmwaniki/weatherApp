// =============================================
//  SKYLINE — Global Weather App
//  app.js — Main application logic
// =============================================

const API_KEY = 'bd5e378503939ddaee76f12ad7a97608';
const BASE    = 'https://api.openweathermap.org/data/2.5';

let unit        = (window.SkylinePreferences && window.SkylinePreferences.unit) || 'metric';
let currentLat  = null;
let currentLon  = null;
let currentData = null;\nconst weatherRequestGate = window.SkylineWeatherApi.createRequestGate();

// ---- Quick cities config ----
const QUICK_CITIES = [
  { name: 'Nairobi',   flag: '🇰🇪' },
  { name: 'London',    flag: '🇬🇧' },
  { name: 'New York',  flag: '🇺🇸' },
  { name: 'Tokyo',     flag: '🇯🇵' },
  { name: 'Dubai',     flag: '🇦🇪' },
  { name: 'Sydney',    flag: '🇦🇺' },
  { name: 'Paris',     flag: '🇫🇷' },
  { name: 'Mumbai',    flag: '🇮🇳' },
  { name: 'São Paulo', flag: '🇧🇷' },
  { name: 'Cairo',     flag: '🇪🇬' },
  { name: 'Singapore', flag: '🇸🇬' },
  { name: 'Berlin',    flag: '🇩🇪' },
];

// ---- Weather icon map ----
function getIcon(code, isDay = true) {
  if (code >= 200 && code < 300) return '⛈️';
  if (code >= 300 && code < 400) return '🌦️';
  if (code >= 500 && code < 600) return '🌧️';
  if (code >= 600 && code < 700) return '❄️';
  if (code >= 700 && code < 800) return '🌫️';
  if (code === 800) return isDay ? '☀️' : '🌙';
  if (code === 801) return '🌤️';
  if (code === 802) return '⛅';
  if (code >= 803)  return '☁️';
  return '🌡️';
}

function windDir(deg) {
  const dirs = ['N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSW','SW','WSW','W','WNW','NW','NNW'];
  return dirs[Math.round(deg / 22.5) % 16];
}

function uSym()  { return unit === 'metric' ? '°C' : '°F'; }
function spdUnit(){ return unit === 'metric' ? 'km/h' : 'mph'; }
function cvtSpd(ms) {
  return unit === 'metric' ? Math.round(ms * 3.6) : Math.round(ms * 2.237);
}

// ---- Dew point formula ----
function dewPoint(tempC, hum) {
  const a = 17.62, b = 243.12;
  const gamma = (a * tempC / (b + tempC)) + Math.log(hum / 100);
  return (b * gamma / (a - gamma)).toFixed(1);
}

// ============================
//  INIT
// ============================
window.addEventListener('DOMContentLoaded', () => {
  buildQuickCities();
  buildParticles();
  startBgCanvas();
  setupSearch();
  setUnit(unit);
  fetchWeather((window.SkylinePreferences && window.SkylinePreferences.defaultCity) || 'Nairobi');
});

// ============================
//  QUICK CITIES
// ============================
function buildQuickCities() {
  const row = document.getElementById('quickRow');
  QUICK_CITIES.forEach(c => {
    const btn = document.createElement('button');
    btn.className = 'quick-pill';
    btn.innerHTML = `<span class="flag">${c.flag}</span>${c.name}`;
    btn.addEventListener('click', () => fetchWeather(c.name));
    row.appendChild(btn);
  });
}

// ============================
//  SEARCH
// ============================
function setupSearch() {
  const input = document.getElementById('searchInput');
  input.addEventListener('keydown', e => { if (e.key === 'Enter') doSearch(); });

  // Autocomplete (debounced)
  let timer;
  input.addEventListener('input', () => {
    clearTimeout(timer);
    const q = input.value.trim();
    if (q.length < 2) { closeSuggestions(); return; }
    timer = setTimeout(() => loadSuggestions(q), 350);
  });

  document.addEventListener('click', e => {
    if (!e.target.closest('.search-section')) closeSuggestions();
  });
}

async function loadSuggestions(q) {
  try {
    const r = await fetch(`https://api.openweathermap.org/geo/1.0/direct?q=${encodeURIComponent(q)}&limit=5&appid=${API_KEY}`);
    const data = await r.json();
    showSuggestions(data);
  } catch { closeSuggestions(); }
}

function showSuggestions(list) {
  const box = document.getElementById('suggestions');
  if (!list.length) { closeSuggestions(); return; }
  box.innerHTML = '';
  list.forEach(item => {
    const div = document.createElement('div');
    div.className = 'suggestion-item';
    const label = [item.name, item.state, item.country].filter(Boolean).join(', ');
    div.innerHTML = `<span>📍</span>${label}`;
    div.addEventListener('click', () => {
      document.getElementById('searchInput').value = item.name;
      closeSuggestions();
      fetchWeatherByCoords(item.lat, item.lon, item.name, item.country, true);
    });
    box.appendChild(div);
  });
  box.classList.add('open');
}

function closeSuggestions() {
  document.getElementById('suggestions').classList.remove('open');
}

function doSearch() {
  const q = document.getElementById('searchInput').value.trim();
  if (q) { closeSuggestions(); fetchWeather(q, true); }
}

// ============================
//  GEOLOCATION
// ============================
function getMyLocation() {
  if (!navigator.geolocation) { showError('Geolocation not supported.'); return; }
  showLoading();
  navigator.geolocation.getCurrentPosition(
    p => fetchWeatherByCoords(p.coords.latitude, p.coords.longitude),
    () => showError('Location access denied. Please search manually.')
  );
}

// ============================
//  FETCH (by name)
// ============================
async function fetchWeather(city, recordHistory = false) {
  const requestId = weatherRequestGate.next();
  showLoading();
  try {
    const [currentResult, forecastResult] = await Promise.allSettled([
      apiFetch(`${BASE}/weather?q=${encodeURIComponent(city)}&appid=${API_KEY}&units=${unit}`),
      apiFetch(`${BASE}/forecast?q=${encodeURIComponent(city)}&appid=${API_KEY}&units=${unit}&cnt=40`)
    ]);
    if (!weatherRequestGate.isLatest(requestId)) return;
    if (currentResult.status === 'rejected') throw currentResult.reason;
    const cur = currentResult.value;
    if (!window.SkylineWeatherApi.isCurrentWeatherPayload(cur)) throw new Error('The weather service returned incomplete current-weather data. Please try again.');
    const forecastAvailable = forecastResult.status === 'fulfilled';
    const fore = forecastAvailable ? { list: window.SkylineWeatherApi.forecastList(forecastResult.value) } : { list: [] };
    currentLat = cur.coord.lat;
    currentLon = cur.coord.lon;
    currentData = { cur, fore };
    renderAll(cur, fore, recordHistory);
    if (!forecastAvailable) document.getElementById('lastUpdated').textContent += ' · Forecast temporarily unavailable';
  } catch (error) {
    if (!weatherRequestGate.isLatest(requestId)) return;
    showError(error.message || 'Unable to retrieve weather. Please try again.');
  }
}

// ============================
//  FETCH (by coords)
// ============================
async function fetchWeatherByCoords(lat, lon, name, country, recordHistory = false) {
  const requestId = weatherRequestGate.next();
  showLoading();
  try {
    const [currentResult, forecastResult] = await Promise.allSettled([
      apiFetch(`${BASE}/weather?lat=${lat}&lon=${lon}&appid=${API_KEY}&units=${unit}`),
      apiFetch(`${BASE}/forecast?lat=${lat}&lon=${lon}&appid=${API_KEY}&units=${unit}&cnt=40`)
    ]);
    if (!weatherRequestGate.isLatest(requestId)) return;
    if (currentResult.status === 'rejected') throw currentResult.reason;
    const cur = currentResult.value;
    if (!window.SkylineWeatherApi.isCurrentWeatherPayload(cur)) throw new Error('The weather service returned incomplete current-weather data. Please try again.');
    const forecastAvailable = forecastResult.status === 'fulfilled';
    const fore = forecastAvailable ? { list: window.SkylineWeatherApi.forecastList(forecastResult.value) } : { list: [] };
    currentLat = lat;
    currentLon = lon;
    currentData = { cur, fore };
    if (name) cur.name = name;
    if (country) cur.sys.country = country;
    renderAll(cur, fore, recordHistory);
    if (!forecastAvailable) document.getElementById('lastUpdated').textContent += ' · Forecast temporarily unavailable';
  } catch (error) {
    if (!weatherRequestGate.isLatest(requestId)) return;
    showError(error.message || 'Could not retrieve weather for this location.');
  }
}

async function apiFetch(url) {
  return window.SkylineWeatherApi.requestJson(url);
}

}
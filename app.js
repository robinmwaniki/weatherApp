// =============================================
//  SKYLINE — Global Weather App
//  app.js — Main application logic
// =============================================

const API_KEY = 'bd5e378503939ddaee76f12ad7a97608';
const BASE    = 'https://api.openweathermap.org/data/2.5';

let unit        = 'metric';
let currentLat  = null;
let currentLon  = null;
let currentData = null;

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
  fetchWeather('Nairobi');
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
      fetchWeatherByCoords(item.lat, item.lon, item.name, item.country);
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
  if (q) { closeSuggestions(); fetchWeather(q); }
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
async function fetchWeather(city) {
  showLoading();
  try {
    const [cur, fore] = await Promise.all([
      apiFetch(`${BASE}/weather?q=${encodeURIComponent(city)}&appid=${API_KEY}&units=${unit}`),
      apiFetch(`${BASE}/forecast?q=${encodeURIComponent(city)}&appid=${API_KEY}&units=${unit}&cnt=40`)
    ]);
    if (cur.cod !== 200) { showError(`"${city}" not found. Try a different spelling.`); return; }
    currentLat = cur.coord.lat;
    currentLon = cur.coord.lon;
    currentData = { cur, fore };
    renderAll(cur, fore);
  } catch {
    showError('Network error. Check your connection.');
  }
}

// ============================
//  FETCH (by coords)
// ============================
async function fetchWeatherByCoords(lat, lon, name, country) {
  showLoading();
  try {
    const [cur, fore] = await Promise.all([
      apiFetch(`${BASE}/weather?lat=${lat}&lon=${lon}&appid=${API_KEY}&units=${unit}`),
      apiFetch(`${BASE}/forecast?lat=${lat}&lon=${lon}&appid=${API_KEY}&units=${unit}&cnt=40`)
    ]);
    currentLat = lat; currentLon = lon;
    currentData = { cur, fore };
    if (name)    cur.name = name;
    if (country) cur.sys.country = country;
    renderAll(cur, fore);
  } catch {
    showError('Could not retrieve weather for this location.');
  }
}

async function apiFetch(url) {
  const r = await fetch(url);
  return r.json();
}

// ============================
//  UNIT TOGGLE
// ============================
function setUnit(u) {
  unit = u;
  document.getElementById('btnC').classList.toggle('active', u === 'metric');
  document.getElementById('btnF').classList.toggle('active', u === 'imperial');
  if (currentData) renderAll(currentData.cur, currentData.fore);
}

// ============================
//  RENDER ALL
// ============================
function renderAll(cur, fore) {
  hideLoading();

  const isDay = cur.dt > cur.sys.sunrise && cur.dt < cur.sys.sunset;
  const tempC = cur.main.temp - (unit === 'imperial' ? 32/1.8 : 0); // approx for dewpoint

  // Main card
  document.getElementById('cityName').textContent = cur.name;
  document.getElementById('cityMeta').textContent =
    `${cur.sys.country} · ${new Date().toLocaleDateString('en-US', { weekday:'long', month:'long', day:'numeric' })} · ${cur.coord.lat.toFixed(2)}°, ${cur.coord.lon.toFixed(2)}°`;
  animateNumber('currentTemp', Math.round(cur.main.temp), uSym());
  document.getElementById('currentDesc').textContent = cur.weather[0].description;
  document.getElementById('hiLo').innerHTML =
    `<span class="hi">↑ ${Math.round(cur.main.temp_max)}${uSym()}</span>  <span class="lo">↓ ${Math.round(cur.main.temp_min)}${uSym()}</span>`;
  document.getElementById('mainIcon').textContent = getIcon(cur.weather[0].id, isDay);
  document.getElementById('lastUpdated').textContent =
    `Updated ${new Date().toLocaleTimeString('en-US', { hour:'2-digit', minute:'2-digit' })}`;

  // Stats bar
  document.getElementById('sHumidity').textContent = `${cur.main.humidity}%`;
  document.getElementById('sWind').textContent     = `${cvtSpd(cur.wind.speed)} ${spdUnit()}`;
  document.getElementById('sFeels').textContent    = `${Math.round(cur.main.feels_like)}${uSym()}`;
  document.getElementById('sVis').textContent      = `${(cur.visibility / 1000).toFixed(1)} km`;
  document.getElementById('sPress').textContent    = `${cur.main.pressure} hPa`;
  document.getElementById('sCloud').textContent    = `${cur.clouds.all}%`;

  // Atmospheric
  const tc = unit === 'metric' ? cur.main.temp : (cur.main.temp - 32) * 5/9;
  const dp = dewPoint(tc, cur.main.humidity);
  const dpDisplay = unit === 'metric' ? `${dp}${uSym()}` : `${((parseFloat(dp) * 9/5) + 32).toFixed(1)}${uSym()}`;
  document.getElementById('aDew').textContent    = dpDisplay;
  document.getElementById('aGust').textContent   = cur.wind.gust ? `${cvtSpd(cur.wind.gust)} ${spdUnit()}` : '—';
  document.getElementById('aSeaLvl').textContent = cur.main.sea_level ? `${cur.main.sea_level} hPa` : '—';
  document.getElementById('aGnd').textContent    = cur.main.grnd_level ? `${cur.main.grnd_level} hPa` : '—';

  // Map
  document.getElementById('mapCoords').textContent = `${cur.coord.lat.toFixed(4)}°, ${cur.coord.lon.toFixed(4)}°`;
  document.getElementById('mapCity').textContent   = `${cur.name}, ${cur.sys.country}`;

  // Sun arc
  renderSunArc(cur.sys.sunrise, cur.sys.sunset, cur.dt);

  // Hourly
  renderHourly(fore.list);

  // 5-day forecast
  renderForecast(fore.list);

  // Wind compass
  renderWindCompass(cur.wind.deg, cvtSpd(cur.wind.speed));
  document.getElementById('windBig').textContent     = `${cvtSpd(cur.wind.speed)} ${spdUnit()}`;
  document.getElementById('windDirLabel').textContent = `${windDir(cur.wind.deg)} — ${cur.wind.deg}°`;

  // Humidity gauge
  renderHumidityGauge(cur.main.humidity);
  document.getElementById('gaugeVal').textContent  = `${cur.main.humidity}%`;
  document.getElementById('gaugeDesc').textContent = humidityLabel(cur.main.humidity);

  // Show content
  document.getElementById('weatherContent').classList.remove('hidden');

  // Background theme
  updateBgTheme(cur.weather[0].id, isDay);
}

// ============================
//  ANIMATED NUMBER
// ============================
function animateNumber(id, target, suffix = '') {
  const el = document.getElementById(id);
  const start = parseInt(el.textContent) || 0;
  const diff = target - start;
  const dur = 600;
  const t0 = performance.now();
  function frame(t) {
    const p = Math.min((t - t0) / dur, 1);
    const ease = 1 - Math.pow(1 - p, 3);
    el.textContent = Math.round(start + diff * ease) + suffix;
    if (p < 1) requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

// ============================
//  SUN ARC CANVAS
// ============================
function renderSunArc(sunrise, sunset, now) {
  const canvas = document.getElementById('sunArc');
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  ctx.clearRect(0, 0, W, H);

  const cx = W / 2, cy = H - 20;
  const r = W / 2 - 20;

  // Total day duration
  const total   = sunset - sunrise;
  const elapsed = Math.max(0, Math.min(now - sunrise, total));
  const progress = elapsed / total;

  // Draw arc background
  ctx.beginPath();
  ctx.arc(cx, cy, r, Math.PI, 0, false);
  ctx.strokeStyle = 'rgba(255,255,255,0.06)';
  ctx.lineWidth = 3;
  ctx.stroke();

  // Draw progress arc
  const startAngle = Math.PI;
  const endAngle   = Math.PI + progress * Math.PI;
  const grad = ctx.createLinearGradient(0, 0, W, 0);
  grad.addColorStop(0, '#ff7043');
  grad.addColorStop(1, '#ffd54f');
  ctx.beginPath();
  ctx.arc(cx, cy, r, startAngle, endAngle, false);
  ctx.strokeStyle = grad;
  ctx.lineWidth = 3;
  ctx.stroke();

  // Draw sun position
  const angle = Math.PI + progress * Math.PI;
  const sx = cx + r * Math.cos(angle);
  const sy = cy + r * Math.sin(angle);

  // Glow
  const grd = ctx.createRadialGradient(sx, sy, 0, sx, sy, 16);
  grd.addColorStop(0, 'rgba(255,213,79,0.6)');
  grd.addColorStop(1, 'rgba(255,213,79,0)');
  ctx.beginPath();
  ctx.arc(sx, sy, 16, 0, Math.PI * 2);
  ctx.fillStyle = grd;
  ctx.fill();

  // Sun dot
  ctx.beginPath();
  ctx.arc(sx, sy, 6, 0, Math.PI * 2);
  ctx.fillStyle = '#ffd54f';
  ctx.fill();

  // Horizon line
  ctx.beginPath();
  ctx.moveTo(cx - r - 10, cy);
  ctx.lineTo(cx + r + 10, cy);
  ctx.strokeStyle = 'rgba(255,255,255,0.1)';
  ctx.lineWidth = 1;
  ctx.stroke();

  // Labels
  const fmt = ts => new Date(ts * 1000).toLocaleTimeString('en-US', { hour:'2-digit', minute:'2-digit' });
  document.getElementById('sunriseTime').textContent = `🌅 ${fmt(sunrise)}`;
  document.getElementById('sunsetTime').textContent  = `🌇 ${fmt(sunset)}`;

  const pct = Math.round(progress * 100);
  document.getElementById('sunNow').textContent =
    now < sunrise ? 'Before sunrise' :
    now > sunset  ? 'After sunset' :
    `${pct}% through the day`;
}

// ============================
//  HOURLY FORECAST
// ============================
function renderHourly(list) {
  const container = document.getElementById('hourlyScroll');
  container.innerHTML = '';
  const now = Date.now() / 1000;

  list.slice(0, 16).forEach((item, i) => {
    const d = new Date(item.dt * 1000);
    const isNow = i === 0;
    const div = document.createElement('div');
    div.className = 'hour-item' + (isNow ? ' now' : '');
    const timeLabel = isNow ? 'Now' : d.toLocaleTimeString('en-US', { hour:'numeric', hour12:true });
    const rain = item.pop ? `💧${Math.round(item.pop * 100)}%` : '';
    div.innerHTML = `
      <div class="hour-time ${isNow ? 'now-label' : ''}">${timeLabel}</div>
      <div class="hour-icon">${getIcon(item.weather[0].id)}</div>
      <div class="hour-temp">${Math.round(item.main.temp)}${uSym()}</div>
      <div class="hour-rain">${rain}</div>
    `;
    div.title = `${item.weather[0].description} · Humidity: ${item.main.humidity}%`;
    container.appendChild(div);
  });
}

// ============================
//  5-DAY FORECAST
// ============================
function renderForecast(list) {
  // Group by day
  const days = {};
  list.forEach(item => {
    const key = new Date(item.dt * 1000).toDateString();
    if (!days[key]) days[key] = { items: [], temps: [], icons: [], pops: [], descs: [], date: new Date(item.dt * 1000) };
    days[key].items.push(item);
    days[key].temps.push(item.main.temp);
    days[key].icons.push(item.weather[0].id);
    days[key].pops.push(item.pop || 0);
    days[key].descs.push(item.weather[0].description);
  });

  const keys   = Object.keys(days).slice(0, 5);
  const allHi  = keys.map(k => Math.max(...days[k].temps));
  const allLo  = keys.map(k => Math.min(...days[k].temps));
  const minAll = Math.min(...allLo);
  const maxAll = Math.max(...allHi);

  const container = document.getElementById('forecastList');
  container.innerHTML = '';
  const dayNames = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

  keys.forEach((k, i) => {
    const d   = days[k];
    const hi  = Math.round(Math.max(...d.temps));
    const lo  = Math.round(Math.min(...d.temps));
    const pop = Math.round(Math.max(...d.pops) * 100);
    const iconCode = d.icons[Math.floor(d.icons.length / 2)];
    const desc = d.descs[Math.floor(d.descs.length / 2)];
    const name = i === 0 ? 'Today' : dayNames[d.date.getDay()];
    const barW = maxAll > minAll ? Math.round((hi - minAll) / (maxAll - minAll) * 100) : 50;

    const row = document.createElement('div');
    row.className = 'forecast-row';
    row.innerHTML = `
      <div class="fc-day-name">${name}</div>
      <div class="fc-icon">${getIcon(iconCode)}</div>
      <div class="fc-desc">${desc}</div>
      <div class="fc-bar-wrap">
        <div class="fc-lo-t">${lo}${uSym()}</div>
        <div class="fc-bar"><div class="fc-bar-fill" style="width:${barW}%"></div></div>
        <div class="fc-hi-t">${hi}${uSym()}</div>
      </div>
      ${pop ? `<div class="fc-pop">💧${pop}%</div>` : '<div class="fc-pop"></div>'}
    `;
    container.appendChild(row);
  });
}

// ============================
//  WIND COMPASS CANVAS
// ============================
function renderWindCompass(deg, speed) {
  const canvas = document.getElementById('windCompass');
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  const cx = W / 2, cy = H / 2, r = (Math.min(W, H) / 2) - 10;
  ctx.clearRect(0, 0, W, H);

  // Outer ring
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(255,255,255,0.1)';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Inner ring
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.65, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(255,255,255,0.05)';
  ctx.lineWidth = 1;
  ctx.stroke();

  // Cardinal labels
  ctx.font = '600 11px Syne, sans-serif';
  ctx.fillStyle = 'rgba(240,244,248,0.4)';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const labels = ['N','E','S','W'];
  labels.forEach((l, i) => {
    const a = (i * Math.PI / 2) - Math.PI / 2;
    const lx = cx + (r - 14) * Math.cos(a);
    const ly = cy + (r - 14) * Math.sin(a);
    ctx.fillStyle = l === 'N' ? '#4fc3f7' : 'rgba(240,244,248,0.35)';
    ctx.fillText(l, lx, ly);
  });

  // Tick marks
  for (let i = 0; i < 36; i++) {
    const a = (i / 36) * Math.PI * 2 - Math.PI / 2;
    const isMajor = i % 9 === 0;
    const r1 = r - (isMajor ? 8 : 5);
    ctx.beginPath();
    ctx.moveTo(cx + r1 * Math.cos(a), cy + r1 * Math.sin(a));
    ctx.lineTo(cx + r * Math.cos(a), cy + r * Math.sin(a));
    ctx.strokeStyle = isMajor ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.07)';
    ctx.lineWidth = isMajor ? 1.5 : 0.8;
    ctx.stroke();
  }

  // Wind needle
  const rad = (deg - 90) * Math.PI / 180;

  // Glow trail
  const grd = ctx.createLinearGradient(
    cx + (r*0.55) * Math.cos(rad + Math.PI), cy + (r*0.55) * Math.sin(rad + Math.PI),
    cx + (r*0.7)  * Math.cos(rad),           cy + (r*0.7)  * Math.sin(rad)
  );
  grd.addColorStop(0, 'rgba(79,195,247,0)');
  grd.addColorStop(1, 'rgba(79,195,247,0.4)');
  ctx.beginPath();
  ctx.moveTo(cx + (r*0.55) * Math.cos(rad + Math.PI), cy + (r*0.55) * Math.sin(rad + Math.PI));
  ctx.lineTo(cx + (r*0.7)  * Math.cos(rad),           cy + (r*0.7)  * Math.sin(rad));
  ctx.strokeStyle = grd;
  ctx.lineWidth = 8;
  ctx.lineCap = 'round';
  ctx.stroke();

  // Arrow head
  ctx.beginPath();
  ctx.moveTo(cx + (r * 0.7) * Math.cos(rad), cy + (r * 0.7) * Math.sin(rad));
  ctx.lineTo(cx + (r * 0.4) * Math.cos(rad + Math.PI), cy + (r * 0.4) * Math.sin(rad + Math.PI));
  ctx.strokeStyle = '#4fc3f7';
  ctx.lineWidth = 2.5;
  ctx.lineCap = 'round';
  ctx.stroke();

  // Centre dot
  ctx.beginPath();
  ctx.arc(cx, cy, 5, 0, Math.PI * 2);
  ctx.fillStyle = '#4fc3f7';
  ctx.fill();
}

// ============================
//  HUMIDITY GAUGE CANVAS
// ============================
function renderHumidityGauge(hum) {
  const canvas = document.getElementById('humidityGauge');
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  ctx.clearRect(0, 0, W, H);

  const cx = W / 2, cy = H - 10;
  const r  = (Math.min(W, H * 2) / 2) - 14;

  // Background arc
  ctx.beginPath();
  ctx.arc(cx, cy, r, Math.PI, 0, false);
  ctx.strokeStyle = 'rgba(255,255,255,0.06)';
  ctx.lineWidth = 14;
  ctx.lineCap = 'round';
  ctx.stroke();

  // Colour gradient by humidity
  const col = hum < 30 ? '#ff7043' : hum < 60 ? '#4fc3f7' : '#00e5ff';
  const endAngle = Math.PI + (hum / 100) * Math.PI;

  const grd = ctx.createLinearGradient(0, 0, W, 0);
  grd.addColorStop(0, '#ff7043');
  grd.addColorStop(0.5, '#4fc3f7');
  grd.addColorStop(1, '#00e5ff');

  ctx.beginPath();
  ctx.arc(cx, cy, r, Math.PI, endAngle, false);
  ctx.strokeStyle = grd;
  ctx.lineWidth = 14;
  ctx.lineCap = 'round';
  ctx.stroke();

  // Pointer dot
  const a = Math.PI + (hum / 100) * Math.PI;
  ctx.beginPath();
  ctx.arc(cx + r * Math.cos(a), cy + r * Math.sin(a), 7, 0, Math.PI * 2);
  ctx.fillStyle = col;
  ctx.shadowColor = col;
  ctx.shadowBlur = 10;
  ctx.fill();
  ctx.shadowBlur = 0;

  // Labels
  ctx.font = '400 10px DM Mono, monospace';
  ctx.fillStyle = 'rgba(240,244,248,0.3)';
  ctx.textAlign = 'left';
  ctx.fillText('0%', cx - r - 2, cy + 14);
  ctx.textAlign = 'right';
  ctx.fillText('100%', cx + r + 2, cy + 14);
}

function humidityLabel(h) {
  if (h < 20) return 'Very dry';
  if (h < 40) return 'Dry';
  if (h < 60) return 'Comfortable';
  if (h < 80) return 'Humid';
  return 'Very humid';
}

// ============================
//  ANIMATED BACKGROUND CANVAS
// ============================
let bgTheme = 'clear';
function updateBgTheme(code, isDay) {
  if (!isDay || code >= 803)     bgTheme = 'night';
  else if (code >= 500)          bgTheme = 'rain';
  else if (code >= 200)          bgTheme = 'storm';
  else                           bgTheme = 'clear';
}

function startBgCanvas() {
  const canvas = document.getElementById('bgCanvas');
  const ctx = canvas.getContext('2d');

  function resize() {
    canvas.width  = window.innerWidth;
    canvas.height = window.innerHeight;
  }
  resize();
  window.addEventListener('resize', resize);

  let t = 0;
  function draw() {
    const W = canvas.width, H = canvas.height;
    ctx.clearRect(0, 0, W, H);
    t += 0.004;

    if (bgTheme === 'clear') {
      // Slow rotating aurora
      for (let i = 0; i < 3; i++) {
        const x = W * (0.3 + i * 0.2) + Math.sin(t + i) * 120;
        const y = H * 0.3 + Math.cos(t * 0.7 + i) * 80;
        const grd = ctx.createRadialGradient(x, y, 0, x, y, 350);
        grd.addColorStop(0, `rgba(79,195,247,0.04)`);
        grd.addColorStop(1, 'transparent');
        ctx.fillStyle = grd;
        ctx.fillRect(0, 0, W, H);
      }
    } else if (bgTheme === 'rain') {
      const grd = ctx.createRadialGradient(W/2, H/3, 0, W/2, H/3, H);
      grd.addColorStop(0, `rgba(20,50,80,0.12)`);
      grd.addColorStop(1, 'transparent');
      ctx.fillStyle = grd;
      ctx.fillRect(0, 0, W, H);
    } else if (bgTheme === 'storm') {
      if (Math.random() < 0.005) {
        ctx.fillStyle = `rgba(255,255,255,0.03)`;
        ctx.fillRect(0, 0, W, H);
      }
      const grd = ctx.createRadialGradient(W/2, 0, 0, W/2, 0, H);
      grd.addColorStop(0, `rgba(100,60,120,0.08)`);
      grd.addColorStop(1, 'transparent');
      ctx.fillStyle = grd;
      ctx.fillRect(0, 0, W, H);
    } else {
      // night — subtle star twinkle handled by particles
      const grd = ctx.createRadialGradient(W*0.6, H*0.2, 0, W*0.6, H*0.2, W*0.5);
      grd.addColorStop(0, `rgba(30,20,60,0.1)`);
      grd.addColorStop(1, 'transparent');
      ctx.fillStyle = grd;
      ctx.fillRect(0, 0, W, H);
    }

    requestAnimationFrame(draw);
  }
  draw();
}

// ============================
//  PARTICLES
// ============================
function buildParticles() {
  const container = document.getElementById('particles');
  for (let i = 0; i < 25; i++) {
    const p = document.createElement('div');
    p.className = 'particle';
    const size = Math.random() * 3 + 1;
    p.style.cssText = `
      width:${size}px; height:${size}px;
      left:${Math.random() * 100}%;
      animation-duration:${8 + Math.random() * 16}s;
      animation-delay:${-Math.random() * 20}s;
      opacity:0.3;
    `;
    container.appendChild(p);
  }
}

// ============================
//  UI STATE HELPERS
// ============================
function showLoading() {
  document.getElementById('loadingState').style.display   = 'flex';
  document.getElementById('errorState').classList.add('hidden');
  document.getElementById('weatherContent').classList.add('hidden');
}
function hideLoading() {
  document.getElementById('loadingState').style.display = 'none';
}
function showError(msg) {
  hideLoading();
  document.getElementById('errorMsg').textContent = msg;
  document.getElementById('errorState').classList.remove('hidden');
  document.getElementById('weatherContent').classList.add('hidden');
}
function hideError() {
  document.getElementById('errorState').classList.add('hidden');
}
# Skyline — Global Weather App

Skyline is a browser-based weather dashboard for checking current weather conditions in cities around the world. It uses the OpenWeatherMap API and a responsive HTML, CSS, and JavaScript interface.

## Features

- Search for a city and view its current weather.
- Search suggestions powered by OpenWeatherMap geocoding.
- Quick access to popular cities, including Nairobi, London, Tokyo, and New York.
- Use browser geolocation to request weather for the current location.
- Switch between metric (°C, km/h) and imperial (°F, mph) units.
- View weather details such as humidity, wind, feels-like temperature, visibility, pressure, and cloud cover.
- Weather icons, loading states, and error handling.

## Technology

- HTML5
- CSS3
- Vanilla JavaScript
- OpenWeatherMap Current Weather and Geocoding APIs

## Run locally

1. Clone the repository:
   ```bash
   git clone https://github.com/robinmwaniki/weatherApp.git
   cd weatherApp
   ```
2. Configure your own OpenWeatherMap API key in `app.js`. Do not commit API keys or other credentials to a public repository.
3. Open `index.html` in a browser. If your browser restricts local features, serve the folder with a local HTTP server:
   ```bash
   python -m http.server 8000
   ```
4. Visit http://localhost:8000.

## Project files

- `index.html` — page structure and weather dashboard.
- `style.css` — layout, responsive styling, and visual effects.
- `app.js` — city search, geolocation, API requests, unit conversion, and weather rendering.

## API

Create an API key through [OpenWeatherMap](https://openweathermap.org/api) and use it locally. Keep credentials out of source control; a browser-only application cannot securely hide a key embedded in client-side JavaScript.

## License

No license file is currently documented in this repository.

## Saved cities
Use the Save city control to keep frequently checked locations in this browser. Saved cities are stored locally and can be removed. Storage is device/browser-specific.

## Development tests
Run dependency-free unit tests with Node.js 18 or newer: `node --test`.


## Recent searches
Skyline keeps up to eight recently viewed cities in browser localStorage. Select a city to view it again or clear the history. History is local to the current browser and device.


## City comparison
Compare the current dashboard city with another city using the existing OpenWeatherMap current-weather endpoint and configured key. The comparison request does not replace the primary dashboard location.


## Weather advisories
Skyline can display app-generated advisories for thunderstorms, likely rain, strong winds and temperature extremes using the current weather and forecast responses. Thresholds are configurable in the dashboard and saved locally. These are informational estimates, not official alerts or emergency warnings.


## Preferences and themes
The Preferences panel lets you choose metric/imperial units, dark/light appearance and a default startup city. Settings are stored in browser localStorage and are not synchronized across devices. The app still uses the same OpenWeatherMap connection.


## Share weather reports
Use Share report to open the device's native share sheet when supported. Otherwise Skyline copies the report to the clipboard. Copy report is always available when browser clipboard permissions allow it. Reports include city, temperature, conditions, humidity, wind and the current timestamp.


## Install and offline support (PWA)
Skyline can be installed on supported browsers over HTTPS or localhost. The service worker caches the app shell and static assets after the first successful load. Weather API requests are never cached, so fresh conditions require a network connection. Offline mode can reopen the cached interface and show an offline fallback when navigation cannot be served. On iOS, use Share → Add to Home Screen.


## Weather notifications
Notifications are opt-in and require browser permission. Skyline evaluates its existing rule-based advisories only when weather data is loaded or refreshed while the app is open; it does not poll in the background or guarantee delivery when closed. Duplicate alert sets are suppressed locally. You can disable notifications by revoking the browser permission or clearing the app's site data.


Recent search history records successful typed searches and selected search suggestions only. Automatic startup, quick-city shortcuts, saved-city navigation, geolocation and unit changes do not add history entries. Opt-in notifications use the same saved thresholds as the Weather Advisories panel.


## Editorial dashboard layout
The dashboard uses a two-column editorial composition on desktop: current conditions alongside sunrise/sunset, followed by a full-width hourly forecast, a five-day forecast with wind details, and compact supporting statistics. Secondary tools (favourites, recent searches, city comparison, advisories, preferences, sharing, install/offline support and notifications) are grouped in a separate section below the weather dashboard. The layout adapts for tablets and phones, including narrow 320px screens.

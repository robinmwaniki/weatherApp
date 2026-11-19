(function () {
  const routeInfo = {
    overview: { title: 'Overview', description: 'A quick look at weather around the world.' },
    current: { title: 'Current weather', description: 'Current conditions and local atmospheric details.' },
    hourly: { title: 'Hourly forecast', description: 'Explore the upcoming hours.' },
    forecast: { title: '5-day forecast', description: 'Plan ahead with the five-day outlook.' },
    saved: { title: 'Saved places', description: 'Your favourite cities, ready to revisit.' },
    history: { title: 'Recent searches', description: 'Cities you have checked recently.' },
    compare: { title: 'Compare cities', description: 'Compare current weather across locations.' },
    alerts: { title: 'Weather advisories', description: 'Rule-based guidance from current conditions.' },
    share: { title: 'Share weather', description: 'Create a compact report for your current city.' },
    notifications: { title: 'Notifications', description: 'Manage weather advisory notifications.' },
    install: { title: 'Install Skyline', description: 'Install the app and use its offline app shell.' },
    settings: { title: 'Preferences', description: 'Set your preferred units, theme and default city.' }
  };
  const panelRoutes = [
    ['saved', /saved places/i], ['history', /recent searches/i],
    ['compare', /compare cities/i], ['alerts', /weather advisories/i],
    ['share', /share weather/i], ['notifications', /weather notifications/i],
    ['install', /install skyline/i], ['settings', /preferences/i]
  ];
  const $ = selector => document.querySelector(selector);
  function currentPage() {
    const requested = new URLSearchParams(location.search).get('page');
    return Object.prototype.hasOwnProperty.call(routeInfo, requested) ? requested : 'overview';
  }
  function setHidden(element, hidden) {
    if (!element) return;
    element.classList.toggle('page-only-hidden', hidden);
  }
  function applyPage() {
    const page = currentPage();
    const info = routeInfo[page];
    document.body.dataset.page = page;
    document.title = 'Skyline — ' + info.title;
    let heading = $('#pageHeading');
    if (!heading) {
      heading = document.createElement('section');
      heading.id = 'pageHeading';
      heading.className = 'page-heading';
      const search = $('.search-section');
      search?.after(heading);
    }
    heading.innerHTML = '<h1></h1><p></p>';
    heading.querySelector('h1').textContent = info.title;
    heading.querySelector('p').textContent = info.description;

    const search = $('.search-section');
    const quick = $('.quick-section');
    const featureHost = $('#featurePanels');
    const main = $('#mainContent');
    const current = $('#currentCard');
    const weather = $('#weatherContent');
    const cards = {
      sun: $('.sun-card'), hourly: $('#hourlyForecast'), forecast: $('#fiveDayForecast'),
      wind: $('.wind-card'), humidity: $('.humidity-card'), map: $('.map-card'), extra: $('.extra-card')
    };
    setHidden(search, false);
    setHidden(quick, page !== 'overview');
    setHidden(featureHost, !panelRoutes.some(([route]) => route === page));
    setHidden(main, !['overview','current','hourly','forecast'].includes(page));
    setHidden(current, !['overview','current'].includes(page));
    setHidden(cards.sun, page !== 'current');
    setHidden(cards.hourly, page !== 'hourly');
    setHidden(cards.forecast, page !== 'forecast');
    ['wind','humidity','map','extra'].forEach(key => setHidden(cards[key], page !== 'current'));
    setHidden($('#loadingState'), !['overview','current','hourly','forecast'].includes(page));
    setHidden($('#errorState'), !['overview','current','hourly','forecast'].includes(page));

    if (weather) {
      weather.classList.toggle('page-only-hidden', !['overview','current','hourly','forecast'].includes(page));
      weather.style.display = ['overview','current','hourly','forecast'].includes(page) ? '' : 'none';
    }
    featureHost?.querySelectorAll('.feature-panel').forEach(panel => {
      const label = panel.querySelector('.card-label')?.textContent || '';
      const route = panelRoutes.find(([, pattern]) => pattern.test(label))?.[0];
      setHidden(panel, route !== page);
    });
    document.querySelectorAll('[data-page-link]').forEach(link => {
      const active = link.dataset.pageLink === page;
      link.classList.toggle('active', active);
      if (active) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    });
  }
  document.addEventListener('DOMContentLoaded', () => {
    applyPage();
    const host = $('#featurePanels');
    if (host && 'MutationObserver' in window) {
      new MutationObserver(applyPage).observe(host, { childList: true, subtree: true });
    }
    document.querySelectorAll('[data-page-link]').forEach(link => {
      link.addEventListener('click', event => {
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
        event.preventDefault();
        const page = link.dataset.pageLink;
        const url = new URL(location.href);
        url.searchParams.set('page', page);
        history.pushState({}, '', url);
        applyPage();
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });
    });
    window.addEventListener('popstate', applyPage);
  });
})();
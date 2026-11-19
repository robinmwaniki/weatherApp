(function(){
  let requestId=0, latestEnvironment=null;
  const el=id=>document.getElementById(id);
  const format=value=>value===null||value===undefined||!Number.isFinite(Number(value))?'—':Number(value).toFixed(1);
  function metric(label,value,unit,note){const card=document.createElement('div');card.className='environment-metric';const title=document.createElement('div');title.className='metric-label';title.textContent=label;const strong=document.createElement('strong');strong.textContent=value+unit;const small=document.createElement('small');small.textContent=note;card.append(title,strong,small);return card}
  function renderAirQuality(data){
    const value=el('environmentAqi'),category=el('environmentCategory'),advice=el('environmentAdvice'),updated=el('environmentUpdated');
    value.textContent=data.aqi===null?'—':String(Math.round(data.aqi));
    category.textContent=data.category;
    advice.textContent=data.advice;
    updated.textContent=data.time?'Modelled forecast · '+data.time:'Modelled forecast · timestamp unavailable';
    const grid=el('environmentAirMetrics');grid.replaceChildren(
      metric('PM2.5',format(data.pm25),' µg/m³','Fine particulate matter'),
      metric('PM10',format(data.pm10),' µg/m³','Coarse particulate matter')
    );
  }
  function renderForecast(environment){
    const uv=environment&&environment.hourly?environment.hourly.find(item=>item.uvIndex!==null&&item.uvIndex!==undefined):null;
    el('environmentUvNow').textContent=uv?format(uv.uvIndex):'—';
    el('environmentUvMax').textContent=environment&&environment.dailyUvMax!==null&&environment.dailyUvMax!==undefined?format(environment.dailyUvMax):'—';
    el('environmentUvAdvice').textContent=uv?uvAdvice(Number(uv.uvIndex)):'UV forecast is unavailable for this location.';
    const rain=el('environmentRainList');rain.replaceChildren();
    const samples=(environment&&environment.hourly||[]).filter((item,index)=>index%3===0).slice(0,8);
    if(!samples.length){const p=document.createElement('p');p.className='environment-status';p.textContent='Precipitation forecast is unavailable.';rain.append(p);return}
    samples.forEach(item=>{
      const wrap=document.createElement('div');wrap.className='environment-rain-item';
      const time=document.createElement('span');time.textContent=item.localTime||'—';
      const track=document.createElement('div');track.className='environment-rain-track';
      const bar=document.createElement('div');bar.className='environment-rain-bar';
      const chance=Number.isFinite(Number(item.precipitationProbability))?Math.max(0,Math.min(100,Number(item.precipitationProbability))):0;
      bar.style.height=Math.max(4,chance*.62)+'px';bar.setAttribute('aria-hidden','true');track.append(bar);
      const percent=document.createElement('strong');percent.textContent=item.precipitationProbability===null||item.precipitationProbability===undefined?'—':Math.round(chance)+'%';
      const amount=document.createElement('span');amount.className='environment-rain-amount';
      amount.textContent=item.precipitation===null||item.precipitation===undefined?'— mm':format(item.precipitation)+' mm';
      wrap.setAttribute('aria-label',(item.localTime||'Hour')+': '+percent.textContent+' precipitation probability, '+amount.textContent+' expected precipitation');
      wrap.append(time,track,percent,amount);rain.append(wrap);
    });
  }
  function uvAdvice(value){
    if(value<3)return 'Low exposure: protection is generally not needed for most people.';
    if(value<6)return 'Moderate exposure: seek shade during midday and consider sunscreen.';
    if(value<8)return 'High exposure: use shade, protective clothing and broad-spectrum sunscreen.';
    if(value<11)return 'Very high exposure: minimise midday sun and use strong sun protection.';
    return 'Extreme exposure: avoid direct midday sun and use maximum sun protection.';
  }
  async function loadAirQuality(detail){
    const idNow=++requestId;const status=el('environmentStatus');
    status.textContent='Loading air quality forecast…';
    try{
      const url=window.SkylineWeatherApi.buildAirQualityUrl(detail.cur.coord.lat,detail.cur.coord.lon);
      const payload=await window.SkylineWeatherApi.requestJson(url);
      if(idNow!==requestId)return;
      const normalized=window.SkylineWeatherApi.normalizeAirQualityResponse(payload,Date.now());
      renderAirQuality(normalized);status.textContent='Air quality is a modelled forecast, not an official monitoring-station reading.';
    }catch(error){
      if(idNow!==requestId)return;
      renderAirQuality({aqi:null,pm25:null,pm10:null,category:'Unavailable',advice:'Air quality could not be loaded. Check your connection and try again.',time:null});
      status.textContent=error.message||'Air quality data is temporarily unavailable.';
    }
  }
  if(typeof document!=='undefined')document.addEventListener('DOMContentLoaded',()=>{
    const host=el('featurePanels');if(!host)return;
    const panel=document.createElement('section');panel.className='feature-panel';
    panel.innerHTML='<div class="card-label">Environmental insights</div><p class="feature-subtitle">Air quality, sun exposure and precipitation outlook for the selected city.</p><div class="environment-summary"><div class="environment-aqi"><div class="environment-aqi-value" id="environmentAqi" aria-label="US air quality index">—</div><div class="environment-aqi-copy"><strong id="environmentCategory">Waiting for data</strong><span>US Air Quality Index</span></div></div><span class="environment-updated" id="environmentUpdated">Waiting for forecast…</span></div><div class="environment-advice" id="environmentAdvice" role="status" aria-live="polite">Load a city to see environmental guidance.</div><div class="environment-grid" id="environmentAirMetrics"></div><h2 class="environment-section-title">UV exposure</h2><div class="environment-grid"><div class="environment-metric"><div class="metric-label">Current / next hour UV</div><strong id="environmentUvNow">—</strong><small>UV index</small></div><div class="environment-metric"><div class="metric-label">Daily maximum UV</div><strong id="environmentUvMax">—</strong><small>Forecast peak</small></div></div><p class="environment-status" id="environmentUvAdvice">UV guidance will appear when forecast data loads.</p><h2 class="environment-section-title">Next 24 hours · precipitation chance</h2><div class="environment-rain-list" id="environmentRainList" aria-label="Hourly precipitation probability"></div><p class="environment-status" id="environmentStatus" role="status" aria-live="polite">Environmental data will load after the weather forecast.</p>';
    host.append(panel);
    if(latestEnvironment)renderForecast(latestEnvironment);
  });
  if(typeof window!=='undefined')window.addEventListener('skyline:weather-updated',event=>{
    const detail=event.detail||{};if(!detail.cur||!detail.cur.coord)return;
    latestEnvironment=detail.environment||detail.fore&&detail.fore.environment||null;
    if(el('environmentAqi')){renderForecast(latestEnvironment);loadAirQuality(detail)}
  });
  if(typeof module!=='undefined'&&module.exports)module.exports={uvAdvice};
})();
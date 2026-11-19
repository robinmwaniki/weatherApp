(function(root){
  function apiMessage(data,status){
    const code=Number(data&&data.cod)||Number(status)||0;
    const message=String(data&&data.message||'').toLowerCase();
    if(code===401)return 'Weather service rejected the API key. Check that the OpenWeatherMap key is active and enabled for Current Weather and 5 Day Forecast.';
    if(code===404)return 'City or location was not found. Check the spelling and try again.';
    if(code===429)return 'Weather service rate limit reached. Please wait a moment and try again.';
    if(code>=500)return 'OpenWeatherMap is temporarily unavailable. Please try again shortly.';
    if(message.includes('invalid api key')||message.includes('appid'))return 'Weather service rejected the API key. Check your OpenWeatherMap API key.';
    return (data&&data.message)||'Weather request failed (HTTP '+(status||'unknown')+'). Please try again.';
  }
  async function requestJson(url,fetchImpl){
    const doFetch=fetchImpl||root.fetch;
    let response;
    try{response=await doFetch(url)}catch(error){throw new Error('Unable to reach the weather service. Check your internet connection and try again.')}
    let data;
    try{data=await response.json()}catch(error){throw new Error('The weather service returned an unreadable response. Please try again.')}
    if(!response.ok||(data&&data.cod!==undefined&&Number(data.cod)!==200))throw new Error(apiMessage(data,response.status));
    return data;
  }
  function isCurrentWeatherPayload(data){
    return Boolean(data&&data.main&&data.sys&&data.coord&&data.wind&&data.clouds&&Array.isArray(data.weather)&&data.weather.length&&Number.isFinite(Number(data.main.temp))&&Number.isFinite(Number(data.coord.lat))&&Number.isFinite(Number(data.coord.lon)));
  }
  function forecastList(data){return data&&Array.isArray(data.list)?data.list:[]}
  function createRequestGate(){let latest=0;return{next(){latest+=1;return latest},isLatest(id){return id===latest}}}
  const api={apiMessage,requestJson,isCurrentWeatherPayload,forecastList,createRequestGate};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  root.SkylineWeatherApi=api;
})(typeof globalThis!=='undefined'?globalThis:this);

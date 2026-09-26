(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const SETTINGS_KEY = 'hch.settings.v1';
  const defaults = {channelName:'HelmetCamHeroes',channel:'@HelmetCamHeroes',apiKey:'',refreshMinutes:15,nightEnabled:true,autoDim:true,nightColor:'amber',nightStart:'22:00',nightEnd:'07:00',hour24:true,showComments:true,keepAwake:true,demo:false};
  const read = (key, fallback) => { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } };
  const write = (key, value) => { try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch { return false; } };
  const validTime = value => /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
  function normalize(value) {
    const c = {...defaults,...value};
    c.channel = String(c.channel || defaults.channel).trim();
    c.nightColor = c.nightColor==='red'?'red':'amber';
    c.apiKey = String(c.apiKey || '').trim();
    c.refreshMinutes = Math.min(1440,Math.max(5,Number(c.refreshMinutes) || 15));
    if (!validTime(c.nightStart)) c.nightStart = defaults.nightStart;
    if (!validTime(c.nightEnd)) c.nightEnd = defaults.nightEnd;
    return c;
  }
  let config = normalize({...window.DASHBOARD_CONFIG,...read(SETTINGS_KEY,{})});
  let mode = 'auto', timer, controller, generation = 0, last = null, comments = null, latestVideo = null, videoMessage = '', wake = null, waking = false, awakeRequested = false;
  let currentNight = false, controlsTimer;
  const number = value => Number(value).toLocaleString();
  const cacheKey = () => 'hch.data.v1.' + config.channel;
  const videoKey = () => 'hch.video.v1.' + config.channel;
  const commentsKey = () => 'hch.comments.v1.' + config.channel;
  const dayStart = () => { const d=new Date(); d.setHours(0,0,0,0); return d.getTime(); };
  let observedDay = dayStart();
  let commentsMessage = '';
  const status = (message, live=false) => { $('status').textContent=message; $('statusDot').classList.toggle('live',live); };
  const minutes = text => {const [h,m]=text.split(':').map(Number); return h*60+m;};
  function scheduledNight(date) {
    if (!config.nightEnabled) return false;
    const start=minutes(config.nightStart), end=minutes(config.nightEnd), now=date.getHours()*60+date.getMinutes();
    return start===end ? false : start>end ? now>=start || now<end : now>=start && now<end;
  }
  function tick() {
    const date = new Date();
    $('night').classList.toggle('red-clock',config.nightColor==='red');
    if (observedDay!==dayStart()) { observedDay=dayStart(); comments=null; commentsMessage=''; renderComments(); refresh(); }
    const options = {hour:'2-digit',minute:'2-digit',hour12:!config.hour24};
    const time = date.toLocaleTimeString([],options);
    $('dayTime').textContent=time;
    $('nightTime').textContent=time;
    $('nightDate').textContent=date.toLocaleDateString([],{weekday:'long',day:'numeric',month:'long'});
    const sensorEnabled = config.autoDim && mode==='auto' && scheduledNight(date);
    if (window.NIGHT_LIGHT_ENABLED !== sensorEnabled) {
      window.NIGHT_LIGHT_ENABLED = sensorEnabled;
      window.dispatchEvent(new Event('nightlightchange'));
    }
    const night = mode==='night' || (mode==='auto' && scheduledNight(date));
    if (night!==currentNight) { currentNight=night; $('dashboard').hidden=night; $('night').hidden=!night; document.body.classList.toggle('is-night',night); }
    // A subtle periodic position shift reduces static pixels; it cannot prevent burn-in.
    const step = Math.floor(date.getTime()/60000)%9;
    $('clockBlock').style.transform=`translate(${(step%3-1)*7}px,${(Math.floor(step/3)-1)*7}px)`;
  }
  function render() {
    $('channelName').textContent=last?.title || config.channelName;
    renderComments();
    $('count').textContent=last ? (last.hidden ? 'Hidden' : number(last.subscribers)) : '—';
    $('count').style.fontSize = last?.hidden ? 'clamp(64px,12vw,170px)' : '';
    renderVideo();
    $('videos').textContent=last ? number(last.videos) : '—';
    $('dataNote').textContent=config.demo ? 'Sample data · preview only' : last ? (last.hidden ? 'This channel does not share its subscriber count.' : 'Public YouTube count · rounded by YouTube') : 'Connect YouTube in Settings to see your subscribers.';
    $('scheduleLabel').textContent=config.nightEnabled && config.nightStart!==config.nightEnd ? `Night clock · ${config.nightStart}–${config.nightEnd}` : 'Night schedule off';
  }
  function renderVideo() {
    $('views').textContent=config.demo?'24,810':latestVideo && !latestVideo.empty?number(latestVideo.views):'—';
    $('videoTitle').textContent=config.demo?'Sample latest upload':videoMessage || (latestVideo?.empty?'No public videos yet':latestVideo?.title || 'Latest public upload');
  }
  async function fetchLatestVideo(playlistId, signal) {
    if(!playlistId) throw new Error('Latest video unavailable');
    async function get(resource, params) {
      const url=new URL('https://www.googleapis.com/youtube/v3/'+resource);
      url.search=new URLSearchParams({...params,key:config.apiKey});
      const response=await fetch(url,{signal,cache:'no-store'});
      const data=await response.json();
      if(!response.ok || !Array.isArray(data.items)) throw new Error('Latest video unavailable · check API access');
      return data;
    }
    const uploads=await get('playlistItems',{part:'contentDetails',playlistId,maxResults:'1'});
    if(!uploads.items.length) return {empty:true,at:Date.now()};
    const id=uploads.items[0].contentDetails?.videoId;
    if(!id) throw new Error('Latest video unavailable');
    const data=await get('videos',{part:'snippet,statistics',id});
    const video=data.items[0], views=video?.statistics?.viewCount;
    if(!video || views==null || !Number.isFinite(Number(views))) throw new Error('Latest video unavailable');
    return {id:video.id,title:video.snippet.title,views:Number(views),at:Date.now()};
  }
  function renderComments() {
    $('commentsCard').hidden=!config.showComments;
    const current=comments && comments.day===dayStart();
    $('comments').textContent=config.demo?'8':current?number(comments.count)+(comments.partial?'+':''):'—';
    $('commentsNote').textContent=config.demo?'Sample comments':commentsMessage || (current ? (comments.partial?'Partial count · ': '')+'Excludes replies · '+new Date(comments.at).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'}) : 'Public comments · excluding replies');
  }
  async function fetchComments(channelId, signal) {
    const day=dayStart(), until=Date.now(), seen=new Set();
    let pageToken='', count=0;
    // Bound requests on very busy channels; never present a truncated result as exact.
    for (let page=0;page<10;page++) {
      const url=new URL('https://www.googleapis.com/youtube/v3/commentThreads');
      url.search=new URLSearchParams({part:'snippet',allThreadsRelatedToChannelId:channelId,order:'time',maxResults:'100',textFormat:'plainText',key:config.apiKey,...(pageToken?{pageToken}:{})});
      const response=await fetch(url,{signal,cache:'no-store'});
      const data=await response.json();
      if(!response.ok) throw new Error('Comments unavailable · check API access or quota');
      if(!Array.isArray(data.items)) throw new Error('Comments unavailable · incomplete response');
      let reachedEarlier=false;
      for(const thread of data.items) {
        const comment=thread.snippet?.topLevelComment;
        const at=Date.parse(comment?.snippet?.publishedAt);
        if(!comment?.id || !Number.isFinite(at)) throw new Error('Comments unavailable · incomplete response');
        if(at<day) reachedEarlier=true;
        if(at>=day && at<=until && !seen.has(comment.id)) {count++;seen.add(comment.id);}
      }
      pageToken=data.nextPageToken || '';
      if(reachedEarlier || !pageToken) return {day,count,at:Date.now(),partial:false};
    }
    return {day,count,at:Date.now(),partial:true};
  }
  function loadCache() {
    const cached=read(cacheKey(),null);
    last=cached && typeof cached.at==='number' && Date.now()-cached.at<30*86400000 ? cached : null;
    const cachedVideo=read(videoKey(),null);
    latestVideo=cachedVideo && Date.now()-cachedVideo.at<30*86400000?cachedVideo:null;
    videoMessage=latestVideo?'Saved · '+new Date(latestVideo.at).toLocaleString()+' · '+(latestVideo.title || 'No public videos'):'';
    comments=read(commentsKey(),null);
    commentsMessage='';
    render();
  }
  function refreshedLabel() { return 'Updated ' + new Date(last.at).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'}); }
  async function refresh() {
    clearTimeout(timer);
    controller?.abort();
    const run=++generation;
    if (config.demo) { last={title:config.channelName,subscribers:12800,views:2486310,videos:186,at:Date.now(),hidden:false}; render(); status('Sample data · not live'); return; }
    if (!config.apiKey) { status(last?'Saved '+new Date(last.at).toLocaleString()+' · API key needed':'Setup needed · open Settings'); return; }
    status(last?'Refreshing · showing saved count':'Connecting to YouTube…');
    controller=new AbortController();
    const timeout=setTimeout(()=>controller?.abort(),15000);
    try {
      const url=new URL('https://www.googleapis.com/youtube/v3/channels');
      url.search=new URLSearchParams({part:'snippet,statistics,contentDetails',key:config.apiKey,[config.channel.startsWith('UC')?'id':'forHandle']:config.channel});
      const response=await fetch(url,{signal:controller.signal,cache:'no-store'});
      const data=await response.json();
      if (run!==generation) return;
      if (!response.ok) {
        const reason=data.error?.errors?.[0]?.reason || '';
        throw new Error(/quota|dailyLimit/i.test(reason)?'YouTube quota reached. Wait for the quota reset.':response.status===403?'Access denied. Check API, key and website restrictions.':'YouTube request failed. Check your API key.');
      }
      const item=data.items?.[0];
      if (!item) throw new Error('Channel not found. Check the exact handle or channel ID.');
      const s=item.statistics;
      if (!s || !Number.isFinite(Number(s.videoCount)) || (!s.hiddenSubscriberCount && !Number.isFinite(Number(s.subscriberCount)))) throw new Error('YouTube returned incomplete statistics.');
      last={id:item.id,title:item.snippet.title,subscribers:Number(s.subscriberCount||0),videos:Number(s.videoCount),hidden:!!s.hiddenSubscriberCount,at:Date.now()};
      const saved=write(cacheKey(),last);
      render(); status(refreshedLabel()+(saved?'':' · storage unavailable'),true);
      videoMessage='Checking latest upload…';renderVideo();
      try {
        const result=await fetchLatestVideo(item.contentDetails?.relatedPlaylists?.uploads,controller.signal);
        if(run!==generation) return;
        latestVideo=result;videoMessage='';write(videoKey(),latestVideo);
      } catch(error) {
        if(run!==generation) return;
        videoMessage=(latestVideo?'Saved '+new Date(latestVideo.at).toLocaleString()+' · ':'')+'Latest video unavailable';
      }
      renderVideo();
      if(config.showComments) {
        commentsMessage='Checking today’s comments…';renderComments();
        try {
          const result=await fetchComments(last.id,controller.signal);
          if(run!==generation) return;
          comments=result;commentsMessage='';write(commentsKey(),comments);
        } catch(error) {
          if(run!==generation) return;
          const detail=error.name==='AbortError'?'Comments request timed out':error instanceof TypeError?'Comments offline':error.message;
          commentsMessage=comments?.day===dayStart()?'Saved '+new Date(comments.at).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})+' · '+detail:detail;
        }
        renderComments();
      }
    } catch (error) {
      if (run!==generation) return;
      const message=error.name==='AbortError'?'Request timed out. Retrying later.':error instanceof TypeError?'Offline or connection blocked. Retrying later.':error.message;
      status((last?'Saved '+new Date(last.at).toLocaleString()+' · ':'')+message);
      videoMessage=(latestVideo?'Saved '+new Date(latestVideo.at).toLocaleString()+' · ':'')+'Latest video unavailable';renderVideo();
      commentsMessage=comments?.day===dayStart()?'Saved comments · '+new Date(comments.at).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'}):'Comments unavailable · retrying later';renderComments();
    } finally {
      clearTimeout(timeout);
      if (run===generation) timer=setTimeout(refresh,config.refreshMinutes*60000);
    }
  }
  async function syncWake() {
    if (!config.keepAwake || document.visibilityState!=='visible') { if(wake) {await wake.release();wake=null;} return; }
    if (!awakeRequested || wake || waking || !('wakeLock' in navigator)) return;
    waking=true;
    try {wake=await navigator.wakeLock.request('screen');wake.addEventListener('release',()=>{wake=null;});if(!config.keepAwake){await wake.release();wake=null;}} catch { /* Kiosk/browser settings may be needed. */ } finally {waking=false;}
  }
  function closeSettings() { $('settingsPanel').hidden=true;document.body.classList.remove('modal-open');$('settingsButton').focus(); }
  $('settingsButton').addEventListener('click',()=>{
    const form=$('settingsForm');
    for(const [key,value] of Object.entries(config)){const input=form.elements.namedItem(key);if(input){if(input.type==='checkbox')input.checked=!!value;else input.value=value;}}
    $('formMessage').textContent='';$('settingsPanel').hidden=false;document.body.classList.add('modal-open');$('closeSettings').focus();
  });
  $('closeSettings').addEventListener('click',closeSettings);
  $('settingsPanel').addEventListener('click',e=>{if(e.target===$('settingsPanel'))closeSettings();});
  document.addEventListener('keydown',e=>{
    if($('settingsPanel').hidden)return;
    if(e.key==='Escape')closeSettings();
    if(e.key==='Tab') {const items=[...$('settingsPanel').querySelectorAll('button,input,select')];const first=items[0],end=items[items.length-1];if(e.shiftKey&&document.activeElement===first){e.preventDefault();end.focus();}else if(!e.shiftKey&&document.activeElement===end){e.preventDefault();first.focus();}}
  });
  $('settingsForm').addEventListener('submit',e=>{
    e.preventDefault();const form=e.currentTarget, values={};
    for(const input of form.elements)if(input.name)values[input.name]=input.type==='checkbox'?input.checked:input.value;
    if(!/^(@[\p{L}\p{N}_.·-]+|UC[\w-]{22}|[\p{L}\p{N}_.·-]+)$/u.test(values.channel.trim())){$('formMessage').textContent='Enter an @handle or a channel ID, rather than a URL.';return;}
    config=normalize({...config,...values});
    const saved=write(SETTINGS_KEY,config);mode='auto';$('modeButton').textContent='Mode: Auto';
    loadCache();tick();syncWake();refresh();
    if(saved)closeSettings();else $('formMessage').textContent='Applied for this session. Browser storage is unavailable, so settings will not survive a reload.';
  });
  $('modeButton').addEventListener('click',()=>{mode={auto:'day',day:'night',night:'auto'}[mode];$('modeButton').textContent='Mode: '+{auto:'Auto',day:'Day',night:'Night'}[mode];tick();});
  $('fullscreenButton').addEventListener('click',async()=>{
    try{if(document.fullscreenElement)await document.exitFullscreen();else if(document.documentElement.requestFullscreen)await document.documentElement.requestFullscreen();else throw new Error();}
    catch{status('Full screen unavailable · use your kiosk browser controls');}
    awakeRequested=true;syncWake();
  });
  document.addEventListener('fullscreenchange',()=>{$('fullscreenButton').textContent=document.fullscreenElement?'Exit full screen':'Full screen';});
  document.addEventListener('pointerdown',()=>{awakeRequested=true;syncWake();document.body.classList.add('controls-visible');clearTimeout(controlsTimer);controlsTimer=setTimeout(()=>document.body.classList.remove('controls-visible'),5000);});
  document.addEventListener('visibilitychange',()=>{tick();syncWake();if(document.visibilityState==='visible' && (!last || Date.now()-last.at>=config.refreshMinutes*60000))refresh();});
  window.addEventListener('online',refresh);
  loadCache();tick();refresh();setInterval(tick,1000);
})();

(() => {
  'use strict';
  const button = document.getElementById('checkSensor');
  const status = document.getElementById('sensorStatus');
  const clock = document.getElementById('clockBlock');
  let sensor = null, watchdog = null, failed = false, test = false, smoothed = null;
  const enabled = () => !!window.NIGHT_LIGHT_ENABLED && !document.hidden;
  const fallback = () => {clock.style.setProperty('--clock-brightness', '1');smoothed=null;};
  function stop() {
    clearTimeout(watchdog);
    const old=sensor;sensor=null;
    if(old) { try {old.stop();} catch {} }
    button.disabled=false;
  }
  function fail(message) {
    stop();fallback();failed=true;test=false;
    status.textContent=message+' Using the chosen clock colour at its normal brightness.';
  }
  function armWatchdog() {
    clearTimeout(watchdog);
    watchdog=setTimeout(()=>fail('No recent light-sensor reading.'),15000);
  }
  function start() {
    if(sensor || document.hidden || failed) return;
    if(!window.isSecureContext) {fail('Open the HTTPS dashboard to use the sensor.');return;}
    if(!('AmbientLightSensor' in window)) {fail('This browser does not expose a light sensor.');return;}
    status.textContent='Checking room light…';
    try {
      const active=new window.AmbientLightSensor({frequency:1});sensor=active;
      active.addEventListener('reading',()=>{
        if(sensor!==active) return;
        const lux=active.illuminance;
        if(typeof lux!=='number' || !Number.isFinite(lux) || lux<0) return;
        armWatchdog();
        // Smooth changes and retain visible digits even at zero lux.
        const target=0.18+1.32*Math.min(1,Math.log10(1+lux)/Math.log10(101));
        smoothed=smoothed===null?target:smoothed+0.2*(target-smoothed);
        if(enabled()) clock.style.setProperty('--clock-brightness',smoothed.toFixed(3));
        else fallback();
        status.textContent=lux.toLocaleString(undefined,{maximumFractionDigits:1})+' lux · '+(enabled()?'Night digits adapt to room light.':'Sensor works. Automatic dimming starts during the night schedule.');
        if(test) {test=false;button.disabled=false;if(!enabled()) stop();}
      });
      active.addEventListener('error',event=>{
        if(sensor!==active) return;
        const denied=['NotAllowedError','SecurityError'].includes(event.error?.name);
        fail(denied?'Sensor access is blocked.':'Light sensor unavailable.');
      });
      armWatchdog();active.start();
    } catch {fail('Light-sensor access is unavailable or blocked.');}
  }
  function sync() {
    if(enabled()) start();
    else {stop();fallback();failed=false;test=false;}
  }
  button.addEventListener('click',()=>{stop();failed=false;test=true;button.disabled=true;start();});
  window.addEventListener('nightlightchange',sync);
  document.addEventListener('visibilitychange',sync);
  window.addEventListener('pagehide',()=>{stop();fallback();});
  sync();
})();

const $=id=>document.getElementById(id);
const map=L.map('map').setView([52.1,5.3],7);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'© OpenStreetMap'}).addTo(map);
let marker=null,routeLayer=null,watchId=null,current=null,routeCoords=[],cameraMarkers=[],cameras=[],fuelMarkers=[],fuelStations=[],fuelVisible=false,voiceOn=true,lastCameraAlert=0,routeSteps=[],nextStepIndex=0;
function say(t){if(voiceOn&&'speechSynthesis'in window){speechSynthesis.cancel();const u=new SpeechSynthesisUtterance(t);u.lang='nl-NL';speechSynthesis.speak(u);}}
function status(t){$('status').textContent=t;}
function setSpeed(s){$('speed').textContent=s===null||!Number.isFinite(s)?'--':Math.round(s*3.6);}
function gpsStart(){
 if(!navigator.geolocation){status('GPS niet beschikbaar');return;}
 if(watchId!==null)return;
 status('GPS zoeken…');
 watchId=navigator.geolocation.watchPosition(p=>{
  current=[p.coords.longitude,p.coords.latitude];setSpeed(p.coords.speed);status('GPS actief');
  if(!marker){marker=L.marker([current[1],current[0]]).addTo(map).bindPopup('Jouw locatie');map.setView([current[1],current[0]],14);}
  else marker.setLatLng([current[1],current[0]]);
  updateNavigation();cameraProximity();
 },e=>{status('GPS-fout: '+e.message);$('alert').textContent='Locatie niet beschikbaar. Controleer locatietoestemming en GPS.';},{enableHighAccuracy:true,maximumAge:1000,timeout:20000});
}
function waitForGPS(ms=20000){return new Promise((resolve,reject)=>{if(current)return resolve(current);gpsStart();const started=Date.now();const timer=setInterval(()=>{if(current){clearInterval(timer);resolve(current);}else if(Date.now()-started>=ms){clearInterval(timer);reject(Error('GPS heeft geen locatie gevonden. Controleer Android-locatietoestemming of vul een vertrekadres in.'));}},250);});}
function stop(){if(watchId!==null)navigator.geolocation.clearWatch(watchId);watchId=null;if(routeLayer){map.removeLayer(routeLayer);routeLayer=null;}routeCoords=[];routeSteps=[];$('instruction').textContent='Navigatie gestopt.';$('details').textContent='Afstand: -- · Reistijd: --';}
async function geocode(q){
 const u='https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=nl,be,lu&q='+encodeURIComponent(q);
 const r=await fetch(u,{headers:{'Accept-Language':'nl'}});if(!r.ok)throw Error('Adres zoeken lukt nu niet. Probeer opnieuw.');const a=await r.json();if(!a.length)throw Error('Bestemming niet gevonden in Nederland, België of Luxemburg.');return [Number(a[0].lon),Number(a[0].lat)];
}
function fmtDist(m){return m>=1000?(m/1000).toFixed(1)+' km':Math.round(m)+' m';}
function instructionText(step){
 if(!step)return 'Volg de route op de kaart.';
 const type=step.maneuver?.type||'continue',mod=step.maneuver?.modifier||'';
 const words={turn:'Sla af','new name':'Volg de weg',depart:'Vertrek',arrive:'Je bent aangekomen',roundabout:'Neem de rotonde',merge:'Voeg in',fork:'Houd','end of road':'Sla aan het einde af',continue:'Volg'};
 const modifiers={left:'links',right:'rechts',slight_left:'schuin links',slight_right:'schuin rechts',sharp_left:'scherp links',sharp_right:'scherp rechts',straight:'rechtdoor'};
 return (words[type]||'Volg')+(mod?' '+(modifiers[mod]||mod):'')+(step.name?' naar '+step.name:'')+' · '+fmtDist(step.distance);
}
async function getRoute(mode){
 const destText=$('to').value.trim();if(!destText){$('instruction').textContent='Vul eerst een bestemming in.';return;}
 $('go').disabled=true;$('instruction').textContent='GPS en bestemming ophalen…';
 try{
  let start;if($('from').value.trim())start=await geocode($('from').value.trim());else start=await waitForGPS();
  const end=await geocode(destText);$('instruction').textContent='Route wordt berekend…';
  const coords=start.join(',')+';'+end.join(',');
  const url='https://router.project-osrm.org/route/v1/driving/'+coords+'?overview=full&geometries=geojson&steps=true&alternatives='+ (mode==='scenic'?'true':'false');
  const res=await fetch(url);if(!res.ok)throw Error('Route-service tijdelijk niet bereikbaar.');const data=await res.json();if(data.code!=='Ok'||!data.routes?.length)throw Error('Geen route gevonden tussen deze locaties.');
  let chosen=data.routes[0];if(mode==='scenic'&&data.routes.length>1)chosen=data.routes.reduce((a,b)=>b.distance>a.distance?b:a);
  routeCoords=chosen.geometry.coordinates;routeSteps=(chosen.legs||[]).flatMap(l=>l.steps||[]);nextStepIndex=0;
  if(routeLayer)map.removeLayer(routeLayer);routeLayer=L.geoJSON(chosen.geometry,{style:{color:mode==='scenic'?'#e6a23c':'#1677d2',weight:7,opacity:.9}}).addTo(map);
  map.fitBounds(routeLayer.getBounds(),{padding:[25,25]});
  $('details').textContent='Afstand: '+fmtDist(chosen.distance)+' · Geschatte reistijd: '+Math.round(chosen.duration/60)+' min'+(mode==='scenic'?' · Alternatieve route indien beschikbaar':'');
  $('instruction').textContent=instructionText(routeSteps[0]);say($('instruction').textContent);loadCameras();
 }catch(e){$('instruction').textContent=e.message;status('Route niet beschikbaar');}finally{$('go').disabled=false;}
}
function updateNavigation(){
 if(!current||!routeSteps.length)return;
 while(nextStepIndex<routeSteps.length-1){const loc=routeSteps[nextStepIndex].maneuver?.location;if(!loc)break;const d=map.distance([current[1],current[0]],[loc[1],loc[0]]);if(d<35)nextStepIndex++;else break;}
 const s=routeSteps[nextStepIndex];if(s){$('instruction').textContent=instructionText(s);const loc=s.maneuver?.location;if(loc){const d=map.distance([current[1],current[0]],[loc[1],loc[0]]);if(d<180&&d>25)$('alert').textContent='Volgende manoeuvre over '+Math.round(d)+' meter';}}
}
async function loadCameras(){
 cameraMarkers.forEach(m=>map.removeLayer(m));cameraMarkers=[];cameras=[];if(!routeCoords.length)return;
 const sample=routeCoords.filter((_,i)=>i%Math.max(1,Math.floor(routeCoords.length/25))===0).slice(0,25),lats=sample.map(c=>c[1]),lons=sample.map(c=>c[0]);if(!lats.length)return;
 const south=Math.min(...lats)-.02,north=Math.max(...lats)+.02,west=Math.min(...lons)-.02,east=Math.max(...lons)+.02;
 const q='[out:json][timeout:12];node["highway"="speed_camera"]('+south+','+west+','+north+','+east+');out;';
 try{const r=await fetch('https://overpass-api.de/api/interpreter',{method:'POST',body:'data='+encodeURIComponent(q)});if(!r.ok)throw Error();const d=await r.json();cameras=d.elements||[];cameras.forEach(c=>cameraMarkers.push(L.circleMarker([c.lat,c.lon],{radius:8,color:'#fff',weight:2,fillColor:'#e33',fillOpacity:.95}).addTo(map).bindPopup('Mogelijke flitscamera volgens OpenStreetMap')));$('cameraInfo').textContent='Bekende camera’s in routegebied: '+cameras.length+'. Niet volledig of gegarandeerd actueel.';}catch{$('cameraInfo').textContent='Flitscamera-gegevens tijdelijk niet beschikbaar.';}
}
async function loadFuelStations(){
 const center=current||(routeCoords.length?routeCoords[Math.floor(routeCoords.length/2)]:null);if(!center){$('instruction').textContent='Start GPS of bereken eerst een route.';return;}
 if(fuelVisible){fuelMarkers.forEach(m=>map.removeLayer(m));fuelMarkers=[];fuelVisible=false;$('fuel').textContent='⛽ TOON TANKSTATIONS';return;}
 const lat=center[1],lon=center[0],radius=15000,dLat=radius/111000,dLon=radius/(111000*Math.cos(lat*Math.PI/180));
 const q='[out:json][timeout:20];(node["amenity"="fuel"]('+(lat-dLat)+','+(lon-dLon)+','+(lat+dLat)+','+(lon+dLon)+');way["amenity"="fuel"]('+(lat-dLat)+','+(lon-dLon)+','+(lat+dLat)+','+(lon+dLon)+'););out center tags;';
 $('fuel').textContent='Tankstations zoeken…';
 try{const r=await fetch('https://overpass-api.de/api/interpreter',{method:'POST',body:'data='+encodeURIComponent(q)});if(!r.ok)throw Error();const d=await r.json();fuelStations=d.elements||[];fuelMarkers=[];fuelStations.forEach(s=>{const y=s.lat??s.center?.lat,x=s.lon??s.center?.lon;if(y==null||x==null)return;const name=s.tags?.name||s.tags?.brand||'Tankstation';fuelMarkers.push(L.marker([y,x]).addTo(map).bindPopup('<b>⛽ '+name+'</b><br><small>Brandstofprijzen niet beschikbaar in deze kaartbron.</small>'));});fuelVisible=true;$('fuel').textContent='⛽ VERBERG TANKSTATIONS';$('cameraInfo').textContent=fuelStations.length+' tankstations gevonden in de omgeving. Prijzen worden niet getoond.';}catch{$('fuel').textContent='⛽ OPNIEUW PROBEREN';$('cameraInfo').textContent='Tankstations tijdelijk niet beschikbaar.';}
}
function cameraProximity(){if(!current||!cameras.length)return;let dist=Infinity;cameras.forEach(c=>{const d=map.distance([current[1],current[0]],[c.lat,c.lon]);if(d<dist)dist=d;});if(dist<500&&Date.now()-lastCameraAlert>45000){lastCameraAlert=Date.now();$('alert').textContent='Mogelijke flitscamera binnen '+Math.round(dist)+' meter';say('Let op. Mogelijke flitscamera.');}}
$('go').onclick=()=>getRoute('fast');$('fast').onclick=()=>getRoute('fast');$('scenic').onclick=()=>getRoute('scenic');$('gps').onclick=()=>{gpsStart();if(current)map.setView([current[1],current[0]],14);};$('stop').onclick=stop;$('fuel').onclick=loadFuelStations;
$('voice').onclick=()=>{voiceOn=!voiceOn;$('voice').textContent=voiceOn?'🔊 STEM AAN':'🔇 STEM UIT';if(voiceOn)say('Stem ingeschakeld');};
$('theme').onclick=()=>{document.body.classList.toggle('light');const light=document.body.classList.contains('light');document.body.style.background=light?'#edf2f5':'#101820';document.body.style.color=light?'#101820':'#fff';$('theme').textContent=light?'☀️ DAG':'🌙 NACHT';};
if('serviceWorker'in navigator)window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(()=>{}));
window.addEventListener('load',()=>setTimeout(()=>map.invalidateSize(),300));

// Buildcontrole: wijziging om de Android APK-workflow op GitHub te starten.

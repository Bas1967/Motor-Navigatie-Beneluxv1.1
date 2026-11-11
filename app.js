const $=id=>document.getElementById(id);
const map=L.map('map').setView([51.9,4.1],8);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'© OpenStreetMap'}).addTo(map);
let marker=null,routeLayer=null,watchId=null,current=null,routeCoords=[],cameraMarkers=[],cameras=[],fuelMarkers=[],fuelStations=[],fuelVisible=false,voiceOn=true,lastCameraAlert=0,routeMode='fast';
let gpsSpeed=null;
function say(t){if(voiceOn&&'speechSynthesis'in window){speechSynthesis.cancel();speechSynthesis.speak(new SpeechSynthesisUtterance(t));}}
function status(t){$('status').textContent=t;}
function setSpeed(s){if(s===null||!Number.isFinite(s)){ $('speed').textContent='--';return;} $('speed').textContent=Math.round(s*3.6); }
function gpsStart(){
 if(!navigator.geolocation){status('GPS niet beschikbaar');return;}
 if(watchId!==null)return;
 status('GPS zoeken…');
 watchId=navigator.geolocation.watchPosition(p=>{
  current=[p.coords.longitude,p.coords.latitude];
  gpsSpeed=p.coords.speed;
  setSpeed(gpsSpeed);
  status('GPS actief');
  if(!marker){marker=L.marker([current[1],current[0]]).addTo(map).bindPopup('Jouw locatie');map.setView([current[1],current[0]],13);}
  else marker.setLatLng([current[1],current[0]]);
  cameraProximity();
 },e=>{status('GPS-fout: '+e.message);$('alert').textContent='Geef locatietoegang in Android-instellingen.';},{enableHighAccuracy:true,maximumAge:1000,timeout:15000});
}
function stop(){if(watchId!==null)navigator.geolocation.clearWatch(watchId);watchId=null;if(routeLayer){map.removeLayer(routeLayer);routeLayer=null;}routeCoords=[];$('instruction').textContent='Navigatie gestopt.';$('details').textContent='Afstand: -- · Reistijd: --';}
async function geocode(q){
 const u='https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=nl,be,lu&q='+encodeURIComponent(q);
 const r=await fetch(u,{headers:{'Accept-Language':'nl'}});if(!r.ok)throw Error('Adres zoeken lukt nu niet.');const a=await r.json();if(!a.length)throw Error('Bestemming niet gevonden.');return [Number(a[0].lon),Number(a[0].lat)];
}
function fmtDist(m){return m>=1000?(m/1000).toFixed(1)+' km':Math.round(m)+' m'}
async function getRoute(mode){
 const destText=$('to').value.trim();if(!destText){$('instruction').textContent='Vul eerst een bestemming in.';return;}
 try{
  gpsStart();
  let start=current;
  if($('from').value.trim())start=await geocode($('from').value.trim());
  if(!start){$('instruction').textContent='Wacht op GPS of vul een vertrekadres in.';return;}
  const end=await geocode(destText);
  $('instruction').textContent='Route wordt berekend…';
  const coords=`${start[0]},${start[1]};${end[0]},${end[1]}`;
  const url=`https://router.project-osrm.org/route/v1/driving/${coords}?overview=full&geometries=geojson&steps=true&alternatives=${mode==='scenic'?'true':'false'}`;
  const res=await fetch(url);if(!res.ok)throw Error('Route-service niet bereikbaar.');const data=await res.json();if(data.code!=='Ok'||!data.routes.length)throw Error('Geen route gevonden.');
  let chosen=data.routes[0];
  if(mode==='scenic'&&data.routes.length>1)chosen=data.routes.reduce((a,b)=>b.distance>a.distance?b:a);
  routeMode=mode;routeCoords=chosen.geometry.coordinates;
  if(routeLayer)map.removeLayer(routeLayer);
  routeLayer=L.geoJSON(chosen.geometry,{style:{color:mode==='scenic'?'#e6a23c':'#1677d2',weight:7,opacity:.9}}).addTo(map);
  map.fitBounds(routeLayer.getBounds(),{padding:[25,25]});
  $('details').textContent=`Afstand: ${fmtDist(chosen.distance)} · Geschatte reistijd: ${Math.round(chosen.duration/60)} min${mode==='scenic'?' · Alternatieve route':''}`;
  let step=chosen.legs?.[0]?.steps?.find(s=>s.name)||chosen.legs?.[0]?.steps?.[0];
  $('instruction').textContent=step?`Rijd richting ${step.name||'de route'} · ${fmtDist(step.distance)}`:'Volg de blauwe route op de kaart.';
  say(mode==='scenic'?'De alternatieve route is geladen.':'De snelste route is geladen.');
  loadCameras();
 }catch(e){$('instruction').textContent=e.message;status('Route niet beschikbaar');}
}
async function loadCameras(){
 cameraMarkers.forEach(m=>map.removeLayer(m));cameraMarkers=[];cameras=[];
 if(!routeCoords.length)return;
 const sample=routeCoords.filter((_,i)=>i%Math.max(1,Math.floor(routeCoords.length/35))===0).slice(0,35);
 const lats=sample.map(c=>c[1]),lons=sample.map(c=>c[0]);
 const south=Math.min(...lats)-.025,north=Math.max(...lats)+.025,west=Math.min(...lons)-.025,east=Math.max(...lons)+.025;
 const query=`[out:json][timeout:12];node["highway"="speed_camera"](${south},${west},${north},${east});out;`;
 try{
  const r=await fetch('https://overpass-api.de/api/interpreter',{method:'POST',body:'data='+encodeURIComponent(query)});
  if(!r.ok)throw Error('overpass');
  const d=await r.json();cameras=d.elements||[];
  cameras.forEach(c=>{const m=L.circleMarker([c.lat,c.lon],{radius:8,color:'#fff',weight:2,fillColor:'#e33',fillOpacity:.95}).addTo(map).bindPopup('⚠️ Bekende flitscamera (OpenStreetMap)');cameraMarkers.push(m);});
  $('cameraInfo').textContent=`Bekende camera's langs de omgeving van de route: ${cameras.length}. Gegevens kunnen ontbreken of verouderd zijn.`;
 }catch(e){$('cameraInfo').textContent='Flitscamera-gegevens tijdelijk niet beschikbaar.';}
}

async function loadFuelStations(){
 const center=current || (routeCoords.length?routeCoords[Math.floor(routeCoords.length/2)]:null);
 if(!center){$('instruction').textContent='Start eerst GPS of bereken een route om tankstations te zoeken.';return;}
 const radius=12000, lat=center[1], lon=center[0];
 const dLat=radius/111000, dLon=radius/(111000*Math.cos(lat*Math.PI/180));
 const south=lat-dLat,north=lat+dLat,west=lon-dLon,east=lon+dLon;
 const query=`[out:json][timeout:15];node["amenity"="fuel"](${south},${west},${north},${east});way["amenity"="fuel"](${south},${west},${north},${east});out center tags;`;
 $('fuel').textContent='⏳ TANKSTATIONS ZOEKEN…';
 try{
  const r=await fetch('https://overpass-api.de/api/interpreter',{method:'POST',body:'data='+encodeURIComponent(query)});
  if(!r.ok)throw Error('tankstationbron niet bereikbaar');
  const d=await r.json();fuelStations=d.elements||[];
  fuelMarkers.forEach(m=>map.removeLayer(m));fuelMarkers=[];
  fuelStations.forEach(s=>{
   const y=s.lat??s.center?.lat,x=s.lon??s.center?.lon;if(y==null||x==null)return;
   const name=s.tags?.name||'Tankstation';
   const brand=s.tags?.brand||s.tags?.operator||'';
   const fuelTypes=['E10','E5','diesel','LPG'].filter(k=>s.tags?.[k]==='yes'||s.tags?.['fuel:'+k]==='yes');
   const popup=`<b>⛽ ${name}</b><br>${brand}<br>${fuelTypes.length?'Brandstoffen: '+fuelTypes.join(', '):'Brandstoffen niet vermeld in kaartgegevens'}<br><small>OpenStreetMap-gegevens; prijzen worden niet getoond.</small>`;
   const m=L.marker([y,x]).bindPopup(popup);
   if(fuelVisible){m.addTo(map);fuelMarkers.push(m);}
  });
  fuelVisible=!fuelVisible;
  if(fuelVisible){fuelMarkers.forEach(m=>m.addTo(map));$('fuel').textContent='⛽ VERBERG TANKSTATIONS';$('cameraInfo').textContent=`${fuelStations.length} tankstations gevonden in de omgeving. Brandstofprijzen zijn niet inbegrepen.`;}
  else{$('fuel').textContent='⛽ TOON TANKSTATIONS';$('cameraInfo').textContent='Tankstations verborgen.';}
 }catch(e){$('cameraInfo').textContent='Tankstations tijdelijk niet beschikbaar. Probeer later opnieuw.';$('fuel').textContent='⛽ OPNIEUW PROBEREN';}
}

function cameraProximity(){
 if(!current||!cameras.length)return;
 let nearest=null,dist=Infinity;
 cameras.forEach(c=>{const d=map.distance([current[1],current[0]],[c.lat,c.lon]);if(d<dist){dist=d;nearest=c;}});
 if(nearest&&dist<500&&Date.now()-lastCameraAlert>45000){
  lastCameraAlert=Date.now();$('alert').textContent='⚠️ Mogelijke flitscamera binnen '+Math.round(dist)+' meter';
  say('Let op. Mogelijke flitscamera vooruit.');
 }else if(dist>=500){$('alert').textContent='Rijd veilig. Bedien de app alleen wanneer je stilstaat.';}
}
$('go').onclick=()=>getRoute('fast');$('fast').onclick=()=>getRoute('fast');$('scenic').onclick=()=>getRoute('scenic');
$('gps').onclick=()=>{gpsStart();if(current)map.setView([current[1],current[0]],14);};
$('stop').onclick=stop;
$('voice').onclick=()=>{voiceOn=!voiceOn;$('voice').textContent=voiceOn?'🔊 STEM AAN':'🔇 STEM UIT';if(voiceOn)say('Stem ingeschakeld');};
$('theme').onclick=()=>{document.body.classList.toggle('light');const light=document.body.classList.contains('light');document.body.style.background=light?'#edf2f5':'#101820';document.body.style.color=light?'#101820':'#fff';$('theme').textContent=light?'☀️ DAG':'🌙 NACHT';};
if('serviceWorker'in navigator)window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(()=>{}));

$('fuel').onclick=loadFuelStations;

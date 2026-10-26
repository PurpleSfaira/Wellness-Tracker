'use strict';
// ---------- calc (pure) ----------
const Calc={
  bmr(sex,kg,cm,age){return 10*kg+6.25*cm-5*age+(sex==='m'?5:-161)},
  ACT:{1.2:'Sedentary (little exercise)',1.375:'Lightly active',1.55:'Moderately active',1.725:'Very active'},
  budget(p){ if(!p.weight||!p.ft)return null;
    const kg=p.weight*0.4536,cm=(p.ft*12+(+p.inch||0))*2.54;
    const bmr=this.bmr(p.sex,kg,cm,+p.age||30),tdee=bmr*(+p.act||1.2);
    let b=tdee-(+p.rate||1)*500+(p.bf?(+p.bfCal||400):0);
    const floor=p.override?(+p.floor||0):(p.sex==='m'?1500:1200);
    const raw=b; if(b<floor)b=floor;
    return {bmr:Math.round(bmr),tdee:Math.round(tdee),budget:Math.round(b),floored:raw<floor};},
  stepKcal(steps,lb){return Math.round(steps*0.04*((lb||150)/150))},
  metKcal(met,lb,min){return Math.round(met*3.5*((lb||150)*0.4536)/200*min)},
  sleepHrs(bed,wake){const t=s=>{const[h,m]=s.split(':').map(Number);return h*60+m};let d=t(wake)-t(bed);if(d<=0)d+=1440;return Math.round(d/6)/10}
};
const METS=[['Walking (slow, 2 mph)',2.8],['Walking (3 mph)',3.5],['Brisk walking (3.5–4 mph)',4.3],['Stroller walk / carrying baby',3.8],['Hiking',6],['Running (5 mph)',8.3],['Running (6 mph)',9.8],['Cycling (leisure)',4],['Cycling (moderate)',6.8],['Stationary bike',5.5],['Elliptical',5],['Strength training',3.5],['Strength training (vigorous)',6],['Postnatal / Pilates',3],['Yoga',2.5],['Swimming (easy)',6],['Dancing',5],['HIIT / circuit',8],['Housework (general)',3.3],['Vacuuming / mopping',3.5],['Gardening / yard work',4],['Shoveling snow',5.3],['Cross-country skiing',9],['Ice skating',5.5],['Playing with kids (active)',4]];
function numOrNull(v){if(v==null||v==='')return null;const n=+v;return Number.isFinite(n)?n:null}
function round1(n){return Math.round((+n||0)*10)/10}
function brandOf(p){let b=p&&p.brands;if(Array.isArray(b))b=b.join(', ');return String(b||'').split(',')[0].trim()}
function gramsFromServing(s){if(!s)return null;const m=String(s).replace(',','.').match(/([\d.]+)\s*g\b/i);if(!m)return null;const g=+m[1];return g>0&&g<2000?g:null}
// Open Food Facts product -> per-serving (or per 100 g) nutrition. Null when there is no name.
function offFood(p){
  if(!p||typeof p!=='object')return null;
  const name=String(p.product_name||p.product_name_en||'').trim();
  if(!name)return null;
  const brand=brandOf(p);
  const n=p.nutriments||{};
  const kcalS=numOrNull(n['energy-kcal_serving']),kcal100=numOrNull(n['energy-kcal_100g']);
  const kjS=numOrNull(n['energy-kj_serving']),kj100=numOrNull(n['energy-kj_100g']);
  const grams=gramsFromServing(p.serving_size);
  let suf=null,scale=1,serv='',cal=null;
  if(kcalS!=null){suf='_serving';serv=p.serving_size||'1 serving';cal=kcalS}
  else if(kjS!=null){suf='_serving';serv=p.serving_size||'1 serving';cal=kjS/4.184}
  else if(grams&&kcal100!=null){suf='_100g';scale=grams/100;serv=String(p.serving_size);cal=kcal100*scale}
  else if(grams&&kj100!=null){suf='_100g';scale=grams/100;serv=String(p.serving_size);cal=(kj100/4.184)*scale}
  else if(kcal100!=null){suf='_100g';serv='100 g';cal=kcal100}
  else if(kj100!=null){suf='_100g';serv='100 g';cal=kj100/4.184}
  else serv=p.serving_size||'';
  const macro=k=>{if(!suf)return 0;const v=numOrNull(n[k+suf]);return round1((v||0)*scale)};
  return {name,brand,serv,cal:cal==null?null:Math.round(cal),p:macro('proteins'),c:macro('carbohydrates'),f:macro('fat'),fi:macro('fiber'),code:String(p.code||'')};
}
if(typeof module!=='undefined'){module.exports={Calc,METS,offFood};}
else{
// ---------- state ----------
const K='jamieTracker.v1';
let S=JSON.parse(localStorage.getItem(K)||'null')||{profile:{sex:'f',ft:5,inch:7,act:1.2,rate:1,bf:false,bfCal:400},days:{},myFoods:[],recents:[],weights:[],sleep:[],waterGoal:64,sleepGoal:7};
const save=()=>localStorage.setItem(K,JSON.stringify(S));
const iso=d=>{const z=new Date(d);z.setMinutes(z.getMinutes()-z.getTimezoneOffset());return z.toISOString().slice(0,10)};
const today=()=>iso(new Date());
let cur=today(),tab='dash';
const day=d=>S.days[d]||(S.days[d]={food:[],ex:[],water:0,steps:0});
const lastW=()=>{const w=[...S.weights].sort((a,b)=>a.d<b.d?-1:1);return w.length?w[w.length-1].w:(+S.profile.weight||0)};
const prof=()=>Object.assign({},S.profile,{weight:lastW()||S.profile.weight});
const esc=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const sum=(a,k)=>a.reduce((t,x)=>t+(+x[k]||0),0);
function totals(d){const D=day(d),lb=lastW();const ex=sum(D.ex,'kcal')+Calc.stepKcal(D.steps||0,lb);const b=Calc.budget(prof());
  return{eat:sum(D.food,'cal'),ex,budget:b?b.budget:0,p:sum(D.food,'p'),c:sum(D.food,'c'),f:sum(D.food,'f'),fi:sum(D.food,'fi'),water:D.water||0}}
const $=id=>document.getElementById(id);const M=$('m');
const bar=(v,g,col)=>`<div class="bar"><div style="width:${Math.min(100,g?v/g*100:0)}%;${col?'background:'+col:''}"></div></div>`;
const dateBar=()=>`<div class="row"><button class="s" style="flex:0" onclick="shift(-1)">‹</button><input type="date" value="${cur}" max="${today()}" onchange="cur=this.value;R()"><button class="s" style="flex:0" onclick="shift(1)">›</button></div>`;
window.shift=n=>{const d=new Date(cur+'T12:00');d.setDate(d.getDate()+n);const s=iso(d);if(s<=today()){cur=s;R()}};
function chart(pts,goal,unit){ // pts [{x:label,y}]
  if(pts.length<1)return'<p class="mu">No data yet.</p>';
  const ys=pts.map(p=>p.y).concat(goal?[goal]:[]),mn=Math.min(...ys)-1,mx=Math.max(...ys)+1,W=300,H=140;
  const X=i=>pts.length<2?W/2:20+i*(W-30)/(pts.length-1),Y=v=>H-15-(v-mn)/(mx-mn)*(H-30);
  let s=`<svg viewBox="0 0 ${W} ${H}">`;
  if(goal)s+=`<line x1="10" x2="${W}" y1="${Y(goal)}" y2="${Y(goal)}" stroke="#81b29a" stroke-dasharray="4"/><text x="${W-4}" y="${Y(goal)-3}" font-size="9" text-anchor="end" fill="#81b29a">goal ${goal}${unit}</text>`;
  s+=`<polyline fill="none" stroke="#e07a5f" stroke-width="2" points="${pts.map((p,i)=>X(i)+','+Y(p.y)).join(' ')}"/>`;
  pts.forEach((p,i)=>s+=`<circle cx="${X(i)}" cy="${Y(p.y)}" r="3" fill="#e07a5f"/>`);
  s+=`<text x="4" y="${Y(mx-1)}" font-size="9" fill="#999">${(mx-1).toFixed(1)}</text><text x="4" y="${Y(mn+1)}" font-size="9" fill="#999">${(mn+1).toFixed(1)}</text>`;
  s+=`<text x="${X(0)}" y="${H-2}" font-size="9" fill="#999">${pts[0].x}</text><text x="${X(pts.length-1)}" y="${H-2}" font-size="9" text-anchor="end" fill="#999">${pts[pts.length-1].x}</text></svg>`;return s}
function bars(vals,goal,col){const W=300,H=110,mx=Math.max(goal||0,...vals.map(v=>v.y),1),bw=(W-10)/vals.length;
  let s=`<svg viewBox="0 0 ${W} ${H}">`;vals.forEach((v,i)=>{const h=v.y/mx*(H-25);s+=`<rect x="${5+i*bw+1}" y="${H-15-h}" width="${bw-2}" height="${h}" rx="2" fill="${col}"/>`;if(vals.length<=7)s+=`<text x="${5+i*bw+bw/2}" y="${H-3}" font-size="9" text-anchor="middle" fill="#999">${v.x}</text>`});
  if(goal){const y=H-15-goal/mx*(H-25);s+=`<line x1="0" x2="${W}" y1="${y}" y2="${y}" stroke="#e07a5f" stroke-dasharray="4"/>`}return s+'</svg>'}
const lastN=n=>{const a=[];for(let i=n-1;i>=0;i--){const d=new Date();d.setDate(d.getDate()-i);a.push(iso(d))}return a};
const wd=d=>'SMTWTFS'[new Date(d+'T12:00').getDay()];
const sleepFor=d=>S.sleep.filter(s=>s.d===d);
const nightHrs=d=>sum(sleepFor(d).filter(s=>!s.nap),'hrs');

// ---------- views ----------
const V={};
V.dash=()=>{const t=totals(cur),b=Calc.budget(prof()),rem=t.budget+t.ex-t.eat;
  const wk=lastN(7).map(d=>({d,...totals(d)}));const logged=wk.filter(x=>x.eat>0);
  const ln=S.sleep.filter(s=>!s.nap).sort((a,b)=>a.d<b.d?1:-1)[0];
  return dateBar()+(b?'':`<div class="card"><h2>Welcome, Jamie 👋</h2><p>Start by entering your current weight in <b>Profile</b> to get your daily calorie budget.</p><button onclick="go('prof')">Set up profile</button></div>`)+
  `<div class="card"><h2>${cur===today()?'Today':cur}</h2><div class="mu">Calories remaining</div><div class="big" style="color:${rem<0?'#c55':'var(--gr)'}">${rem}</div>
  ${bar(t.eat,t.budget+t.ex,rem<0?'#c55':'')}<div class="grid" style="grid-template-columns:repeat(3,1fr)">
  <div class="stat"><div>${t.budget}</div><div class="mu">Budget</div></div><div class="stat"><div>${t.eat}</div><div class="mu">Eaten</div></div><div class="stat"><div>+${t.ex}</div><div class="mu">Exercise</div></div></div></div>
  <div class="card"><h2>Macros</h2><div class="grid" style="grid-template-columns:repeat(4,1fr)">${[['Protein',t.p],['Carbs',t.c],['Fat',t.f],['Fiber',t.fi]].map(([n,v])=>`<div class="stat"><div>${Math.round(v)}g</div><div class="mu">${n}</div></div>`).join('')}</div></div>
  <div class="card"><h2>💧 Water</h2><b>${t.water}</b> / ${S.waterGoal} oz${bar(t.water,S.waterGoal,'var(--bl)')}<button onclick="addW(8)">+8 oz</button><button onclick="addW(16)">+16 oz</button></div>
  <div class="card"><h2>😴 Last night</h2>${ln?`<b>${ln.hrs} h</b> (${ln.bed}–${ln.wake}, ${ln.d})${ln.q?' · quality '+ln.q+'/5':''}${ln.wk!==''&&ln.wk!=null?' · '+ln.wk+' wake-ups':''}${bar(ln.hrs,S.sleepGoal,'var(--pu)')}<span class="mu">Goal ${S.sleepGoal} h</span>`:'<p class="mu">No sleep logged yet.</p>'}</div>
  <div class="card"><h2>This week</h2>${bars(wk.map(x=>({x:wd(x.d),y:x.eat})),wk[6].budget,'#f2cc8f')}
  <div class="mu">Avg eaten (logged days): <b>${logged.length?Math.round(sum(logged,'eat')/logged.length):0}</b> · Total exercise: <b>${sum(wk,'ex')}</b> · Net vs budget: <b>${logged.reduce((a,x)=>a+(x.budget+x.ex-x.eat),0)}</b> cal (${logged.length} logged days)</div></div>`};
window.addW=n=>{day(cur).water=(day(cur).water||0)+n;if(day(cur).water<0)day(cur).water=0;save();R()};

const MEALS=['Breakfast','Lunch','Dinner','Snacks'];
let findMeal='',found=[],searchGen=0,searchTimer=0;
let scanStream=null,scanTimer=null,scanControls=null,scanStop=false,scanBusy=false,lookupGen=0;
function mealDefault(){const h=new Date().getHours();return h<11?'Breakfast':h<15?'Lunch':h<21?'Dinner':'Snacks'}
function selectedMeal(){const el=$('fmeal');return (el&&el.value)||findMeal||mealDefault()}
function savedRow(f,i,src){const uses=f.uses||1;
  return `<div class="it"><span>${esc(f.name)} <span class="mu">${esc(f.serv||'')} · ${f.cal} cal${src!=='my'&&uses>1?' · '+uses+'×':''}</span></span><span class="row" style="flex:0;gap:4px"><input class="qty" id="q${src}${i}" type="number" min="0.25" step="0.25" value="1" aria-label="Servings of ${esc(f.name)}"><button class="g" onclick="quickQty('${src}',${i})">+</button>${src==='my'?`<button class="x" onclick="delMy(${i})">✕</button>`:''}</span></div>`}
function finderCard(){const meal=findMeal||mealDefault();
  const freq=S.recents.map((f,i)=>({f,i})).filter(x=>(x.f.uses||1)>1).sort((a,b)=>(b.f.uses||1)-(a.f.uses||1)||(b.f.last||0)-(a.f.last||0)).slice(0,8);
  const rec=S.recents.map((f,i)=>({f,i})).slice(0,8);
  return `<div class="card" id="finder"><h2>Add food</h2>
  <label>Meal</label><select id="fmeal" onchange="findMeal=this.value">${MEALS.map(m=>`<option ${m===meal?'selected':''}>${m}</option>`).join('')}</select>
  <label>Search foods</label>
  <div class="row"><input id="fqry" placeholder="Try Greek yogurt, oats, banana" autocomplete="off" enterkeyhint="search" oninput="queueSearch()" onkeydown="if(event.key==='Enter'){event.preventDefault();searchFoods()}"><button style="flex:0" onclick="searchFoods()">Search</button></div>
  <div id="fstatus" class="mu"></div><div id="fresults"></div>
  <div class="row"><button class="s" type="button" style="flex:0" id="scanbtn" onclick="toggleScan()">Scan barcode</button><input id="bcode" inputmode="numeric" autocomplete="off" placeholder="Or type barcode" onkeydown="if(event.key==='Enter'){event.preventDefault();lookupBarcode()}"><button class="s" type="button" style="flex:0" onclick="lookupBarcode()">Look up</button></div>
  <div id="scanbox" class="hide"><video id="scanvid" playsinline webkit-playsinline muted autoplay></video><p class="mu" id="scanmsg"></p><button class="s" type="button" onclick="stopScan()">Stop camera</button></div>
  <p class="mu">Nutrition lookup uses Open Food Facts and needs a connection. Saved foods and manual entry work offline.</p>
  <h3>Or enter it yourself</h3>
  <input id="fn" placeholder="Food name" autocomplete="off"><div class="row"><input id="fs" placeholder="Serving size (e.g. 1 cup)"><div style="flex:0.7"><label>Servings</label><input id="fq" type="number" min="0.25" step="0.25" value="1" oninput="previewFood()"></div></div>
  <label>Calories per serving</label><input id="fc" type="number" inputmode="decimal" placeholder="Calories per serving" oninput="previewFood()">
  <div class="grid"><input id="fp" type="number" placeholder="Protein g" oninput="previewFood()"><input id="fcb" type="number" placeholder="Carbs g" oninput="previewFood()"><input id="ff" type="number" placeholder="Fat g" oninput="previewFood()"><input id="ffi" type="number" placeholder="Fiber g" oninput="previewFood()"></div>
  <div id="fpreview"></div>
  <label><input type="checkbox" id="fsave" style="width:auto"> Save to My Foods</label><br>
  <button onclick="addF()">Add</button><button class="s" onclick="quickCal()">Quick-add calories only</button>
  <h3>Frequent</h3>${freq.length?freq.map(({f,i})=>savedRow(f,i,'freq')).join(''):'<p class="mu">Foods you log again show up here for one tap re-add.</p>'}
  <h3>Recent</h3>${rec.length?rec.map(({f,i})=>savedRow(f,i,'rec')).join(''):'<p class="mu">None yet</p>'}
  <h3>My Foods</h3><input placeholder="Search my foods" oninput="document.querySelectorAll('.myf').forEach(e=>e.style.display=e.dataset.n.includes(this.value.toLowerCase())?'':'none')">
  ${S.myFoods.map((f,j)=>`<div class="myf" data-n="${esc(String(f.name||'').toLowerCase())}">${savedRow(f,j,'my')}</div>`).join('')||'<p class="mu">None yet</p>'}</div>`}
V.food=()=>{const D=day(cur);let h=dateBar()+finderCard();
  MEALS.forEach(m=>{const it=D.food.map((f,i)=>[f,i]).filter(([f])=>f.meal===m);
    h+=`<div class="card"><h2>${m} <span class="mu">${sum(it.map(x=>x[0]),'cal')} cal</span></h2>${it.map(([f,i])=>`<div class="it"><span>${esc(f.name)} <span class="mu">${esc(f.serv||'')}</span></span><span>${f.cal} <button class="x" onclick="delF(${i})">✕</button></span></div>`).join('')}
    <button class="s" onclick="openAdd('${m}')">+ Add food</button></div>`});
  return h};
window.delF=i=>{day(cur).food.splice(i,1);save();R()};
window.openAdd=m=>{findMeal=m;const sel=$('fmeal');if(sel)sel.value=m;const box=$('finder');if(box)box.scrollIntoView({behavior:'smooth'});const q=$('fqry');if(q)q.focus()};
function rememberFood(base){const same=r=>r.name===base.name&&(r.serv||'')===(base.serv||'')&&r.cal===base.cal;
  const prev=S.recents.find(same);
  const item=Object.assign({},base,{uses:((prev&&prev.uses)||0)+1,last:Date.now()});
  S.recents=[item,...S.recents.filter(r=>!same(r))].slice(0,40)}
function pushFood(f,m){day(cur).food.push(Object.assign({},f,{meal:m}));
  rememberFood({name:f.name,serv:f.baseServ!=null?f.baseServ:(f.serv||''),cal:f.baseCal??f.cal,p:f.bp??f.p,c:f.bc??f.c,f:f.bf??f.f,fi:f.bfi??f.fi});
  save();R()}
window.addF=()=>{const m=selectedMeal();const n=$('fn').value.trim();const raw=$('fc').value;const c=+raw;const q=+$('fq').value||1;
  if(!n||raw===''||!Number.isFinite(c)){alert('Enter a name and calories');return}
  if(q<=0){alert('Enter servings greater than 0');return}
  const v=id=>{const x=$(id).value;return x===''?0:+x};
  const base={name:n,serv:$('fs').value,cal:c,p:v('fp'),c:v('fcb'),f:v('ff'),fi:v('ffi')};
  if($('fsave')&&$('fsave').checked&&!S.myFoods.some(x=>x.name===base.name&&x.serv===base.serv&&x.cal===base.cal))S.myFoods.push(base);
  pushFood({name:n,serv:(q!==1?q+' × ':'')+base.serv,baseServ:base.serv,cal:Math.round(c*q),p:base.p*q,c:base.c*q,f:base.f*q,fi:base.fi*q,baseCal:c,bp:base.p,bc:base.c,bf:base.f,bfi:base.fi},m)};
window.quickQty=(src,j)=>{const list=src==='my'?S.myFoods:S.recents;const f=list[j];if(!f)return;
  const el=$('q'+src+j);const q=el?(+el.value||0):0;if(!q||q<=0){alert('Enter servings greater than 0');return}
  pushFood({name:f.name,serv:(q!==1?q+' × ':'')+(f.serv||''),baseServ:f.serv||'',cal:Math.round((f.cal||0)*q),p:(f.p||0)*q,c:(f.c||0)*q,f:(f.f||0)*q,fi:(f.fi||0)*q,baseCal:f.cal,bp:f.p,bc:f.c,bf:f.f,bfi:f.fi},selectedMeal())};
window.delMy=j=>{if(confirm('Remove from My Foods?')){S.myFoods.splice(j,1);save();R()}};
window.quickCal=()=>{const m=selectedMeal();const c=+prompt('Calories to quick-add:');if(c){day(cur).food.push({name:'Quick add',cal:Math.round(c),meal:m,p:0,c:0,f:0,fi:0});save();R()}};
function failMsg(e){if(e&&e.name==='AbortError')return 'The food database took too long. Try again, or enter the food manually.';
  if(typeof navigator!=='undefined'&&navigator.onLine===false)return "You're offline. Search and barcode lookup need a connection. Use a saved food or enter it manually.";
  return "The food database didn't respond. Try again in a moment, or enter the food manually."}
function offJSON(url){const c=new AbortController();const t=setTimeout(()=>c.abort(),12000);
  return fetch(url,{signal:c.signal,headers:{Accept:'application/json'}}).then(r=>{if(!r.ok)throw new Error('HTTP '+r.status);return r.json()}).finally(()=>clearTimeout(t))}
function resultHTML(f,i){const macros=f.cal==null?'No nutrition data':`${f.cal} cal · P ${f.p}g · C ${f.c}g · F ${f.f}g${f.fi?' · Fiber '+f.fi+'g':''}`;
  return `<div class="it"><span><b>${esc(f.name)}</b>${f.brand?` <span class="mu">${esc(f.brand)}</span>`:''}<br><span class="mu">${esc(f.serv||'Serving not listed')} · ${macros}</span></span><button class="g" style="flex:0" onclick="pickFood(${i})">Use</button></div>`}
function fillFood(f){if(!$('fn'))return;
  $('fn').value=f.brand?f.name+' ('+f.brand+')':f.name;
  $('fs').value=f.serv||'';
  $('fc').value=f.cal==null?'':f.cal;
  $('fp').value=f.p?f.p:'';$('fcb').value=f.c?f.c:'';$('ff').value=f.f?f.f:'';$('ffi').value=f.fi?f.fi:'';
  if(!$('fq').value)$('fq').value=1;
  window.previewFood();$('fq').focus()}
window.previewFood=()=>{const el=$('fpreview');if(!el||!$('fc'))return;const raw=$('fc').value;const q=+$('fq').value;
  if(raw===''||!(q>0)){el.textContent='';return}
  const g=id=>{const v=$(id).value;return v===''?0:+v};const r=n=>Math.round(n*10)/10;
  el.textContent=q+' serving'+(q===1?'':'s')+' → '+Math.round((+raw)*q)+' cal · P '+r(g('fp')*q)+'g · C '+r(g('fcb')*q)+'g · F '+r(g('ff')*q)+'g · Fiber '+r(g('ffi')*q)+'g'};
window.pickFood=i=>{const f=found[i];if(!f)return;fillFood(f);
  const st=$('fstatus');if(st)st.textContent=f.cal==null?'Filled in the name, but this product has no calorie data. Add calories, then tap Add.':'Filled in. Adjust servings if you need to, then tap Add.'};
window.queueSearch=()=>{clearTimeout(searchTimer);const q=$('fqry')&&$('fqry').value.trim();
  if(!q){found=[];if($('fresults'))$('fresults').innerHTML='';if($('fstatus'))$('fstatus').textContent='';return}
  if(q.length<2)return;searchTimer=setTimeout(()=>window.searchFoods(),600)};
window.searchFoods=async()=>{clearTimeout(searchTimer);const input=$('fqry');if(!input)return;const q=input.value.trim();const st=$('fstatus'),box=$('fresults');
  if(q.length<2){if(st)st.textContent='Type at least 2 characters to search.';if(box)box.innerHTML='';return}
  const gen=++searchGen;if(st)st.textContent='Searching…';if(box)box.innerHTML='';
  const url='https://world.openfoodfacts.org/cgi/search.pl?'+new URLSearchParams({search_terms:q,search_simple:'1',action:'process',json:'1',page_size:'12',fields:'code,product_name,product_name_en,brands,serving_size,nutriments',sort_by:'unique_scans_n'}).toString();
  let list=null,lastErr=null;
  for(let attempt=0;attempt<2;attempt++){try{const d=await offJSON(url);list=d.products||[];break}catch(e){if(gen!==searchGen)return;lastErr=e;if(attempt===0)await new Promise(r=>setTimeout(r,1200))}}
  if(gen!==searchGen)return;
  if(!list){if(st)st.textContent=failMsg(lastErr);return}
  const mapped=[];const seen=new Set();
  for(const p of list){const f=offFood(p);if(!f)continue;const k=(f.name+'|'+f.brand+'|'+(f.cal==null?'':f.cal)+'|'+f.serv).toLowerCase();if(seen.has(k))continue;seen.add(k);mapped.push(f)}
  mapped.sort((a,b)=>(a.cal==null)-(b.cal==null));found=mapped.slice(0,8);
  if(!found.length){if(st)st.textContent='No foods found for "'+q+'". Try a simpler name, or enter it manually below.';return}
  if(st)st.textContent=found.length+' result'+(found.length===1?'':'s')+'. Tap Use. Numbers are per serving, or per 100 g when a serving is not listed.';
  if(box)box.innerHTML=found.map(resultHTML).join('')};
window.lookupBarcode=async(code)=>{const raw=String(code==null?($('bcode')&&$('bcode').value||''):code);const digits=raw.replace(/\D/g,'');const st=$('fstatus');
  if(!/^\d{6,14}$/.test(digits)){if(st)st.textContent=raw.trim()?'That code is not a numeric barcode. Type the number printed under the bars.':'Enter a barcode (6-14 digits), or scan one.';return}
  const gen=++lookupGen;if($('bcode'))$('bcode').value=digits;if(st)st.textContent='Looking up '+digits+'…';
  const fields='fields=code,product_name,product_name_en,brands,serving_size,nutriments,status';
  try{let d=await offJSON('https://world.openfoodfacts.org/api/v2/product/'+digits+'.json?'+fields);
    if(gen!==lookupGen)return;
    if((!d||d.status!==1||!d.product)&&digits.length===12){d=await offJSON('https://world.openfoodfacts.org/api/v2/product/0'+digits+'.json?'+fields);if(gen!==lookupGen)return}
    if(!d||d.status!==1||!d.product){if($('fstatus'))$('fstatus').textContent='No product found for '+digits+'. Try another code or enter the food manually.';return}
    const f=offFood(d.product);if(!f){if($('fstatus'))$('fstatus').textContent='That barcode has no product name. Enter the food manually.';return}
    found=[f];if($('fresults'))$('fresults').innerHTML=resultHTML(f,0);fillFood(f);
    if($('fstatus'))$('fstatus').textContent=f.cal==null?'Product found, but it has no calorie data. Fill in calories to log it.':'Filled in from the barcode. Adjust servings, then tap Add.';
  }catch(e){if(gen===lookupGen&&$('fstatus'))$('fstatus').textContent=failMsg(e)}};
function releaseCamera(){scanStop=true;if(scanTimer){clearTimeout(scanTimer);scanTimer=null}
  if(scanControls){try{scanControls.stop()}catch(e){}scanControls=null}
  if(scanStream){scanStream.getTracks().forEach(t=>t.stop());scanStream=null}
  const vid=document.getElementById('scanvid');if(vid)vid.srcObject=null}
window.stopScan=()=>{releaseCamera();const box=$('scanbox');if(box)box.classList.add('hide')};
function loadScript(src){return new Promise((res,rej)=>{if(window.ZXingBrowser){res();return}
  const s=document.createElement('script');s.src=src;s.async=true;s.onload=()=>res();s.onerror=()=>{s.remove();rej(new Error('script'))};document.head.appendChild(s)})}
async function scanNative(msg){if(!navigator.mediaDevices||!navigator.mediaDevices.getUserMedia){msg.textContent='No camera is available. Type the barcode instead.';return}
  let formats=['ean_13','ean_8','upc_a','upc_e','code_128','code_39'];
  try{if(window.BarcodeDetector.getSupportedFormats){const sup=await window.BarcodeDetector.getSupportedFormats();const keep=formats.filter(f=>sup.includes(f));if(keep.length)formats=keep}}catch(e){}
  let detector;try{detector=new window.BarcodeDetector({formats})}catch(e){msg.textContent='Camera scanning is not available in this browser. Type the barcode instead.';return}
  try{const stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'}},audio:false});
    if(scanStop){stream.getTracks().forEach(t=>t.stop());return}
    scanStream=stream;const vid=$('scanvid');vid.srcObject=scanStream;await vid.play();if(scanStop){releaseCamera();return}
    msg.textContent='Point the camera at a barcode.';
    const tick=async()=>{if(scanStop)return;try{const codes=await detector.detect(vid);
      if(codes&&codes[0]&&codes[0].rawValue){const raw=String(codes[0].rawValue);if($('bcode'))$('bcode').value=raw;window.stopScan();window.lookupBarcode(raw);return}}catch(e){}
      if(!scanStop)scanTimer=setTimeout(tick,250)};
    scanTimer=setTimeout(tick,300)}
  catch(e){releaseCamera();const box=$('scanbox');if(box)box.classList.remove('hide');msg.textContent='Camera permission was blocked, or this device has no camera. Type the barcode instead.'}}
async function scanZXing(msg){try{const reader=new window.ZXingBrowser.BrowserMultiFormatReader();const vid=$('scanvid');
  msg.textContent='Point the camera at a barcode.';
  const controls=await reader.decodeFromConstraints({video:{facingMode:{ideal:'environment'}},audio:false},vid,(result)=>{
    if(scanStop||!result)return;const raw=typeof result.getText==='function'?result.getText():String(result.text||'');if(!raw)return;
    if($('bcode'))$('bcode').value=raw;window.stopScan();window.lookupBarcode(raw)});
  if(scanStop){try{controls.stop()}catch(e){}return}
  scanControls=controls}
  catch(e){releaseCamera();const box=$('scanbox');if(box)box.classList.remove('hide');msg.textContent='Camera permission was blocked, or this device has no camera. Type the barcode instead.'}}
window.toggleScan=async()=>{if(scanStream||scanControls){window.stopScan();return}if(scanBusy)return;const box=$('scanbox');if(!box)return;
  box.classList.remove('hide');const msg=$('scanmsg');scanStop=false;scanBusy=true;
  try{let mode=null;
    if('BarcodeDetector' in window && typeof window.BarcodeDetector==='function')mode='native';
    else{if(msg)msg.textContent='Loading scanner…';try{await loadScript('vendor/zxing-browser.min.js');if(window.ZXingBrowser&&window.ZXingBrowser.BrowserMultiFormatReader)mode='zxing'}catch(e){}}
    if(scanStop)return;
    if(!mode){if(msg)msg.textContent='Camera scanning is not available in this browser (including iPhone Safari without the backup scanner). Type the barcode instead — lookup works the same way.';return}
    if(mode==='native')await scanNative(msg);else await scanZXing(msg)}
  finally{scanBusy=false}};

V.ex=()=>{const D=day(cur),lb=lastW();return dateBar()+`<div class="card"><h2>👣 Steps</h2><div class="row"><input id="st" type="number" inputmode="numeric" value="${D.steps||''}" placeholder="Steps today"><button style="flex:0" onclick="day(cur).steps=+$('st').value||0;save();R()">Save</button></div>
  <div class="mu">${D.steps||0} steps ≈ <b>${Calc.stepKcal(D.steps||0,lb)}</b> cal (scaled to ${lb||150} lb)</div></div>
  <div class="card"><h2>🏃‍♀️ Add exercise</h2><select id="exm">${METS.map(([n,m],i)=>`<option value="${i}">${n} (MET ${m})</option>`).join('')}</select>
  <div class="row"><input id="exmin" type="number" inputmode="numeric" placeholder="Minutes"><button style="flex:0" onclick="addEx()">Add</button></div>
  ${D.ex.map((e,i)=>`<div class="it"><span>${esc(e.name)} <span class="mu">${e.min} min</span></span><span>${e.kcal} cal <button class="x" onclick="day(cur).ex.splice(${i},1);save();R()">✕</button></span></div>`).join('')}
  <p class="mu">kcal = MET × 3.5 × kg ÷ 200 × minutes. Burned calories are added to the day's budget.</p></div>`};
window.addEx=()=>{const [n,m]=METS[$('exm').value],min=+$('exmin').value;if(!min)return;day(cur).ex.push({name:n,min,kcal:Calc.metKcal(m,lastW(),min)});save();R()};

V.water=()=>{const D=day(cur);return dateBar()+`<div class="card"><h2>💧 Water</h2><div class="big" style="color:var(--bl)">${D.water||0} <span style="font-size:18px">/ ${S.waterGoal} oz</span></div>${bar(D.water||0,S.waterGoal,'var(--bl)')}
  <button onclick="addW(8)">+8 oz</button><button onclick="addW(16)">+16 oz</button><button class="s" onclick="const n=+prompt('Ounces (negative to subtract):');if(n)addW(n)">Custom</button><button class="s" onclick="day(cur).water=0;save();R()">Reset</button>
  <h3>Daily goal (oz)</h3><div class="row"><input id="wg" type="number" value="${S.waterGoal}"><button style="flex:0" onclick="S.waterGoal=+$('wg').value||64;save();R()">Save</button></div>
  <p class="mu">Breastfeeding? Many moms aim for extra fluids—drink to thirst.</p></div>
  <div class="card"><h2>Last 7 days</h2>${bars(lastN(7).map(d=>({x:wd(d),y:day(d).water||0})),S.waterGoal,'#5fa8d3')}</div>`};

let sleepRange=7;
V.sleep=()=>{const days=lastN(sleepRange),vals=days.map(d=>({x:wd(d),y:nightHrs(d)})),lg=vals.filter(v=>v.y>0);
  const avg=a=>a.length?(sum(a,'y')/a.length).toFixed(1):'–';const L=S.sleep.slice().sort((a,b)=>a.d<b.d?1:-1);
  return`<div class="card"><h2>😴 Log sleep</h2><label>Morning of (wake date)</label><input type="date" id="sd" value="${today()}" max="${today()}">
  <div class="row"><div><label>Bedtime</label><input type="time" id="sb" value="22:30"></div><div><label>Wake time</label><input type="time" id="sw" value="06:30"></div></div>
  <div class="row"><div><label>Quality (1–5, optional)</label><select id="sq"><option value="">–</option>${[1,2,3,4,5].map(n=>`<option>${n}</option>`).join('')}</select></div><div><label>Night wake-ups</label><input type="number" id="swk" inputmode="numeric" placeholder="e.g. 2"></div></div>
  <label><input type="checkbox" id="snap" style="width:auto"> This was a nap</label><br><button onclick="addSleep()">Save sleep</button></div>
  <div class="card"><h2>Trend</h2><button class="${sleepRange===7?'':'s'}" onclick="sleepRange=7;R()">7 days</button><button class="${sleepRange===30?'':'s'}" onclick="sleepRange=30;R()">30 days</button>
  ${bars(vals,S.sleepGoal,'#9b8ec4')}<div class="mu">Avg night sleep (logged nights): <b>${avg(lg)} h</b> · Goal ${S.sleepGoal} h · Avg wake-ups: <b>${(()=>{const w=S.sleep.filter(s=>!s.nap&&days.includes(s.d)&&s.wk!=='');return w.length?(sum(w,'wk')/w.length).toFixed(1):'–'})()}</b></div>
  <h3>Sleep goal (hours)</h3><div class="row"><input id="sg" type="number" step="0.5" value="${S.sleepGoal}"><button style="flex:0" onclick="S.sleepGoal=+$('sg').value||7;save();R()">Save</button></div></div>
  <div class="card"><h2>History</h2>${L.slice(0,40).map(s=>`<div class="it"><span>${s.d} ${s.nap?'💤 nap':''} <span class="mu">${s.bed}–${s.wake}${s.q?' · Q'+s.q:''}${s.wk!==''?' · '+s.wk+' wakes':''}</span></span><span>${s.hrs} h <button class="x" onclick="delSleep('${s.id}')">✕</button></span></div>`).join('')||'<p class="mu">Nothing yet</p>'}</div>`};
window.addSleep=()=>{const b=$('sb').value,w=$('sw').value;if(!b||!w)return;S.sleep.push({id:Date.now()+'',d:$('sd').value,bed:b,wake:w,hrs:Calc.sleepHrs(b,w),q:$('sq').value?+$('sq').value:'',wk:$('swk').value===''?'':+$('swk').value,nap:$('snap').checked});save();R()};
window.delSleep=id=>{S.sleep=S.sleep.filter(s=>s.id!==id);save();R()};

V.weight=()=>{const W=[...S.weights].sort((a,b)=>a.d<b.d?-1:1),p=S.profile,cw=lastW(),start=W.length?W[0].w:cw;
  const pct=p.target&&start>p.target?Math.max(0,Math.min(100,(start-cw)/(start-p.target)*100)):0;
  return`<div class="card"><h2>⚖️ Log weight</h2><div class="row"><input type="date" id="wd" value="${today()}" max="${today()}"><input type="number" id="wv" step="0.1" inputmode="decimal" placeholder="lb"></div><button onclick="addWt()">Save</button></div>
  <div class="card"><h2>Progress</h2>${cw?`Current <b>${cw} lb</b>${p.target?` · Goal <b>${p.target} lb</b> · ${Math.max(0,(cw-p.target)).toFixed(1)} lb to go`:''}${W.length>1?` · Lost <b>${(start-cw).toFixed(1)} lb</b> since ${W[0].d}`:''}${p.target?bar(pct,100):''}`:'<p class="mu">Log your first weight.</p>'}
  ${chart(W.map(x=>({x:x.d.slice(5),y:x.w})),+p.target||0,' lb')}</div>
  <div class="card"><h2>History</h2>${W.slice().reverse().map(x=>`<div class="it"><span>${x.d}</span><span>${x.w} lb <button class="x" onclick="S.weights=S.weights.filter(y=>y.d!=='${x.d}');save();R()">✕</button></span></div>`).join('')}</div>`};
window.addWt=()=>{const w=+$('wv').value,d=$('wd').value;if(!w)return;S.weights=S.weights.filter(x=>x.d!==d);S.weights.push({d,w});S.profile.weight=lastW();save();R()};

V.prof=()=>{const p=S.profile,b=Calc.budget(prof());const sel=(id,opts,v)=>`<select id="${id}">${opts.map(([k,l])=>`<option value="${k}" ${String(k)===String(v)?'selected':''}>${l}</option>`).join('')}</select>`;
  return`<div class="card"><h2>👤 Profile & goals</h2>
  <div class="grid"><div><label>Sex</label>${sel('ps',[['f','Female'],['m','Male']],p.sex)}</div><div><label>Age</label><input id="pa" type="number" value="${p.age||''}"></div>
  <div><label>Height ft</label><input id="pft" type="number" value="${p.ft||5}"></div><div><label>in</label><input id="pin" type="number" value="${p.inch??7}"></div>
  <div><label>Current weight (lb)</label><input id="pw" type="number" step="0.1" value="${lastW()||''}"></div><div><label>Target weight (lb)</label><input id="pt" type="number" step="0.1" value="${p.target||''}"></div></div>
  <label>Activity level</label>${sel('pact',Object.entries(Calc.ACT),p.act)}
  <label>Weekly loss goal</label>${sel('pr',[[0.5,'0.5 lb/week'],[1,'1 lb/week'],[1.5,'1.5 lb/week'],[2,'2 lb/week']],p.rate)}
  <label><input type="checkbox" id="pbf" style="width:auto" ${p.bf?'checked':''}> Breastfeeding (adds calories)</label>
  <div class="row"><label style="flex:2">Extra for breastfeeding (300–500)</label><input id="pbfc" type="number" value="${p.bfCal||400}"></div>
  <label><input type="checkbox" id="pov" style="width:auto" ${p.override?'checked':''}> Override the 1,200-cal minimum</label>
  <div class="row"><label style="flex:2">Custom minimum</label><input id="pfl" type="number" value="${p.floor||1200}"></div>
  <button onclick="saveProf()">Save</button></div>
  ${b?`<div class="card"><h2>Your numbers</h2>BMR (Mifflin-St Jeor): <b>${b.bmr}</b><br>TDEE: <b>${b.tdee}</b><br>Daily budget: <b style="font-size:22px">${b.budget}</b> cal${b.floored?'<br><span class="mu">Raised to your minimum floor for safety.</span>':''}
  <p class="mu">Postpartum note: check with your provider before aggressive deficits, especially while breastfeeding (1 lb/week is a common gentle target).</p></div>`:''}
  <div class="card"><h2>💾 Backup</h2><p class="mu">Data is stored only on this device/browser. Export regularly.</p><button onclick="exportD()">Export JSON</button><button class="s" onclick="$('imp').click()">Import JSON</button><input type="file" id="imp" accept=".json,application/json" class="hide" onchange="importD(this)"></div>`};
window.saveProf=()=>{const v=id=>$(id).value;Object.assign(S.profile,{sex:v('ps'),age:+v('pa'),ft:+v('pft'),inch:+v('pin'),target:+v('pt')||'',act:+v('pact'),rate:+v('pr'),bf:$('pbf').checked,bfCal:+v('pbfc')||400,override:$('pov').checked,floor:+v('pfl')||1200});
  const w=+v('pw');if(w&&w!==lastW()){S.weights=S.weights.filter(x=>x.d!==today());S.weights.push({d:today(),w});S.profile.weight=w}save();R();alert('Saved!')};
window.exportD=()=>{const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify(S,null,1)],{type:'application/json'}));a.download='jamies-tracker-'+today()+'.json';a.click()};
window.importD=inp=>{const f=inp.files[0];if(!f)return;f.text().then(t=>{try{const d=JSON.parse(t);if(!d.days)throw 0;if(confirm('Replace all current data with this backup?')){S=Object.assign({sleep:[],sleepGoal:7,waterGoal:64,myFoods:[],recents:[],weights:[]},d);save();R()}}catch(e){alert('Not a valid backup file')}})};

const TABS=[['dash','🏠','Home'],['food','🍽️','Food'],['ex','🏃‍♀️','Exercise'],['water','💧','Water'],['sleep','😴','Sleep'],['weight','⚖️','Weight'],['prof','👤','Me']];
window.go=t=>{tab=t;R();scrollTo(0,0)};
window.R=()=>{releaseCamera();clearTimeout(searchTimer);searchGen++;lookupGen++;M.innerHTML=V[tab]();$('nav').innerHTML=TABS.map(([k,i,l])=>`<button class="${tab===k?'on':''}" onclick="go('${k}')"><b>${i}</b>${l}</button>`).join('')};
window.day=day;window.save=save;window.$=$;Object.defineProperty(window,'S',{get:()=>S});Object.defineProperty(window,'cur',{get:()=>cur,set:v=>cur=v});
Object.defineProperty(window,'sleepRange',{get:()=>sleepRange,set:v=>sleepRange=v});
R();
if('serviceWorker'in navigator){
  let refreshing=false,had=!!navigator.serviceWorker.controller;
  navigator.serviceWorker.addEventListener('controllerchange',()=>{
    if(!had){had=true;return}
    if(refreshing)return;refreshing=true;location.reload();
  });
  navigator.serviceWorker.register('sw.js');
}
}

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
if(typeof module!=='undefined'){module.exports={Calc,METS};}
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
V.food=()=>{const D=day(cur);let h=dateBar();
  MEALS.forEach(m=>{const it=D.food.map((f,i)=>[f,i]).filter(([f])=>f.meal===m);
    h+=`<div class="card"><h2>${m} <span class="mu">${sum(it.map(x=>x[0]),'cal')} cal</span></h2>${it.map(([f,i])=>`<div class="it"><span>${esc(f.name)} <span class="mu">${esc(f.serv||'')}</span></span><span>${f.cal} <button class="x" onclick="delF(${i})">✕</button></span></div>`).join('')}
    <button class="s" onclick="openAdd('${m}')">+ Add food</button></div>`});
  return h+`<div id="addbox"></div>`};
window.delF=i=>{day(cur).food.splice(i,1);save();R()};
window.openAdd=m=>{const q=(f,j,src)=>`<div class="it"><span>${esc(f.name)} <span class="mu">${esc(f.serv||'')} · ${f.cal} cal</span></span><span><button class="g" onclick="quick('${src}',${j},'${m}')">+</button>${src==='my'?`<button class="x" onclick="delMy(${j})">✕</button>`:''}</span></div>`;
  $('addbox').innerHTML=`<div class="card" id="ab"><h2>Add to ${m}</h2>
  <input id="fn" placeholder="Food name"><div class="row"><input id="fs" placeholder="Serving (e.g. 1 cup)"><input id="fq" type="number" step="0.25" value="1" placeholder="× servings"></div>
  <input id="fc" type="number" inputmode="decimal" placeholder="Calories per serving">
  <div class="grid"><input id="fp" type="number" placeholder="Protein g"><input id="fcb" type="number" placeholder="Carbs g"><input id="ff" type="number" placeholder="Fat g"><input id="ffi" type="number" placeholder="Fiber g"></div>
  <label><input type="checkbox" id="fsave" style="width:auto"> Save to My Foods</label><br>
  <button onclick="addF('${m}')">Add</button><button class="s" onclick="quickCal('${m}')">Quick-add calories only</button>
  <h3>Recent</h3>${S.recents.map((f,j)=>q(f,j,'rec')).join('')||'<p class="mu">None yet</p>'}
  <h3>My Foods</h3><input placeholder="Search my foods" oninput="document.querySelectorAll('.myf').forEach(e=>e.style.display=e.textContent.toLowerCase().includes(this.value.toLowerCase())?'':'none')">
  ${S.myFoods.map((f,j)=>`<div class="myf">${q(f,j,'my')}</div>`).join('')||'<p class="mu">None yet</p>'}</div>`;$('ab').scrollIntoView({behavior:'smooth'})};
function pushFood(f,m){const e=Object.assign({},f,{meal:m});day(cur).food.push(e);
  const base={name:f.name,serv:f.serv,cal:f.baseCal??f.cal,p:f.bp??f.p,c:f.bc??f.c,f:f.bf??f.f,fi:f.bfi??f.fi};
  S.recents=[base,...S.recents.filter(r=>!(r.name===base.name&&r.cal===base.cal))].slice(0,15);save();R()}
window.addF=m=>{const n=$('fn').value.trim(),c=+$('fc').value,q=+$('fq').value||1;if(!n||!c&&c!==0||!$('fc').value){alert('Enter a name and calories');return}
  const v=id=>$(id).value===''?0:+$(id).value;const base={name:n,serv:$('fs').value,cal:c,p:v('fp'),c:v('fcb'),f:v('ff'),fi:v('ffi')};
  if($('fsave').checked)S.myFoods.push(base);
  pushFood({name:n,serv:(q!==1?q+' × ':'')+base.serv,cal:Math.round(c*q),p:base.p*q,c:base.c*q,f:base.f*q,fi:base.fi*q,baseCal:c,bp:base.p,bc:base.c,bf:base.f,bfi:base.fi},m)};
window.quick=(src,j,m)=>{const f=(src==='my'?S.myFoods:S.recents)[j];const q=+prompt(`Servings of ${f.name} (${f.serv||'1 serving'})?`,'1');if(!q)return;
  pushFood({name:f.name,serv:(q!==1?q+' × ':'')+(f.serv||''),cal:Math.round(f.cal*q),p:(f.p||0)*q,c:(f.c||0)*q,f:(f.f||0)*q,fi:(f.fi||0)*q,baseCal:f.cal,bp:f.p,bc:f.c,bf:f.f,bfi:f.fi},m)};
window.delMy=j=>{if(confirm('Remove from My Foods?')){S.myFoods.splice(j,1);save();R()}};
window.quickCal=m=>{const c=+prompt('Calories to quick-add:');if(c){day(cur).food.push({name:'Quick add',cal:Math.round(c),meal:m,p:0,c:0,f:0,fi:0});save();R()}};

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
window.R=()=>{M.innerHTML=V[tab]();$('nav').innerHTML=TABS.map(([k,i,l])=>`<button class="${tab===k?'on':''}" onclick="go('${k}')"><b>${i}</b>${l}</button>`).join('')};
window.day=day;window.save=save;window.$=$;Object.defineProperty(window,'S',{get:()=>S});Object.defineProperty(window,'cur',{get:()=>cur,set:v=>cur=v});
Object.defineProperty(window,'sleepRange',{get:()=>sleepRange,set:v=>sleepRange=v});
R();
if('serviceWorker'in navigator)navigator.serviceWorker.register('sw.js');
}

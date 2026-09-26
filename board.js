const DASHBOARD_TARGETS = Object.freeze({ hits: 12, views: 100000, minHitViews: 5000, starViews: 10000 });
const THEME_KEY = 'xvs-theme';
function esc(s){return String(s==null?'':s).replace(/&/g,'&').replace(/</g,'<').replace(/>/g,'>').replace(/"/g,'"').replace(/'/g,'&#39;')}
function num(n){n=Number(n);return Number.isFinite(n)?n:0}
function fmt(n){n=num(n);if(n===0)return'0';if(n>=1e6)return(n/1e6).toFixed(n>=1e7?0:2).replace(/\.0+$/,'').replace(/(\.\d)0$/,'$1')+'M';if(n>=1e3)return(n/1e3).toFixed(n>=1e5?0:1).replace(/\.0$/,'')+'K';return String(Math.round(n))}
function pct(value,target){return target?Math.round(value/target*100):0}
function scoreFor(hits,views){return Math.round(100*(.45*Math.min(hits/DASHBOARD_TARGETS.hits,1)+.55*Math.min(views/DASHBOARD_TARGETS.views,1)))}
function rawIndex(hits,views){return Math.round(100*(.45*(hits/DASHBOARD_TARGETS.hits)+.55*(views/DASHBOARD_TARGETS.views)))}
function trendMarkup(delta,label){const dir=delta>0?'up':delta<0?'down':'flat';const arrow=delta>0?'↑':delta<0?'↓':'→';const d=delta===0?'on pace':`${delta>0?'+':''}${delta}`;return{dir,html:`<span class="trend-arrow">${arrow}</span><span>${d} ${label}</span>`}}
function easeOutCubic(t){return 1-Math.pow(1-t,3)}
function countUp(el, to, {duration=1100, format=v=>String(Math.round(v)), decimals=0}={}){
  if(!el) return; const reduce=window.matchMedia('(prefers-reduced-motion: reduce)').matches; const start=performance.now(); const from=0;
  if(reduce){el.textContent=format(to);return}
  function frame(now){const t=Math.min(1,(now-start)/duration); const v=from+(to-from)*easeOutCubic(t); el.textContent=format(v); if(t<1) requestAnimationFrame(frame)}
  requestAnimationFrame(frame)
}
function applyTheme(theme){
  const t=theme==='day'?'day':'night';
  document.documentElement.setAttribute('data-theme', t);
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', t==='day'?'#f4f7f8':'#050505');
  const label=document.getElementById('theme-label'); const ico=document.getElementById('theme-ico');
  if(label) label.textContent=t==='day'?'Day':'Night';
  if(ico) ico.textContent=t==='day'?'☀':'☾';
  try{localStorage.setItem(THEME_KEY,t)}catch(e){}
}
function initTheme(){
  let t='night';
  try{t=localStorage.getItem(THEME_KEY)||t}catch(e){}
  applyTheme(t);
  document.getElementById('theme-toggle')?.addEventListener('click',()=>{
    const cur=document.documentElement.getAttribute('data-theme')==='day'?'day':'night';
    applyTheme(cur==='day'?'night':'day');
  });
}
async function copyDraft(btn,text){try{await navigator.clipboard.writeText(text)}catch(e){const ta=document.createElement('textarea');ta.value=text;ta.style.position='fixed';ta.style.left='-9999px';document.body.appendChild(ta);ta.select();document.execCommand('copy');ta.remove()}const prev=btn.textContent;btn.textContent='COPIED';btn.classList.add('copied');setTimeout(()=>{btn.textContent=prev;btn.classList.remove('copied')},1400)}
function renderSparkline(hits){const top=[...hits].sort((a,b)=>num(b.views)-num(a.views)).slice(0,10);const svg=document.getElementById('sparkline');const labels=document.getElementById('spark-labels');if(!top.length){svg.innerHTML='<text x="500" y="65" text-anchor="middle" fill="#899398" font-size="13">NO SIGNALS</text>';labels.innerHTML='';return}const max=Math.max(...top.map(h=>num(h.views)),1);const gap=18,w=(1000-gap*(top.length+1))/top.length;svg.innerHTML=`<line x1="0" y1="112" x2="1000" y2="112" stroke="currentColor" opacity=".25" stroke-width="1"/>`+top.map((h,i)=>{const height=Math.max(8,94*num(h.views)/max),x=gap+i*(w+gap),y=112-height;const fill=i===0?'#b8ff3d':'#20d9ff';return`<g><rect x="${x}" y="${y}" width="${w}" height="${height}" fill="${fill}" opacity="${i===0?1:.78}"/><rect x="${x}" y="${y}" width="${w}" height="2" fill="#fff" opacity=".65"/><text x="${x+w/2}" y="${Math.max(10,y-7)}" text-anchor="middle" fill="${fill}" font-family="IBM Plex Mono" font-size="10">${esc(fmt(h.views))}</text></g>`}).join('');labels.innerHTML=top.map(h=>`<span>${esc((h.handle||h.name||'—').replace('@',''))}</span>`).join('')}
function renderLeaderboard(el, entries){
  if(!el) return;
  if(!entries||!entries.length){el.innerHTML='<p class="muted">No leaderboard data yet.</p>';return}
  el.innerHTML=entries.map((e,i)=>`<div class="lb-row"><div class="rank">${String(i+1).padStart(2,'0')}</div><div><div class="lb-handle">${esc(e.handle||'')}</div><div class="lb-meta">${esc(e.name||'—')} · ${num(e.hits)} hits · ${num(e.days)}d</div></div><div class="lb-views">${esc(fmt(e.views))}<small>best ${esc(fmt(e.best||0))}</small></div></div>`).join('');
}
function normalizeNoHits(raw){
  if(!Array.isArray(raw)) return [];
  return raw.map(item=>{
    if(typeof item==='string') return {handle:item.startsWith('@')?item:'@'+item, reason:'Below 5k views floor or no qualifying day original.', max_views:null};
    const handle=item.handle||item.account||'';
    return {
      handle: handle.startsWith('@')?handle:'@'+handle,
      reason: item.reason||item.note||item.likely_reason||'Below 5k views floor or no qualifying day original.',
      max_views: item.max_views!=null?item.max_views:null
    };
  });
}
function renderNoHits(list){
  const el=document.getElementById('nohits');
  if(!list.length){el.innerHTML='<p class="muted">All watchlist accounts cleared the 5k floor today.</p>';return}
  el.innerHTML=list.map(n=>`<article class="nohit"><div><div class="nohit-handle">${esc(n.handle)}</div><div class="nohit-badge">no hit ≥5k</div></div><div class="nohit-reason">${esc(n.reason)}</div><div class="nohit-max">max seen<b>${n.max_views==null?'—':esc(fmt(n.max_views))}</b></div></article>`).join('');
}
async function boot(){
  const res=await fetch('./data.json?ts='+Date.now());if(!res.ok)throw new Error('data.json '+res.status);const d=await res.json();
  const hits=Array.isArray(d.hits)?d.hits:[];const virals=Array.isArray(d.virals)?d.virals:(Array.isArray(d.outsiders)?d.outsiders:[]);
  const totalViews=hits.reduce((a,h)=>a+num(h.views),0);const maxViews=hits.length?Math.max(...hits.map(h=>num(h.views))):0;const highlights=hits.filter(h=>h.highlight===true||num(h.views)>=DASHBOARD_TARGETS.starViews).length;
  const score=scoreFor(hits.length,totalViews);let delta=rawIndex(hits.length,totalViews)-100,label='vs target';
  const prev=d.previous_day||d.previous||null;if(prev){let ps=Number(prev.x_score);if(!Number.isFinite(ps)){const ph=Array.isArray(prev.hits)?prev.hits.length:num(prev.hits_count);const pv=Array.isArray(prev.hits)?prev.hits.reduce((a,h)=>a+num(h.views),0):num(prev.total_views);ps=scoreFor(ph,pv)}if(Number.isFinite(ps)){delta=score-ps;label='vs prev day'}}
  countUp(document.getElementById('x-score'), score, {duration:1200, format:v=>String(Math.round(v))});
  const ring=document.getElementById('score-ring');
  const reduce=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if(reduce){ring.style.setProperty('--score',score)}
  else{const t0=performance.now();(function anim(now){const t=Math.min(1,(now-t0)/1200);ring.style.setProperty('--score', (score*easeOutCubic(t)).toFixed(2));if(t<1)requestAnimationFrame(anim)})(t0)}
  const st=trendMarkup(delta,label);const scoreTrend=document.getElementById('score-trend');scoreTrend.className='trend '+st.dir;scoreTrend.innerHTML=st.html;
  const hp=pct(hits.length,DASHBOARD_TARGETS.hits),vp=pct(totalViews,DASHBOARD_TARGETS.views);document.getElementById('hits-target-copy').textContent=`${hits.length} / ${DASHBOARD_TARGETS.hits} · ${hp}%`;document.getElementById('views-target-copy').textContent=`${fmt(totalViews)} / ${fmt(DASHBOARD_TARGETS.views)} · ${vp}%`;
  requestAnimationFrame(()=>{[['hits-progress',hp],['views-progress',vp]].forEach(([id,p])=>{const el=document.getElementById(id);el.style.width=Math.min(100,p)+'%';if(p>=100)el.classList.add('done')})});
  const targetDone=hp>=100&&vp>=100;const targetState=document.getElementById('target-state');targetState.className='target-state '+(targetDone?'done':'pending');targetState.textContent=targetDone?'✓ DONE':'◷ NOT DONE';
  const metrics=[
    ['Hits',hits.length,null,trendMarkup(hits.length-DASHBOARD_TARGETS.hits,'vs target')],
    ['★ Highlights',highlights,null,{dir:highlights?'up':'flat',html:`${highlights?'↑':'→'} ≥${fmt(DASHBOARD_TARGETS.starViews)} each`}],
    ['Total views',totalViews,fmt,trendMarkup(pct(totalViews,DASHBOARD_TARGETS.views)-100,'vs target')],
    ['Outsiders',virals.length,null,trendMarkup(virals.length-num(d.virals_target||20),'vs brief')],
    ['Top view',maxViews,fmt,trendMarkup(pct(maxViews,DASHBOARD_TARGETS.starViews)-100,'vs ★ line')]
  ];
  document.getElementById('stats').innerHTML=metrics.map(([k,v,formatter,t],i)=>`<article class="stat"><div class="stat-k">${esc(k)}</div><div class="stat-v" id="stat-v-${i}" data-raw="${num(v)}">0</div><div class="stat-note ${t.dir}">${t.html}</div></article>`).join('');
  metrics.forEach(([k,v,formatter],i)=>{
    const el=document.getElementById('stat-v-'+i);
    const format = formatter || (x=>String(Math.round(x)));
    countUp(el, num(v), {duration:1000+i*80, format});
  });
  const brandTitle=d.brand_title||'Calmly Crashing';const brandHandle=d.brand_handle||'';const h1=document.querySelector('.brand-lockup h1');if(h1){h1.innerHTML=esc(brandTitle)+(brandHandle?` <span class="handle">· ${esc(brandHandle.startsWith('@')?brandHandle:'@'+brandHandle)}</span>`:'');}document.title=brandTitle+' · X Virality Score';
  const updated=d.updated?new Date(d.updated).toLocaleString('en-GB',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit',hour12:false}):'—';document.getElementById('meta').textContent=`${d.date||'—'} · updated ${updated} · ${d.timezone||'local'}`;document.getElementById('chart-scale').textContent=`peak ${fmt(maxViews)} · ${hits.length} signals`;renderSparkline(hits);
  const lbs=d.leaderboards||{};
  document.getElementById('week-title').textContent=(lbs.week&&lbs.week.label)||'Week';
  document.getElementById('month-title').textContent=(lbs.month&&lbs.month.label)||'Month';
  const daysInc=(lbs.days_included||[]).join(', ')||'—';
  document.getElementById('lb-note').textContent=`as of ${lbs.as_of||d.date||'—'} · days ${daysInc}`;
  renderLeaderboard(document.getElementById('week-board'), lbs.week&&lbs.week.entries);
  renderLeaderboard(document.getElementById('month-board'), lbs.month&&lbs.month.entries);
  const sorted=[...hits].sort((a,b)=>num(b.views)-num(a.views));document.getElementById('hits').innerHTML=sorted.map((h,i)=>{const threshold=h.highlight===true?DASHBOARD_TARGETS.starViews:DASHBOARD_TARGETS.minHitViews;const done=num(h.views)>=threshold;const draftId='draft-'+i;const draft=h.draft_en||'';return`<article class="card"><div class="card-top"><div class="identity"><div class="rank">${String(i+1).padStart(2,'0')}</div><div><div class="name">${esc(h.name||h.display_name||'Unknown')}</div><div class="handle">${esc(h.handle||'')}</div></div></div><div class="views-big">${esc(h.views_label||fmt(h.views))}<small>views</small></div></div><div class="hit-target ${done?'done':'not-done'}"><span class="mark">${done?'✓':'×'}</span><span>${done?'DONE':'NOT DONE'} · day target ≥${fmt(threshold)}${threshold===DASHBOARD_TARGETS.starViews?' ★':''}</span></div><div class="hook">${esc(h.hook||h.text||'')}</div>${h.video_tip?`<div class="chip">${esc(h.video_tip)}</div>`:''}<div class="draft-block"><div class="draft-head"><span class="draft-label">Draft · EN</span><button type="button" class="copy-btn" data-draft-id="${draftId}">COPY DRAFT</button></div><pre class="draft-text" id="${draftId}">${esc(draft)}</pre></div><a class="post-link" href="${esc(h.url||h.status_url||'#')}" target="_blank" rel="noopener">OPEN POST ↗</a></article>`}).join('')||'<p class="muted">No watchlist hits today.</p>';
  document.querySelectorAll('.copy-btn').forEach(btn=>btn.addEventListener('click',()=>{const el=document.getElementById(btn.dataset.draftId);copyDraft(btn,el?el.textContent:'')}));
  document.getElementById('patterns').innerHTML=(d.patterns||[]).map(p=>`<span class="tag">${esc(p)}</span>`).join('');document.getElementById('viral-count').textContent=`${virals.length} outsider signals`;
  document.getElementById('virals').innerHTML=virals.map((v,i)=>{const pending=!v.url||v.url==='#';return`<article class="card${pending?' pending':''}"><div class="card-top"><div class="identity"><div class="rank">${String(i+1).padStart(2,'0')}</div><div><div class="name">${esc(v.name||v.display_name||'Unknown')}</div><div class="handle">${esc(v.handle||'')}</div></div></div><div class="views-big">${esc(v.views_label||fmt(v.views))}<small>views</small></div></div><div class="hook">${esc(v.hook||v.text||'')}</div><a class="post-link${pending?' disabled':''}" href="${esc(v.url||'#')}" target="_blank" rel="noopener">${pending?'PENDING SCRAPE':'OPEN POST ↗'}</a></article>`}).join('');const narr=document.getElementById('virals-narrative');if(d.virals_narrative||d.narrative_synthesis){narr.hidden=false;narr.textContent=d.virals_narrative||d.narrative_synthesis}
  renderNoHits(normalizeNoHits(d.no_hits));
}
initTheme();
boot().catch(err=>{document.getElementById('meta').textContent='failed to load data.json';console.error(err)});
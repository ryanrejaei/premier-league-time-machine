'use strict';

// Independent football-history prototype. Figures are reconstructed from match-level results.
const LATEST_SEASON = 2026;
const SEASONS = Array.from({length:15}, (_, i) => seasonKey(LATEST_SEASON - i));
const SOURCE_OPENFOOTBALL = 'https://raw.githubusercontent.com/openfootball/football.json/master';
const SOURCE_FPL_ARCHIVE = 'https://raw.githubusercontent.com/vaastav/Fantasy-Premier-League/master/data';
const SOURCE_FPL_CURRENT = 'https://raw.githubusercontent.com/footydeano/fpl-data/main/data/current';
const SOURCE_EXTRA_STATS = 'https://raw.githubusercontent.com/qhtexas/football-dataset/master/datasets/premier-league';
const COLUMN_DEFS = [
  {key:'p', label:'P', description:'Matches played', width:27, default:false},
  {key:'w', label:'W', description:'Wins', width:25, default:false},
  {key:'d', label:'D', description:'Draws', width:25, default:false},
  {key:'l', label:'L', description:'Losses', width:25, default:false},
  {key:'gf', label:'GF', description:'Goals for', width:31, default:false},
  {key:'ga', label:'GA', description:'Goals against', width:31, default:false},
  {key:'gd', label:'GD', description:'Goal difference', width:33, default:true},
  {key:'pts', label:'Pts', description:'Points', width:37, default:true},
  {key:'yc', label:'YC', description:'Yellow cards', width:33, default:false},
  {key:'rc', label:'RC', description:'Red cards', width:33, default:false},
  {key:'shots', label:'Sh', description:'Shots', width:34, default:false},
  {key:'sot', label:'SOT', description:'Shots on target', width:37, default:false},
  {key:'corners', label:'Cor', description:'Corners', width:36, default:false},
  {key:'fouls', label:'F', description:'Fouls committed', width:34, default:false},
];
const STAT_KEYS = ['yc','rc','shots','sot','corners','fouls'];
const cache = new Map();
let currentRequest = 0;
let animationTimer = null;
const CHANGE_COLORS = {'up-large':'#21875b','up-medium':'#59c786','up-small':'#b8edc8','down-small':'#f5b95d','down-medium':'#f36e79','down-large':'#c63f53',same:'#a7aebc'};
const state = {week:1,count:5,custom:null,compare:false,movement:false,columns:loadColumns(),selectedClub:null,selectedName:'',connections:false};
let tourStep=0, tourFocus=null, connectionFrame=0;
const $ = id => document.getElementById(id);
function seasonKey(start) {return `${start}-${String((start+1)%100).padStart(2,'0')}`;}
function shortSeason(season) {return season.replace('-', '/');}
function escapeHtml(value) {return String(value).replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));}
function median(values) {if(!values.length)return NaN;const a=[...values].sort((x,y)=>x-y);return a.length%2?a[(a.length-1)/2]:(a[a.length/2-1]+a[a.length/2])/2;}
function timeOf(date) {if(!date)return NaN;return Date.parse(date.slice(0,10)+'T12:00:00Z');}
function parseCSV(text) {
  const rows=[],row=[];let field='',inside=false;
  for(let i=0;i<text.length;i++){const c=text[i];if(c==='"'){if(inside&&text[i+1]==='"'){field+='"';i++;}else inside=!inside;}else if(c===','&&!inside){row.push(field);field='';}else if((c==='\n'||c==='\r')&&!inside){if(c==='\r'&&text[i+1]==='\n')i++;row.push(field);if(row.some(Boolean))rows.push([...row]);row.length=0;field='';}else field+=c;}
  if(field||row.length){row.push(field);rows.push(row);}
  const header=rows.shift()||[];return rows.map(r=>Object.fromEntries(header.map((key,i)=>[key,r[i]??''])));
}
function loadColumns() {
  const defaults=COLUMN_DEFS.filter(c=>c.default).map(c=>c.key);
  try {const saved=JSON.parse(localStorage.getItem('tableTimeColumnsV2'));
    if(Array.isArray(saved)){const known=saved.filter(x=>COLUMN_DEFS.some(c=>c.key===x));if(known.length)return known;}
  } catch(_) {} return defaults;
}
function saveColumns() {try{localStorage.setItem('tableTimeColumnsV2',JSON.stringify(state.columns));}catch(_) {}}
function visibleColumns() {return COLUMN_DEFS.filter(c=>state.columns.includes(c.key));}
async function getText(url){const r=await fetch(url,{cache:'no-cache'});if(!r.ok)throw new Error(`Couldn't load match data (HTTP ${r.status}).`);return r.text();}
function normalizeClub(name){
  let n=String(name).toLowerCase().replace(/\b(fc|afc|the)\b/g,'').replace(/[^a-z0-9]/g,'').trim();
  const aliases={
    'mancity':'manchestercity','manutd':'manchesterunited','manunited':'manchesterunited',
    'spurs':'tottenhamhotspur','tottenham':'tottenhamhotspur',
    'nottinghamforest':'nottinghamforest','nottmforest':'nottinghamforest',
    'wolves':'wolverhamptonwanderers','brighton':'brightonhovealbion',
    'westbrom':'westbromwichalbion','newcastle':'newcastleunited',
    'westham':'westhamunited','leicester':'leicestercity','sheffutd':'sheffieldunited',
    'sheffieldutd':'sheffieldunited','bournemouth':'bournemouth',
    'hull':'hullcity','stoke':'stokecity','swansea':'swanseacity','norwich':'norwichcity',
    'cardiff':'cardiffcity','qpr':'queensparkrangers', 'coventry':'coventrycity','leeds':'leedsunited','wigan':'wiganathletic',
    'huddersfield':'huddersfieldtown','ipswich':'ipswichtown','luton':'lutontown'
  };
  return aliases[n]||n;
}
function clubShortName(name){
  const n=name.replace(/\s+(FC|AFC)$/,'');
  const aliases={'Manchester United':'Man United','Manchester City':'Man City','Tottenham Hotspur':'Tottenham','Wolverhampton Wanderers':'Wolves','West Bromwich Albion':'West Brom','Brighton & Hove Albion':'Brighton','Nottingham Forest':'Nottm Forest','Queens Park Rangers':'QPR','AFC Bournemouth':'Bournemouth','West Ham United':'West Ham','Newcastle United':'Newcastle','Sheffield United':'Sheff United','Leicester City':'Leicester','Norwich City':'Norwich','Swansea City':'Swansea','Hull City':'Hull','Coventry City':'Coventry','Cardiff City':'Cardiff'};
  return aliases[n]||n.replace(/\bFootball Club\b/,'').trim();
}
function initials(name){const n=clubShortName(name),bits=n.split(/\s+/);return bits.length===1?n.slice(0,2).toUpperCase():bits.map(s=>s[0]).join('').slice(0,3).toUpperCase();}
// Current club badges from the Premier League asset service; not season-specific historical designs.
const BADGE_CODES = {"arsenal":3,"astonvilla":7,"bournemouth":91,"brightonhovealbion":36,"burnley":90,"chelsea":8,"crystalpalace":31,"everton":11,"leicestercity":13,"liverpool":14,"manchestercity":43,"manchesterunited":1,"newcastleunited":4,"norwichcity":45,"sheffieldunited":49,"southampton":20,"tottenhamhotspur":6,"watford":57,"westhamunited":21,"wolverhamptonwanderers":39,"fulham":54,"leedsunited":2,"westbromwichalbion":35,"brentford":94,"nottinghamforest":17,"lutontown":102,"ipswichtown":40,"sunderland":56,"hullcity":88,"huddersfieldtown":38,"cardiffcity":97,"swanseacity":80,"stokecity":110,"queensparkrangers":15,"middlesbrough":25,"reading":108,"wiganathletic":111,"coventrycity":10};
function badgeUrl(name){
  const club=normalizeClub(name);
  const official={reading:108,wiganathletic:111,coventrycity:9,ipswichtown:41,queensparkrangers:52};
  if(official[club])return `https://resources.premierleague.com/premierleague25/badges-alt/${official[club]}.svg`;
  const code=BADGE_CODES[club];return code?`https://resources.premierleague.com/premierleague/badges/50/t${code}.png`:null;
}
function clubBadge(name){
  const url=badgeUrl(name);
  return `<span class="club-badge-wrap">${url?`<img class="club-badge" src="${url}" alt="" width="18" height="18" loading="lazy" decoding="async" referrerpolicy="no-referrer">`:''}<span class="badge-fallback" ${url?'hidden':''}>${escapeHtml(initials(name))}</span></span>`;
}
function fixtureId(home,away){return `${normalizeClub(home)}:${normalizeClub(away)}`;}
function numberOrNull(value){return value===''||value==null?null:Number.isFinite(Number(value))?Number(value):null;}
async function openFootballData(season){
  const data=JSON.parse(await getText(`${SOURCE_OPENFOOTBALL}/${season}/en.1.json`));
  if(!Array.isArray(data.matches))throw new Error('No fixtures found in the archive.');
  const fixtures=data.matches.map(m=>{
    const week=Number(String(m.round).match(/\d+/)?.[0]);
    let date=m.date||'';
    if(season==='2019-20'&&week>=30&&/^2019-0[67]-/.test(date))date='2020'+date.slice(4);
    return {week,date,home:m.team1,away:m.team2,hs:numberOrNull(m.score?.ft?.[0]),as:numberOrNull(m.score?.ft?.[1]),played:Array.isArray(m.score?.ft)&&m.score.ft.length===2};
  }).filter(x=>x.week>=1&&x.week<=38&&x.home&&x.away&&x.date);
  return {fixtures,source:'OpenFootball'};
}
async function fplArchiveData(season){
  const base=`${SOURCE_FPL_ARCHIVE}/${season}`;
  const [fixtureCSV,teamCSV]=await Promise.all([getText(`${base}/fixtures.csv`),getText(`${base}/teams.csv`)]);
  const teams=new Map(parseCSV(teamCSV).map(row=>[String(row.id),row.name]));
  const fixtures=parseCSV(fixtureCSV).map(m=>({
    week:Number(m.event),date:m.kickoff_time?.slice(0,10),home:teams.get(String(m.team_h)),away:teams.get(String(m.team_a)),
    hs:numberOrNull(m.team_h_score),as:numberOrNull(m.team_a_score),
    played:m.finished==='True'&&m.team_h_score!==''&&m.team_a_score!==''
  })).filter(x=>x.week>=1&&x.week<=38&&x.home&&x.away&&x.date);
  return {fixtures,source:'Fantasy Premier League archive'};
}
async function fplCurrentData(){
  const [fixtureCSV,teamCSV]=await Promise.all([getText(`${SOURCE_FPL_CURRENT}/fixtures.csv`),getText(`${SOURCE_FPL_CURRENT}/teams.csv`)]);
  const teams=new Map(parseCSV(teamCSV).map(row=>[row.short_name,row.name]));
  const fixtures=parseCSV(fixtureCSV).map(m=>({
    week:Number(m.gw),date:m.kickoff_utc?.slice(0,10),home:teams.get(m.home)||m.home,away:teams.get(m.away)||m.away,
    hs:numberOrNull(m.home_score),as:numberOrNull(m.away_score),played:m.finished==='True'&&m.home_score!==''&&m.away_score!==''
  })).filter(x=>x.week>=1&&x.week<=38&&x.home&&x.away&&x.date);
  return {fixtures,source:'FPL data (community archive)'};
}
async function optionalStatistics(season){
  if(season==='2026-27')return null;
  const id=season.slice(2,4)+season.slice(5,7);
  const rows=parseCSV(await getText(`${SOURCE_EXTRA_STATS}/season-${id}.csv`));
  return rows.map(m=>({
    home:m.HomeTeam,away:m.AwayTeam,date:m.Date,hs:numberOrNull(m.FTHG),as:numberOrNull(m.FTAG),
    homeStats:{yc:numberOrNull(m.HY),rc:numberOrNull(m.HR),shots:numberOrNull(m.HS),sot:numberOrNull(m.HST),corners:numberOrNull(m.HC),fouls:numberOrNull(m.HF)},
    awayStats:{yc:numberOrNull(m.AY),rc:numberOrNull(m.AR),shots:numberOrNull(m.AS),sot:numberOrNull(m.AST),corners:numberOrNull(m.AC),fouls:numberOrNull(m.AF)}
  })).filter(m=>m.home&&m.away&&Number.isFinite(m.hs)&&Number.isFinite(m.as));
}
function enrichFixtures(fixtures,matchStatistics,{fillMissingScores=false}={}){
  if(!matchStatistics)return {matched:0,filled:0,discrepancies:0};
  const byPair=new Map(matchStatistics.map(m=>[fixtureId(m.home,m.away),m]));
  let matched=0,filled=0,discrepancies=0;
  for(const fixture of fixtures){
    const extra=byPair.get(fixtureId(fixture.home,fixture.away));if(!extra)continue;
    // Match pair is unique within one Premier League season; use as stable join key.
    const matchesScore=fixture.played&&fixture.hs===extra.hs&&fixture.as===extra.as;
    if(fixture.played&&!matchesScore){discrepancies++;continue;}
    if(!fixture.played){if(!fillMissingScores)continue;fixture.hs=extra.hs;fixture.as=extra.as;fixture.played=true;fixture.date=extra.date||fixture.date;filled++;}
    fixture.stats={home:extra.homeStats,away:extra.awayStats};matched++;
  }
  return {matched,filled,discrepancies};
}
async function loadSeason(season){
  if(!cache.has(season))cache.set(season,(async()=>{
    const primary=season==='2026-27'?await fplCurrentData():season==='2025-26'?await fplArchiveData(season):await openFootballData(season);
    const stats=await optionalStatistics(season).catch(()=>null);
    const enrichment=enrichFixtures(primary.fixtures,stats,{fillMissingScores:season==='2025-26'});
    if(enrichment.filled)primary.source='FPL archive + Football Dataset';
    const teamList=[...new Set(primary.fixtures.flatMap(f=>[f.home,f.away]))].sort();
    if(primary.fixtures.length<250||teamList.length!==20)throw new Error(`Incomplete fixture list (${primary.fixtures.length} matches; ${teamList.length} teams).`);
    const complete=primary.fixtures.length===380&&primary.fixtures.every(f=>f.played&&Number.isFinite(f.hs)&&Number.isFinite(f.as));
    return {...primary,teams:teamList,complete,actualMatches:primary.fixtures.filter(f=>f.played).length,statsAvailable:enrichment.matched,statsTotal:stats?.length||0,discrepancies:enrichment.discrepancies};
  })().catch(e=>{cache.delete(season);throw e;}));
  return cache.get(season);
}
function latestPlayedDate(data){return data.fixtures.filter(f=>f.played).map(f=>f.date).sort().at(-1)||null;}
function cutoffForWeek(fixtures,week){
  if(week===38)return Infinity;
  const dates=fixtures.filter(m=>m.week===week+1).map(m=>timeOf(m.date)).filter(Number.isFinite);
  if(!dates.length)return Infinity;
  const middle=median(dates),regular=dates.filter(t=>Math.abs(t-middle)<=4*86400000);
  return Math.min(...(regular.length?regular:dates));
}
function standings(data,week){
  const cutoff=cutoffForWeek(data.fixtures,week),now=Date.now();
  const teams=new Map(data.teams.map(name=>{
    const stats=Object.fromEntries(STAT_KEYS.map(key=>[key,{sum:0,count:0}]));
    return [name,{name,p:0,w:0,d:0,l:0,gf:0,ga:0,gd:0,pts:0,_stats:stats}];
  }));
  for(const fixture of data.fixtures){
    const date=timeOf(fixture.date);
    if(!fixture.played||!Number.isFinite(date)||date>=cutoff||date>now)continue;
    const home=teams.get(fixture.home),away=teams.get(fixture.away);if(!home||!away)continue;
    home.p++;away.p++;home.gf+=fixture.hs;home.ga+=fixture.as;away.gf+=fixture.as;away.ga+=fixture.hs;
    if(fixture.hs>fixture.as){home.w++;home.pts+=3;away.l++;}
    else if(fixture.hs<fixture.as){away.w++;away.pts+=3;home.l++;}
    else {home.d++;away.d++;home.pts++;away.pts++;}
    for(const [team,side] of [[home,'home'],[away,'away']]){
      for(const key of STAT_KEYS){const value=fixture.stats?.[side]?.[key];
        if(Number.isFinite(value)){team._stats[key].sum+=value;team._stats[key].count++;}
      }
    }
  }
  const out=[...teams.values()];
  out.forEach(t=>{t.gd=t.gf-t.ga;for(const key of STAT_KEYS)t[key]=t.p>0&&t._stats[key].count===t.p?t._stats[key].sum:null;delete t._stats;});
  out.sort((a,b)=>b.pts-a.pts||b.gd-a.gd||b.gf-a.gf||a.name.localeCompare(b.name));
  out.forEach((t,i)=>{t.pos=i+1;});return out;
}
function activeSeasons(){return state.custom?.length?SEASONS.filter(x=>state.custom.includes(x)):SEASONS.slice(0,state.count);}
// Positive future delta = higher final finish (e.g. 9th -> 3rd = +6).
function positionChange(current,final){return Number.isFinite(final)?current-final:null;}
function changeClass(delta){
  if(!Number.isFinite(delta)||delta===0)return 'same';
  return (delta>0?'up-':'down-')+(Math.abs(delta)>=10?'large':Math.abs(delta)>=4?'medium':'small');
}
function connectionPath(x1,y1,x2,y2){
  const middle=(x1+x2)/2;
  return `M ${x1} ${y1} C ${middle} ${y1}, ${middle} ${y2}, ${x2} ${y2}`;
}
function changeMark(current,final){
  const delta=positionChange(current,final);
  if(delta===null)return '<span class="compare-mark none" title="Final position not yet available" aria-label="Final position not yet available">—</span>';
  if(delta===0)return '<span class="compare-mark same" title="Finishes in the same position" aria-label="Same final position">=</span>';
  const cls=changeClass(delta);
  const explanation=delta>0?`Finishes ${delta} position${delta===1?'':'s'} higher`:`Finishes ${-delta} position${delta===-1?'':'s'} lower`;
  return `<span class="compare-mark ${cls}" title="${explanation}" aria-label="${explanation}">${delta>0?'↑':'↓'}${Math.abs(delta)}</span>`;
}
function movementMark(current,previous){
  if(!previous)return '<span class="movement-mark" title="No previous Gameweek">·</span>';
  const diff=previous-current;
  return diff>0?`<span class="movement-mark" title="Up ${diff} since previous Gameweek">↗${diff}</span>`:diff<0?`<span class="movement-mark" title="Down ${-diff} since previous Gameweek">↘${-diff}</span>`:'<span class="movement-mark" title="Position unchanged since previous Gameweek">·</span>';
}
function displayCell(column,team){const value=team[column.key];return value===null||value===undefined?'—':column.key==='gd'&&value>0?`+${value}`:String(value);}
function renderSeasonCard(season,data){
  const table=standings(data,state.week),finalTable=data.complete?standings(data,38):null;
  const finalPositions=new Map((finalTable||[]).map(x=>[x.name,x.pos]));
  const previousPositions=new Map((state.week>1?standings(data,state.week-1):[]).map(x=>[x.name,x.pos]));
  const cutoff=cutoffForWeek(data.fixtures,state.week);
  const playedWeeks=data.fixtures.filter(f=>f.played&&timeOf(f.date)<=Date.now()).map(f=>f.week);
  const latestWeek=playedWeeks.length?Math.max(...playedWeeks):0,isFuture=!data.complete&&state.week>latestWeek;
  const lastDate=latestPlayedDate(data);
  const badge=data.complete?'FINAL AVAILABLE':isFuture?'FUTURE GAMEWEEK':'IN PROGRESS';
  const columns=visibleColumns(),columnWidths=columns.reduce((sum,c)=>sum+c.width,0);
  const grid=`20px minmax(100px,1fr) ${columns.map(c=>`${c.width}px`).join(' ')}`;
  const cardWidth=20+100+columnWidths+18;
  const rows=table.map(team=>{
    const normalized=normalizeClub(team.name),compare=state.compare?changeMark(team.pos,finalPositions.get(team.name)):'',movement=state.movement?movementMark(team.pos,previousPositions.get(team.name)):'';
    const cls=team.pos===1?'pos-champion':team.pos<=4?'pos-european':team.pos>=18?'pos-relegation':'';
    const statCells=columns.map(col=>`<span class="stat-cell ${col.key==='pts'?'pts':''}" title="${escapeHtml(col.description)}: ${escapeHtml(displayCell(col,team))}">${escapeHtml(displayCell(col,team))}</span>`).join('');
    return `<div class="team-row ${cls}${state.selectedClub===normalized?' team-selected':''}" data-club="${escapeHtml(normalized)}" data-position="${team.pos}" data-name="${escapeHtml(clubShortName(team.name))}" role="button" aria-pressed="${state.selectedClub===normalized}" aria-label="Track ${escapeHtml(clubShortName(team.name))} across seasons" tabindex="0" title="Click to pin ${escapeHtml(team.name)} across seasons"><span class="pos">${team.pos}</span><span class="team-name">${clubBadge(team.name)}<span class="club-name">${escapeHtml(clubShortName(team.name))}</span><span class="marks">${compare}${movement}</span></span>${statCells}</div>`;
  }).join('');
  const cutoffLabel=Number.isFinite(cutoff)?new Date(cutoff-86400000).toISOString().slice(0,10):lastDate||'—';
  const header=columns.map(col=>`<span title="${escapeHtml(col.description)}">${escapeHtml(col.label)}</span>`).join('');
  const sourceInfo=data.statsAvailable?`${data.source} · stats ${data.statsAvailable}/380`:data.source;
  const extraStatus=data.discrepancies?` · ${data.discrepancies} unverified score mismatches`:'';
  return `<article class="season-card" data-season="${season}" style="--col-grid:${grid};--card-min:${cardWidth}px"><header class="season-card-header"><div class="season-title"><div class="topline">PREMIER LEAGUE</div><strong>${shortSeason(season)}</strong></div><div class="right"><span class="season-badge ${!data.complete?'current':''}">${badge}</span><span class="asof">${isFuture?'Latest results only':'As of '+cutoffLabel}</span></div></header><div class="table-head"><span>#</span><span>CLUB</span>${header}</div>${rows}<div class="table-footer"><span>${escapeHtml(sourceInfo+extraStatus)}</span><strong>${data.actualMatches} / 380 results</strong></div></article>`;
}
function renderLoading(seasons){$('tablesTrack').innerHTML=seasons.map(s=>`<article class="season-card loading-card">Loading ${shortSeason(s)}…</article>`).join('');}
function renderLegend(){
  $('comparisonLegend').innerHTML=state.compare?'<span class="comparison-key up-large">↑ 10+ gained</span><span class="comparison-key up-medium">↑ 4–9 gained</span><span class="comparison-key up-small">↑ 1–3 gained</span><span class="comparison-key down-small">↓ 1–3 lost</span><span class="comparison-key down-medium">↓ 4–9 lost</span><span class="comparison-key down-large">↓ 10+ lost</span><span class="comparison-key same">= No change</span>':'';
}
async function render(){
  const request=++currentRequest,seasons=activeSeasons();
  $('seasonCountLabel').textContent=`— ${seasons.length} ${seasons.length===1?'season':'seasons'}`;
  $('dataStatus').textContent='Loading results and reconstructing tables…';
  renderLegend();if($('tablesTrack').dataset.seasons!==seasons.join(',')){renderLoading(seasons);$('tablesTrack').dataset.seasons=seasons.join(',');}
  const results=await Promise.all(seasons.map(async season=>{try{return{season,data:await loadSeason(season)};}catch(error){return{season,error};}}));
  if(request!==currentRequest)return;
  $('tablesTrack').innerHTML=results.map(({season,data,error})=>error?`<article class="season-card error-card"><header class="season-card-header"><div class="season-title"><div class="topline">PREMIER LEAGUE</div><strong>${shortSeason(season)}</strong></div></header><div class="error-note"><strong>Couldn't load this season.</strong><p>${escapeHtml(error.message)}</p><p>Check your connection and refresh to retry.</p></div></article>`:renderSeasonCard(season,data)).join('');
  const loaded=results.filter(r=>r.data).length,failed=results.length-loaded;
  $('dataStatus').textContent=failed?`${loaded} seasons loaded • ${failed} failed to load.`:`Gameweek ${state.week} • ${loaded} seasons loaded • Based on played match results`;
  attachRowHover();
}
function attachRowHover(){
  const track=$('tablesTrack');
  const setFocus=(club,on)=>{track.querySelectorAll('.team-row').forEach(row=>{if(row.dataset.club===club)row.classList.toggle('team-focus',on);});};
  track.querySelectorAll('.team-row').forEach(el=>{
    el.addEventListener('mouseenter',()=>setFocus(el.dataset.club,true));
    el.addEventListener('mouseleave',()=>setFocus(el.dataset.club,false));
    el.addEventListener('focus',()=>setFocus(el.dataset.club,true));
    el.addEventListener('blur',()=>setFocus(el.dataset.club,false));
    const select=()=>selectClub(el.dataset.club,el.dataset.name);
    el.addEventListener('click',select);
    el.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();select();}});
  });
  track.querySelectorAll('.club-badge').forEach(img=>{img.addEventListener('error',()=>{img.hidden=true;img.nextElementSibling.hidden=false;},{once:true});});
  updateTracking();
}
function selectClub(club,name){
  if(state.selectedClub===club){state.selectedClub=null;state.selectedName='';}
  else {state.selectedClub=club;state.selectedName=name;}
  updateTracking();
}
function updateTracking(){
  document.querySelectorAll('.team-row').forEach(row=>{
    const selected=row.dataset.club===state.selectedClub;
    row.classList.toggle('team-selected',selected);row.setAttribute('aria-pressed',String(selected));
  });
  const selectedRows=[...document.querySelectorAll('.team-selected')];
  const total=document.querySelectorAll('.season-card[data-season]').length;
  $('trackingStatus').textContent=state.selectedClub?`Tracking ${state.selectedName} · ${selectedRows.length} of ${total} seasons`:'Click a club to pin it across seasons.';
  $('clearTracking').hidden=!state.selectedClub;
  $('connectionsToggle').disabled=!state.selectedClub;
  $('connectionsToggle').checked=state.connections;
  $('trackingNote').textContent=state.selectedClub&&state.connections?'Lines compare position from left to right at this Gameweek: green = higher, red/orange = lower. Gaps are left where the club is absent.':'Pin a club, then turn on connections to follow its position between neighboring seasons.';
  scheduleConnections();
}
function scheduleConnections(){
  if(connectionFrame)cancelAnimationFrame(connectionFrame);
  connectionFrame=requestAnimationFrame(()=>{connectionFrame=0;drawConnections();});
}
function drawConnections(){
  const track=$('tablesTrack');track.querySelector('.connection-overlay')?.remove();
  if(!state.connections||!state.selectedClub)return;
  const cards=[...track.querySelectorAll('.season-card')],origin=track.getBoundingClientRect();
  const paths=[];
  for(let i=0;i<cards.length-1;i++){
    const from=[...cards[i].querySelectorAll('.team-row')].find(r=>r.dataset.club===state.selectedClub);
    const to=[...cards[i+1].querySelectorAll('.team-row')].find(r=>r.dataset.club===state.selectedClub);
    if(!from||!to)continue;
    const a=from.getBoundingClientRect(),b=to.getBoundingClientRect(),left=cards[i].getBoundingClientRect(),right=cards[i+1].getBoundingClientRect();
    // Endpoints, control points, and arrowheads all stay strictly inside the inter-card gap.
    const x1=left.right-origin.left+4,x2=right.left-origin.left-4;
    if(x2<=x1)continue;
    const y1=a.top-origin.top+a.height/2,y2=b.top-origin.top+b.height/2;
    const delta=Number(from.dataset.position)-Number(to.dataset.position),cls=changeClass(delta),color=CHANGE_COLORS[cls];
    const label=`${state.selectedName}: ${cards[i].dataset.season} position ${from.dataset.position} to ${cards[i+1].dataset.season} position ${to.dataset.position}`;
    paths.push(`<defs><marker id="track-arrow-${i}" markerWidth="6" markerHeight="6" refX="6" refY="3" orient="auto" markerUnits="userSpaceOnUse"><path d="M0,0 L6,3 L0,6 Z" fill="${color}"/></marker></defs><path class="connection-line ${cls}" data-from="${cards[i].dataset.season}" data-to="${cards[i+1].dataset.season}" d="${connectionPath(x1,y1,x2,y2)}" fill="none" stroke="${color}" stroke-width="2.5" marker-end="url(#track-arrow-${i})"><title>${escapeHtml(label)}</title></path>`);
  }
  track.insertAdjacentHTML('beforeend',`<svg class="connection-overlay" role="img" aria-label="${escapeHtml(state.selectedName)} position connections across seasons" width="${track.scrollWidth}" height="${track.scrollHeight}" viewBox="0 0 ${track.scrollWidth} ${track.scrollHeight}">${paths.join('')}</svg>`);
}
function openTour(){
  stopPlay();tourFocus=document.activeElement;tourStep=0;renderTour();$('welcomeTour').showModal();
}
function renderTour(){
  $('tourStep').textContent=`QUICK TOUR · ${tourStep+1} OF 2`;
  $('tourTitle').textContent=tourStep===0?'Your table, your stats.':'Pin a club. Follow its story.';
  $('tourColumns').hidden=tourStep!==0;$('tourTracking').hidden=tourStep!==1;
  $('tourNext').textContent=tourStep===0?'Next →':'Got it';
  $('tourBack').hidden=tourStep===0;
  if(tourStep===0){
    $('tourColumnChecks').innerHTML=COLUMN_DEFS.map(c=>`<label><input type="checkbox" value="${c.key}" ${state.columns.includes(c.key)?'checked':''}><span class="column-code">${c.label}</span><span>${c.description}</span></label>`).join('');
    $('tourColumnChecks').querySelectorAll('input').forEach(el=>el.addEventListener('change',()=>{
      const cols=[...$('tourColumnChecks').querySelectorAll('input:checked')].map(x=>x.value);
      if(!cols.length){el.checked=true;return;}
      state.columns=cols;saveColumns();updateColumnPicker();render();
    }));
  }
}
function closeTour(){
  try{localStorage.setItem('tableTimeTourV1','seen');}catch(_){}
  $('welcomeTour').close();tourFocus?.focus?.();
}

function setWeek(next){const n=Math.min(38,Math.max(1,Number(next)||1));if(n===state.week)return;state.week=n;$('weekSlider').value=String(n);$('weekSelect').value=String(n);$('weekNumber').innerHTML=`${String(n).padStart(2,'0')} <span>/ 38</span>`;$('prevWeek').disabled=n===1;$('nextWeek').disabled=n===38;render();}
function stopPlay(){if(animationTimer!==null){clearInterval(animationTimer);animationTimer=null;}$('playButton').innerHTML='▶ <span>Play</span>';}
function togglePlay(){if(animationTimer!==null){stopPlay();return;}if(state.week===38)setWeek(1);$('playButton').innerHTML='Ⅱ <span>Pause</span>';animationTimer=setInterval(()=>{if(state.week>=38){stopPlay();return;}setWeek(state.week+1);},1150);}
function updatePicker(){
  const selected=activeSeasons();$('seasonChecks').innerHTML=SEASONS.map(season=>`<label><input type="checkbox" value="${season}" ${selected.includes(season)?'checked':''}> ${shortSeason(season)}</label>`).join('');
  $('seasonChecks').querySelectorAll('input').forEach(el=>el.addEventListener('change',()=>{
    const vals=[...$('seasonChecks').querySelectorAll('input:checked')].map(x=>x.value);
    if(!vals.length||vals.length>15){el.checked=!el.checked;return;}
    state.custom=vals;state.count=vals.length;$('seasonCount').value=String(state.count);stopPlay();render();
  }));
}
function updateColumnPicker(){
  $('columnChecks').innerHTML=COLUMN_DEFS.map(c=>`<label title="${escapeHtml(c.description)}"><input type="checkbox" value="${c.key}" ${state.columns.includes(c.key)?'checked':''}><span class="column-code">${escapeHtml(c.label)}</span><span>${escapeHtml(c.description)}</span></label>`).join('');
  $('columnChecks').querySelectorAll('input').forEach(el=>el.addEventListener('change',()=>{
    const cols=[...$('columnChecks').querySelectorAll('input:checked')].map(x=>x.value);
    if(cols.length===0){el.checked=true;return;}
    state.columns=cols;saveColumns();render();
  }));
}
function init(){
  for(let n=1;n<=15;n++)$('seasonCount').add(new Option(`${n} ${n===1?'season':'seasons'}`,String(n)));
  $('seasonCount').value='5';for(let n=1;n<=38;n++)$('weekSelect').add(new Option(`GW ${n}`,String(n)));
  $('weekSelect').value='1';$('prevWeek').disabled=true;
  $('seasonCount').addEventListener('change',()=>{state.count=Number($('seasonCount').value);state.custom=null;updatePicker();stopPlay();render();});
  $('weekSelect').addEventListener('change',event=>{stopPlay();setWeek(event.target.value);});
  $('weekSlider').addEventListener('input',event=>{stopPlay();setWeek(event.target.value);});
  $('prevWeek').addEventListener('click',()=>{stopPlay();setWeek(state.week-1);});
  $('nextWeek').addEventListener('click',()=>{stopPlay();setWeek(state.week+1);});
  $('compareToggle').addEventListener('change',event=>{state.compare=event.target.checked;render();});
  $('changeToggle').addEventListener('change',event=>{state.movement=event.target.checked;render();});
  $('playButton').addEventListener('click',togglePlay);
  $('chooseSeasons').addEventListener('click',()=>{const picker=$('seasonPicker');picker.hidden=!picker.hidden;$('chooseSeasons').setAttribute('aria-expanded',String(!picker.hidden));});
  $('resetSeasons').addEventListener('click',()=>{state.custom=null;updatePicker();render();});
  $('chooseColumns').addEventListener('click',()=>{const panel=$('columnsPanel');panel.hidden=!panel.hidden;$('chooseColumns').setAttribute('aria-expanded',String(!panel.hidden));});
  $('resetColumns').addEventListener('click',()=>{state.columns=COLUMN_DEFS.filter(c=>c.default).map(c=>c.key);saveColumns();updateColumnPicker();render();});
  $('helpButton').addEventListener('click',()=>{const about=$('aboutSection');about.hidden=!about.hidden;if(!about.hidden)about.scrollIntoView({behavior:'smooth',block:'nearest'});});
  document.addEventListener('keydown',event=>{if(['INPUT','SELECT','TEXTAREA','BUTTON'].includes(document.activeElement?.tagName))return;if(event.key==='ArrowLeft'){stopPlay();setWeek(state.week-1);}if(event.key==='ArrowRight'){stopPlay();setWeek(state.week+1);}});
  $('clearTracking').addEventListener('click',()=>{state.selectedClub=null;state.selectedName='';updateTracking();});
  $('connectionsToggle').addEventListener('change',event=>{state.connections=event.target.checked;scheduleConnections();updateTracking();});
  $('tourButton').addEventListener('click',openTour);
  $('tourNext').addEventListener('click',()=>{if(tourStep===0){tourStep=1;renderTour();$('tourNext').focus();}else closeTour();});
  $('tourBack').addEventListener('click',()=>{tourStep=0;renderTour();});
  $('tourSkip').addEventListener('click',closeTour);
  $('welcomeTour').addEventListener('cancel',event=>{event.preventDefault();closeTour();});
  document.addEventListener('visibilitychange',()=>{if(document.hidden)stopPlay();});
  window.addEventListener('blur',stopPlay);
  const sizeTables=()=>{const width=$('tablesViewport').clientWidth;$('tablesTrack').style.setProperty('--card-width',`${Math.max(205,(width-4*22)/5)}px`);scheduleConnections();};
  new ResizeObserver(sizeTables).observe($('tablesViewport'));
  $('tablesViewport').addEventListener('scroll',scheduleConnections,{passive:true});
  document.fonts?.ready.then(scheduleConnections);
  updatePicker();updateColumnPicker();sizeTables();render();
  let visited=false;try{visited=localStorage.getItem('tableTimeTourV1')==='seen';}catch(_){}
  if(!visited)openTour();
}
if(typeof document!=='undefined')init();
if(typeof module!=='undefined')module.exports={seasonKey,parseCSV,timeOf,cutoffForWeek,standings,normalizeClub,positionChange,changeClass,connectionPath,badgeUrl,changeMark,numberOrNull,enrichFixtures,optionalStatistics,visibleColumns,COLUMN_DEFS};

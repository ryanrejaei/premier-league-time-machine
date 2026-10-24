const assert=require('node:assert/strict');
const {parseCSV,standings,normalizeClub,cutoffForWeek,positionChange,changeClass,connectionPath,badgeUrl,changeMark,enrichFixtures,COLUMN_DEFS}=require('./app.js');
const rows=parseCSV('x,y,z\r\n"a,b","quoted ""thing""",42\r\n1,2,3\r\n');
assert.equal(rows.length,2);assert.equal(rows[0].x,'a,b');assert.equal(rows[0].y,'quoted "thing"');
assert.equal(normalizeClub('Manchester United FC'),normalizeClub('Man United'));
assert.equal(normalizeClub('Spurs'),normalizeClub('Tottenham Hotspur'));
assert.equal(normalizeClub('Bournemouth'),normalizeClub('AFC Bournemouth'));
assert.equal(normalizeClub('Leeds'),normalizeClub('Leeds United FC'));
const fixtures=[
 {week:1,date:'2025-08-10',home:'Arsenal',away:'Chelsea',hs:2,as:1,played:true,
  stats:{home:{yc:2,rc:0,shots:12,sot:5,corners:7,fouls:6},away:{yc:3,rc:1,shots:4,sot:2,corners:2,fouls:10}}},
 {week:1,date:'2025-08-11',home:'Liverpool',away:'Spurs',hs:1,as:1,played:true},
 {week:2,date:'2025-08-16',home:'Arsenal',away:'Liverpool',hs:0,as:3,played:true},
 {week:2,date:'2025-08-17',home:'Chelsea',away:'Spurs',hs:1,as:0,played:true}
];
const s=standings({teams:['Arsenal','Chelsea','Liverpool','Spurs'],fixtures},1);
assert.equal(s.length,4);assert.equal(s[0].name,'Arsenal');assert.equal(s[0].pts,3);assert.equal(s[0].p,1);
assert.equal(s[0].gf,2);assert.equal(s[0].ga,1);assert.equal(s[0].gd,1);assert.equal(s[0].yc,2);assert.equal(s[0].rc,0);
assert.equal(s.find(x=>x.name==='Spurs').yc,null);
const s2=standings({teams:['Arsenal','Chelsea','Liverpool','Spurs'],fixtures},38);
assert.equal(s2.find(x=>x.name==='Arsenal').p,2);
assert.equal(s2.find(x=>x.name==='Arsenal').yc,null,'partial stats must show missing rather than partial count');
assert(Number.isFinite(cutoffForWeek(fixtures,1)));assert.equal(cutoffForWeek(fixtures,38),Infinity);
assert.equal(positionChange(9,3),6);assert.equal(positionChange(2,4),-2);assert.equal(positionChange(2,2),0);assert.equal(positionChange(2,undefined),null);
assert.match(changeMark(9,3),/up-medium/);assert.match(changeMark(6,3),/up-small/);
assert.match(changeMark(2,5),/down-small/);assert.match(changeMark(1,5),/down-medium/);
assert.match(changeMark(2,2),/same/);assert.match(changeMark(2,undefined),/none/);
assert.deepEqual(COLUMN_DEFS.filter(c=>c.default).map(c=>c.key),['gd','pts']);
const extra=[{home:'Man United',away:'Leeds',date:'2025-08-15',hs:2,as:0,homeStats:{yc:1},awayStats:{yc:3}}];
const base=[{home:'Manchester United FC',away:'Leeds United FC',date:'2025-08-15',week:1,hs:null,as:null,played:false}];
assert.deepEqual(enrichFixtures(base,extra,{fillMissingScores:true}),{matched:1,filled:1,discrepancies:0});
assert.equal(base[0].played,true);assert.equal(base[0].stats.away.yc,3);
for(const [delta,expected] of [[-19,'down-large'],[-10,'down-large'],[-9,'down-medium'],[-4,'down-medium'],[-3,'down-small'],[-1,'down-small'],[0,'same'],[1,'up-small'],[3,'up-small'],[4,'up-medium'],[9,'up-medium'],[10,'up-large'],[19,'up-large']])assert.equal(changeClass(delta),expected);
assert.match(changeMark(15,5),/up-large/);assert.match(changeMark(1,11),/down-large/);
assert.equal(connectionPath(230,100,250,600),'M 230 100 C 240 100, 240 600, 250 600');
assert.equal(badgeUrl('Manchester United FC'),badgeUrl('Man Utd'));
assert.equal(badgeUrl('Leeds United FC'),badgeUrl('Leeds'));
assert.equal(badgeUrl('Unknown Club'),null);
console.log('Standings, missing statistics, compact defaults, all movement boundaries and gap-only path tests passed.');

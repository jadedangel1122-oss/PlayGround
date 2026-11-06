(() => {
  'use strict';
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const byId = id => document.getElementById(id);
  const ui = { coins:byId('coins'), health:byId('health-value'), healthFill:byId('health-fill'), bonus:byId('bonus-value'), wave:byId('wave-number'), waveLabel:byId('wave-label'), waveStatus:byId('wave-status'), kills:byId('kill-count'), banner:byId('wave-banner'), pauseLayer:byId('paused-overlay'), overLayer:byId('gameover-overlay'), toast:byId('toast') };
  const freshSave = { coins:0, dmg:0, ehp:0, bonus:0 };
  let save = freshSave;
  try { save={...freshSave,...JSON.parse(localStorage.getItem('midnightMunchies')||'{}')}; } catch (_) {}
  save.coins=Math.max(0,Number(save.coins)||0);
  for(const key of ['dmg','ehp','bonus'])save[key]=Math.max(0,Math.floor(Number(save[key])||0));
  const game={running:true,paused:false,over:false,wave:1,health:100,maxHealth:100,enemies:[],particles:[],bullets:[],kills:0,shots:0,elapsed:0,lastShot:0,spawnLeft:0,spawnTimer:.8,intermission:0,aim:null,pointer:null,firing:false,lastFrame:0,audio:true,audioContext:null,shake:0};
  const camera={pos:[0,10.5,19],target:[0,1.7,-.5],right:[1,0,0],up:[0,1,0],forward:[0,0,-1],focal:500};
  let width=0,height=0,dpr=1,toastTimer=0;
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const vec=(a,b)=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]];
  const dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
  const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
  const norm=a=>{const l=Math.hypot(...a)||1;return a.map(x=>x/l);};
  const project=p=>{const r=vec(p,camera.pos),z=dot(r,camera.forward);if(z<=.1)return null;return{x:width/2+dot(r,camera.right)*camera.focal/z,y:height*.53-dot(r,camera.up)*camera.focal/z,z,s:camera.focal/z};};
  const resize=()=>{const rect=canvas.getBoundingClientRect();if(!rect.width||!rect.height)return;width=rect.width;height=rect.height;dpr=Math.min(window.devicePixelRatio||1,1.6);canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);ctx.setTransform(dpr,0,0,dpr,0,0);camera.right=norm(cross(norm(vec(camera.target,camera.pos)),[0,1,0]));camera.forward=norm(vec(camera.target,camera.pos));camera.up=norm(cross(camera.right,camera.forward));camera.focal=height*1.18;};
  new ResizeObserver(resize).observe(canvas);
  const saveData=()=>{try{localStorage.setItem('midnightMunchies',JSON.stringify(save));}catch(_){}};
  const cost=key=>Math.round((key==='bonus'?50:10)*Math.pow(key==='bonus'?1.16:1.18,save[key]));
  const damage=()=>10+save.dmg*2, maxHealth=()=>100+save.ehp*20, multiplier=()=>1+save.bonus*.01;
  const popToast=text=>{ui.toast.textContent=text;ui.toast.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>ui.toast.classList.remove('show'),1550);};
  const fmt=n=>Number.isInteger(n)?String(n):n.toFixed(2).replace(/0+$/,'').replace(/\.$/,'');
  const updateUI=()=>{
    game.maxHealth=maxHealth();game.health=Math.min(game.health,game.maxHealth);
    ui.coins.textContent=fmt(save.coins);ui.health.textContent=Math.ceil(game.health);ui.healthFill.style.width=`${100*game.health/game.maxHealth}%`;ui.healthFill.style.background=game.health/game.maxHealth<.3?'#ff765e':'#e5ef80';ui.bonus.textContent=`${multiplier().toFixed(2)}×`;ui.kills.textContent=game.kills;
    ui.wave.textContent=String(game.wave).padStart(2,'0');ui.waveLabel.textContent=`WAVE ${String(game.wave).padStart(2,'0')}`;
    byId('dmg-level').textContent=save.dmg;byId('ehp-level').textContent=save.ehp;byId('bonus-level').textContent=save.bonus;
    byId('dmg-cost').textContent=cost('dmg');byId('ehp-cost').textContent=cost('ehp');byId('bonus-cost').textContent=cost('bonus');
    byId('dmg-stat').innerHTML=`${damage()} <i>→ ${damage()+2}</i>`;byId('ehp-stat').innerHTML=`${game.maxHealth} <i>→ ${game.maxHealth+20}</i>`;byId('bonus-stat').innerHTML=`${multiplier().toFixed(2)}× <i>→ ${(multiplier()+.01).toFixed(2)}×</i>`;
    document.querySelectorAll('[data-buy]').forEach(btn=>{const key=btn.dataset.buy,afford=save.coins+1e-8>=cost(key);btn.disabled=!afford||game.over;btn.closest('.upgrade-card').classList.toggle('unaffordable',!afford);});
  };
  const buy=key=>{
    if(save.coins+1e-8<cost(key)){popToast('Not quite enough coins, chef.');return;}
    save.coins=Math.max(0,Math.round((save.coins-cost(key))*100)/100);save[key]++;
    if(key==='ehp')game.health=Math.min(game.maxHealth+20,game.health+20);
    saveData();updateUI();const card=document.querySelector(`[data-upgrade="${key}"]`);card.classList.remove('pulse');void card.offsetWidth;card.classList.add('pulse');
    popToast(key==='dmg'?'Sharp! Damage upgraded.':key==='ehp'?'A tougher apron. +20 max health!':'More tips coming your way!');tone(560,.08,.045);
  };
  document.querySelectorAll('[data-buy]').forEach(btn=>btn.addEventListener('click',()=>buy(btn.dataset.buy)));
  const startWave=number=>{game.wave=number;game.spawnLeft=4+Math.min(number,8);game.spawnTimer=.45;game.intermission=0;ui.waveStatus.textContent='INCOMING...';ui.banner.innerHTML=`<span>✦</span><b>WAVE ${String(number).padStart(2,'0')}</b><small>HERE THEY COME!</small>`;ui.banner.classList.remove('show');void ui.banner.offsetWidth;ui.banner.classList.add('show');updateUI();};
  const spawnEnemy=()=>{const side=Math.floor(Math.random()*4),edge=7.3;let x=side===0?-edge:side===1?edge:(Math.random()-.5)*12;let z=side===2?-edge:side===3?5.2:-5+Math.random()*9;const hue=[268,286,250,320][Math.floor(Math.random()*4)];game.enemies.push({x,y:.62,z,hp:20+game.wave*3,maxHp:20+game.wave*3,speed:.55+Math.min(game.wave,12)*.045+Math.random()*.1,r:.4+Math.random()*.09,hue,phase:Math.random()*6.28,attack:0,hit:0,alive:true});};
  const nearestEnemy=(sx=width/2,sy=height*.5,radius=Infinity)=>{let best=null,dist=radius;for(const e of game.enemies)if(e.alive){const p=project([e.x,e.y,e.z]);if(!p)continue;const r=e.r*p.s*1.35,d=Math.hypot(p.x-sx,p.y-sy);if(d<Math.max(dist,r)){best=e;dist=d;}}return best;};
  const tone=(freq=420,dur=.08,vol=.025,type='sine')=>{if(!game.audio)return;try{const AC=window.AudioContext||window.webkitAudioContext;if(!AC)return;game.audioContext||=new AC();if(game.audioContext.state==='suspended')game.audioContext.resume();const osc=game.audioContext.createOscillator(),gain=game.audioContext.createGain();osc.type=type;osc.frequency.setValueAtTime(freq,game.audioContext.currentTime);gain.gain.setValueAtTime(vol,game.audioContext.currentTime);gain.gain.exponentialRampToValueAtTime(.001,game.audioContext.currentTime+dur);osc.connect(gain);gain.connect(game.audioContext.destination);osc.start();osc.stop(game.audioContext.currentTime+dur);}catch(_){}};
  const addBurst=(x,y,z,color,n=8)=>{for(let i=0;i<n;i++)game.particles.push({x,y,z,vx:(Math.random()-.5)*2.8,vy:Math.random()*2.2+.5,vz:(Math.random()-.5)*2.8,life:.45+Math.random()*.45,max:.9,color,size:.035+Math.random()*.07});};
  const shoot=()=>{if(game.over||game.paused)return;const e=game.aim&&game.aim.alive?game.aim:nearestEnemy();if(!e){tone(170,.045,.018,'triangle');return;}game.aim=e;e.hp-=damage();e.hit=.13;game.shots++;game.bullets.push({x:0,y:1.55,z:4.7,tx:e.x,ty:e.y,tz:e.z,life:.13,color:`hsl(${e.hue} 90% 75%)`});tone(520+Math.random()*100,.06,.025,'triangle');if(e.hp<=0){e.alive=false;game.kills++;const earned=Math.round(multiplier()*100)/100;save.coins=Math.round((save.coins+earned)*100)/100;saveData();addBurst(e.x,e.y,e.z,`hsl(${e.hue} 85% 72%)`,12);tone(760,.16,.035,'sine');updateUI();if(game.aim===e)game.aim=null;}};
  const fireButton=byId('fire-btn');
  const fireDown=e=>{e.preventDefault();game.firing=true;game.lastShot=0;shoot();fireButton.classList.add('pressed');};
  const fireUp=e=>{if(e)e.preventDefault();game.firing=false;fireButton.classList.remove('pressed');};
  fireButton.addEventListener('pointerdown',fireDown);['pointerup','pointercancel','pointerleave'].forEach(ev=>fireButton.addEventListener(ev,fireUp));
  canvas.addEventListener('pointerdown',e=>{if(game.over||game.paused)return;const rect=canvas.getBoundingClientRect();game.pointer={x:e.clientX-rect.left,y:e.clientY-rect.top};game.aim=nearestEnemy(game.pointer.x,game.pointer.y,68);game.firing=true;game.lastShot=0;shoot();try{canvas.setPointerCapture(e.pointerId);}catch(_){}});
  canvas.addEventListener('pointermove',e=>{const rect=canvas.getBoundingClientRect();game.pointer={x:e.clientX-rect.left,y:e.clientY-rect.top};if(game.firing&&e.buttons)game.aim=nearestEnemy(game.pointer.x,game.pointer.y,78)||game.aim;});
  ['pointerup','pointercancel','pointerleave'].forEach(ev=>canvas.addEventListener(ev,()=>{game.firing=false;}));

  const box=(x,y,z,w,h,d,color,top=lighten(color,1.2),side=lighten(color,.78))=>{
    const a=[x-w/2,y,z-d/2],b=[x+w/2,y,z-d/2],c=[x+w/2,y,z+d/2],q=[x-w/2,y,z+d/2];
    const A=[a[0],y+h,a[2]],B=[b[0],y+h,b[2]],C=[c[0],y+h,c[2]],D=[q[0],y+h,q[2]];
    poly([a,b,B,A],side);poly([b,c,C,B],lighten(color,.68));poly([q,D,C,c],side);poly([A,B,C,D],top);
  };
  const lighten=(hex,factor)=>{const n=parseInt(hex.slice(1),16),r=clamp(((n>>16)&255)*factor,0,255),g=clamp(((n>>8)&255)*factor,0,255),b=clamp((n&255)*factor,0,255);return`rgb(${r|0},${g|0},${b|0})`;};
  const poly=(pts,fill,stroke=null,line=1)=>{const p=pts.map(project);if(p.some(v=>!v))return;ctx.beginPath();ctx.moveTo(p[0].x,p[0].y);for(let i=1;i<p.length;i++)ctx.lineTo(p[i].x,p[i].y);ctx.closePath();ctx.fillStyle=fill;ctx.fill();if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=line;ctx.stroke();}};
  const line3=(a,b,color,width=1)=>{const p=project(a),q=project(b);if(!p||!q)return;ctx.beginPath();ctx.moveTo(p.x,p.y);ctx.lineTo(q.x,q.y);ctx.strokeStyle=color;ctx.lineWidth=width;ctx.stroke();};
  const sphere=(x,y,z,r,color,glow=false)=>{const p=project([x,y,z]);if(!p)return;const rad=Math.max(1,r*p.s);ctx.save();if(glow){ctx.shadowColor=color;ctx.shadowBlur=rad*.8;}const g=ctx.createRadialGradient(p.x-rad*.32,p.y-rad*.38,rad*.05,p.x,p.y,rad);g.addColorStop(0,'#ffffff');g.addColorStop(.14,color);g.addColorStop(.75,color);g.addColorStop(1,'#362f56');ctx.fillStyle=g;ctx.beginPath();ctx.ellipse(p.x,p.y,rad,rad*.92,0,0,Math.PI*2);ctx.fill();ctx.restore();return{x:p.x,y:p.y,r:rad};};
  const drawKitchen=time=>{
    const sky=ctx.createLinearGradient(0,0,0,height);sky.addColorStop(0,'#aac9b7');sky.addColorStop(.58,'#779f8e');sky.addColorStop(1,'#42695d');ctx.fillStyle=sky;ctx.fillRect(0,0,width,height);
    poly([[-10,0,-9],[10,0,-9],[10,0,8],[-10,0,8]],'#718f7e');
    for(let z=-8;z<8;z++)for(let x=-10;x<10;x++)if((x+z)%2===0)poly([[x,0,z],[x+1,0,z],[x+1,0,z+1],[x,0,z+1]],'#829e8c');
    for(let x=-10;x<=10;x++)line3([x,.008,-9],[x,.008,8],'#d0d5b8aa',.65);
    for(let z=-9;z<=8;z++)line3([-10,.008,z],[10,.008,z],'#d0d5b8aa',.65);
    poly([[-10,0,-9.2],[10,0,-9.2],[10,7,-9.2],[-10,7,-9.2]],'#d6cdb1');
    poly([[-10,3.8,-9.13],[10,3.8,-9.13],[10,7,-9.13],[-10,7,-9.13]],'#e3d8ba');
    for(let x=-9.5;x<10;x+=1.35){box(x,3.6,-8.6,1.22,1.7,.58,'#71876b','#a1ad7d','#667a65');line3([x+.02,3.8,-8.28],[x+.02,5.1,-8.28],'#d6d5aa',1);}
    box(-7.3,0,-7.55,2.1,4.7,1.35,'#9baba0','#d3d8c8','#71847b');box(-7.3,0,-6.84,1.78,1.8,.07,'#b8c5b7','#d7ddcb','#82988d');line3([-6.65,2.5,-6.79],[-6.65,3.6,-6.79],'#687c73',2);
    box(0,2.5,-7.48,18.3,.22,1.1,'#d0b38b','#e2cda7','#ad916f');box(0,0,-7.5,17.9,2.5,1.02,'#8e775e','#aa9474','#74634f');
    for(let x=-8.2;x<8.5;x+=1.5){box(x,.15,-6.92,1.25,2.12,.08,'#9f886c','#b39b7a','#83745d');sphere(x+.43,1.2,-6.82,.045,'#e1cf9b');}
    box(3.2,2.75,-7.12,2.1,.12,.74,'#46534d','#66756b','#37443e');
    for(let x of [2.65,3.75])for(let z of [-7.3,-6.94]){const p=project([x,2.84,z]);if(p){ctx.strokeStyle='#c2b991';ctx.lineWidth=2;ctx.beginPath();ctx.arc(p.x,p.y,p.s*.11,0,Math.PI*2);ctx.stroke();}}
    for(const x of [-4,0,4]){line3([x,6.6,-6.6],[x,5.8,-6.6],'#665f4e',1.5);sphere(x,5.72,-6.6,.19,'#ffecb3',true);const p=project([x,5.7,-6.6]);if(p){const glow=ctx.createRadialGradient(p.x,p.y,2,p.x,p.y,p.s*1.35);glow.addColorStop(0,'#ffe8a044');glow.addColorStop(1,'#ffe8a000');ctx.fillStyle=glow;ctx.fillRect(p.x-p.s*1.4,p.y-p.s*1.4,p.s*2.8,p.s*2.8);}}
    box(0,0,7.15,10.8,.34,1.05,'#725b46','#ab8862','#594b3d');for(let x=-4.5;x<=4.5;x+=.5)line3([x,.35,6.65],[x,.35,7.65],'#9c7d59',.5);
    box(-2.2,2.76,-6.92,1.35,.055,.58,'#d5af72','#edce91','#a88456');for(let x of [5.2,5.55,5.9])box(x,2.78,-7.02,.16,.34,.15,'#99a779','#b7c598','#758862');
  };
  const drawChef=time=>{
    const bob=Math.sin(time*5)*.045,x=0,z=5.25,shadow=project([x,.02,z]);
    if(shadow){ctx.fillStyle='#20362b45';ctx.beginPath();ctx.ellipse(shadow.x,shadow.y,shadow.s*.62,shadow.s*.18,0,0,Math.PI*2);ctx.fill();}
    box(x,.04,z,.67,.95,.48,'#d5ded2','#f8f6e8','#94a398');box(x,.06,z+.05,.71,.13,.5,'#465a4a','#667b54','#374a3e');sphere(x,1.2+bob,z,.31,'#dfaa83');
    const head=project([x,1.56+bob,z]);if(head){const r=head.s*.24;ctx.fillStyle='#f7f2de';ctx.beginPath();ctx.ellipse(head.x,head.y,r,r*.75,0,0,Math.PI*2);ctx.fill();ctx.beginPath();ctx.ellipse(head.x-r*.3,head.y-r*.35,r*.47,r*.48,0,0,Math.PI*2);ctx.ellipse(head.x+r*.3,head.y-r*.35,r*.47,r*.48,0,0,Math.PI*2);ctx.fill();ctx.fillRect(head.x-r*.8,head.y,r*1.6,r*.35);}
    const face=project([x,1.22+bob,z-.28]);if(face){ctx.fillStyle='#344038';ctx.beginPath();ctx.arc(face.x-face.s*.08,face.y,Math.max(1,face.s*.025),0,Math.PI*2);ctx.arc(face.x+face.s*.08,face.y,Math.max(1,face.s*.025),0,Math.PI*2);ctx.fill();}
  };
  const drawEnemy=(e,time)=>{
    const bob=Math.sin(time*4+e.phase)*.1,y=e.y+bob,shadow=project([e.x,.02,e.z]);if(shadow){ctx.fillStyle='#27312950';ctx.beginPath();ctx.ellipse(shadow.x,shadow.y,e.r*shadow.s*1.1,e.r*shadow.s*.27,0,0,Math.PI*2);ctx.fill();}
    const col=`hsl(${e.hue} 76% ${e.hit?86:65}%)`;const ball=sphere(e.x,y,e.z,e.r,col,true);if(!ball)return;
    const face=project([e.x,y,e.z-e.r*.74]);if(face){const eye=Math.max(1,face.s*.045),gap=face.s*.11;ctx.fillStyle='#28223a';ctx.beginPath();ctx.arc(face.x-gap,face.y,eye,0,Math.PI*2);ctx.arc(face.x+gap,face.y,eye,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#28223a';ctx.lineWidth=Math.max(1,face.s*.035);ctx.beginPath();ctx.arc(face.x,face.y+face.s*.085,face.s*.075,.15,Math.PI-.15);ctx.stroke();}
    const p=project([e.x,y+e.r+.24,e.z]);if(p&&e.hp<e.maxHp){const w=e.r*p.s*1.5,h=3;ctx.fillStyle='#142323b8';ctx.fillRect(p.x-w/2,p.y,w,h);ctx.fillStyle='#e7ea8a';ctx.fillRect(p.x-w/2,p.y,w*clamp(e.hp/e.maxHp,0,1),h);}
    if(game.aim===e){const p2=project([e.x,y,e.z]);if(p2){ctx.strokeStyle='#e4f48a';ctx.lineWidth=1.5;ctx.beginPath();ctx.arc(p2.x,p2.y,e.r*p2.s*1.45,0,Math.PI*2);ctx.stroke();}}
  };
  const render=time=>{
    if(!width||!height)return;ctx.save();if(game.shake>0){ctx.translate((Math.random()-.5)*game.shake,(Math.random()-.5)*game.shake);game.shake*=.85;}drawKitchen(time);
    for(const e of [...game.enemies].filter(e=>e.alive).sort((a,b)=>a.z-b.z))drawEnemy(e,time);
    for(const p of game.particles){const q=project([p.x,p.y,p.z]);if(q){ctx.globalAlpha=clamp(p.life/p.max,0,1);ctx.fillStyle=p.color;ctx.beginPath();ctx.arc(q.x,q.y,Math.max(1,p.size*q.s),0,Math.PI*2);ctx.fill();}}
    ctx.globalAlpha=1;drawChef(time);
    for(const b of game.bullets){const t=1-b.life/.13,p=project([b.x+(b.tx-b.x)*t,b.y+(b.ty-b.y)*t,b.z+(b.tz-b.z)*t]);if(p){ctx.strokeStyle=b.color;ctx.lineWidth=3;ctx.shadowColor=b.color;ctx.shadowBlur=9;ctx.beginPath();ctx.arc(p.x,p.y,3,0,Math.PI*2);ctx.stroke();ctx.shadowBlur=0;}}
    if(game.pointer&&!game.firing&&!game.over){const e=nearestEnemy(game.pointer.x,game.pointer.y,68),p=e?project([e.x,e.y,e.z]):game.pointer;if(p){ctx.strokeStyle='#e8f38a';ctx.lineWidth=1.2;ctx.beginPath();ctx.arc(p.x,p.y,10,0,Math.PI*2);ctx.moveTo(p.x-15,p.y);ctx.lineTo(p.x-5,p.y);ctx.moveTo(p.x+5,p.y);ctx.lineTo(p.x+15,p.y);ctx.moveTo(p.x,p.y-15);ctx.lineTo(p.x,p.y-5);ctx.moveTo(p.x,p.y+5);ctx.lineTo(p.x,p.y+15);ctx.stroke();}}
    ctx.restore();
  };

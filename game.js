(() => {
  const canvas = document.getElementById('gameCanvas');
  const ctx = canvas.getContext('2d');

  const scoreEl = document.getElementById('score');
  const highEl  = document.getElementById('highscore');
  const retryBtn= document.getElementById('retryButton');

  const W = canvas.width;
  const H = canvas.height;

  const groundH = 60;
  const gravity = 0.5;
  const jumpV   = -10.5;
  const baseSpeed = 2.4;
  const maxSpeed  = 7;
  const speedGain = 0.08;
  const speedEveryMs = 1500;

  const maxHoldMs = 110;
  const holdThrust = -0.22;
  const jumpBoostMax = 22;
  const jumpBoostAccel = -0.42;
  let spaceHeld = false;
  let holdMs = 0;
  let boostMs = 0;

  const player = {
    x: 100, y: H - groundH - 40, w: 36, h: 36, vy: 0, onGround: true,
    color1: '#ffeb3b', color2: '#ff9f43', rot: 0
  };

  let obstacles = [];
  let lastSpawn = 0;
  let nextGap = 1500;
  let speed = baseSpeed;
  let score = 0;
  let high = Number(localStorage.getItem('runner_high') || 0);
  highEl.textContent = high;

  let running = false;
  let lastTs = 0;
  let accelTimer = 0;
  let bgOffset = 0;

  function jump() {
    if (!running) return;
    if (player.onGround) {
      player.vy = jumpV;
      player.onGround = false;
      holdMs = 0;
      boostMs = 0;
    }
  }

document.addEventListener('keydown', (e) => {
    // リトライ表示中は Enter / Space で即スタート
    if (!running && (e.code === 'Enter' || e.code === 'Space')) {
      e.preventDefault();
      startGame();
      return;
    }
    if (e.code === 'Space') { e.preventDefault(); if (!spaceHeld) jump(); spaceHeld = true; }
  });
  document.addEventListener('keyup', (e) => {
    if (e.code === 'Space') spaceHeld = false;
  });

  canvas.addEventListener('pointerdown', () => { if (!spaceHeld) jump(); spaceHeld = true; });
  window.addEventListener('pointerup',   () => { spaceHeld = false; });

// クリックより先に反応（モバイルの300ms遅延対策）
  retryBtn.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!running) startGame();
  });

  function rand(min, max){ return Math.random() * (max - min) + min; }

  function maybeSpawn(ts) {
    if (ts - lastSpawn >= nextGap) {
      const w = rand(26, 36);
      const h = rand(24, 40);
      obstacles.push({
        x: W + 20,
        y: H - groundH - h,
        w,
        h,
        hue: Math.floor(rand(180, 330)),
        roof: Math.floor(rand(16, 28))
      });
      lastSpawn = ts;
      const baseGap = 1500;
      const minGap  = 900;
      nextGap = Math.max(minGap, baseGap - (speed - baseSpeed) * 30 + rand(-80, 80));
    }
  }

  function hit(a, b){
    return a.x < b.x + b.w &&
           a.x + a.w > b.x &&
           a.y < b.y + b.h &&
           a.y + a.h > b.y;
  }

  function setScore(s){
    score = s;
    if (score > high){ high = score; localStorage.setItem('runner_high', high); }
    scoreEl.textContent = score;
    highEl.textContent  = high;
  }

  function drawBackground(offset){
    ctx.clearRect(0,0,W,H);

    const skyGrad = ctx.createLinearGradient(0,0,0,H);
    skyGrad.addColorStop(0, '#8fd3fe');
    skyGrad.addColorStop(1, '#e0f7ff');
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0,0,W,H);

    const farSpeed = 0.12;
    ctx.fillStyle = '#b3e5fc';
    for (let x=-240; x < W+240; x+=480){
      const bx = (x - (offset * farSpeed) % 480);
      ctx.beginPath();
      ctx.moveTo(bx, H - groundH);
      ctx.lineTo(bx+120, H - groundH - 95);
      ctx.lineTo(bx+240, H - groundH);
      ctx.closePath();
      ctx.fill();
    }

    const midSpeed = 0.22;
    for (let x=-220; x < W+220; x+=440){
      const bx = (x - (offset * midSpeed) % 440);
      ctx.fillStyle = '#90caf9';
      ctx.beginPath();
      ctx.moveTo(bx, H - groundH);
      ctx.lineTo(bx+110, H - groundH - 70);
      ctx.lineTo(bx+220, H - groundH);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.moveTo(bx+110, H - groundH - 70);
      ctx.lineTo(bx+80,  H - groundH - 50);
      ctx.lineTo(bx+140, H - groundH - 50);
      ctx.closePath();
      ctx.fill();
    }

    const cloud = (cx, cy, r) => {
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI*2);
      ctx.arc(cx+r*0.9, cy+r*0.2, r*0.8, 0, Math.PI*2);
      ctx.arc(cx-r*0.9, cy+r*0.2, r*0.7, 0, Math.PI*2);
      ctx.fill();
    };
    const cloudFar = 0.08;
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    for (let x=-180; x < W+180; x+=360){
      const cx = (x - (offset * cloudFar) % 360);
      cloud(cx, 70, 22);
    }
    const cloudNear = 0.18;
    ctx.fillStyle = 'rgba(255,255,255,0.95)';
    for (let x=-220; x < W+220; x+=440){
      const cx = (x - (offset * cloudNear) % 440);
      cloud(cx, 45, 18);
    }

    ctx.fillStyle = '#6fcf97';
    ctx.fillRect(0, H - groundH, W, groundH);
  }

  function drawPlayer(){
    const {x,y,w,h,rot} = player;
    ctx.save();
    ctx.translate(x + w/2, y + h/2);
    ctx.rotate(rot);

    // ニコちゃん本体
    const grad = ctx.createRadialGradient(0,0,w*0.1, 0,0,w/2);
    grad.addColorStop(0, player.color1);
    grad.addColorStop(1, player.color2);
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(0, 0, w/2, 0, Math.PI*2);
    ctx.fill();

    // 目
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.arc(-w*0.18, -h*0.15, w*0.07, 0, Math.PI*2);
    ctx.arc(w*0.18, -h*0.15, w*0.07, 0, Math.PI*2);
    ctx.fill();

    // 口
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, w*0.22, 0.15*Math.PI, 0.85*Math.PI);
    ctx.stroke();

    ctx.restore();
  }

  function drawObstacles(){
    obstacles.forEach(o=>{
      const bx = o.x, by = o.y, w = o.w, h = o.h;
      const roofH = o.roof || 20;
      const wallHue = o.hue;
      const roofHue = (o.hue + 20) % 360;

      ctx.fillStyle = `hsl(${wallHue} 70% 70%)`;
      ctx.fillRect(bx, by, w, h);
      ctx.strokeStyle = 'rgba(0,0,0,0.18)';
      ctx.lineWidth = 2;
      ctx.strokeRect(bx+0.5, by+0.5, w-1, h-1);

      ctx.fillStyle = `hsl(${roofHue} 65% 45%)`;
      ctx.beginPath();
      ctx.moveTo(bx - 4, by);
      ctx.lineTo(bx + w + 4, by);
      ctx.lineTo(bx + w/2, by - roofH);
      ctx.closePath();
      ctx.fill();

      const doorW = Math.max(8, Math.floor(w * 0.28));
      const doorH = Math.min(Math.floor(h * 0.55), 28);
      const dx = Math.floor(bx + w * 0.12);
      const dy = Math.floor(by + h - doorH);
      ctx.fillStyle = `hsl(${(roofHue+10)%360} 45% 35%)`;
      ctx.fillRect(dx, dy, doorW, doorH);
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.beginPath();
      ctx.arc(dx + doorW - 3, dy + Math.floor(doorH*0.55), 1.5, 0, Math.PI*2);
      ctx.fill();

      const win = Math.max(8, Math.floor(w * 0.28));
      const wx = Math.floor(bx + w - win - w*0.12);
      const wy = Math.floor(by + Math.max(4, h*0.18));
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      ctx.fillRect(wx, wy, win, win);
      ctx.strokeStyle = 'rgba(0,0,0,0.12)';
      ctx.strokeRect(wx+0.5, wy+0.5, win-1, win-1);
      ctx.beginPath();
      ctx.moveTo(wx, wy + win/2);
      ctx.lineTo(wx + win, wy + win/2);
      ctx.moveTo(wx + win/2, wy);
      ctx.lineTo(wx + win/2, wy + win);
      ctx.stroke();
    });
  }

  function update(dt, ts){
    if (!player.onGround && spaceHeld && holdMs < maxHoldMs && player.vy < 0) {
      const factor = Math.min(maxHoldMs - holdMs, dt);
      player.vy += (holdThrust * (factor / 16));
      holdMs += dt;
    }
    if (!player.onGround && boostMs < jumpBoostMax) {
      const factor = Math.min(jumpBoostMax - boostMs, dt);
      player.vy += (jumpBoostAccel * (factor / 16));
      boostMs += dt;
    }
    player.vy += gravity;
    player.y  += player.vy;

    const ceilingY = Math.floor(H * 0.25);
    if (player.y < ceilingY) {
      player.y = ceilingY + 1;
      if (player.vy < 0) player.vy = 0;
      boostMs = jumpBoostMax;
      holdMs  = maxHoldMs;
      spaceHeld = false;
    }

    if (player.y + player.h >= H - groundH){
      player.y = H - groundH - player.h;
      player.vy = 0;
      player.onGround = true;
      holdMs = 0;
      boostMs = 0;
    } else {
      player.onGround = false;
    }

    player.rot += (player.onGround ? speed/50 : 0.02);

    obstacles.forEach(o => { o.x -= speed; });
    for (let i=obstacles.length-1; i>=0; i--){
      if (obstacles[i].x + obstacles[i].w < 0){
        obstacles.splice(i,1);
        setScore(score + 1);
      }
    }

    maybeSpawn(ts);
    const pInset = 4;
    const pBox = {x:player.x + pInset, y:player.y + pInset, w:player.w - pInset*2, h:player.h - pInset*2};
    for (const o of obstacles){
      if (hit(pBox, o)) { endGame(); break; }
    }

    accelTimer += dt;
    if (accelTimer >= speedEveryMs){
      accelTimer = 0;
      speed = Math.min(maxSpeed, speed + speedGain);
    }
  }

  function render(offset){
    drawBackground(offset);
    drawObstacles();
    drawPlayer();
  }

  function loop(ts){
    if (!running){ return; }
    if (!lastTs) lastTs = ts;
    const dt = ts - lastTs;
    lastTs = ts;
    update(dt, ts);
    bgOffset += dt * 0.06 * (speed + 1);
    render(bgOffset);
    requestAnimationFrame(loop);
  }

  function startGame(){
    running = true;
    lastTs = 0;
    accelTimer = 0;
    speed = baseSpeed;
    setScore(0);
    player.y  = H - groundH - player.h;
    player.vy = 0;
    player.onGround = true;
    player.rot = 0;
    obstacles = [];
    lastSpawn = 0;
    nextGap = 1500;
    retryBtn.style.display = 'none';
    requestAnimationFrame(loop);
  }

  function endGame(){
    running = false;
    retryBtn.style.display = 'block';
  }

  startGame();
})();

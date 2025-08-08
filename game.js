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
    color1: '#ffeb3b', color2: '#ff9f43'
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
  let bgOffset = 0; // 背景スクロール用の累積オフセット（ms換算）

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
    if (e.code === 'Space') { e.preventDefault(); if (!spaceHeld) jump(); spaceHeld = true; }
  });
  document.addEventListener('keyup', (e) => {
    if (e.code === 'Space') spaceHeld = false;
  });

  canvas.addEventListener('pointerdown', () => { if (!spaceHeld) jump(); spaceHeld = true; });
  window.addEventListener('pointerup',   () => { spaceHeld = false; });

  retryBtn.addEventListener('click', startGame);

  function rand(min, max){ return Math.random() * (max - min) + min; }

  function maybeSpawn(ts) {
    if (ts - lastSpawn >= nextGap) {
      const w = rand(26, 36);
      const h = rand(24, 40);
      obstacles.push({
        x: W + 20,
        y: H - groundH - h,
        w, h,
        hue: Math.floor(rand(180, 330))
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

    // 空
    const skyGrad = ctx.createLinearGradient(0,0,0,H);
    skyGrad.addColorStop(0, '#8fd3fe');
    skyGrad.addColorStop(1, '#e0f7ff');
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0,0,W,H);

    // ===== パララックス：遠景の山（最も遅い） =====
    const farSpeed = 0.12;
    ctx.fillStyle = '#b3e5fc';
    for (let x=-240; x < W+240; x+=240){
      const bx = (x - (offset * farSpeed) % 240);
      ctx.beginPath();
      ctx.moveTo(bx, H - groundH);
      ctx.lineTo(bx+120, H - groundH - 95);
      ctx.lineTo(bx+240, H - groundH);
      ctx.closePath();
      ctx.fill();
    }

    // 中景の山（雪化粧、少し速い）
    const midSpeed = 0.22;
    for (let x=-220; x < W+220; x+=220){
      const bx = (x - (offset * midSpeed) % 220);
      // 本体
      ctx.fillStyle = '#90caf9';
      ctx.beginPath();
      ctx.moveTo(bx, H - groundH);
      ctx.lineTo(bx+110, H - groundH - 70);
      ctx.lineTo(bx+220, H - groundH);
      ctx.closePath();
      ctx.fill();
      // 雪
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.moveTo(bx+110, H - groundH - 70);
      ctx.lineTo(bx+80,  H - groundH - 50);
      ctx.lineTo(bx+140, H - groundH - 50);
      ctx.closePath();
      ctx.fill();
    }

    // 近景の丘（最も速い）
    const nearSpeed = 0.38;
    ctx.fillStyle = '#64b5f6';
    for (let x=-200; x < W+200; x+=200){
      const bx = (x - (offset * nearSpeed) % 200);
      ctx.beginPath();
      ctx.moveTo(bx, H - groundH);
      ctx.quadraticCurveTo(bx+50, H - groundH - 35, bx+100, H - groundH);
      ctx.quadraticCurveTo(bx+150, H - groundH - 35, bx+200, H - groundH);
      ctx.closePath();
      ctx.fill();
    }

    // ===== パララックス：雲（2レイヤー） =====
    const cloud = (cx, cy, r) => {
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI*2);
      ctx.arc(cx+r*0.9, cy+r*0.2, r*0.8, 0, Math.PI*2);
      ctx.arc(cx-r*0.9, cy+r*0.2, r*0.7, 0, Math.PI*2);
      ctx.fill();
    };

    // 遠い雲（ゆっくり）
    const cloudFar = 0.08;
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    for (let x=-180; x < W+180; x+=180){
      const cx = (x - (offset * cloudFar) % 180);
      cloud(cx, 70, 22);
    }
    // 近い雲（少し速い）
    const cloudNear = 0.18;
    ctx.fillStyle = 'rgba(255,255,255,0.95)';
    for (let x=-220; x < W+220; x+=220){
      const cx = (x - (offset * cloudNear) % 220);
      cloud(cx, 45, 18);
    }

    // 地面（芝 + 走査ストライプ）
    const grdY = H - groundH;
    ctx.fillStyle = '#6fcf97';
    ctx.fillRect(0, grdY, W, groundH);
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, grdY, W, groundH);
    ctx.clip();
    ctx.fillStyle = '#58d5c9';
    const stripeSpeed = 0.6;
    for (let x=-60; x < W+60; x+=30){
      const sx = (x - (offset * stripeSpeed) % 30);
      ctx.fillRect(sx, grdY, 12, groundH);
    }
    ctx.restore();
  }

    // 山（パララックス: 中）
    ctx.fillStyle = '#8d6e63';
    for (let i = 0; i < 3; i++) {
      const mx = (offset * 0.05 + i * 300) % (W + 300) - 150;
      ctx.beginPath();
      ctx.moveTo(mx, H - groundH);
      ctx.lineTo(mx + 200, H - groundH);
      ctx.lineTo(mx + 100, H - groundH - 150);
      ctx.closePath();
      ctx.fill();
    }

    // 手前の低い丘（パララックス: 速い）
    ctx.fillStyle = '#a5d6a7';
    for (let i = 0; i < 5; i++) {
      const hx = (offset * 0.2 + i * 160) % (W + 200) - 100;
      ctx.beginPath();
      ctx.moveTo(hx, H - groundH);
      ctx.quadraticCurveTo(hx + 40, H - groundH - 30, hx + 80, H - groundH);
      ctx.closePath();
      ctx.fill();
    }

    // 地面
    ctx.fillStyle = '#6fcf97';
    ctx.fillRect(0, H - groundH, W, groundH);
  }

  function drawPlayer(){
    const {x,y,w,h} = player;
    const grad = ctx.createLinearGradient(x, y, x+w, y+h);
    grad.addColorStop(0, player.color1);
    grad.addColorStop(1, player.color2);
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(x + w/2, y + h/2, w/2, 0, Math.PI*2);
    ctx.fill();
  }

  function drawObstacles(){
    obstacles.forEach(o=>{
      const grad = ctx.createLinearGradient(o.x, o.y, o.x+o.w, o.y+o.h);
      grad.addColorStop(0, `hsl(${o.hue} 80% 60%)`);
      grad.addColorStop(1, `hsl(${(o.hue+40)%360} 75% 45%)`);
      ctx.fillStyle = grad;
      ctx.fillRect(o.x, o.y, o.w, o.h);
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
    }

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
    bgOffset += dt * 0.06 * (speed + 1); // dtはms。+1で低速時も動く
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

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
  const jumpV   = -12; // 高さを7割程度に抑えるため弱め
  const baseSpeed = 2.4;
  const maxSpeed  = 7;
  const speedGain = 0.08;
  const speedEveryMs = 1500;

  const maxHoldMs = 150;
  const holdThrust = -0.3;
  const jumpBoostMax = 40;
  const jumpBoostAccel = -0.6;
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
    const skyGrad = ctx.createLinearGradient(0,0,0,H);
    skyGrad.addColorStop(0, '#9be7ff');
    skyGrad.addColorStop(1, '#e1f5fe');
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0,0,W,H);
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

    // ---- 上限（キャンバス高さの約7割）で頭打ち ----
    const ceilingY = Math.floor(H * 0.30); // 上から30%
    if (player.y < ceilingY) {
      player.y = ceilingY;
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
    render(performance.now() * (speed * 0.5));
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

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
  const jumpV   = -14;   // ジャンプ力を上げる
  const baseSpeed = 2.4;
  const maxSpeed  = 7;
  const speedGain = 0.08;
  const speedEveryMs = 1500;

  const player = {
    x: 100, y: H - groundH - 40, w: 36, h: 36, vy: 0, onGround: true,
    color1: '#ffeb3b', color2: '#ff9f43'
  };

  let obstacles = [];
  let lastSpawn = 0;
  let nextGap = 1400;
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
    }
  }
  document.addEventListener('keydown', (e) => {
    if (e.code === 'Space') { e.preventDefault(); jump(); }
  });
  canvas.addEventListener('click', jump);

  retryBtn.addEventListener('click', startGame);

  function rand(min, max){ return Math.random() * (max - min) + min; }

  function maybeSpawn(ts) {
    if (ts - lastSpawn >= nextGap) {
      const w = rand(28, 40);
      const h = rand(36, 50);
      obstacles.push({
        x: W + 20,
        y: H - groundH - h,
        w, h,
        hue: Math.floor(rand(180, 330))
      });
      lastSpawn = ts;

      const baseGap = 1400;
      const minGap  = 800;
      nextGap = Math.max(minGap, baseGap - (speed - baseSpeed) * 40 + rand(-60, 60));
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
    ctx.fillStyle = '#b3e5fc';
    const m1Speed = 0.15;
    for (let x=-200; x < W+200; x+=220){
      const bx = (x - (offset * m1Speed) % 220);
      ctx.beginPath();
      ctx.moveTo(bx, H - groundH);
      ctx.lineTo(bx+110, H - groundH - 90);
      ctx.lineTo(bx+220, H - groundH);
      ctx.closePath();
      ctx.fill();
    }
    ctx.fillStyle = '#81d4fa';
    const m2Speed = 0.3;
    for (let x=-200; x < W+200; x+=200){
      const bx = (x - (offset * m2Speed) % 200);
      ctx.beginPath();
      ctx.moveTo(bx, H - groundH);
      ctx.lineTo(bx+100, H - groundH - 60);
      ctx.lineTo(bx+200, H - groundH);
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
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    const c1Speed = 0.1;
    for (let x=-150; x < W+150; x+=180){
      const cx = (x - (offset * c1Speed) % 180);
      cloud(cx, 90, 24);
    }
    ctx.fillStyle = 'rgba(255,255,255,0.95)';
    const c2Speed = 0.2;
    for (let x=-200; x < W+200; x+=220){
      const cx = (x - (offset * c2Speed) % 220);
      cloud(cx, 55, 18);
    }
    const grdY = H - groundH;
    ctx.fillStyle = '#6fcf97';
    ctx.fillRect(0, grdY, W, groundH);
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, grdY, W, groundH);
    ctx.clip();
    const stripeSpeed = 0.8;
    ctx.fillStyle = '#58d5c9';
    for (let x=-60; x < W+60; x+=30){
      const sx = (x - (offset * stripeSpeed) % 30);
      ctx.fillRect(sx, grdY, 12, groundH);
    }
    ctx.restore();
  }

  function drawPlayer(){
    const {x,y,w,h} = player;
    const grad = ctx.createLinearGradient(x, y, x+w, y+h);
    grad.addColorStop(0, player.color1);
    grad.addColorStop(1, player.color2);
    ctx.fillStyle = grad;
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = 'rgba(0,0,0,0.15)';
    ctx.lineWidth = 2;
    ctx.strokeRect(x+0.5, y+0.5, w-1, h-1);
  }

  function drawObstacles(){
    obstacles.forEach(o=>{
      const grad = ctx.createLinearGradient(o.x, o.y, o.x+o.w, o.y+o.h);
      grad.addColorStop(0, `hsl(${o.hue} 80% 60%)`);
      grad.addColorStop(1, `hsl(${(o.hue+40)%360} 75% 45%)`);
      ctx.fillStyle = grad;
      ctx.fillRect(o.x, o.y, o.w, o.h);
      ctx.strokeStyle = 'rgba(0,0,0,0.18)';
      ctx.lineWidth = 2;
      ctx.strokeRect(o.x+0.5, o.y+0.5, o.w-1, o.h-1);
    });
  }

  function update(dt, ts){
    player.vy += gravity;
    player.y  += player.vy;
    if (player.y + player.h >= H - groundH){
      player.y = H - groundH - player.h;
      player.vy = 0;
      player.onGround = true;
    }
    obstacles.forEach(o => { o.x -= speed; });
    for (let i=obstacles.length-1; i>=0; i--){
      if (obstacles[i].x + obstacles[i].w < 0){
        obstacles.splice(i,1);
        setScore(score + 1);
      }
    }
    maybeSpawn(ts);
    const pBox = {x:player.x, y:player.y, w:player.w, h:player.h};
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
    nextGap = 1400;
    retryBtn.style.display = 'none';
    requestAnimationFrame(loop);
  }

  function endGame(){
    running = false;
    retryBtn.style.display = 'block';
  }

  startGame();
})();

const character = document.getElementById('character');
const gameArea  = document.getElementById('gameArea');
const retryBtn  = document.getElementById('retryButton');
const scoreDisplay = document.getElementById('score');

let isJumping = false;
let score = 0;
let highScore = Number(localStorage.getItem('highScore')) || 0;
let speed = 3;                // 障害物の移動速度
let obstacles = [];
let loopId;
let speedId;

function safeBottom() {
  // style.bottom が未設定のときNaNにならないように
  const v = parseInt(getComputedStyle(character).bottom, 10);
  return Number.isNaN(v) ? 0 : v;
}

function updateScore() {
  if (score > highScore) {
    highScore = score;
    localStorage.setItem('highScore', highScore);
  }
  scoreDisplay.textContent = `Score: ${score} | High Score: ${highScore}`;
}

function jump() {
  if (isJumping) return;
  isJumping = true;

  let position = safeBottom();      // 現在の高さから
  const maxJump = 150;              // 誰でも遊べるよう控えめ
  const upTimer = setInterval(() => {
    if (position >= maxJump) {
      clearInterval(upTimer);
      const downTimer = setInterval(() => {
        position -= 5;
        if (position <= 0) {
          position = 0;
          clearInterval(downTimer);
          isJumping = false;
        }
        character.style.bottom = position + 'px';
      }, 16);
    } else {
      position += 6;
      character.style.bottom = position + 'px';
    }
  }, 16);
}

function createObstacle() {
  const obstacle = document.createElement('div');
  obstacle.className = 'obstacle';
  const h = 40 + Math.floor(Math.random() * 40); // 高さランダム
  obstacle.style.height = `${h}px`;
  let obstaclePos = gameArea.clientWidth;
  obstacle.style.left = obstaclePos + 'px';
  gameArea.appendChild(obstacle);
  obstacles.push(obstacle);
}

function moveObstacles() {
  for (let i = 0; i < obstacles.length; i++) {
    const obs = obstacles[i];
    let left = parseInt(obs.style.left, 10);
    left -= speed;
    obs.style.left = left + 'px';

    // 画面外に出たら削除＆スコア加算
    if (left < -60) {
      obs.remove();
      obstacles.splice(i, 1);
      i--;
      score++;
      updateScore();
      continue;
    }

    // 簡易当たり判定
    const charX = 60, charW = 40;
    const obsW = obs.offsetWidth;
    const overlapX = (left < charX + charW) && (left + obsW > charX);
    const overlapY = (safeBottom() < obs.offsetHeight);
    if (overlapX && overlapY) {
      endGame();
    }
  }

  // ランダム生成（間隔が近すぎないよう控えめ）
  if (Math.random() < 0.02) createObstacle();
}

function increaseSpeed() {
  // なだらかに加速（遊びやすさ優先）
  if (speed < 10) speed += 0.15;
}

function loop() {
  moveObstacles();
  loopId = requestAnimationFrame(loop);
}

function startGame() {
  // 初期化
  score = 0;
  speed = 3;
  updateScore();

  // 既存の障害物を撤去
  obstacles.forEach(o => o.remove());
  obstacles = [];

  // キャラ位置リセット
  character.style.bottom = '0px';

  // UI
  retryBtn.style.display = 'none';

  // ループ開始
  loopId = requestAnimationFrame(loop);
  speedId = setInterval(increaseSpeed, 1000);
}

function endGame() {
  cancelAnimationFrame(loopId);
  clearInterval(speedId);
  retryBtn.style.display = 'block';
}

// 入力
document.addEventListener('keydown', e => {
  if (e.code === 'Space') {
    e.preventDefault();
    jump();
  }
});
document.addEventListener('click', () => jump());

// リトライ
retryBtn.addEventListener('click', startGame);

// 初回開始
startGame();

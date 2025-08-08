const character = document.getElementById('character');
const gameArea = document.getElementById('gameArea');
const retryBtn = document.getElementById('retryButton');
const scoreDisplay = document.getElementById('score');

let isJumping = false;
let score = 0;
let highScore = Number(localStorage.getItem('highScore')) || 0;
let speed = 3;
let obstacles = [];
let loopId;
let speedId;

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
  let position = 0;
  const upTimer = setInterval(() => {
    if (position >= 150) {
      clearInterval(upTimer);
      const downTimer = setInterval(() => {
        if (position <= 0) {
          clearInterval(downTimer);
          isJumping = false;
        }
        position -= 5;
        character.style.bottom = position + 'px';
      }, 20);
    } else {
      position += 5;
      character.style.bottom = position + 'px';
    }
  }, 20);
}

function createObstacle() {
  const obstacle = document.createElement('div');
  obstacle.className = 'obstacle';
  let obstaclePos = gameArea.offsetWidth;
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

    if (left < -60) {
      obs.remove();
      obstacles.splice(i, 1);
      i--;
      score++;
      updateScore();
    } else if (left < 60 && left > 0 && parseInt(character.style.bottom, 10) < 60) {
      endGame();
    }
  }

  if (Math.random() < 0.02) {
    createObstacle();
  }
}

function increaseSpeed() {
  speed += 0.2;
}

function loop() {
  moveObstacles();
  loopId = requestAnimationFrame(loop);
}

function startGame() {
  score = 0;
  speed = 3;
  updateScore();
  obstacles.forEach(o => o.remove());
  obstacles = [];
  retryBtn.style.display = 'none';
  loopId = requestAnimationFrame(loop);
  speedId = setInterval(increaseSpeed, 1000);
}

function endGame() {
  cancelAnimationFrame(loopId);
  clearInterval(speedId);
  retryBtn.style.display = 'block';
}

document.addEventListener('keydown', e => {
  if (e.code === 'Space') {
    jump();
  }
});

retryBtn.addEventListener('click', startGame);

startGame();

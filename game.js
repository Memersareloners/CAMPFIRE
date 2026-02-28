

const config = {
  type: Phaser.AUTO,
  width: 800,
  height: 600,
  physics: {
    default: 'arcade',
    arcade: { gravity: { y: 600 }, debug: false }
  },
  scene: { preload, create, update }
};

const game = new Phaser.Game(config);

let player;
let cursors;
let fireKey, digKey;
let bullets;
let groundGroup;
let enemies;
let powerups;
let score = 0;
let scoreText;
let health = 3;
let healthText;
let keys;
let lastShot = 0;
const shotCooldown = 300;
let lastDig = 0;
const digCooldown = 500;
let digIndicator;

function preload() {
  this.textures.generate('ship', { data: ['  /\  ', ' /--\ ', '/====\\', "\\____/"], pixelWidth: 4, palette: { ' ': 0x00000000, '/': 0x6666ff, '\\': 0x6666ff, '-': 0x9999ff, '=': 0x222222, '_': 0x333333 } });
  this.textures.generate('block', { data: ['####'], pixelWidth: 8, palette: { '#': 0x8B5A2B } });
  this.textures.generate('enemy', { data: ['><>'], pixelWidth: 8, palette: { '>': 0xff4444, '<': 0xff4444 } });
  this.textures.generate('laser', { data: ['|'], pixelWidth: 4, palette: { '|': 0xffff66 } });
  this.textures.generate('power', { data: ['+'], pixelWidth: 8, palette: { '+': 0x66ff66 } });
}

function create() {
  this.cameras.main.setBackgroundColor('#87ceeb');

  groundGroup = this.physics.add.staticGroup();
  const cols = 40;
  const rows = 8;
  const blockW = 20;
  const startY = 420;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = c * blockW + blockW / 2;
      const y = startY + r * 24;

      const block = groundGroup.create(x, y, 'block').setOrigin(0.5).refreshBody();
      block.displayWidth = blockW;
      block.displayHeight = 24;
    }
  }

  player = this.physics.add.sprite(100, 350, 'ship');
  player.setCollideWorldBounds(true);
  player.setBounce(0.1);
  player.speed = 160;

  this.physics.add.collider(player, groundGroup);

  bullets = this.physics.add.group({ defaultKey: 'laser', maxSize: 30 });

  enemies = this.physics.add.group();
  powerups = this.physics.add.group();

  cursors = this.input.keyboard.createCursorKeys();
  fireKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
  digKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.DOWN);
  keys = this.input.keyboard.addKeys({ W: 'W', A: 'A', D: 'D' });

  this.add.rectangle(120, 18, 240, 36, 0xffffff, 0.8).setScrollFactor(0).setDepth(10);
  this.add.text(10, 10, 'Move: ← → / A D   Jump: ↑ / W   Dig: ↓   Shoot: Space', { font: '14px Arial', fill: '#000' }).setScrollFactor(0).setDepth(11);

  digIndicator = this.add.graphics().setScrollFactor(0).setDepth(9);

  this.physics.add.overlap(bullets, enemies, onBulletHitEnemy, null, this);
  this.physics.add.overlap(player, enemies, onPlayerHit, null, this);
  this.physics.add.overlap(player, powerups, onCollectPower, null, this);

  this.physics.add.collider(bullets, groundGroup, (b, block) => {
    b.destroy();
    block.destroy();
  });

  scoreText = this.add.text(8, 8, 'Score: 0', { font: '18px Arial', fill: '#000' }).setScrollFactor(0);
  healthText = this.add.text(700, 8, 'HP: 3', { font: '18px Arial', fill: '#000' }).setScrollFactor(0);

  this.time.addEvent({ delay: 3000, callback: spawnEnemy, callbackScope: this, loop: true });
  this.time.addEvent({ delay: 5000, callback: spawnPowerup, callbackScope: this, loop: true });
}

function update(time) {
  const left = cursors.left.isDown;
  const right = cursors.right.isDown;
  const up = cursors.up.isDown;
  const a = keys.A.isDown;
  const d = keys.D.isDown;
  const w = keys.W.isDown;

  if (left || a) {
    player.setVelocityX(-player.speed);
    player.flipX = true;
  } else if (right || d) {
    player.setVelocityX(player.speed);
    player.flipX = false;
  } else {
    player.setVelocityX(0);
  }

  if ((up || w) && player.body.blocked.down) {
    player.setVelocityY(-350);
  }

  const now = this.time.now;
  if (Phaser.Input.Keyboard.JustDown(digKey) && now - lastDig >= digCooldown) {
    digAroundPlayer(this);
    lastDig = now;
  }

  if (Phaser.Input.Keyboard.JustDown(fireKey) && now - lastShot >= shotCooldown) {
    shootLaser(this);
    lastShot = now;
  }

  bullets.children.each(b => {
    if (b && (b.y < -50 || b.x > 900 || b.x < -50)) b.destroy();
  });

  enemies.children.each(e => {
    if (!e) return;
    if (!e.body) return;
    if (e.body.blocked.left) e.setVelocityX(60);
    if (e.body.blocked.right) e.setVelocityX(-60);
  });

  const digReady = now - lastDig >= digCooldown;
  digIndicator.clear();
  digIndicator.fillStyle(digReady ? 0x66ff66 : 0xff6666, 0.5);
  digIndicator.fillCircle(720, 22, 10);
}

function shootLaser(scene) {
  const dir = player.flipX ? -1 : 1;
  const x = player.x + dir * 24;
  const y = player.y;
  const laser = bullets.get(x, y);
  if (!laser) return;
  laser.setActive(true);
  laser.setVisible(true);
  laser.body.allowGravity = false;
  laser.setVelocityX(500 * dir);
  laser.setVelocityY(0);
  laser.setDepth(1);
  scene.time.delayedCall(1200, () => { if (laser && laser.destroy) laser.destroy(); });
}

function digAroundPlayer(scene) {
  const digRadius = 28;
  const px = player.x;
  const py = player.y + 10;
  groundGroup.children.each(block => {
    if (!block) return;
    const dist = Phaser.Math.Distance.Between(px, py, block.x, block.y);
    if (dist < digRadius) {
      block.destroy();
    }
  });
}

function spawnEnemy() {
  const cols = 40;
  const blockW = 20;
  const c = Phaser.Math.Between(0, cols - 1);
  const x = c * blockW + blockW / 2;
  const y = Phaser.Math.Between(450, 600);
  const enemy = enemies.create(x, y, 'enemy');
  enemy.setCollideWorldBounds(true);
  enemy.setBounce(0);
  enemy.setVelocityX(Phaser.Math.Between(-60, 60) || 60);
  enemy.body.setSize(14, 14);
  enemy.setDepth(1);
  this.physics.add.collider(enemy, groundGroup);
}

function spawnPowerup() {
  const cols = 40;
  const blockW = 20;
  const c = Phaser.Math.Between(0, cols - 1);
  const x = c * blockW + blockW / 2;
  const y = Phaser.Math.Between(450, 600);
  const p = powerups.create(x, y, 'power');
  p.body.allowGravity = false;
}

function onBulletHitEnemy(bullet, enemy) {
  bullet.destroy();
  enemy.destroy();
  score += 10;
  scoreText.setText('Score: ' + score);
}

function onPlayerHit(playerSprite, enemy) {
  enemy.destroy();
  health -= 1;
  healthText.setText('HP: ' + health);
  if (health <= 0) {
    this.add.text(300, 250, 'Game Over', { font: '32px Arial', fill: '#000' });
    this.scene.pause();
  }
}

function onCollectPower(playerSprite, power) {
  power.destroy();
  score += 25;
  scoreText.setText('Score: ' + score);
  health = Math.min(5, health + 1);
  healthText.setText('HP: ' + health);
}

const PI_2 = 2 * Math.PI;

const canvas = document.querySelector("canvas");
const context = canvas.getContext("2d");

const size = window.innerWidth;
const dpr = window.devicePixelRatio;
canvas.width = size * dpr;
canvas.height = size * dpr;
context.scale(dpr, dpr);

let particles = [];

animate();

function randomColor() {
  const r = 50 + Math.floor(Math.random() * 205);
  const g = 0;
  const b = 50 + Math.floor(Math.random() * 205);
  return "rgba(" + r + "," + g + "," + b + ", 0.5)";
}

function Particle(x, y) {
  this.x = x;
  this.y = y;
  this.dy = 1 + Math.random() * 3;
  this.dx = -1 + Math.random() * 2;
  this.color = randomColor();
  this.size = 2 + Math.floor(Math.random() * 4);
  this.draw = function() {
    context.beginPath();
    context.arc(this.x, this.y, this.size, 0, PI_2, false);
    context.fillStyle = this.color;
    context.fill();
    this.update();
  };
  this.update = function() {
    this.y += this.dy;
    this.x += this.dx;
  };
}

canvas.addEventListener(
  "mousemove",
  function(e) {
    const mouseX = e.offsetX;
    const mouseY = e.offsetY;
    for (let i = 0; i < 3; i++) {
      let p = new Particle(mouseX, mouseY);
      particles.push(p);
    }
  },
  false
);

function animate() {
  context.clearRect(0, 0, canvas.width, canvas.height);
  draw();
  window.requestAnimationFrame(animate);
}

function draw() {
  for (let i = 0; i < particles.length; i++) {
    particles[i].draw();
  }
}

window.addEventListener("resize", function() {
  canvas.height = window.innerHeight;
  canvas.width = window.innerWidth;
});

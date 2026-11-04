// ============================================================
// codigo.js — todo el código del juego "Escuela Portuaria"
// Archivos del juego:  mapa.js (el mapa) · sprites.js (las imágenes) · codigo.js (este)
// El ajuste más fácil de tocar está en el bloque CONFIG, al inicio de la sección 1.
// ============================================================

// ############################################################
// ## 1. AJUSTES, RIVALES Y ARMAS
// ############################################################

const CONFIG = {
  vidaInicial: 100,
  velocidadJugador: 3.4,        // casillas por segundo
  enemigosIniciales: 6,         // rivales al empezar
  enemigosMax: 30,              // tope de rivales a la vez
  bajasPorEnemigoExtra: 2,      // cada X bajas se suma 1 rival al máximo actual
  distanciaAparicion: 8,        // los rivales aparecen al menos a tantas casillas de ti
  intervaloAparicion: 1.5,      // segundos entre apariciones (baja con las bajas)
  intervaloMinimo: 0.6,
  curaColacion: 20,             // vida que da una colación
  probColacion: 0.18            // probabilidad de que un rival suelte una colación
};

// Pantalla interna (baja resolución, estilo Doom)
const W = 320, H = 200, VH = 176;   // VH = alto de la vista 3D (el resto es la barra de estado)
const cv = document.getElementById('c');
cv.width = W; cv.height = H;
const ctx = cv.getContext('2d');
ctx.imageSmoothingEnabled = false;

// Colores de muros por tipo (1 casilleros, 2 puerta, 3 pilar, 4 ventana, 5 salvavidas, 6 ladrillo)
const WALL_COLORS = {
  1: [72, 92, 118], 2: [150, 118, 82], 3: [128, 128, 134],
  4: [196, 190, 176], 5: [52, 84, 128], 6: [158, 86, 64]
};
// Casas de colores que se ven por las ventanas
const HOUSES = [[200, 70, 60], [230, 170, 50], [60, 140, 170], [90, 170, 90], [220, 120, 150], [240, 230, 200]];

// ------------------------------------------------------------
// Rivales. Aparecen más tipos a medida que tumbas más rivales.
//   id      → nombre de los archivos en images/enemigos/<id>_1.svg ... _3.svg
//   hp      → golpes de "vida"
//   spd     → velocidad (casillas por segundo)
//   dmg     → daño que te hace cada golpe
//   pts     → puntos al tumbarlo
//   sc      → tamaño en pantalla (1 = alto del muro)
//   unlock  → bajas necesarias para que empiece a aparecer
//   w       → "peso": qué tan seguido sale frente a los demás
// ------------------------------------------------------------
const TYPES = [
  { id: 'estudiante', name: 'Estudiante',    hp: 3,  spd: 1.0,  dmg: 6,  pts: 10, sc: 0.80, unlock: 0,  w: 10 },
  { id: 'corredor',   name: 'Corredor',      hp: 2,  spd: 1.9,  dmg: 4,  pts: 15, sc: 0.76, unlock: 4,  w: 6 },
  { id: 'bravucon',   name: 'Bravucón',      hp: 6,  spd: 0.8,  dmg: 10, pts: 25, sc: 0.95, unlock: 9,  w: 5 },
  { id: 'inspector',  name: 'Inspector',     hp: 9,  spd: 0.7,  dmg: 12, pts: 40, sc: 0.90, unlock: 16, w: 3 },
  { id: 'jefe',       name: 'Jefe de curso', hp: 14, spd: 0.95, dmg: 15, pts: 80, sc: 1.05, unlock: 25, w: 2 }
];
const NUM_VARIANTES = 3;   // cada tipo tiene 3 versiones de imagen (_1, _2, _3)

// ------------------------------------------------------------
// Armas (se desbloquean con las bajas)
//   type   → 'melee' (cuerpo a cuerpo), 'ball' (a distancia), 'spray' (cono corto)
//   range  → alcance en casillas · arc → ángulo del cono (radianes)
//   cd     → segundos entre ataques · dur → duración de la animación
//   kb     → empuje al rival
// ------------------------------------------------------------
const WEAPONS = [
  { name: 'PUÑOS',    unlock: 0,  type: 'melee', dmg: 1, range: 1.3, arc: 0.5,  cd: 0.38, dur: 0.20, kb: 0.5 },
  { name: 'MOCHILA',  unlock: 5,  type: 'melee', dmg: 2, range: 1.6, arc: 0.8,  cd: 0.50, dur: 0.28, kb: 0.8 },
  { name: 'PELOTA',   unlock: 12, type: 'ball',  dmg: 2, range: 9,   arc: 0.12, cd: 0.65, dur: 0.25, kb: 0.6 },
  { name: 'EXTINTOR', unlock: 22, type: 'spray', dmg: 1, range: 3.4, arc: 0.55, cd: 0.20, dur: 0.18, kb: 0.35 }
];
const WEAPON_MSG = ['', '¡NUEVA ARMA: MOCHILA!', '¡NUEVA ARMA: PELOTA DE EDUCACIÓN FÍSICA!', '¡NUEVA ARMA: EXTINTOR!'];

// ############################################################
// ## 2. MAPA: muros, patio y caminos de los rivales
// ############################################################

const MAP = NIVEL.filas;
const MH = MAP.length, MW = MAP[0].length;

// Qué hay en una posición: 0 = libre, o el tipo de muro (1..6)
function wallAt(x, y) {
  const mx = Math.floor(x), my = Math.floor(y);
  if (mx < 0 || my < 0 || mx >= MW || my >= MH) return 1;
  const c = MAP[my][mx];
  if (c === '.' || c === ',') return 0;
  if (c === '2') return 2;   // puerta
  if (c === '1') return 3;   // pilar / contenedor
  if (c === 'W') return 4;   // ventana
  if (c === 'L') return 5;   // salvavidas
  if (c === 'B') return 6;   // ladrillo
  return 1;                  // casilleros
}

// OUT[i] = 1 si esa casilla es patio abierto (cielo en vez de techo)
const OUT = new Uint8Array(MW * MH);
for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) OUT[y * MW + x] = MAP[y][x] === ',' ? 1 : 0;

// Mapa de distancias hacia el jugador: así los rivales encuentran el camino
const DIRS8 = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
const dist = new Int16Array(MW * MH);
function computeFlow() {
  dist.fill(-1);
  const sx = Math.floor(player.x), sy = Math.floor(player.y);
  if (sx < 0 || sy < 0 || sx >= MW || sy >= MH) return;
  const q = [[sx, sy]]; dist[sy * MW + sx] = 0;
  for (let i = 0; i < q.length; i++) {
    const [x, y] = q[i];
    for (let k = 0; k < 4; k++) {
      const nx = x + DIRS8[k][0], ny = y + DIRS8[k][1];
      if (nx < 0 || ny < 0 || nx >= MW || ny >= MH) continue;
      if (dist[ny * MW + nx] !== -1 || wallAt(nx + 0.5, ny + 0.5) !== 0) continue;
      dist[ny * MW + nx] = dist[y * MW + x] + 1;
      q.push([nx, ny]);
    }
  }
}

// Casillas a las que se puede llegar desde el inicio (para hacer aparecer rivales)
const reachable = [];
(function () {
  const sx = Math.floor(NIVEL.inicio.x), sy = Math.floor(NIVEL.inicio.y);
  const seen = new Set([sx + ',' + sy]), q = [[sx, sy]];
  while (q.length) {
    const [x, y] = q.shift();
    reachable.push([x, y]);
    [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([dx, dy]) => {
      const nx = x + dx, ny = y + dy, k = nx + ',' + ny;
      if (!seen.has(k) && wallAt(nx + 0.5, ny + 0.5) === 0) { seen.add(k); q.push([nx, ny]); }
    });
  }
})();

// ¿Hay línea de visión libre entre dos puntos?
function hasLOS(ax, ay, bx, by) {
  const d = Math.hypot(bx - ax, by - ay), steps = Math.ceil(d / 0.15);
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    if (wallAt(ax + (bx - ax) * t, ay + (by - ay) * t)) return false;
  }
  return true;
}

function canMove(x, y, r) {
  return !wallAt(x - r, y - r) && !wallAt(x + r, y - r) && !wallAt(x - r, y + r) && !wallAt(x + r, y + r);
}
// Mueve un objeto deslizándose por las paredes
function tryMove(o, dx, dy, r) {
  if (canMove(o.x + dx, o.y, r)) o.x += dx;
  if (canMove(o.x, o.y + dy, r)) o.y += dy;
}

// ############################################################
// ## 3. SONIDO
// ############################################################

let actx = null;
function beep(freq, dur, type, vol) {
  try {
    if (!actx) actx = new (window.AudioContext || window.webkitAudioContext)();
    const o = actx.createOscillator(), g = actx.createGain();
    o.type = type || 'square'; o.frequency.value = freq;
    g.gain.value = vol || 0.05;
    g.gain.exponentialRampToValueAtTime(0.0001, actx.currentTime + dur);
    o.connect(g); g.connect(actx.destination);
    o.start(); o.stop(actx.currentTime + dur);
  } catch (e) {}
}

// ############################################################
// ## 4. CARGA DE IMÁGENES (las imágenes están en sprites.js)
// ############################################################

const SPR = { enemigos: [], armas: {}, colacion: null };

function cargarImagen(clave) {
  return new Promise(resolve => {
    const svg = SPRITES[clave];                 // viene de sprites.js
    if (!svg) { console.warn('Falta el sprite:', clave); resolve(null); return; }
    const im = new Image();
    im.onload = () => resolve(im);
    im.onerror = () => { console.warn('No se pudo leer el sprite:', clave); resolve(null); };
    im.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  });
}

// Prepara dos versiones del rival: normal (con sombreado) y "golpeado" (blanco)
function crearVariantes(im) {
  if (!im) return null;
  const hacer = (golpeado) => {
    const c = document.createElement('canvas');
    c.width = 50; c.height = 80;
    const g = c.getContext('2d');
    g.drawImage(im, 0, 0, 50, 80);
    g.globalCompositeOperation = 'source-atop';
    const gr = g.createLinearGradient(0, 0, 50, 0);
    gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,0.28)');
    g.fillStyle = gr; g.fillRect(0, 0, 50, 80);
    if (golpeado) { g.fillStyle = 'rgba(255,255,255,0.55)'; g.fillRect(0, 0, 50, 80); }
    return c;
  };
  return { n: hacer(false), h: hacer(true) };
}

async function cargarSprites() {
  const tareas = [];

  TYPES.forEach((t, ti) => {
    SPR.enemigos[ti] = [];
    for (let v = 0; v < NUM_VARIANTES; v++) {
      tareas.push(cargarImagen('enemigos/' + t.id + '_' + (v + 1))
        .then(im => { SPR.enemigos[ti][v] = crearVariantes(im); }));
    }
  });

  ['punos', 'mochila', 'pelota', 'mano', 'extintor'].forEach(nombre => {
    tareas.push(cargarImagen('armas/' + nombre).then(im => { SPR.armas[nombre] = im; }));
  });
  tareas.push(cargarImagen('items/colacion').then(im => { SPR.colacion = im; }));

  await Promise.all(tareas);
}

// ############################################################
// ## 5. JUEGO: estado, rivales, combate y actualización
// ############################################################

const player = { x: NIVEL.inicio.x, y: NIVEL.inicio.y, a: NIVEL.inicio.a, hp: CONFIG.vidaInicial };
let enemies = [], items = [];
let score = 0, kills = 0, state = 'menu';   // state: 'menu' | 'play' | 'over'
let punchT = 0, punchMax = 0.2, cooldown = 0;
let redFlash = 0, spawnT = 0, walk = 0, weapon = 0;
let msg = '', msgT = 0, overT = 0, firing = false;
let unlocked = [true, false, false, false];
let flowT = 0, lastCell = -1;
const keys = {};
const zbuf = new Array(W).fill(0);

function resetGame() {
  player.x = NIVEL.inicio.x; player.y = NIVEL.inicio.y; player.a = NIVEL.inicio.a;
  player.hp = CONFIG.vidaInicial;
  enemies = []; items = []; score = 0; kills = 0; punchT = 0; cooldown = 0; redFlash = 0; spawnT = 0;
  weapon = 0; unlocked = [true, false, false, false]; msg = ''; msgT = 0; lastCell = -1; flowT = 0;
  computeFlow();
  for (let i = 0; i < CONFIG.enemigosIniciales; i++) spawnEnemy();
  state = 'play';
}

// ---------- Rivales ----------
function pickType() {
  const av = [];
  TYPES.forEach((t, i) => { if (kills >= t.unlock) av.push([i, t.w]); });
  const tot = av.reduce((s, a) => s + a[1], 0);
  let r = Math.random() * tot;
  for (const [i, w] of av) { r -= w; if (r <= 0) return i; }
  return 0;
}

function spawnEnemy() {
  const far = reachable.filter(([x, y]) => Math.hypot(x + 0.5 - player.x, y + 0.5 - player.y) > CONFIG.distanciaAparicion);
  const pool = far.length ? far : reachable;
  const [x, y] = pool[Math.floor(Math.random() * pool.length)];
  const type = pickType();
  enemies.push({ x: x + 0.5, y: y + 0.5, type, v: Math.floor(Math.random() * NUM_VARIANTES),
                 hp: TYPES[type].hp, atk: 0.6, flash: 0 });
}

// Camina hacia el jugador: directo si lo ve, o siguiendo el mapa de distancias
function steer(e, dt, speed) {
  let tx = player.x, ty = player.y;
  if (!hasLOS(e.x, e.y, player.x, player.y)) {
    const cx = Math.floor(e.x), cy = Math.floor(e.y);
    let best = dist[cy * MW + cx], bx = null, by = null;
    if (best >= 0) {
      for (const [ox, oy] of DIRS8) {
        const nx = cx + ox, ny = cy + oy;
        if (nx < 0 || ny < 0 || nx >= MW || ny >= MH) continue;
        const dv = dist[ny * MW + nx];
        if (dv < 0) continue;
        if (ox && oy && (wallAt(cx + ox + 0.5, cy + 0.5) || wallAt(cx + 0.5, cy + oy + 0.5))) continue;
        if (dv < best) { best = dv; bx = nx; by = ny; }
      }
      if (bx !== null) { tx = bx + 0.5; ty = by + 0.5; }
    }
  }
  const ex = tx - e.x, ey = ty - e.y, ed = Math.hypot(ex, ey) || 1;
  tryMove(e, (ex / ed) * speed * dt, (ey / ed) * speed * dt, 0.2);
}

// ---------- Combate ----------
function killEnemy(e) {
  e.dead = true;
  score += TYPES[e.type].pts; kills++;
  beep(90, 0.25, 'triangle', 0.08);
  if (Math.random() < CONFIG.probColacion) items.push({ x: e.x, y: e.y, ttl: 20 });
  for (let i = 1; i < WEAPONS.length; i++) {
    if (!unlocked[i] && kills >= WEAPONS[i].unlock) {
      unlocked[i] = true; weapon = i; msg = WEAPON_MSG[i]; msgT = 3;
      beep(520, 0.15, 'square', 0.06); setTimeout(() => beep(780, 0.2, 'square', 0.06), 130);
    }
  }
}

function hitEnemy(e, dmg, kb) {
  e.hp -= dmg; e.flash = 0.15;
  const dx = e.x - player.x, dy = e.y - player.y, d = Math.hypot(dx, dy) || 1;
  tryMove(e, (dx / d) * kb, (dy / d) * kb, 0.2);
  if (e.hp <= 0 && !e.dead) killEnemy(e);
}

function attack() {
  if (state === 'menu' || (state === 'over' && overT <= 0)) { resetGame(); return; }
  if (state !== 'play' || cooldown > 0) return;
  const wp = WEAPONS[weapon];
  cooldown = wp.cd; punchT = wp.dur; punchMax = wp.dur;
  const dx = Math.cos(player.a), dy = Math.sin(player.a);

  if (wp.type === 'ball') {
    // pelota: golpea al rival más cercano en la mira
    let best = null, bd = 1e9;
    for (const e of enemies) {
      const ex = e.x - player.x, ey = e.y - player.y, d = Math.hypot(ex, ey);
      if (d > wp.range || (ex * dx + ey * dy) / d < Math.cos(wp.arc)) continue;
      if (!hasLOS(player.x, player.y, e.x, e.y)) continue;
      if (d < bd) { bd = d; best = e; }
    }
    beep(220, 0.12, 'triangle', 0.07);
    if (best) { hitEnemy(best, wp.dmg, wp.kb); beep(320, 0.08, 'square', 0.07); }
  } else {
    // puños, mochila y extintor: golpean a todos los que estén en el cono
    beep(wp.type === 'spray' ? 600 : 160, 0.1, 'sawtooth', 0.05);
    let hit = false;
    for (const e of enemies) {
      const ex = e.x - player.x, ey = e.y - player.y, d = Math.hypot(ex, ey);
      if (d > wp.range || (ex * dx + ey * dy) / d < Math.cos(wp.arc)) continue;
      if (!hasLOS(player.x, player.y, e.x, e.y)) continue;
      hitEnemy(e, wp.dmg, wp.kb); hit = true;
    }
    if (hit) beep(300, 0.08, 'square', 0.07);
  }
  enemies = enemies.filter(e => !e.dead);
}

function selectWeapon(i) { if (unlocked[i]) { weapon = i; beep(400, 0.05, 'square', 0.04); } }
function cycleWeapon(dir) {
  for (let k = 1; k <= WEAPONS.length; k++) {
    const i = (weapon + dir * k + WEAPONS.length * 4) % WEAPONS.length;
    if (unlocked[i]) { weapon = i; beep(400, 0.05, 'square', 0.04); return; }
  }
}

// ---------- Actualización por cuadro ----------
function update(dt) {
  if (state === 'over') { overT -= dt; return; }
  if (state !== 'play') return;

  const turn = (keys.ArrowLeft || keys.KeyA ? -1 : 0) + (keys.ArrowRight || keys.KeyD ? 1 : 0);
  const mv = (keys.ArrowUp || keys.KeyW ? 1 : 0) + (keys.ArrowDown || keys.KeyS ? -1 : 0);
  player.a += turn * 2.3 * dt;
  if (mv) {
    const v = CONFIG.velocidadJugador * mv * dt;
    tryMove(player, Math.cos(player.a) * v, Math.sin(player.a) * v, 0.22);
    walk += dt * 9;
  }
  punchT = Math.max(0, punchT - dt);
  cooldown = Math.max(0, cooldown - dt);
  redFlash = Math.max(0, redFlash - dt);
  msgT = Math.max(0, msgT - dt);

  flowT -= dt;
  const pc = Math.floor(player.y) * MW + Math.floor(player.x);
  if (pc !== lastCell || flowT <= 0) { computeFlow(); lastCell = pc; flowT = 0.5; }

  if (keys.Space || keys.Enter || keys.KeyF || firing) attack();

  const mul = 1 + Math.min(kills, 40) * 0.01;      // se vuelven un poco más rápidos
  for (const e of enemies) {
    const t = TYPES[e.type];
    e.flash = Math.max(0, e.flash - dt);
    e.atk -= dt;
    const d = Math.hypot(player.x - e.x, player.y - e.y);
    const reach = 0.6 + t.sc * 0.15;
    if (d > reach) steer(e, dt, t.spd * mul);
    else if (e.atk <= 0) {
      player.hp -= t.dmg; e.atk = 0.9; redFlash = 0.18;
      beep(110, 0.12, 'sawtooth', 0.07);
    }
  }
  // que no se amontonen
  for (let i = 0; i < enemies.length; i++) for (let j = i + 1; j < enemies.length; j++) {
    const a = enemies[i], b = enemies[j];
    const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy);
    if (d < 0.45 && d > 0.001) {
      const p = (0.45 - d) * 0.5;
      tryMove(a, -dx / d * p, -dy / d * p, 0.2); tryMove(b, dx / d * p, dy / d * p, 0.2);
    }
  }
  // colaciones
  for (const it of items) {
    it.ttl -= dt;
    if (Math.hypot(it.x - player.x, it.y - player.y) < 0.6 && player.hp < CONFIG.vidaInicial) {
      player.hp = Math.min(CONFIG.vidaInicial, player.hp + CONFIG.curaColacion); it.ttl = 0;
      beep(660, 0.12, 'triangle', 0.07);
    }
  }
  items = items.filter(it => it.ttl > 0);

  // más bajas = más rivales a la vez y apariciones más seguidas
  const objetivo = Math.min(CONFIG.enemigosIniciales + Math.floor(kills / CONFIG.bajasPorEnemigoExtra), CONFIG.enemigosMax);
  spawnT -= dt;
  if (enemies.length < objetivo && spawnT <= 0) {
    spawnEnemy();
    spawnT = Math.max(CONFIG.intervaloMinimo, CONFIG.intervaloAparicion - kills * 0.02);
  }

  if (player.hp <= 0) { player.hp = 0; state = 'over'; overT = 1; firing = false; }
}

// ############################################################
// ## 6. DIBUJO: piso, cielo, muros, rivales, arma y barra de estado
// ############################################################

// ---------- Piso y techo/cielo ----------
const floorImg = ctx.createImageData(W, VH);
function drawFloorCeil(dirX, dirY, planeX, planeY) {
  const d = floorImg.data, half = VH / 2;
  const r0x = dirX - planeX, r0y = dirY - planeY, r1x = dirX + planeX, r1y = dirY + planeY;
  const camShift = player.a * 160;
  for (let y = 0; y < half; y++) {
    const rowDist = half / Math.max(half - y, 0.5);
    const fogIn = Math.max(0.12, Math.min(1, 1 / (1 + rowDist * 0.28)));
    const fogOut = Math.max(0.5, Math.min(1, 1 / (1 + rowDist * 0.1)));
    const sx = rowDist * (r1x - r0x) / W, sy = rowDist * (r1y - r0y) / W;
    let fx = player.x + rowDist * r0x, fy = player.y + rowDist * r0y;
    const yf = VH - 1 - y, skyT = y / half;
    for (let x = 0; x < W; x++) {
      const cxm = Math.floor(fx), cym = Math.floor(fy);
      const out = cxm >= 0 && cym >= 0 && cxm < MW && cym < MH && OUT[cym * MW + cxm] === 1;
      let fr, fg, fb, cr, cg, cb;
      if (out) {                                   // patio: cemento y cielo
        const tx = fx - cxm, ty = fy - cym;
        const base = ((cxm + cym) & 1) ? 150 : 140;
        fr = base; fg = base; fb = base - 6;
        if (tx < 0.04 || ty < 0.04) { fr -= 35; fg -= 35; fb -= 35; }
        fr *= fogOut; fg *= fogOut; fb *= fogOut;
        cr = 70 + skyT * 120; cg = 140 + skyT * 85; cb = 225 + skyT * 25;
        if (Math.sin((x + camShift) * 0.05) * Math.sin(y * 0.3 + 1.3) > 0.55) { cr += 60; cg += 50; cb += 20; }
      } else {                                     // interior: linóleo y techo con tubos de luz
        const chk = (Math.floor(fx * 2) + Math.floor(fy * 2)) & 1;
        fr = (chk ? 150 : 116) * fogIn; fg = (chk ? 142 : 108) * fogIn; fb = (chk ? 128 : 96) * fogIn;
        const tx = fx - cxm, ty = fy - cym;
        let r = 70, g = 72, b = 80;
        if (tx < 0.04 || ty < 0.04) { r = 45; g = 46; b = 52; }
        if (tx > 0.3 && tx < 0.7 && ty > 0.42 && ty < 0.58) { r = 235; g = 236; b = 220; }
        cr = r * fogIn; cg = g * fogIn; cb = b * fogIn;
      }
      let i = (yf * W + x) * 4;
      d[i] = fr; d[i + 1] = fg; d[i + 2] = fb; d[i + 3] = 255;
      i = (y * W + x) * 4;
      d[i] = cr; d[i + 1] = cg; d[i + 2] = cb; d[i + 3] = 255;
      fx += sx; fy += sy;
    }
  }
  ctx.putImageData(floorImg, 0, 0);
}

// ---------- Muros (raycasting) ----------
function drawWalls() {
  const dirX = Math.cos(player.a), dirY = Math.sin(player.a);
  const planeX = -dirY * 0.66, planeY = dirX * 0.66;
  drawFloorCeil(dirX, dirY, planeX, planeY);

  for (let x = 0; x < W; x++) {
    const camX = 2 * x / W - 1;
    const rdx = dirX + planeX * camX, rdy = dirY + planeY * camX;
    let mapX = Math.floor(player.x), mapY = Math.floor(player.y);
    const ddx = Math.abs(1 / rdx), ddy = Math.abs(1 / rdy);
    let stepX, stepY, sdx, sdy, side = 0, type = 0;
    if (rdx < 0) { stepX = -1; sdx = (player.x - mapX) * ddx; } else { stepX = 1; sdx = (mapX + 1 - player.x) * ddx; }
    if (rdy < 0) { stepY = -1; sdy = (player.y - mapY) * ddy; } else { stepY = 1; sdy = (mapY + 1 - player.y) * ddy; }
    for (let i = 0; i < 160 && !type; i++) {
      if (sdx < sdy) { sdx += ddx; mapX += stepX; side = 0; } else { sdy += ddy; mapY += stepY; side = 1; }
      type = wallAt(mapX + 0.5, mapY + 0.5);
    }
    const perp = side === 0 ? sdx - ddx : sdy - ddy;
    zbuf[x] = perp;
    let wx = side === 0 ? player.y + perp * rdy : player.x + perp * rdx;
    wx -= Math.floor(wx);

    const lineH = VH / Math.max(perp, 0.05);
    const top = VH / 2 - lineH / 2;
    const shade = Math.max(0.15, Math.min(1, 1 / (1 + perp * 0.28))) * (side ? 0.72 : 1);
    const col = WALL_COLORS[type] || WALL_COLORS[1];
    const rgb = (k) => `rgb(${(col[0] * shade * k) | 0},${(col[1] * shade * k) | 0},${(col[2] * shade * k) | 0})`;
    ctx.fillStyle = rgb(1);
    ctx.fillRect(x, top, 1, lineH);

    if (type === 1) {                         // casilleros
      const f = (wx * 4) % 1;
      if (f < 0.07) { ctx.fillStyle = rgb(0.5); ctx.fillRect(x, top, 1, lineH); }
      if (f > 0.7 && f < 0.82) { ctx.fillStyle = rgb(1.6); ctx.fillRect(x, top + lineH * 0.5, 1, lineH * 0.06); }
      if (f > 0.25 && f < 0.6) { ctx.fillStyle = rgb(0.65); ctx.fillRect(x, top + lineH * 0.12, 1, lineH * 0.025); ctx.fillRect(x, top + lineH * 0.17, 1, lineH * 0.025); }
    } else if (type === 2) {                  // puerta de sala
      if (wx > 0.22 && wx < 0.78) {
        ctx.fillStyle = rgb(0.55); ctx.fillRect(x, top + lineH * 0.08, 1, lineH * 0.92);
        if (wx > 0.4 && wx < 0.6) { ctx.fillStyle = rgb(1.8); ctx.fillRect(x, top + lineH * 0.18, 1, lineH * 0.22); }
        if (wx > 0.66 && wx < 0.7) { ctx.fillStyle = '#d9c27a'; ctx.fillRect(x, top + lineH * 0.55, 1, lineH * 0.04); }
      }
    } else if (type === 4) {                  // ventana con vista al puerto
      const rgbc = (r, g, b) => `rgb(${(r * shade) | 0},${(g * shade) | 0},${(b * shade) | 0})`;
      if (wx > 0.14 && wx < 0.86) {
        const y0 = top + lineH * 0.2, hh = lineH * 0.5, sea = y0 + hh * 0.78;
        ctx.fillStyle = rgbc(130, 178, 220); ctx.fillRect(x, y0, 1, hh);
        const hi = Math.floor(wx * 16), hc = HOUSES[hi % HOUSES.length];
        const hH = hh * (0.2 + ((hi * 37) % 5) * 0.045);
        ctx.fillStyle = rgbc(hc[0], hc[1], hc[2]); ctx.fillRect(x, sea - hH, 1, hH);
        if (wx > 0.6 && wx < 0.62) { ctx.fillStyle = rgbc(40, 44, 52); ctx.fillRect(x, y0 + hh * 0.1, 1, sea - y0 - hh * 0.1); }
        if (wx > 0.52 && wx < 0.74) { ctx.fillStyle = rgbc(40, 44, 52); ctx.fillRect(x, y0 + hh * 0.1, 1, hh * 0.04); }
        ctx.fillStyle = rgbc(30, 70, 120); ctx.fillRect(x, sea, 1, y0 + hh - sea);
        if (wx < 0.17 || wx > 0.83 || (wx > 0.495 && wx < 0.505)) { ctx.fillStyle = rgbc(235, 235, 235); ctx.fillRect(x, y0, 1, hh); }
        ctx.fillStyle = rgbc(235, 235, 235); ctx.fillRect(x, y0 - lineH * 0.015, 1, lineH * 0.02); ctx.fillRect(x, y0 + hh, 1, lineH * 0.02);
      }
    } else if (type === 5) {                  // salvavidas
      const dx = wx - 0.5;
      if (Math.abs(dx) < 0.2) {
        const hh = Math.sqrt(0.04 - dx * dx) * lineH, cy = top + lineH * 0.45;
        const stripe = Math.floor((wx + 1) * 8) & 1;
        ctx.fillStyle = stripe ? `rgb(${(235 * shade) | 0},${(235 * shade) | 0},${(235 * shade) | 0})` : `rgb(${(200 * shade) | 0},${(45 * shade) | 0},${(45 * shade) | 0})`;
        ctx.fillRect(x, cy - hh, 1, hh * 2);
        if (Math.abs(dx) < 0.09) {
          const hi2 = Math.sqrt(0.0081 - dx * dx) * lineH;
          ctx.fillStyle = rgb(1); ctx.fillRect(x, cy - hi2, 1, hi2 * 2);
        }
      }
    } else if (type === 6) {                  // ladrillo del patio
      const rows = 10;
      ctx.fillStyle = rgb(0.6);
      for (let r = 1; r < rows; r++) ctx.fillRect(x, top + lineH * r / rows, 1, Math.max(0.5, lineH * 0.012));
      for (let r = 0; r < rows; r++) {
        const f = (wx * 5 + (r & 1 ? 0.5 : 0)) % 1;
        if (f < 0.05) ctx.fillRect(x, top + lineH * r / rows, 1, lineH / rows);
      }
    } else if (type === 3) {                  // pilar / contenedor
      if (((wx * 2) % 1) < 0.08) { ctx.fillStyle = rgb(0.6); ctx.fillRect(x, top, 1, lineH); }
    }
  }
}

// ---------- Rivales y objetos (sprites) ----------
function drawBillboards() {
  const dirX = Math.cos(player.a), dirY = Math.sin(player.a);
  const planeX = -dirY * 0.66, planeY = dirX * 0.66;
  const inv = 1 / (planeX * dirY - dirX * planeY);
  const things = [];
  for (const e of enemies) {
    const im = SPR.enemigos[e.type] && SPR.enemigos[e.type][e.v];
    if (!im) continue;
    things.push({ x: e.x, y: e.y, img: e.flash > 0 ? im.h : im.n, iw: 50, ih: 80, sc: TYPES[e.type].sc, asp: 0.625 });
  }
  if (SPR.colacion) for (const it of items) things.push({ x: it.x, y: it.y, img: SPR.colacion, iw: 24, ih: 16, sc: 0.12, asp: 1.5 });
  things.forEach(t => { t.d = (t.x - player.x) ** 2 + (t.y - player.y) ** 2; });
  things.sort((a, b) => b.d - a.d);

  for (const t of things) {
    const sx = t.x - player.x, sy = t.y - player.y;
    const tx = inv * (dirY * sx - dirX * sy);
    const ty = inv * (-planeY * sx + planeX * sy);
    if (ty < 0.15) continue;
    const screenX = (W / 2) * (1 + tx / ty);
    const full = VH / ty, h = full * t.sc, w = h * t.asp;
    const top = VH / 2 + full / 2 - h;
    const x0 = Math.floor(screenX - w / 2), x1 = Math.floor(screenX + w / 2);
    for (let x = Math.max(0, x0); x < Math.min(W, x1); x++) {
      if (ty >= zbuf[x]) continue;
      const srcX = Math.min(t.iw - 1, Math.floor((x - x0) / w * t.iw));
      ctx.drawImage(t.img, srcX, 0, 1, t.ih, x, top, 1, h);
    }
  }
}

// ---------- Arma en mano ----------
function drawHeldWeapon() {
  const A = SPR.armas;
  const p = punchT > 0 ? 1 - punchT / punchMax : 0;      // 0..1 durante el ataque
  const lift = Math.sin(p * Math.PI);
  const cx = W / 2 + 16 + Math.sin(walk) * 2;

  if (weapon === 0 && A.punos) {
    const s = 1 + lift * 0.55, cy = VH - 18 - lift * 46;
    ctx.drawImage(A.punos, cx - 30 * s, cy - 22 * s, 60 * s, 120 * s);
  } else if (weapon === 1 && A.mochila) {
    ctx.save();
    ctx.translate(cx + 14 - p * 80, VH + 4 - lift * 26);
    ctx.rotate(0.45 - p * 1.5);
    ctx.drawImage(A.mochila, -30, -86, 60, 90);
    ctx.restore();
  } else if (weapon === 2 && A.pelota && A.mano) {
    ctx.drawImage(A.mano, cx + 6 - 25, VH - 6 - 14, 50, 28);
    if (p <= 0.85) {
      const r = 19 * (1 - p * 0.55), bx = cx + 6 - p * 12, by = VH - 26 - p * 86;
      ctx.drawImage(A.pelota, bx - r, by - r, 2 * r, 2 * r);
    }
  } else if (weapon === 3 && A.extintor) {
    ctx.drawImage(A.extintor, cx - 20, VH - 96, 40, 100);
    if (punchT > 0) {                          // nube de espuma
      for (let i = 0; i < 12; i++) {
        const t = i / 12;
        const px = cx - 6 + (W / 2 - cx + 6) * t + (Math.random() - 0.5) * 14 * t;
        const py = VH - 86 - t * 56 + (Math.random() - 0.5) * 8;
        ctx.fillStyle = `rgba(255,255,255,${0.45 - t * 0.2})`;
        ctx.beginPath(); ctx.arc(px, py, 4 + t * 16, 0, 7); ctx.fill();
      }
    }
  }
}

// ---------- Barra de estado y minimapa ----------
function drawFace(cx, cy) {
  const hp = player.hp;
  ctx.fillStyle = '#f2b98a'; ctx.beginPath(); ctx.arc(cx, cy, 10, 0, 7); ctx.fill();
  ctx.fillStyle = '#222';
  ctx.fillRect(cx - 5, cy - 3, 2, 2); ctx.fillRect(cx + 3, cy - 3, 2, 2);
  ctx.strokeStyle = '#222'; ctx.lineWidth = 1.2; ctx.beginPath();
  if (hp > 60) { ctx.moveTo(cx - 4, cy + 4); ctx.quadraticCurveTo(cx, cy + 8, cx + 4, cy + 4); }
  else if (hp > 30) { ctx.moveTo(cx - 4, cy + 5); ctx.lineTo(cx + 4, cy + 5); }
  else { ctx.moveTo(cx - 4, cy + 7); ctx.quadraticCurveTo(cx, cy + 3, cx + 4, cy + 7); }
  ctx.stroke();
}

function drawMinimap() {
  // muestra solo la zona cercana al jugador
  const RX = 14, RY = 8, ms = 2.2, ox = 5, oy = 5;
  const px = Math.floor(player.x), py = Math.floor(player.y);
  ctx.fillStyle = 'rgba(0,0,0,0.4)';
  ctx.fillRect(ox - 2, oy - 2, (2 * RX + 1) * ms + 4, (2 * RY + 1) * ms + 4);
  for (let dy = -RY; dy <= RY; dy++) for (let dx = -RX; dx <= RX; dx++) {
    const x = px + dx, y = py + dy;
    if (x < 0 || y < 0 || x >= MW || y >= MH) continue;
    const c = MAP[y][x];
    if (c === '.') continue;
    ctx.fillStyle = c === ',' ? 'rgba(140,190,140,0.4)' : '#6a7f99';
    ctx.fillRect(ox + (dx + RX) * ms, oy + (dy + RY) * ms, ms, ms);
  }
  ctx.fillStyle = '#ff4c4c';
  for (const e of enemies) {
    const ex = e.x - px + RX, ey = e.y - py + RY;
    if (ex < 0 || ey < 0 || ex > 2 * RX + 1 || ey > 2 * RY + 1) continue;
    ctx.fillRect(ox + ex * ms - 1, oy + ey * ms - 1, 2, 2);
  }
  ctx.fillStyle = '#4cff6a';
  ctx.fillRect(ox + (player.x - px + RX) * ms - 1.5, oy + (player.y - py + RY) * ms - 1.5, 3, 3);
}

function drawHUD() {
  ctx.fillStyle = '#2b2118'; ctx.fillRect(0, VH, W, H - VH);
  ctx.fillStyle = '#5b4630'; ctx.fillRect(0, VH, W, 2);
  ctx.font = 'bold 9px monospace'; ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
  ctx.fillStyle = '#ff7a5c'; ctx.fillText('VIDA ' + Math.max(0, Math.round(player.hp)) + '%', 8, VH + 8);
  ctx.fillStyle = '#9fd3ff'; ctx.fillText('ARMA ' + WEAPONS[weapon].name, 8, VH + 18);
  ctx.textAlign = 'right';
  ctx.fillStyle = '#f5d76e'; ctx.fillText('PUNTOS ' + score, W - 8, VH + 8);
  ctx.fillStyle = '#cfcfcf'; ctx.fillText('BAJAS ' + kills, W - 8, VH + 18);
  ctx.textAlign = 'left';
  drawFace(W / 2, VH + 12);
  drawMinimap();

  if (msgT > 0) {
    ctx.textAlign = 'center'; ctx.font = 'bold 10px monospace';
    ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(0, 70, W, 16);
    ctx.fillStyle = '#ffe36a'; ctx.fillText(msg, W / 2, 78);
    ctx.textAlign = 'left';
  }
}

function drawOverlay(title, sub) {
  ctx.fillStyle = 'rgba(0,0,0,0.65)'; ctx.fillRect(0, 0, W, VH);
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillStyle = '#ff5a3c'; ctx.font = 'bold 20px monospace'; ctx.fillText(title, W / 2, 55);
  ctx.fillStyle = '#eee'; ctx.font = 'bold 10px monospace';
  sub.forEach((s, i) => ctx.fillText(s, W / 2, 88 + i * 15));
  ctx.textAlign = 'left';
}

function render() {
  drawWalls();
  drawBillboards();
  drawHeldWeapon();
  if (redFlash > 0) { ctx.fillStyle = `rgba(200,0,0,${redFlash * 2})`; ctx.fillRect(0, 0, W, VH); }
  drawHUD();
  if (state === 'menu') drawOverlay(NIVEL.nombre.toUpperCase(), ['Valparaíso · pasillos, patio y gimnasio', 'Cada baja trae más rivales y nuevas armas', 'Toca o presiona Espacio para empezar']);
  if (state === 'over') drawOverlay('¡TE NOQUEARON!', ['Puntos: ' + score + ' · Bajas: ' + kills, overT > 0 ? ' ' : 'Toca para jugar de nuevo']);
}

// ############################################################
// ## 7. CONTROLES: teclado, mouse/touch y botones
// ############################################################

window.addEventListener('keydown', ev => {
  keys[ev.code] = true;
  if (ev.code === 'Space' || ev.code === 'Enter' || ev.code === 'KeyF') { attack(); ev.preventDefault(); }
  if (ev.code === 'Digit1') selectWeapon(0);
  if (ev.code === 'Digit2') selectWeapon(1);
  if (ev.code === 'Digit3') selectWeapon(2);
  if (ev.code === 'Digit4') selectWeapon(3);
  if (ev.code === 'KeyE') cycleWeapon(1);
  if (ev.code === 'KeyQ') cycleWeapon(-1);
  if (ev.code.startsWith('Arrow')) ev.preventDefault();
});
window.addEventListener('keyup', ev => { keys[ev.code] = false; });
window.addEventListener('pointerup', () => { firing = false; });
window.addEventListener('pointercancel', () => { firing = false; });
cv.addEventListener('pointerdown', ev => { firing = true; attack(); ev.preventDefault(); });

function bindBtn(id, code) {
  const b = document.getElementById(id);
  const down = ev => { keys[code] = true; ev.preventDefault(); };
  const up = ev => { keys[code] = false; ev.preventDefault(); };
  b.addEventListener('pointerdown', down);
  b.addEventListener('pointerup', up);
  b.addEventListener('pointerleave', up);
  b.addEventListener('pointercancel', up);
}
bindBtn('bL', 'ArrowLeft'); bindBtn('bR', 'ArrowRight'); bindBtn('bU', 'ArrowUp'); bindBtn('bD', 'ArrowDown');
document.getElementById('punch').addEventListener('pointerdown', ev => { firing = true; attack(); ev.preventDefault(); });
document.getElementById('sw').addEventListener('pointerdown', ev => { cycleWeapon(1); ev.preventDefault(); });

// ############################################################
// ## 8. ARRANQUE
// ############################################################

let last = performance.now();
function loop(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  update(dt);
  render();
  requestAnimationFrame(loop);
}

cargarSprites().then(() => {
  computeFlow();
  // rivales de fondo para el menú
  for (let i = 0; i < 4; i++) spawnEnemy();
  last = performance.now();
  requestAnimationFrame(loop);
});

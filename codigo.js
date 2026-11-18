// ============================================================
// codigo.js — todo el código del juego "Guerra Anfibia"
// Carpetas del juego:  assets/ (mapa.js y los dibujos PNG en assets/imagenes/) · codigo/ (este archivo)
// El ajuste más fácil de tocar está en el bloque CONFIG, al inicio de la sección 1.
// ============================================================

// ############################################################
// ## 1. AJUSTES, RIVALES Y ARMAS
// ############################################################

const CONFIG = {
  vidaInicial: 100,
  velocidadJugador: 3.4,        // casillas por segundo
  enemigosIniciales: 10,         // rivales al empezar
  enemigosMax: 40,              // tope de rivales a la vez
  bajasPorEnemigoExtra: 2,      // cada X bajas se suma 1 rival al máximo actual
  distanciaAparicion: 8,        // los rivales aparecen al menos a tantas casillas de ti
  intervaloAparicion: 1.5,      // segundos entre apariciones (baja con las bajas)
  intervaloMinimo: 0.6,
  curaColacion: 20,             // vida que da una ración
  probColacion: 0.18,           // probabilidad de que un enemigo suelte una ración
  spritesPixelados: true        // true = pixeles nítidos estilo Doom; false = suavizado
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
  4: [196, 190, 176], 5: [52, 84, 128], 6: [158, 86, 64],
  7: [40, 96, 160], 8: [222, 222, 228], 9: [78, 92, 60], 10: [150, 142, 128]   // mar, barco, base militar, almacén
};
// Casas de colores que se ven por las ventanas
const HOUSES = [[200, 70, 60], [230, 170, 50], [60, 140, 170], [90, 170, 90], [220, 120, 150], [240, 230, 200]];

// ------------------------------------------------------------
// Rivales. Aparecen más tipos a medida que tumbas más rivales.
//   id      → nombre de los archivos en assets/imagenes/enemigos/<id>_1.png ... _3.png
//   hp      → golpes de "vida"
//   spd     → velocidad (casillas por segundo)
//   dmg     → daño que te hace cada golpe
//   pts     → puntos al tumbarlo
//   sc      → tamaño en pantalla (1 = alto del muro)
//   unlock  → bajas necesarias para que empiece a aparecer
//   w       → "peso": qué tan seguido sale frente a los demás
// ------------------------------------------------------------
const TYPES = [
  { id: 'marinero',   name: 'Marinero',    hp: 3,  spd: 1.0,  dmg: 6,  pts: 10, sc: 0.80, unlock: 0,  w: 10 },
  { id: 'explorador', name: 'Explorador',  hp: 2,  spd: 1.9,  dmg: 4,  pts: 15, sc: 0.76, unlock: 4,  w: 6 },
  { id: 'granadero',  name: 'Granadero',   hp: 6,  spd: 0.8,  dmg: 10, pts: 25, sc: 0.95, unlock: 9,  w: 5 },
  { id: 'oficial',    name: 'Oficial',     hp: 9,  spd: 0.7,  dmg: 12, pts: 40, sc: 0.90, unlock: 16, w: 3 },
  { id: 'comandante', name: 'Comandante',  hp: 14, spd: 0.95, dmg: 15, pts: 80, sc: 1.05, unlock: 25, w: 2 }
];
const NUM_VARIANTES = 3;   // cada tipo tiene 3 versiones de imagen (_1, _2, _3)

// ------------------------------------------------------------
// Hojas de sprites estilo Doom (opcional, mira LEEME.md)
// Archivo: assets/imagenes/enemigos/<id>_<n>_hoja.png  (ej: marinero_1_hoja.png)
// Es UNA imagen con todos los cuadros en cuadrícula; cada cuadro en proporción 5:8.
// Los cuadros se numeran de izquierda a derecha y de arriba hacia abajo, desde el 0.
// Si no hay hoja, el juego usa la imagen sola (<id>_<n>.png) como siempre.
// ------------------------------------------------------------
const HOJA = {
  columnas: 4, filas: 2,
  caminar: [0, 1, 2, 3],   // ciclo de caminata
  atacar: [4, 5],          // 4 = prepara el golpe, 5 = golpea
  dolor: 6,                // cuando recibe un golpe
  muerte: 7                // al caer (se queda un momento y se desvanece)
};
const MUERTE_SEG = 0.9;    // cuánto dura la animación de muerte

// ------------------------------------------------------------
// Armas (se desbloquean con las bajas)
//   pellets → balas por disparo · spread → dispersión (radianes) · range → alcance en casillas
//   img    → archivo assets/imagenes/armas/<img>.png
//   cd     → segundos entre ataques · dur → duración de la animación
//   kb     → empuje al rival
// ------------------------------------------------------------
const WEAPONS = [
  { name: 'PISTOLA',        img: 'pistola',       unlock: 0,  type: 'bala', dmg: 1, pellets: 1, spread: 0.02, range: 14, cd: 0.34, dur: 0.14, kb: 0.15, snd: 260 },
  { name: 'ESCOPETA',       img: 'escopeta',      unlock: 6,  type: 'bala', dmg: 1, pellets: 7, spread: 0.30, range: 8,  cd: 0.85, dur: 0.30, kb: 0.45, snd: 110 },
  { name: 'FUSIL',          img: 'fusil',         unlock: 14, type: 'bala', dmg: 2, pellets: 1, spread: 0.03, range: 18, cd: 0.20, dur: 0.10, kb: 0.20, snd: 200 },
  { name: 'AMETRALLADORA',  img: 'ametralladora', unlock: 24, type: 'bala', dmg: 1, pellets: 1, spread: 0.10, range: 16, cd: 0.09, dur: 0.07, kb: 0.08, snd: 170 }
];
const WEAPON_MSG = ['', '¡NUEVA ARMA: ESCOPETA!', '¡NUEVA ARMA: FUSIL DE ASALTO!', '¡NUEVA ARMA: AMETRALLADORA!'];

// ############################################################
// ## 2. MAPA: muros, patio y caminos de los rivales
// ############################################################

// Los datos del mapa vienen de mapa/mapa.js (lo haces tú). Si el archivo no existe, se avisa en pantalla.
const DATOS_NIVEL = (typeof NIVEL !== 'undefined') ? NIVEL : null;
const NOMBRE_JUEGO = (DATOS_NIVEL && DATOS_NIVEL.nombre) || 'Guerra Anfibia';

// Lee el mapa escrito en mapa.js y avisa en pantalla si tiene errores
function leerNivel() {
  if (!DATOS_NIVEL) {
    return { filas: ['###', '#.#', '###'], inicio: { x: 1.5, y: 1.5, a: 0 },
             errores: ['No se encontró mapa/mapa.js. Crea ese archivo con el mapa (el formato está en LEEME.md).'] };
  }
  const errores = [];
  const filas = String(DATOS_NIVEL.mapa || '').split('\n').map(f => f.trim()).filter(f => f && !f.startsWith('//'));
  if (filas.length < 3) errores.push('El mapa está vacío o tiene muy pocas filas.');
  const ancho = filas.length ? filas[0].length : 0;
  const validos = '#.,;~12WLBSOYMV';
  let inicio = null;
  filas.forEach((f, y) => {
    if (f.length !== ancho) errores.push('La fila ' + (y + 1) + ' tiene ' + f.length + ' caracteres y debería tener ' + ancho + ' (como la fila 1).');
    for (let x = 0; x < f.length; x++) {
      const c = f[x];
      if (!validos.includes(c)) { errores.push('Carácter no válido "' + c + '" en la fila ' + (y + 1) + ', columna ' + (x + 1) + '.'); break; }
      if (c === 'S') {
        if (inicio) errores.push('Hay más de una S (punto de inicio). Deja solo una.');
        else inicio = { x: x + 0.5, y: y + 0.5, a: 0 };
      }
    }
  });
  if (!inicio && DATOS_NIVEL.inicio) inicio = { x: DATOS_NIVEL.inicio.x, y: DATOS_NIVEL.inicio.y, a: DATOS_NIVEL.inicio.a || 0 };
  if (!inicio) errores.push('Falta la S (punto de inicio del jugador) en el mapa.');
  const limpias = filas.map(f => f.replace(/S/g, '.'));
  if (inicio && !errores.length) {
    const c = (limpias[Math.floor(inicio.y)] || '')[Math.floor(inicio.x)];
    if (!'.,;~'.includes(c)) errores.push('El punto de inicio cae sobre un muro. Muévelo a una casilla libre.');
  }
  if (errores.length) return { filas: ['###', '#.#', '###'], inicio: { x: 1.5, y: 1.5, a: 0 }, errores };
  return { filas: limpias, inicio, errores };
}
const NIVEL_LEIDO = leerNivel();
const MAP = NIVEL_LEIDO.filas;
const INICIO = NIVEL_LEIDO.inicio;
const MH = MAP.length, MW = MAP[0].length;

// Qué hay en una posición: 0 = libre, o el tipo de muro (1..6)
function wallAt(x, y) {
  const mx = Math.floor(x), my = Math.floor(y);
  if (mx < 0 || my < 0 || mx >= MW || my >= MH) return 1;
  const c = MAP[my][mx];
  if (c === '.' || c === ',' || c === ';' || c === '~') return 0;   // libre: interior, patio, arena, agua baja
  if (c === '2') return 2;   // puerta
  if (c === '1') return 3;   // pilar / contenedor
  if (c === 'W') return 4;   // ventana
  if (c === 'L') return 5;   // salvavidas
  if (c === 'B') return 6;   // ladrillo
  if (c === 'O') return 7;   // mar (horizonte)
  if (c === 'Y') return 8;   // barco
  if (c === 'M') return 9;   // muro de base militar
  if (c === 'V') return 10;  // almacén (chapa)
  return 1;                  // casilleros
}

// OUT[i] = 1 si esa casilla es patio abierto (cielo en vez de techo)
const OUT = new Uint8Array(MW * MH);
for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) OUT[y * MW + x] = (MAP[y][x] === ',' || MAP[y][x] === ';' || MAP[y][x] === '~') ? 1 : 0;

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
  const sx = Math.floor(INICIO.x), sy = Math.floor(INICIO.y);
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
const FALTANTES = [];   // archivos de assets/imagenes/ que no se pudieron cargar

function cargarImagen(ruta, avisar) {
  return new Promise(resolve => {
    const im = new Image();
    im.onload = () => resolve(im);
    im.onerror = () => { if (avisar !== false) FALTANTES.push(ruta); resolve(null); };
    im.src = ruta;
  });
}

// Mide una imagen o lienzo
function dim(img) { return [img.naturalWidth || img.width, img.naturalHeight || img.height]; }

// Deja cada rival en un lienzo de 100x160 (proporción 5:8): se ajusta sin deformarse,
// apoyado abajo y centrado. Así sirven imágenes de cualquier tamaño.
// Hace dos versiones: normal (con algo de sombra) y "golpeado" (se ve blanco).
function crearVariantes(im, sx, sy, sw, sh) {
  if (!im) return null;
  if (sx === undefined) { const d = dim(im); sx = 0; sy = 0; sw = d[0]; sh = d[1]; }   // imagen completa
  const esc = Math.min(100 / sw, 160 / sh), dw = sw * esc, dh = sh * esc;
  const hacer = (golpeado) => {
    const c = document.createElement('canvas');
    c.width = 100; c.height = 160;
    const g = c.getContext('2d');
    g.imageSmoothingEnabled = !CONFIG.spritesPixelados;
    g.drawImage(im, sx, sy, sw, sh, (100 - dw) / 2, 160 - dh, dw, dh);
    g.globalCompositeOperation = 'source-atop';
    const gr = g.createLinearGradient(0, 0, 100, 0);
    gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,0.28)');
    g.fillStyle = gr; g.fillRect(0, 0, 100, 160);
    if (golpeado) { g.fillStyle = 'rgba(255,255,255,0.55)'; g.fillRect(0, 0, 100, 160); }
    return c;
  };
  return { n: hacer(false), h: hacer(true) };
}

// Corta una hoja de sprites en sus cuadros (cada uno con su versión normal y "golpeada")
function cuadrosDeHoja(im) {
  const [iw, ih] = dim(im);
  const cw = iw / HOJA.columnas, ch = ih / HOJA.filas, cuadros = [];
  for (let f = 0; f < HOJA.columnas * HOJA.filas; f++) {
    cuadros.push(crearVariantes(im, (f % HOJA.columnas) * cw, Math.floor(f / HOJA.columnas) * ch, cw, ch));
  }
  return cuadros;
}

// Carga un rival: primero busca su hoja (<id>_<n>_hoja.png); si no hay, usa la imagen sola
async function cargarEnemigo(id, n) {
  const base = 'assets/imagenes/enemigos/' + id + '_' + n;
  const hoja = await cargarImagen(base + '_hoja.png', false);
  if (hoja) return { frames: cuadrosDeHoja(hoja), hoja: true };
  const v = crearVariantes(await cargarImagen(base + '.png'));
  return v ? { frames: [v], hoja: false } : null;
}

async function cargarSprites() {
  const tareas = [];

  TYPES.forEach((t, ti) => {
    SPR.enemigos[ti] = [];
    for (let v = 0; v < NUM_VARIANTES; v++) {
      tareas.push(cargarEnemigo(t.id, v + 1).then(set => { SPR.enemigos[ti][v] = set; }));
    }
  });

  ['pistola', 'escopeta', 'fusil', 'ametralladora', 'fogonazo'].forEach(nombre => {
    tareas.push(cargarImagen('assets/imagenes/armas/' + nombre + '.png').then(im => { SPR.armas[nombre] = im; }));
  });
  tareas.push(cargarImagen('assets/imagenes/items/colacion.png').then(im => { SPR.colacion = im; }));

  await Promise.all(tareas);

  // si a un tipo de rival le falta alguna versión, usa las que sí existen
  TYPES.forEach((t, ti) => {
    const ok = SPR.enemigos[ti].filter(Boolean);
    for (let v = 0; v < NUM_VARIANTES; v++) if (!SPR.enemigos[ti][v] && ok.length) SPR.enemigos[ti][v] = ok[v % ok.length];
  });
  FALTANTES.sort();

  // Si falta una imagen, se usa una figura simple para poder probar el juego igual
  TYPES.forEach((t, ti) => {
    if (!SPR.enemigos[ti].some(Boolean)) {
      const set = { frames: [crearVariantes(figuraEnemigo(ti))], hoja: false };
      for (let k = 0; k < NUM_VARIANTES; k++) SPR.enemigos[ti][k] = set;
    }
  });
  ['pistola', 'escopeta', 'fusil', 'ametralladora'].forEach(n => {
    if (!SPR.armas[n]) SPR.armas[n] = lienzo(48, 80, g => { g.fillStyle = '#6b7280'; g.fillRect(20, 6, 8, 60); g.fillStyle = '#ecb88e'; g.fillRect(14, 50, 20, 18); });
  });
  if (!SPR.armas.fogonazo) SPR.armas.fogonazo = lienzo(40, 40, g => { g.fillStyle = '#ffd24a'; g.beginPath(); g.arc(20, 20, 14, 0, 7); g.fill(); });
  if (!SPR.colacion) SPR.colacion = lienzo(24, 16, g => { g.fillStyle = '#d9a95a'; g.fillRect(2, 3, 20, 10); });
}

function lienzo(w, h, dibujar) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  dibujar(c.getContext('2d'));
  return c;
}
const COLORES_FIGURA = ['#3a5a9a', '#c0392b', '#333333', '#777777', '#1f6b45'];
function figuraEnemigo(ti) {
  return lienzo(100, 160, g => {
    g.fillStyle = COLORES_FIGURA[ti % COLORES_FIGURA.length];
    g.fillRect(25, 55, 50, 70); g.fillRect(30, 125, 15, 35); g.fillRect(55, 125, 15, 35);
    g.fillStyle = '#e0ac86'; g.beginPath(); g.arc(50, 32, 24, 0, 7); g.fill();
  });
}

// ############################################################
// ## 5. JUEGO: estado, rivales, combate y actualización
// ############################################################

const player = { x: INICIO.x, y: INICIO.y, a: INICIO.a, hp: CONFIG.vidaInicial };
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
  player.x = INICIO.x; player.y = INICIO.y; player.a = INICIO.a;
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
                 hp: TYPES[type].hp, atk: 0.6, flash: 0,
                 walkT: Math.random() * 4, pain: 0, atkAnim: 0, muriendo: 0 });
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
  e.muriendo = MUERTE_SEG;           // empieza la animación de muerte; luego se quita solo
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
  if (e.muriendo > 0) return;
  e.hp -= dmg; e.flash = 0.15; e.pain = 0.25;
  const dx = e.x - player.x, dy = e.y - player.y, d = Math.hypot(dx, dy) || 1;
  tryMove(e, (dx / d) * kb, (dy / d) * kb, 0.2);
  if (e.hp <= 0) killEnemy(e);
}

function attack() {
  if (state === 'menu' || (state === 'over' && overT <= 0)) { resetGame(); return; }
  if (state !== 'play' || cooldown > 0) return;
  const wp = WEAPONS[weapon];
  cooldown = wp.cd; punchT = wp.dur; punchMax = wp.dur;
  const dx = Math.cos(player.a), dy = Math.sin(player.a);

  // disparo: cada bala es un rayo que golpea al rival más cercano en esa dirección
  beep(wp.snd, 0.12, 'sawtooth', 0.08); beep(wp.snd * 0.5, 0.18, 'square', 0.05);
  let hit = false;
  for (let k = 0; k < wp.pellets; k++) {
    const ang = player.a + (Math.random() - 0.5) * wp.spread;
    const bx = Math.cos(ang), by = Math.sin(ang);
    let best = null, bd = 1e9;
    for (const e of enemies) {
      if (e.muriendo > 0) continue;
      const ex = e.x - player.x, ey = e.y - player.y, along = ex * bx + ey * by;
      if (along < 0.2 || along > wp.range || along >= bd) continue;
      if (Math.abs(ex * by - ey * bx) > 0.3) continue;                 // qué tan centrado va el rival
      if (!hasLOS(player.x, player.y, e.x, e.y)) continue;
      bd = along; best = e;
    }
    if (best) { hitEnemy(best, wp.dmg, wp.kb); hit = true; }
  }
  if (hit) beep(300, 0.06, 'square', 0.06);
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
    if (e.muriendo > 0) { e.muriendo -= dt; if (e.muriendo <= 0) e.dead = true; continue; }
    const t = TYPES[e.type];
    e.flash = Math.max(0, e.flash - dt);
    e.pain = Math.max(0, (e.pain || 0) - dt);
    e.atkAnim = Math.max(0, (e.atkAnim || 0) - dt);
    e.atk -= dt;
    const d = Math.hypot(player.x - e.x, player.y - e.y);
    const reach = 0.6 + t.sc * 0.15;
    if (d > reach) {
      steer(e, dt, t.spd * mul);
      e.walkT = (e.walkT || 0) + dt * (3 + 3 * t.spd);       // avanza el ciclo de caminata
    } else if (e.atk <= 0) {
      player.hp -= t.dmg; e.atk = 0.9; e.atkAnim = 0.45; redFlash = 0.18;
      beep(110, 0.12, 'sawtooth', 0.07);
    }
  }
  enemies = enemies.filter(e => !e.dead);
  // que no se amontonen
  for (let i = 0; i < enemies.length; i++) for (let j = i + 1; j < enemies.length; j++) {
    const a = enemies[i], b = enemies[j];
    if (a.muriendo > 0 || b.muriendo > 0) continue;
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
  if (enemies.filter(e => !(e.muriendo > 0)).length < objetivo && spawnT <= 0) {
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
      if (out) {                                   // exterior: cemento, arena o agua, con cielo
        const tx = fx - cxm, ty = fy - cym;
        const tc = MAP[cym][cxm];
        if (tc === ';') {                          // arena
          const n = ((Math.floor(fx * 9) * 7 + Math.floor(fy * 9) * 13) & 7) * 3;
          fr = 206 + n; fg = 182 + n; fb = 128 + n;
        } else if (tc === '~') {                   // agua baja con olitas
          const o = Math.sin(fx * 5 + fy * 3) * Math.sin(fy * 6 - fx * 2);
          fr = 48 + o * 14; fg = 128 + o * 18; fb = 188 + o * 14;
          if (o > 0.82) { fr += 70; fg += 70; fb += 50; }
        } else {                                   // cemento
          const base = ((cxm + cym) & 1) ? 150 : 140;
          fr = base; fg = base; fb = base - 6;
          if (tx < 0.04 || ty < 0.04) { fr -= 35; fg -= 35; fb -= 35; }
        }
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
    } else if (type === 7) {                  // mar al fondo: olas
      const o = Math.sin(wx * 40 + mapX) * 0.5 + 0.5;
      ctx.fillStyle = rgb(0.7 + o * 0.5); ctx.fillRect(x, top + lineH * 0.45, 1, lineH * 0.55);
      ctx.fillStyle = rgb(1.6); ctx.fillRect(x, top + lineH * (0.45 + o * 0.08), 1, Math.max(0.5, lineH * 0.02));
    } else if (type === 8) {                  // barco: casco blanco con franja y ojos de buey
      const v = (mapX * 7 + mapY * 3) % 3, fr3 = [[200, 45, 45], [40, 90, 170], [230, 170, 40]][v];
      const rc = (r, g, b) => `rgb(${(r * shade) | 0},${(g * shade) | 0},${(b * shade) | 0})`;
      ctx.fillStyle = rc(fr3[0], fr3[1], fr3[2]); ctx.fillRect(x, top + lineH * 0.62, 1, lineH * 0.38);
      ctx.fillStyle = rc(250, 250, 250); ctx.fillRect(x, top + lineH * 0.58, 1, lineH * 0.04);
      const k = (wx * 3) % 1;
      if (k > 0.3 && k < 0.7) { ctx.fillStyle = rc(60, 100, 140); ctx.fillRect(x, top + lineH * 0.25, 1, lineH * 0.16); }
      if (k > 0.26 && k < 0.3 || k > 0.7 && k < 0.74) { ctx.fillStyle = rc(120, 120, 130); ctx.fillRect(x, top + lineH * 0.23, 1, lineH * 0.2); }
    } else if (type === 9) {                  // base militar: camuflaje y franja
      const n = Math.sin(wx * 23 + mapX * 5.1) + Math.sin(wx * 9 - mapY * 3.7);
      if (n > 0.7) { ctx.fillStyle = rgb(0.62); ctx.fillRect(x, top, 1, lineH); }
      else if (n < -0.9) { ctx.fillStyle = rgb(1.25); ctx.fillRect(x, top + lineH * 0.15, 1, lineH * 0.5); }
      ctx.fillStyle = rgb(0.5); ctx.fillRect(x, top + lineH * 0.88, 1, lineH * 0.12);
      if (wx > 0.4 && wx < 0.6) { ctx.fillStyle = `rgb(${(230 * shade) | 0},${(200 * shade) | 0},${(60 * shade) | 0})`; ctx.fillRect(x, top + lineH * 0.1, 1, lineH * 0.06); }
    } else if (type === 10) {                 // almacén: chapa acanalada
      const g = Math.sin(wx * 90);
      ctx.fillStyle = rgb(0.82 + g * 0.22); ctx.fillRect(x, top, 1, lineH);
      if (((mapX + mapY) & 1) && wx > 0.15 && wx < 0.3) { ctx.fillStyle = `rgb(${(130 * shade) | 0},${(70 * shade) | 0},${(40 * shade) | 0})`; ctx.fillRect(x, top + lineH * 0.3, 1, lineH * 0.7); }
      ctx.fillStyle = `rgb(${(230 * shade) | 0},${(190 * shade) | 0},${(40 * shade) | 0})`;
      if (Math.floor(wx * 8 + ((mapX + mapY) & 1)) & 1) ctx.fillRect(x, top + lineH * 0.9, 1, lineH * 0.1);
    } else if (type === 3) {                  // pilar / contenedor
      if (((wx * 2) % 1) < 0.08) { ctx.fillStyle = rgb(0.6); ctx.fillRect(x, top, 1, lineH); }
    }
  }
}

// ---------- Rivales y objetos (sprites) ----------
// Elige qué cuadro mostrar según lo que hace el rival: caminar, atacar, dolor o muerte.
// Si el rival no tiene hoja de sprites (solo una imagen), se usa esa imagen siempre.
function elegirCuadro(e, set) {
  const fr = set.frames;
  const f = (i) => (fr[i] || fr[0]);
  if (e.muriendo > 0) {
    const prog = 1 - e.muriendo / MUERTE_SEG;                 // 0 → 1 durante la muerte
    if (set.hoja) return { img: f(HOJA.muerte).n, escala: 1, alpha: prog > 0.6 ? 1 - (prog - 0.6) / 0.4 : 1 };
    return { img: fr[0].h, escala: Math.max(0.12, 1 - prog), alpha: 1 - prog * 0.7 };   // sin hoja: se achica
  }
  if (!set.hoja) return { img: e.flash > 0 ? fr[0].h : fr[0].n, escala: 1, alpha: 1 };
  if (e.pain > 0) return { img: f(HOJA.dolor).n, escala: 1, alpha: 1 };
  if (e.atkAnim > 0) return { img: f(e.atkAnim > 0.22 ? HOJA.atacar[0] : HOJA.atacar[1]).n, escala: 1, alpha: 1 };
  return { img: f(HOJA.caminar[Math.floor(e.walkT || 0) % HOJA.caminar.length]).n, escala: 1, alpha: 1 };
}

function drawBillboards() {
  const dirX = Math.cos(player.a), dirY = Math.sin(player.a);
  const planeX = -dirY * 0.66, planeY = dirX * 0.66;
  const inv = 1 / (planeX * dirY - dirX * planeY);
  const things = [];
  for (const e of enemies) {
    const set = SPR.enemigos[e.type] && SPR.enemigos[e.type][e.v];
    if (!set) continue;
    const c = elegirCuadro(e, set);
    things.push({ x: e.x, y: e.y, img: c.img, iw: 100, ih: 160, sc: TYPES[e.type].sc * c.escala, asp: 0.625, alpha: c.alpha });
  }
  if (SPR.colacion) {
    const [cw, ch] = dim(SPR.colacion);
    for (const it of items) things.push({ x: it.x, y: it.y, img: SPR.colacion, iw: cw, ih: ch, sc: 0.12, asp: cw / ch });
  }
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
    ctx.globalAlpha = t.alpha === undefined ? 1 : t.alpha;
    for (let x = Math.max(0, x0); x < Math.min(W, x1); x++) {
      if (ty >= zbuf[x]) continue;
      const srcX = Math.min(t.iw - 1, Math.floor((x - x0) / w * t.iw));
      ctx.drawImage(t.img, srcX, 0, 1, t.ih, x, top, 1, h);
    }
    ctx.globalAlpha = 1;
  }
}

// ---------- Arma en mano ----------
// Cada imagen se dibuja con su propia proporción (alto fijo), así sirve cualquier tamaño.
function drawHeldWeapon() {
  const A = SPR.armas, wp = WEAPONS[weapon], img = A[wp.img];
  if (!img) return;
  const p = punchT > 0 ? 1 - punchT / punchMax : 1;     // 0..1 durante el disparo
  const retro = punchT > 0 ? Math.sin(p * Math.PI) * 14 : 0;   // retroceso
  const cx = W / 2 + 18 + Math.sin(walk) * 2;
  const alto = wp.img === 'pistola' ? 108 : 124;
  const [iw, ih] = dim(img), w = alto * iw / ih;
  const y = VH - alto + 6 + retro + Math.abs(Math.cos(walk)) * 1.5;
  ctx.drawImage(img, cx - w / 2, y, w, alto);
  if (punchT > 0 && p < 0.55 && A.fogonazo) {           // fogonazo en la boca del arma
    const fs = 36 + Math.random() * 10;
    ctx.drawImage(A.fogonazo, cx - fs / 2, y - fs * 0.55, fs, fs);
    ctx.fillStyle = 'rgba(255,220,120,0.10)'; ctx.fillRect(0, 0, W, VH);
  }
  ctx.fillStyle = 'rgba(255,255,255,0.8)';              // mira
  ctx.fillRect(W / 2 - 1, VH / 2 - 5, 2, 3); ctx.fillRect(W / 2 - 1, VH / 2 + 2, 2, 3);
  ctx.fillRect(W / 2 - 5, VH / 2 - 1, 3, 2); ctx.fillRect(W / 2 + 2, VH / 2 - 1, 3, 2);
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
    ctx.fillStyle = c === ',' ? 'rgba(140,190,140,0.4)' : c === ';' ? 'rgba(230,205,140,0.55)' : c === '~' ? 'rgba(70,150,220,0.55)' : c === 'M' ? '#667a4e' : c === 'Y' ? '#e8e8ee' : c === 'V' ? '#a09484' : '#6a7f99';
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
  if (state === 'menu') drawOverlay(NOMBRE_JUEGO.toUpperCase(), ['Desembarco · playa, puerto y base enemiga', 'Cada baja trae más enemigos y nuevas armas', 'Toca o presiona Espacio para empezar']);
  if (state === 'over') drawOverlay('¡TE ABATIERON!', ['Puntos: ' + score + ' · Bajas: ' + kills, overT > 0 ? ' ' : 'Toca para jugar de nuevo']);
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

// Muestra un cuadro de aviso sobre el juego (errores del mapa o imágenes que faltan)
function mostrarAviso(titulo, lineas, grave) {
  const d = document.createElement('div');
  d.style.cssText = 'position:fixed;left:8px;right:8px;top:8px;max-height:60vh;overflow:auto;z-index:99;padding:10px 12px;'
    + 'border-radius:10px;font:13px/1.4 Arial,sans-serif;color:#fff;background:' + (grave ? '#8f1d1d' : '#8a6d12') + ';';
  d.innerHTML = '<b>' + titulo + '</b><br>' + lineas.slice(0, 12).map(l => '• ' + l).join('<br>')
    + (lineas.length > 12 ? '<br>… y ' + (lineas.length - 12) + ' más' : '');
  if (!grave) d.onclick = () => d.remove();
  document.body.appendChild(d);
}

cargarSprites().then(() => {
  if (NIVEL_LEIDO.errores.length) {
    mostrarAviso('Hay errores en mapa.js (arréglalos y recarga la página):', NIVEL_LEIDO.errores, true);
    return;
  }
  if (FALTANTES.length) mostrarAviso('Faltan estas imágenes (mientras tanto se usan figuras simples; toca para cerrar):', FALTANTES, false);
  computeFlow();
  // rivales de fondo para el menú
  for (let i = 0; i < 4; i++) spawnEnemy();
  last = performance.now();
  requestAnimationFrame(loop);
});

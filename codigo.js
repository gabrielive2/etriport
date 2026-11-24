// ============================================================
// codigo.js — todo el código del juego "Guerra Anfibia"
// Carpetas del juego:  assets/ (mapa.js y los dibujos PNG en sprite/) · codigo/ (este archivo)
// El ajuste más fácil de tocar está en el bloque CONFIG, al inicio de la sección 1.
// ============================================================

// ############################################################
// ## 1. AJUSTES, RIVALES Y ARMAS
// ############################################################

const CONFIG = {
  vidaInicial: 100,
  velocidadJugador: 3.4,        // casillas por segundo
  enemigosIniciales: 35,         // rivales al empezar
  enemigosMax: 110,              // tope de rivales a la vez
  bajasPorEnemigoExtra: 1,      // cada X bajas se suma 1 rival al máximo actual
  distanciaAparicion: 8,        // los rivales aparecen al menos a tantas casillas de ti
  intervaloAparicion: 0.8,      // segundos entre apariciones (baja con las bajas)
  intervaloMinimo: 0.25,
  curaColacion: 20,             // vida que da una ración
  probColacion: 0.18,           // probabilidad de que un enemigo suelte una ración
  danoAgua: 7,                  // vida que pierdes por segundo en mar profundo
  velAgua: 0.45,                // velocidad en el mar (1 = normal)
  danoAmigo: 8,                 // fuego amigo: daño = daño del arma × este número (la vida es 100)
  danoEnemigos: 1.0,            // multiplicador del daño de los disparos enemigos
  armasPorBajas: false,         // true = además se desbloquean por bajas; false = solo las encuentras en el mapa
  spritesPixelados: true        // true = pixeles nítidos estilo Doom; false = suavizado
};

// Pantalla interna (baja resolución, estilo Doom)
const W = 320, H = 200, VH = 176;   // VH = alto de la vista 3D (el resto es la barra de estado)
const cv = document.getElementById('c');
cv.width = W; cv.height = H;
const ctx = cv.getContext('2d');
ctx.imageSmoothingEnabled = false;

// número pseudoaleatorio fijo (0..1) para dar variedad a texturas
function hs(a, b) { let h = (Math.imul(a | 0, 73856093) ^ Math.imul(b | 0, 19349663)) >>> 0; h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0; return (h & 1023) / 1023; }

// Colores de muros por tipo (1 casilleros, 2 puerta, 3 pilar, 4 ventana, 5 salvavidas, 6 ladrillo)
const WALL_COLORS = {
  1: [72, 92, 118], 2: [150, 118, 82], 3: [128, 128, 134],
  4: [196, 190, 176], 5: [52, 84, 128], 6: [158, 86, 64],
  7: [40, 96, 160], 8: [222, 222, 228], 9: [78, 92, 60], 10: [150, 142, 128],   // mar, barco, base militar, almacén
  11: [128, 122, 114], 12: [44, 104, 48], 13: [160, 112, 62], 14: [190, 48, 38]   // piedra, seto, caja, barril
};
// Casas de colores que se ven por las ventanas
const HOUSES = [[200, 70, 60], [230, 170, 50], [60, 140, 170], [90, 170, 90], [220, 120, 150], [240, 230, 200]];

// ------------------------------------------------------------
// Rivales. Aparecen más tipos a medida que tumbas más rivales.
//   id      → nombre de los archivos en sprite/<id>_1.png ... _3.png
//   hp      → golpes de "vida"
//   spd     → velocidad (casillas por segundo)
//   dmg     → daño que te hace cada golpe
//   pts     → puntos al tumbarlo
//   sc      → tamaño en pantalla (1 = alto del muro)
//   unlock  → bajas necesarias para que empiece a aparecer
//   w       → "peso": qué tan seguido sale frente a los demás
// ------------------------------------------------------------
const TYPES = [
  // arma → qué lleva · rango → a cuántas casillas dispara · cad → segundos entre disparos
  // dmgD → daño por disparo · prec → puntería (0 a 1; baja con la distancia)
  { id: 'marinero',   name: 'Marinero',    hp: 3,  spd: 1.0,  dmg: 6,  pts: 10, sc: 0.80, unlock: 0,  w: 10, arma: 'pistola',  rango: 7,  cad: 1.5, dmgD: 3, prec: 0.55 },
  { id: 'explorador', name: 'Explorador',  hp: 2,  spd: 1.9,  dmg: 4,  pts: 15, sc: 0.76, unlock: 4,  w: 6,  arma: 'subfusil', rango: 6,  cad: 0.5, dmgD: 2, prec: 0.45 },
  { id: 'granadero',  name: 'Granadero',   hp: 6,  spd: 0.8,  dmg: 10, pts: 25, sc: 0.95, unlock: 9,  w: 5,  arma: 'escopeta', rango: 5,  cad: 1.9, dmgD: 7, prec: 0.6 },
  { id: 'oficial',    name: 'Oficial',     hp: 9,  spd: 0.7,  dmg: 12, pts: 40, sc: 0.90, unlock: 16, w: 3,  arma: 'pistola',  rango: 10, cad: 1.0, dmgD: 5, prec: 0.65 },
  { id: 'comandante', name: 'Comandante',  hp: 14, spd: 0.95, dmg: 15, pts: 80, sc: 1.05, unlock: 25, w: 2,  arma: 'fusil',    rango: 12, cad: 0.6, dmgD: 4, prec: 0.7 },
  // TERCERA FUERZA (mercenarios que desembarcan de los barcos): atacan a los soldados enemigos Y a los jugadores. No salen por el sorteo normal (w: 0).
  { id: 'mercenario', name: 'Mercenario',  hp: 5,  spd: 1.3,  dmg: 8,  pts: 30, sc: 0.92, unlock: 99999, w: 0, arma: 'fusil',   rango: 9,  cad: 0.8, dmgD: 5, prec: 0.55 }
];
const NUM_VARIANTES = 3;   // cada tipo tiene 3 versiones de imagen (_1, _2, _3)

// ------------------------------------------------------------
// Hojas de sprites estilo Doom (opcional, mira LEEME.md)
// Archivo: sprite/<id>_<n>_hoja.png  (ej: marinero_1_hoja.png)
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
//   mag    → balas por cargador · reload → segundos que tarda en recargar (tecla R)
//   img    → archivo sprite/<img>.png
//   cd     → segundos entre ataques · dur → duración de la animación
//   kb     → empuje al rival
// ------------------------------------------------------------
const WEAPONS = [
  { name: 'PISTOLA',        img: 'pistola',       unlock: 0,  type: 'bala', dmg: 1, pellets: 1, spread: 0.02, range: 14, cd: 0.34, dur: 0.14, kb: 0.15, snd: 260, mag: 12, reload: 1.0 },
  { name: 'ESCOPETA',       img: 'escopeta',      unlock: 6,  type: 'bala', dmg: 1, pellets: 7, spread: 0.30, range: 8,  cd: 0.85, dur: 0.30, kb: 0.45, snd: 110, mag: 6,  reload: 1.4 },
  { name: 'FUSIL',          img: 'fusil',         unlock: 14, type: 'bala', dmg: 2, pellets: 1, spread: 0.03, range: 18, cd: 0.20, dur: 0.10, kb: 0.20, snd: 200, mag: 30, reload: 1.5 },
  { name: 'AMETRALLADORA',  img: 'ametralladora', unlock: 24, type: 'bala', dmg: 1, pellets: 1, spread: 0.10, range: 16, cd: 0.09, dur: 0.07, kb: 0.08, snd: 170, mag: 60, reload: 2.2 },
  { name: 'FRANCOTIRADOR',  img: 'francotirador', unlock: 36, type: 'bala', dmg: 6, pellets: 1, spread: 0.0,  range: 45, cd: 1.1,  dur: 0.25, kb: 0.5,  snd: 90,  mag: 5,    reload: 2.0 },
  { name: 'LANZACOHETES',   img: 'lanzacohetes',  unlock: 55, type: 'cohete', dmg: 10, pellets: 1, spread: 0,   range: 30, cd: 1.4,  dur: 0.3,  kb: 0,    snd: 70,  mag: 3,    reload: 2.6 },
  { name: 'CUCHILLO',       img: 'cuchillo',      unlock: 0,  type: 'bala', dmg: 3, pellets: 1, spread: 0.12, range: 1.4, cd: 0.45, dur: 0.2,  kb: 0.3,  snd: 600, mag: 9999, reload: 0.1 },
];
const WEAPON_MSG = ['', '¡NUEVA ARMA: ESCOPETA!', '¡NUEVA ARMA: FUSIL DE ASALTO!', '¡NUEVA ARMA: AMETRALLADORA!', '¡NUEVA ARMA: FRANCOTIRADOR! (alcance enorme)', '¡NUEVA ARMA: LANZACOHETES! (explota)', ''];

// ############################################################
// ## 2. MAPA: muros, patio y caminos de los rivales
// ############################################################

// Los datos del mapa vienen de mapa.js (lo haces tú). Si el archivo no existe, se avisa en pantalla.
const DATOS_NIVEL = (typeof NIVEL !== 'undefined') ? NIVEL : null;
const NOMBRE_JUEGO = (DATOS_NIVEL && DATOS_NIVEL.nombre) || 'Guerra Anfibia';

// Lee el mapa escrito en mapa.js y avisa en pantalla si tiene errores
function leerNivel() {
  if (!DATOS_NIVEL) {
    return { filas: ['###', '#.#', '###'], inicio: { x: 1.5, y: 1.5, a: 0 },
             errores: ['No se encontró mapa.js. Crea ese archivo con el mapa (el formato está en LEEME.md).'] };
  }
  const errores = [];
  const filas = String(DATOS_NIVEL.mapa || '').split('\n').map(f => f.trim()).filter(f => f && !f.startsWith('//'));
  if (filas.length < 3) errores.push('El mapa está vacío o tiene muy pocas filas.');
  const ancho = filas.length ? filas[0].length : 0;
  const validos = '#.,;~=rhvg:12WLBSOYMVFAKDU';
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
    if (!'.,;~=rhvg:'.includes(c)) errores.push('El punto de inicio cae sobre un muro. Muévelo a una casilla libre.');
  }
  if (errores.length) return { filas: ['###', '#.#', '###'], inicio: { x: 1.5, y: 1.5, a: 0 }, errores };
  return { filas: limpias, inicio, errores, barcos: DATOS_NIVEL.barcos || [], objetos: DATOS_NIVEL.objetos || [], canones: DATOS_NIVEL.canones || [], ametralladoras: DATOS_NIVEL.ametralladoras || [], escape: DATOS_NIVEL.objetivos_escape || null, camiones: DATOS_NIVEL.camiones || [], tanques: DATOS_NIVEL.tanques || [], escaleras: DATOS_NIVEL.escaleras || [], salas: DATOS_NIVEL.salas || [], altos: DATOS_NIVEL.altos || null };
}
const NIVEL_LEIDO = leerNivel();
const MAP = NIVEL_LEIDO.filas;
const INICIO = NIVEL_LEIDO.inicio;
const MH = MAP.length, MW = MAP[0].length;
const BOATMASK = new Uint8Array(MW * MH);   // casillas ocupadas por barcos que se mueven (id del barco)
const VSOL = new Uint8Array(MW * MH);       // de esas casillas, las que son casco (muro). El resto es cubierta: se camina

// Qué hay en una posición: 0 = libre, o el tipo de muro (1..6)
function wallAt(x, y) {
  const mx = Math.floor(x), my = Math.floor(y);
  if (mx < 0 || my < 0 || mx >= MW || my >= MH) return 1;
  if (BOATMASK[my * MW + mx]) return VSOL[my * MW + mx] ? 8 : 0;   // barco: casco = muro, cubierta = piso
  const c = MAP[my][mx];
  if ('.,;~=rhvg:U'.includes(c)) return 0;   // libre (U = escalera): interior, patio, arena, agua, asfalto, pasto, piso de piedra
  if (c === '2') return 2;   // puerta
  if (c === '1') return 3;   // pilar / contenedor
  if (c === 'W') return 4;   // ventana
  if (c === 'L') return 5;   // salvavidas
  if (c === 'B') return 6;   // ladrillo
  if (c === 'O') return 7;   // mar (horizonte)
  if (c === 'Y') return 8;   // barco
  if (c === 'M') return 9;   // muro de base militar
  if (c === 'V') return 10;  // almacén (chapa)
  if (c === 'F') return 11;  // muro de piedra (fortaleza)
  if (c === 'A') return 12;  // seto
  if (c === 'K') return 13;  // caja de madera
  if (c === 'D') return 14;  // barril
  return 1;                  // casilleros
}

// ¿Mar profundo? (el jugador se hunde; los enemigos no entran)
function hondo(x, y) {
  const mx = Math.floor(x), my = Math.floor(y);
  return mx >= 0 && my >= 0 && mx < MW && my < MH && MAP[my][mx] === '=' && !BOATMASK[my * MW + mx];   // sobre la cubierta de un barco no te hundes
}

// OUT[i] = 1 si esa casilla es patio abierto (cielo en vez de techo)
const TCH = []; for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) TCH.push(MAP[y][x]);   // mapa plano (más rápido que MAP[y][x] por píxel)
const OUT = new Uint8Array(MW * MH);
for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) OUT[y * MW + x] = ',;~=rhvg'.includes(MAP[y][x]) ? 1 : 0;

// Mapa de distancias hacia el jugador: así los rivales encuentran el camino
const DIRS8 = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
const dist = new Int16Array(MW * MH);
function computeFlow() {
  dist.fill(-1);
  const q = [];
  for (const P of objetivos()) {                       // el mapa de distancias parte desde todos los jugadores vivos
    const sx = Math.floor(P.x), sy = Math.floor(P.y);
    if (sx < 0 || sy < 0 || sx >= MW || sy >= MH || dist[sy * MW + sx] !== -1) continue;
    dist[sy * MW + sx] = 0; q.push([sx, sy]);
  }
  for (let i = 0; i < q.length; i++) {
    const [x, y] = q[i];
    for (let k = 0; k < 4; k++) {
      const nx = x + DIRS8[k][0], ny = y + DIRS8[k][1];
      if (nx < 0 || ny < 0 || nx >= MW || ny >= MH) continue;
      if (dist[ny * MW + nx] !== -1 || wallAt(nx + 0.5, ny + 0.5) !== 0 || hondo(nx + 0.5, ny + 0.5)) continue;
      dist[ny * MW + nx] = dist[y * MW + x] + 1;
      q.push([nx, ny]);
    }
    const L = LINK[y * MW + x];                            // escaleras: unen un piso con otro
    if (L >= 0 && dist[L] === -1) { dist[L] = dist[y * MW + x] + 1; q.push([L % MW, Math.floor(L / MW)]); }
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
      if (!seen.has(k) && wallAt(nx + 0.5, ny + 0.5) === 0 && !hondo(nx + 0.5, ny + 0.5)) { seen.add(k); q.push([nx, ny]); }
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

// ---------- Balas: choque real contra paredes y obstáculos (hitbox) ----------
// Distancia hasta la primera pared siguiendo exactamente la trayectoria de la bala (recorrido por celdas).
function rayWall(sx, sy, bx, by, max) {
  let mx = Math.floor(sx), my = Math.floor(sy);
  const dX = Math.abs(1 / (bx || 1e-9)), dY = Math.abs(1 / (by || 1e-9)), stX = bx < 0 ? -1 : 1, stY = by < 0 ? -1 : 1;
  let sdX = (bx < 0 ? sx - mx : mx + 1 - sx) * dX, sdY = (by < 0 ? sy - my : my + 1 - sy) * dY, d = 0;
  while (d < max) {
    if (sdX < sdY) { mx += stX; d = sdX; sdX += dX; } else { my += stY; d = sdY; sdY += dY; }
    if (d < max && wallAt(mx + 0.5, my + 0.5)) return d;
  }
  return max;
}
// Obstáculos redondos que paran las balas: camiones, tanques y torres de cañón (si no estás dentro de ellos)
function obstaculosBala() {
  const L = [];
  for (const c of CAM) if (c.piloto !== 99) L.push({ o: c, x: c.x, y: c.y, r: c.tipo === 'tanque' ? 0.95 : 0.85 });
  for (const c of CAN) if (c.alto) L.push({ o: c, x: c.x, y: c.y, r: 0.42 });
  return L;
}
function rayObst(sx, sy, bx, by, max, exc, excB) {
  let best = max;
  for (const q of obstaculosBala()) {
    if (q.o === exc || q.o === excB) continue;
    const ox = q.x - sx, oy = q.y - sy;
    if (Math.hypot(ox, oy) < q.r + 0.05) continue;                    // estás pegado o dentro: no te tapa
    const along = ox * bx + oy * by; if (along < 0.1 || along > best) continue;
    const perp = Math.abs(ox * by - oy * bx); if (perp >= q.r) continue;
    best = Math.min(best, along - Math.sqrt(q.r * q.r - perp * perp));
  }
  return best;
}
function hitR(e) { const t = TYPES[e.type]; return 0.28 * (t ? t.sc : 0.9) / 0.9 * (e.jefe ? 1.3 : 1); }   // radio del cuerpo del enemigo
function tapado(ax, ay, bx, by, exc, excB) {                          // ¿algo (camión, tanque, torre) cubre el tiro de A a B?
  const d = Math.hypot(bx - ax, by - ay); if (d < 0.2) return false;
  const dx = (bx - ax) / d, dy = (by - ay) / d;
  return rayObst(ax, ay, dx, dy, d, exc, excB) < d - 0.05;
}

function canMove(x, y, r, evitaMar) {
  if (wallAt(x - r, y - r) || wallAt(x + r, y - r) || wallAt(x - r, y + r) || wallAt(x + r, y + r)) return false;
  return !(evitaMar && (hondo(x - r, y - r) || hondo(x + r, y - r) || hondo(x - r, y + r) || hondo(x + r, y + r)));
}
// Mueve un objeto deslizándose por las paredes
function tryMove(o, dx, dy, r, evitaMar) {
  if (canMove(o.x + dx, o.y, r, evitaMar)) o.x += dx;
  if (canMove(o.x, o.y + dy, r, evitaMar)) o.y += dy;
}

// ############################################################
// ## 3. SONIDO
// ############################################################

let actx = null;
let silencio = false;
function beep(freq, dur, type, vol) {
  if (silencio) return;
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


// ---------- Sonido: disparos, explosiones, pasos, oleaje y música (todo sintetizado, sin archivos) ----------
let master = null, bufR = null;
function audio() {
  try {
    if (!actx) actx = new (window.AudioContext || window.webkitAudioContext)();
    if (actx.state === 'suspended') actx.resume();
    if (!master) { const comp = actx.createDynamicsCompressor(); master = actx.createGain(); master.gain.value = 0.9; master.connect(comp); comp.connect(actx.destination); }
    return actx;
  } catch (e) { return null; }
}
function bufRuido(a) { if (!bufR) { bufR = a.createBuffer(1, a.sampleRate * 2, a.sampleRate); const d = bufR.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; } return bufR; }
function salida(a, nodo, pan) {
  if (pan && a.createStereoPanner) { const p = a.createStereoPanner(); p.pan.value = pan; nodo.connect(p); p.connect(master); } else nodo.connect(master);
}
function ruido(dur, tipo, f0, f1, vol, pan) {
  if (silencio) return; const a = audio(); if (!a) return; const t = a.currentTime;
  const src = a.createBufferSource(); src.buffer = bufRuido(a);
  const f = a.createBiquadFilter(); f.type = tipo; f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(Math.max(30, f1), t + dur); f.Q.value = 0.9;
  const g = a.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f); f.connect(g); salida(a, g, pan); src.start(t, Math.random()); src.stop(t + dur + 0.05);
}
function tono(f0, f1, dur, tipo, vol, pan, atq) {
  if (silencio) return; const a = audio(); if (!a) return; const t = a.currentTime;
  const o = a.createOscillator(); o.type = tipo || 'sine'; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
  const g = a.createGain(); g.gain.setValueAtTime(atq ? 0.0001 : vol, t); if (atq) g.gain.linearRampToValueAtTime(vol, t + atq); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); salida(a, g, pan); o.start(t); o.stop(t + dur + 0.05);
}
let ultHerido = 0;
const sfx = {
  disparo(wp) {
    switch (wp.img) {
      case 'escopeta': ruido(0.3, 'lowpass', 3200, 180, 0.7); tono(120, 38, 0.28, 'sine', 0.55); break;
      case 'fusil': ruido(0.11, 'bandpass', 1900, 700, 0.45); tono(150, 50, 0.12, 'sine', 0.4); break;
      case 'ametralladora': ruido(0.07, 'bandpass', 1500, 800, 0.35); tono(130, 60, 0.08, 'sine', 0.32); break;
      case 'francotirador': ruido(0.1, 'highpass', 2800, 1400, 0.5); ruido(0.8, 'lowpass', 900, 100, 0.4); tono(95, 28, 0.45, 'sine', 0.55); break;
      case 'lanzacohetes': ruido(0.6, 'bandpass', 500, 3000, 0.45); tono(85, 40, 0.35, 'sawtooth', 0.25); break;
      case 'cuchillo': ruido(0.12, 'highpass', 3000, 7000, 0.3); break;
      default: ruido(0.09, 'bandpass', 2200, 900, 0.4); tono(180, 60, 0.1, 'sine', 0.32);
    }
  },
  explosion(v) { v = v === undefined ? 1 : v; ruido(1.1, 'lowpass', 2200, 50, 0.95 * v); tono(85, 24, 0.9, 'sine', 0.75 * v); ruido(0.25, 'bandpass', 1200, 400, 0.3 * v); },
  grito(v, pan) {                                          // grito humano sintetizado: tono con vibrato + formantes + aire
    if (silencio) return; const a = audio(); if (!a) return; const t = a.currentTime, dur = 0.7 + Math.random() * 0.9, f0 = 260 + Math.random() * 380;
    const o = a.createOscillator(); o.type = 'sawtooth'; o.frequency.setValueAtTime(f0, t); o.frequency.linearRampToValueAtTime(f0 * (1.5 + Math.random() * 0.7), t + dur * 0.3); o.frequency.exponentialRampToValueAtTime(f0 * 0.65, t + dur);
    const lfo = a.createOscillator(), lg = a.createGain(); lfo.frequency.value = 5 + Math.random() * 4; lg.gain.value = 22; lfo.connect(lg); lg.connect(o.frequency);
    const g = a.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.4 * v, t + 0.04); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    for (const fq of [820 + Math.random() * 300, 1750 + Math.random() * 500]) { const bp = a.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = fq; bp.Q.value = 3.5; o.connect(bp); bp.connect(g); }
    salida(a, g, pan); o.start(t); lfo.start(t); o.stop(t + dur + 0.05); lfo.stop(t + dur + 0.05);
    ruido(dur * 0.8, 'bandpass', 2500, 1200, 0.16 * v, pan);
  },
  tiroEnemigo(arma, d) { const v = Math.max(0, 1 - d / 22); if (v < 0.05) return; if (arma === 'escopeta') { ruido(0.22, 'lowpass', 2600, 200, 0.45 * v); } else ruido(0.08, 'bandpass', Math.max(900, 1600 - d * 20), 700, 0.3 * v, (Math.random() - 0.5) * 0.8); },
  golpe() { tono(120, 45, 0.15, 'sine', 0.5); ruido(0.1, 'lowpass', 900, 200, 0.4); },
  herido() { const n = performance.now(); if (n - ultHerido < 180) return; ultHerido = n; tono(95, 45, 0.18, 'sine', 0.6); ruido(0.12, 'lowpass', 700, 150, 0.35); },
  paso(corre) { ruido(0.07, 'lowpass', corre ? 700 : 500, 160, corre ? 0.22 : 0.15, (Math.random() - 0.5) * 0.3); },
  latido(v) { tono(70, 34, 0.14, 'sine', 0.7 * v); setTimeout(() => tono(60, 32, 0.16, 'sine', 0.45 * v), 190); },
};

// ---------- Ambiente y modo tétrico ----------
let tet = 0, tetFiltroPrev = '', latidoT = 0, latidoPulso = 0, notaT = 3, susT = 6, susTxt = '', susTxtT = 0, flickerT = 0, pasoT = 0, ultPx = 0, ultPy = 0;
const SUSURROS = ['NO ESTÁS SOLO', '¿VALIÓ LA PENA?', 'SIGUEN VINIENDO', 'TAMBIÉN TENÍAN FAMILIA', 'NO MIRES ATRÁS', 'TE ESTÁN VIENDO', '¿CUÁNTOS YA?', 'EL MAR TE LLAMA', 'YA NO HAY VUELTA'];
const TETRICAS = { 35: 'El puerto se queda en silencio… demasiado silencio.', 65: 'Algo te observa desde el mar.', 90: 'Ya no recuerdas por qué empezaste a disparar.' };
const amb = { on: false };
function iniciarAmbiente() {
  const a = audio(); if (!a || amb.on) return; amb.on = true;
  amb.out = a.createGain(); amb.out.gain.value = 1; amb.out.connect(master);
  const w = a.createBufferSource(); w.buffer = bufRuido(a); w.loop = true;
  const wf = a.createBiquadFilter(); wf.type = 'lowpass'; wf.frequency.value = 420; amb.wg = a.createGain(); amb.wg.gain.value = 0.05;
  const lfo = a.createOscillator(); lfo.frequency.value = 0.13; const lg = a.createGain(); lg.gain.value = 0.035; lfo.connect(lg); lg.connect(amb.wg.gain);
  w.connect(wf); wf.connect(amb.wg); amb.wg.connect(amb.out); w.start(); lfo.start();
  amb.df = a.createBiquadFilter(); amb.df.type = 'lowpass'; amb.df.frequency.value = 180; amb.dg = a.createGain(); amb.dg.gain.value = 0.025;
  amb.d1 = a.createOscillator(); amb.d1.type = 'sawtooth'; amb.d1.frequency.value = 55;
  amb.d2 = a.createOscillator(); amb.d2.type = 'sawtooth'; amb.d2.frequency.value = 55.3;
  amb.d3 = a.createOscillator(); amb.d3.type = 'sawtooth'; amb.d3.frequency.value = 77.8; amb.d3g = a.createGain(); amb.d3g.gain.value = 0;   // tritono: solo suena al volverse tétrico
  amb.d1.connect(amb.df); amb.d2.connect(amb.df); amb.d3.connect(amb.d3g); amb.d3g.connect(amb.df); amb.df.connect(amb.dg); amb.dg.connect(amb.out);
  amb.d1.start(); amb.d2.start(); amb.d3.start();
}
// ---------- Música: metal tipo Doom (normal) → lenta y tétrica (modo tétrico) ----------
let musT = 0, musPaso = 0, musGain = null, distCurva = null;
function mNota(t, f, dur, tipo, vol, fc, pan) {
  const a = actx, o = a.createOscillator(); o.type = tipo; o.frequency.value = f;
  const fl = a.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = fc || 1800;
  const g = a.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(fl); let n = fl;
  if (tipo === 'sawtooth' && fc > 0 && fc < 3000 && distCurva) { const ws = a.createWaveShaper(); ws.curve = distCurva; fl.connect(ws); n = ws; }
  n.connect(g); g.connect(musGain); o.start(t); o.stop(t + dur + 0.05);
}
function mRuido(t, dur, tipo, f, vol) {
  const a = actx, s = a.createBufferSource(); s.buffer = bufRuido(a);
  const fl = a.createBiquadFilter(); fl.type = tipo; fl.frequency.value = f;
  const g = a.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(fl); fl.connect(g); g.connect(musGain); s.start(t, Math.random()); s.stop(t + dur + 0.05);
}
function mBombo(t, v) { const a = actx, o = a.createOscillator(), g = a.createGain(); o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(40, t + 0.12); g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18); o.connect(g); g.connect(musGain); o.start(t); o.stop(t + 0.2); }
// riff en Mi (semitonos sobre E2) — 2 compases de 16 pasos
const RIFF = [[0,0,12,0,0,10,0,0, 0,0,12,0,0,13,0,0], [0,0,12,0,0,10,0,0, 7,7,0,0,6,6,5,0]];
const DOOM_BAJO = 82.41;
function musicaPaso(t, p) {
  const c = Math.floor(p / 16) % 2, s = p % 16;
  if (tet < 0.35) {                                             // modo normal: metal rápido
    const semi = RIFF[c][s], f = DOOM_BAJO * Math.pow(2, semi / 12);
    const acento = s % 4 === 0 ? 1 : 0.75;
    mNota(t, f, 0.11, 'sawtooth', 0.22 * acento, 1500);
    mNota(t, f / 2, 0.12, 'square', 0.12, 600);
    if (s === 0 || s === 6 || s === 8 || s === 10 || (c === 1 && s === 14)) mBombo(t, 0.6);
    if (s === 4 || s === 12) { mRuido(t, 0.14, 'bandpass', 1800, 0.35); mNota(t, 190, 0.08, 'triangle', 0.25, 1500); }
    if (s % 2 === 0) mRuido(t, 0.04, 'highpass', 7000, 0.12);
  } else {                                                      // modo tétrico: lento, grave, inquietante
    if (s === 0) { mNota(t, 41.2, 5.5, 'sine', 0.5, 300); mNota(t, 82.4, 5.5, 'sawtooth', 0.09, 260); mNota(t, 82.4 * 1.0105, 5.5, 'sawtooth', 0.09, 260); }
    if (s === 8 && c === 1) mNota(t, 58.3, 5.5, 'sine', 0.4, 300);                         // tritono grave
    if (s === 0 || s === 3) mBombo(t, 0.45 + 0.2 * tet);                                   // latido lejano
    if (s === 6 || s === 14) { if (Math.random() < 0.7) { const cam = [329.6, 349.2, 466.2, 493.9]; mNota(t, cam[Math.floor(Math.random() * 4)], 3.2, 'sine', 0.07, 2500); } }
    if (s === 11 && Math.random() < 0.5) mRuido(t, 2.5, 'bandpass', 500 + Math.random() * 400, 0.06);
  }
}
function musicaActualizar() {
  if (!actx || !master) return;
  if (masacre) { if (musGain) musGain.gain.setTargetAtTime(0, actx.currentTime, 0.25); musT = actx.currentTime + 0.2; return; }   // la música se corta
  if (!musGain) {
    musGain = actx.createGain(); musGain.gain.value = 0.5; musGain.connect(master);
    distCurva = new Float32Array(256); for (let i = 0; i < 256; i++) { const x = i / 128 - 1; distCurva[i] = Math.tanh(x * 4); }
    musT = actx.currentTime + 0.1; musPaso = 0;
  }
  musGain.gain.setTargetAtTime(silencio ? 0 : 0.5, actx.currentTime, 0.1);
  if (silencio) { musT = actx.currentTime + 0.1; return; }
  const bpm = tet < 0.35 ? 150 : 52, dur = 60 / bpm / 4;
  if (musT < actx.currentTime - 0.5) musT = actx.currentTime + 0.05;
  let n = 0;
  while (musT < actx.currentTime + 0.3 && n++ < 8) { musicaPaso(musT, musPaso); musT += dur; musPaso++; }
}

function actualizarAmbiente(dt) {
  const objetivo = state === 'play' ? (masacre ? 1 : Math.max(0, Math.min(1, (kills - 20) / 60))) : 0;
  masaF += ((masacre && state === 'play' ? 1 : 0) - masaF) * Math.min(1, dt * 1.2);
  tet += (objetivo - tet) * Math.min(1, dt * 0.6);
  latidoPulso = Math.max(0, latidoPulso - dt * 3); flickerT = Math.max(0, flickerT - dt); susTxtT = Math.max(0, susTxtT - dt);
  if (state === 'play' && !amb.on) iniciarAmbiente();
  if (amb.on && actx) {
    const t = actx.currentTime, k = 0.4;
    amb.out.gain.setTargetAtTime(silencio || masacre ? 0 : 1, t, masacre ? 0.5 : 0.1);
    amb.dg.gain.setTargetAtTime(0.025 + 0.06 * tet, t, k); amb.df.frequency.setTargetAtTime(170 + 260 * tet, t, k);
    amb.d3g.gain.setTargetAtTime(tet > 0.25 ? 0.9 * tet : 0, t, k); amb.d2.frequency.setTargetAtTime(55 * (1.005 + 0.02 * tet), t, k);
    amb.wg.gain.setTargetAtTime(0.05 * (1 - 0.6 * tet), t, k);
  }
  if (amb.on && state === 'play') musicaActualizar();
  if (amb.on && actx) {                                              // motor del camión / tanque
    const V = player.veh, mot = !!(V && (V.k === 'camion' || V.k === 'tanque') && state === 'play' && !player.muerto), t = actx.currentTime, tk = V && V.k === 'tanque', sp = Math.abs(vSpd);
    if (mot && !amb.mo) {
      amb.mo = actx.createOscillator(); amb.mo.type = 'sawtooth'; amb.mo2 = actx.createOscillator(); amb.mo2.type = 'square';
      amb.mf = actx.createBiquadFilter(); amb.mf.type = 'lowpass'; amb.mf.frequency.value = 220; amb.mg = actx.createGain(); amb.mg.gain.value = 0;
      amb.mo.connect(amb.mf); amb.mo2.connect(amb.mf); amb.mf.connect(amb.mg); amb.mg.connect(amb.out); amb.mo.start(); amb.mo2.start();
    }
    if (amb.mo) {
      amb.mo.frequency.setTargetAtTime((tk ? 30 : 44) + sp * (tk ? 8 : 9), t, 0.12); amb.mo2.frequency.setTargetAtTime(((tk ? 30 : 44) + sp * (tk ? 8 : 9)) * 0.5, t, 0.12);
      amb.mf.frequency.setTargetAtTime(160 + sp * 45, t, 0.12); amb.mg.gain.setTargetAtTime(mot ? 0.07 + 0.05 * Math.min(1, sp / 8) : 0, t, 0.2);
    }
  }
  bocinaT = Math.max(0, bocinaT - dt);
  if (masacre && state === 'play') {                                 // gritos fuertes y constantes
    gritoT -= dt;
    if (gritoT <= 0) { gritoT = 0.1 + Math.random() * 0.3; sfx.grito(0.55 + Math.random() * 0.45, (Math.random() - 0.5) * 1.6); if (Math.random() < 0.3) tono(70 + Math.random() * 40, 40, 1.2, 'sawtooth', 0.12, (Math.random() - 0.5), 0.2); }
    if (susTxtT <= 0.05) { susTxt = GRITOS_TXT[Math.floor(Math.random() * GRITOS_TXT.length)]; susTxtT = 0.9; }
    if (Math.random() < dt * 0.6) flickerT = 0.07;
  }
  if (state !== 'play' || player.muerto) return;
  const mv = Math.hypot(player.x - ultPx, player.y - ultPy); ultPx = player.x; ultPy = player.y;
  if (mv > 0.004 && mv < 1 && !player.veh) { pasoT -= dt; if (pasoT <= 0) { const corre = mv / dt > 3.2; pasoT = corre ? 0.27 : 0.43; sfx.paso(corre); } } else pasoT = 0.1;
  const bajaVida = player.hp < 35 ? 1 - player.hp / 35 : 0, tens = Math.max(tet > 0.25 ? tet : 0, bajaVida);
  if (tens > 0) { latidoT -= dt; if (latidoT <= 0) { latidoT = 1.25 - 0.65 * tens; sfx.latido(0.35 + 0.65 * tens); latidoPulso = 1; } }
  if (tet > 0.15) {
    notaT -= dt;
    if (notaT <= 0) {
      notaT = 4.5 - 2.5 * tet + Math.random() * 2;
      const esc = tet < 0.5 ? [1, 1.2, 1.5, 1.8] : [1, 1.0595, 1.414, 1.587, 1.888];
      const f = 110 * esc[Math.floor(Math.random() * esc.length)] * (Math.random() < 0.3 ? 2 : 1);
      tono(f, f * (0.97 - 0.02 * tet), 3.2, 'triangle', 0.045 + 0.04 * tet, (Math.random() - 0.5) * 0.6, 1.2);
    }
  }
  if (tet > 0.4) {
    susT -= dt;
    if (susT <= 0) {
      susT = 5 + Math.random() * 6 - 3 * tet;
      ruido(1.1, 'bandpass', 2000 + Math.random() * 1500, 1200, 0.06 + 0.08 * tet, (Math.random() - 0.5) * 1.6);
      susTxt = SUSURROS[Math.floor(Math.random() * SUSURROS.length)]; susTxtT = 2.2;
      if (tet > 0.7 && Math.random() < 0.5) tono(320, 150, 1.4, 'sawtooth', 0.03, (Math.random() - 0.5), 0.3);
    }
    if (Math.random() < dt * 0.25 * tet) flickerT = 0.09;
  }
}
function dibujarTetrico() {
  const f = tet > 0.02 ? `saturate(${Math.max(0, 1 - 0.65 * tet - masaF).toFixed(2)}) brightness(${(1 - 0.3 * tet - 0.08 * masaF).toFixed(2)}) contrast(${(1 + 0.18 * tet + 0.3 * masaF).toFixed(2)})` : '';
  if (f !== tetFiltroPrev) { cv.style.filter = f; tetFiltroPrev = f; }
  if (tet <= 0.02) return;
  const gr = ctx.createRadialGradient(W / 2, VH / 2, VH * 0.2, W / 2, VH / 2, VH * 0.95);
  gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, `rgba(10,0,0,${Math.min(0.9, 0.7 * tet + 0.18 * latidoPulso * tet)})`);
  ctx.fillStyle = gr; ctx.fillRect(0, 0, W, VH);
  if (flickerT > 0) { ctx.fillStyle = 'rgba(0,0,0,0.65)'; ctx.fillRect(0, 0, W, VH); }
  if (susTxtT > 0) {
    ctx.font = masaF > 0.5 ? 'bold 16px monospace' : 'bold 11px monospace'; ctx.textAlign = 'center'; ctx.fillStyle = `rgba(${masaF > 0.5 ? '235,235,235' : '150,10,10'},${Math.min(0.85, susTxtT * 0.6) * Math.max(tet, masaF)})`; ctx.fillText(susTxt, W / 2 + Math.sin(susTxtT * 40) * (tet > 0.7 ? 1.5 : 0), VH * 0.38); ctx.textAlign = 'left';
  }
}

// ############################################################
// ## 4. CARGA DE IMÁGENES (las imágenes están en sprites.js)
// ############################################################

const SPR = { enemigos: [], aliados: [], armas: {}, suelo: {}, colacion: null, camion: null, tanque: null, canon: null, explosion: null, ametra: null };
SPR.patito = lienzo(32, 28, g => {          // patito de goma
  g.fillStyle = '#e8b800'; g.beginPath(); g.ellipse(14, 20, 12, 7, 0, 0, 7); g.fill();
  g.beginPath(); g.arc(20, 10, 7, 0, 7); g.fill(); g.fillStyle = '#ffd21a'; g.beginPath(); g.ellipse(12, 18, 7, 4, 0, 0, 7); g.fill();
  g.fillStyle = '#e8641a'; g.fillRect(25, 10, 6, 3); g.fillStyle = '#111'; g.fillRect(21, 7, 2, 2);
  g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(4, 26, 22, 2);
});
const FALTANTES = [];   // archivos de sprite/ que no se pudieron cargar

function cargarImagen(ruta, avisar) {
  return new Promise(resolve => {
    const im = new Image();
    im.onload = () => resolve(im);
    im.onerror = () => { if (avisar !== false) FALTANTES.push(ruta); resolve(null); };
    im.src = (window.IMAGENES_INCRUSTADAS && window.IMAGENES_INCRUSTADAS[ruta]) || ruta;   // en jugar.html las imágenes vienen dentro del archivo
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
  const base = 'sprite/' + id + '_' + n;
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

  for (let k = 0; k < 6; k++) tareas.push(cargarEnemigo('aliado', k + 1).then(set => { SPR.aliados[k] = set; }));
  ['pistola', 'escopeta', 'fusil', 'ametralladora', 'francotirador', 'lanzacohetes', 'cuchillo', 'fogonazo'].forEach(nombre => {
    tareas.push(cargarImagen('sprite/' + nombre + '.png').then(im => { SPR.armas[nombre] = im; }));
  });
  tareas.push(cargarImagen('sprite/camion.png').then(im => { SPR.camion = im; }));
  tareas.push(cargarImagen('sprite/tanque.png').then(im => { SPR.tanque = im; }));
  tareas.push(cargarImagen('sprite/canon.png').then(im => { SPR.canon = im; }));
  tareas.push(cargarImagen('sprite/ametra.png').then(im => { SPR.ametra = im; }));
  tareas.push(cargarImagen('sprite/explosion.png').then(im => { SPR.explosion = im; }));
  tareas.push(cargarImagen('sprite/vendas.png').then(im => { SPR.colacion = im; }));

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
  ['pistola', 'escopeta', 'fusil', 'ametralladora'].forEach(n => {   // versión "tirada en el suelo" para recogerla
    const im = SPR.armas[n], [iw, ih] = dim(im);
    SPR.suelo[n] = lienzo(ih, iw, g => { g.translate(ih, 0); g.rotate(Math.PI / 2); g.drawImage(im, 0, 0); });
  });
  if (!SPR.armas.fogonazo) SPR.armas.fogonazo = lienzo(40, 40, g => { g.fillStyle = '#ffd24a'; g.beginPath(); g.arc(20, 20, 14, 0, 7); g.fill(); });
  if (!SPR.colacion) SPR.colacion = lienzo(24, 16, g => { g.fillStyle = '#eee'; g.fillRect(2, 3, 20, 10); g.fillStyle = '#c22'; g.fillRect(10, 4, 4, 8); g.fillRect(7, 7, 10, 2); });
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
// ---------- Huevos de pascua ----------
let granadas = 3, GRAN = [], aves = Array.from({ length: 6 }, (_, i) => ({ th: i * 1.05, alt: 14 + (i % 3) * 9, v: 0.12 + (i % 4) * 0.03, fase: i })), aveT = 8;
function lanzarGranada() {
  if (state !== 'play' || player.muerto || player.veh) return;
  if (MP.rol === 'cliente') { aviso('Granadas: solo en modo un jugador o anfitrión'); return; }
  if (granadas <= 0) { aviso('Sin granadas (1 más cada 10 bajas)'); return; }
  granadas--;
  let d = 0.8; const bx = Math.cos(player.a), by = Math.sin(player.a);
  while (d < 7 && !wallAt(player.x + bx * (d + 0.3), player.y + by * (d + 0.3)) && !enemies.some(e => e.muriendo <= 0 && Math.hypot(e.x - (player.x + bx * d), e.y - (player.y + by * d)) < 0.7)) d += 0.3;
  GRAN.push({ x: player.x + bx * d, y: player.y + by * d, t: 1.0 }); beep(260, 0.05, 'square', 0.05);
}
function actualizarGranadas(dt) {
  for (const g of GRAN) { g.t -= dt; if (g.t <= 0) { g.dead = true; explosion(g.x, g.y, 3.2, 45, player); sangreP(g.x, g.y, 6, 1.2); } }
  GRAN = GRAN.filter(g => !g.dead);
}
SPR.granada = lienzo(12, 12, g => { g.fillStyle = '#2f3a24'; g.beginPath(); g.arc(6, 7, 5, 0, 7); g.fill(); g.fillStyle = '#7a8a5a'; g.fillRect(4, 3, 3, 2); g.fillStyle = '#c9c9c9'; g.fillRect(5, 0, 2, 3); });
function dibujarAves() {                                  // gaviotas que cruzan el cielo (solo por encima de los muros)
  const fov = 2 * Math.atan(0.66);
  for (const a of aves) {
    let dx = (a.th - player.a) % 6.2832; if (dx > 3.1416) dx -= 6.2832; if (dx < -3.1416) dx += 6.2832;
    const sx = W / 2 + dx / fov * W; if (sx < 2 || sx >= W - 2) continue;
    const col = Math.floor(sx), top = VH / 2 - 0.5 * VH / zbuf[col], y = VH / 2 - 8 - a.alt * 1.6 - Math.sin(a.fase * 2) * 2;
    if (y > top - 4) continue;
    const ala = Math.sin(a.fase * 7) > 0 ? 2 : -1;
    ctx.fillStyle = 'rgba(245,245,250,0.95)'; ctx.fillRect(sx - 3, y + ala, 3, 1); ctx.fillRect(sx, y + ala, 3, 1); ctx.fillRect(sx - 1, y + 1, 2, 1);
  }
}
// ---------- Bombarderos ----------
// ---------- Escape: llaves + mapa + barco, o 100 bajas + helicóptero ----------
const BAJAS_HELI = 100;
let abandonoOk = 0, meAbandonaron = false;
let ESC = [], tieneLlaves = false, tieneMapa = false, escapeT = 0, HELI = null, victoria = '', heliT = 0;
SPR.llaves = lienzo(18, 14, g => { g.fillStyle = '#e6b800'; g.beginPath(); g.arc(5, 7, 4.5, 0, 7); g.fill(); g.fillStyle = '#3a2a00'; g.beginPath(); g.arc(5, 7, 1.8, 0, 7); g.fill(); g.fillStyle = '#e6b800'; g.fillRect(8, 6, 9, 2.4); g.fillRect(13, 8, 2, 4); g.fillRect(16, 8, 2, 3); });
SPR.mapaItem = lienzo(22, 16, g => { g.fillStyle = '#d9c28a'; g.fillRect(0, 0, 22, 16); g.strokeStyle = '#6b4a1e'; g.lineWidth = 1; g.strokeRect(0.5, 0.5, 21, 15); g.beginPath(); g.moveTo(3, 12); g.lineTo(8, 5); g.lineTo(12, 10); g.lineTo(18, 3); g.stroke(); g.fillStyle = '#b22'; g.fillRect(16, 2, 4, 4); });
SPR.heli = lienzo(80, 40, g => {
  g.fillStyle = '#3b4a35'; g.beginPath(); g.ellipse(34, 24, 22, 9, 0, 0, 7); g.fill();                         // fuselaje
  g.fillStyle = '#2d3a29'; g.fillRect(52, 21, 26, 4); g.fillRect(74, 14, 4, 11);                                // cola
  g.fillStyle = '#9fc4dc'; g.beginPath(); g.ellipse(22, 22, 9, 6, 0, Math.PI, 0); g.fill();                    // cabina
  g.fillStyle = '#c33'; g.fillRect(36, 20, 6, 4); g.fillStyle = '#222'; g.fillRect(24, 33, 34, 2); g.fillRect(28, 30, 2, 4); g.fillRect(50, 30, 2, 4);  // patines
  g.fillStyle = 'rgba(30,30,30,0.55)'; g.fillRect(2, 13, 76, 2); g.fillStyle = '#222'; g.fillRect(33, 14, 3, 5);   // rotor
});
function avisoEquipo(t) { aviso(t); if (MP.rol === 'host' && MP.avisoTodos && t !== ultAvisoEq) MP.avisoTodos(t); ultAvisoEq = t; }
let ultAvisoEq = '', umbralHeli = BAJAS_HELI;
function iniciarEscape() {
  ESC = []; tieneLlaves = tieneMapa = false; escapeT = 0; HELI = null; victoria = ''; meAbandonaron = false; heliT = 0; umbralHeli = BAJAS_HELI; ultAvisoEq = '';
  const e = NIVEL_LEIDO.escape; if (!e) return;
  ESC.push({ k: 'llaves', x: e.llaves.x, y: e.llaves.y, ok: false }, { k: 'mapa', x: e.mapa.x, y: e.mapa.y, ok: false });
}
function idxDe(P) { return P === player ? MP.miIdx : P.idx; }
function pedirAbandono() {
  if (state !== 'play') return;
  if (MP.rol === 'solo') { aviso('Solo hay amigos que abandonar en multijugador'); return; }
  if (MP.rol === 'cliente') { MP.enviarAbandono && MP.enviarAbandono(); aviso('Orden enviada: abandonar a los que estén lejos'); return; }
  abandonoOk = 10; avisoEquipo('¡ORDEN DE ABANDONAR! Se escapa sin los que estén lejos (10 s)');
}
function ganar(como, dejados) {
  if (masacre) return;                                     // ya no hay escape
  meAbandonaron = !!(dejados && dejados.some(P => P === player));
  victoria = como; state = 'over'; overT = 2; causa = ''; firing = false; beep(660, 0.3, 'triangle', 0.08); setTimeout(() => beep(880, 0.4, 'triangle', 0.08), 250);
  if (MP.rol === 'host' && MP.anunciarVictoria) MP.anunciarVictoria(como, (dejados || []).map(idxDe));
}
function llamarHeli() {
  if (masacre) return;
  const vivos = jugadoresVivos(); let cx = 0, cy = 0; for (const P of vivos) { cx += P.x; cy += P.y; } cx /= vivos.length || 1; cy /= vivos.length || 1;
  const tx = wallAt(cx, cy) ? player.x : cx, ty = wallAt(cx, cy) ? player.y : cy, ang = Math.random() * 6.283;
  HELI = { x: tx + Math.cos(ang) * 70, y: ty + Math.sin(ang) * 70, tx, ty, z: 3, resc: 0, llego: false, condenado: Math.random() < 0.2 };   // 20 %: un avión enemigo lo derribará
  avisoEquipo('¡' + umbralHeli + ' BAJAS! HELICÓPTERO DE RESCATE EN CAMINO'); beep(90, 0.6, 'sawtooth', 0.1);
}
function destruirHeli() {
  if (!HELI || MP.rol === 'cliente') return;
  const H = HELI; HELI = null; explosion(H.x, H.y, 4, 45, null, true); FX.push({ x: H.x, y: H.y, t: 0 });
  umbralHeli = kills + 50; avisoEquipo('¡UN AVIÓN DERRIBÓ EL HELICÓPTERO! Sobrevive: otro vendrá a las ' + umbralHeli + ' bajas (o escapa en barco)'); beep(60, 1, 'sawtooth', 0.15); tiembla = 1.2;
}
function actualizarEscape(dt) {
  if (MP.rol === 'cliente' || state !== 'play') return;
  const vivos = jugadoresVivos(); if (!vivos.length) return;
  abandonoOk = Math.max(0, abandonoOk - dt);
  for (const o of ESC) {
    if (o.ok) continue;
    if (!vivos.some(P => Math.hypot(o.x - P.x, o.y - P.y) < 0.8)) continue;
    o.ok = true; beep(740, 0.15, 'triangle', 0.07);
    if (o.k === 'llaves') { tieneLlaves = true; avisoEquipo('¡LLAVES! ' + (tieneMapa ? 'Ya tienen todo: tomen un barco (T), TODOS cerca' : 'Falta el mapa (otro extremo del último piso)')); }
    else { tieneMapa = true; avisoEquipo('¡MAPA! ' + (tieneLlaves ? 'Ya tienen todo: tomen un barco (T), TODOS cerca' : 'Faltan las llaves (otro extremo del último piso)')); }
  }
  const piloto = vivos.find(P => P.veh && P.veh.k === 'barco');                    // barco con llaves y mapa
  if (piloto && tieneLlaves && tieneMapa) {
    const b = piloto.veh.o, bx = b.x + (b.l || 8) / 2, by = b.y + (b.h || 4) / 2;
    const lej = vivos.filter(P => Math.hypot(P.x - bx, P.y - by) > 9);
    if (lej.length && abandonoOk <= 0) { escapeT = 0; avisoEquipo('Faltan ' + lej.length + ' jugador(es) cerca del barco · X = abandonarlos'); }
    else if (lej.length === vivos.length) escapeT = 0;
    else { escapeT += dt; avisoEquipo((lej.length ? 'ABANDONANDO A ' + lej.length + '… ' : 'ARRANCANDO MOTOR… ') + Math.max(0, Math.ceil(3 - escapeT))); if (escapeT >= 3) ganar('barco', lej); }
  } else escapeT = 0;
  if (kills >= umbralHeli && !HELI) llamarHeli();
  if (HELI) {
    const H = HELI, d = Math.hypot(H.tx - H.x, H.ty - H.y);
    if (!H.llego) {
      const v = 22 * dt;
      if (d <= v) {
        H.x = H.tx; H.y = H.ty; H.llego = true; avisoEquipo('¡HELICÓPTERO AQUÍ! Todos juntos a su lado 3 s'); if (!enemies.some(e => e.bando === 3 && e.muriendo <= 0)) setTimeout(terceraFuerza, 1200);
        if (H.condenado) { const a = Math.random() * 6.283; AVIONES.push({ x: H.tx - Math.cos(a) * 24, y: H.ty - Math.sin(a) * 24, vx: Math.cos(a) * 13, vy: Math.sin(a) * 13, z: 3.2, tb: 99, n: 99, t: 2, mata: true }); }
      } else { H.x += (H.tx - H.x) / d * v; H.y += (H.ty - H.y) / d * v; }
    } else {
      H.z = Math.max(0.25, H.z - dt * 1.5);
      const lej = vivos.filter(P => Math.hypot(H.tx - P.x, H.ty - P.y) > 4.5);
      if (lej.length && abandonoOk <= 0) { H.resc = 0; avisoEquipo('Faltan ' + lej.length + ' jugador(es) junto al helicóptero · X = abandonarlos'); }
      else if (lej.length === vivos.length) H.resc = 0;
      else { H.resc += dt; avisoEquipo((lej.length ? 'ABANDONANDO A ' + lej.length + '… ' : 'SUBIENDO AL HELICÓPTERO… ') + Math.max(0, Math.ceil(3 - H.resc))); if (H.resc >= 3) ganar('helicoptero', lej); }
    }
  }
  if (HELI) { heliT -= dt; if (heliT <= 0) { heliT = 0.18; const dd = Math.hypot(HELI.x - player.x, HELI.y - player.y); if (dd < 40) beep(55, 0.08, 'square', 0.07 * (1 - dd / 40)); } }
}
function dibujarObjetivo() {
  if (masacre) return;
  if (state !== 'play') return;
  ctx.font = 'bold 7px monospace'; ctx.textAlign = 'left';
  const eq = MP.rol !== 'solo' ? ' (todos juntos)' : '';
  const L = HELI ? ['HELICÓPTERO: ¡corre hacia él y espera 3 s!' + eq] : ['ESCAPA: llaves ' + (tieneLlaves ? 'OK' : '--') + ' · mapa ' + (tieneMapa ? 'OK' : '--') + ' (último piso de la fortaleza)', '→ toma un barco con T · o ' + umbralHeli + ' bajas (' + Math.min(kills, umbralHeli) + ') → helicóptero' + eq];
  L.forEach((t, i) => { ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillText(t, 6, 128 + i * 9); ctx.fillStyle = '#ffe9a8'; ctx.fillText(t, 5, 127 + i * 9); });
}
let AVIONES = [], BOMBAS = [], avionT = 20, PECES = [], pecesT = 0;
SPR.pez = lienzo(18, 9, g => { g.fillStyle = '#6fa8c8'; g.beginPath(); g.ellipse(7, 4.5, 7, 3.6, 0, 0, 7); g.fill(); g.fillStyle = '#4c7f9e'; g.beginPath(); g.moveTo(13, 4.5); g.lineTo(18, 0); g.lineTo(18, 9); g.fill(); g.fillStyle = '#d8e8f0'; g.fillRect(2, 5, 8, 1.5); g.fillStyle = '#111'; g.fillRect(2, 3, 1.5, 1.5); });
function actualizarPeces(dt) {
  if (pecesT > 0) {
    pecesT -= dt;
    for (let i = 0; i < 2 && PECES.length < 120; i++) { const a = Math.random() * 6.283, r = 1 + Math.random() * 11; PECES.push({ x: player.x + Math.cos(a) * r, y: player.y + Math.sin(a) * r, z: 5 + Math.random() * 3, vz: 0 }); }
  }
  for (const f of PECES) {
    f.vz -= 9 * dt; f.z += f.vz * dt;
    if (f.z <= 0) {
      f.dead = true; if (Math.random() < 0.25) beep(160 + Math.random() * 80, 0.05, 'square', 0.03);
      if (MP.rol !== 'cliente') for (const e of enemies) if (e.muriendo <= 0 && Math.hypot(e.x - f.x, e.y - f.y) < 0.9) hitEnemy(e, 1.5, 0.15, f.x, f.y);
    }
  }
  PECES = PECES.filter(f => !f.dead);
}
SPR.avion = lienzo(64, 24, g => {                      // silueta de bombardero visto de lado (mira a la derecha)
  g.fillStyle = '#3d4350'; g.beginPath(); g.ellipse(32, 12, 28, 5, 0, 0, 7); g.fill();               // fuselaje
  g.fillStyle = '#2b303a'; g.beginPath(); g.moveTo(10, 11); g.lineTo(2, 2); g.lineTo(8, 2); g.lineTo(18, 10); g.fill();   // cola
  g.fillStyle = '#4a5160'; g.beginPath(); g.moveTo(26, 12); g.lineTo(36, 22); g.lineTo(44, 22); g.lineTo(42, 12); g.fill();  // ala
  g.fillStyle = '#9fb4c8'; g.beginPath(); g.ellipse(48, 10, 6, 3, 0, 0, 7); g.fill();               // cabina
  g.fillStyle = '#c33'; g.fillRect(24, 10, 4, 3); g.fillStyle = '#ddd'; g.fillRect(28, 10, 3, 3);   // insignia
  g.fillStyle = '#222'; g.fillRect(58, 9, 2, 6); g.fillRect(60, 8, 2, 8);                            // hélice
});
SPR.bomba = lienzo(8, 14, g => { g.fillStyle = '#23262c'; g.beginPath(); g.ellipse(4, 8, 3.5, 6, 0, 0, 7); g.fill(); g.fillStyle = '#7a1c1c'; g.fillRect(2, 0, 4, 3); g.fillStyle = '#555'; g.fillRect(3, 6, 1, 4); });
function lanzarAvion() {
  const f = Math.min(1, playT / TIEMPO_ROJO);                         // cuanto más te demoras: más aviones, más rápidos y con más bombas
  const nAv = 1 + Math.floor(f * 3.2), vel = 13 + 17 * f;
  const ang = Math.random() * 6.283, dx = Math.cos(ang), dy = Math.sin(ang), px = -dy, py = dx;
  for (let i = 0; i < nAv; i++) {
    const off = (Math.random() - 0.5) * (12 + 6 * nAv), atras = 45 + i * 6;
    AVIONES.push({ x: player.x - dx * atras + px * off, y: player.y - dy * atras + py * off, vx: dx * vel, vy: dy * vel, z: 3.2, tb: 0, n: 0, t: 0, maxB: 7 + Math.floor(9 * f), cad: 0.34 - 0.18 * f });
  }
  aviso(nAv > 1 ? '✈ ¡' + nAv + ' AVIONES ENEMIGOS! Cada vez bombardean más…' : '✈ ¡AVIONES ENEMIGOS! Muévete: ¡bombas!'); beep(420, 0.5, 'sawtooth', 0.05); setTimeout(() => beep(520, 0.5, 'sawtooth', 0.05), 450);
}
function actualizarAviones(dt) {
  if (MP.rol !== 'cliente') {
    avionT -= dt;
    if (avionT <= 0 && !AVIONES.length && jugadoresVivos().length) { lanzarAvion(); avionT = (25 + Math.random() * 10) * (1 - 0.72 * Math.min(1, playT / TIEMPO_ROJO)); }   // cada vez más seguidos
  }
  for (const a of AVIONES) {
    a.x += a.vx * dt; a.y += a.vy * dt; a.t += dt; a.tb -= dt;
    const d = Math.hypot(a.x - player.x, a.y - player.y);
    if (a.t > 1.2 && d < 28 && a.tb <= 0 && a.n < (a.maxB || 7) && MP.rol !== 'cliente') { a.tb = a.cad || 0.34; a.n++; BOMBAS.push({ x: a.x, y: a.y, z: a.z, vz: 0, vx: a.vx * 0.6, vy: a.vy * 0.6 }); beep(900, 0.35, 'sine', 0.03); }
    if (a.mata && HELI && Math.hypot(a.x - HELI.x, a.y - HELI.y) < 3) destruirHeli();
    if (d > 60 && a.t > 4 && !a.mata) a.dead = true; else if (a.t > 12) a.dead = true;
  }
  AVIONES = AVIONES.filter(a => !a.dead);
  for (const b of BOMBAS) {
    b.vz -= 9 * dt; b.z += b.vz * dt; b.x += b.vx * dt; b.y += b.vy * dt;
    if (b.z <= 0) { b.dead = true; explosion(b.x, b.y, 3.0, 40, null, true); sangreP(b.x, b.y, 3, 1); mancha(b.x, b.y, 0.6); if (MP.rol !== 'cliente') tiembla = Math.max(tiembla, Math.hypot(b.x - player.x, b.y - player.y) < 8 ? 0.8 : 0); }
  }
  BOMBAS = BOMBAS.filter(b => !b.dead);
}
function dibujarAviones() {
  const dirX = Math.cos(player.a), dirY = Math.sin(player.a), planeX = -dirY * 0.66, planeY = dirX * 0.66, inv = 1 / (planeX * dirY - dirX * planeY);
  for (const a of AVIONES) {
    const sx = a.x - player.x, sy = a.y - player.y, tx = inv * (dirY * sx - dirX * sy), ty = inv * (-planeY * sx + planeX * sy);
    if (ty < 1) continue;
    const scrX = (W / 2) * (1 + tx / ty), w = 3.4 * VH / ty, h = w * 24 / 64, yc = VH / 2 + (0.5 - a.z) * VH / ty;
    const col = Math.max(0, Math.min(W - 1, Math.floor(scrX))), top = VH / 2 - 0.5 * VH / zbuf[col];
    if (yc + h / 2 > top + 2) continue;                                  // un muro lo tapa
    const sentido = (a.vx * planeX + a.vy * planeY) / ty;                 // hacia dónde se mueve en pantalla
    ctx.save(); ctx.translate(scrX, yc); if (sentido < 0) ctx.scale(-1, 1); ctx.drawImage(SPR.avion, -w / 2, -h / 2, w, h); ctx.restore();
  }
}
SPR.caja = lienzo(20, 14, g => { g.fillStyle = '#5b6b3a'; g.fillRect(0, 2, 20, 12); g.fillStyle = '#3d4a26'; g.fillRect(0, 2, 20, 2); g.fillStyle = '#d8c25a'; for (let i = 0; i < 4; i++) g.fillRect(3 + i * 4, 6, 2, 6); g.fillStyle = '#222'; g.fillRect(0, 13, 20, 1); });
let hitT = 0, estamina = 1, pausa = false, record = 0;
try { record = +localStorage.getItem('ga_record') || 0; } catch (e) {}
let mouseDX = 0, girando = false;                        // giro con el mouse (clic derecho)
let vSpd = 0, volante = 0, tkT = 0, bocinaT = 0;   // velocidad del vehículo, giro del volante, ruido de orugas, bocina
let bailaT = 0, tiembla = 0, PATOS = [], patosTomados = 0, chiste = '', tecleo = '';
const CHISTES = ['Los peces te mandan saludos.', 'Tu abuela dispara mejor… y es de Quilpué.', 'Consejo: las balas van hacia adelante.', 'Casi lo logras (mentira).', 'El cangrejo del puerto se ríe de ti.', 'Se acabó el pisco, se acabó la guerra.', '¿Y si la próxima vez esquivas?', 'Hasta el cañón de madera te ganó.'];
const FRASES_BAJAS = { 5: '¡Cinco abajo! Esto va en serio.', 10: '¡Diez! Ya mereces un completo italiano.', 20: '¡Veinte! Las gaviotas te respetan.', 30: '¡Treinta! El almirante empieza a sudar.', 50: '¡Cincuenta! ¿Eres Chuck Norris del puerto?', 75: '¡Setenta y cinco! El mar tiembla.', 100: '¡CIEN! Leyenda de Valparaíso.' };
const TRUCOS = {
  pisco: () => { player.hp = Math.min(100, player.hp + 50); aviso('¡Un piscolita! +vida (¡salud!)'); beep(330, 0.1, 'sine', 0.06); },
  completo: () => { player.hp = 100; aviso('Completo italiano con palta: vida al 100%'); beep(520, 0.1, 'square', 0.05); },
  sopaipilla: () => { ammo = WEAPONS.map(w => w.mag); aviso('Sopaipillas pasadas: ¡munición llena!'); },
  terremoto: () => { tiembla = 3; aviso('¡TEMBLOR! (Chile, país sísmico)'); beep(50, 1.5, 'sawtooth', 0.12); },
  cueca: () => { if (MP.rol === 'cliente') return; bailaT = 6; aviso('¡CUECA! Los enemigos no pueden evitar bailar'); },
  pescado: () => { pecesT = 6; aviso('¡LLUEVEN PESCADOS! (marea alta)'); beep(300, 0.3, 'sine', 0.05); },
  cabezon: () => { if (MP.rol === 'cliente') return; aplastar(); },
  'cabezón': () => { if (MP.rol === 'cliente') return; aplastar(); },
  naya: () => { if (MP.rol === 'cliente') return; explotarTodos(); },
  cuac: () => { aviso('CUAC.'); cuac(); },
};
function aplastar() {                                    // una cabeza gigante cae y los aplasta a todos
  const lista = enemies.filter(e => e.muriendo <= 0); tiembla = 1.6;
  for (const e of lista) { e.aplastado = true; hitEnemy(e, 99999, 0); }
  aviso('¡CABEZÓN! ' + lista.length + ' aplastados'); beep(45, 0.9, 'sawtooth', 0.16);
}
function explotarTodos() {                               // los enemigos revientan
  const lista = enemies.filter(e => e.muriendo <= 0);
  for (const e of lista) { e.explota = true; FX.push({ x: e.x, y: e.y, t: 0 }); if (MP.rol === 'host') MP.avisarExplosion(e.x, e.y); hitEnemy(e, 99999, 0); }
  aviso('¡NAYA! ' + lista.length + ' enemigos explotaron'); beep(70, 0.6, 'sawtooth', 0.14); tiembla = 0.8;
}
function aviso(t) { msg = t; msgT = 3.5; }
function cuac() { beep(520, 0.07, 'square', 0.07); setTimeout(() => beep(400, 0.1, 'square', 0.07), 80); }
function crearPatos() {                                  // 5 patitos de goma escondidos por el mapa
  PATOS = []; patosTomados = 0;
  const n = reachable.length; if (!n) return;
  for (let k = 0; k < 5; k++) { const [x, y] = reachable[Math.floor(n * (k + 0.35 + 0.1 * k) / 5.2) % n]; PATOS.push({ x: x + 0.5, y: y + 0.5, ok: false }); }
}
function actualizarPatos() {
  for (const d of PATOS) {
    if (d.ok || Math.hypot(d.x - player.x, d.y - player.y) > 0.9) continue;
    d.ok = true; patosTomados++; score += 50; cuac();
    aviso(patosTomados >= PATOS.length ? '¡5/5 PATITOS! Vida y munición llenas, ¡CUAC!' : '¡Patito de goma! ' + patosTomados + '/' + PATOS.length + ' · CUAC');
    if (patosTomados >= PATOS.length) { player.hp = 100; ammo = WEAPONS.map(w => w.mag); }
  }
}
let unlocked = [true, false, false, false, false, false, true];
let ammo = WEAPONS.map(w => w.mag), reloadT = 0, reloadW = 0;
let BOATS = [], pickups = [], aguaT = 0, causa = '';

// ---------- Multijugador (el resto del código está en multi.js) ----------
// rol: 'solo' | 'host' (anfitrión: corre todo el juego) | 'cliente' (recibe lo que pasa y manda sus movimientos)
const MP = { rol: 'solo', otros: [], fuegoAmigo: false, lobby: false, listo: false, miIdx: 0, nombres: [], enemigoId: 0 };
player.nombre = 'Marino'; player.muerto = false; player.resp = 0;
const COLORES_JUGADOR = ['#e24b4b', '#4b8be2', '#e2c64b', '#4be27a', '#a64be2', '#e2884b'];
// jugadores vivos: son los blancos de los enemigos
function objetivos() {                       // a quién persiguen los enemigos (quien está en una sala de barco no, queda a salvo)
  const l = [];
  if (!player.muerto && !salaDe(player)) l.push(player);
  for (const o of MP.otros) if (!o.muerto && !salaDe(o)) l.push(o);
  return l;
}
function jugadoresVivos() { return [player, ...MP.otros].filter(P => !P.muerto); }
let golpeX = 0, golpeY = 0, golpeT = 0;
function danar(T, n, src) {
  if (T === player) { sfx.herido(); salpicarPantalla(n > 12 ? 3 : 1, n > 12); }
  if (T === player && src && src.x !== undefined) { golpeX = src.x; golpeY = src.y; golpeT = 0.9; }
  if (T.veh && T.veh.k === 'tanque') n *= 0.3;        // el blindaje del tanque
  T.hp -= n;
  if (T === player) redFlash = 0.18; else T.golpe = 0.3;
}

// Barcos que navegan de lado a lado (vienen de "barcos" en mapa.js)
// Un barco grande tiene casco alrededor (muro) y cubierta adentro (piso). Dos "puertas" en cada costado para subir.
function solidoBarco(b, i, j) {
  if (b.h >= 3) {
    const borde = i === 0 || i === b.l - 1 || j === 0 || j === b.h - 1;
    const puerta = (j === 0 || j === b.h - 1) && (i === Math.floor(b.l / 2) || i === Math.floor(b.l / 2) - 1);
    return borde && !puerta;
  }
  return b.l >= 4 && j === 0 && (i === Math.floor(b.l / 2) || i === Math.floor(b.l / 2) + 1);   // lanchas: una cabina
}
function pintarBarco(b, v) {
  for (let j = 0; j < b.h; j++) for (let i = 0; i < b.l; i++) {
    const k = (b.y + j) * MW + b.x + i;
    BOATMASK[k] = v; VSOL[k] = v && solidoBarco(b, i, j) ? 8 : 0;
  }
}
function posTimon(b) { return { x: b.x + 2.5, y: b.y + (b.h >= 3 ? 2.5 : 1.5) }; }  // dónde te paras al manejar

const ALTURA_TORRE = 1.0;   // los cañones están tan altos como los muros: ningún muro los tapa
let CUERPOS = [], GORE = [], MANCHAS = [];
let CAM = [], CAN = [], FX = [], SALAS = [], artT = 3;
const LINK = new Int32Array(MW * MH).fill(-1);   // escaleras: casilla -> casilla del otro piso

// Pisos: el piso alto de la fortaleza y las salas de artillería de los barcos son zonas del mapa a las que se llega por escaleras.
// salaDe: en qué sala de barco está P (o null). mundoPos: dónde está P "de verdad" en el mapa de abajo (para distancias y disparos).
function salaDe(P) {
  const A = NIVEL_LEIDO.altos; if (!A || P.y < A.sy0) return null;
  for (const s of SALAS) if (P.x >= s.x0 && P.x <= s.x1 + 1 && P.y >= s.y0 && P.y <= s.y1 + 1) return s;
  return null;
}
function mundoPos(P) {
  const A = NIVEL_LEIDO.altos; if (!A) return P;
  if (P.y >= A.sy0) { const s = salaDe(P), b = s && BOATS[s.barco]; return b ? { x: b.x + b.l / 2 + (P.x - s.x0 - 8) * 0.5, y: b.y + b.h / 2 + (P.y - s.y0 - 3) * 0.5 } : P; }
  if (P.y >= A.fy0 && P.y <= A.fy1 + 1) return { x: P.x, y: P.y - A.off };
  return P;
}
function crearBarcos() {
  BOATMASK.fill(0); VSOL.fill(0); LINK.fill(-1);
  SALAS = NIVEL_LEIDO.salas || [];
  BOATS = (NIVEL_LEIDO.barcos || []).map((b, i) => Object.assign({}, b, { id: i + 1, dir: i % 2 ? 1 : -1, t: Math.random(), piloto: -1, cmd: null, cmdT: 0, flash: 0, sala: SALAS.find(s => s.barco === i) || null }));
  BOATS.forEach(b => pintarBarco(b, b.id));
  const A = NIVEL_LEIDO.altos;
  CAM = (NIVEL_LEIDO.camiones || []).map(c => ({ tipo: 'camion', x: c.x, y: c.y, a: c.a || 0, piloto: -1 }))
    .concat((NIVEL_LEIDO.tanques || []).map(c => ({ tipo: 'tanque', x: c.x, y: c.y, a: c.a || 0, piloto: -1 })));
  CAM.forEach((c, i) => { c.id = i; });
  CAN = (NIVEL_LEIDO.canones || []).map(c => ({ x: c.x, y: c.y, piloto: -1, op: null, cd: 2, flash: 0, alto: true }));
  for (const b of BOATS) if (b.sala) for (const [ox, oy] of [[b.l - 2.5, 1.5], [6.5, 2.5]]) CAN.push({ x: b.x + ox, y: b.y + oy, ox, oy, bar: b, piloto: -1, op: null, cd: 2, flash: 0, alto: true });   // cañones sobre la cubierta del barco
  for (const c of (NIVEL_LEIDO.ametralladoras || [])) CAN.push({ x: c.x, y: c.y, piloto: -1, op: null, cd: 2, flash: 0, alto: false, tipo: 'ametra' });
  CAN.forEach((c, i) => { c.id = i; });
  CUERPOS = []; GORE = []; MANCHAS = []; crearPatos(); chiste = ''; bailaT = 0; pausa = false; estamina = 1; granadas = 3; GRAN = []; terceraT = 40; invasiones = 0; ultInvasion = -999; abandonoOk = 0; iniciarEscape(); tiros = aciertos = combo = 0; AVIONES = []; BOMBAS = []; avionT = 20; PECES = []; pecesT = 0;
  for (const e of (NIVEL_LEIDO.escaleras || [])) if (e.enemigos) { const a = e.a.y * MW + e.a.x, b = e.b.y * MW + e.b.x; LINK[a] = b; LINK[b] = a; }
  FX = []; artT = 3;
}

// Mueve un barco una casilla. Lleva consigo a quien esté en la cubierta. Devuelve false si algo lo frena.
function moverBarco(b, dx, dy, limites) {
  const nx = b.x + dx, ny = b.y + dy;
  if (limites && (nx < b.min || nx + b.l - 1 > b.max)) return false;
  for (let j = 0; j < b.h; j++) for (let i = 0; i < b.l; i++) {
    const x = nx + i, y = ny + j;
    if (x < 1 || y < 1 || x >= MW - 1 || y >= MH - 1) return false;
    const c = MAP[y][x], v = BOATMASK[y * MW + x];
    if (!(c === '~' || c === '=') || (v && v !== b.id)) return false;
  }
  const dentro = (e, x0, y0) => { const cx = Math.floor(e.x), cy = Math.floor(e.y); return cx >= x0 && cx < x0 + b.l && cy >= y0 && cy < y0 + b.h; };
  const todos = [player, ...MP.otros, ...enemies];
  const montados = todos.filter(e => dentro(e, b.x, b.y) && !VSOL[Math.floor(e.y) * MW + Math.floor(e.x)]);
  if (todos.some(e => !montados.includes(e) && dentro(e, nx, ny))) return false;
  pintarBarco(b, 0); b.x = nx; b.y = ny; pintarBarco(b, b.id);
  for (const e of montados) { e.x += dx; e.y += dy; if (e.tx !== undefined) { e.tx += dx; e.ty += dy; } }
  return true;
}
function anclarCanones() { for (const c of CAN) if (c.bar) { c.x = c.bar.x + c.ox; c.y = c.bar.y + c.oy; } }   // los cañones de cubierta viajan con el barco
function moverBarcos(dt) {
  anclarCanones();
  for (const b of BOATS) {
    b.flash = Math.max(0, b.flash - dt);
    b.t += dt;
    if (b.piloto >= 0) {                                   // lo maneja un jugador
      b.cmdT -= dt;
      if (b.cmdT > 0 && b.cmd && (b.cmd[0] || b.cmd[1]) && b.t >= 0.26) { b.t = 0; moverBarco(b, b.cmd[0], b.cmd[1], false); }
      continue;
    }
    const paso = 1 / Math.max(0.05, b.vel);
    if (b.t < paso) continue;
    b.t -= paso;
    if (!moverBarco(b, b.dir, 0, true)) b.dir = -b.dir;
  }
}

// ---------- Escaleras (suben/bajan de piso al pisarlas) ----------
function escaleraBarco(cx, cy) {                 // ¿esa casilla es la escalera de la cubierta de un barco?
  const id = BOATMASK[cy * MW + cx]; const b = id && BOATS[id - 1];
  return b && b.sala && cx === b.x + 4 && cy === b.y + 1 ? b : null;
}
function usarEscalera(P) {
  const cx = Math.floor(P.x), cy = Math.floor(P.y);
  if (cx < 0 || cy < 0 || cx >= MW || cy >= MH) return;
  const bc = escaleraBarco(cx, cy), enSala = MAP[cy][cx] === 'U' && salaDe(P);
  if (!(MAP[cy][cx] === 'U' || bc)) { P.enEsc = false; return; }
  if (P.enEsc) return;                           // acabas de llegar: sal de la escalera antes de volver a usarla
  let d = null;
  if (bc) d = bc.sala.escalera;
  else if (enSala) { const b = BOATS[enSala.barco]; d = { x: b.x + 4, y: b.y + 1 }; }
  else if (LINK[cy * MW + cx] >= 0) { const L = LINK[cy * MW + cx]; d = { x: L % MW, y: Math.floor(L / MW) }; }
  if (!d) return;
  P.x = d.x + 0.5; P.y = d.y + 0.5; P.enEsc = true;
  beep(300, 0.08, 'square', 0.05); setTimeout(() => beep(400, 0.08, 'square', 0.05), 70);
  msg = P.y >= (NIVEL_LEIDO.altos ? NIVEL_LEIDO.altos.fy0 : 1e9) ? 'Subiste de piso' : 'Bajaste de piso'; msgT = 1.5;
}

// ---------- Vehículos: subir (T), manejar, y cañones ----------
// player.veh = { k: 'barco' | 'camion' | 'tanque' | 'canon', o: el objeto }
const CAPACIDAD = { camion: 6, tanque: 3 };              // personas que caben (conductor + pasajeros)
function idxDeP(P) { return P === player ? (MP.rol === 'cliente' ? MP.miIdx : 0) : P.idx; }
function pesado(P) { return !!(P && P.veh && (P.veh.k === 'camion' || P.veh.k === 'tanque')); }
function ocupantes(c) { return (c.piloto >= 0 ? 1 : 0) + (c.pas ? c.pas.length : 0); }
function liberar(P) {
  if (!P.veh) return;
  const o = P.veh.o;
  if (P.veh.pas) { o.pas = (o.pas || []).filter(i => i !== idxDeP(P)); }
  else {
    o.piloto = -1; if (P.veh.k === 'barco') o.cmd = null;
    if (o.pas && o.pas.length) {                          // el primer pasajero pasa a conducir
      const ni = o.pas.shift(); o.piloto = ni;
      const Q = ni === idxDeP(player) ? player : MP.otros.find(q => q.idx === ni);
      if (Q && Q.veh) Q.veh.pas = false;
    }
  }
  P.veh = null;
}
function candidatoVeh(P) {
  let mejor = null, md = 1e9;
  const prueba = (k, o, d, lim) => { if (o.piloto < 0 && d < lim && d < md) { md = d; mejor = { k, o }; } };
  for (const b of BOATS) {
    const dx = Math.max(b.x - P.x, 0, P.x - (b.x + b.l)), dy = Math.max(b.y - P.y, 0, P.y - (b.y + b.h));
    prueba('barco', b, Math.hypot(dx, dy), 1.5);
  }
  for (const c of CAM) {                                   // camión y tanque: libres, o con sitio para pasajeros
    const d = Math.hypot(c.x - P.x, c.y - P.y);
    if (c.piloto < 0) prueba(c.tipo, c, d, c.tipo === 'tanque' ? 2.6 : 2.3);
    else if (c.piloto < 90 && ocupantes(c) < CAPACIDAD[c.tipo] && d < (c.tipo === 'tanque' ? 2.6 : 2.3) && d < md) { md = d; mejor = { k: c.tipo, o: c }; }
  }
  for (const c of CAN) if (!c.op) prueba('canon', c, Math.hypot(c.x - P.x, c.y - P.y), 1.6);   // un cañón con artillero enemigo no se puede usar
  return mejor;
}
function nombreVeh(k, o) { if (k === 'canon' && o && o.tipo === 'ametra') return 'AMETRALLADORA';
  return k === 'barco' ? 'BARCO' : k === 'camion' ? 'CAMIÓN' : k === 'tanque' ? 'TANQUE' : 'CAÑÓN'; }
function usarVehiculo() {
  if (state !== 'play' || player.muerto) return;
  if (player.veh) {
    const v = player.veh;
    if (MP.rol === 'cliente') MP.enviarVeh(0, v.k, v.o.id);
    liberar(player);
    if (v.k === 'camion' || v.k === 'tanque') tryMove(player, Math.cos(player.a + 1.57) * 1.4, Math.sin(player.a + 1.57) * 1.4, 0.22);
    msg = 'Bajaste'; msgT = 1; return;
  }
  const c = candidatoVeh(player);
  if (!c) { msg = 'No hay nada para manejar cerca'; msgT = 1; return; }
  player.veh = c; vSpd = 0; volante = 0; player.vehT = 0.8;
  if ((c.k === 'camion' || c.k === 'tanque') && c.o.piloto >= 0) {   // ya hay conductor: subes de pasajero
    c.o.pas = c.o.pas || []; c.o.pas.push(idxDeP(player)); player.veh.pas = true;
    if (MP.rol === 'cliente') MP.enviarVeh(1, c.k, c.o.id);
    msg = 'Vas de pasajero (' + ocupantes(c.o) + '/' + CAPACIDAD[c.k] + ') · puedes disparar tu arma · T bajar'; msgT = 3; beep(220, 0.1, 'square', 0.06); return;
  }
  c.o.piloto = MP.rol === 'cliente' ? MP.miIdx : 0;
  if (c.k === 'barco') aviso(tieneLlaves && tieneMapa ? 'Con llaves y mapa: ¡manténte en el barco para escapar!' : 'Para escapar en barco necesitas las llaves y el mapa (último piso de la fortaleza)');
  if (c.k === 'barco') { const t = posTimon(c.o); player.x = t.x; player.y = t.y; }
  else if (c.k === 'camion' || c.k === 'tanque') { player.x = c.o.x; player.y = c.o.y; player.a = c.o.a; }
  else { player.x = c.o.x; player.y = c.o.y; }
  if (MP.rol === 'cliente') MP.enviarVeh(1, c.k, c.o.id);
  msg = c.k === 'canon' ? (c.o.tipo === 'ametra' ? 'A/D girar · mantén E para ráfaga · T bajar' : 'A/D girar · E disparar · T bajar') : c.k === 'barco' ? 'W/S mover · A/D girar · T bajar' : 'W/S mover · A/D girar · E ' + (c.k === 'tanque' ? 'cañón' : 'disparar') + ' · T bajar';
  msgT = 4; beep(220, 0.1, 'square', 0.06);
}

// ---------- Explosiones y cañonazos ----------
function explosion(x, y, r, dmg, duenio, deEnemigo) {
  FX.push({ x, y, t: 0 });
  sfx.explosion(Math.max(0.25, 1 - Math.hypot(x - player.x, y - player.y) / 40));
  if (MP.rol === 'cliente') return;                         // el daño lo calcula el anfitrión
  if (!deEnemigo) for (const c of CAM) if (c.ia) { const d = Math.hypot(c.x - x, c.y - y); if (d < r + 0.9) danarVeh(c, dmg * (1 - 0.4 * d / (r + 0.9))); }
  if (!deEnemigo) for (const e of enemies) {
    if (e.muriendo > 0) continue;
    const d = Math.hypot(e.x - x, e.y - y);
    if (d < r) hitEnemy(e, dmg * (1 - 0.6 * d / r), 0.5, x, y);
  }
  if (deEnemigo || (MP.fuegoAmigo && MP.rol !== 'solo')) {
    for (const P of [player, ...MP.otros]) {
      if (P.muerto || P === duenio) continue;
      const q = mundoPos(P), d = Math.hypot(q.x - x, q.y - y);
      if (d < r) danar(P, (deEnemigo ? dmg : 60) * (1 - 0.5 * d / r));
    }
  }
  if (MP.rol === 'host') MP.avisarExplosion(x, y);
}
// El proyectil vuela en línea recta hasta chocar con un muro o un rival. Desde un piso alto pasa por encima de los muros.
function disparoCanon(sx, sy, sa, duenio, propio, alto) {
  const bx = Math.cos(sa), by = Math.sin(sa);
  let x = sx, y = sy;
  const alcance = alto ? 60 : 26;                           // desde lo alto el cañón llega mucho más lejos
  for (let d = 0.8; d <= alcance; d += 0.3) {
    const nx = sx + bx * d, ny = sy + by * d;
    if (nx < 1 || ny < 1 || nx >= MW - 1 || ny >= MH - 1) break;
    const w = wallAt(nx, ny);
    if (w && !alto && !(propio && BOATMASK[Math.floor(ny) * MW + Math.floor(nx)] === propio)) break;
    x = nx; y = ny;
    if (enemies.some(e => e.muriendo <= 0 && !e.canon && Math.hypot(e.x - x, e.y - y) < 0.6)) break;
    if (MP.fuegoAmigo && MP.rol !== 'solo' && [player, ...MP.otros].some(P => { const q = mundoPos(P); return P !== duenio && !P.muerto && Math.hypot(q.x - x, q.y - y) < 0.5; })) break;
  }
  explosion(x, y, 2.6, 12, duenio);
}
const ARMA_FIJA = { pellets: 1, spread: 0.06, range: 30, dmg: 16, kb: 0.15 };
function dispararVeh() {
  const v = player.veh;
  if (!v || (v.k !== 'canon' && v.k !== 'tanque') || cooldownC > 0) return false;
  if (v.o.tipo === 'ametra') {                               // ametralladora fija: ráfaga rápida
    cooldownC = 0.09; punchT = punchMax = 0.06; v.o.flash = 0.08;
    beep(170 + Math.random() * 40, 0.07, 'sawtooth', 0.09);
    if (MP.rol === 'cliente') MP.enviarCanon(v.k, v.o.id, player.a);
    else disparoBalas(player.x, player.y, player.a, ARMA_FIJA, player);
    return true;
  }
  cooldownC = v.k === 'tanque' ? 0.9 : 1.1; punchT = punchMax = 0.25;
  const q = mundoPos(player);
  v.o.flash = 0.3;
  if (MP.rol === 'cliente') MP.enviarCanon(v.k, v.o.id, player.a);
  else disparoCanon(q.x, q.y, player.a, player, 0, !!v.o.alto);
  return true;
}

// ---------- Artilleros enemigos: un cañón solo funciona si alguien lo maneja ----------
function actualizarArtilleros(dt) {
  const vivos = jugadoresVivos(); if (!vivos.length) return;
  for (const c of CAN) c.flash = Math.max(0, c.flash - dt);
  artT -= dt;
  if (artT > 0) return;
  artT = 6;
  if (enemies.filter(e => e.canon && e.muriendo <= 0).length >= 4) return;
  const lib = CAN.filter(c => {
    if (c.op || c.piloto >= 0) return false;
    const w = mundoPos(c); let d = 1e9;
    for (const P of vivos) { const q = mundoPos(P); d = Math.min(d, Math.hypot(q.x - w.x, q.y - w.y)); }
    return d > 10 && d < 70;
  });
  if (!lib.length) return;
  const c = lib[Math.floor(Math.random() * lib.length)], type = Math.random() < 0.6 ? 0 : 2;
  const e = { id: ++MP.enemigoId, x: c.x, y: c.y, type, v: Math.floor(Math.random() * NUM_VARIANTES), hp: TYPES[type].hp, atk: 0.6, tiro: 5, flash: 0,
              walkT: 0, pain: 0, atkAnim: 0, muriendo: 0, canon: c };
  c.op = e; enemies.push(e);
}
function artilleroTira(e, dt) {
  if (e.canon.tipo === 'ametra') {                 // ametrallador enemigo: ráfagas cortas con pausa
    e.tiro -= dt; e.canon.flash = Math.max(e.canon.flash, 0);
    if (e.tiro > 0) return;
    const w = e.canon; let T = null, d = 1e9;
    for (const P of jugadoresVivos()) { const q = mundoPos(P), dd = Math.hypot(q.x - w.x, q.y - w.y); if (dd < d && hasLOS(w.x, w.y, q.x, q.y)) { d = dd; T = P; } }
    if (!T || d > 24) { e.tiro = 0.5; e.rafaga = 0; return; }
    e.rafaga = (e.rafaga || 0) + 1; e.atkAnim = 0.2; w.flash = 0.08;
    if (e.rafaga >= 9) { e.rafaga = 0; e.tiro = 1.6; } else e.tiro = 0.12;
    beep(150 + Math.random() * 30, 0.05, 'sawtooth', 0.06);
    if (Math.random() < 0.55 - d * 0.012) { danar(T, 4, w); sangreP(T.x, T.y, 3, 0.8); }
    return;
  }                  // el artillero dispara el cañón al jugador más cercano que esté a su alcance
  e.tiro -= dt;
  const w = mundoPos(e.canon); let T = null, d = 1e9, tq = null;
  for (const P of jugadoresVivos()) { const q = mundoPos(P), dd = Math.hypot(q.x - w.x, q.y - w.y); if (dd < d) { d = dd; T = P; tq = q; } }
  if (!T || d > 15 || e.tiro > 0) return;
  e.tiro = 9; e.atkAnim = 0.5; e.canon.flash = 0.3;
  const ang = Math.random() * 6.283, off = Math.random() * (1.2 + d * 0.05);   // más lejos, menos puntería
  if (T === player) { msg = '¡ARTILLERÍA ENEMIGA!'; msgT = 1.5; }
  explosion(tq.x + Math.cos(ang) * off, tq.y + Math.sin(ang) * off, 2.2, 18, null, true);
}
let cooldownC = 0;
let flowT = 0, lastCell = -1;
const keys = {};
const zbuf = new Array(W).fill(0);

function resetGame() {
  player.x = INICIO.x; player.y = INICIO.y; player.a = INICIO.a;
  player.hp = CONFIG.vidaInicial; player.muerto = false; player.resp = 0; player.veh = null; cooldownC = 0;
  playT = 0; skyRed = 0; marRojo = 0; masacre = false; masaT = 0; masaF = 0; condT = 40; WALL_COLORS[7] = [40, 96, 160];
  enemies = []; items = []; score = 0; kills = 0; punchT = 0; cooldown = 0; redFlash = 0; spawnT = 0;
  crearBarcos(); pickups = (NIVEL_LEIDO.objetos || []).map((o, i) => Object.assign({ idx: i }, o)); aguaT = 0; causa = '';
  weapon = 0; unlocked = [true, false, false, false, false, false, true]; ammo = WEAPONS.map(w => w.mag); reloadT = 0; msg = ''; msgT = 0; lastCell = -1; flowT = 0;
  if (MP.rol === 'host' && MP.colocarJugadores) MP.colocarJugadores();
  computeFlow();
  if (MP.rol !== 'cliente') for (let i = 0; i < CONFIG.enemigosIniciales; i++) spawnEnemy();   // el cliente recibe los rivales del anfitrión
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
  const obj = objetivos(); if (!obj.length) obj.push(player);
  const far = reachable.filter(([x, y]) => obj.every(P => Math.hypot(x + 0.5 - P.x, y + 0.5 - P.y) > CONFIG.distanciaAparicion));
  const pool = far.length ? far : reachable;
  const [x, y] = pool[Math.floor(Math.random() * pool.length)];
  const type = pickType();
  enemies.push({ id: ++MP.enemigoId, x: x + 0.5, y: y + 0.5, type, v: Math.floor(Math.random() * NUM_VARIANTES),
                 hp: TYPES[type].hp, atk: 0.6, tiro: 0.5 + Math.random() * 1.5, flash: 0,
                 walkT: Math.random() * 4, pain: 0, atkAnim: 0, muriendo: 0 });
}

// ---------- Tercera fuerza: mercenarios que desembarcan de los barcos ----------
let terceraT = 40, invasiones = 0, ultInvasion = -999;
function terceroIA(e, dt, mul) {
  const t = TYPES[e.type];
  e.flash = Math.max(0, e.flash - dt); e.pain = Math.max(0, (e.pain || 0) - dt); e.atkAnim = Math.max(0, (e.atkAnim || 0) - dt); e.tiro -= dt;
  let T = null, d = 1e9, esJug = false;
  for (const o of enemies) {
    if (o === e || o.bando === 3 || o.muriendo > 0) continue;
    const dd = Math.hypot(o.x - e.x, o.y - e.y);
    if (dd < d && dd < 18 && hasLOS(e.x, e.y, o.x, o.y)) { T = o; d = dd; esJug = false; }
  }
  for (const P of jugadoresVivos()) {
    const q = mundoPos(P), dd = Math.hypot(q.x - e.x, q.y - e.y);
    if (dd < d && dd < 18 && hasLOS(e.x, e.y, q.x, q.y)) { T = P; d = dd; esJug = true; }
  }
  if (!T) { const ob = objetivos(); let best = null, bd = 1e9; for (const P of ob) { const dd = Math.hypot(P.x - e.x, P.y - e.y); if (dd < bd) { bd = dd; best = P; } } e.obj = best || player; steer(e, dt, t.spd * mul); e.walkT = (e.walkT || 0) + dt * 4; return; }
  e.obj = T;
  if (e.tiro <= 0 && d <= t.rango) {
    e.tiro = t.cad * (0.8 + Math.random() * 0.6); e.atkAnim = 0.3; sfx.tiroEnemigo('fusil', d);
    if (esJug) { if (Math.random() < Math.max(0.15, t.prec - d * 0.04)) danar(T, t.dmgD * CONFIG.danoEnemigos, e); }
    else if (Math.random() < 0.75) { if (T.hp - 2 <= 0) T.porTercero = true; hitEnemy(T, 2, 0.1, e.x, e.y); }
  }
  if (d > t.rango * 0.6) { steer(e, dt, t.spd * mul); e.walkT = (e.walkT || 0) + dt * 4; } else e.walkT = (e.walkT || 0) + dt * 0.5;
}
function terceraFuerza() {
  if (MP.rol === 'cliente') return;
  const obj = objetivos(); if (!obj.length) obj.push(player);
  const cand = BOATS.map(b => ({ b, d: Math.hypot(b.x + b.l / 2 - obj[0].x, b.y + b.h / 2 - obj[0].y) })).sort((a, b) => a.d - b.d).slice(0, 3);
  let n = 0;
  for (const { b } of cand) {
    const bx = b.x + b.l / 2, by = b.y + b.h / 2;
    const orilla = reachable.filter(([x, y]) => y < 189 && obj.every(P => Math.hypot(x + 0.5 - P.x, y + 0.5 - P.y) > 9)).sort((p, q) => Math.hypot(p[0] - bx, p[1] - by) - Math.hypot(q[0] - bx, q[1] - by)).slice(0, 12);   // la orilla más cercana al barco
    if (!orilla.length) continue;
    for (let k = 0; k < 4; k++) {
      const [x, y] = orilla[Math.floor(Math.random() * orilla.length)], type = TYPES.length - 1;
      enemies.push({ id: ++MP.enemigoId, x: x + 0.5, y: y + 0.5, type, v: Math.floor(Math.random() * NUM_VARIANTES), hp: TYPES[type].hp, atk: 0.6, tiro: 1 + Math.random(), flash: 0, walkT: Math.random() * 4, pain: 0, atkAnim: 0, muriendo: 0, bando: 3 });
      if (k === 0) FX.push({ x: x + 0.5, y: y + 0.5, t: 0 }); n++;
    }
  }
  if (!n) return;
  invasiones++; ultInvasion = playT;
  avisoEquipo('⚠ ¡TERCERA FUERZA! Mercenarios desembarcan de los barcos: atacan a todos'); beep(110, 0.7, 'sawtooth', 0.12); setTimeout(() => beep(85, 0.7, 'sawtooth', 0.12), 500);
}
function actualizarTercera(dt) {
  if (MP.rol === 'cliente' || state !== 'play') return;
  terceraT -= dt; if (terceraT > 0) return;
  terceraT = 25;
  const vivos = enemies.some(e => e.bando === 3 && e.muriendo <= 0);
  if (vivos) return;
  const ready = (kills >= 60 && invasiones === 0) || (kills >= 100 && invasiones <= 1) || (kills >= 15 && playT - ultInvasion > 110 && Math.random() < 0.14);   // sobre todo al final, pero puede llegar antes
  if (ready) terceraFuerza();
}
function spawnJefe() {                                   // cada 25 bajas llega un Almirante: más vida y más grande
  spawnEnemy(); const e = enemies[enemies.length - 1]; if (!e) return;
  e.type = 4; e.hp = TYPES[4].hp * 4; e.jefe = 1; aviso('⚠ ¡LLEGÓ EL ALMIRANTE! Aguanta 4 veces más'); beep(70, 0.8, 'sawtooth', 0.12);
}


// ---------- La masacre: matas demasiado sin escapar → el mundo se apaga y la multitud te devora ----------
const MASACRE_BAJAS = 170;
let masacre = false, masaT = 0, masaF = 0, masaSpT = 0, gritoT = 0;
const GRITOS_TXT = ['¡AAAAAAH!', 'NO PUEDES ESCAPAR', 'ES TU CULPA', '¡MUERE!', 'TODOS TE VEN', '¡ASESINO!'];
function iniciarMasacre() {
  masacre = true; masaT = 0; masaSpT = 0; gritoT = 0; HELI = null;
  avisoEquipo('☠ MATASTE DEMASIADO. LOS MUERTOS VIENEN POR TI. YA NO HAY ESCAPE.');
  tiembla = 1.2; sfx.explosion(1);
}
function actualizarMasacre(dt) {
  if (MP.rol === 'cliente' || state !== 'play') return;
  if (!masacre && kills >= MASACRE_BAJAS) iniciarMasacre();
  if (!masacre) return;
  masaT += dt;
  masaSpT -= dt;
  const vivosM = enemies.filter(e => e.masa && e.muriendo <= 0).length, tope = Math.min(90, 25 + masaT * 1.6);
  while (masaSpT <= 0) {
    masaSpT += 0.1;
    if (vivosM >= tope) break;
    const objs = jugadoresVivos(); if (!objs.length) break;
    const P = objs[Math.floor(Math.random() * objs.length)], q = mundoPos(P);
    const cerca = reachable.filter(([x, y]) => { const d = Math.hypot(x + 0.5 - q.x, y + 0.5 - q.y); return d > 3.2 && d < 9; });
    if (!cerca.length) { spawnEnemy(); const e = enemies[enemies.length - 1]; if (e) { e.masa = 1; e.hp = Math.ceil(e.hp * 0.6); } continue; }
    const [x, y] = cerca[Math.floor(Math.random() * cerca.length)], type = pickType();
    enemies.push({ id: ++MP.enemigoId, x: x + 0.5, y: y + 0.5, type, v: Math.floor(Math.random() * NUM_VARIANTES), hp: Math.max(1, Math.ceil(TYPES[type].hp * 0.6)), atk: 0.4 + Math.random() * 0.5, tiro: 99, flash: 0, walkT: Math.random() * 4, pain: 0, atkAnim: 0, muriendo: 0, masa: 1 });
  }
}

// ---------- Enemigos que conducen camiones y tanques ----------
let condT = 40;
function caido(c) { return c.piloto === 99; }              // vehículo destruido
function reclutarConductor(dt) {
  if (MP.rol === 'cliente' || state !== 'play') return;
  condT -= dt; if (condT > 0) return;
  condT = 22 + Math.random() * 14;
  if (CAM.filter(c => c.ia).length >= (kills > 60 ? 3 : 2)) return;
  const libres = CAM.filter(c => c.piloto < 0 && jugadoresVivos().every(P => Math.hypot(c.x - P.x, c.y - P.y) > 9));
  if (!libres.length) return;
  const c = libres[Math.floor(Math.random() * libres.length)], tk = c.tipo === 'tanque';
  c.ia = { hp: tk ? 30 : 14, cd: 2.5, golpe: 0, giro: 0, dir: 1 }; c.piloto = 90;
  avisoEquipo('⚠ ¡UN ENEMIGO TOMÓ ' + (tk ? 'UN TANQUE' : 'UN CAMIÓN') + '! Destrúyelo (cohetes y granadas)'); beep(120, 0.5, 'sawtooth', 0.1);
}
function danarVeh(c, n) {
  if (!c.ia) return; c.ia.hp -= n; c.flash = 0.15; sfx.golpe();
  if (c.ia.hp <= 0) {
    c.ia = null; c.piloto = 99; kills += 2; score += 150; aviso('¡Destruiste el ' + (c.tipo === 'tanque' ? 'TANQUE' : 'CAMIÓN') + ' enemigo!');
    explosion(c.x, c.y, 3.2, 35, null, true); sangreP(c.x, c.y, 4, 1);
  }
}
function actualizarVehIA(dt) {
  if (MP.rol === 'cliente' || state !== 'play') return;
  for (const c of CAM) {
    const I = c.ia; if (!I) continue;
    const tk = c.tipo === 'tanque', rad = tk ? 0.85 : 0.7;
    I.cd -= dt; I.golpe -= dt; I.giro -= dt; c.flash = Math.max(0, (c.flash || 0) - dt);
    let T = null, d = 1e9;
    for (const P of jugadoresVivos()) { const q = mundoPos(P), dd = Math.hypot(q.x - c.x, q.y - c.y); if (dd < d) { d = dd; T = { x: q.x, y: q.y, P }; } }
    if (!T) continue;
    const want = Math.atan2(T.y - c.y, T.x - c.x), rate = tk ? 1.5 : 2.0;
    if (I.giro > 0) c.a += I.dir * rate * dt;                        // esquivando un obstáculo
    else { let da = want - c.a; while (da > Math.PI) da -= 6.2832; while (da < -Math.PI) da += 6.2832; c.a += Math.max(-rate * dt, Math.min(rate * dt, da)); }
    const sp = (tk ? 3.4 : 6.0) * (d < 1.6 ? 0.4 : 1), x0 = c.x, y0 = c.y;
    tryMove(c, Math.cos(c.a) * sp * dt, Math.sin(c.a) * sp * dt, rad, true);
    if (Math.hypot(c.x - x0, c.y - y0) < sp * dt * 0.3 && I.giro <= 0) { I.giro = 0.7 + Math.random() * 0.6; I.dir = Math.random() < 0.5 ? 1 : -1; }
    if (I.golpe <= 0) for (const P of jugadoresVivos()) {            // atropella jugadores
      const q = mundoPos(P);
      if (Math.hypot(q.x - c.x, q.y - c.y) < (tk ? 1.25 : 1.05)) { danar(P, tk ? 35 : 28, null); I.golpe = 1.0; sfx.golpe(); if (P === player) tiembla = Math.max(tiembla, 0.6); }
    }
    if (tk && I.cd <= 0 && d < 16 && d > 3 && hasLOS(c.x, c.y, T.x, T.y)) {   // el tanque dispara su cañón
      I.cd = 3.4; c.flash = 0.3;
      const bx = Math.cos(want), by = Math.sin(want); let x = c.x, y = c.y;
      for (let r = 1; r <= 18; r += 0.4) { x = c.x + bx * r; y = c.y + by * r; if (wallAt(x, y)) { x -= bx * 0.4; y -= by * 0.4; break; } if (Math.hypot(x - T.x, y - T.y) < 0.8) break; }
      explosion(x, y, 2.4, 22, null, true);
    }
  }
}

// Camina hacia el jugador: directo si lo ve, o siguiendo el mapa de distancias
function steer(e, dt, speed) {
  const T = e.obj || player;
  let tx = T.x, ty = T.y;
  if (!hasLOS(e.x, e.y, T.x, T.y)) {
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
  tryMove(e, (ex / ed) * speed * dt, (ey / ed) * speed * dt, 0.2, true);
}

// ---------- Sangre ----------
const COL_SANGRE = ['#6e0a0c', '#8f1014', '#b21a18', '#4c0608'];
function sangreP(x, y, n, f) {                     // chorro de gotas que cae al suelo y deja manchas
  for (let i = 0; i < n && GORE.length < 260; i++) {
    const a = Math.random() * 6.283, v = (0.6 + Math.random() * 2.2) * (f || 1);
    GORE.push({ x, y, z: 0.35 + Math.random() * 0.4, vx: Math.cos(a) * v, vy: Math.sin(a) * v, vz: 1 + Math.random() * 2.6, c: COL_SANGRE[(Math.random() * 4) | 0] });
  }
}
function mancha(x, y, r) { MANCHAS.push({ x, y, r, c: COL_SANGRE[(Math.random() * 3) | 0] }); if (MANCHAS.length > 360) MANCHAS.shift(); }
function dejarCuerpo(e) {
  if (e.explota) { sangreP(e.x, e.y, 50, 2.2); for (let i = 0; i < 8; i++) mancha(e.x + (Math.random() - 0.5) * 2.4, e.y + (Math.random() - 0.5) * 2.4, 0.15 + Math.random() * 0.35); return; }   // reventó: no queda cuerpo
  CUERPOS.push({ x: e.x, y: e.y, type: e.type, v: e.v, apl: !!e.aplastado });
  if (CUERPOS.length > 220) CUERPOS.shift();
  for (let i = 0; i < 6; i++) mancha(e.x + (Math.random() - 0.5) * 1.2, e.y + (Math.random() - 0.5) * 1.2, 0.12 + Math.random() * 0.25);
  sangreP(e.x, e.y, 26, 1.4);
}
function actualizarSangre(dt) {
  for (const g of GORE) {
    g.x += g.vx * dt; g.y += g.vy * dt; g.z += g.vz * dt; g.vz -= 9 * dt;
    if (wallAt(g.x, g.y)) { g.vx = g.vy = 0; }
    if (g.z <= 0) { g.dead = true; if (Math.random() < 0.55) mancha(g.x, g.y, 0.05 + Math.random() * 0.1); }
  }
  GORE = GORE.filter(g => !g.dead);
}

// ---------- Combate ----------
function killEnemy(e) {
  if (e.id !== undefined && !e.porTercero && Math.hypot(e.x - player.x, e.y - player.y) < 3.2) salpicarPantalla(1 + (tet > 0.4 ? 2 : 0), false);   // la sangre te salpica si matas de cerca
  dejarCuerpo(e);
  if (e.canon) { e.canon.op = null; e.canon = null; }     // el cañón queda libre
  e.muriendo = MUERTE_SEG;           // empieza la animación de muerte; luego se quita solo
  if (e.porTercero) { beep(90, 0.2, 'triangle', 0.05); return; }   // lo mató la tercera fuerza: no suma bajas
  score += TYPES[e.type].pts; kills++;
  combo = comboT > 0 ? combo + 1 : 1; comboT = 3;           // bajas seguidas dan puntos extra
  if (combo >= 2) { const extra = Math.round(TYPES[e.type].pts * 0.5 * (combo - 1)); score += extra; }
  if (FRASES_BAJAS[kills]) aviso(FRASES_BAJAS[kills]);
  if (TETRICAS[kills]) { const tx = TETRICAS[kills]; setTimeout(() => { if (state === 'play') aviso(tx); }, 3000); }
  if (kills % 10 === 0 && granadas < 9) { granadas++; msg = (FRASES_BAJAS[kills] || '') + ' +1 granada'; msgT = 3.5; }
  if (score > record) { record = score; try { localStorage.setItem('ga_record', String(record)); } catch (e) {} }
  if (e.jefe) { items.push({ x: e.x, y: e.y, ttl: 30 }); items.push({ x: e.x + 0.5, y: e.y, ttl: 30 }); aviso('¡Derrotaste al ALMIRANTE! Suelta botiquines'); }
  else if (kills % 25 === 0 && MP.rol !== 'cliente') spawnJefe();
  beep(90, 0.25, 'triangle', 0.08);
  if (Math.random() < CONFIG.probColacion) items.push({ x: e.x, y: e.y, ttl: 20 });
  else if (MP.rol === 'solo' && Math.random() < 0.18) items.push({ x: e.x, y: e.y, ttl: 25, m: 1 });   // caja de munición
  for (let i = 1; CONFIG.armasPorBajas && i < WEAPONS.length; i++) {
    if (!unlocked[i] && kills >= WEAPONS[i].unlock) {
      unlocked[i] = true; weapon = i; reloadT = 0; msg = WEAPON_MSG[i]; msgT = 3;
      beep(520, 0.15, 'square', 0.06); setTimeout(() => beep(780, 0.2, 'square', 0.06), 130);
    }
  }
}

function hitEnemy(e, dmg, kb, fx, fy) {
  if (e.muriendo > 0) return;
  e.hp -= dmg; e.flash = 0.15; e.pain = 0.25;
  sangreP(e.x, e.y, 5 + Math.round(dmg / 8), 1);
  const dx = e.x - (fx === undefined ? player.x : fx), dy = e.y - (fy === undefined ? player.y : fy), d = Math.hypot(dx, dy) || 1;
  tryMove(e, (dx / d) * kb, (dy / d) * kb, 0.2, true);
  if (e.hp <= 0) killEnemy(e);
}

// Disparo: cada bala es un rayo que golpea al más cercano en esa dirección (enemigo, o compañero si hay fuego amigo)
let tiros = 0, aciertos = 0, combo = 0, comboT = 0;
function disparoBalas(sx, sy, sa, wp, duenio) {
  if (duenio === player) tiros++;
  if (wp.type === 'cohete') {                              // cohete: vuela recto y explota al chocar
    const bx = Math.cos(sa), by = Math.sin(sa); let x = sx, y = sy;
    for (let d = 0.8; d <= wp.range; d += 0.25) {
      x = sx + bx * d; y = sy + by * d;
      if (wallAt(x, y)) { x -= bx * 0.3; y -= by * 0.3; break; }
      if (tapado(sx, sy, x, y, duenio && duenio.veh && duenio.veh.o)) { break; }
      if (enemies.some(e => e.muriendo <= 0 && Math.hypot(e.x - x, e.y - y) < 0.55)) break;
    }
    explosion(x, y, 2.8, wp.dmg, duenio, false); if (duenio === player) aciertos++;
    return true;
  }
  let hit = false;
  const amigos = (MP.fuegoAmigo && MP.rol !== 'solo') ? [player, ...MP.otros].filter(P => P !== duenio && !P.muerto) : [];
  for (let k = 0; k < wp.pellets; k++) {
    const ang = sa + (Math.random() - 0.5) * wp.spread;
    const bx = Math.cos(ang), by = Math.sin(ang);
    let best = null, bd = 1e9, bestP = null;
    const miVeh = duenio && duenio.veh ? duenio.veh.o : null;
    const lim = Math.min(wp.range, rayWall(sx, sy, bx, by, wp.range), rayObst(sx, sy, bx, by, wp.range, miVeh));   // hasta dónde llega la bala antes de chocar
    for (const e of enemies) {
      if (e.muriendo > 0) continue;
      const ex = e.x - sx, ey = e.y - sy, along = ex * bx + ey * by, r = hitR(e);
      if (along < 0.2 || along >= bd) continue;
      if (Math.abs(ex * by - ey * bx) > r) continue;                   // hitbox del cuerpo del enemigo
      if (e.canon && e.canon.alto) {                                   // al artillero de una torre se le dispara por encima de los muros (pero no a través de camiones/tanques)
        if (along > wp.range || along > rayObst(sx, sy, bx, by, wp.range, miVeh, e.canon) + 0.05) continue;
      } else if (along > lim + r * 0.6) continue;                      // la bala se quedó en la pared / el obstáculo
      bd = along; best = e; bestP = null;
    }
    for (const P of amigos) {
      const ex = P.x - sx, ey = P.y - sy, along = ex * bx + ey * by;
      if (along < 0.2 || along > wp.range || along >= bd) continue;
      if (Math.abs(ex * by - ey * bx) > 0.3 || along > lim + 0.2) continue;
      bd = along; bestP = P; best = null;
    }
    let hv = null;                                                    // ¿la bala pega en un camión/tanque enemigo?
    for (const c of CAM) if (c.ia) {
      const ox = c.x - sx, oy = c.y - sy, along = ox * bx + oy * by, r = c.tipo === 'tanque' ? 0.95 : 0.85;
      const perp = Math.abs(ox * by - oy * bx); if (perp > r) continue;
      const sup = along - Math.sqrt(r * r - perp * perp);                 // distancia hasta la superficie del vehículo
      if (sup < 0 || sup > lim + 0.1 || (hv && sup >= hv.along)) continue;
      hv = { c, along: sup };
    }
    if (hv && hv.along < bd) { danarVeh(hv.c, wp.dmg * 0.9); hit = true; continue; }
    if (best) { hitEnemy(best, wp.dmg, wp.kb, sx, sy); hit = true; }
    else if (bestP) { danar(bestP, wp.dmg * CONFIG.danoAmigo); hit = true; if (MP.avisoAmigo) MP.avisoAmigo(bestP, duenio); }
  }
  enemies = enemies.filter(e => !e.dead);
  if (hit && duenio === player) { hitT = 0.14; aciertos++; }
  return hit;
}

function attack() {
  if (state === 'menu' && MP.lobby) return;                // todavía estás en la sala
  if (state === 'menu' || (state === 'over' && overT <= 0)) {
    if (MP.rol === 'cliente') return;                      // solo el anfitrión (o el modo solo) empieza la partida
    resetGame(); if (MP.rol === 'host') MP.anunciarInicio();
    return;
  }
  if (state !== 'play' || cooldown > 0 || player.muerto) return;
  if (player.veh && !player.veh.pas && (player.veh.k === 'canon' || player.veh.k === 'tanque')) { dispararVeh(); return; }
  const wp = WEAPONS[weapon];
  if (reloadT > 0) return;
  if (ammo[weapon] <= 0) { startReload(); return; }
  ammo[weapon]--;
  cooldown = wp.cd; punchT = wp.dur; punchMax = wp.dur;
  sfx.disparo(wp);
  if (MP.rol === 'cliente') MP.enviarDisparo(player.x, player.y, player.a, weapon);
  else if (disparoBalas(player.x, player.y, player.a, wp, player)) beep(300, 0.06, 'square', 0.06);
  if (ammo[weapon] <= 0) startReload();
}

function startReload() {
  const wp = WEAPONS[weapon];
  if (state !== 'play' || reloadT > 0 || ammo[weapon] >= wp.mag) return;
  reloadT = wp.reload; reloadW = weapon;
  beep(140, 0.08, 'square', 0.06); setTimeout(() => beep(200, 0.06, 'square', 0.05), 220);
}
function selectWeapon(i) { if (unlocked[i]) { if (i !== weapon) reloadT = 0; weapon = i; beep(400, 0.05, 'square', 0.04); } }
function cycleWeapon(dir) {
  for (let k = 1; k <= WEAPONS.length; k++) {
    const i = (weapon + dir * k + WEAPONS.length * 4) % WEAPONS.length;
    if (unlocked[i]) { weapon = i; reloadT = 0; beep(400, 0.05, 'square', 0.04); return; }
  }
}

// ---------- Actualización por cuadro ----------
function recogerLocal(o) {                               // el jugador local recoge un objeto
  if (o.t === 'arma') {
    const w = WEAPONS[o.arma];
    if (!unlocked[o.arma]) { unlocked[o.arma] = true; weapon = o.arma; reloadT = 0; msg = '¡ENCONTRASTE: ' + w.name + '!  (Q = cambiar)'; }
    else { ammo[o.arma] = w.mag; msg = 'MUNICIÓN: ' + w.name; }
    msgT = 3; beep(520, 0.12, 'square', 0.06); setTimeout(() => beep(780, 0.15, 'square', 0.06), 120);
  } else { beep(660, 0.12, 'triangle', 0.07); aviso('Vendas: +' + CONFIG.curaColacion + ' de vida'); }
}
function reaparecer(P) {
  const c = reachable[Math.min(reachable.length - 1, 1 + Math.floor(Math.random() * 6))];
  P.muerto = false; P.hp = 60; P.x = c[0] + 0.5; P.y = c[1] + 0.5; P.resp = 0;
  if (P === player) { msg = '¡REAPARECISTE!'; msgT = 2; reloadT = 0; }
  else if (MP.enviarA) MP.enviarA(P, { t: 'rea', x: P.x, y: P.y, hp: P.hp });
}

function update(dt) {
  if (state === 'over') { overT -= dt; return; }
  if (state !== 'play') return;
  const cliente = MP.rol === 'cliente', vivo = !player.muerto;
  playT += dt; skyDrift += dt * 5;
  skyRed += (Math.min(1, kills / 60 + playT / 1500) - skyRed) * Math.min(1, dt * 0.8);
  marRojo = Math.min(1, playT / TIEMPO_ROJO);                       // con el tiempo el mar se vuelve sangre
  { const k = marRojo, base = [40, 96, 160], sangre = [120, 12, 16]; WALL_COLORS[7] = base.map((v, i) => Math.round(v + (sangre[i] - v) * k)); }

  // --- tu personaje
  if (vivo) {
    const turn = (keys.ArrowLeft || keys.KeyA ? -1 : 0) + (keys.ArrowRight || keys.KeyD ? 1 : 0);
    const mv = (keys.ArrowUp || keys.KeyW ? 1 : 0) + (keys.ArrowDown || keys.KeyS ? -1 : 0);
    player.a += turn * 2.3 * dt + mouseDX * 0.0045; mouseDX = 0;      // mouse: clic derecho + arrastrar mueve la cámara
    const V = player.veh;
    player.cmd = null;
    if (V && V.k === 'barco') {                           // manejas el barco: avanza hacia donde miras (en las 4 direcciones)
      player.mov = false;
      if (mv) {
        const c = Math.cos(player.a), sn = Math.sin(player.a);
        const cmd = Math.abs(c) >= Math.abs(sn) ? [Math.sign(c) * mv, 0] : [0, Math.sign(sn) * mv];
        player.cmd = cmd;
        if (!cliente) { V.o.cmd = cmd; V.o.cmdT = 0.3; }
      }
    } else if (V && V.k === 'canon') {
      player.mov = false; player.x = V.o.x; player.y = V.o.y;
    } else if (V && V.pas) {                              // pasajero: te lleva el vehículo; tú miras y disparas
      const o = V.o, si = Math.max(0, (o.pas || []).indexOf(idxDeP(player))), lado = (si % 2 ? 1 : -1) * 0.3 * (1 + Math.floor(si / 2) * 0.5), atras = si > 1 ? -0.35 : 0;
      player.mov = false; player.x = o.x + Math.cos(o.a + 1.5708) * lado + Math.cos(o.a) * atras; player.y = o.y + Math.sin(o.a + 1.5708) * lado + Math.sin(o.a) * atras;
    } else if (V && (V.k === 'camion' || V.k === 'tanque')) {          // camión y tanque: aceleración, freno, inercia, choques y atropellos
      const tk = V.k === 'tanque', sp0 = Math.abs(vSpd);
      player.a += turn * 2.3 * dt * ((tk ? 0.8 : 1 - 0.45 * Math.min(1, sp0 / 9.5)) - 1);   // el camión gira menos rápido a más velocidad
      volante += (turn - volante) * Math.min(1, dt * 7);
      const obj = mv * (mv > 0 ? (tk ? 5.5 : 9.5) : (tk ? 2.5 : 3.5));
      const frenando = mv !== 0 && vSpd !== 0 && Math.sign(vSpd) !== Math.sign(mv);
      vSpd += (obj - vSpd) * Math.min(1, dt * (frenando ? 4.5 : mv ? (tk ? 1.3 : 1.1) : (tk ? 2.6 : 0.9)));
      if (Math.abs(vSpd) < 0.05 && !mv) vSpd = 0;
      const x0 = player.x, y0 = player.y;
      tryMove(player, Math.cos(player.a) * vSpd * dt, Math.sin(player.a) * vSpd * dt, tk ? 0.85 : 0.7);
      const hecho = Math.hypot(player.x - x0, player.y - y0);
      if (Math.abs(vSpd) > 3 && hecho < Math.abs(vSpd) * dt * 0.35) {   // choque contra un muro
        tiembla = Math.max(tiembla, 0.35); sfx.golpe(); if (!tk && Math.abs(vSpd) > 6) danar(player, 4, null); vSpd *= -0.25;
      }
      if (MP.rol !== 'cliente' && Math.abs(vSpd) > 2.2) {              // atropellar enemigos
        for (const e of enemies) if (e.muriendo <= 0 && !e.canon && Math.hypot(e.x - player.x, e.y - player.y) < (tk ? 1.25 : 1.0)) { hitEnemy(e, tk ? 99 : 8, 0.4, Math.cos(player.a), Math.sin(player.a)); tiembla = Math.max(tiembla, 0.25); sfx.golpe(); }
      }
      player.mov = Math.abs(vSpd) > 0.3; walk += dt * Math.abs(vSpd) * 1.6;
      V.o.x = player.x; V.o.y = player.y; V.o.a = player.a;
      tkT -= dt; if (tkT <= 0 && Math.abs(vSpd) > 0.6) { tkT = tk ? 0.15 : 0.26; ruido(0.06, 'bandpass', tk ? 320 : 700, 150, tk ? 0.16 : 0.08, (Math.random() - 0.5) * 0.2); }
    } else {
      player.mov = !!mv;
      if (mv) {
        const enMar = hondo(player.x, player.y);
        const camion = V && V.k === 'camion', tanque = V && V.k === 'tanque';
        const corre = !V && mv > 0 && (keys.ShiftLeft || keys.ShiftRight) && estamina > 0.02;     // correr con Shift gasta aliento
        if (corre) estamina = Math.max(0, estamina - dt * 0.4);
        const v = (camion ? (mv > 0 ? 8 : 3.5) : tanque ? (mv > 0 ? 5.5 : 2.5) : CONFIG.velocidadJugador * (corre ? 1.6 : 1)) * dt * (enMar && !tanque ? CONFIG.velAgua : 1);
        tryMove(player, Math.cos(player.a) * v * Math.sign(mv), Math.sin(player.a) * v * Math.sign(mv), camion ? 0.7 : tanque ? 0.85 : 0.22);
        walk += dt * 9;
      }
      if (V && (V.k === 'camion' || V.k === 'tanque')) { V.o.x = player.x; V.o.y = player.y; V.o.a = player.a; }
      if (!V) usarEscalera(player);
    }
  }
  punchT = Math.max(0, punchT - dt);
  cooldown = Math.max(0, cooldown - dt); cooldownC = Math.max(0, cooldownC - dt);
  player.vehT = Math.max(0, (player.vehT || 0) - dt);
  actualizarAmbiente(dt);
  hitT = Math.max(0, hitT - dt); comboT = Math.max(0, comboT - dt); if (comboT <= 0) combo = 0; golpeT = Math.max(0, golpeT - dt); actualizarGranadas(dt); actualizarAviones(dt); actualizarPeces(dt); actualizarEscape(dt); actualizarTercera(dt);
  for (const a of aves) { a.th += a.v * dt; a.fase += dt; }
  aveT -= dt; if (aveT <= 0) { aveT = 10 + Math.random() * 14; if (player.y < 40) { beep(1500, 0.08, 'sine', 0.03); setTimeout(() => beep(1250, 0.12, 'sine', 0.03), 110); } }
  if (!((keys.ShiftLeft || keys.ShiftRight) && player.mov)) estamina = Math.min(1, estamina + dt * 0.3);
  actualizarSangre(dt); actualizarPatos(); bailaT = Math.max(0, bailaT - dt); tiembla = Math.max(0, tiembla - dt);
  for (const f of FX) f.t += dt;
  FX = FX.filter(f => f.t < 0.7);
  redFlash = Math.max(0, redFlash - dt);
  msgT = Math.max(0, msgT - dt);
  if (vivo && hondo(player.x, player.y) && !(player.veh && player.veh.k === 'tanque')) {                // mar profundo: te hundes
    if (!cliente) player.hp -= CONFIG.danoAgua * dt;
    aguaT = Math.min(1, aguaT + dt * 3); causa = 'mar';
    if (msgT <= 0) { msg = '¡TE HUNDES! SAL DEL MAR'; msgT = 1; }
    if (Math.random() < dt * 3) beep(300 + Math.random() * 200, 0.05, 'sine', 0.04);
  } else aguaT = Math.max(0, aguaT - dt * 3);
  if (reloadT > 0) {
    if (reloadW !== weapon) reloadT = 0;
    else { reloadT -= dt; if (reloadT <= 0) { reloadT = 0; ammo[weapon] = WEAPONS[weapon].mag; beep(520, 0.06, 'square', 0.05); } }
  }
  if (vivo && (keys.KeyE || keys.Space || keys.Enter || firing)) attack();
  if (cliente) { MP.actualizarCliente(dt); return; }      // el cliente solo recibe lo que pasa; el anfitrión lo calcula todo

  // --- el mundo (modo solo y anfitrión)
  moverBarcos(dt); actualizarArtilleros(dt); actualizarVehIA(dt); reclutarConductor(dt); actualizarMasacre(dt);
  for (const c of CAM) if (c.piloto >= 0 && c.piloto < 90) for (const e of enemies) {   // el camión arrolla
    if (e.muriendo > 0 || Math.hypot(e.x - c.x, e.y - c.y) > 1.1) continue;
    hitEnemy(e, 50, 0.8, c.x, c.y);
  }
  for (const o of MP.otros) {                             // compañeros: avance de animación, mar y daño recibido
    o.atkAnim = Math.max(0, (o.atkAnim || 0) - dt); o.golpe = Math.max(0, (o.golpe || 0) - dt);
    if (o.mov) o.walkT = (o.walkT || 0) + dt * 6;
    if (!o.muerto && hondo(o.x, o.y) && !(o.veh && o.veh.k === 'tanque')) o.hp -= CONFIG.danoAgua * dt;
  }
  for (const P of [player, ...MP.otros]) {                // armas y raciones por el mapa
    if (P.muerto || pesado(P)) continue;                    // dentro de un camión/tanque no se recoge nada
    for (const o of pickups) {
      if (o.listo || Math.hypot(o.x - P.x, o.y - P.y) > 0.7) continue;
      if (o.t === 'racion' && P.hp >= CONFIG.vidaInicial) continue;
      if (o.t === 'racion') P.hp = Math.min(CONFIG.vidaInicial, P.hp + CONFIG.curaColacion);
      o.listo = true;
      if (P === player) recogerLocal(o); else if (MP.enviarA) MP.enviarA(P, { t: 'pk', k: o.t, i: o.arma });
    }
  }
  pickups = pickups.filter(o => !o.listo);
  flowT -= dt;
  const pc = objetivos().map(P => Math.floor(P.y) * MW + Math.floor(P.x)).join(',');
  if (pc !== lastCell || flowT <= 0) { computeFlow(); lastCell = pc; flowT = 0.5; }

  const mul = 1 + Math.min(kills, 40) * 0.01;      // se vuelven un poco más rápidos
  const objs = objetivos();
  for (const e of enemies) {
    if (e.muriendo > 0) { e.muriendo -= dt; if (e.muriendo <= 0) e.dead = true; continue; }
    if (bailaT > 0 && !e.canon) { e.walkT = (e.walkT || 0) + dt * 9; continue; }
    if (e.bando === 3) { terceroIA(e, dt, mul); continue; }   // huevo de pascua: ¡bailan!
    const t = TYPES[e.type];
    e.flash = Math.max(0, e.flash - dt);
    e.pain = Math.max(0, (e.pain || 0) - dt);
    e.atkAnim = Math.max(0, (e.atkAnim || 0) - dt);
    e.atk -= dt;
    if (e.canon) { e.x = e.canon.x; e.y = e.canon.y; e.walkT = (e.walkT || 0) + dt * 0.4; artilleroTira(e, dt); continue; }   // artillero: se queda en su cañón
    e.escT = Math.max(0, (e.escT || 0) - dt);
    { const ci = Math.floor(e.y) * MW + Math.floor(e.x), L = LINK[ci];     // sube o baja por las escaleras
      if (L >= 0 && !e.escT && dist[L] >= 0 && dist[L] < dist[ci]) { e.x = (L % MW) + 0.5; e.y = Math.floor(L / MW) + 0.5; e.escT = 1.5; } }
    let T = null, d = 1e9;                                // ataca al jugador vivo más cercano
    for (const P of objs) { const dd = Math.hypot(P.x - e.x, P.y - e.y); if (dd < d) { d = dd; T = P; } }
    if (!T) continue;
    e.obj = T;
    const reach = 0.6 + t.sc * 0.15;
    e.tiro -= dt;
    const ve = !e.masa && d <= t.rango && hasLOS(e.x, e.y, T.x, T.y) && !tapado(e.x, e.y, T.x, T.y, T.veh && T.veh.o, e.canon);     // te ve y está a tiro (un camión, tanque o torre en medio te cubre)
    if (ve && d > reach + 0.5 && e.tiro <= 0) {                // dispara
      e.tiro = t.cad * (0.8 + Math.random() * 0.5); e.atkAnim = 0.3;
      if (Math.random() < Math.max(0.12, t.prec - d * 0.04)) danar(T, t.dmgD * CONFIG.danoEnemigos, e);
      sfx.tiroEnemigo(t.arma, d);
    }
    if (d > reach && !(ve && d <= t.rango * 0.55)) {           // avanza (se detiene a disparar)
      steer(e, dt, t.spd * mul * (e.masa ? 1.7 : 1));
      e.walkT = (e.walkT || 0) + dt * (3 + 3 * t.spd);          // avanza el ciclo de caminata
    } else if (d > reach) {
      e.walkT = (e.walkT || 0) + dt * 0.5;
    } else if (e.atk <= 0) {
      danar(T, e.masa ? t.dmg * (0.6 + Math.min(1.5, masaT * 0.025)) : t.dmg, e); e.atk = e.masa ? 0.6 : 0.9; e.atkAnim = 0.45;
      sfx.golpe();
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
  // colaciones que sueltan los enemigos
  for (const it of items) {
    it.ttl -= dt;
    if (it.m) {
      if (!player.muerto && !pesado(player) && it.ttl > 0 && Math.hypot(it.x - player.x, it.y - player.y) < 0.7) {
        const w = WEAPONS[weapon]; ammo[weapon] = w.mag; if (weapon > 0) for (let k = 1; k < WEAPONS.length; k++) if (unlocked[k]) ammo[k] = WEAPONS[k].mag;
        it.ttl = 0; aviso('Munición repuesta'); beep(520, 0.08, 'square', 0.05);
      }
      continue;
    }
    for (const P of [player, ...MP.otros]) {
      if (P.muerto || pesado(P) || it.ttl <= 0 || P.hp >= CONFIG.vidaInicial || Math.hypot(it.x - P.x, it.y - P.y) > 0.6) continue;
      P.hp = Math.min(CONFIG.vidaInicial, P.hp + CONFIG.curaColacion); it.ttl = 0;
      if (P === player) { beep(660, 0.12, 'triangle', 0.07); aviso('Vendas: +' + CONFIG.curaColacion + ' de vida'); }
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

  // --- caídos y reapariciones
  if (!player.muerto && player.hp <= 0) {
    player.hp = 0; firing = false;
    if (MP.rol === 'solo') { state = 'over'; overT = 1; return; }
    player.muerto = true; player.resp = 10; liberar(player);
  }
  for (const o of MP.otros) if (!o.muerto && o.hp <= 0) { o.hp = 0; o.muerto = true; o.resp = 10; liberar(o); }
  if (MP.rol === 'host') {
    if ([player, ...MP.otros].every(P => P.muerto)) { state = 'over'; overT = 2; causa = ''; if (MP.anunciarFin) MP.anunciarFin(); return; }
    for (const P of [player, ...MP.otros]) if (P.muerto) { P.resp -= dt; if (P.resp <= 0) reaparecer(P); }
  }
}

// ############################################################
// ## 6. DIBUJO: piso, cielo, muros, rivales, arma y barra de estado
// ############################################################

// ---------- Piso y techo/cielo ----------
const floorImg = ctx.createImageData(W, VH);
// ---------- Cielo ----------
// Dos panoramas pintados al iniciar: cielo despejado con sol y nubes, y cielo rojo de guerra con sol sangriento y nubes de humo.
// Se mezclan según qué tan "rojo" esté el cielo (sube con cada baja y con el tiempo).
const SKY_W = 1024;
let SKY_A = null, SKY_B = null, skyRed = 0, skyDrift = 0, playT = 0, marRojo = 0;
const TIEMPO_ROJO = 480;                                  // segundos para que el mar quede completamente rojo y los bombardeos al máximo
function crearCielo() {
  const H = Math.ceil(VH / 2);
  SKY_A = new Uint8ClampedArray(SKY_W * H * 3); SKY_B = new Uint8ClampedArray(SKY_W * H * 3);
  const hv = (i, j) => { let h = (i * 374761393 + j * 668265263) | 0; h = (h ^ (h >>> 13)) * 1274126177 | 0; return ((h ^ (h >>> 16)) >>> 0) / 4294967295; };
  const suave = t => t * t * (3 - 2 * t);
  const ruido = (x, y, per) => {                              // ruido de valor que se repite cada "per" celdas en horizontal
    const x0 = Math.floor(x), y0 = Math.floor(y), fx = suave(x - x0), fy = suave(y - y0);
    const a = hv(((x0 % per) + per) % per, y0), b = hv((((x0 + 1) % per) + per) % per, y0), c = hv(((x0 % per) + per) % per, y0 + 1), d = hv((((x0 + 1) % per) + per) % per, y0 + 1);
    return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
  };
  const fbm = (u, v) => ruido(u / 64, v / 24, 16) * 0.5 + ruido(u / 32, v / 12, 32) * 0.27 + ruido(u / 16, v / 6, 64) * 0.15 + ruido(u / 8, v / 3, 128) * 0.08;
  const mez = (a, b, t) => a + (b - a) * t;
  for (let v = 0; v < H; v++) {
    const t = v / (H - 1);                                    // 0 arriba, 1 horizonte
    for (let u = 0; u < SKY_W; u++) {
      const k = (v * SKY_W + u) * 3;
      const dens = fbm(u, v * 1.3), dens2 = fbm(u + 6, v * 1.3 + 4);
      const cob = Math.max(0, Math.min(1, (dens - (0.58 - 0.14 * t)) / 0.2));           // cobertura de nubes (más hacia el horizonte)
      const sombra = Math.max(0, Math.min(1, (dens2 - dens) * 5 + 0.5));                 // borde iluminado / base oscura
      // --- despejado
      let r = mez(48, 186, t * t), g = mez(112, 224, Math.pow(t, 1.4)), b = mez(214, 250, t);
      let du = Math.min(Math.abs(u - 300), SKY_W - Math.abs(u - 300)), dv = (v - H * 0.62) * 1.0, rr = Math.hypot(du * 0.55, dv);
      const glow = Math.exp(-rr / 22) * 0.7, core = rr < 7 ? 1 : 0;
      r += glow * 90; g += glow * 70; b += glow * 20;
      if (core) { r = 255; g = 250; b = 215; }
      const nb = 0.72 + 0.28 * sombra;
      r = mez(r, 252 * nb, cob * 0.92); g = mez(g, 252 * nb, cob * 0.92); b = mez(b, 255 * (0.8 + 0.2 * nb), cob * 0.92);
      SKY_A[k] = r; SKY_A[k + 1] = g; SKY_A[k + 2] = b;
      // --- rojo de guerra
      let R = mez(34, 205, t * t * 0.9 + t * 0.1), G = mez(4, 52, Math.pow(t, 1.8)), B = mez(8, 22, t);
      const gl2 = Math.exp(-rr / 34) * 0.9;
      R += gl2 * 120; G += gl2 * 40;
      if (rr < 11) { R = 255; G = 78; B = 28; } else if (rr < 14) { R = 190; G = 36; B = 16; }
      const hum = Math.max(0, Math.min(1, (dens - (0.5 - 0.12 * t)) / 0.17));
      const borde = Math.max(0, 1 - Math.abs(hum - 0.5) * 3) * (1 - sombra * 0.3);        // borde encendido de las nubes
      R = mez(R, 36 + sombra * 40, hum * 0.93) + borde * 120; G = mez(G, 22 + sombra * 14, hum * 0.93) + borde * 26; B = mez(B, 24 + sombra * 10, hum * 0.93);
      SKY_B[k] = R; SKY_B[k + 1] = G; SKY_B[k + 2] = B;
    }
  }
}
crearCielo();

function drawFloorCeil(dirX, dirY, planeX, planeY) {
  const d = floorImg.data, half = VH / 2;
  const r0x = dirX - planeX, r0y = dirY - planeY, r1x = dirX + planeX, r1y = dirY + planeY;
  const camShift = player.a * 160;
  const skyU = player.a * (SKY_W / 6.2832) + skyDrift;
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
        const tc = TCH[cym * MW + cxm];
        if (BOATMASK[cym * MW + cxm]) {              // cubierta de madera de un barco
          const bq = BOATS[BOATMASK[cym * MW + cxm] - 1];
          if (bq && bq.sala && cxm === bq.x + 4 && cym === bq.y + 1) {   // escalera a la sala de artillería
            const e = Math.floor(ty * 5) & 1; fr = e ? 90 : 60; fg = e ? 70 : 45; fb = e ? 50 : 30;
          } else {
          const tabla = Math.floor(ty * 5), n = ((tabla * 37 + cxm * 11) & 7) * 3;
          fr = 150 + n; fg = 104 + n; fb = 62 + n;
          if ((ty * 5) % 1 < 0.1) { fr -= 50; fg -= 40; fb -= 30; }
          if (Math.abs(tx - ((tabla * 0.37) % 1)) < 0.03) { fr -= 40; fg -= 30; fb -= 20; }
          }
        } else if (tc === ';') {                          // arena
          const n = ((Math.floor(fx * 9) * 7 + Math.floor(fy * 9) * 13) & 7) * 3;
          fr = 206 + n; fg = 182 + n; fb = 128 + n;
        } else if (tc === '=') {                   // mar profundo
          const o = Math.sin(fx * 3 + fy * 2 + camShift * 0) * Math.sin(fy * 4 - fx * 3);
          fr = 14 + o * 10; fg = 62 + o * 16; fb = 130 + o * 16;
          if (o > 0.85) { fr += 60; fg += 70; fb += 50; }
          if (marRojo > 0) { const m = marRojo; fr += (96 + o * 18 + (o > 0.85 ? 70 : 0) - fr) * m; fg += (8 + o * 5 + (o > 0.85 ? 20 : 0) - fg) * m; fb += (12 + o * 5 + (o > 0.85 ? 18 : 0) - fb) * m; }
        } else if (tc === '~') {                   // agua baja con olitas
          const o = Math.sin(fx * 5 + fy * 3) * Math.sin(fy * 6 - fx * 2);
          fr = 48 + o * 14; fg = 128 + o * 18; fb = 188 + o * 14;
          if (o > 0.82) { fr += 70; fg += 70; fb += 50; }
          if (marRojo > 0) { const m = marRojo; fr += (140 + o * 20 + (o > 0.82 ? 70 : 0) - fr) * m; fg += (18 + o * 6 + (o > 0.82 ? 25 : 0) - fg) * m; fb += (22 + o * 6 + (o > 0.82 ? 22 : 0) - fb) * m; }
        } else if (tc === 'g') {                   // pasto con matitas y florcitas
          const n = hs(Math.floor(fx * 10), Math.floor(fy * 10));
          fr = 56 + n * 34; fg = 120 + n * 46; fb = 44 + n * 22;
          if (hs(Math.floor(fx * 5) + 99, Math.floor(fy * 5)) > 0.985) { fr = 240; fg = 220; fb = 90; }
        } else if (tc === 'r' || tc === 'h' || tc === 'v') {   // asfalto (h/v = con línea amarilla)
          const n = hs(Math.floor(fx * 14), Math.floor(fy * 14)) * 10;
          fr = 66 + n; fg = 68 + n; fb = 74 + n;
          if (hs(cxm * 3 + Math.floor(ty * 4), cym * 5 + Math.floor(tx * 4)) > 0.97) { fr -= 22; fg -= 22; fb -= 22; }   // grietas
          if (tc === 'h' && (ty < 0.08 || ty > 0.92) && (Math.floor(fx * 2) & 1)) { fr = 232; fg = 198; fb = 56; }
          if (tc === 'v' && Math.abs(tx - 0.5) < 0.06 && (Math.floor(fy * 2) & 1)) { fr = 232; fg = 198; fb = 56; }
        } else {                                   // cemento
          const base = ((cxm + cym) & 1) ? 150 : 140;
          fr = base; fg = base; fb = base - 6;
          if (tx < 0.04 || ty < 0.04) { fr -= 35; fg -= 35; fb -= 35; }
        }
        fr *= fogOut; fg *= fogOut; fb *= fogOut;
        { const u = Math.floor(((x * 0.37 + skyU) % SKY_W + SKY_W) % SKY_W), k3 = (y * SKY_W + u) * 3;
          cr = SKY_A[k3] + (SKY_B[k3] - SKY_A[k3]) * skyRed; cg = SKY_A[k3 + 1] + (SKY_B[k3 + 1] - SKY_A[k3 + 1]) * skyRed; cb = SKY_A[k3 + 2] + (SKY_B[k3 + 2] - SKY_A[k3 + 2]) * skyRed; }
      } else if (cxm >= 0 && cym >= 0 && cxm < MW && cym < MH && TCH[cym * MW + cxm] === 'U') {   // escalera: escalones de madera
        const esc = Math.floor((fy - cym) * 6) & 1;
        fr = (esc ? 176 : 118) * fogIn; fg = (esc ? 128 : 84) * fogIn; fb = (esc ? 78 : 50) * fogIn;
        cr = 84 * fogIn; cg = 78 * fogIn; cb = 72 * fogIn;
      } else if (cxm >= 0 && cym >= 0 && cxm < MW && cym < MH && TCH[cym * MW + cxm] === ':') {   // interior de piedra con vigas de madera
        const tx = fx - cxm, ty = fy - cym;
        const tn = 0.8 + 0.35 * hs(Math.floor(fx * 2), Math.floor(fy * 2));
        const junta = ((fx * 2) % 1 < 0.06 || (fy * 2) % 1 < 0.06) ? 0.55 : 1;
        fr = 122 * tn * junta * fogIn; fg = 114 * tn * junta * fogIn; fb = 104 * tn * junta * fogIn;
        if (tx < 0.16) { cr = 62 * fogIn; cg = 42 * fogIn; cb = 26 * fogIn; }          // viga
        else { const t2 = 0.8 + 0.3 * hs(Math.floor(fx * 3), Math.floor(fy * 3)); cr = 84 * t2 * fogIn; cg = 78 * t2 * fogIn; cb = 72 * t2 * fogIn; }
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
    let t0 = top, h0 = lineH;
    if (type === 11 && (wx * 4) % 1 > 0.5) {                    // almenas: huecos arriba, solo si el muro da al exterior
      const bx = side === 0 ? mapX - stepX : mapX, by = side === 0 ? mapY : mapY - stepY;
      if (bx >= 0 && by >= 0 && bx < MW && by < MH && OUT[by * MW + bx] === 1) { t0 = top + lineH * 0.14; h0 = lineH * 0.86; }
    }
    ctx.fillStyle = rgb(1);
    ctx.fillRect(x, t0, 1, h0);

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
    } else if (type === 6) {                  // ladrillo con tonos distintos y mortero
      const rows = 10;
      for (let r = 0; r < rows; r++) {
        const u = wx * 5 + (r & 1 ? 0.5 : 0), bi = Math.floor(u), f = u - bi;
        ctx.fillStyle = rgb(0.82 + 0.34 * hs(r + mapX * 13, bi + mapY * 7));
        ctx.fillRect(x, top + lineH * r / rows, 1, lineH / rows);
        ctx.fillStyle = rgb(0.55);
        ctx.fillRect(x, top + lineH * r / rows, 1, Math.max(0.5, lineH * 0.012));
        if (f < 0.05) ctx.fillRect(x, top + lineH * r / rows, 1, lineH / rows);
      }
    } else if (type === 7) {                  // mar al fondo: olas
      const o = Math.sin(wx * 40 + mapX) * 0.5 + 0.5;
      ctx.fillStyle = rgb(0.7 + o * 0.5); ctx.fillRect(x, top + lineH * 0.45, 1, lineH * 0.55);
      ctx.fillStyle = rgb(1.6); ctx.fillRect(x, top + lineH * (0.45 + o * 0.08), 1, Math.max(0.5, lineH * 0.02));
    } else if (type === 8) {                  // barco: casco blanco con franja y ojos de buey
      const bid = BOATMASK[mapY * MW + mapX], v = bid ? bid % 3 : (mapX * 7 + mapY * 3) % 3, fr3 = [[200, 45, 45], [40, 90, 170], [230, 170, 40]][v];
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
    } else if (type === 11) {                 // piedra de fortaleza: sillares, juntas y musgo
      const rows = 6, rh = h0 / rows;
      for (let r = 0; r < rows; r++) {
        const u = wx * 3 + (r & 1 ? 0.5 : 0), bi = Math.floor(u), f = u - bi;
        const tn = 0.78 + 0.4 * hs(r + mapX * 11, bi + mapY * 5);
        ctx.fillStyle = rgb(tn); ctx.fillRect(x, t0 + rh * r, 1, rh);
        ctx.fillStyle = rgb(0.5); ctx.fillRect(x, t0 + rh * r, 1, Math.max(0.5, rh * 0.09));
        if (f < 0.04) ctx.fillRect(x, t0 + rh * r, 1, rh);
        if (r === rows - 1 && hs(bi + mapX * 3, mapY) > 0.45) { ctx.fillStyle = `rgba(52,110,44,${0.55 * shade + 0.1})`; ctx.fillRect(x, t0 + rh * (r + 0.4), 1, rh * 0.6); }
      }
    } else if (type === 12) {                 // seto de hojas
      for (let k = 0; k < 9; k++) {
        const tn = 0.7 + 0.6 * hs(Math.floor(wx * 14) + k * 31 + mapX, k + mapY * 17);
        ctx.fillStyle = rgb(tn); ctx.fillRect(x, top + lineH * k / 9, 1, lineH / 9 + 0.5);
      }
      if (hs(Math.floor(wx * 14) + mapX * 5, mapY * 3) > 0.93) { ctx.fillStyle = `rgb(${(230 * shade) | 0},${(70 * shade) | 0},${(90 * shade) | 0})`; ctx.fillRect(x, top + lineH * (0.2 + 0.5 * hs(Math.floor(wx * 14), mapX)), 1, lineH * 0.05); }
      ctx.fillStyle = `rgb(${(70 * shade) | 0},${(48 * shade) | 0},${(28 * shade) | 0})`; ctx.fillRect(x, top + lineH * 0.92, 1, lineH * 0.08);
    } else if (type === 13) {                 // caja de madera con zuncho en X
      ctx.fillStyle = rgb(0.62);
      for (let k = 1; k < 4; k++) ctx.fillRect(x, top + lineH * k / 4, 1, Math.max(0.5, lineH * 0.012));
      ctx.fillRect(x, top, 1, lineH * 0.07); ctx.fillRect(x, top + lineH * 0.93, 1, lineH * 0.07);
      if (wx < 0.07 || wx > 0.93) ctx.fillRect(x, top, 1, lineH);
      ctx.fillStyle = rgb(0.72);
      ctx.fillRect(x, top + lineH * wx - lineH * 0.04, 1, lineH * 0.08); ctx.fillRect(x, top + lineH * (1 - wx) - lineH * 0.04, 1, lineH * 0.08);
    } else if (type === 14) {                 // barril metálico con aros y franja de peligro
      ctx.fillStyle = rgb(0.55 + 0.6 * Math.sin(wx * Math.PI)); ctx.fillRect(x, top, 1, lineH);
      ctx.fillStyle = rgb(0.45);
      for (const q of [0.1, 0.5, 0.9]) ctx.fillRect(x, top + lineH * q - lineH * 0.015, 1, lineH * 0.03);
      ctx.fillStyle = (Math.floor(wx * 10) & 1) ? `rgb(${(240 * shade) | 0},${(200 * shade) | 0},${(40 * shade) | 0})` : `rgb(${(30 * shade) | 0},${(30 * shade) | 0},${(34 * shade) | 0})`;
      ctx.fillRect(x, top + lineH * 0.3, 1, lineH * 0.1);
    } else if (type === 3) {                  // pilar / contenedor
      if (((wx * 2) % 1) < 0.08) { ctx.fillStyle = rgb(0.6); ctx.fillRect(x, top, 1, lineH); }
    }
    if (type === 9) {                         // placas de concreto con remaches
      ctx.fillStyle = rgb(0.55);
      ctx.fillRect(x, top + lineH * 0.5, 1, Math.max(0.5, lineH * 0.012));
      if (wx < 0.025 || wx > 0.975) ctx.fillRect(x, top, 1, lineH);
      if ((wx > 0.07 && wx < 0.1) || (wx > 0.9 && wx < 0.93)) { ctx.fillStyle = rgb(1.5); ctx.fillRect(x, top + lineH * 0.1, 1, lineH * 0.03); ctx.fillRect(x, top + lineH * 0.88, 1, lineH * 0.03); }
    } else if (type === 10) {                 // chapa: costuras y manchas de óxido
      if (wx < 0.02 || wx > 0.98) { ctx.fillStyle = rgb(0.5); ctx.fillRect(x, top, 1, lineH); }
      const ox = hs(Math.floor(wx * 6) + mapX * 9, mapY * 5);
      if (ox > 0.72) { ctx.fillStyle = `rgba(120,64,34,${0.35 + 0.3 * (ox - 0.72)})`; ctx.fillRect(x, top + lineH * (0.55 - 0.2 * ox), 1, lineH * 0.45); }
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
  anclarCanones();
  const dirX = Math.cos(player.a), dirY = Math.sin(player.a);
  const planeX = -dirY * 0.66, planeY = dirX * 0.66;
  const inv = 1 / (planeX * dirY - dirX * planeY);
  const things = [];
  for (const e of enemies) {
    const set = SPR.enemigos[e.type] && SPR.enemigos[e.type][e.v];
    if (!set) continue;
    if (e.muriendo > 0) continue;                           // el cuerpo ya está en el suelo (CUERPOS)
    const c = elegirCuadro(e, set);
    const cn = e.canon || e.torre;
    if (cn) {                                               // artillero: se ve de pie sobre la torreta o tras la ametralladora
      const mg = cn.tipo === 'ametra';
      const sube = !mg || cn.alto;      // sobre pedestal (cañón o ametralladora en torre): se ve de pie arriba
      things.push({ x: e.x, y: e.y, img: c.img, iw: 100, ih: 160, sc: TYPES[e.type].sc * (mg ? 0.8 : 0.9) * (sube ? 1.08 : 1), asp: 0.625, alza: sube ? ALTURA_TORRE - 0.02 : 0, alto: sube, dAdj: sube ? 0.5 : -0.05 });
    } else things.push({ x: e.x, y: e.y, img: c.img, iw: 100, ih: 160, sc: TYPES[e.type].sc * c.escala * (e.jefe ? 1.3 : 1), asp: 0.625, alpha: c.alpha });
  }
  if (SPR.patito) for (const d of PATOS) if (!d.ok) things.push({ x: d.x, y: d.y, img: SPR.patito, iw: 32, ih: 28, sc: 0.13, asp: 32 / 28 });
  for (const o of ESC) if (!o.ok) things.push({ x: o.x, y: o.y, img: o.k === 'llaves' ? SPR.llaves : SPR.mapaItem, iw: o.k === 'llaves' ? 18 : 22, ih: o.k === 'llaves' ? 14 : 16, sc: 0.2, asp: o.k === 'llaves' ? 18 / 14 : 22 / 16, alza: 0.15 + 0.05 * Math.sin(performance.now() / 300) });
  if (HELI) things.push({ x: HELI.x, y: HELI.y, img: SPR.heli, iw: 80, ih: 40, sc: 1.1, asp: 2, alza: HELI.z, alto: true });
  for (const f of PECES) things.push({ x: f.x, y: f.y, img: SPR.pez, iw: 18, ih: 9, sc: 0.12, asp: 2, alza: Math.max(0, f.z) });
  for (const b of BOMBAS) things.push({ x: b.x, y: b.y, img: SPR.bomba, iw: 8, ih: 14, sc: 0.18, asp: 8 / 14, alza: Math.max(0, b.z - 0.1) });
  if (SPR.granada) for (const g of GRAN) things.push({ x: g.x, y: g.y, img: SPR.granada, iw: 12, ih: 12, sc: 0.1, asp: 1 });
  for (const cu of CUERPOS) {
    if ((cu.x - player.x) ** 2 + (cu.y - player.y) ** 2 > 2000) continue;
    const set = SPR.enemigos[cu.type] && SPR.enemigos[cu.type][cu.v]; if (!set) continue;
    things.push({ x: cu.x, y: cu.y, img: (set.frames[HOJA.muerte] || set.frames[0]).n, iw: 100, ih: 160, sc: TYPES[cu.type].sc * (cu.apl ? 0.42 : 1), asp: cu.apl ? 0.625 / 0.42 : 0.625, dAdj: -0.2 });
  }
  for (const m of MANCHAS) if ((m.x - player.x) ** 2 + (m.y - player.y) ** 2 < 900) things.push({ x: m.x, y: m.y, gore: 1, mancha: 1, r: m.r, col: m.c, dAdj: -0.3 });
  for (const g of GORE) things.push({ x: g.x, y: g.y, gore: 1, z: g.z, col: g.c });
  const etiquetas = [];
  for (const c of CAM) {
    const im = c.tipo === 'tanque' ? SPR.tanque : SPR.camion; if (!im || c.piloto === 99) continue;
    if (player.veh && player.veh.o === c) continue;
    const [w, h] = dim(im); things.push({ x: c.x, y: c.y, img: im, iw: w, ih: h, sc: c.tipo === 'tanque' ? 0.8 : 0.9, asp: w / h });
  }
  if (SPR.canon) { const [w, h] = dim(SPR.canon); for (const c of CAN) { if (player.veh && player.veh.o === c) continue;
    if (c.tipo === 'ametra') { if (SPR.ametra) { const [mw, mh] = dim(SPR.ametra); things.push({ x: c.x, y: c.y, img: SPR.ametra, iw: mw, ih: mh, sc: 0.42, asp: mw / mh }); } continue; } things.push({ x: c.x, y: c.y, img: SPR.canon, iw: w, ih: h, sc: 0.62, asp: w / h, alza: ALTURA_TORRE, alto: true, torre: true }); } }
  if (SPR.explosion) for (const f of FX) { const fr = Math.min(3, Math.floor(f.t / 0.17)); things.push({ x: f.x, y: f.y, img: SPR.explosion, iw: 96, ih: 96, sx0: fr * 96, sc: 1.5, asp: 1, alpha: f.t > 0.55 ? (0.7 - f.t) / 0.15 : 1, alza: true }); }
  for (const o of MP.otros) {                               // compañeros
    const set = SPR.aliados[o.idx - 1] || SPR.aliados.find(Boolean);
    if (!set || !o.conectado) continue;
    let img;
    if (o.muerto) img = (set.frames[HOJA.muerte] || set.frames[0]).n;
    else img = elegirCuadro({ muriendo: 0, pain: o.golpe || 0, atkAnim: o.atkAnim || 0, walkT: o.walkT || 0, flash: 0 }, set).img;
    things.push({ x: o.x, y: o.y, img, iw: 100, ih: 160, sc: 1, asp: 0.625, etiqueta: o });
  }
  if (SPR.colacion) {
    const [cw, ch] = dim(SPR.colacion);
    for (const it of items) { if (it.m) things.push({ x: it.x, y: it.y, img: SPR.caja, iw: 20, ih: 14, sc: 0.12, asp: 20 / 14 }); else things.push({ x: it.x, y: it.y, img: SPR.colacion, iw: cw, ih: ch, sc: 0.12, asp: cw / ch }); }
  }
  for (const o of pickups) {
    if (o.t === 'arma' && SPR.suelo[WEAPONS[o.arma].img]) {
      const im = SPR.suelo[WEAPONS[o.arma].img], [pw, ph] = dim(im);
      things.push({ x: o.x, y: o.y, img: im, iw: pw, ih: ph, sc: 0.2, asp: pw / ph });
    } else if (o.t === 'racion' && SPR.colacion) {
      const [cw, ch] = dim(SPR.colacion); things.push({ x: o.x, y: o.y, img: SPR.colacion, iw: cw, ih: ch, sc: 0.12, asp: cw / ch });
    }
  }
  things.forEach(t => { t.d = (t.x - player.x) ** 2 + (t.y - player.y) ** 2 - (t.dAdj || 0); });
  things.sort((a, b) => b.d - a.d);

  for (const t of things) {
    const sx = t.x - player.x, sy = t.y - player.y;
    const tx = inv * (dirY * sx - dirX * sy);
    const ty = inv * (-planeY * sx + planeX * sy);
    if (ty < 0.15) continue;
    const screenX = (W / 2) * (1 + tx / ty);
    if (t.gore) {
      const zc = Math.floor(screenX);
      if (zc >= 0 && zc < W && ty < zbuf[zc]) {
        const fl = VH / ty, base = VH / 2 + fl / 2; ctx.fillStyle = t.col;
        if (t.mancha) { const ww = Math.min(40, Math.max(1.5, t.r * fl * 1.6)), hh = Math.max(1, ww * 0.2); ctx.fillRect(screenX - ww / 2, base - hh, ww, hh); }
        else { const sz = Math.max(1, Math.min(3, fl * 0.02)); ctx.fillRect(screenX - sz / 2, base - t.z * fl - sz / 2, sz, sz); }
      }
      continue;
    }
    const full = VH / ty, h = full * t.sc, w = h * t.asp;
    const top = VH / 2 + full / 2 - h - (t.alza || 0) * full;
    const x0 = Math.floor(screenX - w / 2), x1 = Math.floor(screenX + w / 2);
    ctx.globalAlpha = t.alpha === undefined ? 1 : t.alpha;
    for (let x = Math.max(0, x0); x < Math.min(W, x1); x++) {
      if (ty >= zbuf[x] && !(t.alto && top + h <= VH / 2 - 0.5 * VH / zbuf[x] + 1)) continue;   // lo alto asoma sobre los muros
      const srcX = (t.sx0 || 0) + Math.min(t.iw - 1, Math.floor((x - x0) / w * t.iw));
      if (t.torre) {                                          // torreta de piedra bajo el cañón: lo pone en alto
        const f = (x - x0) / w, base = ty >= zbuf[x] ? VH / 2 - 0.5 * VH / zbuf[x] : VH / 2 + full / 2, y0 = top + h * 0.82;
        if (f > 0.22 && f < 0.78 && base > y0) { ctx.fillStyle = f < 0.4 ? '#8d8a84' : f < 0.65 ? '#6f6c67' : '#55534f'; ctx.fillRect(x, y0, 1, base - y0); if (((x + Math.floor(base)) & 7) === 0) { ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(x, y0, 1, base - y0); } }
      }
      ctx.drawImage(t.img, srcX, 0, 1, t.ih, x, top, 1, h);
    }
    ctx.globalAlpha = 1;
    if (t.etiqueta && !t.etiqueta.muerto && screenX > 0 && screenX < W && zbuf[Math.max(0, Math.min(W - 1, Math.floor(screenX)))] > ty) {
      const o = t.etiqueta, ty0 = top - 4;
      ctx.font = 'bold 8px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      const nm = (o.nombre || 'Marino').slice(0, 10), tw = ctx.measureText(nm).width + 6;
      ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(screenX - tw / 2, ty0 - 8, tw, 10);
      ctx.fillStyle = COLORES_JUGADOR[(o.idx) % 6]; ctx.fillText(nm, screenX, ty0 - 3);
      ctx.textAlign = 'left';
    }
  }
}

// ---------- Arma en mano ----------
// Cada imagen se dibuja con su propia proporción (alto fijo), así sirve cualquier tamaño.
function drawVehiculoVista() {
  const v = player.veh, k = v.k, p = punchT > 0 ? 1 - punchT / punchMax : 1;
  const sp = Math.abs(vSpd), vib = (sp > 0.5 ? Math.sin(playT * 55) * Math.min(1.4, sp * 0.12) : 0) + (tiembla > 0 ? (Math.random() - 0.5) * 3 : 0);
  if (k === 'camion') {                                   // cabina: capó, parabrisas, espejos, tablero, volante y faros
    ctx.save(); ctx.translate(0, vib);
    const haz = ctx.createLinearGradient(0, VH - 70, 0, VH / 2 + 8); haz.addColorStop(0, 'rgba(255,240,170,0.16)'); haz.addColorStop(1, 'rgba(255,240,170,0)');
    ctx.fillStyle = haz; ctx.beginPath(); ctx.moveTo(40, VH - 34); ctx.lineTo(W / 2 - 14, VH / 2 + 8); ctx.lineTo(W / 2 + 14, VH / 2 + 8); ctx.lineTo(W - 40, VH - 34); ctx.fill();   // luz de los faros
    ctx.fillStyle = '#4d5a33'; ctx.beginPath(); ctx.moveTo(40, VH); ctx.lineTo(70, VH - 34); ctx.lineTo(W - 70, VH - 34); ctx.lineTo(W - 40, VH); ctx.fill();
    ctx.fillStyle = '#6a7b45'; ctx.beginPath(); ctx.moveTo(70, VH - 34); ctx.lineTo(W - 70, VH - 34); ctx.lineTo(W - 80, VH - 40); ctx.lineTo(80, VH - 40); ctx.fill();
    ctx.fillStyle = '#3a4526'; ctx.fillRect(W / 2 - 1, VH - 40, 2, 40); for (let x = 96; x < W - 90; x += 14) ctx.fillRect(x, VH - 33, 6, 2);   // rejilla y línea del capó
    ctx.fillStyle = '#23262c'; ctx.fillRect(0, 0, W, 7); ctx.fillRect(0, 0, 9, VH); ctx.fillRect(W - 9, 0, 9, VH);            // marco del parabrisas
    ctx.fillStyle = '#2d3138'; ctx.beginPath(); ctx.moveTo(9, 0); ctx.lineTo(34, 0); ctx.lineTo(9, 52); ctx.fill(); ctx.beginPath(); ctx.moveTo(W - 9, 0); ctx.lineTo(W - 34, 0); ctx.lineTo(W - 9, 52); ctx.fill();
    ctx.fillStyle = '#16181c'; ctx.fillRect(2, VH / 2 - 26, 8, 30); ctx.fillRect(W - 10, VH / 2 - 26, 8, 30);                  // espejos
    ctx.fillStyle = '#7d8b97'; ctx.fillRect(3, VH / 2 - 24, 5, 26); ctx.fillRect(W - 9, VH / 2 - 24, 5, 26);
    ctx.fillStyle = '#ffeaa0'; ctx.fillRect(52, VH - 20, 10, 6); ctx.fillRect(W - 62, VH - 20, 10, 6);
    ctx.fillStyle = 'rgba(255,250,200,0.5)'; ctx.fillRect(49, VH - 22, 16, 10); ctx.fillRect(W - 65, VH - 22, 16, 10);
    ctx.fillStyle = '#15171b'; ctx.beginPath(); ctx.moveTo(W / 2 - 70, VH); ctx.lineTo(W / 2 - 60, VH - 16); ctx.lineTo(W / 2 + 60, VH - 16); ctx.lineTo(W / 2 + 70, VH); ctx.fill();   // tablero
    ctx.fillStyle = '#2a2e35'; ctx.fillRect(W / 2 - 60, VH - 16, 120, 3);
    const gx = W / 2 - 34, gy = VH - 8;                                                                          // velocímetro
    ctx.fillStyle = '#0c0d10'; ctx.beginPath(); ctx.arc(gx, gy, 12, Math.PI, 0); ctx.fill(); ctx.strokeStyle = '#8a8f9a'; ctx.lineWidth = 1; ctx.stroke();
    const ang = Math.PI + Math.min(1, sp / 9.5) * Math.PI; ctx.strokeStyle = '#ff5a3a'; ctx.beginPath(); ctx.moveTo(gx, gy); ctx.lineTo(gx + Math.cos(ang) * 10, gy + Math.sin(ang) * 10); ctx.stroke();
    ctx.fillStyle = '#ffd25a'; ctx.font = 'bold 8px monospace'; ctx.fillText(Math.round(sp * 10) + ' km/h', W / 2 - 8, VH - 3);
    ctx.save(); ctx.translate(W / 2, VH + 6); ctx.rotate(volante * 0.5);                                         // volante que gira
    ctx.strokeStyle = '#0d0e11'; ctx.lineWidth = 5; ctx.beginPath(); ctx.ellipse(0, 0, 30, 11, 0, 0, 7); ctx.stroke();
    ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-30, 0); ctx.lineTo(30, 0); ctx.moveTo(0, 0); ctx.lineTo(0, -11); ctx.stroke(); ctx.restore();
    ctx.restore();
    if (sp > 7) { ctx.fillStyle = 'rgba(255,255,255,0.05)'; for (let i = 0; i < 6; i++) { const lx = Math.random() * W; ctx.fillRect(lx, VH / 2 - 10, 1, 40); } }   // líneas de velocidad
  } else if (v.o.tipo === 'ametra') {                     // ametralladora fija: tubo fino con cubierta y fogonazo
    const sh = (punchT > 0 ? (Math.random() - 0.5) * 3 : 0);
    ctx.fillStyle = '#23262c'; ctx.fillRect(W / 2 - 4 + sh, VH - 70, 8, 70); ctx.fillStyle = '#4a505a'; ctx.fillRect(W / 2 - 4 + sh, VH - 70, 3, 70);
    ctx.fillStyle = '#16181c'; ctx.fillRect(W / 2 - 14, VH - 34, 28, 34); ctx.fillStyle = '#3b4048'; ctx.fillRect(W / 2 - 14, VH - 34, 28, 5);
    ctx.fillStyle = '#9a8660'; ctx.fillRect(0, VH - 14, W, 14); ctx.fillStyle = '#7b6a48'; for (let x = 0; x < W; x += 26) ctx.fillRect(x, VH - 14, 2, 14);
    if (punchT > 0) { ctx.fillStyle = 'rgba(255,220,120,0.95)'; ctx.beginPath(); ctx.arc(W / 2 + sh, VH - 74, 8 + Math.random() * 4, 0, 7); ctx.fill(); }
  } else {                                                // cañón: marco de mira y el tubo abajo
    ctx.strokeStyle = 'rgba(10,10,14,0.75)'; ctx.lineWidth = 30; ctx.beginPath(); ctx.ellipse(W / 2, VH / 2, W * 0.62, VH * 0.82, 0, 0, 7); ctx.stroke();
    const retro = punchT > 0 ? Math.sin(p * Math.PI) * 12 : 0;
    ctx.fillStyle = '#3b4048'; ctx.fillRect(W / 2 - 15, VH - 52 + retro, 30, 60);
    ctx.fillStyle = '#5a616d'; ctx.fillRect(W / 2 - 15, VH - 52 + retro, 8, 60);
    ctx.fillStyle = '#16181c'; ctx.fillRect(W / 2 - 18, VH - 58 + retro, 36, 10);
    if (punchT > 0 && p < 0.5) { ctx.fillStyle = 'rgba(255,200,90,0.9)'; ctx.beginPath(); ctx.arc(W / 2, VH - 62 + retro, 14, 0, 7); ctx.fill(); ctx.fillStyle = 'rgba(255,110,30,0.35)'; ctx.fillRect(0, 0, W, VH); }
    if (k === 'tanque') {                                // visor del tanque: rendija blindada, remaches, brújula de torreta y velocidad
      ctx.save(); ctx.translate(0, vib);
      ctx.fillStyle = '#1b1d22'; ctx.fillRect(0, 0, W, 22); ctx.fillRect(0, VH - 26, W, 26); ctx.fillStyle = '#2f343c'; ctx.fillRect(0, 22, W, 3); ctx.fillRect(0, VH - 29, W, 3);
      ctx.fillStyle = '#4a505a'; for (let x = 8; x < W; x += 24) { ctx.fillRect(x, 8, 3, 3); ctx.fillRect(x, VH - 14, 3, 3); }
      ctx.fillStyle = '#0c0d10'; ctx.fillRect(0, 0, 12, VH); ctx.fillRect(W - 12, 0, 12, VH);
      ctx.fillStyle = '#9fe9a0'; ctx.font = 'bold 8px monospace'; ctx.fillText('VEL ' + Math.round(sp * 10) + ' km/h', 16, VH - 12);
      ctx.fillStyle = '#2f343c'; ctx.fillRect(W - 100, VH - 20, 80, 6); ctx.fillStyle = cooldownC > 0 ? '#e8a13a' : '#7be07b'; ctx.fillRect(W - 100, VH - 20, 80 * (cooldownC > 0 ? 1 - cooldownC / 0.9 : 1), 6);
      ctx.fillStyle = '#9fe9a0'; ctx.fillText(cooldownC > 0 ? 'CARGANDO' : 'LISTO', W - 100, VH - 24);
      ctx.restore();
    }
  }
  ctx.fillStyle = 'rgba(255,255,255,0.8)'; ctx.fillRect(W / 2 - 1, VH / 2 - 5, 2, 3); ctx.fillRect(W / 2 - 1, VH / 2 + 2, 2, 3); ctx.fillRect(W / 2 - 5, VH / 2 - 1, 3, 2); ctx.fillRect(W / 2 + 2, VH / 2 - 1, 3, 2);
}

function drawHeldWeapon() {
  if (player.veh && !player.veh.pas && player.veh.k !== 'barco' && !player.muerto) { drawVehiculoVista(); return; }
  const A = SPR.armas, wp = WEAPONS[weapon], img = A[wp.img];
  if (!img) return;
  const p = punchT > 0 ? 1 - punchT / punchMax : 1;     // 0..1 durante el disparo
  const retro = punchT > 0 ? Math.sin(p * Math.PI) * 10 : 0;   // retroceso
  const alto = wp.img === 'pistola' ? 78 : 92;          // chica y a un costado: no tapa la vista
  const [iw, ih] = dim(img), w = alto * iw / ih;
  const bajada = reloadT > 0 ? Math.sin(Math.min(1, (1 - reloadT / WEAPONS[weapon].reload)) * Math.PI) * 60 : 0;
  ctx.save();
  ctx.translate(W / 2 + 44 + Math.sin(walk) * 2, VH + 14 + retro + bajada + Math.abs(Math.cos(walk)) * 1.5);
  ctx.rotate(-0.26);                                    // inclinada hacia el centro
  ctx.drawImage(img, -w / 2, -alto, w, alto);
  if (punchT > 0 && p < 0.55 && A.fogonazo) {           // fogonazo en la boca del arma
    const fs = 26 + Math.random() * 8;
    ctx.drawImage(A.fogonazo, -fs / 2, -alto - fs * 0.45, fs, fs);
  }
  ctx.restore();
  if (punchT > 0 && p < 0.55) { ctx.fillStyle = 'rgba(255,220,120,0.08)'; ctx.fillRect(0, 0, W, VH); }
  ctx.font = 'bold 8px monospace'; ctx.textAlign = 'right'; ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.fillText('G · GRANADAS ' + granadas, W - 5, 8); ctx.textAlign = 'left';
  if (golpeT > 0 && state === 'play') {                 // de dónde te dispararon
    let rel = Math.atan2(golpeY - player.y, golpeX - player.x) - player.a; rel = Math.atan2(Math.sin(rel), Math.cos(rel));
    const al = Math.min(1, golpeT / 0.5) * 0.7; let gr;
    if (Math.abs(rel) > 2.3) { gr = ctx.createLinearGradient(0, VH, 0, VH - 30); gr.addColorStop(0, `rgba(220,20,20,${al})`); gr.addColorStop(1, 'rgba(220,20,20,0)'); ctx.fillStyle = gr; ctx.fillRect(0, VH - 30, W, 30); }
    else if (Math.abs(rel) < 0.6) { gr = ctx.createLinearGradient(0, 0, 0, 24); gr.addColorStop(0, `rgba(220,20,20,${al})`); gr.addColorStop(1, 'rgba(220,20,20,0)'); ctx.fillStyle = gr; ctx.fillRect(0, 0, W, 24); }
    else { const dr = rel > 0; gr = ctx.createLinearGradient(dr ? W : 0, 0, dr ? W - 40 : 40, 0); gr.addColorStop(0, `rgba(220,20,20,${al})`); gr.addColorStop(1, 'rgba(220,20,20,0)'); ctx.fillStyle = gr; ctx.fillRect(dr ? W - 40 : 0, 0, 40, VH); }
  }
  ctx.font = 'bold 8px monospace'; ctx.textAlign = 'center'; ctx.fillStyle = 'rgba(255,255,255,0.8)';
  ctx.fillText(['E', 'SE', 'S', 'SO', 'O', 'NO', 'N', 'NE'][((Math.round(player.a / (Math.PI / 4)) % 8) + 8) % 8], W / 2, 8); ctx.textAlign = 'left';
  if (combo >= 2 && comboT > 0 && state === 'play') { ctx.font = 'bold 12px monospace'; ctx.textAlign = 'center'; ctx.fillStyle = `rgba(255,${Math.round(200 - combo * 15)},60,${Math.min(1, comboT)})`; ctx.fillText('COMBO x' + combo, W / 2, 22); ctx.textAlign = 'left'; }
  if (punchT > 0 && state === 'play' && !player.veh) { ctx.fillStyle = `rgba(255,230,170,${Math.min(0.14, punchT)})`; ctx.fillRect(0, 0, W, VH); }   // destello del disparo
  if (hitT > 0) { ctx.strokeStyle = 'rgba(255,60,60,0.95)'; ctx.lineWidth = 1.5; ctx.beginPath(); for (const [a, b] of [[-5, -5], [5, -5], [-5, 5], [5, 5]]) { ctx.moveTo(W / 2 + a * 0.4, VH / 2 + b * 0.4); ctx.lineTo(W / 2 + a, VH / 2 + b); } ctx.stroke(); }   // marca de impacto
  if (estamina < 0.99) { ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(W / 2 - 22, VH - 5, 44, 3); ctx.fillStyle = estamina > 0.25 ? '#7ad07a' : '#d08a3a'; ctx.fillRect(W / 2 - 22, VH - 5, 44 * estamina, 3); }
  ctx.fillStyle = 'rgba(255,255,255,0.8)';              // mira
  ctx.fillRect(W / 2 - 1, VH / 2 - 5, 2, 3); ctx.fillRect(W / 2 - 1, VH / 2 + 2, 2, 3);
  ctx.fillRect(W / 2 - 5, VH / 2 - 1, 3, 2); ctx.fillRect(W / 2 + 2, VH / 2 - 1, 3, 2);
}

// ---------- Barra de estado y minimapa ----------
function drawFace(cx, cy) {                       // cara seria de soldado; con menos vida se llena de heridas y sangre
  const hp = player.hp, R = ctx.fillRect.bind(ctx);
  ctx.fillStyle = '#d9a37a'; ctx.beginPath(); ctx.ellipse(cx, cy + 1, 8, 10, 0, 0, 7); ctx.fill();
  ctx.fillStyle = '#b9825c'; ctx.beginPath(); ctx.ellipse(cx, cy + 6, 7, 5, 0, 0, Math.PI); ctx.fill();
  ctx.fillStyle = '#4b5a38'; ctx.beginPath(); ctx.ellipse(cx, cy - 3, 9, 7, 0, Math.PI, 0); ctx.fill(); R(cx - 10, cy - 4, 20, 2);   // casco
  ctx.fillStyle = '#2b3320'; R(cx - 10, cy - 3, 20, 1);
  ctx.fillStyle = '#eee'; R(cx - 5, cy - 1, 3, 2); R(cx + 2, cy - 1, 3, 2);
  ctx.fillStyle = '#1a1210'; R(cx - 4, cy - 1, 2, 2); R(cx + 3, cy - 1, 2, 2);
  ctx.strokeStyle = '#2a1c14'; ctx.lineWidth = 1.3; ctx.beginPath();                                   // cejas duras
  if (hp > 30) { ctx.moveTo(cx - 6, cy - 3); ctx.lineTo(cx - 2, cy - 2); ctx.moveTo(cx + 2, cy - 2); ctx.lineTo(cx + 6, cy - 3); }
  else { ctx.moveTo(cx - 6, cy - 2); ctx.lineTo(cx - 2, cy - 3); ctx.moveTo(cx + 2, cy - 3); ctx.lineTo(cx + 6, cy - 2); }
  ctx.stroke();
  ctx.fillStyle = '#a9704c'; R(cx - 1, cy + 1, 1, 4);                                                    // nariz
  ctx.fillStyle = '#3a2418'; R(cx - 4, cy + 7, 8, 1);                                                    // boca recta
  if (hp <= 30) R(cx - 3, cy + 7, 6, 2);                                                                 // gesto de dolor
  ctx.fillStyle = 'rgba(0,0,0,0.12)'; R(cx - 6, cy + 5, 12, 5);                                         // barba cerrada
  const sg = hp < 85 ? 1 : 0;
  if (sg) { ctx.fillStyle = '#8f1014'; R(cx + 3, cy - 6, 1, 6); ctx.fillStyle = '#b21a18'; R(cx + 3, cy - 6, 1, 2); }          // herida en la frente
  if (hp < 60) { ctx.fillStyle = '#7a0c0e'; R(cx - 7, cy + 2, 3, 1); R(cx - 6, cy + 3, 1, 4); }                                 // corte en la mejilla
  if (hp < 40) { ctx.fillStyle = '#9a1214'; ctx.beginPath(); ctx.ellipse(cx + 4, cy + 3, 3, 2, 0, 0, 7); ctx.fill(); R(cx - 1, cy + 9, 2, 5); }
  if (hp < 20) { ctx.fillStyle = 'rgba(150,10,12,0.55)'; ctx.beginPath(); ctx.ellipse(cx, cy + 2, 8, 10, 0, 0, 7); ctx.fill(); }
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
    ctx.fillStyle = c === ',' ? 'rgba(140,190,140,0.4)' : c === ';' ? 'rgba(230,205,140,0.55)' : c === '~' ? 'rgba(70,150,220,0.55)' : c === '=' ? 'rgba(30,90,180,0.7)' : c === 'M' ? '#667a4e' : c === 'Y' ? '#e8e8ee' : c === 'V' ? '#a09484' : c === 'F' ? '#8a857c' : c === 'U' ? '#e0b048' : c === ':' ? 'rgba(190,170,130,0.5)' : c === 'g' ? 'rgba(90,160,80,0.5)' : (c === 'r' || c === 'h' || c === 'v') ? 'rgba(70,72,80,0.6)' : c === 'A' ? '#2f7a36' : c === 'K' ? '#a0703c' : c === 'D' ? '#c03a2a' : '#6a7f99';
    ctx.fillRect(ox + (dx + RX) * ms, oy + (dy + RY) * ms, ms, ms);
  }
  ctx.fillStyle = '#ffe36a';
  for (const o of pickups) {
    if (o.t !== 'arma') continue;
    const ex = o.x - px + RX, ey = o.y - py + RY;
    if (ex < 0 || ey < 0 || ex > 2 * RX + 1 || ey > 2 * RY + 1) continue;
    ctx.fillRect(ox + ex * ms - 1, oy + ey * ms - 1, 3, 3);
  }
  for (const c of CAN) {
    const ex = c.x - px + RX, ey = c.y - py + RY;
    if (ex < 0 || ey < 0 || ex > 2 * RX + 1 || ey > 2 * RY + 1) continue;
    ctx.fillStyle = c.op ? '#ff9a2a' : '#8a8f9a'; ctx.fillRect(ox + ex * ms - 1.5, oy + ey * ms - 1.5, 3, 3);   // naranja = con artillero enemigo
  }
  const marca = (x, y, col) => { const ex = x - px + RX, ey = y - py + RY; if (ex < 0 || ey < 0 || ex > 2 * RX + 1 || ey > 2 * RY + 1) return; ctx.fillStyle = col; ctx.fillRect(ox + ex * ms - 2, oy + ey * ms - 2, 4, 4); };
  for (const o of ESC) if (!o.ok) marca(o.x, o.y, '#ffd700');                         // dorado = llaves / mapa
  if (HELI) marca(HELI.x, HELI.y, '#35e0ff');
  ctx.fillStyle = '#ff4c4c';
  for (const e of enemies) {
    const ex = e.x - px + RX, ey = e.y - py + RY;
    if (ex < 0 || ey < 0 || ex > 2 * RX + 1 || ey > 2 * RY + 1) continue;
    ctx.fillRect(ox + ex * ms - 1, oy + ey * ms - 1, 2, 2);
  }
  for (const o of MP.otros) {
    if (!o.conectado || o.muerto) continue;
    const ex = o.x - px + RX, ey = o.y - py + RY;
    if (ex < 0 || ey < 0 || ex > 2 * RX + 1 || ey > 2 * RY + 1) continue;
    ctx.fillStyle = COLORES_JUGADOR[o.idx % 6]; ctx.fillRect(ox + ex * ms - 1.5, oy + ey * ms - 1.5, 3, 3);
  }
  ctx.fillStyle = '#4cff6a';
  ctx.fillRect(ox + (player.x - px + RX) * ms - 1.5, oy + (player.y - py + RY) * ms - 1.5, 3, 3);
}


// ---------- Interfaz sangrienta: salpicaduras, goteo, panel del HUD ----------
const SANGRE_COL = ['#5a0606', '#7a0a0a', '#9b0f0f', '#b81414'];
function gota(c, x, y, r, col, drips) {                          // mancha de sangre irregular con salpicaduras y chorros
  c.fillStyle = col;
  c.beginPath(); c.arc(x, y, r, 0, 7); c.fill();
  for (let i = 0; i < 7; i++) { const a = Math.random() * 6.28, d = r * (0.5 + Math.random() * 0.7); c.beginPath(); c.arc(x + Math.cos(a) * d, y + Math.sin(a) * d, r * (0.25 + Math.random() * 0.35), 0, 7); c.fill(); }
  for (let i = 0; i < 6; i++) { const a = Math.random() * 6.28, d = r * (1.3 + Math.random() * 1.6); c.beginPath(); c.arc(x + Math.cos(a) * d, y + Math.sin(a) * d, Math.max(0.6, r * 0.12 * Math.random() + 0.5), 0, 7); c.fill(); }
  if (drips) for (let i = 0; i < 2; i++) { const dx = x + (Math.random() - 0.5) * r, l = r * (1 + Math.random() * 2.5); c.fillRect(dx - 0.7, y, 1.4, l); c.beginPath(); c.arc(dx, y + l, 1.3, 0, 7); c.fill(); }
}
function gotearBorde(c, x0, x1, y, col, n) {                       // chorros que cuelgan de un borde horizontal
  c.fillStyle = col;
  for (let i = 0; i < n; i++) { const x = x0 + Math.random() * (x1 - x0), w = 1.5 + Math.random() * 2.5, l = 3 + Math.random() * 14; c.fillRect(x, y, w, l); c.beginPath(); c.arc(x + w / 2, y + l, w * 0.75, 0, 7); c.fill(); }
}
const SANGRE_HUD = lienzo(W, H - VH, c => {                      // panel del HUD: metal oscuro manchado de sangre
  const g = c.createLinearGradient(0, 0, 0, H - VH); g.addColorStop(0, '#2a1111'); g.addColorStop(1, '#140808'); c.fillStyle = g; c.fillRect(0, 0, W, H - VH);
  c.fillStyle = 'rgba(255,255,255,0.03)'; for (let y = 4; y < H - VH; y += 4) c.fillRect(0, y, W, 1);
  c.fillStyle = '#6e0c0c'; c.fillRect(0, 0, W, 2); c.fillStyle = '#a01414'; c.fillRect(0, 0, W, 1);
  for (let i = 0; i < 9; i++) gota(c, Math.random() * W, 4 + Math.random() * (H - VH - 8), 1.5 + Math.random() * 4, SANGRE_COL[Math.floor(Math.random() * 4)], false);
  gotearBorde(c, 0, W, 2, '#8a0c0c', 26);
  c.fillStyle = '#3a3a3a'; for (const x of [3, W - 5]) for (const y of [6, H - VH - 6]) { c.beginPath(); c.arc(x, y, 1.4, 0, 7); c.fill(); }   // remaches
});
let manchasP = [];                                               // salpicaduras de sangre sobre la pantalla (al recibir daño y al matar)
function salpicarPantalla(n, big) {
  for (let i = 0; i < n; i++) manchasP.push({ x: 10 + Math.random() * (W - 20), y: 8 + Math.random() * (VH - 30), r: (big ? 6 : 3) + Math.random() * (big ? 12 : 6), t: 5 + Math.random() * 3, dy: 0, sd: Math.random() * 9 });
  if (manchasP.length > 28) manchasP.splice(0, manchasP.length - 28);
}
function dibujarManchasP(dt) {
  for (let i = manchasP.length - 1; i >= 0; i--) {
    const m = manchasP[i]; m.t -= dt; m.dy += dt * 2.2 * (0.4 + (m.sd % 1)); if (m.t <= 0) { manchasP.splice(i, 1); continue; }
    const a = Math.min(1, m.t / 2.5) * 0.78;
    ctx.globalAlpha = a; ctx.fillStyle = '#8c0d0d';
    ctx.beginPath(); ctx.arc(m.x, m.y + m.dy * 0.3, m.r, 0, 7); ctx.fill();
    ctx.fillStyle = '#a81212'; ctx.beginPath(); ctx.arc(m.x - m.r * 0.25, m.y + m.dy * 0.3 - m.r * 0.25, m.r * 0.45, 0, 7); ctx.fill();
    ctx.fillStyle = '#8c0d0d'; ctx.fillRect(m.x - 0.8, m.y, 1.6, m.r * 0.6 + m.dy); ctx.beginPath(); ctx.arc(m.x, m.y + m.r * 0.6 + m.dy, 1.6, 0, 7); ctx.fill();   // chorro que resbala
  }
  ctx.globalAlpha = 1;
}
function barra(x, y, w, h, frac, c1, c2) {
  ctx.fillStyle = '#0a0505'; ctx.fillRect(x - 1, y - 1, w + 2, h + 2); ctx.fillStyle = '#2a1010'; ctx.fillRect(x, y, w, h);
  const f = Math.max(0, Math.min(1, frac)), g = ctx.createLinearGradient(0, y, 0, y + h); g.addColorStop(0, c1); g.addColorStop(1, c2); ctx.fillStyle = g; ctx.fillRect(x, y, w * f, h);
  ctx.fillStyle = 'rgba(255,255,255,0.18)'; ctx.fillRect(x, y, w * f, 1);
}

function drawHUD() {
  ctx.drawImage(SANGRE_HUD, 0, VH);
  ctx.font = 'bold 9px monospace'; ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
  barra(6, VH + 3, 118, 9, player.hp / CONFIG.vidaInicial, '#b01818', '#5a0606');
  barra(6, VH + 13, 118, 9, weapon === 6 ? 1 : reloadT > 0 ? 1 - reloadT / WEAPONS[weapon].reload : ammo[weapon] / WEAPONS[weapon].mag, '#7a6a2a', '#3a300e');
  const lat = player.hp < 35 ? 0.5 + 0.5 * Math.sin(performance.now() / 120) : 1;
  ctx.fillStyle = player.hp < 35 ? `rgba(255,${Math.floor(120 + 100 * lat)},${Math.floor(110 + 90 * lat)},1)` : '#fff'; ctx.fillText('VIDA ' + Math.max(0, Math.round(player.hp)) + '%', 8, VH + 8);
  ctx.fillStyle = '#ffe9a8'; ctx.fillText(WEAPONS[weapon].name + (reloadT > 0 ? '  RECARGANDO…' : weapon === 6 ? '  ∞' : '  ' + ammo[weapon] + '/' + WEAPONS[weapon].mag), 8, VH + 18);
  ctx.textAlign = 'right';
  ctx.fillStyle = '#f5d76e'; ctx.fillText('PUNTOS ' + score, W - 8, VH + 8);
  ctx.fillStyle = '#cfcfcf'; ctx.fillText('BAJAS ' + kills, W - 8, VH + 18);
  ctx.textAlign = 'left';
  drawFace(W / 2, VH + 12);
  drawMinimap();
  if (MP.rol !== 'solo') {                                  // lista de jugadores con su vida
    ctx.font = 'bold 8px monospace'; ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
    const lista = [player, ...MP.otros.filter(o => o.conectado)];
    lista.forEach((P, i) => {
      ctx.fillStyle = COLORES_JUGADOR[(P === player ? MP.miIdx : P.idx) % 6];
      ctx.fillText((P.muerto ? '✝ ' : '') + (P.nombre || 'Marino').slice(0, 9) + ' ' + Math.max(0, Math.round(P.hp)), W - 4, 26 + i * 9);
    });
    ctx.textAlign = 'left';
    if (MP.fuegoAmigo) { ctx.fillStyle = '#ff9a3c'; ctx.fillText('FUEGO AMIGO', 5, 52); }
  }
  if (player.muerto && state === 'play') {
    ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.fillRect(0, 0, W, VH);
    ctx.textAlign = 'center'; ctx.fillStyle = '#ff5a3c'; ctx.font = 'bold 16px monospace'; ctx.fillText('ESTÁS CAÍDO', W / 2, 70);
    ctx.fillStyle = '#eee'; ctx.font = 'bold 9px monospace'; ctx.fillText('Reapareces en ' + Math.ceil(player.resp) + ' s (si un compañero sigue en pie)', W / 2, 90);
    ctx.textAlign = 'left';
  }

  if (!player.muerto && state === 'play') {               // aviso de vehículo cercano
    ctx.textAlign = 'center'; ctx.font = 'bold 9px monospace';
    if (player.veh) { ctx.fillStyle = '#9fe9a0'; ctx.fillText((player.veh.pas ? 'PASAJERO EN ' : 'MANEJANDO ') + nombreVeh(player.veh.k, player.veh.o) + ' · T: bajar' + (((player.veh.k === 'canon' || player.veh.k === 'tanque') && !(player.veh.o && player.veh.o.tipo === 'ametra') && cooldownC > 0) ? ' · recargando…' : ''), W / 2, (player.veh.k === 'camion' || player.veh.k === 'tanque') ? 38 : VH - 12); }
    else { const c = candidatoVeh(player); if (c) { ctx.fillStyle = '#ffe36a'; ctx.fillText('T: subir al ' + nombreVeh(c.k).toLowerCase(), W / 2, VH - 12); } }
    ctx.textAlign = 'left';
  }
  if (msgT > 0) {
    ctx.textAlign = 'center'; ctx.font = 'bold 10px monospace';
    ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(0, 70, W, 16);
    ctx.fillStyle = '#ffe36a'; ctx.fillText(msg, W / 2, 78);
    ctx.textAlign = 'left';
  }
}

const SANGRE_MENU = lienzo(W, VH, c => {                           // fondo del menú / fin de partida: salpicaduras y chorros
  const g = c.createRadialGradient(W / 2, VH / 2, 20, W / 2, VH / 2, VH * 1.1); g.addColorStop(0, 'rgba(25,0,0,0.55)'); g.addColorStop(1, 'rgba(70,0,0,0.85)'); c.fillStyle = g; c.fillRect(0, 0, W, VH);
  for (let i = 0; i < 26; i++) gota(c, Math.random() * W, Math.random() * VH, 2 + Math.random() * 10, SANGRE_COL[Math.floor(Math.random() * 4)], true);
  gotearBorde(c, 0, W, 0, '#7a0a0a', 40); c.fillStyle = '#5a0606'; c.fillRect(0, 0, W, 3);
});
function drawOverlay(title, sub, color) {
  ctx.drawImage(SANGRE_MENU, 0, 0);
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const pul = 1 + 0.05 * Math.sin(performance.now() / 400);
  ctx.font = 'bold 21px monospace'; ctx.fillStyle = '#2a0000'; ctx.fillText(title, W / 2 + 1.5, 56.5); ctx.fillStyle = '#6a0000'; ctx.fillText(title, W / 2 + 0.5, 55.5);
  ctx.fillStyle = color && color !== '#ff5a3c' ? color : `rgb(${Math.floor(200 * pul)},16,16)`; ctx.fillText(title, W / 2, 55);
  const tw = ctx.measureText(title).width; ctx.fillStyle = '#a01010';                    // chorros que gotean de las letras
  for (let i = 0; i < 9; i++) { const dx = W / 2 - tw / 2 + 4 + ((i * 47 + 13) % Math.max(10, tw - 8)), l = 4 + ((i * 29) % 11) + 3 * Math.sin(performance.now() / 700 + i); ctx.fillRect(dx, 64, 1.5, l); ctx.beginPath(); ctx.arc(dx + 0.7, 64 + l, 1.6, 0, 7); ctx.fill(); }
  ctx.fillStyle = '#eee'; ctx.font = 'bold 10px monospace';
  sub.forEach((s, i) => ctx.fillText(s, W / 2, 88 + i * 15));
  ctx.textAlign = 'left';
}

function render() {
  if (tiembla > 0) { ctx.save(); ctx.translate((Math.random() - 0.5) * tiembla * 5, (Math.random() - 0.5) * tiembla * 5); }
  drawWalls();
  drawBillboards();
  dibujarAves(); dibujarAviones();
  if (tiembla > 0) ctx.restore();
  if (skyRed > 0.02) { ctx.fillStyle = `rgba(150,12,0,${skyRed * 0.17})`; ctx.fillRect(0, 0, W, VH); }   // todo se tiñe de rojo
  dibujarTetrico();
  drawHeldWeapon();
  if (aguaT > 0) { ctx.fillStyle = `rgba(${Math.round(20 + 130 * marRojo)},${Math.round(90 - 78 * marRojo)},${Math.round(170 - 150 * marRojo)},${aguaT * 0.45})`; ctx.fillRect(0, 0, W, VH); }
  if (player.hp > 0 && player.hp < 40 && state === 'play') {          // poca vida: bordes rojos que laten
    const k = (1 - player.hp / 40) * (0.7 + 0.3 * Math.sin(performance.now() / 160));
    const gr = ctx.createRadialGradient(W / 2, VH / 2, VH * 0.25, W / 2, VH / 2, VH * 0.95); gr.addColorStop(0, 'rgba(120,0,0,0)'); gr.addColorStop(1, `rgba(120,0,0,${0.75 * k})`);
    ctx.fillStyle = gr; ctx.fillRect(0, 0, W, VH);
  }
  if (redFlash > 0) { ctx.fillStyle = `rgba(200,0,0,${redFlash * 2})`; ctx.fillRect(0, 0, W, VH); }
  dibujarManchasP(Math.min(0.05, (performance.now() - (dibujarManchasP.ult || performance.now())) / 1000)); dibujarManchasP.ult = performance.now();
  drawHUD(); dibujarObjetivo();
  if (state === 'menu' && !MP.lobby) drawOverlay(NOMBRE_JUEGO.toUpperCase(), ['Desembarco · playa, puerto y base enemiga', 'Busca armas por el mapa · ¡no te metas al mar!', 'Toca o presiona Espacio para empezar']);
  if (state === 'over' && victoria && meAbandonaron) drawOverlay('¡TE ABANDONARON!', ['Tus amigos escaparon sin ti · Puntos: ' + score + ' · Bajas: ' + kills, 'Quién te manda quedarte atrás…', overT > 0 ? ' ' : (MP.rol === 'cliente' ? 'Espera al anfitrión…' : 'Toca para jugar de nuevo')]);
  else if (state === 'over' && victoria) drawOverlay('¡ESCAPASTE!', ['Escapaste en ' + (victoria === 'barco' ? 'barco' : 'helicóptero') + ' · Puntos: ' + score + ' · Bajas: ' + kills, 'Precisión: ' + (tiros ? Math.round(100 * aciertos / tiros) : 0) + '% · Récord: ' + record, overT > 0 ? ' ' : (MP.rol === 'cliente' ? 'Espera al anfitrión…' : 'Toca para jugar de nuevo')], '#6be06b');
  else if (state === 'over') drawOverlay(causa === 'mar' ? '¡TE HUNDISTE EN EL MAR!' : masacre ? '¡LA MULTITUD TE DEVORÓ!' : '¡TE ABATIERON!', ['Puntos: ' + score + ' · Bajas: ' + kills + ' · Récord: ' + record + ' · Precisión: ' + (tiros ? Math.round(100 * aciertos / tiros) : 0) + '%', (chiste || (chiste = CHISTES[Math.floor(Math.random() * CHISTES.length)])), overT > 0 ? ' ' : (MP.rol === 'cliente' ? 'Espera al anfitrión…' : 'Toca para jugar de nuevo')]);
}

// ############################################################
// ## 7. CONTROLES: teclado, mouse/touch y botones
// ############################################################

window.addEventListener('keydown', ev => {
  if (ev.target && (ev.target.tagName === 'INPUT' || ev.target.tagName === 'BUTTON' && MP.lobby)) return;   // escribiendo en la sala
  keys[ev.code] = true;
  if (ev.key && ev.key.length === 1) { tecleo = (tecleo + ev.key.toLowerCase()).slice(-12); for (const k in TRUCOS) if (tecleo.endsWith(k)) { tecleo = ''; if (state === 'play' && !player.muerto) TRUCOS[k](); } }
  if (ev.code === 'Space' || ev.code === 'Enter' || ev.code === 'KeyE') { attack(); ev.preventDefault(); }
  if (ev.code === 'Escape' && MP.rol === 'solo' && state === 'play') pausa = !pausa;
  if (ev.code === 'KeyG') lanzarGranada();
  if (ev.code === 'KeyH' && player.veh && player.veh.k === 'camion' && bocinaT <= 0) { bocinaT = 0.6; tono(311, 305, 0.5, 'square', 0.22); tono(392, 385, 0.5, 'square', 0.18); }
  if (ev.code === 'KeyX') pedirAbandono();
  if (ev.code === 'KeyM') { silencio = !silencio; aviso(silencio ? 'Sonido apagado (M para encender)' : 'Sonido encendido'); }
  if (ev.code === 'KeyR') startReload();
  if (ev.code === 'KeyT') usarVehiculo();
  if (ev.code === 'KeyF') pantallaCompleta();
  if (ev.code === 'Digit1') selectWeapon(0);
  if (ev.code === 'Digit2') selectWeapon(1);
  if (ev.code === 'Digit3') selectWeapon(2);
  if (ev.code === 'Digit4') selectWeapon(3);
  if (ev.code === 'Digit5') selectWeapon(4);
  if (ev.code === 'Digit6') selectWeapon(5);
  if (ev.code === 'Digit7' || ev.code === 'KeyV') selectWeapon(6);
  if (ev.code === 'KeyQ') cycleWeapon(1);
  if (ev.code.startsWith('Arrow')) ev.preventDefault();
});
window.addEventListener('keyup', ev => { keys[ev.code] = false; });
// Mouse: clic izquierdo = disparar · clic derecho (mantener y arrastrar) = mover la cámara. Con el dedo, tocar la pantalla dispara como antes.
window.addEventListener('pointerup', ev => { if (ev.pointerType !== 'mouse' || ev.button === 0) firing = false; if (ev.pointerType === 'mouse' && ev.button === 2) { girando = false; cv.style.cursor = ''; } });
window.addEventListener('pointercancel', () => { firing = false; girando = false; cv.style.cursor = ''; });
window.addEventListener('blur', () => { firing = false; girando = false; cv.style.cursor = ''; });
window.addEventListener('contextmenu', ev => { if (ev.target === cv || (ev.target.closest && ev.target.closest('#wrap'))) ev.preventDefault(); });
window.addEventListener('pointermove', ev => { if (girando && ev.pointerType === 'mouse') mouseDX += ev.movementX || 0; });
cv.addEventListener('pointerdown', ev => {
  if (ev.pointerType === 'mouse') {
    if (ev.button === 2) { girando = true; cv.style.cursor = 'grabbing'; ev.preventDefault(); return; }
    if (ev.button !== 0) return;
  }
  firing = true; attack(); ev.preventDefault();
});

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
function pantallaCompleta() {
  const el = document.getElementById('wrap'), d = document;
  try {
    if (d.fullscreenElement || d.webkitFullscreenElement) (d.exitFullscreen || d.webkitExitFullscreen).call(d);
    else (el.requestFullscreen || el.webkitRequestFullscreen).call(el);
  } catch (e) { /* en algunos celulares no se permite: no pasa nada */ }
}
document.getElementById('fs').addEventListener('pointerdown', ev => { pantallaCompleta(); ev.preventDefault(); ev.stopPropagation(); });
document.getElementById('bG').addEventListener('pointerdown', ev => { lanzarGranada(); ev.preventDefault(); });
document.getElementById('bT').addEventListener('pointerdown', ev => { usarVehiculo(); ev.preventDefault(); });
document.getElementById('rl').addEventListener('pointerdown', ev => { startReload(); ev.preventDefault(); });
document.getElementById('sw').addEventListener('pointerdown', ev => { cycleWeapon(1); ev.preventDefault(); });

// ############################################################
// ## 8. ARRANQUE
// ############################################################

let last = performance.now();
function loop(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (!pausa) { update(dt); if (MP.tick) MP.tick(dt); }
  render();
  if (pausa) { ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(0, 0, W, VH); ctx.fillStyle = '#fff'; ctx.font = 'bold 18px monospace'; ctx.textAlign = 'center'; ctx.fillText('PAUSA · Esc para seguir', W / 2, VH / 2); ctx.textAlign = 'left'; }
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
  crearBarcos(); pickups = (NIVEL_LEIDO.objetos || []).map((o, i) => Object.assign({ idx: i }, o));
  computeFlow();
  // rivales de fondo para el menú
  for (let i = 0; i < 4; i++) spawnEnemy();
  last = performance.now();
  MP.listo = true; if (MP.alListo) MP.alListo();
  requestAnimationFrame(loop);
});

// ############################################################
// ## MULTIJUGADOR COOPERATIVO (hasta 6 jugadores)
// ## Usa PeerJS (WebRTC): uno crea la sala (anfitrión) y los demás entran con el código.
// ## El anfitrión corre el juego completo; los demás reciben lo que pasa y mandan sus movimientos y disparos.
// ############################################################

(function () {
  const MAX_JUGADORES = 6;                       // anfitrión + 5
  const HZ_SNAP = 12, HZ_POS = 20;               // cuántas veces por segundo se envía el estado / tu posición
  const LETRAS = 'ABCDEFGHJKLMNPQRSTUVWXYZ';

  let peer = null, conn = null;                  // peer propio; conn = conexión al anfitrión (solo cliente)
  let codigo = '', snapT = 0, posT = 0;
  const $ = id => document.getElementById(id);

  // ---------------- Pantalla de sala ----------------
  const css = document.createElement('style');
  css.textContent = `
  #sala{position:fixed;inset:0;z-index:30;background:rgba(10,14,20,.94);display:flex;align-items:center;justify-content:center;font-family:Arial,sans-serif;color:#eee;touch-action:auto}
  #sala .caja{width:min(92vw,430px);max-height:94vh;overflow:auto;background:#1b222c;border:2px solid #3a4658;border-radius:14px;padding:16px;touch-action:auto;user-select:text}
  #sala h2{margin:0 0 4px;color:#ff5a3c;font-size:22px;text-align:center}
  #sala p.sub{margin:0 0 12px;text-align:center;color:#9aa7b8;font-size:13px}
  #sala input[type=text]{width:100%;padding:10px;font-size:16px;border-radius:8px;border:2px solid #3a4658;background:#10151c;color:#fff;text-transform:none}
  #sala .fila{display:flex;gap:8px;margin:8px 0}
  #sala button{width:auto;height:auto;min-height:44px;padding:8px 14px;font-size:15px;border-radius:10px;border:2px solid #555;background:#2a3444;color:#fff;flex:1}
  #sala button.pri{background:#b8321f;border-color:#e0553f}
  #sala button:disabled{opacity:.45}
  #sala .cod{font:bold 34px monospace;text-align:center;letter-spacing:3px;color:#ffe36a;background:#10151c;border-radius:10px;padding:8px;margin:8px 0;user-select:all}
  #sala ul{list-style:none;margin:8px 0;padding:0}
  #sala li{padding:6px 8px;margin:3px 0;background:#10151c;border-radius:8px;display:flex;align-items:center;gap:8px;font-size:15px}
  #sala li i{width:12px;height:12px;border-radius:50%;display:inline-block}
  #sala .est{min-height:20px;text-align:center;font-size:14px;color:#ffd24a;margin:6px 0}
  #sala label{display:flex;gap:8px;align-items:center;font-size:15px;margin:8px 0}
  #sala label input{width:20px;height:20px}
  #sala .peq{font-size:12px;color:#7f8ca0;text-align:center;margin-top:8px}
  `;
  document.head.appendChild(css);
  const sala = document.createElement('div');
  sala.id = 'sala';
  sala.innerHTML = `<div class="caja">
    <h2>GUERRA ANFIBIA</h2><p class="sub">Elige cómo jugar · hasta ${MAX_JUGADORES} jugadores en equipo</p>
    <div id="s-inicio">
      <input id="s-nombre" type="text" maxlength="10" placeholder="Tu nombre" autocomplete="off">
      <div class="fila"><button id="s-solo" class="pri">Un jugador</button></div>
      <div class="fila"><button id="s-crear">Crear sala</button></div>
      <div class="fila"><input id="s-cod" type="text" maxlength="8" placeholder="Código (GA-XXXXX)" autocomplete="off" autocapitalize="characters" style="flex:2"><button id="s-unir">Unirse</button></div>
    </div>
    <div id="s-dentro" style="display:none">
      <div id="s-codbox"><div class="peq">Código de la sala (pásaselo a tus amigos)</div><div class="cod" id="s-codigo"></div></div>
      <ul id="s-lista"></ul>
      <label id="s-fa-fila"><input type="checkbox" id="s-fa"> Fuego amigo (los disparos también dañan a tus compañeros)</label>
      <div id="s-fa-txt" class="est" style="display:none"></div>
      <div class="fila"><button id="s-ini" class="pri">Empezar partida</button><button id="s-salir">Salir</button></div>
    </div>
    <div class="est" id="s-est"></div>
    <div class="peq">Modo cooperativo: todos contra los enemigos. Necesita internet.</div>
  </div>`;
  document.body.appendChild(sala);
  const est = t => { $('s-est').textContent = t || ''; };
  MP.lobby = true;
  try { $('s-nombre').value = localStorage.getItem('ga_nombre') || ''; } catch (e) {}
  const qs = new URLSearchParams(location.search);
  if (qs.get('sala')) $('s-cod').value = qs.get('sala').toUpperCase();

  function miNombre() {
    const n = ($('s-nombre').value || '').trim().slice(0, 10) || 'Marino';
    try { localStorage.setItem('ga_nombre', n); } catch (e) {}
    return n;
  }
  function mostrar(dentro) { $('s-inicio').style.display = dentro ? 'none' : ''; $('s-dentro').style.display = dentro ? '' : 'none'; }
  function ocultarSala() { MP.lobby = false; sala.style.display = 'none'; }
  function mostrarSala() { MP.lobby = true; sala.style.display = 'flex'; }

  function pintarLista() {
    const ul = $('s-lista'); ul.innerHTML = '';
    for (let i = 0; i < MAX_JUGADORES; i++) {
      const li = document.createElement('li');
      const nombre = MP.nombres[i];
      const b = document.createElement('i'); b.style.background = nombre ? COLORES_JUGADOR[i] : '#333'; li.appendChild(b);
      const t = document.createElement('span'); t.textContent = nombre ? nombre + (i === 0 ? ' (anfitrión)' : '') + (i === MP.miIdx ? ' · tú' : '') : '— libre —';
      if (!nombre) t.style.opacity = .4;
      li.appendChild(t); ul.appendChild(li);
    }
    $('s-fa').checked = MP.fuegoAmigo;
  }

  // ---------------- Utilidades de red ----------------
  function enviar(c, m) { try { if (c && c.open) c.send(m); } catch (e) {} }
  function aTodos(m) { for (const o of MP.otros) enviar(o.conn, m); }
  MP.enviarA = (P, m) => enviar(P.conn, m);
  const r2 = v => Math.round(v * 100) / 100;

  function cerrarTodo() {
    try { if (conn) conn.close(); } catch (e) {}
    try { if (peer) peer.destroy(); } catch (e) {}
    peer = null; conn = null; MP.otros = []; MP.rol = 'solo'; MP.nombres = []; MP.miIdx = 0; MP.fuegoAmigo = false;
  }
  function volverASala(texto) {
    cerrarTodo();
    state = 'menu'; enemies = []; items = []; player.muerto = false;
    mostrar(false); mostrarSala(); est(texto);
  }

  // ---------------- Botones ----------------
  function listo() {
    if (MP.listo) return true;
    est('Cargando el juego… espera un momento'); return false;
  }
  $('s-solo').onclick = () => { if (!listo()) return; cerrarTodo(); player.nombre = miNombre(); ocultarSala(); resetGame(); };
  $('s-salir').onclick = () => { volverASala(''); };
  $('s-crear').onclick = () => { if (listo()) crearSala(0); };
  $('s-unir').onclick = () => {
    if (!listo()) return;
    const c = ($('s-cod').value || '').trim().toUpperCase().replace(/\s+/g, '');
    if (c.length < 4) { est('Escribe el código de la sala'); return; }
    unirse(c.startsWith('GA-') ? c : 'GA-' + c);
  };
  $('s-ini').onclick = () => { if (MP.rol === 'host' && listo()) { ocultarSala(); resetGame(); MP.anunciarInicio(); } };
  $('s-fa').onchange = () => { if (MP.rol === 'host') { MP.fuegoAmigo = $('s-fa').checked; avisarSala(); } };

  // Servidores para atravesar routers/redes móviles (STUN) y, si no queda otra, retransmitir (TURN gratuito de OpenRelay)
  const OPC_PEER = { debug: 1, config: { iceServers: [
    { urls: 'stun:stun.l.google.com:19302' }, { urls: 'stun:stun1.l.google.com:19302' }, { urls: 'stun:global.stun.twilio.com:3478' },
    { urls: ['turn:openrelay.metered.ca:80', 'turn:openrelay.metered.ca:443', 'turns:openrelay.metered.ca:443?transport=tcp'], username: 'openrelayproject', credential: 'openrelayproject' } ] } };
  function textoError(err) {
    const t = err && err.type || err;
    if (t === 'peer-unavailable') return 'No existe esa sala. Revisa el código.';
    if (t === 'network' || t === 'server-error' || t === 'socket-error' || t === 'socket-closed') return 'No se pudo contactar el servidor de salas (PeerJS). Revisa tu internet y vuelve a intentar.';
    if (t === 'browser-incompatible') return 'Tu navegador no soporta conexión directa (WebRTC). Prueba con Chrome.';
    return 'Error de conexión: ' + t;
  }

  // ---------------- ANFITRIÓN ----------------
  function nuevoCodigo() { let c = 'GA-'; for (let i = 0; i < 5; i++) c += LETRAS[Math.floor(Math.random() * LETRAS.length)]; return c; }

  function crearSala(intento) {
    cerrarTodo(); est('Creando sala…');
    player.nombre = miNombre();
    codigo = nuevoCodigo();
    try { peer = new Peer(codigo, OPC_PEER); } catch (e) { est('No se pudo cargar PeerJS (¿sin internet?)'); return; }
    MP.rol = 'host'; MP.miIdx = 0; MP.nombres = [player.nombre];
    peer.on('open', () => {
      mostrar(true); est('');
      $('s-codigo').textContent = codigo; $('s-codbox').style.display = '';
      $('s-fa-fila').style.display = ''; $('s-fa-txt').style.display = 'none'; $('s-ini').style.display = '';
      pintarLista();
    });
    peer.on('connection', c => nuevaConexion(c));
    peer.on('error', err => {
      if (err.type === 'unavailable-id' && intento < 5) { crearSala(intento + 1); return; }
      volverASala(textoError(err));
    });
    peer.on('disconnected', () => { try { peer.reconnect(); } catch (e) {} });
  }

  function nombresLista() { const n = []; n[0] = player.nombre; for (const o of MP.otros) n[o.idx] = o.nombre; return Array.from(n, v => v || null); }
  function avisarSala() {
    MP.nombres = nombresLista(); pintarLista();
    aTodos({ t: 'lobby', n: MP.nombres, fa: MP.fuegoAmigo });
  }

  function nuevaConexion(c) {
    let o = null;
    c.on('data', m => {
      if (!m || typeof m !== 'object') return;
      if (m.t === 'hola') {
        if (o) return;
        let idx = 0; const usados = new Set(MP.otros.map(x => x.idx));
        for (let i = 1; i < MAX_JUGADORES; i++) if (!usados.has(i)) { idx = i; break; }
        if (!idx) { enviar(c, { t: 'lleno' }); setTimeout(() => { try { c.close(); } catch (e) {} }, 400); return; }
        o = { idx, conn: c, nombre: String(m.nombre || 'Marino').slice(0, 10), x: INICIO.x, y: INICIO.y, tx: INICIO.x, ty: INICIO.y, a: 0, hp: CONFIG.vidaInicial,
              weapon: 0, muerto: false, resp: 0, conectado: true, mov: false, golpe: 0, atkAnim: 0, walkT: 0, fT: 0 };
        MP.otros.push(o);
        enviar(c, { t: 'ok', idx, n: nombresLista(), fa: MP.fuegoAmigo });
        avisarSala();
        if (state === 'play') { colocar(o); enviar(c, { t: 'ini', fa: MP.fuegoAmigo, idx, x: o.x, y: o.y, a: o.a, n: MP.nombres }); }   // entra con la partida en marcha
      } else if (!o) return;
      else if (m.t === 'p') {
        o.tx = +m.x || o.tx; o.ty = +m.y || o.ty; o.a = +m.a || 0; o.weapon = m.w | 0; o.mov = !!m.m;
        if (o.veh && o.veh.k === 'barco') { o.veh.o.cmd = Array.isArray(m.d) ? [Math.sign(m.d[0] | 0), Math.sign(m.d[1] | 0)] : null; o.veh.o.cmdT = 0.3; }
      } else if (m.t === 'v') {                                   // subir / bajar de un vehículo
        if (state !== 'play' || o.muerto) return;
        const lista = m.k === 'barco' ? BOATS : (m.k === 'camion' || m.k === 'tanque') ? CAM : CAN;
        const ob = lista.find(q => q.id === m.i);
        if (!ob) return;
        if (m.on) {
          if ((ob.piloto >= 0 && ob.piloto !== o.idx) || ob.op) { enviar(c, { t: 'vno' }); return; }
          liberar(o); ob.piloto = o.idx; o.veh = { k: m.k, o: ob };
        } else if (o.veh && o.veh.o === ob) liberar(o);
      } else if (m.t === 'f' && m.c) {                             // disparo de cañón (barco o torre)
        if (state !== 'play' || o.muerto || o.fT > 0 || !o.veh || o.veh.k !== m.k || o.veh.o.id !== m.i) return;
        const v = o.veh;
        if (v.o.tipo === 'ametra') { o.fT = 0.08; v.o.flash = 0.08; disparoBalas(o.x, o.y, +m.a || 0, ARMA_FIJA, o); return; }
        o.fT = 1.0;
        const q = mundoPos(o);
        v.o.flash = 0.3; disparoCanon(q.x, q.y, +m.a || 0, o, 0, !!v.o.alto);
      } else if (m.t === 'aban') {
        if (state === 'play' && !o.muerto) { abandonoOk = 10; avisoEquipo('¡' + (o.nombre || 'Un jugador') + ' ORDENA ABANDONAR! Se escapa sin los que estén lejos (10 s)'); }
      } else if (m.t === 'f') {
        if (state !== 'play' || o.muerto || o.fT > 0) return;
        const w = WEAPONS[m.w | 0]; if (!w) return;
        o.fT = w.cd * 0.7; o.atkAnim = 0.3;
        disparoBalas(+m.x || o.x, +m.y || o.y, +m.a || 0, w, o);
      }
    });
    const salio = () => {
      if (!o) return;
      liberar(o);
      MP.otros = MP.otros.filter(x => x !== o);
      avisarSala();
      if (state === 'play' && MP.rol === 'host') msg = o.nombre + ' salió de la partida', msgT = 3;
      o = null;
    };
    c.on('close', salio); c.on('error', salio);
  }

  function colocar(o) {
    const c = reachable[Math.min(reachable.length - 1, o.idx)];
    o.x = o.tx = c[0] + 0.5; o.y = o.ty = c[1] + 0.5; o.a = INICIO.a; o.hp = CONFIG.vidaInicial; o.muerto = false; o.resp = 0; o.veh = null;
  }
  MP.colocarJugadores = () => { for (const o of MP.otros) colocar(o); };
  MP.anunciarInicio = () => {
    for (const o of MP.otros) enviar(o.conn, { t: 'ini', fa: MP.fuegoAmigo, idx: o.idx, x: o.x, y: o.y, a: o.a, n: MP.nombres });
  };
  MP.anunciarVictoria = (como, d) => aTodos({ t: 'gan', c: como, sc: score, k: kills, d });
  MP.enviarAbandono = () => enviar(conn, { t: 'aban' });
  MP.avisoTodos = t => aTodos({ t: 'msg', m: t });
  MP.anunciarFin = () => aTodos({ t: 'fin', sc: score, k: kills });
  MP.avisoAmigo = (v, duenio) => {
    const texto = (duenio.nombre || 'Un compañero') + ' te disparó (fuego amigo)';
    if (v === player) { msg = texto; msgT = 2; } else enviar(v.conn, { t: 'msg', m: texto });
  };
  MP.enviarVeh = (on, k, i) => enviar(conn, { t: 'v', on, k, i });
  MP.enviarCanon = (k, i, a) => enviar(conn, { t: 'f', c: 1, k, i, a: r2(a) });
  MP.avisarExplosion = (x, y) => aTodos({ t: 'x', x: r2(x), y: r2(y) });
  MP.enviarDisparo = (x, y, a, w) => enviar(conn, { t: 'f', x: r2(x), y: r2(y), a: r2(a), w });

  function snapshotHost() {
    const e = [];
    for (const n of enemies) e.push([n.id, Math.round(n.x * 100), Math.round(n.y * 100), n.type, n.v, n.pain > 0 ? 1 : 0, Math.round((n.atkAnim || 0) * 100), Math.round(Math.max(0, n.muriendo || 0) * 100)]);
    const j = [[0, Math.round(player.x * 100), Math.round(player.y * 100), Math.round(player.a * 100), Math.round(player.hp), weapon, player.muerto ? 1 : 0, punchT > 0 ? 1 : 0, player.mov ? 1 : 0, Math.ceil(player.resp)]];
    for (const o of MP.otros) j.push([o.idx, Math.round(o.x * 100), Math.round(o.y * 100), Math.round(o.a * 100), Math.round(o.hp), o.weapon, o.muerto ? 1 : 0, o.atkAnim > 0 ? 1 : 0, o.mov ? 1 : 0, Math.ceil(o.resp)]);
    return { t: 's', k: kills, sc: score, e, b: BOATS.map(b => [b.x, b.y, b.piloto]), c: CAM.map(c => [Math.round(c.x * 100), Math.round(c.y * 100), Math.round(c.a * 100), c.piloto]), cp: CAN.map(c => c.piloto), esc: [tieneLlaves ? 1 : 0, tieneMapa ? 1 : 0, HELI ? [r2(HELI.x), r2(HELI.y), r2(HELI.z), HELI.llego ? 1 : 0] : 0], p: pickups.map(o => o.idx), i: items.map(it => [Math.round(it.x * 100), Math.round(it.y * 100)]), j };
  }

  // ---------------- CLIENTE ----------------
  function unirse(c) {
    cerrarTodo(); est('Conectando…');
    player.nombre = miNombre();
    try { peer = new Peer(undefined, OPC_PEER); } catch (e) { est('No se pudo cargar PeerJS (¿sin internet?)'); return; }
    let abierto = false;
    const limite = setTimeout(() => { if (!abierto) volverASala('No se pudo conectar. Revisa el código o tu internet.'); }, 25000);
    peer.on('open', () => {
      conn = peer.connect(c, { reliable: true });
      conn.on('open', () => { abierto = true; clearTimeout(limite); MP.rol = 'cliente'; enviar(conn, { t: 'hola', nombre: player.nombre }); });
      conn.on('data', alRecibir);
      conn.on('close', () => { if (MP.rol === 'cliente') volverASala('El anfitrión cerró la sala.'); });
      conn.on('error', () => { if (MP.rol === 'cliente') volverASala('Se perdió la conexión.'); });
    });
    peer.on('error', err => {
      clearTimeout(limite);
      volverASala(textoError(err));
    });
  }

  function alRecibir(m) {
    if (!m || typeof m !== 'object') return;
    if (m.t === 'ok') {
      MP.miIdx = m.idx; MP.nombres = m.n; MP.fuegoAmigo = !!m.fa;
      mostrar(true); est('Conectado. Espera a que el anfitrión empiece.');
      $('s-codigo').textContent = (conn && conn.peer) || ''; $('s-fa-fila').style.display = 'none';
      $('s-fa-txt').style.display = ''; $('s-fa-txt').textContent = 'Fuego amigo: ' + (MP.fuegoAmigo ? 'SÍ' : 'NO'); $('s-ini').style.display = 'none';
      pintarLista();
    } else if (m.t === 'lobby') {
      MP.nombres = m.n; MP.fuegoAmigo = !!m.fa; $('s-fa-txt').textContent = 'Fuego amigo: ' + (MP.fuegoAmigo ? 'SÍ' : 'NO'); pintarLista();
      for (const o of MP.otros) o.nombre = MP.nombres[o.idx] || o.nombre;
    } else if (m.t === 'lleno') {
      volverASala('La sala está llena (máximo ' + MAX_JUGADORES + ' jugadores).');
    } else if (m.t === 'ini') {
      MP.rol = 'cliente'; MP.fuegoAmigo = !!m.fa; MP.miIdx = m.idx; MP.nombres = m.n || MP.nombres; MP.otros = [];
      resetGame(); player.x = m.x; player.y = m.y; player.a = m.a || 0;
      ocultarSala();
    } else if (m.t === 's') {
      if (state === 'play') aplicarSnapshot(m);
    } else if (m.t === 'pk') {
      recogerLocal({ t: m.k, arma: m.i });
    } else if (m.t === 'rea') {
      player.muerto = false; player.x = m.x; player.y = m.y; player.hp = m.hp; player.resp = 0; msg = '¡REAPARECISTE!'; msgT = 2; reloadT = 0;
    } else if (m.t === 'x') {
      FX.push({ x: m.x, y: m.y, t: 0 }); sfx.explosion(Math.max(0.25, 1 - Math.hypot(m.x - player.x, m.y - player.y) / 40));
    } else if (m.t === 'vno') {
      liberar(player); msg = 'Ese vehículo ya está ocupado'; msgT = 2;
    } else if (m.t === 'msg') {
      msg = m.m; msgT = 2;
    } else if (m.t === 'gan') {
      score = m.sc; kills = m.k; victoria = m.c; meAbandonaron = !!(m.d && m.d.includes(MP.miIdx)); state = 'over'; overT = 2; causa = ''; firing = false;
    } else if (m.t === 'fin') {
      score = m.sc; kills = m.k; state = 'over'; overT = 2; causa = ''; firing = false;
    }
  }

  function aplicarSnapshot(m) {
    score = m.sc; kills = m.k;
    if (m.esc) {                                            // llaves, mapa y helicóptero del equipo
      tieneLlaves = !!m.esc[0]; tieneMapa = !!m.esc[1]; if (ESC[0]) ESC[0].ok = tieneLlaves; if (ESC[1]) ESC[1].ok = tieneMapa;
      const h = m.esc[2]; HELI = h ? { x: h[0], y: h[1], tx: h[0], ty: h[1], z: h[2], llego: !!h[3], resc: 0 } : null;
    }
    // rivales
    const vistos = new Set(), previos = new Map(enemies.map(e => [e.id, e]));
    const nuevos = [];
    for (const d of m.e) {
      const [id, x, y, type, v, pain, atk, mu] = d;
      let e = previos.get(id);
      if (!e) e = { id, x: x / 100, y: y / 100, type, v, hp: 1, atk: 0, tiro: 0, flash: 0, walkT: Math.random() * 4, pain: 0, atkAnim: 0, muriendo: 0 };
      e.tx = x / 100; e.ty = y / 100; e.pain = pain ? 0.1 : 0; e.atkAnim = atk / 100; e.muriendo = mu / 100;
      e.torre = CAN.find(c => Math.abs(c.x - e.tx) < 0.7 && Math.abs(c.y - e.ty) < 0.7) || null;
      if (mu > 0 && !e.cu) { e.cu = true; dejarCuerpo(e); }
      else if (pain && !e.sg) { e.sg = 1; sangreP(e.x, e.y, 5, 1); } else if (!pain) e.sg = 0;
      nuevos.push(e);
    }
    enemies = nuevos;
    // barcos
    m.b.forEach(([bx, by, pl], i) => {
      const b = BOATS[i]; if (!b) return;
      b.piloto = pl;
      if (b.x !== bx || b.y !== by) {
        const cx = Math.floor(player.x), cy = Math.floor(player.y);
        const montado = cx >= b.x && cx < b.x + b.l && cy >= b.y && cy < b.y + b.h && !VSOL[cy * MW + cx];
        const dx = bx - b.x, dy = by - b.y;
        pintarBarco(b, 0); b.x = bx; b.y = by; pintarBarco(b, b.id);
        if (montado) { player.x += dx; player.y += dy; }       // te lleva el barco
      }
    });
    m.c.forEach(([x, y, a, pl], i) => {
      const c = CAM[i]; if (!c) return;
      c.piloto = pl;
      if (player.veh && player.veh.o === c) return;
      c.tx = x / 100; c.ty = y / 100; c.ta = a / 100;
    });
    m.cp.forEach((pl, i) => { if (CAN[i]) CAN[i].piloto = pl; });
    if (player.veh && player.veh.o.piloto !== MP.miIdx && player.vehT <= 0) player.veh = null;
    // objetos
    const quedan = new Set(m.p); pickups = pickups.filter(o => quedan.has(o.idx));
    items = m.i.map(([x, y]) => ({ x: x / 100, y: y / 100, ttl: 5 }));
    // jugadores
    const idxs = new Set();
    for (const d of m.j) {
      const [idx, x, y, a, hp, w, muerto, atk, mov, resp] = d;
      if (idx === MP.miIdx) {
        if (hp < player.hp - 0.5) redFlash = 0.18;
        player.hp = hp; player.muerto = !!muerto; player.resp = resp;
        continue;
      }
      idxs.add(idx);
      let o = MP.otros.find(q => q.idx === idx);
      if (!o) { o = { idx, nombre: MP.nombres[idx] || 'Marino', x: x / 100, y: y / 100, conectado: true, walkT: 0, golpe: 0, atkAnim: 0 }; MP.otros.push(o); }
      if (o.hp !== undefined && hp < o.hp - 0.5) o.golpe = 0.3;
      o.tx = x / 100; o.ty = y / 100; o.a = a / 100; o.hp = hp; o.weapon = w; o.muerto = !!muerto; o.mov = !!mov; o.resp = resp;
      if (atk) o.atkAnim = 0.3;
    }
    MP.otros = MP.otros.filter(o => idxs.has(o.idx));
  }

  // El cliente suaviza lo que recibe y manda su posición
  MP.actualizarCliente = dt => {
    const k = Math.min(1, dt * 12);
    for (const e of enemies) {
      if (e.tx === undefined) continue;
      const px = e.x, py = e.y;
      e.x += (e.tx - e.x) * k; e.y += (e.ty - e.y) * k;
      e.walkT += Math.hypot(e.x - px, e.y - py) * 5;
      e.flash = Math.max(0, e.flash - dt);
    }
    for (const o of MP.otros) {
      if (o.tx !== undefined) { o.x += (o.tx - o.x) * k; o.y += (o.ty - o.y) * k; }
      o.atkAnim = Math.max(0, (o.atkAnim || 0) - dt); o.golpe = Math.max(0, (o.golpe || 0) - dt);
      if (o.mov && !o.muerto) o.walkT += dt * 6;
    }
    for (const it of items) it.ttl = 5;
    for (const c of CAM) if (c.tx !== undefined && !(player.veh && player.veh.o === c)) { c.x += (c.tx - c.x) * k; c.y += (c.ty - c.y) * k; c.a = c.ta; }
  };

  // ---------------- Reloj de red (se llama en cada cuadro) ----------------
  MP.tick = dt => {
    if (MP.rol === 'host') {
      for (const o of MP.otros) {
        o.fT = Math.max(0, (o.fT || 0) - dt);
        const k = Math.min(1, dt * 14);
        o.x += (o.tx - o.x) * k; o.y += (o.ty - o.y) * k;
        if (o.veh && (o.veh.k === 'camion' || o.veh.k === 'tanque')) { o.veh.o.x = o.x; o.veh.o.y = o.y; o.veh.o.a = o.a; }
        if (o.veh && o.veh.k === 'canon') { o.x = o.tx = o.veh.o.x; o.y = o.ty = o.veh.o.y; }
      }
      snapT -= dt;
      if (state === 'play' && snapT <= 0 && MP.otros.length) { snapT = 1 / HZ_SNAP; aTodos(snapshotHost()); }
    } else if (MP.rol === 'cliente' && state === 'play') {
      posT -= dt;
      if (posT <= 0) { posT = 1 / HZ_POS; enviar(conn, { t: 'p', x: r2(player.x), y: r2(player.y), a: r2(player.a), w: weapon, m: player.mov ? 1 : 0, d: player.cmd || 0 }); }
    }
  };

  MP.alListo = () => { if (qs.get('sala')) est('Listo: pulsa «Unirse»'); };
})();

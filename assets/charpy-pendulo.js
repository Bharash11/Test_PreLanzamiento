// charpy-pendulo.js — Módulo "Ensayos mecánicos", grupo "Fractura, fatiga y
// fluencia", subsección "5. Impacto" (v6.7): péndulo Charpy simulado como
// aparato físico, en la misma línea que rrmoore.js (v6.1-v6.4) y la máquina
// de estados de liquidos-particulas.js -- reemplaza el modo anterior (elegir
// material y ver de una la curva teórica completa) por un modo experimental:
// el alumno elige T, suelta el péndulo, y el punto (T, energía absorbida)
// se agrega a la curva. La curva teórica de fractura.js (FR_IMPACTO_PRESETS
// + frSigmoid) queda como referencia de fondo, sin tocarse -- este módulo
// solo LEE esas dos cosas y el chart ya creado (rtImpactoChartInst), no
// duplica ninguna fórmula.
//
// Física del péndulo (para documentar qué es cita y qué es modelado propio,
// mismo criterio que RR_BRAZO_M en rrmoore.js):
//   - Ángulo de suelta CH_THETA0_DEG=150° -- del orden de lo que usan las
//     máquinas Charpy reales (se elevan bastante por encima de la
//     horizontal), pero no es un valor normativo de ninguna norma puntual.
//   - CH_K (equivalente a m·g·L de un péndulo real) NO es la masa/longitud
//     de ninguna máquina real -- es una constante de modelado elegida para
//     que el rango de energías de FR_IMPACTO_PRESETS (5 a 150 J) produzca
//     una diferencia de rebote clara y legible en pantalla. La relación
//     energía-ángulo en sí (conservación de energía de un péndulo antes y
//     después del impacto) sí es física real:
//       E_absorbida = K·(cosθ1 − cosθ0)   =>   θ1 = acos(cosθ0 + E/K)
//     Con θ0 fijo, a mayor E absorbida, menor θ1 (menos rebote) -- así se
//     ve en pantalla lo mismo que mide una máquina Charpy real a partir de
//     la altura de rebote.

const CH_THETA0_DEG = 150;
const CH_K = 90;          // constante de modelado (ver comentario arriba)
const CH_CAPACIDAD_J = 170; // tope del dial/escala -- coincide con el eje Y del chart de fractura.js
const CH_PIVOTE = {x:210, y:170};
const CH_BRAZO = 150;
const CH_ANVIL = {x:CH_PIVOTE.x, y:CH_PIVOTE.y + CH_BRAZO}; // punto de impacto (θ=0)

let chHistorial = {bajoC:[], bajoCFino:[], aleado:[], fcc:[]};
let chAnimando = false;
let chAnimId = null;

function chPosBrazo(thetaDeg){
  const r = thetaDeg * Math.PI/180;
  return { x: CH_PIVOTE.x + CH_BRAZO*Math.sin(r), y: CH_PIVOTE.y + CH_BRAZO*Math.cos(r) };
}

// energiaDial: null = sin aguja (reposo); número = aguja apuntando a esa energía (0..CH_CAPACIDAD_J)
function chRenderDial(energiaDial){
  const cx=350, cy=58, r=38;
  const arco = `M${cx-r},${cy} A${r},${r} 0 0 1 ${cx+r},${cy}`;
  let aguja = '';
  if(energiaDial !== null){
    const frac = Math.max(0, Math.min(1, energiaDial/CH_CAPACIDAD_J));
    const ang = Math.PI*(1-frac); // 180deg (0J, izq) -> 0deg (capacidad, der)
    const nx = cx + (r-6)*Math.cos(ang), ny = cy - (r-6)*Math.sin(ang);
    aguja = `<line x1="${cx}" y1="${cy}" x2="${nx.toFixed(1)}" y2="${ny.toFixed(1)}" stroke="var(--frac)" stroke-width="2"/><circle cx="${cx}" cy="${cy}" r="3" fill="var(--frac)"/>`;
  }
  return `
    <path d="${arco}" fill="none" stroke="var(--border)" stroke-width="3"/>
    <line x1="${cx-r}" y1="${cy}" x2="${cx-r+4}" y2="${cy}" stroke="var(--muted)" stroke-width="1.5"/>
    <line x1="${cx+r-4}" y1="${cy}" x2="${cx+r}" y2="${cy}" stroke="var(--muted)" stroke-width="1.5"/>
    <line x1="${cx}" y1="${cy-r}" x2="${cx}" y2="${cy-r+4}" stroke="var(--muted)" stroke-width="1.5"/>
    ${aguja}
    <text x="${cx-r}" y="${cy+14}" font-size="9" fill="var(--muted)" text-anchor="middle">0</text>
    <text x="${cx+r}" y="${cy+14}" font-size="9" fill="var(--muted)" text-anchor="middle">${CH_CAPACIDAD_J}J</text>
    <text x="${cx}" y="${cy+26}" font-size="9" fill="var(--muted)" text-anchor="middle">energía absorbida</text>`;
}

// separacion: 0 = probeta entera, 1 = totalmente partida (fase de impacto)
function chRenderProbeta(separacion){
  const {x,y} = CH_ANVIL;
  if(separacion <= 0.001){
    return `<rect x="${x-30}" y="${y-6}" width="60" height="12" rx="2" fill="var(--border)"/>
      <path d="M${x-4},${y-6} L${x},${y+2} L${x+4},${y-6}" fill="var(--bg)"/>`;
  }
  const d = separacion*14;
  const rot = separacion*10;
  return `
    <g transform="translate(${-d},0) rotate(${-rot} ${x-30} ${y})">
      <rect x="${x-30}" y="${y-6}" width="30" height="12" rx="2" fill="var(--border)"/>
    </g>
    <g transform="translate(${d},0) rotate(${rot} ${x+30} ${y})">
      <rect x="${x}" y="${y-6}" width="30" height="12" rx="2" fill="var(--border)"/>
    </g>`;
}

function chRender(thetaDeg, separacion, energiaDial){
  const p = chPosBrazo(thetaDeg);
  const p0 = chPosBrazo(CH_THETA0_DEG); // posición de suelta, solo para dibujar la trayectoria de referencia
  return `<svg viewBox="0 0 420 340" width="100%" height="300" style="max-width:420px">
    <line x1="${CH_PIVOTE.x-70}" y1="330" x2="${CH_PIVOTE.x+70}" y2="330" stroke="var(--border)" stroke-width="4"/>
    <line x1="${CH_PIVOTE.x}" y1="330" x2="${CH_PIVOTE.x}" y2="${CH_PIVOTE.y}" stroke="var(--border)" stroke-width="6"/>
    <rect x="${CH_ANVIL.x-14}" y="${CH_ANVIL.y+6}" width="28" height="18" rx="2" fill="var(--surface3)"/>
    ${chRenderProbeta(separacion)}
    <path d="M${p0.x.toFixed(1)},${p0.y.toFixed(1)} A${CH_BRAZO},${CH_BRAZO} 0 0 1 ${CH_ANVIL.x},${CH_ANVIL.y}" fill="none" stroke="var(--border)" stroke-width="1" stroke-dasharray="2,3" opacity="0.5"/>
    <line x1="${CH_PIVOTE.x}" y1="${CH_PIVOTE.y}" x2="${p.x.toFixed(1)}" y2="${p.y.toFixed(1)}" stroke="var(--muted)" stroke-width="3"/>
    <circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="11" fill="var(--accent)"/>
    <circle cx="${CH_PIVOTE.x}" cy="${CH_PIVOTE.y}" r="6" fill="var(--muted)"/>
    ${chRenderDial(energiaDial)}
    <text x="210" y="18" text-anchor="middle" font-size="10" fill="var(--muted)">péndulo Charpy (corte esquemático, no a escala)</text>
  </svg>`;
}

function chDibujarReposo(){
  document.getElementById('ch_escenaWrap').innerHTML = chRender(CH_THETA0_DEG, 0, null);
}

function chEaseIn(t){ return t*t; }
function chEaseOut(t){ return 1-(1-t)*(1-t); }

// FIX #54 (hallazgo QA v6.9, Etapa 7): la física del péndulo (E -> θ1)
// vivía inline dentro de chEnsayar(), mezclada con el requestAnimationFrame
// -- no había forma de testearla sin duplicar la fórmula a mano o simular
// DOM+timers. Se extrae como función pura, mismo criterio que ya usan
// dzBrProfundidad() (Brinell) y dzRkCalcDepthFrac() (Rockwell) en esta
// misma versión. E = mgR(cosβ−cosα) es la fórmula real de un péndulo
// Charpy (α=ángulo de suelta, β=ángulo de rebote); CH_K hace de mgR.
function chCalcTheta1(E){
  const cosTheta0 = Math.cos(CH_THETA0_DEG*Math.PI/180);
  let cosTheta1 = cosTheta0 + E/CH_K;
  cosTheta1 = Math.max(-1, Math.min(1, cosTheta1)); // clamp NaN-safe si E fuera extremo
  return Math.acos(cosTheta1) * 180/Math.PI;
}

function chEnsayar(){
  if(chAnimando) return;
  const key = document.getElementById('rt_impactoMat').value;
  const p = FR_IMPACTO_PRESETS[key];
  const T = parseFloat(document.getElementById('ch_temp').value);
  if(isNaN(T)){ return; } // NaN guard (input numérico libre)
  const E = frSigmoid(T, p.Elow, p.Ehigh, p.Tmid, p.width);
  const theta1 = chCalcTheta1(E);

  chAnimando = true;
  document.getElementById('ch_btnEnsayar').disabled = true;
  document.getElementById('ch_mEnergia').textContent = '—';
  document.getElementById('ch_mEstado').textContent = 'Ensayando…';

  const DUR_CAIDA = 550, DUR_REBOTE = 450, PAUSA = 1100;
  const t0 = performance.now();

  function frame(now){
    const elapsed = now - t0;
    if(elapsed < DUR_CAIDA){
      const t = chEaseIn(elapsed/DUR_CAIDA);
      const theta = CH_THETA0_DEG*(1-t);
      document.getElementById('ch_escenaWrap').innerHTML = chRender(theta, 0, null);
      chAnimId = requestAnimationFrame(frame);
    } else if(elapsed < DUR_CAIDA + DUR_REBOTE){
      const t = chEaseOut((elapsed-DUR_CAIDA)/DUR_REBOTE);
      const theta = theta1*t;
      document.getElementById('ch_escenaWrap').innerHTML = chRender(theta, Math.min(1,t*3), E*t);
      chAnimId = requestAnimationFrame(frame);
    } else if(elapsed < DUR_CAIDA + DUR_REBOTE + PAUSA){
      document.getElementById('ch_escenaWrap').innerHTML = chRender(theta1, 1, E);
      chAnimId = requestAnimationFrame(frame);
    } else {
      chFinalizarEnsayo(key, T, E);
    }
  }
  chAnimId = requestAnimationFrame(frame);
}

function chFinalizarEnsayo(key, T, E){
  chAnimando = false;
  cancelAnimationFrame(chAnimId);
  document.getElementById('ch_btnEnsayar').disabled = false;
  chDibujarReposo();

  chHistorial[key].push({x:T, y:Math.round(E*10)/10});
  chSincronizarPuntosChart();
  chRenderBitacora(key);

  document.getElementById('ch_mEnergia').textContent = E.toFixed(1).replace('.',',');
  const p = FR_IMPACTO_PRESETS[key];
  let estado;
  if(!p.hasDBTT){ estado = 'Dúctil en todo el rango (FCC, sin transición marcada)'; }
  else if(T < p.Tmid - p.width){ estado = 'Rotura frágil (por debajo de la zona de transición)'; }
  else if(T > p.Tmid + p.width){ estado = 'Rotura dúctil (por encima de la zona de transición)'; }
  else { estado = 'Zona de transición dúctil-frágil'; }
  document.getElementById('ch_mEstado').textContent = estado;
}

function chSincronizarPuntosChart(){
  const key = document.getElementById('rt_impactoMat').value;
  if(rtImpactoChartInst){
    rtImpactoChartInst.data.datasets[2].data = chHistorial[key];
    rtImpactoChartInst.update();
  }
}

function chRenderBitacora(key){
  const wrap = document.getElementById('ch_bitacoraNote');
  const lista = document.getElementById('ch_bitacora');
  const puntos = chHistorial[key];
  if(!puntos.length){ wrap.style.display = 'none'; return; }
  wrap.style.display = 'block';
  lista.innerHTML = puntos.map(pt => `<div>T = ${pt.x}°C → E = ${pt.y} J</div>`).join('');
}

function chBorrarEnsayos(){
  const key = document.getElementById('rt_impactoMat').value;
  if(!chHistorial[key].length) return;
  if(!confirm('¿Borrar los ensayos Charpy registrados para este material?')) return;
  // FIX #79 (hallazgo QA v6.21, Etapa 16): a diferencia de chOnMaterialChange
  // (que sí cancela una animación en curso), acá no se tocaba chAnimando/
  // chAnimId -- si el alumno apretaba "Borrar ensayos" mientras el péndulo
  // seguía cayendo/rebotando, chFinalizarEnsayo() igual terminaba haciendo
  // push() de su resultado sobre el arreglo recién vaciado al completarse la
  // animación unos instantes después, reapareciendo un punto que el alumno
  // ya había borrado. Mismo criterio de cancelación que chOnMaterialChange().
  if(chAnimando){ cancelAnimationFrame(chAnimId); chAnimando = false; document.getElementById('ch_btnEnsayar').disabled = false; chDibujarReposo(); }
  chHistorial[key] = [];
  chSincronizarPuntosChart();
  chRenderBitacora(key);
  document.getElementById('ch_mEnergia').textContent = '—';
  document.getElementById('ch_mEstado').textContent = '—';
}

function chOnMaterialChange(){
  if(chAnimando){ cancelAnimationFrame(chAnimId); chAnimando = false; document.getElementById('ch_btnEnsayar').disabled = false; }
  const key = document.getElementById('rt_impactoMat').value;
  chDibujarReposo();
  chSincronizarPuntosChart();
  chRenderBitacora(key);
  document.getElementById('ch_mEnergia').textContent = '—';
  document.getElementById('ch_mEstado').textContent = '—';
}

function chInit(){
  chDibujarReposo();
  chSincronizarPuntosChart();
}

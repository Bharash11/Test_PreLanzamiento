// indentador-micro.js — escenas animadas de Vickers y Knoop (v6.9).
// Cuarto módulo con "aparato físico" fuera de Tracción/Compresión y R.R.
// Moore, después de Charpy (v6.8), Brinell (v6.9) y Rockwell (v6.9) -- mismo
// patrón: un botón "▶ Realizar ensayo" por cada mini-ensayo (acá hay dos,
// independientes entre sí, en el mismo panel de microdureza) que dramatiza
// en el tiempo lo que antes se mostraba de una sola vez, sin tocar el
// comportamiento de exploración instantánea que ya tenía dureza-vickers.js.
//
// Vickers y Knoop comparten el mismo tipo de indentador (pirámide de
// diamante) y la misma huella romboidal vista desde arriba -- solo cambia
// la relación entre diagonales: Vickers es un rombo "cuadrado" (las dos
// diagonales miden lo mismo, d₁), Knoop es un rombo alargado (la diagonal
// corta mide 1/7,11 de la larga, l -- geometría real del indentador Knoop,
// no un dato del material). Por eso hay UNA sola función de dibujo
// (dzMicroEscenaUna) reusada para las dos, en vez de duplicarla.
//
// Mismo criterio de escala real aprendido en Brinell (v6.9, corrección
// pedida tras la primera revisión): las dos huellas de este panel usan la
// MISMA constante mm→px (DZ_MICRO_ESCALA), para que se pueda comparar a
// simple vista el tamaño real de una diagonal Vickers contra la diagonal
// larga de una Knoop.

const DZ_MICRO_ESCALA = 500; // px por mm -- escala propia de este panel (las
  // medidas acá son ~40x más chicas que en Brinell: d₁/l típicos rondan
  // 0,02-0,15 mm, muy lejos de los 1-6,5 mm de un diámetro de huella
  // Brinell, así que reusar la escala de Brinell (22 px/mm) daría huellas
  // invisibles de 1-2px de radio.
const DZ_MICRO_MIN_PX = 8, DZ_MICRO_MAX_PX = 90; // límites visuales para que un d₁/l fuera de rango típico no rompa el dibujo
const DZ_KNOOP_RATIO = 7.11; // relación real diagonal larga/corta de un indentador Knoop (geometría del indentador, fija)

function dzMicroClampPx(mm){
  return Math.max(DZ_MICRO_MIN_PX, Math.min(DZ_MICRO_MAX_PX, mm*DZ_MICRO_ESCALA));
}
function dzEaseInOutMicro(t){ return t<0.5 ? 2*t*t : 1-Math.pow(-2*t+2,2)/2; }
function dzEaseInMicro(t){ return t*t; }

let dzMicroVProg = {tool:1, mark:1};
let dzMicroKProg = {tool:1, mark:1};
let dzMicroVAnimando = false, dzMicroVAnimId = null;
let dzMicroKAnimando = false, dzMicroKAnimId = null;

// halfLong/halfShort: semidiagonales FINALES en px (ya a escala real, antes
// de aplicar markPenFrac) -- para Vickers son iguales entre sí (rombo
// "cuadrado"); para Knoop, halfLong = halfShort*DZ_KNOOP_RATIO.
// toolPosFrac: 0..1, posición de la herramienta (0=elevada, 1=apoyada).
// markPenFrac: 0..1, cuánto de la huella final ya se marcó.
function dzMicroEscenaUna(surfaceY, halfLong, halfShort, toolPosFrac, markPenFrac, titulo, valorTexto){
  const cx = 110;
  const liftPx = 40*(1-toolPosFrac);
  const toolTipY = surfaceY - liftPx;
  const hl = halfLong*markPenFrac, hs = halfShort*markPenFrac;
  const marcaOp = markPenFrac > 0.02 ? 1 : 0;
  return `
    <line x1="20" y1="${surfaceY}" x2="200" y2="${surfaceY}" stroke="var(--border)" stroke-width="2"/>
    <text x="26" y="${surfaceY-10}" fill="var(--muted)" font-size="9" letter-spacing="1">${titulo}</text>
    <polygon points="${(cx-hl).toFixed(1)},${surfaceY} ${cx},${(surfaceY-hs).toFixed(1)} ${(cx+hl).toFixed(1)},${surfaceY} ${cx},${(surfaceY+hs).toFixed(1)}"
      fill="var(--accent)" opacity="${0.45*marcaOp}" stroke="var(--accent)" stroke-width="1.5"/>
    <polygon points="${cx},${toolTipY.toFixed(1)} ${cx-13},${(toolTipY-20).toFixed(1)} ${cx+13},${(toolTipY-20).toFixed(1)}" fill="none" stroke="var(--text)" stroke-width="1.5" opacity="0.75"/>
    <text x="${cx}" y="${surfaceY+40}" text-anchor="middle" fill="var(--muted)" font-size="10">${valorTexto}</text>
  `;
}

function dzDrawMicroScene(){
  const svg = document.getElementById('dz_microSvg');
  if(!svg) return;
  const d1 = parseFloat(document.getElementById('dz_vD').value);
  const l = parseFloat(document.getElementById('dz_kL').value);
  const validD1 = isFinite(d1) && d1>0;
  const validL = isFinite(l) && l>0;
  const hV = validD1 ? dzMicroClampPx(d1) : 0;
  const hK = validL ? dzMicroClampPx(l) : 0;

  const sceneV = dzMicroEscenaUna(100, hV, hV, dzMicroVProg.tool, validD1?dzMicroVProg.mark:0,
    'VICKERS', validD1?`d₁ = ${d1.toFixed(3).replace('.',',')} mm`:'d₁ inválido');
  const sceneK = dzMicroEscenaUna(350, hK, hK/DZ_KNOOP_RATIO, dzMicroKProg.tool, validL?dzMicroKProg.mark:0,
    'KNOOP', validL?`l = ${l.toFixed(3).replace('.',',')} mm`:'l inválido');

  svg.innerHTML = sceneV + sceneK;
}

function dzMicroVEnsayar(){
  if(dzMicroVAnimando) return;
  const d1 = parseFloat(document.getElementById('dz_vD').value); // guard NaN: campo numérico libre
  if(!isFinite(d1) || d1<=0) return;

  dzMicroVAnimando = true;
  document.getElementById('dz_vBtnEnsayar').disabled = true;
  const DUR_BAJADA=700, PAUSA=800, DUR_SUBIDA=450;
  const t0 = performance.now();

  function frame(now){
    const el = now - t0;
    if(el < DUR_BAJADA){
      const p = dzEaseInOutMicro(el/DUR_BAJADA);
      dzMicroVProg = {tool:p, mark:p};
    } else if(el < DUR_BAJADA+PAUSA){
      dzMicroVProg = {tool:1, mark:1};
    } else if(el < DUR_BAJADA+PAUSA+DUR_SUBIDA){
      const p = 1 - dzEaseInMicro((el-DUR_BAJADA-PAUSA)/DUR_SUBIDA);
      dzMicroVProg = {tool:p, mark:1};
    } else {
      dzMicroVAnimando = false;
      cancelAnimationFrame(dzMicroVAnimId);
      document.getElementById('dz_vBtnEnsayar').disabled = false;
      dzUpdateMicro();
      return;
    }
    dzDrawMicroScene();
    dzMicroVAnimId = requestAnimationFrame(frame);
  }
  dzMicroVAnimId = requestAnimationFrame(frame);
}

function dzMicroKEnsayar(){
  if(dzMicroKAnimando) return;
  const l = parseFloat(document.getElementById('dz_kL').value); // guard NaN: campo numérico libre
  if(!isFinite(l) || l<=0) return;

  dzMicroKAnimando = true;
  document.getElementById('dz_kBtnEnsayar').disabled = true;
  const DUR_BAJADA=700, PAUSA=800, DUR_SUBIDA=450;
  const t0 = performance.now();

  function frame(now){
    const el = now - t0;
    if(el < DUR_BAJADA){
      const p = dzEaseInOutMicro(el/DUR_BAJADA);
      dzMicroKProg = {tool:p, mark:p};
    } else if(el < DUR_BAJADA+PAUSA){
      dzMicroKProg = {tool:1, mark:1};
    } else if(el < DUR_BAJADA+PAUSA+DUR_SUBIDA){
      const p = 1 - dzEaseInMicro((el-DUR_BAJADA-PAUSA)/DUR_SUBIDA);
      dzMicroKProg = {tool:p, mark:1};
    } else {
      dzMicroKAnimando = false;
      cancelAnimationFrame(dzMicroKAnimId);
      document.getElementById('dz_kBtnEnsayar').disabled = false;
      dzUpdateMicro();
      return;
    }
    dzDrawMicroScene();
    dzMicroKAnimId = requestAnimationFrame(frame);
  }
  dzMicroKAnimId = requestAnimationFrame(frame);
}

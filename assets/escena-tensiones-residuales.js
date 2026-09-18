// escena-tensiones-residuales.js — escena animada del ensayo de tensiones
// residuales por hole-drilling (prototipo, sesión posterior a v6.9).
// Quinto módulo con "aparato físico" después de Charpy/Brinell/Rockwell/
// Vickers-Knoop -- mismo criterio: agrega un botón "▶ Realizar ensayo" que
// dramatiza en el tiempo lo que tensiones-residuales.js ya calcula al
// instante con los 3 sliders de deformación (tr_e1/tr_e2/tr_e3), sin tocar
// ni reemplazar esa exploración instantánea (trUpdate() sigue actualizando
// el círculo de Mohr exactamente igual que antes).
//
// A diferencia de Brinell (donde la profundidad de penetración ES la
// fórmula real HB), acá NO hay ninguna magnitud física real que determine
// cuánto debe "verse" el agujero perforado ni cuánto debe tardar la broca
// en bajar: el hole-drilling real (ASTM E837) perfora a una profundidad
// normalizada fija (típicamente ~0,4×D0, ver Tech Note TN-503), que no es
// un parámetro de este simulador y no depende de ε1/ε2/ε3. Por eso, tanto
// el radio del agujero dibujado (DZ_TR_HOLE_R, fijo) como los tiempos de
// la animación son puramente ILUSTRATIVOS -- lo único real acá son las 3
// lecturas de deformación (tomadas tal cual de los sliders) y el círculo
// de Mohr resultante, que ya calculaba trUpdate() antes de esta escena.
//
// Misma separación herramienta/marca que Brinell/Rockwell: brocaProg (dónde
// está la broca) y marcaProg (cuánto se reveló el agujero + cuántas de las
// 3 galgas ya muestran su lectura) son variables separadas -- al retirar la
// broca, brocaProg vuelve a 0 pero marcaProg se mantiene en 1, para que el
// agujero y las 3 lecturas no desaparezcan.

const DZ_TR_CX = 130, DZ_TR_CY = 140; // centro de la roseta/agujero
const DZ_TR_HOLE_R = 16; // radio ilustrativo del agujero perforado, fijo (ver nota arriba)
const DZ_TR_ROSETA_R = 60; // radio al que se ubican las 3 galgas
const DZ_TR_GALGA_LARGO = 46, DZ_TR_GALGA_ANCHO = 10;
const DZ_TR_BROCA_ARRIBA_Y = 20, DZ_TR_BROCA_ABAJO_Y = DZ_TR_CY; // recorrido vertical de la broca

function dzEaseInOutTr(t){ return t<0.5 ? 2*t*t : 1-Math.pow(-2*t+2,2)/2; }
function dzEaseInTr(t){ return t*t; }

let dzTrAnimando = false;
let dzTrAnimId = null;

// Ángulo de cada galga en grados, medido igual que ε1(0°)/ε2(45°)/ε3(90°)
// del propio módulo (ver tr_e1/tr_e2/tr_e3 en tensiones-residuales.js).
const DZ_TR_GALGA_ANGULOS = [0, 45, 90];

function dzTrGalgaRect(anguloDeg, cx, cy, r, largo, ancho){
  // Rectángulo fino centrado a distancia r del centro, orientado a lo largo
  // del ángulo dado (para que la roseta se vea con las 3 galgas "mirando"
  // hacia el agujero, como en una roseta real 062RE/UL).
  const rad = anguloDeg * Math.PI / 180;
  const midx = cx + r * Math.cos(rad), midy = cy - r * Math.sin(rad);
  const dx = Math.cos(rad), dy = -Math.sin(rad);
  const x1 = midx - dx*largo/2, y1 = midy - dy*largo/2;
  const x2 = midx + dx*largo/2, y2 = midy + dy*largo/2;
  return { x1, y1, x2, y2, midx, midy, ancho, angulo: anguloDeg };
}

// brocaProg: 0..1, posición vertical de la broca (0=retraída arriba,
// 1=profundidad máxima ilustrativa) -- controla SOLO dónde se dibuja la
// broca.
// marcaProg: 0..1, cuánto avanzó la perforación en términos de "revelado":
// controla el radio del agujero Y cuántas de las 3 galgas ya muestran su
// valor de deformación (por tercios: 0-1/3 revela ε1, 1/3-2/3 revela ε2,
// 2/3-1 revela ε3), sugiriendo que cada galga registra su relajación a
// medida que la broca avanza -- en las dos GANAN persistencia a la vez
// (no se apagan si la broca sube).
function trDrawEscena(brocaProg, marcaProg, e1, e2, e3){
  const svg = document.getElementById('tr_svg');
  if(!svg) return;
  const cx = DZ_TR_CX, cy = DZ_TR_CY;
  const holeR = DZ_TR_HOLE_R * Math.max(0, Math.min(1, marcaProg));
  const brocaY = DZ_TR_BROCA_ARRIBA_Y + brocaProg * (DZ_TR_BROCA_ABAJO_Y - DZ_TR_BROCA_ARRIBA_Y);
  const valores = [e1, e2, e3];
  const umbrales = [1/3, 2/3, 1]; // fracción de marcaProg a la que cada galga "revela" su lectura

  let galgasSvg = '';
  for(let i=0;i<3;i++){
    const g = dzTrGalgaRect(DZ_TR_GALGA_ANGULOS[i], cx, cy, DZ_TR_ROSETA_R, DZ_TR_GALGA_LARGO, DZ_TR_GALGA_ANCHO);
    const revelada = marcaProg >= umbrales[i] - 1e-9;
    const activa = marcaProg > 0 && marcaProg < umbrales[i] + 0.02 && marcaProg >= (i===0?0:umbrales[i-1]);
    const fill = revelada ? 'var(--accent)' : 'var(--surface2)';
    const glow = activa ? 1 : 0.35;
    const labelX = g.midx + 14*Math.cos(DZ_TR_GALGA_ANGULOS[i]*Math.PI/180);
    const labelY = g.midy - 14*Math.sin(DZ_TR_GALGA_ANGULOS[i]*Math.PI/180);
    galgasSvg += `
      <g opacity="${(0.5+0.5*glow).toFixed(2)}">
        <rect x="${(g.midx-g.ancho/2).toFixed(1)}" y="${(g.midy-DZ_TR_GALGA_LARGO/2).toFixed(1)}"
          width="${g.ancho}" height="${DZ_TR_GALGA_LARGO}" rx="2"
          fill="${fill}" stroke="var(--border)" stroke-width="1"
          transform="rotate(${(90-DZ_TR_GALGA_ANGULOS[i]).toFixed(1)} ${g.midx.toFixed(1)} ${g.midy.toFixed(1)})"/>
        <text x="${labelX.toFixed(1)}" y="${labelY.toFixed(1)}" text-anchor="middle" fill="var(--muted)" font-size="8">${DZ_TR_GALGA_ANGULOS[i]}°</text>
        ${revelada ? `<text x="${labelX.toFixed(1)}" y="${(labelY+12).toFixed(1)}" text-anchor="middle" fill="var(--text)" font-size="9" font-weight="600">${valores[i]} µε</text>` : ''}
      </g>`;
  }

  const brocaVisible = brocaProg > 0.01;

  svg.innerHTML = `
    <rect x="10" y="10" width="240" height="260" rx="6" fill="var(--surface)" stroke="var(--border)"/>
    <text x="20" y="26" fill="var(--muted)" font-size="9" letter-spacing="1">SUPERFICIE DE LA PIEZA</text>

    <!-- roseta de 3 galgas -->
    ${galgasSvg}

    <!-- agujero perforado -->
    <circle cx="${cx}" cy="${cy}" r="${holeR.toFixed(1)}" fill="var(--bg)" stroke="var(--neck)" stroke-width="1.5"/>

    <!-- broca -->
    <g opacity="${brocaVisible ? 1 : 0}">
      <line x1="${cx}" y1="0" x2="${cx}" y2="${brocaY.toFixed(1)}" stroke="var(--muted)" stroke-width="6" stroke-linecap="round"/>
      <polygon points="${cx-6},${(brocaY-10).toFixed(1)} ${cx+6},${(brocaY-10).toFixed(1)} ${cx},${(brocaY+6).toFixed(1)}" fill="var(--text)"/>
    </g>

    <text x="130" y="285" text-anchor="middle" fill="var(--muted)" font-size="9">agujero ilustrativo (Ø no está a escala real de la roseta) · broca sube al terminar, la marca queda</text>
  `;
}

function trEnsayar(){
  if(dzTrAnimando) return;
  const e1 = parseFloat(document.getElementById('tr_e1').value) || 0; // <input type=range>, estructuralmente numérico
  const e2 = parseFloat(document.getElementById('tr_e2').value) || 0;
  const e3 = parseFloat(document.getElementById('tr_e3').value) || 0;

  dzTrAnimando = true;
  const btn = document.getElementById('tr_btnEnsayar');
  if(btn) btn.disabled = true;

  const DUR_BAJADA = 1100, PAUSA = 700, DUR_SUBIDA = 500;
  const t0 = performance.now();

  function frame(now){
    const el = now - t0;
    if(el < DUR_BAJADA){
      const p = dzEaseInOutTr(el/DUR_BAJADA);
      trDrawEscena(p, p, e1, e2, e3);
      dzTrAnimId = requestAnimationFrame(frame);
    } else if(el < DUR_BAJADA+PAUSA){
      trDrawEscena(1, 1, e1, e2, e3);
      dzTrAnimId = requestAnimationFrame(frame);
    } else if(el < DUR_BAJADA+PAUSA+DUR_SUBIDA){
      const p = 1 - dzEaseInTr((el-DUR_BAJADA-PAUSA)/DUR_SUBIDA);
      trDrawEscena(p, 1, e1, e2, e3); // la broca se retira (brocaProg->0) pero el agujero/las 3 lecturas quedan (marcaProg=1)
      dzTrAnimId = requestAnimationFrame(frame);
    } else {
      dzTrAnimando = false;
      cancelAnimationFrame(dzTrAnimId);
      if(btn) btn.disabled = false;
      trUpdate(); // deja todo (Mohr, escena en reposo) en el estado final canónico
    }
  }
  dzTrAnimId = requestAnimationFrame(frame);
}

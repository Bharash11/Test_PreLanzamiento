// escena-corrosion.js — escena animada de envejecimiento visual de una
// probeta corroída (prototipo, post-v6.15). Cuarto módulo del backlog de
// escenas (orden de prioridad: 1. Tensiones residuales, 2. Ultrasonido,
// 3. Metalografía, 4. Corrosión), séptimo "aparato/proceso" animado en
// total después de Charpy/Brinell/Rockwell/Vickers-Knoop/Tensiones/
// Ultrasonido/Metalografía.
//
// Botón "▶ Simular envejecimiento" (`crEnvejecer()`) como capa ADICIONAL
// sobre la exploración instantánea existente: los 3 controles (metal,
// i_corr, tiempo de exposición) siguen actualizando la curva de Faraday y
// las 2 métricas al instante vía crUpdate() (corrosion.js), sin tocar esa
// lógica. crUpdate() se extiende con UNA sola línea al final que llama
// crDrawEscena(svg, 1, metal) -- mismo criterio que trUpdate()/utUpdate().
//
// Sin separación herramienta/marca (igual que Metalografía): acá no hay
// una herramienta que se retire dejando una marca, sino un único progreso
// de tiempo simulado (0 = probeta nueva, 1 = tiempo de exposición máximo
// elegido por el alumno, cr_tiempo). `fraction` recorre ese progreso.
//
// Honestidad física, MUY importante en este módulo en particular: la curva
// que ya calcula crCalcVelocidad() (ASTM G102 / ley de Faraday) es
// corrosión GENERAL/uniforme -- así lo aclara el propio comentario de
// cabecera de corrosion.js. El OSCURECIMIENTO de la placa (capa de óxido
// superpuesta) SÍ está atado a esa magnitud real: su opacidad es
// proporcional a la pérdida de espesor acumulada en cada instante,
// `CR·t`, la misma que ya muestra la tarjeta de métricas. Las PICADURAS
// (circulitos que aparecen y crecen) en cambio son una LICENCIA VISUAL
// pura para que se note el avance del daño con más dramatismo -- el
// picado (pitting) es un fenómeno distinto, estadístico y localizado, que
// esta calculadora NO modela (no hay ninguna fórmula de picado en
// corrosion.js). Posición, cantidad y tamaño de las picaduras son
// ilustrativos y deterministas (semilla fija, mismo criterio que
// mgGenerarSemillas en metalografia.js), NO se derivan de i_corr ni de
// ninguna otra magnitud de entrada real. Esto se aclara también en la
// nota de la UI (index.html) para no confundir a un alumno.

// PRNG chico y determinístico (mulberry32) -- mismo algoritmo que
// mgMulberry32/mdMulberry32 en otros módulos, reimplementado acá para que
// este archivo no dependa de que otro módulo haya cargado antes (cada
// módulo de escena mantiene su propia copia, mismo criterio ya usado en
// todo el proyecto).
function crMulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Geometría fija de la placa dibujada (viewBox del SVG).
const DZ_CR_VB_W = 260, DZ_CR_VB_H = 170;
const DZ_CR_PLACA = { x: 20, y: 35, w: 220, h: 100 };

// Colores de óxido ilustrativos por metal -- aproximaciones visuales
// razonables (herrumbre rojiza en hierro, pátinas blanquecinas o verdosas
// en el resto) para que se note la diferencia entre metales, NO son una
// referencia colorimétrica citada de ninguna norma.
const CR_OXIDO_TABLE = {
  hierro:   { color: '138,74,42',   nombre: 'herrumbre rojiza (óxidos de hierro)' },
  zinc:     { color: '176,178,168', nombre: 'pátina blanquecina (óxido de zinc)' },
  aluminio: { color: '196,196,188', nombre: 'película blanquecina (Al₂O₃)' },
  cobre:    { color: '105,140,118', nombre: 'pátina verdosa (carbonatos de cobre)' },
  niquel:   { color: '122,128,98',  nombre: 'tono verde-grisáceo (óxido de níquel)' },
  magnesio: { color: '206,206,196', nombre: 'película blanquecina (óxido de magnesio)' },
  titanio:  { color: '148,156,158', nombre: 'película pasivante grisácea (TiO₂)' },
};
const CR_OXIDO_OPACIDAD_MAX = 0.72; // a fraction=1, no tapa del todo el metal base

// Picaduras: generadas UNA vez (geometría de la placa es fija, no depende
// de metal/i_corr/tiempo), cada una con su umbral de aparición y su radio
// máximo. Ver nota de honestidad física arriba -- puramente ilustrativas.
function crGenerarPicaduras(n, seed) {
  const rnd = crMulberry32(seed);
  const margen = 10;
  const pts = [];
  for (let i = 0; i < n; i++) {
    pts.push({
      x: DZ_CR_PLACA.x + margen + rnd() * (DZ_CR_PLACA.w - 2 * margen),
      y: DZ_CR_PLACA.y + margen + rnd() * (DZ_CR_PLACA.h - 2 * margen),
      radioMax: 1.5 + rnd() * 4.5,
      umbral: 0.05 + rnd() * 0.65, // fracción a partir de la cual empieza a aparecer
    });
  }
  return pts;
}
const CR_PICADURAS = crGenerarPicaduras(16, 9001);

// Única fuente de verdad de la escena: tanto la animación (crEnvejecer(),
// cuadro a cuadro) como el estado final instantáneo (fraction=1, llamado
// desde crUpdate()) pasan por acá.
function crDrawEscena(svg, fraction, metalKey) {
  if (!svg) return;
  const f = Math.max(0, Math.min(1, fraction));
  const oxido = CR_OXIDO_TABLE[metalKey] || CR_OXIDO_TABLE.hierro;
  const { x, y, w, h } = DZ_CR_PLACA;

  let picadurasSvg = '';
  for (const p of CR_PICADURAS) {
    if (f <= p.umbral) continue;
    const avance = (f - p.umbral) / (1 - p.umbral);
    const radio = p.radioMax * Math.max(0, Math.min(1, avance));
    if (radio < 0.3) continue;
    picadurasSvg += `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="${radio.toFixed(1)}" fill="#241610" opacity="0.75"/>`;
  }

  svg.innerHTML = `
    <rect x="2" y="2" width="${DZ_CR_VB_W - 4}" height="${DZ_CR_VB_H - 4}" rx="6" fill="var(--surface)" stroke="var(--border)"/>
    <text x="12" y="20" fill="var(--muted)" font-size="9" letter-spacing="1">PROBETA (VISTA DE FRENTE)</text>

    <!-- metal base -->
    <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="3" fill="#b7b9bb" stroke="var(--border)" stroke-width="1"/>
    <!-- brillo metálico leve, fijo -->
    <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="3" fill="url(#crBrilloGrad)" opacity="${(0.35 * (1 - f)).toFixed(2)}"/>

    <!-- capa de óxido, opacidad proporcional a la pérdida de espesor acumulada -->
    <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="3" fill="rgb(${oxido.color})" opacity="${(f * CR_OXIDO_OPACIDAD_MAX).toFixed(2)}"/>

    <!-- picaduras ilustrativas (licencia visual, ver comentario en escena-corrosion.js) -->
    ${picadurasSvg}

    <defs>
      <linearGradient id="crBrilloGrad" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#ffffff" stop-opacity="0.55"/>
        <stop offset="0.5" stop-color="#ffffff" stop-opacity="0"/>
        <stop offset="1" stop-color="#ffffff" stop-opacity="0.25"/>
      </linearGradient>
    </defs>

    <text x="${DZ_CR_VB_W / 2}" y="${DZ_CR_VB_H - 8}" text-anchor="middle" fill="var(--muted)" font-size="9">oscurecimiento = pérdida de espesor real (Faraday/G102) · picaduras = licencia visual, no modelada</text>
  `;
}

let dzCrAnimando = false;
let dzCrAnimId = null;

function crEnvejecer() {
  if (dzCrAnimando) return;
  const svg = document.getElementById('cr_svg');
  if (!svg) return;

  const metalKey = document.getElementById('cr_metal').value;
  const metalData = CR_METAL_TABLE[metalKey];
  const icorr = parseFloat(document.getElementById('cr_icorr').value) || 0; // <input type=range>, estructuralmente numérico
  const tMax = parseFloat(document.getElementById('cr_tiempo').value) || 0; // ídem
  const CR = crCalcVelocidad(icorr, metalData.ew, metalData.rho); // mm/año, congelado al arrancar

  dzCrAnimando = true;
  const btn = document.getElementById('cr_btnEnvejecer');
  if (btn) btn.disabled = true;
  const label = document.getElementById('cr_anioLabel');

  const DUR_TOTAL = 2200; // ms de animación -- ilustrativo, sin relación con los años reales simulados
  const t0 = performance.now();

  function frame(now) {
    const el = now - t0;
    const fraction = Math.max(0, Math.min(1, el / DUR_TOTAL));
    const tSim = fraction * tMax;
    crDrawEscena(svg, fraction, metalKey);
    if (label) {
      label.textContent = isFinite(CR)
        ? `Año simulado: ${tSim.toFixed(1).replace('.',',')} / ${tMax} años — pérdida acumulada: ${(CR * tSim).toFixed(2).replace('.',',')} mm`
        : `Año simulado: ${tSim.toFixed(1).replace('.',',')} / ${tMax} años`;
    }
    if (el < DUR_TOTAL) {
      dzCrAnimId = requestAnimationFrame(frame);
    } else {
      dzCrAnimando = false;
      cancelAnimationFrame(dzCrAnimId);
      if (btn) btn.disabled = false;
      crUpdate(); // deja curva, métricas y escena en el estado final canónico
    }
  }
  dzCrAnimId = requestAnimationFrame(frame);
}

// corrosion.js — Módulo 4 "Ensayos complementarios", 3er ensayo (Grupo A):
// Corrosión — ley de Faraday, acotada a velocidad de corrosión GENERAL/uniforme
// (no picado, no intergranular). Fórmula de ASTM G102 (Standard Practice for
// Calculation of Corrosion Rates and Related Information from Electrochemical
// Measurements), que es la ley de Faraday reescrita en términos de icorr.
// tc/gc (colores de gráfico) y Chart vienen definidos/cargados globalmente antes que este archivo.

// FIX (v4.3): CR_METAL_TABLE con peso equivalente (EW=AW/n) y densidad REALES de
// cada metal -- valores de tabla periódica estándar (peso atómico, valencia usual
// de oxidación en corrosión acuosa) y densidades de manual de ingeniería, ambos
// datos de manual (no específicos de una única fuente como el k de Desgaste, pero
// tampoco inventados: son los mismos AW/n/ρ que trae la Tabla 1 de ASTM G102 para
// metales puros).
const CR_METAL_TABLE = {
  hierro:    { label: 'Hierro / acero al carbono (Fe, n=2)', ew: 27.92, rho: 7.87 },
  zinc:      { label: 'Zinc (Zn, n=2)',                       ew: 32.69, rho: 7.14 },
  aluminio:  { label: 'Aluminio (Al, n=3)',                   ew: 8.99,  rho: 2.70 },
  cobre:     { label: 'Cobre (Cu, n=2)',                      ew: 31.77, rho: 8.96 },
  niquel:    { label: 'Níquel (Ni, n=2)',                     ew: 29.35, rho: 8.90 },
  magnesio:  { label: 'Magnesio (Mg, n=2)',                   ew: 12.15, rho: 1.74 },
  titanio:   { label: 'Titanio (Ti, n=4)',                    ew: 11.97, rho: 4.51 },
};

// FIX (v4.3): constante K1 de ASTM G102 (Faraday's Law aplicada a icorr), tal cual
// figura en la Tabla 2 del estándar para obtener CR en mm/año con icorr en µA/cm²
// y densidad en g/cm³.
const CR_K1 = 3.27e-3; // mm·g / (µA·cm·año)

let crChartInst = null;

// Función pura, testeable desde el día 1: ley de Faraday (ASTM G102) para la
// velocidad de corrosión general/uniforme. icorr en µA/cm², EW en g/eq, rho en g/cm³.
function crCalcVelocidad(icorr, EW, rho) {
  if (!(rho > 0)) return NaN;
  return CR_K1 * icorr * EW / rho; // mm/año
}

function crInit() {
  crInitChart();
  crUpdate();
}

function crSetMetal() {
  // FIX (v4.3): al cambiar de metal, EW y ρ vienen fijos de la tabla (no son
  // ajustables por el alumno, a diferencia de la dureza en Desgaste, porque acá
  // sí son propiedades intrínsecas del metal elegido, no un parámetro de ensayo).
  crUpdate();
}

function crUpdate() {
  const metal = CR_METAL_TABLE[document.getElementById('cr_metal').value];
  const icorr = parseFloat(document.getElementById('cr_icorr').value) || 0;
  const tMax = parseFloat(document.getElementById('cr_tiempo').value) || 0;

  document.getElementById('cr_icorrVal').textContent = icorr + ' µA/cm²';
  document.getElementById('cr_tiempoVal').textContent = tMax + ' años';

  const CR = crCalcVelocidad(icorr, metal.ew, metal.rho); // mm/año
  document.getElementById('cr_mVelocidad').textContent = CR.toFixed(3).replace('.',',');
  document.getElementById('cr_mPerdida').textContent = (CR * tMax).toFixed(2).replace('.',',');

  const N = 60;
  const pts = [];
  for (let i = 0; i <= N; i++) {
    const t = tMax * i / N;
    pts.push({ x: t, y: CR * t });
  }
  crChartInst.data.datasets[0].data = pts;
  crChartInst.update();

  // FIX (prototipo post-v6.15): dibujo de la escena (placa + óxido +
  // picaduras ilustrativas) unificado en crDrawEscena(), que vive en
  // escena-corrosion.js (cargado después de este archivo -- seguro de
  // referenciar acá por el mismo motivo ya documentado entre
  // tensiones-residuales.js y escena-tensiones-residuales.js: recién se
  // EJECUTA cuando el usuario interactúa o desde crInit(), momento en el
  // que ambos scripts ya terminaron de cargar). En reposo (fuera de una
  // animación de "Simular envejecimiento") se dibuja directamente en el
  // estado final: fraction=1, es decir la placa tal como queda al cabo
  // del tiempo de exposición máximo elegido (cr_tiempo) -- mismo criterio
  // que trUpdate()/utUpdate().
  if (typeof crDrawEscena === 'function') crDrawEscena(document.getElementById('cr_svg'), 1, document.getElementById('cr_metal').value);
}

function crInitChart() {
  const ctx = document.getElementById('cr_chart').getContext('2d');
  crChartInst = new Chart(ctx, {
    type: 'line',
    data: { datasets: [
      { label: 'Pérdida de espesor', data: [], borderColor: '#1a8a5f', backgroundColor: 'rgba(26,138,95,.10)', borderWidth: 2, pointRadius: 0, tension: 0, fill: true }
    ] },
    options: {
      responsive: true, maintainAspectRatio: false, animation: { duration: 200 },
      plugins: {
        legend: { labels: { color: tc, font: { size: 11 } } },
        tooltip: { callbacks: { label: c => ` t=${c.parsed.x.toFixed(1).replace('.',',')} años → pérdida=${c.parsed.y.toFixed(2).replace('.',',')} mm` } }
      },
      scales: {
        x: { type: 'linear', title: { display: true, text: 'Tiempo (años)', color: tc, font: { size: 11 } }, grid: { color: gc }, ticks: { color: tc } },
        y: { title: { display: true, text: 'Pérdida de espesor (mm)', color: tc, font: { size: 11 } }, grid: { color: gc }, ticks: { color: tc } }
      }
    }
  });
}

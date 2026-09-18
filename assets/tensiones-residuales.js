// tensiones-residuales.js — Módulo 4 "Ensayos complementarios", 2do ensayo (Grupo A):
// Tensiones residuales — método del agujero (hole-drilling), ASTM E837 / roseta de 3 galgas
// a 0°/45°/90°, caso de tensión uniforme con la profundidad.
// tc/gc (colores de gráfico) y Chart vienen definidos/cargados globalmente antes que este archivo.

// FIX (v4.2): TR_CAL_TABLE con constantes de calibración A,B REALES para una roseta
// Tipo A (062RE/UL de Micro-Measurements = "Rosette Type A" en ASTM E837), agujero
// PASANTE con D0/D=0.35 -- tomadas de Vishay Measurements Group, Tech Note TN-503-6,
// "Measurement of Residual Stresses by the Hole-Drilling Strain Gage Method", sección
// "Determining Coefficients A and B" (calibración experimental sobre acero inoxidable
// AISI 304): A=-0.36×10⁻¹² Pa⁻¹, B=-0.94×10⁻¹² Pa⁻¹.
// NOTA HONESTA: la tabla 3 de ASTM E837 tiene más geometrías (distintos D0/D, roseta
// B y C, agujero ciego a distintas profundidades) pero la única copia que pude revisar
// llegó con el OCR de la tabla mezclado/ilegible -- preferí dejar UNA sola geometría
// bien verificada antes que 2-3 con números que no puedo garantizar. Si Agus consigue
// una copia limpia de esa tabla (o del Tech Note TN-503 con la Fig. 8), se puede sumar
// como cambio aislado sin tocar el resto de este archivo.
const TR_CAL_TABLE = {
  tipoA_pasante: {
    label: 'Roseta Tipo A (062RE/UL) — agujero pasante, D₀/D=0,35',
    A: -0.36e-12, // Pa⁻¹
    B: -0.94e-12, // Pa⁻¹
  },
};

let trChartInst = null;

// Función pura, testeable desde el día 1: resuelve las tensiones principales y su
// orientación a partir de las 3 deformaciones medidas (ε1 a 0°, ε2 a 45°, ε3 a 90°)
// y las constantes de calibración A, B (Pa⁻¹). Fórmulas de Vishay TN-503 / ASTM E837
// para tensión uniforme con la profundidad (deducidas y verificadas acá contra el
// caso de calibración uniaxial de la fuente antes de usarlas).
function trCalcTensiones(e1, e2, e3, A, B) {
  const prom = (e1 + e3) / (4 * A);
  const R = Math.sqrt(Math.pow(e1 - e3, 2) + Math.pow(2 * e2 - e1 - e3, 2)) / (4 * B);
  const sigmaMax = prom - R;
  const sigmaMin = prom + R;
  const betaRad = 0.5 * Math.atan2(e1 + e3 - 2 * e2, e3 - e1); // ángulo galga1→eje de σmax
  return { sigmaMax, sigmaMin, betaDeg: betaRad * 180 / Math.PI };
}

function trInit() {
  trInitChart();
  trUpdate();
}

function trUpdate() {
  const cal = TR_CAL_TABLE[document.getElementById('tr_cal').value];
  const e1 = parseFloat(document.getElementById('tr_e1').value) || 0; // µε
  const e2 = parseFloat(document.getElementById('tr_e2').value) || 0;
  const e3 = parseFloat(document.getElementById('tr_e3').value) || 0;

  document.getElementById('tr_e1Val').textContent = e1 + ' µε';
  document.getElementById('tr_e2Val').textContent = e2 + ' µε';
  document.getElementById('tr_e3Val').textContent = e3 + ' µε';

  const r = trCalcTensiones(e1 * 1e-6, e2 * 1e-6, e3 * 1e-6, cal.A, cal.B);
  const sigmaMaxMPa = r.sigmaMax / 1e6;
  const sigmaMinMPa = r.sigmaMin / 1e6;

  document.getElementById('tr_mSigmaMax').textContent = sigmaMaxMPa.toFixed(1).replace('.',',');
  document.getElementById('tr_mSigmaMin').textContent = sigmaMinMPa.toFixed(1).replace('.',',');
  document.getElementById('tr_mBeta').textContent = r.betaDeg.toFixed(1).replace('.',',');

  const centro = (sigmaMaxMPa + sigmaMinMPa) / 2;
  const radio = Math.abs(sigmaMaxMPa - sigmaMinMPa) / 2;
  const N = 72;
  const circulo = [];
  for (let i = 0; i <= N; i++) {
    const t = 2 * Math.PI * i / N;
    circulo.push({ x: centro + radio * Math.cos(t), y: radio * Math.sin(t) });
  }
  trChartInst.data.datasets[0].data = circulo;
  trChartInst.data.datasets[1].data = [{ x: sigmaMaxMPa, y: 0 }, { x: sigmaMinMPa, y: 0 }];
  trChartInst.update();

  // FIX (prototipo post-v6.9): dibujo de la escena (roseta + agujero)
  // unificado en trDrawEscena(), que vive en escena-tensiones-residuales.js
  // (cargado después de este archivo -- seguro de referenciar acá por el
  // mismo motivo ya documentado entre dureza-brinell.js e
  // indentador-brinell.js: recién se EJECUTA cuando el usuario interactúa o
  // desde trInit(), momento en el que ambos scripts ya terminaron de
  // cargar). En reposo (fuera de una animación de "Ensayar") se dibuja
  // directamente en el estado final: broca retraída (brocaProg=0), agujero
  // y las 3 lecturas ya reveladas (marcaProg=1) -- mismo criterio que
  // dzUpdateBrinell().
  if (typeof trDrawEscena === 'function') trDrawEscena(0, 1, e1, e2, e3);
}

function trInitChart() {
  const ctx = document.getElementById('tr_chart').getContext('2d');
  trChartInst = new Chart(ctx, {
    type: 'line',
    data: { datasets: [
      { label: 'Círculo de Mohr', data: [], borderColor: '#1a5fa8', pointRadius: 0, borderWidth: 2, showLine: true, fill: false, tension: 0 },
      { label: 'σ_max / σ_min', data: [], borderColor: '#c43535', backgroundColor: '#c43535', pointRadius: 5, showLine: false }
    ] },
    options: {
      responsive: true, maintainAspectRatio: false, animation: { duration: 200 },
      plugins: {
        legend: { labels: { color: tc, font: { size: 11 } } },
        tooltip: { callbacks: { label: c => ` σ=${c.parsed.x.toFixed(1).replace('.',',')} MPa, τ=${c.parsed.y.toFixed(1).replace('.',',')} MPa` } }
      },
      scales: {
        x: { type: 'linear', title: { display: true, text: 'Tensión normal σ (MPa)', color: tc, font: { size: 11 } }, grid: { color: gc }, ticks: { color: tc } },
        y: { title: { display: true, text: 'Tensión de corte τ (MPa)', color: tc, font: { size: 11 } }, grid: { color: gc }, ticks: { color: tc } }
      }
    }
  });
}

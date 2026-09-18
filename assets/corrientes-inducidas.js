// corrientes-inducidas.js — Módulo "Ensayo no destructivo" (Grupo B, v5.1):
// Corrientes inducidas (eddy current) — profundidad estándar de penetración,
// amplitud y fase de la señal vs. profundidad.
// tc/gc (colores de gráfico) y Chart vienen definidos/cargados globalmente antes
// que este archivo (mismo criterio que desgaste.js/fluencia.js).

// FIX (v5.1): ECT_METAL_TABLE con conductividad eléctrica REAL de 6 metales no
// ferromagnéticos, expresada en %IACS (International Annealed Copper Standard,
// ASTM E1004: 100% IACS = 58 MS/m a 20°C) y convertida a S/m.
// Fuentes: cobre y aluminio puro — tabla de referencia de conductividad de
// Eddy Current Technology Inc. (ECTM/NDT Mag, recopilada en nde-ed.org);
// aluminio 6061-T6 (40-43% IACS) y latón 70/30 (25-37% IACS, se tomó punto
// medio ~28%) — rangos de manual de ingeniería de aleaciones de aluminio y
// cobre; acero inoxidable austenítico 304/316 (2-3% IACS) — valor citado en
// literatura de componentes eléctricos no magnéticos; titanio Ti-6Al-4V
// (~1% IACS) — Cardarelli, "Materials Handbook", tabla de conductividad de
// aleaciones de titanio.
// IMPORTANTE (acotación de alcance): esta primera versión asume μr=1 (metal
// NO ferromagnético) para los 6 materiales de la tabla. Metales ferromagnéticos
// (acero al carbono, aceros inoxidables ferríticos/martensíticos) tienen
// μr≫1 y una profundidad de penetración mucho menor a igual frecuencia y
// conductividad -- fuera del alcance de esta versión (no hay una tabla de μr
// tan estandarizada bibliográficamente como la de %IACS, y mezclar ambos
// efectos en un solo selector sería confuso para una primera versión).
const ECT_METAL_TABLE = {
  cobre:        { label: 'Cobre electrolítico (Cu-ETP)',              iacs: 100.0 },
  aluminio:     { label: 'Aluminio puro (serie 1100)',                iacs: 61.0  },
  aluminio6061: { label: 'Aluminio 6061-T6',                          iacs: 41.5  },
  laton:        { label: 'Latón 70/30 (cartucho)',                    iacs: 28.0  },
  aceroinox:    { label: 'Acero inoxidable austenítico (304/316)',    iacs: 2.5   },
  titanio:      { label: 'Titanio Ti-6Al-4V',                         iacs: 1.0   },
};

// Conductividad del cobre recocido (ASTM E1004, 100% IACS), en S/m.
const ECT_SIGMA_CU_100IACS = 58e6;
// Permeabilidad magnética del vacío (H/m).
const ECT_MU0 = 4 * Math.PI * 1e-7;

function ectSigmaSm(iacs) {
  return (iacs / 100) * ECT_SIGMA_CU_100IACS;
}

let ectChartInst = null;

/* ---------------- FÓRMULAS PURAS (testeables desde el día 1) ---------------- */

// Profundidad estándar de penetración δ = 1/√(π·f·μ0·μr·σ) — ecuación clásica
// de eddy current testing (ver ASNT NDT Handbook / Hagemaier, "Fundamentals of
// Eddy Current Testing"). f en Hz, sigma en S/m, mur adimensional (=1 para
// metales no ferromagnéticos). Devuelve δ en mm.
function ectCalcDeltaMm(f_Hz, sigma_Sm, mur) {
  if (!(f_Hz > 0) || !(sigma_Sm > 0) || !(mur > 0)) return NaN;
  const delta_m = 1 / Math.sqrt(Math.PI * f_Hz * ECT_MU0 * mur * sigma_Sm);
  return delta_m * 1000;
}

// Amplitud relativa de la señal a una profundidad x (0-1, normalizada a la
// superficie x=0). Decaimiento exponencial con la profundidad medida en
// unidades de δ: A(x) = A0·e^(-x/δ).
function ectAmplitudRel(x_mm, delta_mm) {
  if (!(delta_mm > 0) || !(x_mm >= 0)) return NaN;
  return Math.exp(-x_mm / delta_mm);
}

// Fase de la señal a una profundidad x, en grados, relativa a la superficie
// (retraso de fase lineal con la profundidad medida en unidades de δ):
// φ(x) = (x/δ)·(180/π).
function ectFaseGrados(x_mm, delta_mm) {
  if (!(delta_mm > 0) || !(x_mm >= 0)) return NaN;
  return (x_mm / delta_mm) * (180 / Math.PI);
}

/* ---------------- UI ---------------- */

// FIX v5.9 (backlog punto C): muestra/oculta el input crudo de σ cuando el
// material es "Otro" -- ectCalcDeltaMm ya recibe sigma_Sm como parámetro
// puro, así que esto es pura UI, no toca la física.
function ectMetalToggle() {
  const custom = document.getElementById('ect_metal').value === 'otro';
  document.getElementById('ect_sigmaCustomWrap').style.display = custom ? '' : 'none';
  ectUpdate();
}

function ectUpdate() {
  const metalKey = document.getElementById('ect_metal').value;
  let sigma_Sm;
  if (metalKey === 'otro') {
    const iacsCustom = parseFloat(document.getElementById('ect_sigmaCustom').value);
    sigma_Sm = (iacsCustom > 0) ? ectSigmaSm(iacsCustom) : NaN;
  } else {
    sigma_Sm = ectSigmaSm(ECT_METAL_TABLE[metalKey].iacs);
  }
  const f_Hz = parseFloat(document.getElementById('ect_freq').value) || 0;
  const mur = 1; // acotado a metales no ferromagnéticos, ver comentario de ECT_METAL_TABLE

  const delta_mm = ectCalcDeltaMm(f_Hz, sigma_Sm, mur);
  const efectiva_mm = 3 * delta_mm; // "profundidad efectiva de inspección" (convención habitual en ECT: a 3δ la señal cayó a e⁻³≈5%, ~95% de las corrientes inducidas circulan por encima)

  document.getElementById('ect_mDelta').textContent = isFinite(delta_mm) ? delta_mm.toFixed(3).replace('.',',') : '—';
  document.getElementById('ect_mEfectiva').textContent = isFinite(efectiva_mm) ? efectiva_mm.toFixed(3).replace('.',',') : '—';
  document.getElementById('ect_mSigma').textContent = isFinite(sigma_Sm) ? (sigma_Sm / 1e6).toFixed(1).replace('.',',') : '—';

  const N = 60;
  const ampPts = [];
  const fasePts = [];
  const xMax = (isFinite(efectiva_mm) && efectiva_mm > 0) ? efectiva_mm : 0;
  for (let i = 0; i <= N; i++) {
    const x = xMax * i / N;
    ampPts.push({ x: x, y: ectAmplitudRel(x, delta_mm) * 100 });
    fasePts.push({ x: x, y: ectFaseGrados(x, delta_mm) });
  }
  ectChartInst.data.datasets[0].data = ampPts;
  ectChartInst.data.datasets[1].data = fasePts;
  ectChartInst.options.scales.x.max = xMax > 0 ? xMax : 10;
  ectChartInst.update();
}

function ectInitChart() {
  const ctx = document.getElementById('ect_chart').getContext('2d');
  ectChartInst = new Chart(ctx, {
    type: 'line',
    data: {
      datasets: [
        { label: 'Amplitud relativa (%)', data: [], borderColor: '#1a5fa8', backgroundColor: 'rgba(26,95,168,.10)', borderWidth: 2, pointRadius: 0, tension: 0, fill: true, yAxisID: 'y' },
        { label: 'Fase (°)', data: [], borderColor: '#c0392b', backgroundColor: 'rgba(192,57,43,.06)', borderWidth: 2, pointRadius: 0, tension: 0, fill: false, borderDash: [5, 3], yAxisID: 'y1' }
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false, animation: { duration: 200 },
      plugins: {
        legend: { labels: { color: tc, font: { size: 11 } } },
        tooltip: { callbacks: { label: c => `${c.dataset.label}: ${c.parsed.y.toFixed(1).replace('.',',')}${c.datasetIndex === 0 ? '%' : '°'} a ${c.parsed.x.toFixed(2).replace('.',',')} mm` } }
      },
      scales: {
        x: { type: 'linear', title: { display: true, text: 'Profundidad x (mm)', color: tc, font: { size: 11 } }, grid: { color: gc }, ticks: { color: tc } },
        y: { position: 'left', min: 0, max: 100, title: { display: true, text: 'Amplitud relativa (%)', color: tc, font: { size: 11 } }, grid: { color: gc }, ticks: { color: tc } },
        y1: { position: 'right', min: 0, title: { display: true, text: 'Fase (°)', color: tc, font: { size: 11 } }, grid: { drawOnChartArea: false }, ticks: { color: tc } }
      }
    }
  });
}

function ectInit() {
  ectInitChart();
  ectUpdate();
}

/* ---------------- FICHA DE LABORATORIO (backlog punto D, v5.10) ---------------- */

function showFichaECT() {
  const metalSel = document.getElementById('ect_metal');
  const metalLabel = metalSel.value === 'otro'
    ? `Personalizado (σ = ${document.getElementById('ect_sigmaCustom').value || '—'} %IACS)`
    : metalSel.options[metalSel.selectedIndex].text;
  const freqLabel = document.getElementById('ect_freq').selectedOptions[0].text;

  fichaNDTRender({
    titulo: 'Informe de Ensayo por Corrientes Inducidas (Eddy Current)',
    secciones: [
      { titulo: 'Configuración del ensayo', filas: [
        ['Material', metalLabel],
        ['Frecuencia de excitación f', freqLabel],
      ] },
      { titulo: 'Resultados', filas: [
        ['Conductividad σ', fichaConUnidad(document.getElementById('ect_mSigma').textContent, 'MS/m')],
        ['Profundidad estándar δ', fichaConUnidad(document.getElementById('ect_mDelta').textContent, 'mm')],
        ['Profundidad efectiva 3δ', fichaConUnidad(document.getElementById('ect_mEfectiva').textContent, 'mm')],
      ] },
    ],
    imagenHtml: fichaImgDesdeCanvas('ect_chart'),
    imagenTitulo: 'Amplitud relativa y fase vs. profundidad',
    notaFinal: 'Válido solo para metales no ferromagnéticos (μr≈1). Ver el panel interactivo para el detalle completo de alcance y fuentes bibliográficas (ASTM E1004).',
  });
}

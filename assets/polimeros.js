// polimeros.js — Módulo 4 "Ensayos complementarios", 4to ensayo (Grupo A, último):
// Polímeros — acotado a la curva DMA (Dynamic Mechanical Analysis) del módulo de
// almacenamiento E' vs. temperatura, mostrando la transición vítrea. No incluye
// tan δ ni el módulo de pérdida E'' -- queda para una fase futura si hace falta.
// tc/gc (colores de gráfico) y Chart vienen definidos/cargados globalmente antes que este archivo.

// FIX (v4.4): PO_POLIMERO_TABLE con temperatura de transición vítrea (Tg) REAL de
// cada polímero (valores estándar de manual de ingeniería de polímeros, ver
// comentario de cada uno). Los módulos "eg" (vítreo) y "er" (mesa gomosa) son
// órdenes de magnitud TÍPICOS de una curva DMA (GPa en la zona vítrea, MPa en la
// mesa gomosa) -- mismo criterio que la dureza por defecto en Desgaste: ilustrativos,
// no atados a una fuente puntual, ajustables si hiciera falta en el futuro.
const PO_POLIMERO_TABLE = {
  caucho:  { label: 'Caucho natural vulcanizado', tg: -70,  eg: 1.5e9, er: 1e6  }, // Tg típica de NR
  nylon6:  { label: 'Nylon 6 (poliamida, seco)',  tg: 50,   eg: 2.0e9, er: 10e6 }, // Tg amorfa, nylon 6 seco
  pvc:     { label: 'PVC rígido',                 tg: 80,   eg: 2.5e9, er: 3e6  },
  ps:      { label: 'Poliestireno (PS)',           tg: 100,  eg: 3.2e9, er: 2e6  },
  pmma:    { label: 'PMMA (acrílico)',             tg: 105,  eg: 3.0e9, er: 5e6  },
  epoxi:   { label: 'Epoxi curado (formulación típica)', tg: 120, eg: 2.8e9, er: 15e6 },
  pc:      { label: 'Policarbonato (PC)',          tg: 150,  eg: 2.3e9, er: 8e6  },
};

let poChartInst = null;

// Función pura, testeable desde el día 1: modelo sigmoideo de la curva DMA
// (transición vítrea centrada en Tg, ancho w). No es el modelo WLF completo de
// superposición tiempo-temperatura -- es la versión "acotada para arrancar" que
// pidió Agus, suficiente para mostrar la caída de E' alrededor de Tg.
function poCalcModulo(T, Tg, Eg, Er, w) {
  if (!(w > 0)) return NaN;
  return Er + (Eg - Er) / (1 + Math.exp((T - Tg) / w));
}

function poInit() {
  poInitChart();
  poUpdate();
}

function poUpdate() {
  const pol = PO_POLIMERO_TABLE[document.getElementById('po_polimero').value];
  const T = parseFloat(document.getElementById('po_temp').value) || 0;
  const w = parseFloat(document.getElementById('po_ancho').value) || 10;

  document.getElementById('po_tempVal').textContent = T + ' °C';
  document.getElementById('po_anchoVal').textContent = w + ' °C';

  const Ep = poCalcModulo(T, pol.tg, pol.eg, pol.er, w);
  document.getElementById('po_mTg').textContent = pol.tg;
  document.getElementById('po_mModulo').textContent = (Ep / 1e6).toFixed(1).replace('.',',');

  const N = 100;
  const tMin = pol.tg - 80, tMax = pol.tg + 80;
  const pts = [];
  for (let i = 0; i <= N; i++) {
    const t = tMin + (tMax - tMin) * i / N;
    pts.push({ x: t, y: poCalcModulo(t, pol.tg, pol.eg, pol.er, w) / 1e6 }); // MPa
  }
  poChartInst.data.datasets[0].data = pts;
  // FIX #83 (hallazgo QA v6.21, Etapa 24): el eje X no tenía min/max fijos,
  // así que cuando el "punto actual" caía fuera de la ventana graficada
  // (Tg±80°C) -- alcanzable con cualquiera de los 7 polímeros, ya que el
  // slider de temperatura comparte un rango fijo de -150 a 230°C mucho más
  // ancho que esa ventana -- Chart.js reescalaba todo el eje para incluir
  // ese punto lejano, comprimiendo la curva de transición real (la parte
  // pedagógicamente importante) en una fracción mínima del gráfico. Se fija
  // el rango del eje a la ventana de la curva y se clampea la posición
  // dibujada del punto a ese mismo rango -- el valor de E' que se muestra en
  // el texto y en el tooltip sigue siendo el real, sin clampear.
  poChartInst.options.scales.x.min = tMin;
  poChartInst.options.scales.x.max = tMax;
  const Tclampeado = Math.max(tMin, Math.min(tMax, T));
  poChartInst.data.datasets[1].data = [{ x: Tclampeado, y: Ep / 1e6 }];
  poChartInst.update();
}

function poInitChart() {
  const ctx = document.getElementById('po_chart').getContext('2d');
  poChartInst = new Chart(ctx, {
    type: 'line',
    data: { datasets: [
      { label: "E' (módulo de almacenamiento)", data: [], borderColor: '#7a3fa8', backgroundColor: 'rgba(122,63,168,.08)', borderWidth: 2, pointRadius: 0, tension: 0, fill: true },
      { label: 'Punto actual', data: [], borderColor: '#c43535', backgroundColor: '#c43535', pointRadius: 5, showLine: false }
    ] },
    options: {
      responsive: true, maintainAspectRatio: false, animation: { duration: 200 },
      plugins: {
        legend: { labels: { color: tc, font: { size: 11 } } },
        tooltip: { callbacks: { label: c => ` T=${c.parsed.x.toFixed(0)}°C → E'=${c.parsed.y.toFixed(1).replace('.',',')} MPa` } }
      },
      scales: {
        x: { type: 'linear', title: { display: true, text: 'Temperatura (°C)', color: tc, font: { size: 11 } }, grid: { color: gc }, ticks: { color: tc } },
        y: { type: 'logarithmic', title: { display: true, text: "E' — módulo de almacenamiento (MPa, escala log)", color: tc, font: { size: 11 } }, grid: { color: gc }, ticks: { color: tc } }
      }
    }
  });
}

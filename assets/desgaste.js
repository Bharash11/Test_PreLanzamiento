// desgaste.js — Módulo 4 "Ensayos complementarios", 1er ensayo (Grupo A, bajo costo):
// Desgaste/tribología — ley de Archard (V = k·F·d/H).
// tc/gc (colores de gráfico) y Chart vienen definidos/cargados globalmente antes que este archivo
// (mismo criterio que fluencia.js).

// FIX (v4.1): DS_K_TABLE con coeficientes de desgaste k REALES -- tomados de Archard & Hirst
// (1956), "The wear of metals under unlubricated conditions", Proc. R. Soc. London A 236,
// según se reproducen en la tabla resumen del artículo "Wear coefficient" (ensayos pin-on-disk
// sin lubricar, material listado deslizando contra un disco de acero). k es adimensional.
// Los valores de dureza "hb" son órdenes de magnitud TÍPICOS de manual de ingeniería para cada
// material (punto de partida razonable, no un dato bibliográfico atado a la fuente de k) --
// el alumno los puede ajustar libremente con el control deslizante de dureza.
const DS_K_TABLE = {
  polietileno: { label: 'Polietileno – Acero',                  k: 1.3e-7, hb: 2   },
  pmma:        { label: 'PMMA (acrílico) – Acero',              k: 7e-6,   hb: 20  },
  inoxferr:    { label: 'Acero inoxidable ferrítico – Acero',   k: 1.7e-5, hb: 200 },
  ptfe:        { label: 'PTFE (teflón) – Acero',                k: 2.5e-5, hb: 5   },
  cube:        { label: 'Cobre-berilio – Acero',                k: 3.7e-5, hb: 200 },
  toolsteel:   { label: 'Acero de herramienta templado – Acero', k: 1.3e-4, hb: 600 },
  laton:       { label: 'Latón (α/β) – Acero',                  k: 6e-4,   hb: 100 },
  aceroacero:  { label: 'Acero dulce – Acero dulce',             k: 7e-3,   hb: 120 },
};

let dsChartInst = null;

// FIX (v4.1): cmSwitch es el sub-nav de TODA la pestaña "Ensayos complementarios"
// (análogo a dzSwitch/edSwitch/rtSwitch), no algo específico de desgaste -- vive
// acá por ahora porque desgaste.js es el único script de esta pestaña. Cuando entre
// el 2do ensayo del Grupo A convendría moverla a un "complementarios-shared.js",
// mismo criterio que ya se usó con dureza-shared.js.
// FIX #38 (hallazgo Etapa 2 QA v5.14, mismo patrón que dzScopeRoot/edScopeRoot
// en dureza-shared.js): cm se comparte entre "Caracterización y microscopía"
// (Metalografía) y "Degradación y comportamiento en servicio" (Desgaste,
// Tensiones residuales, Corrosión, Polímeros) desde la reorganización de
// v5.14 -- antes vivían en la misma pestaña "Ensayos complementarios", así
// que un solo querySelectorAll sin acotar no traía problema. Ahora sí.
function cmScopeRoot(){
  const carac = document.getElementById('tab-caracterizacion');
  if (carac && carac.classList.contains('active')) return carac;
  return document.getElementById('tab-degradacion') || document;
}
function cmSwitch(name) {
  const root = cmScopeRoot();
  root.querySelectorAll('.cm-subbtn').forEach(b => b.classList.toggle('active', b.dataset.cm === name));
  root.querySelectorAll('.cm-sub-panel').forEach(p => p.classList.toggle('active', p.id === 'cm_panel_' + name));
  root.querySelectorAll('.cm-sub-ctrl').forEach(c => c.classList.toggle('active', c.id === 'cm_ctrl_' + name));
}

// Función pura, testeable desde el día 1: ley de Archard V = k·F·d/H.
// Unidades consistentes: F en N, d en m, H en Pa → V en m³.
function dsCalcVolumen(k, F, d, H) {
  if (!(H > 0)) return NaN;
  return k * F * d / H;
}

function dsInit() {
  dsInitChart();
  dsUpdate();
}

// FIX (v4.1): al cambiar el par de materiales, la dureza por defecto salta al
// valor típico de ese material (mismo criterio de UX que FL_MAT_PRESETS en
// fluencia.js) -- el alumno la sigue pudiendo ajustar a mano después.
function dsSetPar() {
  const par = DS_K_TABLE[document.getElementById('ds_par').value];
  document.getElementById('ds_dureza').value = par.hb;
  dsUpdate();
}

function dsUpdate() {
  const par = DS_K_TABLE[document.getElementById('ds_par').value];
  const F = parseFloat(document.getElementById('ds_fuerza').value) || 0;
  const hb = parseFloat(document.getElementById('ds_dureza').value) || 1;
  const dMax = parseFloat(document.getElementById('ds_distancia').value) || 0;

  document.getElementById('ds_fuerzaVal').textContent = F + ' N';
  document.getElementById('ds_durezaVal').textContent = hb + ' HB';
  document.getElementById('ds_distanciaVal').textContent = dMax + ' m';

  const H_pa = hb * 9.80665e6; // conversión dureza Brinell (kgf/mm²) → Pa
  const V = dsCalcVolumen(par.k, F, dMax, H_pa);

  // FIX #63 (hallazgo QA v6.16, M53-01 -- extensión): mismo problema que
  // .toFixed(), pero con .toExponential(). "1.23e-5" también tiene un punto
  // en la mantisa que debía pasar a coma ("1,23e-5") para ser consistente
  // con el resto de los resultados numéricos del simulador.
  document.getElementById('ds_mK').textContent = par.k.toExponential(1).replace('.',',');
  document.getElementById('ds_mVolumen').textContent = isFinite(V) ? (V * 1e9).toExponential(2).replace('.',',') : '—'; // mm³

  const N = 60;
  const pts = [];
  for (let i = 0; i <= N; i++) {
    const d = dMax * i / N;
    pts.push({ x: d, y: dsCalcVolumen(par.k, F, d, H_pa) * 1e9 }); // mm³
  }
  dsChartInst.data.datasets[0].data = pts;
  dsChartInst.update();

  // FIX (prototipo post-v6.17): dibujo de la escena (corte transversal +
  // ranura + pin deslizante) unificado en dsDrawEscena(), que vive en
  // escena-desgaste.js (cargado después de este archivo -- seguro de
  // referenciar acá por el mismo motivo ya documentado entre
  // tensiones-residuales.js y escena-tensiones-residuales.js: recién se
  // EJECUTA cuando el usuario interactúa o desde dsInit(), momento en el
  // que ambos scripts ya terminaron de cargar). En reposo (fuera de una
  // animación de "Simular deslizamiento") se dibuja directamente en el
  // estado final: fraction=1, es decir la ranura tal como queda al cabo
  // de la distancia recorrida máxima elegida (ds_distancia) -- mismo
  // criterio que trUpdate()/utUpdate()/crUpdate().
  if (typeof dsDrawEscena === 'function') dsDrawEscena(document.getElementById('ds_svg'), 1, par.k, F, dMax, H_pa);
}

function dsInitChart() {
  const ctx = document.getElementById('ds_chart').getContext('2d');
  dsChartInst = new Chart(ctx, {
    type: 'line',
    data: { datasets: [
      { label: 'Volumen desgastado', data: [], borderColor: '#1a5fa8', backgroundColor: 'rgba(26,95,168,.10)', borderWidth: 2, pointRadius: 0, tension: 0, fill: true }
    ] },
    options: {
      responsive: true, maintainAspectRatio: false, animation: { duration: 200 },
      plugins: {
        legend: { labels: { color: tc, font: { size: 11 } } },
        tooltip: { callbacks: { label: c => ` d=${c.parsed.x.toFixed(0).replace('.',',')} m → V=${c.parsed.y.toExponential(2).replace('.',',')} mm³` } }
      },
      scales: {
        x: { type: 'linear', title: { display: true, text: 'Distancia recorrida (m)', color: tc, font: { size: 11 } }, grid: { color: gc }, ticks: { color: tc } },
        y: { title: { display: true, text: 'Volumen desgastado V (mm³)', color: tc, font: { size: 11 } }, grid: { color: gc }, ticks: { color: tc } }
      }
    }
  });
}

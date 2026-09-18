// radiografia.js — Módulo "Ensayo no destructivo" (Grupo B, v5.4):
// Radiografía industrial — atenuación de rayos gamma (Beer-Lambert) a partir
// de la capa hemirreductora (HVL) de cada material, y una "placa" simulada
// (degradé + mancha oscura representando el defecto) dibujada en canvas.

// FIX (v5.4): RX_MATERIAL_TABLE con la capa hemirreductora (HVL, Half-Value
// Layer) REAL para la fuente gamma industrial más común, Ir-192 (energía
// efectiva ~380 keV, rango de uso típico 10-90mm de acero según ISO
// 5579:2013). Se fija UNA sola fuente para arrancar (mismo criterio que usó
// Tensiones residuales con hole-drilling en v4.2: "elegir un solo método
// para arrancar") -- otras fuentes (Co-60, tubos de rayos X) quedan fuera de
// esta versión. Fuentes: acero y plomo -- tabla de HVL de Wikipedia (citando
// la fuente radiactiva Ir-192, consistente con la regla práctica "0,5
// pulgadas de acero" citada en material de entrenamiento de la NRC de
// EE.UU.); tungsteno -- misma tabla de Wikipedia; aluminio -- calculadora de
// blindaje radprocalculator.com, citada en un foro de NDT.net (no es una
// norma primaria, es la mejor referencia práctica disponible para este par
// fuente/material -- se aclara en la nota de la UI).
const RX_MATERIAL_TABLE = {
  acero:      { label: 'Acero (fuente Ir-192)',      hvl: 12.7 },
  aluminio:   { label: 'Aluminio (fuente Ir-192)',    hvl: 85.0 },
  plomo:      { label: 'Plomo (fuente Ir-192)',       hvl: 4.8  },
  tungsteno:  { label: 'Tungsteno (fuente Ir-192)',   hvl: 3.3  },
};

/* ---------------- FÓRMULAS PURAS (testeables desde el día 1) ---------------- */

// Coeficiente de atenuación lineal μ (mm⁻¹) a partir de la capa
// hemirreductora: μ = ln(2)/HVL -- por definición, μ·HVL = ln(2) siempre.
function rxCalcMu(hvl_mm) {
  if (!(hvl_mm > 0)) return NaN;
  return Math.LN2 / hvl_mm;
}

// Transmisión I/I0 a través de un espesor dado (ley de Beer-Lambert).
function rxCalcTransmision(espesor_mm, mu) {
  if (!(espesor_mm >= 0) || !(mu >= 0)) return NaN;
  return Math.exp(-mu * espesor_mm);
}

// Relación de intensidad transmitida en la zona con defecto (menos espesor,
// pérdida_mm) respecto de la zona sana: I_defecto/I_sano = e^(μ·pérdida).
// Siempre ≥1 (la zona con defecto deja pasar más radiación).
function rxCalcRatioDefecto(mu, perdida_mm) {
  if (!(mu >= 0) || !(perdida_mm >= 0)) return NaN;
  return Math.exp(mu * perdida_mm);
}

/* ---------------- DIBUJO DE LA "PLACA" (canvas 2D, degradé + mancha) ---------------- */

// Dibuja la placa: fondo gris parejo (zona sana) + viñeta sutil (caída
// geométrica de intensidad hacia los bordes, común en radiografías reales) +
// una mancha oscura con degradé radial (penumbra por desenfoque geométrico
// del foco) si hay defecto. baseGray/defectGray en 0-255 (0=negro=máxima
// exposición, 255=blanco=mínima exposición -- convención de placa revelada:
// a MÁS radiación transmitida, MÁS oscura queda la placa).
function rxDrawPlaca(canvas, baseGray, defectGray, hayDefecto) {
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  ctx.clearRect(0, 0, W, H);

  ctx.fillStyle = `rgb(${baseGray},${baseGray},${Math.min(255, baseGray + 4)})`;
  ctx.fillRect(0, 0, W, H);

  const vg = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.2, W / 2, H / 2, Math.max(W, H) * 0.72);
  vg.addColorStop(0, 'rgba(0,0,0,0)');
  vg.addColorStop(1, 'rgba(0,0,0,0.22)');
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, W, H);

  if (hayDefecto) {
    const cx = W / 2, cy = H / 2, r = Math.min(W, H) * 0.24;
    const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    grad.addColorStop(0, `rgb(${defectGray},${defectGray},${defectGray})`);
    grad.addColorStop(0.65, `rgb(${defectGray},${defectGray},${defectGray})`);
    grad.addColorStop(1, `rgba(${defectGray},${defectGray},${defectGray},0)`);
    ctx.fillStyle = grad;
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
  }
}

/* ---------------- UI ---------------- */

// ACOTACIÓN DE ALCANCE (a propósito, mismo criterio que Ultrasonido en
// v5.2): esta versión modela correctamente la TRANSMISIÓN relativa de
// radiación (ley de Beer-Lambert, μ real por material vía su HVL), que es
// la física central del ensayo. Lo que NO modela es la conversión de esa
// transmisión a densidad óptica real de la placa -- eso depende de la curva
// característica (H&D) de cada película/detector digital y de la técnica de
// exposición (tiempo, distancia, actividad de la fuente), que quedan fuera
// de esta versión. El gris de fondo (RX_BASE_GRAY) es un valor ilustrativo
// fijo, y el oscurecimiento de la mancha es proporcional a (ratio-1) con una
// escala elegida para que el contraste se vea bien en pantalla, no una
// curva de densidad real.
const RX_BASE_GRAY = 190; // gris base ilustrativo de la zona sana

// FIX v5.8 (backlog punto B, "Modo desafío"): mismo patrón que Ultrasonido
// (ver UT_DESAFIO en ultrasonido.js). Acá "perdida" reemplaza al slider real
// rx_perdida mientras activo=true, generada una vez por "Nuevo desafío" con
// mdValorEnRango dentro del mismo rango [0, rx_perdida.max] ya validado.
let RX_DESAFIO = { activo: false, seed: null, perdida: null, revelado: false };

// FIX v5.9 (backlog punto C): muestra/oculta el input crudo de HVL cuando
// el material es "Otro". rxCalcMu ya toma hvl_mm como parámetro puro.
function rxMaterialToggle() {
  const custom = document.getElementById('rx_material').value === 'otro';
  document.getElementById('rx_hvlCustomWrap').style.display = custom ? '' : 'none';
  rxUpdate();
}

function rxModoToggle() {
  const desafio = document.getElementById('rx_modo').value === 'desafio';
  RX_DESAFIO.activo = desafio;
  document.getElementById('rx_camposDefecto').style.display = desafio ? 'none' : '';
  document.getElementById('rx_camposDesafio').style.display = desafio ? '' : 'none';
  document.getElementById('rx_desafioResultado').style.display = 'none';
  if (desafio) {
    rxDesafioNuevo();
  } else {
    RX_DESAFIO.revelado = false;
    rxUpdate();
  }
}

function rxDesafioNuevo(seedOverride) {
  const espesor = parseFloat(document.getElementById('rx_espesor').value) || 0;
  const perdidaSlider = document.getElementById('rx_perdida');
  // FIX v5.12 (backlog punto F): mismo patrón que utDesafioNuevo -- acepta
  // una semilla explícita para reproducir un desafío compartido por enlace.
  const seed = (seedOverride != null) ? seedOverride : mdNuevaSemilla();

  const minPerdida = Math.max(parseFloat(perdidaSlider.min) || 0, 1);
  const maxPerdida = Math.max(minPerdida, Math.min(parseFloat(perdidaSlider.max) || espesor, espesor - 1));
  const stepPerdida = parseFloat(perdidaSlider.step) || 1;

  RX_DESAFIO.seed = seed;
  RX_DESAFIO.perdida = mdValorEnRango(seed, minPerdida, maxPerdida, stepPerdida);
  RX_DESAFIO.revelado = false;

  document.getElementById('rx_estPerdida').value = '';
  document.getElementById('rx_desafioResultado').style.display = 'none';
  document.getElementById('rx_btnRevelar').disabled = false;
  rxUpdate();
}

function rxDesafioRevelar() {
  if (!RX_DESAFIO.activo) return;
  const estimacion = parseFloat(document.getElementById('rx_estPerdida').value);
  const real = RX_DESAFIO.perdida;
  RX_DESAFIO.revelado = true;

  document.getElementById('rx_desafioResultado').style.display = '';
  document.getElementById('rx_rReal').textContent = real.toFixed(1).replace('.',',') + ' mm';
  document.getElementById('rx_rEstimacion').textContent = isFinite(estimacion) ? estimacion.toFixed(1).replace('.',',') + ' mm' : '(sin estimación)';
  document.getElementById('rx_rDif').textContent = isFinite(estimacion) ? Math.abs(estimacion - real).toFixed(1).replace('.',',') + ' mm' : '—';
  document.getElementById('rx_rMsg').textContent = mdMensajeResultado(estimacion, real, 'mm', 'la relación de transmisión defecto/sano y la ley de Beer-Lambert (I_defecto/I_sano = e^(μ·pérdida))');

  rxUpdate(); // redibuja mostrando ahora el valor real, ya revelado
}

function rxUpdate() {
  const materialKey = document.getElementById('rx_material').value;
  // FIX #85 (hallazgo QA v6.21, Etapa 28): mismo patrón que UT27-01/FIX #84
  // en Ultrasonido -- "parseFloat(...)||NaN" no atrapa un HVL NEGATIVO
  // tipeado (ej. "-10" es *truthy* en JS). rxCalcMu() sí valida hvl>0 y
  // devuelve NaN correctamente, así que μ/transmisión/ratio ya mostraban
  // "—" bien -- pero ratio=NaN se colaba sin chequeo al color de la
  // "mancha" del defecto: `rgb(${defectGray},${defectGray},${defectGray})`
  // con defectGray=NaN da literalmente "rgb(NaN,NaN,NaN)", un color CSS
  // inválido que el canvas ignora en silencio (queda pintado con el último
  // fillStyle válido). Se valida explícitamente hvl>0 acá para que el
  // problema ni siquiera llegue a esa parte del cálculo.
  const hvlCustomRaw = parseFloat(document.getElementById('rx_hvlCustom').value);
  const hvl = (materialKey === 'otro')
    ? (isFinite(hvlCustomRaw) && hvlCustomRaw>0 ? hvlCustomRaw : NaN)
    : RX_MATERIAL_TABLE[materialKey].hvl;
  const espesor = parseFloat(document.getElementById('rx_espesor').value) || 0;

  const perdida = RX_DESAFIO.activo
    ? (RX_DESAFIO.perdida || 0)
    : (parseFloat(document.getElementById('rx_perdida').value) || 0);

  document.getElementById('rx_espesorVal').textContent = espesor + ' mm';
  if (!RX_DESAFIO.activo) {
    document.getElementById('rx_perdidaVal').textContent = perdida > 0 ? perdida + ' mm' : 'sin defecto';
  }

  const hayDefecto = perdida > 0 && perdida < espesor;
  const avisoEl = document.getElementById('rx_avisoDefecto');
  avisoEl.style.display = (!RX_DESAFIO.activo && perdida > 0 && !hayDefecto) ? 'block' : 'none';

  const mu = rxCalcMu(hvl);
  const transmisionSana = rxCalcTransmision(espesor, mu);
  const ratio = hayDefecto ? rxCalcRatioDefecto(mu, perdida) : 1;

  // FIX v5.8: mientras el desafío está activo y sin revelar, se oculta la
  // relación defecto/sano -- mostrarla sería regalar la respuesta, porque
  // pérdida = ln(ratio)/μ con μ ya visible arriba en "Coeficiente μ".
  const mostrarDefecto = !RX_DESAFIO.activo || RX_DESAFIO.revelado;

  document.getElementById('rx_mMu').textContent = isFinite(mu) ? mu.toFixed(4).replace('.',',') : '—';
  document.getElementById('rx_mTransmision').textContent = isFinite(transmisionSana) ? (transmisionSana * 100).toFixed(2).replace('.',',') : '—';
  document.getElementById('rx_mRatio').textContent = !mostrarDefecto
    ? (hayDefecto ? '?' : '—')
    : (hayDefecto && isFinite(ratio) ? ratio.toFixed(2).replace('.',',') : '—');

  // Mapeo ilustrativo de la relación de transmisión a nivel de gris (ver
  // ACOTACIÓN DE ALCANCE): la curva característica real (densidad de placa
  // vs. exposición) es propia de cada película/detector y no se modela acá.
  // La mancha se dibuja siempre con su oscurecimiento real (visible), aún
  // en modo desafío -- es la "lectura" que el alumno tiene que interpretar,
  // lo único que se oculta es el NÚMERO de la relación defecto/sano.
  const defectGrayCalc = Math.max(20, Math.min(RX_BASE_GRAY, RX_BASE_GRAY - (ratio - 1) * 60));
  // Blindaje adicional (FIX #85): si ratio llegara a ser inválido por algún
  // otro camino no previsto, mejor un gris de placa sana que un color CSS
  // roto ("rgb(NaN,NaN,NaN)") que el canvas ignoraría en silencio.
  const defectGray = isFinite(defectGrayCalc) ? defectGrayCalc : RX_BASE_GRAY;
  rxDrawPlaca(document.getElementById('rx_chart'), RX_BASE_GRAY, defectGray, hayDefecto);
}

function rxInit() {
  const canvas = document.getElementById('rx_chart');
  canvas.width = 500;
  canvas.height = 320;
  rxUpdate();
}

/* ---------------- FICHA DE LABORATORIO (backlog punto D, v5.10) ---------------- */

function showFichaRX() {
  const matSel = document.getElementById('rx_material');
  const matLabel = matSel.value === 'otro'
    ? `Personalizado (HVL = ${document.getElementById('rx_hvlCustom').value || '—'} mm)`
    : matSel.options[matSel.selectedIndex].text;
  const espesor = document.getElementById('rx_espesorVal').textContent;

  const filasDefecto = RX_DESAFIO.activo
    ? (RX_DESAFIO.revelado
        ? [['Pérdida de espesor (revelada)', RX_DESAFIO.perdida.toFixed(1).replace('.',',') + ' mm']]
        : [['Pérdida de espesor', 'Modo desafío activo, aún sin revelar']])
    : [['Pérdida de espesor en el defecto', document.getElementById('rx_perdidaVal').textContent]];

  fichaNDTRender({
    titulo: 'Informe de Ensayo por Radiografía Industrial',
    secciones: [
      { titulo: 'Configuración del ensayo', filas: [
        ['Material', matLabel],
        ['Fuente', 'Ir-192'],
        ['Espesor de la pieza', espesor],
        ['Modo', RX_DESAFIO.activo ? 'Desafío' : 'Exploración'],
      ] },
      { titulo: 'Defecto', filas: filasDefecto },
      { titulo: 'Resultados', filas: [
        ['Coeficiente μ', fichaConUnidad(document.getElementById('rx_mMu').textContent, 'mm⁻¹')],
        ['Transmisión zona sana', fichaConUnidad(document.getElementById('rx_mTransmision').textContent, '%')],
        ['Relación defecto/sano', fichaConUnidad(document.getElementById('rx_mRatio').textContent, '×')],
      ] },
    ],
    imagenHtml: fichaImgDesdeCanvas('rx_chart'),
    imagenTitulo: 'Placa simulada',
  });
}

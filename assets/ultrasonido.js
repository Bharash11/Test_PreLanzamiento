// ultrasonido.js — Módulo "Ensayo no destructivo" (Grupo B, v5.2):
// Ultrasonido (pulso-eco) — tiempo de vuelo, conversión a profundidad, y un
// A-scan (forma de onda con picos) dibujado a mano en <canvas> 2D -- primera
// vez que el simulador dibuja directo sobre canvas en vez de usar Chart.js o
// SVG, según pide el plan de versiones para este ensayo.

// FIX (v5.2): UT_VELOCIDAD_TABLE con velocidad de propagación de onda
// longitudinal REAL, en mm/µs, para 6 materiales. Fuentes: ASNT "Ultrasonic
// Testing" (Level II) — tabla de velocidades longitudinales de aluminio
// (6320 m/s), latón (4430 m/s), cobre (4700 m/s) y acrílico/Perspex (2730
// m/s, el material estándar de las cuñas y bloques de calibración V1/V2);
// acero al carbono (~5920 m/s) y acero inoxidable austenítico 304/316
// (~5650-5660 m/s) — valores consistentes entre tablas de referencia de
// fabricantes de equipos de ensayo (Dakota NDT, Material Welding).
const UT_VELOCIDAD_TABLE = {
  acero:      { label: 'Acero al carbono',                            v: 5.90 },
  aceroinox:  { label: 'Acero inoxidable austenítico (304/316)',      v: 5.65 },
  aluminio:   { label: 'Aluminio',                                    v: 6.32 },
  laton:      { label: 'Latón',                                       v: 4.43 },
  cobre:      { label: 'Cobre',                                       v: 4.70 },
  acrilico:   { label: 'Acrílico (PMMA, bloque de calibración)',      v: 2.73 },
};

/* ---------------- FÓRMULAS PURAS (testeables desde el día 1) ---------------- */

// Tiempo de vuelo (ida y vuelta, pulso-eco) para un eco reflejado a una
// profundidad dada: t = 2·d/v. d en mm, v en mm/µs → t en µs.
function utCalcTiempoVuelo(profundidad_mm, velocidad_mmus) {
  if (!(profundidad_mm >= 0) || !(velocidad_mmus > 0)) return NaN;
  return 2 * profundidad_mm / velocidad_mmus;
}

// Inversa: a partir del tiempo de vuelo medido, la profundidad del reflector.
// Es literalmente lo que hace un equipo real calibrado en velocidad conocida.
function utCalcProfundidad(tiempo_us, velocidad_mmus) {
  if (!(tiempo_us >= 0) || !(velocidad_mmus > 0)) return NaN;
  return velocidad_mmus * tiempo_us / 2;
}

/* ---------------- DIBUJO DEL A-SCAN (canvas 2D, una sola pasada) ---------------- */

// Dibuja cada eco como un pico único (ventana de coseno alzado, siempre ≥0 --
// el A-scan simplificado que se enseña habitualmente muestra picos hacia
// arriba nada más, no la oscilación de RF cruda). pulsos: [{t, amp, label, color}].
function utDrawAscan(canvas, tMax, pulsos) {
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  ctx.clearRect(0, 0, W, H);

  const marginL = 42, marginR = 14, marginT = 16, marginB = 34;
  const plotW = W - marginL - marginR, plotH = H - marginT - marginB;
  const baseline = marginT + plotH;
  if (!(tMax > 0)) return;

  // Grilla vertical + eje
  ctx.strokeStyle = gc; ctx.lineWidth = 1;
  ctx.beginPath();
  for (let i = 0; i <= 5; i++) {
    const x = marginL + plotW * i / 5;
    ctx.moveTo(x, marginT); ctx.lineTo(x, baseline);
  }
  ctx.stroke();

  ctx.strokeStyle = tc; ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(marginL, marginT); ctx.lineTo(marginL, baseline); ctx.lineTo(marginL + plotW, baseline);
  ctx.stroke();

  // Etiquetas del eje: tiempo (µs) arriba de la línea, profundidad equivalente (mm) abajo
  ctx.fillStyle = tc; ctx.font = '10px sans-serif'; ctx.textAlign = 'center';
  const v = pulsos._v; // velocidad usada, para la doble escala (ver utUpdate)
  for (let i = 0; i <= 5; i++) {
    const x = marginL + plotW * i / 5;
    const t = tMax * i / 5;
    ctx.fillText(t.toFixed(1).replace('.',','), x, baseline + 13);
    if (v > 0) ctx.fillText('(' + (t * v / 2).toFixed(0) + 'mm)', x, baseline + 25);
  }
  ctx.textAlign = 'left';
  ctx.fillText('t (µs)', marginL + plotW - 30, baseline + 13);

  // Picos: ventana de coseno alzado, ancho fijo en px (mismo criterio simple
  // que el resto del simulador: "una sola pasada de dibujo", sin animación).
  const hw = 15;
  pulsos.forEach(p => {
    const x0 = marginL + plotW * (p.t / tMax);
    const ampPx = plotH * (p.amp / 100);
    ctx.strokeStyle = p.color; ctx.lineWidth = 1.8;
    ctx.beginPath();
    let first = true;
    for (let dx = -hw; dx <= hw; dx++) {
      const xx = x0 + dx;
      if (xx < marginL - 0.01 || xx > marginL + plotW + 0.01) continue;
      const shape = 0.5 * (1 + Math.cos(Math.PI * dx / hw));
      const y = baseline - ampPx * shape;
      if (first) { ctx.moveTo(xx, y); first = false; } else { ctx.lineTo(xx, y); }
    }
    ctx.stroke();
    ctx.fillStyle = p.color; ctx.font = 'bold 11px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText(p.label, x0, Math.max(marginT + 9, baseline - ampPx - 8));
  });
}

/* ---------------- UI ---------------- */

// FIX v5.8 (backlog punto B, "Modo desafío"): estado del desafío activo.
// profDef/ampDef acá reemplazan a los sliders reales mientras activo=true
// -- se generan una vez por "Nuevo desafío" con mdValorEnRango (ver
// modo-desafio.js), usando el MISMO rango [0, ut_profdefecto.max] /
// [ut_ampdefecto.min, ut_ampdefecto.max] que ya está validado para el modo
// exploración (ningún límite nuevo inventado).
let UT_DESAFIO = { activo: false, seed: null, profDef: null, ampDef: null, posDef: null, revelado: false };

// FIX (prototipo post-v6.12): movimiento del palpador en X (segundo módulo
// del backlog de escenas, después de Tensiones residuales). A diferencia de
// la tolerancia real de un ultrasonido (que depende del diámetro del
// palpador, la divergencia del haz y la frecuencia usada -- ninguno de esos
// parámetros existe en este simulador), UT_TOLERANCIA_X es un ancho de
// "huella de haz" ILUSTRATIVO, elegido para que barrer la pieza sea
// deliberado pero no tedioso. Se documenta como tal, mismo criterio que la
// K de Charpy.
const UT_TOLERANCIA_X = 6; // % del largo de la pieza, a cada lado

// UT_ENCONTRADO: separado de la posición del palpador a propósito (mismo
// criterio "herramienta vs. marca" que Brinell/Rockwell/Tensiones
// residuales) -- acá no hay una marca física que quede grabada, pero sí hay
// un equivalente: una vez que el palpador coincidió con el defecto al menos
// una vez, ese hallazgo "se sabe" y no se re-oculta si el palpador se aleja
// después. En modo exploración no se usa para ocultar nada (ahí nunca hubo
// nada escondido); solo importa en modo desafío.
let UT_ENCONTRADO = false;
let UT_BARRIENDO = false; // bandera de animación del barrido automático (utBarrer)

// FIX v5.9 (backlog punto C): muestra/oculta el input crudo de velocidad
// cuando el material es "Otro". utCalcTiempoVuelo ya toma v como parámetro
// puro, así que esto es pura UI.
function utMaterialToggle() {
  const custom = document.getElementById('ut_metal').value === 'otro';
  document.getElementById('ut_velCustomWrap').style.display = custom ? '' : 'none';
  utUpdate();
}

function utModoToggle() {
  const desafio = document.getElementById('ut_modo').value === 'desafio';
  UT_DESAFIO.activo = desafio;
  UT_ENCONTRADO = false;
  document.getElementById('ut_camposDefecto').style.display = desafio ? 'none' : '';
  document.getElementById('ut_camposDesafio').style.display = desafio ? '' : 'none';
  document.getElementById('ut_desafioResultado').style.display = 'none';
  if (desafio) {
    utDesafioNuevo();
  } else {
    UT_DESAFIO.revelado = false;
    utUpdate();
  }
}

function utDesafioNuevo(seedOverride) {
  const espesor = parseFloat(document.getElementById('ut_espesor').value) || 0;
  const profSlider = document.getElementById('ut_profdefecto');
  const ampSlider = document.getElementById('ut_ampdefecto');
  const posSlider = document.getElementById('ut_posdefecto');
  // FIX v5.12 (backlog punto F): acepta una semilla explícita para poder
  // reproducir EXACTAMENTE el mismo desafío recibido por "Compartir enlace"
  // (ver progreso.js) -- si no se pasa ninguna, se comporta igual que antes.
  const seed = (seedOverride != null) ? seedOverride : mdNuevaSemilla();

  // Rango de profundidad: dentro de la pieza actual, siempre por debajo del
  // espesor (si no, no habría eco de defecto que dibujar -- mismo chequeo
  // hayDefecto que ya usa utUpdate() en modo exploración).
  const minProf = Math.max(parseFloat(profSlider.min) || 0, 1);
  const maxProf = Math.max(minProf, Math.min(parseFloat(profSlider.max) || espesor, espesor - 1));
  const stepProf = parseFloat(profSlider.step) || 1;
  const minAmp = parseFloat(ampSlider.min) || 5;
  const maxAmp = parseFloat(ampSlider.max) || 100;
  const stepAmp = parseFloat(ampSlider.step) || 1;
  const minPos = parseFloat(posSlider.min) || 0;
  const maxPos = parseFloat(posSlider.max) || 100;
  const stepPos = parseFloat(posSlider.step) || 1;

  UT_DESAFIO.seed = seed;
  UT_DESAFIO.profDef = mdValorEnRango(seed, minProf, maxProf, stepProf);
  UT_DESAFIO.ampDef = mdValorEnRango(seed + 1, minAmp, maxAmp, stepAmp);
  UT_DESAFIO.posDef = mdValorEnRango(seed + 2, minPos, maxPos, stepPos);
  UT_DESAFIO.revelado = false;
  UT_ENCONTRADO = false; // FIX (prototipo post-v6.12): hay que barrer y encontrarlo en X antes de poder revelar la profundidad

  // FIX (prototipo post-v6.12): el palpador arranca del lado OPUESTO del
  // nuevo defecto -- si se dejara donde haya quedado de un desafío
  // anterior (o de exploración), podría coincidir con el nuevo posDef por
  // pura casualidad y el desafío "ya estaría encontrado" antes de barrer
  // una sola vez. Girar 180° (mod 100) garantiza que arranque bien afuera
  // de la tolerancia sin importar dónde estuviera antes.
  document.getElementById('ut_posPalpador').value = ((UT_DESAFIO.posDef + 50) % 100).toFixed(0);

  document.getElementById('ut_estProfundidad').value = '';
  document.getElementById('ut_desafioResultado').style.display = 'none';
  document.getElementById('ut_btnRevelar').disabled = true; // se habilita recién al encontrarlo (ver utUpdate())
  utUpdate();
}

function utDesafioRevelar() {
  if (!UT_DESAFIO.activo) return;
  if (!UT_ENCONTRADO) return; // defensivo -- el botón ya queda disabled hasta encontrarlo (ver utUpdate())
  const estimacion = parseFloat(document.getElementById('ut_estProfundidad').value);
  const real = UT_DESAFIO.profDef;
  UT_DESAFIO.revelado = true;

  document.getElementById('ut_desafioResultado').style.display = '';
  document.getElementById('ut_rReal').textContent = real.toFixed(1).replace('.',',') + ' mm';
  document.getElementById('ut_rEstimacion').textContent = isFinite(estimacion) ? estimacion.toFixed(1).replace('.',',') + ' mm' : '(sin estimación)';
  document.getElementById('ut_rDif').textContent = isFinite(estimacion) ? Math.abs(estimacion - real).toFixed(1).replace('.',',') + ' mm' : '—';
  document.getElementById('ut_rMsg').textContent = mdMensajeResultado(estimacion, real, 'mm', 'el tiempo de vuelo del eco "D" y la fórmula d = v·t/2');

  utUpdate(); // redibuja mostrando ahora el valor real, ya revelado
}

// FIX (prototipo post-v6.12): barrido automático del palpador en X, capa
// ADICIONAL sobre la exploración manual (mover el slider ut_posPalpador ya
// actualiza todo al instante, esto no lo reemplaza). No hay una "posición
// final" especial a la que volver -- a diferencia de Charpy/Brinell no hay
// nada que "se retira" al terminar, así que no hace falta separar variables
// de progreso: el barrido simplemente mueve ut_posPalpador de 0% a 100% y
// llama a utUpdate() en cada cuadro, exactamente la misma función que ya
// usa la exploración manual -- una sola fuente de verdad, sin duplicar
// lógica de dibujo.
function utBarrer() {
  if (UT_BARRIENDO) return;
  const slider = document.getElementById('ut_posPalpador');
  const btn = document.getElementById('ut_btnBarrer');
  UT_BARRIENDO = true;
  if (btn) btn.disabled = true;

  const DURACION_MS = 2600;
  const t0 = performance.now();

  function frame(now) {
    const frac = Math.min(1, (now - t0) / DURACION_MS);
    slider.value = (frac * 100).toFixed(1);
    utUpdate();
    if (frac < 1) {
      requestAnimationFrame(frame);
    } else {
      UT_BARRIENDO = false;
      if (btn) btn.disabled = false;
    }
  }
  requestAnimationFrame(frame);
}

function utUpdate() {
  const metalKey = document.getElementById('ut_metal').value;
  // FIX #84 (hallazgo QA v6.21, Etapa 27): "parseFloat(...)||NaN" solo
  // atrapaba 0/blanco/NaN como inválidos -- un valor NEGATIVO tipeado (ej.
  // "-5") es *truthy* en JS, así que "-5||NaN" da -5, no NaN. El campo
  // ut_mVelocidad (que solo chequeaba isFinite(v), no v>0) terminaba
  // mostrando "-5,00" como si fuera una velocidad de propagación válida,
  // mientras ut_mTFondo/ut_mTDefecto sí mostraban "—" correctamente (porque
  // utCalcTiempoVuelo() valida velocidad>0 puertas adentro) -- un estado
  // visualmente inconsistente. Se valida explícitamente v>0 acá, mismo
  // criterio que el resto de la app usa para descartar negativos.
  const vCustomRaw = parseFloat(document.getElementById('ut_velCustom').value);
  const v = (metalKey === 'otro')
    ? (isFinite(vCustomRaw) && vCustomRaw>0 ? vCustomRaw : NaN)
    : UT_VELOCIDAD_TABLE[metalKey].v;
  const espesor = parseFloat(document.getElementById('ut_espesor').value) || 0;

  let profDef, ampDef, posDef;
  if (UT_DESAFIO.activo) {
    profDef = UT_DESAFIO.profDef || 0;
    ampDef = UT_DESAFIO.ampDef || 0;
    posDef = UT_DESAFIO.posDef || 0;
  } else {
    profDef = parseFloat(document.getElementById('ut_profdefecto').value) || 0;
    ampDef = parseFloat(document.getElementById('ut_ampdefecto').value) || 0;
    posDef = parseFloat(document.getElementById('ut_posdefecto').value) || 0;
  }
  const posPalpador = parseFloat(document.getElementById('ut_posPalpador').value) || 0;

  document.getElementById('ut_espesorVal').textContent = espesor + ' mm';
  if (!UT_DESAFIO.activo) {
    document.getElementById('ut_profdefectoVal').textContent = profDef > 0 ? profDef + ' mm' : 'sin defecto';
    document.getElementById('ut_ampdefectoVal').textContent = ampDef + ' %';
    document.getElementById('ut_posdefectoVal').textContent = posDef + ' %';
  }
  document.getElementById('ut_posPalpadorVal').textContent = posPalpador + ' %';

  // FIX (prototipo post-v6.12): el eco de defecto ahora exige, ADEMÁS de
  // "hay un defecto dentro del espesor", que el palpador esté barriendo
  // sobre él en X (dentro de UT_TOLERANCIA_X) -- en las DOS modos, no solo
  // en desafío: en un ultrasonido real, si el haz no incide sobre el
  // reflector, no hay eco, punto. Con los valores por defecto de ambos
  // sliders (50%/50%) esto coincide de entrada, así que el comportamiento
  // de exploración anterior a esta versión no cambia salvo que el alumno
  // mueva el palpador.
  const dentroTolerancia = Math.abs(posPalpador - posDef) <= UT_TOLERANCIA_X;
  const hayDefectoFisico = profDef > 0 && profDef < espesor;
  if (dentroTolerancia && hayDefectoFisico) UT_ENCONTRADO = true; // "marca" persistente, no se re-oculta si el palpador se aleja después
  const hayDefecto = hayDefectoFisico && dentroTolerancia;
  const tFondo = utCalcTiempoVuelo(espesor, v);
  const tDefecto = hayDefecto ? utCalcTiempoVuelo(profDef, v) : null;

  // FIX v5.8: mientras el desafío está activo y sin revelar, el tiempo de
  // vuelo al defecto se oculta -- mostrarlo sería regalar la respuesta,
  // porque d = v·t/2 con v ya visible en \"Velocidad\" de arriba.
  if (UT_DESAFIO.activo) document.getElementById('ut_btnRevelar').disabled = !UT_ENCONTRADO;
  const mostrarDefecto = !UT_DESAFIO.activo || UT_DESAFIO.revelado;

  document.getElementById('ut_mVelocidad').textContent = isFinite(v) ? v.toFixed(2).replace('.',',') : '—';
  document.getElementById('ut_mTFondo').textContent = isFinite(tFondo) ? tFondo.toFixed(2).replace('.',',') : '—';
  document.getElementById('ut_mTDefecto').textContent = !mostrarDefecto
    ? (hayDefecto ? '?' : '—')
    : ((tDefecto != null && isFinite(tDefecto)) ? tDefecto.toFixed(2).replace('.',',') : '—');

  const avisoEl = document.getElementById('ut_avisoDefecto');
  avisoEl.style.display = (!UT_DESAFIO.activo && profDef > 0 && !hayDefectoFisico) ? 'block' : 'none';

  const etiquetaDefecto = mostrarDefecto ? `D (${profDef}mm)` : 'D (?)';
  const pulsos = [{ t: 0, amp: 100, label: 'PI', color: '#1a5fa8' }];
  if (hayDefecto) pulsos.push({ t: tDefecto, amp: ampDef, label: etiquetaDefecto, color: '#c0392b' });
  pulsos.push({ t: tFondo, amp: 100, label: `EF (${espesor}mm)`, color: '#1a8c5e' });
  pulsos._v = v;

  utDrawAscan(document.getElementById('ut_chart'), tFondo * 1.15, pulsos);

  // FIX (prototipo post-v6.12): posición visible del defecto en la escena
  // -- en exploración siempre (ahí nunca hubo nada oculto, ver mostrarDefecto
  // más arriba, mismo espíritu); en desafío recién cuando ya se encontró en
  // X (UT_ENCONTRADO), sin necesidad de haber revelado todavía la
  // profundidad -- son dos revelaciones separadas, primero dónde, después
  // cuánto.
  const posicionVisible = !UT_DESAFIO.activo || UT_ENCONTRADO;
  if (typeof utDrawEscenaPalpador === 'function') {
    utDrawEscenaPalpador(document.getElementById('ut_scenaCanvas'), profDef, espesor, posPalpador / 100, posDef / 100, posicionVisible, dentroTolerancia);
  }
}

function utInit() {
  const canvas = document.getElementById('ut_chart');
  // Resolución interna fija del canvas (independiente del tamaño en pantalla,
  // igual de simple que fijar un viewBox en las ilustraciones SVG del resto
  // del simulador -- ver dz_scSvg en dureza-esclerometro.js).
  canvas.width = 700;
  canvas.height = 280;
  // FIX (prototipo post-v6.12): canvas de la escena palpador+pieza, vive en
  // escena-ultrasonido.js (cargado después de este archivo).
  const scena = document.getElementById('ut_scenaCanvas');
  if (scena) { scena.width = 700; scena.height = 140; }
  utUpdate();
}

/* ---------------- FICHA DE LABORATORIO (backlog punto D, v5.10) ---------------- */

function showFichaUT() {
  const metalSel = document.getElementById('ut_metal');
  const metalLabel = metalSel.value === 'otro'
    ? `Personalizado (v = ${document.getElementById('ut_velCustom').value || '—'} mm/µs)`
    : metalSel.options[metalSel.selectedIndex].text;
  const espesor = document.getElementById('ut_espesorVal').textContent;

  const filasDefecto = UT_DESAFIO.activo
    ? (UT_DESAFIO.revelado
        ? [['Profundidad del defecto (revelada)', UT_DESAFIO.profDef.toFixed(1).replace('.',',') + ' mm'],
           ['Posición X del defecto (encontrada)', UT_ENCONTRADO ? UT_DESAFIO.posDef.toFixed(1).replace('.',',') + ' %' : 'aún sin encontrar']]
        : [['Profundidad del defecto', 'Modo desafío activo, aún sin revelar']])
    : [
        ['Profundidad del defecto', document.getElementById('ut_profdefectoVal').textContent],
        ['Amplitud del eco de defecto', document.getElementById('ut_ampdefectoVal').textContent],
        ['Posición X del defecto', document.getElementById('ut_posdefectoVal').textContent],
      ];

  fichaNDTRender({
    titulo: 'Informe de Ensayo por Ultrasonido (Pulso-Eco)',
    secciones: [
      { titulo: 'Configuración del ensayo', filas: [
        ['Material', metalLabel],
        ['Espesor de la pieza E', espesor],
        ['Modo', UT_DESAFIO.activo ? 'Desafío' : 'Exploración'],
      ] },
      { titulo: 'Defecto', filas: filasDefecto },
      { titulo: 'Resultados', filas: [
        ['Velocidad v', fichaConUnidad(document.getElementById('ut_mVelocidad').textContent, 'mm/µs')],
        ['Tiempo de vuelo al fondo', fichaConUnidad(document.getElementById('ut_mTFondo').textContent, 'µs')],
        ['Tiempo de vuelo al defecto', fichaConUnidad(document.getElementById('ut_mTDefecto').textContent, 'µs')],
      ] },
    ],
    imagenHtml: fichaImgDesdeCanvas('ut_chart'),
    imagenTitulo: 'A-scan (amplitud vs. tiempo)',
  });
}

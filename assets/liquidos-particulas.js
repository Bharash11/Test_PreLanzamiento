// liquidos-particulas.js — Módulo "Ensayo no destructivo" (Grupo B, v5.5):
// Líquidos penetrantes (PT) y Partículas magnéticas (MT) -- los dos ensayos
// más caros del Grupo B porque su procedimiento real tiene una secuencia de
// pasos, algunos con tiempo de espera obligatorio. Se resuelven con una
// máquina de estados genérica (fsmCrear/fsmAvanzar/fsmTick/fsmReiniciar) --
// una primera versión simple de la "máquina de estados genérica
// reutilizable" que el plan de versiones deja prevista para v6.4 (fatiga/
// fluencia como aparato físico).
// FIX #63 (hallazgo A3-01): esta cabecera decía "reutilizable entre ambos"
// (PT y MT). Desde v6.1, R.R. Moore también la reusa tal cual (ver la
// cabecera de rrmoore.js) -- son 3 consumidores, no 2.

/* ---------------- MÁQUINA DE ESTADOS GENÉRICA (pura, testeable desde el día 1) ---------------- */
// No toca el DOM ni usa timers reales -- eso vive en pnArrancarTimer más
// abajo. Acá solo la lógica de "¿en qué paso estoy? ¿puedo avanzar? ¿cuánto
// falta de espera?", que es lo que realmente hace falta testear.

function fsmCrear(pasos) {
  return { pasos, indice: 0, esperaRestanteSeg: 0, esperaTotalSeg: 0 };
}

function fsmPasoActual(estado) {
  return estado.pasos[estado.indice];
}

function fsmPuedeAvanzar(estado) {
  return estado.esperaRestanteSeg <= 0 && estado.indice < estado.pasos.length - 1;
}

// Devuelve un ESTADO NUEVO (no muta el original) -- si el paso siguiente
// tiene tiempo de espera (esperaMin > 0), arranca la cuenta regresiva.
function fsmAvanzar(estado) {
  if (!fsmPuedeAvanzar(estado)) return estado;
  const indice = estado.indice + 1;
  const esperaMin = estado.pasos[indice].esperaMin || 0;
  const esperaTotalSeg = esperaMin * 60;
  return { pasos: estado.pasos, indice, esperaRestanteSeg: esperaTotalSeg, esperaTotalSeg };
}

function fsmReiniciar(estado) {
  return { pasos: estado.pasos, indice: 0, esperaRestanteSeg: 0, esperaTotalSeg: 0 };
}

// Descuenta segundos de la espera actual (clamped a 0). Estado nuevo, puro.
function fsmTick(estado, decrementoSeg) {
  if (estado.esperaRestanteSeg <= 0) return estado;
  const nuevo = Math.max(0, estado.esperaRestanteSeg - decrementoSeg);
  return { pasos: estado.pasos, indice: estado.indice, esperaRestanteSeg: nuevo, esperaTotalSeg: estado.esperaTotalSeg };
}

/* ---------------- DATOS REALES (ASME Sección V, Artículo 6, Tabla T-672 y T-676.1) ---------------- */

// FIX (v5.5): tiempo de espera del penetrante -- depende de la forma de la
// pieza según la Tabla T-672 de ASME Sección V Art. 6: 5 min para piezas
// coladas o soldadas (cold shuts, porosidad, falta de fusión, grietas), 10
// min para piezas forjadas o laminadas (extrusión, forja, chapa). El tiempo
// de espera del revelador es 10 min como mínimo en ambos casos (T-676.1:
// interpretación final no antes de 10 min ni después de 60 min de aplicado
// el revelador) -- no depende de la forma de la pieza, así que es una sola
// constante.
const PN_FORMA_TABLE = {
  colada_soldadura: { label: 'Fundición o soldadura (coladas, soldaduras)', esperaPenetranteMin: 5 },
  forjado_laminado: { label: 'Forjado o laminado (extrusión, forja, chapa)', esperaPenetranteMin: 10 },
};
const PN_ESPERA_REVELADOR_MIN = 10;

// Duración REAL de reloj de pared que tarda la animación de cada espera en
// esta simulación (comprimida a propósito -- nadie va a esperar 10 minutos
// reales en una clase). El contador en pantalla sí muestra los minutos
// REALES de la norma, contando hacia atrás durante esos segundos.
const FSM_DURACION_ANIM_SEG = 5;

/* ---------------- LÍQUIDOS PENETRANTES (PT) ---------------- */

function pnPasos(esperaPenetranteMin) {
  return [
    { id: 'limpieza', titulo: '1. Limpieza previa', texto: 'Se elimina toda suciedad, grasa, óxido o pintura de la superficie -- cualquier residuo puede taponar una grieta y esconderla, o generar una indicación falsa.', esperaMin: 0 },
    { id: 'aplicar', titulo: '2. Aplicación del penetrante', texto: 'Se cubre toda la superficie con un líquido de baja viscosidad y alta capacidad humectante (rojo visible o fluorescente). Por capilaridad, el líquido entra en cualquier discontinuidad abierta a la superficie.', esperaMin: esperaPenetranteMin, normaTexto: `Tiempo de espera mínimo: ${esperaPenetranteMin} min (ASME Sección V, Artículo 6, Tabla T-672).` },
    { id: 'remover', titulo: '3. Remoción del exceso', texto: 'Se retira con cuidado el penetrante de la superficie plana (con un paño o agua, según el tipo), sin arrastrar el que quedó atrapado dentro de la grieta por capilaridad.', esperaMin: 0 },
    { id: 'revelador', titulo: '4. Aplicación del revelador', texto: 'Se aplica un polvo blanco fino que actúa como un papel secante: por capilaridad inversa, "chupa" hacia la superficie el penetrante que había quedado atrapado en la grieta, formando una indicación visible.', esperaMin: PN_ESPERA_REVELADOR_MIN, normaTexto: `Tiempo de espera mínimo: ${PN_ESPERA_REVELADOR_MIN} min (ASME Sección V, Artículo 6, T-676.1).` },
    { id: 'inspeccion', titulo: '5. Inspección', texto: 'La grieta queda marcada como una línea de color bien definida sobre el fondo blanco del revelador (o brillante bajo luz ultravioleta, si el penetrante era fluorescente) -- mucho más fácil de ver que la grieta original a simple vista.', esperaMin: 0 },
  ];
}

let pnEstado = fsmCrear(pnPasos(PN_FORMA_TABLE.forjado_laminado.esperaPenetranteMin));
let pnTimerId = null;

function pnReiniciar() {
  clearInterval(pnTimerId);
  const forma = PN_FORMA_TABLE[document.getElementById('pn_forma').value];
  pnEstado = fsmCrear(pnPasos(forma.esperaPenetranteMin));
  pnRender();
}

function pnSiguiente() {
  if (!fsmPuedeAvanzar(pnEstado)) return;
  pnEstado = fsmAvanzar(pnEstado);
  pnRender();
  if (pnEstado.esperaRestanteSeg > 0) pnArrancarTimer();
}

function pnArrancarTimer() {
  clearInterval(pnTimerId);
  const pasos = 25;
  const decremento = pnEstado.esperaTotalSeg / pasos;
  pnTimerId = setInterval(() => {
    pnEstado = fsmTick(pnEstado, decremento);
    pnRender();
    if (pnEstado.esperaRestanteSeg <= 0) clearInterval(pnTimerId);
  }, (FSM_DURACION_ANIM_SEG * 1000) / pasos);
}

function pnRender() {
  const paso = fsmPasoActual(pnEstado);
  document.getElementById('pn_pasoTitulo').textContent = paso.titulo;
  document.getElementById('pn_pasoTexto').textContent = paso.texto;
  document.getElementById('pn_pasoNorma').textContent = paso.normaTexto || '';
  document.getElementById('pn_pasoNorma').style.display = paso.normaTexto ? 'block' : 'none';
  document.getElementById('pn_progreso').textContent = `Paso ${pnEstado.indice + 1} de ${pnEstado.pasos.length}`;

  const esperando = pnEstado.esperaRestanteSeg > 0;
  const btn = document.getElementById('pn_btnSiguiente');
  btn.disabled = !fsmPuedeAvanzar(pnEstado);
  const esUltimo = pnEstado.indice === pnEstado.pasos.length - 1;
  btn.textContent = esUltimo ? 'Ensayo terminado' : (esperando ? 'Esperando…' : 'Siguiente paso →');

  const contador = document.getElementById('pn_contador');
  if (esperando) {
    const m = Math.floor(pnEstado.esperaRestanteSeg / 60), s = Math.floor(pnEstado.esperaRestanteSeg % 60);
    contador.textContent = `Tiempo de espera restante (real): ${m}:${s.toString().padStart(2, '0')}`;
    contador.style.display = 'block';
  } else {
    contador.style.display = 'none';
  }

  document.getElementById('pn_escena').innerHTML = pnSvgEscena(paso.id);
}

function pnSvgEscena(pasoId) {
  const conRevelador = pasoId === 'revelador' || pasoId === 'inspeccion';
  const conPenetranteSuperficie = pasoId === 'aplicar';
  const conPenetranteAtrapado = pasoId === 'aplicar' || pasoId === 'remover' || conRevelador;
  const conIndicacion = conRevelador;
  const halo = pasoId === 'inspeccion';
  return `
  <svg viewBox="0 0 300 170" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:100%">
    <rect x="30" y="70" width="240" height="70" fill="${conRevelador ? '#e9e4d8' : '#b9b7ae'}" stroke="#5a584f" stroke-width="1.5"/>
    ${conPenetranteSuperficie ? '<rect x="30" y="70" width="240" height="70" fill="#c0392b" opacity="0.55"/>' : ''}
    ${conPenetranteAtrapado ? '<path d="M145,70 L155,70 L150,92 Z" fill="#c0392b"/>' : '<path d="M145,70 L155,70 L150,92 Z" fill="none" stroke="#5a584f" stroke-width="1"/>'}
    ${conIndicacion ? '<path d="M147,70 Q150,60 153,70 Z" fill="#c0392b"/>' : ''}
    ${halo ? '<circle cx="150" cy="75" r="18" fill="none" stroke="#1a5fa8" stroke-width="1.5" stroke-dasharray="3,3"/>' : ''}
    <text x="150" y="158" text-anchor="middle" font-size="10" fill="#72706a">corte esquemático de la pieza (la grieta está exagerada para que se vea)</text>
  </svg>`;
}

/* ---------------- PARTÍCULAS MAGNÉTICAS (MT) ---------------- */

function mtPasos() {
  return [
    { id: 'limpieza', titulo: '1. Limpieza previa', texto: 'Se elimina suciedad, grasa u óxido de la superficie de la pieza ferromagnética -- igual que en líquidos penetrantes, cualquier residuo puede afectar la indicación.', esperaMin: 0 },
    { id: 'magnetizar', titulo: '2. Magnetización', texto: 'Se induce un campo magnético en la pieza (con un yugo electromagnético, como acá, o con bobinas). Donde el campo encuentra una discontinuidad que corta las líneas de flujo, parte de ese flujo "se escapa" al aire -- es el flujo de fuga.', esperaMin: 0 },
    { id: 'particulas', titulo: '3. Aplicación de partículas magnéticas', texto: 'Se aplican partículas ferromagnéticas finas (secas o en suspensión líquida) sobre la superficie magnetizada. El flujo de fuga en la discontinuidad las atrae y las concentra ahí, formando una acumulación visible con la forma del defecto.', esperaMin: 0 },
    { id: 'inspeccion', titulo: '4. Inspección', texto: 'Se observa la acumulación de partículas bajo buena iluminación (o luz ultravioleta, si son fluorescentes) -- su forma marca directamente el contorno de la discontinuidad superficial o muy cercana a la superficie.', esperaMin: 0 },
    { id: 'desmagnetizar', titulo: '5. Desmagnetización', texto: 'Si la pieza va a usarse cerca de instrumentos sensibles al magnetismo, o para evitar que atraiga virutas metálicas en servicio, se revierte y reduce gradualmente el campo hasta anularlo.', esperaMin: 0 },
  ];
}

let mtEstado = fsmCrear(mtPasos());

function mtReiniciar() {
  mtEstado = fsmCrear(mtPasos());
  mtRender();
}

function mtSiguiente() {
  if (!fsmPuedeAvanzar(mtEstado)) return;
  mtEstado = fsmAvanzar(mtEstado);
  mtRender();
}

function mtRender() {
  const paso = fsmPasoActual(mtEstado);
  document.getElementById('mt_pasoTitulo').textContent = paso.titulo;
  document.getElementById('mt_pasoTexto').textContent = paso.texto;
  document.getElementById('mt_progreso').textContent = `Paso ${mtEstado.indice + 1} de ${mtEstado.pasos.length}`;

  const btn = document.getElementById('mt_btnSiguiente');
  btn.disabled = !fsmPuedeAvanzar(mtEstado);
  const esUltimo = mtEstado.indice === mtEstado.pasos.length - 1;
  btn.textContent = esUltimo ? 'Ensayo terminado' : 'Siguiente paso →';

  document.getElementById('mt_escena').innerHTML = mtSvgEscena(paso.id);
}

function mtSvgEscena(pasoId) {
  const magnetizado = pasoId === 'magnetizar' || pasoId === 'particulas' || pasoId === 'inspeccion';
  const conYugo = pasoId === 'magnetizar';
  const conParticulas = pasoId === 'particulas' || pasoId === 'inspeccion';
  const desmagnetizando = pasoId === 'desmagnetizar';
  const halo = pasoId === 'inspeccion';
  const dots = conParticulas
    ? [40, 70, 100, 200, 230, 260].map(x => {
        const cerca = Math.abs(x - 150) < 25;
        return `<circle cx="${x + (cerca ? 0 : (x < 150 ? -6 : 6))}" cy="${cerca ? 72 : 74}" r="${cerca ? 2.6 : 1.6}" fill="#2b2b28"/>`;
      }).join('') + '<circle cx="145" cy="73" r="2.4" fill="#2b2b28"/><circle cx="150" cy="71" r="2.4" fill="#2b2b28"/><circle cx="155" cy="73" r="2.4" fill="#2b2b28"/>'
    : '';
  return `
  <svg viewBox="0 0 300 170" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:100%">
    <rect x="30" y="70" width="240" height="70" fill="${magnetizado ? '#aebfce' : '#b9b7ae'}" stroke="#5a584f" stroke-width="1.5"/>
    <path d="M145,70 L155,70 L150,92 Z" fill="none" stroke="#5a584f" stroke-width="1"/>
    ${conYugo ? '<path d="M100,40 L100,70 M200,40 L200,70 M90,40 L210,40" fill="none" stroke="#444" stroke-width="6" stroke-linecap="round"/>' : ''}
    ${magnetizado && !desmagnetizando ? '<path d="M110,55 Q150,35 190,55" fill="none" stroke="#1a5fa8" stroke-width="1.5" opacity="0.8"/><path d="M110,62 Q150,45 190,62" fill="none" stroke="#1a5fa8" stroke-width="1.5" opacity="0.6"/>' : ''}
    ${desmagnetizando ? '<path d="M110,55 Q150,35 190,55" fill="none" stroke="#1a5fa8" stroke-width="1.5" stroke-dasharray="2,4" opacity="0.4"/>' : ''}
    ${dots}
    ${halo ? '<circle cx="150" cy="75" r="18" fill="none" stroke="#c0392b" stroke-width="1.5" stroke-dasharray="3,3"/>' : ''}
    <text x="150" y="158" text-anchor="middle" font-size="10" fill="#72706a">corte esquemático de la pieza (la grieta está exagerada para que se vea)</text>
  </svg>`;
}

/* ---------------- INIT ---------------- */

function pnMtInit() {
  pnRender();
  mtRender();
}

/* ---------------- FICHAS DE LABORATORIO (backlog punto D, v5.10) ---------------- */

function showFichaPN() {
  const formaSel = document.getElementById('pn_forma');
  const formaLabel = formaSel.options[formaSel.selectedIndex].text;
  const forma = PN_FORMA_TABLE[formaSel.value];
  const paso = fsmPasoActual(pnEstado);
  const completo = pnEstado.indice === pnEstado.pasos.length - 1;

  fichaNDTRender({
    titulo: 'Informe de Ensayo por Líquidos Penetrantes',
    badgeTexto: completo ? 'ENSAYO COMPLETO' : undefined,
    badgeClase: 'badge-ductil',
    secciones: [
      { titulo: 'Configuración del ensayo', filas: [
        ['Forma de la pieza', formaLabel],
      ] },
      { titulo: 'Procedimiento (ASME Sección V, Artículo 6)', filas: [
        ['Paso alcanzado', paso.titulo],
        ['Tiempo de espera del penetrante', forma.esperaPenetranteMin + ' min (Tabla T-672)'],
        ['Tiempo de espera del revelador', PN_ESPERA_REVELADOR_MIN + ' min (T-676.1)'],
      ] },
    ],
    imagenHtml: fichaImgDesdeSvg('pn_escena'),
    imagenTitulo: 'Corte esquemático de la pieza',
    notaFinal: completo ? '' : 'Ensayo aún no terminado -- este informe refleja el paso alcanzado hasta ahora, no el resultado final.',
  });
}

function showFichaMT() {
  const paso = fsmPasoActual(mtEstado);
  const completo = mtEstado.indice === mtEstado.pasos.length - 1;

  fichaNDTRender({
    titulo: 'Informe de Ensayo por Partículas Magnéticas',
    badgeTexto: completo ? 'ENSAYO COMPLETO' : undefined,
    badgeClase: 'badge-ductil',
    secciones: [
      { titulo: 'Configuración del ensayo', filas: [
        ['Material requerido', 'Ferromagnético (acero al carbono, hierro fundido)'],
      ] },
      { titulo: 'Procedimiento', filas: [
        ['Paso alcanzado', paso.titulo],
      ] },
    ],
    imagenHtml: fichaImgDesdeSvg('mt_escena'),
    imagenTitulo: 'Corte esquemático de la pieza',
    notaFinal: completo ? '' : 'Ensayo aún no terminado -- este informe refleja el paso alcanzado hasta ahora, no el resultado final.',
  });
}

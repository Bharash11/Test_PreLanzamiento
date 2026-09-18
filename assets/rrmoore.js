// rrmoore.js — Módulo "Ensayos mecánicos", grupo "Fractura, fatiga y
// fluencia" (v6.1-v6.4): máquina de fatiga rotativa R.R. Moore como
// aparato físico simulado. Ver PROMPT_v6_v7_plan.md (v6.0).
//
// Reusa TAL CUAL la máquina de estados genérica de liquidos-particulas.js
// (fsmCrear/fsmPasoActual/fsmPuedeAvanzar/fsmAvanzar/fsmReiniciar/fsmTick,
// v5.5) -- no hizo falta generalizarla más, sirve sin cambios para este
// tercer consumidor. Se carga después de fatiga.js porque reusa
// FT_SN_PRESETS/ftBasquinN (mismos 3 materiales que "Curva S-N") como
// única fuente de verdad -- ninguna tabla ni fórmula nueva.
//
// v6.1: pasos 1-3 (montaje, contrapeso, arranque), sin ejecución.
// v6.2: paso 4 (contador de ciclos acelerado), modelado como una espera
// más del FSM (esperaMin arbitrario, sin significado normativo real, solo
// para tener una fracción 0→1 que interpolar) -- mismo truco que
// pnArrancarTimer/FSM_DURACION_ANIM_SEG en Líquidos/Partículas (v5.5).
//
// v6.3: paso 5 (parada automática + resultado). Tampoco hizo falta tocar
// fsm* -- cuando el timer de "en_marcha" llega a espera=0, en vez de solo
// habilitar el botón (como hacen PT/MT), se llama a fsmAvanzar()
// automáticamente: la parada es un evento de la máquina, no una decisión
// del operador.
//
// v6.4 -- CONTRAPESO INTERACTIVO. Hasta acá, σ_a era un slider abstracto
// en MPa -- el paso "Ajuste del contrapeso" se LLAMABA así pero no había
// ningún contrapeso que ajustar. Ahora σ_a es una SALIDA calculada, no una
// entrada: el alumno arma la carga real -- agrega plaquetas (0.5/1/2/5 kg,
// apilables, clic para sacarlas) y arrastra el gancho a lo largo del
// brazo -- y σ_a sale de la física real de una viga en voladizo:
//
//   σ_a = M·c/I   donde   M = peso_total_kg · g · distancia_m
//
// Geometría (documentada así a propósito, para separar lo citado de lo
// que es una simplificación de modelado nuestra):
//   RR_D_M = 7.62 mm -- CITADO: diámetro estándar americano de la probeta
//   en el punto de mayor tensión (0.300 in), fuente: Khoshaba, "A
//   comparison of the fatigue calculation process...", WTE&TE Vol.5 No.3
//   (2006), sobre esta misma máquina.
//   RR_BRAZO_M = 0.25 m -- NO es una norma. Es una elección de modelado
//   nuestra (la máquina real no es "un contrapeso deslizante sobre un
//   brazo" tipo romana -- es una viga apoyada en los extremos y cargada
//   en 2 puntos simétricos, con pesos muertos aplicados directamente en
//   un bastidor). El valor 0.25m se eligió por dar un rango de σ_a
//   pedagógicamente útil con plaquetas de pocos kg para los 3 materiales
//   de FT_SN_PRESETS, no porque sea "la" medida real de ninguna máquina
//   -- un ejercicio de texto sobre esta misma máquina usa un brazo de
//   10in (25.4cm), que es de dónde sale el orden de magnitud elegido.
//
// El arrastre y las plaquetas solo son editables durante el paso
// "contrapeso" -- en el resto de la secuencia el gancho se muestra fijo
// en lo que quedó configurado (ver rrRender: el 4to parámetro "editable"
// de rrSvgEscena).
//
// El campo σ_a sigue existiendo pero ahora es de solo-consulta con
// edición inversa: si el alumno escribe un valor ahí, se recalcula la
// DISTANCIA necesaria para el peso ya colocado (no al revés) -- si todavía
// no hay ninguna plaqueta puesta, el campo queda deshabilitado (dividir
// por peso=0 no tiene sentido físico, y no vamos a inventar una
// combinación de plaquetas que el alumno no eligió).
//
// DECISIÓN DE DISEÑO (v6.2, sigue vigente): en la máquina real, durante
// el giro SOLO gira el eje con la probeta -- el contrapeso y el brazo de
// palanca quedan fijos. Con el contrapeso ahora interactivo esto se
// mantiene igual: la posición del gancho es function de σ_a elegida en
// el paso 2, y desde ahí en adelante (arranque/en_marcha/resultado) no
// se mueve más -- solo la probeta se anima al girar.
//
// CASO ESPECIAL -- vida infinita: si σ_a ≤ S_e del material, la probeta
// NUNCA rompe a ese nivel de tensión. La "parada automática" en ese caso
// es un run-out (ensayo truncado a RR_CICLOS_RUNOUT = 10⁷ ciclos, mismo
// umbral que ya usa ftUpdateSN para "> 10⁷ (infinita)"), no una rotura.

const RR_DURACION_ANIM_SEG = 6; // segundos de pared que representan el conteo completo de ciclos
const RR_CICLOS_RUNOUT = 1e7; // mismo umbral que ftUpdateSN ("> 10⁷ (infinita)") para truncar un ensayo que no va a romper

// ---- Geometría del aparato (v6.4) -- ver comentario de cabecera para la
// distinción entre lo citado (RR_D_M) y lo que es modelado nuestro ----
const RR_D_M = 0.00762; // 7.62 mm -- CITADO (0.300 in, estándar americano)
const RR_C_M = RR_D_M / 2;
const RR_I_M4 = Math.PI * Math.pow(RR_D_M, 4) / 64;
const RR_G = 9.81;
const RR_BRAZO_M = 0.25; // NO citado -- elección de modelado, ver cabecera
const RR_MAX_PLATOS = 6; // tope blando por legibilidad del dibujo, no por física

// ---- Geometría de la escena SVG (píxeles del viewBox, no metros) ----
const RR_PIVOTE_PX = 168; // x del apoyo/pivote del brazo (mismo valor que v6.1-v6.3)
const RR_BRAZO_PX = 140; // largo del brazo dibujado -- antes eran 18px (168->186), muy corto para arrastrar con sentido
const RR_PX_POR_M = RR_BRAZO_PX / RR_BRAZO_M;

function rrPasos() {
  return [
    {
      id: 'montaje',
      titulo: '1. Montaje de la probeta',
      texto: 'La probeta, con sus extremos cónicos normalizados, se sujeta entre los dos cabezales rotativos de la máquina y se alinea con el eje de giro. Todavía no hay ninguna carga aplicada sobre ella.',
    },
    {
      id: 'contrapeso',
      titulo: '2. Ajuste del contrapeso',
      texto: 'Agregá plaquetas al gancho y arrastralo a lo largo del brazo de palanca. El momento M = peso × distancia que genera aplica una tensión de flexión σ_a = M·c/I sobre la probeta — cuanto más lejos del apoyo o más pesada la carga, mayor la tensión que va a sufrir cada fibra de la superficie en cada vuelta.',
    },
    {
      id: 'arranque',
      titulo: '3. Arranque del motor',
      texto: 'El motor empieza a girar la probeta a velocidad constante. Como la carga de flexión no gira junto con la probeta, cada punto de su superficie va a pasar una vez por tracción y una vez por compresión en cada vuelta completa: un ciclo de flexión rotativa completamente invertido (R = −1) por cada giro del motor.',
    },
    {
      id: 'en_marcha',
      titulo: '4. En marcha — contador de ciclos',
      texto: 'La probeta gira en forma continua mientras la carga permanece fija en la misma dirección (en la escena, solo el eje/probeta se anima — el contrapeso y el brazo no giran, y es justamente esa diferencia la que genera el ciclo de tensión). El contador de ciclos avanza en tiempo acelerado hasta el número de ciclos que predice la curva S-N para la σ_a elegida.',
      esperaMin: 1, // valor interno arbitrario, no es un tiempo normativo -- ver comentario de cabecera
    },
    {
      id: 'resultado',
      titulo: '5. Parada automática y resultado',
      texto: 'El motor se detiene solo, sin intervención manual: por rotura de la probeta (si σ_a supera el límite de fatiga del material) o al llegar al ciclo de referencia de vida infinita (run-out) si no lo supera. El panel de arriba muestra cuál de los dos casos ocurrió, con el N de ciclos correspondiente.', // versión general para la grilla de pasos (FIX #61); rrRender() sigue completando arriba la versión específica con los números reales de este ensayo
    },
  ];
}

let rrEstado = fsmCrear(rrPasos());
let rrTimerId = null;
let rrPlatos = []; // v6.4: array de kg agregados al gancho, en orden (p.ej. [0.5, 2, 1])
let rrDistanciaM = 0; // v6.4: distancia del gancho al apoyo, en metros [0, RR_BRAZO_M]

// FIX #61 (QA exhaustivo v6.13, etapa 4): grilla de tarjetas "Paso 1..5"
// debajo de la escena, con qué hacer/qué pasa en cada etapa del ensayo.
// Construida siempre a partir de rrPasos() -- la misma fuente de verdad
// que ya usa la máquina de estados para el indicador dinámico de arriba
// (#rr_pasoTitulo/#rr_pasoTexto) -- así que nunca puede quedar
// desincronizada de los pasos reales del ensayo. Resalta la tarjeta del
// paso vigente según rrEstado.indice; se llama desde rrRender() en cada
// actualización, igual que el resto de esta función reconstruye su parte
// del DOM en cada render (ver dzRenderRkTable para el mismo patrón).
function rrRenderPasosGrid() {
  const grid = document.getElementById('rr_pasosGrid');
  if (!grid) return;
  grid.innerHTML = rrPasos().map((paso, i) => {
    const titulo = paso.titulo.replace(/^\d+\.\s*/, ''); // el número ya lo muestra "Paso N" aparte, no hace falta repetirlo
    const activa = i === rrEstado.indice ? ' active' : '';
    return `<div class="rr-paso-card${activa}">
      <div class="rr-paso-num">Paso ${i + 1}</div>
      <div class="rr-paso-titulo">${escapeHtml(titulo)}</div>
      <div class="rr-paso-texto">${escapeHtml(paso.texto)}</div>
    </div>`;
  }).join('');
}

function rrMatSeleccionado() {
  return document.getElementById('rr_mat').value;
}

function rrPesoTotalKg() {
  return rrPlatos.reduce((suma, kg) => suma + kg, 0);
}

// FIX (v6.4): σ_a deja de ser un input directo -- se CALCULA a partir de
// las plaquetas puestas y la distancia del gancho. Sin peso, no hay
// momento, no hay tensión (0 MPa es la respuesta físicamente correcta,
// no un placeholder).
function rrSigmaA() {
  const pesoKg = rrPesoTotalKg();
  if (pesoKg <= 0) return 0;
  const M = pesoKg * RR_G * rrDistanciaM; // N·m
  return (M * RR_C_M / RR_I_M4) / 1e6; // Pa -> MPa
}

function rrObjetivoCiclos() {
  const p = FT_SN_PRESETS[rrMatSeleccionado()];
  const sigmaA = rrSigmaA();
  const infinita = sigmaA > 0 && p.hasLimit && sigmaA <= p.Se;
  return { infinita, Nf: (sigmaA > 0 && !infinita) ? ftBasquinN(sigmaA, p.sfp, p.b) : null };
}

function rrReiniciar() {
  clearInterval(rrTimerId);
  rrEstado = fsmCrear(rrPasos());
  rrPlatos = [];
  rrDistanciaM = 0;
  rrRender();
}

// FIX (v6.5): restaura rrPlatos/rrDistanciaM desde los campos ocultos que
// csAplicarDesdeURL (progreso.js) llena al reconstruir un link compartido
// -- ver el comentario junto a rr_platosState/rr_distanciaState en
// index.html. NO reusa rrAgregarPlato/rrEditarSigmaA porque esas están
// bloqueadas fuera del paso "contrapeso" (FIX de v6.4): un link puede
// compartirse desde cualquier paso de la secuencia (el paso en sí NO se
// captura, mismo criterio ya establecido para PT/MT -- el link siempre
// arranca en "montaje"), y el contrapeso tiene que poder restaurarse
// igual sin importar en qué paso estaba el que lo compartió.
//
// Se lee directo del DOM (no del parámetro `campos` de csCapturarEstado)
// porque progreso.js ya dejó el valor puesto en el input antes de
// disparar el evento 'change' que llama a esta función -- mismo patrón
// que ya usa el resto del restore genérico.
function rrAplicarEstadoCompartido() {
  try {
    const platos = JSON.parse(document.getElementById('rr_platosState').value);
    if (Array.isArray(platos) && platos.every(n => typeof n === 'number' && n > 0)) {
      rrPlatos = platos.slice(0, RR_MAX_PLATOS);
    }
  } catch (e) {
    // JSON inválido (link armado a mano, versión vieja, etc.) -- se
    // ignora y el contrapeso queda vacío, no rompe la carga de la página.
  }
  const dist = parseFloat(document.getElementById('rr_distanciaState').value);
  if (!isNaN(dist)) rrDistanciaM = Math.max(0, Math.min(RR_BRAZO_M, dist));
  rrRender();
}

// FIX (v6.5): ficha técnica independiente, mismo patrón que
// showFichaPN/showFichaMT (liquidos-particulas.js, v5.10) -- reusa
// fichaNDTRender()/fichaImgDesdeSvg() tal cual, ningún modal nuevo.
function showFichaRR() {
  const p = FT_SN_PRESETS[rrMatSeleccionado()];
  const matLabel = document.getElementById('rr_mat').selectedOptions[0].text;
  const paso = fsmPasoActual(rrEstado);
  const completo = paso.id === 'resultado';
  const obj = rrObjetivoCiclos();
  const sigmaA = rrSigmaA();

  const filasContrapeso = rrPlatos.length
    ? [
        ['Plaquetas en el gancho', rrPlatos.map(kg => kg + ' kg').join(' + ')],
        ['Distancia al apoyo', `${(rrDistanciaM * 100).toFixed(0)} cm (de ${RR_BRAZO_M * 100} cm de brazo)`],
        ['σ_a resultante (M·c/I)', sigmaA.toFixed(0) + ' MPa'],
      ]
    : [['Contrapeso', 'Todavía sin configurar (0 kg en el gancho)']];

  let filasResultado;
  if (!completo) {
    filasResultado = [['Estado', 'Ensayo en curso -- todavía no llegó a la parada automática']];
  } else if (obj.infinita) {
    filasResultado = [
      ['Resultado', 'Run-out (sin rotura)'],
      ['Ciclos alcanzados', RR_CICLOS_RUNOUT.toLocaleString('es-AR') + ' (truncado)'],
      ['Motivo', `σ_a (${sigmaA.toFixed(0)} MPa) ≤ S_e del material -- vida infinita a este nivel de tensión`],
    ];
  } else {
    filasResultado = [
      ['Resultado', 'Rotura por fatiga'],
      ['N_f calculado', Math.round(obj.Nf).toLocaleString('es-AR') + ' ciclos (curva de Basquin, misma fórmula que "Curva S-N")'],
    ];
  }

  fichaNDTRender({
    titulo: 'Informe de Ensayo de Fatiga — Máquina R.R. Moore',
    badgeTexto: completo ? 'ENSAYO COMPLETO' : undefined,
    badgeClase: 'badge-ductil',
    secciones: [
      { titulo: 'Configuración del ensayo', filas: [
        ['Material', matLabel],
        ['Diámetro de probeta', '7.62 mm (0.300 in, estándar americano)'],
      ] },
      { titulo: 'Contrapeso (brazo de 25 cm, modelado propio)', filas: filasContrapeso },
      { titulo: 'Procedimiento', filas: [['Paso alcanzado', paso.titulo]] },
      { titulo: 'Resultado', filas: filasResultado },
    ],
    imagenHtml: fichaImgDesdeSvg('rr_escena'),
    imagenTitulo: 'Corte esquemático de la máquina',
    notaFinal: completo ? '' : 'Ensayo aún no terminado -- este informe refleja el paso alcanzado hasta ahora, no el resultado final.',
  });
}

function rrSiguiente() {
  if (!fsmPuedeAvanzar(rrEstado)) return;
  // FIX (v6.4): no se puede arrancar el motor sin haber puesto contrapeso
  // -- sin peso, σ_a=0 y no hay ningún ciclo que contar (además, antes de
  // v6.4 esto no podía pasar porque σ_a siempre tenía un valor por
  // default en el slider; ahora que es una salida calculada, sí puede).
  if (fsmPasoActual(rrEstado).id === 'contrapeso' && rrPesoTotalKg() <= 0) return;
  rrEstado = fsmAvanzar(rrEstado);
  rrRender();
  if (rrEstado.esperaRestanteSeg > 0) rrArrancarTimer();
}

function rrAvanzarSiTerminoEspera(estado) {
  // FIX (v6.3): la parada es un evento de la MÁQUINA, no una decisión del
  // operador -- separado de rrArrancarTimer para que sea testeable sin
  // depender de un timer real (ver rrArrancarTimer más abajo).
  if (estado.esperaRestanteSeg <= 0 && fsmPasoActual(estado).id === 'en_marcha') {
    return fsmAvanzar(estado);
  }
  return estado;
}

function rrArrancarTimer() {
  clearInterval(rrTimerId);
  const pasos = 30;
  const decremento = rrEstado.esperaTotalSeg / pasos;
  rrTimerId = setInterval(() => {
    rrEstado = fsmTick(rrEstado, decremento);
    rrEstado = rrAvanzarSiTerminoEspera(rrEstado);
    rrRender();
    if (rrEstado.esperaRestanteSeg <= 0) clearInterval(rrTimerId);
  }, (RR_DURACION_ANIM_SEG * 1000) / pasos);
}

// ---- v6.4: plaquetas ----

function rrPasoEsEditable() {
  return fsmPasoActual(rrEstado).id === 'contrapeso';
}

function rrAgregarPlato(kg) {
  if (!rrPasoEsEditable() || rrPlatos.length >= RR_MAX_PLATOS) return;
  rrPlatos.push(kg);
  rrRender();
}

function rrQuitarPlato(indice) {
  if (!rrPasoEsEditable()) return;
  rrPlatos.splice(indice, 1);
  rrRender();
}

function rrQuitarUltimoPlato() {
  if (!rrPasoEsEditable() || rrPlatos.length === 0) return;
  rrPlatos.pop();
  rrRender();
}

// El alumno escribe un σ_a deseado -- se despeja la DISTANCIA necesaria
// para el peso ya puesto (no al revés, no se inventan plaquetas nuevas).
function rrEditarSigmaA() {
  if (!rrPasoEsEditable()) return;
  const pesoKg = rrPesoTotalKg();
  if (pesoKg <= 0) return; // el input queda disabled en este caso (ver rrRender), esto es una segunda barrera
  const sigmaDeseadaPa = (parseFloat(document.getElementById('rr_sigmaAInput').value) || 0) * 1e6;
  const M = sigmaDeseadaPa * RR_I_M4 / RR_C_M;
  let dist = M / (pesoKg * RR_G);
  dist = Math.max(0, Math.min(RR_BRAZO_M, dist));
  rrDistanciaM = dist;
  rrRender();
}

// ---- v6.4: arrastre del gancho (primera interacción de tipo drag del
// simulador -- documentado con más detalle de lo habitual porque no hay
// ningún otro módulo del que copiar el patrón) ----
//
// Como rrRender() reemplaza el innerHTML de #rr_escena en cada cuadro
// (incluso durante el arrastre, para que σ_a/el aviso/etc. se actualicen
// en vivo), el <svg> real se recrea todo el tiempo -- por eso NO hay que
// guardar una referencia al elemento SVG fuera de la función que lo usa:
// una referencia guardada de un renderizado anterior queda "húerfana"
// (fuera del DOM) y getBoundingClientRect() de un elemento húerfano
// devuelve todo en 0, rompiendo el arrastre después del primer píxel de
// movimiento. Por eso rrPunteroADistancia() vuelve a buscar el <svg>
// vigente en cada llamada.
function rrPunteroADistancia(clientX) {
  const svg = document.querySelector('#rr_escena svg');
  if (!svg) return rrDistanciaM;
  const rect = svg.getBoundingClientRect();
  const vb = svg.viewBox.baseVal;
  const fraccion = rect.width > 0 ? (clientX - rect.left) / rect.width : 0;
  const xSvg = vb.x + fraccion * vb.width;
  const distPx = Math.max(0, Math.min(RR_BRAZO_PX, xSvg - RR_PIVOTE_PX));
  return distPx / RR_PX_POR_M;
}

function rrArrastrarInicio(evt) {
  if (!rrPasoEsEditable()) return;
  evt.preventDefault();
  const mover = (e) => {
    rrDistanciaM = rrPunteroADistancia(e.clientX);
    rrRender();
  };
  const soltar = () => {
    document.removeEventListener('pointermove', mover);
    document.removeEventListener('pointerup', soltar);
  };
  document.addEventListener('pointermove', mover);
  document.addEventListener('pointerup', soltar);
  mover(evt); // aplica ya en el click inicial, no hace falta mover el mouse primero
}

// FIX #55 (hallazgo QA v6.9, R.R. Moore -- decisión de diseño, opción B
// elegida): con aceros que tienen límite de fatiga (hasLimit:true), la
// mayoría de combinaciones "intuitivas" de plaquetas chicas dan run-out
// en vez de rotura -- físicamente correcto, pero si las primeras 2-3
// pruebas de un alumno le dan todas run-out seguidas, hay riesgo de que
// abandone antes de leer la explicación. Se agrega una guía cuantitativa
// en vivo (NO un número fijo pegado a mano) del peso mínimo, a brazo
// completo, que hace falta para superar S_e y romper. Función pura,
// mismo criterio que dzBrProfundidad()/dzRkCalcDepthFrac()/chCalcTheta1().
// Despeja el PESO de la misma fórmula que ya usa rrSigmaA(), invertida:
// Se = pesoKg·RR_G·RR_BRAZO_M·RR_C_M/RR_I_M4 / 1e6  =>  pesoKg = ...
function rrPesoMinRotura(matKey) {
  const p = FT_SN_PRESETS[matKey];
  if (!p || !p.hasLimit) return null; // sin límite de fatiga -> siempre rompe con suficientes ciclos, no aplica el hint
  const seMPa = p.Se;
  const pesoKg = (seMPa * 1e6) * RR_I_M4 / (RR_C_M * RR_G * RR_BRAZO_M);
  return pesoKg;
}

function rrRender() {
  const paso = fsmPasoActual(rrEstado);
  const obj = rrObjetivoCiclos();
  const editable = rrPasoEsEditable();
  const pesoKg = rrPesoTotalKg();

  if (paso.id === 'resultado') {
    // Contenido dinámico -- depende del material/σ_a vigentes al momento
    // de la parada, no de lo que decía rrPasos() cuando se creó el paso.
    if (obj.infinita) {
      document.getElementById('rr_pasoTitulo').textContent = '5. Corrida completa — vida infinita (run-out)';
      document.getElementById('rr_pasoTexto').textContent =
        `El motor se detuvo solo al llegar a los ${RR_CICLOS_RUNOUT.toLocaleString('es-AR')} ciclos de referencia, sin que la probeta rompiera. Como σ_a (${rrSigmaA().toFixed(0)} MPa) está por debajo del límite de fatiga S_e de este material, se considera que tiene vida infinita a este nivel de tensión: en la práctica de laboratorio, el ensayo se trunca (run-out) en vez de esperar una rotura que no va a ocurrir.`;
    } else {
      document.getElementById('rr_pasoTitulo').textContent = '5. Parada automática — rotura por fatiga';
      document.getElementById('rr_pasoTexto').textContent =
        `El motor se detuvo solo apenas la probeta se partió, a N ≈ ${Math.round(obj.Nf).toLocaleString('es-AR')} ciclos (calculado con la misma curva de Basquin que usa "Curva S-N", para σ_a = ${rrSigmaA().toFixed(0)} MPa). Es el mismo mecanismo real: la rotura hace caer bruscamente el par motor, y ese cambio dispara el corte automático.`;
    }
  } else {
    document.getElementById('rr_pasoTitulo').textContent = paso.titulo;
    document.getElementById('rr_pasoTexto').textContent = paso.texto;
  }
  document.getElementById('rr_progreso').textContent = `Paso ${rrEstado.indice + 1} de ${rrEstado.pasos.length}`;
  rrRenderPasosGrid();

  // ---- v6.4: plaquetas, distancia, σ_a calculada ----
  const p = FT_SN_PRESETS[rrMatSeleccionado()];
  const sigmaA = rrSigmaA();
  document.getElementById('rr_pesoTotal').textContent = `Peso total: ${pesoKg} kg (${rrPlatos.length}/${RR_MAX_PLATOS} plaquetas)`;
  const pesoMin = rrPesoMinRotura(rrMatSeleccionado());
  const hintEl = document.getElementById('rr_hintPesoRotura');
  if (pesoMin === null) {
    hintEl.textContent = 'Este material no tiene límite de fatiga definido: con suficientes ciclos, siempre termina rompiendo.';
  } else {
    hintEl.textContent = `A brazo completo (${RR_BRAZO_M * 100} cm), hacen falta ≈${pesoMin.toFixed(1).replace('.',',')} kg para superar el límite de fatiga S_e y romper -- por debajo, vida infinita (run-out).`;
  }
  document.getElementById('rr_distanciaVal').textContent = `${Math.round(rrDistanciaM * 100)} cm de ${RR_BRAZO_M * 100} cm`;

  // FIX (v6.5): espeja rrPlatos/rrDistanciaM en los campos ocultos que
  // "Compartir enlace" sabe capturar (ver comentario junto a esos inputs
  // en index.html) -- se actualizan en cada render para que la URL
  // armada en cualquier momento refleje el contrapeso vigente.
  document.getElementById('rr_platosState').value = JSON.stringify(rrPlatos);
  document.getElementById('rr_distanciaState').value = String(rrDistanciaM);
  document.getElementById('rr_sigmaAVal').textContent = sigmaA.toFixed(0) + ' MPa';

  const sigmaInput = document.getElementById('rr_sigmaAInput');
  sigmaInput.disabled = !editable || pesoKg <= 0;
  if (document.activeElement !== sigmaInput) sigmaInput.value = sigmaA.toFixed(0);

  document.getElementById('rr_addPlato05').disabled = !editable || rrPlatos.length >= RR_MAX_PLATOS;
  document.getElementById('rr_addPlato1').disabled = !editable || rrPlatos.length >= RR_MAX_PLATOS;
  document.getElementById('rr_addPlato2').disabled = !editable || rrPlatos.length >= RR_MAX_PLATOS;
  document.getElementById('rr_addPlato5').disabled = !editable || rrPlatos.length >= RR_MAX_PLATOS;
  document.getElementById('rr_quitarPlato').disabled = !editable || rrPlatos.length === 0;

  // Aviso (sin bloquear, mismo criterio que e_warnSyTs / FIX #10) si σ_a
  // ya está fuera de rango físicamente razonable para el material elegido.
  // FIX #44 (hallazgo Etapa 1 QA v6.5): decía "σ_fp" -- no es la notación que
  // usa el resto del simulador ni la bibliografía de Basquin (coeficiente de
  // resistencia a la fatiga σ'_f). Alineado con el mismo aviso ya agregado en
  // Curva S-N (FIX #45, ft_sn -- mismos datos de FT_SN_PRESETS).
  const warnEl = document.getElementById('rr_warnSigma');
  if (p && sigmaA > p.sfp) {
    warnEl.style.display = 'block';
    warnEl.innerHTML = `<strong>Dato fuera de rango:</strong> σ_a (${sigmaA.toFixed(0)} MPa) supera σ'_f (${p.sfp} MPa) del material elegido — la probeta rompería en el primer cuarto de vuelta, no como fatiga.`;
  } else {
    warnEl.style.display = 'none';
  }

  // Contador de ciclos (solo visible mientras corre el paso "en_marcha")
  const contadorEl = document.getElementById('rr_contador');
  if (paso.id === 'en_marcha') {
    const fraccion = rrEstado.esperaTotalSeg > 0
      ? Math.min(1, 1 - (rrEstado.esperaRestanteSeg / rrEstado.esperaTotalSeg))
      : 1;
    const objetivo = obj.infinita ? RR_CICLOS_RUNOUT : obj.Nf;
    const ciclosMostrados = Math.round(fraccion * objetivo);
    contadorEl.style.display = 'block';
    contadorEl.textContent = `N ≈ ${ciclosMostrados.toLocaleString('es-AR')} ciclos (contando…)`;
  } else {
    contadorEl.style.display = 'none';
  }

  const esperando = rrEstado.esperaRestanteSeg > 0;
  const esUltimo = rrEstado.indice === rrEstado.pasos.length - 1;
  const sinContrapeso = paso.id === 'contrapeso' && pesoKg <= 0;
  const btn = document.getElementById('rr_btnSiguiente');
  btn.disabled = !fsmPuedeAvanzar(rrEstado) || esperando || sinContrapeso;
  if (esperando) {
    btn.textContent = 'Contando ciclos…';
  } else if (sinContrapeso) {
    btn.textContent = 'Agregá una plaqueta primero';
  } else if (esUltimo) {
    // FIX (v6.3): con el paso "resultado" ya es verdad que el ensayo
    // terminó -- primera vez que este botón puede decirlo sin mentir.
    btn.textContent = obj.infinita ? 'Ensayo terminado (run-out) ✓' : 'Ensayo terminado (rotura) ✓';
  } else {
    btn.textContent = 'Siguiente paso →';
  }

  const motionHint = paso.id === 'arranque' || paso.id === 'en_marcha';
  const girando = paso.id === 'en_marcha';
  const rota = paso.id === 'resultado' && !obj.infinita;
  document.getElementById('rr_escena').innerHTML = rrSvgEscena(motionHint, girando, rota, editable);
}

function rrSvgEscena(motionHint, girando, rota, editable) {
  const giroHint = motionHint
    ? '<path d="M28,90 A8,8 0 1,1 42,85" fill="none" stroke="var(--muted)" stroke-width="1.2" opacity="0.6"/>' +
      '<path d="M100,100 Q120,90 140,100" fill="none" stroke="var(--muted)" stroke-width="1" stroke-dasharray="2,2" opacity="0.5"/>' +
      '<path d="M100,126 Q120,136 140,126" fill="none" stroke="var(--muted)" stroke-width="1" stroke-dasharray="2,2" opacity="0.5"/>'
    : '';

  // Único elemento que realmente se anima con el giro -- un patrón
  // diagonal deslizante superpuesto sobre la probeta ("poste de
  // barbería"). El contrapeso NUNCA gira (v6.2) -- su posición depende
  // solo de σ_a (v6.4), no del paso actual.
  let probetaHtml;
  if (rota) {
    probetaHtml = `
      <rect x="80" y="106" width="32" height="14" rx="3" fill="var(--border)" opacity="0.7"/>
      <rect x="128" y="106" width="32" height="14" rx="3" fill="var(--border)" opacity="0.7"/>
      <path d="M112,106 L118,113 L114,116 L128,120" fill="none" stroke="var(--frac)" stroke-width="1.5"/>
      <path d="M120,106 L116,98" fill="none" stroke="var(--frac)" stroke-width="1" opacity="0.7"/>
      <path d="M120,120 L124,128" fill="none" stroke="var(--frac)" stroke-width="1" opacity="0.7"/>`;
  } else {
    const probetaGirando = girando
      ? `<defs><pattern id="rrHatch" width="10" height="10" patternUnits="userSpaceOnUse">
           <line x1="0" y1="10" x2="10" y2="0" stroke="var(--surface)" stroke-width="3"/>
           <animateTransform attributeName="patternTransform" type="translate" from="0 0" to="10 0" dur="0.35s" repeatCount="indefinite"/>
         </pattern></defs>
         <rect x="80" y="106" width="80" height="14" rx="3" fill="url(#rrHatch)" opacity="0.55"/>`
      : '';
    probetaHtml = `<rect x="80" y="106" width="80" height="14" rx="3" fill="var(--border)" opacity="0.7"/>${probetaGirando}`;
  }

  // ---- v6.4: brazo + gancho arrastrable + plaquetas apiladas ----
  const hookX = RR_PIVOTE_PX + rrDistanciaM * RR_PX_POR_M;
  const cursorAttr = editable ? ' style="cursor:grab"' : '';
  const dragAttr = editable ? ` onpointerdown="rrArrastrarInicio(event)"` : '';
  // Ancho de cada plaqueta ∝ su peso -- codifica visualmente "más kg" sin
  // necesitar leer el número. Alto fijo, se apilan hacia abajo del gancho.
  const anchoPorKg = { 0.5: 20, 1: 26, 2: 32, 5: 40 };
  let platosHtml = '';
  let yPlato = 120;
  rrPlatos.forEach((kg, i) => {
    const w = anchoPorKg[kg] || 24;
    const clickAttr = editable ? ` onpointerdown="event.stopPropagation();rrQuitarPlato(${i})" style="cursor:pointer"` : '';
    platosHtml += `<rect x="${(hookX - w / 2).toFixed(1)}" y="${yPlato}" width="${w}" height="7" rx="1.5" fill="var(--muted)" opacity="0.85"${clickAttr}/>`;
    yPlato += 9;
  });
  const brazoHtml = `
    <line x1="${RR_PIVOTE_PX}" y1="113" x2="${RR_PIVOTE_PX + RR_BRAZO_PX}" y2="113" stroke="var(--muted)" stroke-width="2"/>
    <line x1="${hookX.toFixed(1)}" y1="113" x2="${hookX.toFixed(1)}" y2="120" stroke="var(--muted)" stroke-width="1.5"/>
    ${platosHtml}
    <circle cx="${hookX.toFixed(1)}" cy="113" r="6"${cursorAttr}${dragAttr} fill="${rrPlatos.length ? 'var(--muted)' : 'none'}" stroke="var(--muted)" stroke-width="1.5"/>`;

  return `
  <svg viewBox="0 0 340 210" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:100%">
    <rect x="15" y="90" width="42" height="46" rx="4" fill="var(--border)" opacity="0.6"/>
    ${giroHint}
    <line x1="57" y1="113" x2="80" y2="113" stroke="var(--muted)" stroke-width="2"/>
    ${probetaHtml}
    <rect x="160" y="98" width="8" height="30" rx="2" fill="var(--border)" opacity="0.6"/>
    ${brazoHtml}
    <text x="170" y="195" text-anchor="middle" font-size="10" fill="var(--muted)">corte esquemático de la máquina R.R. Moore (no a escala)</text>
  </svg>`;
}

function rrInit() {
  rrRender();
}

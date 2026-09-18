// progreso.js — Guardado/progreso local del alumno (Fase 10)
//
// Dos usos pedidos por la cátedra, ambos a la vez:
//   1) Retomar donde dejó: se restaura el material elegido en cada selector
//      sincronizable (reusando MATERIAL_SYNC_TARGETS de material-sync.js,
//      Fase 7 -- cero lista paralela nueva) y la última pestaña principal
//      activa.
//   2) Registro para entregar/evaluar: un log de eventos (cambio de
//      material, ficha técnica generada, gráfico exportado) con fecha/hora,
//      pensado para que el alumno lo exporte y lo entregue.
//
// Vive en un único localStorage bajo PROGRESO_KEY (un objeto, no una clave
// por dato) más un botón de exportar/importar JSON, para que sobreviva a un
// cambio de máquina -- las dos opciones que pidió Agus, no una u otra.
//
// Todo el módulo es best-effort: si localStorage no está disponible (modo
// incógnito con storage deshabilitado, cuota llena, etc.) la app sigue
// funcionando normal, solo se pierde la persistencia entre sesiones -- mismo
// criterio de robustez que ya usaba tests.js para su propio localStorage de
// dev-mode.

const PROGRESO_KEY = 'matyens_progreso_v1';
let PROG_DATA = null;

function progVacio(){
  return { version: 1, alumno: '', ultimaPestana: null, materiales: {}, eventos: [] };
}

function progCargar(){
  try {
    const raw = localStorage.getItem(PROGRESO_KEY);
    if (!raw) return progVacio();
    const data = JSON.parse(raw);
    if (!data || typeof data !== 'object' || !Array.isArray(data.eventos)) return progVacio();
    return { ...progVacio(), ...data };
  } catch(e) {
    return progVacio();
  }
}

// FIX #86 (hallazgo QA v6.21, Etapa 32): progGuardar() se llama automática-
// mente después de cada evento, y ante un fallo de localStorage (cuota
// llena, modo privado estricto) solo hacía console.warn() -- sin ningún
// aviso visible para el alumno, a diferencia del mismo escenario ya resuelto
// en configs.js (FIX #33). El alumno seguía viendo su actividad registrarse
// con normalidad en el panel (PROG_DATA vive en memoria durante la sesión),
// sin ninguna señal de que nada se estaba persistiendo, hasta perderlo todo
// al recargar la página. Se agrega un aviso visible la próxima vez que se
// abre el modal "Mi progreso".
let PROG_GUARDADO_FALLO = false;
function progGuardar(){
  try {
    localStorage.setItem(PROGRESO_KEY, JSON.stringify(PROG_DATA));
    PROG_GUARDADO_FALLO = false;
  } catch(e) {
    console.warn('No se pudo guardar el progreso localmente:', e);
    PROG_GUARDADO_FALLO = true;
  }
}

// Tope de eventos para que una sesión larga no crezca sin límite -- se queda
// con los últimos 200, de sobra para el registro de una clase.
const PROG_MAX_EVENTOS = 200;

function progRegistrar(tipo, detalle){
  if (!PROG_DATA) return;
  PROG_DATA.eventos.push({ ts: new Date().toISOString(), tipo, ...detalle });
  if (PROG_DATA.eventos.length > PROG_MAX_EVENTOS) PROG_DATA.eventos = PROG_DATA.eventos.slice(-PROG_MAX_EVENTOS);
  progGuardar();
}

function progRegistrarPestana(name){
  if (!PROG_DATA) return;
  PROG_DATA.ultimaPestana = name;
  progGuardar();
}

/* ================================================================ INIT */
function progInit(){
  PROG_DATA = progCargar();

  if (typeof MATERIAL_SYNC_TARGETS !== 'undefined') {
    // Restaurar el último material elegido en cada selector sincronizable.
    MATERIAL_SYNC_TARGETS.forEach(t => {
      const val = PROG_DATA.materiales[t.id];
      const el = document.getElementById(t.id);
      if (!val || !el) return;
      const disponible = Array.from(el.options).some(o => o.value === val);
      if (disponible) { el.value = val; t.apply(val); }
    });
    // Enganchar el registro de cambios de material a esos mismos selectores
    // (además del onchange normal ya definido en el HTML -- addEventListener
    // no pisa el atributo onchange, ambos corren).
    MATERIAL_SYNC_TARGETS.forEach(t => {
      const el = document.getElementById(t.id);
      if (!el) return;
      el.addEventListener('change', () => {
        if (!el.value) return;
        PROG_DATA.materiales[t.id] = el.value;
        progRegistrar('material', { pestana: t.label, material: el.value });
      });
    });
  }

  if (PROG_DATA.ultimaPestana) {
    const btn = document.querySelector(`.tab[onclick*="switchTab('${PROG_DATA.ultimaPestana}'"]`);
    if (btn) switchTab(PROG_DATA.ultimaPestana, btn);
  }
}

/* ================================================================ ESCAPE */
function progEsc(s){
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

/* ================================================================ PANEL */
function abrirProgreso(){
  renderProgresoBody();
  document.getElementById('progresoModal').style.display = 'flex';
}
function cerrarProgreso(){
  document.getElementById('progresoModal').style.display = 'none';
}

function progDescribirEvento(ev){
  const nombreMat = (typeof MATERIAL_LABELS !== 'undefined' && MATERIAL_LABELS[ev.material]) || ev.material;
  if (ev.tipo === 'material') return `${progEsc(ev.pestana)}: ${progEsc(nombreMat)}`;
  if (ev.tipo === 'ficha')    return `Ficha técnica generada: ${progEsc(nombreMat)}`;
  if (ev.tipo === 'export')   return `Gráfico exportado: ${progEsc(ev.archivo)}`;
  return progEsc(ev.tipo);
}

function renderProgresoBody(){
  const eventosHtml = PROG_DATA.eventos.length
    ? PROG_DATA.eventos.slice().reverse().map(ev => {
        const hora = new Date(ev.ts).toLocaleString('es-AR');
        return `<div class="prog-row"><span class="prog-hora">${progEsc(hora)}</span><span class="prog-tipo prog-tipo-${progEsc(ev.tipo)}">${progEsc(ev.tipo)}</span><span class="prog-detalle">${progDescribirEvento(ev)}</span></div>`;
      }).join('')
    : '<div class="note">Todavía no hay actividad registrada en esta sesión.</div>';

  document.getElementById('progresoBody').innerHTML = `
    ${PROG_GUARDADO_FALLO ? '<div class="info-bar" style="margin-bottom:10px;border-left-color:var(--neck)"><strong>No se pudo guardar el progreso en este navegador</strong> (almacenamiento lleno o deshabilitado, ej. modo privado estricto). Lo que ves acá es de esta sesión nomás -- exportalo ya si lo necesitás, porque se va a perder al recargar la página.</div>' : ''}
    <div class="field"><label>Nombre (para identificar el registro al exportar)</label>
      <input type="text" id="progAlumnoNombre" value="${progEsc(PROG_DATA.alumno||'')}" placeholder="Opcional" oninput="progActualizarNombre(this.value)">
    </div>
    <div class="note">Este registro queda guardado en este navegador. Si vas a cambiar de máquina, exportalo antes para no perderlo.</div>
    <div class="prog-list">${eventosHtml}</div>
    <div class="no-print" style="margin-top:14px;display:flex;gap:8px;flex-wrap:wrap">
      <button class="btn-secondary" onclick="progExportar()">⬇ Exportar progreso (JSON)</button>
      <button class="btn-secondary" onclick="document.getElementById('progImportInput').click()">⬆ Importar progreso</button>
      <button class="btn-danger" onclick="progBorrar()">🗑 Borrar mi progreso</button>
    </div>
    <input type="file" id="progImportInput" accept="application/json" style="display:none" onchange="progImportar(this)">
  `;
}

function progActualizarNombre(v){
  PROG_DATA.alumno = v;
  progGuardar();
}

function progExportar(){
  const blob = new Blob([JSON.stringify(PROG_DATA, null, 2)], {type:'application/json'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const nombreArchivo = (PROG_DATA.alumno || 'alumno').trim().replace(/\s+/g,'_').toLowerCase() || 'alumno';
  a.href = url; a.download = `progreso_matyens_${nombreArchivo}.json`; a.click();
  URL.revokeObjectURL(url);
}

function progImportar(input){
  const file = input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(reader.result);
      if (!data || typeof data !== 'object' || !Array.isArray(data.eventos)) throw new Error('formato no reconocido');
      PROG_DATA = { ...progVacio(), ...data };
      progGuardar();
      renderProgresoBody();
    } catch(e) {
      alert('El archivo no tiene el formato esperado de un progreso exportado por este simulador.');
    }
    input.value = '';
  };
  reader.readAsText(file);
}

function progBorrar(){
  if (!confirm('¿Borrar todo el progreso guardado en este navegador? Esta acción no se puede deshacer.')) return;
  PROG_DATA = progVacio();
  progGuardar();
  renderProgresoBody();
}

/* ================================================================ COMPARTIR ESCENARIO POR URL (backlog punto F, v5.12) ================================================================
 *
 * Idea: capturar la sub-sección activa AHORA MISMO (la que sea, de
 * cualquiera de las 5 pestañas) junto con los valores actuales de sus
 * campos, armar un link con todo eso en la query string, y poder
 * reconstruir exactamente ese mismo escenario al abrir el link.
 *
 * Alcance deliberado de esta versión (no se construye nada más allá de
 * esto): UNA sub-sección por link, no "todo el simulador configurado" --
 * coincide con cómo se usa en la práctica (el alumno arma un caso en el
 * panel que está mirando y lo comparte), y evita tener que serializar el
 * estado de las ~40 sub-secciones existentes de una sola vez.
 *
 * Reutiliza infraestructura que YA existe, no crea nada paralelo:
 *   - edSwitch/dzSwitch/rtSwitch/cmSwitch (mismo patrón uniforme de las 4
 *     pestañas) para reconstruir la sub-sección activa.
 *   - showSyncMessage (material-sync.js, v4.6) para el toast de
 *     confirmación -- no se creó un sistema de toast nuevo.
 *   - mdMulberry32/mdValorEnRango (modo-desafio.js, v5.8) para reproducir
 *     el defecto oculto EXACTO en un desafío compartido, vía la semilla.
 */

// FIX (v5.14): reorganización de navegación -- "mecanicos" es la única
// pestaña que por dentro combina 3 grupos (Tracción/compresión=ed,
// Dureza=dz, Fractura/fatiga/fluencia=rt) en vez de un prefijo fijo único
// como el resto. Las otras 4 pestañas siguen el patrón viejo de "1 pestaña
// = 1 prefijo" sin cambios.
const CS_TAB_PREFIJO = { end: 'dz', caracterizacion: 'cm', degradacion: 'cm', herramientas: 'ed' }; // FIX #62: clave 'dureza' -> 'end' (tab-dureza se renombró a tab-end; el 'dz' de valor sigue igual, es el prefijo de Corrientes/Ultrasonido/etc., no cambia)
const CS_PREFIJO_SWITCHFN = { ed: 'edSwitch', dz: 'dzSwitch', rt: 'rtSwitch', cm: 'cmSwitch' };
const MEC_GROUP_PREFIJO = { estatica: 'ed', dureza: 'dz', rotura: 'rt' };

// Resuelve el prefijo activo para una pestaña dada. Para "mecanicos" no
// alcanza con el nombre de la pestaña -- depende de cuál de los 3 grupos
// (mec-groupbtn) está activo en ese momento.
function csPrefijoActivo(tab) {
  if (tab === 'mecanicos') {
    const grupoBtn = document.querySelector('.mec-groupbtn.active');
    const grupo = grupoBtn && grupoBtn.dataset.mecgroup;
    return grupo && MEC_GROUP_PREFIJO[grupo];
  }
  return CS_TAB_PREFIJO[tab];
}

function csTabActiva() {
  const pagina = document.querySelector('.page.active');
  return pagina ? pagina.id.replace('tab-', '') : null;
}

// FIX #38 (hallazgo Etapa 2 QA v5.14, mismo problema de raíz que
// dzScopeRoot/edScopeRoot/cmScopeRoot): antes de acotar esos 3 switch a su
// pestaña real, solo podía existir UN .{prefijo}-sub-panel.active en TODO
// el documento a la vez, así que esta consulta sin acotar siempre encontraba
// el correcto. Ahora que dz/ed/cm pueden tener un panel activo propio en
// cada una de sus 2 ubicaciones simultáneamente (correcto para la UI), esta
// consulta sin acotar podía traer el panel de la ubicación EQUIVOCADA (la
// que no se está viendo) -- se acota a la página actualmente visible.
function csSubActiva(prefijo) {
  const pagina = document.querySelector('.page.active');
  if (!pagina) return null;
  const panel = pagina.querySelector(`.${prefijo}-sub-panel.active`);
  return panel ? panel.id.replace(`${prefijo}_panel_`, '') : null;
}

// Captura los campos con id dentro del sidebar de control de la sub-sección
// activa. Se lee directo del DOM (los valores ya renderizados), no de
// variables internas de cada módulo -- así funciona igual sin importar qué
// módulo sea, sin tener que tocar este archivo cada vez que se agregue un
// ensayo nuevo.
function csCapturarEstado() {
  const tab = csTabActiva();
  const prefijo = tab && csPrefijoActivo(tab);
  if (!prefijo) return null;
  const sub = csSubActiva(prefijo);
  if (!sub) return null;

  const ctrl = document.getElementById(`${prefijo}_ctrl_${sub}`);
  if (!ctrl) return null;

  const campos = {};
  ctrl.querySelectorAll('input[id], select[id]').forEach(el => { campos[el.id] = el.value; });

  // Modo desafío (Ultrasonido/Radiografía, v5.8): si está activo, se agrega
  // la semilla del defecto oculto para que quien reciba el link tenga EL
  // MISMO desafío, no uno nuevo al azar.
  if (campos.ut_modo === 'desafio' && typeof UT_DESAFIO !== 'undefined' && UT_DESAFIO.seed != null) {
    campos._ut_seed = String(UT_DESAFIO.seed);
  }
  if (campos.rx_modo === 'desafio' && typeof RX_DESAFIO !== 'undefined' && RX_DESAFIO.seed != null) {
    campos._rx_seed = String(RX_DESAFIO.seed);
  }

  const estado = { tab, sub, campos };
  // FIX (v5.14): si la pestaña activa es "mecanicos", también hay que
  // guardar qué grupo (estatica/dureza/rotura) estaba visible -- sin esto
  // el link reconstruiría la pestaña pero mostraría el grupo por defecto
  // (Tracción y compresión) en vez del que el alumno realmente compartió.
  if (tab === 'mecanicos') {
    const grupoBtn = document.querySelector('.mec-groupbtn.active');
    if (grupoBtn) estado.grupo = grupoBtn.dataset.mecgroup;
  }
  return estado;
}

function csArmarURL(estado) {
  const params = new URLSearchParams();
  params.set('t', estado.tab);
  params.set('s', estado.sub);
  if (estado.grupo) params.set('g', estado.grupo);
  Object.entries(estado.campos).forEach(([k, v]) => params.set(k, v));
  return `${location.origin}${location.pathname}?${params.toString()}`;
}

async function compartirEscenario() {
  const estado = csCapturarEstado();
  if (!estado) {
    if (typeof showSyncMessage === 'function') showSyncMessage('No se pudo identificar una sub-sección activa para compartir.');
    return;
  }
  const url = csArmarURL(estado);
  let copiado = false;
  try {
    await navigator.clipboard.writeText(url);
    copiado = true;
  } catch (e) {
    // Clipboard API puede fallar (permisos del navegador, contexto no
    // seguro, etc.) -- se muestra el link en un prompt para copiar a mano
    // en vez de dejar al alumno sin ninguna forma de conseguirlo.
    prompt('No se pudo copiar automáticamente. Copiá el enlace:', url);
  }
  if (typeof showSyncMessage === 'function') {
    showSyncMessage(copiado ? '🔗 Enlace del escenario actual copiado al portapapeles.' : '🔗 Enlace armado (ver el cuadro para copiarlo).');
  }
  progRegistrar('compartir', { pestana: estado.tab, sub: estado.sub });
}

// Reconstruye el escenario a partir de la query string, si la hay. Se llama
// una vez al cargar la página, DESPUÉS de que todos los *Init() ya corrieron
// (ver el final de app.js) -- así los <select> ya tienen sus <option> y los
// paneles ya existen antes de intentar tocarlos.
function csAplicarDesdeURL(paramsOverride) {
  // FIX v5.12: acepta un URLSearchParams ya armado (paramsOverride) para
  // poder testear el round-trip captura→URL→aplicar sin tener que navegar
  // de verdad a una URL distinta -- en uso normal (llamada desde app.js) se
  // arma a partir de location.search, como siempre.
  const params = paramsOverride || new URLSearchParams(location.search);
  const tab = params.get('t');
  const sub = params.get('s');
  if (!tab || !sub) return;

  const btnTab = document.querySelector(`.tab[onclick*="switchTab('${tab}'"]`);
  switchTab(tab, btnTab);

  // FIX (v5.14): si el link apunta a "mecanicos", primero hay que mostrar
  // el grupo correcto (mecSwitchGroup) -- recién ahí csPrefijoActivo puede
  // resolver bien el prefijo (depende de qué mec-groupbtn quede activo).
  if (tab === 'mecanicos') {
    const grupo = params.get('g');
    if (grupo) mecSwitchGroup(grupo);
  }

  const prefijo = csPrefijoActivo(tab);
  if (!prefijo) return;
  const switchFn = CS_PREFIJO_SWITCHFN[prefijo];
  if (typeof window[switchFn] === 'function') window[switchFn](sub);

  params.forEach((value, key) => {
    if (key === 't' || key === 's' || key === 'g' || key.startsWith('_')) return; // _ut_seed/_rx_seed se manejan aparte
    const el = document.getElementById(key);
    if (!el) return;
    el.value = value;
    // Dispara los mismos eventos que un cambio manual -- cada campo ya
    // tiene su propio onchange/oninput cableado en el HTML, así que no hace
    // falta saber acá qué función de recálculo llamar para cada uno.
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  });

  // Si el link compartía un desafío (UT/RX), reproducir EXACTAMENTE el
  // mismo defecto oculto en vez del nuevo al azar que ya generó el
  // dispatchEvent de ut_modo/rx_modo de arriba (vía utModoToggle/
  // rxModoToggle → utDesafioNuevo()/rxDesafioNuevo() sin semilla).
  const utSeed = params.get('_ut_seed');
  if (utSeed != null && typeof UT_DESAFIO !== 'undefined' && UT_DESAFIO.activo && typeof utDesafioNuevo === 'function') {
    utDesafioNuevo(parseInt(utSeed, 10));
  }
  const rxSeed = params.get('_rx_seed');
  if (rxSeed != null && typeof RX_DESAFIO !== 'undefined' && RX_DESAFIO.activo && typeof rxDesafioNuevo === 'function') {
    rxDesafioNuevo(parseInt(rxSeed, 10));
  }

  if (typeof showSyncMessage === 'function') showSyncMessage('🔗 Escenario cargado desde el enlace.');
}

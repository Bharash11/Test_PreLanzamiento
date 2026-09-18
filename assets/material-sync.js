// material-sync.js — Sincronización cruzada de material entre pestañas
// (Fase 7 — pedido pendiente desde v2.3, retomado ahora que PRESETS ya está
// unificado, ver data-presets.js).
//
// Antes, cada pestaña con selector de material (Tracción, Compresión,
// Temperatura, Dureza x3, Janka, Esclerómetro, Fatiga-Paris) vivía aislada:
// elegir "Acero A36" en Tracción no cambiaba nada en las demás. Con PRESETS
// ya unificado (Fase 1/6a) alcanza con leer las <option> REALES de cada
// <select> destino (no una lista paralela a mano, que se desincroniza con
// el tiempo apenas alguien agregue/saque un material de un <select>) y
// reusar la función applyX() que YA existe para ese selector -- cero lógica
// de cálculo nueva acá, solo el "disparador" cruzado.
//
// Decisiones de UX (conversación con la cátedra, no automático/silencioso):
//   - Botón manual "Aplicar a todos los ensayos", no sync automática al
//     elegir un material -- el alumno puede querer, por ejemplo, comparar
//     Acero (cargado en Tracción) contra Aluminio (ya cargado en
//     Compresión) sin que un cambio en una pestaña le pise la otra sola.
//   - Comparar (c1/c2) y Material compuesto (k1/k2, matriz/refuerzo) NO
//     entran en este registro: tienen DOS materiales simultáneos y no hay
//     "el material actual" único ahí -- sincronizar pisaría un slot al azar
//     sin que sea obvio cuál. Quedan totalmente independientes, como ya
//     estaban.
//   - Si el material no existe en el subconjunto de una pestaña destino
//     (ej. "Oro" no está en Janka porque es un ensayo de maderas, o "Madera"
//     no está en Rockwell/Brinell/Vickers porque esas tablas son de
//     metales), esa pestaña se deja intacta -- no es un error, es
//     esperable -- y el reporte lo lista como "no aplica" para que quede
//     explícito que el simulador lo tuvo en cuenta y no que se olvidó.

// FIX (v4.6 — integración Grupo A al sync, pedido pendiente desde v4.4): los
// selectores de Corrosión y Polímeros SÍ representan "un material" como los
// 9 targets originales, pero con claves de <option> propias del módulo
// (ej. cr_metal usa "hierro", no "acero" como PRESETS) -- fueron elegidas así
// en su momento (v4.3/v4.4) porque cada módulo se armó con su propia tabla de
// datos (CR_METAL_TABLE/PO_POLIMERO_TABLE), sin saber todavía si iban a
// terminar entrando al registro de sync. En vez de renombrar esas claves
// ahora (rompería cualquier estado guardado en progreso.js que referencie el
// valor viejo), `keyMap` traduce PRESETS[x] <-> valor local de ESE <select>
// en las dos direcciones -- clave de PRESETS ausente en el mapa = ese
// material no tiene equivalente real en la tabla del módulo, no es un bug.
//
// Desgaste (ds_par) es un caso más forzado: el <select> no es "un material"
// sino un PAR deslizante contra acero (ver desgaste.js) -- pero como 3 de
// los 8 pares tienen un componente real de PRESETS deslizando contra acero,
// se lo incluye igual con un keyMap parcial (ver DS_KEY_MAP) en vez de
// excluirlo del todo; el alumno sigue pudiendo elegir cualquier par a mano,
// esto solo agrega una forma más rápida de armarlo cuando corresponde.
//
// Tensiones residuales (tr_cal) SÍ queda afuera del registro, igual que
// Comparar/Compuesto: su único <select> es una geometría de roseta de
// calibración (ASTM E837), no un material -- no hay ninguna clave de PRESETS
// razonable a la que mapearlo.
const CR_KEY_MAP = { acero:'hierro', zinc:'zinc', aluminio:'aluminio', cobre:'cobre', niquel:'niquel', magnesio:'magnesio', titanio:'titanio' };
const PO_KEY_MAP = { nylon:'nylon6' };
const DS_KEY_MAP = { acero:'aceroacero', aceroinox:'inoxferr', laton:'laton' };

// FIX (QA v5.5 → v5.6, hallazgo Etapas 8/11): Corrientes inducidas,
// Ultrasonido y Radiografía (Grupo B, v5.1/v5.2/v5.4) representan "un
// material" exactamente igual que Dureza/Janco/Corrosión, pero nunca se
// habían sumado a este registro -- sus botones "🔗 Aplicar a todos los
// ensayos" ya estaban en el HTML (looked-alike de los que sí funcionan) pero
// como `sourceTarget` no existía, el valor local (ej. "aluminio6061") se
// usaba directo como si fuera clave de PRESETS, dando un toast roto
// ("🔗 aluminio6061" en vez de un nombre real, "No se aplicó en ninguna otra
// pestaña"). Mismo criterio que CR/PO/DS de arriba: keyMap solo donde la
// clave local del <select> no coincide textualmente con la de PRESETS.
//
// ECT (Corrientes inducidas): su "aluminio" es aluminio PURO (serie 1100,
// 61% IACS) -- una aleación distinta del "aluminio" genérico de PRESETS, que
// representa 6061-T6 (mismo criterio que ya usan Brinell/Rockwell/Vickers en
// dureza-*.js). El que sí corresponde 1:1 a PRESETS.aluminio es la entrada
// propia "aluminio6061" de ECT_METAL_TABLE. El aluminio puro de ECT queda sin
// equivalente real en PRESETS (no se inventa uno), igual que "acrilico" en UT.
const ECT_KEY_MAP = { cobre:'cobre', laton:'laton', aceroinox:'aceroinox', titanio:'titanio', aluminio:'aluminio6061' };
// UT (Ultrasonido): "acrilico" (PMMA, bloque de calibración) no tiene
// equivalente en PRESETS -- se deja fuera del mapa a propósito, mismo
// criterio que el resto de esta fase.
const UT_KEY_MAP = { acero:'acero', aceroinox:'aceroinox', aluminio:'aluminio', laton:'laton', cobre:'cobre' };
// RX (Radiografía): las 4 claves de RX_MATERIAL_TABLE coinciden 1:1 con
// PRESETS (incluido "plomo", que sí existe como material propio en
// data-presets.js) -- se lista igual el keyMap completo en vez de omitirlo,
// porque si el target NO tiene keyMap, keyToLocal/localToKey devuelven la
// clave tal cual sin pasar por ninguna validación explícita; ser explícitos
// acá deja documentado que la correspondencia se revisó a mano.
const RX_KEY_MAP = { acero:'acero', aluminio:'aluminio', tungsteno:'tungsteno', plomo:'plomo' };

// Registro único de selectores sincronizables. `label` es lo que se muestra
// en el reporte del toast; `apply` reusa la función que YA aplica ese
// preset a esa pestaña (la misma que dispara el onchange normal del
// <select> cuando el alumno lo cambia a mano). `keyMap` es opcional: solo lo
// llevan los targets cuyo <select> no usa las claves de PRESETS tal cual
// (ver comentario arriba) -- para el resto, ausente = clave local == clave
// de PRESETS, como siempre.
//
// FIX #63 (hallazgo A2-01): 5 selectores de material del simulador quedan
// deliberadamente FUERA de este registro, sin que hasta ahora hubiera un
// comentario que lo explicara (a diferencia de Comparar/Compuesto/
// Tensiones residuales, ya documentados más abajo). Quedan afuera por dos
// motivos distintos, verificados uno por uno:
//   - rt_impactoMat (Fractura-Impacto) y fl_mat1/fl_mat2 (Fluencia): sus
//     opciones son ARQUETIPOS de comportamiento (familia cristalina BCC/
//     FCC, austenítico/superaleación/aluminio), no aleaciones puntuales
//     con E/σy/TS -- no hay ninguna clave de PRESETS a la que mapearlos.
//   - ft_snMat (Fatiga, curva S-N) y rr_mat (R.R. Moore, comparten la
//     misma tabla): "acero4340" y "al2014" NO son alias de "acero4140" ni
//     de "aluminio2024/7075" de PRESETS -- son aleaciones DISTINTAS
//     (4340≠4140, 2014≠2024/7075). Mapearlos igual sería incorrecto, no
//     una simplificación razonable.
const MATERIAL_SYNC_TARGETS = [
  { id: 'e_preset',    label: 'Tracción',               apply: () => applyPreset('e') },
  { id: 'co_preset',   label: 'Compresión',             apply: () => applyPresetComp0() },
  { id: 't_preset',    label: 'Temperatura',            apply: (v) => applyPreset('t', v) },
  { id: 'dz_rkMat',    label: 'Dureza — Rockwell',      apply: () => dzApplyRockwellMaterial() },
  { id: 'dz_brMat',    label: 'Dureza — Brinell',       apply: () => dzApplyBrinellMaterial() },
  { id: 'dz_vMat',     label: 'Dureza — Vickers',       apply: () => dzApplyVickersMaterial() },
  // FIX #77 (hallazgo QA v6.21, Etapa 10): Knoop no tenía selector de
  // material propio (a diferencia de sus 3 escalas hermanas) -- se agrega
  // como fila independiente, mismo criterio que Vickers/Brinell/Rockwell.
  { id: 'dz_kMat',     label: 'Dureza — Knoop',         apply: () => dzApplyKnoopMaterial() },
  { id: 'dz_jkMat',    label: 'Dureza — Janka',         apply: () => dzApplyJankaMaterial() },
  { id: 'dz_scMat',    label: 'Dureza — Esclerómetro',  apply: () => dzApplyScleroMaterial() },
  // FIX v5.9 (backlog punto C): apply pasa a llamar a xxMaterialToggle() en
  // vez de xxUpdate() directamente. Motivo: si el alumno estaba en "Otro
  // (ingresar manualmente)" cuando llega un sync desde otra pestaña, el
  // <select> pasa a un material real de la tabla, y el input crudo (σ/v/HVL)
  // tiene que ocultarse -- xxMaterialToggle() ya hace ese show/hide antes de
  // llamar a xxUpdate() internamente, así que alcanza con cambiar acá.
  { id: 'ect_metal',   label: 'Ensayo no destructivo — Corrientes inducidas', keyMap: ECT_KEY_MAP, apply: () => ectMetalToggle() },
  { id: 'ut_metal',    label: 'Ensayo no destructivo — Ultrasonido',          keyMap: UT_KEY_MAP,  apply: () => utMaterialToggle() },
  { id: 'rx_material', label: 'Ensayo no destructivo — Radiografía',          keyMap: RX_KEY_MAP,  apply: () => rxMaterialToggle() },
  { id: 'ft_parisMat', label: 'Fatiga — Ley de Paris',  apply: () => ftApplyParisPreset() },
  // FIX (v5.14): labels actualizados tras la reorganización de navegación --
  // Corrosión, Polímeros y Desgaste se movieron de "Ensayos complementarios"
  // a la nueva pestaña "Degradación y comportamiento en servicio".
  { id: 'cr_metal',    label: 'Degradación y comportamiento en servicio — Corrosión', keyMap: CR_KEY_MAP, apply: () => crSetMetal() },
  { id: 'po_polimero', label: 'Degradación y comportamiento en servicio — Polímeros', keyMap: PO_KEY_MAP, apply: () => poUpdate() },
  { id: 'ds_par',      label: 'Degradación y comportamiento en servicio — Desgaste',  keyMap: DS_KEY_MAP, apply: () => dsSetPar() },
];

// Traduce clave PRESETS -> valor local de un target (usa keyMap si lo tiene;
// si no, la clave de PRESETS y el valor del <select> son la misma cosa).
// Devuelve undefined si ese material no tiene equivalente en ese módulo.
function keyToLocal(target, key) {
  return target.keyMap ? target.keyMap[key] : key;
}
// Traduce valor local de un target -> clave PRESETS (inversa de keyToLocal).
// Se arma una sola vez por target y se cachea en el propio objeto.
function localToKey(target, localVal) {
  if (!target.keyMap) return localVal;
  if (!target._invKeyMap) {
    target._invKeyMap = {};
    Object.entries(target.keyMap).forEach(([k, v]) => { target._invKeyMap[v] = k; });
  }
  return target._invKeyMap[localVal];
}

// Aplica el material actualmente elegido en `sourceId` a todas las demás
// pestañas del registro que lo tengan disponible como opción real de su
// <select> (no se asume nada: se revisa el DOM en el momento del click, así
// que sigue siendo correcto aunque a futuro se agreguen/saquen materiales
// de algún <select> puntual sin tocar este archivo).
function syncMaterialToAllTests(sourceId) {
  const srcEl = document.getElementById(sourceId);
  if (!srcEl) return;
  const localVal = srcEl.value;
  if (!localVal) {
    showSyncMessage('Elegí un material en este selector antes de aplicarlo a las demás pestañas.');
    return;
  }

  // El "key" canónico es siempre una clave de PRESETS -- si el origen tiene
  // keyMap (ej. cr_metal), se traduce su valor local a esa clave antes de
  // recorrer el resto del registro.
  const sourceTarget = MATERIAL_SYNC_TARGETS.find(t => t.id === sourceId);
  const key = sourceTarget ? localToKey(sourceTarget, localVal) : localVal;
  if (!key) {
    showSyncMessage('Este material no tiene un equivalente en la tabla general de materiales, así que no se puede usar como origen del sync.');
    return;
  }

  const aplicados = [];
  const noDisponibles = [];
  MATERIAL_SYNC_TARGETS.forEach(target => {
    if (target.id === sourceId) return; // no reaplicar sobre el mismo selector que originó el sync
    const el = document.getElementById(target.id);
    if (!el) return; // selector no presente en este DOM (robustez ante cambios futuros)
    const val = keyToLocal(target, key);
    const disponible = val != null && Array.from(el.options).some(o => o.value === val);
    if (disponible) {
      el.value = val;
      target.apply(val);
      aplicados.push(target.label);
    } else {
      noDisponibles.push(target.label);
    }
  });

  const nombre = (typeof MATERIAL_LABELS !== 'undefined' && MATERIAL_LABELS[key]) || key;
  showSyncReport(nombre, aplicados, noDisponibles);
}

/* ================================================================ TOAST */
// Toast simple, no bloqueante, se autodescarta -- reusa el mismo <div> para
// no acumular nodos si el docente clickea el botón varias veces seguidas.
let syncToastTimer = null;

function getSyncToastEl() {
  let box = document.getElementById('matSyncToast');
  if (!box) {
    box = document.createElement('div');
    box.id = 'matSyncToast';
    box.className = 'mat-sync-toast';
    document.body.appendChild(box);
  }
  return box;
}

function showSyncMessage(text) {
  const box = getSyncToastEl();
  box.innerHTML = `<div class="mat-sync-toast-row">${text}</div>
    <button type="button" class="mat-sync-toast-close" onclick="hideSyncToast()">✕</button>`;
  box.classList.add('show');
  clearTimeout(syncToastTimer);
  syncToastTimer = setTimeout(hideSyncToast, 5000);
}

function showSyncReport(nombre, aplicados, noDisponibles) {
  const box = getSyncToastEl();
  let html = `<div class="mat-sync-toast-title">🔗 ${nombre}</div>`;
  html += aplicados.length
    ? `<div class="mat-sync-toast-row"><span class="ok">✓ Aplicado en:</span> ${aplicados.join(', ')}</div>`
    : `<div class="mat-sync-toast-row"><span class="warn">— No se aplicó en ninguna otra pestaña.</span></div>`;
  if (noDisponibles.length) {
    html += `<div class="mat-sync-toast-row"><span class="warn">— No aplica en:</span> ${noDisponibles.join(', ')}</div>`;
  }
  html += `<button type="button" class="mat-sync-toast-close" onclick="hideSyncToast()">✕</button>`;
  box.innerHTML = html;
  box.classList.add('show');
  clearTimeout(syncToastTimer);
  syncToastTimer = setTimeout(hideSyncToast, 7000);
}

function hideSyncToast() {
  const box = document.getElementById('matSyncToast');
  if (box) box.classList.remove('show');
}

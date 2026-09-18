// app.js — switchTab, sidebar, detección de dispositivo, modo desarrollador (siempre cargado)

/* ============================================================ TAB SWITCH */
function switchTab(name, el){
  document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
  document.querySelectorAll('.tab').forEach(t=>t.classList.remove('active'));
  document.getElementById('tab-'+name).classList.add('active');
  if(el) el.classList.add('active');
  // FIX (Fase 10): registrar la pestaña activa para "retomar donde dejó" en
  // la próxima sesión. Guardado, no typeof-guard porque progreso.js siempre
  // se carga junto con app.js (mismo orden que material-sync.js).
  if (typeof progRegistrarPestana === 'function') progRegistrarPestana(name);
}

/* ============================================================ MEC GROUP SWITCH */
// FIX (v5.14): reorganización de navegación -- dentro de la pestaña "Ensayos
// mecánicos" viven 3 grupos que antes eran pestañas separadas (Tracción y
// compresión / Dureza / Fractura, fatiga y fluencia), cada uno con su propio
// subnav y switch function sin tocar (edSwitch/dzSwitch/rtSwitch siguen
// funcionando exactamente igual que antes, ninguno sabe que ahora conviven
// en la misma pestaña). Esta función solo decide cuál de los 3 grupos se ve.
function mecSwitchGroup(group){
  document.querySelectorAll('.mec-groupbtn').forEach(b=>b.classList.toggle('active', b.dataset.mecgroup===group));
  document.querySelectorAll('.mec-group-aside').forEach(c=>c.classList.toggle('active', c.dataset.mecgroup===group));
  document.querySelectorAll('.mec-group-main').forEach(c=>c.classList.toggle('active', c.dataset.mecgroup===group));
}

/* ============================================================ INIT */
updateDerived();
updateCompDerived();
drawProbeta(0,'elastic');
drawCompProbeta(0);
applyPreset2(1,'acero');
applyPreset2(2,'aluminio');
applyPresetComp0();   // FIX #2: sincronizar preset inicial de compresión con Acero A36
renderSavedList();
setTimeout(()=>{ renderCompare(); renderTemp(); },200);
dzInit();
ectInit(); // FIX (v5.1): Corrientes inducidas (eddy current), 1er ensayo del Grupo B, en la pestaña "Ensayo no destructivo"
utInit(); // FIX (v5.2): Ultrasonido (pulso-eco), 2do ensayo del Grupo B, en la pestaña "Ensayo no destructivo"
rxInit(); // FIX (v5.4): Radiografía (Beer-Lambert, Ir-192), 4to ensayo del Grupo B, en la pestaña "Ensayo no destructivo"
pnMtInit(); // FIX (v5.5): Líquidos penetrantes + Partículas magnéticas (máquina de estados), 5to ensayo del Grupo B
frInit();
// FIX #51 (hallazgo QA v6.9, Etapa 1): este comentario decía "(v6.7)" --
// el CHANGELOG ubica el péndulo Charpy en v6.8. Corregido para que quien
// busque "qué se cambió en v6.8" por comentario de código llegue bien acá.
chInit(); // FIX (v6.8): pendulo Charpy interactivo -- reusa FR_IMPACTO_PRESETS/frSigmoid/rtImpactoChartInst de fractura.js, cargado antes
ftInit();
rrInit(); // FIX (v6.1): máquina de fatiga rotativa R.R. Moore, pasos 1-3 (montaje/contrapeso/arranque)
flInit();
dsInit(); // FIX (v4.1): Desgaste (Archard), 1er ensayo de la pestaña "Ensayos complementarios"
trInit(); // FIX (v4.2): Tensiones residuales (hole-drilling), 2do ensayo de esa pestaña
crInit(); // FIX (v4.3): Corrosión (Faraday/ASTM G102), 3er ensayo de esa pestaña
poInit(); // FIX (v4.4): Polímeros (curva DMA), 4to y último ensayo del Grupo A
mgInit(); // FIX (v5.3): Metalografía (ASTM E112 + micrografía Voronoi), 3er ensayo del Grupo B, en "Ensayos complementarios"
// FIX (Fase 10): progInit() va al final del bloque de init para restaurar
// último material por selector y última pestaña activa DESPUÉS de que todos
// los valores por defecto (applyPreset2, applyPresetComp0, dzInit, etc.) ya
// se aplicaron -- mismo criterio de orden que ya usaba applyPresetComp0
// (comentario FIX #2 arriba) para no pisarse con el resto del init.
progInit();

// FIX v5.12 (backlog punto F): csAplicarDesdeURL() va al final de todo,
// después de progInit() -- si el link trae un escenario compartido, tiene
// que ganarle a "retomar donde dejé" (progInit), no al revés. El pequeño
// delay es el mismo criterio que ya usa el setTimeout de renderCompare/
// renderTemp de arriba: evita pisarse con esos dos renders diferidos si el
// link comparte justamente esa sub-sección.
setTimeout(csAplicarDesdeURL, 250);


/* ============================================================ RESPONSIVE / DEVICE DETECTION v5 */
(function() {
  function detectDevice() {
    const ua = navigator.userAgent;
    const w = window.innerWidth;
    const isTabletUA = /iPad|tablet|Kindle|PlayBook/i.test(ua) || (/Android/i.test(ua) && !/Mobile/i.test(ua));
    const isMobileUA = /iPhone|iPod|Android.*Mobile|BlackBerry|IEMobile|Opera Mini/i.test(ua);
    const isTouch = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
    const isTablet = isTabletUA || (isTouch && w > 720 && w <= 1200);
    // FIX (detección de dispositivo): isMobile se evaluaba antes que isTablet en el
    // if/else de más abajo, y como isMobile solo miraba el ancho (w<=720) sin excluir
    // los casos ya confirmados como tablet por User-Agent, un iPad o tablet Android en
    // modo Split View / multitarea (viewport angosto) quedaba mal etiquetado como "Móvil".
    // Ahora isMobile respeta la detección explícita de tablet por UA.
    const isMobile = isMobileUA || (!isTabletUA && w <= 720);
    const orientation = window.innerWidth > window.innerHeight ? 'horizontal' : 'vertical';

    const icon  = document.getElementById('deviceIcon');
    const label = document.getElementById('deviceLabel');
    const badge = document.getElementById('deviceBadge');
    if (!icon || !label) return;

    let type, iconSVG, color;
    if (isMobile) {
      type = 'Móvil';
      iconSVG = '<rect x="5" y="2" width="14" height="20" rx="2"/><line x1="12" y1="18" x2="12" y2="18.01" stroke-width="3"/>';
      color = '#c8780a';
    } else if (isTablet) {
      type = 'Tablet';
      iconSVG = '<rect x="4" y="2" width="16" height="20" rx="2"/><line x1="12" y1="18" x2="12" y2="18.01" stroke-width="3"/>';
      color = '#7b2fa8';
    } else {
      type = 'Escritorio';
      iconSVG = '<rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/>';
      color = 'var(--accent)';
    }

    const oriLabel = isMobile || isTablet ? ` · ${orientation === 'horizontal' ? '⟺' : '↕'}` : '';
    const touchLabel = isTouch && !isMobile ? ' · táctil' : '';
    label.textContent = type + oriLabel + touchLabel;
    icon.innerHTML = iconSVG;
    icon.style.stroke = color;
    if (badge) badge.title = `UA: ${ua.slice(0,80)}… | ${w}×${window.innerHeight}px | touch:${isTouch}`;

    // Ajustar comportamiento según dispositivo
    document.body.dataset.device = isMobile ? 'mobile' : isTablet ? 'tablet' : 'desktop';
  }
  detectDevice();
  window.addEventListener('resize', detectDevice);
  window.addEventListener('orientationchange', () => setTimeout(detectDevice, 200));
})();

/* ============================================================ SIDEBAR DRAWER */
function openSidebar() {
  // Find the active page's sidebar
  const activePage = document.querySelector('.page.active');
  if (!activePage) return;
  const sidebar = activePage.querySelector('.sidebar');
  if (sidebar) sidebar.classList.add('open');
  const overlay = document.getElementById('drawerOverlay');
  if (overlay) overlay.classList.add('open');
  document.body.style.overflow = 'hidden';
}
function closeSidebar() {
  document.querySelectorAll('.sidebar').forEach(s => s.classList.remove('open'));
  const overlay = document.getElementById('drawerOverlay');
  if (overlay) overlay.classList.remove('open');
  document.body.style.overflow = '';
}
// Close sidebar when tab changes
const origSwitchTab = window.switchTab;
window.switchTab = function(name, el) {
  closeSidebar();
  origSwitchTab(name, el);
};

/* ============================================================ TEST PANEL */
// FIX #27: el panel de test es una herramienta de QA para el docente, no para
// los alumnos -- antes había un botón "🧪 Tests" siempre visible en el header
// para cualquiera que abriera el simulador. Ahora el botón arranca oculto
// (display:none) y el número de versión funciona como gatillo de "modo
// desarrollador": 5 clicks en menos de 2 segundos muestran/ocultan el botón.
let verClickCount = 0;
let verClickTimer = null;
function handleVerBadgeClick() {
  verClickCount++;
  if (verClickTimer) clearTimeout(verClickTimer);
  verClickTimer = setTimeout(() => { verClickCount = 0; }, 2000);
  if (verClickCount >= 5) {
    verClickCount = 0;
    clearTimeout(verClickTimer);
    const btn = document.getElementById('testHeaderBtn');
    if (!btn) return;
    const showing = btn.style.display !== 'none';
    btn.style.display = showing ? 'none' : 'inline-flex';
    if (showing) {
      const panel = document.getElementById('testPanel');
      if (panel) panel.style.display = 'none';
    }
  }
}
// v2.8 (fix): testSuite/runAllTests viven en tests.js (~485 líneas), un archivo
// aparte que NO se carga en el arranque de la página -- solo el docente en modo
// desarrollador llega a necesitarlo. La versión anterior de este fix pasaba
// `runAllTests` como argumento a ensureTestsLoaded(), pero ese argumento se
// evalúa ANTES de que tests.js termine de cargar (todavía es `undefined` en
// ese momento), así que el callback terminaba siendo undefined() y no hacía
// nada -- por eso el botón "Ejecutar todos los tests" no mostraba resultados.
// Ahora `runAllTests` es su propio "loader": si tests.js no cargó, lo inyecta
// y se vuelve a llamar a sí misma apenas termina -- en ese momento ya quedó
// redefinida por la función real que trae tests.js, así que la 2da llamada
// ejecuta la lógica de verdad. Funciona sin importar qué botón se toque primero.
let testsScriptLoaded = false;
let testsScriptLoading = false;
function runAllTests() {
  if (testsScriptLoading) return;
  testsScriptLoading = true;
  const s = document.createElement('script');
  s.src = 'assets/tests.js';
  s.onload = () => {
    testsScriptLoaded = true;
    testsScriptLoading = false;
    runAllTests(); // esta llamada ya ejecuta la versión real (tests.js la redefinió)
  };
  s.onerror = () => {
    testsScriptLoading = false;
    const log = document.getElementById('testLog');
    if (log) log.textContent = 'No se pudo cargar tests.js (¿se movió el archivo o se abrió sin las demás piezas de la carpeta?).';
  };
  document.head.appendChild(s);
}
function toggleTestPanelFromHeader() {
  const panel = document.getElementById('testPanel');
  if (!panel) return;
  panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
  if (panel.style.display === 'block') {
    panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    runAllTests();
  }
}
function toggleTestPanel() {
  const body = document.getElementById('testPanelBody');
  const icon = document.getElementById('tpToggleIcon');
  if (!body) return;
  body.classList.toggle('open');
  icon.textContent = body.classList.contains('open') ? '▲' : '▼';
}
function clearTestLog() {
  const log = document.getElementById('testLog');
  if (log) log.innerHTML = 'Log limpiado.';
  const grid = document.getElementById('testGrid');
  if (grid) grid.innerHTML = '';
  const summary = document.getElementById('testSummary');
  if (summary) summary.innerHTML = '';
  const badge = document.getElementById('tpBadge');
  if (badge) { badge.textContent = '—'; badge.style.background = ''; badge.style.color = ''; }
}


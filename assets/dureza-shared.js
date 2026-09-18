// dureza-shared.js — datos y helpers compartidos por todas las escalas de dureza (interpolación, switch de sub-tabs)

// dureza.js — Módulo 2: escalas de dureza (Mohs, Rockwell, Brinell, Vickers, Janka, esclerómetro)

/* ============================================================ MODULO 2: DUREZA */

const DZ_MOHS = [
  [10,'Diamante'],[9,'Corindón'],[8,'Topacio'],[7,'Cuarzo'],[6,'Ortoclasa'],
  [5,'Apatita'],[4,'Fluorita'],[3,'Calcita'],[2,'Yeso'],[1,'Talco']
];

const DZ_RK_NORMAL = [
  ['A','Diamante',60],['B','Bola de 1/16 pulg.',100],['C','Diamante',150],
  ['D','Diamante',100],['E','Bola de 1/8 pulg.',100],['F','Bola de 1/16 pulg.',60],
  ['G','Bola de 1/16 pulg.',150],['H','Bola de 1/8 pulg.',60],['K','Bola de 1/8 pulg.',150]
];
const DZ_RK_SUPERFICIAL = [
  ['15N','Diamante',15],['30N','Diamante',30],['45N','Diamante',45],
  ['15T','Bola de 1/16 pulg.',15],['30T','Bola de 1/16 pulg.',30],['45T','Bola de 1/16 pulg.',45],
  ['15W','Bola de 1/8 pulg.',15],['30W','Bola de 1/8 pulg.',30],['45W','Bola de 1/8 pulg.',45]
];

// Approximate reference conversion points for steels (illustrative, standard published table)
const DZ_CONV_POINTS = [
  {hrc:20, hb:226, ts_mpa:772},
  {hrc:25, hb:253, ts_mpa:840},
  {hrc:30, hb:286, ts_mpa:1015},
  {hrc:35, hb:327, ts_mpa:1160},
  {hrc:40, hb:371, ts_mpa:1310},
  {hrc:45, hb:428, ts_mpa:1500},
  {hrc:50, hb:481, ts_mpa:1720},
  {hrc:55, hb:562, ts_mpa:1980},
  {hrc:60, hb:654, ts_mpa:2280},
  {hrc:65, hb:739, ts_mpa:2600}
];

let dzRkSelected = null;
let dzTsChartInst = null;

function dzInterp(scaleKey, val, targetKey){
  const arr = DZ_CONV_POINTS.map(p=>({x:p[scaleKey], y:p[targetKey]})).sort((a,b)=>a.x-b.x);
  if(val<=arr[0].x) return arr[0].y;
  if(val>=arr[arr.length-1].x) return arr[arr.length-1].y;
  for(let i=0;i<arr.length-1;i++){
    if(val>=arr[i].x && val<=arr[i+1].x){
      const t = (val-arr[i].x)/(arr[i+1].x-arr[i].x);
      return arr[i].y + t*(arr[i+1].y-arr[i].y);
    }
  }
}

// FIX #38 (hallazgo Etapa 2 QA v5.14): dzSwitch/edSwitch/cmSwitch operaban
// sobre TODO el documento (querySelectorAll sin acotar), lo cual no traía
// problemas mientras cada prefijo vivía en un solo lugar del DOM. La
// reorganización de v5.14 hizo que 3 prefijos pasaran a compartirse entre
// DOS ubicaciones físicas distintas (ver mapeo abajo), así que interactuar
// en una apagaba en silencio el sub-panel activo por defecto de la otra --
// al navegar a esa otra pestaña, quedaba sin ningún sub-panel visible hasta
// que el alumno clickeaba algo ahí de nuevo. Fix: cada switch ahora resuelve
// primero CUÁL de sus dos ubicaciones posibles está realmente visible y
// acota los querySelectorAll a esa raíz, en vez de a `document` entero.
// Mismo criterio para los 3 (dz/ed/cm) -- ver dzScopeRoot/edScopeRoot abajo
// y cmScopeRoot en desgaste.js.
// Ojo: `.mec-group-main` conserva su clase `active` aunque el alumno haya
// navegado a otra pestaña -- switchTab() solo toca `.page`/`.tab`, nunca los
// mec-group-main (eso es tarea de mecSwitchGroup, que no se vuelve a llamar
// solo por cambiar de pestaña). Por eso NO alcanza con mirar si el grupo
// tiene `active`: hay que confirmar además que "Ensayos mecánicos" sea la
// página actualmente visible, o un dz/edSwitch disparado ya en Herramientas
// o en Ensayo no destructivo terminaría escribiendo, por error, sobre el
// grupo de Ensayos mecánicos que quedó con la clase pisada de la última vez.
// FIX #62 (QA exhaustivo v6.13, etapa 9): el id de esta pestaña era
// "tab-dureza" y el argumento de switchTab() era 'dureza' desde antes de
// que Corrientes/Ultrasonido/Radiografía/Líquidos/Partículas se separaran
// de Dureza en dos secciones distintas (Dureza terminó viviendo dentro de
// "Ensayos mecánicos", esta pestaña quedó solo con los 5 ensayos no
// destructivos) -- el nombre interno nunca se actualizó y quedó mintiendo
// sobre lo que la pestaña contiene. Renombrado a 'end' (Ensayo No
// Destructivo, la sigla real de cátedra) / #tab-end en todo el proyecto.
function dzScopeRoot(){
  // dz: grupo "Dureza" dentro de "Ensayos mecánicos" (mec-group-main) vs.
  // pestaña "Ensayo no destructivo" (#tab-end).
  const tabMecanicos = document.getElementById('tab-mecanicos');
  if (tabMecanicos && tabMecanicos.classList.contains('active')) {
    const durezaGroup = document.querySelector('.mec-group-main[data-mecgroup="dureza"]');
    if (durezaGroup && durezaGroup.classList.contains('active')) return durezaGroup;
  }
  return document.getElementById('tab-end') || document;
}
function edScopeRoot(){
  // ed: grupo "Tracción y compresión" dentro de "Ensayos mecánicos" vs.
  // pestaña "Herramientas".
  const tabMecanicos = document.getElementById('tab-mecanicos');
  if (tabMecanicos && tabMecanicos.classList.contains('active')) {
    const estaticaGroup = document.querySelector('.mec-group-main[data-mecgroup="estatica"]');
    if (estaticaGroup && estaticaGroup.classList.contains('active')) return estaticaGroup;
  }
  return document.getElementById('tab-herramientas') || document;
}
// FIX #41 (hallazgo Etapa 3 QA v6.5): dzScopeRoot/edScopeRoot devuelven UNA
// sola raíz (.mec-group-main[...]), asumiendo que ahí viven los 3 selectores
// que dz/edSwitch necesitan acotar (.dz-subbtn, .dz-sub-panel, .dz-sub-ctrl).
// Eso vale para subbtn/sub-panel, pero NO para sub-ctrl: desde la
// reorganización de v5.14/v5.15, los controles de la izquierda (dz_ctrl_*/
// ed_ctrl_*) viven en un contenedor HERMANO -- .mec-group-aside[data-mecgroup],
// no un descendiente de .mec-group-main. El querySelectorAll('.dz-sub-ctrl')
// acotado a .mec-group-main no encontraba NINGÚN sub-ctrl (ni para
// desactivar el viejo ni para activar el nuevo), así que el panel izquierdo
// quedaba pegado en el que estuviera activo por defecto (Mohs / Tracción)
// sin importar qué sub-sección se eligiera -- el panel derecho (dz_panel_*)
// sí cambiaba porque ese sí vive dentro de .mec-group-main. Fix: resolver
// una raíz aparte para el aside, con la misma lógica de fallback a la
// pestaña completa (ND / Herramientas) que ya usan dzScopeRoot/edScopeRoot.
function dzAsideRoot(){
  const tabMecanicos = document.getElementById('tab-mecanicos');
  if (tabMecanicos && tabMecanicos.classList.contains('active')) {
    const durezaAside = document.querySelector('.mec-group-aside[data-mecgroup="dureza"]');
    if (durezaAside && durezaAside.classList.contains('active')) return durezaAside;
  }
  return document.getElementById('tab-end') || document;
}
function edAsideRoot(){
  const tabMecanicos = document.getElementById('tab-mecanicos');
  if (tabMecanicos && tabMecanicos.classList.contains('active')) {
    const estaticaAside = document.querySelector('.mec-group-aside[data-mecgroup="estatica"]');
    if (estaticaAside && estaticaAside.classList.contains('active')) return estaticaAside;
  }
  return document.getElementById('tab-herramientas') || document;
}

/* ---------------- SUB-NAV ---------------- */
function dzSwitch(name){
  const root = dzScopeRoot();
  const asideRoot = dzAsideRoot();
  root.querySelectorAll('.dz-subbtn').forEach(b=>b.classList.toggle('active', b.dataset.dz===name));
  root.querySelectorAll('.dz-sub-panel').forEach(p=>p.classList.toggle('active', p.id==='dz_panel_'+name));
  asideRoot.querySelectorAll('.dz-sub-ctrl').forEach(c=>c.classList.toggle('active', c.id==='dz_ctrl_'+name));
}

/* ---------------- SUB-NAV (Ensayo destructivo) ---------------- */
function edSwitch(name){
  const root = edScopeRoot();
  const asideRoot = edAsideRoot();
  root.querySelectorAll('.ed-subbtn').forEach(b=>b.classList.toggle('active', b.dataset.ed===name));
  root.querySelectorAll('.ed-sub-panel').forEach(p=>p.classList.toggle('active', p.id==='ed_panel_'+name));
  asideRoot.querySelectorAll('.ed-sub-ctrl').forEach(c=>c.classList.toggle('active', c.id==='ed_ctrl_'+name));
  if(name==='configuraciones') { renderSavedList(); updateCurrentConfigDisplay(); }
}

/* ---------------- 1. MOHS ---------------- */

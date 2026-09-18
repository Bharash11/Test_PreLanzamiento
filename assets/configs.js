// configs.js — Tab 7: guardar/cargar configuraciones (localStorage)

/* ============================================================ TAB 7: SAVED CONFIGS */
// FIX #33: localStorage.setItem/removeItem pueden tirar una excepción real
// (storage lleno, modo privado que lo deshabilita, políticas de PCs de aula)
// -- antes solo la LECTURA (getSavedConfigs) estaba protegida con try/catch.
// Este helper centraliza la escritura seguriza y avisa in-line si falla, en
// vez de dejar una excepción sin manejar en la consola sin que el usuario se
// entere de que su guardado/borrado no se aplicó.
function safeLocalStorageWrite(fn, warnEl){
  try { fn(); return true; }
  catch(e) {
    if (warnEl) {
      warnEl.style.display='block';
      warnEl.textContent='No se pudo guardar en este navegador (almacenamiento lleno o deshabilitado). Probá liberar espacio o revisar el modo privado.';
    }
    return false;
  }
}

function saveConfig() {
  const name=document.getElementById('cfg_name').value.trim();
  const warnEl=document.getElementById('cfg_warn');
  // FIX #19: antes se usaba alert() nativo bloqueante, el único lugar de toda
  // la app con ese patrón. Se reemplaza por el mismo tipo de aviso inline que
  // se usa en el resto de la UI (help/ficha/paneles internos).
  if(!name){
    warnEl.style.display='block';
    warnEl.textContent='Ingresá un nombre para la configuración.';
    return;
  }
  const saved=getSavedConfigs();
  // FIX #18: se avisa (sin bloquear) si ya existe una config con ese nombre,
  // para que el usuario no pierda de vista que puede tener duplicados.
  const dup = saved.some(c=>c.name===name);
  const cfg={
    name,
    date:new Date().toLocaleString('es-AR'),
    E:document.getElementById('e_E').value,
    sy:document.getElementById('e_sy').value,
    ts:document.getElementById('e_ts').value,
    el:document.getElementById('e_el').value,
    nu:document.getElementById('e_nu').value,
    l0:document.getElementById('e_l0').value,
    // FIX #16: antes solo se guardaba el número crudo de l0/d0 y nunca la
    // unidad elegida (mm/cm/in) ni un A0 explícito -- si el usuario cambiaba
    // de unidad entre guardar y cargar, el mismo número se reinterpretaba mal.
    l0u:document.getElementById('e_l0u').value,
    d0:document.getElementById('e_d0').value,
    d0u:document.getElementById('e_d0u').value,
    a0:document.getElementById('e_a0').value,
    a0u:document.getElementById('e_a0u').value,
    fluencia:document.getElementById('e_fluencia').checked,
  };
  saved.push(cfg);
  if (!safeLocalStorageWrite(() => localStorage.setItem('ensayo_configs', JSON.stringify(saved)), warnEl)) return;
  document.getElementById('cfg_name').value='';
  if (dup) {
    warnEl.style.display='block';
    warnEl.textContent=`Se guardó, pero ya había otra configuración llamada "${name}" -- ahora hay dos con el mismo nombre.`;
  } else {
    warnEl.style.display='none';
  }
  renderSavedList();
  updateCurrentConfigDisplay();
}

function getSavedConfigs(){ try{return JSON.parse(localStorage.getItem('ensayo_configs')||'[]');}catch{return[];} }

function loadConfig(idx){
  const saved=getSavedConfigs();
  const cfg=saved[idx]; if(!cfg) return;
  // FIX #8: antes de cargar los valores nuevos, se limpia cualquier curva o
  // resultado que haya quedado graficado de un ensayo anterior (resetSim),
  // para no dejar en pantalla resultados de un material que ya no corresponde.
  resetSim();
  document.getElementById('e_E').value=cfg.E;
  document.getElementById('e_sy').value=cfg.sy;
  document.getElementById('e_ts').value=cfg.ts;
  document.getElementById('e_el').value=cfg.el;
  document.getElementById('e_nu').value=cfg.nu||0.30;
  document.getElementById('e_l0').value=cfg.l0;
  document.getElementById('e_d0').value=cfg.d0;
  // FIX #16: restaurar unidades y A0 explícito si la config los tiene guardados;
  // si es una config vieja guardada antes de este fix, se cae a "mm"/vacío por
  // compatibilidad, que es el comportamiento que ya tenía antes.
  document.getElementById('e_l0u').value=cfg.l0u||'mm';
  document.getElementById('e_d0u').value=cfg.d0u||'mm';
  document.getElementById('e_a0').value=cfg.a0||'';
  document.getElementById('e_a0u').value=cfg.a0u||'mm2';
  // FIX #76 (hallazgo QA v6.21, Etapa 6): a diferencia de nu/l0u/d0u/a0/a0u
  // (arriba), acá no había ningún fallback -- una config guardada antes de
  // que existiera este campo (o cualquier registro externo sin esa clave)
  // dejaba el checkbox desmarcado en silencio (`undefined` se interpreta
  // como "no"), sin el mismo criterio defensivo que ya se aplicó a los otros
  // 5 campos en esta misma función. El valor por defecto real del checkbox
  // en el HTML es "marcado", así que ese es el fallback correcto.
  document.getElementById('e_fluencia').checked = cfg.fluencia===undefined ? true : cfg.fluencia;
  // FIX #8: una config guardada es un ingreso manual, no necesariamente coincide
  // con ningún preset -- se limpia el desplegable para no mostrar un material
  // que ya no corresponde a los valores recién cargados.
  document.getElementById('e_preset').value='';
  updateDerived();
  // FIX #8: switchTab(...) solo no alcanza, porque "Configuraciones guardadas"
  // vive en una sub-pestaña distinta de Tracción -- hay que cambiar también
  // esa sub-pestaña, si no el usuario no ve ningún cambio en pantalla tras
  // cargar la config.
  // FIX (v5.14): tras la reorganización de navegación, "Configuraciones" y
  // "Tracción" quedaron en pestañas principales DISTINTAS ("Herramientas" y
  // "Ensayos mecánicos" respectivamente) -- además del cambio de pestaña,
  // ahora hace falta mostrar el grupo "estatica" dentro de Mecánicos antes
  // de poder ver la sub-pestaña Tracción.
  switchTab('mecanicos', document.querySelectorAll('.tab')[0]);
  mecSwitchGroup('estatica');
  edSwitch('traccion');
}

function deleteConfig(idx){
  const saved=getSavedConfigs();
  saved.splice(idx,1);
  const warnEl=document.getElementById('cfg_warn');
  if (!safeLocalStorageWrite(() => localStorage.setItem('ensayo_configs',JSON.stringify(saved)), warnEl)) return;
  renderSavedList();
}

// FIX #20: botón para borrar todas las configuraciones guardadas de una,
// pensado para uso en PCs compartidas de aula (localStorage persiste entre
// usuarios del mismo navegador).
function deleteAllConfigs(){
  const saved=getSavedConfigs();
  if(saved.length===0) return;
  if(!confirm(`¿Borrar las ${saved.length} configuración(es) guardadas en este navegador? Esta acción no se puede deshacer.`)) return;
  const warnEl=document.getElementById('cfg_warn');
  if (!safeLocalStorageWrite(() => localStorage.removeItem('ensayo_configs'), warnEl)) return;
  renderSavedList();
}

// FIX #7: escapa caracteres HTML antes de insertar texto proveniente del usuario
// (nombre de la configuración) con innerHTML. Sin esto, un nombre como
// '<img src=x onerror="...">' se ejecutaba apenas se renderizaba la lista —
// y esta lista se renderiza automáticamente al cargar la página, en cualquier
// pestaña, sin que haga falta hacer click en nada (riesgo real en PCs compartidas
// del aula, donde localStorage persiste entre distintos usuarios del navegador).
function escapeHtml(str){
  return String(str).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

function renderSavedList(){
  const saved=getSavedConfigs();
  const list=document.getElementById('savedList');
  if(!saved.length){list.innerHTML='<div style="font-size:12px;color:var(--muted);text-align:center;padding:10px">No hay configuraciones guardadas aún</div>';return;}
  list.innerHTML=saved.map((cfg,i)=>`
  <div class="saved-item" onclick="loadConfig(${i})">
    <div>
      <div class="si-name">${escapeHtml(cfg.name)}</div>
      <div class="si-mat">E=${cfg.E} GPa · σ_y=${cfg.sy} MPa · TS=${cfg.ts} MPa · %EL=${cfg.el}%</div>
      <div class="si-mat" style="font-size:10px">${cfg.date}</div>
    </div>
    <button class="si-del" onclick="event.stopPropagation();deleteConfig(${i})" title="Eliminar">×</button>
  </div>`).join('');
}

function updateCurrentConfigDisplay(){
  // FIX #32: l₀/d₀ mostraban siempre la etiqueta "mm" fija, sin mirar el
  // selector de unidad real (e_l0u/e_d0u). Si el usuario trabaja en cm o
  // pulgadas, esta tarjeta mostraba un valor y una unidad que no correspondían
  // entre sí. Se toma la unidad realmente seleccionada, igual que ya hace
  // saveConfig()/loadConfig() al guardar y cargar l0u/d0u.
  const l0u = document.getElementById('e_l0u').value;
  const d0u = document.getElementById('e_d0u').value;
  document.getElementById('currentConfigDisplay').innerHTML=`
  <div class="rcard"><div class="rl">E</div><div class="rv">${document.getElementById('e_E').value} GPa</div></div>
  <div class="rcard"><div class="rl">σ_y</div><div class="rv">${document.getElementById('e_sy').value} MPa</div></div>
  <div class="rcard"><div class="rl">TS</div><div class="rv">${document.getElementById('e_ts').value} MPa</div></div>
  <div class="rcard"><div class="rl">%EL</div><div class="rv">${document.getElementById('e_el').value}%</div></div>
  <div class="rcard"><div class="rl">ν (Poisson)</div><div class="rv">${document.getElementById('e_nu').value}</div></div>
  <div class="rcard"><div class="rl">l₀</div><div class="rv">${document.getElementById('e_l0').value} ${l0u}</div></div>
  <div class="rcard"><div class="rl">d₀</div><div class="rv">${document.getElementById('e_d0').value} ${d0u}</div></div>
  <div class="rcard"><div class="rl">Fluencia</div><div class="rv">${document.getElementById('e_fluencia').checked?'Sí':'No'}</div></div>`;
}


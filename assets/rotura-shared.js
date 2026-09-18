// rotura-shared.js — helpers compartidos por el módulo 3 (Fractura, fatiga y fluencia): switch de sub-tabs

/* ---------------- SUB-NAV (Fractura, fatiga y fluencia) ---------------- */
function rtSwitch(name){
  document.querySelectorAll('.rt-subbtn').forEach(b=>b.classList.toggle('active', b.dataset.rt===name));
  document.querySelectorAll('.rt-sub-panel').forEach(p=>p.classList.toggle('active', p.id==='rt_panel_'+name));
  document.querySelectorAll('.rt-sub-ctrl').forEach(c=>c.classList.toggle('active', c.id==='rt_ctrl_'+name));
}

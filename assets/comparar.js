// comparar.js — Tab 3: comparación de dos materiales

/* ============================================================ TAB 3: COMPARE */
let compareChartInst=null;

function renderCompare(){
  const m1={E:+document.getElementById('c1_E').value,sy:+document.getElementById('c1_sy').value,ts:+document.getElementById('c1_ts').value,el:+document.getElementById('c1_el').value};
  const m2={E:+document.getElementById('c2_E').value,sy:+document.getElementById('c2_sy').value,ts:+document.getElementById('c2_ts').value,el:+document.getElementById('c2_el').value};
  // FIX #5: el campo %EL tiene min="0.1" en el HTML, pero eso no bloquea que
  // alguien tipee "0" directamente -- con %EL=0, genCurve() colapsaba TODA la
  // curva en una línea vertical pegada a x=0 (ey=min(sy/E,0)=0). Se le pone un
  // piso de 0.01% (ductilidad casi nula, no nula), igual que ya hace el
  // Material compuesto.
  // FIX #63 (hallazgo QA v6.16, C6-01): genCurve() ahora tiene este mismo
  // piso adentro suyo -- se deja igual acá como defensa en capas, ya que
  // m1.el/m2.el también se muestran en la tabla de resultados de esta
  // pestaña, no solo se pasan a genCurve().
  if(m1.el<=0) m1.el=0.01;
  if(m2.el<=0) m2.el=0.01;
  // FIX #39 (hallazgo Etapa 9 QA v5.14): mismo problema que ya se corrigió en
  // Tracción (buildCurve, FIX QA v5.12) y ahora también en Compresión (FIX
  // #39) -- genCurve() ya aplica internamente un piso de 1 GPa si E<=0, pero
  // las tarjetas "M1/M2 — E" de acá abajo mostraban el E crudo sin ese piso
  // (ej. "0 GPa" mientras la curva dibujada usaba 1 GPa). Mismo criterio: se
  // calcula el piso una sola vez y se reusa para mostrar y para generar la
  // curva.
  if(!(isFinite(m1.E) && m1.E>0)) m1.E=1;
  if(!(isFinite(m2.E) && m2.E>0)) m2.E=1;
  // FIX #73 (hallazgo QA v6.21, Etapa 3): a diferencia de Tracción (que usa
  // numOrDefault, con default 450 si TS queda vacío), acá TS se leía con
  // "+valor" directo -- un campo vacío se convertía en 0, no en un default.
  // Para un material DÚCTIL (σy>0) esto ya se detectaba como σy>TS (ver aviso
  // de abajo), pero para un material FRÁGIL (σy=0, el valor que la propia
  // app usa para indicar "sin fluencia") el aviso de σy>TS nunca se disparaba
  // (0 no es >0), y la curva quedaba completamente plana en σ=0 -- un
  // "material que rompe con tensión nula" sin ningún aviso. Se agrega un
  // piso + aviso dedicado, mismo criterio que ya usan l₀/d₀/A₀ en Tracción.
  const ts1Invalido = !(isFinite(m1.ts) && m1.ts>0);
  const ts2Invalido = !(isFinite(m2.ts) && m2.ts>0);
  if (ts1Invalido) m1.ts = 1;
  if (ts2Invalido) m2.ts = 1;
  // FIX #6: faltaba la validación de σ_y > TS que sí existe en Tracción --
  // se podía cargar un dato físicamente imposible sin ningún aviso.
  const warnEl = document.getElementById('c_warnSyTs');
  const bad1 = m1.sy>0 && m1.sy>m1.ts, bad2 = m2.sy>0 && m2.sy>m2.ts;
  if (bad1 || bad2 || ts1Invalido || ts2Invalido) {
    warnEl.style.display='block';
    const partes=[];
    if(bad1) partes.push(`M1: σ_y (${m1.sy} MPa) > TS (${m1.ts} MPa)`);
    if(bad2) partes.push(`M2: σ_y (${m2.sy} MPa) > TS (${m2.ts} MPa)`);
    if(ts1Invalido) partes.push('M1: TS debe ser un número positivo mayor que cero');
    if(ts2Invalido) partes.push('M2: TS debe ser un número positivo mayor que cero');
    warnEl.innerHTML = `<strong>Dato inconsistente:</strong> ${partes.join(' · ')}. Revisá los valores.`;
  } else {
    warnEl.style.display='none';
  }
  const c1=genCurve(m1.E,m1.sy,m1.ts,m1.el,false);
  const c2=genCurve(m2.E,m2.sy,m2.ts,m2.el,false);
  const maxX=Math.max(m1.el,m2.el)/100*1.12, maxY=Math.max(m1.ts,m2.ts)*1.18;
  if(!compareChartInst){
    compareChartInst=new Chart(document.getElementById('compareChart').getContext('2d'),{
      type:'line',data:{datasets:[
        // FIX v5.11 (backlog punto E, auditoría de daltonismo): M1 y M2 antes
        // solo se distinguían por color (azul/violeta, con
        // legend:{display:false} más abajo) -- se le agrega un trazo
        // punteado a M2 para que la forma de la línea también las diferencie.
        {label:'M1',data:[],borderColor:'#2176ae',borderWidth:2.5,pointRadius:0,tension:0.15,fill:false},
        {label:'M2',data:[],borderColor:'#7b2fa8',borderWidth:2.5,pointRadius:0,tension:0.15,fill:false,borderDash:[6,3]},
        {label:'M1f',data:[],borderColor:'#2176ae',borderWidth:2.5,pointRadius:6,pointBackgroundColor:'#2176ae',tension:0,fill:false},
        {label:'M2f',data:[],borderColor:'#7b2fa8',borderWidth:2.5,pointRadius:6,pointBackgroundColor:'#7b2fa8',tension:0,fill:false},
      ]},
      options:{responsive:true,maintainAspectRatio:false,animation:{duration:300},
        plugins:{legend:{display:false},tooltip:{callbacks:{label:c=>`${c.dataset.label.replace(/f$/,'')}: σ=${c.parsed.y.toFixed(1).replace('.',',')} MPa  ε=${c.parsed.x.toFixed(5).replace('.',',')}`}}},
        scales:{x:{type:'linear',title:{display:true,text:'Deformación nominal ε',color:tc,font:{size:12}},grid:{color:gc},ticks:{color:tc,maxTicksLimit:8,callback:v=>v.toFixed(3).replace('.',',')}},
                y:{title:{display:true,text:'Tensión σ (MPa)',color:tc,font:{size:12}},grid:{color:gc},ticks:{color:tc,maxTicksLimit:8}}}}
    });
  }
  compareChartInst.data.datasets[0].data=c1.filter(p=>p.phase!=='fracture').map(p=>({x:p.x,y:p.y}));
  compareChartInst.data.datasets[1].data=c2.filter(p=>p.phase!=='fracture').map(p=>({x:p.x,y:p.y}));
  compareChartInst.data.datasets[2].data=[{x:c1[c1.length-1].x,y:c1[c1.length-1].y}];
  compareChartInst.data.datasets[3].data=[{x:c2[c2.length-1].x,y:c2[c2.length-1].y}];
  compareChartInst.options.scales.x.max=maxX;
  compareChartInst.options.scales.y.max=maxY;
  compareChartInst.update();
  const ten1=calcTenacity(c1),ten2=calcTenacity(c2);
  const res1=calcResilience(c1),res2=calcResilience(c2);
  document.getElementById('compareResults').innerHTML=`
  <div class="rcard"><div class="rl" style="color:#2176ae">M1 — E${hb('E')}</div><div class="rv">${m1.E} GPa</div></div>
  <div class="rcard"><div class="rl" style="color:#7b2fa8">M2 — E${hb('E')}</div><div class="rv">${m2.E} GPa</div></div>
  <div class="rcard"><div class="rl" style="color:#2176ae">M1 — σ_y${hb('sy')}</div><div class="rv">${m1.sy>0?m1.sy+' MPa':'— (frágil)'}</div></div>
  <div class="rcard"><div class="rl" style="color:#7b2fa8">M2 — σ_y${hb('sy')}</div><div class="rv">${m2.sy>0?m2.sy+' MPa':'— (frágil)'}</div></div>
  <div class="rcard"><div class="rl" style="color:#2176ae">M1 — TS${hb('ts')}</div><div class="rv">${m1.ts} MPa</div></div>
  <div class="rcard"><div class="rl" style="color:#7b2fa8">M2 — TS${hb('ts')}</div><div class="rv">${m2.ts} MPa</div></div>
  <div class="rcard"><div class="rl" style="color:#2176ae">M1 — Tenacidad${hb('tenacidad')}</div><div class="rv">${ten1.toFixed(3).replace('.',',')} MJ/m³</div></div>
  <div class="rcard"><div class="rl" style="color:#7b2fa8">M2 — Tenacidad${hb('tenacidad')}</div><div class="rv">${ten2.toFixed(3).replace('.',',')} MJ/m³</div></div>
  <div class="rcard"><div class="rl" style="color:#2176ae">M1 — Resiliencia${hb('resiliencia')}</div><div class="rv">${m1.sy>0?(res1*1000).toFixed(2).replace('.',',')+' kJ/m³':'— frágil'}</div></div>
  <div class="rcard"><div class="rl" style="color:#7b2fa8">M2 — Resiliencia${hb('resiliencia')}</div><div class="rv">${m2.sy>0?(res2*1000).toFixed(2).replace('.',',')+' kJ/m³':'— frágil'}</div></div>
  <div class="rcard"><div class="rl" style="color:#2176ae">M1 — %EL${hb('el')}</div><div class="rv">${m1.el}%</div></div>
  <div class="rcard"><div class="rl" style="color:#7b2fa8">M2 — %EL${hb('el')}</div><div class="rv">${m2.el}%</div></div>`;
}


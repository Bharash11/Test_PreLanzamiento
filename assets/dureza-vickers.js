// dureza-vickers.js — microdureza Vickers + correlación TS-dureza + conversión entre escalas

// FIX (Fase 6a): hv ahora sale de PRESETS[x].dureza.hv (misma fuente que
// Rockwell/Brinell); p y d son la carga y diagonal de ESTE ensayo puntual.
// VICKERS_REF mantiene el mismo shape {hv,p,d} de antes -- el test FIX #34
// (VICKERS_REF — los 15 pares...) sigue funcionando sin tocarlo.
const VICKERS_PD = {
  ceramica:{p:1000,d:0.033}, acero:{p:1000,d:0.117}, aceroinox:{p:1000,d:0.109},
  fragil:{p:1000,d:0.094}, aluminio:{p:300,d:0.072}, cobre:{p:300,d:0.106},
  titanio:{p:1000,d:0.073}, niquel:{p:500,d:0.111}, molibdeno:{p:1000,d:0.106},
  magnesio:{p:300,d:0.099}, zinc:{p:300,d:0.121}, tungsteno:{p:1000,d:0.077},
  laton:{p:500,d:0.124}, plata:{p:200,d:0.117}, oro:{p:200,d:0.122},
  // FIX (v4.10): mismo criterio de carga que ya usaba esta tabla -- ferrosos/
  // duros con P=1000 (aisi1045, hierronodular, titaniocp2, cerámicos nuevos,
  // igual que acero/titanio/cerámica), no ferrosos blandos con P=300-500
  // (aluminio7075/aluminio2024 como aluminio, broncefosforico como laton). d
  // se despejó de HV=1,854·(P/1000)/d² para reproducir el HV de
  // PRESETS[x].dureza.hv con esa carga. acero4140 queda afuera: por encima de
  // 200 HB la aproximación HV≈HB pierde precisión (ver dureza-shared arriba)
  // y no se encontró un HV publicado propio para esta condición.
  aisi1045:{p:1000,d:0.102}, aluminio7075:{p:300,d:0.061}, aluminio2024:{p:300,d:0.064},
  broncefosforico:{p:500,d:0.077}, hierronodular:{p:1000,d:0.106}, titaniocp2:{p:1000,d:0.108},
  sic:{p:1000,d:0.024}, si3n4:{p:1000,d:0.045}, zirconia:{p:1000,d:0.0385},
};
const VICKERS_REF = {};
for (const [key, pd] of Object.entries(VICKERS_PD)) {
  const hv = PRESETS[key]?.dureza?.hv;
  if (hv !== undefined) VICKERS_REF[key] = { hv, p:pd.p, d:pd.d };
}
function dzApplyVickersMaterial(){
  const key = document.getElementById('dz_vMat').value;
  const ref = VICKERS_REF[key];
  if(!ref){ dzUpdateMicro(); return; }
  document.getElementById('dz_vP').value = ref.p;
  document.getElementById('dz_vD').value = ref.d;
  dzUpdateMicro();
}

// FIX #77 (hallazgo QA v6.21, Etapa 10): Knoop era la única de las 4 escalas
// de dureza sin ningún dato de referencia bibliográfica ni ejemplo guiado
// (Brinell/Rockwell/Vickers sí tienen los 3). El propio texto de ayuda
// recomienda Knoop para cerámicas/vidrios/recubrimientos finos -- así que la
// tabla se arma con los cerámicos técnicos que ya modela el simulador
// (mismo criterio que VICKERS_REF: se toma de PRESETS[x].dureza.hk, p y l se
// despejaron de HK=14,2·(P/1000)/l² para reproducir ese hk con esa carga).
const KNOOP_PL = {
  aluminio:{p:200,l:0.337}, ceramica:{p:500,l:0.060},
  sic:{p:500,l:0.053}, si3n4:{p:500,l:0.084}, zirconia:{p:500,l:0.080},
};
const KNOOP_REF = {};
for (const [key, pl] of Object.entries(KNOOP_PL)) {
  const hk = PRESETS[key]?.dureza?.hk;
  if (hk !== undefined) KNOOP_REF[key] = { hk, p:pl.p, l:pl.l };
}
function dzApplyKnoopMaterial(){
  const key = document.getElementById('dz_kMat').value;
  const ref = KNOOP_REF[key];
  if(!ref){ dzUpdateMicro(); return; }
  document.getElementById('dz_kP').value = ref.p;
  document.getElementById('dz_kL').value = ref.l;
  dzUpdateMicro();
}
function dzUpdateMicro(){
  // FIX #5: los campos de carga están etiquetados en gf (gramos-fuerza, como
  // corresponde a un ensayo de MICROdureza real), pero las fórmulas estándar
  // HV=1.854·P/d² y HK=14.2·P/l² requieren P en kgf. Antes no se convertía,
  // así que los HV/HK mostrados quedaban 1000 veces más altos de lo real.
  // FIX #26: antes se podían tipear valores negativos (el "min" de HTML no lo
  // impide) y se obtenía un HV/HK negativo sin ningún aviso. Ahora un valor
  // negativo o cero se trata como dato inválido, igual que un campo vacío.
  const P1raw = parseFloat(document.getElementById('dz_vP').value);
  const d1raw = parseFloat(document.getElementById('dz_vD').value);
  const P2raw = parseFloat(document.getElementById('dz_kP').value);
  const lraw = parseFloat(document.getElementById('dz_kL').value);
  const validP1 = isFinite(P1raw) && P1raw>0, validD1 = isFinite(d1raw) && d1raw>0;
  const validP2 = isFinite(P2raw) && P2raw>0, validL = isFinite(lraw) && lraw>0;
  const P1 = (validP1?P1raw:0) / 1000; // gf -> kgf
  const d1 = validD1?d1raw:0.0001;
  const HV = 1.854*P1/(d1*d1);
  document.getElementById('dz_vResult').textContent = (validP1&&validD1&&isFinite(HV)) ? HV.toFixed(1).replace('.',',')+' HV' : '—';

  const cmpEl = document.getElementById('dz_vMatCompare');
  const matKey = document.getElementById('dz_vMat').value;
  const ref = VICKERS_REF[matKey];
  if(ref && validP1 && validD1 && isFinite(HV)){
    const diffPct = ((HV-ref.hv)/ref.hv*100);
    const cerca = Math.abs(diffPct) < 15;
    cmpEl.style.display='block';
    cmpEl.innerHTML = `<strong>Referencia bibliográfica para este material: ≈${ref.hv} HV</strong> (valor típico de tabla, carga estándar HV1). `
      + (cerca ? `Tu ensayo dio un valor cercano.`
               : `Tu ensayo dio un valor ${diffPct>0?'más alto':'más bajo'} (${Math.abs(diffPct).toFixed(0).replace('.',',')}% de diferencia) -- normal si cambiaste P o d₁ respecto del ensayo guiado.`);
  } else {
    cmpEl.style.display='none';
  }

  const P2 = (validP2?P2raw:0) / 1000; // gf -> kgf
  const l = validL?lraw:0.0001;
  const HK = 14.2*P2/(l*l);
  document.getElementById('dz_kResult').textContent = (validP2&&validL&&isFinite(HK)) ? HK.toFixed(1).replace('.',',')+' HK' : '—';

  // FIX #77: comparación bibliográfica para Knoop, mismo patrón que Vickers.
  const kCmpEl = document.getElementById('dz_kMatCompare');
  if (kCmpEl) {
    const kMatKey = document.getElementById('dz_kMat').value;
    const kRef = KNOOP_REF[kMatKey];
    if (kRef && validP2 && validL && isFinite(HK)) {
      const diffPctK = ((HK-kRef.hk)/kRef.hk*100);
      const cercaK = Math.abs(diffPctK) < 15;
      kCmpEl.style.display='block';
      kCmpEl.innerHTML = `<strong>Referencia bibliográfica para este material: ≈${kRef.hk} HK</strong> (valor típico de tabla). `
        + (cercaK ? `Tu ensayo dio un valor cercano.`
                  : `Tu ensayo dio un valor ${diffPctK>0?'más alto':'más bajo'} (${Math.abs(diffPctK).toFixed(0).replace('.',',')}% de diferencia) -- normal si cambiaste P o l respecto del ensayo guiado.`);
    } else {
      kCmpEl.style.display='none';
    }
  }

  // FIX #25: a diferencia de Brinell (que valida d/D), acá no había ninguna
  // validación de rango razonable. Se avisa si algún input es inválido
  // (vacío/negativo/cero) o si el resultado queda fuera de un rango físico
  // plausible para materiales reales (aprox. 1 a 4000 HV/HK).
  // FIX #63 (hallazgo QA v6.16, D12-01): el techo era 3000, pero
  // PRESETS.sic.dureza.hv=3200 (un dato bibliográficamente correcto -- el
  // carburo de silicio es una cerámica técnica genuinamente muy dura, con
  // valores publicados de hasta más de 3000 HV según el método/carga) caía
  // por encima de ese techo y disparaba la advertencia sobre su propio
  // ejemplo guiado. El dato estaba bien; el límite de validación era el que
  // estaba corto. Se sube a 4000 para dejar margen a SiC y cerámicas
  // técnicas similares sin volver inútil la validación.
  const warnEl = document.getElementById('dz_microWarn');
  const msgs = [];
  if(!validP1 || !validD1) msgs.push('Vickers: la carga P y la diagonal d₁ deben ser números positivos mayores que cero.');
  else if(HV<1 || HV>4000) msgs.push(`Vickers: HV=${HV.toFixed(0)} está fuera del rango típico de materiales reales (~1 a 4000 HV) -- revisá P y d₁.`);
  if(!validP2 || !validL) msgs.push('Knoop: la carga P y la longitud l deben ser números positivos mayores que cero.');
  else if(HK<1 || HK>4000) msgs.push(`Knoop: HK=${HK.toFixed(0)} está fuera del rango típico de materiales reales (~1 a 4000 HK) -- revisá P y l.`);
  if(msgs.length){
    warnEl.style.display='block';
    warnEl.innerHTML = msgs.join('<br>');
  } else {
    warnEl.style.display='none';
  }
  // FIX (v6.9): dibujo de las huellas delegado a dzDrawMicroScene()
  // (indentador-micro.js, cargado después de este archivo -- misma razón ya
  // documentada en dureza-brinell.js/dureza-rockwell.js para llamar a una
  // función definida en un script hermano posterior). En reposo, ambas
  // escenas (Vickers y Knoop) se resetean a su estado final instantáneo --
  // dzMicroVProg/dzMicroKProg viven en indentador-micro.js.
  if(typeof dzDrawMicroScene === 'function'){
    dzMicroVProg = {tool:1, mark:1};
    dzMicroKProg = {tool:1, mark:1};
    dzDrawMicroScene();
  }
}

/* ---------------- 5. CONVERSION ---------------- */
function dzUpdateConvRange(){
  const sl = document.getElementById('dz_convSlider');
  if(document.getElementById('dz_convScale').value==='hrc'){ sl.min=20; sl.max=65; sl.value=30; }
  else { sl.min=225; sl.max=740; sl.value=286; }
  dzDrawConv();
}
function dzDrawConv(){
  const isHRC = document.getElementById('dz_convScale').value==='hrc';
  const val = parseFloat(document.getElementById('dz_convSlider').value);
  document.getElementById('dz_convVal').textContent = val + (isHRC?' HRC':' HB');
  let hrc, hb, ts;
  if(isHRC){ hrc=val; hb=dzInterp('hrc',val,'hb'); ts=dzInterp('hrc',val,'ts_mpa'); }
  else { hb=val; hrc=dzInterp('hb',val,'hrc'); ts=dzInterp('hb',val,'ts_mpa'); }

  const svg = document.getElementById('dz_convSvg');
  const scales = [
    {label:'HRC', min:20, max:65, val:hrc, x:150, color:'var(--accent)'},
    {label:'HB (Brinell)', min:225, max:740, val:hb, x:350, color:'var(--neck)'},
    {label:'TS (MPa) — solo aceros', min:770, max:2600, val:ts, x:550, color:'var(--plastic)'}
  ];
  let html='';
  scales.forEach(s=>{
    const top=30, bottom=190;
    const norm = (s.val-s.min)/(s.max-s.min);
    const y = bottom - norm*(bottom-top);
    html += `<line x1="${s.x}" y1="${top}" x2="${s.x}" y2="${bottom}" stroke="var(--border)" stroke-width="6"/>`;
    html += `<circle cx="${s.x}" cy="${y}" r="7" fill="${s.color}"/>`;
    html += `<text x="${s.x}" y="${bottom+20}" text-anchor="middle" fill="var(--muted)" font-size="12">${s.label}</text>`;
    html += `<text x="${s.x}" y="${y-14}" text-anchor="middle" fill="${s.color}" font-size="13" font-weight="600">${Math.round(s.val)}</text>`;
  });
  html += `<line x1="150" y1="${190 - ((hrc-20)/(65-20))*160}" x2="350" y2="${190 - ((hb-225)/(740-225))*160}" stroke="var(--muted)" stroke-dasharray="3 3"/>`;
  html += `<line x1="350" y1="${190 - ((hb-225)/(740-225))*160}" x2="550" y2="${190 - ((ts-770)/(2600-770))*160}" stroke="var(--muted)" stroke-dasharray="3 3"/>`;
  svg.innerHTML = html;
}

/* ---------------- 6. CORRELACION TS ---------------- */
function dzInitTsChart(){
  const ctx = document.getElementById('dz_tsChart').getContext('2d');
  dzTsChartInst = new Chart(ctx,{
    type:'line',
    data:{datasets:[
      {label:'Aceros (línea empírica)',data:[{x:0,y:0},{x:500,y:500*3.45}],borderColor:'#1a8c5e',borderWidth:2,pointRadius:0,fill:false},
      {label:'HB actual',data:[],borderColor:'#c8780a',backgroundColor:'#c8780a',pointRadius:6,showLine:false}
    ]},
    options:{responsive:true,maintainAspectRatio:false,animation:{duration:250},
      plugins:{legend:{display:false},tooltip:{callbacks:{label:c=>` ${c.parsed.y.toFixed(0)} MPa a HB=${c.parsed.x.toFixed(0)}`}}},
      scales:{
        x:{type:'linear',min:0,max:500,title:{display:true,text:'Dureza Brinell (HB)',color:tc,font:{size:11}},grid:{color:gc},ticks:{color:tc}},
        y:{min:0,max:1800,title:{display:true,text:'TS (MPa)',color:tc,font:{size:11}},grid:{color:gc},ticks:{color:tc}}
      }}
  });
}
function dzUpdateTS(){
  const hb = parseFloat(document.getElementById('dz_tsSlider').value);
  document.getElementById('dz_tsVal').textContent = hb;
  const psi = 500*hb;
  const mpa = 3.45*hb;
  document.getElementById('dz_tsPsi').textContent = Math.round(psi).toLocaleString('es-AR');
  document.getElementById('dz_tsMpa').textContent = mpa.toFixed(1).replace('.',',');
  if(dzTsChartInst){
    dzTsChartInst.data.datasets[1].data = [{x:hb,y:mpa}];
    dzTsChartInst.update();
  }
}


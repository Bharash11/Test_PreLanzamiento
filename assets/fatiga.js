// fatiga.js — Módulo 3, grupo "Fatiga": tensiones cíclicas, curva S-N, iniciación/propagación,
// ley de Paris (velocidad de propagación) y factores de Marin (corrección del límite de fatiga).
// tc/gc (colores de gráfico) y Chart vienen definidos/cargados globalmente antes que este archivo.

let ftCicloChartInst = null;
let ftSnChartInst = null;
let ftParisChartInst = null;
let ftFactoresChartInst = null;

// FIX (prototipo post-v6.19): snapshot del último resultado de la
// integración de la ley de Paris (ftCalcCurvaCrecimiento(), en
// ftUpdateVelocidad() más abajo) -- mismo criterio que FL_ULTIMO en
// fluencia.js: se reasigna un objeto NUEVO en cada llamada (nunca se muta
// el anterior en el lugar), null cuando el resultado actual no es válido
// (parámetros inconsistentes, ver ftUpdateVelocidad()).
let FT_ULTIMO = null;

function ftInit(){
  ftInitCicloChart();
  ftUpdateCiclicas();
  ftDrawFatigaSvg();
  ftInitSNChart();
  ftUpdateSN();
  ftInitParisChart();
  ftUpdateVelocidad();
  ftInitFactoresChart();
  ftUpdateFactores();
}

/* ================================================================ FT1. TENSIONES CÍCLICAS */
function ftPresetCiclo(tipo){
  const presets = { reversa:[250,-250], repetida:[300,0], fluctuante:[300,80] };
  const [smax,smin] = presets[tipo];
  document.getElementById('ft_smax').value = smax;
  document.getElementById('ft_smin').value = smin;
  ftUpdateCiclicas();
}

function ftInitCicloChart(){
  const ctx = document.getElementById('ft_cicloChart').getContext('2d');
  ftCicloChartInst = new Chart(ctx,{
    type:'line',
    data:{datasets:[
      {label:'σ(t)', data:[], borderColor:'#1a5fa8', borderWidth:2, pointRadius:0, tension:.4, fill:false},
      {label:'σ_m (media)', data:[], borderColor:'#72706a', borderDash:[5,4], borderWidth:1.5, pointRadius:0, fill:false}
    ]},
    options:{responsive:true, maintainAspectRatio:false, animation:{duration:200},
      plugins:{legend:{labels:{color:tc,font:{size:11}}}},
      scales:{
        x:{type:'linear', title:{display:true,text:'Ciclos',color:tc,font:{size:11}}, grid:{color:gc}, ticks:{color:tc}},
        y:{title:{display:true,text:'Tensión (MPa)',color:tc,font:{size:11}}, grid:{color:gc}, ticks:{color:tc}}
      }}
  });
}

function ftUpdateCiclicas(){
  const smax = parseFloat(document.getElementById('ft_smax').value)||0;
  const smin = parseFloat(document.getElementById('ft_smin').value)||0;
  const sm = (smax+smin)/2;
  const sa = (smax-smin)/2;
  const sr = smax-smin;
  const R = smax!==0 ? smin/smax : NaN;

  document.getElementById('ft_mSa').textContent = sa.toFixed(0);
  document.getElementById('ft_mSm').textContent = sm.toFixed(0);
  document.getElementById('ft_mSr').textContent = sr.toFixed(0);
  document.getElementById('ft_mR').textContent = isFinite(R) ? R.toFixed(2).replace('.',',') : '—';

  // FIX #63 (hallazgo QA v6.16, F22-01): mismo criterio que co_warnSycSc
  // (Compresión) y e_warnSyTs (Tracción) -- σ_min y σ_max son dos campos
  // numéricos independientes, sin validación cruzada. Si σ_min>σ_max (los
  // extremos vienen invertidos), σ_a da negativo -- una magnitud que por
  // definición es un semi-rango, nunca negativo -- y R queda fuera del
  // rango convencional (>1). No se bloquea el cálculo, solo se avisa, mismo
  // espíritu no restrictivo que el resto de estos avisos en el proyecto.
  const warnSminSmax = document.getElementById('ft_warnSminSmax');
  if (smin > smax) {
    warnSminSmax.style.display = 'block';
    warnSminSmax.innerHTML = `<strong>Dato inconsistente:</strong> σ_min (${smin} MPa) no puede ser mayor que σ_max (${smax} MPa) -- revisá el orden de los valores. La amplitud σ_a mostrada arriba salió negativa porque, por definición, es un semi-rango (siempre ≥0).`;
  } else {
    warnSminSmax.style.display = 'none';
  }

  const pts=[], N=80;
  for(let i=0;i<=N;i++){
    const t = 3*i/N;
    pts.push({x:t, y: sm + sa*Math.sin(2*Math.PI*t)});
  }
  if(ftCicloChartInst){
    ftCicloChartInst.data.datasets[0].data = pts;
    ftCicloChartInst.data.datasets[1].data = [{x:0,y:sm},{x:3,y:sm}];
    ftCicloChartInst.update();
  }
}

/* ================================================================ FT3. INICIACIÓN Y PROPAGACIÓN (SVG) */
function ftDrawFatigaSvg(){
  const svg = document.getElementById('rt_fatigaSvg');
  if(!svg) return;
  const cx=280, cy=75, r=60;
  let html='';
  // sección transversal (círculo)
  html+=`<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="var(--border)" stroke-width="1.5"/>`;
  // origen en el borde izquierdo
  const ox = cx-r, oy=cy;
  html+=`<circle cx="${ox}" cy="${oy}" r="4" fill="var(--frac)"/>`;
  html+=`<text x="${ox-6}" y="${oy-10}" text-anchor="middle" fill="var(--frac)" font-size="10">Origen</text>`;
  // marcas de playa (arcos concéntricos alrededor del origen)
  [15,28,41,54].forEach(rr=>{
    html+=`<path d="M ${ox+rr*0.15},${oy-rr*0.98} A ${rr},${rr} 0 0 1 ${ox+rr*0.15},${oy+rr*0.98}" fill="none" stroke="var(--elastic)" stroke-width="1" opacity=".55"/>`;
  });
  // zona de fractura final (rugosa) — sector opuesto al origen
  html+=`<path d="M ${cx+r*0.15},${cy-r*0.75} L ${cx+r*0.95},${cy-r*0.35} L ${cx+r*0.75},${cy} L ${cx+r*0.95},${cy+r*0.35} L ${cx+r*0.15},${cy+r*0.75} A ${r},${r} 0 0 1 ${cx+r*0.15},${cy-r*0.75} Z" fill="var(--neck)" opacity=".22" stroke="var(--neck)" stroke-width="1"/>`;
  html+=`<text x="${cx+r*0.5}" y="${cy+r+18}" text-anchor="middle" fill="var(--muted)" font-size="10">Fractura final (rápida, rugosa)</text>`;
  html+=`<text x="${ox+8}" y="${cy+r+18}" text-anchor="middle" fill="var(--muted)" font-size="10">Marcas de playa (propagación lenta)</text>`;
  svg.innerHTML = html;
}

/* ================================================================ FT2. CURVA S-N */
const FT_SN_PRESETS = {
  acero1045:  {label:"Acero 1045",        sfp:1000, b:-0.09,  Se:310, hasLimit:true},
  acero4340:  {label:"Acero 4340 T y R",   sfp:1200, b:-0.095, Se:480, hasLimit:true},
  al2014:     {label:"Aluminio 2014-T6",   sfp:440,  b:-0.100, Se:null, hasLimit:false}
};

function ftBasquinN(sa, sfp, b){
  return 0.5*Math.pow(sa/sfp, 1/b);
}

function ftInitSNChart(){
  const ctx = document.getElementById('ft_snChart').getContext('2d');
  ftSnChartInst = new Chart(ctx,{
    type:'line',
    data:{datasets:[
      {label:'Curva S-N', data:[], borderColor:'#1a5fa8', borderWidth:2, pointRadius:0, tension:0, fill:false},
      {label:'σ_a elegida', data:[], borderColor:'#c8780a', backgroundColor:'#c8780a', pointRadius:6, showLine:false}
    ]},
    options:{responsive:true, maintainAspectRatio:false, animation:{duration:200},
      plugins:{legend:{labels:{color:tc,font:{size:11}}}, tooltip:{callbacks:{label:c=>` N≈${c.parsed.x.toExponential(2).replace('.',',')} ciclos → σ_a=${c.parsed.y.toFixed(0)} MPa`}}},
      scales:{
        x:{type:'logarithmic', title:{display:true,text:'Número de ciclos a rotura, N',color:tc,font:{size:11}}, grid:{color:gc}, ticks:{color:tc}},
        y:{type:'logarithmic', title:{display:true,text:'Amplitud de tensión σ_a (MPa)',color:tc,font:{size:11}}, grid:{color:gc}, ticks:{color:tc}}
      }}
  });
}

function ftUpdateSN(){
  const key = document.getElementById('ft_snMat').value;
  const p = FT_SN_PRESETS[key];
  const sa = parseFloat(document.getElementById('ft_sa').value)||1;
  document.getElementById('ft_saVal').textContent = sa+' MPa';

  const curve=[];
  for(let e=3; e<=9; e+=0.15){
    const N = Math.pow(10,e);
    let s = p.sfp*Math.pow(2*N, p.b);
    if(p.hasLimit) s = Math.max(s, p.Se);
    curve.push({x:N, y:s});
  }

  let Nf;
  const infinita = p.hasLimit && sa<=p.Se;
  if(infinita){ Nf = 1e9; }
  else { Nf = ftBasquinN(sa, p.sfp, p.b); }

  document.getElementById('ft_mNf').textContent = infinita ? '> 10⁷ (infinita)' : Nf.toExponential(2).replace('.',',');
  // FIX #80 (hallazgo QA v6.21, Etapa 17): para un material sin límite de
  // fatiga verdadero (hasLimit:false, ej. al2014), un σ_a bajo (perfectamente
  // alcanzable arrastrando el slider a su mínimo normal) da un N_f de hasta
  // ~10¹³ ciclos -- 4 a 6 órdenes de magnitud más allá de cualquier ensayo
  // real de fatiga, mostrado sin ningún aviso pese a que el propio punto ya
  // no entra en el gráfico (que grafica hasta 10⁹) y queda pisado ahí sin
  // indicar que el número de al lado es mucho más grande. Se avisa cuando la
  // extrapolación supera el propio rango graficado.
  const warnExtrapEl = document.getElementById('ft_warnExtrapolacion');
  if (warnExtrapEl) {
    if (!infinita && Nf > 1e9) {
      warnExtrapEl.style.display = 'block';
      warnExtrapEl.innerHTML = `<strong>Extrapolación fuera de rango:</strong> N_f (${Nf.toExponential(2).replace('.',',')} ciclos) supera ampliamente el rango de ensayos de fatiga reales (~10⁹ ciclos) y el propio rango graficado -- es un resultado matemático de extender la ley de Basquin, no un dato con respaldo experimental a esa escala.`;
    } else {
      warnExtrapEl.style.display = 'none';
    }
  }
  // FIX #45 (hallazgo Etapa 4 QA v6.5): R.R. Moore usa estos mismos datos
  // (FT_SN_PRESETS/sfp) y ya avisa cuando σ_a supera σ'_f -- acá no había
  // ningún aviso equivalente. Con σ_a > σ'_f, ftBasquinN da N<1 ciclo sin
  // ninguna advertencia, y el punto queda fuera del rango graficado (10³-10⁹),
  // así que ni siquiera se ve marcado en la curva. Mismo criterio y mismo
  // texto que rrRender() en rrmoore.js (ver FIX #44).
  const warnSNEl = document.getElementById('ft_warnSigma');
  if (sa > p.sfp) {
    warnSNEl.style.display = 'block';
    warnSNEl.innerHTML = `<strong>Dato fuera de rango:</strong> σ_a (${sa.toFixed(0)} MPa) supera σ'_f (${p.sfp} MPa) del material elegido — la probeta rompería en el primer cuarto de vuelta, no como fatiga.`;
  } else {
    warnSNEl.style.display = 'none';
  }
  const infEl = document.getElementById('ft_mInfinita');
  if(p.hasLimit){
    infEl.textContent = infinita ? `✓ Sí (σ_a ≤ S_e=${p.Se} MPa)` : `✗ No (σ_a > S_e=${p.Se} MPa)`;
    infEl.style.color = infinita ? 'var(--plastic)' : 'var(--frac)';
  } else {
    infEl.textContent = '✗ No — este material no tiene límite de fatiga verdadero';
    infEl.style.color = 'var(--frac)';
  }

  if(ftSnChartInst){
    ftSnChartInst.data.datasets[0].data = curve;
    ftSnChartInst.data.datasets[0].label = p.label;
    ftSnChartInst.data.datasets[1].data = [{x: Math.min(Nf,1e9), y:sa}];
    ftSnChartInst.update();
  }
}

/* ================================================================ FT4. LEY DE PARIS */
// FIX (integración Unidad 3): antes esto era un diccionario propio
// (FT_PARIS_PRESETS) con las mismas claves "acero"/"aluminio"/"titanio" que
// PRESETS en data-presets.js, pero sin ninguna relación entre ambos -- dos
// fuentes de verdad para el mismo material. Ahora lee directo de
// PRESETS[key].frac, que es la misma tabla que usan tracción/compresión.
function ftApplyParisPreset(){
  const key = document.getElementById('ft_parisMat').value;
  const p = PRESETS[key]?.frac;
  if(p){
    document.getElementById('ft_parisC').value = p.parisC;
    document.getElementById('ft_parisM').value = p.parisM;
    // FIX (prototipo post-v6.19): K_IC ya estaba en esta misma tabla
    // (PRESETS[key].frac.kic, usada por fractura.js) pero este panel nunca
    // lo leía -- ahora se autocompleta igual que C y m (editable a mano si
    // se elige "— Personalizado —", mismo criterio que esos 2 campos).
    if(p.kic!=null) document.getElementById('ft_parisKic').value = p.kic;
  }
  ftUpdateVelocidad();
}

function ftInitParisChart(){
  const ctx = document.getElementById('ft_parisChart').getContext('2d');
  ftParisChartInst = new Chart(ctx,{
    type:'line',
    data:{datasets:[
      {label:'da/dN (Región II — Paris)', data:[], borderColor:'#1a5fa8', borderWidth:2, pointRadius:0, tension:0, fill:false},
      {label:'ΔK actual', data:[], borderColor:'#c8780a', backgroundColor:'#c8780a', pointRadius:6, showLine:false}
    ]},
    options:{responsive:true, maintainAspectRatio:false, animation:{duration:200},
      plugins:{legend:{labels:{color:tc,font:{size:11}}}, tooltip:{callbacks:{label:c=>` ΔK=${c.parsed.x.toFixed(1).replace('.',',')} → da/dN=${c.parsed.y.toExponential(2).replace('.',',')} mm/ciclo`}}},
      scales:{
        x:{type:'logarithmic', title:{display:true,text:'ΔK (MPa·√m)',color:tc,font:{size:11}}, grid:{color:gc}, ticks:{color:tc}},
        y:{type:'logarithmic', title:{display:true,text:'da/dN (mm/ciclo)',color:tc,font:{size:11}}, grid:{color:gc}, ticks:{color:tc}}
      }}
  });
}

function ftDadN(dk, C, m){
  return 1000*C*Math.pow(dk, m); // conversión de m/ciclo a mm/ciclo
}

// FIX (prototipo post-v6.19): integración real de la ley de Paris a lo
// largo de los ciclos, de a₀ a la grieta crítica a_c (donde ΔK=K_IC) --
// hasta acá el panel solo mostraba da/dN para un ΔK puntual fijo, sin
// noción de que ΔK=Y·Δσ·√(π·a) depende de la propia longitud de grieta,
// ni de cuántos ciclos hacen falta para llegar a la rotura.
const FT_NPASOS_INTEGRACION = 200;

// da/dN en m/ciclo (SI) -- misma ley que ftDadN() (que da mm/ciclo para un
// ΔK puntual elegido a mano), pero acá ΔK se calcula a partir de `a` vía
// ΔK=Y·Δσ·√(π·a). Unidades SI (a en metros) porque hace falta integrar en
// esa escala para obtener N en ciclos reales.
function ftDadNSi(a_m, C, m, Y, dSigma){
  const dk = Y*dSigma*Math.sqrt(Math.PI*a_m);
  return C*Math.pow(dk, m);
}

// Devuelve N(a) desde a₀ hasta a_c -- INTEGRACIÓN NUMÉRICA REAL de la ODE
// da/dN=C·(ΔK)^m (no una aproximación distinta ni una curva inventada).
// Se integra con paso FIJO EN `a` (en vez de en N, que sería un Euler
// explícito clásico) porque da/dN diverge cuando a→a_c (ΔK→K_IC): un paso
// fijo en N se queda corto al principio y se dispara al final, cerca de
// la singularidad. Invertir la relación (dN=da/(da/dN)) y avanzar en `a`
// evita ese problema de estabilidad numérica -- matemáticamente
// equivalente a integrar en N, solo cambia la variable de integración.
// Se usa la regla del trapecio sobre 1/(da/dN) entre pasos consecutivos
// (más preciso que un rectángulo simple cerca de la singularidad).
function ftCalcCurvaCrecimiento(C, m, Y, dSigma, a0_m, kic){
  if(!(kic>0) || !(dSigma>0) || !(Y>0) || !(a0_m>0)){
    return { valido:false, motivo:'Todos los parámetros (Δσ, a₀, Y, K_IC) deben ser números positivos mayores que cero.' };
  }
  const ac_m = (1/Math.PI) * Math.pow(kic/(Y*dSigma), 2);
  if(!(ac_m > a0_m)){
    return { valido:false, motivo:`La grieta inicial a₀ (${(a0_m*1000).toFixed(2)} mm) ya es mayor o igual que la longitud crítica a_c (${(ac_m*1000).toFixed(2)} mm) calculada con estos Δσ/Y/K_IC -- la pieza ya estaría rota. Bajá Δσ, subí K_IC o Y, o achicá a₀.` };
  }
  // FIX #81 (hallazgo QA v6.21, Etapa 18): el paso fijo y UNIFORME en `a`
  // tenía un error real de hasta 118% (verificado contra la solución
  // analítica cerrada de Paris para m=3) con los valores por defecto de esta
  // misma pestaña, y empeora cuanto más chico es a₀. El comentario original
  // decía que la dificultad numérica estaba "cerca de a_c (ΔK→K_IC)" -- pero
  // eso es físicamente incorrecto: da/dN es una función ACOTADA y suave en
  // todo el intervalo (en a=a_c vale C·K_IC^m, un número finito, no una
  // divergencia). La verdadera dificultad está en el otro extremo: el
  // integrando 1/(da/dN) ∝ a^(-m/2) es muy empinado cerca de a₀ (para
  // a₀=0,1mm, miles de veces mayor que en a_c), y un paso UNIFORME en `a`
  // subresuelve gravemente esa zona. La corrección es espaciar los pasos
  // GEOMÉTRICAMENTE (progresión log entre a₀ y a_c) en vez de linealmente --
  // así se concentra la resolución donde el integrando cambia rápido. Se
  // verificó contra la solución analítica (m=3) y contra una integración de
  // referencia de altísima resolución (m=4): error <0,05% en todo el rango
  // de a₀ del slider (0,1 a 5mm), contra hasta 118% del esquema anterior.
  const N = FT_NPASOS_INTEGRACION;
  const ratioAcA0 = ac_m / a0_m;
  const curva = [{ a: a0_m, N: 0 }];
  let acumN = 0;
  for (let i = 1; i <= N; i++) {
    const aPrev = a0_m * Math.pow(ratioAcA0, (i - 1) / N);
    const aNext = a0_m * Math.pow(ratioAcA0, i / N);
    const invPrev = 1 / ftDadNSi(aPrev, C, m, Y, dSigma);
    const invNext = 1 / ftDadNSi(aNext, C, m, Y, dSigma);
    acumN += (aNext - aPrev) * 0.5 * (invPrev + invNext);
    curva.push({ a: aNext, N: acumN });
  }
  return { valido: true, ac_m, curva, Nf: acumN };
}

function ftUpdateVelocidad(){
  const CRaw = parseFloat(document.getElementById('ft_parisC').value);
  const mRaw = parseFloat(document.getElementById('ft_parisM').value);
  const kicRaw = parseFloat(document.getElementById('ft_parisKic').value);
  const dk = parseFloat(document.getElementById('ft_dk').value)||1;
  document.getElementById('ft_dkVal').textContent = dk+' MPa·√m';

  // Parámetros nuevos de la integración -- <input type=range>,
  // estructuralmente inmunes a NaN (a diferencia de C/m/K_IC, que son
  // texto libre y sí necesitan el guard de abajo).
  const dSigma = parseFloat(document.getElementById('ft_dsigma').value)||1;
  const a0_mm = parseFloat(document.getElementById('ft_a0').value)||0.1;
  const Y = parseFloat(document.getElementById('ft_y').value)||1;
  document.getElementById('ft_dsigmaVal').textContent = dSigma+' MPa';
  document.getElementById('ft_a0Val').textContent = a0_mm.toFixed(1).replace('.',',')+' mm';
  document.getElementById('ft_yVal').textContent = Y.toFixed(2).replace('.',',');

  // FIX (QA v4.4 — hallazgo Etapa 4): C y m son campos de texto libre sin
  // validar -- un C o un m negativo tipeado a mano no daba NaN (da/dN sigue
  // siendo un número finito), sino un resultado numéricamente válido pero
  // físicamente imposible: una velocidad de propagación de grieta negativa
  // (la grieta "encogería" con cada ciclo de carga). Mismo criterio que
  // rt_mecaWarn (FIX #36) y fl_lmWarn (FIX #37): se valida antes de calcular
  // en vez de mostrar un resultado sin sentido sin avisar.
  // FIX (prototipo post-v6.19): K_IC (nuevo campo, también texto libre) se
  // valida acá mismo, junto a C y m -- misma naturaleza de error.
  const warnEl = document.getElementById('ft_parisWarn');
  const validC = isFinite(CRaw) && CRaw>0;
  const validM = isFinite(mRaw) && mRaw>0;
  const validKic = isFinite(kicRaw) && kicRaw>0;
  if(!validC || !validM || !validKic){
    document.getElementById('ft_mDadn').textContent = '—';
    document.getElementById('ft_mKic').textContent = '—';
    document.getElementById('ft_mAc').textContent = '—';
    document.getElementById('ft_mNfParis').textContent = '—';
    warnEl.style.display = 'block';
    warnEl.innerHTML = 'La constante C, el exponente m y la tenacidad K_IC deben ser números positivos mayores que cero (una velocidad de propagación de grieta no puede ser negativa, ni una tenacidad).';
    document.getElementById('ft_grietaWarn').style.display = 'none';
    if(ftParisChartInst){
      ftParisChartInst.data.datasets[0].data = [];
      ftParisChartInst.data.datasets[1].data = [];
      ftParisChartInst.update();
    }
    FT_ULTIMO = null;
    if (typeof ftDrawEscena === 'function') ftDrawEscena(document.getElementById('ft_svg'), 1, null);
    return;
  }
  warnEl.style.display = 'none';
  const C = CRaw, m = mRaw, kic = kicRaw;

  const dadn = ftDadN(dk, C, m);
  document.getElementById('ft_mDadn').textContent = dadn.toExponential(2).replace('.',',');
  document.getElementById('ft_mKic').textContent = kic.toFixed(0);

  const curve=[];
  for(let x=2; x<=60; x*=1.08){ curve.push({x, y: ftDadN(x,C,m)}); }
  if(ftParisChartInst){
    ftParisChartInst.data.datasets[0].data = curve;
    ftParisChartInst.data.datasets[1].data = [{x:dk, y:dadn}];
    ftParisChartInst.update();
  }

  // FIX (prototipo post-v6.19): integración de la ley de Paris a lo largo
  // de los ciclos (ver ftCalcCurvaCrecimiento() más arriba). a₀ se pasa en
  // metros (el slider está en mm, más cómodo de leer para el alumno).
  const grietaWarnEl = document.getElementById('ft_grietaWarn');
  const a0_m = a0_mm/1000;
  const resultado = ftCalcCurvaCrecimiento(C, m, Y, dSigma, a0_m, kic);
  if(!resultado.valido){
    document.getElementById('ft_mAc').textContent = '—';
    document.getElementById('ft_mNfParis').textContent = '—';
    grietaWarnEl.style.display = 'block';
    grietaWarnEl.innerHTML = resultado.motivo;
    FT_ULTIMO = null;
    if (typeof ftDrawEscena === 'function') ftDrawEscena(document.getElementById('ft_svg'), 1, null);
    return;
  }
  grietaWarnEl.style.display = 'none';
  document.getElementById('ft_mAc').textContent = (resultado.ac_m*1000).toFixed(2).replace('.',',');
  // FIX #67 (hallazgo QA v6.20, Etapa 4): este id era 'ft_mNf', el MISMO que
  // usa la tarjeta "Ciclos a rotura N" del panel de Curva S-N (ver línea ~166
  // de este archivo / rt_panel_ft_sn en index.html). Un id duplicado en el
  // documento hace que getElementById() siempre devuelva el PRIMERO que
  // aparece en el HTML (el de Curva S-N) -- así que este resultado nunca
  // llegaba a la tarjeta visible de este panel (Ley de Paris), que quedaba
  // pegada en "—" para siempre, mientras de paso pisaba en silencio el valor
  // de la tarjeta de Curva S-N cada vez que se tocaba este panel. Renombrado
  // a 'ft_mNfParis' (índice HTML también actualizado) para que cada panel
  // tenga su propio id.
  document.getElementById('ft_mNfParis').textContent = resultado.Nf.toExponential(2).replace('.',',');

  // Snapshot para la escena (ver comentario junto a la declaración de
  // FT_ULTIMO más arriba) + una sola línea que dibuja el estado final en
  // reposo -- mismo criterio que trUpdate()/utUpdate()/crUpdate()/
  // dsUpdate()/flUpdateComportamiento().
  FT_ULTIMO = { C, m, Y, dSigma, a0_m, kic, ac_m: resultado.ac_m, curva: resultado.curva, Nf: resultado.Nf };
  if (typeof ftDrawEscena === 'function') ftDrawEscena(document.getElementById('ft_svg'), 1, FT_ULTIMO);
}

/* ================================================================ FT5. FACTORES DE MARIN */
function ftInitFactoresChart(){
  const ctx = document.getElementById('ft_factoresChart').getContext('2d');
  ftFactoresChartInst = new Chart(ctx,{
    type:'bar',
    data:{labels:['k_a','k_b','k_c','k_d','k_e','S_e / S_e´'],
      datasets:[{label:'Valor', data:[], backgroundColor:['#1a5fa8','#1a5fa8','#1a5fa8','#1a5fa8','#1a5fa8','#c8780a']}]},
    options:{responsive:true, maintainAspectRatio:false, animation:{duration:200},
      plugins:{legend:{display:false}},
      scales:{
        x:{grid:{display:false}, ticks:{color:tc}},
        y:{min:0, max:1, title:{display:true,text:'Factor (adimensional)',color:tc,font:{size:11}}, grid:{color:gc}, ticks:{color:tc}}
      }}
  });
}

function ftUpdateFactores(){
  const seBaseRaw = parseFloat(document.getElementById('ft_seBase').value);
  const ka = parseFloat(document.getElementById('ft_ka').value)||1;
  const kb = parseFloat(document.getElementById('ft_kb').value)||1;
  const kc = parseFloat(document.getElementById('ft_kc').value)||1;
  const kd = parseFloat(document.getElementById('ft_kd').value)||1;
  const ke = parseFloat(document.getElementById('ft_ke').value)||1;
  document.getElementById('ft_kbVal').textContent = kb.toFixed(2).replace('.',',');
  document.getElementById('ft_kdVal').textContent = kd.toFixed(2).replace('.',',')+(kd>=0.99?' (T ambiente)':' (alta T)');

  // FIX (QA v4.4 — hallazgo Etapa 4): Se' es el único campo de texto libre
  // de esta sección (k_a..k_e son slider/select, ya a salvo por
  // construcción) -- un Se' negativo tipeado a mano daba un "límite de
  // fatiga" final negativo, sin sentido físico, sin ningún aviso. Mismo
  // criterio que ftUpdateVelocidad de arriba.
  const warnEl = document.getElementById('ft_marinWarn');
  const validSeBase = isFinite(seBaseRaw) && seBaseRaw>0;
  if(!validSeBase){
    document.getElementById('ft_mSe').textContent = '—';
    document.getElementById('ft_mReduccion').textContent = '—';
    warnEl.style.display = 'block';
    warnEl.innerHTML = 'El límite de fatiga base Se\' debe ser un número positivo mayor que cero.';
    if(ftFactoresChartInst){
      ftFactoresChartInst.data.datasets[0].data = [];
      ftFactoresChartInst.update();
    }
    return;
  }
  warnEl.style.display = 'none';
  const seBase = seBaseRaw;

  const factorTotal = ka*kb*kc*kd*ke;
  const se = seBase*factorTotal;
  document.getElementById('ft_mSe').textContent = se.toFixed(0);
  document.getElementById('ft_mReduccion').textContent = ((1-factorTotal)*100).toFixed(0);

  if(ftFactoresChartInst){
    ftFactoresChartInst.data.datasets[0].data = [ka,kb,kc,kd,ke, factorTotal];
    ftFactoresChartInst.update();
  }
}

// traccion.js — Tab 1: motor de curvas (genCurve), gráfico, animación de ensayo, ficha técnica

/* ============================================================ UNITS */
function toMM(v,u){return u==='cm'?v*10:u==='in'?v*25.4:v}
function toMM2(v,u){return u==='cm2'?v*100:u==='in2'?v*645.16:v}
// FIX #2: antes varios campos numéricos usaban el patrón `+valor||default`,
// que en JS trata al 0 como "falsy" -- si alguien tipeaba literalmente 0 en
// E, TS, %EL, d0, l0 o h0, el 0 se ignoraba en silencio y se reemplazaba por
// el valor por defecto, sin ningún aviso (a diferencia de σ_y, que sí
// respetaba el 0 porque su propio default también era 0). numOrDefault()
// solo cae al default cuando el campo está vacío o no es un número válido.
function numOrDefault(elId, def){
  const raw = document.getElementById(elId).value;
  const v = parseFloat(raw);
  return (raw==='' || isNaN(v)) ? def : v;
}
// FIX #64 (hallazgo QA v6.20, Etapa 1): l₀ y d₀ tienen min="1"/min="0.1" en el
// HTML, pero eso no bloquea tipear 0 (o un negativo) a mano en un input
// type="number" -- exactamente el mismo problema que ya se había corregido acá
// mismo en Compresión (ver updateCompDerived() más abajo, FIX QA v4.4). Sin
// esto, d₀=0 daba A₀=0 mm² y F_max=0 kN mostrados como si fueran resultados
// válidos, sin ningún aviso, pese a que una probeta sin sección es física-
// mente imposible. Se valida en updateDerived() (el único punto que corre en
// cada tecleo) y se deja un piso de seguridad DENTRO de getL0()/getA0() para
// que ningún otro cálculo aguas abajo (buildCurve, showFicha, etc.) reciba un
// 0 o negativo aunque el usuario no haya visto todavía el aviso.
function getL0(){
  const raw=toMM(numOrDefault('e_l0',50), document.getElementById('e_l0u').value);
  return raw>0 ? raw : 0.1;
}
// FIX #69 (hallazgo QA v6.21, Etapa 1): getA0() ya tenía un piso de seguridad
// para d₀≤0 (FIX #64), pero si el propio A₀ manual se tipeaba en 0 o negativo,
// la función caía en silencio al valor calculado desde d₀ -- sin ningún aviso,
// a diferencia de d₀/l₀. Un A₀ manual de -10 daba el mismo resultado que
// dejarlo vacío, mostrado como si el dato tipeado nunca hubiera sido inválido.
// Se agrega el mismo criterio de aviso que ya tienen d₀/l₀.
function getA0(){
  const ov=parseFloat(document.getElementById('e_a0').value);
  if(!isNaN(ov)&&ov>0) return toMM2(ov,document.getElementById('e_a0u').value);
  const d=toMM(numOrDefault('e_d0',12.8), document.getElementById('e_d0u').value);
  const dSeguro = d>0 ? d : 0.1;
  return Math.PI*(dSeguro/2)**2;
}
function updateDerived(){
  document.getElementById('dL0').textContent=getL0().toFixed(1).replace('.',',');
  document.getElementById('dA0').textContent=getA0().toFixed(1).replace('.',',');

  const warnEl = document.getElementById('e_warnDim');
  const l0raw = toMM(numOrDefault('e_l0',50), document.getElementById('e_l0u').value);
  const a0Text = document.getElementById('e_a0').value;
  const ovA0 = parseFloat(a0Text);
  const usaA0Manual = !isNaN(ovA0) && ovA0>0;
  const a0TipeadoInvalido = a0Text.trim()!=='' && !usaA0Manual;
  const d0raw = toMM(numOrDefault('e_d0',12.8), document.getElementById('e_d0u').value);
  const problemas = [];
  if (!(l0raw>0)) problemas.push('la longitud original l₀ debe ser un número positivo mayor que cero');
  if (a0TipeadoInvalido) problemas.push('el área A₀ tipeada manualmente debe ser un número positivo mayor que cero (se está ignorando y calculando desde d₀)');
  if (!usaA0Manual && !(d0raw>0)) problemas.push('el diámetro d₀ debe ser un número positivo mayor que cero');
  if (problemas.length) {
    warnEl.style.display='block';
    warnEl.innerHTML = `<strong>Dato inconsistente:</strong> ${problemas.join(' · ')}.`;
  } else {
    warnEl.style.display='none';
  }
}
function updateCompDerived(){
  const d=numOrDefault('co_d0',15);
  const h=numOrDefault('co_h0',30);
  const A=Math.PI*(d/2)**2;
  document.getElementById('co_dA0').textContent=A.toFixed(1).replace('.',',');
  const warnEl = document.getElementById('co_warnRatio');
  // FIX (QA v4.4 — hallazgo Etapa 2): d₀ tiene min="1" en el HTML, pero eso
  // no bloquea tipear 0 (o un negativo) a mano en un input type="number".
  // Con d₀<=0 la relación h₀/d₀ daba Infinity/NaN y se mostraba tal cual en
  // pantalla ("h₀/d₀ = Infinity está fuera del rango..."), un texto poco
  // profesional para un dato que ya de por sí no tiene sentido físico
  // (un diámetro no puede ser cero ni negativo). Se valida antes de dividir,
  // mismo criterio que numOrDefault ya usa para vacío/no-numérico.
  if (!(d>0)) {
    document.getElementById('co_ratio').textContent = '—';
    warnEl.style.display = 'block';
    warnEl.textContent = 'El diámetro d₀ debe ser un número positivo mayor que cero.';
    return;
  }
  // FIX #71 (hallazgo QA v6.21, Etapa 2): h₀≤0 no tenía un mensaje propio --
  // caía en el aviso genérico de "fuera del rango recomendado (1 a 3), la
  // probeta podría pandear", el mismo texto que se usa para una probeta
  // simplemente corta. Una altura negativa o cero no es un riesgo de pandeo,
  // es un dato imposible; se agrega un mensaje dedicado, mismo criterio que
  // ya tiene d₀ acá arriba.
  if (!(h>0)) {
    document.getElementById('co_ratio').textContent = '—';
    warnEl.style.display = 'block';
    warnEl.textContent = 'La altura h₀ debe ser un número positivo mayor que cero.';
    return;
  }
  const ratio=h/d;
  document.getElementById('co_ratio').textContent=ratio.toFixed(2).replace('.',',');
  // FIX #11: el texto de ayuda ya menciona que fuera de 1-3 la probeta puede
  // pandear, pero nunca se avisaba en pantalla si esto ocurría. Se agrega el
  // aviso, igual en espíritu al que ya existe en Brinell para d/D.
  if (ratio < 1 || ratio > 3) {
    warnEl.style.display = 'block';
    warnEl.textContent = `h₀/d₀ = ${ratio.toFixed(2).replace('.',',')} está fuera del rango recomendado (1 a 3). La probeta podría pandear (flexionar) en vez de aplastarse uniformemente, y el ensayo dejaría de ser válido.`;
  } else {
    warnEl.style.display = 'none';
  }
}

/* ============================================================ CURVE ENGINE */
function genCurve(E_GPa, sy, ts, el_pct, fluencia=false) {
  // FIX #3: blindaje anti-E<=0 — un módulo de elasticidad nulo o negativo (input
  // vacío/inválido, ej. en la pestaña "Comparar materiales") hacía que ey=sy/E
  // diera Infinity y contaminara toda la curva con NaN/Infinity. Si E no es un
  // número positivo válido, se usa un valor mínimo de seguridad (1 GPa) en vez
  // de dejar que la curva explote.
  const E_GPa_safe = (isFinite(E_GPa) && E_GPa>0) ? E_GPa : 1;
  // FIX #63 (hallazgo QA v6.16, C6-01): mismo blindaje que E_GPa_safe, pero
  // para %EL<=0. Antes este piso vivía DUPLICADO en los 5 lugares que llaman
  // a genCurve() (buildCurve() acá abajo, comparar.js, compuesto.js x2,
  // ficha.js) en vez de estar acá adentro -- confirmado con el arnés de
  // testing que, llamando a genCurve() directo con el_pct<=0, la curva
  // colapsaba entera en x:0,y:0 (o daba deformaciones/tensiones NEGATIVAS
  // con el_pct<0), exactamente el bug que el comentario de buildCurve() ya
  // describía haber corregido -- pero corregido afuera, no adentro de la
  // función pura. Se mueve el piso acá para que sea imposible de omitir en
  // un futuro sexto llamador.
  const el_pct_safe = (isFinite(el_pct) && el_pct>0) ? el_pct : 0.01;
  const E = E_GPa_safe*1000, el=el_pct_safe/100;
  const frag = sy<=0;
  const pts=[];
  if(frag){
    // FIX #1: antes había un término de "ablandamiento" (t-0.65)^2 que hacía
    // bajar la curva hasta ~95% de TS cerca del final, y como el punto de
    // fractura de abajo se fuerza siempre a TS exacto, se veía un salto
    // vertical (baja y después pega un salto hacia arriba) justo antes de
    // romper, en TODOS los materiales frágiles. Ahora la curva sube en línea
    // recta y hace un plateau liso en TS, así el punto de fractura queda
    // continuo con el resto de la curva.
    // Además: con algunos presets (ej. fibra de carbono, madera) la recta
    // elástica eps*E no alcanza a TS dentro del %EL declarado -- quedaba un
    // salto residual más chico pero visible. Igual que en compresión (FIX #4),
    // si hace falta más deformación que el %EL*0.93 para llegar a TS, se
    // estira apenas el rango (nunca se acorta) para que la curva cierre lisa.
    const epsFrag = Math.max(el*0.93, (ts/E)*1.02);
    for(let i=0;i<=90;i++){
      const t=i/90, eps=t*epsFrag;
      const sig=Math.min(eps*E, ts);
      pts.push({x:+eps.toFixed(7),y:+sig.toFixed(2),phase:'elastic'});
    }
    pts.push({x:+epsFrag.toFixed(7),y:+ts.toFixed(2),phase:'fracture'});
    return pts;
  }
  const ey_raw=sy/E, ef=el;
  // FIX #3 (nuevo): si sy/E (deformación de fluencia teórica) es mayor o casi
  // igual a la deformación total de fractura (ef), el dato de entrada es una
  // combinación imposible -- por ejemplo un E o %EL mal cargados, o un campo
  // vacío que se evaluó como 0. Sin este clamp, la fase elástica sola ya
  // "gastaba" toda la deformación disponible y las fases siguientes quedaban
  // obligadas a retroceder en X (curva invertida / en zigzag).
  // Acotamos ey a lo sumo a la mitad de ef, dejando margen real para las
  // fases de plástico y estricción antes de llegar a ef.
  const ey = Math.min(ey_raw, ef*0.5);
  let ets = el*0.68;
  if (ets <= ey) ets = Math.min(ey*1.3, ef*0.95);
  if (ets <= ey) ets = ey*1.01; // último resorte si ef es muy chico
  ets = Math.min(ets, ef*0.99); // FIX #3: ets nunca puede alcanzar ni superar ef
  for(let i=0;i<=40;i++){
    const eps=(i/40)*ey;
    pts.push({x:+eps.toFixed(7),y:+(eps*E).toFixed(2),phase:'elastic'});
  }
  // FIX #1: la oscilación de fluencia avanza ε más allá de "ey" (hasta ey+0.0024),
  // pero el tramo plástico principal (más abajo) arrancaba siempre desde "ey" otra
  // vez, generando un retroceso en X (la curva "volvía para atrás" antes de seguir).
  // plasticStart marca dónde debe empezar realmente el tramo plástico principal,
  // y si hace falta, se corre "ets" para que siga habiendo margen hacia ef.
  let plasticStart = ey;
  if(fluencia && sy>0){
    const syUpper=sy*1.05, syLower=sy*0.97;
    pts.push({x:+ey.toFixed(7),y:+syUpper.toFixed(2),phase:'plastic'});
    // FIX #3 (parte 2): el paso fijo de 0.0003 entre puntos de oscilación puede,
    // si ef es muy chico, hacer que estos mismos puntos ya superen ef -- antes
    // de que se llegara siquiera a acotar "plasticStart" más abajo. Se acota el
    // paso para que los 8 puntos de oscilación siempre entren en el margen
    // disponible entre ey y el límite de plasticStart (ef*0.6).
    const room = Math.max(0, ef*0.6 - ey);
    const oscStep = Math.min(0.0003, room/8.5);
    for(let i=0;i<=8;i++){
      const osc=syLower+(Math.sin(i*2.2)*sy*0.01);
      pts.push({x:+(ey+i*oscStep).toFixed(7),y:+osc.toFixed(2),phase:'plastic'});
    }
    plasticStart = Math.min(ey + 8*oscStep, ef*0.6);
    if (ets <= plasticStart) ets = Math.min(plasticStart*1.3, ef*0.95);
    if (ets <= plasticStart) ets = plasticStart*1.01;
    ets = Math.min(ets, ef*0.99); // FIX #3: clamp final también en esta rama
  }
  for(let i=1;i<=80;i++){
    const t=i/80, eps=plasticStart+t*(ets-plasticStart);
    const sig=sy+(ts-sy)*(1-Math.pow(1-t,1.7));
    pts.push({x:+eps.toFixed(7),y:+sig.toFixed(2),phase:'plastic'});
  }
  for(let i=1;i<=30;i++){
    const t=i/30, eps=ets+t*(ef-ets);
    const sig=ts-(ts-sy*0.52)*Math.pow(t,0.75);
    pts.push({x:+eps.toFixed(7),y:+Math.max(0,sig).toFixed(2),phase:i===30?'fracture':'neck'});
  }
  return pts;
}

function splitPhases(pts){
  const el=[],pl=[],nk=[],fr=[];
  let lE=null,lP=null,lN=null;
  for(const p of pts){
    if(p.phase==='elastic') {el.push({x:p.x,y:p.y});lE={x:p.x,y:p.y}}
    if(p.phase==='plastic') {if(!pl.length&&lE)pl.push(lE);pl.push({x:p.x,y:p.y});lP={x:p.x,y:p.y}}
    if(p.phase==='neck')    {if(!nk.length&&lP)nk.push(lP);nk.push({x:p.x,y:p.y});lN={x:p.x,y:p.y}}
    if(p.phase==='fracture'){const pv=lN||lP||lE;if(pv)fr.push(pv);fr.push({x:p.x,y:p.y})}
  }
  return [el,pl,nk,fr];
}

function calcTenacity(pts){
  let sum=0;
  for(let i=1;i<pts.length;i++) sum+=(pts[i].x-pts[i-1].x)*(pts[i].y+pts[i-1].y)/2;
  return sum;
}

// FIX #1: calcResilience — antes incluía el segmento elastic→plastic (break incorrecto con &&)
// Corrección: break tan pronto como el punto ACTUAL (i) no es elástico
function calcResilience(pts){
  let sum=0;
  for(let i=1;i<pts.length;i++){
    if(pts[i].phase!=='elastic') break;   // ✅ detener al primer punto no-elástico
    sum+=(pts[i].x-pts[i-1].x)*(pts[i].y+pts[i-1].y)/2;
  }
  return sum;
}

/* ============================================================ SHADING PLUGIN */
function buildShadingPlugin(curveRef) {
  return {
    id:'shading',
    afterDatasetsDraw(chart) {
      if (!document.getElementById('e_showShading')?.checked) return;
      if (!curveRef.pts || !curveRef.pts.length) return;
      const ctx = chart.ctx;
      const xScale = chart.scales.x;
      const yScale = chart.scales.y;
      const pts = curveRef.pts;
      const elasticPts = pts.filter(p=>p.phase==='elastic');
      if (!elasticPts.length) return;
      const yBase = yScale.getPixelForValue(0);

      ctx.save();
      ctx.beginPath();
      ctx.fillStyle = 'rgba(33,118,174,0.15)';
      ctx.moveTo(xScale.getPixelForValue(0), yBase);
      for(const p of elasticPts) ctx.lineTo(xScale.getPixelForValue(p.x), yScale.getPixelForValue(p.y));
      ctx.lineTo(xScale.getPixelForValue(elasticPts[elasticPts.length-1].x), yBase);
      ctx.closePath(); ctx.fill(); ctx.restore();

      const beyondElastic = pts.filter(p=>p.phase!=='elastic'&&p.phase!=='fracture');
      if (!beyondElastic.length) return;
      ctx.save();
      ctx.beginPath();
      ctx.fillStyle = 'rgba(26,140,94,0.10)';
      const transitionPt = elasticPts[elasticPts.length-1];
      ctx.moveTo(xScale.getPixelForValue(transitionPt.x), yBase);
      ctx.lineTo(xScale.getPixelForValue(transitionPt.x), yScale.getPixelForValue(transitionPt.y));
      for(const p of beyondElastic) ctx.lineTo(xScale.getPixelForValue(p.x), yScale.getPixelForValue(p.y));
      const lastPt = beyondElastic[beyondElastic.length-1];
      ctx.lineTo(xScale.getPixelForValue(lastPt.x), yBase);
      ctx.closePath(); ctx.fill(); ctx.restore();
    }
  };
}

/* ============================================================ DISCHARGE */
let dischargeCurve = null;
let isDischarging = false;
let dischargeProgress = 0;
let dischargeResidual = 0;

function triggerDischarge() {
  if (!fullCurve.length || progress < 2) return;
  const idx = Math.floor(progress);
  const current = fullCurve[Math.min(idx, fullCurve.length-1)];
  if (current.phase !== 'plastic' && current.phase !== 'neck') {
    document.getElementById('dischargeInfo').textContent = 'Solo puede descargarse desde la zona plástica (pausa el ensayo primero).';
    document.getElementById('dischargeInfo').style.display = 'block';
    return;
  }
  playing = false;
  document.getElementById('e_playBtn').textContent = '▶ Continuar';
  // FIX #70 (hallazgo QA v6.21, Etapa 1): buildCurve() ya usa un piso de
  // 1 GPa cuando E≤0 (así la curva nunca es una vertical infinita), pero acá
  // se leía el E crudo sin ese mismo piso -- con E=0 tipeado, E_MPa daba 0 y
  // elasticStrain=curSig/0=Infinity, mostrando "ε_res = -Infinity" al alumno
  // pese a que la curva ya se había dibujado con el piso aplicado. Se usa el
  // mismo criterio de piso que buildCurve() para que la descarga sea
  // consistente con la curva que el alumno ya está viendo en pantalla.
  const E_raw = numOrDefault('e_E',207);
  const E = (isFinite(E_raw) && E_raw>0) ? E_raw : 1;
  const E_MPa = E * 1000;
  const curEps = current.x;
  const curSig = current.y;
  const elasticStrain = curSig / E_MPa;
  dischargeResidual = curEps - elasticStrain;
  dischargeCurve = [];
  for (let i=0; i<=30; i++){
    const t = i/30;
    const eps = curEps - t * elasticStrain;
    const sig = curSig * (1 - t);
    dischargeCurve.push({x:+eps.toFixed(7), y:+Math.max(0,sig).toFixed(2)});
  }
  isDischarging = true;
  dischargeProgress = 0;
  animateDischarge();

  document.getElementById('dischargeInfo').innerHTML =
    `<strong>Deformación residual permanente:</strong> ε_res = ${dischargeResidual.toFixed(5).replace('.',',')} (Δl_perm = ${(dischargeResidual*getL0()).toFixed(3).replace('.',',')} mm)<br>
    La curva de descarga es paralela a la zona elástica — el módulo E no cambia. Esto ilustra el <em>endurecimiento por deformación</em>.`;
  document.getElementById('dischargeInfo').style.display = 'block';
}

function animateDischarge() {
  if (!isDischarging) return;
  const speed = parseFloat(document.getElementById('e_speed').value)||2;
  dischargeProgress = Math.min(dischargeCurve.length, dischargeProgress + speed);
  const vis = dischargeCurve.slice(0, Math.floor(dischargeProgress));
  if (mainChart.data.datasets.length < 5) {
    mainChart.data.datasets.push({
      label:'Descarga',data:[],borderColor:'#c8780a',borderWidth:2,
      pointRadius:0,tension:0,fill:false,borderDash:[4,3]
    });
  }
  mainChart.data.datasets[4].data = vis.map(p=>({x:p.x,y:p.y}));
  mainChart.update('none');
  if (dischargeProgress < dischargeCurve.length) requestAnimationFrame(animateDischarge);
  else isDischarging = false;
}

/* ============================================================ CHART INIT */
const isDark=matchMedia('(prefers-color-scheme:dark)').matches;
const gc=isDark?'rgba(255,255,255,0.07)':'rgba(0,0,0,0.07)';
const tc=isDark?'#8a8880':'#72706a';

const curveRef = { pts: null };
const shadingPlugin = buildShadingPlugin(curveRef);

function makeChartBase(id, extraDatasets=[], extraOpts={}) {
  const baseDS = [
    {label:'Elástica',   data:[],borderColor:'#2176ae',borderWidth:2.5,pointRadius:0,tension:0,  fill:false},
    {label:'Plástica',   data:[],borderColor:'#1a8c5e',borderWidth:2.5,pointRadius:0,tension:0.2,fill:false},
    {label:'Estricción', data:[],borderColor:'#c8780a',borderWidth:2.5,pointRadius:0,tension:0.3,fill:false},
    {label:'Fractura',   data:[],borderColor:'#c43535',borderWidth:2.5,pointRadius:6,pointBackgroundColor:'#c43535',tension:0,fill:false},
    ...extraDatasets
  ];
  return new Chart(document.getElementById(id).getContext('2d'),{
    type:'line', data:{datasets:baseDS},
    options:{responsive:true,maintainAspectRatio:false,animation:{duration:0},
      plugins:{legend:{display:false},tooltip:{callbacks:{label:c=>` σ=${c.parsed.y.toFixed(1).replace('.',',')} MPa  ε=${c.parsed.x.toFixed(5).replace('.',',')}`}}},
      scales:{
        x:{type:'linear',title:{display:true,text:'Deformación nominal ε',color:tc,font:{size:12}},
           grid:{color:gc},ticks:{color:tc,maxTicksLimit:8,callback:v=>v.toFixed(3).replace('.',',')}},
        y:{title:{display:true,text:'Tensión σ (MPa)',color:tc,font:{size:12}},
           grid:{color:gc},ticks:{color:tc,maxTicksLimit:8}}
      },...extraOpts},
    plugins:[shadingPlugin]
  });
}

let mainChart = makeChartBase('mainChart', [
  {label:'Descarga',data:[],borderColor:'#c8780a',borderWidth:2,pointRadius:0,tension:0,fill:false,borderDash:[4,3]}
]);
let zoomChart  = makeChartBase('zoomChart');

function rebuildMainChart() {
  mainChart.update('none');
}

/* ============================================================ ZOOM SYNC */
function updateZoom(fullCurve){
  if(!fullCurve.length) return;
  const elasticPts = fullCurve.filter(p=>p.phase==='elastic');
  if(!elasticPts.length) return;
  const [el] = splitPhases(elasticPts);
  zoomChart.data.datasets[0].data = el;
  [1,2,3].forEach(i=>zoomChart.data.datasets[i].data=[]);
  const maxE = elasticPts[elasticPts.length-1];
  zoomChart.options.scales.x.max = maxE.x * 1.3;
  zoomChart.options.scales.y.max = maxE.y * 1.3;
  zoomChart.update('none');
}

/* ============================================================ PROBETA */
// Perfil de espesor a lo largo de la probeta: hombros fijos + estricción
// localizada que se hace más profunda y más angosta a medida que avanza t.
function probThicknessProfile(x, cx, gaugeStart, gaugeEnd, shoulderLen, headRef, uniformTh, dipAmp, sigma){
  const gauss = Math.exp(-((x-cx)*(x-cx))/(2*sigma*sigma));
  const gaugeVal = uniformTh - dipAmp*gauss;
  const ease = f => f*f*(3-2*f); // smoothstep
  if(x < gaugeStart+shoulderLen){
    const f = Math.max(0, Math.min(1,(x-gaugeStart)/shoulderLen));
    return headRef + (gaugeVal-headRef)*ease(f);
  }
  if(x > gaugeEnd-shoulderLen){
    const f = Math.max(0, Math.min(1,(gaugeEnd-x)/shoulderLen));
    return headRef + (gaugeVal-headRef)*ease(f);
  }
  return gaugeVal;
}
function buildOutline(xStart, xEnd, cyVal, thFn, n){
  const top=[], bot=[];
  for(let i=0;i<=n;i++){
    const x = xStart + (xEnd-xStart)*i/n;
    const th = thFn(x);
    top.push(`${x.toFixed(2)},${(cyVal-th/2).toFixed(2)}`);
    bot.push(`${x.toFixed(2)},${(cyVal+th/2).toFixed(2)}`);
  }
  return `M${top.join(' L')} L${bot.reverse().join(' L')} Z`;
}
function drawProbeta(t, phase){
  const svg=document.getElementById('probSVG');
  if(!svg) return;
  const W=500,H=56,cx=W/2,cy=H/2;
  const colors={elastic:'#2176ae',plastic:'#1a8c5e',neck:'#c8780a',fracture:'#c43535'};
  const col=colors[phase]||'#2176ae';
  const fillOp = phase==='fracture' ? 0.22 : 0.15;

  const baseTh=32;              // espesor original (elástico)
  const minTh=baseTh*0.34;      // espesor mínimo en el cuello, justo antes de romper
  const headLen=32, headH=baseTh+12, shoulderLen=26;
  const headW = 420, leftHead = cx-headW/2, rightHead = cx+headW/2;
  const gaugeStart = leftHead+headLen, gaugeEnd = rightHead-headLen;
  const gaugeLen = gaugeEnd-gaugeStart;
  const headRef = headH*0.88;

  // Espesor "de fondo" (uniforme, sin localizar) y profundidad/anchura del cuello según fase
  let uniformTh=baseTh, dipAmp=0, sigma=gaugeLen*0.30;
  if(phase==='plastic'){
    uniformTh = baseTh - baseTh*0.10*t;           // adelgazamiento uniforme leve (aún sin localizar)
  }
  if(phase==='neck' || phase==='fracture'){
    uniformTh = baseTh*0.90;                       // parte del adelgazamiento uniforme ya alcanzado
    const tt = phase==='fracture' ? 1 : t;
    dipAmp = Math.pow(tt,0.55) * (uniformTh - minTh);   // el cuello se profundiza gradualmente
    sigma = gaugeLen*(0.30 - 0.14*tt);                  // y se va localizando (más angosto) con el tiempo
  }
  const thFn = x => probThicknessProfile(x,cx,gaugeStart,gaugeEnd,shoulderLen,headRef,uniformTh,dipAmp,sigma);
  const neckThNow = thFn(cx);
  const areaPct = Math.max(0, (1-(neckThNow/baseTh)*(neckThNow/baseTh))*100);

  if(phase !== 'fracture'){
    const arrColor = col;
    const arrLen = 22 + (phase==='elastic'?0:phase==='plastic'?6:12);
    const arrows = phase!=='elastic' ? `
      <line x1="${leftHead - 5}" y1="${cy}" x2="${leftHead - 5 - arrLen}" y2="${cy}" stroke="${arrColor}" stroke-width="2" opacity="0.7"/>
      <polygon points="${leftHead-5-arrLen},${cy} ${leftHead-5-arrLen+8},${cy-4} ${leftHead-5-arrLen+8},${cy+4}" fill="${arrColor}" opacity="0.7"/>
      <line x1="${rightHead + 5}" y1="${cy}" x2="${rightHead + 5 + arrLen}" y2="${cy}" stroke="${arrColor}" stroke-width="2" opacity="0.7"/>
      <polygon points="${rightHead+5+arrLen},${cy} ${rightHead+5+arrLen-8},${cy-4} ${rightHead+5+arrLen-8},${cy+4}" fill="${arrColor}" opacity="0.7"/>
    ` : '';

    // Línea de longitud medida (extensómetro), solo en zona elástica
    const extH = cy - headH/2 - 5;
    const extLine = phase==='elastic' ? `
      <line x1="${cx-30}" y1="${extH}" x2="${cx+30}" y2="${extH}" stroke="${col}" stroke-width="1" stroke-dasharray="3,2" opacity="0.5"/>
      <line x1="${cx-30}" y1="${extH-3}" x2="${cx-30}" y2="${extH+3}" stroke="${col}" stroke-width="1" opacity="0.5"/>
      <line x1="${cx+30}" y1="${extH-3}" x2="${cx+30}" y2="${extH+3}" stroke="${col}" stroke-width="1" opacity="0.5"/>
    ` : '';

    // Calibre indicando el diámetro reducido en el cuello (crece a medida que se marca la estricción)
    const neckGauge = (phase==='neck' && t>0.12) ? `
      <line x1="${cx}" y1="${cy-neckThNow/2-6}" x2="${cx}" y2="${cy-baseTh/2-6}" stroke="${col}" stroke-width="1" stroke-dasharray="2,2" opacity="0.55"/>
      <line x1="${cx}" y1="${cy+neckThNow/2+6}" x2="${cx}" y2="${cy+baseTh/2+6}" stroke="${col}" stroke-width="1" stroke-dasharray="2,2" opacity="0.55"/>
    ` : '';

    svg.innerHTML=`
      <defs>
        <linearGradient id="probGrad_${phase}" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="${col}" stop-opacity="${fillOp*1.4}"/>
          <stop offset="45%" stop-color="${col}" stop-opacity="${fillOp*0.7}"/>
          <stop offset="100%" stop-color="${col}" stop-opacity="${fillOp*1.4}"/>
        </linearGradient>
      </defs>
      ${arrows}
      ${extLine}
      <!-- Cabezas mordaza izquierda y derecha -->
      <rect x="${leftHead}" y="${cy-headH/2}" width="${headLen}" height="${headH}" rx="3" fill="${col}" fill-opacity="0.22" stroke="${col}" stroke-width="1.2"/>
      <rect x="${rightHead-headLen}" y="${cy-headH/2}" width="${headLen}" height="${headH}" rx="3" fill="${col}" fill-opacity="0.22" stroke="${col}" stroke-width="1.2"/>
      <!-- Cuerpo de la probeta: perfil suave, se angosta localmente al formarse el cuello -->
      <path d="${buildOutline(gaugeStart,gaugeEnd,cy,thFn,40)}" fill="url(#probGrad_${phase})" stroke="${col}" stroke-width="1.5" stroke-linejoin="round"/>
      ${neckGauge}
      <text x="${cx}" y="${cy-headH/2-9}" text-anchor="middle" font-size="9" font-weight="600" fill="var(--text)" font-family="system-ui,sans-serif">
        ${phase==='elastic'?'zona elástica':phase==='plastic'?'↔ deformación plástica uniforme':`⚠ estricción — cuello formándose (${areaPct.toFixed(0).replace('.',',')}% menos área)`}
      </text>`;
  } else {
    // Fractura dúctil: rotura tipo "copa y cono" en el punto más fino del cuello
    const gap = 10 + 6*Math.min(1, (dipAmp/(uniformTh-minTh))||1);
    const leftEnd = cx - gap/2, rightStart = cx + gap/2;
    const thFnClamped = x => Math.max(thFn(x), minTh*0.94);
    svg.innerHTML=`
      <defs>
        <linearGradient id="fracGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="${col}" stop-opacity="0.26"/>
          <stop offset="50%" stop-color="${col}" stop-opacity="0.11"/>
          <stop offset="100%" stop-color="${col}" stop-opacity="0.26"/>
        </linearGradient>
      </defs>
      <!-- Mordazas -->
      <rect x="${leftHead}" y="${cy-headH/2}" width="${headLen}" height="${headH}" rx="3" fill="${col}" fill-opacity="0.22" stroke="${col}" stroke-width="1.2"/>
      <rect x="${rightHead-headLen}" y="${cy-headH/2}" width="${headLen}" height="${headH}" rx="3" fill="${col}" fill-opacity="0.22" stroke="${col}" stroke-width="1.2"/>
      <!-- Mitad izquierda: conserva el perfil de cuello, termina en punta fina -->
      <path d="${buildOutline(gaugeStart,leftEnd,cy,thFnClamped,26)}" fill="url(#fracGrad)" stroke="${col}" stroke-width="1.5" stroke-linejoin="round"/>
      <polyline points="${leftEnd-3},${cy-minTh*0.55} ${leftEnd+2},${cy-2} ${leftEnd-2},${cy+3} ${leftEnd-3},${cy+minTh*0.55}"
        fill="none" stroke="${col}" stroke-width="1.4" opacity="0.85"/>
      <!-- Mitad derecha -->
      <path d="${buildOutline(rightStart,gaugeEnd,cy,thFnClamped,26)}" fill="url(#fracGrad)" stroke="${col}" stroke-width="1.5" stroke-linejoin="round"/>
      <polyline points="${rightStart+3},${cy-minTh*0.55} ${rightStart-2},${cy-2} ${rightStart+2},${cy+3} ${rightStart+3},${cy+minTh*0.55}"
        fill="none" stroke="${col}" stroke-width="1.4" opacity="0.85"/>
      <text x="${cx}" y="${cy-headH/2-9}" text-anchor="middle" font-size="9" font-weight="700" fill="var(--text)" font-family="system-ui,sans-serif">FRACTURA — rotura en el cuello (copa y cono)</text>`;
  }
}

function drawCompProbeta(eps_c, phase, frag){
  const svg = document.getElementById('compProbSVG');
  if(!svg) return;
  const W=500,H=60,cx=W/2,cy=H/2;
  // FIX #65 (hallazgo QA v6.20, Etapa 1): origH/origW eran constantes fijas,
  // sin relación con la relación h₀/d₀ real que el alumno carga en el
  // sidebar -- con h₀/d₀=5 (fuera del rango 1-3, aviso de pandeo activo en
  // updateCompDerived()) la probeta dibujada se veía IDÉNTICA a una con
  // h₀/d₀=1, contradiciendo el propio aviso de texto que aparece arriba.
  // Se deriva origW a partir de la relación h₀/d₀ real (tomando la relación
  // 2,0 -- el punto medio del rango recomendado 1-3 -- como referencia visual,
  // ya que es el valor con el que ya se había ajustado a mano el aspecto
  // 42/64 de las constantes originales). Se clampea el factor visual para
  // que geometrías muy extremas sigan siendo legibles dentro del viewBox de
  // 500x60 en vez de degenerar en una línea o un óvalo. origH se deja fijo:
  // solo representa la referencia de partida para la animación de
  // aplastamiento (eps_c ya maneja el acortamiento en tiempo real, sin
  // relación con h₀/d₀).
  const co_d0 = numOrDefault('co_d0', 15), co_h0 = numOrDefault('co_h0', 30);
  const ratioReal = co_d0>0 ? co_h0/co_d0 : 2.0;
  const RATIO_REF = 2.0;
  const factorVisual = Math.min(2.5, Math.max(0.4, ratioReal/RATIO_REF));
  const origH=42, origW=64/factorVisual;
  const nu=0.33;
  const absEps = Math.min(0.32, -eps_c);
  const scaleH = Math.max(0.28, 1+eps_c);
  const newH = origH*scaleH;
  // Abarrilamiento: el centro se ensancha más que los extremos (fricción en los platos)
  const endScale = 1 + nu*absEps*0.55;     // extremos (junto a platos), ensanchan menos
  const midScale  = 1 + nu*absEps*1.55;    // centro, ensancha más -> forma de barril
  const colors={elastic:'#2176ae',plastic:'#1a8c5e',fracture:'#c43535'};
  const col = colors[phase] || (absEps>0.0006 ? colors.plastic : colors.elastic);

  const platH=8, gap=2;
  const by=cy-newH/2, topPlate=by-gap-platH, botPlate=by+newH+gap;

  const isBrittleBreak = frag && phase==='fracture';
  const n=24;
  const left=[], right=[];
  for(let i=0;i<=n;i++){
    const f = i/n;                       // 0 arriba, 1 abajo
    const bulge = Math.sin(f*Math.PI);   // 0 en extremos, 1 en el centro
    const scale = endScale + (midScale-endScale)*bulge;
    const halfW = (origW*scale)/2;
    const y = by + newH*f;
    left.push(`${(cx-halfW).toFixed(2)},${y.toFixed(2)}`);
    right.push(`${(cx+halfW).toFixed(2)},${y.toFixed(2)}`);
  }
  const bodyPath = `M${left.join(' L')} L${right.reverse().join(' L')} Z`;

  // Grieta diagonal a ~45° típica de falla por corte en materiales frágiles
  const shearCrack = isBrittleBreak ? `
    <line x1="${cx-origW*0.42}" y1="${by+newH*0.18}" x2="${cx+origW*0.42}" y2="${by+newH*0.82}"
      stroke="${col}" stroke-width="2" opacity="0.9"/>
    <line x1="${cx-origW*0.30}" y1="${by+newH*0.08}" x2="${cx-origW*0.10}" y2="${by+newH*0.24}"
      stroke="${col}" stroke-width="1.2" opacity="0.6"/>
    <line x1="${cx+origW*0.10}" y1="${by+newH*0.76}" x2="${cx+origW*0.30}" y2="${by+newH*0.92}"
      stroke="${col}" stroke-width="1.2" opacity="0.6"/>` : '';

  const label = isBrittleBreak ? `Falla frágil (corte a 45°)`
    : `Aplastamiento = ${(absEps*100).toFixed(1).replace('.',',')}%${phase==='plastic'||absEps>0.001?' · abarrilamiento':''}`;

  svg.innerHTML=`
    <defs>
      <linearGradient id="compGrad" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stop-color="${col}" stop-opacity="0.10"/>
        <stop offset="50%" stop-color="${col}" stop-opacity="0.22"/>
        <stop offset="100%" stop-color="${col}" stop-opacity="0.10"/>
      </linearGradient>
    </defs>
    <!-- Plato superior e inferior de la prensa -->
    <rect x="${cx-95}" y="${topPlate}" width="190" height="${platH}" rx="2" fill="${col}" fill-opacity="0.28" stroke="${col}" stroke-width="1.2"/>
    <rect x="${cx-95}" y="${botPlate}" width="190" height="${platH}" rx="2" fill="${col}" fill-opacity="0.28" stroke="${col}" stroke-width="1.2"/>
    <!-- Flechas de fuerza -->
    <line x1="${cx}" y1="${topPlate-14}" x2="${cx}" y2="${topPlate-2}" stroke="${col}" stroke-width="2" opacity="0.7"/>
    <polygon points="${cx},${topPlate-2} ${cx-4},${topPlate-8} ${cx+4},${topPlate-8}" fill="${col}" opacity="0.7"/>
    <line x1="${cx}" y1="${botPlate+platH+14}" x2="${cx}" y2="${botPlate+platH+2}" stroke="${col}" stroke-width="2" opacity="0.7"/>
    <polygon points="${cx},${botPlate+platH+2} ${cx-4},${botPlate+platH+8} ${cx+4},${botPlate+platH+8}" fill="${col}" opacity="0.7"/>
    <!-- Cuerpo abarrilado -->
    <path d="${bodyPath}" fill="url(#compGrad)" stroke="${col}" stroke-width="1.5" stroke-linejoin="round"/>
    ${shearCrack}
    <text x="${cx}" y="${H-4}" text-anchor="middle" font-size="9" font-weight="600" fill="var(--text)" font-family="system-ui,sans-serif">${label}</text>`;
}

/* ============================================================ POISSON UPDATE */
function updatePoisson(eps) {
  const nu = numOrDefault('e_nu',0.30);
  const eps_lat = -nu * eps;
  const diam_change = eps_lat * 100;
  const scaleW = Math.max(0.3, 1 + eps_lat);
  const scaleH = Math.min(2.5, 1 + eps*0.8);
  const w = Math.round(40*scaleW), h = Math.round(60*scaleH);
  const actual = document.getElementById('pois_actual');
  actual.style.width = w+'px';
  actual.style.height = h+'px';
  document.getElementById('pois_nu').textContent = nu.toFixed(2).replace('.',',');
  document.getElementById('pois_deld').textContent = diam_change.toFixed(3).replace('.',',')+'%';
  document.getElementById('pois_elat').textContent = eps_lat.toFixed(5).replace('.',',');
}

/* ============================================================ PHASE INFO */
function phaseInfo(p){
  return {
    elastic: '<strong>Zona elástica</strong> — σ = E·ε. La probeta vuelve a su longitud original si se retira la carga. El sombreado azul es la <em>resiliencia</em> (energía elástica almacenada).',
    plastic: '<strong>Zona plástica</strong> — Se superó σ_y. La deformación es <em>permanente</em>. El material se endurece. El área verde representa la energía adicional (tenacidad). Podés usar el botón "Descargar" para ver la deformación residual.',
    neck:    '<strong>Estricción</strong> — Se alcanzó la TS. El área se reduce localmente formando un "cuello". La tensión nominal cae aunque la tensión real sigue subiendo.',
    fracture:'<strong>Fractura</strong> — La probeta se rompe. El ensayo finaliza.'
  }[p]||'';
}
const phaseLabel={elastic:'Elástica',plastic:'Plástica',neck:'Estricción',fracture:'Fractura'};
const phaseColor={elastic:'#2176ae',plastic:'#1a8c5e',neck:'#c8780a',fracture:'#c43535'};

/* ============================================================ SIMULATION LOOP */
let playing=false, animId=null, progress=0, fullCurve=[];

function togglePlay(){
  if(!playing && progress>=fullCurve.length && fullCurve.length>0){resetSim();return;}
  if(!fullCurve.length) buildCurve();
  playing=!playing;
  document.getElementById('e_playBtn').textContent=playing?'⏸ Pausar':'▶ Continuar';
  const currentPt = fullCurve[Math.min(Math.floor(progress),fullCurve.length-1)];
  if (currentPt && (currentPt.phase==='plastic'||currentPt.phase==='neck')) {
    document.getElementById('e_dischargeBtn').style.display = 'block';
  }
  if(playing) tick();
}

function resetSim(){
  playing=false; cancelAnimationFrame(animId); progress=0; fullCurve=[]; dischargeCurve=null; isDischarging=false;
  mainChart.data.datasets.forEach(d=>d.data=[]);
  mainChart.update('none');
  zoomChart.data.datasets.forEach(d=>d.data=[]);
  zoomChart.update('none');
  document.getElementById('e_playBtn').textContent='▶ Iniciar ensayo';
  document.getElementById('e_dischargeBtn').style.display='none';
  document.getElementById('dischargeInfo').style.display='none';
  ['mF','mSig','mDl','mEps'].forEach(id=>document.getElementById(id).textContent=id==='mEps'?'0.0000':'0');
  document.getElementById('infoBar').textContent='Configurá la probeta y el material, luego iniciá el ensayo.';
  document.getElementById('probState').textContent='Sin carga';
  drawProbeta(0,'elastic');
  ['rE','rSy','rTs','rEl','rAR','rFmax','rDltot','rTen','rRes','rEfrac','rNu','rTipo'].forEach(id=>document.getElementById(id).textContent='—');
  document.getElementById('formulasNote').style.display='none';
  curveRef.pts = null;
  updatePoisson(0);
}

function buildCurve(){
  const E_raw=numOrDefault('e_E',207);
  // FIX (QA v5.12): antes se mostraba E_raw tal cual en la tarjeta "E (GPa)"
  // (incluso 0), mientras que genCurve() ya aplicaba por su cuenta un piso de
  // 1 GPa para no romper la curva (FIX #3) -- el número en pantalla no
  // coincidía con el que realmente generó la curva dibujada. Se aplica el
  // mismo piso acá, una sola vez, y se usa ese valor (E) tanto para mostrar
  // como para calcular ey más abajo -- mismo criterio que el bloque de
  // %EL<=0 de acá abajo.
  const E = (isFinite(E_raw) && E_raw>0) ? E_raw : 1;
  const sy=+document.getElementById('e_sy').value||0;
  const ts=numOrDefault('e_ts',450);
  let el=numOrDefault('e_el',20);
  // FIX (QA v5.5 → v5.6, hallazgo Etapa 3): este mismo piso ya existía en
  // Comparar (FIX #5), Temperatura (FIX #29) y Material compuesto -- todos
  // motores que reusan genCurve() -- pero nunca se había propagado de vuelta
  // a la pestaña principal de Tracción, que es donde aparentemente se
  // detectó el problema por primera vez. Un %EL tipeado a mano en 0 colapsaba
  // toda la curva en una línea vertical pegada a x=0; un %EL negativo hacía
  // que genCurve devolviera deformaciones (ε) negativas, con tenacidad y
  // resiliencia sin sentido físico (resiliencia > tenacidad) mostradas en la
  // Ficha Técnica.
  // FIX #63 (hallazgo QA v6.16, C6-01): genCurve() ahora tiene este mismo
  // piso adentro suyo (el_pct_safe), así que esta línea quedó redundante --
  // se deja de todos modos como defensa en capas (no cuesta nada y protege
  // el resto de esta función, que usa "el" para otras cosas antes de llegar
  // a llamar a genCurve).
  if (el<=0) el=0.01;
  const nu=numOrDefault('e_nu',0.30);
  const flu=document.getElementById('e_fluencia').checked;
  // FIX #10: aviso si σy > TS (dato físicamente inconsistente: el límite
  // elástico no puede superar la resistencia máxima a la tracción). No se
  // bloquea el ensayo, pero se avisa -- antes no había ninguna validación.
  const warnSyTs = document.getElementById('e_warnSyTs');
  if (sy > 0 && sy > ts) {
    warnSyTs.style.display = 'block';
    warnSyTs.innerHTML = `<strong>Dato inconsistente:</strong> σ_y (${sy} MPa) no puede ser mayor que TS (${ts} MPa). Revisá los valores.`;
  } else {
    warnSyTs.style.display = 'none';
  }
  fullCurve=genCurve(E,sy,ts,el,flu);
  curveRef.pts = fullCurve;
  mainChart.options.scales.x.max=el/100*1.12;
  mainChart.options.scales.y.max=ts*1.18;
  const l0=getL0(), a0=getA0();
  const ten=calcTenacity(fullCurve), res=calcResilience(fullCurve);
  const el_frac = el/100;
  const d0=numOrDefault('e_d0',12.8);
  // FIX #3 (WARN): %AR — valor estimado, se documenta su limitación en la nota
  const ar = Math.min(80, el*0.85);
  const ey=sy>0?sy/(E*1000):0;

  document.getElementById('rE').textContent=E+' GPa';
  document.getElementById('rSy').textContent=sy>0?sy+' MPa':'— frágil';
  document.getElementById('rTs').textContent=ts+' MPa';
  document.getElementById('rEl').textContent=el+'%';
  document.getElementById('rAR').textContent=sy>0?ar.toFixed(1).replace('.',',')+'% *':'— frágil';
  document.getElementById('rFmax').textContent=((ts*a0)/1000).toFixed(2).replace('.',',');
  document.getElementById('rDltot').textContent=(el_frac*l0).toFixed(2).replace('.',',');
  document.getElementById('rTen').textContent=ten.toFixed(3).replace('.',',');
  // FIX #6: en materiales frágiles, calcResilience() no puede aislar una fase
  // "elástica" real (toda la curva frágil está marcada como 'elastic' salvo el
  // punto de fractura), así que el número que devolvía terminaba siendo
  // idéntico a la Tenacidad -- contradiciendo la propia nota de más abajo, que
  // ya mostraba "—" para este caso. Ahora la tarjeta es consistente con la nota.
  document.getElementById('rRes').textContent=sy>0?(res*1000).toFixed(2).replace('.',','):'— frágil';
  document.getElementById('rEfrac').textContent=el_frac.toFixed(5).replace('.',',');
  document.getElementById('rNu').textContent=nu.toFixed(2).replace('.',',');
  document.getElementById('rTipo').textContent=sy>0?'Dúctil (copa-cono)':'Frágil (plano)';

  // FIX #1: res ahora es correcto → la fórmula y el valor numérico coinciden
  const UR = res * 1000; // kJ/m³
  const UR_analytic = sy>0 ? (sy*sy)/(2*E*1000)*1000 : 0; // σ_y²/(2E) en kJ/m³
  const UR_formula = sy>0
    ? `σ_y²/(2E) = ${sy}²/(2×${E}×10³) = ${UR_analytic.toFixed(2).replace('.',',')} kJ/m³ — numérico: ${UR.toFixed(2).replace('.',',')} kJ/m³`
    : '—';

  document.getElementById('formulasNote').innerHTML=`
    <strong>Cálculos explícitos:</strong><br>
    l_f = l₀ + %EL·l₀ = ${l0} + ${el}%×${l0} = <strong>${(l0+el_frac*l0).toFixed(2).replace('.',',')} mm</strong> (l_f se reconstruye a partir del %EL cargado, no es una medición independiente; en un ensayo real es al revés: se mide l_f después de la rotura y con eso se calcula el %EL)<br>
    %EL = (l_f − l₀)/l₀ × 100 = (${(l0+el_frac*l0).toFixed(2).replace('.',',')} − ${l0}) / ${l0} × 100 = <strong>${el}%</strong><br>
    * %AR es una <em>aproximación empírica simplificada</em> (correlación con %EL). El valor real depende de la geometría y el endurecimiento por deformación.<br>
    Módulo de resiliencia U_R = σ_y²/(2E) → ${UR_formula}<br>
    Tenacidad ≈ área bajo la curva completa (integral numérica trapezoidal) = <strong>${ten.toFixed(3).replace('.',',')} MJ/m³</strong><br>
    F_máx = TS × A₀ = ${ts} MPa × ${a0.toFixed(1).replace('.',',')} mm² = <strong>${((ts*a0)/1000).toFixed(2).replace('.',',')} kN</strong>
  `;
  document.getElementById('formulasNote').style.display='block';
  updateZoom(fullCurve);
}

function tick(){
  if(!playing) return;
  const speed=+document.getElementById('e_speed').value;
  const n=Math.min(fullCurve.length,Math.floor(progress));
  const vis=fullCurve.slice(0,n);
  const [el,pl,nk,fr]=splitPhases(vis);
  mainChart.data.datasets[0].data=el;
  mainChart.data.datasets[1].data=pl;
  mainChart.data.datasets[2].data=nk;
  mainChart.data.datasets[3].data=fr;
  mainChart.update('none');

  const last=vis[vis.length-1];
  if(last){
    const l0=getL0(),a0=getA0();
    document.getElementById('mSig').textContent=last.y.toFixed(1).replace('.',',');
    document.getElementById('mEps').textContent=last.x.toFixed(5).replace('.',',');
    document.getElementById('mDl').textContent=(last.x*l0).toFixed(3).replace('.',',');
    document.getElementById('mF').textContent=Math.round(last.y*a0);
    document.getElementById('infoBar').innerHTML=phaseInfo(last.phase)+
      `<span class="phase-pill" style="background:${phaseColor[last.phase]}22;color:${phaseColor[last.phase]}">${phaseLabel[last.phase]}</span>`;
    const nkPts=vis.filter(p=>p.phase==='neck').length;
    drawProbeta(last.phase==='fracture'?1:last.phase==='neck'?nkPts/30:last.phase==='plastic'?vis.filter(p=>p.phase==='plastic').length/80:0, last.phase);
    document.getElementById('probState').textContent=phaseLabel[last.phase];
    updatePoisson(last.x);
    if(last.phase==='plastic'||last.phase==='neck'){
      document.getElementById('e_dischargeBtn').style.display='block';
    }
  }
  if(progress<fullCurve.length){progress+=speed; animId=requestAnimationFrame(tick);}
  else{
    playing=false;
    document.getElementById('e_playBtn').textContent='↺ Reiniciar';
    document.getElementById('e_dischargeBtn').style.display='none';
    setTimeout(showFicha, 600);
  }
}

/* ============================================================ FICHA TÉCNICA */
function showFicha() {
  const E_raw=numOrDefault('e_E',207);
  // FIX (QA v5.12): mismo piso de 1 GPa que buildCurve() de arriba -- ver
  // ese comentario para el detalle. Sin esto la Ficha Técnica podía mostrar
  // "E = 0 GPa" pese a que la curva ya se había generado con el piso de
  // seguridad de genCurve() (FIX #3).
  const E = (isFinite(E_raw) && E_raw>0) ? E_raw : 1;
  const sy=+document.getElementById('e_sy').value||0;
  const ts=numOrDefault('e_ts',450);
  // FIX (QA v5.5 → v5.6, hallazgo Etapa 3): mismo piso que buildCurve() de
  // arriba -- sin esto, la Ficha Técnica podía mostrar %EL y %AR negativos
  // en pantalla/impresión aunque la curva ya se hubiera generado con el
  // valor corregido.
  let el=numOrDefault('e_el',20);
  if (el<=0) el=0.01;
  const nu=numOrDefault('e_nu',0.30);
  const l0=getL0(), a0=getA0();
  const el_frac=el/100;
  // FIX #68 (hallazgo QA v6.20, Etapa 11): fullCurve es la variable global
  // que llena buildCurve(), y ESA solo corre la primera vez que se aprieta
  // "Iniciar ensayo" (y se vacía de nuevo con "Reiniciar", ver resetSim() más
  // arriba) -- si el alumno configura una probeta y va derecho a "Ficha
  // técnica" sin haber corrido el ensayo ni una vez, fullCurve seguía siendo
  // el arreglo vacío inicial. calcTenacity/calcResilience sobre un arreglo
  // vacío devuelven 0 sin tirar ningún error, así que la ficha mostraba
  // "Módulo de resiliencia U_R: 0,00 kJ/m³" y "Tenacidad: 0,000 MJ/m³" (y la
  // miniatura de la curva quedaba vacía) como si esos fueran los resultados
  // reales, mientras el resto de la ficha (F_max, TS, E) sí se recalculaba en
  // vivo desde los campos de entrada -- una inconsistencia real entre
  // secciones de la misma ficha. Si todavía no hay curva generada, se genera
  // una al vuelo acá mismo con los mismos parámetros y la misma función
  // (genCurve) que usa buildCurve(), sin necesidad de que el alumno haya
  // iniciado el ensayo antes.
  const curvaFicha = fullCurve.length ? fullCurve : genCurve(E,sy,ts,el,document.getElementById('e_fluencia').checked);
  const ten=calcTenacity(curvaFicha), res=calcResilience(curvaFicha);
  const ar=Math.min(80,el*0.85);
  const frag=sy<=0;
  const now=new Date().toLocaleString('es-AR');

  const fichaBody=document.getElementById('fichaBody');
  fichaBody.innerHTML=`
  <div class="ficha-header">
    <div>
      <div class="ficha-title">Informe de Ensayo de Tracción</div>
      <div class="ficha-meta">Fecha: ${now} — Simulador de Ensayos Mecánicos v${SIM_VERSION}</div>
    </div>
    <div style="text-align:right">
      <div class="ficha-badge ${frag?'badge-fragil':'badge-ductil'}">${frag?'MATERIAL FRÁGIL':'MATERIAL DÚCTIL'}</div>
    </div>
  </div>
  <div class="ficha">
    <div class="ficha-sec">
      <h3>Datos de la probeta</h3>
      <div class="ficha-row"><span class="fk">Longitud original l₀</span><span class="fv">${l0.toFixed(1).replace('.',',')} mm</span></div>
      <div class="ficha-row"><span class="fk">Área transversal A₀</span><span class="fv">${a0.toFixed(2).replace('.',',')} mm²</span></div>
      <div class="ficha-row"><span class="fk">Diámetro d₀</span><span class="fv">${(2*Math.sqrt(a0/Math.PI)).toFixed(2).replace('.',',')} mm</span></div>
      <div class="ficha-row"><span class="fk">Tipo de probeta</span><span class="fv">Cilíndrica</span></div>
    </div>
    <div class="ficha-sec">
      <h3>Propiedades elásticas</h3>
      <div class="ficha-row"><span class="fk">Módulo de elasticidad E</span><span class="fv">${E} GPa</span></div>
      <div class="ficha-row"><span class="fk">Coeficiente de Poisson ν</span><span class="fv">${nu.toFixed(2).replace('.',',')}</span></div>
      <div class="ficha-row"><span class="fk">Límite elástico σ_y</span><span class="fv">${sy>0?sy+' MPa':'— (frágil)'}</span></div>
      <div class="ficha-row"><span class="fk">Módulo de resiliencia U_R</span><span class="fv">${(res*1000).toFixed(2).replace('.',',')} kJ/m³</span></div>
    </div>
    <div class="ficha-sec">
      <h3>Resistencia</h3>
      <div class="ficha-row"><span class="fk">Resistencia a la tracción TS</span><span class="fv">${ts} MPa</span></div>
      <div class="ficha-row"><span class="fk">Fuerza máxima F_max</span><span class="fv">${((ts*a0)/1000).toFixed(2).replace('.',',')} kN</span></div>
      <div class="ficha-row"><span class="fk">Tenacidad (área bajo curva)</span><span class="fv">${ten.toFixed(3).replace('.',',')} MJ/m³</span></div>
      <div class="ficha-row"><span class="fk">Tipo de fractura</span><span class="fv">${frag?'Frágil (plano)':'Dúctil (copa-cono)'}</span></div>
    </div>
    <div class="ficha-sec">
      <h3>Ductilidad</h3>
      <div class="ficha-row"><span class="fk">%EL (elongación)</span><span class="fv">${el.toFixed(1).replace('.',',')} %</span></div>
      <div class="ficha-row"><span class="fk">Alargamiento total Δl</span><span class="fv">${(el_frac*l0).toFixed(2).replace('.',',')} mm</span></div>
      <div class="ficha-row"><span class="fk">%AR (reducción de área, est.)</span><span class="fv">${sy>0?ar.toFixed(1).replace('.',',')+' % *':'— (frágil)'}</span></div>
      <div class="ficha-row"><span class="fk">Deformación en fractura ε_f</span><span class="fv">${el_frac.toFixed(5).replace('.',',')}</span></div>
    </div>
    <div class="ficha-sec ficha-full">
      <h3>Miniatura de la curva σ — ε</h3>
      <div class="ficha-mini"><canvas id="fichaChart"></canvas></div>
    </div>
  </div>
  <div class="note" style="margin-top:10px">* %AR es una aproximación empírica simplificada. El valor real depende de la geometría de la probeta y el endurecimiento por deformación del material.</div>
  <div class="no-print" style="margin-top:12px;display:flex;gap:10px;flex-wrap:wrap">
    <button class="btn-primary" style="width:auto;padding:8px 20px" onclick="printFicha()">⬇ Imprimir / Guardar PDF</button>
    <button class="btn-secondary" style="width:auto;padding:8px 20px" onclick="closeFicha()">Cerrar</button>
  </div>`;

  document.getElementById('fichaModal').style.display='flex';

  setTimeout(()=>{
    const miniCtx = document.getElementById('fichaChart')?.getContext('2d');
    if (!miniCtx) return;
    const [el_,pl,nk,fr]=splitPhases(curvaFicha);
    new Chart(miniCtx,{type:'line',data:{datasets:[
      {data:el_,borderColor:'#2176ae',borderWidth:2,pointRadius:0,tension:0,fill:false},
      {data:pl, borderColor:'#1a8c5e',borderWidth:2,pointRadius:0,tension:0.2,fill:false},
      {data:nk, borderColor:'#c8780a',borderWidth:2,pointRadius:0,tension:0.3,fill:false},
      {data:fr, borderColor:'#c43535',borderWidth:2,pointRadius:5,pointBackgroundColor:'#c43535',tension:0,fill:false},
    ]},options:{responsive:true,maintainAspectRatio:false,animation:{duration:0},
      plugins:{legend:{display:false},tooltip:{enabled:false}},
      scales:{x:{type:'linear',grid:{color:gc},ticks:{color:tc,maxTicksLimit:5,callback:v=>v.toFixed(3).replace('.',',')}},
              y:{grid:{color:gc},ticks:{color:tc,maxTicksLimit:5}}}}});
  },100);
}

function closeFicha(){ document.getElementById('fichaModal').style.display='none'; }
function printFicha(){ window.print(); }


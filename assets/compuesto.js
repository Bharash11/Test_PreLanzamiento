// compuesto.js — Tab 5: material compuesto (regla de mezclas)

/* ============================================================ TAB 5: COMPOUND */
// numOrDefault() (usada en Componente 1/2 más abajo) ya está definida junto a
// getL0()/getA0() más arriba en el archivo -- respeta el 0 explícito en vez
// de reemplazarlo en silencio por el valor por defecto (ver FIX #2).
let compoundChartInst=null;
// FIX #35 (generalizado): aviso informativo (no bloqueante) para CUALQUIER
// combinación matriz/refuerzo de "Material compuesto" que no tenga una ruta
// de fabricación real conocida. Se basa en dos reglas físicas, direccionales
// (matriz -> componente 1, refuerzo -> componente 2; no es lo mismo A+B que B+A):
//
// Regla 1 (madera como matriz): la madera no tiene un proceso real de
// consolidación de MATRIZ compuesta (no se sinteriza, funde ni cura como un
// polímero/cerámico/metal/hormigón). En los compuestos reales con madera,
// la madera es casi siempre el REFUERZO/relleno (ej. compuestos madera-plástico,
// tableros de partículas con cemento) -- no al revés.
//
// Regla 2 (compatibilidad térmica): si la matriz necesita formarse
// (fundirse/sinterizarse/curarse) a una temperatura mayor a la que el
// refuerzo puede tolerar sin degradarse o fundirse, el refuerzo no
// sobreviviría el proceso de fabricación real. Ej.: acero (matriz, ~1500°C)
// + algarrobo (refuerzo, se carboniza ~250°C) -> el algarrobo no llega vivo
// al final del proceso. En cambio hormigón (matriz, cura en frío ~80°C) +
// acero (refuerzo, ~1500°C) SÍ es real -- es hormigón armado -- porque acá
// la matriz nunca somete al refuerzo a su propia temperatura de fusión.
//
// Regla 3 (jerarquía de rigidez): el refuerzo tiene que ser más rígido (E
// mayor) que la matriz -- es ese salto de rigidez el que define su función.
// Un "refuerzo" más blando que la matriz (ej. acero matriz + plomo refuerzo)
// no refuerza nada, diluye las propiedades hacia abajo.
//
// Es una aproximación pensada para advertir, no para certificar: no cubre
// incompatibilidades químicas (ej. reactividad interfacial) ni de adherencia,
// solo el criterio térmico + el caso particular de la madera como matriz.
const PROC_TEMP_C = {
  acero:1500, aceroinox:1450, aluminio:660, cobre:1085, titanio:1668,
  fragil:1200, nylon:220, carbono:3000, ceramica:1700, hormigon:80,
  madera:250, pino:250, algarrobo:250, quebracho:250,
  niquel:1455, molibdeno:2623, magnesio:650, zinc:420, plata:962,
  plomo:327, tungsteno:3422, laton:930, oro:1064,
  // FIX #75 (hallazgo QA v6.21, Etapa 5): esta tabla nunca se actualizó
  // cuando se agregaron los 18 "materiales nuevos v4.10" a los selectores de
  // Matriz/Refuerzo de este mismo módulo -- dzCompoundPlausibility() corta
  // en la primera línea (`!(k1 in PROC_TEMP_C)`) para cualquier combinación
  // que use alguno de estos 18, así que las 3 reglas de plausibilidad
  // (térmica, madera-matriz, rigidez) quedaban desactivadas en silencio para
  // casi la mitad del catálogo de materiales -- ej. matriz SiC (sinteriza a
  // >2000°C) + refuerzo PVC rígido (funde a ~160°C) no disparaba ningún
  // aviso. Valores aproximados de temperatura de proceso/fusión/sinterizado
  // por material, mismo criterio que la tabla original (referencia de manual
  // de ingeniería, no una norma primaria citada):
  aisi1045:1500, acero4140:1500,           // aceros -- mismo rango que "acero"
  aluminio7075:635, aluminio2024:638,      // aleaciones de Al (funden más bajo que el Al puro)
  broncefosforico:1000, hierronodular:1150, // aleaciones de Cu / fundición de Fe
  inconel718:1300, titaniocp2:1668,        // superaleación de Ni / Ti puro comercial
  sic:2200, si3n4:1850, zirconia:1600,     // cerámicos técnicos -- temperatura de sinterizado
  gfrp:180, kevlarepoxi:180,               // compuestos con matriz epoxi -- temp. de curado de la resina
  hdpe:135, pp:165, pvcrigido:200, abs:220, pc:300, // polímeros -- temp. de procesamiento/fusión
};
const ORGANIC_SET = new Set(['madera','pino','algarrobo','quebracho']);
// FIX #43 (hallazgo Etapa 8 QA v6.5): la Regla 3 recibía las CLAVES de preset
// (k1, k2) y volvía a mirar PRESETS[k].E -- pero si el alumno parte de un
// preset y después edita a mano el campo E1/E2 (algo que la UI permite y que
// la curva/regla de mezclas de abajo sí respetan), la Regla 3 seguía evaluando
// el E viejo del preset, no el que el alumno realmente cargó. Resultado: un
// aviso de "el refuerzo es menos rígido" que no se actualizaba (ni aparecía
// ni desaparecía) al corregir el E a mano. Ahora recibe los E ya resueltos en
// vivo (E1, E2 -- los mismos que usa renderCompound() para la curva) en vez
// de volver a resolverlos por su cuenta a partir de la clave del preset.
function dzCompoundPlausibility(k1, k2, E1live, E2live){
  if (!(k1 in PROC_TEMP_C) || !(k2 in PROC_TEMP_C)) return null; // sin material elegido
  if (ORGANIC_SET.has(k1) && !ORGANIC_SET.has(k2)) {
    return `La madera no tiene un proceso real de fabricación como matriz de un compuesto: no se funde, sinteriza ni cura como un metal/cerámico/polímero/hormigón. En la práctica la madera es el refuerzo (ej. compuestos madera-plástico), no la matriz.`;
  }
  const tMatrix = PROC_TEMP_C[k1], tRef = PROC_TEMP_C[k2];
  if (tMatrix > tRef) {
    return `La matriz se procesa/funde a ~${tMatrix}°C, muy por encima de lo que el refuerzo puede tolerar (~${tRef}°C) sin degradarse o fundirse durante la fabricación.`;
  }
  // Regla 3 (jerarquía de rigidez): el refuerzo tiene que ser MÁS rígido que
  // la matriz -- es justamente ese salto de rigidez el que hace que "refuerce"
  // algo. Si el E del refuerzo es menor al de la matriz, no está reforzando:
  // está diluyendo las propiedades de la matriz hacia abajo. Usa el E EN VIVO
  // de los campos E1/E2 (ya resueltos con su piso por renderCompound()), no
  // el de PRESETS -- ver FIX #43 arriba.
  if (E1live!=null && E2live!=null && E2live < E1live) {
    return `El refuerzo (E≈${E2live} GPa) es menos rígido que la matriz (E≈${E1live} GPa): no cumple una función de refuerzo real, diluye la rigidez de la matriz en vez de mejorarla.`;
  }
  return null;
}
function renderCompound(){
  const E1_raw=numOrDefault('k1_E',207);
  const E2_raw=numOrDefault('k2_E',230);
  // FIX #39 (hallazgo Etapa 9 QA v5.14): acá el problema era más serio que en
  // Comparar/Temperatura -- E1/E2 no solo alimentan genCurve() (que ya se
  // blinda solo con su propio piso interno), sino también E_par/E_ser (regla
  // de mezclas) DIRECTO, sin blindaje. Con E1=0 tipeado a mano, E_ser=1/(f1/E1
  // +f2/E2) evaluaba a 0 (matemáticamente consistente -- 1/Infinity=0 -- pero
  // sigue sin corresponder a la curva C1 dibujada, que sí usaba el piso de 1
  // GPa de genCurve()). Se pisa E1/E2 ACÁ, antes de cualquier otro uso, para
  // que curva y regla de mezclas usen siempre el mismo valor.
  const E1=(isFinite(E1_raw) && E1_raw>0) ? E1_raw : 1;
  const E2=(isFinite(E2_raw) && E2_raw>0) ? E2_raw : 1;
  const sy1=numOrDefault('k1_sy',250);
  const ts1=numOrDefault('k1_ts',450);
  // El %EL es la base de una potencia en la fórmula de el_mix (más abajo) y también
  // define la deformación final de la curva en genCurve; un 0 literal ahí generaría
  // NaN en un caso y una curva invertida en el otro. Se le pone un piso de 0.01%
  // (ductilidad casi nula, pero no nula) en vez de rechazarlo o de reemplazarlo por
  // un valor por defecto no relacionado (lo cual era el problema original del #6).
  // FIX #63 (hallazgo QA v6.16, C6-01): genCurve() ahora tiene este mismo piso
  // adentro suyo, pero acá el piso sigue siendo necesario igual, porque el1/el2
  // también son la base de la potencia de el_mix un poco más abajo -- ese uso
  // no pasa por genCurve() y seguiría expuesto a un 0 literal sin este clamp.
  let el1=numOrDefault('k1_el',20); if(el1<=0) el1=0.01;
  const ts2=numOrDefault('k2_ts',3500);
  let el2=numOrDefault('k2_el',1.5); if(el2<=0) el2=0.01;
  const f2=Math.min(0.99,Math.max(0.01,numOrDefault('k_f2',0.3)));
  const f1=1-f2;
  const E_par=E1*f1+E2*f2, E_ser=1/(f1/E1+f2/E2);
  const ts_mix=ts1*f1+ts2*f2, sy_mix=sy1*f1;
  const el_mix=Math.min(el1,el2*(el1/el2)**f2)*f1+el2*f2*0.3;
  const c1=genCurve(E1,sy1,ts1,el1,false);
  const c2=genCurve(E2,0,ts2,el2,true);
  const cComp=genCurve(E_par,sy_mix,ts_mix,el_mix,false);
  // FIX (compuesto): maxX/maxY se calculaban solo a partir de el1/el_mix y ts1/ts_mix,
  // ignorando por completo la curva del componente 2 (c2). Con los valores por defecto
  // de esta misma pestaña (matriz + fibra de carbono, TS₂=3500 MPa) la curva de c2
  // quedaba cortada a menos de la mitad de su altura real. Ahora se toma el máximo
  // real entre las tres curvas graficadas.
  const maxX=Math.max(c1[c1.length-1].x, c2[c2.length-1].x, cComp[cComp.length-1].x)*1.12;
  const maxY=Math.max(Math.max(...c1.map(p=>p.y)), Math.max(...c2.map(p=>p.y)), Math.max(...cComp.map(p=>p.y)))*1.15;
  if(!compoundChartInst){
    compoundChartInst=new Chart(document.getElementById('compoundChart').getContext('2d'),{
      type:'line',data:{datasets:[
        // FIX v5.11 (backlog punto E, auditoría de daltonismo): C1 y C2 antes
        // tenían el MISMO patrón de trazo (borderDash:[5,3] en los dos) y
        // legend:{display:false} más abajo -- solo el color (azul/violeta)
        // los distinguía entre sí. Se les da un trazo distinto a cada uno.
        {label:'C1',data:[],borderColor:'#2176ae',borderWidth:2,pointRadius:0,tension:0.15,fill:false,borderDash:[5,3]},
        {label:'C2',data:[],borderColor:'#7b2fa8',borderWidth:2,pointRadius:0,tension:0.15,fill:false,borderDash:[2,2]},
        {label:'Comp',data:[],borderColor:'#c8780a',borderWidth:3,pointRadius:0,tension:0.15,fill:false},
        {label:'Cf',data:[],borderColor:'#c8780a',borderWidth:2.5,pointRadius:6,pointBackgroundColor:'#c8780a',fill:false},
      ]},
      options:{responsive:true,maintainAspectRatio:false,animation:{duration:300},
        plugins:{legend:{display:false},tooltip:{callbacks:{label:c=>`${c.dataset.label}: σ=${c.parsed.y.toFixed(1).replace('.',',')} MPa  ε=${c.parsed.x.toFixed(5).replace('.',',')}`}}},
        scales:{x:{type:'linear',title:{display:true,text:'Deformación nominal ε',color:tc,font:{size:12}},grid:{color:gc},ticks:{color:tc,maxTicksLimit:8,callback:v=>v.toFixed(3).replace('.',',')}},
                y:{title:{display:true,text:'Tensión σ (MPa)',color:tc,font:{size:12}},grid:{color:gc},ticks:{color:tc,maxTicksLimit:8}}}}
    });
  }
  compoundChartInst.data.datasets[0].data=c1.filter(p=>p.phase!=='fracture').map(p=>({x:p.x,y:p.y}));
  compoundChartInst.data.datasets[1].data=c2.filter(p=>p.phase!=='fracture').map(p=>({x:p.x,y:p.y}));
  compoundChartInst.data.datasets[2].data=cComp.filter(p=>p.phase!=='fracture').map(p=>({x:p.x,y:p.y}));
  const fc=cComp[cComp.length-1];
  compoundChartInst.data.datasets[3].data=[{x:fc.x,y:fc.y}];
  compoundChartInst.options.scales.x.max=maxX;
  compoundChartInst.options.scales.y.max=maxY;
  compoundChartInst.update();
  document.getElementById('compResult').style.display='block';
  document.getElementById('compResult').innerHTML=`<table>
    <tr><th>Propiedad</th><th>Comp. 1 (f₁=${(f1*100).toFixed(0)}%)</th><th>Comp. 2 (f₂=${(f2*100).toFixed(0)}%)</th><th>Compuesto estimado</th></tr>
    <tr><td>E — paralelo (GPa) *</td><td>${E1}</td><td>${E2}</td><td>${E_par.toFixed(1).replace('.',',')}</td></tr>
    <tr><td>E — serie (GPa)</td><td>${E1}</td><td>${E2}</td><td>${E_ser.toFixed(1).replace('.',',')}</td></tr>
    <tr><td>TS (MPa)</td><td>${ts1}</td><td>${ts2}</td><td>${ts_mix.toFixed(0)}</td></tr>
    <tr><td>σ_y estimado (MPa)</td><td>${sy1>0?sy1:'— (frágil)'}</td><td>— (frágil) **</td><td>${sy_mix>0?sy_mix.toFixed(0):'— (frágil)'}</td></tr>
    <tr><td>%EL estimado</td><td>${el1}%</td><td>${el2}%</td><td>${el_mix.toFixed(2).replace('.',',')}%</td></tr>
  </table>`;
  // FIX #12: aviso si el Componente 1 tiene σy > TS (dato inconsistente),
  // igual que ya se hace en Tracción.
  const warnComp = document.getElementById('compWarnSyTs');
  if (sy1 > 0 && sy1 > ts1) {
    warnComp.style.display = 'block';
    warnComp.innerHTML = `<strong>Dato inconsistente en Componente 1:</strong> σ_y (${sy1} MPa) no puede ser mayor que TS (${ts1} MPa).`;
  } else {
    warnComp.style.display = 'none';
  }
  // FIX #13/#15: se aclara con notas al pie de la tabla (*) que "E-serie" es
  // solo informativo -- el gráfico y la curva estimada siempre usan el modelo
  // en paralelo -- y (**) que el refuerzo (Componente 2) se modela siempre
  // como frágil (σy=0), ya que no hay ningún campo en la UI para cambiar eso.
  // FIX #35: aviso de plausibilidad matriz/refuerzo (ver dzCompoundPlausibility).
  const warnPlaus = document.getElementById('compWarnPlausible');
  const k1Key = document.getElementById('k1_preset').value;
  const k2Key = document.getElementById('k2_preset').value;
  const plausMsg = dzCompoundPlausibility(k1Key, k2Key, E1, E2);
  if (plausMsg) {
    warnPlaus.style.display = 'block';
    warnPlaus.innerHTML = `<strong>Combinación poco realista:</strong> ${plausMsg}`;
  } else {
    warnPlaus.style.display = 'none';
  }
  document.getElementById('compNote').innerHTML=`<strong>Recordá:</strong> Estos valores son estimaciones por regla de mezclas. En la práctica, la interfaz entre componentes es el punto débil y el %EL real suele ser menor.<br>
    * La curva y el resto de los cálculos usan el modelo en <strong>paralelo</strong> (E-paralelo). "E-serie" se muestra solo a modo comparativo/informativo.<br>
    ** El refuerzo (Componente 2) se modela siempre como <strong>frágil</strong> (sin fluencia), ya que en la práctica las fibras de refuerzo no presentan un límite elástico definido.`;
}


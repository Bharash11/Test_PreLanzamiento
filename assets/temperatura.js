// temperatura.js — Tab 4: efecto de la temperatura en las propiedades

/* ============================================================ TAB 4: TEMPERATURE */
let tempChartInst=null;
function tempFactor(T_ref, T){
  const dT=(T-T_ref);
  // FIX (temperatura): kEl no tenía piso — con una T por debajo del cero absoluto
  // (posible si alguien tipea manualmente un valor fuera del rango del input,
  // ya que el atributo HTML "min" no bloquea la llamada a renderTemp()), kEl
  // se volvía negativo y el %EL resultante rompía la curva. Se le agrega un
  // piso de 0.1, igual que kS.
  return {kE:Math.max(0.2,1-dT/2000), kS:Math.max(0.1,1-dT/1500), kEl:Math.max(0.1,Math.min(5.0,1+dT/600))};
}
function renderTemp(){
  const E0_raw=numOrDefault('t_E',207);
  // FIX #39 (hallazgo Etapa 9 QA v5.14): mismo problema que ya se corrigió en
  // Tracción/Compresión/Comparar -- genCurve() aplica su propio piso de 1 GPa
  // sobre E0*f.kE si el resultado es <=0, pero la leyenda (tLeg) y las
  // tarjetas de acá abajo mostraban E0*f.kE crudo (ej. "E≈0 GPa" con E0=0,
  // mientras la curva ya usaba el piso de 1 GPa). Se aplica el piso sobre E0
  // una sola vez, antes de multiplicar por f.kE en cualquier lado.
  const E0=(isFinite(E0_raw) && E0_raw>0) ? E0_raw : 1;
  // FIX (temperatura): 0 es un valor legítimo de sy (material frágil) y no debe
  // confundirse con un campo vacío/inválido -- por eso no se usa "||250" acá.
  const syRaw=document.getElementById('t_sy').value;
  const syParsed=parseFloat(syRaw);
  const sy0=(syRaw===''||isNaN(syParsed))?250:syParsed;
  const ts0=numOrDefault('t_ts',450);
  // FIX #29: mismo piso de 0.01% que ya tienen "Comparar materiales" y "Material
  // compuesto" (FIX #5). Sin esto, un %EL=0 o negativo tipeado a mano (el input
  // tiene min="0.1" pero eso no bloquea el tipeo directo) colapsaba la curva en
  // una línea vertical pegada a x=0, o directamente la invertía a deformación
  // negativa (ε<0), algo sin sentido físico para un ensayo de tracción.
  let el0=numOrDefault('t_el',20);
  if(el0<=0) el0=0.01;
  // FIX #74 (hallazgo QA v6.21, Etapa 4): el cap de "Math.min(80, el0*f.kEl)"
  // estaba pensado para no dejar que la ductilidad se dispare a temperaturas
  // extremas -- pero se aplicaba incluso EN la temperatura de referencia
  // (kEl=1, sin ningún efecto térmico todavía), pisando en silencio el %EL
  // real de cualquier material cuya ductilidad base ya superara el 80%. Hay
  // 4 polímeros disponibles en este mismo selector con ese problema (nylon
  // 150%, HDPE y PP 200%, PC 100%): a 25°C (temperatura media, sin efecto
  // térmico) mostraban %EL≈80,0% en vez del valor real cargado. El techo
  // ahora es el mayor entre 80 y el propio el0, así nunca recorta por debajo
  // de la línea de base del material -- kEl ya tiene su propio techo de 5.0
  // en tempFactor(), así que el crecimiento relativo sigue acotado igual.
  const elCap = Math.max(80, el0);
  // FIX (temperatura): el cero absoluto (-273.15°C) es el mínimo físico posible.
  // El input HTML tiene min="-273" pero eso no impide tipear un valor menor y
  // llamar a renderTemp() igual, así que se clampa acá también.
  const clampT = T => Math.max(-273, T);
  const temps=[clampT(+document.getElementById('t_low').value),clampT(+document.getElementById('t_mid').value),clampT(+document.getElementById('t_high').value)];
  const colors=['#c43535','#e88a00','#2176ae'];
  // FIX v5.11 (backlog punto E, auditoría de daltonismo): las 3 curvas antes
  // se distinguían SOLO por color (rojo/naranja/azul, con la leyenda nativa
  // de Chart.js apagada -- legend:{display:false} más abajo). Rojo/naranja
  // es justo el par más difícil de diferenciar para protanopia/deuteranopia
  // (ambos caen en un marrón/amarillento parecido). Se agrega un patrón de
  // trazo distinto por curva (sólido / trazo largo / punteado) para que la
  // forma de la línea identifique la curva sin depender del color, más un
  // label con la temperatura en el tooltip (antes no decía a qué curva
  // pertenecía el punto tocado).
  const dashes=[[], [8,4], [2,3]];
  const curves=temps.map(T=>{const f=tempFactor(25,T);return genCurve(E0*f.kE,sy0*f.kS,ts0*f.kS,Math.min(elCap,el0*f.kEl),false);});
  const maxX=Math.max(...curves.map(c=>c[c.length-1].x))*1.12;
  const maxY=Math.max(...curves.map(c=>Math.max(...c.map(p=>p.y))))*1.15;
  if(!tempChartInst){
    const ds=temps.map((t,i)=>({label:t+'°C',data:[],borderColor:colors[i],borderDash:dashes[i],borderWidth:2.5,pointRadius:0,tension:0.15,fill:false}));
    ds.push(...temps.map((t,i)=>({label:t+'°C-f',data:[],borderColor:colors[i],borderWidth:2.5,pointRadius:6,pointBackgroundColor:colors[i],tension:0,fill:false})));
    tempChartInst=new Chart(document.getElementById('tempChart').getContext('2d'),{
      type:'line',data:{datasets:ds},
      options:{responsive:true,maintainAspectRatio:false,animation:{duration:300},
        plugins:{legend:{display:false},tooltip:{callbacks:{label:c=>`${c.dataset.label.replace('-f','')}: σ=${c.parsed.y.toFixed(1).replace('.',',')} MPa  ε=${c.parsed.x.toFixed(5).replace('.',',')}`}}},
        scales:{x:{type:'linear',title:{display:true,text:'Deformación nominal ε',color:tc,font:{size:12}},grid:{color:gc},ticks:{color:tc,maxTicksLimit:8,callback:v=>v.toFixed(3).replace('.',',')}},
                y:{title:{display:true,text:'Tensión σ (MPa)',color:tc,font:{size:12}},grid:{color:gc},ticks:{color:tc,maxTicksLimit:8}}}}
    });
  }
  curves.forEach((c,i)=>{
    tempChartInst.data.datasets[i].data=c.filter(p=>p.phase!=='fracture').map(p=>({x:p.x,y:p.y}));
    const f=c[c.length-1];
    tempChartInst.data.datasets[3+i].data=[{x:f.x,y:f.y}];
  });
  tempChartInst.options.scales.x.max=maxX;
  tempChartInst.options.scales.y.max=maxY;
  tempChartInst.update();
  temps.forEach((T,i)=>{
    const f=tempFactor(25,T);
    document.getElementById('tLeg'+(i+1)).textContent=`${T}°C — E≈${(E0*f.kE).toFixed(0)} GPa, TS≈${(ts0*f.kS).toFixed(0)} MPa, %EL≈${Math.min(elCap,el0*f.kEl).toFixed(1).replace('.',',')}%`;
  });
  document.getElementById('tempResults').innerHTML=temps.map((T,i)=>{
    const f=tempFactor(25,T);
    return `<div class="rcard"><div class="rl" style="color:${colors[i]}">${T}°C — E${hb('E')}</div><div class="rv">${(E0*f.kE).toFixed(0)} GPa</div></div>
    <div class="rcard"><div class="rl" style="color:${colors[i]}">${T}°C — TS${hb('ts')}</div><div class="rv">${(ts0*f.kS).toFixed(0)} MPa</div></div>
    <div class="rcard"><div class="rl" style="color:${colors[i]}">${T}°C — %EL${hb('el')}</div><div class="rv">${Math.min(elCap,el0*f.kEl).toFixed(1).replace('.',',')}%</div></div>
    <div class="rcard"><div class="rl" style="color:${colors[i]}">${T}°C — Ten.${hb('tenacidad')}</div><div class="rv">${calcTenacity(curves[i]).toFixed(3).replace('.',',')} MJ/m³</div></div>`;
  }).join('');
}


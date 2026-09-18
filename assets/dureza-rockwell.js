// dureza-rockwell.js — escala Rockwell (normal y superficial)

// FIX (Fase 6a): antes cada entrada tenía su propio {scale, hr, slider}
// desconectado de PRESETS -- ahora scale/hr salen de PRESETS[x].dureza.hr
// (misma fuente que Brinell/Vickers usan para hb/hv); slider es específico
// de ESTE control de UI (posición del dial), así que se queda acá.
// ROCKWELL_REF se arma combinando ambas, mismo shape {scale,hr,slider} que
// tenía antes.
const ROCKWELL_SLIDER = {
  acero:61, aceroinox:74, fragil:16, aluminio:48, titanio:31,
  niquel:29, molibdeno:68, magnesio:36, zinc:16, tungsteno:18, laton:42,
  // FIX (v4.10): valores de slider calculados (no adivinados) resolviendo la
  // misma fórmula que usa dzUpdateRk() para el HR objetivo de cada material
  // (PRESETS[x].dureza.hr) en su escala real -- mismo método con el que se
  // verificaron los 11 valores de arriba antes de agregar estos.
  aisi1045:85, acero4140:26, aluminio7075:83, aluminio2024:68,
  broncefosforico:85, hierronodular:78, inconel718:37, titaniocp2:68,
};
const ROCKWELL_REF = {};
for (const [key, slider] of Object.entries(ROCKWELL_SLIDER)) {
  const hr = PRESETS[key]?.dureza?.hr;
  if (hr) ROCKWELL_REF[key] = { scale: hr.scale, hr: hr.value, slider };
}
function dzApplyRockwellMaterial(){
  const key = document.getElementById('dz_rkMat').value;
  const ref = ROCKWELL_REF[key];
  if(!ref){ dzUpdateRk(); return; }
  document.getElementById('dz_rkType').value = 'normal';
  dzRenderRkTable();
  const body = document.getElementById('dz_rkBody');
  const row = Array.from(body.children).find(tr => tr.querySelector('td.mono').textContent === ref.scale);
  if(row) row.dispatchEvent(new Event('click'));
  document.getElementById('dz_rkSlider').value = ref.slider;
  dzUpdateRk();
}
// FIX #87 (hallazgo QA v6.21, Etapa 33): el onchange de dz_rkType vaciaba
// dz_rkMat de forma INCONDICIONAL en cualquier cambio -- esto rompía la
// restauración de un enlace compartido (Compartir enlace, csAplicarDesdeURL)
// para Rockwell: como dz_rkMat aparece antes que dz_rkType en el DOM, la
// reproducción genérica del enlace fija primero el material y DESPUÉS el
// tipo, y el "change" de dz_rkType (disparado igual aunque el valor ya fuera
// el mismo) borraba el material que el enlace acababa de restaurar. Ahora
// solo se vacía el material si de verdad quedaría inconsistente con el
// nuevo tipo (su escala de referencia ya no pertenece al grupo normal/
// superficial elegido) -- conserva el comportamiento original para un
// cambio de tipo manual genuino, sin romper la reproducción de un enlace.
function dzOnTypeChange(){
  const matKey = document.getElementById('dz_rkMat').value;
  const ref = ROCKWELL_REF[matKey];
  const isNormalAhora = document.getElementById('dz_rkType').value === 'normal';
  if (ref) {
    const escalaEsNormal = DZ_RK_NORMAL.some(r => r[0] === ref.scale);
    if (escalaEsNormal !== isNormalAhora) {
      document.getElementById('dz_rkMat').value = '';
    }
  }
  dzRenderRkTable();
}
function dzRenderRkTable(){
  const isNormal = document.getElementById('dz_rkType').value === 'normal';
  const data = isNormal ? DZ_RK_NORMAL : DZ_RK_SUPERFICIAL;
  const cargaMenor = isNormal ? 10 : 3;
  document.getElementById('dz_rkHead').innerHTML = `<tr><th>Escala</th><th>Penetrador</th><th>Carga menor (kg)</th><th>Carga mayor (kg)</th></tr>`;
  const body = document.getElementById('dz_rkBody');
  body.innerHTML='';
  data.forEach(([sym,pen,cm])=>{
    const tr = document.createElement('tr');
    tr.className = 'dz-row-sel';
    tr.innerHTML = `<td class="mono">${sym}</td><td>${pen}</td><td class="mono">${cargaMenor}</td><td class="mono">${cm}</td>`;
    tr.addEventListener('click', ()=>{
      Array.from(body.children).forEach(t=>t.classList.remove('on'));
      tr.classList.add('on');
      dzRkSelected = {sym, pen, cm, cmen:cargaMenor};
      document.getElementById('dz_rkSelectedInfo').innerHTML =
        `Escala <strong style="color:var(--accent)">${sym}</strong> — penetrador: ${pen}, carga menor ${cargaMenor} kg, carga mayor ${cm} kg.`;
      dzUpdateRk();
    });
    body.appendChild(tr);
  });
  dzRkSelected = null;
  document.getElementById('dz_rkSelectedInfo').textContent = 'Elegí una fila de la tabla ↑';
  dzUpdateRk();
}
// FIX (v6.9): antes esta fórmula vivía escrita dos veces si se quería
// reusar la misma lógica desde otro lado (ej. una animación) -- ahora
// dzRkCalcDepthRaw/dzRkCalcDepthFrac son la única fuente de verdad, y tanto
// dzUpdateRk() acá como dzRkEnsayar() en indentador-rockwell.js las llaman
// en vez de duplicar el cálculo.
function dzRkCalcDepthRaw(slider){
  if(!dzRkSelected) return (100 - slider);
  const refLoad = 150; // carga mayor normal más alta (referencia)
  const loadFactor = Math.sqrt(dzRkSelected.cm / refLoad);
  return (100 - slider) * loadFactor; // 0 (duro/carga chica) .. ~100 (blando/carga grande)
}
function dzRkCalcDepthFrac(slider){
  return Math.min(1, Math.max(0, dzRkCalcDepthRaw(slider) / 100));
}
function dzUpdateRk(){
  const slider = parseInt(document.getElementById('dz_rkSlider').value);
  const numEl = document.getElementById('dz_rkNumber');
  const cmpEl = document.getElementById('dz_rkMatCompare');
  const matKey = document.getElementById('dz_rkMat').value;
  const ref = ROCKWELL_REF[matKey];
  // FIX #9: antes, hrValue=Math.round(slider*0.95) era el mismo número sin
  // importar la fila de escala elegida (A, C, 15N, etc.) -- solo cambiaba el
  // sufijo de texto. Ahora se incorpora la carga mayor (cm) de la fila
  // seleccionada: a mayor carga, mayor penetración simulada, y por lo tanto
  // menor número Rockwell para la misma posición de "dureza" del slider --
  // igual que las escalas superficiales (cargas chicas) suelen leer más alto
  // que las normales (cargas grandes) para un material similar. Sigue siendo
  // una aproximación ilustrativa (así lo aclara el texto de ayuda), pero ahora
  // cambiar de escala sí cambia el resultado.
  const depthFrac = dzRkCalcDepthFrac(slider);
  if(!dzRkSelected){
    numEl.textContent='—';
    if(cmpEl) cmpEl.style.display='none';
  } else {
    const depthRaw = dzRkCalcDepthRaw(slider);
    const hrValue = Math.max(0, Math.min(100, Math.round(100 - depthRaw*0.95)));
    numEl.textContent = `${hrValue} HR${dzRkSelected.sym}`;
    if(!ref){
      if(cmpEl) cmpEl.style.display='none';
    } else if(dzRkSelected.sym===ref.scale){
      const diff = hrValue - ref.hr;
      const cerca = Math.abs(diff) <= 5;
      cmpEl.style.display='block';
      cmpEl.innerHTML = `<strong>Referencia bibliográfica para este material: ≈${ref.hr} HR${ref.scale}</strong> (valor típico de tabla, modelo ilustrativo). `
        + (cerca ? `Tu ensayo dio un valor cercano.`
                 : `Tu ensayo dio un valor ${diff>0?'más alto':'más bajo'} (diferencia de ${Math.abs(diff)} puntos) -- normal si moviste el control respecto del ensayo guiado.`);
    } else {
      cmpEl.style.display='block';
      cmpEl.innerHTML = `La referencia de este material es en escala HR${ref.scale} -- elegí esa fila en la tabla para comparar.`;
    }
  }
  // FIX (v6.9): el dibujo se delega a dzDrawRkEscena() (indentador-rockwell.js),
  // llamado acá con el estado instantáneo de siempre, sin animar (huella ya
  // en su profundidad final). El botón "▶ Realizar ensayo" reusa la misma
  // función pero variando esos dos parámetros cuadro a cuadro.
  // FIX #63 (hallazgo QA v6.16, D10-01): toolPosFrac pasa de 1 a 0 --
  // herramienta retirada en el estado de reposo, igual que Brinell, para
  // que coincida con el último cuadro real de la animación (que siempre
  // termina con la herramienta levantada) y no haya un salto visual al
  // redibujar el estado de reposo apenas termina el ensayo animado.
  dzDrawRkEscena(0, 1, depthFrac, slider);
}


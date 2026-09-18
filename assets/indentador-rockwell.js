// indentador-rockwell.js — escena animada del ensayo Rockwell (v6.9).
// Tercer módulo con "aparato físico" fuera de Tracción/Compresión y R.R.
// Moore, después de Charpy (v6.8) y Brinell (v6.9) -- mismo patrón: un
// botón "▶ Realizar ensayo" que dramatiza en el tiempo lo que antes se
// mostraba de una sola vez, sin tocar el comportamiento de exploración
// instantánea que ya tenía Rockwell (tabla de escalas + slider siguen
// actualizando todo al instante como siempre).
//
// dzDrawRkEscena() reemplaza el dibujo que antes estaba escrito adentro de
// dzUpdateRk() (dureza-rockwell.js) -- mismo criterio de refactor ya usado
// en Brinell (v6.9): una sola función de dibujo, parametrizada por dos
// fracciones de progreso en vez de un valor final fijo, para poder
// reusarla tanto en el estado instantáneo (toolPosFrac=0, markPenFrac=1)
// como cuadro a cuadro durante la animación.
// FIX #63 (hallazgo QA v6.16, D10-01): el estado instantáneo usaba
// toolPosFrac=1 (herramienta apoyada), mientras que la animación siempre
// TERMINA con la herramienta retirada (toolPosFrac->0, ver más abajo) --
// resultado: apenas terminaba la animación, la herramienta saltaba de
// golpe 45px hacia abajo para volver a "apoyarse" en el redibujado del
// estado de reposo. Se cambia el estado de reposo a toolPosFrac=0, mismo
// criterio que ya usaba Brinell (dzDrawBrinellEscena(0,1,...) en
// dureza-brinell.js) -- sin este desajuste no hace falta que ambos
// coincidan en el mismo valor por casualidad, pero acá directamente los
// alinea.
//
// A diferencia de Brinell, la profundidad de penetración acá NO es una
// fórmula física cerrada (no hay un t=f(HR) de manual) -- ya era, antes de
// esta versión, una aproximación ilustrativa documentada como tal (ver FIX
// #9 en dureza-rockwell.js). Esta versión no le suma ni le saca rigor a
// esa aproximación: solo la anima. dzRkCalcDepthFrac() (dureza-rockwell.js)
// sigue siendo la única fuente de verdad del cálculo.

let dzRkAnimando = false;
let dzRkAnimId = null;

function dzEaseInOutRk(t){ return t<0.5 ? 2*t*t : 1-Math.pow(-2*t+2,2)/2; }
function dzEaseInRk(t){ return t*t; }

// toolPosFrac: 0..1, posición vertical de la herramienta (0=elevada, sin
// tocar; 1=apoyada en la superficie) -- controla SOLO dónde se dibuja el
// cuerpo de la herramienta. markPenFrac: 0..1, cuánto de la profundidad
// final ya se marcó -- controla el tamaño de la huella (triángulo interno +
// elipse de superficie). Van separados por el mismo motivo que en Brinell:
// al retirar la herramienta (última fase de la animación) toolPosFrac
// vuelve a 0 pero markPenFrac se mantiene en 1, porque la huella queda
// permanente aunque la herramienta ya se haya levantado.
// FIX #53 (hallazgo QA v6.9, Etapa 3): el parámetro `sym` (símbolo de
// escala, ej. "C"/"B"/"15N") se recibía pero nunca se usaba en el cuerpo --
// código muerto, mismo tipo de hallazgo que ya se sacó en Brinell (FIX
// #47). Se saca de la firma y de las 5 llamadas de este archivo y de
// dureza-rockwell.js.
function dzDrawRkEscena(toolPosFrac, markPenFrac, depthFracFinal, slider){
  const svg = document.getElementById('dz_rkDepthSvg');
  if(!svg) return;
  const rectX=20, rectY=34, rectW=220, rectH=82;
  const cx=130;
  const depthShown = depthFracFinal*markPenFrac;
  const tipY = rectY + depthShown*(rectH-8); // punta de la huella, nunca toca el borde inferior
  const rimR = 7 + depthShown*24; // ancho de la huella en la superficie: crece con la profundidad marcada
  const liftPx = 45*(1-toolPosFrac); // elevación de la herramienta por encima de su posición de apoyo
  const toolTipY = rectY - liftPx;
  const marcaOpacity = markPenFrac > 0.02 ? 1 : 0;

  svg.innerHTML = `
    <rect x="${rectX}" y="${rectY}" width="${rectW}" height="${rectH}" fill="var(--surface)" stroke="var(--border)"/>
    <text x="${rectX+8}" y="${rectY+15}" text-anchor="start" fill="var(--muted)" font-size="9" letter-spacing="1">MATERIAL</text>
    <!-- huella dentro del material: punta abajo, se ensancha hacia la superficie -->
    <polygon points="${cx},${tipY.toFixed(1)} ${(cx-rimR).toFixed(1)},${rectY} ${(cx+rimR).toFixed(1)},${rectY}" fill="var(--neck)" opacity="${0.55*marcaOpacity}" stroke="var(--neck)" stroke-width="1"/>
    <!-- guía de profundidad -->
    <line x1="${cx}" y1="${rectY}" x2="${cx}" y2="${tipY.toFixed(1)}" stroke="var(--muted)" stroke-width="1" stroke-dasharray="2 2" opacity="0.6"/>
    <!-- marca visible en la superficie (vista desde arriba, aplastada) -->
    <ellipse cx="${cx}" cy="${rectY}" rx="${rimR.toFixed(1)}" ry="3.5" fill="var(--frac)" opacity="${0.85*marcaOpacity}"/>
    <!-- herramienta: se eleva/baja según toolPosFrac, apoyando la punta justo en el borde cuando toolPosFrac=1 -->
    <polygon points="${cx},${toolTipY.toFixed(1)} ${cx-15},${(toolTipY-22).toFixed(1)} ${cx+15},${(toolTipY-22).toFixed(1)}" fill="none" stroke="var(--text)" stroke-width="1.5" opacity="0.75"/>
    <rect x="${cx-6}" y="${(toolTipY-30).toFixed(1)}" width="12" height="9" fill="var(--surface3)" stroke="var(--text)" stroke-width="1" opacity="0.75"/>
    <text x="${rectX+rectW-6}" y="${rectY+15}" text-anchor="end" fill="var(--muted)" font-size="8">profundidad</text>
    <text x="130" y="150" text-anchor="middle" fill="var(--muted)" font-size="10">${slider<40?'material blando: huella profunda':(slider>70?'material duro: huella superficial':'material intermedio')}</text>
  `;
}

function dzRkEnsayar(){
  if(dzRkAnimando) return;
  const slider = parseInt(document.getElementById('dz_rkSlider').value); // <input type=range>, siempre numérico
  const depthFracFinal = dzRkCalcDepthFrac(slider); // única fuente de verdad, en dureza-rockwell.js

  dzRkAnimando = true;
  document.getElementById('dz_rkBtnEnsayar').disabled = true;

  const DUR_BAJADA = 800, PAUSA = 900, DUR_SUBIDA = 500;
  const t0 = performance.now();

  function frame(now){
    const el = now - t0;
    if(el < DUR_BAJADA){
      const p = dzEaseInOutRk(el/DUR_BAJADA);
      dzDrawRkEscena(p, p, depthFracFinal, slider);
      dzRkAnimId = requestAnimationFrame(frame);
    } else if(el < DUR_BAJADA+PAUSA){
      dzDrawRkEscena(1, 1, depthFracFinal, slider);
      dzRkAnimId = requestAnimationFrame(frame);
    } else if(el < DUR_BAJADA+PAUSA+DUR_SUBIDA){
      const p = 1 - dzEaseInRk((el-DUR_BAJADA-PAUSA)/DUR_SUBIDA);
      dzDrawRkEscena(p, 1, depthFracFinal, slider); // la herramienta se retira (toolPosFrac->0) pero la marca queda clavada (markPenFrac=1)
      dzRkAnimId = requestAnimationFrame(frame);
    } else {
      dzRkAnimando = false;
      cancelAnimationFrame(dzRkAnimId);
      document.getElementById('dz_rkBtnEnsayar').disabled = false;
      dzUpdateRk(); // deja todo (textos, escena en reposo) en el estado final canónico
    }
  }
  dzRkAnimId = requestAnimationFrame(frame);
}

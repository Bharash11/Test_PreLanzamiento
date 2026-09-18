// indentador-brinell.js — escena animada del ensayo Brinell (v6.8).
// Segundo módulo con "aparato físico" fuera de Tracción/Compresión y R.R.
// Moore, después del péndulo Charpy (charpy-pendulo.js) -- mismo criterio:
// agrega un botón "▶ Realizar ensayo" que dramatiza en el tiempo lo que
// antes se mostraba de una sola vez, sin tocar ni reemplazar el
// comportamiento existente de exploración libre con los sliders/selects de
// dureza-brinell.js (siguen actualizando todo al instante como siempre).
//
// A diferencia de Charpy, acá la "física" de la animación no es una
// aproximación de modelado -- es la fórmula real que ya usa este módulo:
// HB = 2P / [πD(D−√(D²−d²))], y D−√(D²−d²) = 2t, donde t es la profundidad
// de penetración real de una esfera de diámetro D que deja una huella de
// diámetro d. dzBrProfundidad() no inventa nada nuevo, solo aísla ese
// término ya presente en la fórmula de dureza-brinell.js.
//
// FIX (v6.8, corrección tras primera revisión): el corte transversal y la
// huella (vista superior) eran dos SVG separados, cada uno con su propia
// escala -- la marca del corte crecía de forma genérica (0 a 24px) sin
// relación real con d, mientras que la huella de abajo sí usaba d a escala
// real (scale=22 px/mm). Quedaban dos círculos que "coincidían por
// casualidad" en el resultado final, pero no durante la animación, y no
// había ninguna pista visual de que representaran la misma medida. Ahora
// es UN solo SVG (dzDrawBrinellEscena), con la MISMA escala real en las dos
// vistas, más líneas punteadas que bajan desde el borde de la marca del
// corte hasta el borde de la huella -- para que quede explícito que es la
// misma medida, vista desde dos ángulos.

function dzBrProfundidad(d){
  const D = 10;
  return (D - Math.sqrt(Math.max(0, D*D - d*d))) / 2;
}

function dzEaseInOutBr(t){ return t<0.5 ? 2*t*t : 1-Math.pow(-2*t+2,2)/2; }
function dzEaseInBr(t){ return t*t; }

let dzBrAnimando = false;
let dzBrAnimId = null;

const DZ_BR_ESCALA = 22; // px por mm -- MISMA escala en el corte y en la huella, a propósito
const DZ_BR_CX = 110;
const DZ_BR_SURFACE_Y = 90, DZ_BR_BALL_R = 38, DZ_BR_PEN_MAX_PX = 45;
const DZ_BR_HUELLA_CY = 320, DZ_BR_HUELLA_OUTER_R = 95;

// ballPenFrac: 0..1, posición vertical de la esfera (0=en reposo apoyada sin
// penetrar, 1=profundidad t completa) -- controla SOLO dónde se dibuja la
// esfera. markPenFrac: 0..1, cuánto se alcanzó a marcar la superficie hasta
// ahora -- controla el diámetro de la marca, EN LAS DOS VISTAS A LA VEZ (por
// eso van separados de ballPenFrac): al retirar la esfera (última fase de
// la animación) ballPenFrac vuelve a 0 pero markPenFrac se mantiene en 1,
// porque la huella queda permanente aunque el penetrador ya se haya
// levantado.
function dzDrawBrinellEscena(ballPenFrac, markPenFrac, dFinal, tFinal){
  const svg = document.getElementById('dz_brSvg');
  if(!svg) return;
  const cx = DZ_BR_CX, surfaceY = DZ_BR_SURFACE_Y, ballR = DZ_BR_BALL_R;
  const touchCenterY = surfaceY - ballR;
  const ballCenterY = touchCenterY + ballPenFrac*DZ_BR_PEN_MAX_PX;
  const rPx = (dFinal/2)*DZ_BR_ESCALA*markPenFrac; // MISMO rPx para el corte y para la huella
  const huellaCy = DZ_BR_HUELLA_CY, huellaOuterR = DZ_BR_HUELLA_OUTER_R;
  const dMostrado = dFinal*markPenFrac;
  const guiaOpacity = markPenFrac > 0.02 ? 0.85 : 0;
  const lineaOpacity = markPenFrac > 0.02 ? 0.55 : 0;

  svg.innerHTML = `
    <clipPath id="dz_brClipTop"><rect x="0" y="0" width="220" height="${surfaceY}"/></clipPath>

    <!-- corte transversal -->
    <rect x="10" y="${surfaceY}" width="200" height="65" fill="var(--surface)" stroke="var(--border)"/>
    <text x="18" y="${surfaceY+14}" fill="var(--muted)" font-size="9" letter-spacing="1">MATERIAL</text>
    <ellipse cx="${cx}" cy="${surfaceY}" rx="${Math.max(1.5,rPx).toFixed(1)}" ry="4" fill="var(--frac)" opacity="${guiaOpacity}"/>
    <circle cx="${cx}" cy="${ballCenterY.toFixed(1)}" r="${ballR}" fill="var(--muted)" stroke="var(--text)" stroke-width="1" clip-path="url(#dz_brClipTop)"/>
    <line x1="${cx}" y1="${surfaceY}" x2="${cx}" y2="${(surfaceY+markPenFrac*DZ_BR_PEN_MAX_PX).toFixed(1)}" stroke="var(--accent)" stroke-width="1" stroke-dasharray="2 2"/>
    <text x="200" y="${surfaceY-10}" text-anchor="end" fill="var(--muted)" font-size="8">superficie</text>
    <text x="${cx}" y="150" text-anchor="middle" fill="var(--muted)" font-size="10">D = 10,00 mm (fijo) &nbsp;·&nbsp; t = ${tFinal.toFixed(3).replace('.',',')} mm</text>

    <!-- líneas de referencia punteadas: mismo diámetro, corte -> huella -->
    <line x1="${(cx-rPx).toFixed(1)}" y1="${surfaceY}" x2="${(cx-rPx).toFixed(1)}" y2="${huellaCy}" stroke="var(--muted)" stroke-width="1" stroke-dasharray="3 3" opacity="${lineaOpacity}"/>
    <line x1="${(cx+rPx).toFixed(1)}" y1="${surfaceY}" x2="${(cx+rPx).toFixed(1)}" y2="${huellaCy}" stroke="var(--muted)" stroke-width="1" stroke-dasharray="3 3" opacity="${lineaOpacity}"/>
    <text x="${cx}" y="195" text-anchor="middle" fill="var(--muted)" font-size="9">mismo diámetro, visto desde arriba ↓</text>

    <!-- huella, vista superior -->
    <circle cx="${cx}" cy="${huellaCy}" r="${huellaOuterR}" fill="var(--surface)" stroke="var(--border)"/>
    <circle cx="${cx}" cy="${huellaCy}" r="${Math.max(0,rPx).toFixed(1)}" fill="var(--accent)" opacity="0.4" stroke="var(--accent)" stroke-width="1.5"/>
    <line x1="${(cx-rPx).toFixed(1)}" y1="${huellaCy}" x2="${(cx+rPx).toFixed(1)}" y2="${huellaCy}" stroke="var(--neck)" stroke-width="1" stroke-dasharray="3 2"/>
    <text x="${cx}" y="${huellaCy+huellaOuterR+18}" text-anchor="middle" fill="var(--muted)" font-size="11">d = ${dMostrado.toFixed(2).replace('.',',')} mm</text>
  `;
}

function dzBrEnsayar(){
  if(dzBrAnimando) return;
  const dFinal = parseFloat(document.getElementById('dz_brD').value); // <input type=range>, siempre numérico
  const tFinal = dzBrProfundidad(dFinal);

  dzBrAnimando = true;
  document.getElementById('dz_brBtnEnsayar').disabled = true;

  const DUR_BAJADA = 900, PAUSA = 900, DUR_SUBIDA = 500;
  const t0 = performance.now();

  function frame(now){
    const el = now - t0;
    if(el < DUR_BAJADA){
      const p = dzEaseInOutBr(el/DUR_BAJADA);
      dzDrawBrinellEscena(p, p, dFinal, tFinal);
      dzBrAnimId = requestAnimationFrame(frame);
    } else if(el < DUR_BAJADA+PAUSA){
      dzDrawBrinellEscena(1, 1, dFinal, tFinal);
      dzBrAnimId = requestAnimationFrame(frame);
    } else if(el < DUR_BAJADA+PAUSA+DUR_SUBIDA){
      const p = 1 - dzEaseInBr((el-DUR_BAJADA-PAUSA)/DUR_SUBIDA);
      dzDrawBrinellEscena(p, 1, dFinal, tFinal); // la esfera se retira (ballPenFrac->0) pero la marca queda clavada en el máximo (markPenFrac=1)
      dzBrAnimId = requestAnimationFrame(frame);
    } else {
      dzBrAnimando = false;
      cancelAnimationFrame(dzBrAnimId);
      document.getElementById('dz_brBtnEnsayar').disabled = false;
      dzUpdateBrinell(); // deja todo (textos, escena en reposo) en el estado final canónico
    }
  }
  dzBrAnimId = requestAnimationFrame(frame);
}

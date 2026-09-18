// dureza-janka.js — dureza Janka (maderas)

const JANKA_REF = {
  pino:      {kgf:180,  lbf:400},
  madera:    {kgf:585,  lbf:1290},  // Roble
  algarrobo: {kgf:1134, lbf:2500},
  quebracho: {kgf:2177, lbf:4800},
};
const JANKA_BALL_D = 11.28, JANKA_HALF = JANKA_BALL_D/2; // 5.64 mm
function dzApplyJankaMaterial(){
  const key = document.getElementById('dz_jkMat').value;
  const ref = JANKA_REF[key];
  if(!ref){ dzUpdateJanka(); return; }
  document.getElementById('dz_jkF').value = ref.kgf;
  dzUpdateJanka();
}
function dzUpdateJanka(){
  const F = parseFloat(document.getElementById('dz_jkF').value);
  document.getElementById('dz_jkVal').textContent = F;
  const matKey = document.getElementById('dz_jkMat').value;
  const ref = JANKA_REF[matKey];
  const forceEl = document.getElementById('dz_jkForce');
  const depthEl = document.getElementById('dz_jkDepth');
  const cmpEl = document.getElementById('dz_jkMatCompare');
  forceEl.textContent = `${F.toFixed(0)} kgf (${(F*9.80665).toFixed(0)} N)`;
  if(!ref){
    depthEl.textContent = '—';
    cmpEl.style.display='block';
    cmpEl.innerHTML = 'Elegí una especie de madera para simular la penetración -- este ensayo se define de forma distinta para cada especie, no hay una curva "genérica" sin calibrar.';
    document.getElementById('dz_jkDrawWarn').style.display='none';
    dzDrawJankaSvg(0);
    return;
  }
  // FIX #30 (histórico) quitado en QA v5.12: el blindaje F_safe protegía contra
  // F<=0/NaN de cuando dz_jkF era un campo de texto libre. Hoy es un slider con
  // min="10" (ver index.html) que no puede alcanzar un valor <=0 ni vacío por
  // ninguna vía de la UI (arrastre, teclado o flechas), así que el guard había
  // quedado inofensivo pero muerto -- confirmado en el ciclo de testeo exhaustivo,
  // se saca en vez de dejarlo como código muerto.
  const depthRaw = JANKA_HALF * Math.pow(F/ref.kgf, 2/3);
  const depthCapped = Math.min(depthRaw, 10); // tope solo para que el dibujo no se vaya de rango
  depthEl.textContent = depthRaw.toFixed(2).replace('.',',')+' mm';
  // FIX #63 (hallazgo QA v6.16, D15-01): cuando el tope de arriba realmente
  // recorta el dibujo (depthRaw>10), se avisa por qué el dibujo deja de
  // moverse aunque el número siga subiendo -- antes esto quedaba sin
  // explicar, y para maderas blandas (pino, roble) a fuerza alta es
  // fácilmente alcanzable con el slider real (ver hallazgo D15-01).
  const drawWarnEl = document.getElementById('dz_jkDrawWarn');
  if(depthRaw > 10){
    drawWarnEl.style.display='block';
    drawWarnEl.innerHTML = `El dibujo no puede representar una profundidad mayor al radio de la bola (queda "trabado" en ese límite geométrico) -- el valor numérico de arriba (${depthRaw.toFixed(2).replace('.',',')} mm) sigue siendo el resultado válido del modelo.`;
  } else {
    drawWarnEl.style.display='none';
  }
  const atTarget = Math.abs(depthRaw-JANKA_HALF) < 0.15;
  cmpEl.style.display='block';
  if(atTarget){
    cmpEl.innerHTML = `<strong>¡Profundidad = mitad del diámetro (${JANKA_HALF.toFixed(2).replace('.',',')} mm)!</strong> Por definición, esta fuerza (≈${ref.kgf} kgf / ${ref.lbf} lbf de tabla) ES la dureza Janka de esta madera.`;
  } else if(depthRaw<JANKA_HALF){
    cmpEl.innerHTML = `Profundidad alcanzada: ${depthRaw.toFixed(2).replace('.',',')} mm, todavía menos que la mitad del diámetro (${JANKA_HALF.toFixed(2).replace('.',',')} mm). Hace falta más fuerza para llegar al criterio Janka (≈${ref.kgf} kgf de referencia).`;
  } else {
    cmpEl.innerHTML = `Profundidad alcanzada: ${depthRaw.toFixed(2).replace('.',',')} mm, ya superaste la mitad del diámetro (${JANKA_HALF.toFixed(2).replace('.',',')} mm). Con menos fuerza (≈${ref.kgf} kgf de referencia) alcanzarías justo el criterio Janka.`;
  }
  dzDrawJankaSvg(depthCapped);
}
function dzDrawJankaSvg(depth){
  const svg = document.getElementById('dz_jkSvg');
  if(!svg) return;
  const scale = 6;
  const r = JANKA_HALF*scale;
  const woodTop = 55, woodBottom = 170, woodLeft = 20, woodRight = 240;
  const targetY = woodTop + JANKA_HALF*scale;
  const ballCY = woodTop - r + (depth||0)*scale;
  svg.innerHTML = `
    <rect x="${woodLeft}" y="${woodTop}" width="${woodRight-woodLeft}" height="${woodBottom-woodTop}" fill="#c8a165" stroke="var(--border)"/>
    <text x="130" y="${woodTop-8}" text-anchor="middle" fill="var(--muted)" font-size="10">MADERA</text>
    <line x1="${woodLeft}" y1="${targetY}" x2="${woodRight}" y2="${targetY}" stroke="var(--frac)" stroke-width="1.5" stroke-dasharray="4 3"/>
    <text x="${woodRight+2}" y="${targetY+3}" font-size="8" fill="var(--frac)">½ D</text>
    <circle cx="130" cy="${ballCY}" r="${r}" fill="#9aa5ad" stroke="#5a6570" stroke-width="1.5"/>
  `;
}


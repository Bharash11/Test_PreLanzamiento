// escena-ultrasonido.js — escena animada del palpador moviéndose en X sobre
// la pieza (prototipo, segundo módulo del backlog post-v6.9, después de
// Tensiones residuales). A diferencia de las 4 escenas de v6.8/v6.9
// (Charpy/Brinell/Rockwell/Vickers-Knoop, en SVG) y de la de Tensiones
// residuales (también SVG), acá se dibuja en <canvas> 2D crudo -- Ultrasonido
// ya lo hacía así para el A-scan (utDrawAscan en ultrasonido.js) antes de
// que el resto del simulador usara SVG, así que esta escena sigue esa misma
// convención en vez de introducir una tecnología de dibujo nueva en el
// mismo módulo.
//
// Vista lateral de la pieza (rectángulo largo) con el palpador como un
// bloque que se desliza en X. A diferencia de Brinell/Rockwell (donde la
// "herramienta" -- bola, cono -- se retira y deja una marca fija), acá no
// hay nada que quede grabado físicamente: el palpador simplemente se mueve,
// y el eco del defecto aparece y desaparece en vivo según su posición. El
// equivalente de "herramienta vs. marca" es otro: la posición del palpador
// (transitoria, cambia todo el tiempo) vs. UT_ENCONTRADO (booleano en
// ultrasonido.js, persistente -- una vez que el palpador coincidió con el
// defecto al menos una vez, ese hallazgo no se re-oculta si se aleja
// después).
//
// Honestidad física: la posición VERTICAL del defecto en este dibujo SÍ es
// real (profDef/espesor, la misma proporción física que efectivamente
// tiene dentro de la pieza) -- no es una constante inventada. Lo único
// ilustrativo acá es UT_TOLERANCIA_X (documentada en ultrasonido.js) y el
// tamaño/forma del "cono de haz" dibujado debajo del palpador, que sirve
// para visualizar esa tolerancia pero no representa la divergencia real de
// un haz ultrasónico (que depende de la frecuencia y el diámetro del
// palpador, ninguno de los dos parámetros de este simulador).

function utDrawEscenaPalpador(canvas, profDef, espesor, posPalpadorFrac, posDefectoFrac, posicionVisible, dentroTolerancia) {
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  ctx.clearRect(0, 0, W, H);

  const marginL = 20, marginR = 20, marginT = 14, marginB = 10;
  const piezaX = marginL, piezaY = marginT + 20, piezaW = W - marginL - marginR, piezaH = H - marginT - marginB - 20;

  // Pieza (vista lateral)
  const surface2_ = getComputedStyle(document.documentElement).getPropertyValue('--surface2') || '#e8ecef';
  const border_ = getComputedStyle(document.documentElement).getPropertyValue('--border') || '#ccc';
  ctx.fillStyle = surface2_;
  ctx.fillRect(piezaX, piezaY, piezaW, piezaH);
  ctx.strokeStyle = border_;
  ctx.lineWidth = 1.5;
  ctx.strokeRect(piezaX, piezaY, piezaW, piezaH);

  const tc_ = getComputedStyle(document.documentElement).getPropertyValue('--text') || '#222';
  const muted_ = getComputedStyle(document.documentElement).getPropertyValue('--muted') || '#888';
  const accent_ = getComputedStyle(document.documentElement).getPropertyValue('--accent') || '#1a5fa8';

  // Posición X del palpador (0..1 -> px), clamped por seguridad
  const fracP = Math.max(0, Math.min(1, posPalpadorFrac || 0));
  const xPalpador = piezaX + piezaW * fracP;

  // "Cono de haz" ilustrativo, ancho = 2×UT_TOLERANCIA_X (ver nota arriba)
  const tolFrac = (typeof UT_TOLERANCIA_X === 'number' ? UT_TOLERANCIA_X : 6) / 100;
  const haloW = piezaW * tolFrac * 2;
  ctx.fillStyle = dentroTolerancia ? 'rgba(46,160,90,0.18)' : 'rgba(120,120,120,0.10)';
  ctx.beginPath();
  ctx.moveTo(xPalpador - 9, piezaY);
  ctx.lineTo(xPalpador - haloW / 2, piezaY + piezaH);
  ctx.lineTo(xPalpador + haloW / 2, piezaY + piezaH);
  ctx.lineTo(xPalpador + 9, piezaY);
  ctx.closePath();
  ctx.fill();

  // Palpador (bloque que se desliza en la superficie)
  const palW = 22, palH = 16;
  ctx.fillStyle = dentroTolerancia ? '#2ea05a' : accent_;
  ctx.fillRect(xPalpador - palW / 2, piezaY - palH, palW, palH);
  ctx.strokeStyle = tc_; ctx.lineWidth = 1;
  ctx.strokeRect(xPalpador - palW / 2, piezaY - palH, palW, palH);

  // Defecto: posición vertical REAL (profDef/espesor), posición horizontal
  // según posDefectoFrac -- ambas visibles solo si posicionVisible.
  if (posicionVisible && espesor > 0 && profDef > 0 && profDef < espesor) {
    const fracD = Math.max(0, Math.min(1, posDefectoFrac || 0));
    const xDefecto = piezaX + piezaW * fracD;
    const yDefecto = piezaY + piezaH * (profDef / espesor);
    ctx.fillStyle = '#c0392b';
    ctx.beginPath();
    ctx.ellipse(xDefecto, yDefecto, 7, 4, 0, 0, 2 * Math.PI);
    ctx.fill();
    ctx.strokeStyle = tc_; ctx.lineWidth = 1;
    ctx.stroke();
  }

  // Etiquetas
  ctx.fillStyle = muted_; ctx.font = '9px sans-serif'; ctx.textAlign = 'left';
  ctx.fillText('0%', piezaX, piezaY + piezaH + 12);
  ctx.textAlign = 'right';
  ctx.fillText('100%', piezaX + piezaW, piezaY + piezaH + 12);
  ctx.textAlign = 'center';
  ctx.fillStyle = tc_; ctx.font = '10px sans-serif';
  ctx.fillText('palpador', xPalpador, piezaY - palH - 4);
}

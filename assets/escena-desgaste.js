// escena-desgaste.js — escena animada de ranura de desgaste que se
// profundiza/ensancha (prototipo, post-v6.17). Quinto módulo del backlog
// de escenas (orden de prioridad: 1. Tensiones residuales, 2. Ultrasonido,
// 3. Metalografía, 4. Corrosión, 5. Desgaste), octavo "aparato/proceso"
// animado en total después de Charpy/Brinell/Rockwell/Vickers-Knoop/
// Tensiones/Ultrasonido/Metalografía/Corrosión.
//
// Botón "▶ Simular deslizamiento" (`dsDeslizar()`) como capa ADICIONAL
// sobre la exploración instantánea existente: los 3 controles (par de
// materiales, fuerza normal, distancia recorrida) siguen actualizando la
// curva de Archard y las 2 métricas originales al instante vía dsUpdate()
// (desgaste.js), sin tocar esa lógica. dsUpdate() se extiende con UNA sola
// línea al final que llama dsDrawEscena(svg, 1, ...) -- mismo criterio que
// trUpdate()/utUpdate()/crUpdate().
//
// Sin herramienta que se retire (como Metalografía/Corrosión): acá la
// "herramienta" (el pin deslizante) NUNCA se retira -- se pasa la vida
// deslizando de un lado a otro sobre la ranura, así que hay UN progreso de
// distancia recorrida (0..1, fracción de la distancia máxima elegida,
// ds_distancia) que controla a la vez (a) la profundidad/ancho de la
// ranura (monótona, solo crece) y (b) la posición horizontal del pin
// (oscilante, va y viene -- no es monótona, es pura puesta en escena del
// "vaivén" para transmitir deslizamiento repetido).
//
// Honestidad física, distinción central de este módulo: la ley de Archard
// (dsCalcVolumen(), en desgaste.js, SIN TOCAR) solo predice VOLUMEN
// desgastado, no una geometría de ranura. Para poder dibujar "una
// profundidad" en el corte transversal hace falta una conversión
// geométrica adicional (asumir un ancho de contacto y un largo de pista
// fijos, Volumen = Profundidad · Ancho · Largo) que es una SIMPLIFICACIÓN
// de este simulador para la puesta en escena, NO parte de la ley de
// Archard en sí (que es agnóstica a la forma real de la huella de
// desgaste). Documentado en cada constante/función de acá abajo, y
// también en la nota de la UI (index.html), para que quede claro que el
// número exacto y citable es el VOLUMEN (ds_mVolumen, ya existente), y que
// la PROFUNDIDAD (ds_mProfundidad, métrica nueva) es una estimación
// derivada con un supuesto geométrico adicional.

// Geometría fija de la escena (viewBox del SVG).
const DZ_DS_VB_W = 260, DZ_DS_VB_H = 170;
const DZ_DS_SURF_Y = 60;       // altura (y) de la superficie SIN desgaste, en reposo
const DZ_DS_SURF_X0 = 20, DZ_DS_SURF_X1 = 240; // ancho dibujado del cuerpo fijo
const DZ_DS_SURF_BOTTOM = 150; // borde inferior del cuerpo fijo (relleno)
const DZ_DS_PIN_W = 26, DZ_DS_PIN_H = 22; // tamaño del "pin" deslizante

// Conversión volumen -> profundidad de ranura: SIMPLIFICACIÓN GEOMÉTRICA
// (ver comentario de cabecera), no un dato de Archard. Se asume que el
// segmento de pista de desgaste representado en este corte tiene un ancho
// de contacto y un largo fijos -- valores de orden de magnitud típico de
// un ensayo pin-on-disco de laboratorio, elegidos solo para que la
// conversión dé profundidades visualmente razonables (mm, no µm ni km).
const DS_ANCHO_CONTACTO_MM = 3;   // ancho de contacto ilustrativo del pin
const DS_LARGO_RANURA_MM = 15;    // largo de pista representado en el corte
// Profundidad "de fondo de escala" del corte dibujado: más allá de este
// valor, la ranura se recorta VISUALMENTE (clamp) para no salirse del
// dibujo -- el número real (sin recortar) se sigue mostrando siempre en
// la métrica ds_mProfundidad.
const DS_PROF_VISUAL_MAX_MM = 6;

// Único lugar donde vive esta conversión -- reusada tanto por el dibujo
// como por el texto de la métrica, para que nunca puedan desincronizarse.
function dsProfundidadMm(V_mm3) {
  if (!isFinite(V_mm3)) return NaN;
  return V_mm3 / (DS_ANCHO_CONTACTO_MM * DS_LARGO_RANURA_MM);
}

// Perfil de la ranura: función tipo "ventana de Hann" (coseno elevado),
// perfil suave y acotado, sin pretensión de ser la forma real de una huella
// de desgaste (que depende del mecanismo, la geometría del contacto, etc.)
// -- solo una curva razonable para que la ranura se vea como un surco.
function dsPerfilRanura(xFrac, profFracVisual) {
  // xFrac: posición horizontal 0..1 dentro del ancho de la ranura dibujada.
  // profFracVisual: 0..1, profundidad visual actual (ya clampeada).
  const d = Math.abs(xFrac - 0.5) * 2; // 0 en el centro, 1 en los bordes de la ranura
  if (d >= 1) return 0;
  return profFracVisual * 0.5 * (1 + Math.cos(Math.PI * d));
}

const DZ_DS_RANURA_X0 = 70, DZ_DS_RANURA_X1 = 190; // ancho horizontal de la ranura dibujada
const DZ_DS_RANURA_PROF_PX = 34; // profundidad máxima en px cuando profFracVisual=1
const DZ_DS_N_MUESTRAS = 28;
const DZ_DS_NUM_CICLOS_ILUSTRATIVOS = 4; // vaivenes del pin durante la animación -- puesta en
// escena pura (ritmo de la animación), NO la cantidad real de pasadas de la
// distancia recorrida (que sería astronómicamente mayor en metros reales).

// Única fuente de verdad de la escena: tanto la animación (dsDeslizar(),
// cuadro a cuadro) como el estado final instantáneo (fraction=1, llamado
// desde dsUpdate()) pasan por acá.
function dsDrawEscena(svg, fraction, k, F, dMax, H_pa) {
  if (!svg) return;
  const f = Math.max(0, Math.min(1, fraction));
  const d = f * dMax;
  const V_m3 = dsCalcVolumen(k, F, d, H_pa); // ley de Archard real, sin tocar
  const V_mm3 = isFinite(V_m3) ? V_m3 * 1e9 : NaN;
  const profundidadMm = dsProfundidadMm(V_mm3); // simplificación geométrica, ver comentario arriba
  const profFracVisual = isFinite(profundidadMm) ? Math.max(0, Math.min(1, profundidadMm / DS_PROF_VISUAL_MAX_MM)) : 0;

  const mProf = document.getElementById('ds_mProfundidad');
  if (mProf) mProf.textContent = isFinite(profundidadMm) ? profundidadMm.toFixed(3).replace('.', ',') : '—';

  // Muestreo del perfil de la ranura (polígono relleno del cuerpo fijo).
  let puntosSuperficie = [];
  for (let i = 0; i <= DZ_DS_N_MUESTRAS; i++) {
    const x = DZ_DS_SURF_X0 + (DZ_DS_SURF_X1 - DZ_DS_SURF_X0) * i / DZ_DS_N_MUESTRAS;
    let y = DZ_DS_SURF_Y;
    if (x >= DZ_DS_RANURA_X0 && x <= DZ_DS_RANURA_X1) {
      const xFrac = (x - DZ_DS_RANURA_X0) / (DZ_DS_RANURA_X1 - DZ_DS_RANURA_X0);
      y = DZ_DS_SURF_Y + DZ_DS_RANURA_PROF_PX * dsPerfilRanura(xFrac, profFracVisual);
    }
    puntosSuperficie.push([x, y]);
  }
  const poligonoCuerpo = [
    `${DZ_DS_SURF_X0},${DZ_DS_SURF_BOTTOM}`,
    ...puntosSuperficie.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`),
    `${DZ_DS_SURF_X1},${DZ_DS_SURF_BOTTOM}`,
  ].join(' ');

  // Posición horizontal del pin: vaivén ilustrativo (ver comentario arriba),
  // recorre el ancho de la ranura de lado a lado varias veces durante la
  // animación completa. En reposo (fraction=1, llamado desde dsUpdate())
  // queda centrado, como una "foto" representativa cualquiera del vaivén.
  const xPinFrac = (f >= 1) ? 0.5 : 0.5 + 0.5 * Math.sin(f * 2 * Math.PI * DZ_DS_NUM_CICLOS_ILUSTRATIVOS);
  const xPinCentro = DZ_DS_RANURA_X0 + (DZ_DS_RANURA_X1 - DZ_DS_RANURA_X0) * xPinFrac;
  const yPinSuperficie = DZ_DS_SURF_Y + DZ_DS_RANURA_PROF_PX * dsPerfilRanura(xPinFrac, profFracVisual);

  svg.innerHTML = `
    <rect x="2" y="2" width="${DZ_DS_VB_W - 4}" height="${DZ_DS_VB_H - 4}" rx="6" fill="var(--surface)" stroke="var(--border)"/>
    <text x="12" y="20" fill="var(--muted)" font-size="9" letter-spacing="1">CORTE TRANSVERSAL (ILUSTRATIVO)</text>

    <!-- cuerpo fijo, con la ranura ya carvada en su superficie superior -->
    <polygon points="${poligonoCuerpo}" fill="#9a9d9f" stroke="var(--border)" stroke-width="1"/>
    <!-- sombreado del fondo de la ranura, para que se note la profundidad -->
    <polygon points="${poligonoCuerpo}" fill="url(#dsRanuraGrad)" opacity="0.55"/>

    <!-- pin deslizante -->
    <rect x="${(xPinCentro - DZ_DS_PIN_W / 2).toFixed(1)}" y="${(yPinSuperficie - DZ_DS_PIN_H).toFixed(1)}" width="${DZ_DS_PIN_W}" height="${DZ_DS_PIN_H}" rx="3" fill="#5b6b78" stroke="var(--border)" stroke-width="1"/>
    <text x="${xPinCentro.toFixed(1)}" y="${(yPinSuperficie - DZ_DS_PIN_H / 2 + 3).toFixed(1)}" text-anchor="middle" fill="#e7ecef" font-size="8">PIN</text>
    <text x="${xPinCentro.toFixed(1)}" y="${(yPinSuperficie - DZ_DS_PIN_H - 5).toFixed(1)}" text-anchor="middle" fill="var(--muted)" font-size="8">F</text>

    <defs>
      <linearGradient id="dsRanuraGrad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#000000" stop-opacity="0"/>
        <stop offset="1" stop-color="#000000" stop-opacity="0.4"/>
      </linearGradient>
    </defs>

    <text x="${DZ_DS_VB_W / 2}" y="${DZ_DS_VB_H - 8}" text-anchor="middle" fill="var(--muted)" font-size="9">profundidad = conversión geométrica ilustrativa (ancho·largo fijos) · Archard solo predice volumen</text>
  `;
}

let dzDsAnimando = false;
let dzDsAnimId = null;

function dsDeslizar() {
  if (dzDsAnimando) return;
  const svg = document.getElementById('ds_svg');
  if (!svg) return;

  const par = DS_K_TABLE[document.getElementById('ds_par').value];
  const F = parseFloat(document.getElementById('ds_fuerza').value) || 0; // <input type=range>, estructuralmente numérico
  const hb = parseFloat(document.getElementById('ds_dureza').value) || 1; // ídem
  const dMax = parseFloat(document.getElementById('ds_distancia').value) || 0; // ídem
  const H_pa = hb * 9.80665e6;

  dzDsAnimando = true;
  const btn = document.getElementById('ds_btnDeslizar');
  if (btn) btn.disabled = true;
  const label = document.getElementById('ds_distanciaLabel');

  const DUR_TOTAL = 2200; // ms de animación -- ilustrativo, sin relación con los metros reales recorridos
  const t0 = performance.now();

  function frame(now) {
    const el = now - t0;
    const fraction = Math.max(0, Math.min(1, el / DUR_TOTAL));
    const dSim = fraction * dMax;
    dsDrawEscena(svg, fraction, par.k, F, dMax, H_pa);
    if (label) label.textContent = `Distancia recorrida: ${dSim.toFixed(0).replace('.', ',')} / ${dMax} m`;
    if (el < DUR_TOTAL) {
      dzDsAnimId = requestAnimationFrame(frame);
    } else {
      dzDsAnimando = false;
      cancelAnimationFrame(dzDsAnimId);
      if (btn) btn.disabled = false;
      dsUpdate(); // deja curva, métricas y escena en el estado final canónico
    }
  }
  dzDsAnimId = requestAnimationFrame(frame);
}

// escena-fluencia.js — escena animada de probeta en el horno, alargándose
// hasta la rotura (prototipo, post-v6.18). Sexto módulo del backlog de
// escenas (orden de prioridad: 1. Tensiones residuales, 2. Ultrasonido,
// 3. Metalografía, 4. Corrosión, 5. Desgaste, 6. Fluencia), noveno
// "aparato/proceso" animado en total.
//
// Este es el módulo con MENOS física nueva de los 6: la curva ε(t) de 3
// etapas ya la calcula flUpdateComportamiento() entera (primaria/
// secundaria/terciaria, ε̇_s real por Norton-Bailey/Dorn, t_r por
// ductilidad) -- acá solo se DRAMATIZA en el tiempo, leyendo eps
// directamente de los puntos `pts` que ya arma esa función (expuestos en
// FL_ULTIMO, fluencia.js) sin recalcular ni duplicar la fórmula.
//
// Botón "▶ Simular ensayo (tiempo comprimido)" (`flEnsayar()`) como capa
// ADICIONAL sobre la exploración instantánea existente (material, tensión
// y temperatura siguen actualizando la curva y las 2 métricas al instante
// vía flUpdateComportamiento(), sin tocar esa lógica). flUpdateComportamiento()
// se extiende con la asignación de FL_ULTIMO + una sola línea que llama
// flDrawEscena(svg, 1, FL_ULTIMO) -- mismo criterio que
// trUpdate()/utUpdate()/crUpdate()/dsUpdate().
//
// Escala de tiempo: t_r puede ser de años reales -- la animación NO
// reproduce eso en tiempo real, recorre las 3 etapas completas en unos
// segundos (DUR_TOTAL más abajo). Aclarado en la nota de la UI
// (index.html) y en el propio DUR_TOTAL. La velocidad de reproducción es
// pura puesta en escena; la elongación dibujada en cada instante SÍ es la
// deformación ε real de esa curva (no una versión "amplificada" ni
// reescalada -- se dibuja literalmente largo = L0·(1+ε), que es la propia
// definición de deformación ingenieril, no una licencia visual adicional).
//
// Rotura: por construcción, flUpdateComportamiento() define t_r como el
// instante en que ε alcanza exactamente mat.epsF (último punto de `pts`),
// así que la rotura siempre coincide con fraction=1. Igual se chequea
// explícitamente (con tolerancia) para no seguir alargando la probeta más
// allá de epsF por errores de redondeo, y para poder reusar el gesto de
// "romperse" (dos mitades que se separan y rotan levemente) ya usado en
// Charpy (chRenderProbeta(), charpy-pendulo.js), adaptado acá con su
// propia implementación (misma idea, sin acoplar los dos archivos entre
// sí).

// Geometría fija de la escena (viewBox del SVG).
const DZ_FL_VB_W = 260, DZ_FL_VB_H = 170;
const DZ_FL_HORNO = { x: 20, y: 30, w: 220, h: 110 };
const DZ_FL_GRIP_W = 14, DZ_FL_GRIP_H = 40;
const DZ_FL_GRIP_IZQ_X = 40; // borde izquierdo del mordaza fija
const DZ_FL_BARRA_Y = 85;    // centro vertical de la probeta
const DZ_FL_L0_PX = 80;      // longitud dibujada de la probeta a ε=0
const DZ_FL_ROTURA_GAP_PX = 7;

// Color del horno según temperatura -- APROXIMACIÓN ILUSTRATIVA simple de
// 3 colores (rojo oscuro -> naranja -> amarillo pálido), inspirada en la
// progresión real de colores de incandescencia de un metal caliente, NO
// un cálculo de radiancia de cuerpo negro (eso requeriría la ley de
// Planck y una conversión a color perceptual, fuera del alcance de esta
// puesta en escena).
function flColorHorno(tC) {
  const f = Math.max(0, Math.min(1, (tC - 300) / (1100 - 300)));
  const stops = [
    [120, 25, 15],   // rojo oscuro, ~300°C
    [225, 110, 20],  // naranja, ~700°C
    [255, 225, 140], // amarillo pálido, ~1100°C
  ];
  let a, b, t;
  if (f < 0.5) { a = stops[0]; b = stops[1]; t = f / 0.5; }
  else { a = stops[1]; b = stops[2]; t = (f - 0.5) / 0.5; }
  const r = Math.round(a[0] + (b[0] - a[0]) * t);
  const g = Math.round(a[1] + (b[1] - a[1]) * t);
  const bl = Math.round(a[2] + (b[2] - a[2]) * t);
  return `rgb(${r},${g},${bl})`;
}

// Interpolación lineal de ε(t) leyendo directamente los puntos ya
// calculados por flUpdateComportamiento() (snap.pts, uniformemente
// espaciados en t de 0 a snap.tr) -- SIN recalcular ninguna fórmula.
function flEpsEnFraction(snap, fraction) {
  const pts = snap.pts;
  const N = pts.length - 1;
  const f = Math.max(0, Math.min(1, fraction));
  const idxF = f * N;
  const i0 = Math.floor(idxF);
  const i1 = Math.min(N, i0 + 1);
  const resto = idxF - i0;
  return pts[i0].y * (1 - resto) + pts[i1].y * resto;
}

// Única fuente de verdad de la escena: tanto la animación (flEnsayar(),
// cuadro a cuadro) como el estado final instantáneo (fraction=1, llamado
// desde flUpdateComportamiento()) pasan por acá.
function flDrawEscena(svg, fraction, snap) {
  if (!svg || !snap) return;
  const f = Math.max(0, Math.min(1, fraction));
  const eps = flEpsEnFraction(snap, f);
  const roto = eps >= snap.mat.epsF - 1e-9;

  const largoPx = DZ_FL_L0_PX * (1 + eps);
  const xBarraIni = DZ_FL_GRIP_IZQ_X + DZ_FL_GRIP_W;
  const xBarraFin = xBarraIni + largoPx;
  const xGripDerIni = xBarraFin;

  const colorHorno = flColorHorno(snap.tC);

  let probetaSvg;
  if (!roto) {
    probetaSvg = `<rect x="${xBarraIni.toFixed(1)}" y="${DZ_FL_BARRA_Y - 8}" width="${largoPx.toFixed(1)}" height="16" fill="#c7ccce" stroke="var(--border)" stroke-width="1"/>`;
  } else {
    // Gesto de rotura (mismo espíritu que chRenderProbeta() en Charpy,
    // implementación propia): las 2 mitades se separan y rotan levemente.
    const mitad = largoPx / 2;
    const xCorte = xBarraIni + mitad;
    probetaSvg = `
      <g transform="translate(${-DZ_FL_ROTURA_GAP_PX},0) rotate(-4 ${xBarraIni.toFixed(1)} ${DZ_FL_BARRA_Y})">
        <rect x="${xBarraIni.toFixed(1)}" y="${DZ_FL_BARRA_Y - 8}" width="${mitad.toFixed(1)}" height="16" fill="#c7ccce" stroke="var(--border)" stroke-width="1"/>
      </g>
      <g transform="translate(${DZ_FL_ROTURA_GAP_PX},0) rotate(4 ${xCorte.toFixed(1)} ${DZ_FL_BARRA_Y})">
        <rect x="${xCorte.toFixed(1)}" y="${DZ_FL_BARRA_Y - 8}" width="${mitad.toFixed(1)}" height="16" fill="#c7ccce" stroke="var(--border)" stroke-width="1"/>
      </g>`;
  }

  svg.innerHTML = `
    <rect x="2" y="2" width="${DZ_FL_VB_W - 4}" height="${DZ_FL_VB_H - 4}" rx="6" fill="var(--surface)" stroke="var(--border)"/>
    <text x="12" y="20" fill="var(--muted)" font-size="9" letter-spacing="1">ENSAYO DE FLUENCIA (HORNO)</text>

    <!-- horno esquemático -->
    <rect x="${DZ_FL_HORNO.x}" y="${DZ_FL_HORNO.y}" width="${DZ_FL_HORNO.w}" height="${DZ_FL_HORNO.h}" rx="6" fill="${colorHorno}" opacity="0.30" stroke="var(--border)" stroke-width="1.5"/>
    <text x="${DZ_FL_HORNO.x + DZ_FL_HORNO.w / 2}" y="${DZ_FL_HORNO.y + 14}" text-anchor="middle" fill="var(--muted)" font-size="8">T = ${snap.tC.toFixed(0)} °C</text>

    <!-- mordazas fijas -->
    <rect x="${DZ_FL_GRIP_IZQ_X}" y="${DZ_FL_BARRA_Y - DZ_FL_GRIP_H / 2}" width="${DZ_FL_GRIP_W}" height="${DZ_FL_GRIP_H}" fill="#5b6b78" stroke="var(--border)" stroke-width="1"/>
    <rect x="${xGripDerIni.toFixed(1)}" y="${DZ_FL_BARRA_Y - DZ_FL_GRIP_H / 2}" width="${DZ_FL_GRIP_W}" height="${DZ_FL_GRIP_H}" fill="#5b6b78" stroke="var(--border)" stroke-width="1"/>

    <!-- probeta (entera o rota) -->
    ${probetaSvg}

    <!-- carga que mantiene la tensión constante -->
    <text x="${(DZ_FL_GRIP_IZQ_X + DZ_FL_GRIP_W / 2).toFixed(1)}" y="${DZ_FL_BARRA_Y - DZ_FL_GRIP_H / 2 - 6}" text-anchor="middle" fill="var(--muted)" font-size="8">σ = ${snap.sigma.toFixed(0)} MPa</text>

    <text x="${DZ_FL_VB_W / 2}" y="${DZ_FL_VB_H - 8}" text-anchor="middle" fill="var(--muted)" font-size="9">${roto ? 'rotura por fluencia (ε alcanzó la ductilidad del material)' : 'elongación = ε real de la curva · color del horno = ilustrativo'}</text>
  `;
}

let dzFlAnimando = false;
let dzFlAnimId = null;

function flEnsayar() {
  if (dzFlAnimando) return;
  const svg = document.getElementById('fl_svg');
  if (!svg || !FL_ULTIMO) return;
  const snap = FL_ULTIMO; // congelado al arrancar (ver comentario junto a FL_ULTIMO en fluencia.js)

  dzFlAnimando = true;
  const btn = document.getElementById('fl_btnEnsayar');
  if (btn) btn.disabled = true;
  const label = document.getElementById('fl_tiempoLabel');

  const DUR_TOTAL = 10000; // ms de animación -- t_r real puede ser de años, ver comentario de cabecera
  const t0 = performance.now();

  function frame(now) {
    const el = now - t0;
    const fraction = Math.max(0, Math.min(1, el / DUR_TOTAL));
    const tSim = fraction * snap.tr;
    flDrawEscena(svg, fraction, snap);
    if (label) label.textContent = `Tiempo simulado: ${tSim.toExponential(2).replace('.', ',')} / ${snap.tr.toExponential(2).replace('.', ',')} h (escala comprimida)`;
    if (el < DUR_TOTAL) {
      dzFlAnimId = requestAnimationFrame(frame);
    } else {
      dzFlAnimando = false;
      cancelAnimationFrame(dzFlAnimId);
      if (btn) btn.disabled = false;
      flUpdateComportamiento(); // deja curva, métricas y escena en el estado final canónico
    }
  }
  dzFlAnimId = requestAnimationFrame(frame);
}

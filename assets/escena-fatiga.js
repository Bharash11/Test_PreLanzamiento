// escena-fatiga.js — escena animada de grieta creciendo con los ciclos
// hasta la rotura por fatiga (prototipo, post-v6.19). Séptimo y último
// módulo del backlog de escenas (orden de prioridad: 1. Tensiones
// residuales, 2. Ultrasonido, 3. Metalografía, 4. Corrosión, 5. Desgaste,
// 6. Fluencia, 7. Fatiga/Paris), décimo "aparato/proceso" animado en
// total.
//
// A diferencia de los otros 6 módulos, acá la curva a(N) NO existía
// previamente en ninguna forma -- el panel solo mostraba da/dN para un
// ΔK puntual fijo (Región II de Paris), sin ninguna noción de que ΔK
// depende de la propia longitud de grieta `a` (que crece con cada
// ciclo), ni de cuántos ciclos hacen falta para llegar a la rotura. Por
// eso este módulo SÍ agrega física/parámetros nuevos a la UI (Δσ, a₀, Y)
// y una integración numérica real (ftCalcCurvaCrecimiento(), en
// fatiga.js) -- discutido y decidido explícitamente con Giamma antes de
// escribir código (Opción A: integración completa, con Y editable en la
// UI, en vez de dejarlo fijo en el código o hacer una versión puramente
// ilustrativa que no integre nada). Ver el comentario de cabecera de
// ftCalcCurvaCrecimiento() en fatiga.js para el detalle de POR QUÉ se
// integra con paso fijo en `a` (y no en N, que sería inestable cerca de
// la grieta crítica a_c).
//
// Esta escena, en sí, es la parte "liviana" de este módulo: solo
// dramatiza en el tiempo la curva {a, N} que ya calculó
// ftCalcCurvaCrecimiento() (expuesta en FT_ULTIMO, fatiga.js), sin
// recalcular ni duplicar esa integración -- mismo patrón que
// flEpsEnFraction()/FL_ULTIMO en Fluencia.
//
// Botón "▶ Simular crecimiento (ciclos comprimidos)" (`ftEnsayarFatiga()`)
// como capa ADICIONAL sobre la exploración instantánea existente
// (material/C/m/K_IC/ΔK/Δσ/a₀/Y siguen actualizando la curva da/dN, las
// 4 métricas y la escena al instante vía ftUpdateVelocidad(), sin tocar
// esa lógica). ftUpdateVelocidad() se extiende con la asignación de
// FT_ULTIMO + una sola línea que llama ftDrawEscena(svg, 1, FT_ULTIMO) --
// mismo criterio que trUpdate()/utUpdate()/crUpdate()/dsUpdate()/
// flUpdateComportamiento().
//
// Escala de ciclos comprimida: N_f puede ser de cientos de miles o
// millones de ciclos -- la animación NO los reproduce 1:1, recorre toda
// la curva en unos segundos (DUR_TOTAL más abajo), aclarado en la nota de
// la UI. La LONGITUD de grieta dibujada en cada instante sí es la `a`
// real de la curva (leída de FT_ULTIMO.curva, sin escalar ni exagerar);
// lo único ilustrativo es la velocidad de reproducción.
//
// Simplificación geométrica, ya aclarada en la UI (index.html) y en
// fatiga.js: se asume Y constante durante todo el crecimiento (en la
// realidad Y depende de la relación a/W, fuera de alcance acá).

// Geometría fija de la escena (viewBox del SVG).
const DZ_FT_VB_W = 260, DZ_FT_VB_H = 170;
const DZ_FT_PLACA = { x: 30, y: 40, w: 200, h: 90 };
const DZ_FT_GRIETA_MAX_PX = 85; // largo dibujado de la grieta cuando a=a_c (recorte visual, ver comentario abajo)

// Interpolación lineal de N(a) leyendo directamente los puntos ya
// calculados por ftCalcCurvaCrecimiento() (snap.curva, uniformemente
// espaciados en `a` de a₀ a a_c) -- SIN recalcular ninguna integración.
// Notar que acá `fraction` recorre directamente el eje `a` (que SÍ es
// uniforme por construcción, ver comentario de ftCalcCurvaCrecimiento()
// en fatiga.js), a diferencia de flEpsEnFraction() en Fluencia (donde
// fraction recorre el tiempo). Por eso alcanza con leer el índice
// correspondiente, sin buscar dónde cae `fraction` dentro de la curva.
function ftNEnFraction(snap, fraction) {
  const curva = snap.curva;
  const nPasos = curva.length - 1;
  const f = Math.max(0, Math.min(1, fraction));
  const idxF = f * nPasos;
  const i0 = Math.floor(idxF);
  const i1 = Math.min(nPasos, i0 + 1);
  const resto = idxF - i0;
  return curva[i0].N * (1 - resto) + curva[i1].N * resto;
}

// Única fuente de verdad de la escena: tanto la animación
// (ftEnsayarFatiga(), cuadro a cuadro) como el estado final instantáneo
// (fraction=1, llamado desde ftUpdateVelocidad()) pasan por acá.
function ftDrawEscena(svg, fraction, snap) {
  if (!svg) return;
  if (!snap) {
    // Parámetros inválidos (ver ftUpdateVelocidad()) -- placa sin grieta,
    // sin intentar dibujar nada que dependa de valores inconsistentes.
    svg.innerHTML = `
      <rect x="2" y="2" width="${DZ_FT_VB_W - 4}" height="${DZ_FT_VB_H - 4}" rx="6" fill="var(--surface)" stroke="var(--border)"/>
      <text x="${DZ_FT_VB_W / 2}" y="${DZ_FT_VB_H / 2}" text-anchor="middle" fill="var(--muted)" font-size="10">Ajustá Δσ, a₀, Y y K_IC para ver la escena</text>
    `;
    return;
  }
  const f = Math.max(0, Math.min(1, fraction));
  // `a` es literalmente lineal en fraction por construcción (paso fijo en
  // `a` en ftCalcCurvaCrecimiento()) -- se calcula directo, sin necesidad
  // de interpolar sobre la curva (a diferencia de N, que sí hace falta
  // interpolar porque no es lineal, ver ftNEnFraction()).
  const a_m = snap.a0_m + f * (snap.ac_m - snap.a0_m);
  const N = ftNEnFraction(snap, f);

  // Conversión a píxeles: RECORTE VISUAL puro (a_c siempre llena el ancho
  // dibujado de la grieta, sea a_c de 2mm o de 200mm) -- para que la
  // escena sea legible independientemente de la escala real de a_c, que
  // varía muchísimo según Δσ/Y/K_IC. El número real (sin recortar) sigue
  // siempre en la métrica ft_mAc.
  const grietaFracVisual = snap.ac_m > snap.a0_m ? (a_m - snap.a0_m) / (snap.ac_m - snap.a0_m) : 0;
  const largoGrietaPx = DZ_FT_GRIETA_MAX_PX * Math.max(0, Math.min(1, grietaFracVisual));

  const cx = DZ_FT_PLACA.x + DZ_FT_PLACA.w / 2;
  const cy = DZ_FT_PLACA.y + DZ_FT_PLACA.h / 2;
  const roto = f >= 1 - 1e-9;

  // Grieta: una línea en zigzag leve desde el centro hacia la derecha,
  // cuyo largo crece con `a` -- puramente esquemática (una grieta real de
  // fatiga no es una línea recta ni perfectamente horizontal), pero el
  // LARGO sí está atado a la magnitud real (ver conversión arriba).
  const puntas = 6;
  let dGrieta = `M ${cx.toFixed(1)} ${cy.toFixed(1)}`;
  for (let i = 1; i <= puntas; i++) {
    const t = i / puntas;
    const x = cx + largoGrietaPx * t;
    const y = cy + (i % 2 === 0 ? 3 : -3);
    dGrieta += ` L ${x.toFixed(1)} ${y.toFixed(1)}`;
  }

  let roturaSvg = '';
  if (roto) {
    // Gesto de rotura (mismo espíritu que chRenderProbeta() en Charpy y
    // el usado en Fluencia): la placa se separa en 2 mitades por la
    // grieta, con una leve rotación.
    roturaSvg = `<text x="${cx.toFixed(1)}" y="${(DZ_FT_PLACA.y + DZ_FT_PLACA.h + 16).toFixed(1)}" text-anchor="middle" fill="#b3392c" font-size="9">rotura: a alcanzó a_c (ΔK llegó a K_IC)</text>`;
  }

  const gapRotura = roto ? 6 : 0;

  svg.innerHTML = `
    <rect x="2" y="2" width="${DZ_FT_VB_W - 4}" height="${DZ_FT_VB_H - 4}" rx="6" fill="var(--surface)" stroke="var(--border)"/>
    <text x="12" y="20" fill="var(--muted)" font-size="9" letter-spacing="1">PROBETA CON GRIETA (ESQUEMÁTICO)</text>

    <!-- placa, partida en 2 si ya rompió -->
    <g transform="translate(${-gapRotura},0)">
      <rect x="${DZ_FT_PLACA.x}" y="${DZ_FT_PLACA.y}" width="${(DZ_FT_PLACA.w / 2)}" height="${DZ_FT_PLACA.h}" fill="#c7ccce" stroke="var(--border)" stroke-width="1"/>
    </g>
    <g transform="translate(${gapRotura},0)">
      <rect x="${cx.toFixed(1)}" y="${DZ_FT_PLACA.y}" width="${(DZ_FT_PLACA.w / 2)}" height="${DZ_FT_PLACA.h}" fill="#c7ccce" stroke="var(--border)" stroke-width="1"/>
    </g>

    <!-- grieta -->
    <path d="${dGrieta}" fill="none" stroke="#b3392c" stroke-width="2"/>

    <!-- flechas de carga cíclica (Δσ) -->
    <text x="${DZ_FT_PLACA.x - 6}" y="${cy + 3}" text-anchor="end" fill="var(--muted)" font-size="10">⇄</text>
    <text x="${DZ_FT_PLACA.x + DZ_FT_PLACA.w + 6}" y="${cy + 3}" fill="var(--muted)" font-size="10">⇄</text>
    <text x="${cx.toFixed(1)}" y="${(DZ_FT_PLACA.y - 8)}" text-anchor="middle" fill="var(--muted)" font-size="8">Δσ = ${snap.dSigma.toFixed(0)} MPa</text>

    ${roturaSvg}
    <text x="${DZ_FT_VB_W / 2}" y="${DZ_FT_VB_H - 8}" text-anchor="middle" fill="var(--muted)" font-size="9">a = ${(a_m * 1000).toFixed(2).replace('.', ',')} mm · N = ${N.toExponential(2).replace('.', ',')} ciclos (recorte visual, no la escala real de a_c)</text>
  `;
}

let dzFtAnimando = false;
let dzFtAnimId = null;

function ftEnsayarFatiga() {
  if (dzFtAnimando) return;
  const svg = document.getElementById('ft_svg');
  if (!svg || !FT_ULTIMO) return;
  const snap = FT_ULTIMO; // congelado al arrancar (ver comentario junto a FT_ULTIMO en fatiga.js)

  dzFtAnimando = true;
  const btn = document.getElementById('ft_btnCrecer');
  if (btn) btn.disabled = true;
  const label = document.getElementById('ft_ciclosLabel');

  const DUR_TOTAL = 9000; // ms de animación -- N_f real puede ser de cientos de miles/millones de ciclos
  const t0 = performance.now();

  function frame(now) {
    const el = now - t0;
    const fraction = Math.max(0, Math.min(1, el / DUR_TOTAL));
    const N = ftNEnFraction(snap, fraction);
    ftDrawEscena(svg, fraction, snap);
    if (label) label.textContent = `Ciclos simulados: ${N.toExponential(2).replace('.', ',')} / ${snap.Nf.toExponential(2).replace('.', ',')} (escala comprimida)`;
    if (el < DUR_TOTAL) {
      dzFtAnimId = requestAnimationFrame(frame);
    } else {
      dzFtAnimando = false;
      cancelAnimationFrame(dzFtAnimId);
      if (btn) btn.disabled = false;
      ftUpdateVelocidad(); // deja curva, métricas y escena en el estado final canónico
    }
  }
  dzFtAnimId = requestAnimationFrame(frame);
}

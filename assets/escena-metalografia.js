// escena-metalografia.js — escena animada de preparación metalográfica
// (prototipo, post-v6.14). Sexto módulo con "aparato físico"/proceso
// animado después de Charpy/Brinell/Rockwell/Vickers-Knoop/Tensiones
// residuales/Ultrasonido -- mismo criterio: agrega un botón que dramatiza
// en el tiempo lo que metalografia.js ya calcula y dibuja al instante con
// el slider ℓ (mg_ell), sin tocar ni reemplazar esa exploración
// instantánea (mgUpdate() sigue redibujando la micrografía final apenas
// se mueve el slider, exactamente igual que antes).
//
// A diferencia de las 5 escenas anteriores, acá NO hay ninguna
// "herramienta" que se retire dejando una marca (no hay broca, indentador
// ni palpador) -- lo que se dramatiza es el PROCESO de preparación de la
// probeta que hoy se saltea directo al resultado: desbaste/pulido → ataque
// químico (nital u otro reactivo) → observación al microscopio. Por eso
// no hay separación herramienta/marca; en su lugar hay una única variable
// de progreso global (0..1) que atraviesa las 3 etapas en secuencia.
//
// Honestidad física: el propio diagrama de Voronoi final (mgDrawMicrografia,
// en metalografia.js) ya estaba documentado como esquemático/ilustrativo, no
// una micrografía real. Todo lo que agrega esta escena (textura rugosa,
// pulido progresivo, flash del ataque químico) es puesta en escena del
// PROCESO -- no representa ninguna magnitud medida por el simulador (no hay
// una "rugosidad Ra" ni un "tiempo de ataque" que sea parámetro de entrada
// en ningún lado de este módulo) y se documenta como tal en cada función,
// mismo criterio que la K de Charpy o el agujero ilustrativo de Tensiones
// residuales.
//
// Layout: a diferencia de los 5 módulos anteriores, acá NO se agrega grid
// de 2 columnas en desktop -- en Charpy/Brinell/Rockwell/Vickers-Knoop/
// Tensiones/Ultrasonido esa grilla existe para mostrar la escena del
// "aparato" y un gráfico/resultado ANALÍTICO DISTINTO uno al lado del otro.
// Acá no hay 2 vistas distintas: la escena de preparación y el resultado
// final (la micrografía) son la MISMA superficie dibujada en el MISMO
// canvas a lo largo del tiempo, no dos paneles que tenga sentido ver en
// simultáneo. Se deja esta nota en vez de agregar una grilla forzada sin
// un segundo panel real que justifique la columna.

let dzMgAnimando = false;
let dzMgAnimId = null;

function dzEaseInOutMg(t) { return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; }

// Límites de fase dentro del progreso global 0..1 (ver mgDrawEscenaPrep).
// Puramente de puesta en escena -- no hay una duración real citable para
// "cuánto dura pulir/atacar una probeta" en este simulador.
const DZ_MG_FASE_PULIDO_FIN = 0.55;
const DZ_MG_FASE_ATAQUE_FIN = 0.72;

// Textura de superficie rugosa/pulida -- PRNG determinístico (mismo
// mgMulberry32 de metalografia.js, semilla propia y fija) para que la
// escena sea reproducible frame a frame sin depender de Math.random().
// rugosidad: 1 = recién desbastada (rayas marcadas), 0 = pulida a espejo.
function mgDrawSuperficieRugosa(ctx, W, H, rugosidad) {
  const r = Math.max(0, Math.min(1, rugosidad));
  const rnd = mgMulberry32(777);
  ctx.fillStyle = '#b8b3ab';
  ctx.fillRect(0, 0, W, H);
  const nRayas = Math.round(90 * r);
  for (let i = 0; i < nRayas; i++) {
    const y = rnd() * H;
    const x = rnd() * W;
    const largo = 20 + rnd() * 60;
    const grosor = 0.4 + rnd() * 1.2;
    const dy = (rnd() - 0.5) * 6;
    ctx.strokeStyle = `rgba(90,84,76,${(0.15 + 0.35 * r).toFixed(2)})`;
    ctx.lineWidth = grosor;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + largo, y + dy);
    ctx.stroke();
  }
  // Brillo especular que aparece a medida que se pule (r→0) -- sugiere
  // superficie tipo espejo, sin ninguna magnitud física detrás.
  if (r < 0.6) {
    const brillo = (0.6 - r) / 0.6;
    const grad = ctx.createLinearGradient(0, 0, W, H);
    grad.addColorStop(0, `rgba(255,255,255,${(0.12 * brillo).toFixed(2)})`);
    grad.addColorStop(0.5, 'rgba(255,255,255,0)');
    grad.addColorStop(1, `rgba(255,255,255,${(0.08 * brillo).toFixed(2)})`);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);
  }
}

// Tinte translúcido simulando el instante del ataque químico (nital u otro
// reactivo, lo que revela los bordes de grano) -- ilustrativo, intensidad
// 0..1 (se usa con una curva de "sube y baja" tipo flash, ver
// mgDrawEscenaPrep).
function mgDrawFlashAtaque(ctx, W, H, intensidad) {
  const i = Math.max(0, Math.min(1, intensidad));
  ctx.fillStyle = `rgba(196,140,40,${(0.45 * i).toFixed(2)})`;
  ctx.fillRect(0, 0, W, H);
}

// Única fuente de verdad de la escena: tanto la animación (mgPrepararProbeta(),
// cuadro a cuadro) como el estado final instantáneo pasan por acá.
// progreso=1 debe dar exactamente la misma micrografía final que dibuja
// mgUpdate() para las mismas `semillas` -- el dibujo real del Voronoi sigue
// viviendo únicamente en mgDrawMicrografia() (metalografia.js), reusada acá
// sin reescribirla.
function mgDrawEscenaPrep(canvas, progreso, semillas) {
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  const p = Math.max(0, Math.min(1, progreso));

  if (p < DZ_MG_FASE_PULIDO_FIN) {
    // Desbaste/pulido: rugosidad decrece de 1 a 0 con un poco de ease para
    // que se sienta el paso de desbaste grueso → paño de pulido fino.
    const fp = p / DZ_MG_FASE_PULIDO_FIN;
    const rugosidad = 1 - dzEaseInOutMg(fp);
    mgDrawSuperficieRugosa(ctx, W, H, rugosidad);
  } else if (p < DZ_MG_FASE_ATAQUE_FIN) {
    // Ataque químico: superficie ya pulida a espejo (rugosidad=0) + flash
    // que sube y baja de intensidad a lo largo de esta fase.
    mgDrawSuperficieRugosa(ctx, W, H, 0);
    const fa = (p - DZ_MG_FASE_PULIDO_FIN) / (DZ_MG_FASE_ATAQUE_FIN - DZ_MG_FASE_PULIDO_FIN);
    const intensidad = Math.sin(fa * Math.PI); // 0 -> 1 -> 0
    mgDrawFlashAtaque(ctx, W, H, intensidad);
  } else {
    // Observación: la micrografía final (Voronoi) aparece con un fundido
    // de opacidad sobre la superficie ya pulida. mgDrawMicrografia() se
    // dibuja en un canvas auxiliar fuera de pantalla porque putImageData()
    // ignora globalAlpha -- drawImage() sí lo respeta, así que el fundido
    // se logra sin tocar ni duplicar la función real de dibujo del Voronoi.
    mgDrawSuperficieRugosa(ctx, W, H, 0);
    const off = document.createElement('canvas');
    off.width = W; off.height = H;
    mgDrawMicrografia(off, semillas);
    const fr = (p - DZ_MG_FASE_ATAQUE_FIN) / (1 - DZ_MG_FASE_ATAQUE_FIN);
    ctx.globalAlpha = Math.max(0, Math.min(1, fr || 0));
    ctx.drawImage(off, 0, 0);
    ctx.globalAlpha = 1;
  }
}

// Texto de la fase actual, mostrado debajo del canvas mientras se anima.
function mgFaseLabel(progreso) {
  const p = Math.max(0, Math.min(1, progreso));
  if (p < DZ_MG_FASE_PULIDO_FIN) return 'Desbastando y puliendo la superficie…';
  if (p < DZ_MG_FASE_ATAQUE_FIN) return 'Atacando químicamente (nital) para revelar los bordes de grano…';
  return 'Observando la microestructura al microscopio…';
}

// Recalcula, a partir del slider ℓ actual, las mismas `semillas` que ya usa
// mgUpdate() (misma cantidad nGranos, mismo seed 12345) -- así el resultado
// final de la animación coincide exactamente con la exploración instantánea.
function mgSemillasActuales() {
  const canvas = document.getElementById('mg_chart');
  const ell = parseFloat(document.getElementById('mg_ell').value) || 0; // <input type=range>, estructuralmente numérico
  const G = mgCalcG(ell);
  const nGranos = Math.max(15, Math.min(70, Math.round(80 - 5 * (isFinite(G) ? G : 5))));
  return mgGenerarSemillas(nGranos, 12345, canvas.width, canvas.height);
}

function mgPrepararProbeta() {
  if (dzMgAnimando) return;
  const canvas = document.getElementById('mg_chart');
  if (!canvas) return;
  const semillas = mgSemillasActuales(); // congeladas al arrancar, igual que e1/e2/e3 en trEnsayar()

  dzMgAnimando = true;
  const btn = document.getElementById('mg_btnPreparar');
  if (btn) btn.disabled = true;
  const label = document.getElementById('mg_faseLabel');

  const DUR_TOTAL = 2000; // ~2s, dentro del rango pedido (2-3s)
  const t0 = performance.now();

  function frame(now) {
    const el = now - t0;
    const p = Math.max(0, Math.min(1, el / DUR_TOTAL));
    mgDrawEscenaPrep(canvas, p, semillas);
    if (label) label.textContent = mgFaseLabel(p);
    if (el < DUR_TOTAL) {
      dzMgAnimId = requestAnimationFrame(frame);
    } else {
      dzMgAnimando = false;
      cancelAnimationFrame(dzMgAnimId);
      if (btn) btn.disabled = false;
      mgUpdate(); // deja el canvas y las 3 métricas en el estado final canónico
    }
  }
  dzMgAnimId = requestAnimationFrame(frame);
}

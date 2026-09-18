// metalografia.js — Módulo "Ensayos complementarios" (Grupo B, v5.3):
// Metalografía y microestructura — tamaño de grano según ASTM E112 (método de
// intercepción, Heyn) + una "micrografía" ilustrativa generada como diagrama
// de Voronoi en canvas (sin necesitar imágenes reales de microscopio).

/* ---------------- FÓRMULAS PURAS (testeables desde el día 1) ---------------- */

// Método de intercepción (Heyn), ASTM E112: a partir de la longitud media de
// intercepción ℓ (mm, medida a escala real/1x), da el número de tamaño de
// grano ASTM G. Constantes de la norma: G = -6,6439·log10(ℓ) - 3,288
// (mismas constantes citadas en metallography.org/ASTM E112 y, con redondeo
// equivalente, en patentes que citan la norma directamente).
function mgCalcG(ell_mm) {
  if (!(ell_mm > 0)) return NaN;
  return -6.6439 * Math.log10(ell_mm) - 3.288;
}

// Inversa: de G a ℓ (mm) -- útil para fijar sliders a partir de un G deseado
// y para el test de round-trip.
function mgCalcEllDesdeG(G) {
  if (!isFinite(G)) return NaN;
  return Math.pow(10, -(G + 3.288) / 6.6439);
}

// Número de grano por unidad de área a escala real (1x), en granos/mm²,
// según la definición del número de tamaño de grano ASTM (n = 2^(G-1)
// granos por pulgada cuadrada a 100x, convertido a mm² a 1x).
function mgCalcNA(G) {
  if (!isFinite(G)) return NaN;
  return 15.50 * Math.pow(2, G - 1);
}

// Diámetro medio de grano (mm) -- el propio ASTM E112 aclara que esto es el
// lado de un grano cuadrado equivalente de área 1/NA, no un diámetro físico
// real (los granos no son cuadrados), pero es la convención habitual.
function mgCalcDiametroMm(NA) {
  if (!(NA > 0)) return NaN;
  return Math.sqrt(1 / NA);
}

// FIX (v5.3): MG_CONDICION_TABLE -- a diferencia de las tablas de v5.1/v5.2
// (conductividad %IACS, velocidad de onda), acá NO hay un dato de material
// único y citable: el tamaño de grano depende del historial térmico/mecánico
// específico de cada pieza, no es una propiedad intrínseca del material. Por
// eso esta tabla son valores ILUSTRATIVOS representativos (mismo criterio que
// usó Polímeros con la Tg: "valores típicos, no de un lote específico"), para
// arrancar el slider en un punto razonable según la condición elegida.
const MG_CONDICION_TABLE = {
  fundicion:   { label: 'Fundición gris, sin tratamiento (grano grueso)',   ell: 0.226 },
  recocido:    { label: 'Acero recocido (grano medio)',                    ell: 0.057 },
  normalizado: { label: 'Acero normalizado (grano fino)',                  ell: 0.020 },
  templado:    { label: 'Acero templado y revenido (grano ultrafino)',     ell: 0.010 },
};

/* ---------------- MICROGRAFÍA ILUSTRATIVA (diagrama de Voronoi, canvas) ---------------- */

// PRNG chico y determinístico (mulberry32) para que la micrografía sea
// reproducible con la misma semilla -- necesario para poder testear
// mgGenerarSemillas sin depender de Math.random().
function mgMulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Genera n semillas (puntos) pseudoaleatorias pero reproducibles dentro de un
// rectángulo W×H. Pura y testeable: mismo seed → mismo resultado siempre.
function mgGenerarSemillas(n, seed, W, H) {
  const rnd = mgMulberry32(seed);
  const pts = [];
  for (let i = 0; i < n; i++) pts.push({ x: rnd() * W, y: rnd() * H });
  return pts;
}

// Dibuja el diagrama de Voronoi por fuerza bruta (nearest-neighbor por
// píxel) -- resolución interna reducida (ver mgInit) para que ande fluido
// en cada movimiento del slider, sin animación, "una sola pasada de dibujo".
function mgDrawMicrografia(canvas, semillas) {
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  const img = ctx.createImageData(W, H);
  const data = img.data;
  const n = semillas.length;
  // Tono claro por grano, con variación leve -- simula la diferencia de
  // brillo entre granos de distinta orientación cristalina bajo ataque
  // químico/luz polarizada en una micrografía real.
  const tono = semillas.map((_, i) => 205 + ((i * 47) % 40));

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      let d1 = Infinity, d2 = Infinity, idx = 0;
      for (let i = 0; i < n; i++) {
        const dx = x - semillas[i].x, dy = y - semillas[i].y;
        const dd = dx * dx + dy * dy;
        if (dd < d1) { d2 = d1; d1 = dd; idx = i; }
        else if (dd < d2) { d2 = dd; }
      }
      const esBorde = (Math.sqrt(d2) - Math.sqrt(d1)) < 1.1;
      const p = (y * W + x) * 4;
      if (esBorde) {
        data[p] = 58; data[p + 1] = 52; data[p + 2] = 46; data[p + 3] = 255;
      } else {
        const g = tono[idx];
        data[p] = g; data[p + 1] = g - 6; data[p + 2] = g - 14; data[p + 3] = 255;
      }
    }
  }
  ctx.putImageData(img, 0, 0);
}

/* ---------------- UI ---------------- */

function mgAplicarCondicion() {
  const cond = MG_CONDICION_TABLE[document.getElementById('mg_condicion').value];
  document.getElementById('mg_ell').value = cond.ell;
  mgUpdate();
}

function mgUpdate() {
  const ell = parseFloat(document.getElementById('mg_ell').value) || 0;
  document.getElementById('mg_ellVal').textContent = ell.toFixed(3).replace('.',',') + ' mm';

  const G = mgCalcG(ell);
  const NA = mgCalcNA(G);
  const d_mm = mgCalcDiametroMm(NA);

  document.getElementById('mg_mG').textContent = isFinite(G) ? G.toFixed(1).replace('.',',') : '—';
  document.getElementById('mg_mNA').textContent = isFinite(NA) ? NA.toFixed(0).replace('.',',') : '—';
  document.getElementById('mg_mDiametro').textContent = isFinite(d_mm) ? (d_mm * 1000).toFixed(1).replace('.',',') : '—';

  // Cantidad de granos dibujados: esquemática, no a escala real -- varía
  // suavemente con G solo para que se note visualmente "más fino"/"más
  // grueso" al mover el slider (ver nota en la UI).
  const nGranos = Math.max(15, Math.min(70, Math.round(80 - 5 * (isFinite(G) ? G : 5))));
  const canvas = document.getElementById('mg_chart');
  const semillas = mgGenerarSemillas(nGranos, 12345, canvas.width, canvas.height);
  mgDrawMicrografia(canvas, semillas);
}

function mgInit() {
  const canvas = document.getElementById('mg_chart');
  // Resolución interna reducida a propósito (rápido de recalcular en cada
  // input del slider); se estira por CSS al tamaño del contenedor.
  canvas.width = 320;
  canvas.height = 220;
  mgUpdate();
}

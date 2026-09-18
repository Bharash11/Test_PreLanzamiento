// modo-desafio.js — Infraestructura compartida para "Modo desafío" en NDT
// (backlog punto B, v5.8). La usan Ultrasonido y Radiografía: son los 2
// ensayos del Grupo B que en esta versión tienen un parámetro de "defecto"
// ajustable (profundidad / pérdida de espesor). Corrientes inducidas queda
// afuera a propósito -- su panel modela la curva amplitud/fase vs.
// profundidad de penetración del material, no un defecto puntual ubicable
// a una profundidad, así que no hay nada que "ocultar" ahí sin inventar un
// modelo físico nuevo (decisión tomada con la cátedra antes de arrancar
// este punto, ver CHANGELOG v5.8).
//
// Mismo criterio de mulberry32 que ya usa Metalografía (v5.3) para
// generación determinística/reproducible: misma semilla → mismo resultado
// siempre (lo que se testea). La semilla en sí se elige al azar cada vez
// que el alumno pide "Nuevo desafío" (no hay ningún input de semilla visible
// para el alumno -- no hace falta, el desafío es replicable puertas adentro
// para testing, no pensado como algo que el alumno comparta con un número).

function mdMulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Genera un valor pseudoaleatorio pero reproducible dentro de [min, max],
// alineado al step indicado. El rango SIEMPRE viene de los mismos límites ya
// validados del slider real del modo exploración (ver ut/rxDesafioNuevo) --
// acá no se inventa ningún rango nuevo, solo se elige un punto adentro.
function mdValorEnRango(seed, min, max, step) {
  if (!(max > min) || !(step > 0)) return min;
  const rnd = mdMulberry32(seed);
  const crudo = min + rnd() * (max - min);
  const pasos = Math.round((crudo - min) / step);
  let val = min + pasos * step;
  if (val > max) val = max;
  if (val < min) val = min;
  return +val.toFixed(4);
}

// Semilla nueva y suficientemente distinta entre clicks consecutivos --
// no necesita ser criptográfica, solo variar el resultado de mdValorEnRango
// cada vez que el alumno pide un desafío nuevo.
function mdNuevaSemilla() {
  return (Date.now() ^ Math.floor(Math.random() * 1e6)) | 0;
}

// Mensaje de feedback compartido entre Ultrasonido y Radiografía al revelar
// -- mismo umbral (10% del valor real, con un piso de 1mm para que valores
// reales chicos no exijan una precisión irreal) para los dos ensayos, así
// el criterio de "buena estimación" es consistente en todo el Grupo B.
function mdMensajeResultado(estimacion, real, unidad, pistaFormula) {
  if (!isFinite(estimacion)) {
    return 'Escribí una estimación antes de revelar para poder comparar.';
  }
  const dif = Math.abs(estimacion - real);
  const tolerancia = Math.max(1, real * 0.10);
  if (dif <= tolerancia) {
    return `¡Buena estimación! Diferencia de ${dif.toFixed(1).replace('.',',')} ${unidad}, dentro del ~10% del valor real.`;
  }
  return `Diferencia de ${dif.toFixed(1).replace('.',',')} ${unidad} — revisá ${pistaFormula} y probá de nuevo con "Nuevo desafío".`;
}

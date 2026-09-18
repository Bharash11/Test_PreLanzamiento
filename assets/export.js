// export.js — funciones de exportación de gráficos (todas las pestañas)

// FIX (Fase 10): cada función de export ya dispara la descarga -- se agrega
// una línea de registro en el progreso local (si el módulo está cargado),
// reusando el mismo punto de disparo en vez de agregar listeners nuevos.

/* ============================================================ EXPORT */
function exportChart(){
  const url = document.getElementById('mainChart').toDataURL('image/png');
  const a = document.createElement('a'); a.href=url; a.download='curva_traccion.png'; a.click();
  if (typeof progRegistrar === 'function') progRegistrar('export', { archivo: 'curva_traccion.png' });
}
function exportCompareChart(){
  const url = document.getElementById('compareChart').toDataURL('image/png');
  const a = document.createElement('a'); a.href=url; a.download='comparacion_materiales.png'; a.click();
  if (typeof progRegistrar === 'function') progRegistrar('export', { archivo: 'comparacion_materiales.png' });
}
function exportTempChart(){
  const url = document.getElementById('tempChart').toDataURL('image/png');
  const a = document.createElement('a'); a.href=url; a.download='efecto_temperatura.png'; a.click();
  if (typeof progRegistrar === 'function') progRegistrar('export', { archivo: 'efecto_temperatura.png' });
}
function exportCompChart(){
  const url = document.getElementById('compChart').toDataURL('image/png');
  const a = document.createElement('a'); a.href=url; a.download='curva_compresion.png'; a.click();
  if (typeof progRegistrar === 'function') progRegistrar('export', { archivo: 'curva_compresion.png' });
}
function exportCompoundChart(){
  const url = document.getElementById('compoundChart').toDataURL('image/png');
  const a = document.createElement('a'); a.href=url; a.download='material_compuesto.png'; a.click();
  if (typeof progRegistrar === 'function') progRegistrar('export', { archivo: 'material_compuesto.png' });
}

// FIX (integración Unidad 3 — Fase 3): la pestaña "Fractura, fatiga y fluencia"
// tiene 9 gráficos repartidos en 9 subsecciones (rt-sub-panel) -- en vez de
// escribir 9 funciones exportXChart() casi idénticas, una sola función lee el
// canvas que esté dentro de la subsección activa en ese momento (rtSwitch ya
// se encarga de marcar cuál es la .active) y lo exporta con el nombre de
// archivo que le pasa el botón de esa subsección.
function exportRoturaChart(filename){
  const panel = document.querySelector('.rt-sub-panel.active');
  const canvas = panel ? panel.querySelector('canvas') : null;
  if (!canvas) return; // subsección conceptual, sin gráfico que exportar
  const url = canvas.toDataURL('image/png');
  const a = document.createElement('a'); a.href=url; a.download=filename; a.click();
  if (typeof progRegistrar === 'function') progRegistrar('export', { archivo: filename });
}

// FIX (Fase 6b): Dureza (Ensayo no destructivo) tenía el mismo gap que Unidad
// 3 antes de la Fase 3 -- su único gráfico (correlación TS vs HB) no tenía
// forma de exportarse.
function exportTsChart(){
  const url = document.getElementById('dz_tsChart').toDataURL('image/png');
  const a = document.createElement('a'); a.href=url; a.download='correlacion_ts_hb.png'; a.click();
  if (typeof progRegistrar === 'function') progRegistrar('export', { archivo: 'correlacion_ts_hb.png' });
}

// FIX (v4.1): mismo criterio que exportRoturaChart -- la pestaña "Ensayos
// complementarios" va a ir sumando un ensayo (cm-sub-panel) por vez, así que
// una sola función genérica que exporta el canvas del panel activo evita
// escribir una exportXChart() nueva por cada ensayo que se agregue después.
// FIX (v5.5): las escenas de Líquidos penetrantes/Partículas magnéticas se
// dibujan como SVG (no canvas, ver liquidos-particulas.js), así que
// exportDurezaChart (que busca un <canvas>) no les sirve. Función genérica
// chica: serializa el <svg> a imagen y la exporta como PNG -- reutilizable
// para cualquier escena SVG futura del simulador, no solo esta.
function exportSvgComoImagen(svgSelector, filename) {
  const svg = document.querySelector(svgSelector);
  if (!svg) return;
  const svgData = new XMLSerializer().serializeToString(svg);
  const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(svgBlob);
  const img = new Image();
  img.onload = function () {
    const vb = svg.viewBox && svg.viewBox.baseVal;
    const canvas = document.createElement('canvas');
    canvas.width = (vb && vb.width) || svg.clientWidth || 300;
    canvas.height = (vb && vb.height) || svg.clientHeight || 170;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    URL.revokeObjectURL(url);
    const pngUrl = canvas.toDataURL('image/png');
    const a = document.createElement('a'); a.href = pngUrl; a.download = filename; a.click();
    if (typeof progRegistrar === 'function') progRegistrar('export', { archivo: filename });
  };
  img.src = url;
}

// FIX (v5.1): mismo criterio que exportRoturaChart/exportComplementariosChart --
// la pestaña "Ensayo no destructivo" va a ir sumando ensayos del Grupo B
// (Corrientes inducidas, Ultrasonido, Radiografía, Líquidos penetrantes,
// Partículas magnéticas) además de las 8 escalas de dureza que ya tenía, así
// que una función genérica que exporta el canvas del .dz-sub-panel activo
// evita escribir una exportXChart() nueva por cada uno (exportTsChart queda
// como estaba, es anterior y específica de un solo canvas fijo).
function exportDurezaChart(filename){
  const panel = document.querySelector('.dz-sub-panel.active');
  const canvas = panel ? panel.querySelector('canvas') : null;
  if (!canvas) return;
  const url = canvas.toDataURL('image/png');
  const a = document.createElement('a'); a.href=url; a.download=filename; a.click();
  if (typeof progRegistrar === 'function') progRegistrar('export', { archivo: filename });
}

// FIX (QA v5.5 → v5.6, hallazgo Etapa 1): esta función existía desde v4.1
// ("exportComplementariosChart (de v4.x) se reusa tal cual para exportar",
// ver CHANGELOG) pero se había perdido en algún punto posterior sin dejar
// rastro -- los 5 botones "Exportar imagen" de la pestaña "Ensayos
// complementarios" (Desgaste, Tensiones residuales, Corrosión, Polímeros,
// Metalografía) quedaron llamando a una función inexistente
// (ReferenceError en consola, sin efecto visible). Mismo patrón que
// exportDurezaChart de arriba, pero apuntando al panel activo de
// ".cm-sub-panel" en vez de ".dz-sub-panel". Se agregó también el test
// correspondiente en tests.js (typeof === 'function') para que esta
// regresión no vuelva a pasar desapercibida.
function exportComplementariosChart(filename){
  const panel = document.querySelector('.cm-sub-panel.active');
  const canvas = panel ? panel.querySelector('canvas') : null;
  if (!canvas) return;
  const url = canvas.toDataURL('image/png');
  const a = document.createElement('a'); a.href=url; a.download=filename; a.click();
  if (typeof progRegistrar === 'function') progRegistrar('export', { archivo: filename });
}


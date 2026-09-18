// ficha-ndt.js — Infraestructura compartida para las 5 fichas de
// laboratorio del Grupo B (backlog punto D, v5.10): Corrientes inducidas,
// Ultrasonido, Radiografía, Líquidos penetrantes, Partículas magnéticas.
//
// Decisión tomada con la cátedra antes de empezar este punto: UNA ficha por
// ensayo (no un resumen combinado de los 5) -- ver CHANGELOG v5.10. Cada
// módulo tiene su propia función showFichaXxx() que arma la configuración
// (título, secciones, imagen) y se la pasa a fichaNDTRender(), que reutiliza
// el MISMO modal/#fichaBody/printFicha()/closeFicha() que ya usan la ficha
// de Tracción (traccion.js) y la Ficha técnica de material (ficha.js) -- no
// se crea ningún modal nuevo.
//
// Los 5 ensayos dibujan de 3 formas distintas (Chart.js en Corrientes
// inducidas, canvas 2D dibujado a mano en Ultrasonido/Radiografía, SVG
// inline en Líquidos/Partículas), así que hay 2 helpers de captura de
// imagen en vez de intentar unificarlos en uno solo.

// Arma el HTML de #fichaBody a partir de una config genérica y abre el modal.
// config = { titulo, badgeTexto?, badgeClase?, secciones: [{titulo, filas:[[clave,valor],...]}],
//            imagenHtml?, imagenTitulo?, notaFinal? }
function fichaNDTRender(config) {
  const now = new Date().toLocaleString('es-AR');
  const secHtml = config.secciones.map(sec => `
    <div class="ficha-sec">
      <h3>${sec.titulo}</h3>
      ${sec.filas.map(([k, v]) => `<div class="ficha-row"><span class="fk">${k}</span><span class="fv">${v}</span></div>`).join('')}
    </div>`).join('');

  const imgSec = config.imagenHtml ? `
    <div class="ficha-sec ficha-full">
      <h3>${config.imagenTitulo || 'Imagen del ensayo'}</h3>
      <div class="ficha-mini">${config.imagenHtml}</div>
    </div>` : '';

  document.getElementById('fichaBody').innerHTML = `
  <div class="ficha-header">
    <div>
      <div class="ficha-title">${config.titulo}</div>
    <div class="ficha-meta">Fecha: ${now} — Simulador de Ensayos Mecánicos v${SIM_VERSION}</div>
    </div>
    ${config.badgeTexto ? `<div style="text-align:right"><div class="ficha-badge ${config.badgeClase || ''}">${config.badgeTexto}</div></div>` : ''}
  </div>
  <div class="ficha">
    ${secHtml}
    ${imgSec}
  </div>
  ${config.notaFinal ? `<div class="note" style="margin-top:10px">${config.notaFinal}</div>` : ''}
  <div class="no-print" style="margin-top:12px;display:flex;gap:10px;flex-wrap:wrap">
    <button class="btn-primary" style="width:auto;padding:8px 20px" onclick="printFicha()">⬇ Imprimir / Guardar PDF</button>
    <button class="btn-secondary" style="width:auto;padding:8px 20px" onclick="closeFicha()">Cerrar</button>
  </div>`;

  document.getElementById('fichaModal').style.display = 'flex';
}

// Captura la imagen de un <canvas> (Chart.js o dibujado a mano) como PNG.
// Devuelve '' si el canvas no existe o el navegador bloquea toDataURL (no
// debería pasar acá, todo el contenido es generado localmente, sin imágenes
// externas que puedan "taintear" el canvas).
function fichaImgDesdeCanvas(canvasId) {
  const c = document.getElementById(canvasId);
  if (!c) return '';
  try {
    return `<img src="${c.toDataURL('image/png')}" style="max-width:100%;max-height:100%;display:block;margin:0 auto">`;
  } catch (e) {
    return '';
  }
}

// El contenido de los escenarios de Líquidos/Partículas YA es un <svg>
// completo (ver pnSvgEscena/mtSvgEscena en liquidos-particulas.js) con
// style="width:100%;height:100%" propio -- alcanza con clonar el innerHTML
// tal cual, no hace falta convertirlo a imagen rasterizada.
function fichaImgDesdeSvg(containerId) {
  const el = document.getElementById(containerId);
  return (el && el.innerHTML) ? el.innerHTML : '';
}

// Agrega la unidad SOLO si el texto es un número (las mcard de métrica
// muestran '?' en modo desafío sin revelar, o '—' si no hay dato -- ahí no
// corresponde pegarle una unidad al costado).
function fichaConUnidad(texto, unidad) {
  return /^-?[\d.,]+$/.test((texto || '').trim()) ? `${texto} ${unidad}` : (texto || '—');
}

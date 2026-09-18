// Service worker de Sim_MatyEns (Simulador de Ensayos Mecánicos).
//
// IMPORTANTE PARA AGUS: subí SW_CACHE_VERSION en CADA release donde cambien
// archivos de assets/ o index.html. Si no lo subís, los alumnos que ya
// instalaron la PWA van a seguir viendo la versión vieja cacheada, aunque
// GitHub Pages ya tenga la nueva (el navegador solo revisa este archivo
// sw.js byte a byte; si sw.js no cambia, no se entera de nada más).
//
// FIX v4.10: 18 materiales nuevos (metales, cerámicos técnicos, compuestos,
// polímeros) agregados a PRESETS + selects de Tracción/Compresión/Dureza/
// Comparar/Compuesto. Ver v4.9 para el resto.
//
// FIX v4.11 (revisión QA por partes): SRI en el script de Chart.js del CDN
// (index.html + este archivo) + ayuda contextual faltante en 8 subsecciones
// de Dureza + nota de %EL aclarada en la ficha de Tracción + sy de Magnesio
// AZ31 corregido (97→150 MPa, era el valor de compresión) + tests dz_brinell_
// ref_table / dz_rockwell_ref_table / presets_v4_10 agregados a tests.js.
// FIX v5.0 (esqueleto Grupo B): 5 subsecciones placeholder nuevas en index.html
// (Corrientes inducidas, Ultrasonido, Radiografía, Líquidos penetrantes,
// Partículas magnéticas, Metalografía) -- sin ensayos reales todavía, así que
// no hace falta agregar/quitar nada de PRECACHE_URLS (ningún .js nuevo).
// FIX v5.1: primer ensayo real del Grupo B (Corrientes inducidas / eddy
// current) -- nuevo assets/corrientes-inducidas.js agregado a PRECACHE_URLS.
// FIX v5.2: 2do ensayo real del Grupo B (Ultrasonido / pulso-eco) -- nuevo
// assets/ultrasonido.js agregado a PRECACHE_URLS.
// FIX v5.3: 3er ensayo real del Grupo B (Metalografía) -- nuevo
// assets/metalografia.js agregado a PRECACHE_URLS.
// FIX v5.4: 4to ensayo real del Grupo B (Radiografía / Beer-Lambert, Ir-192)
// -- nuevo assets/radiografia.js agregado a PRECACHE_URLS.
// FIX v5.5: 5to y último ensayo real del Grupo B (Líquidos penetrantes +
// Partículas magnéticas, máquina de estados) -- nuevo
// assets/liquidos-particulas.js agregado a PRECACHE_URLS.
// FIX v5.6 (ciclo de QA, 13 etapas): 3 bugs reales corregidos en export.js,
// traccion.js y material-sync.js (ver CHANGELOG.txt) -- ningún archivo nuevo
// ni renombrado, así que PRECACHE_URLS no cambia, pero el contenido de esos
// 3 archivos sí, y tests.js sumó 5 tests nuevos -- hace falta subir la
// versión igual para que los alumnos que ya instalaron la PWA reciban los
// archivos corregidos en vez de seguir viendo la copia vieja cacheada.
// FIX v5.7 (backlog punto A): 14ta sub-sección en "Ensayo no destructivo",
// tabla comparativa estática de los 5 ensayos del Grupo B -- solo cambia
// index.html (nueva sección dz_panel_comparativa + dz_ctrl_comparativa +
// botón de subnav), ningún .js nuevo, así que PRECACHE_URLS no cambia.
// FIX v5.8 (backlog punto B): "Modo desafío" en Ultrasonido y Radiografía
// -- nuevo assets/modo-desafio.js agregado a PRECACHE_URLS (infra
// compartida de generación de defecto oculto con semilla determinística).
// FIX v5.9 (backlog punto C): opción "Otro (ingresar manualmente)" en el
// selector de material de Corrientes inducidas/Ultrasonido/Radiografía --
// solo cambia index.html, help-data.js, corrientes-inducidas.js,
// ultrasonido.js, radiografia.js y material-sync.js, ningún .js nuevo, así
// que PRECACHE_URLS no cambia.
// FIX v5.10 (backlog punto D): ficha/informe de laboratorio imprimible por
// ensayo del Grupo B (una por ensayo, no un resumen combinado -- decisión
// tomada con la cátedra antes de empezar este punto). Nuevo
// assets/ficha-ndt.js agregado a PRECACHE_URLS (infraestructura compartida
// de renderizado de ficha, reutilizada por los 5 módulos).
// FIX v5.11 (backlog punto E): auditoría de daltonismo -- 3 gráficos
// (Temperatura, Material compuesto, Comparar materiales) tenían curvas
// distinguibles SOLO por color (con la leyenda de Chart.js apagada); se les
// agregó un patrón de trazo distinto por curva y el nombre de la curva en
// el tooltip. Solo cambian .js existentes, ningún archivo nuevo, así que
// PRECACHE_URLS no cambia.
// FIX v5.12 (backlog punto F): "Compartir enlace" -- captura la sub-sección
// activa (cualquiera de las ~40 que tiene el simulador) y arma un link con
// sus valores actuales en la query string; al abrirlo, reconstruye ese
// mismo escenario. Vive en progreso.js (ya cargado, ver PRECACHE_URLS más
// abajo), sin archivo nuevo.
// FIX v5.14: reorganización de navegación (4 pestañas -> 5, agrupadas por
// taxonomía de la cátedra en vez de por orden de desarrollo). Solo cambian
// index.html/styles.css/app.js/progreso.js/configs.js/material-sync.js/
// ficha.js/tests.js -- ningún archivo nuevo, así que PRECACHE_URLS no
// cambia. Igual hay que subir la versión para que quien ya tenga la PWA
// instalada reciba la navegación nueva en vez de seguir viendo la vieja.
// FIX #42 (hallazgo Etapa 9 QA v6.5): assets/rrmoore.js (agregado en v6.1)
// nunca se sumó a PRECACHE_URLS -- hueco alfabético entre rotura-shared.js
// y temperatura.js. Con la estrategia "caché primero" de abajo, si el
// archivo no estaba precacheado y el alumno usaba la PWA sin conexión, el
// <script> fallaba (Response.error()) y R.R. Moore quedaba roto offline
// mientras el resto del simulador seguía funcionando. Agregado a la lista.
// FIX #49 (hallazgo QA v6.9, Etapa 5): mismo bug que FIX #42, esta vez en
// los 4 archivos de las escenas interactivas de aparato agregadas en
// v6.8/v6.9 (charpy-pendulo.js, indentador-brinell.js,
// indentador-rockwell.js, indentador-micro.js) -- se sumaron los <script
// src> a index.html pero no a PRECACHE_URLS. Mismo síntoma offline: el
// resto del simulador seguía andando, pero las 4 escenas nuevas no
// cargaban. Se agrega también un test estructural en tests.js
// (precache_completo) que compara todos los <script src="assets/..."> de
// index.html contra PRECACHE_URLS, para que esta clase de bug no se
// repita una tercera vez sin que el test suite lo detecte solo.
// FIX #56 (QA exhaustivo v6.13, etapa 1): tercera recurrencia del mismo
// bug (ver párrafo anterior) -- escena-tensiones-residuales.js (v6.12) y
// escena-ultrasonido.js (v6.13) se habían sumado a index.html pero no acá.
// Se agregan las 2 entradas que faltaban. El test precache_completo que
// el párrafo de arriba dice haber agregado en FIX #49 para prevenir
// justo esto NO estaba en tests.js -- ver FIX #57, que lo agrega de
// verdad esta vez.
// v6.15: nuevo assets/escena-metalografia.js agregado a PRECACHE_URLS
// (sexta escena animada del backlog -- preparación metalográfica:
// desbaste/pulido -> ataque químico -> observación).
// v6.16: nuevo assets/escena-corrosion.js agregado a PRECACHE_URLS
// (septima escena animada del backlog -- envejecimiento visual de la
// probeta: oscurecimiento real por perdida de espesor + picaduras
// ilustrativas, ver comentario en el propio archivo).
// v6.18: nuevo assets/escena-desgaste.js agregado a PRECACHE_URLS
// (octava escena animada del backlog -- ranura de desgaste que se
// profundiza + pin deslizante en vaivén, ver comentario en el propio
// archivo sobre la conversión volumen->profundidad, que es una
// simplificación geometrica, no parte de la ley de Archard en si).
// v6.19: nuevo assets/escena-fluencia.js agregado a PRECACHE_URLS (novena
// escena animada del backlog -- probeta en el horno que se alarga hasta
// la rotura, tiempo comprimido).
// v6.20: nuevo assets/escena-fatiga.js agregado a PRECACHE_URLS (decima y
// ultima escena animada del backlog original de 7 -- grieta creciendo con
// los ciclos hasta la rotura, con integracion real de la ley de Paris
// a(N), Opcion A discutida con Giamma antes de implementar).
const SW_CACHE_VERSION = 'v6.22';
const CACHE_NAME = `sim-matyens-${SW_CACHE_VERSION}`;

// Archivos propios del simulador (mismo origen que GitHub Pages).
// Si agregás un .js o .css nuevo a assets/, sumalo acá también.
const PRECACHE_URLS = [
  './',
  './index.html',
  './manifest.json',
  './assets/styles.css',
  './assets/app.js',
  './assets/charpy-pendulo.js',
  './assets/comparar.js',
  './assets/compresion.js',
  './assets/compuesto.js',
  './assets/configs.js',
  './assets/corrientes-inducidas.js',
  './assets/corrosion.js',
  './assets/data-presets.js',
  './assets/desgaste.js',
  './assets/dureza-brinell.js',
  './assets/dureza-esclerometro.js',
  './assets/dureza-init.js',
  './assets/dureza-janka.js',
  './assets/dureza-mohs.js',
  './assets/dureza-rockwell.js',
  './assets/dureza-shared.js',
  './assets/dureza-vickers.js',
  './assets/escena-corrosion.js',
  './assets/escena-desgaste.js',
  './assets/escena-fatiga.js',
  './assets/escena-fluencia.js',
  './assets/escena-metalografia.js',
  './assets/escena-tensiones-residuales.js',
  './assets/escena-ultrasonido.js',
  './assets/export.js',
  './assets/fatiga.js',
  './assets/ficha.js',
  './assets/ficha-ndt.js',
  './assets/fluencia.js',
  './assets/fractura.js',
  './assets/help-data.js',
  './assets/indentador-brinell.js',
  './assets/indentador-micro.js',
  './assets/indentador-rockwell.js',
  './assets/liquidos-particulas.js',
  './assets/material-sync.js',
  './assets/metalografia.js',
  './assets/modo-desafio.js',
  './assets/polimeros.js',
  './assets/progreso.js',
  './assets/radiografia.js',
  './assets/rotura-shared.js',
  './assets/rrmoore.js',
  './assets/temperatura.js',
  './assets/tensiones-residuales.js',
  './assets/tests.js',
  './assets/traccion.js',
  './assets/ultrasonido.js',
  './assets/icons/icon-16.png',
  './assets/icons/icon-32.png',
  './assets/icons/icon-48.png',
  './assets/icons/icon-72.png',
  './assets/icons/icon-96.png',
  './assets/icons/icon-128.png',
  './assets/icons/icon-144.png',
  './assets/icons/icon-152.png',
  './assets/icons/icon-180.png',
  './assets/icons/icon-192.png',
  './assets/icons/icon-256.png',
  './assets/icons/icon-384.png',
  './assets/icons/icon-512.png',
  './assets/icons/icon-maskable-192.png',
  './assets/icons/icon-maskable-512.png'
];

// Chart.js viene de un CDN externo (cdnjs). Se cachea aparte porque es
// cross-origin: si cdnjs no responde, el precache de arriba no debe fallar
// por su culpa.
// FIX (QA — hallazgo Parte 1): antes se pedía en modo 'no-cors', que da una
// respuesta opaca -- el navegador NO puede verificar su contenido, así que
// ni siquiera vale la pena pedirle a fetch() que valide un hash ahí. Ahora se
// pide en modo 'cors' con el mismo hash SRI que ya tiene el <script> de
// index.html: cdnjs sirve con headers CORS habilitados (por eso el <script>
// puede usar crossorigin="anonymous"+integrity), así que esto no le pide
// nada al CDN que no pudiera hacer ya. Si el hash no coincide (CDN comprometido,
// o el día de mañana alguien sube la versión sin actualizar el hash), el fetch
// de esta línea directamente falla y cae al catch -- Chart.js quedaría sin
// precachear, pero nunca se sirve una copia adulterada desde la caché.
const CDN_URL = 'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.js';
const CDN_SRI = 'sha512-ZwR1/gSZM3ai6vCdI+LVF1zSq/5HznD3ZSTk7kajkaj4D292NLuduDCO1c/NT8Id+jE58KYLKT7hXnbtryGmMg==';

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await cache.addAll(PRECACHE_URLS);
    try {
      const res = await fetch(CDN_URL, { mode: 'cors', integrity: CDN_SRI });
      // FIX #89 (hallazgo QA v6.22, Etapa 37): ninguno de los 3 lugares de
      // este archivo donde se hace cache.put() chequeaba res.ok antes de
      // guardar la respuesta -- fetch() no rechaza su promesa ante un HTTP
      // 404/500 (solo ante fallos de red), así que una respuesta de error
      // transitoria (ej. propagación de GitHub Pages a mitad de un deploy)
      // quedaría guardada en caché con la estrategia "caché primero", y se
      // seguiría sirviendo ese error hasta el próximo cambio de
      // SW_CACHE_VERSION. Se agrega el chequeo en los 3 lugares.
      if (res.ok) await cache.put(CDN_URL, res);
    } catch (e) {
      // Sin conexión, o el hash no coincide (CDN comprometido/desactualizado):
      // no se cachea nada acá antes que cachear una copia sin verificar.
      // Si hay conexión más adelante, el runtime fetch de abajo reintenta.
    }
    self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(
      names
        .filter((n) => n.startsWith('sim-matyens-') && n !== CACHE_NAME)
        .map((n) => caches.delete(n))
    );
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  const isSameOrigin = url.origin === self.location.origin;
  const isCdnChart = req.url === CDN_URL;

  if (!isSameOrigin && !isCdnChart) return; // deja pasar cualquier otro pedido externo tal cual

  if (req.mode === 'navigate') {
    // HTML: red primero (para que Agus/los alumnos vean cambios apenas hay
    // internet), y si no hay conexión, cae al index.html cacheado.
    event.respondWith((async () => {
      try {
        const fresh = await fetch(req);
        const cache = await caches.open(CACHE_NAME);
        if (fresh.ok) cache.put(req, fresh.clone()); // FIX #89
        return fresh;
      } catch (e) {
        const cache = await caches.open(CACHE_NAME);
        return (await cache.match('./index.html')) || (await cache.match(req));
      }
    })());
    return;
  }

  // CSS/JS/íconos/manifest y Chart.js del CDN: caché primero (arranca
  // rápido y funciona offline), y de yapa actualiza la caché en segundo
  // plano para la próxima carga.
  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(req);
    // FIX (QA — hallazgo Parte 1): mismo criterio que el precache de arriba --
    // Chart.js se pide con 'cors' + integrity (verificable) en vez de
    // 'no-cors' (opaco, sin forma de confirmar que el contenido es el
    // esperado). Si el hash no coincide, el fetch falla y se sigue sirviendo
    // la copia ya cacheada (si existe) en vez de una versión sin verificar.
    const network = fetch(req, isCdnChart ? { mode: 'cors', integrity: CDN_SRI } : undefined)
      .then((res) => {
        if (res.ok) cache.put(req, res.clone()); // FIX #89
        return res;
      })
      .catch(() => undefined);
    return cached || (await network) || Response.error();
  })());
});

// dureza-esclerometro.js — esclerómetro (martillo de rebote, hormigón)

const SCLERO_ORIENT_CORRECTION = {
  horizontal: 0,
  abajo90: 3,
  abajo45: 1.5,
  arriba45: -1.5,
  arriba90: -3,
};
const SCLERO_ORIENT_LABEL = {
  horizontal: 'Horizontal',
  abajo90: 'Vert. abajo',
  abajo45: '45° abajo',
  arriba45: '45° arriba',
  arriba90: 'Vert. arriba',
};
// FIX #66 (hallazgo QA v6.20, Etapa 2): la línea/flecha SIN rotar (ver más
// abajo, línea de (130,20) a (130,65) con la punta del triángulo apuntando
// hacia abajo) ya es VERTICAL por sí sola -- representa el martillo apuntando
// derecho hacia abajo, contra una superficie horizontal desde arriba (mismo
// caso que "abajo90"/"Vert. abajo"). El mapeo anterior le asignaba 0° a
// "horizontal" en cambio, así que con esa orientación se veía una flecha
// VERTICAL (contradiciendo la etiqueta), y con "arriba90" (rotación -90°
// sobre esa base ya vertical) se obtenía una flecha HORIZONTAL -- exactamente
// al revés de lo que decía el texto al lado. Se renumera el mapeo tomando la
// base sin rotar (0°) como "abajo90" y girando en el sentido físico correcto
// -90°→0°→45°→90°→135°→180° = abajo90→abajo45→horizontal→arriba45→arriba90,
// de abajo hacia arriba.
const SCLERO_ORIENT_ANGLE = { abajo90:0, abajo45:45, horizontal:90, arriba45:135, arriba90:180 };
const SCLERO_TABLE = [
  {r:10,fc:4},{r:15,fc:8},{r:20,fc:13},{r:25,fc:18},{r:30,fc:25},
  {r:35,fc:32},{r:40,fc:40},{r:45,fc:48},{r:50,fc:56},{r:55,fc:63},{r:60,fc:70}
];
const SCLERO_REF = { hormigon: {fc:25, r:30, orient:'horizontal'} };
function dzScleroInterp(r){
  const arr = SCLERO_TABLE;
  if(r<=arr[0].r) return arr[0].fc;
  if(r>=arr[arr.length-1].r) return arr[arr.length-1].fc;
  for(let i=0;i<arr.length-1;i++){
    if(r>=arr[i].r && r<=arr[i+1].r){
      const t=(r-arr[i].r)/(arr[i+1].r-arr[i].r);
      return arr[i].fc + t*(arr[i+1].fc-arr[i].fc);
    }
  }
}
function dzApplyScleroMaterial(){
  const key = document.getElementById('dz_scMat').value;
  const ref = SCLERO_REF[key];
  if(!ref){ dzUpdateSclero(); return; }
  document.getElementById('dz_scOrient').value = ref.orient;
  document.getElementById('dz_scR').value = ref.r;
  dzUpdateSclero();
}
function dzUpdateSclero(){
  const R = parseFloat(document.getElementById('dz_scR').value);
  document.getElementById('dz_scRVal').textContent = R;
  const orient = document.getElementById('dz_scOrient').value;
  const corr = SCLERO_ORIENT_CORRECTION[orient];
  const Rcorr = Math.max(10, Math.min(60, R+corr));
  const fc = dzScleroInterp(Rcorr);
  document.getElementById('dz_scRRaw').textContent = R;
  document.getElementById('dz_scRCorr').textContent = Rcorr.toFixed(1).replace('.',',');
  document.getElementById('dz_scFc').textContent = fc.toFixed(1).replace('.',',')+' MPa';

  const matKey = document.getElementById('dz_scMat').value;
  const ref = SCLERO_REF[matKey];
  const cmpEl = document.getElementById('dz_scMatCompare');
  if(!ref){
    cmpEl.style.display='none';
  } else {
    const diffPct = ((fc-ref.fc)/ref.fc*100);
    const cerca = Math.abs(diffPct)<15;
    cmpEl.style.display='block';
    cmpEl.innerHTML = `<strong>Referencia bibliográfica para este hormigón: ≈${ref.fc} MPa</strong> (valor de diseño típico, curva aproximada). `
      + (cerca ? `Tu estimación dio un valor cercano.`
               : `Tu estimación dio un valor ${diffPct>0?'más alto':'más bajo'} (${Math.abs(diffPct).toFixed(0).replace('.',',')}% de diferencia) -- normal si cambiaste R o la orientación respecto del ensayo guiado.`);
  }
  dzDrawScleroSvg(orient, R, Rcorr);
}
function dzDrawScleroSvg(orient, R, Rcorr){
  const svg = document.getElementById('dz_scSvg');
  if(!svg) return;
  const ang = SCLERO_ORIENT_ANGLE[orient]||0;
  const label = SCLERO_ORIENT_LABEL[orient]||'';
  const barX=70, barW=170;
  const wRaw = Math.max(0, barW*(R-10)/50);
  const wCorr = Math.max(0, Math.min(barW, barW*(Rcorr-10)/50));
  svg.innerHTML = `
    <rect x="90" y="20" width="80" height="90" fill="#9a9a9a" stroke="var(--border)"/>
    <text x="130" y="15" text-anchor="middle" fill="var(--muted)" font-size="10">HORMIGÓN</text>
    <g transform="rotate(${ang} 130 65)">
      <line x1="130" y1="20" x2="130" y2="65" stroke="var(--accent)" stroke-width="4"/>
      <polygon points="122,58 138,58 130,72" fill="var(--accent)"/>
    </g>
    <text x="195" y="68" font-size="9" fill="var(--muted)">${label}</text>
    <text x="20" y="134" font-size="10" fill="var(--text)">R crudo</text>
    <rect x="${barX}" y="126" width="${barW}" height="10" fill="none" stroke="var(--border)"/>
    <rect x="${barX}" y="126" width="${wRaw}" height="10" fill="var(--muted)"/>
    <text x="20" y="154" font-size="10" fill="var(--text)">R corr.</text>
    <rect x="${barX}" y="146" width="${barW}" height="10" fill="none" stroke="var(--border)"/>
    <rect x="${barX}" y="146" width="${wCorr}" height="10" fill="var(--accent)"/>
  `;
}

/* ---------------- INIT ---------------- */

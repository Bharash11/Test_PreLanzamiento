// dureza-brinell.js — escala Brinell

// FIX (Fase 6a): hb ahora sale de PRESETS[x].dureza.hb (misma fuente que
// Rockwell/Vickers) en vez de estar hardcodeado acá también; p y d son la
// carga y diagonal de ESTE ensayo puntual para reproducir ese HB, así que
// quedan acá. BRINELL_REF se arma combinando ambas fuentes, mismo shape
// {hb,p,d} que tenía antes -- nada que lo consume necesita cambiar.
const BRINELL_PD = {
  acero:{p:3000,d:5.20}, aceroinox:{p:3000,d:4.90}, fragil:{p:3000,d:4.25},
  aluminio:{p:500,d:2.55}, cobre:{p:500,d:3.70}, titanio:{p:3000,d:3.35},
  niquel:{p:1000,d:4.15}, molibdeno:{p:3000,d:4.75}, magnesio:{p:500,d:3.50},
  zinc:{p:500,d:4.15}, tungsteno:{p:3000,d:3.85}, laton:{p:500,d:3.35},
  plata:{p:500,d:4.90}, oro:{p:500,d:4.90},
  // FIX (v4.10): mismos criterios de P que ya usaba esta tabla -- ferrosos/
  // duros con P=3000 (aisi1045, acero4140, hierronodular, titaniocp2, igual
  // que acero/titanio/molibdeno), no ferrosos blandos con P=500 (aluminio7075,
  // aluminio2024, broncefosforico, igual que aluminio/cobre/laton). d se
  // despejó de la fórmula HB=2P/[πD(D−√(D²−d²))] para reproducir el HB de
  // PRESETS[x].dureza.hb con esa carga. Inconel 718 queda afuera: no se
  // encontró un HB confiable para esa condición (solo HRC, ver Rockwell).
  // FIX #63 (hallazgo QA v6.16, D11-01): aluminio7075, aluminio2024 y
  // broncefosforico quedaron con P=500 y una huella tan chica (d/D=0.20-0.23)
  // que caía por debajo del rango válido que esta misma escena exige (0.24 a
  // 0.60) -- el propio ejemplo guiado disparaba la advertencia de "huella
  // poco confiable" apenas se elegía el material. Se subió P a 1000 (misma
  // carga ya usada para níquel, otro no ferroso de dureza media/alta) y se
  // recalculó d con el mismo método, dando d/D=0.29-0.32 (bien adentro del
  // rango) sin perder precisión en el HB reproducido (error <0.3%, dentro
  // del margen de <2% que ya exige dz_brinell_ref_table).
  aisi1045:{p:3000,d:4.49}, acero4140:{p:3000,d:3.46},
  aluminio7075:{p:1000,d:2.88}, aluminio2024:{p:1000,d:3.21},
  broncefosforico:{p:1000,d:2.88}, hierronodular:{p:3000,d:4.67},
  titaniocp2:{p:3000,d:4.74},
};
const BRINELL_REF = {};
for (const [key, pd] of Object.entries(BRINELL_PD)) {
  const hb = PRESETS[key]?.dureza?.hb;
  if (hb !== undefined) BRINELL_REF[key] = { hb, p:pd.p, d:pd.d };
}
function dzApplyBrinellMaterial(){
  const key = document.getElementById('dz_brMat').value;
  const ref = BRINELL_REF[key];
  if(!ref) { dzUpdateBrinell(); return; }
  document.getElementById('dz_brP').value = ref.p;
  document.getElementById('dz_brD').value = ref.d;
  dzUpdateBrinell();
}
function dzUpdateBrinell(){
  const D = 10;
  const P = parseFloat(document.getElementById('dz_brP').value);
  const d = parseFloat(document.getElementById('dz_brD').value);
  document.getElementById('dz_brDVal').textContent = d.toFixed(2).replace('.',',');
  const warnEl = document.getElementById('dz_brWarn');
  const resultEl = document.getElementById('dz_brResult');
  const subEl = document.getElementById('dz_brSub');
  const cmpEl = document.getElementById('dz_brMatCompare');
  const matKey = document.getElementById('dz_brMat').value;
  const ref = BRINELL_REF[matKey];
  // FIX #47 (hallazgo Etapa 3 QA v6.5, mismo criterio que FIX #30 en Janka):
  // el guard "d>=D" de acá abajo era inalcanzable con el slider actual
  // (dz_brD tiene max="6.5" en index.html, mientras D=10mm es fijo), así que
  // se sacó. Si algún día se sube el máximo del slider por encima de D=10,
  // conviene reponer un blindaje equivalente.
  const HB = (2*P) / (Math.PI*D*(D - Math.sqrt(D*D - d*d)));
  resultEl.textContent = HB.toFixed(1).replace('.',',') + ' HB';
  subEl.textContent = `HB = 2×${P} / [π×10×(10−√(100−${(d*d).toFixed(2).replace('.',',')}))] = ${HB.toFixed(1).replace('.',',')}`;
  if(ref){
    const diffPct = ((HB-ref.hb)/ref.hb*100);
    const cerca = Math.abs(diffPct) < 15;
    cmpEl.style.display='block';
    cmpEl.innerHTML = `<strong>Referencia bibliográfica para este material: ≈${ref.hb} HB</strong> (valor típico de tabla, no una medición exacta). `
      + (cerca
        ? `Tu ensayo dio un valor cercano.`
        : `Tu ensayo dio un valor ${diffPct>0?'más alto':'más bajo'} (${Math.abs(diffPct).toFixed(0).replace('.',',')}% de diferencia) -- normal si cambiaste P o d respecto del ensayo guiado.`);
  } else if(cmpEl) {
    cmpEl.style.display='none';
  }
  const ratio = d/D;
  if(ratio < 0.24 || ratio > 0.6){
    warnEl.style.display='block';
    warnEl.textContent = 'La huella medida es muy pequeña o muy grande para una lectura confiable (se recomienda d entre 0,24D y 0,60D aprox.). Ajustá la carga o revisá la medición.';
  } else {
    warnEl.style.display='none';
  }
  // FIX (v6.8): dibujo del corte + huella unificado en una sola función,
  // dzDrawBrinellEscena() (vive en indentador-brinell.js, cargado después
  // de este archivo -- segura de referenciar acá por el mismo motivo ya
  // documentado entre fractura.js y charpy-pendulo.js: recién se EJECUTA
  // cuando el usuario interactúa o desde dzInit(), momento en el que ambos
  // scripts ya terminaron de cargar). En reposo (fuera de una animación de
  // "Ensayar") se dibuja directamente en el estado final, sin pasar por los
  // fotogramas intermedios.
  const tPrevEl = document.getElementById('dz_brTPrev');
  const tCalc = dzBrProfundidad(d);
  if(tPrevEl) tPrevEl.textContent = tCalc.toFixed(3).replace('.',',');
  dzDrawBrinellEscena(0, 1, d, tCalc);
}


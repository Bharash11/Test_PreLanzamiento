// dureza-mohs.js — escala de Mohs (dureza por rayado)

function dzBuildMohs(){
  const tbody = document.querySelector('#dz_mohsTable tbody');
  const selA = document.getElementById('dz_mohsA'), selB = document.getElementById('dz_mohsB');
  tbody.innerHTML=''; selA.innerHTML=''; selB.innerHTML='';
  DZ_MOHS.forEach(([h,m])=>{
    tbody.innerHTML += `<tr><td class="mono">${h}</td><td>${m}</td></tr>`;
    selA.innerHTML += `<option value="${h}">${m} (${h})</option>`;
    selB.innerHTML += `<option value="${h}">${m} (${h})</option>`;
  });
  selA.value = 10; selB.value = 2;
}
// FIX #22: comparación extraída como función pura para poder testearla de
// verdad desde el panel de auto-tests (antes el test solo verificaba que
// 10>1, sin ejercitar esta función ni el caso de empate).
function dzMohsCompare(a, b){
  if (a > b) return 'raya';
  if (a === b) return 'empate';
  return 'no_raya';
}
function dzMohsTest(){
  const a = parseInt(document.getElementById('dz_mohsA').value);
  const b = parseInt(document.getElementById('dz_mohsB').value);
  const nameA = DZ_MOHS.find(x=>x[0]==a)[1], nameB = DZ_MOHS.find(x=>x[0]==b)[1];
  const svg = document.getElementById('dz_scratchSvg');
  const canScratch = dzMohsCompare(a,b)==='raya';
  let scratchLine = '';
  if(canScratch){
    scratchLine = `<line x1="40" y1="55" x2="230" y2="45" stroke="var(--frac)" stroke-width="2" stroke-dasharray="4 3"/>`;
  }
  svg.innerHTML = `
    <rect x="30" y="20" width="240" height="50" rx="4" fill="var(--surface3,#e2e0d8)"/>
    <text x="150" y="49" text-anchor="middle" fill="var(--text)" font-size="12">${nameB} (superficie, dureza ${b})</text>
    ${scratchLine}
    <circle cx="${canScratch?230:60}" cy="45" r="6" fill="var(--neck)"/>
    <text x="150" y="14" text-anchor="middle" fill="var(--muted)" font-size="10">${nameA} (dureza ${a}) se desliza →</text>
  `;
  const resultDiv = document.getElementById('dz_mohsResult');
  if(canScratch){
    resultDiv.style.borderLeftColor = 'var(--plastic)';
    resultDiv.innerHTML = `<strong style="color:var(--plastic)">Sí, raya.</strong> ${nameA} (${a}) es más duro que ${nameB} (${b}) → deja marca visible.`;
  } else if(a===b){
    resultDiv.style.borderLeftColor = 'var(--neck)';
    resultDiv.innerHTML = `<strong style="color:var(--neck)">Dureza igual.</strong> Ambos minerales tienen dureza ${a}: en el límite, el rayado no es claro.`;
  } else {
    resultDiv.style.borderLeftColor = 'var(--frac)';
    resultDiv.innerHTML = `<strong style="color:var(--frac)">No raya.</strong> ${nameA} (${a}) es más blando que ${nameB} (${b}) → no logra rayarlo.`;
  }
}


// tests.js — testSuite + runAllTests. NO se carga en el arranque: se inyecta on-demand

// FIX (v6.4): helper SOLO para tests -- pone el contrapeso de R.R. Moore
// en un σ_a EXACTO sin pasar por el DOM del input. Despeja el PESO (no la
// distancia) para el brazo a su extensión máxima -- así nunca choca con
// el clamp de RR_BRAZO_M, sea cual sea el σ_a pedido (si en cambio se
// fijara un peso arbitrario y se despejara la distancia, valores de σ_a
// grandes exigirían una distancia mayor a la del brazo dibujado y el
// resultado quedaría clampeado por debajo de lo pedido).
function rrTestFijarSigmaA(sigmaMPa) {
  const M = (sigmaMPa * 1e6) * RR_I_M4 / RR_C_M;
  rrPlatos = [M / (RR_G * RR_BRAZO_M)];
  rrDistanciaM = RR_BRAZO_M;
}

const testSuite = [
  // ---- GENERAR CURVA ----
  {
    id: 'curve_acero', group: 'Motor de curvas',
    name: 'genCurve — Acero A36',
    run: () => {
      const pts = genCurve(207, 250, 450, 20, false);
      if (!pts || !pts.length) return { ok: false, msg: 'No se generaron puntos' };
      const frac = pts.filter(p => p.phase === 'fracture');
      const el   = pts.filter(p => p.phase === 'elastic');
      if (!frac.length) return { ok: false, msg: 'Sin punto de fractura' };
      if (!el.length)   return { ok: false, msg: 'Sin zona elástica' };
      const maxSig = Math.max(...pts.map(p => p.y));
      if (Math.abs(maxSig - 450) > 20) return { ok: false, msg: `TS esperado ~450, obtenido ${maxSig.toFixed(1)}` };
      return { ok: true, msg: `${pts.length} pts, TS=${maxSig.toFixed(1)} MPa ✓` };
    }
  },
  {
    id: 'curve_fragil', group: 'Motor de curvas',
    name: 'genCurve — Hierro fundido (frágil)',
    run: () => {
      const pts = genCurve(170, 0, 200, 0.6, false);
      const pl = pts.filter(p => p.phase === 'plastic');
      if (pl.length > 0) return { ok: false, msg: `Frágil no debería tener zona plástica (${pl.length} pts)` };
      return { ok: true, msg: `Sin zona plástica ✓ (${pts.length} pts)` };
    }
  },
  {
    // FIX #63 (hallazgo QA v6.16, C6-01): genCurve() no se blindaba a sí
    // misma contra el_pct<=0 -- el blindaje vivía DUPLICADO en los 5
    // lugares que la llaman (traccion.js x2, comparar.js, compuesto.js x2),
    // nunca adentro de la función pura. Llamándola directo con el_pct=0 la
    // curva colapsaba entera en x:0,y:0; con el_pct negativo daba
    // deformaciones/tensiones NEGATIVAS. Se agregó el piso adentro
    // (el_pct_safe), igual que ya tenía E_GPa_safe. Este test ejercita la
    // función pura directamente, sin pasar por ningún llamador externo, para
    // que una futura regresión acá se detecte aunque el sexto consumidor que
    // se agregue algún día se olvide de clampear por su cuenta.
    id: 'curve_el_pct_no_positivo', group: 'Motor de curvas',
    name: 'genCurve — el_pct<=0 no colapsa la curva ni da valores negativos (FIX #63, hallazgo C6-01)',
    run: () => {
      const ptsCero = genCurve(207, 250, 450, 0, false);
      const colapsada = ptsCero.every(p => p.x === 0 && p.y === 0);
      if (colapsada) return { ok: false, msg: 'con el_pct=0 la curva sigue colapsando entera en x:0,y:0' };
      const ptsNeg = genCurve(207, 250, 450, -5, false);
      const hayNegativos = ptsNeg.some(p => p.x < 0 || p.y < 0);
      if (hayNegativos) return { ok: false, msg: 'con el_pct=-5 la curva sigue dando puntos con x o y negativos' };
      return { ok: true, msg: 'el_pct=0 y el_pct=-5 dan una curva válida (sin colapso ni valores negativos) ✓' };
    }
  },
  {
    // FIX #63 (hallazgo QA v6.16, L47-01): el aviso de "dato inconsistente"
    // (σy>TS o σyc>σc) está implementado en 6 lugares del proyecto --
    // Tracción, Compresión, Compuesto, Comparar, R.R. Moore y Curva S-N --
    // pero de los 6, solo R.R. Moore tenía un test que confirmara
    // DIRECTAMENTE que el aviso aparece. Los otros 5 solo se mencionaban de
    // forma indirecta (ej. el propio comentario del test de R.R. Moore dice
    // "mismo criterio que e_warnSyTs", pero nunca testeaba e_warnSyTs en
    // sí). Este test recorre los 5 restantes en un único lugar, confirmando
    // en cada uno que el aviso aparece con datos inconsistentes y
    // desaparece al corregirlos -- mismo criterio que ya usa
    // compound_plausibility_live_E para el caso de Compuesto/Regla 3.
    id: 'aviso_dato_inconsistente_consolidado', group: 'Motor de curvas',
    name: 'Avisos de σ_y>TS / σ_yc>σ_c aparecen y desaparecen correctamente en los 5 lugares restantes del proyecto (FIX #63, hallazgo L47-01)',
    run: () => {
      const casos = [
        {
          nombre: 'Tracción (e_warnSyTs)', warnId: 'e_warnSyTs', fn: buildCurve,
          malos: [['e_sy','600'],['e_ts','450']], buenos: [['e_sy','250'],['e_ts','450']],
        },
        {
          nombre: 'Compresión (co_warnSycSc)', warnId: 'co_warnSycSc', fn: buildCompCurve,
          malos: [['co_syc','600'],['co_sc','450']], buenos: [['co_syc','250'],['co_sc','450']],
        },
        {
          nombre: 'Comparar (c_warnSyTs)', warnId: 'c_warnSyTs', fn: renderCompare,
          malos: [['c1_sy','600'],['c1_ts','450']], buenos: [['c1_sy','250'],['c1_ts','450']],
        },
        {
          nombre: 'Compuesto (compWarnSyTs)', warnId: 'compWarnSyTs', fn: renderCompound,
          malos: [['k1_sy','600'],['k1_ts','450']], buenos: [['k1_sy','250'],['k1_ts','450']],
        },
        {
          nombre: 'Curva S-N (ft_warnSigma)', warnId: 'ft_warnSigma', fn: ftUpdateSN,
          malos: [['ft_snMat','al2014'],['ft_sa','480']], buenos: [['ft_sa','200']],
        },
      ];
      const errores = [];
      for (const caso of casos) {
        const antes = caso.malos.map(([id]) => document.getElementById(id).value);
        caso.malos.forEach(([id, val]) => { document.getElementById(id).value = val; });
        try { caso.fn(); } catch (e) { errores.push(`${caso.nombre}: excepción con datos malos (${e.message})`); continue; }
        const warnEl = document.getElementById(caso.warnId);
        const visibleConMalo = warnEl.style.display !== 'none';
        caso.buenos.forEach(([id, val]) => { document.getElementById(id).value = val; });
        try { caso.fn(); } catch (e) { errores.push(`${caso.nombre}: excepción con datos buenos (${e.message})`); continue; }
        const ocultoConBueno = warnEl.style.display === 'none';
        // restaurar valores originales
        caso.malos.forEach(([id], i) => { document.getElementById(id).value = antes[i]; });
        try { caso.fn(); } catch (e) { /* restauración best-effort */ }
        if (!visibleConMalo) errores.push(`${caso.nombre}: con dato inconsistente el aviso debería estar visible y no lo está`);
        if (!ocultoConBueno) errores.push(`${caso.nombre}: con dato válido el aviso debería estar oculto y no lo está`);
      }
      if (errores.length) return { ok: false, msg: errores.join(' | ') };
      return { ok: true, msg: `${casos.length} avisos verificados directamente (aparecen y desaparecen correctamente) ✓` };
    }
  },
  {
    id: 'presets_nuevos', group: 'Motor de curvas',
    name: 'PRESETS v5 — nuevos materiales presentes',
    run: () => {
      const requeridos = ['niquel','aceroinox','molibdeno','magnesio','zinc','plata','plomo','tungsteno','laton','oro'];
      const faltantes = requeridos.filter(k => !PRESETS[k]);
      if (faltantes.length) return { ok: false, msg: `Faltantes: ${faltantes.join(', ')}` };
      return { ok: true, msg: `${requeridos.length} nuevos presets ✓` };
    }
  },
  {
    // FIX (QA — hallazgo Parte 7): equivalente de presets_nuevos para los 18
    // materiales agregados en v4.10 (Materiales_nuevos_Sim_MatyEns.md), que
    // hasta ahora no tenían un test dedicado que verificara su sola presencia.
    id: 'presets_v4_10', group: 'Motor de curvas',
    name: 'PRESETS v4.10 — los 18 materiales nuevos están presentes',
    run: () => {
      const requeridos = [
        'aisi1045','acero4140','aluminio7075','aluminio2024','broncefosforico',
        'hierronodular','inconel718','titaniocp2','sic','si3n4','zirconia',
        'gfrp','kevlarepoxi','hdpe','pp','pvcrigido','abs','pc'
      ];
      const faltantes = requeridos.filter(k => !PRESETS[k]);
      if (faltantes.length) return { ok: false, msg: `Faltantes: ${faltantes.join(', ')}` };
      return { ok: true, msg: `${requeridos.length} materiales de v4.10 ✓` };
    }
  },
  {
    id: 'curve_fluencia', group: 'Motor de curvas',
    name: 'genCurve — Discontinuidad de fluencia',
    run: () => {
      const pts = genCurve(207, 250, 450, 20, true);
      const pl = pts.filter(p => p.phase === 'plastic');
      if (!pl.length) return { ok: false, msg: 'Sin zona plástica con fluencia activada' };
      const maxEarly = Math.max(...pl.slice(0,3).map(p => p.y));
      if (maxEarly < 250) return { warn: true, msg: `Pico de fluencia bajo: ${maxEarly.toFixed(0)} MPa` };
      return { ok: true, msg: `Pico: ${maxEarly.toFixed(1)} MPa ✓` };
    }
  },
  // ---- CÁLCULO RESILIENCIA ----
  {
    id: 'resilience_formula', group: 'Cálculos energéticos',
    name: 'Resiliencia — fórmula σ²/(2E)',
    run: () => {
      const E = 207, sy = 250;
      const pts = genCurve(E, sy, 450, 20, false);
      const res = calcResilience(pts);
      const analytic = (sy * sy) / (2 * E * 1000); // MJ/m³
      const err = Math.abs(res - analytic) / analytic;
      if (err > 0.05) return { ok: false, msg: `Numérico=${(res*1000).toFixed(2)} kJ/m³ vs analítico=${(analytic*1000).toFixed(2)} kJ/m³ (err=${(err*100).toFixed(1)}%)` };
      return { ok: true, msg: `Err=${(err*100).toFixed(2)}% — U_R=${(res*1000).toFixed(2)} kJ/m³ ✓` };
    }
  },
  {
    id: 'tenacity_positive', group: 'Cálculos energéticos',
    name: 'Tenacidad — área positiva',
    run: () => {
      const pts = genCurve(207, 250, 450, 20, false);
      const ten = calcTenacity(pts);
      if (ten <= 0) return { ok: false, msg: `Tenacidad negativa o cero: ${ten}` };
      const res = calcResilience(pts);
      if (ten < res) return { ok: false, msg: `Tenacidad(${ten.toFixed(4)}) < Resiliencia(${res.toFixed(4)})` };
      return { ok: true, msg: `Ten=${ten.toFixed(4)} MJ/m³ > Res=${res.toFixed(4)} ✓` };
    }
  },
  // ---- CURVA DE COMPRESIÓN ----
  {
    id: 'comp_curve', group: 'Compresión',
    name: 'genCompCurve — Acero A36',
    run: () => {
      const pts = genCompCurve(207, 250, 450, 'no');
      if (!pts.length) return { ok: false, msg: 'Sin puntos' };
      const negSig = pts.filter(p => p.y > 0);
      if (negSig.length > 1) return { ok: false, msg: `${negSig.length} puntos con σ positivo (debería ser negativo)` };
      return { ok: true, msg: `${pts.length} pts, todos σ ≤ 0 ✓` };
    }
  },
  {
    id: 'comp_fragil', group: 'Compresión',
    name: 'genCompCurve — Hormigón (frágil)',
    run: () => {
      const pts = genCompCurve(30, 0, 30, 'si');
      const pl = pts.filter(p => p.phase === 'plastic');
      if (pl.length > 0) return { ok: false, msg: `Frágil tiene zona plástica (${pl.length} pts)` };
      return { ok: true, msg: 'Sin plástica en frágil ✓' };
    }
  },
  {
    id: 'comp_syc_negativo', group: 'Compresión',
    name: 'genCompCurve — σyc negativo no rompe monotonicidad (FIX #28)',
    run: () => {
      const pts = genCompCurve(207, -10, 450, 'no');
      let prevX = Infinity, badMono = false;
      for (const p of pts) { if (p.x > prevX + 1e-9) badMono = true; prevX = p.x; }
      if (badMono) return { ok: false, msg: 'ε no monotónico con σyc negativo' };
      return { ok: true, msg: 'Monotónico incluso con σyc negativo ✓' };
    }
  },
  {
    id: 'comp_sc_negativo', group: 'Compresión',
    name: 'genCompCurve (frágil) — σc negativo no da σ positivo (FIX #28)',
    run: () => {
      const pts = genCompCurve(125, 0, -200, 'si');
      const bad = pts.filter(p => p.y > 0);
      if (bad.length) return { ok: false, msg: `${bad.length} puntos con σ positivo (debería ser ≤0)` };
      return { ok: true, msg: 'σ ≤ 0 en toda la curva ✓' };
    }
  },
  // ---- PRESETS ----
  {
    id: 'preset_load', group: 'Presets',
    name: 'PRESETS — todas las claves definidas',
    run: () => {
      const required = ['acero','aluminio','cobre','titanio','fragil','nylon','carbono','ceramica','hormigon','madera'];
      const missing = required.filter(k => !PRESETS[k]);
      if (missing.length) return { ok: false, msg: `Faltantes: ${missing.join(', ')}` };
      return { ok: true, msg: `${required.length} presets OK ✓` };
    }
  },
  {
    id: 'preset_values', group: 'Presets',
    name: 'PRESETS — valores en rango',
    run: () => {
      const errors = [];
      for (const [k, p] of Object.entries(PRESETS)) {
        if (p.E <= 0 || p.E > 1000) errors.push(`${k}.E=${p.E}`);
        if (p.ts <= 0 || p.ts > 10000) errors.push(`${k}.ts=${p.ts}`);
        if (p.el < 0 || p.el > 200) errors.push(`${k}.el=${p.el}`);
      }
      if (errors.length) return { ok: false, msg: errors.join(', ') };
      return { ok: true, msg: 'Todos los valores en rango ✓' };
    }
  },
  // ---- REGLA DE MEZCLAS ----
  {
    id: 'compound_parallel', group: 'Material compuesto',
    name: 'Regla de mezclas — módulo paralelo',
    run: () => {
      const E1=207, E2=230, f2=0.3, f1=0.7;
      const E_par = E1*f1 + E2*f2;
      const expected = 207*0.7 + 230*0.3;
      if (Math.abs(E_par - expected) > 0.01) return { ok: false, msg: `E_par=${E_par} ≠ ${expected}` };
      if (E_par < Math.min(E1,E2) || E_par > Math.max(E1,E2)) 
        return { ok: false, msg: `E_par=${E_par.toFixed(1)} fuera de rango [${Math.min(E1,E2)},${Math.max(E1,E2)}]` };
      return { ok: true, msg: `E_par=${E_par.toFixed(1)} GPa ✓` };
    }
  },
  {
    id: 'compound_plausibility', group: 'Material compuesto',
    name: 'Aviso de plausibilidad — térmico + madera-matriz + rigidez (FIX #35)',
    run: () => {
      const cases = [
        // [matriz, refuerzo, debeAvisar, motivo]
        ['madera','ceramica', true,  'madera como matriz'],
        ['ceramica','madera', true,  'cerámica funde a más temp. que lo que la madera tolera'],
        ['acero','algarrobo', true,  'acero funde a más temp. que lo que el algarrobo tolera'],
        ['acero','plomo',     true,  'acero funde a más temp. y plomo es más blando'],
        ['acero','aluminio',  true,  'aluminio (E=69) más blando que acero (E=207): no refuerza'],
        ['acero','carbono',   false, 'combinación real (default de la app)'],
        ['hormigon','acero',  false, 'hormigón armado -- real, acero más rígido que hormigón'],
        ['hormigon','madera', true,  'madera (E=12) menos rígida que hormigón (E=30): no refuerza en rigidez, aunque existan tableros madera-cemento por otros motivos (aislación/peso)'],
        ['cobre','tungsteno', false, 'compuesto W-Cu -- real'],
        ['nylon','madera',    false, 'compuesto madera-plástico -- madera más rígida que nylon'],
      ];
      const fails = [];
      for (const [k1,k2,expectWarn,why] of cases) {
        // FIX #43: dzCompoundPlausibility ahora recibe los E EN VIVO (antes
        // volvía a mirar PRESETS[k].E por su cuenta) -- acá se los pasamos
        // explícitamente porque este test evalúa combinaciones de PRESETS
        // puros, sin pasar por renderCompound()/los campos E1/E2 del DOM.
        const E1 = PRESETS[k1] ? PRESETS[k1].E : null, E2 = PRESETS[k2] ? PRESETS[k2].E : null;
        const got = !!dzCompoundPlausibility(k1,k2,E1,E2);
        if (got !== expectWarn) fails.push(`${k1}+${k2}: esperado ${expectWarn?'aviso':'sin aviso'} (${why}), dio ${got?'aviso':'sin aviso'}`);
      }
      if (fails.length) return { ok: false, msg: fails.join(' | ') };
      return { ok: true, msg: `${cases.length} combinaciones verificadas ✓` };
    }
  },
  {
    id: 'compound_daltonismo_trazos', group: 'Material compuesto',
    name: 'Auditoría de daltonismo (backlog punto E, v5.11) — C1 y C2 tienen trazos distintos, no solo color',
    run: () => {
      renderCompound();
      const d1 = JSON.stringify(compoundChartInst.data.datasets[0].borderDash || []);
      const d2 = JSON.stringify(compoundChartInst.data.datasets[1].borderDash || []);
      if (d1 === d2) return { ok: false, msg: `C1 y C2 comparten el mismo patrón de trazo: [${d1}]` };
      return { ok: true, msg: `C1=[${d1}], C2=[${d2}] — trazos distintos ✓` };
    }
  },
  {
    id: 'comparar_daltonismo_trazos', group: 'Comparar materiales',
    name: 'Auditoría de daltonismo (backlog punto E, v5.11) — M1 y M2 tienen trazos distintos, no solo color',
    run: () => {
      renderCompare();
      const d1 = JSON.stringify(compareChartInst.data.datasets[0].borderDash || []);
      const d2 = JSON.stringify(compareChartInst.data.datasets[1].borderDash || []);
      if (d1 === d2) return { ok: false, msg: `M1 y M2 comparten el mismo patrón de trazo: [${d1}]` };
      return { ok: true, msg: `M1=[${d1}], M2=[${d2}] — trazos distintos ✓` };
    }
  },
  // ---- TEMPERATURA ----
  {
    id: 'temp_factor', group: 'Temperatura',
    name: 'tempFactor — alta T reduce propiedades',
    run: () => {
      const cold = tempFactor(25, -200);
      const hot  = tempFactor(25,  500);
      if (cold.kE <= hot.kE) return { ok: false, msg: `kE frío(${cold.kE}) ≤ kE caliente(${hot.kE})` };
      if (cold.kEl >= hot.kEl) return { ok: false, msg: `kEl frío(${cold.kEl}) ≥ kEl caliente(${hot.kEl})` };
      return { ok: true, msg: `T alta: kE=${hot.kE.toFixed(2)}, kEl=${hot.kEl.toFixed(2)} ✓` };
    }
  },
  {
    id: 'temp_extreme', group: 'Temperatura',
    name: 'tempFactor — valores en límites físicos',
    run: () => {
      const f = tempFactor(25, 1500);
      if (f.kE < 0) return { ok: false, msg: `kE negativo a 1500°C: ${f.kE}` };
      if (f.kS < 0) return { ok: false, msg: `kS negativo a 1500°C: ${f.kS}` };
      if (f.kEl > 5.1) return { ok: false, msg: `kEl demasiado alto: ${f.kEl}` };
      return { ok: true, msg: `kE=${f.kE.toFixed(3)}, kS=${f.kS.toFixed(3)}, kEl=${f.kEl.toFixed(2)} ✓` };
    }
  },
  {
    id: 'temp_el_cero', group: 'Temperatura',
    name: '%EL≤0 no colapsa la curva (FIX #29)',
    run: () => {
      // Replica la lógica de renderTemp: %EL=0 o negativo debe clampearse a 0.01
      // antes de escalarlo por temperatura y pasarlo a genCurve.
      let el0 = 0; // valor tipeado a mano, inválido
      if (el0 <= 0) el0 = 0.01;
      const f = tempFactor(25, 25);
      const pts = genCurve(207, 250, 450, Math.min(80, el0 * f.kEl), false);
      const lastX = pts[pts.length - 1].x;
      if (lastX <= 0) return { ok: false, msg: `Curva colapsada/invertida: ε_fractura=${lastX}` };
      return { ok: true, msg: `ε_fractura=${lastX.toFixed(5)} ✓` };
    }
  },
  {
    id: 'temp_daltonismo_trazos', group: 'Temperatura',
    name: 'Auditoría de daltonismo (backlog punto E, v5.11) — las 3 curvas tienen trazos distintos, no solo color',
    run: () => {
      renderTemp();
      const d0 = JSON.stringify(tempChartInst.data.datasets[0].borderDash || []);
      const d1 = JSON.stringify(tempChartInst.data.datasets[1].borderDash || []);
      const d2 = JSON.stringify(tempChartInst.data.datasets[2].borderDash || []);
      if (d0 === d1 || d1 === d2 || d0 === d2) {
        return { ok: false, msg: `Dos de las 3 curvas (baja/media/alta) comparten el mismo patrón de trazo: [${d0}], [${d1}], [${d2}]` };
      }
      return { ok: true, msg: `3 patrones de trazo distintos: [${d0}], [${d1}], [${d2}] ✓` };
    }
  },
  // ---- UNIDADES ----
  {
    id: 'units_mm', group: 'Conversión de unidades',
    name: 'toMM — cm y pulgadas',
    run: () => {
      const cm_result  = toMM(1, 'cm');
      const in_result  = toMM(1, 'in');
      const mm_result  = toMM(5, 'mm');
      const errors = [];
      if (Math.abs(cm_result - 10) > 0.001) errors.push(`1 cm → ${cm_result} (esperado 10)`);
      if (Math.abs(in_result - 25.4) > 0.001) errors.push(`1 in → ${in_result} (esperado 25.4)`);
      if (mm_result !== 5) errors.push(`5 mm → ${mm_result} (esperado 5)`);
      if (errors.length) return { ok: false, msg: errors.join(' | ') };
      return { ok: true, msg: '1cm=10mm, 1in=25.4mm ✓' };
    }
  },
  // ---- SPLITPHASES ----
  {
    id: 'splitphases', group: 'Motor de curvas',
    name: 'splitPhases — continuidad entre zonas',
    run: () => {
      const pts = genCurve(207, 250, 450, 20, false);
      const [el, pl, nk, fr] = splitPhases(pts);
      // el should start at 0
      if (!el.length) return { ok: false, msg: 'Sin zona elástica' };
      if (!pl.length) return { ok: false, msg: 'Sin zona plástica' };
      // last point of elastic should equal first of plastic (bridging)
      const elLast = el[el.length - 1];
      const plFirst = pl[0];
      if (Math.abs(elLast.x - plFirst.x) > 0.0001) 
        return { ok: false, msg: `Discontinuidad elástica-plástica: ε_el_fin=${elLast.x}, ε_pl_ini=${plFirst.x}` };
      return { ok: true, msg: `Zonas continuas ✓ (el:${el.length}, pl:${pl.length}, nk:${nk.length}, fr:${fr.length})` };
    }
  },
  // ---- DOM ----
  {
    id: 'dom_ids', group: 'DOM',
    name: 'IDs críticos del DOM — presentes',
    run: () => {
      const ids = ['e_E','e_sy','e_ts','e_el','e_nu','mainChart','zoomChart','compChart',
                   'compareChart','tempChart','compoundChart','mF','mSig','infoBar'];
      const missing = ids.filter(id => !document.getElementById(id));
      if (missing.length) return { ok: false, msg: `Faltantes: ${missing.join(', ')}` };
      return { ok: true, msg: `${ids.length} IDs presentes ✓` };
    }
  },
  {
    id: 'dom_tabs', group: 'DOM',
    // FIX: este test esperaba 2 tabs/2 páginas porque se escribió antes de
    // v3.1, cuando se agregó la tercera pestaña "Fractura, fatiga y fluencia".
    // Nadie lo actualizó en su momento, así que quedó rompiéndose en silencio
    // apenas se abriera el panel de tests. Ahora cuenta las 3 pestañas reales
    // y también valida las 15 subsecciones de la Unidad 3 (rt-subbtn), igual
    // que ya se hacía con las otras dos pestañas.
    // FIX (v4.0): se agregó la 4ta pestaña "Ensayos complementarios" (esqueleto
    // vacío, todavía sin ensayos). Actualizamos el conteo de tabs/pages a 4 ANTES
    // de que se agregue el primer ensayo -- la vez pasada (v3.4) este test se
    // rompió justamente por dejarlo desactualizado cuando se sumó la 3ra pestaña.
    // FIX (v4.1): primer ensayo de esa pestaña (Desgaste/Archard) -- se agrega el
    // conteo de cm-subbtn (1 por ahora, va a subir a 4 con el resto del Grupo A).
    // FIX (v4.4): 4to y último ensayo del Grupo A (Polímeros/curva DMA) -- cierra
    // por ahora el Grupo A completo: cm-subbtn queda en 4 hasta que arranque el
    // Grupo B (Metalografía/Voronoi) en una fase futura.
    // FIX (v5.0): esqueleto del Grupo B. Se agregaron 5 subsecciones placeholder
    // ("Próximamente", sin ensayo real todavía) a la pestaña "Ensayo no
    // destructivo" -- Corrientes inducidas, Ultrasonido, Radiografía, Líquidos
    // penetrantes, Partículas magnéticas -- subiendo dzSubs de 8 a 13. Y 1
    // subsección placeholder más (Metalografía) a "Ensayos complementarios",
    // subiendo cmSubs de 4 a 5. Mismo criterio que el esqueleto de v4.0: contar
    // ya los botones nuevos ANTES de que se cargue el primer ensayo real de
    // esta tanda, para no repetir el bug de v3.4.
    // FIX (v5.7, backlog punto A): 14ta subsección en "Ensayo no destructivo"
    // (Comparativa NDT, contenido estático) -- dzSubs sube de 13 a 14.
    // FIX (v5.14): reorganización de navegación -- 4 pestañas pasan a 5
    // ("Ensayo destructivo"+"Fractura, fatiga y fluencia" se fusionan con
    // Dureza dentro de "Ensayos mecánicos"; "Ensayos complementarios" se
    // divide en "Caracterización y microscopía" y "Degradación y
    // comportamiento en servicio"). Los TOTALES por clase (ed/dz/rt/cm) no
    // cambian -- ningún botón se agregó ni se borró, solo se reubicaron --
    // así que esta parte del test sigue siendo la misma cuenta 6+14+15+5,
    // ahora repartida en 5 páginas en vez de 4. Se agregan checks nuevos de
    // cómo quedó repartido cada grupo entre las pestañas nuevas.
    // FIX (v6.1): primer ensayo de Grupo C -- 7ma subsección en "Fractura,
    // fatiga y fluencia" (Máquina R.R. Moore, assets/rrmoore.js) -- rtSubs
    // sube de 15 a 16. Mismo criterio que v4.0/v5.0: contar el botón nuevo
    // en la misma versión en que se agrega, no dejarlo para después.
    name: 'Tabs — 5 tabs, 5 páginas, 6+14+16+5 subsecciones (repartidas)',
    run: () => {
      const tabs  = document.querySelectorAll('.tab').length;
      const pages = document.querySelectorAll('.page').length;
      const edSubs = document.querySelectorAll('.ed-subbtn').length;
      const dzSubs = document.querySelectorAll('.dz-subbtn').length;
      const rtSubs = document.querySelectorAll('.rt-subbtn').length;
      const cmSubs = document.querySelectorAll('.cm-subbtn').length;
      if (tabs !== 5)   return { ok: false, msg: `Tabs: ${tabs} (esperado 5)` };
      if (pages !== 5)  return { ok: false, msg: `Pages: ${pages} (esperado 5)` };
      if (edSubs !== 6) return { ok: false, msg: `Subsecciones ed (Tracción/Compresión + Herramientas): ${edSubs} (esperado 6)` };
      if (dzSubs !== 14) return { ok: false, msg: `Subsecciones dz (Dureza + Ensayo no destructivo): ${dzSubs} (esperado 14)` };
      if (rtSubs !== 16) return { ok: false, msg: `Subsecciones rt (Fractura/fatiga/fluencia): ${rtSubs} (esperado 16)` };
      if (cmSubs !== 5) return { ok: false, msg: `Subsecciones cm (Caracterización + Degradación): ${cmSubs} (esperado 5)` };

      // Reparto entre pestañas nuevas.
      const mecPage = document.getElementById('tab-mecanicos');
      const dzPage = document.getElementById('tab-end'); // FIX #62: "tab-dureza" -> "tab-end", ver dureza-shared.js
      const caracPage = document.getElementById('tab-caracterizacion');
      const degrPage = document.getElementById('tab-degradacion');
      const herrPage = document.getElementById('tab-herramientas');
      if (!mecPage || !dzPage || !caracPage || !degrPage || !herrPage) {
        return { ok: false, msg: 'Falta alguna de las 5 páginas por id (tab-mecanicos/tab-end/tab-caracterizacion/tab-degradacion/tab-herramientas)' };
      }
      const edEnMec = mecPage.querySelectorAll('.ed-subbtn').length;
      const dzEnMec = mecPage.querySelectorAll('.dz-subbtn').length;
      const rtEnMec = mecPage.querySelectorAll('.rt-subbtn').length;
      const dzEnNdt = dzPage.querySelectorAll('.dz-subbtn').length;
      const cmEnCarac = caracPage.querySelectorAll('.cm-subbtn').length;
      const cmEnDegr = degrPage.querySelectorAll('.cm-subbtn').length;
      const edEnHerr = herrPage.querySelectorAll('.ed-subbtn').length;
      if (edEnMec !== 2) return { ok: false, msg: `ed-subbtn dentro de Mecánicos: ${edEnMec} (esperado 2, Tracción+Compresión)` };
      if (dzEnMec !== 8) return { ok: false, msg: `dz-subbtn dentro de Mecánicos: ${dzEnMec} (esperado 8, Dureza)` };
      if (rtEnMec !== 16) return { ok: false, msg: `rt-subbtn dentro de Mecánicos: ${rtEnMec} (esperado 16, Fractura/fatiga/fluencia)` };
      if (dzEnNdt !== 6) return { ok: false, msg: `dz-subbtn dentro de Ensayo no destructivo: ${dzEnNdt} (esperado 6)` };
      if (cmEnCarac !== 1) return { ok: false, msg: `cm-subbtn dentro de Caracterización: ${cmEnCarac} (esperado 1, Metalografía)` };
      if (cmEnDegr !== 4) return { ok: false, msg: `cm-subbtn dentro de Degradación: ${cmEnDegr} (esperado 4)` };
      if (edEnHerr !== 4) return { ok: false, msg: `ed-subbtn dentro de Herramientas: ${edEnHerr} (esperado 4)` };

      return { ok: true, msg: `${tabs} tabs, ${pages} pages, ${edSubs}+${dzSubs}+${rtSubs}+${cmSubs} subsecciones, repartidas correctamente ✓` };
    }
  },
  {
    id: 'mec_group_switch', group: 'Navegación (v5.14)',
    name: 'mecSwitchGroup — alterna grupo activo dentro de "Ensayos mecánicos"',
    run: () => {
      switchTab('mecanicos', document.querySelectorAll('.tab')[0]);
      mecSwitchGroup('dureza');
      const asideOk = document.querySelector('.mec-group-aside[data-mecgroup="dureza"]').classList.contains('active')
        && !document.querySelector('.mec-group-aside[data-mecgroup="estatica"]').classList.contains('active')
        && !document.querySelector('.mec-group-aside[data-mecgroup="rotura"]').classList.contains('active');
      const mainOk = document.querySelector('.mec-group-main[data-mecgroup="dureza"]').classList.contains('active')
        && !document.querySelector('.mec-group-main[data-mecgroup="estatica"]').classList.contains('active')
        && !document.querySelector('.mec-group-main[data-mecgroup="rotura"]').classList.contains('active');
      const btnOk = document.querySelector('.mec-groupbtn[data-mecgroup="dureza"]').classList.contains('active');
      mecSwitchGroup('estatica'); // vuelve al estado inicial para no afectar otros tests
      if (!asideOk || !mainOk || !btnOk) {
        return { ok: false, msg: `asideOk=${asideOk} mainOk=${mainOk} btnOk=${btnOk}` };
      }
      return { ok: true, msg: 'mecSwitchGroup activa el grupo correcto en aside+main+botón, y solo ese ✓' };
    }
  },
  {
    id: 'dz_comparativa_ndt', group: 'Ensayo no destructivo (Grupo B, v5.7)',
    name: 'Comparativa NDT — 5 filas, subnav/panel/sidebar correctamente enlazados',
    run: () => {
      const boton = document.querySelector('.dz-subbtn[data-dz="comparativa"]');
      if (!boton) return { ok: false, msg: 'Falta el botón de subnav data-dz="comparativa"' };
      const panel = document.getElementById('dz_panel_comparativa');
      if (!panel) return { ok: false, msg: 'Falta dz_panel_comparativa' };
      const ctrl = document.getElementById('dz_ctrl_comparativa');
      if (!ctrl) return { ok: false, msg: 'Falta dz_ctrl_comparativa' };
      const filas = panel.querySelectorAll('table tbody tr');
      if (filas.length !== 5) return { ok: false, msg: `Filas de la tabla: ${filas.length} (esperado 5, una por ensayo del Grupo B)` };
      const primeraCol = Array.from(filas).map(f => f.querySelector('td')?.textContent?.trim());
      const esperado = ['Corrientes inducidas', 'Ultrasonido', 'Radiografía', 'Líquidos penetrantes', 'Partículas magnéticas'];
      const faltan = esperado.filter(e => !primeraCol.includes(e));
      if (faltan.length) return { ok: false, msg: `Faltan filas para: ${faltan.join(', ')}` };
      // Sanity check de dzSwitch: activarla debe activar panel+ctrl+botón y desactivar los demás.
      dzSwitch('comparativa');
      const panelActivo = panel.classList.contains('active');
      const ctrlActivo = ctrl.classList.contains('active');
      const botonActivo = boton.classList.contains('active');
      // FIX (v5.14): 'mohs' ya no vive en esta pestaña (se movió a "Ensayos
      // mecánicos") -- el estado inicial de "Ensayo no destructivo" ahora es
      // 'corrientes', primer ítem del grupo NDT que quedó acá.
      dzSwitch('corrientes'); // vuelve al estado inicial para no afectar otros tests
      if (!panelActivo || !ctrlActivo || !botonActivo) {
        return { ok: false, msg: 'dzSwitch("comparativa") no activó panel/ctrl/botón correctamente' };
      }
      return { ok: true, msg: '5 filas presentes, dzSwitch("comparativa") activa panel/ctrl/botón ✓' };
    }
  },
  // ---- RESPONSIVE ----
  {
    id: 'responsive_detection', group: 'Responsive',
    name: 'Detección de dispositivo — label presente',
    run: () => {
      const label = document.getElementById('deviceLabel');
      if (!label) return { ok: false, msg: 'deviceLabel no encontrado' };
      if (!label.textContent) return { ok: false, msg: 'deviceLabel vacío' };
      return { ok: true, msg: `Dispositivo: "${label.textContent}" ✓` };
    }
  },
  {
    id: 'responsive_sidebar', group: 'Responsive',
    name: 'Drawer sidebar — funciones definidas',
    run: () => {
      if (typeof openSidebar !== 'function')  return { ok: false, msg: 'openSidebar no definida' };
      if (typeof closeSidebar !== 'function') return { ok: false, msg: 'closeSidebar no definida' };
      return { ok: true, msg: 'openSidebar/closeSidebar ✓' };
    }
  },
  {
    id: 'responsive_charts', group: 'Responsive',
    name: 'Chart.js — instancias inicializadas',
    run: () => {
      const instances = [];
      if (typeof mainChart !== 'undefined' && mainChart) instances.push('mainChart');
      if (typeof zoomChart !== 'undefined' && zoomChart) instances.push('zoomChart');
      if (instances.length < 2) return { ok: false, msg: `Solo ${instances.length}/2 charts init` };
      return { ok: true, msg: instances.join(', ') + ' ✓' };
    }
  },
  // ---- STORAGE ----
  {
    id: 'localstorage', group: 'Configuraciones',
    name: 'localStorage — lectura/escritura',
    run: () => {
      try {
        const key = '__test_ensayo__';
        localStorage.setItem(key, 'ok');
        const val = localStorage.getItem(key);
        localStorage.removeItem(key);
        if (val !== 'ok') return { ok: false, msg: `Valor leído: "${val}"` };
        return { ok: true, msg: 'R/W OK ✓' };
      } catch(e) {
        return { ok: false, msg: e.message };
      }
    }
  },
  {
    // FIX #63 (hallazgo QA v6.16, M53-01 -- extensión): al corregir el
    // separador decimal de .toFixed() en todo el proyecto, se encontró el
    // mismo problema en .toExponential() (usado en Desgaste, Fatiga, Ficha
    // técnica y Fluencia para notación científica, ej. "1.23e-5"). Se
    // corrigieron los 20 casos reales del código fuente; este test verifica
    // en tiempo de ejecución, para un caso representativo de cada uno de
    // los 4 archivos, que la mantisa efectivamente usa coma y no punto.
    id: 'notacion_exponencial_usa_coma', group: 'Configuraciones',
    name: 'Notación exponencial (toExponential) usa coma decimal en la mantisa, no punto (FIX #63, extensión de M53-01)',
    run: () => {
      const sinPuntoEnMantisa = (texto) => !/\d\.\d+e/i.test(texto);
      const casos = [];

      // Desgaste
      dsUpdate();
      casos.push(['ds_mK', document.getElementById('ds_mK').textContent]);

      // Fatiga (velocidad de propagación, siempre da un valor con e- si ΔK es chico)
      document.getElementById('ft_dk').value = '5';
      ftUpdateVelocidad();
      casos.push(['ft_mDadn', document.getElementById('ft_mDadn').textContent]);

      // Fluencia (ε̇_s siempre viene en notación exponencial para valores típicos)
      flUpdateComportamiento();
      casos.push(['fl_mEpsS1', document.getElementById('fl_mEpsS1').textContent]);

      const conPuntoEnMantisa = casos.filter(([id, txt]) => !sinPuntoEnMantisa(txt));
      if (conPuntoEnMantisa.length) {
        return { ok: false, msg: conPuntoEnMantisa.map(([id, txt]) => `${id}="${txt}"`).join(' | ') };
      }
      return { ok: true, msg: casos.map(([id, txt]) => `${id}="${txt}"`).join(', ') + ' ✓' };
    }
  },
  // FIX #63 (hallazgo QA v6.16, L52-01): este archivo tiene 8 FIX históricos
  // documentados (#7, #8, #16, #18, #19, #20, #32, #33) pero el único test
  // del grupo "Configuraciones" verificaba lectura/escritura genérica de
  // localStorage, sin probar nada de la lógica propia de la app. Se agregan
  // 3 tests directos a los bugs ya corregidos, mismo patrón de backup/
  // restauración en un finally que ya usa prog_guardar_cargar.
  {
    id: 'cfg_escape_html_xss', group: 'Configuraciones',
    name: 'escapeHtml() neutraliza un payload real antes de insertarlo con innerHTML (FIX #63, hallazgo L52-01)',
    run: () => {
      const payload = `<img src=x onerror="window.__cfgXssRan=true">`;
      const escapado = escapeHtml(payload);
      if (escapado.includes('<img')) return { ok: false, msg: `no se escapó "<": "${escapado}"` };
      if (!escapado.includes('&lt;img')) return { ok: false, msg: `falta &lt; en el resultado: "${escapado}"` };
      // Confirmación end-to-end: insertarlo de verdad vía innerHTML (como
      // hace renderSavedList() con cfg.name) y verificar que NO se crea un
      // <img> real en el DOM ni se ejecuta el onerror.
      const div = document.createElement('div');
      div.innerHTML = `<span>${escapado}</span>`;
      const hayImgReal = div.querySelector('img') !== null;
      if (hayImgReal) return { ok: false, msg: 'se creó un <img> real en el DOM pese al escape' };
      return { ok: true, msg: 'payload neutralizado, sin <img> real en el DOM ✓' };
    }
  },
  {
    id: 'cfg_guardar_cargar_roundtrip_unidades', group: 'Configuraciones',
    name: 'saveConfig()/loadConfig() — round-trip conserva unidades de l₀/d₀, no solo el número crudo (FIX #63, hallazgo L52-01, cubre FIX #16)',
    run: () => {
      const backup = localStorage.getItem('ensayo_configs');
      const camposAntes = ['e_E','e_sy','e_ts','e_el','e_nu','e_l0','e_l0u','e_d0','e_d0u','e_a0','e_a0u','e_preset','cfg_name']
        .map(id => [id, document.getElementById(id).value]);
      try {
        localStorage.removeItem('ensayo_configs');
        document.getElementById('e_E').value = '207';
        document.getElementById('e_sy').value = '250';
        document.getElementById('e_ts').value = '450';
        document.getElementById('e_el').value = '20';
        document.getElementById('e_l0').value = '2';
        document.getElementById('e_l0u').value = 'in'; // unidad no-default a propósito
        document.getElementById('e_d0').value = '0.5';
        document.getElementById('e_d0u').value = 'in';
        document.getElementById('cfg_name').value = 'Test round-trip';
        saveConfig();
        const saved = getSavedConfigs();
        if (saved.length !== 1) return { ok: false, msg: `se esperaba 1 config guardada, hay ${saved.length}` };
        if (saved[0].l0u !== 'in' || saved[0].d0u !== 'in') return { ok: false, msg: `unidades no guardadas: l0u=${saved[0].l0u}, d0u=${saved[0].d0u}` };
        // Se cambian las unidades en pantalla ANTES de cargar, para confirmar
        // que loadConfig() las restaura desde la config y no las deja como
        // estaban en pantalla (que era exactamente el bug del FIX #16).
        document.getElementById('e_l0u').value = 'mm';
        document.getElementById('e_d0u').value = 'mm';
        loadConfig(0);
        const l0uCargado = document.getElementById('e_l0u').value;
        const d0uCargado = document.getElementById('e_d0u').value;
        if (l0uCargado !== 'in') return { ok: false, msg: `loadConfig() no restauró l0u: quedó "${l0uCargado}"` };
        if (d0uCargado !== 'in') return { ok: false, msg: `loadConfig() no restauró d0u: quedó "${d0uCargado}"` };
        return { ok: true, msg: 'round-trip conserva l0u/d0u ("in") en vez de caer al default ✓' };
      } finally {
        camposAntes.forEach(([id, val]) => { document.getElementById(id).value = val; });
        if (backup === null) localStorage.removeItem('ensayo_configs'); else localStorage.setItem('ensayo_configs', backup);
      }
    }
  },
  {
    id: 'cfg_aviso_nombre_duplicado', group: 'Configuraciones',
    name: 'saveConfig() — avisa (sin bloquear) al guardar un nombre ya usado (FIX #63, hallazgo L52-01, cubre FIX #18)',
    run: () => {
      const backup = localStorage.getItem('ensayo_configs');
      const nameBefore = document.getElementById('cfg_name').value;
      try {
        localStorage.removeItem('ensayo_configs');
        document.getElementById('cfg_name').value = 'Config duplicada test';
        saveConfig();
        const trasLaPrimera = getSavedConfigs().length;
        document.getElementById('cfg_name').value = 'Config duplicada test'; // mismo nombre
        saveConfig();
        const trasLaSegunda = getSavedConfigs().length;
        const warnEl = document.getElementById('cfg_warn');
        const avisoVisible = warnEl.style.display !== 'none' && /ya había otra configuración/.test(warnEl.textContent);
        if (trasLaPrimera !== 1) return { ok: false, msg: `tras la primera debería haber 1 config, hay ${trasLaPrimera}` };
        if (trasLaSegunda !== 2) return { ok: false, msg: `saveConfig() con nombre duplicado no debería bloquearse -- debería haber 2 configs, hay ${trasLaSegunda}` };
        if (!avisoVisible) return { ok: false, msg: `debería avisar sobre el nombre duplicado sin bloquear; texto actual: "${warnEl.textContent}"` };
        return { ok: true, msg: 'guarda igual (no bloquea) y avisa sobre el duplicado ✓' };
      } finally {
        document.getElementById('cfg_name').value = nameBefore;
        if (backup === null) localStorage.removeItem('ensayo_configs'); else localStorage.setItem('ensayo_configs', backup);
        renderSavedList();
      }
    }
  },
  // ---- DUREZA (Módulo 2) ----
  {
    id: 'dz_mohs_logic', group: 'Dureza',
    name: 'Mohs — dzMohsCompare() en los 3 casos posibles',
    run: () => {
      if (dzMohsCompare(10,1) !== 'raya') return { ok: false, msg: 'Diamante (10) debería rayar a talco (1)' };
      if (dzMohsCompare(1,10) !== 'no_raya') return { ok: false, msg: 'Talco (1) no debería poder rayar a diamante (10)' };
      if (dzMohsCompare(7,7) !== 'empate') return { ok: false, msg: 'Dos minerales de igual dureza (7 y 7) deberían dar empate' };
      return { ok: true, msg: 'dzMohsCompare(): raya / no_raya / empate ✓ (los 3 casos, no solo 10>1)' };
    }
  },
  {
    id: 'dz_brinell_formula', group: 'Dureza',
    name: 'Brinell — HB = 2P/[πD(D−√(D²−d²))]',
    run: () => {
      const D=10, P=2000, d=3.5;
      const HB = (2*P) / (Math.PI*D*(D - Math.sqrt(D*D - d*d)));
      const expected = 201.3;
      if (Math.abs(HB - expected) > 0.5) return { ok: false, msg: `HB=${HB.toFixed(1)} ≠ ${expected}` };
      return { ok: true, msg: `HB(P=2000kg, d=3.5mm) = ${HB.toFixed(1)} ✓` };
    }
  },
  {
    id: 'dz_vickers_ref_table', group: 'Dureza',
    name: 'VICKERS_REF — todos los pares (P,d) reproducen su HV declarado (FIX #34)',
    run: () => {
      const bad = [];
      for (const [name, ref] of Object.entries(VICKERS_REF)) {
        const HV = 1.854*(ref.p/1000)/(ref.d*ref.d);
        if (Math.abs(HV-ref.hv)/ref.hv*100 > 2) bad.push(`${name}: HV calc=${HV.toFixed(1)} vs tabla=${ref.hv}`);
      }
      if (bad.length) return { ok: false, msg: bad.join(' | ') };
      return { ok: true, msg: `${Object.keys(VICKERS_REF).length} materiales OK (<2% de diferencia) ✓` };
    }
  },
  {
    // FIX #63 (hallazgo QA v6.16, D12-01): PRESETS.sic.dureza.hv=3200 (dato
    // bibliográficamente correcto) caía por encima del techo de validación
    // de 3000 HV que usaba dzUpdateMicro(), disparando la advertencia de
    // "fuera de rango típico" sobre su propio ejemplo guiado. Se subió el
    // techo a 4000. Este test blinda que ningún material de VICKERS_REF
    // (incluido SiC) dispare esa advertencia.
    id: 'dz_vickers_ref_hv_dentro_de_rango', group: 'Dureza',
    name: 'VICKERS_REF — ningún material de referencia dispara su propia advertencia de rango típico (FIX #63, hallazgo D12-01)',
    run: () => {
      const bad = [];
      for (const [name, ref] of Object.entries(VICKERS_REF)) {
        const HV = 1.854*(ref.p/1000)/(ref.d*ref.d);
        if (HV < 1 || HV > 4000) bad.push(`${name}: HV=${HV.toFixed(0)}`);
      }
      if (bad.length) return { ok: false, msg: bad.join(' | ') };
      return { ok: true, msg: `${Object.keys(VICKERS_REF).length} materiales con HV dentro de [1, 4000] ✓` };
    }
  },
  {
    // FIX (QA — hallazgo Parte 7): equivalente de dz_vickers_ref_table para
    // Brinell. Sin este test, un futuro cambio en PRESETS[x].dureza.hb sin
    // actualizar el (p,d) correspondiente en BRINELL_PD pasaría desapercibido.
    id: 'dz_brinell_ref_table', group: 'Dureza',
    name: 'BRINELL_REF — todos los pares (P,d,D=10mm) reproducen su HB declarado',
    run: () => {
      const D = 10, bad = [];
      for (const [name, ref] of Object.entries(BRINELL_REF)) {
        const HB = (2*ref.p) / (Math.PI*D*(D - Math.sqrt(D*D - ref.d*ref.d)));
        if (Math.abs(HB-ref.hb)/ref.hb*100 > 2) bad.push(`${name}: HB calc=${HB.toFixed(1)} vs tabla=${ref.hb}`);
      }
      if (bad.length) return { ok: false, msg: bad.join(' | ') };
      return { ok: true, msg: `${Object.keys(BRINELL_REF).length} materiales OK (<2% de diferencia) ✓` };
    }
  },
  {
    // FIX #63 (hallazgo QA v6.16, D11-01): 3 de los 21 materiales guiados
    // (aluminio7075, aluminio2024, broncefosforico) tenían un ratio d/D por
    // debajo de 0.24 -- el propio ejemplo bibliográfico disparaba la
    // advertencia de "huella poco confiable" del módulo. Este test blinda
    // que ningún material de referencia caiga fuera del rango válido que la
    // escena misma exige (0.24 a 0.60, ver dureza-brinell.js).
    id: 'dz_brinell_ref_ratio_valido', group: 'Dureza',
    name: 'BRINELL_REF — ningún material de referencia dispara su propia advertencia de huella fuera de rango (FIX #63, hallazgo D11-01)',
    run: () => {
      const D = 10, bad = [];
      for (const [name, ref] of Object.entries(BRINELL_REF)) {
        const ratio = ref.d / D;
        if (ratio < 0.24 || ratio > 0.60) bad.push(`${name}: d/D=${ratio.toFixed(3)}`);
      }
      if (bad.length) return { ok: false, msg: bad.join(' | ') };
      return { ok: true, msg: `${Object.keys(BRINELL_REF).length} materiales con d/D dentro de [0.24, 0.60] ✓` };
    }
  },
  {
    // FIX (QA — hallazgo Parte 7): equivalente para Rockwell. Acá no hay una
    // fórmula física cerrada (el control es ilustrativo, según su propio texto
    // de ayuda), pero SÍ hay una fórmula fija que usa dzUpdateRk() para pasar
    // de "slider" a HR -- este test reproduce esa misma fórmula y verifica
    // que cada (slider, escala) siga cayendo dentro de los ±5 puntos que la
    // propia UI considera "cerca" (mismo umbral que usa dzUpdateRk() al
    // comparar con la referencia bibliográfica).
    id: 'dz_rockwell_ref_table', group: 'Dureza',
    name: 'ROCKWELL_REF — todos los (slider, escala) reproducen su HR declarado (±5 pts)',
    run: () => {
      const bad = [];
      for (const [name, ref] of Object.entries(ROCKWELL_REF)) {
        const row = DZ_RK_NORMAL.find(r => r[0] === ref.scale);
        if (!row) { bad.push(`${name}: escala ${ref.scale} no está en DZ_RK_NORMAL`); continue; }
        const cm = row[2];
        const loadFactor = Math.sqrt(cm / 150);
        const depthRaw = (100 - ref.slider) * loadFactor;
        const hrCalc = Math.max(0, Math.min(100, Math.round(100 - depthRaw*0.95)));
        if (Math.abs(hrCalc - ref.hr) > 5) bad.push(`${name}: HR${ref.scale} calc=${hrCalc} vs tabla=${ref.hr}`);
      }
      if (bad.length) return { ok: false, msg: bad.join(' | ') };
      return { ok: true, msg: `${Object.keys(ROCKWELL_REF).length} materiales OK (±5 pts) ✓` };
    }
  },
  {
    id: 'dz_vickers_formula', group: 'Dureza',
    name: 'Vickers — HV = 1,854·P/d₁² (P convertido de gf a kgf)',
    run: () => {
      // FIX #5: P está en gf en la UI; la fórmula requiere kgf, así que se
      // divide por 1000 antes de aplicar la constante 1,854 (antes este test
      // tenía "hardcodeado" como esperado el resultado SIN esa conversión).
      const HV = 1.854*(100/1000)/(0.03*0.03);
      const expected = 206.0;
      if (Math.abs(HV - expected) > 1) return { ok: false, msg: `HV=${HV.toFixed(1)} ≠ ${expected}` };
      return { ok: true, msg: `HV(P=100gf=0,1kgf, d₁=0,03mm) = ${HV.toFixed(1)} ✓` };
    }
  },
  {
    id: 'dz_ts_correlation', group: 'Dureza',
    name: 'Correlación TS — ejercicio HB=150',
    run: () => {
      const mpa = 3.45*150, psi = 500*150;
      if (Math.abs(mpa - 517.5) > 0.01) return { ok: false, msg: `TS(MPa)=${mpa} ≠ 517.5` };
      if (Math.abs(psi - 75000) > 0.01) return { ok: false, msg: `TS(psi)=${psi} ≠ 75000` };
      if (!(mpa > 130)) return { ok: false, msg: 'TS calculado no supera la Tabla 6.2 (130 MPa) como espera el ejercicio' };
      return { ok: true, msg: `TS=517.5 MPa / 75000 psi, mayor que 130 MPa ✓` };
    }
  },
  {
    id: 'dz_conv_monotonic', group: 'Dureza',
    name: 'Conversión — interpolación monótona HRC→HB',
    run: () => {
      const a = dzInterp('hrc', 25, 'hb');
      const b = dzInterp('hrc', 45, 'hb');
      if (!(b > a)) return { ok: false, msg: `HB(45 HRC)=${b.toFixed(0)} no es mayor que HB(25 HRC)=${a.toFixed(0)}` };
      return { ok: true, msg: `HB crece con HRC: ${a.toFixed(0)} → ${b.toFixed(0)} ✓` };
    }
  },
  {
    // FIX #60 (QA exhaustivo v6.13, etapa 3): este test decía probar el
    // guard de FIX #30, pero ese guard ya no existe en dzUpdateJanka()
    // -- se quitó en QA v5.12 por ser código muerto (dz_jkF pasó de texto
    // libre a slider con min="10"). El test original recalculaba la
    // fórmula a mano con un F_safe_test inventado, sin llamar nunca a la
    // función real: no protegía nada del código actual.
    //
    // Se reescribe para ejercitar dzUpdateJanka() de verdad, a través del
    // slider real. Confirmado (jsdom y navegador real coinciden en esto,
    // por especificación HTML): asignarle a un <input type="range"> un
    // valor fuera de [min,max] queda clampeado automáticamente por el
    // propio elemento -- por eso F<=0 ya no puede llegarle a la función
    // por NINGÚN camino de la UI (ni siquiera "compartir enlace" con un
    // link viejo). Este test verifica esa protección real, no una fórmula
    // aislada.
    id: 'janka_fuerza_negativa', group: 'Dureza',
    name: 'Janka — el slider de fuerza clampea F<=0 antes de llegar a dzUpdateJanka() (FIX #30/#60)',
    run: () => {
      const matEl = document.getElementById('dz_jkMat');
      const matBefore = matEl.value;
      matEl.value = 'pino'; // asegura que ref exista, si no dzUpdateJanka toma la rama "elegí una especie" y no calcula profundidad
      const el = document.getElementById('dz_jkF');
      const before = el.value;
      el.value = '-999'; // intento de forzar un valor inválido
      const clamped = parseFloat(el.value);
      if (!(clamped > 0)) { el.value = before; matEl.value = matBefore; return { ok: false, msg: `el slider dejó pasar F=${el.value} (debería clampear a min="10")` }; }
      try {
        dzUpdateJanka();
      } catch (e) {
        el.value = before; matEl.value = matBefore;
        return { ok: false, msg: `dzUpdateJanka() tiró excepción con F clampeado a ${clamped}: ${e.message}` };
      }
      const depthEl = document.getElementById('dz_jkDepth');
      const shown = depthEl ? depthEl.textContent : null;
      el.value = before; matEl.value = matBefore; dzUpdateJanka(); // restaurar estado
      if (shown === null || /NaN|Infinity/.test(shown)) {
        return { ok: false, msg: `profundidad no finita en pantalla tras clamp: "${shown}"` };
      }
      return { ok: true, msg: `slider clampeó -999 → ${clamped}, dzUpdateJanka() corrió sin error, profundidad="${shown}" ✓` };
    }
  },
  {
    // FIX #63 (hallazgo QA v6.16, D15-01): el dibujo capea la profundidad a
    // 10mm (límite geométrico: la bola no puede hundirse más que su propio
    // radio), pero el número de profundidad no tenía ese tope -- para
    // maderas blandas con fuerza alta, el dibujo quedaba "trabado" mientras
    // el número seguía subiendo, sin explicación. Se verifica con Pino
    // (la madera con menor fuerza de referencia, la más fácil de superar el
    // umbral) en el extremo alto real del slider (2500 kgf, dentro de su
    // rango [10,2500]) que el aviso aparece, y que se oculta de nuevo con
    // una fuerza baja que no cruza el umbral.
    id: 'janka_aviso_dibujo_capeado', group: 'Dureza',
    name: 'Janka — aviso visible cuando el dibujo queda capeado a 10mm, oculto cuando no (FIX #63, hallazgo D15-01)',
    run: () => {
      const matEl = document.getElementById('dz_jkMat');
      const fEl = document.getElementById('dz_jkF');
      const warnEl = document.getElementById('dz_jkDrawWarn');
      const matBefore = matEl.value, fBefore = fEl.value;
      matEl.value = 'pino';
      fEl.value = '2500'; // depthRaw ≈ 32.6mm con Pino, muy por encima del cap de 10mm
      dzUpdateJanka();
      const visibleAlto = warnEl.style.display !== 'none';
      fEl.value = '10'; // fuerza mínima del slider, depthRaw bien por debajo de 10mm
      dzUpdateJanka();
      const ocultoBajo = warnEl.style.display === 'none';
      matEl.value = matBefore; fEl.value = fBefore; dzUpdateJanka();
      if (!visibleAlto) return { ok: false, msg: 'con Pino a 2500 kgf (profundidad ≈32mm) el aviso debería estar visible y no lo está' };
      if (!ocultoBajo) return { ok: false, msg: 'con Pino a 10 kgf (profundidad bien por debajo de 10mm) el aviso debería estar oculto y no lo está' };
      return { ok: true, msg: 'aviso visible cuando corresponde, oculto cuando no ✓' };
    }
  },
  // FIX #63 (hallazgo QA v6.16, D16-01): Esclerómetro no tenía NINGÚN test
  // -- era el único módulo de Dureza (de 8) en esa situación. Se agregan acá
  // los 2 que señalaba el hallazgo (monotonía de la interpolación, signo
  // correcto de la corrección angular en los 2 casos extremos) más 2
  // adicionales (clamp de Rcorr, consistencia con SCLERO_REF) para cubrir
  // el resto de la lógica del módulo con el mismo criterio ya usado en
  // Conversión de escalas (dz_conv_monotonic).
  {
    id: 'sclero_interp_monotona', group: 'Dureza',
    name: 'Esclerómetro — dzScleroInterp() es monótona creciente (R más alto → f_c más alto) (FIX #63, hallazgo D16-01)',
    run: () => {
      const puntos = [10, 20, 30, 40, 50, 60];
      const valores = puntos.map(dzScleroInterp);
      for (let i = 1; i < valores.length; i++) {
        if (valores[i] < valores[i-1]) return { ok: false, msg: `fc(R=${puntos[i]})=${valores[i]} < fc(R=${puntos[i-1]})=${valores[i-1]}` };
      }
      return { ok: true, msg: `monótona en R=${puntos.join(',')} ✓` };
    }
  },
  {
    id: 'sclero_correccion_angular_signo', group: 'Dureza',
    name: 'Esclerómetro — la corrección angular suma para golpe hacia abajo y resta para golpe hacia arriba (FIX #63, hallazgo D16-01)',
    run: () => {
      // Golpear hacia abajo (ensayo de piso): la gravedad se opone al
      // rebote → la lectura cruda da más baja de lo real → hay que SUMAR.
      if (!(SCLERO_ORIENT_CORRECTION.abajo90 > 0)) {
        return { ok: false, msg: `abajo90 debería ser positivo (suma), da ${SCLERO_ORIENT_CORRECTION.abajo90}` };
      }
      // Golpear hacia arriba (ensayo de techo): la gravedad ayuda al
      // rebote → la lectura cruda da más alta de lo real → hay que RESTAR.
      if (!(SCLERO_ORIENT_CORRECTION.arriba90 < 0)) {
        return { ok: false, msg: `arriba90 debería ser negativo (resta), da ${SCLERO_ORIENT_CORRECTION.arriba90}` };
      }
      if (SCLERO_ORIENT_CORRECTION.horizontal !== 0) {
        return { ok: false, msg: `horizontal debería ser 0 (sin corrección), da ${SCLERO_ORIENT_CORRECTION.horizontal}` };
      }
      return { ok: true, msg: 'abajo90 suma (+), arriba90 resta (-), horizontal=0 ✓' };
    }
  },
  {
    id: 'sclero_rcorr_clamp', group: 'Dureza',
    name: 'Esclerómetro — Rcorr queda dentro de [10,60] aunque la corrección angular lo saque del rango de la tabla (FIX #63, hallazgo D16-01)',
    run: () => {
      const rEl = document.getElementById('dz_scR');
      const orientEl = document.getElementById('dz_scOrient');
      const before = { r: rEl.value, orient: orientEl.value };
      // R=60 (máximo del slider) + corrección abajo90 (+3) -> sin clamp daría 63
      rEl.value = '60'; orientEl.value = 'abajo90'; dzUpdateSclero();
      const rCorrAlto = parseFloat(document.getElementById('dz_scRCorr').textContent);
      // R=10 (mínimo del slider) + corrección arriba90 (-3) -> sin clamp daría 7
      rEl.value = '10'; orientEl.value = 'arriba90'; dzUpdateSclero();
      const rCorrBajo = parseFloat(document.getElementById('dz_scRCorr').textContent);
      rEl.value = before.r; orientEl.value = before.orient; dzUpdateSclero();
      if (rCorrAlto > 60) return { ok: false, msg: `Rcorr=${rCorrAlto} > 60 con R=60 + abajo90` };
      if (rCorrBajo < 10) return { ok: false, msg: `Rcorr=${rCorrBajo} < 10 con R=10 + arriba90` };
      return { ok: true, msg: `Rcorr clampeado correctamente: ${rCorrAlto} (≤60) y ${rCorrBajo} (≥10) ✓` };
    }
  },
  {
    id: 'sclero_referencia_hormigon', group: 'Dureza',
    name: 'Esclerómetro — SCLERO_REF.hormigon (R=30) reproduce f_c=25 MPa vía dzScleroInterp() (FIX #63, hallazgo D16-01)',
    run: () => {
      const ref = SCLERO_REF.hormigon;
      const fc = dzScleroInterp(ref.r);
      if (Math.abs(fc - ref.fc) > 0.01) return { ok: false, msg: `dzScleroInterp(${ref.r})=${fc} no coincide con SCLERO_REF.hormigon.fc=${ref.fc}` };
      return { ok: true, msg: `dzScleroInterp(30)=${fc} MPa == SCLERO_REF.hormigon.fc ✓` };
    }
  },
  // ---- FRACTURA, FATIGA Y FLUENCIA (Unidad 3) ----
  {
    id: 'fr_ki_formula', group: 'Fractura, fatiga y fluencia',
    name: 'K_I = Y·σ·√(π·a) — valor analítico',
    run: () => {
      const Ki = frCalcKi(1.0, 300, 2); // Y=1, σ=300 MPa, a=2 mm
      const analytic = 1.0*300*Math.sqrt(Math.PI*(2/1000));
      if (Math.abs(Ki-analytic) > 0.01) return { ok: false, msg: `esperado ${analytic.toFixed(2)}, obtenido ${Ki.toFixed(2)}` };
      return { ok: true, msg: `K_I=${Ki.toFixed(2)} MPa√m ✓` };
    }
  },
  {
    id: 'fr_ac_roundtrip', group: 'Fractura, fatiga y fluencia',
    name: 'a_c — a la longitud crítica, K_I vuelve a valer K_IC',
    run: () => {
      const kic = 53, Y = 1.0, sigma = 300;
      const ac = frCalcAcMm(kic, Y, sigma);
      const Ki_en_ac = frCalcKi(Y, sigma, ac);
      if (Math.abs(Ki_en_ac-kic) > 0.1) return { ok: false, msg: `K_I(a_c)=${Ki_en_ac.toFixed(2)}, esperado K_IC=${kic}` };
      return { ok: true, msg: `a_c=${ac.toFixed(2)} mm → K_I=K_IC ✓` };
    }
  },
  {
    // FIX (Fase 8, punto 2): regresión sobre frSyncKicPresetValues() -- las 4
    // opciones con [data-material] deben terminar con el MISMO value que
    // PRESETS[x].frac.kic, no un número hardcodeado en el HTML que se pueda
    // desincronizar. Corre en el navegador (necesita el <select> del DOM).
    id: 'fr_kic_preset_sync', group: 'Fractura, fatiga y fluencia',
    name: 'rt_kicPreset — opciones con material se sincronizan con PRESETS[x].frac.kic',
    run: () => {
      const sel = document.getElementById('rt_kicPreset');
      if (!sel) return { warn: true, msg: 'No se encontró #rt_kicPreset (¿pestaña Fractura no cargada en el DOM?)' };
      const conMaterial = Array.from(sel.options).filter(o => o.dataset.material);
      if (conMaterial.length !== 4) return { ok: false, msg: `Se esperaban 4 opciones con [data-material], hay ${conMaterial.length}` };
      const errores = [];
      for (const opt of conMaterial) {
        const kic = PRESETS[opt.dataset.material]?.frac?.kic;
        if (kic === undefined) { errores.push(`${opt.dataset.material}: sin PRESETS[x].frac.kic`); continue; }
        if (Number(opt.value) !== kic) errores.push(`${opt.dataset.material}: option.value=${opt.value} ≠ PRESETS.kic=${kic}`);
      }
      if (errores.length) return { ok: false, msg: errores.join('; ') };
      return { ok: true, msg: `${conMaterial.length} opciones sincronizadas con PRESETS[x].frac.kic ✓` };
    }
  },
  {
    id: 'fr_charpy_dbtt', group: 'Fractura, fatiga y fluencia',
    name: 'Charpy — transición dúctil-frágil monótona (hasDBTT) o ~plana (sin DBTT) en todas las familias de FR_IMPACTO_PRESETS',
    // FIX (Fase 9d): antes hardcodeaba solo bajoC (monótona) y fcc (plana) a
    // mano. Ahora recorre TODAS las entradas de FR_IMPACTO_PRESETS y decide
    // qué chequear según su propio flag hasDBTT -- así bajoCFino (Fase 9,
    // grano fino) queda cubierto automáticamente sin duplicar el test, y una
    // 5ta familia futura tampoco va a requerir tocar tests.js.
    run: () => {
      const errores = [];
      Object.entries(FR_IMPACTO_PRESETS).forEach(([key, p]) => {
        const antes = frSigmoid(p.Tmid-40, p.Elow, p.Ehigh, p.Tmid, p.width);
        const enMedio = frSigmoid(p.Tmid, p.Elow, p.Ehigh, p.Tmid, p.width);
        const despues = frSigmoid(p.Tmid+40, p.Elow, p.Ehigh, p.Tmid, p.width);
        if (p.hasDBTT) {
          if (!(antes < enMedio && enMedio < despues)) errores.push(`${key}: no monótona (${antes.toFixed(1)}, ${enMedio.toFixed(1)}, ${despues.toFixed(1)})`);
        } else {
          const rango = despues - antes;
          if (Math.abs(rango) > 15) errores.push(`${key}: debería ser casi plana, varió ${rango.toFixed(1)} J`);
        }
      });
      if (errores.length) return { ok: false, msg: errores.join('; ') };
      return { ok: true, msg: `${Object.keys(FR_IMPACTO_PRESETS).length} familias verificadas (monótonas las con DBTT, planas las sin DBTT) ✓` };
    }
  },
  {
    id: 'fr_charpy_grano_fino_vs_grueso', group: 'Fractura, fatiga y fluencia',
    name: 'Charpy — grano fino (Fase 9) tiene menor DBTT y mayor meseta superior que grano grueso (Hall-Petch)',
    run: () => {
      const grueso = FR_IMPACTO_PRESETS.bajoC;
      const fino = FR_IMPACTO_PRESETS.bajoCFino;
      if (!(fino.Tmid < grueso.Tmid)) return { ok: false, msg: `Tmid grano fino (${fino.Tmid}) debería ser menor que grano grueso (${grueso.Tmid})` };
      if (!(fino.Ehigh >= grueso.Ehigh)) return { ok: false, msg: `Ehigh grano fino (${fino.Ehigh}) debería ser ≥ grano grueso (${grueso.Ehigh})` };
      return { ok: true, msg: `DBTT ${fino.Tmid}°C < ${grueso.Tmid}°C, meseta superior ${fino.Ehigh} ≥ ${grueso.Ehigh} J ✓` };
    }
  },
  {
    // FIX #63 (hallazgo QA v6.16, F22-01): ft_smax/ft_smin son dos campos
    // independientes sin validación cruzada. Con σ_min>σ_max, σ_a daba
    // negativo (magnitud que por definición nunca lo es) y R quedaba fuera
    // del rango convencional, sin ningún aviso -- mismo criterio que ya
    // tenían Tracción (e_warnSyTs) y Compresión (co_warnSycSc). Este test
    // confirma que el aviso aparece con los valores invertidos y desaparece
    // al corregirlos.
    id: 'ft_aviso_smin_mayor_smax', group: 'Fractura, fatiga y fluencia',
    name: 'Tensiones cíclicas — aviso cuando σ_min > σ_max (FIX #63, hallazgo F22-01)',
    run: () => {
      const smaxEl = document.getElementById('ft_smax');
      const sminEl = document.getElementById('ft_smin');
      const warnEl = document.getElementById('ft_warnSminSmax');
      const smaxBefore = smaxEl.value, sminBefore = sminEl.value;
      smaxEl.value = '100'; sminEl.value = '300'; // invertidos a propósito
      ftUpdateCiclicas();
      const visibleInvertido = warnEl.style.display !== 'none';
      smaxEl.value = '250'; sminEl.value = '-250'; // caso normal (alternado puro)
      ftUpdateCiclicas();
      const ocultoNormal = warnEl.style.display === 'none';
      smaxEl.value = smaxBefore; sminEl.value = sminBefore; ftUpdateCiclicas();
      if (!visibleInvertido) return { ok: false, msg: 'con σ_min=300 > σ_max=100 el aviso debería estar visible y no lo está' };
      if (!ocultoNormal) return { ok: false, msg: 'con σ_max=250/σ_min=-250 (caso normal) el aviso debería estar oculto y no lo está' };
      return { ok: true, msg: 'aviso visible cuando σ_min>σ_max, oculto en el caso normal ✓' };
    }
  },
  {
    id: 'ft_basquin_sn', group: 'Fractura, fatiga y fluencia',
    name: 'Basquin — vida a fatiga decrece con σ_a',
    run: () => {
      const p = FT_SN_PRESETS.acero1045;
      const N_alta = ftBasquinN(300, p.sfp, p.b);
      const N_baja = ftBasquinN(150, p.sfp, p.b);
      if (!(N_baja > N_alta)) return { ok: false, msg: `N(150MPa)=${N_baja.toExponential(2)} no es mayor que N(300MPa)=${N_alta.toExponential(2)}` };
      return { ok: true, msg: `N crece al bajar σ_a: ${N_alta.toExponential(2)} → ${N_baja.toExponential(2)} ✓` };
    }
  },
  {
    id: 'ft_paris_monotonic', group: 'Fractura, fatiga y fluencia',
    name: 'Ley de Paris — da/dN crece con ΔK',
    run: () => {
      const { parisC: C, parisM: m } = PRESETS.acero.frac;
      const bajo = ftDadN(10, C, m);
      const alto = ftDadN(30, C, m);
      if (!(alto > bajo)) return { ok: false, msg: `da/dN no crece con ΔK: ${bajo.toExponential(2)} → ${alto.toExponential(2)}` };
      return { ok: true, msg: `da/dN crece con ΔK: ${bajo.toExponential(2)} → ${alto.toExponential(2)} mm/ciclo ✓` };
    }
  },
  // FIX #63 (hallazgo QA v6.16, F26-01): Factores de Marin no tenía ningún
  // test -- mismo patrón ya corregido en Esclerómetro (D16-01). Se agregan
  // 3: la fórmula combinada, la propiedad de que S_e nunca puede superar a
  // S_e' (los 5 factores están siempre en [0,1], así que la reducción nunca
  // debería poder invertirse en un aumento), y el aviso de S_e'≤0.
  {
    id: 'ft_marin_factor_total', group: 'Fractura, fatiga y fluencia',
    name: 'Marin — S_e = S_e\'·k_a·k_b·k_c·k_d·k_e (FIX #63, hallazgo F26-01)',
    run: () => {
      const seBaseEl = document.getElementById('ft_seBase');
      const before = seBaseEl.value;
      seBaseEl.value = '400';
      document.getElementById('ft_ka').value = '0.9';
      document.getElementById('ft_kb').value = '0.85';
      document.getElementById('ft_kc').value = '1.0';
      document.getElementById('ft_kd').value = '1.0';
      document.getElementById('ft_ke').value = '0.897';
      ftUpdateFactores();
      const se = parseFloat(document.getElementById('ft_mSe').textContent);
      const esperado = 400*0.9*0.85*1.0*1.0*0.897;
      seBaseEl.value = before; ftUpdateFactores();
      if (Math.abs(se-esperado) > 1) return { ok: false, msg: `S_e mostrado=${se}, esperado≈${esperado.toFixed(0)}` };
      return { ok: true, msg: `S_e=${se} ≈ ${esperado.toFixed(0)} MPa ✓` };
    }
  },
  {
    id: 'ft_marin_se_nunca_supera_sebase', group: 'Fractura, fatiga y fluencia',
    name: 'Marin — S_e nunca supera a S_e\' (los 5 factores están siempre en [0,1]) (FIX #63, hallazgo F26-01)',
    run: () => {
      const seBaseEl = document.getElementById('ft_seBase');
      const before = seBaseEl.value;
      seBaseEl.value = '500';
      // valores altos deliberados (cercanos o iguales al máximo de cada slider/opción)
      document.getElementById('ft_ka').value = '1.0';
      document.getElementById('ft_kb').value = '1.0';
      document.getElementById('ft_kc').value = '1.0';
      document.getElementById('ft_kd').value = '1.0';
      document.getElementById('ft_ke').value = '1.0';
      ftUpdateFactores();
      const se = parseFloat(document.getElementById('ft_mSe').textContent);
      seBaseEl.value = before; ftUpdateFactores();
      if (se > 500) return { ok: false, msg: `S_e=${se} > S_e'=500 con todos los factores en 1.0 -- no debería poder pasar` };
      return { ok: true, msg: `S_e=${se} ≤ S_e'=500 incluso con todos los factores al máximo ✓` };
    }
  },
  {
    id: 'ft_marin_warn_sebase_invalido', group: 'Fractura, fatiga y fluencia',
    name: 'Marin — aviso cuando S_e\' es inválido (≤0) (FIX #63, hallazgo F26-01)',
    run: () => {
      const seBaseEl = document.getElementById('ft_seBase');
      const warnEl = document.getElementById('ft_marinWarn');
      const before = seBaseEl.value;
      seBaseEl.value = '-50';
      ftUpdateFactores();
      const visibleNegativo = warnEl.style.display !== 'none';
      const seShown = document.getElementById('ft_mSe').textContent;
      seBaseEl.value = '400';
      ftUpdateFactores();
      const ocultoValido = warnEl.style.display === 'none';
      seBaseEl.value = before; ftUpdateFactores();
      if (!visibleNegativo) return { ok: false, msg: 'con S_e\'=-50 el aviso debería estar visible y no lo está' };
      if (seShown !== '—') return { ok: false, msg: `con S_e'=-50 el resultado debería mostrar "—", muestra "${seShown}"` };
      if (!ocultoValido) return { ok: false, msg: 'con S_e\'=400 (válido) el aviso debería estar oculto y no lo está' };
      return { ok: true, msg: 'aviso visible con S_e\'≤0, oculto con dato válido ✓' };
    }
  },
  {
    id: 'fl_dorn_temp_sensitivity', group: 'Fractura, fatiga y fluencia',
    name: 'Ecuación de Dorn — ε̇_s crece con la temperatura',
    run: () => {
      const mat = { K: PRESETS.aluminio.frac.K, n: PRESETS.aluminio.frac.n, Qc: PRESETS.aluminio.frac.Qc };
      const bajaT = flEpsDot(mat, 100, 300);
      const altaT = flEpsDot(mat, 100, 450);
      if (!(altaT > bajaT)) return { ok: false, msg: `ε̇_s no crece con T: ${bajaT.toExponential(2)} → ${altaT.toExponential(2)}` };
      return { ok: true, msg: `ε̇_s crece con T: ${bajaT.toExponential(2)} → ${altaT.toExponential(2)} /h ✓` };
    }
  },
  {
    id: 'fl_larson_miller_roundtrip', group: 'Fractura, fatiga y fluencia',
    name: 'Larson-Miller — ida y vuelta recupera t_r original',
    run: () => {
      const C = 20, T_K = 900+273.15, trOriginal = 1000;
      const LMP = flLarsonMillerP(T_K, C, trOriginal);
      const trRecuperado = flLarsonMillerTr(LMP, T_K, C);
      const errorPct = Math.abs(trRecuperado-trOriginal)/trOriginal*100;
      if (errorPct > 1) return { ok: false, msg: `t_r original=${trOriginal}, recuperado=${trRecuperado.toFixed(1)} (${errorPct.toFixed(2)}% error)` };
      return { ok: true, msg: `t_r=${trOriginal}h recuperado=${trRecuperado.toFixed(1)}h ✓` };
    }
  },
  {
    id: 'frac_presets_integrados', group: 'Fractura, fatiga y fluencia',
    name: 'PRESETS.frac — integración con tracción/compresión (Fase 1) intacta',
    run: () => {
      const esperado = {
        acero:     ['kic','parisC','parisM'],
        aluminio:  ['kic','parisC','parisM','K','n','Qc'],
        titanio:   ['kic','parisC','parisM'],
        aceroinox: ['K','n','Qc'],
        ceramica:  ['kic'],
      };
      const faltantes = [];
      for (const [mat, campos] of Object.entries(esperado)) {
        if (!PRESETS[mat] || !PRESETS[mat].frac) { faltantes.push(`${mat}.frac no existe`); continue; }
        for (const campo of campos) {
          if (PRESETS[mat].frac[campo] === undefined) faltantes.push(`${mat}.frac.${campo}`);
        }
      }
      if (faltantes.length) return { ok: false, msg: `Faltantes: ${faltantes.join(', ')}` };
      return { ok: true, msg: `PRESETS.frac completo para 5 materiales ✓` };
    }
  },
  {
    id: 'frac_presets_fase5a', group: 'Fractura, fatiga y fluencia',
    name: 'PRESETS.frac — Fase 5a (11 materiales nuevos) según el criterio acordado',
    run: () => {
      const esperado = {
        cobre:      ['parisC','parisM'],
        niquel:     ['parisC','parisM'],
        zinc:       ['K','n','Qc'],
        plomo:      ['K','n','Qc'],
        molibdeno:  ['kic','K','n','Qc'],
        tungsteno:  ['kic','K','n','Qc'],
        laton:      ['kic','parisC','parisM'],
        magnesio:   ['kic','parisC','parisM'],
        fragil:     ['kic'],
        hormigon:   ['kic'],
        nylon:      ['kic'],
      };
      // negativo: estos NO deberían tener .frac -- si aparece, alguien fabricó
      // un valor sin respaldo real (Cu/Ni/Au/Ag son demasiado dúctiles para K_IC
      // convencional; oro/plata/madera/pino/algarrobo/quebracho/carbono no
      // tienen dato real de ningún tipo cargado)
      const sinFrac = ['oro','plata','madera','pino','algarrobo','quebracho','carbono'];
      const faltantes = [];
      for (const [mat, campos] of Object.entries(esperado)) {
        if (!PRESETS[mat] || !PRESETS[mat].frac) { faltantes.push(`${mat}.frac no existe`); continue; }
        for (const campo of campos) {
          if (PRESETS[mat].frac[campo] === undefined) faltantes.push(`${mat}.frac.${campo}`);
        }
        // cobre/niquel no deben tener kic (fundamento: no aplica K_IC convencional en metales muy dúctiles)
        if ((mat==='cobre'||mat==='niquel') && PRESETS[mat].frac.kic !== undefined) faltantes.push(`${mat}.frac.kic no debería existir`);
      }
      for (const mat of sinFrac) {
        if (PRESETS[mat] && PRESETS[mat].frac) faltantes.push(`${mat}.frac no debería existir (sin dato real)`);
      }
      if (faltantes.length) return { ok: false, msg: `Faltantes/inconsistencias: ${faltantes.join(', ')}` };
      return { ok: true, msg: `11 materiales nuevos con el campo correcto, 7 correctamente sin .frac ✓` };
    }
  },
  {
    id: 'rt_export_defined', group: 'Fractura, fatiga y fluencia',
    name: 'Exportación de gráficos (Fase 3) — función definida',
    run: () => {
      if (typeof exportRoturaChart !== 'function') return { ok: false, msg: 'exportRoturaChart no definida' };
      const botones = document.querySelectorAll('[onclick^="exportRoturaChart"]').length;
      if (botones !== 9) return { ok: false, msg: `Botones de exportación: ${botones} (esperado 9, uno por gráfico)` };
      return { ok: true, msg: `exportRoturaChart definida, ${botones}/9 botones ✓` };
    }
  },
  {
    id: 'ficha_material_defined', group: 'Ficha técnica (Fase 4)',
    name: 'openFichaPicker / renderFichaMaterial — funciones y botón de header definidos',
    run: () => {
      if (typeof openFichaPicker !== 'function') return { ok: false, msg: 'openFichaPicker no definida' };
      if (typeof renderFichaMaterial !== 'function') return { ok: false, msg: 'renderFichaMaterial no definida' };
      if (!document.getElementById('fichaHeaderBtn')) return { ok: false, msg: 'Botón de header #fichaHeaderBtn no existe' };
      const nMat = Object.keys(MATERIAL_LABELS).length;
      const nPresets = Object.keys(PRESETS).length;
      if (nMat !== nPresets) return { warn: true, msg: `MATERIAL_LABELS tiene ${nMat} entradas, PRESETS tiene ${nPresets} — revisar si falta alguna etiqueta` };
      return { ok: true, msg: `Funciones y botón OK, ${nMat} materiales con etiqueta ✓` };
    }
  },
  {
    id: 'ficha_disponibilidad_honesta', group: 'Ficha técnica (Fase 4)',
    name: 'Ficha — no inventa Unidad 3 para materiales sin esos datos',
    run: () => {
      // acero: tiene K_IC y Paris, NO tiene fluencia (Fase 1)
      const acero = PRESETS.acero.frac || {};
      if (acero.kic === undefined || acero.parisC === undefined) return { ok: false, msg: 'acero debería tener K_IC y Paris' };
      if (acero.K !== undefined) return { ok: false, msg: 'acero no debería tener parámetros de fluencia (no hay dato real)' };
      // madera: no tiene ningún dato de Unidad 3 -- la ficha debe mostrar el aviso, no fabricar valores
      if (PRESETS.madera.frac !== undefined) return { ok: false, msg: 'madera no debería tener .frac (sin dato real de fractura/fatiga/fluencia)' };
      return { ok: true, msg: 'Disponibilidad por material coincide con los datos reales de PRESETS.frac ✓' };
    }
  },
  {
    // FIX (Fase 8, punto 1): la ficha ahora suma un resumen S-N/Basquin junto
    // al de Paris, SOLO para los 3 materiales mapeados en FICHA_SN_REF, y
    // rotulado con el grado de referencia (ej. "Acero 1045") -- no debe
    // aparecer para materiales sin mapeo (ej. cobre, que sí tiene Paris pero
    // no un grado S-N de referencia asignado).
    id: 'ficha_sn_basquin', group: 'Ficha técnica (Fase 4)',
    name: 'Ficha — resumen S-N/Basquin (Fase 8) presente solo para materiales con grado de referencia',
    run: () => {
      const errores = [];
      try {
        openFichaPicker();
        document.getElementById('fichaMatSelect').value = 'acero';
        renderFichaMaterial();
        const htmlAcero = document.getElementById('fichaBody').innerHTML;
        if (!/Curva S-N \(Basquin\)/.test(htmlAcero)) errores.push('acero: falta el resumen S-N');
        if (!htmlAcero.includes(FT_SN_PRESETS.acero1045.label)) errores.push('acero: no cita el grado de referencia (Acero 1045)');
        // Mismo branching que renderFichaMaterial(): con σ_a=200 ≤ S_e=310
        // (Acero 1045) da vida infinita, no un Nf finito.
        const p1045 = FT_SN_PRESETS.acero1045;
        const infinita = p1045.hasLimit && FICHA_SN_SA_EJEMPLO <= p1045.Se;
        const textoEsperado = infinita ? 'mayor a 10⁷ ciclos (infinita)' : ftBasquinN(FICHA_SN_SA_EJEMPLO, p1045.sfp, p1045.b).toExponential(2);
        if (!htmlAcero.includes(textoEsperado)) errores.push(`acero: vida estimada no coincide (esperado "${textoEsperado}")`);

        openFichaPicker();
        document.getElementById('fichaMatSelect').value = 'cobre';
        renderFichaMaterial();
        const htmlCobre = document.getElementById('fichaBody').innerHTML;
        if (/Curva S-N \(Basquin\)/.test(htmlCobre)) errores.push('cobre: no debería mostrar resumen S-N (sin grado de referencia mapeado)');
      } finally {
        closeFicha();
      }
      if (errores.length) return { ok: false, msg: errores.join('; ') };
      return { ok: true, msg: 'Resumen S-N correcto en acero (con referencia y vida estimada), ausente en cobre ✓' };
    }
  },
  {
    id: 'ficha_hb_correlacion', group: 'Ficha técnica (Fase 4)',
    name: 'Ficha — dureza estimada usa la misma correlación TS≈3.45·HB del ejercicio de dureza',
    run: () => {
      const hbEst = PRESETS.acero.ts/3.45;
      const esperado = 450/3.45;
      if (Math.abs(hbEst-esperado) > 0.01) return { ok: false, msg: `HB estimado=${hbEst.toFixed(1)}, esperado=${esperado.toFixed(1)}` };
      return { ok: true, msg: `HB estimado(acero)=${hbEst.toFixed(0)} (misma correlación que dz_ts_correlation) ✓` };
    }
  },
  {
    id: 'ficha_graficos_fase5b', group: 'Ficha técnica (Fase 4)',
    name: 'Ficha — gráficos (Fase 5b) según los datos disponibles por material',
    run: () => {
      const casos = [
        { mat:'aluminio', esperados:['fichaMatTraccionChart','fichaMatFracChart','fichaMatFatigaChart','fichaMatFluenciaChart'] },
        { mat:'madera',   esperados:['fichaMatTraccionChart'] },
        { mat:'zinc',     esperados:['fichaMatTraccionChart','fichaMatFluenciaChart'] },
        { mat:'cobre',    esperados:['fichaMatTraccionChart','fichaMatFatigaChart'] },
      ];
      const errores = [];
      // FIX (bug real, no cosmético): renderFichaMaterial() reemplaza TODO
      // #fichaBody -- incluido el <select> que crea openFichaPicker(). Antes
      // este test abría el picker una sola vez y reusaba el mismo <select>
      // para los 4 materiales del loop; a partir de la 2da vuelta el select
      // ya no existía (lo había pisado la ficha del material anterior), el
      // test tiraba una excepción, y como esa excepción no pasaba por
      // closeFicha(), el modal quedaba abierto -- por eso al correr "todos
      // los tests" aparecía la ficha completa en pantalla. Ahora se reabre el
      // picker antes de CADA material, y closeFicha() corre siempre (finally).
      try {
        for (const {mat, esperados} of casos) {
          openFichaPicker();
          const sel = document.getElementById('fichaMatSelect');
          if (!sel) { errores.push(`${mat}: no se encontró #fichaMatSelect tras openFichaPicker()`); continue; }
          sel.value = mat;
          try { renderFichaMaterial(); } catch(e) { errores.push(`${mat}: excepción ${e.message}`); continue; }
          const html = document.getElementById('fichaBody').innerHTML;
          for (const id of esperados) if (!html.includes(`id="${id}"`)) errores.push(`${mat}: falta canvas ${id}`);
          const noEsperados = ['fichaMatFracChart','fichaMatFatigaChart','fichaMatFluenciaChart'].filter(id => !esperados.includes(id));
          for (const id of noEsperados) if (html.includes(`id="${id}"`)) errores.push(`${mat}: no debería tener canvas ${id}`);
        }
      } finally {
        closeFicha();
      }
      if (errores.length) return { ok: false, msg: errores.join('; ') };
      return { ok: true, msg: 'Canvas correctos para 4 materiales con distinta disponibilidad de datos ✓' };
    }
  },
  {
    id: 'ficha_compresion_cruzada', group: 'Ficha técnica (Fase 4)',
    name: 'Ficha — lee Compresión solo si el material coincide con el seleccionado ahí',
    run: () => {
      const coSel = document.getElementById('co_preset');
      if (!coSel) return { warn: true, msg: 'No se encontró #co_preset (¿pestaña Compresión no cargada en el DOM?)' };
      const original = coSel.value;
      let tieneDatosCoincide = false, tieneAvisoNoCoincide = false;
      // FIX: mismo motivo que en ficha_graficos_fase5b -- hay que reabrir el
      // picker antes de CADA material porque renderFichaMaterial() se come el
      // <select> anterior, y todo va en try/finally para que closeFicha() y
      // la restauración de co_preset corran siempre, incluso si algo falla.
      try {
        openFichaPicker();
        coSel.value = 'acero';
        document.getElementById('fichaMatSelect').value = 'acero';
        renderFichaMaterial();
        const htmlCoincide = document.getElementById('fichaBody').innerHTML;
        tieneDatosCoincide = /Valores tomados de la pestaña Compresión/.test(htmlCoincide);

        openFichaPicker();
        document.getElementById('fichaMatSelect').value = 'aluminio';
        renderFichaMaterial();
        const htmlNoCoincide = document.getElementById('fichaBody').innerHTML;
        tieneAvisoNoCoincide = /Sin datos propios de compresión/.test(htmlNoCoincide);
      } finally {
        coSel.value = original;
        closeFicha();
      }
      if (!tieneDatosCoincide) return { ok: false, msg: 'No mostró los datos de Compresión con el material coincidente' };
      if (!tieneAvisoNoCoincide) return { ok: false, msg: 'Mostró datos de Compresión con un material que no coincide' };
      return { ok: true, msg: 'Lectura cruzada con Compresión correcta (coincide → datos, no coincide → aviso) ✓' };
    }
  },
  {
    id: 'dureza_presets_integrados', group: 'Dureza',
    name: 'ROCKWELL_REF/BRINELL_REF/VICKERS_REF — integrados con PRESETS.dureza (Fase 6a)',
    run: () => {
      const casos = [
        ['acero', 'hb', BRINELL_REF, 130], ['acero', 'hv', VICKERS_REF, 135],
        ['aluminio', 'hb', BRINELL_REF, 95], ['titanio', 'hv', VICKERS_REF, 349],
      ];
      const errores = [];
      for (const [mat, campo, ref, esperado] of casos) {
        const presetsVal = PRESETS[mat]?.dureza?.[campo];
        if (presetsVal !== esperado) errores.push(`PRESETS.${mat}.dureza.${campo}=${presetsVal} (esperado ${esperado})`);
        if (ref[mat]?.[campo] !== esperado) errores.push(`${campo==='hb'?'BRINELL_REF':'VICKERS_REF'}.${mat}.${campo}=${ref[mat]?.[campo]} (esperado ${esperado}, debería venir de PRESETS)`);
      }
      const rkAcero = ROCKWELL_REF.acero;
      if (!rkAcero || rkAcero.scale !== 'B' || rkAcero.hr !== 70) errores.push(`ROCKWELL_REF.acero=${JSON.stringify(rkAcero)} (esperado scale:B, hr:70)`);
      if (errores.length) return { ok: false, msg: errores.join('; ') };
      return { ok: true, msg: 'Las 3 tablas de dureza leen de PRESETS.dureza, valores consistentes ✓' };
    }
  },
  {
    id: 'dureza_export_defined', group: 'Dureza',
    name: 'Exportación del gráfico de correlación TS-HB (Fase 6b) — función y botón definidos',
    run: () => {
      if (typeof exportTsChart !== 'function') return { ok: false, msg: 'exportTsChart no definida' };
      const boton = document.querySelector('[onclick="exportTsChart()"]');
      if (!boton) return { ok: false, msg: 'No se encontró el botón de exportar en la pestaña Dureza' };
      return { ok: true, msg: 'exportTsChart definida y botón presente ✓' };
    }
  },
  {
    id: 'ficha_dureza_real_vs_estimada', group: 'Ficha técnica (Fase 4)',
    name: 'Ficha — usa HB/HV/HR reales (Fase 6) en vez de la correlación cuando existen',
    run: () => {
      openFichaPicker();
      let errores = [];
      try {
        document.getElementById('fichaMatSelect').value = 'acero';
        renderFichaMaterial();
        const htmlAcero = document.getElementById('fichaBody').innerHTML;
        if (!/HB \(Brinell\)<\/span><span class="fv">130/.test(htmlAcero)) errores.push('acero: no mostró HB real (130)');
        if (/HB estimado/.test(htmlAcero)) errores.push('acero: no debería mostrar el estimado, tiene dato real');

        openFichaPicker();
        document.getElementById('fichaMatSelect').value = 'madera';
        renderFichaMaterial();
        const htmlMadera = document.getElementById('fichaBody').innerHTML;
        if (!/HB estimado/.test(htmlMadera)) errores.push('madera: debería mostrar el estimado (no tiene dato real de dureza)');
      } finally {
        closeFicha();
      }
      if (errores.length) return { ok: false, msg: errores.join('; ') };
      return { ok: true, msg: 'Ficha prioriza HB/HV/HR real sobre la correlación cuando el material lo tiene ✓' };
    }
  },
  // FIX (Fase 7 — sync cruzado de material, pedido pendiente desde v2.3):
  // tests de assets/material-sync.js. Todos restauran el valor original de
  // cada <select> tocado en un finally, para no dejar el DOM en un estado
  // distinto al que tenía antes de correr la suite (varios tests de arriba,
  // ej. dureza_presets_integrados, asumen los selects en su estado inicial).
  {
    id: 'sync_excluye_2_slots', group: 'Sincronización de material (Fase 7)',
    name: 'Registro de sync NO incluye Comparar/Compuesto (2 materiales a la vez)',
    run: () => {
      const ids = MATERIAL_SYNC_TARGETS.map(t => t.id);
      const noDeberian = ['k1_preset', 'k2_preset']; // Comparar (c1/c2) no tiene <select> con id
      const presentes = noDeberian.filter(id => ids.includes(id));
      if (presentes.length) return { ok: false, msg: `El registro incluye selectores de 2 slots que deberían quedar afuera: ${presentes.join(', ')}` };
      return { ok: true, msg: `Registro con ${ids.length} selectores, ninguno de Comparar/Compuesto ✓` };
    }
  },
  {
    id: 'sync_material_completo', group: 'Sincronización de material (Fase 7)',
    name: 'syncMaterialToAllTests — "Acero" se aplica en las 7 pestañas donde corresponde, no toca Janka/Esclerómetro',
    run: () => {
      const ids = ['e_preset','co_preset','t_preset','dz_rkMat','dz_brMat','dz_vMat','dz_jkMat','dz_scMat','ft_parisMat'];
      const originales = {}; ids.forEach(id => { const el = document.getElementById(id); originales[id] = el ? el.value : undefined; });
      const errores = [];
      try {
        document.getElementById('dz_jkMat').value = 'quebracho'; // material sin relación, para confirmar que NO se pisa
        document.getElementById('dz_scMat').value = ''; // Esclerómetro solo tiene hormigón como opción -- 'acero' nunca puede coincidir
        document.getElementById('e_preset').value = 'acero';
        syncMaterialToAllTests('e_preset');
        const esperanAcero = ['co_preset','t_preset','dz_rkMat','dz_brMat','dz_vMat','ft_parisMat'];
        for (const id of esperanAcero) {
          if (document.getElementById(id).value !== 'acero') errores.push(`${id} no quedó en 'acero'`);
        }
        if (document.getElementById('co_E').value !== String(PRESETS.acero.E)) errores.push('co_E no se actualizó con applyPresetComp0() real');
        if (document.getElementById('dz_jkMat').value !== 'quebracho') errores.push('dz_jkMat se tocó (Janka es solo maderas, "acero" no debería afectarlo)');
        if (document.getElementById('dz_scMat').value !== '') errores.push('dz_scMat se tocó (Esclerómetro es solo hormigón)');
      } finally {
        ids.forEach(id => { const el = document.getElementById(id); if (el && originales[id] !== undefined) el.value = originales[id]; });
      }
      if (errores.length) return { ok: false, msg: errores.join('; ') };
      return { ok: true, msg: 'Sync de "Acero" correcto: 6 pestañas actualizadas con valores reales, Janka/Esclerómetro intactos ✓' };
    }
  },
  {
    id: 'sync_material_parcial', group: 'Sincronización de material (Fase 7)',
    name: 'syncMaterialToAllTests — "Oro" no está en Rockwell (metal blando excluido de esa tabla, ver dureza-rockwell.js)',
    run: () => {
      const ids = ['e_preset','dz_rkMat','dz_brMat','dz_vMat'];
      const originales = {}; ids.forEach(id => { const el = document.getElementById(id); originales[id] = el ? el.value : undefined; });
      const errores = [];
      try {
        document.getElementById('dz_rkMat').value = 'aluminio'; // para confirmar que NO se pisa con 'oro'
        document.getElementById('e_preset').value = 'oro';
        syncMaterialToAllTests('e_preset');
        if (document.getElementById('dz_brMat').value !== 'oro') errores.push('dz_brMat debería quedar en "oro" (Brinell sí tiene oro)');
        if (document.getElementById('dz_vMat').value !== 'oro') errores.push('dz_vMat debería quedar en "oro" (Vickers sí tiene oro)');
        if (document.getElementById('dz_rkMat').value !== 'aluminio') errores.push('dz_rkMat se pisó con "oro", pero Rockwell no tiene oro en su <select>');
      } finally {
        ids.forEach(id => { const el = document.getElementById(id); if (el && originales[id] !== undefined) el.value = originales[id]; });
      }
      if (errores.length) return { ok: false, msg: errores.join('; ') };
      return { ok: true, msg: 'Sync parcial correcto: Brinell/Vickers reciben "oro", Rockwell queda intacto ✓' };
    }
  },
  {
    id: 'sync_sin_seleccion', group: 'Sincronización de material (Fase 7)',
    name: 'syncMaterialToAllTests — sin material elegido en el origen, no rompe ni toca otras pestañas',
    run: () => {
      const original = document.getElementById('co_preset').value;
      const eOriginal = document.getElementById('e_preset').value;
      let excepcion = null;
      try {
        document.getElementById('e_preset').value = '';
        syncMaterialToAllTests('e_preset');
      } catch (e) { excepcion = e.message; }
      const coSigueIgual = document.getElementById('co_preset').value === original;
      document.getElementById('e_preset').value = eOriginal;
      if (excepcion) return { ok: false, msg: `Tiró una excepción: ${excepcion}` };
      if (!coSigueIgual) return { ok: false, msg: 'Sin material elegido igual modificó Compresión' };
      return { ok: true, msg: 'Selector vacío: no hace nada y no rompe ✓' };
    }
  },
  // FIX (QA v5.5 → v5.6, hallazgo Etapas 8/11): confirma que el gap quedó
  // cerrado -- los 3 targets de Grupo B (END) ahora están en el registro.
  {
    id: 'sync_grupob_incluye_end', group: 'Sincronización de material (Grupo B, v5.6)',
    name: 'Registro de sync incluye ect_metal/ut_metal/rx_material (antes ausentes pese a tener botón de sync en el HTML)',
    run: () => {
      const ids = MATERIAL_SYNC_TARGETS.map(t => t.id);
      const faltan = ['ect_metal', 'ut_metal', 'rx_material'].filter(id => !ids.includes(id));
      if (faltan.length) return { ok: false, msg: `Faltan en el registro: ${faltan.join(', ')}` };
      return { ok: true, msg: 'ect_metal/ut_metal/rx_material presentes en el registro ✓' };
    }
  },
  // FIX (v4.6 — integración Grupo A al sync): tests de los 3 nuevos targets
  // con keyMap (cr_metal/po_polimero/ds_par) y de la exclusión de tr_cal.
  // Mismo criterio de arriba: todo <select> tocado se restaura en un finally.
  {
    id: 'sync_grupoa_excluye_tr', group: 'Sincronización de material (Grupo A, v4.6)',
    name: 'Registro de sync NO incluye tr_cal (geometría de roseta, no es un material)',
    run: () => {
      const ids = MATERIAL_SYNC_TARGETS.map(t => t.id);
      if (ids.includes('tr_cal')) return { ok: false, msg: 'tr_cal está en el registro y no debería (no es un material, ver tensiones-residuales.js)' };
      const incluye = ['cr_metal', 'po_polimero', 'ds_par'].every(id => ids.includes(id));
      if (!incluye) return { ok: false, msg: 'Falta alguno de cr_metal/po_polimero/ds_par en el registro' };
      return { ok: true, msg: 'tr_cal afuera, cr_metal/po_polimero/ds_par adentro ✓' };
    }
  },
  {
    id: 'sync_grupoa_desde_traccion', group: 'Sincronización de material (Grupo A, v4.6)',
    name: 'syncMaterialToAllTests("e_preset") con "Acero" también llega a Corrosión (hierro) y Desgaste (aceroacero), no a Polímeros',
    run: () => {
      const ids = ['e_preset', 'cr_metal', 'po_polimero', 'ds_par'];
      const originales = {}; ids.forEach(id => { const el = document.getElementById(id); originales[id] = el ? el.value : undefined; });
      const errores = [];
      try {
        document.getElementById('e_preset').value = 'acero';
        syncMaterialToAllTests('e_preset');
        if (document.getElementById('cr_metal').value !== 'hierro') errores.push(`cr_metal quedó en "${document.getElementById('cr_metal').value}", esperaba "hierro"`);
        if (document.getElementById('ds_par').value !== 'aceroacero') errores.push(`ds_par quedó en "${document.getElementById('ds_par').value}", esperaba "aceroacero"`);
      } finally {
        ids.forEach(id => { const el = document.getElementById(id); if (el && originales[id] !== undefined) el.value = originales[id]; });
      }
      if (errores.length) return { ok: false, msg: errores.join('; ') };
      return { ok: true, msg: 'Acero → Corrosión (hierro) y Desgaste (aceroacero) via keyMap ✓' };
    }
  },
  {
    id: 'sync_grupoa_hacia_traccion', group: 'Sincronización de material (Grupo A, v4.6)',
    name: 'syncMaterialToAllTests("cr_metal") con "Titanio (Ti)" traduce hacia atrás y llega a Tracción como "titanio"',
    run: () => {
      const ids = ['e_preset', 'cr_metal'];
      const originales = {}; ids.forEach(id => { const el = document.getElementById(id); originales[id] = el ? el.value : undefined; });
      const errores = [];
      try {
        document.getElementById('cr_metal').value = 'titanio';
        syncMaterialToAllTests('cr_metal');
        if (document.getElementById('e_preset').value !== 'titanio') errores.push(`e_preset quedó en "${document.getElementById('e_preset').value}", esperaba "titanio"`);
      } finally {
        ids.forEach(id => { const el = document.getElementById(id); if (el && originales[id] !== undefined) el.value = originales[id]; });
      }
      if (errores.length) return { ok: false, msg: errores.join('; ') };
      return { ok: true, msg: 'cr_metal="titanio" traduce correctamente de vuelta a la clave PRESETS "titanio" ✓' };
    }
  },
  {
    id: 'sync_grupoa_parcial', group: 'Sincronización de material (Grupo A, v4.6)',
    name: 'syncMaterialToAllTests — "Cobre" llega a Corrosión pero no a Desgaste ni Polímeros (sin equivalente real en esas tablas)',
    run: () => {
      const ids = ['e_preset', 'cr_metal', 'po_polimero', 'ds_par'];
      const originales = {}; ids.forEach(id => { const el = document.getElementById(id); originales[id] = el ? el.value : undefined; });
      const errores = [];
      try {
        document.getElementById('po_polimero').value = 'pmma'; // para confirmar que NO se pisa
        document.getElementById('ds_par').value = 'ptfe'; // para confirmar que NO se pisa
        document.getElementById('e_preset').value = 'cobre';
        syncMaterialToAllTests('e_preset');
        if (document.getElementById('cr_metal').value !== 'cobre') errores.push('cr_metal debería quedar en "cobre" (Corrosión sí tiene cobre)');
        if (document.getElementById('po_polimero').value !== 'pmma') errores.push('po_polimero se pisó, pero "cobre" no tiene equivalente en la tabla de polímeros');
        if (document.getElementById('ds_par').value !== 'ptfe') errores.push('ds_par se pisó, pero "cobre" no está en DS_KEY_MAP');
      } finally {
        ids.forEach(id => { const el = document.getElementById(id); if (el && originales[id] !== undefined) el.value = originales[id]; });
      }
      if (errores.length) return { ok: false, msg: errores.join('; ') };
      return { ok: true, msg: 'Sync parcial correcto: Corrosión recibe "cobre", Desgaste/Polímeros quedan intactos ✓' };
    }
  },
  // FIX (QA v5.5 → v5.6, hallazgo Etapas 8/11): Corrientes inducidas,
  // Ultrasonido y Radiografía se suman recién ahora al registro de sync
  // (existían desde v5.1/v5.2/v5.4 sin estar integradas). Estos 3 tests
  // siguen el mismo criterio que los de Grupo A de arriba.
  {
    id: 'sync_grupob_desde_traccion', group: 'Sincronización de material (Grupo B, v5.6)',
    name: 'syncMaterialToAllTests("e_preset") con "Titanio" llega a ECT/UT/RX correctamente',
    run: () => {
      const ids = ['e_preset', 'ect_metal', 'ut_metal', 'rx_material'];
      const originales = {}; ids.forEach(id => { const el = document.getElementById(id); originales[id] = el ? el.value : undefined; });
      const errores = [];
      try {
        document.getElementById('e_preset').value = 'titanio';
        syncMaterialToAllTests('e_preset');
        if (document.getElementById('ect_metal').value !== 'titanio') errores.push(`ect_metal quedó en "${document.getElementById('ect_metal').value}", esperaba "titanio"`);
        // "titanio" no está en RX_MATERIAL_TABLE (solo acero/aluminio/plomo/tungsteno) -> no debe aplicarse
        if (document.getElementById('rx_material').value === 'titanio') errores.push('rx_material se pisó con "titanio", pero Radiografía no tiene ese material');
      } finally {
        ids.forEach(id => { const el = document.getElementById(id); if (el && originales[id] !== undefined) el.value = originales[id]; });
      }
      if (errores.length) return { ok: false, msg: errores.join('; ') };
      return { ok: true, msg: 'Titanio → ECT (directo), correctamente ausente en RX ✓' };
    }
  },
  {
    id: 'sync_grupob_ect_keymap', group: 'Sincronización de material (Grupo B, v5.6)',
    name: 'ECT: "Aluminio 6061-T6" (clave local aluminio6061) traduce hacia atrás a "aluminio" de PRESETS',
    run: () => {
      const ids = ['e_preset', 'ect_metal'];
      const originales = {}; ids.forEach(id => { const el = document.getElementById(id); originales[id] = el ? el.value : undefined; });
      const errores = [];
      try {
        document.getElementById('e_preset').value = 'acero'; // valor previo distinto, para detectar el cambio
        document.getElementById('ect_metal').value = 'aluminio6061';
        syncMaterialToAllTests('ect_metal');
        if (document.getElementById('e_preset').value !== 'aluminio') errores.push(`e_preset quedó en "${document.getElementById('e_preset').value}", esperaba "aluminio"`);
      } finally {
        ids.forEach(id => { const el = document.getElementById(id); if (el && originales[id] !== undefined) el.value = originales[id]; });
      }
      if (errores.length) return { ok: false, msg: errores.join('; ') };
      return { ok: true, msg: 'ect_metal="aluminio6061" traduce correctamente a la clave PRESETS "aluminio" ✓' };
    }
  },
  {
    id: 'sync_grupob_ut_rx_directo', group: 'Sincronización de material (Grupo B, v5.6)',
    name: 'UT y RX: "Acero" sincroniza en ambas direcciones sin pasar por keyMap especial',
    run: () => {
      const ids = ['e_preset', 'ut_metal', 'rx_material'];
      const originales = {}; ids.forEach(id => { const el = document.getElementById(id); originales[id] = el ? el.value : undefined; });
      const errores = [];
      try {
        document.getElementById('ut_metal').value = 'acero';
        syncMaterialToAllTests('ut_metal');
        if (document.getElementById('e_preset').value !== 'acero') errores.push(`e_preset quedó en "${document.getElementById('e_preset').value}", esperaba "acero" (desde ut_metal)`);
        if (document.getElementById('rx_material').value !== 'acero') errores.push(`rx_material quedó en "${document.getElementById('rx_material').value}", esperaba "acero"`);
      } finally {
        ids.forEach(id => { const el = document.getElementById(id); if (el && originales[id] !== undefined) el.value = originales[id]; });
      }
      if (errores.length) return { ok: false, msg: errores.join('; ') };
      return { ok: true, msg: 'ut_metal="acero" sincroniza correctamente hacia Tracción y Radiografía ✓' };
    }
  },
  {
    id: 'ficha_dureza_cruzada', group: 'Ficha técnica (Fase 4)',
    name: 'Ficha — extiende la lectura cruzada de la Fase 5c (Compresión) a Dureza (Brinell/Vickers/Rockwell)',
    run: () => {
      const brSel = document.getElementById('dz_brMat');
      if (!brSel) return { warn: true, msg: 'No se encontró #dz_brMat (¿pestaña Dureza no cargada en el DOM?)' };
      const brOriginal = brSel.value;
      const pOriginal = document.getElementById('dz_brP').value;
      const dOriginal = document.getElementById('dz_brD').value;
      let tieneMedidoCoincide = false, noTieneMedidoNoCoincide = false;
      // FIX: mismo motivo que ficha_compresion_cruzada -- reabrir el picker
      // antes de cada material porque renderFichaMaterial() reemplaza el
      // <select> anterior, todo en try/finally para restaurar el DOM.
      try {
        brSel.value = 'acero';
        dzApplyBrinellMaterial(); // carga P/D de referencia y calcula el HB "medido" en pantalla
        openFichaPicker();
        document.getElementById('fichaMatSelect').value = 'acero';
        renderFichaMaterial();
        const htmlCoincide = document.getElementById('fichaBody').innerHTML;
        tieneMedidoCoincide = /HB medido en tu ensayo \(Brinell\)/.test(htmlCoincide);

        openFichaPicker();
        document.getElementById('fichaMatSelect').value = 'aluminio'; // Brinell sigue en "acero" -> no debería cruzar
        renderFichaMaterial();
        const htmlNoCoincide = document.getElementById('fichaBody').innerHTML;
        noTieneMedidoNoCoincide = !/HB medido en tu ensayo/.test(htmlNoCoincide);
      } finally {
        brSel.value = brOriginal;
        document.getElementById('dz_brP').value = pOriginal;
        document.getElementById('dz_brD').value = dOriginal;
        closeFicha();
      }
      if (!tieneMedidoCoincide) return { ok: false, msg: 'No mostró el HB medido en Brinell con el material coincidente' };
      if (!noTieneMedidoNoCoincide) return { ok: false, msg: 'Mostró HB medido con un material que no coincide con Brinell' };
      return { ok: true, msg: 'Lectura cruzada con Dureza (Brinell) correcta, mismo patrón que Compresión (Fase 5c) ✓' };
    }
  },
  // FIX (v4.7 — integración Ficha ↔ Grupo A): tests de la nueva sección
  // "Ensayos complementarios (Grupo A)" en la Ficha técnica. Mismo criterio
  // de arriba (try/finally, restaurar el DOM) y mismo criterio de fondo que
  // fractSeccion: material con dato real → se muestra calculado; sin
  // equivalente real en la tabla del módulo → se lista en "Sin datos de".
  {
    id: 'ficha_grupoa_acero', group: 'Ficha técnica ↔ Grupo A (v4.7)',
    name: 'Ficha de "Acero" muestra Desgaste y Corrosión (vía keyMap), no Polímeros',
    run: () => {
      let html = '';
      try {
        openFichaPicker();
        document.getElementById('fichaMatSelect').value = 'acero';
        renderFichaMaterial();
        html = document.getElementById('fichaBody').innerHTML;
      } finally {
        closeFicha();
      }
      const errores = [];
      if (!/Acero dulce – Acero dulce/.test(html)) errores.push('No mostró el par de Desgaste correspondiente a "acero" (aceroacero)');
      if (!/Hierro \/ acero al carbono/.test(html)) errores.push('No mostró el metal de Corrosión correspondiente a "acero" (hierro)');
      if (!/Sin datos de:[^<]*Polímeros/.test(html)) errores.push('Debería listar "Polímeros" en "Sin datos de" para acero (no tiene equivalente en PO_KEY_MAP)');
      if (errores.length) return { ok: false, msg: errores.join('; ') };
      return { ok: true, msg: 'Ficha de Acero: Desgaste/Corrosión calculados, Polímeros correctamente ausente ✓' };
    }
  },
  {
    id: 'ficha_grupoa_nylon', group: 'Ficha técnica ↔ Grupo A (v4.7)',
    name: 'Ficha de "Nylon PA6" muestra solo Polímeros (nylon→nylon6), no Desgaste ni Corrosión',
    run: () => {
      let html = '';
      try {
        openFichaPicker();
        document.getElementById('fichaMatSelect').value = 'nylon';
        renderFichaMaterial();
        html = document.getElementById('fichaBody').innerHTML;
      } finally {
        closeFicha();
      }
      const errores = [];
      if (!/Nylon 6 \(poliamida, seco\)/.test(html)) errores.push('No mostró el polímero correspondiente a "nylon" (nylon6)');
      if (!/Sin datos de:[^<]*Desgaste/.test(html)) errores.push('Debería listar "Desgaste" en "Sin datos de" para nylon');
      if (!/Sin datos de:[^<]*Corrosión/.test(html)) errores.push('Debería listar "Corrosión" en "Sin datos de" para nylon');
      if (errores.length) return { ok: false, msg: errores.join('; ') };
      return { ok: true, msg: 'Ficha de Nylon: solo Polímeros calculado, Desgaste/Corrosión correctamente ausentes ✓' };
    }
  },
  {
    id: 'ficha_grupoa_sin_equivalente', group: 'Ficha técnica ↔ Grupo A (v4.7)',
    name: 'Ficha de un material sin equivalente en ninguna tabla del Grupo A (ej. Cerámica) muestra el aviso genérico',
    run: () => {
      let html = '';
      try {
        openFichaPicker();
        document.getElementById('fichaMatSelect').value = 'ceramica';
        renderFichaMaterial();
        html = document.getElementById('fichaBody').innerHTML;
      } finally {
        closeFicha();
      }
      if (!/no tiene un equivalente real en ninguna de las tablas de Desgaste, Corrosión o Polímeros/.test(html)) {
        return { ok: false, msg: 'No mostró el aviso genérico de "sin equivalente" para un material sin datos de Grupo A' };
      }
      return { ok: true, msg: 'Aviso genérico correcto cuando ningún módulo del Grupo A aplica ✓' };
    }
  },
  {
    id: 'ficha_grupoa_lectura_viva', group: 'Ficha técnica ↔ Grupo A (v4.7)',
    name: 'Ficha lee en vivo la fuerza/distancia cargadas en Desgaste cuando el par coincide',
    // FIX (post-v4.7, reporte de Agus): el valor de prueba de ds_distancia
    // tiene que ser múltiplo del step="10" del slider -- el navegador sanea
    // (redondea) el valor asignado por JS al step más cercano, así que un
    // valor como 4444 termina guardado como 4440 y el regex de abajo nunca
    // matcheaba. No era un bug de ficha.js, era este test.
    run: () => {
      const parSel = document.getElementById('ds_par');
      if (!parSel) return { warn: true, msg: 'No se encontró #ds_par (¿pestaña Ensayos complementarios no cargada en el DOM?)' };
      const parOriginal = parSel.value;
      const fOriginal = document.getElementById('ds_fuerza').value;
      const dOriginal = document.getElementById('ds_distancia').value;
      let html = '';
      try {
        parSel.value = 'aceroacero';
        document.getElementById('ds_fuerza').value = '333';
        document.getElementById('ds_distancia').value = '4440';
        openFichaPicker();
        document.getElementById('fichaMatSelect').value = 'acero';
        renderFichaMaterial();
        html = document.getElementById('fichaBody').innerHTML;
      } finally {
        parSel.value = parOriginal;
        document.getElementById('ds_fuerza').value = fOriginal;
        document.getElementById('ds_distancia').value = dOriginal;
        closeFicha();
      }
      if (!/F=333 N, d=4440 m/.test(html)) return { ok: false, msg: 'No tomó F/d en vivo de la pestaña Desgaste con el mismo par cargado ahí' };
      return { ok: true, msg: 'Lectura en vivo de Desgaste correcta (F=333 N, d=4440 m) ✓' };
    }
  },
  {
    // FIX #57 (QA exhaustivo v6.13, etapa 1): esta es la salvaguarda
    // estructural que FIX #49 decía haber agregado ("para que esta clase
    // de bug no se repita una tercera vez") pero que nunca llegó a
    // tests.js -- confirmado buscándola en todo el archivo, cero
    // coincidencias. Se agrega ahora de verdad, tras la 3ra recurrencia
    // real (FIX #56, escena-tensiones-residuales.js/escena-ultrasonido.js
    // faltantes en PRECACHE_URLS).
    //
    // Compara los <script src="assets/..."> que el DOM vivo de index.html
    // realmente carga contra el contenido real de sw.js (leído con XHR
    // síncrono -- el framework de tests no soporta tests async, y
    // document.styleSheets/etc. no sirven acá porque sw.js no es un
    // recurso cargado por la página, es un archivo aparte).
    //
    // Limitación conocida y aceptada (mismo criterio que
    // ficha_print_css_fix/rr_drag_contrapeso): bajo file://, o en un
    // arnés Node+jsdom que no sirve los archivos por http, el XHR no
    // puede completarse -- ahí el test devuelve WARN (nunca un OK falso),
    // no FAIL. En GitHub Pages real, o abriendo el simulador con un
    // servidor local (python -m http.server, live-server, etc.), corre
    // completo.
    id: 'precache_completo', group: 'PWA / Service worker',
    // FIX #63 (hallazgo A1-05): el name/msg de este test tenían el texto
    // literal "<script src=...>" para describir qué audita. Como el panel
    // de resultados inserta name/msg vía innerHTML (no textContent), ese
    // texto se parseaba como HTML real y creaba 2 elementos <script>
    // fantasma en el DOM (uno al renderizar la tarjeta, otro al renderizar
    // el log) apenas corría este mismo test -- inofensivo (el atributo src
    // no apunta a ningún archivo real y el panel limpia todo al iniciar
    // cada corrida), pero confuso de ver en las devtools. Se reescribe sin
    // los símbolos '<'/'>' para que no haya nada que un innerHTML pueda
    // interpretar como una etiqueta.
    name: 'sw.js (PRECACHE_URLS) incluye todas las etiquetas script con src="assets/..." de index.html',
    run: () => {
      const scriptsEnHTML = [...document.querySelectorAll('script[src^="assets/"]')]
        .map(s => s.getAttribute('src'));
      if (scriptsEnHTML.length === 0) {
        return { ok: false, msg: 'No se encontró ninguna etiqueta script con src="assets/..." en el documento -- ¿DOM vacío?' };
      }

      let swText = '';
      try {
        const xhr = new XMLHttpRequest();
        xhr.open('GET', './sw.js', false); // síncrono a propósito, ver nota arriba
        xhr.send(null);
        if (xhr.status !== 0 && xhr.status !== 200) {
          return { ok: false, warn: true, msg: `No se pudo leer sw.js (HTTP ${xhr.status}) -- test omitido en este entorno` };
        }
        swText = xhr.responseText || '';
      } catch (e) {
        return { ok: false, warn: true, msg: 'No se pudo leer sw.js (¿file://, o entorno sin servidor http? probá abrir el simulador servido por http) -- test omitido' };
      }
      if (!swText) {
        return { ok: false, warn: true, msg: 'sw.js se leyó vacío -- test omitido' };
      }

      const scriptsEnSW = new Set(
        [...swText.matchAll(/'\.\/(assets\/[a-zA-Z0-9_-]+\.js)'/g)].map(m => m[1])
      );
      const faltantes = scriptsEnHTML.filter(src => !scriptsEnSW.has(src));
      if (faltantes.length > 0) {
        return { ok: false, msg: `Falta(n) en PRECACHE_URLS de sw.js: ${faltantes.join(', ')} -- rompe el uso offline de esos módulos` };
      }
      return { ok: true, msg: `Las ${scriptsEnHTML.length} etiquetas script con src="assets/..." de index.html están precacheadas en sw.js` };
    }
  },
  {
    // FIX (Fase 8 — corte de columnas al imprimir): este test es una
    // salvaguarda de REGRESIÓN sobre las reglas de styles.css (que las 3
    // reglas del fix sigan presentes), NO una verificación visual. Corre en
    // el navegador (lee document.styleSheets); aun así NO puede confirmar
    // que el texto ya no se corte en una impresión/PDF real -- eso depende
    // del motor de impresión del navegador/SO, algo que ningún test
    // automatizado (navegador o Node) puede reproducir. Verificación manual
    // pendiente: abrir una ficha con datos de fractura/fatiga (ej. aluminio,
    // que tiene K_IC/Paris/fluencia) y usar "Imprimir → Vista previa",
    // revisando que ningún valor con unidad (GPa, MPa·√m, kJ/m³, J/mol)
    // quede cortado contra el borde derecho de la hoja.
    id: 'ficha_print_css_fix', group: 'Ficha técnica (Fase 4)',
    name: 'Ficha — reglas @page/@media print del fix de corte de columnas presentes en styles.css',
    run: () => {
      let printRuleText = '';
      let pageRuleFound = false;
      let sheetsReadable = 0;
      let sheetsBlocked = 0;
      for (const sheet of document.styleSheets) {
        let rules;
        try {
          rules = sheet.cssRules || sheet.rules;
          sheetsReadable++;
        } catch (e) {
          sheetsBlocked++; // típico bajo file:// (Chrome trata la lectura de cssRules externas como cross-origin)
          continue;
        }
        if (!rules) continue;
        for (const rule of rules) {
          if (rule.type === CSSRule.MEDIA_RULE && /print/.test(rule.conditionText || rule.media?.mediaText || '')) {
            printRuleText += rule.cssText;
          }
          if (rule.type === CSSRule.PAGE_RULE) pageRuleFound = true;
        }
      }
      // FIX: distinguir "no se pudo leer ninguna hoja" (típico al abrir el
      // .html directo con file://, donde Chrome bloquea la lectura de
      // cssRules de hojas externas por su modelo de seguridad para
      // recursos locales) de "se pudo leer, pero la regla no está" -- son
      // diagnósticos distintos y mezclarlos en un solo warning genérico
      // era confuso.
      if (sheetsReadable === 0 && sheetsBlocked > 0) {
        return { warn: true, msg: `No se pudo leer ninguna hoja de estilos (${sheetsBlocked} bloqueada(s)) — normal si abriste el .html con file:// en vez de un servidor local; no es una falla del fix. Confirmar manualmente con Vista previa de impresión.` };
      }
      if (!printRuleText) return { ok: false, msg: 'Las hojas se pudieron leer pero no hay ninguna regla @media print — el fix no está' };
      if (!pageRuleFound) return { ok: false, msg: 'Falta la regla @page (margen de impresión explícito)' };
      if (!/\.ficha\s*{[^}]*grid-template-columns\s*:\s*1fr/.test(printRuleText)) {
        return { ok: false, msg: '.ficha no pasa a 1 columna dentro de @media print' };
      }
      if (!/\.ficha-row\s*{[^}]*flex-wrap\s*:\s*wrap/.test(printRuleText)) {
        return { ok: false, msg: '.ficha-row no permite wrap dentro de @media print' };
      }
      return { ok: true, msg: '@page + .ficha a 1 columna + wrap presentes ✓ (pendiente: confirmar visualmente con Vista previa de impresión)' };
    }
  },
  // ---- PROGRESO (Fase 10) ----
  {
    id: 'prog_formato_vacio', group: 'Progreso (Fase 10)',
    name: 'progVacio() — estructura base correcta',
    run: () => {
      const v = progVacio();
      if (v.version !== 1) return { ok: false, msg: `version esperada 1, vino ${v.version}` };
      if (v.alumno !== '' || v.ultimaPestana !== null) return { ok: false, msg: 'alumno/ultimaPestana deberían arrancar vacíos' };
      if (typeof v.materiales !== 'object' || !Array.isArray(v.eventos)) return { ok: false, msg: 'materiales/eventos con tipo incorrecto' };
      return { ok: true, msg: 'estructura vacía correcta ✓' };
    }
  },
  {
    id: 'prog_guardar_cargar', group: 'Progreso (Fase 10)',
    name: 'progGuardar()/progCargar() — round-trip por localStorage',
    // FIX (Fase 10f): corre contra el localStorage real (mismo patrón que el
    // test 'localstorage' de Configuraciones), pero respalda y restaura el
    // progreso real del usuario en un finally para no perderlo por correr
    // los tests -- mismo cuidado que ya tuvieron con la ficha en v3.11.
    run: () => {
      const backup = localStorage.getItem(PROGRESO_KEY);
      const prevData = PROG_DATA;
      try {
        PROG_DATA = { version:1, alumno:'Test', ultimaPestana:'dureza', materiales:{e_preset:'acero'}, eventos:[{ts:'2026-01-01T00:00:00.000Z',tipo:'material',pestana:'Tracción',material:'acero'}] };
        progGuardar();
        const releido = progCargar();
        if (releido.alumno !== 'Test' || releido.ultimaPestana !== 'dureza') return { ok: false, msg: 'no se releyeron alumno/ultimaPestana' };
        if (releido.materiales.e_preset !== 'acero') return { ok: false, msg: 'no se releyó materiales.e_preset' };
        if (releido.eventos.length !== 1) return { ok: false, msg: `se esperaba 1 evento, vinieron ${releido.eventos.length}` };
        return { ok: true, msg: 'round-trip OK ✓' };
      } finally {
        PROG_DATA = prevData;
        if (backup === null) localStorage.removeItem(PROGRESO_KEY); else localStorage.setItem(PROGRESO_KEY, backup);
      }
    }
  },
  {
    id: 'prog_tope_eventos', group: 'Progreso (Fase 10)',
    name: 'progRegistrar() — tope de 200 eventos, se queda con los últimos',
    run: () => {
      const backup = localStorage.getItem(PROGRESO_KEY);
      const prevData = PROG_DATA;
      try {
        PROG_DATA = progVacio();
        for (let i=0; i<PROG_MAX_EVENTOS+10; i++) progRegistrar('material', { pestana:'Test', material:'m'+i });
        if (PROG_DATA.eventos.length !== PROG_MAX_EVENTOS) return { ok: false, msg: `se esperaban ${PROG_MAX_EVENTOS} eventos, quedaron ${PROG_DATA.eventos.length}` };
        const ultimo = PROG_DATA.eventos[PROG_DATA.eventos.length-1];
        if (ultimo.material !== `m${PROG_MAX_EVENTOS+9}`) return { ok: false, msg: 'no se conservaron los eventos más recientes' };
        return { ok: true, msg: `tope en ${PROG_MAX_EVENTOS} ✓, se descartan los más viejos` };
      } finally {
        PROG_DATA = prevData;
        if (backup === null) localStorage.removeItem(PROGRESO_KEY); else localStorage.setItem(PROGRESO_KEY, backup);
      }
    }
  },
  {
    id: 'prog_sin_localstorage', group: 'Progreso (Fase 10)',
    name: 'progGuardar() — no rompe si localStorage falla (ej. modo incógnito con storage deshabilitado)',
    run: () => {
      const prevData = PROG_DATA;
      const originalSetItem = localStorage.setItem;
      try {
        localStorage.setItem = () => { throw new DOMException('QuotaExceededError simulado'); };
        PROG_DATA = progVacio();
        progGuardar(); // no debería tirar
        return { ok: true, msg: 'progGuardar() no propaga la excepción ✓' };
      } catch(e) {
        return { ok: false, msg: `progGuardar() dejó pasar la excepción: ${e.message}` };
      } finally {
        localStorage.setItem = originalSetItem;
        PROG_DATA = prevData;
      }
    }
  },
  // ---- COMPARTIR ESCENARIO POR URL (backlog punto F, v5.12) ----
  {
    id: 'cs_capturar_estado', group: 'Compartir escenario por URL (v5.12)',
    name: 'csCapturarEstado — identifica tab/sub activos y los campos del sidebar de esa sub-sección',
    run: () => {
      const tabOriginal = csTabActiva();
      const subOriginal = csSubActiva(csPrefijoActivo(tabOriginal));
      try {
        switchTab('end');
        dzSwitch('ultrasonido');
        document.getElementById('ut_metal').value = 'cobre';
        document.getElementById('ut_espesor').value = '77';
        utUpdate();

        const estado = csCapturarEstado();
        if (!estado) return { ok: false, msg: 'csCapturarEstado() devolvió null con una sub-sección activa real' };
        if (estado.tab !== 'end') return { ok: false, msg: `tab="${estado.tab}" (esperado "end")` };
        if (estado.sub !== 'ultrasonido') return { ok: false, msg: `sub="${estado.sub}" (esperado "ultrasonido")` };
        if (estado.campos.ut_metal !== 'cobre') return { ok: false, msg: `ut_metal="${estado.campos.ut_metal}" (esperado "cobre")` };
        if (estado.campos.ut_espesor !== '77') return { ok: false, msg: `ut_espesor="${estado.campos.ut_espesor}" (esperado "77")` };
        return { ok: true, msg: `tab/sub/campos capturados correctamente (${Object.keys(estado.campos).length} campos) ✓` };
      } finally {
        // vuelve al estado inicial para no afectar otros tests
        if (tabOriginal) switchTab(tabOriginal);
        if (subOriginal && CS_PREFIJO_SWITCHFN[csPrefijoActivo(tabOriginal)]) {
          window[CS_PREFIJO_SWITCHFN[csPrefijoActivo(tabOriginal)]](subOriginal);
        }
      }
    }
  },
  {
    id: 'cs_armar_url', group: 'Compartir escenario por URL (v5.12)',
    name: 'csArmarURL — la query string incluye t, s y cada campo capturado',
    run: () => {
      const estado = { tab: 'end', sub: 'ultrasonido', campos: { ut_metal: 'cobre', ut_espesor: '77' } };
      const url = csArmarURL(estado);
      const qs = url.split('?')[1] || '';
      const params = new URLSearchParams(qs);
      if (params.get('t') !== 'end') return { ok: false, msg: `t="${params.get('t')}" (esperado "end")` };
      if (params.get('s') !== 'ultrasonido') return { ok: false, msg: `s="${params.get('s')}" (esperado "ultrasonido")` };
      if (params.get('ut_metal') !== 'cobre') return { ok: false, msg: `ut_metal="${params.get('ut_metal')}" (esperado "cobre")` };
      if (params.get('ut_espesor') !== '77') return { ok: false, msg: `ut_espesor="${params.get('ut_espesor')}" (esperado "77")` };
      return { ok: true, msg: `URL bien formada: ${url}` };
    }
  },
  {
    id: 'cs_roundtrip_capturar_aplicar', group: 'Compartir escenario por URL (v5.12)',
    name: 'Round-trip: capturar → armar URL → aplicar reconstruye el mismo escenario en otra sub-sección',
    run: () => {
      const tabOriginal = csTabActiva();
      const subOriginal = csSubActiva(csPrefijoActivo(tabOriginal));
      try {
        // 1) Arma un escenario conocido en Ultrasonido.
        switchTab('end'); dzSwitch('ultrasonido');
        document.getElementById('ut_metal').value = 'laton';
        document.getElementById('ut_espesor').value = '63';
        utUpdate();
        const estado = csCapturarEstado();
        const url = csArmarURL(estado);
        const params = new URLSearchParams(url.split('?')[1]);

        // 2) Deja el simulador en un módulo totalmente distinto, simulando
        // a alguien que abre el link desde otra sub-sección.
        switchTab('mecanicos'); mecSwitchGroup('estatica'); edSwitch('traccion');

        // 3) Aplica el link y verifica que reconstruya Ultrasonido con los
        // mismos valores.
        csAplicarDesdeURL(params);

        const subActiva = csSubActiva('dz');
        if (subActiva !== 'ultrasonido') return { ok: false, msg: `Sub-sección activa tras aplicar="${subActiva}" (esperado "ultrasonido")` };
        if (document.getElementById('ut_metal').value !== 'laton') return { ok: false, msg: 'ut_metal no se restauró a "laton"' };
        if (document.getElementById('ut_espesor').value !== '63') return { ok: false, msg: 'ut_espesor no se restauró a "63"' };
        return { ok: true, msg: 'Round-trip capturar→URL→aplicar reconstruye tab/sub/campos ✓' };
      } finally {
        if (tabOriginal) switchTab(tabOriginal);
        if (subOriginal && CS_PREFIJO_SWITCHFN[csPrefijoActivo(tabOriginal)]) {
          window[CS_PREFIJO_SWITCHFN[csPrefijoActivo(tabOriginal)]](subOriginal);
        }
      }
    }
  },
  {
    id: 'cs_desafio_semilla_compartida', group: 'Compartir escenario por URL (v5.12)',
    name: 'Un link con modo desafío activo reproduce EL MISMO defecto oculto, no uno nuevo al azar',
    run: () => {
      const tabOriginal = csTabActiva();
      const subOriginal = csSubActiva(csPrefijoActivo(tabOriginal));
      const modoOriginal = document.getElementById('ut_modo').value;
      try {
        switchTab('end'); dzSwitch('ultrasonido');
        document.getElementById('ut_modo').value = 'desafio';
        utModoToggle();
        const profReal = UT_DESAFIO.profDef;
        const ampReal = UT_DESAFIO.ampDef;

        const estado = csCapturarEstado();
        if (estado.campos._ut_seed === undefined) return { ok: false, msg: 'csCapturarEstado() no incluyó _ut_seed con el modo desafío activo' };
        const url = csArmarURL(estado);
        const params = new URLSearchParams(url.split('?')[1]);

        switchTab('mecanicos'); mecSwitchGroup('estatica'); edSwitch('traccion'); // simula abrir el link desde otro lado
        csAplicarDesdeURL(params);

        if (UT_DESAFIO.profDef !== profReal) return { ok: false, msg: `Profundidad reproducida=${UT_DESAFIO.profDef} ≠ original=${profReal}` };
        if (UT_DESAFIO.ampDef !== ampReal) return { ok: false, msg: `Amplitud reproducida=${UT_DESAFIO.ampDef} ≠ original=${ampReal}` };
        return { ok: true, msg: `Mismo desafío reproducido: profundidad=${profReal}mm, amplitud=${ampReal}% ✓` };
      } finally {
        document.getElementById('ut_modo').value = modoOriginal; utModoToggle();
        if (tabOriginal) switchTab(tabOriginal);
        if (subOriginal && CS_PREFIJO_SWITCHFN[csPrefijoActivo(tabOriginal)]) {
          window[CS_PREFIJO_SWITCHFN[csPrefijoActivo(tabOriginal)]](subOriginal);
        }
      }
    }
  },
  // ---- DESGASTE (v4.1) ----
  {
    id: 'ds_calc_basico', group: 'Desgaste (Archard)',
    name: 'dsCalcVolumen — caso de referencia (Wikipedia "Wear coefficient")',
    run: () => {
      // Acero dulce/acero dulce, HB=120 (→1.176e9 Pa), F=9.8N, d=1m, k=7e-3
      // Resultado esperado del ejemplo de referencia: ≈5.83e-11 m³
      const H_pa = 120 * 9.80665e6;
      const V = dsCalcVolumen(7e-3, 9.8, 1, H_pa);
      const esperado = 5.83e-11;
      const err = Math.abs(V - esperado) / esperado;
      if (err > 0.02) return { ok: false, msg: `V=${V.toExponential(3)} m³, esperado≈${esperado.toExponential(2)} m³ (err ${(err*100).toFixed(1)}%)` };
      return { ok: true, msg: `V=${V.toExponential(3)} m³ ✓` };
    }
  },
  {
    id: 'ds_calc_proporcional', group: 'Desgaste (Archard)',
    name: 'dsCalcVolumen — proporcionalidad directa con F y d, inversa con H',
    run: () => {
      const base = dsCalcVolumen(1e-3, 100, 500, 1e9);
      const dobleF = dsCalcVolumen(1e-3, 200, 500, 1e9);
      const dobleD = dsCalcVolumen(1e-3, 100, 1000, 1e9);
      const dobleH = dsCalcVolumen(1e-3, 100, 500, 2e9);
      if (Math.abs(dobleF - 2*base) > 1e-15) return { ok: false, msg: 'No es proporcional a F' };
      if (Math.abs(dobleD - 2*base) > 1e-15) return { ok: false, msg: 'No es proporcional a d' };
      if (Math.abs(dobleH - base/2) > 1e-15) return { ok: false, msg: 'No es inversamente proporcional a H' };
      return { ok: true, msg: 'V ∝ F·d/H ✓' };
    }
  },
  {
    id: 'ds_calc_dureza_invalida', group: 'Desgaste (Archard)',
    name: 'dsCalcVolumen — dureza cero o negativa devuelve NaN en vez de Infinity/valor engañoso',
    run: () => {
      const v0 = dsCalcVolumen(1e-3, 100, 500, 0);
      const vNeg = dsCalcVolumen(1e-3, 100, 500, -10);
      if (!Number.isNaN(v0)) return { ok: false, msg: `H=0 → ${v0} (esperado NaN)` };
      if (!Number.isNaN(vNeg)) return { ok: false, msg: `H<0 → ${vNeg} (esperado NaN)` };
      return { ok: true, msg: 'H≤0 → NaN en ambos casos ✓' };
    }
  },
  {
    id: 'ds_tabla_k_completa', group: 'Desgaste (Archard)',
    name: 'DS_K_TABLE — 8 pares de materiales, todos con k>0',
    run: () => {
      const keys = Object.keys(DS_K_TABLE);
      if (keys.length !== 8) return { ok: false, msg: `${keys.length} pares (esperados 8)` };
      const malos = keys.filter(k => !(DS_K_TABLE[k].k > 0) || !(DS_K_TABLE[k].hb > 0));
      if (malos.length) return { ok: false, msg: `Pares con k o hb inválido: ${malos.join(', ')}` };
      return { ok: true, msg: '8 pares, todos con k>0 y hb>0 ✓' };
    }
  },
  // FIX (QA v5.5 → v5.6, hallazgo Etapa 1): exportComplementariosChart existía
  // desde v4.1 pero se había perdido en algún punto posterior sin que ningún
  // test lo detectara -- los 5 botones "Exportar imagen" de esta pestaña
  // quedaron rotos en silencio. Se restauró la función en export.js y se
  // agrega este test (mismo criterio que dureza_export_defined/
  // rt_export_defined) para que la próxima vez sí se detecte en la suite.
  {
    id: 'cm_export_defined', group: 'Ensayos complementarios (Grupo A + Metalografía)',
    name: 'Exportación de gráficos — función definida y los 5 botones reales presentes',
    run: () => {
      if (typeof exportComplementariosChart !== 'function') return { ok: false, msg: 'exportComplementariosChart no definida' };
      const botones = document.querySelectorAll('[onclick^="exportComplementariosChart"]').length;
      if (botones !== 5) return { ok: false, msg: `Botones de exportación: ${botones} (esperado 5: Desgaste/Tensiones/Corrosión/Polímeros/Metalografía)` };
      return { ok: true, msg: `exportComplementariosChart definida, ${botones}/5 botones ✓` };
    }
  },
  // ---- TENSIONES RESIDUALES / HOLE-DRILLING (v4.2) ----
  {
    id: 'tr_calc_referencia', group: 'Tensiones residuales (hole-drilling)',
    name: 'trCalcTensiones — recupera el caso de calibración uniaxial de Vishay TN-503 (σc≈69 MPa)',
    run: () => {
      // ε1=-90µε, ε2=-25µε, ε3=39µε con A,B de la roseta Tipo A pasante (TN-503).
      // Debería recuperar σ_max≈σc=68.9MPa (tolerancia amplia por redondeo de A,B
      // a 2 cifras en la fuente), σ_min≈0 y β≈0° (uniaxial alineado con galga 1).
      const cal = TR_CAL_TABLE.tipoA_pasante;
      const r = trCalcTensiones(-90e-6, -25e-6, 39e-6, cal.A, cal.B);
      const maxMPa = r.sigmaMax / 1e6, minMPa = r.sigmaMin / 1e6;
      if (Math.abs(maxMPa - 68.9) > 5) return { ok: false, msg: `σ_max=${maxMPa.toFixed(1)} MPa, esperado≈68.9±5 MPa` };
      if (Math.abs(minMPa) > 5) return { ok: false, msg: `σ_min=${minMPa.toFixed(1)} MPa, esperado≈0±5 MPa` };
      if (Math.abs(r.betaDeg) > 5) return { ok: false, msg: `β=${r.betaDeg.toFixed(1)}°, esperado≈0±5°` };
      return { ok: true, msg: `σ_max=${maxMPa.toFixed(1)} MPa, σ_min=${minMPa.toFixed(1)} MPa, β=${r.betaDeg.toFixed(1)}° ✓` };
    }
  },
  {
    id: 'tr_calc_equibiaxial', group: 'Tensiones residuales (hole-drilling)',
    name: 'trCalcTensiones — tensión equibiaxial (ε1=ε2=ε3) da σ_max=σ_min sin componente de corte',
    run: () => {
      const cal = TR_CAL_TABLE.tipoA_pasante;
      const r = trCalcTensiones(-50e-6, -50e-6, -50e-6, cal.A, cal.B);
      const diff = Math.abs(r.sigmaMax - r.sigmaMin);
      if (diff > 1) return { ok: false, msg: `σ_max-σ_min=${diff.toExponential(2)} Pa (esperado ≈0, caso equibiaxial)` };
      return { ok: true, msg: `σ_max≈σ_min=${(r.sigmaMax/1e6).toFixed(1)} MPa ✓` };
    }
  },
  {
    id: 'tr_calc_sin_deformacion', group: 'Tensiones residuales (hole-drilling)',
    name: 'trCalcTensiones — sin deformación relevada, tensión residual nula',
    run: () => {
      const cal = TR_CAL_TABLE.tipoA_pasante;
      const r = trCalcTensiones(0, 0, 0, cal.A, cal.B);
      if (Math.abs(r.sigmaMax) > 1e-6 || Math.abs(r.sigmaMin) > 1e-6) {
        return { ok: false, msg: `σ_max=${r.sigmaMax}, σ_min=${r.sigmaMin} (esperado 0,0)` };
      }
      return { ok: true, msg: 'ε=0 → σ_max=σ_min=0 ✓' };
    }
  },
  {
    id: 'tr_tabla_cal', group: 'Tensiones residuales (hole-drilling)',
    name: 'TR_CAL_TABLE — al menos 1 geometría con A y B negativos (según Vishay TN-503)',
    run: () => {
      const keys = Object.keys(TR_CAL_TABLE);
      if (keys.length < 1) return { ok: false, msg: 'Sin geometrías cargadas' };
      const malos = keys.filter(k => !(TR_CAL_TABLE[k].A < 0) || !(TR_CAL_TABLE[k].B < 0));
      if (malos.length) return { ok: false, msg: `Geometrías con A o B no negativos: ${malos.join(', ')}` };
      return { ok: true, msg: `${keys.length} geometría(s), A y B negativos ✓` };
    }
  },
  // ---- CORROSIÓN / FARADAY (v4.3) ----
  {
    id: 'cr_calc_proporcional', group: 'Corrosión (Faraday)',
    name: 'crCalcVelocidad — proporcional a i_corr y EW, inversa a la densidad',
    run: () => {
      const base = crCalcVelocidad(5, 30, 8);
      const dobleI = crCalcVelocidad(10, 30, 8);
      const dobleEW = crCalcVelocidad(5, 60, 8);
      const dobleRho = crCalcVelocidad(5, 30, 16);
      if (Math.abs(dobleI - 2 * base) > 1e-12) return { ok: false, msg: 'No es proporcional a i_corr' };
      if (Math.abs(dobleEW - 2 * base) > 1e-12) return { ok: false, msg: 'No es proporcional a EW' };
      if (Math.abs(dobleRho - base / 2) > 1e-12) return { ok: false, msg: 'No es inversamente proporcional a ρ' };
      return { ok: true, msg: 'CR ∝ i_corr·EW/ρ ✓' };
    }
  },
  {
    id: 'cr_calc_orden_magnitud', group: 'Corrosión (Faraday)',
    name: 'crCalcVelocidad — acero al carbono, i_corr=5µA/cm², da un orden de magnitud realista (µm a décimas de mm/año)',
    run: () => {
      const fe = CR_METAL_TABLE.hierro;
      const CR = crCalcVelocidad(5, fe.ew, fe.rho);
      // Corrosión atmosférica moderada de acero: decenas de µm/año, no nm ni cm.
      if (CR < 0.005 || CR > 0.5) return { ok: false, msg: `CR=${CR.toFixed(4)} mm/año, fuera del rango físico esperado (0.005–0.5)` };
      return { ok: true, msg: `CR=${CR.toFixed(4)} mm/año (${(CR*1000).toFixed(1)} µm/año) ✓` };
    }
  },
  {
    id: 'cr_calc_densidad_invalida', group: 'Corrosión (Faraday)',
    name: 'crCalcVelocidad — densidad cero o negativa devuelve NaN',
    run: () => {
      const v0 = crCalcVelocidad(5, 30, 0);
      const vNeg = crCalcVelocidad(5, 30, -1);
      if (!Number.isNaN(v0)) return { ok: false, msg: `ρ=0 → ${v0} (esperado NaN)` };
      if (!Number.isNaN(vNeg)) return { ok: false, msg: `ρ<0 → ${vNeg} (esperado NaN)` };
      return { ok: true, msg: 'ρ≤0 → NaN en ambos casos ✓' };
    }
  },
  {
    id: 'cr_tabla_metales', group: 'Corrosión (Faraday)',
    name: 'CR_METAL_TABLE — 7 metales, todos con EW y ρ positivos',
    run: () => {
      const keys = Object.keys(CR_METAL_TABLE);
      if (keys.length !== 7) return { ok: false, msg: `${keys.length} metales (esperados 7)` };
      const malos = keys.filter(k => !(CR_METAL_TABLE[k].ew > 0) || !(CR_METAL_TABLE[k].rho > 0));
      if (malos.length) return { ok: false, msg: `Metales con EW o ρ inválido: ${malos.join(', ')}` };
      return { ok: true, msg: '7 metales, todos con EW>0 y ρ>0 ✓' };
    }
  },
  // ---- POLÍMEROS / CURVA DMA (v4.4, cierra el Grupo A) ----
  {
    id: 'po_calc_punto_medio', group: 'Polímeros (curva DMA)',
    name: "poCalcModulo — en T=Tg, E' es exactamente el punto medio entre vítreo y gomoso",
    run: () => {
      const Eg = 3e9, Er = 5e6, Tg = 105, w = 10;
      const Ep = poCalcModulo(Tg, Tg, Eg, Er, w);
      const esperado = (Eg + Er) / 2;
      if (Math.abs(Ep - esperado) > 1) return { ok: false, msg: `E'(Tg)=${Ep.toExponential(3)}, esperado ${esperado.toExponential(3)}` };
      return { ok: true, msg: `E'(Tg)=${(Ep/1e6).toFixed(1)} MPa = punto medio ✓` };
    }
  },
  {
    id: 'po_calc_asintotas', group: 'Polímeros (curva DMA)',
    name: "poCalcModulo — lejos de Tg, E' tiende al módulo vítreo o gomoso según corresponda",
    run: () => {
      const Eg = 3e9, Er = 5e6, Tg = 105, w = 10;
      const lejosAbajo = poCalcModulo(Tg - 100, Tg, Eg, Er, w);
      const lejosArriba = poCalcModulo(Tg + 100, Tg, Eg, Er, w);
      if (Math.abs(lejosAbajo - Eg) / Eg > 0.01) return { ok: false, msg: `T≪Tg: E'=${lejosAbajo.toExponential(3)}, esperado≈Eg=${Eg.toExponential(2)}` };
      if (Math.abs(lejosArriba - Er) / Er > 0.05) return { ok: false, msg: `T≫Tg: E'=${lejosArriba.toExponential(3)}, esperado≈Er=${Er.toExponential(2)}` };
      return { ok: true, msg: 'T≪Tg → E_vítreo, T≫Tg → E_gomoso ✓' };
    }
  },
  {
    id: 'po_calc_ancho_invalido', group: 'Polímeros (curva DMA)',
    name: "poCalcModulo — ancho de transición cero o negativo devuelve NaN",
    run: () => {
      const v0 = poCalcModulo(105, 105, 3e9, 5e6, 0);
      const vNeg = poCalcModulo(105, 105, 3e9, 5e6, -5);
      if (!Number.isNaN(v0)) return { ok: false, msg: `w=0 → ${v0} (esperado NaN)` };
      if (!Number.isNaN(vNeg)) return { ok: false, msg: `w<0 → ${vNeg} (esperado NaN)` };
      return { ok: true, msg: 'w≤0 → NaN en ambos casos ✓' };
    }
  },
  {
    id: 'po_tabla_polimeros', group: 'Polímeros (curva DMA)',
    name: 'PO_POLIMERO_TABLE — 7 polímeros, todos con E_vítreo > E_gomoso > 0',
    run: () => {
      const keys = Object.keys(PO_POLIMERO_TABLE);
      if (keys.length !== 7) return { ok: false, msg: `${keys.length} polímeros (esperados 7)` };
      const malos = keys.filter(k => !(PO_POLIMERO_TABLE[k].eg > PO_POLIMERO_TABLE[k].er) || !(PO_POLIMERO_TABLE[k].er > 0));
      if (malos.length) return { ok: false, msg: `Polímeros con eg≤er o er≤0: ${malos.join(', ')}` };
      return { ok: true, msg: '7 polímeros, todos con E_vítreo > E_gomoso > 0 ✓' };
    }
  },
  // ---- CORRIENTES INDUCIDAS / EDDY CURRENT (v5.1, 1er ensayo del Grupo B) ----
  {
    id: 'ect_calc_delta_referencia', group: 'Corrientes inducidas (eddy current)',
    name: 'ectCalcDeltaMm — cobre a 60 kHz (frecuencia de referencia ASTM E1004) da δ≈0,27 mm',
    run: () => {
      // δ(mm) para cobre (100% IACS, σ=58 MS/m) a 60 kHz: fórmula equivalente
      // muy citada en la literatura de eddy current, δ(mm)≈66,2/√f(Hz) para
      // cobre no ferromagnético -- 66,2/√60000 ≈ 0,270 mm.
      const delta = ectCalcDeltaMm(60000, 58e6, 1);
      const esperado = 0.270;
      const err = Math.abs(delta - esperado) / esperado;
      if (err > 0.02) return { ok: false, msg: `δ=${delta.toFixed(4)} mm, esperado≈${esperado} mm (err ${(err*100).toFixed(1)}%)` };
      return { ok: true, msg: `δ=${delta.toFixed(4)} mm ✓` };
    }
  },
  {
    id: 'ect_calc_delta_proporcional', group: 'Corrientes inducidas (eddy current)',
    name: 'ectCalcDeltaMm — inversamente proporcional a √f y a √σ',
    run: () => {
      const base = ectCalcDeltaMm(10000, 30e6, 1);
      const cuatroF = ectCalcDeltaMm(40000, 30e6, 1); // f×4 → δ/2
      const cuatroSigma = ectCalcDeltaMm(10000, 120e6, 1); // σ×4 → δ/2
      if (Math.abs(cuatroF - base/2) / (base/2) > 1e-6) return { ok: false, msg: 'No es inversamente proporcional a √f' };
      if (Math.abs(cuatroSigma - base/2) / (base/2) > 1e-6) return { ok: false, msg: 'No es inversamente proporcional a √σ' };
      return { ok: true, msg: 'δ ∝ 1/√(f·σ) ✓' };
    }
  },
  {
    id: 'ect_calc_delta_invalido', group: 'Corrientes inducidas (eddy current)',
    name: 'ectCalcDeltaMm — f, σ o μr ≤0 devuelve NaN',
    run: () => {
      if (!Number.isNaN(ectCalcDeltaMm(0, 58e6, 1))) return { ok: false, msg: 'f=0 no dio NaN' };
      if (!Number.isNaN(ectCalcDeltaMm(60000, 0, 1))) return { ok: false, msg: 'σ=0 no dio NaN' };
      if (!Number.isNaN(ectCalcDeltaMm(60000, 58e6, 0))) return { ok: false, msg: 'μr=0 no dio NaN' };
      if (!Number.isNaN(ectCalcDeltaMm(-1, 58e6, 1))) return { ok: false, msg: 'f<0 no dio NaN' };
      return { ok: true, msg: 'f≤0, σ≤0 o μr≤0 → NaN en los 4 casos ✓' };
    }
  },
  {
    id: 'ect_amplitud_fase_referencia', group: 'Corrientes inducidas (eddy current)',
    name: 'ectAmplitudRel/ectFaseGrados — a x=δ, amplitud≈36,8% y fase≈57,3° (1 rad)',
    run: () => {
      const amp = ectAmplitudRel(10, 10); // x=δ
      const fase = ectFaseGrados(10, 10);
      if (Math.abs(amp - Math.E**-1) > 1e-9) return { ok: false, msg: `Amplitud en x=δ: ${amp}, esperado e⁻¹≈0,3679` };
      if (Math.abs(fase - (180/Math.PI)) > 1e-6) return { ok: false, msg: `Fase en x=δ: ${fase}°, esperado 1 rad≈57,3°` };
      return { ok: true, msg: `x=δ → amplitud=${(amp*100).toFixed(1)}%, fase=${fase.toFixed(1)}° ✓` };
    }
  },
  {
    id: 'ect_amplitud_efectiva', group: 'Corrientes inducidas (eddy current)',
    name: 'ectAmplitudRel — a x=3δ ("profundidad efectiva"), amplitud≈5% (convención habitual de ECT)',
    run: () => {
      const amp = ectAmplitudRel(30, 10); // x=3δ
      const esperado = Math.E**-3; // ≈0.0498
      if (Math.abs(amp - esperado) > 1e-9) return { ok: false, msg: `Amplitud en x=3δ: ${(amp*100).toFixed(2)}%, esperado≈${(esperado*100).toFixed(2)}%` };
      return { ok: true, msg: `x=3δ → amplitud≈${(amp*100).toFixed(2)}% ✓` };
    }
  },
  {
    id: 'ect_amplitud_monotona', group: 'Corrientes inducidas (eddy current)',
    name: 'ectAmplitudRel — decrece monótonamente con la profundidad, sin valores negativos',
    run: () => {
      const delta = 5;
      let prev = ectAmplitudRel(0, delta);
      for (let x = 1; x <= 20; x++) {
        const a = ectAmplitudRel(x, delta);
        if (a < 0 || a > prev) return { ok: false, msg: `Amplitud no monótona/negativa en x=${x} mm` };
        prev = a;
      }
      return { ok: true, msg: 'Amplitud monótona decreciente en 0-20mm ✓' };
    }
  },
  {
    id: 'ect_tabla_metales', group: 'Corrientes inducidas (eddy current)',
    name: 'ECT_METAL_TABLE — 6 metales no ferromagnéticos, todos con %IACS entre 0 y 100',
    run: () => {
      const keys = Object.keys(ECT_METAL_TABLE);
      if (keys.length !== 6) return { ok: false, msg: `${keys.length} metales (esperados 6)` };
      const malos = keys.filter(k => !(ECT_METAL_TABLE[k].iacs > 0) || ECT_METAL_TABLE[k].iacs > 100);
      if (malos.length) return { ok: false, msg: `Metales con %IACS inválido: ${malos.join(', ')}` };
      // Cobre (ASTM E1004) tiene que ser exactamente 100% IACS por definición de la norma.
      if (ECT_METAL_TABLE.cobre.iacs !== 100) return { ok: false, msg: 'Cobre no está en 100% IACS (definición de ASTM E1004)' };
      return { ok: true, msg: '6 metales, %IACS válido, cobre=100% IACS ✓' };
    }
  },
  {
    id: 'ect_material_personalizado', group: 'Corrientes inducidas (eddy current)',
    name: 'Material "Otro" (backlog punto C, v5.9) — muestra el input de σ y lo usa en vez de la tabla',
    run: () => {
      const sel = document.getElementById('ect_metal');
      const original = sel.value;
      sel.value = 'otro';
      document.getElementById('ect_sigmaCustom').value = '50'; // 50% IACS, distinto a cualquier valor de la tabla
      ectMetalToggle();

      const visible = document.getElementById('ect_sigmaCustomWrap').style.display !== 'none';
      const sigmaTexto = document.getElementById('ect_mSigma').textContent; // MS/m
      const sigmaEsperada = (50 / 100 * 58); // 29.0 MS/m

      sel.value = original; ectMetalToggle(); // vuelve al estado inicial

      if (!visible) return { ok: false, msg: 'ect_sigmaCustomWrap no se mostró con material="otro"' };
      if (Math.abs(parseFloat(sigmaTexto) - sigmaEsperada) > 0.1) {
        return { ok: false, msg: `σ mostrada=${sigmaTexto} MS/m, esperada ≈${sigmaEsperada.toFixed(1)} MS/m para 50% IACS` };
      }
      return { ok: true, msg: `50% IACS → σ=${sigmaTexto} MS/m (≈${sigmaEsperada.toFixed(1)} esperado) ✓` };
    }
  },
  // ---- ULTRASONIDO / PULSO-ECO (v5.2, 2do ensayo del Grupo B) ----
  {
    id: 'ut_tiempo_vuelo_referencia', group: 'Ultrasonido (pulso-eco)',
    name: 'utCalcTiempoVuelo — acero, 50mm, da t≈16,95 µs (2d/v)',
    run: () => {
      const t = utCalcTiempoVuelo(50, 5.90);
      const esperado = 2 * 50 / 5.90;
      if (Math.abs(t - esperado) > 1e-9) return { ok: false, msg: `t=${t}, esperado ${esperado}` };
      return { ok: true, msg: `t=${t.toFixed(2)} µs ✓` };
    }
  },
  {
    id: 'ut_tiempo_vuelo_invalido', group: 'Ultrasonido (pulso-eco)',
    name: 'utCalcTiempoVuelo — profundidad o velocidad inválida devuelve NaN',
    run: () => {
      if (!Number.isNaN(utCalcTiempoVuelo(-5, 5.90))) return { ok: false, msg: 'profundidad<0 no dio NaN' };
      if (!Number.isNaN(utCalcTiempoVuelo(50, 0))) return { ok: false, msg: 'velocidad=0 no dio NaN' };
      if (!Number.isNaN(utCalcTiempoVuelo(50, -1))) return { ok: false, msg: 'velocidad<0 no dio NaN' };
      if (Number.isNaN(utCalcTiempoVuelo(0, 5.90))) return { ok: false, msg: 'profundidad=0 (pulso inicial) debería dar t=0, no NaN' };
      return { ok: true, msg: 'profundidad/velocidad inválida → NaN, profundidad=0 → t=0 ✓' };
    }
  },
  {
    id: 'ut_profundidad_inversa', group: 'Ultrasonido (pulso-eco)',
    name: 'utCalcProfundidad — inversa exacta de utCalcTiempoVuelo (round-trip)',
    run: () => {
      const v = 6.32; // aluminio
      for (const d of [0, 10, 37.5, 120, 300]) {
        const t = utCalcTiempoVuelo(d, v);
        const d2 = utCalcProfundidad(t, v);
        if (Math.abs(d2 - d) > 1e-9) return { ok: false, msg: `d=${d} → t=${t} → d2=${d2} (no coincide)` };
      }
      return { ok: true, msg: 'utCalcProfundidad(utCalcTiempoVuelo(d,v),v)=d en 5 casos ✓' };
    }
  },
  {
    id: 'ut_tabla_velocidades', group: 'Ultrasonido (pulso-eco)',
    name: 'UT_VELOCIDAD_TABLE — 6 materiales, todas las velocidades > 0 y en rango físico razonable',
    run: () => {
      const keys = Object.keys(UT_VELOCIDAD_TABLE);
      if (keys.length !== 6) return { ok: false, msg: `${keys.length} materiales (esperados 6)` };
      // Rango razonable para ondas longitudinales en sólidos de ingeniería: 1-10 mm/µs
      const malos = keys.filter(k => !(UT_VELOCIDAD_TABLE[k].v > 1 && UT_VELOCIDAD_TABLE[k].v < 10));
      if (malos.length) return { ok: false, msg: `Velocidades fuera de rango: ${malos.join(', ')}` };
      return { ok: true, msg: '6 materiales, velocidades en 1-10 mm/µs ✓' };
    }
  },
  {
    id: 'ut_defecto_fuera_de_espesor', group: 'Ultrasonido (pulso-eco)',
    name: 'Defecto con profundidad ≥ espesor no debe generar eco (se ignora en la UI)',
    run: () => {
      // Prueba de la condición usada en utUpdate() para decidir si hay eco de
      // defecto -- no depende del DOM, así que se puede testear la lógica
      // aislada acá aunque el dibujo en sí viva en utUpdate().
      const casos = [
        { prof: 0, esp: 50, esperado: false },
        { prof: 50, esp: 50, esperado: false },
        { prof: 60, esp: 50, esperado: false },
        { prof: 20, esp: 50, esperado: true },
      ];
      for (const c of casos) {
        const hay = c.prof > 0 && c.prof < c.esp;
        if (hay !== c.esperado) return { ok: false, msg: `prof=${c.prof}, esp=${c.esp}: hay=${hay}, esperado=${c.esperado}` };
      }
      return { ok: true, msg: '4 casos de borde (0, =espesor, >espesor, válido) ✓' };
    }
  },
  // ---- MODO DESAFÍO (backlog punto B, v5.8) ----
  {
    id: 'md_valor_en_rango_determinista', group: 'Modo desafío (NDT, v5.8)',
    name: 'mdValorEnRango — misma semilla da siempre el mismo resultado',
    run: () => {
      const a = mdValorEnRango(12345, 1, 49, 1);
      const b = mdValorEnRango(12345, 1, 49, 1);
      if (a !== b) return { ok: false, msg: `Misma semilla dio valores distintos: ${a} vs ${b}` };
      return { ok: true, msg: `Semilla 12345 → ${a} (reproducible) ✓` };
    }
  },
  {
    id: 'md_valor_en_rango_limites', group: 'Modo desafío (NDT, v5.8)',
    name: 'mdValorEnRango — resultado siempre dentro de [min, max] y alineado al step, para muchas semillas',
    run: () => {
      for (let s = 0; s < 200; s++) {
        const v = mdValorEnRango(s * 977, 5, 45, 1);
        if (v < 5 || v > 45) return { ok: false, msg: `Semilla ${s * 977}: v=${v} fuera de [5,45]` };
        if (Math.abs((v - 5) - Math.round(v - 5)) > 1e-9) return { ok: false, msg: `Semilla ${s * 977}: v=${v} no está alineado al step=1` };
      }
      return { ok: true, msg: '200 semillas, siempre dentro de rango y alineadas al step ✓' };
    }
  },
  {
    id: 'md_valor_en_rango_rango_invalido', group: 'Modo desafío (NDT, v5.8)',
    name: 'mdValorEnRango — si max<=min devuelve min en vez de romper',
    run: () => {
      const v1 = mdValorEnRango(1, 10, 10, 1);
      const v2 = mdValorEnRango(1, 10, 5, 1);
      if (v1 !== 10) return { ok: false, msg: `max=min: devolvió ${v1} (esperado 10)` };
      if (v2 !== 10) return { ok: false, msg: `max<min: devolvió ${v2} (esperado 10, el min)` };
      return { ok: true, msg: 'Rangos degenerados devuelven min sin romper ✓' };
    }
  },
  {
    id: 'md_mensaje_resultado', group: 'Modo desafío (NDT, v5.8)',
    name: 'mdMensajeResultado — sin estimación pide completar, dentro/fuera del 10% da feedback distinto',
    run: () => {
      const sinEst = mdMensajeResultado(NaN, 20, 'mm', 'pista');
      if (!sinEst.toLowerCase().includes('estimación')) return { ok: false, msg: `Sin estimación no pide completar: "${sinEst}"` };
      const buena = mdMensajeResultado(21, 20, 'mm', 'pista'); // dif=1, tolerancia=max(1,2)=2
      if (!buena.toLowerCase().includes('buena')) return { ok: false, msg: `Dentro del 10% no dice "buena": "${buena}"` };
      const mala = mdMensajeResultado(35, 20, 'mm', 'pista de prueba'); // dif=15, tolerancia=2
      if (buena === mala || mala.toLowerCase().includes('buena')) return { ok: false, msg: `Fuera del 10% no debería decir "buena": "${mala}"` };
      return { ok: true, msg: '3 casos (sin estimación / dentro / fuera del 10%) con mensajes distintos ✓' };
    }
  },
  {
    id: 'ut_modo_desafio_oculta_y_revela', group: 'Ultrasonido (pulso-eco)',
    name: 'Modo desafío UT — oculta sliders y tiempo del defecto, Revelar muestra el valor real',
    run: () => {
      const selModo = document.getElementById('ut_modo');
      const modoOriginal = selModo.value;
      selModo.value = 'desafio';
      utModoToggle();

      const camposOcultos = document.getElementById('ut_camposDefecto').style.display === 'none';
      const camposDesafioVisibles = document.getElementById('ut_camposDesafio').style.display !== 'none';
      if (!camposOcultos) { selModo.value = modoOriginal; utModoToggle(); return { ok: false, msg: 'ut_camposDefecto no se ocultó al activar el desafío' }; }
      if (!camposDesafioVisibles) { selModo.value = modoOriginal; utModoToggle(); return { ok: false, msg: 'ut_camposDesafio no se mostró al activar el desafío' }; }

      const tTextoOculto = document.getElementById('ut_mTDefecto').textContent;
      if (tTextoOculto !== '?' && tTextoOculto !== '—') {
        selModo.value = modoOriginal; utModoToggle();
        return { ok: false, msg: `Tiempo de vuelo al defecto no se ocultó antes de revelar: "${tTextoOculto}"` };
      }

      // FIX (prototipo post-v6.12): desde que Ultrasonido tiene posición X,
      // el modo desafío exige encontrar el defecto barriendo ANTES de poder
      // revelar su profundidad -- acá se simula ese hallazgo llevando el
      // palpador directo a UT_DESAFIO.posDef (ver ut_encontrado_persiste,
      // en el grupo "Escenas interactivas", para el test dedicado a esa
      // mecánica en sí).
      if (document.getElementById('ut_btnRevelar').disabled !== true) {
        selModo.value = modoOriginal; utModoToggle();
        return { ok: false, msg: 'Revelar debería arrancar deshabilitado, antes de encontrar el defecto en X' };
      }
      document.getElementById('ut_posPalpador').value = String(UT_DESAFIO.posDef);
      utUpdate();
      if (document.getElementById('ut_btnRevelar').disabled !== false) {
        selModo.value = modoOriginal; utModoToggle();
        return { ok: false, msg: 'Revelar debería habilitarse al alinear el palpador con el defecto' };
      }

      const real = UT_DESAFIO.profDef;
      document.getElementById('ut_estProfundidad').value = String(real); // estimación perfecta
      utDesafioRevelar();

      const resultadoVisible = document.getElementById('ut_desafioResultado').style.display !== 'none';
      const difTexto = document.getElementById('ut_rDif').textContent;
      const tTextoRevelado = document.getElementById('ut_mTDefecto').textContent;

      // vuelve a exploración para no afectar otros tests
      selModo.value = modoOriginal; utModoToggle();

      if (!resultadoVisible) return { ok: false, msg: 'ut_desafioResultado no se mostró después de Revelar' };
      if (!difTexto.startsWith('0,0')) return { ok: false, msg: `Estimación perfecta debería dar diferencia 0,0mm, dio: "${difTexto}"` };
      if (tTextoRevelado === '?') return { ok: false, msg: 'Tiempo de vuelo al defecto sigue oculto después de Revelar' };
      return { ok: true, msg: `Real=${real}mm, estimación perfecta → diferencia ${difTexto}, oculto antes/revelado después ✓` };
    }
  },
  {
    id: 'rx_modo_desafio_oculta_y_revela', group: 'Radiografía (Beer-Lambert)',
    name: 'Modo desafío RX — oculta slider y relación defecto/sano, Revelar muestra el valor real',
    run: () => {
      const selModo = document.getElementById('rx_modo');
      const modoOriginal = selModo.value;
      selModo.value = 'desafio';
      rxModoToggle();

      const camposOcultos = document.getElementById('rx_camposDefecto').style.display === 'none';
      const camposDesafioVisibles = document.getElementById('rx_camposDesafio').style.display !== 'none';
      if (!camposOcultos) { selModo.value = modoOriginal; rxModoToggle(); return { ok: false, msg: 'rx_camposDefecto no se ocultó al activar el desafío' }; }
      if (!camposDesafioVisibles) { selModo.value = modoOriginal; rxModoToggle(); return { ok: false, msg: 'rx_camposDesafio no se mostró al activar el desafío' }; }

      const ratioTextoOculto = document.getElementById('rx_mRatio').textContent;
      if (ratioTextoOculto !== '?' && ratioTextoOculto !== '—') {
        selModo.value = modoOriginal; rxModoToggle();
        return { ok: false, msg: `Relación defecto/sano no se ocultó antes de revelar: "${ratioTextoOculto}"` };
      }

      const real = RX_DESAFIO.perdida;
      document.getElementById('rx_estPerdida').value = String(real); // estimación perfecta
      rxDesafioRevelar();

      const resultadoVisible = document.getElementById('rx_desafioResultado').style.display !== 'none';
      const difTexto = document.getElementById('rx_rDif').textContent;
      const ratioTextoRevelado = document.getElementById('rx_mRatio').textContent;

      selModo.value = modoOriginal; rxModoToggle();

      if (!resultadoVisible) return { ok: false, msg: 'rx_desafioResultado no se mostró después de Revelar' };
      if (!difTexto.startsWith('0,0')) return { ok: false, msg: `Estimación perfecta debería dar diferencia 0,0mm, dio: "${difTexto}"` };
      if (ratioTextoRevelado === '?') return { ok: false, msg: 'Relación defecto/sano sigue oculta después de Revelar' };
      return { ok: true, msg: `Real=${real}mm, estimación perfecta → diferencia ${difTexto}, oculto antes/revelado después ✓` };
    }
  },
  {
    id: 'ut_desafio_defecto_dentro_de_pieza', group: 'Ultrasonido (pulso-eco)',
    name: 'Modo desafío UT — la profundidad generada siempre queda dentro del espesor actual, en 30 desafíos seguidos',
    run: () => {
      const selModo = document.getElementById('ut_modo');
      const modoOriginal = selModo.value;
      const espesor = parseFloat(document.getElementById('ut_espesor').value) || 50;
      selModo.value = 'desafio';
      utModoToggle();
      let malos = 0;
      for (let i = 0; i < 30; i++) {
        utDesafioNuevo();
        if (!(UT_DESAFIO.profDef > 0 && UT_DESAFIO.profDef < espesor)) malos++;
      }
      selModo.value = modoOriginal; utModoToggle();
      if (malos) return { ok: false, msg: `${malos}/30 desafíos generaron una profundidad fuera de (0, espesor)` };
      return { ok: true, msg: `30/30 desafíos con profundidad dentro de (0, ${espesor})mm ✓` };
    }
  },
  {
    id: 'rx_desafio_defecto_dentro_de_pieza', group: 'Radiografía (Beer-Lambert)',
    name: 'Modo desafío RX — la pérdida generada siempre queda dentro del espesor actual, en 30 desafíos seguidos',
    run: () => {
      const selModo = document.getElementById('rx_modo');
      const modoOriginal = selModo.value;
      const espesor = parseFloat(document.getElementById('rx_espesor').value) || 25;
      selModo.value = 'desafio';
      rxModoToggle();
      let malos = 0;
      for (let i = 0; i < 30; i++) {
        rxDesafioNuevo();
        if (!(RX_DESAFIO.perdida > 0 && RX_DESAFIO.perdida < espesor)) malos++;
      }
      selModo.value = modoOriginal; rxModoToggle();
      if (malos) return { ok: false, msg: `${malos}/30 desafíos generaron una pérdida fuera de (0, espesor)` };
      return { ok: true, msg: `30/30 desafíos con pérdida dentro de (0, ${espesor})mm ✓` };
    }
  },
  {
    id: 'ut_material_personalizado', group: 'Ultrasonido (pulso-eco)',
    name: 'Material "Otro" (backlog punto C, v5.9) — muestra el input de v y lo usa en vez de la tabla',
    run: () => {
      const sel = document.getElementById('ut_metal');
      const original = sel.value;
      sel.value = 'otro';
      document.getElementById('ut_velCustom').value = '3.33'; // valor distinto a cualquiera de la tabla
      utMaterialToggle();

      const visible = document.getElementById('ut_velCustomWrap').style.display !== 'none';
      const vTexto = document.getElementById('ut_mVelocidad').textContent;

      sel.value = original; utMaterialToggle();

      if (!visible) return { ok: false, msg: 'ut_velCustomWrap no se mostró con material="otro"' };
      // FIX #63 (hallazgo QA v6.16, M53-01): ut_mVelocidad ahora se muestra
      // con coma decimal, aunque el input ut_velCustom siga en punto (es un
      // <input type="number">, que debe mantenerse en punto).
      if (vTexto !== '3,33') return { ok: false, msg: `Velocidad mostrada="${vTexto}" (esperado "3,33")` };
      return { ok: true, msg: `v=3.33 mm/µs manual, reflejado en la métrica como 3,33 ✓` };
    }
  },
  {
    id: 'rx_material_personalizado', group: 'Radiografía (Beer-Lambert)',
    name: 'Material "Otro" (backlog punto C, v5.9) — muestra el input de HVL y lo usa en vez de la tabla',
    run: () => {
      const sel = document.getElementById('rx_material');
      const original = sel.value;
      sel.value = 'otro';
      document.getElementById('rx_hvlCustom').value = '20'; // valor distinto a cualquiera de la tabla
      rxMaterialToggle();

      const visible = document.getElementById('rx_hvlCustomWrap').style.display !== 'none';
      const muTexto = document.getElementById('rx_mMu').textContent;
      const muEsperado = Math.LN2 / 20;

      sel.value = original; rxMaterialToggle();

      if (!visible) return { ok: false, msg: 'rx_hvlCustomWrap no se mostró con material="otro"' };
      // FIX #63 (hallazgo QA v6.16, M53-01): muTexto ahora puede venir con
      // coma decimal (convención argentina) -- parseFloat() se detiene en
      // la coma y da un resultado truncado/incorrecto si no se normaliza
      // primero a punto.
      if (Math.abs(parseFloat(muTexto.replace(',', '.')) - muEsperado) > 0.001) {
        return { ok: false, msg: `μ mostrado=${muTexto}, esperado ≈${muEsperado.toFixed(4)} para HVL=20mm` };
      }
      return { ok: true, msg: `HVL=20mm manual → μ=${muTexto} (≈${muEsperado.toFixed(4)} esperado) ✓` };
    }
  },
  {
    id: 'ficha_ect', group: 'Fichas de laboratorio (Grupo B, backlog punto D, v5.10)',
    name: 'showFichaECT — título correcto, material y métricas presentes, modal abre/cierra',
    run: () => {
      try {
        document.getElementById('ect_metal').value = 'cobre';
        ectUpdate();
        showFichaECT();
        const html = document.getElementById('fichaBody').innerHTML;
        const abierto = document.getElementById('fichaModal').style.display === 'flex';
        if (!abierto) return { ok: false, msg: 'fichaModal no quedó abierto (display != flex)' };
        if (!html.includes('Corrientes Inducidas')) return { ok: false, msg: 'Falta el título esperado' };
        if (!html.includes('Cobre')) return { ok: false, msg: 'Falta el material (Cobre) en la ficha' };
        if (!/<img/.test(html)) return { ok: false, msg: 'Falta la imagen del gráfico (esperaba un <img> desde el canvas)' };
        return { ok: true, msg: 'Título, material e imagen presentes ✓' };
      } finally { closeFicha(); }
    }
  },
  {
    id: 'ficha_ut', group: 'Fichas de laboratorio (Grupo B, backlog punto D, v5.10)',
    name: 'showFichaUT — refleja el modo desafío sin revelar la respuesta',
    run: () => {
      const selModo = document.getElementById('ut_modo');
      const modoOriginal = selModo.value;
      try {
        selModo.value = 'desafio'; utModoToggle();
        showFichaUT();
        const htmlSinRevelar = document.getElementById('fichaBody').innerHTML;
        if (!htmlSinRevelar.includes('sin revelar')) return { ok: false, msg: 'Sin revelar, la ficha debería avisar que el desafío sigue sin revelar' };
        if (htmlSinRevelar.includes(UT_DESAFIO.profDef.toFixed(1).replace('.',','))) return { ok: false, msg: 'La ficha reveló la profundidad real antes de que el alumno la revelara en pantalla' };

        document.getElementById('ut_estProfundidad').value = String(UT_DESAFIO.profDef);
        // FIX (prototipo post-v6.12): hay que encontrar el defecto en X
        // antes de poder revelar (ver ut_modo_desafio_oculta_y_revela).
        document.getElementById('ut_posPalpador').value = String(UT_DESAFIO.posDef);
        utUpdate();
        utDesafioRevelar();
        showFichaUT();
        const htmlRevelado = document.getElementById('fichaBody').innerHTML;
        if (!htmlRevelado.includes(UT_DESAFIO.profDef.toFixed(1).replace('.',','))) return { ok: false, msg: 'Ya revelado, la ficha debería mostrar la profundidad real' };
        return { ok: true, msg: 'Oculta antes de revelar, muestra el valor real después ✓' };
      } finally {
        selModo.value = modoOriginal; utModoToggle();
        closeFicha();
      }
    }
  },
  {
    id: 'ficha_rx', group: 'Fichas de laboratorio (Grupo B, backlog punto D, v5.10)',
    name: 'showFichaRX — título correcto, material "Otro" se etiqueta como Personalizado',
    run: () => {
      const sel = document.getElementById('rx_material');
      const original = sel.value;
      try {
        sel.value = 'otro';
        document.getElementById('rx_hvlCustom').value = '33';
        rxMaterialToggle();
        showFichaRX();
        const html = document.getElementById('fichaBody').innerHTML;
        if (!html.includes('Radiografía Industrial')) return { ok: false, msg: 'Falta el título esperado' };
        if (!html.includes('Personalizado')) return { ok: false, msg: 'Material "otro" no se etiquetó como "Personalizado" en la ficha' };
        if (!html.includes('Ir-192')) return { ok: false, msg: 'Falta la fuente (Ir-192) en la ficha' };
        return { ok: true, msg: 'Título, "Personalizado" y fuente presentes ✓' };
      } finally {
        sel.value = original; rxMaterialToggle();
        closeFicha();
      }
    }
  },
  {
    id: 'ficha_pn_mt', group: 'Fichas de laboratorio (Grupo B, backlog punto D, v5.10)',
    name: 'showFichaPN / showFichaMT — badge "ENSAYO COMPLETO" solo al llegar al último paso',
    run: () => {
      try {
        pnReiniciar();
        showFichaPN();
        const htmlPnInicio = document.getElementById('fichaBody').innerHTML;
        if (htmlPnInicio.includes('ENSAYO COMPLETO')) return { ok: false, msg: 'PN: no debería mostrar "ENSAYO COMPLETO" en el paso 1' };
        if (!htmlPnInicio.includes('aún no terminado')) return { ok: false, msg: 'PN: falta la nota de "aún no terminado" en el paso 1' };

        while (fsmPuedeAvanzar(pnEstado)) { pnEstado = fsmAvanzar(pnEstado); pnEstado = { ...pnEstado, esperaRestanteSeg: 0 }; }
        pnRender();
        showFichaPN();
        const htmlPnFin = document.getElementById('fichaBody').innerHTML;
        if (!htmlPnFin.includes('ENSAYO COMPLETO')) return { ok: false, msg: 'PN: debería mostrar "ENSAYO COMPLETO" en el último paso' };

        mtReiniciar();
        showFichaMT();
        const htmlMtInicio = document.getElementById('fichaBody').innerHTML;
        if (htmlMtInicio.includes('ENSAYO COMPLETO')) return { ok: false, msg: 'MT: no debería mostrar "ENSAYO COMPLETO" en el paso 1' };

        while (fsmPuedeAvanzar(mtEstado)) mtEstado = fsmAvanzar(mtEstado);
        mtRender();
        showFichaMT();
        const htmlMtFin = document.getElementById('fichaBody').innerHTML;
        if (!htmlMtFin.includes('ENSAYO COMPLETO')) return { ok: false, msg: 'MT: debería mostrar "ENSAYO COMPLETO" en el último paso' };

        pnReiniciar(); mtReiniciar(); // deja todo como estaba para el resto de los tests
        return { ok: true, msg: 'Badge "ENSAYO COMPLETO" solo en el último paso, en PN y MT ✓' };
      } finally { closeFicha(); }
    }
  },
  // ---- METALOGRAFÍA / ASTM E112 (v5.3, 3er ensayo del Grupo B) ----
  {
    id: 'mg_g_invalido', group: 'Metalografía (ASTM E112)',
    name: 'mgCalcG — ℓ≤0 devuelve NaN',
    run: () => {
      if (!Number.isNaN(mgCalcG(0))) return { ok: false, msg: 'ℓ=0 no dio NaN' };
      if (!Number.isNaN(mgCalcG(-0.01))) return { ok: false, msg: 'ℓ<0 no dio NaN' };
      return { ok: true, msg: 'ℓ≤0 → NaN ✓' };
    }
  },
  {
    id: 'mg_g_monotono', group: 'Metalografía (ASTM E112)',
    name: 'mgCalcG — decrece al aumentar ℓ (grano más grueso → G más chico)',
    run: () => {
      const valores = [0.005, 0.01, 0.02, 0.05, 0.1, 0.2, 0.3].map(mgCalcG);
      for (let i = 1; i < valores.length; i++) {
        if (valores[i] >= valores[i - 1]) return { ok: false, msg: `No es monótona decreciente en ℓ=${[0.005,0.01,0.02,0.05,0.1,0.2,0.3][i]}` };
      }
      return { ok: true, msg: 'G decrece monótonamente con ℓ ✓' };
    }
  },
  {
    id: 'mg_roundtrip_g_ell', group: 'Metalografía (ASTM E112)',
    name: 'mgCalcEllDesdeG — inversa exacta de mgCalcG (round-trip)',
    run: () => {
      for (const G of [-1, 0, 3, 5, 8, 10, 14]) {
        const ell = mgCalcEllDesdeG(G);
        const G2 = mgCalcG(ell);
        if (Math.abs(G2 - G) > 1e-6) return { ok: false, msg: `G=${G} → ℓ=${ell} → G2=${G2} (no coincide)` };
      }
      return { ok: true, msg: 'mgCalcG(mgCalcEllDesdeG(G))=G en 7 casos ✓' };
    }
  },
  {
    id: 'mg_referencia_g00', group: 'Metalografía (ASTM E112)',
    name: 'mgCalcNA/mgCalcDiametroMm — G=-1 (ASTM "00") da diámetro≈0,508mm (valor citado por la norma)',
    run: () => {
      const NA = mgCalcNA(-1);
      const d = mgCalcDiametroMm(NA);
      const esperado = 0.508;
      const err = Math.abs(d - esperado) / esperado;
      if (err > 0.001) return { ok: false, msg: `d=${d.toFixed(4)}mm, esperado≈${esperado}mm (err ${(err*100).toFixed(2)}%)` };
      return { ok: true, msg: `G=-1 → d=${d.toFixed(4)}mm ✓` };
    }
  },
  {
    id: 'mg_referencia_g14', group: 'Metalografía (ASTM E112)',
    name: 'mgCalcNA/mgCalcDiametroMm — G=14 da diámetro≈2,8µm (valor citado por la norma)',
    run: () => {
      const NA = mgCalcNA(14);
      const d_um = mgCalcDiametroMm(NA) * 1000;
      const esperado = 2.8;
      const err = Math.abs(d_um - esperado) / esperado;
      if (err > 0.01) return { ok: false, msg: `d=${d_um.toFixed(2)}µm, esperado≈${esperado}µm (err ${(err*100).toFixed(2)}%)` };
      return { ok: true, msg: `G=14 → d=${d_um.toFixed(2)}µm ✓` };
    }
  },
  {
    id: 'mg_na_invalido', group: 'Metalografía (ASTM E112)',
    name: 'mgCalcDiametroMm — NA≤0 devuelve NaN',
    run: () => {
      if (!Number.isNaN(mgCalcDiametroMm(0))) return { ok: false, msg: 'NA=0 no dio NaN' };
      if (!Number.isNaN(mgCalcDiametroMm(-5))) return { ok: false, msg: 'NA<0 no dio NaN' };
      return { ok: true, msg: 'NA≤0 → NaN ✓' };
    }
  },
  {
    id: 'mg_semillas_deterministas', group: 'Metalografía (ASTM E112)',
    name: 'mgGenerarSemillas — misma semilla da siempre el mismo resultado (reproducible)',
    run: () => {
      const a = mgGenerarSemillas(30, 12345, 320, 220);
      const b = mgGenerarSemillas(30, 12345, 320, 220);
      if (a.length !== 30 || b.length !== 30) return { ok: false, msg: `largo: ${a.length}/${b.length} (esperado 30)` };
      for (let i = 0; i < 30; i++) {
        if (a[i].x !== b[i].x || a[i].y !== b[i].y) return { ok: false, msg: `Punto ${i} no coincide entre corridas` };
        if (a[i].x < 0 || a[i].x > 320 || a[i].y < 0 || a[i].y > 220) return { ok: false, msg: `Punto ${i} fuera de los límites` };
      }
      return { ok: true, msg: '30 semillas, reproducibles y dentro de los límites ✓' };
    }
  },
  {
    id: 'mg_condicion_table', group: 'Metalografía (ASTM E112)',
    name: 'MG_CONDICION_TABLE — 4 condiciones, ℓ ordenado de mayor a menor (grueso→fino)',
    run: () => {
      const keys = ['fundicion', 'recocido', 'normalizado', 'templado'];
      if (Object.keys(MG_CONDICION_TABLE).length !== 4) return { ok: false, msg: `${Object.keys(MG_CONDICION_TABLE).length} condiciones (esperadas 4)` };
      for (let i = 1; i < keys.length; i++) {
        if (MG_CONDICION_TABLE[keys[i]].ell >= MG_CONDICION_TABLE[keys[i - 1]].ell) {
          return { ok: false, msg: `${keys[i]} no tiene ℓ menor que ${keys[i - 1]}` };
        }
      }
      return { ok: true, msg: '4 condiciones, ℓ decrece de fundición a templado ✓' };
    }
  },
  // ---- RADIOGRAFÍA / BEER-LAMBERT (v5.4, 4to ensayo del Grupo B) ----
  {
    id: 'rx_mu_invalido', group: 'Radiografía (Beer-Lambert)',
    name: 'rxCalcMu — HVL≤0 devuelve NaN',
    run: () => {
      if (!Number.isNaN(rxCalcMu(0))) return { ok: false, msg: 'HVL=0 no dio NaN' };
      if (!Number.isNaN(rxCalcMu(-1))) return { ok: false, msg: 'HVL<0 no dio NaN' };
      return { ok: true, msg: 'HVL≤0 → NaN ✓' };
    }
  },
  {
    id: 'rx_transmision_referencia_hvl', group: 'Radiografía (Beer-Lambert)',
    name: 'rxCalcTransmision — a t=HVL da EXACTAMENTE 50% para los 4 materiales (por definición de HVL)',
    run: () => {
      for (const k of Object.keys(RX_MATERIAL_TABLE)) {
        const hvl = RX_MATERIAL_TABLE[k].hvl;
        const mu = rxCalcMu(hvl);
        const T = rxCalcTransmision(hvl, mu);
        if (Math.abs(T - 0.5) > 1e-9) return { ok: false, msg: `${k}: T(HVL)=${T}, esperado 0.5` };
      }
      return { ok: true, msg: '4 materiales, T(HVL)=50,00% exacto ✓' };
    }
  },
  {
    id: 'rx_transmision_multiplos_hvl', group: 'Radiografía (Beer-Lambert)',
    name: 'rxCalcTransmision — a t=2·HVL y 3·HVL da 25% y 12,5% (mitades sucesivas)',
    run: () => {
      const mu = rxCalcMu(12.7); // acero
      const T2 = rxCalcTransmision(2 * 12.7, mu);
      const T3 = rxCalcTransmision(3 * 12.7, mu);
      if (Math.abs(T2 - 0.25) > 1e-9) return { ok: false, msg: `T(2·HVL)=${T2}, esperado 0.25` };
      if (Math.abs(T3 - 0.125) > 1e-9) return { ok: false, msg: `T(3·HVL)=${T3}, esperado 0.125` };
      return { ok: true, msg: 'T(2·HVL)=25%, T(3·HVL)=12,5% ✓' };
    }
  },
  {
    id: 'rx_transmision_invalido', group: 'Radiografía (Beer-Lambert)',
    name: 'rxCalcTransmision — espesor o μ inválido devuelve NaN',
    run: () => {
      if (!Number.isNaN(rxCalcTransmision(-1, 0.05))) return { ok: false, msg: 'espesor<0 no dio NaN' };
      if (!Number.isNaN(rxCalcTransmision(10, -0.01))) return { ok: false, msg: 'μ<0 no dio NaN' };
      if (Number.isNaN(rxCalcTransmision(0, 0.05))) return { ok: false, msg: 'espesor=0 debería dar T=1, no NaN' };
      return { ok: true, msg: 'entradas inválidas → NaN, espesor=0 → T=1 ✓' };
    }
  },
  {
    id: 'rx_ratio_defecto_sin_defecto', group: 'Radiografía (Beer-Lambert)',
    name: 'rxCalcRatioDefecto — sin pérdida de espesor (0mm) da ratio=1 (sin contraste)',
    run: () => {
      const r = rxCalcRatioDefecto(0.05, 0);
      if (Math.abs(r - 1) > 1e-9) return { ok: false, msg: `ratio=${r}, esperado 1` };
      return { ok: true, msg: 'pérdida=0 → ratio=1 ✓' };
    }
  },
  {
    id: 'rx_ratio_defecto_monotono', group: 'Radiografía (Beer-Lambert)',
    name: 'rxCalcRatioDefecto — crece monótonamente con la pérdida de espesor, siempre ≥1',
    run: () => {
      const mu = rxCalcMu(12.7);
      let prev = rxCalcRatioDefecto(mu, 0);
      for (let p = 1; p <= 10; p++) {
        const r = rxCalcRatioDefecto(mu, p);
        if (r < 1 || r <= prev) return { ok: false, msg: `No monótona o <1 en pérdida=${p}mm` };
        prev = r;
      }
      return { ok: true, msg: 'ratio monótono creciente y ≥1 en 0-10mm de pérdida ✓' };
    }
  },
  {
    id: 'rx_tabla_materiales', group: 'Radiografía (Beer-Lambert)',
    name: 'RX_MATERIAL_TABLE — 4 materiales, todos con HVL > 0',
    run: () => {
      const keys = Object.keys(RX_MATERIAL_TABLE);
      if (keys.length !== 4) return { ok: false, msg: `${keys.length} materiales (esperados 4)` };
      const malos = keys.filter(k => !(RX_MATERIAL_TABLE[k].hvl > 0));
      if (malos.length) return { ok: false, msg: `Materiales con HVL inválido: ${malos.join(', ')}` };
      return { ok: true, msg: '4 materiales, HVL>0 ✓' };
    }
  },
  {
    id: 'rx_defecto_fuera_de_espesor', group: 'Radiografía (Beer-Lambert)',
    name: 'Defecto con pérdida ≥ espesor no debe generar mancha (se ignora en la UI, mismo criterio que Ultrasonido)',
    run: () => {
      const casos = [
        { perdida: 0, esp: 25, esperado: false },
        { perdida: 25, esp: 25, esperado: false },
        { perdida: 30, esp: 25, esperado: false },
        { perdida: 6, esp: 25, esperado: true },
      ];
      for (const c of casos) {
        const hay = c.perdida > 0 && c.perdida < c.esp;
        if (hay !== c.esperado) return { ok: false, msg: `perdida=${c.perdida}, esp=${c.esp}: hay=${hay}, esperado=${c.esperado}` };
      }
      return { ok: true, msg: '4 casos de borde (0, =espesor, >espesor, válido) ✓' };
    }
  },
  // ---- MÁQUINA DE ESTADOS: LÍQUIDOS PENETRANTES / PARTÍCULAS MAGNÉTICAS (v5.5, 5to ensayo del Grupo B) ----
  {
    id: 'fsm_avanza_pasos_sin_espera', group: 'Máquina de estados (PT/MT)',
    name: 'fsmAvanzar — con pasos sin espera, avanza libremente hasta el último',
    run: () => {
      let e = fsmCrear([{ id: 'a', esperaMin: 0 }, { id: 'b', esperaMin: 0 }, { id: 'c', esperaMin: 0 }]);
      if (fsmPasoActual(e).id !== 'a') return { ok: false, msg: `arranca en ${fsmPasoActual(e).id}, esperado a` };
      e = fsmAvanzar(e);
      if (fsmPasoActual(e).id !== 'b') return { ok: false, msg: `paso 2: ${fsmPasoActual(e).id}, esperado b` };
      e = fsmAvanzar(e);
      if (fsmPasoActual(e).id !== 'c') return { ok: false, msg: `paso 3: ${fsmPasoActual(e).id}, esperado c` };
      if (fsmPuedeAvanzar(e)) return { ok: false, msg: 'en el último paso, fsmPuedeAvanzar debería ser false' };
      const e2 = fsmAvanzar(e);
      if (e2.indice !== e.indice) return { ok: false, msg: 'fsmAvanzar en el último paso no debería cambiar de índice' };
      return { ok: true, msg: 'a→b→c, sin poder pasarse del final ✓' };
    }
  },
  {
    id: 'fsm_espera_bloquea_avance', group: 'Máquina de estados (PT/MT)',
    name: 'fsmAvanzar/fsmPuedeAvanzar — un paso con espera bloquea el siguiente "Siguiente" hasta agotarse',
    run: () => {
      let e = fsmCrear([{ id: 'a', esperaMin: 0 }, { id: 'b', esperaMin: 10 }, { id: 'c', esperaMin: 0 }]);
      e = fsmAvanzar(e); // entra a 'b', con 10 min = 600s de espera
      if (e.esperaRestanteSeg !== 600) return { ok: false, msg: `esperaRestanteSeg=${e.esperaRestanteSeg}, esperado 600` };
      if (fsmPuedeAvanzar(e)) return { ok: false, msg: 'no debería poder avanzar mientras espera > 0' };
      e = fsmTick(e, 599);
      if (fsmPuedeAvanzar(e)) return { ok: false, msg: 'no debería poder avanzar con 1s restante' };
      e = fsmTick(e, 1);
      if (!fsmPuedeAvanzar(e)) return { ok: false, msg: 'debería poder avanzar con espera=0' };
      e = fsmAvanzar(e);
      if (fsmPasoActual(e).id !== 'c') return { ok: false, msg: `no avanzó a c, quedó en ${fsmPasoActual(e).id}` };
      return { ok: true, msg: 'espera de 600s bloquea el avance hasta llegar exactamente a 0 ✓' };
    }
  },
  {
    id: 'fsm_tick_no_baja_de_cero', group: 'Máquina de estados (PT/MT)',
    name: 'fsmTick — nunca deja esperaRestanteSeg negativo, aunque el decremento sea mayor al restante',
    run: () => {
      let e = fsmCrear([{ id: 'a', esperaMin: 0 }, { id: 'b', esperaMin: 1 }]);
      e = fsmAvanzar(e); // 60s de espera
      e = fsmTick(e, 999);
      if (e.esperaRestanteSeg !== 0) return { ok: false, msg: `esperaRestanteSeg=${e.esperaRestanteSeg}, esperado 0` };
      return { ok: true, msg: 'decremento > restante → clamped a 0 ✓' };
    }
  },
  {
    id: 'fsm_reiniciar', group: 'Máquina de estados (PT/MT)',
    name: 'fsmReiniciar — vuelve siempre al paso 0 con espera en 0, sin importar en qué paso estaba',
    run: () => {
      let e = fsmCrear([{ id: 'a', esperaMin: 0 }, { id: 'b', esperaMin: 5 }, { id: 'c', esperaMin: 0 }]);
      e = fsmAvanzar(e); e = fsmTick(e, 100);
      e = fsmReiniciar(e);
      if (e.indice !== 0 || e.esperaRestanteSeg !== 0) return { ok: false, msg: `indice=${e.indice}, esperaRestanteSeg=${e.esperaRestanteSeg} (esperado 0,0)` };
      return { ok: true, msg: 'reinicia a índice 0, espera 0 ✓' };
    }
  },
  {
    id: 'fsm_no_muta_estado_original', group: 'Máquina de estados (PT/MT)',
    name: 'fsmAvanzar/fsmTick — devuelven un objeto NUEVO, no mutan el estado recibido (inmutable)',
    run: () => {
      const original = fsmCrear([{ id: 'a', esperaMin: 0 }, { id: 'b', esperaMin: 5 }]);
      const copiaIndice = original.indice;
      const avanzado = fsmAvanzar(original);
      if (original.indice !== copiaIndice) return { ok: false, msg: 'fsmAvanzar mutó el estado original' };
      if (avanzado === original) return { ok: false, msg: 'fsmAvanzar devolvió la misma referencia, no un objeto nuevo' };
      const restanteOriginal = avanzado.esperaRestanteSeg;
      const tickeado = fsmTick(avanzado, 10);
      if (avanzado.esperaRestanteSeg !== restanteOriginal) return { ok: false, msg: 'fsmTick mutó el estado que recibió' };
      return { ok: true, msg: 'fsmAvanzar y fsmTick son puras (no mutan) ✓' };
    }
  },
  {
    id: 'rr_pasos_5_pasos_v6_3', group: 'R.R. Moore',
    name: 'rrPasos — devuelve 5 pasos en el orden montaje → contrapeso → arranque → en_marcha → resultado (v6.3)',
    run: () => {
      const pasos = rrPasos();
      if (pasos.length !== 5) return { ok: false, msg: `${pasos.length} pasos, esperados 5 (alcance de v6.3)` };
      const orden = pasos.map(p => p.id).join(',');
      if (orden !== 'montaje,contrapeso,arranque,en_marcha,resultado') return { ok: false, msg: `orden=${orden}` };
      if (!(pasos[3].esperaMin > 0)) return { ok: false, msg: '"en_marcha" necesita esperaMin > 0 para poder animarse con fsmTick' };
      if (pasos[4].esperaMin) return { ok: false, msg: '"resultado" no debería tener espera propia -- se llega ahí ya con la cuenta hecha' };
      return { ok: true, msg: '5 pasos en el orden correcto, espera solo en "en_marcha" ✓' };
    }
  },
  {
    id: 'rr_reusa_fsm_generico', group: 'R.R. Moore',
    name: 'rrSiguiente — reusa fsmAvanzar/fsmCrear tal cual; "resultado" (5to paso) es el único terminal',
    run: () => {
      rrReiniciar();
      rrSiguiente(); // -> contrapeso
      rrAgregarPlato(1); rrDistanciaM = 0.1; // sin esto, v6.4 bloquea el avance (ver rr_no_arranca_sin_contrapeso)
      rrSiguiente(); rrSiguiente();
      if (fsmPasoActual(rrEstado).id !== 'en_marcha') return { ok: false, msg: `paso 4: ${fsmPasoActual(rrEstado).id}, esperado en_marcha` };
      if (rrEstado.esperaRestanteSeg <= 0) return { ok: false, msg: 'al entrar a "en_marcha" debería arrancar con espera > 0' };
      if (fsmPuedeAvanzar(rrEstado)) return { ok: false, msg: 'mientras "en_marcha" tiene espera pendiente no debería poder avanzar por click manual' };
      rrReiniciar();
      return { ok: true, msg: 'avanza los primeros 3 pasos sin espera, "en_marcha" arranca con espera > 0 ✓' };
    }
  },
  {
    id: 'rr_no_arranca_sin_contrapeso', group: 'R.R. Moore',
    name: 'rrSiguiente — bloquea el paso "contrapeso" -> "arranque" si no hay ninguna plaqueta puesta (σ_a=0 no es un ensayo)',
    run: () => {
      rrReiniciar();
      rrSiguiente(); // -> contrapeso, sin plaquetas
      rrSiguiente(); // intenta avanzar sin peso -- no debería pasar nada
      if (fsmPasoActual(rrEstado).id !== 'contrapeso') return { ok: false, msg: `avanzó a "${fsmPasoActual(rrEstado).id}" sin contrapeso -- no debería poder` };
      const btn = document.getElementById('rr_btnSiguiente');
      if (!btn.disabled) return { ok: false, msg: 'el botón debería estar deshabilitado sin plaquetas en "contrapeso"' };
      if (!btn.textContent.toLowerCase().includes('plaqueta')) return { ok: false, msg: `el botón debería explicar por qué está trabado: "${btn.textContent}"` };

      rrAgregarPlato(0.5); rrDistanciaM = 0.05;
      rrRender();
      if (btn.disabled) return { ok: false, msg: 'con una plaqueta puesta, el botón ya debería habilitarse' };
      rrSiguiente();
      if (fsmPasoActual(rrEstado).id !== 'arranque') return { ok: false, msg: 'con contrapeso puesto, ahora sí debería avanzar a "arranque"' };
      rrReiniciar();
      return { ok: true, msg: 'no deja arrancar el motor con el gancho vacío; con una plaqueta puesta, avanza normal ✓' };
    }
  },
  {
    id: 'rr_parada_automatica_avanza_sola', group: 'R.R. Moore',
    name: 'rrAvanzarSiTerminoEspera — al terminar la espera de "en_marcha" avanza SOLA a "resultado" (no es un click del usuario)',
    run: () => {
      rrReiniciar();
      rrSiguiente(); // -> contrapeso
      rrAgregarPlato(1); rrDistanciaM = 0.1;
      rrSiguiente(); rrSiguiente(); // -> arranque -> en_marcha
      rrEstado = fsmTick(rrEstado, rrEstado.esperaTotalSeg); // consume toda la espera de una
      if (fsmPasoActual(rrEstado).id !== 'en_marcha') return { ok: false, msg: 'fsmTick solo no debería mover el índice -- eso lo hace rrAvanzarSiTerminoEspera' };
      rrEstado = rrAvanzarSiTerminoEspera(rrEstado);
      if (fsmPasoActual(rrEstado).id !== 'resultado') return { ok: false, msg: `debería haber avanzado solo a "resultado", quedó en "${fsmPasoActual(rrEstado).id}"` };
      if (rrEstado.esperaRestanteSeg !== 0) return { ok: false, msg: '"resultado" no tiene espera propia -- debería quedar en 0' };
      if (fsmPuedeAvanzar(rrEstado)) return { ok: false, msg: '"resultado" es el último paso -- no debería poder avanzar más' };
      // Llamar rrAvanzarSiTerminoEspera de nuevo (ya en "resultado") no
      // debería hacer nada -- solo actúa sobre "en_marcha".
      rrEstado = rrAvanzarSiTerminoEspera(rrEstado);
      if (fsmPasoActual(rrEstado).id !== 'resultado') return { ok: false, msg: 'no debería seguir avanzando más allá de "resultado"' };
      rrReiniciar();
      return { ok: true, msg: 'al agotarse la espera de "en_marcha", avanza sola a "resultado" y ahí se detiene ✓' };
    }
  },
  {
    id: 'rr_resultado_rotura_finita', group: 'R.R. Moore',
    name: 'rrRender — con vida finita, "resultado" muestra la rotura a N_f≈ftBasquinN y la probeta partida en la escena',
    run: () => {
      const sel = document.getElementById('rr_mat');
      const matOriginal = sel.value;
      try {
        sel.value = 'acero1045';
        rrReiniciar();
        rrTestFijarSigmaA(350); // 350 > Se=310 => vida finita
        rrSiguiente(); rrSiguiente(); rrSiguiente();
        rrEstado = fsmTick(rrEstado, rrEstado.esperaTotalSeg);
        rrEstado = rrAvanzarSiTerminoEspera(rrEstado);
        rrRender();

        if (fsmPasoActual(rrEstado).id !== 'resultado') return { ok: false, msg: 'debería haber llegado a "resultado"' };
        const titulo = document.getElementById('rr_pasoTitulo').textContent.toLowerCase();
        const texto = document.getElementById('rr_pasoTexto').textContent.toLowerCase();
        if (!titulo.includes('rotura')) return { ok: false, msg: `título debería mencionar "rotura": "${titulo}"` };
        const p = FT_SN_PRESETS['acero1045'];
        const nfEsperado = Math.round(ftBasquinN(rrSigmaA(), p.sfp, p.b));
        const soloDigitos = texto.replace(/[^\d]/g, '');
        if (!soloDigitos.includes(String(nfEsperado))) return { ok: false, msg: `texto debería mencionar N_f≈${nfEsperado}: "${texto}"` };

        const btn = document.getElementById('rr_btnSiguiente');
        if (!btn.textContent.toLowerCase().includes('terminado')) return { ok: false, msg: `acá SÍ es honesto decir "terminado": "${btn.textContent}"` };
        if (!btn.disabled) return { ok: false, msg: 'el botón debería seguir deshabilitado (no hay más pasos)' };

        const escena = document.getElementById('rr_escena').innerHTML;
        if (!escena.includes('var(--frac)')) return { ok: false, msg: 'la escena debería mostrar la marca de fractura (var(--frac)) en la rotura' };
        return { ok: true, msg: `resultado de rotura correcto: N_f≈${nfEsperado}, botón honesto, escena con fractura ✓` };
      } finally {
        sel.value = matOriginal; rrReiniciar();
      }
    }
  },
  {
    id: 'rr_resultado_runout_infinita', group: 'R.R. Moore',
    name: 'rrRender — con vida infinita, "resultado" es un run-out (NO rotura) a RR_CICLOS_RUNOUT, probeta entera en la escena',
    run: () => {
      const sel = document.getElementById('rr_mat');
      const matOriginal = sel.value;
      try {
        sel.value = 'acero1045';
        rrReiniciar();
        rrTestFijarSigmaA(200); // 200 < Se=310 => vida infinita
        rrSiguiente(); rrSiguiente(); rrSiguiente();
        rrEstado = fsmTick(rrEstado, rrEstado.esperaTotalSeg);
        rrEstado = rrAvanzarSiTerminoEspera(rrEstado);
        rrRender();

        const titulo = document.getElementById('rr_pasoTitulo').textContent.toLowerCase();
        const texto = document.getElementById('rr_pasoTexto').textContent.toLowerCase();
        if (titulo.includes('rotura')) return { ok: false, msg: `con vida infinita NO debería decir "rotura": "${titulo}"` };
        if (!titulo.includes('run-out') && !texto.includes('run-out')) return { ok: false, msg: 'debería identificarse como run-out en algún lado' };
        const soloDigitos = texto.replace(/[^\d]/g, '');
        if (!soloDigitos.includes(String(RR_CICLOS_RUNOUT))) return { ok: false, msg: `debería mencionar el umbral de ${RR_CICLOS_RUNOUT} ciclos` };

        const btn = document.getElementById('rr_btnSiguiente');
        if (!btn.textContent.toLowerCase().includes('run-out')) return { ok: false, msg: `el botón debería aclarar que fue run-out, no rotura: "${btn.textContent}"` };

        const escena = document.getElementById('rr_escena').innerHTML;
        if (escena.includes('var(--frac)')) return { ok: false, msg: 'sin rotura, la escena NO debería mostrar marca de fractura' };
        return { ok: true, msg: 'resultado de run-out correcto: sin rotura, sin marca de fractura, botón aclara run-out ✓' };
      } finally {
        sel.value = matOriginal; rrReiniciar();
      }
    }
  },
  {
    id: 'rr_solo_probeta_se_anima', group: 'R.R. Moore',
    name: 'rrSvgEscena — solo la probeta lleva animación; motor/apoyo (fijos de verdad) y gancho/plaquetas (función de σ_a) quedan igual al girar o al romperse',
    run: () => {
      rrPlatos = [2, 1]; rrDistanciaM = 0.12; // estado arbitrario fijo para la comparación
      const quieta = rrSvgEscena(true, false, false, false);
      const girando = rrSvgEscena(true, true, false, false);
      const rota = rrSvgEscena(false, false, true, false);
      if (!girando.includes('animateTransform')) return { ok: false, msg: 'con girando=true debería aparecer una animación real (animateTransform)' };
      if (quieta.includes('animateTransform')) return { ok: false, msg: 'con girando=false no debería haber ninguna animación' };
      if (!rota.includes('var(--frac)')) return { ok: false, msg: 'con rota=true debería aparecer la marca de fractura' };
      // Partes ESTRUCTURALES (motor/apoyo) -- coordenadas absolutas fijas,
      // no dependen de nada (esto no cambió respecto a v6.1-v6.3).
      for (const fragmento of ['x="15" y="90" width="42" height="46"', 'x="160" y="98" width="8" height="30"']) {
        for (const [nombre, svg] of [['quieta', quieta], ['girando', girando], ['rota', rota]]) {
          if (!svg.includes(fragmento)) return { ok: false, msg: `coordenada de motor/apoyo no coincide en "${nombre}": "${fragmento}"` };
        }
      }
      // Gancho/plaquetas -- v6.4: ya NO son una coordenada fija, son función
      // de rrDistanciaM/rrPlatos. Lo que hay que verificar es que, para el
      // MISMO estado de contrapeso, la posición es IDÉNTICA sin importar si
      // la probeta gira o está rota -- el contrapeso no se entera de nada
      // de eso.
      const hookXEsperado = (RR_PIVOTE_PX + rrDistanciaM * RR_PX_POR_M).toFixed(1);
      for (const [nombre, svg] of [['quieta', quieta], ['girando', girando], ['rota', rota]]) {
        if (!svg.includes(`cx="${hookXEsperado}"`)) return { ok: false, msg: `posición del gancho no coincide en "${nombre}" (esperado cx="${hookXEsperado}")` };
      }
      rrReiniciar();
      return { ok: true, msg: 'motor/apoyo fijos siempre; gancho fijo para un mismo contrapeso sin importar el estado de la probeta ✓' };
    }
  },
  {
    id: 'rr_sigma_calculada_de_la_fisica', group: 'R.R. Moore',
    name: 'rrSigmaA — sale de M·c/I con d=7.62mm citado (no de un input directo); 0 kg => 0 MPa',
    run: () => {
      rrPlatos = []; rrDistanciaM = 0.2;
      if (rrSigmaA() !== 0) return { ok: false, msg: 'sin plaquetas, σ_a debería ser 0 (no hay momento sin peso)' };

      rrPlatos = [1]; rrDistanciaM = 0.1; // M = 1*9.81*0.1 = 0.981 N·m
      const M = 1 * RR_G * 0.1;
      const sigmaEsperadaMPa = (M * RR_C_M / RR_I_M4) / 1e6;
      const diff = Math.abs(rrSigmaA() - sigmaEsperadaMPa);
      if (diff > 0.01) return { ok: false, msg: `rrSigmaA()=${rrSigmaA()}, esperado ≈${sigmaEsperadaMPa} (M·c/I con d=7.62mm)` };
      rrReiniciar();
      return { ok: true, msg: `σ_a sale de M·c/I correctamente (≈${sigmaEsperadaMPa.toFixed(1)} MPa para 1kg a 10cm) ✓` };
    }
  },
  {
    id: 'rr_platos_agregar_quitar', group: 'R.R. Moore',
    name: 'rrAgregarPlato/rrQuitarUltimoPlato/rrQuitarPlato — apilan, respetan RR_MAX_PLATOS, y solo funcionan en el paso "contrapeso"',
    run: () => {
      rrReiniciar();
      rrSiguiente(); // montaje -> contrapeso (recién ahí es editable)
      rrAgregarPlato(0.5); rrAgregarPlato(2); rrAgregarPlato(1);
      if (rrPesoTotalKg() !== 3.5) return { ok: false, msg: `peso total=${rrPesoTotalKg()}, esperado 3.5 (0.5+2+1)` };
      rrQuitarPlato(1); // saca el "2" (índice 1) específicamente, no el último
      if (rrPesoTotalKg() !== 1.5) return { ok: false, msg: `tras sacar el índice 1, peso total=${rrPesoTotalKg()}, esperado 1.5 (0.5+1)` };
      rrQuitarUltimoPlato();
      if (rrPesoTotalKg() !== 0.5) return { ok: false, msg: `tras quitar la última, peso total=${rrPesoTotalKg()}, esperado 0.5` };

      for (let i = 0; i < RR_MAX_PLATOS + 3; i++) rrAgregarPlato(1);
      if (rrPlatos.length > RR_MAX_PLATOS) return { ok: false, msg: `${rrPlatos.length} plaquetas, no debería superar RR_MAX_PLATOS=${RR_MAX_PLATOS}` };

      // Fuera del paso "contrapeso" no debería poder agregar/quitar nada.
      rrSiguiente(); // contrapeso -> arranque
      const pesoAntes = rrPesoTotalKg();
      rrAgregarPlato(5);
      rrQuitarUltimoPlato();
      if (rrPesoTotalKg() !== pesoAntes) return { ok: false, msg: 'agregar/quitar plaquetas fuera de "contrapeso" no debería tener efecto' };
      rrReiniciar();
      return { ok: true, msg: 'apilan correctamente, respetan el tope, y quedan bloqueadas fuera de "contrapeso" ✓' };
    }
  },
  {
    id: 'rr_editar_sigma_recalcula_distancia', group: 'R.R. Moore',
    name: 'rrEditarSigmaA — escribir σ_a despeja la DISTANCIA para el peso ya puesto (no inventa plaquetas), y clampea a [0, RR_BRAZO_M]',
    run: () => {
      rrReiniciar();
      rrSiguiente(); // montaje -> contrapeso
      // Sin plaquetas, no debería hacer nada (no hay peso del que despejar).
      document.getElementById('rr_sigmaAInput').value = '300';
      rrEditarSigmaA();
      if (rrDistanciaM !== 0) return { ok: false, msg: 'sin plaquetas, rrEditarSigmaA no debería mover la distancia' };

      rrAgregarPlato(2);
      document.getElementById('rr_sigmaAInput').value = '80'; // alcanzable con 2kg dentro de RR_BRAZO_M (máximo ≈113 MPa)
      rrEditarSigmaA();
      const sigmaObtenida = rrSigmaA();
      if (Math.abs(sigmaObtenida - 80) > 1) return { ok: false, msg: `pedí σ_a=80, resultó en ${sigmaObtenida.toFixed(1)} MPa` };
      if (rrPesoTotalKg() !== 2) return { ok: false, msg: 'rrEditarSigmaA no debería agregar ni sacar plaquetas, solo mover la distancia' };

      // Pedido irreal (necesitaría una distancia > RR_BRAZO_M) -- debe
      // clampear, no desbordar el brazo dibujado.
      document.getElementById('rr_sigmaAInput').value = '99999';
      rrEditarSigmaA();
      if (rrDistanciaM > RR_BRAZO_M) return { ok: false, msg: `distancia=${rrDistanciaM}, no debería superar RR_BRAZO_M=${RR_BRAZO_M}` };
      rrReiniciar();
      return { ok: true, msg: 'despeja la distancia para el peso puesto, sin inventar plaquetas, clampeado al brazo ✓' };
    }
  },
  {
    id: 'rr_material_reusa_ft_sn_presets', group: 'R.R. Moore',
    name: 'rrRender — el desplegable de material usa las mismas claves que FT_SN_PRESETS (ninguna tabla nueva)',
    run: () => {
      const sel = document.getElementById('rr_mat');
      const opciones = Array.from(sel.options).map(o => o.value);
      for (const key of opciones) {
        if (!FT_SN_PRESETS[key]) return { ok: false, msg: `la opción "${key}" del selector no existe en FT_SN_PRESETS` };
      }
      return { ok: true, msg: 'las 3 opciones del selector son claves reales de FT_SN_PRESETS ✓' };
    }
  },
  {
    id: 'rr_warn_sigma_fuera_de_rango', group: 'R.R. Moore',
    name: 'rrRender — avisa (sin bloquear) si σ_a > σ_fp del material, mismo criterio que e_warnSyTs (FIX #10)',
    run: () => {
      const sel = document.getElementById('rr_mat');
      const matOriginal = sel.value;
      try {
        sel.value = 'al2014'; // sfp=440 (FT_SN_PRESETS)
        rrReiniciar();
        rrTestFijarSigmaA(500);
        rrRender();
        const warn = document.getElementById('rr_warnSigma');
        if (warn.style.display !== 'block') return { ok: false, msg: 'σ_a=500 > σ_fp=440 del aluminio 2014-T6 debería mostrar el aviso' };
        rrTestFijarSigmaA(200);
        rrRender();
        if (warn.style.display === 'block') return { ok: false, msg: 'σ_a=200 < σ_fp=440 no debería mostrar el aviso' };
        return { ok: true, msg: 'aviso aparece solo cuando σ_a supera σ_fp del material elegido ✓' };
      } finally {
        sel.value = matOriginal; rrReiniciar();
      }
    }
  },
  {
    id: 'rr_compartir_captura_y_restaura', group: 'R.R. Moore',
    name: 'csCapturarEstado/rrAplicarEstadoCompartido — el contrapeso viaja completo en "Compartir enlace" (plaquetas + distancia + σ_a exacto)',
    run: () => {
      rrReiniciar();
      rrSiguiente(); // -> contrapeso
      rrAgregarPlato(5); rrAgregarPlato(1);
      document.getElementById('rr_sigmaAInput').value = '250';
      rrEditarSigmaA();
      const sigmaOriginal = rrSigmaA();
      const platosOriginal = rrPesoTotalKg();
      const distOriginal = rrDistanciaM;

      // Espejado en los campos ocultos (lo que csCapturarEstado va a leer)
      if (document.getElementById('rr_platosState').value !== JSON.stringify(rrPlatos)) {
        return { ok: false, msg: 'rr_platosState no está espejando rrPlatos en cada render' };
      }

      // Simula "volver a cargar la página en otra sesión" -- reinicia y
      // aplica los valores como si vinieran de una URL compartida.
      const platosGuardados = document.getElementById('rr_platosState').value;
      const distGuardada = document.getElementById('rr_distanciaState').value;
      rrReiniciar();
      if (rrPesoTotalKg() !== 0) return { ok: false, msg: 'rrReiniciar debería vaciar el contrapeso antes de simular la restauración' };

      document.getElementById('rr_platosState').value = platosGuardados;
      document.getElementById('rr_distanciaState').value = distGuardada;
      rrAplicarEstadoCompartido();

      if (rrPesoTotalKg() !== platosOriginal) return { ok: false, msg: `peso restaurado=${rrPesoTotalKg()}, esperado ${platosOriginal}` };
      if (Math.abs(rrDistanciaM - distOriginal) > 1e-9) return { ok: false, msg: `distancia restaurada=${rrDistanciaM}, esperado ${distOriginal}` };
      if (Math.abs(rrSigmaA() - sigmaOriginal) > 0.01) return { ok: false, msg: `σ_a restaurada=${rrSigmaA()}, esperado ${sigmaOriginal}` };

      // JSON corrupto (link armado a mano, versión vieja) no debería romper la carga.
      document.getElementById('rr_platosState').value = 'esto no es json';
      document.getElementById('rr_distanciaState').value = 'tampoco esto';
      let crashed = false;
      try { rrAplicarEstadoCompartido(); } catch (e) { crashed = true; }
      if (crashed) return { ok: false, msg: 'un valor corrupto en los campos ocultos no debería tirar una excepción' };

      rrReiniciar();
      return { ok: true, msg: 'plaquetas + distancia + σ_a viajan exactos por el link; JSON corrupto no rompe nada ✓' };
    }
  },
  {
    id: 'rr_ficha_tecnica', group: 'R.R. Moore',
    name: 'showFichaRR — badge "ENSAYO COMPLETO" solo al llegar a "resultado"; incluye contrapeso, material y resultado real',
    run: () => {
      const sel = document.getElementById('rr_mat');
      const matOriginal = sel.value;
      try {
        sel.value = 'acero1045';
        rrReiniciar();
        rrSiguiente(); // -> contrapeso
        rrAgregarPlato(5); rrAgregarPlato(2); // hace falta bastante peso para llegar a 350 MPa dentro del brazo de 25cm
        document.getElementById('rr_sigmaAInput').value = '350'; // > Se=310 -> vida finita
        rrEditarSigmaA();

        showFichaRR();
        const htmlInicio = document.getElementById('fichaBody').innerHTML;
        if (htmlInicio.includes('ENSAYO COMPLETO')) return { ok: false, msg: 'no debería decir "ENSAYO COMPLETO" antes de llegar a "resultado"' };
        if (!htmlInicio.includes('aún no terminado')) return { ok: false, msg: 'falta la nota de "aún no terminado" mientras el ensayo está en curso' };
        if (!htmlInicio.includes('Acero 1045')) return { ok: false, msg: 'la ficha debería mostrar el material elegido' };
        if (!htmlInicio.includes('5 kg')) return { ok: false, msg: 'la ficha debería mostrar las plaquetas puestas' };

        rrSiguiente(); rrSiguiente(); // -> arranque -> en_marcha
        rrEstado = fsmTick(rrEstado, rrEstado.esperaTotalSeg);
        rrEstado = rrAvanzarSiTerminoEspera(rrEstado);
        rrRender();
        showFichaRR();
        const htmlFin = document.getElementById('fichaBody').innerHTML;
        if (!htmlFin.includes('ENSAYO COMPLETO')) return { ok: false, msg: 'debería decir "ENSAYO COMPLETO" en "resultado"' };
        if (!htmlFin.includes('Rotura por fatiga')) return { ok: false, msg: 'con vida finita, la ficha debería decir "Rotura por fatiga"' };
        if (!htmlFin.includes('<svg')) return { ok: false, msg: 'la ficha debería incluir la imagen de la escena (fichaImgDesdeSvg)' };
        if (!new RegExp('Simulador de Ensayos Mecánicos v' + SIM_VERSION.replace('.', '\\.')).test(htmlFin)) {
          return { ok: false, msg: 'el pie de la ficha debería usar SIM_VERSION, no un número hardcodeado aparte' };
        }

        closeFicha();
        return { ok: true, msg: 'ficha honesta según el paso alcanzado, con contrapeso/material/resultado reales y versión centralizada ✓' };
      } finally {
        sel.value = matOriginal; rrReiniciar();
      }
    }
  },
  {
    id: 'pn_forma_table_asme', group: 'Máquina de estados (PT/MT)',
    name: 'PN_FORMA_TABLE — coladas/soldaduras 5min, forjado/laminado 10min (Tabla T-672, ASME Sección V Art. 6)',
    run: () => {
      if (PN_FORMA_TABLE.colada_soldadura.esperaPenetranteMin !== 5) return { ok: false, msg: `colada_soldadura=${PN_FORMA_TABLE.colada_soldadura.esperaPenetranteMin}min, esperado 5` };
      if (PN_FORMA_TABLE.forjado_laminado.esperaPenetranteMin !== 10) return { ok: false, msg: `forjado_laminado=${PN_FORMA_TABLE.forjado_laminado.esperaPenetranteMin}min, esperado 10` };
      if (PN_ESPERA_REVELADOR_MIN !== 10) return { ok: false, msg: `PN_ESPERA_REVELADOR_MIN=${PN_ESPERA_REVELADOR_MIN}, esperado 10` };
      return { ok: true, msg: '5min coladas/soldaduras, 10min forjado/laminado, 10min revelador ✓' };
    }
  },
  {
    id: 'pn_pasos_5_mt_pasos_5', group: 'Máquina de estados (PT/MT)',
    name: 'pnPasos/mtPasos — 5 pasos cada uno, con id único y sin espera negativa',
    run: () => {
      const pn = pnPasos(10), mt = mtPasos();
      if (pn.length !== 5) return { ok: false, msg: `pnPasos: ${pn.length} pasos (esperados 5)` };
      if (mt.length !== 5) return { ok: false, msg: `mtPasos: ${mt.length} pasos (esperados 5)` };
      const idsUnicosPn = new Set(pn.map(p => p.id)).size === pn.length;
      const idsUnicosMt = new Set(mt.map(p => p.id)).size === mt.length;
      if (!idsUnicosPn) return { ok: false, msg: 'pnPasos tiene ids repetidos' };
      if (!idsUnicosMt) return { ok: false, msg: 'mtPasos tiene ids repetidos' };
      const malos = [...pn, ...mt].filter(p => (p.esperaMin || 0) < 0);
      if (malos.length) return { ok: false, msg: 'hay pasos con esperaMin negativo' };
      return { ok: true, msg: '5+5 pasos, ids únicos, sin esperas negativas ✓' };
    }
  },
  // FIX (v4.7 — botones de ayuda + minitexto de fórmula en el Grupo A): los 4
  // módulos (Desgaste, Tensiones residuales, Corrosión, Polímeros) se armaron
  // en v4.1-v4.4 sin botón de ayuda en sus inputs -- quedó pendiente hasta
  // ahora. El primer test es una comprobación GENERAL (no específica del
  // Grupo A): cualquier botón .help-btn en el DOM, sea de la fase que sea,
  // tiene que apuntar a una clave real de HELP_DATA -- barata de mantener y
  // atrapa errores de tipeo en cualquier módulo futuro, no solo este.
  {
    id: 'help_data_cobertura', group: 'Ayuda contextual (v4.7)',
    name: 'Todo botón de ayuda (?) del DOM tiene su entrada correspondiente en HELP_DATA',
    run: () => {
      const botones = document.querySelectorAll('.help-btn');
      if (!botones.length) return { warn: true, msg: 'No se encontraron botones .help-btn en el DOM' };
      const faltantes = new Set();
      botones.forEach(b => {
        const m = (b.getAttribute('onclick') || '').match(/showHelp\('([^']+)'/);
        if (m && !HELP_DATA[m[1]]) faltantes.add(m[1]);
      });
      if (faltantes.size) return { ok: false, msg: `Faltan en HELP_DATA: ${Array.from(faltantes).join(', ')}` };
      return { ok: true, msg: `${botones.length} botones de ayuda, todos con entrada en HELP_DATA ✓` };
    }
  },
  {
    id: 'help_grupoa_presente', group: 'Ayuda contextual (v4.7)',
    name: 'Los 14 inputs del sidebar del Grupo A tienen botón de ayuda',
    run: () => {
      const ids = ['ds_par','ds_fuerza','ds_distancia','ds_dureza','tr_cal','tr_e1','tr_e2','tr_e3','cr_metal','cr_icorr','cr_tiempo','po_polimero','po_temp','po_ancho'];
      const faltantes = ids.filter(id => {
        const el = document.getElementById(id);
        if (!el) return true; // sin selector en el DOM = falla igual
        const label = el.closest('.field')?.querySelector('label');
        return !label || !label.querySelector('.help-btn');
      });
      if (faltantes.length) return { ok: false, msg: `Sin botón de ayuda: ${faltantes.join(', ')}` };
      return { ok: true, msg: '14/14 inputs del Grupo A tienen botón de ayuda ✓' };
    }
  },
  {
    id: 'formula_mini_grupoa', group: 'Ayuda contextual (v4.7)',
    name: 'Los 4 paneles del Grupo A muestran el minitexto de fórmula (.formula-mini)',
    run: () => {
      const panelesEsperados = {
        cm_panel_desgaste: 'V = k',
        cm_panel_tensiones: 'σ_max,min',
        cm_panel_corrosion: 'CR = K₁',
        cm_panel_polimeros: "E'(T)",
      };
      const faltantes = [];
      Object.entries(panelesEsperados).forEach(([panelId, esperado]) => {
        const panel = document.getElementById(panelId);
        const f = panel && panel.querySelector('.formula-mini');
        if (!f || !f.textContent.includes(esperado)) faltantes.push(panelId);
      });
      if (faltantes.length) return { ok: false, msg: `Sin minitexto de fórmula esperado en: ${faltantes.join(', ')}` };
      return { ok: true, msg: 'Minitexto de fórmula presente en los 4 paneles del Grupo A ✓' };
    }
  },
  {
    // FIX (QA v5.12, hallazgo #1): antes buildCurve() mostraba el valor crudo
    // de e_E en la tarjeta "E (GPa)" incluso si era 0/negativo/inválido,
    // mientras que genCurve() ya aplicaba internamente un piso de 1 GPa para
    // no romper la curva -- el número en pantalla no coincidía con el que
    // realmente generó la curva dibujada. Corregido para que buildCurve()
    // aplique el mismo piso antes de mostrar/usar E.
    id: 'traccion_E_cero_muestra_piso', group: 'Correcciones QA v5.12',
    name: 'Tracción — E=0 en el input muestra el piso de seguridad (1 GPa), no el crudo',
    run: () => {
      try {
        switchTab('mecanicos'); mecSwitchGroup('estatica'); edSwitch('traccion');
        const prevE = document.getElementById('e_E').value;
        document.getElementById('e_E').value = '0';
        buildCurve();
        const rE = document.getElementById('rE').textContent;
        document.getElementById('e_E').value = prevE;
        buildCurve();
        if (rE !== '1 GPa') return { ok: false, msg: `Con e_E=0, rE mostró "${rE}" (esperado "1 GPa")` };
        return { ok: true, msg: 'E=0 → tarjeta muestra el piso real (1 GPa) ✓' };
      } catch (e) { return { ok: false, msg: String(e) }; }
    }
  },
  {
    // FIX (QA v5.12, hallazgo #2): los presets HDPE y PP cargan %EL=200 en
    // un input con max="100" -- sin impacto visual (no hay CSS :invalid ni
    // validación de formulario que bloquee nada), pero era un dato
    // inconsistente entre el preset y el límite declarado del campo.
    // Corregido subiendo max a 200 (el mayor %EL real entre los presets).
    id: 'traccion_el_max_cubre_presets', group: 'Correcciones QA v5.12',
    name: 'Tracción — el max del input %EL cubre el %EL más alto entre los presets (HDPE/PP=200)',
    run: () => {
      const maxAttr = Number(document.getElementById('e_el').max);
      const maxPreset = Math.max(...Object.values(PRESETS).map(p => p.el || 0));
      if (maxAttr < maxPreset) return { ok: false, msg: `e_el.max=${maxAttr} pero el preset más alto tiene %EL=${maxPreset}` };
      return { ok: true, msg: `e_el.max=${maxAttr} cubre el %EL más alto (${maxPreset}) ✓` };
    }
  },
  {
    // FIX (QA v5.12, hallazgo #3): la tarjeta "σ_yc" en Compresión mostraba
    // un número incluso para materiales frag='si' (sin yield real, y cuyo
    // syc ni siquiera se usa dentro de genCompCurve para esos casos).
    // Corregido para que replique el mismo criterio que ya usa Tracción
    // (rSy) con sy<=0: mostrar "— frágil" en vez de un valor que no
    // corresponde.
    id: 'compresion_syc_fragil_oculto', group: 'Correcciones QA v5.12',
    name: 'Compresión — σ_yc muestra "— frágil" para materiales frag=\'si\' (no un número inventado)',
    run: () => {
      try {
        switchTab('mecanicos'); mecSwitchGroup('estatica'); edSwitch('compresion');
        const prevPreset = document.getElementById('co_preset').value;

        document.getElementById('co_preset').value = 'ceramica';
        applyPresetComp0();
        buildCompCurve();
        const rSyFragil = document.getElementById('co_rSy').textContent;

        document.getElementById('co_preset').value = 'acero';
        applyPresetComp0();
        buildCompCurve();
        const rSyDuctil = document.getElementById('co_rSy').textContent;

        document.getElementById('co_preset').value = prevPreset;
        applyPresetComp0();
        buildCompCurve();

        if (rSyFragil !== '— frágil') return { ok: false, msg: `Cerámica (frag) mostró "${rSyFragil}" (esperado "— frágil")` };
        if (!/^\d/.test(rSyDuctil)) return { ok: false, msg: `Acero (dúctil) mostró "${rSyDuctil}" (esperado un número en MPa)` };
        return { ok: true, msg: `Frágil="${rSyFragil}", dúctil="${rSyDuctil}" ✓` };
      } catch (e) { return { ok: false, msg: String(e) }; }
    }
  },
  {
    // FIX (QA v5.12, hallazgo #4): Cerámica, SiC, Si3N4, ZrO2, fibra de
    // carbono, GFRP y Kevlar/epoxi no tenían tsc propio y usaban su TS de
    // tracción como resistencia a compresión -- subestimaba mucho la
    // compresión real de los cerámicos (varias veces más resistentes en
    // compresión que en tracción) y sobreestimaba la de los compuestos
    // unidireccionales (más débiles en compresión por pandeo de fibra).
    // Corregido agregando tsc con valores de bibliografía citados en los
    // comentarios de data-presets.js.
    // FIX #58 (QA exhaustivo v6.13, etapa 2): 'fragil' (Hierro fundido
    // gris) tenía el mismo problema y quedó afuera de este test en su
    // momento -- se suma acá a la lista de "requeridos" y al bucket de
    // materiales tipo cerámico (tsc>ts), que es su comportamiento real.
    id: 'compresion_tsc_materiales_fragiles', group: 'Correcciones QA v5.12',
    name: 'Compresión — los 8 materiales frágiles/compuestos tienen un tsc propio (no caen a TS de tracción)',
    run: () => {
      const requeridos = ['ceramica','sic','si3n4','zirconia','gfrp','kevlarepoxi','carbono','fragil'];
      const faltantes = requeridos.filter(k => !PRESETS[k] || !PRESETS[k].tsc);
      if (faltantes.length) return { ok: false, msg: `Sin tsc propio: ${faltantes.join(', ')}` };
      // Sentido físico mínimo: cerámicos (y la fundición gris, que se
      // comporta igual en este aspecto) deben tener tsc > ts (más
      // resistentes en compresión); compuestos unidireccionales deben
      // tener tsc < ts (más débiles en compresión por pandeo de fibra).
      const ceramicos = ['ceramica','sic','si3n4','zirconia','fragil'];
      const compuestos = ['gfrp','kevlarepoxi','carbono'];
      const malCeramico = ceramicos.filter(k => PRESETS[k].tsc <= PRESETS[k].ts);
      const malCompuesto = compuestos.filter(k => PRESETS[k].tsc >= PRESETS[k].ts);
      if (malCeramico.length) return { ok: false, msg: `Cerámicos con tsc<=ts (no debería): ${malCeramico.join(', ')}` };
      if (malCompuesto.length) return { ok: false, msg: `Compuestos con tsc>=ts (no debería): ${malCompuesto.join(', ')}` };
      return { ok: true, msg: `${requeridos.length} materiales con tsc propio y coherente ✓` };
    }
  },
  {
    // FIX (v5.13 — integración Ficha ↔ Grupo B, pendiente desde v5.7): la
    // Ficha Técnica no tenía sección para ninguno de los 5 ensayos del
    // Grupo B ni para Metalografía. Se cerró para los 3 ensayos que tienen
    // tabla de datos real keyed por material (ECT/UT/RX, vía los KEY_MAP
    // de material-sync.js); PT/MT y Metalografía quedan fuera a propósito
    // (no dependen del material -- ver el comentario extenso junto a
    // grupoBSeccion en ficha.js). Este test verifica: (a) un material con
    // los 3 keyMaps (aluminio) muestra las 3 filas de datos reales; (b) un
    // material sin ninguno (oro) muestra el aviso de "sin equivalente" en
    // vez de una sección vacía o rota.
    id: 'ficha_grupob_integrada', group: 'Correcciones QA v5.13',
    name: 'Ficha Técnica — sección Ensayo no destructivo (Grupo B) con datos reales de ECT/UT/RX',
    run: () => {
      try {
        openFichaPicker();
        document.getElementById('fichaMatSelect').value = 'aluminio';
        renderFichaMaterial();
        const htmlAluminio = document.getElementById('fichaBody').innerHTML;
        const idxAl = htmlAluminio.indexOf('Ensayo no destructivo (Grupo B)');
        if (idxAl === -1) return { ok: false, msg: 'Sección Grupo B no encontrada para aluminio' };
        const bloqueAl = htmlAluminio.slice(idxAl, idxAl + 1500);
        const faltanAluminio = ['Corrientes inducidas — conductividad','Ultrasonido — velocidad','Radiografía — capa']
          .filter(txt => !bloqueAl.includes(txt));
        if (faltanAluminio.length) return { ok: false, msg: `Aluminio (tiene los 3 keyMaps) sin fila de: ${faltanAluminio.join(', ')}` };

        openFichaPicker();
        document.getElementById('fichaMatSelect').value = 'oro';
        renderFichaMaterial();
        const htmlOro = document.getElementById('fichaBody').innerHTML;
        const idxOro = htmlOro.indexOf('Ensayo no destructivo (Grupo B)');
        if (idxOro === -1) return { ok: false, msg: 'Sección Grupo B no encontrada para oro' };
        const bloqueOro = htmlOro.slice(idxOro, idxOro + 400);
        if (!bloqueOro.includes('no tiene un equivalente real')) return { ok: false, msg: 'Oro (sin ningún keyMap) no mostró el aviso de "sin equivalente"' };

        closeFicha();
        return { ok: true, msg: 'Aluminio muestra ECT/UT/RX reales; oro muestra el aviso correcto ✓' };
      } catch (e) { return { ok: false, msg: String(e) }; }
    }
  },

  // ---- CORRECCIONES QA v5.14 ----
  {
    // FIX #38 (hallazgo Etapa 2): dz/ed/cm se comparten ahora entre 2
    // ubicaciones cada uno (ver dzScopeRoot/edScopeRoot en dureza-shared.js,
    // cmScopeRoot en desgaste.js) -- interactuar en una NO debe apagar el
    // sub-panel activo por defecto de la otra. Se prueba el caso dz
    // (Dureza dentro de Ensayos mecánicos vs. Ensayo no destructivo), que
    // es el más representativo porque además tenía el id histórico
    // "tab-dureza" (no coincidía con la etiqueta visible de la pestaña --
    // renombrado a "tab-end" en FIX #62, ver dureza-shared.js).
    id: 'scope_dz_no_colisiona', group: 'Correcciones QA v5.14',
    name: 'dzSwitch no apaga el sub-panel activo de la otra ubicación que comparte el prefijo dz',
    run: () => {
      try {
        switchTab('mecanicos', document.querySelector('.tab[onclick*="switchTab(\'mecanicos\'"]'));
        mecSwitchGroup('dureza');
        dzSwitch('brinell');
        switchTab('end', document.querySelector('.tab[onclick*="switchTab(\'end\'"]'));
        const activo = document.querySelector('#tab-end .dz-sub-panel.active');
        if (!activo) return { ok: false, msg: 'Ensayo no destructivo quedó sin ningún sub-panel activo tras interactuar con Dureza' };
        switchTab('mecanicos', document.querySelector('.tab[onclick*="switchTab(\'mecanicos\'"]'));
        mecSwitchGroup('dureza');
        const activo2 = document.querySelector('.mec-group-main[data-mecgroup="dureza"] .dz-sub-panel.active');
        if (!activo2 || activo2.id !== 'dz_panel_brinell') return { ok: false, msg: `Dureza (grupo) no conservó su propio estado tras ir y volver de Ensayo no destructivo (activo=${activo2 ? activo2.id : 'ninguno'})` };
        return { ok: true, msg: 'Ambas ubicaciones conservan su propio sub-panel activo, independiente una de la otra ✓' };
      } catch (e) { return { ok: false, msg: String(e) }; }
    }
  },
  {
    // FIX #38: csSubActiva() (progreso.js, usada por "Compartir enlace")
    // también necesitaba acotarse a la pestaña visible -- antes de este fix
    // devolvía el primer .dz-sub-panel.active en orden de documento, que no
    // necesariamente era el de la pestaña que el alumno tenía abierta.
    id: 'scope_cs_sub_activa', group: 'Correcciones QA v5.14',
    name: 'csSubActiva() identifica el sub-panel de la pestaña realmente visible, no el primero en orden de documento',
    run: () => {
      try {
        switchTab('mecanicos', document.querySelector('.tab[onclick*="switchTab(\'mecanicos\'"]'));
        mecSwitchGroup('dureza');
        dzSwitch('mohs');
        switchTab('end'); dzSwitch('ultrasonido');
        const sub = csSubActiva('dz');
        if (sub !== 'ultrasonido') return { ok: false, msg: `csSubActiva('dz') devolvió "${sub}", esperado "ultrasonido"` };
        return { ok: true, msg: 'csSubActiva() acotada correctamente a la pestaña visible ✓' };
      } catch (e) { return { ok: false, msg: String(e) }; }
    }
  },
  {
    // FIX #39 (hallazgo Etapas 3/9): buildCompCurve()/renderCompare()/
    // renderTemp()/renderCompound() mostraban E/σ crudos aunque la curva ya
    // usara el piso interno de genCurve()/genCompCurve() -- ahora los 4
    // calculan el piso una sola vez y lo reusan tanto para mostrar como
    // para generar la curva (mismo criterio que Tracción, QA v5.12).
    id: 'display_piso_compresion', group: 'Correcciones QA v5.14',
    name: 'Compresión — tarjetas E/σ_c/F_máx reflejan el piso real usado por la curva, no el valor crudo tipeado',
    run: () => {
      try {
        switchTab('mecanicos', document.querySelector('.tab[onclick*="switchTab(\'mecanicos\'"]'));
        mecSwitchGroup('estatica');
        edSwitch('compresion');
        document.getElementById('co_E').value = '0';
        document.getElementById('co_syc').value = '250';
        document.getElementById('co_sc').value = '-350';
        document.getElementById('co_frag').value = 'no';
        buildCompCurve();
        const rE = document.getElementById('co_rE').textContent;
        const rSc = document.getElementById('co_rSc').textContent;
        const rFmax = parseFloat(document.getElementById('co_rFmax').textContent);
        if (rE !== '1 GPa') return { ok: false, msg: `co_rE="${rE}", esperado "1 GPa" (piso)` };
        if (rSc !== '1 MPa') return { ok: false, msg: `co_rSc="${rSc}", esperado "1 MPa" (piso)` };
        if (!(rFmax >= 0)) return { ok: false, msg: `co_rFmax=${rFmax}, esperado un valor no negativo (piso de σ_c aplicado)` };
        return { ok: true, msg: 'Tarjetas de Compresión ya coinciden con el piso real de la curva ✓' };
      } catch (e) { return { ok: false, msg: String(e) }; }
    }
  },
  {
    id: 'display_piso_herramientas', group: 'Correcciones QA v5.14',
    name: 'Comparar/Temperatura/Compuesto — E mostrado coincide con el piso real usado por la curva',
    run: () => {
      try {
        switchTab('herramientas', document.querySelector('.tab[onclick*="switchTab(\'herramientas\'"]'));
        edSwitch('comparar');
        document.getElementById('c1_E').value = '0';
        document.getElementById('c2_E').value = '69';
        renderCompare();
        const htmlComp = document.getElementById('compareResults').innerHTML;
        if (!/M1 . E[\s\S]{0,120}rv">1 GPa</.test(htmlComp)) return { ok: false, msg: 'Comparar: "M1 — E" no muestra "1 GPa" (piso) con E=0 tipeado' };

        edSwitch('temperatura');
        document.getElementById('t_E').value = '0';
        renderTemp();
        const tLeg1 = document.getElementById('tLeg1').textContent;
        if (!tLeg1.includes('E≈1 GPa')) return { ok: false, msg: `Temperatura: tLeg1="${tLeg1}", esperado que incluya "E≈1 GPa"` };

        edSwitch('compuesto');
        document.getElementById('k1_E').value = '0';
        document.getElementById('k2_E').value = '230';
        document.getElementById('k_f2').value = '0.3';
        renderCompound();
        const htmlComp2 = document.getElementById('compResult').innerHTML;
        if (!/E — paralelo \(GPa\) \*<\/td><td>1<\/td>/.test(htmlComp2)) return { ok: false, msg: 'Compuesto: fila "E — paralelo" no muestra "1" (piso) para Componente 1 con E=0' };

        return { ok: true, msg: 'Comparar, Temperatura y Compuesto ya coinciden con el piso real de la curva ✓' };
      } catch (e) { return { ok: false, msg: String(e) }; }
    }
  },

  // ---- CORRECCIONES QA v6.5 ----
  {
    // FIX #41 (hallazgo Etapa 3 QA v6.5): dzScopeRoot/edScopeRoot acotaban
    // dz-sub-ctrl/ed-sub-ctrl a .mec-group-main, pero esos controles viven en
    // .mec-group-aside (contenedor HERMANO, no descendiente) desde la
    // reorganización v5.14/v5.15 -- el querySelectorAll no encontraba nada
    // y el panel izquierdo quedaba pegado en el primero por defecto (Mohs /
    // Tracción) sin importar qué sub-sección se eligiera, aunque el panel
    // derecho sí cambiara bien. Se prueba con los 2 grupos afectados
    // (dureza y estatica); "rotura" no lo tenía (rtSwitch nunca acotó a una
    // raíz) así que no hace falta test de regresión ahí.
    id: 'scope_aside_dz_ed', group: 'Correcciones QA v6.5',
    name: 'dzSwitch/edSwitch activan el sub-ctrl (panel izquierdo) correcto, no solo el sub-panel derecho',
    run: () => {
      try {
        switchTab('mecanicos', document.querySelector('.tab[onclick*="switchTab(\'mecanicos\'"]'));
        mecSwitchGroup('dureza');
        dzSwitch('rockwell');
        const ctrlDz = document.getElementById('dz_ctrl_rockwell');
        const mohsDz = document.getElementById('dz_ctrl_mohs');
        if (!ctrlDz || !ctrlDz.classList.contains('active')) return { ok: false, msg: 'dz_ctrl_rockwell no quedó activo tras dzSwitch("rockwell")' };
        if (mohsDz && mohsDz.classList.contains('active')) return { ok: false, msg: 'dz_ctrl_mohs siguió activo tras cambiar a Rockwell' };

        mecSwitchGroup('estatica');
        edSwitch('compresion');
        const ctrlEd = document.getElementById('ed_ctrl_compresion');
        const tracEd = document.getElementById('ed_ctrl_traccion');
        if (!ctrlEd || !ctrlEd.classList.contains('active')) return { ok: false, msg: 'ed_ctrl_compresion no quedó activo tras edSwitch("compresion")' };
        if (tracEd && tracEd.classList.contains('active')) return { ok: false, msg: 'ed_ctrl_traccion siguió activo tras cambiar a Compresión' };

        // vuelta al estado por defecto para no interferir con otros tests
        dzSwitch('mohs'); edSwitch('traccion');
        return { ok: true, msg: 'Panel izquierdo (sub-ctrl) sincronizado con el sub-panel derecho en ambos grupos ✓' };
      } catch (e) { return { ok: false, msg: String(e) }; }
    }
  },
  {
    // FIX #46 (hallazgo Etapa 1 QA v6.5): rrPunteroADistancia/rrArrastrarInicio
    // (el arrastre del contrapeso, agregado en v6.4) nunca tuvieron cobertura
    // permanente en esta suite -- solo se habían validado con un arnés externo
    // ad-hoc en su momento, que no queda como protección de regresión. Este
    // test ejercita el camino completo: click inicial sobre el SVG (que ya
    // aplica sin necesidad de mover el mouse, ver comentario en
    // rrArrastrarInicio) hasta el extremo del brazo, y confirma que la
    // distancia y σ_a resultante son físicamente consistentes.
    id: 'rr_drag_contrapeso', group: 'Correcciones QA v6.5',
    name: 'rrArrastrarInicio calcula la distancia y σ_a correctos al arrastrar el contrapeso',
    run: () => {
      try {
        switchTab('mecanicos', document.querySelector('.tab[onclick*="switchTab(\'mecanicos\'"]'));
        mecSwitchGroup('rotura');
        rtSwitch('ft_rrmoore');
        rrReiniciar();
        rrSiguiente(); // -> paso "contrapeso"
        rrAgregarPlato(5); rrAgregarPlato(5); // 10 kg

        const svg = document.querySelector('#rr_escena svg');
        if (!svg) return { ok: false, msg: 'No se encontró el SVG de la máquina R.R. Moore' };
        const rect = svg.getBoundingClientRect();
        if (rect.width <= 0) return { ok: false, msg: 'El SVG no tiene ancho renderizado (¿pestaña oculta?) -- no se puede probar el drag' };

        // arrastrar hasta el extremo derecho del brazo (25 cm, RR_BRAZO_PX)
        rrArrastrarInicio({ preventDefault(){}, clientX: rect.left + rect.width });
        const distTxt = document.getElementById('rr_distanciaVal').textContent;
        if (!distTxt.includes('25 cm')) return { ok: false, msg: `Arrastrar al extremo debería dar 25 cm, dio: "${distTxt}"` };

        const sigmaTxt = document.getElementById('rr_sigmaAVal').textContent;
        const sigma = parseFloat(sigmaTxt);
        // 10kg a 0.25m sobre probeta de 7.62mm -> ~565 MPa (ver derivación en el hallazgo original)
        if (!(sigma > 550 && sigma < 580)) return { ok: false, msg: `σ_a con 10kg a 25cm debería ser ~565 MPa, dio: "${sigmaTxt}"` };

        // arrastrar de vuelta al pivote (0 cm) -> σ_a debe volver a 0
        rrArrastrarInicio({ preventDefault(){}, clientX: rect.left });
        const distTxt2 = document.getElementById('rr_distanciaVal').textContent;
        const sigma2 = parseFloat(document.getElementById('rr_sigmaAVal').textContent);
        if (!distTxt2.includes('0 cm')) return { ok: false, msg: `Arrastrar al pivote debería dar 0 cm, dio: "${distTxt2}"` };
        if (sigma2 !== 0) return { ok: false, msg: `σ_a en el pivote debería ser 0, dio: ${sigma2}` };

        rrReiniciar();
        return { ok: true, msg: 'Drag del contrapeso: distancia y σ_a consistentes en ambos extremos ✓' };
      } catch (e) { return { ok: false, msg: String(e) }; }
    }
  },
  {
    // FIX #43 (hallazgo Etapa 8 QA v6.5): la Regla 3 de plausibilidad del
    // compuesto (jerarquía de rigidez) comparaba PRESETS[k].E -- el E del
    // preset elegido -- en vez del E EN VIVO de los campos E1/E2, que es lo
    // que la curva y el resto de la app sí usan. Si el alumno elegía un
    // preset que disparaba el aviso y después corregía el E a mano para que
    // la combinación fuera válida, el aviso se quedaba pegado (falso
    // positivo) porque solo miraba el preset viejo. Este test reproduce
    // exactamente ese flujo (a diferencia de 'compound_plausibility', que
    // solo prueba combinaciones de presets puros).
    id: 'compound_plausibility_live_E', group: 'Correcciones QA v6.5',
    name: 'Regla 3 de plausibilidad del compuesto usa el E editado a mano, no el del preset viejo',
    run: () => {
      try {
        switchTab('herramientas', document.querySelector('.tab[onclick*="switchTab(\'herramientas\'"]'));
        // acero (matriz, E=207) + aluminio (refuerzo, E=69) -> con los
        // presets tal cual, el refuerzo es MENOS rígido: debería avisar
        applyPresetComp(1,'acero'); applyPresetComp(2,'aluminio');
        renderCompound();
        const avisoConPresets = document.getElementById('compWarnPlausible').style.display;
        if (avisoConPresets !== 'block') return { ok: false, msg: `acero(207)+aluminio(69) con presets debería avisar, dio display="${avisoConPresets}"` };

        // el alumno corrige a mano el E del refuerzo a 300 GPa (ahora SÍ es
        // más rígido que la matriz) -- el aviso debería desaparecer
        document.getElementById('k2_E').value = '300';
        renderCompound();
        const avisoTrasEditar = document.getElementById('compWarnPlausible').style.display;
        if (avisoTrasEditar !== 'none') return { ok: false, msg: `tras editar E2 a 300 (más rígido que la matriz) el aviso debería desaparecer, sigue en display="${avisoTrasEditar}"` };

        applyPresetComp(1,'acero'); applyPresetComp(2,'carbono'); renderCompound(); // vuelta al default
        return { ok: true, msg: 'Regla 3 responde al E editado a mano, no solo al del preset ✓' };
      } catch (e) { return { ok: false, msg: String(e) }; }
    }
  },
  {
    // FIX #45 (hallazgo Etapa 4 QA v6.5): R.R. Moore ya avisaba cuando
    // σ_a > σ'_f (los mismos datos de FT_SN_PRESETS), pero la Curva S-N
    // (el módulo del que R.R. Moore toma esos datos) no tenía el aviso
    // equivalente -- con σ_a fuera de rango, N daba menos de 1 ciclo sin
    // ninguna advertencia.
    id: 'sn_warn_sigma_fuera_de_rango', group: 'Correcciones QA v6.5',
    name: 'Curva S-N avisa cuando σ_a supera σ\'_f del material, igual que R.R. Moore',
    run: () => {
      try {
        switchTab('mecanicos', document.querySelector('.tab[onclick*="switchTab(\'mecanicos\'"]'));
        mecSwitchGroup('rotura'); rtSwitch('ft_sn');
        // OJO: ft_sa es un slider con max="500" -- asignar un valor mayor se
        // clampea solo, así que para superar σ'_f hace falta un material con
        // σ'_f por debajo de 500. acero1045/4340 tienen σ'_f=1000/1200
        // (inalcanzable desde el slider); al2014 tiene σ'_f=440, sí alcanzable.
        document.getElementById('ft_snMat').value = 'al2014';
        document.getElementById('ft_sa').value = '500'; // > sfp=440 de al2014
        ftUpdateSN();
        const warn = document.getElementById('ft_warnSigma');
        if (!warn || warn.style.display !== 'block') return { ok: false, msg: 'σ_a=500 > σ\'_f=440 (al2014) debería mostrar el aviso' };
        document.getElementById('ft_sa').value = '200';
        ftUpdateSN();
        if (warn.style.display !== 'none') return { ok: false, msg: 'σ_a=200 < σ\'_f=440 no debería mostrar el aviso' };
        document.getElementById('ft_snMat').value = 'acero1045'; ftUpdateSN(); // vuelta al default
        return { ok: true, msg: 'Aviso de rango en Curva S-N funciona igual que en R.R. Moore ✓' };
      } catch (e) { return { ok: false, msg: String(e) }; }
    }
  },
  {
    // FIX #47 (hallazgo Etapa 3 QA v6.5): se sacó el guard muerto "d>=D" de
    // Brinell (inalcanzable, dz_brD tiene max="6.5" < D=10 fijo). Este test
    // confirma que el cálculo normal sigue funcionando sin ese guard, en
    // todo el rango real del slider.
    id: 'brinell_sin_guard_muerto', group: 'Correcciones QA v6.5',
    name: 'Brinell calcula correctamente en todo el rango real del slider, sin el guard d>=D muerto',
    run: () => {
      try {
        switchTab('mecanicos', document.querySelector('.tab[onclick*="switchTab(\'mecanicos\'"]'));
        mecSwitchGroup('dureza'); dzSwitch('brinell');
        document.getElementById('dz_brP').value = '3000';
        document.getElementById('dz_brD').value = '6.5'; // máximo real del slider
        dzUpdateBrinell();
        const resultMax = document.getElementById('dz_brResult').textContent;
        if (!/^\d/.test(resultMax)) return { ok: false, msg: `d=6.5 (máximo del slider) debería dar un HB numérico, dio "${resultMax}"` };
        document.getElementById('dz_brD').value = '1.0'; // mínimo real del slider
        dzUpdateBrinell();
        const resultMin = document.getElementById('dz_brResult').textContent;
        if (!/^\d/.test(resultMin)) return { ok: false, msg: `d=1.0 (mínimo del slider) debería dar un HB numérico, dio "${resultMin}"` };
        return { ok: true, msg: 'Brinell funciona en todo el rango del slider sin el guard muerto ✓' };
      } catch (e) { return { ok: false, msg: String(e) }; }
    }
  },

  // ---- ESCENAS INTERACTIVAS v6.8/v6.9 (tests permanentes, QA v6.9 Etapa 7) ----
  // FIX #54: hasta acá las 4 escenas (Charpy, Brinell, Rockwell,
  // Vickers/Knoop) solo se habían probado con arneses Node+jsdom ad-hoc,
  // que no quedaban en el repo ni corrían en cada packaging. Estos tests
  // corren contra el código real (no reimplementan la fórmula), igual que
  // el resto de la suite.
  {
    id: 'br_profundidad_formula', group: 'Escenas interactivas v6.8/v6.9',
    name: 'Brinell — dzBrProfundidad(d) = (D-√(D²-d²))/2 en puntos conocidos',
    run: () => {
      const casos = [[1.0, 0.0251], [3.5, 0.3163], [6.5, 1.2003]];
      for (const [d, esperado] of casos) {
        const t = dzBrProfundidad(d);
        if (Math.abs(t - esperado) > 0.001) {
          return { ok: false, msg: `d=${d}: esperado t≈${esperado}, obtenido ${t.toFixed(4)}` };
        }
      }
      return { ok: true, msg: `${casos.length} puntos verificados ✓` };
    }
  },
  {
    id: 'br_escala_consistente', group: 'Escenas interactivas v6.8/v6.9',
    name: 'Brinell — rx del corte y r de la huella coinciden en todo punto de la animación, no solo al final (regresión del bug histórico)',
    run: () => {
      try {
        switchTab('mecanicos', document.querySelector('.tab[onclick*="switchTab(\'mecanicos\'"]'));
        mecSwitchGroup('dureza'); dzSwitch('brinell');
        const casos = [[1.0, 0.3], [6.5, 0.7], [3.5, 1.0], [4.0, 0.5]];
        for (const [d, frac] of casos) {
          const t = dzBrProfundidad(d);
          dzDrawBrinellEscena(frac, frac, d, t);
          const svg = document.getElementById('dz_brSvg').innerHTML;
          const mEllipse = svg.match(/ellipse[^>]*rx="([\d.]+)"/);
          const mCircle = [...svg.matchAll(/circle cx="[\d.]+" cy="[\d.]+" r="([\d.]+)" fill="var\(--accent\)"/g)];
          if (!mEllipse || !mCircle.length) return { ok: false, msg: `d=${d} frac=${frac}: no se pudo leer rx/r del SVG` };
          const rx = mEllipse[1], r = mCircle[0][1];
          if (rx !== r) return { ok: false, msg: `d=${d} frac=${frac}: rx=${rx} != r=${r}` };
        }
        return { ok: true, msg: `${casos.length} puntos, rx==r en todos ✓` };
      } catch (e) { return { ok: false, msg: String(e) }; }
    }
  },
  {
    id: 'rk_duro_menor_profundidad', group: 'Escenas interactivas v6.8/v6.9',
    name: 'Rockwell — a igual escala, material duro da menor profundidad simulada que uno blando',
    run: () => {
      dzRkSelected = { sym: 'C', pen: 'Cono diamante', cm: 150, cmen: 10 };
      const depthDuro = dzRkCalcDepthFrac(85);
      const depthBlando = dzRkCalcDepthFrac(16);
      if (!(depthDuro < depthBlando)) {
        return { ok: false, msg: `duro=${depthDuro}, blando=${depthBlando} -- se esperaba duro < blando` };
      }
      return { ok: true, msg: `duro=${depthDuro.toFixed(2)} < blando=${depthBlando.toFixed(2)} ✓` };
    }
  },
  {
    id: 'rk_reposo_coincide_con_final', group: 'Escenas interactivas v6.8/v6.9',
    name: 'Rockwell — dzUpdateRk() (exploración instantánea) dibuja el mismo estado que dzDrawRkEscena(0,1,...) llamada directamente, para el mismo slider (FIX #63, hallazgo D10-01)',
    run: () => {
      try {
        const prevSel = dzRkSelected;
        dzRkSelected = { sym: 'C', pen: 'Cono diamante', cm: 150, cmen: 10 };
        switchTab('mecanicos', document.querySelector('.tab[onclick*="switchTab(\'mecanicos\'"]'));
        mecSwitchGroup('dureza'); dzSwitch('rockwell');
        document.getElementById('dz_rkSlider').value = '50';
        dzUpdateRk();
        const svgReposo = document.getElementById('dz_rkDepthSvg').innerHTML;
        const frac = dzRkCalcDepthFrac(50);
        dzDrawRkEscena(0, 1, frac, 50);
        const svgDirecto = document.getElementById('dz_rkDepthSvg').innerHTML;
        dzRkSelected = prevSel;
        if (svgReposo !== svgDirecto) return { ok: false, msg: 'dzUpdateRk() no coincide con dzDrawRkEscena(0,1,frac,slider) llamada directa -- ver hallazgo D10-01' };
        return { ok: true, msg: 'exploración instantánea == estado de reposo de la escena (herramienta retirada, igual que Brinell) ✓' };
      } catch (e) { return { ok: false, msg: String(e) }; }
    }
  },
  {
    id: 'rk_sin_fila_no_rompe', group: 'Escenas interactivas v6.8/v6.9',
    name: 'Rockwell — sin ninguna fila de tabla elegida, dzRkCalcDepthFrac/dzDrawRkEscena no rompen',
    run: () => {
      try {
        const prevSel = dzRkSelected;
        dzRkSelected = null;
        const frac = dzRkCalcDepthFrac(50);
        if (!(frac >= 0 && frac <= 1)) return { ok: false, msg: `frac fuera de [0,1]: ${frac}` };
        switchTab('mecanicos', document.querySelector('.tab[onclick*="switchTab(\'mecanicos\'"]'));
        mecSwitchGroup('dureza'); dzSwitch('rockwell');
        dzDrawRkEscena(0.5, 0.5, frac, 50); // no debe tirar excepción
        const svg = document.getElementById('dz_rkDepthSvg').innerHTML;
        dzRkSelected = prevSel; // restaurar estado
        if (svg.includes('NaN')) return { ok: false, msg: 'NaN en el SVG sin fila elegida' };
        return { ok: true, msg: `frac=${frac.toFixed(2)}, sin excepción, sin NaN ✓` };
      } catch (e) { return { ok: false, msg: String(e) }; }
    }
  },
  {
    id: 'vk_clamp_rango', group: 'Escenas interactivas v6.8/v6.9',
    name: 'Vickers/Knoop — dzMicroClampPx respeta el mínimo/máximo en valores extremos',
    run: () => {
      const min = dzMicroClampPx(0.001), max = dzMicroClampPx(1.0), medio = dzMicroClampPx(0.10);
      if (min !== 8) return { ok: false, msg: `clamp mínimo esperado 8, dio ${min}` };
      if (max !== 90) return { ok: false, msg: `clamp máximo esperado 90, dio ${max}` };
      if (medio <= 8 || medio >= 90) return { ok: false, msg: `d1=0.10mm debería quedar sin clampear (8<x<90), dio ${medio}` };
      return { ok: true, msg: `min=${min}px, medio=${medio}px, max=${max}px ✓` };
    }
  },
  {
    id: 'vk_dos_ensayos_independientes', group: 'Escenas interactivas v6.8/v6.9',
    name: 'Vickers/Knoop — las banderas de animación de Vickers y Knoop son independientes (no se cruzan)',
    run: () => {
      if (typeof dzMicroVAnimando === 'undefined' || typeof dzMicroKAnimando === 'undefined') {
        return { ok: false, msg: 'no se encontraron las banderas dzMicroVAnimando/dzMicroKAnimando' };
      }
      const prevV = dzMicroVAnimando, prevK = dzMicroKAnimando;
      dzMicroVAnimando = true; dzMicroKAnimando = false;
      const ok1 = (dzMicroVAnimando === true && dzMicroKAnimando === false);
      dzMicroVAnimando = prevV; dzMicroKAnimando = prevK; // restaurar
      if (!ok1) return { ok: false, msg: 'las banderas de V y K comparten estado' };
      return { ok: true, msg: 'banderas independientes ✓' };
    }
  },
  {
    id: 'ch_theta1_monotona', group: 'Escenas interactivas v6.8/v6.9',
    name: 'Charpy — chCalcTheta1(E): a mayor energía absorbida, menor ángulo de rebote (monótona)',
    run: () => {
      const energias = [5, 40, 90, 150];
      let anterior = Infinity;
      for (const E of energias) {
        const theta1 = chCalcTheta1(E);
        if (theta1 >= anterior) return { ok: false, msg: `E=${E}: θ1=${theta1.toFixed(1)} no es menor que el anterior (${anterior.toFixed(1)})` };
        anterior = theta1;
      }
      return { ok: true, msg: `monótona decreciente en ${energias.length} puntos ✓` };
    }
  },
  {
    id: 'ch_theta1_sin_nan', group: 'Escenas interactivas v6.8/v6.9',
    name: 'Charpy — chCalcTheta1(E) no da NaN con energías en o por fuera del rango realista (E siempre es >=0, viene de frSigmoid)',
    run: () => {
      const casos = [0, 170, 10000];
      for (const E of casos) {
        const theta1 = chCalcTheta1(E);
        if (isNaN(theta1)) return { ok: false, msg: `E=${E} dio NaN` };
        if (theta1 < -1e-9 || theta1 > CH_THETA0_DEG + 1e-9) return { ok: false, msg: `E=${E}: θ1=${theta1} fuera de [0, ${CH_THETA0_DEG}]` }; // tolerancia de punto flotante en el roundtrip cos/acos
      }
      return { ok: true, msg: `${casos.length} valores extremos, sin NaN, dentro de rango ✓` };
    }
  },
  {
    id: 'rr_peso_min_rotura', group: 'Escenas interactivas v6.8/v6.9',
    name: 'R.R. Moore — rrPesoMinRotura(): el peso mínimo calculado realmente da sigma_a >= Se a brazo completo (FIX #55, guía pedagógica)',
    run: () => {
      for (const key of ['acero1045', 'acero4340']) {
        const p = FT_SN_PRESETS[key];
        const pesoMin = rrPesoMinRotura(key);
        if (pesoMin === null || isNaN(pesoMin) || pesoMin <= 0) return { ok: false, msg: `${key}: peso mínimo inválido (${pesoMin})` };
        const sigmaCheck = (pesoMin * RR_G * RR_BRAZO_M * RR_C_M / RR_I_M4) / 1e6;
        if (Math.abs(sigmaCheck - p.Se) > 0.5) return { ok: false, msg: `${key}: sigma_a con el peso mínimo da ${sigmaCheck.toFixed(1)}, esperado ≈Se=${p.Se}` };
      }
      const alPresetSinLimite = Object.keys(FT_SN_PRESETS).find(k => !FT_SN_PRESETS[k].hasLimit);
      if (alPresetSinLimite && rrPesoMinRotura(alPresetSinLimite) !== null) {
        return { ok: false, msg: `${alPresetSinLimite} no tiene límite de fatiga, debería devolver null` };
      }
      return { ok: true, msg: 'peso mínimo consistente con Se en 1045/4340, null en material sin límite ✓' };
    }
  },
  {
    id: 'tr_galgas_angulos_fijos', group: 'Escenas interactivas v6.8/v6.9',
    name: 'Tensiones residuales — trDrawEscena(): las 3 galgas quedan siempre a 0°/45°/90°, sin NaN, en cualquier deformación (incluso extrema)',
    run: () => {
      try {
        switchTab('degradacion'); cmSwitch('tensiones');
        const casos = [[-90, -25, 39], [400, -400, 10], [0, 0, 0]];
        for (const [e1, e2, e3] of casos) {
          trDrawEscena(0.5, 0.5, e1, e2, e3);
          const svg = document.getElementById('tr_svg').innerHTML;
          if (svg.includes('NaN')) return { ok: false, msg: `e1=${e1},e2=${e2},e3=${e3}: NaN en el SVG` };
          for (const ang of ['0°', '45°', '90°']) {
            const n = (svg.match(new RegExp(`>${ang}<`, 'g')) || []).length;
            if (n !== 1) return { ok: false, msg: `e1=${e1},e2=${e2},e3=${e3}: se esperaba exactamente una galga a ${ang}, aparecieron ${n}` };
          }
        }
        return { ok: true, msg: `${casos.length} casos, ángulos fijos y sin NaN ✓` };
      } catch (e) { return { ok: false, msg: String(e) }; }
    }
  },
  {
    id: 'tr_herramienta_vs_marca_independientes', group: 'Escenas interactivas v6.8/v6.9',
    name: 'Tensiones residuales — el agujero (marcaProg) no se achica ni desaparece cuando la broca se retira (brocaProg->0), mismo criterio que Brinell/Rockwell',
    run: () => {
      try {
        switchTab('degradacion'); cmSwitch('tensiones');
        trDrawEscena(1, 1, -90, -25, 39); // broca abajo, agujero terminado
        const rConBroca = document.getElementById('tr_svg').innerHTML.match(/circle[^>]*r="([\d.]+)"[^>]*stroke="var\(--neck\)"/)[1];
        trDrawEscena(0, 1, -90, -25, 39); // broca retirada, agujero debe seguir igual
        const rSinBroca = document.getElementById('tr_svg').innerHTML.match(/circle[^>]*r="([\d.]+)"[^>]*stroke="var\(--neck\)"/)[1];
        if (rConBroca !== rSinBroca) {
          return { ok: false, msg: `radio del agujero cambió al retirar la broca: ${rConBroca} -> ${rSinBroca}` };
        }
        return { ok: true, msg: `radio del agujero constante (${rConBroca}px) con broca puesta o retirada ✓` };
      } catch (e) { return { ok: false, msg: String(e) }; }
    }
  },
  {
    id: 'tr_reposo_coincide_con_final', group: 'Escenas interactivas v6.8/v6.9',
    name: 'Tensiones residuales — trUpdate() (exploración instantánea) dibuja el mismo estado final que trDrawEscena(0,1,...) llamada directamente, para los mismos sliders',
    run: () => {
      try {
        switchTab('degradacion'); cmSwitch('tensiones');
        document.getElementById('tr_e1').value = '120';
        document.getElementById('tr_e2').value = '-60';
        document.getElementById('tr_e3').value = '15';
        trUpdate();
        const svgReposo = document.getElementById('tr_svg').innerHTML;
        trDrawEscena(0, 1, 120, -60, 15);
        const svgDirecto = document.getElementById('tr_svg').innerHTML;
        if (svgReposo !== svgDirecto) return { ok: false, msg: 'trUpdate() no coincide con trDrawEscena(0,1,e1,e2,e3) llamada directa' };
        return { ok: true, msg: 'exploración instantánea == estado final de la escena ✓' };
      } catch (e) { return { ok: false, msg: String(e) }; }
    }
  },
  {
    id: 'tr_boton_no_relanza', group: 'Escenas interactivas v6.8/v6.9',
    name: 'Tensiones residuales — trEnsayar() no hace nada si ya hay una animación en curso (doble click no relanza)',
    run: () => {
      if (typeof dzTrAnimando === 'undefined') return { ok: false, msg: 'no se encontró la bandera dzTrAnimando' };
      const prevAnimando = dzTrAnimando;
      const btn = document.getElementById('tr_btnEnsayar');
      const prevDisabled = btn.disabled;
      dzTrAnimando = true;
      btn.disabled = false; // estado deliberadamente "inconsistente" para detectar si trEnsayar() lo toca
      trEnsayar();
      const tocoElBoton = (btn.disabled !== false);
      dzTrAnimando = prevAnimando; // restaurar
      btn.disabled = prevDisabled;
      if (tocoElBoton) return { ok: false, msg: 'trEnsayar() avanzó (tocó el botón) a pesar de dzTrAnimando=true' };
      return { ok: true, msg: 'con dzTrAnimando=true, trEnsayar() retorna sin hacer nada ✓' };
    }
  },
  {
    id: 'ut_eco_requiere_alineacion_x', group: 'Escenas interactivas v6.8/v6.9',
    name: 'Ultrasonido — el eco de defecto en el A-scan solo aparece cuando el palpador está alineado en X con el defecto (dentro de la tolerancia)',
    run: () => {
      try {
        switchTab('end'); dzSwitch('ultrasonido');
        document.getElementById('ut_modo').value = 'exploracion';
        utModoToggle();
        document.getElementById('ut_profdefecto').value = '20';
        document.getElementById('ut_posdefecto').value = '50';
        document.getElementById('ut_posPalpador').value = '50';
        utUpdate();
        const conEco = document.getElementById('ut_mTDefecto').textContent;
        document.getElementById('ut_posPalpador').value = '5';
        utUpdate();
        const sinEco = document.getElementById('ut_mTDefecto').textContent;
        if (conEco === '—') return { ok: false, msg: 'alineado (50%/50%) debería mostrar tiempo de vuelo al defecto' };
        if (sinEco !== '—') return { ok: false, msg: `desalineado (palpador 5%, defecto 50%) no debería mostrar eco, mostró "${sinEco}"` };
        document.getElementById('ut_posPalpador').value = '50'; utUpdate(); // restaurar
        return { ok: true, msg: 'eco presente alineado, ausente desalineado ✓' };
      } catch (e) { return { ok: false, msg: String(e) }; }
    }
  },
  {
    id: 'ut_encontrado_persiste', group: 'Escenas interactivas v6.8/v6.9',
    name: 'Ultrasonido — UT_ENCONTRADO (y el botón Revelar) persisten aunque el palpador se aleje después de encontrar el defecto',
    run: () => {
      try {
        switchTab('end'); dzSwitch('ultrasonido');
        document.getElementById('ut_modo').value = 'desafio';
        utModoToggle();
        if (document.getElementById('ut_btnRevelar').disabled !== true) {
          return { ok: false, msg: 'un desafío nuevo debe arrancar con Revelar deshabilitado (todavía sin encontrar)' };
        }
        const posReal = UT_DESAFIO.posDef;
        document.getElementById('ut_posPalpador').value = String(posReal);
        utUpdate();
        if (UT_ENCONTRADO !== true || document.getElementById('ut_btnRevelar').disabled !== false) {
          return { ok: false, msg: 'al coincidir con la posición real, UT_ENCONTRADO debería activarse y Revelar habilitarse' };
        }
        document.getElementById('ut_posPalpador').value = String((posReal + 50) % 100);
        utUpdate();
        if (UT_ENCONTRADO !== true || document.getElementById('ut_btnRevelar').disabled !== false) {
          return { ok: false, msg: 'UT_ENCONTRADO y Revelar deberían seguir true/habilitado aunque el palpador se aleje después' };
        }
        document.getElementById('ut_modo').value = 'exploracion'; utModoToggle(); // restaurar modo
        return { ok: true, msg: 'hallazgo persistente, no se re-oculta al alejar el palpador ✓' };
      } catch (e) { return { ok: false, msg: String(e) }; }
    }
  },
  {
    id: 'ut_desafio_no_revela_sin_encontrar', group: 'Escenas interactivas v6.8/v6.9',
    name: 'Ultrasonido — en modo desafío, utDesafioRevelar() no hace nada mientras el defecto no fue encontrado en X',
    run: () => {
      try {
        switchTab('end'); dzSwitch('ultrasonido');
        document.getElementById('ut_modo').value = 'desafio';
        utModoToggle(); // desafío nuevo: UT_ENCONTRADO=false
        document.getElementById('ut_desafioResultado').style.display = 'none';
        utDesafioRevelar();
        const seMostro = document.getElementById('ut_desafioResultado').style.display !== 'none';
        document.getElementById('ut_modo').value = 'exploracion'; utModoToggle(); // restaurar
        if (seMostro) return { ok: false, msg: 'utDesafioRevelar() no debería mostrar resultado sin haber encontrado el defecto antes' };
        return { ok: true, msg: 'Revelar bloqueado hasta encontrar el defecto en X ✓' };
      } catch (e) { return { ok: false, msg: String(e) }; }
    }
  },
  {
    id: 'ut_barrido_no_relanza', group: 'Escenas interactivas v6.8/v6.9',
    name: 'Ultrasonido — utBarrer() no hace nada si ya hay un barrido en curso (doble click no relanza)',
    run: () => {
      if (typeof UT_BARRIENDO === 'undefined') return { ok: false, msg: 'no se encontró la bandera UT_BARRIENDO' };
      const prevBarriendo = UT_BARRIENDO;
      const btn = document.getElementById('ut_btnBarrer');
      const prevDisabled = btn.disabled;
      UT_BARRIENDO = true;
      btn.disabled = false; // estado deliberadamente "inconsistente" para detectar si utBarrer() lo toca
      utBarrer();
      const tocoElBoton = (btn.disabled !== false);
      UT_BARRIENDO = prevBarriendo; // restaurar
      btn.disabled = prevDisabled;
      if (tocoElBoton) return { ok: false, msg: 'utBarrer() avanzó (tocó el botón) a pesar de UT_BARRIENDO=true' };
      return { ok: true, msg: 'con UT_BARRIENDO=true, utBarrer() retorna sin hacer nada ✓' };
    }
  },
  {
    id: 'mg_escena_sin_excepciones', group: 'Escenas interactivas v6.8/v6.9',
    name: 'Metalografía — mgDrawEscenaPrep() no tira excepciones en ningún punto de las 3 fases (pulido/ataque/observación), incluyendo los bordes exactos',
    run: () => {
      try {
        switchTab('degradacion'); cmSwitch('metalografia');
        const canvas = document.getElementById('mg_chart');
        const semillas = mgSemillasActuales();
        const puntos = [0, 0.1, 0.3, 0.549, 0.55, 0.6, 0.719, 0.72, 0.85, 0.999, 1];
        for (const p of puntos) mgDrawEscenaPrep(canvas, p, semillas);
        return { ok: true, msg: `${puntos.length} puntos de progreso (incluyendo bordes de fase) sin excepciones ✓` };
      } catch (e) { return { ok: false, msg: String(e) }; }
    }
  },
  {
    id: 'mg_reposo_coincide_con_final', group: 'Escenas interactivas v6.8/v6.9',
    name: 'Metalografía — mgDrawEscenaPrep(canvas,1,semillas) dibuja exactamente la misma micrografía final que mgUpdate() para el mismo ℓ',
    run: () => {
      try {
        switchTab('degradacion'); cmSwitch('metalografia');
        document.getElementById('mg_ell').value = '0.057';
        mgUpdate();
        const canvasReposo = document.getElementById('mg_chart');
        const dataReposo = canvasReposo.toDataURL();

        const semillas = mgSemillasActuales();
        const canvasDirecto = document.createElement('canvas');
        canvasDirecto.width = canvasReposo.width;
        canvasDirecto.height = canvasReposo.height;
        mgDrawEscenaPrep(canvasDirecto, 1, semillas);
        const dataDirecto = canvasDirecto.toDataURL();

        if (dataReposo !== dataDirecto) return { ok: false, msg: 'mgUpdate() no coincide pixel a pixel con mgDrawEscenaPrep(canvas,1,semillas)' };
        return { ok: true, msg: 'exploración instantánea == estado final de la escena (pixel a pixel) ✓' };
      } catch (e) { return { ok: false, msg: String(e) }; }
    }
  },
  {
    id: 'mg_fase_label_coherente', group: 'Escenas interactivas v6.8/v6.9',
    name: 'Metalografía — mgFaseLabel() nombra la etapa correcta (pulido/ataque/observación) según el progreso',
    run: () => {
      const casos = [
        [0, 'pul'], [0.3, 'pul'],
        [0.6, 'atac'], [0.7, 'atac'],
        [0.8, 'observ'], [1, 'observ'],
      ];
      for (const [p, esperado] of casos) {
        const texto = mgFaseLabel(p).toLowerCase();
        if (!texto.includes(esperado)) return { ok: false, msg: `progreso=${p}: label "${mgFaseLabel(p)}" no contiene "${esperado}"` };
      }
      return { ok: true, msg: `${casos.length} puntos de progreso, etapa correcta en cada uno ✓` };
    }
  },
  {
    id: 'mg_boton_no_relanza', group: 'Escenas interactivas v6.8/v6.9',
    name: 'Metalografía — mgPrepararProbeta() no hace nada si ya hay una animación en curso (doble click no relanza)',
    run: () => {
      if (typeof dzMgAnimando === 'undefined') return { ok: false, msg: 'no se encontró la bandera dzMgAnimando' };
      const prevAnimando = dzMgAnimando;
      const btn = document.getElementById('mg_btnPreparar');
      const prevDisabled = btn.disabled;
      dzMgAnimando = true;
      btn.disabled = false; // estado deliberadamente "inconsistente" para detectar si mgPrepararProbeta() lo toca
      mgPrepararProbeta();
      const tocoElBoton = (btn.disabled !== false);
      dzMgAnimando = prevAnimando; // restaurar
      btn.disabled = prevDisabled;
      if (tocoElBoton) return { ok: false, msg: 'mgPrepararProbeta() avanzó (tocó el botón) a pesar de dzMgAnimando=true' };
      return { ok: true, msg: 'con dzMgAnimando=true, mgPrepararProbeta() retorna sin hacer nada ✓' };
    }
  },
  {
    id: 'cr_oxido_monotono_sin_nan', group: 'Escenas interactivas v6.8/v6.9',
    name: 'Corrosión — crDrawEscena(): la opacidad del óxido crece monótonamente con fraction, sin NaN, para cualquier metal',
    run: () => {
      try {
        switchTab('degradacion'); cmSwitch('corrosion');
        const svg = document.getElementById('cr_svg');
        for (const metal of Object.keys(CR_METAL_TABLE)) {
          let prevOpacidad = -1;
          for (const f of [0, 0.25, 0.5, 0.75, 1]) {
            crDrawEscena(svg, f, metal);
            const html = svg.innerHTML;
            if (html.includes('NaN')) return { ok: false, msg: `${metal}, f=${f}: NaN en el SVG` };
            const m = html.match(/fill="rgb\([\d, ]+\)" opacity="([\d.]+)"/);
            if (!m) return { ok: false, msg: `${metal}, f=${f}: no se encontró la capa de óxido en el SVG` };
            const opacidad = parseFloat(m[1]);
            if (opacidad < prevOpacidad - 1e-9) return { ok: false, msg: `${metal}: la opacidad del óxido bajó de ${prevOpacidad} a ${opacidad} entre pasos de fraction` };
            prevOpacidad = opacidad;
          }
        }
        return { ok: true, msg: `${Object.keys(CR_METAL_TABLE).length} metales, opacidad de óxido monótona y sin NaN ✓` };
      } catch (e) { return { ok: false, msg: String(e) }; }
    }
  },
  {
    id: 'cr_reposo_coincide_con_final', group: 'Escenas interactivas v6.8/v6.9',
    name: 'Corrosión — crUpdate() (exploración instantánea) dibuja el mismo estado final que crDrawEscena(svg,1,metal) llamada directamente',
    run: () => {
      try {
        switchTab('degradacion'); cmSwitch('corrosion');
        document.getElementById('cr_metal').value = 'cobre';
        document.getElementById('cr_icorr').value = '12';
        document.getElementById('cr_tiempo').value = '40';
        crUpdate();
        const svgReposo = document.getElementById('cr_svg').innerHTML;
        crDrawEscena(document.getElementById('cr_svg'), 1, 'cobre');
        const svgDirecto = document.getElementById('cr_svg').innerHTML;
        if (svgReposo !== svgDirecto) return { ok: false, msg: 'crUpdate() no coincide con crDrawEscena(svg,1,metal) llamada directa' };
        return { ok: true, msg: 'exploración instantánea == estado final de la escena ✓' };
      } catch (e) { return { ok: false, msg: String(e) }; }
    }
  },
  {
    id: 'cr_picaduras_licencia_visual_no_afecta_faraday', group: 'Escenas interactivas v6.8/v6.9',
    name: 'Corrosión — las picaduras ilustrativas de la escena no alteran la pérdida de espesor real calculada por crCalcVelocidad()/crUpdate()',
    run: () => {
      try {
        switchTab('degradacion'); cmSwitch('corrosion');
        document.getElementById('cr_metal').value = 'hierro';
        document.getElementById('cr_icorr').value = '8';
        document.getElementById('cr_tiempo').value = '30';
        crUpdate();
        const perdidaAntes = document.getElementById('cr_mPerdida').textContent;
        // Dibujar la escena a distintos fraction (con picaduras crecientes) no
        // debe tocar para nada la métrica real, que solo depende de CR y t.
        crDrawEscena(document.getElementById('cr_svg'), 0.3, 'hierro');
        crDrawEscena(document.getElementById('cr_svg'), 0.9, 'hierro');
        const perdidaDespues = document.getElementById('cr_mPerdida').textContent;
        if (perdidaAntes !== perdidaDespues) return { ok: false, msg: `la métrica de pérdida cambió de ${perdidaAntes} a ${perdidaDespues} solo por redibujar la escena` };
        const CRreal = crCalcVelocidad(8, CR_METAL_TABLE.hierro.ew, CR_METAL_TABLE.hierro.rho);
        // FIX #63 (hallazgo QA v6.16, M53-01): crUpdate() ahora muestra la
        // pérdida con coma decimal -- se aplica el mismo .replace() acá para
        // que el valor esperado se construya en el mismo formato.
        const esperado = (CRreal * 30).toFixed(2).replace('.', ',');
        if (perdidaDespues !== esperado) return { ok: false, msg: `pérdida mostrada ${perdidaDespues}, esperada ${esperado} según crCalcVelocidad()` };
        return { ok: true, msg: 'las picaduras (licencia visual) no afectan la magnitud real calculada ✓' };
      } catch (e) { return { ok: false, msg: String(e) }; }
    }
  },
  {
    id: 'cr_boton_no_relanza', group: 'Escenas interactivas v6.8/v6.9',
    name: 'Corrosión — crEnvejecer() no hace nada si ya hay una animación en curso (doble click no relanza)',
    run: () => {
      if (typeof dzCrAnimando === 'undefined') return { ok: false, msg: 'no se encontró la bandera dzCrAnimando' };
      const prevAnimando = dzCrAnimando;
      const btn = document.getElementById('cr_btnEnvejecer');
      const prevDisabled = btn.disabled;
      dzCrAnimando = true;
      btn.disabled = false; // estado deliberadamente "inconsistente" para detectar si crEnvejecer() lo toca
      crEnvejecer();
      const tocoElBoton = (btn.disabled !== false);
      dzCrAnimando = prevAnimando; // restaurar
      btn.disabled = prevDisabled;
      if (tocoElBoton) return { ok: false, msg: 'crEnvejecer() avanzó (tocó el botón) a pesar de dzCrAnimando=true' };
      return { ok: true, msg: 'con dzCrAnimando=true, crEnvejecer() retorna sin hacer nada ✓' };
    }
  },
  {
    id: 'ds_ranura_sin_excepciones_ni_nan', group: 'Escenas interactivas v6.8/v6.9',
    name: 'Desgaste — dsDrawEscena() no tira excepciones ni deja NaN en el SVG, en toda la franja de progreso, para varios pares de materiales',
    run: () => {
      try {
        switchTab('degradacion'); cmSwitch('desgaste');
        const svg = document.getElementById('ds_svg');
        const puntos = [0, 0.1, 0.3, 0.5, 0.7, 0.9, 1];
        for (const key of ['polietileno', 'aceroacero', 'toolsteel']) {
          const par = DS_K_TABLE[key];
          for (const f of puntos) {
            dsDrawEscena(svg, f, par.k, 50, 1000, 120 * 9.80665e6);
            if (svg.innerHTML.includes('NaN')) return { ok: false, msg: `${key}, f=${f}: NaN en el SVG` };
          }
        }
        return { ok: true, msg: '3 pares de materiales x 7 puntos de progreso, sin excepciones ni NaN ✓' };
      } catch (e) { return { ok: false, msg: String(e) }; }
    }
  },
  {
    id: 'ds_reposo_coincide_con_final', group: 'Escenas interactivas v6.8/v6.9',
    name: 'Desgaste — dsUpdate() (exploración instantánea) dibuja el mismo estado final que dsDrawEscena(svg,1,...) llamada directamente',
    run: () => {
      try {
        switchTab('degradacion'); cmSwitch('desgaste');
        document.getElementById('ds_par').value = 'laton';
        document.getElementById('ds_fuerza').value = '80';
        document.getElementById('ds_dureza').value = '100';
        document.getElementById('ds_distancia').value = '500';
        dsUpdate();
        const svgReposo = document.getElementById('ds_svg').innerHTML;
        const par = DS_K_TABLE.laton;
        dsDrawEscena(document.getElementById('ds_svg'), 1, par.k, 80, 500, 100 * 9.80665e6);
        const svgDirecto = document.getElementById('ds_svg').innerHTML;
        if (svgReposo !== svgDirecto) return { ok: false, msg: 'dsUpdate() no coincide con dsDrawEscena(svg,1,...) llamada directa' };
        return { ok: true, msg: 'exploración instantánea == estado final de la escena ✓' };
      } catch (e) { return { ok: false, msg: String(e) }; }
    }
  },
  {
    id: 'ds_profundidad_coherente_con_volumen', group: 'Escenas interactivas v6.8/v6.9',
    name: 'Desgaste — la métrica de profundidad (simplificación geométrica) es siempre V_mm³/(ancho·largo), nunca un número inventado aparte',
    run: () => {
      try {
        switchTab('degradacion'); cmSwitch('desgaste');
        document.getElementById('ds_par').value = 'ptfe';
        document.getElementById('ds_fuerza').value = '30';
        document.getElementById('ds_dureza').value = '5';
        document.getElementById('ds_distancia').value = '2000';
        dsUpdate();
        const par = DS_K_TABLE.ptfe;
        const H_pa = 5 * 9.80665e6;
        const V_mm3 = dsCalcVolumen(par.k, 30, 2000, H_pa) * 1e9;
        const esperado = (V_mm3 / (3 * 15)).toFixed(3).replace('.', ',');
        const mostrado = document.getElementById('ds_mProfundidad').textContent;
        if (mostrado !== esperado) return { ok: false, msg: `profundidad mostrada ${mostrado}, esperada ${esperado} (V=${V_mm3} mm³ / (3·15))` };
        return { ok: true, msg: 'profundidad == V_mm³/(ancho·largo), coherente con Archard ✓' };
      } catch (e) { return { ok: false, msg: String(e) }; }
    }
  },
  {
    id: 'ds_boton_no_relanza', group: 'Escenas interactivas v6.8/v6.9',
    name: 'Desgaste — dsDeslizar() no hace nada si ya hay una animación en curso (doble click no relanza)',
    run: () => {
      if (typeof dzDsAnimando === 'undefined') return { ok: false, msg: 'no se encontró la bandera dzDsAnimando' };
      const prevAnimando = dzDsAnimando;
      const btn = document.getElementById('ds_btnDeslizar');
      const prevDisabled = btn.disabled;
      dzDsAnimando = true;
      btn.disabled = false; // estado deliberadamente "inconsistente" para detectar si dsDeslizar() lo toca
      dsDeslizar();
      const tocoElBoton = (btn.disabled !== false);
      dzDsAnimando = prevAnimando; // restaurar
      btn.disabled = prevDisabled;
      if (tocoElBoton) return { ok: false, msg: 'dsDeslizar() avanzó (tocó el botón) a pesar de dzDsAnimando=true' };
      return { ok: true, msg: 'con dzDsAnimando=true, dsDeslizar() retorna sin hacer nada ✓' };
    }
  },
  {
    id: 'fl_eps_lee_puntos_sin_recalcular', group: 'Escenas interactivas v6.8/v6.9',
    name: 'Fluencia — flEpsEnFraction() interpola exactamente sobre los mismos puntos que ya grafica flUpdateComportamiento(), sin recalcular la fórmula de 3 etapas',
    run: () => {
      try {
        mecSwitchGroup('rotura'); rtSwitch('fl_comportamiento');
        document.getElementById('fl_mat1').value = 'aluminio';
        document.getElementById('fl_sigma1').value = '80';
        document.getElementById('fl_temp1').value = '400';
        flUpdateComportamiento();
        if (!FL_ULTIMO) return { ok: false, msg: 'FL_ULTIMO no quedó asignado tras flUpdateComportamiento()' };
        const N = FL_ULTIMO.pts.length - 1;
        // en los puntos EXACTOS de la grilla (i/N), la interpolación debe
        // coincidir con el punto ya calculado, sin ningún desvío.
        for (const i of [0, 1, Math.round(N / 2), N - 1, N]) {
          const esperado = FL_ULTIMO.pts[i].y;
          const obtenido = flEpsEnFraction(FL_ULTIMO, i / N);
          if (Math.abs(obtenido - esperado) > 1e-9) return { ok: false, msg: `i=${i}: interpolado ${obtenido}, esperado ${esperado} (punto ya calculado)` };
        }
        return { ok: true, msg: 'flEpsEnFraction() coincide exactamente con los puntos ya calculados, en toda la grilla ✓' };
      } catch (e) { return { ok: false, msg: String(e) }; }
    }
  },
  {
    id: 'fl_escena_sin_excepciones_ni_nan', group: 'Escenas interactivas v6.8/v6.9',
    name: 'Fluencia — flDrawEscena() no tira excepciones ni deja NaN en el SVG, en toda la franja de progreso, para los 3 materiales',
    run: () => {
      try {
        mecSwitchGroup('rotura'); rtSwitch('fl_comportamiento');
        const svg = document.getElementById('fl_svg');
        const puntos = [0, 0.1, 0.3, 0.5, 0.7, 0.9, 0.999, 1];
        for (const matKey of ['inox', 'superaleacion', 'aluminio']) {
          document.getElementById('fl_mat1').value = matKey;
          flUpdateComportamiento();
          for (const f of puntos) {
            flDrawEscena(svg, f, FL_ULTIMO);
            if (svg.innerHTML.includes('NaN')) return { ok: false, msg: `${matKey}, f=${f}: NaN en el SVG` };
          }
        }
        return { ok: true, msg: '3 materiales x 8 puntos de progreso, sin excepciones ni NaN ✓' };
      } catch (e) { return { ok: false, msg: String(e) }; }
    }
  },
  {
    id: 'fl_reposo_coincide_con_final', group: 'Escenas interactivas v6.8/v6.9',
    name: 'Fluencia — flUpdateComportamiento() (exploración instantánea) dibuja el mismo estado final (roto) que flDrawEscena(svg,1,FL_ULTIMO) llamada directamente',
    run: () => {
      try {
        mecSwitchGroup('rotura'); rtSwitch('fl_comportamiento');
        document.getElementById('fl_mat1').value = 'superaleacion';
        document.getElementById('fl_sigma1').value = '150';
        document.getElementById('fl_temp1').value = '900';
        flUpdateComportamiento();
        const svgReposo = document.getElementById('fl_svg').innerHTML;
        flDrawEscena(document.getElementById('fl_svg'), 1, FL_ULTIMO);
        const svgDirecto = document.getElementById('fl_svg').innerHTML;
        if (svgReposo !== svgDirecto) return { ok: false, msg: 'flUpdateComportamiento() no coincide con flDrawEscena(svg,1,FL_ULTIMO) llamada directa' };
        if (!svgReposo.includes('rotura por fluencia')) return { ok: false, msg: 'en reposo (fraction=1) la escena debería mostrar la probeta ya rota' };
        return { ok: true, msg: 'exploración instantánea == estado final roto de la escena ✓' };
      } catch (e) { return { ok: false, msg: String(e) }; }
    }
  },
  {
    id: 'fl_boton_no_relanza', group: 'Escenas interactivas v6.8/v6.9',
    name: 'Fluencia — flEnsayar() no hace nada si ya hay una animación en curso (doble click no relanza)',
    run: () => {
      if (typeof dzFlAnimando === 'undefined') return { ok: false, msg: 'no se encontró la bandera dzFlAnimando' };
      const prevAnimando = dzFlAnimando;
      const btn = document.getElementById('fl_btnEnsayar');
      const prevDisabled = btn.disabled;
      dzFlAnimando = true;
      btn.disabled = false; // estado deliberadamente "inconsistente" para detectar si flEnsayar() lo toca
      flEnsayar();
      const tocoElBoton = (btn.disabled !== false);
      dzFlAnimando = prevAnimando; // restaurar
      btn.disabled = prevDisabled;
      if (tocoElBoton) return { ok: false, msg: 'flEnsayar() avanzó (tocó el botón) a pesar de dzFlAnimando=true' };
      return { ok: true, msg: 'con dzFlAnimando=true, flEnsayar() retorna sin hacer nada ✓' };
    }
  },
  {
    id: 'ft_curva_crecimiento_valida_y_monotona', group: 'Escenas interactivas v6.8/v6.9',
    name: 'Fatiga/Paris — ftCalcCurvaCrecimiento() integra una curva {a,N} válida y monótona (ambas crecientes) para parámetros típicos de acero',
    run: () => {
      try {
        mecSwitchGroup('rotura'); rtSwitch('ft_velocidad');
        const r = ftCalcCurvaCrecimiento(6.9e-12, 3.0, 1.0, 150, 0.0005, 98);
        if (!r.valido) return { ok: false, msg: `se esperaba un resultado válido, motivo de rechazo: ${r.motivo}` };
        if (!(r.ac_m > 0.0005)) return { ok: false, msg: `a_c (${r.ac_m}) debería ser mayor que a₀ (0.0005)` };
        let prevA = -1, prevN = -1;
        for (const pt of r.curva) {
          if (!isFinite(pt.a) || !isFinite(pt.N)) return { ok: false, msg: `punto no finito: a=${pt.a}, N=${pt.N}` };
          if (pt.a < prevA - 1e-12) return { ok: false, msg: `a no es monótona: bajó de ${prevA} a ${pt.a}` };
          if (pt.N < prevN - 1e-9) return { ok: false, msg: `N no es monótona: bajó de ${prevN} a ${pt.N}` };
          prevA = pt.a; prevN = pt.N;
        }
        if (Math.abs(r.curva[r.curva.length - 1].N - r.Nf) > 1e-6) return { ok: false, msg: 'r.Nf no coincide con el último punto de la curva' };
        return { ok: true, msg: `curva válida, ${r.curva.length} puntos, monótona en a y en N, Nf=${r.Nf.toExponential(2)} ✓` };
      } catch (e) { return { ok: false, msg: String(e) }; }
    }
  },
  {
    id: 'ft_curva_crecimiento_detecta_a0_mayor_igual_ac', group: 'Escenas interactivas v6.8/v6.9',
    name: 'Fatiga/Paris — ftCalcCurvaCrecimiento() rechaza con un motivo claro cuando a₀ ya es mayor o igual que a_c',
    run: () => {
      try {
        // Δσ muy alto -> a_c muy chica, menor que a₀=0.5mm elegido a propósito.
        const r = ftCalcCurvaCrecimiento(6.9e-12, 3.0, 1.0, 390, 0.0005, 5);
        if (r.valido) return { ok: false, msg: 'debería haber rechazado (a_c calculada queda menor que a₀)' };
        if (!r.motivo || !r.motivo.toLowerCase().includes('crítica')) return { ok: false, msg: `motivo de rechazo poco claro: "${r.motivo}"` };
        return { ok: true, msg: 'rechazado correctamente, con un motivo explicando a₀ vs a_c ✓' };
      } catch (e) { return { ok: false, msg: String(e) }; }
    }
  },
  {
    id: 'ft_escena_sin_excepciones_ni_nan', group: 'Escenas interactivas v6.8/v6.9',
    name: 'Fatiga/Paris — ftDrawEscena() no tira excepciones ni deja NaN en el SVG, en toda la franja de progreso, para los 3 materiales',
    run: () => {
      try {
        mecSwitchGroup('rotura'); rtSwitch('ft_velocidad');
        const svg = document.getElementById('ft_svg');
        const puntos = [0, 0.1, 0.3, 0.5, 0.7, 0.9, 0.999, 1];
        for (const matKey of ['acero', 'aluminio', 'titanio']) {
          document.getElementById('ft_parisMat').value = matKey;
          ftApplyParisPreset();
          for (const f of puntos) {
            ftDrawEscena(svg, f, FT_ULTIMO);
            if (svg.innerHTML.includes('NaN')) return { ok: false, msg: `${matKey}, f=${f}: NaN en el SVG` };
          }
        }
        return { ok: true, msg: '3 materiales x 8 puntos de progreso, sin excepciones ni NaN ✓' };
      } catch (e) { return { ok: false, msg: String(e) }; }
    }
  },
  {
    id: 'ft_reposo_coincide_con_final', group: 'Escenas interactivas v6.8/v6.9',
    name: 'Fatiga/Paris — ftUpdateVelocidad() (exploración instantánea) dibuja el mismo estado final (roto) que ftDrawEscena(svg,1,FT_ULTIMO) llamada directamente',
    run: () => {
      try {
        mecSwitchGroup('rotura'); rtSwitch('ft_velocidad');
        document.getElementById('ft_parisMat').value = 'aluminio';
        ftApplyParisPreset();
        document.getElementById('ft_dsigma').value = '120';
        document.getElementById('ft_a0').value = '0.3';
        document.getElementById('ft_y').value = '1.10';
        ftUpdateVelocidad();
        const svgReposo = document.getElementById('ft_svg').innerHTML;
        ftDrawEscena(document.getElementById('ft_svg'), 1, FT_ULTIMO);
        const svgDirecto = document.getElementById('ft_svg').innerHTML;
        if (svgReposo !== svgDirecto) return { ok: false, msg: 'ftUpdateVelocidad() no coincide con ftDrawEscena(svg,1,FT_ULTIMO) llamada directa' };
        if (!svgReposo.includes('rotura: a alcanzó a_c')) return { ok: false, msg: 'en reposo (fraction=1) la escena debería mostrar la rotura' };
        return { ok: true, msg: 'exploración instantánea == estado final roto de la escena ✓' };
      } catch (e) { return { ok: false, msg: String(e) }; }
    }
  },
  {
    id: 'ft_boton_no_relanza', group: 'Escenas interactivas v6.8/v6.9',
    name: 'Fatiga/Paris — ftEnsayarFatiga() no hace nada si ya hay una animación en curso (doble click no relanza)',
    run: () => {
      if (typeof dzFtAnimando === 'undefined') return { ok: false, msg: 'no se encontró la bandera dzFtAnimando' };
      const prevAnimando = dzFtAnimando;
      const btn = document.getElementById('ft_btnCrecer');
      const prevDisabled = btn.disabled;
      dzFtAnimando = true;
      btn.disabled = false; // estado deliberadamente "inconsistente" para detectar si ftEnsayarFatiga() lo toca
      ftEnsayarFatiga();
      const tocoElBoton = (btn.disabled !== false);
      dzFtAnimando = prevAnimando; // restaurar
      btn.disabled = prevDisabled;
      if (tocoElBoton) return { ok: false, msg: 'ftEnsayarFatiga() avanzó (tocó el botón) a pesar de dzFtAnimando=true' };
      return { ok: true, msg: 'con dzFtAnimando=true, ftEnsayarFatiga() retorna sin hacer nada ✓' };
    }
  },
  {
    // FIX #61 (QA exhaustivo v6.13, etapa 4): grilla de tarjetas "Paso 1..5"
    // debajo de la escena de R.R. Moore, pedida explícitamente por Agus.
    // Cobertura permanente: la grilla se construye siempre a partir de
    // rrPasos() (misma fuente que ya usa la máquina de estados para el
    // indicador dinámico de arriba), así que este test confirma que ambas
    // vistas nunca pueden desincronizarse -- si mañana se agrega/edita un
    // paso en rrPasos(), la grilla lo refleja solo con que este test siga
    // pasando, sin tocar rrRenderPasosGrid().
    id: 'rr_pasos_grid_generada_desde_rrPasos', group: 'R.R. Moore',
    name: 'R.R. Moore — la grilla de tarjetas "Paso N" tiene una tarjeta por cada paso real de rrPasos(), todas con texto',
    run: () => {
      switchTab('mecanicos', document.querySelector('.tab[onclick*="switchTab(\'mecanicos\'"]'));
      mecSwitchGroup('rotura');
      rtSwitch('ft_rrmoore');
      rrRenderPasosGrid();
      const pasos = rrPasos();
      const cards = [...document.querySelectorAll('#rr_pasosGrid .rr-paso-card')];
      if (cards.length !== pasos.length) return { ok: false, msg: `${cards.length} tarjetas en la grilla, ${pasos.length} pasos en rrPasos()` };
      for (let i = 0; i < pasos.length; i++) {
        const num = cards[i].querySelector('.rr-paso-num').textContent;
        if (num !== `Paso ${i + 1}`) return { ok: false, msg: `tarjeta ${i}: num="${num}" (esperado "Paso ${i + 1}")` };
        const texto = cards[i].querySelector('.rr-paso-texto').textContent;
        if (!texto || texto.length < 10) return { ok: false, msg: `tarjeta ${i} (${pasos[i].id}) sin texto o demasiado corto: "${texto}"` };
      }
      return { ok: true, msg: `${cards.length} tarjetas, una por paso, todas con texto ✓` };
    }
  },
  {
    id: 'rr_pasos_grid_resalta_paso_activo', group: 'R.R. Moore',
    name: 'R.R. Moore — la tarjeta del paso vigente queda resaltada (.active) y se mueve al avanzar con rrSiguiente()',
    run: () => {
      switchTab('mecanicos', document.querySelector('.tab[onclick*="switchTab(\'mecanicos\'"]'));
      mecSwitchGroup('rotura');
      rtSwitch('ft_rrmoore');
      rrReiniciar();
      const activaInicial = [...document.querySelectorAll('#rr_pasosGrid .rr-paso-card')].findIndex(c => c.classList.contains('active'));
      if (activaInicial !== 0) return { ok: false, msg: `al reiniciar, la tarjeta activa es la #${activaInicial + 1} (esperada #1)` };
      rrSiguiente(); // montaje -> contrapeso (no requiere peso)
      const activaTrasAvanzar = [...document.querySelectorAll('#rr_pasosGrid .rr-paso-card')].findIndex(c => c.classList.contains('active'));
      rrReiniciar(); // restaurar estado para no afectar otros tests
      if (activaTrasAvanzar !== 1) return { ok: false, msg: `tras rrSiguiente(), la tarjeta activa es la #${activaTrasAvanzar + 1} (esperada #2)` };
      return { ok: true, msg: 'la tarjeta activa sigue a rrEstado.indice correctamente ✓' };
    }
  },
  // ================================================================
  // BATCH DE CORRECCIONES QA v6.21 -> v6.22 (FIX #69 a #89, testeo
  // exhaustivo en 40 etapas). Un test de regresión por hallazgo.
  // ================================================================
  {
    id: 'fix69_a0_manual_invalido_avisa', group: 'Correcciones QA v6.22',
    name: 'FIX #69 — Tracción: A₀ manual ≤0 muestra aviso dedicado en vez de caer en silencio al valor de d₀',
    run: () => {
      switchTab('mecanicos', document.querySelector('.tab[onclick*="switchTab(\'mecanicos\'"]'));
      mecSwitchGroup('estatica'); edSwitch('traccion');
      const a0El = document.getElementById('e_a0'), d0El = document.getElementById('e_d0');
      const a0Antes = a0El.value, d0Antes = d0El.value;
      d0El.value = '12.8'; a0El.value = '-10';
      updateDerived();
      const warn = document.getElementById('e_warnDim');
      const visible = warn.style.display === 'block' && /A₀/.test(warn.innerHTML);
      a0El.value = a0Antes; d0El.value = d0Antes; updateDerived();
      if (!visible) return { ok: false, msg: 'A₀=-10 no disparó el aviso dedicado' };
      return { ok: true, msg: 'A₀ manual inválido avisa correctamente ✓' };
    }
  },
  {
    id: 'fix70_descarga_e_cero_no_da_infinity', group: 'Correcciones QA v6.22',
    name: 'FIX #70 — Tracción: E=0 en la descarga ya no da ε_res=-Infinity',
    run: () => {
      switchTab('mecanicos', document.querySelector('.tab[onclick*="switchTab(\'mecanicos\'"]'));
      mecSwitchGroup('estatica'); edSwitch('traccion');
      resetSim();
      document.getElementById('e_E').value = '0';
      document.getElementById('e_sy').value = '250'; document.getElementById('e_ts').value = '450';
      document.getElementById('e_el').value = '20'; document.getElementById('e_fluencia').checked = true;
      buildCurve();
      progress = 60;
      triggerDischarge();
      const html = document.getElementById('dischargeInfo').innerHTML;
      resetSim();
      if (/Infinity/.test(html)) return { ok: false, msg: 'dischargeInfo todavía muestra Infinity: ' + html.slice(0,80) };
      return { ok: true, msg: 'descarga con E=0 ya no produce Infinity ✓' };
    }
  },
  {
    id: 'fix71_compresion_h0_mensaje_propio', group: 'Correcciones QA v6.22',
    name: 'FIX #71 — Compresión: h₀≤0 tiene mensaje propio, no reutiliza el de "fuera de rango 1-3"',
    run: () => {
      switchTab('mecanicos', document.querySelector('.tab[onclick*="switchTab(\'mecanicos\'"]'));
      mecSwitchGroup('estatica'); edSwitch('compresion');
      const h0El = document.getElementById('co_h0'), d0El = document.getElementById('co_d0');
      const h0Antes = h0El.value, d0Antes = d0El.value;
      d0El.value = '15'; h0El.value = '-10';
      updateCompDerived();
      const warn = document.getElementById('co_warnRatio');
      const ok = warn.style.display === 'block' && /altura h₀ debe ser un número positivo/.test(warn.textContent);
      h0El.value = h0Antes; d0El.value = d0Antes; updateCompDerived();
      if (!ok) return { ok: false, msg: 'h₀=-10 no dio el mensaje dedicado: ' + warn.textContent };
      return { ok: true, msg: 'h₀≤0 tiene su propio mensaje ✓' };
    }
  },
  {
    id: 'fix72_compresion_d0_negativo_no_da_fmax_igual', group: 'Correcciones QA v6.22',
    name: 'FIX #72 — Compresión: d₀ negativo ya no da el mismo F_máx que su valor absoluto',
    run: () => {
      switchTab('mecanicos', document.querySelector('.tab[onclick*="switchTab(\'mecanicos\'"]'));
      mecSwitchGroup('estatica'); edSwitch('compresion');
      const d0El = document.getElementById('co_d0');
      const d0Antes = d0El.value;
      document.getElementById('co_h0').value = '30'; document.getElementById('co_E').value = '207';
      document.getElementById('co_syc').value = '250'; document.getElementById('co_sc').value = '350';
      document.getElementById('co_frag').value = 'no';
      d0El.value = '15'; buildCompCurve();
      const fMaxPositivo = document.getElementById('co_rFmax').textContent;
      d0El.value = '-15'; buildCompCurve();
      const fMaxNegativo = document.getElementById('co_rFmax').textContent;
      d0El.value = d0Antes; buildCompCurve();
      if (fMaxPositivo === fMaxNegativo) return { ok: false, msg: `d₀=+15 y d₀=-15 dan el mismo F_máx (${fMaxPositivo}) -- el piso no está actuando` };
      return { ok: true, msg: `d₀=+15 → ${fMaxPositivo}, d₀=-15 → ${fMaxNegativo} (distintos) ✓` };
    }
  },
  {
    id: 'fix73_comparar_fragil_ts_vacio_avisa', group: 'Correcciones QA v6.22',
    name: 'FIX #73 — Comparar: material frágil (σy=0) con TS vacío avisa y no da curva plana en 0',
    run: () => {
      switchTab('mecanicos', document.querySelector('.tab[onclick*="switchTab(\'mecanicos\'"]'));
      mecSwitchGroup('estatica'); edSwitch('comparar');
      const c1sy = document.getElementById('c1_sy'), c1ts = document.getElementById('c1_ts');
      const syAntes = c1sy.value, tsAntes = c1ts.value;
      document.getElementById('c1_E').value = '125'; c1sy.value = '0'; c1ts.value = ''; document.getElementById('c1_el').value = '0.6';
      renderCompare();
      const warn = document.getElementById('c_warnSyTs');
      const curva = compareChartInst.data.datasets[0].data;
      const maxY = Math.max(...curva.map(p=>p.y));
      c1sy.value = syAntes; c1ts.value = tsAntes; renderCompare();
      if (warn.style.display !== 'block') return { ok: false, msg: 'no se muestra ningún aviso con TS vacío + frágil' };
      if (maxY <= 0) return { ok: false, msg: `la curva de M1 sigue plana en 0 (maxY=${maxY})` };
      return { ok: true, msg: 'TS inválido en material frágil avisa y ya no da curva plana ✓' };
    }
  },
  {
    id: 'fix74_temperatura_no_recorta_el0_alto_en_referencia', group: 'Correcciones QA v6.22',
    name: 'FIX #74 — Temperatura: %EL de un polímero con el0>80% no se recorta a 25°C (temperatura de referencia)',
    run: () => {
      switchTab('mecanicos', document.querySelector('.tab[onclick*="switchTab(\'mecanicos\'"]'));
      mecSwitchGroup('estatica'); edSwitch('temperatura');
      const elEl = document.getElementById('t_el');
      const elAntes = elEl.value;
      document.getElementById('t_E').value = '2.8'; document.getElementById('t_sy').value = '50';
      document.getElementById('t_ts').value = '75'; elEl.value = '150';
      document.getElementById('t_low').value = '-100'; document.getElementById('t_mid').value = '25'; document.getElementById('t_high').value = '150';
      renderTemp();
      const leg = document.getElementById('tLeg2').textContent;
      elEl.value = elAntes; renderTemp();
      if (/80,0%/.test(leg)) return { ok: false, msg: `a T de referencia sigue mostrando el cap de 80%: "${leg}"` };
      if (!/150,0%/.test(leg)) return { ok: false, msg: `no muestra el %EL real (150%) a T de referencia: "${leg}"` };
      return { ok: true, msg: 'el0=150% ya no se recorta a la temperatura de referencia ✓' };
    }
  },
  {
    id: 'fix75_proc_temp_c_cubre_los_41_materiales', group: 'Correcciones QA v6.22',
    name: 'FIX #75 — Compuesto: PROC_TEMP_C tiene entrada para los 41 materiales de PRESETS (recorre PRESETS, no una lista fija)',
    run: () => {
      const faltantes = Object.keys(PRESETS).filter(k => !(k in PROC_TEMP_C));
      if (faltantes.length) return { ok: false, msg: `faltan en PROC_TEMP_C: ${faltantes.join(', ')}` };
      return { ok: true, msg: `los ${Object.keys(PRESETS).length} materiales de PRESETS tienen temperatura de proceso ✓` };
    }
  },
  {
    id: 'fix75_compuesto_sic_pvc_dispara_aviso', group: 'Correcciones QA v6.22',
    name: 'FIX #75 — Compuesto: matriz SiC + refuerzo PVC rígido (absurdo térmico) ya dispara el aviso de plausibilidad',
    run: () => {
      const res = dzCompoundPlausibility('sic','pvcrigido',410,3);
      if (!res) return { ok: false, msg: 'sigue sin disparar ningún aviso para sic+pvcrigido' };
      return { ok: true, msg: 'sic+pvcrigido ahora sí dispara el aviso de plausibilidad ✓' };
    }
  },
  {
    id: 'fix76_loadconfig_fluencia_fallback', group: 'Correcciones QA v6.22',
    name: 'FIX #76 — Configuraciones: cargar una config vieja sin el campo fluencia deja el checkbox marcado (su default), no desmarcado',
    run: () => {
      const key = 'ensayo_configs';
      const antes = localStorage.getItem(key);
      const fluenciaAntes = document.getElementById('e_fluencia').checked;
      localStorage.setItem(key, JSON.stringify([{name:'__test_fix76__', date:'', E:'207', sy:'250', ts:'450', el:'20', l0:'50', d0:'12.8'}]));
      loadConfig(0);
      const marcado = document.getElementById('e_fluencia').checked;
      document.getElementById('e_fluencia').checked = fluenciaAntes;
      if (antes===null) localStorage.removeItem(key); else localStorage.setItem(key, antes);
      if (!marcado) return { ok: false, msg: 'config sin campo fluencia dejó el checkbox desmarcado' };
      return { ok: true, msg: 'config vieja sin fluencia cae al default marcado ✓' };
    }
  },
  {
    id: 'fix77_knoop_tiene_referencia', group: 'Correcciones QA v6.22',
    name: 'FIX #77 — Knoop: ahora tiene selector de material y tabla de referencia, mismo criterio que Vickers',
    run: () => {
      switchTab('mecanicos', document.querySelector('.tab[onclick*="switchTab(\'mecanicos\'"]'));
      mecSwitchGroup('dureza'); dzSwitch('micro');
      const sel = document.getElementById('dz_kMat');
      if (!sel) return { ok: false, msg: 'no existe #dz_kMat' };
      if (Object.keys(KNOOP_REF).length < 3) return { ok: false, msg: `KNOOP_REF solo tiene ${Object.keys(KNOOP_REF).length} materiales` };
      sel.value = 'ceramica';
      dzApplyKnoopMaterial();
      const resultado = document.getElementById('dz_kResult').textContent;
      const cmp = document.getElementById('dz_kMatCompare');
      sel.value = '';
      if (resultado === '—') return { ok: false, msg: 'elegir cerámica no calculó ningún HK' };
      if (cmp.style.display !== 'block') return { ok: false, msg: 'no se muestra la comparación bibliográfica' };
      return { ok: true, msg: `Knoop con cerámica da ${resultado} y muestra comparación ✓` };
    }
  },
  {
    id: 'fix78_fractura_aluminio7075_no_es_6061', group: 'Correcciones QA v6.22',
    name: 'FIX #78 — Fractura: la opción "Aluminio 7075-T651" del K_IC ya no apunta a la clave del aluminio 6061 genérico',
    run: () => {
      const opt = document.querySelector('#rt_kicPreset option[value="24"]');
      if (!opt) return { ok: false, msg: 'no se encontró la opción de 24 MPa√m' };
      if (opt.dataset.material === 'aluminio') return { ok: false, msg: 'todavía apunta a "aluminio" (6061 genérico)' };
      if (opt.dataset.material !== 'aluminio7075') return { ok: false, msg: `apunta a "${opt.dataset.material}", esperado "aluminio7075"` };
      if (!PRESETS.aluminio7075.frac || !PRESETS.aluminio7075.frac.kic) return { ok: false, msg: 'PRESETS.aluminio7075.frac.kic no existe' };
      return { ok: true, msg: 'la opción ahora apunta a aluminio7075, con su propio K_IC ✓' };
    }
  },
  {
    id: 'fix79_charpy_borrar_cancela_animacion', group: 'Correcciones QA v6.22',
    name: 'FIX #79 — Charpy: "Borrar ensayos" durante una animación en curso la cancela (no reaparece un punto fantasma)',
    run: () => {
      mecSwitchGroup('rotura'); rtSwitch('fr_impacto');
      const key = document.getElementById('rt_impactoMat').value;
      const historialAntes = JSON.stringify(chHistorial[key]);
      chAnimando = true;
      chHistorial[key] = [{T:20, E:50}];
      const originalConfirm = window.confirm;
      window.confirm = () => true;
      chBorrarEnsayos();
      window.confirm = originalConfirm;
      const animandoTrasBorrar = chAnimando;
      const vacio = chHistorial[key].length === 0;
      chHistorial[key] = JSON.parse(historialAntes);
      if (animandoTrasBorrar) return { ok: false, msg: 'chAnimando sigue en true tras borrar -- no se canceló' };
      if (!vacio) return { ok: false, msg: 'el historial no quedó vacío tras borrar' };
      return { ok: true, msg: 'borrar durante una animación en curso la cancela correctamente ✓' };
    }
  },
  {
    id: 'fix80_fatiga_sn_avisa_extrapolacion_extrema', group: 'Correcciones QA v6.22',
    name: 'FIX #80 — Fatiga S-N: σ_a bajo en un material sin límite de fatiga (al2014) avisa que N_f es una extrapolación fuera de rango',
    run: () => {
      mecSwitchGroup('rotura'); rtSwitch('ft_sn');
      const matSel = document.getElementById('ft_snMat'), saEl = document.getElementById('ft_sa');
      const matAntes = matSel.value, saAntes = saEl.value;
      matSel.value = 'al2014'; saEl.value = '20';
      ftUpdateSN();
      const warn = document.getElementById('ft_warnExtrapolacion');
      const visible = warn && warn.style.display === 'block';
      matSel.value = matAntes; saEl.value = saAntes; ftUpdateSN();
      if (!visible) return { ok: false, msg: 'no aparece el aviso de extrapolación con al2014 a σ_a=20' };
      return { ok: true, msg: 'aviso de extrapolación fuera de rango funciona ✓' };
    }
  },
  {
    id: 'fix81_paris_integracion_exacta_vs_analitica', group: 'Correcciones QA v6.22',
    name: 'FIX #81 — Ley de Paris: la integración numérica reproduce la solución analítica cerrada (m=3) con <0,5% de error en todo el rango de a₀',
    run: () => {
      const C=6.9e-12, m=3.0, Y=1.0, dSigma=150, kic=98;
      for (const a0mm of [0.1, 0.5, 5.0]) {
        const a0_m = a0mm/1000;
        const r = ftCalcCurvaCrecimiento(C, m, Y, dSigma, a0_m, kic);
        if (!r.valido) return { ok: false, msg: `a₀=${a0mm}mm: la integración no dio un resultado válido` };
        const analit = (2/(C*Math.pow(Y*dSigma,3)*Math.pow(Math.PI,1.5))) * (Math.pow(a0_m,-0.5)-Math.pow(r.ac_m,-0.5));
        const errorPct = Math.abs(r.Nf-analit)/analit*100;
        if (errorPct > 0.5) return { ok: false, msg: `a₀=${a0mm}mm: error de ${errorPct.toFixed(2)}% contra la solución analítica (antes del FIX #81 llegaba a 118%)` };
      }
      return { ok: true, msg: 'integración de Paris <0,5% de error en todo el rango de a₀ ✓' };
    }
  },
  {
    id: 'fix82_fluencia_cero_absoluto_exacto_invalido', group: 'Correcciones QA v6.22',
    name: 'FIX #82 — Fluencia: T_test que clampea exacto a -273,15°C se trata como dato inválido, no da LMP=0 en silencio',
    run: () => {
      mecSwitchGroup('rotura'); rtSwitch('fl_extrapolacion');
      const ttestEl = document.getElementById('fl_ttest');
      const antes = ttestEl.value;
      ttestEl.value = '-300';
      flUpdateExtrapolacion();
      const lmp = document.getElementById('fl_mLMP').textContent;
      ttestEl.value = antes; flUpdateExtrapolacion();
      if (lmp !== '—') return { ok: false, msg: `LMP sigue mostrando un número (${lmp}) en vez de "—"` };
      return { ok: true, msg: 'T_test=-273,15° exacto ahora se trata como dato inválido ✓' };
    }
  },
  {
    id: 'fix83_polimeros_eje_fijo_a_ventana', group: 'Correcciones QA v6.22',
    name: 'FIX #83 — Polímeros: el eje X del gráfico DMA queda fijo a la ventana Tg±80°C del polímero elegido',
    run: () => {
      switchTab('degradacion', document.querySelector('.tab[onclick*="switchTab(\'degradacion\'"]'));
      cmSwitch('polimeros');
      const matSel = document.getElementById('po_polimero'), tempEl = document.getElementById('po_temp');
      const matAntes = matSel.value, tempAntes = tempEl.value;
      matSel.value = 'caucho'; tempEl.value = '150';
      poUpdate();
      const xMin = poChartInst.options.scales.x.min, xMax = poChartInst.options.scales.x.max;
      matSel.value = matAntes; tempEl.value = tempAntes; poUpdate();
      if (xMax - xMin !== 160) return { ok: false, msg: `ventana del eje no es de 160°C (min=${xMin}, max=${xMax})` };
      return { ok: true, msg: `eje fijo a [${xMin},${xMax}] para caucho ✓` };
    }
  },
  {
    id: 'fix84_ultrasonido_velocidad_negativa_invalida', group: 'Correcciones QA v6.22',
    name: 'FIX #84 — Ultrasonido: velocidad personalizada negativa ya no se muestra como un valor válido',
    run: () => {
      mecSwitchGroup('dureza'); dzSwitch('ultrasonido');
      const metalSel = document.getElementById('ut_metal'), velEl = document.getElementById('ut_velCustom');
      const metalAntes = metalSel.value, velAntes = velEl.value;
      metalSel.value = 'otro'; velEl.value = '-5';
      utUpdate();
      const vTexto = document.getElementById('ut_mVelocidad').textContent;
      metalSel.value = metalAntes; velEl.value = velAntes; utUpdate();
      if (vTexto !== '—') return { ok: false, msg: `con v=-5 personalizado sigue mostrando "${vTexto}" en vez de "—"` };
      return { ok: true, msg: 'velocidad negativa personalizada ahora muestra "—" ✓' };
    }
  },
  {
    id: 'fix85_radiografia_hvl_negativo_invalido', group: 'Correcciones QA v6.22',
    name: 'FIX #85 — Radiografía: HVL personalizado negativo ya no propaga NaN al color de la mancha',
    run: () => {
      mecSwitchGroup('dureza'); dzSwitch('radiografia');
      const matSel = document.getElementById('rx_material'), hvlEl = document.getElementById('rx_hvlCustom');
      const matAntes = matSel.value, hvlAntes = hvlEl.value, perdidaAntes = document.getElementById('rx_perdida').value;
      matSel.value = 'otro'; hvlEl.value = '-10'; document.getElementById('rx_perdida').value = '6';
      rxUpdate();
      const mu = document.getElementById('rx_mMu').textContent;
      matSel.value = matAntes; hvlEl.value = hvlAntes; document.getElementById('rx_perdida').value = perdidaAntes; rxUpdate();
      if (mu !== '—') return { ok: false, msg: `con HVL=-10 personalizado, μ sigue mostrando "${mu}" en vez de "—"` };
      return { ok: true, msg: 'HVL negativo personalizado ahora da μ="—" (y ya no llega NaN al canvas) ✓' };
    }
  },
  {
    id: 'fix86_progreso_avisa_guardado_fallido', group: 'Correcciones QA v6.22',
    name: 'FIX #86 — Mi Progreso: un fallo de guardado ahora muestra un aviso visible la próxima vez que se abre el modal',
    run: () => {
      const antes = PROG_GUARDADO_FALLO;
      const originalSetItem = Storage.prototype.setItem;
      Storage.prototype.setItem = function(k,v){ if(k===PROGRESO_KEY) throw new Error('QuotaExceededError simulado'); return originalSetItem.call(this,k,v); };
      progGuardar();
      Storage.prototype.setItem = originalSetItem;
      const banderaQuedoTrue = PROG_GUARDADO_FALLO === true;
      renderProgresoBody();
      const tieneAviso = /No se pudo guardar el progreso/.test(document.getElementById('progresoBody').innerHTML);
      PROG_GUARDADO_FALLO = antes; renderProgresoBody();
      if (!banderaQuedoTrue) return { ok: false, msg: 'PROG_GUARDADO_FALLO no quedó en true tras el fallo simulado' };
      if (!tieneAviso) return { ok: false, msg: 'el modal no muestra el aviso de guardado fallido' };
      return { ok: true, msg: 'fallo de guardado ahora es visible para el alumno ✓' };
    }
  },
  {
    id: 'fix87_compartir_rockwell_sobrevive_reproduccion', group: 'Correcciones QA v6.22',
    name: 'FIX #87 — Compartir enlace: restaurar un enlace de Rockwell con material ya no lo borra al reproducir el tipo',
    run: () => {
      mecSwitchGroup('dureza'); dzSwitch('rockwell');
      const matEl = document.getElementById('dz_rkMat'), typeEl = document.getElementById('dz_rkType');
      const matAntes = matEl.value, typeAntes = typeEl.value;
      matEl.value = 'acero'; dzApplyRockwellMaterial();
      typeEl.value = 'normal';
      typeEl.dispatchEvent(new Event('change'));
      const matTrasReproducir = matEl.value;
      matEl.value = matAntes; typeEl.value = typeAntes; dzRenderRkTable();
      if (matTrasReproducir !== 'acero') return { ok: false, msg: `el material quedó en "${matTrasReproducir}" en vez de "acero" tras reproducir el tipo` };
      return { ok: true, msg: 'el material sobrevive a la reproducción del enlace compartido ✓' };
    }
  },
  {
    id: 'fix87_rockwell_cambio_manual_sigue_limpiando', group: 'Correcciones QA v6.22',
    name: 'FIX #87 — Compartir enlace: un cambio de tipo MANUAL genuino (a una escala incompatible) sigue limpiando el material, como antes',
    run: () => {
      mecSwitchGroup('dureza'); dzSwitch('rockwell');
      const matEl = document.getElementById('dz_rkMat'), typeEl = document.getElementById('dz_rkType');
      const matAntes = matEl.value, typeAntes = typeEl.value;
      matEl.value = 'acero'; dzApplyRockwellMaterial();
      typeEl.value = 'superficial';
      dzOnTypeChange();
      const matTrasCambio = matEl.value;
      matEl.value = matAntes; typeEl.value = typeAntes; dzRenderRkTable();
      if (matTrasCambio !== '') return { ok: false, msg: `el material debería limpiarse (escala B no es superficial) pero quedó en "${matTrasCambio}"` };
      return { ok: true, msg: 'un cambio de tipo manual incompatible sigue limpiando el material ✓' };
    }
  },
  {
    id: 'fix88_grid_responsive_en_5_paneles_nuevos', group: 'Correcciones QA v6.22',
    name: 'FIX #88 — Responsive: los 5 paneles con estructura de 2 chart-card (Janka, Esclerómetro, Radiografía, Líquidos, Partículas) ahora tienen la regla de grid ≥980px',
    run: () => {
      const ids = ['dz_panel_janka','dz_panel_esclero','dz_panel_radiografia','dz_panel_liquidos','dz_panel_particulas'];
      const faltantes = [];
      for (const sheet of document.styleSheets) {
        try {
          for (const r of sheet.cssRules) {
            if (r.media && [...r.media].some(m=>/980px/.test(m))) {
              for (const inner of r.cssRules) {
                for (let i=ids.length-1;i>=0;i--) if (inner.selectorText && inner.selectorText.includes('#'+ids[i])) ids.splice(i,1);
              }
            }
          }
        } catch(e) { /* hoja de estilo de otro origen, ignorar */ }
      }
      if (ids.length) return { ok: false, msg: `sin regla de grid ≥980px: ${ids.join(', ')}` };
      return { ok: true, msg: 'los 5 paneles tienen su regla de grid ✓' };
    }
  },
  {
    id: 'fix89_sw_valida_res_ok_antes_de_cachear', group: 'Correcciones QA v6.22',
    name: 'FIX #89 — Service worker: los 3 lugares que hacen cache.put() ahora validan res.ok/fresh.ok antes de guardar',
    run: () => {
      return fetch('./sw.js').then(r => r.text()).then(txt => {
        const puts = [...txt.matchAll(/cache\.put\(/g)];
        const sinChequeo = puts.filter(m => {
          const idx = m.index;
          const contexto = txt.slice(Math.max(0, idx-150), idx);
          return !/\.ok\)/.test(contexto);
        });
        if (sinChequeo.length) return { ok: false, msg: `${sinChequeo.length} de ${puts.length} cache.put() sin chequeo de .ok cerca` };
        return { ok: true, msg: `los ${puts.length} cache.put() están guardados detrás de un chequeo .ok ✓` };
      }).catch(() => ({ warn: true, msg: 'no se pudo leer sw.js (¿corriendo sin servidor HTTP?)' }));
    }
  },
];

function runAllTests() {
  const panel = document.getElementById('testPanel');
  if (panel) panel.style.display = 'block';
  const body = document.getElementById('testPanelBody');
  if (body) body.classList.add('open');
  const icon = document.getElementById('tpToggleIcon');
  if (icon) icon.textContent = '▲';

  const grid   = document.getElementById('testGrid');
  const log    = document.getElementById('testLog');
  const summary= document.getElementById('testSummary');
  const badge  = document.getElementById('tpBadge');
  
  let passed = 0, failed = 0, warned = 0;
  const logLines = [];
  grid.innerHTML = '';
  log.innerHTML  = '';
  summary.innerHTML = '';

  for (const test of testSuite) {
    let result;
    try {
      result = test.run();
    } catch(e) {
      result = { ok: false, msg: `Error: ${e.message}` };
    }

    const status = result.ok ? 'pass' : (result.warn ? 'warn' : 'fail');
    if (status === 'pass') passed++;
    else if (status === 'fail') failed++;
    else warned++;

    // Card
    const card = document.createElement('div');
    card.className = 'test-card';
    card.innerHTML = `<div class="tc-name">${test.group}</div>
      <div class="tc-val">${test.name}</div>
      <div class="tc-status tc-${status}">${status === 'pass' ? '✓ OK' : status === 'warn' ? '⚠ WARN' : '✗ FAIL'}</div>
      <div style="font-size:10px;color:var(--muted);margin-top:2px">${result.msg}</div>`;
    grid.appendChild(card);

    // Log
    const cls = status === 'pass' ? 'tl-pass' : status === 'warn' ? 'tl-warn' : 'tl-fail';
    const icon_char = status === 'pass' ? '✓' : status === 'warn' ? '⚠' : '✗';
    logLines.push(`<span class="${cls}">[${icon_char}] ${test.name}: ${result.msg}</span>`);
  }

  log.innerHTML = logLines.join('\n');

  const total = passed + failed + warned;
  const pct = Math.round(passed / total * 100);
  
  summary.innerHTML = `
    <span class="ts-item" style="color:#1a8c5e">✓ ${passed} OK</span>
    ${warned ? `<span class="ts-item" style="color:#c8780a">⚠ ${warned} WARN</span>` : ''}
    ${failed ? `<span class="ts-item" style="color:#c43535">✗ ${failed} FAIL</span>` : ''}
    <span class="ts-item" style="color:var(--muted)">— ${total} total, ${pct}% OK</span>`;

  badge.textContent = `${passed}/${total}`;
  badge.style.background = failed > 0 ? 'rgba(196,53,53,.12)' : warned > 0 ? 'rgba(200,120,10,.12)' : 'rgba(26,140,94,.12)';
  badge.style.color = failed > 0 ? '#c43535' : warned > 0 ? '#c8780a' : '#1a8c5e';

  log.scrollTop = 0;
}

/* FIX #9: antes la suite de tests corría automáticamente 800ms después de
   cargar la página, para CUALQUIERA que abriera el simulador -- aunque el
   panel estuviera oculto, la suite igual se ejecutaba entera en segundo
   plano sin ningún motivo (gasta recursos del alumno para nada, ya que
   nadie ve el resultado). Ahora los tests solo corren cuando se abre el
   panel (ver toggleTestPanelFromHeader más abajo), que a su vez solo es
   alcanzable en modo desarrollador (5 clicks en el número de versión). */

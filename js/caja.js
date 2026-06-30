// ============================================================
// caja.js — Caja del día (recepción y negocio)
// ============================================================
// Dashboard de caja: estadísticas por método (con color), detalle
// profesional × método (click → modal del profesional), panel lateral
// con acciones rápidas, dona de métodos y resumen del día; gastos y
// retiros; "efectivo en caja" calculado.
//
// "Contar billetes" es una herramienta (calculadora) para contar un
// retiro y plasmarlo en Retiros. No es el arqueo.
//
// Cargan recepción y negocio. El profesional no ve este módulo.
// ============================================================

const _CJ_DENOMS = [20000, 10000, 5000, 2000, 1000, 500, 200, 100];

const _CJ_ICOS = {
  efectivo: '<rect width="20" height="12" x="2" y="6" rx="2"/><circle cx="12" cy="12" r="2"/><path d="M6 12h.01"/><path d="M18 12h.01"/>',
  tarjeta: '<rect width="20" height="14" x="2" y="5" rx="2"/><line x1="2" x2="22" y1="10" y2="10"/>',
  transferencia: '<line x1="3" x2="21" y1="22" y2="22"/><line x1="6" x2="6" y1="18" y2="11"/><line x1="10" x2="10" y1="18" y2="11"/><line x1="14" x2="14" y1="18" y2="11"/><line x1="18" x2="18" y1="18" y2="11"/><polygon points="12 2 20 7 4 7"/>',
  qr: '<rect width="7" height="7" x="3" y="3" rx="1"/><rect width="7" height="7" x="14" y="3" rx="1"/><rect width="7" height="7" x="3" y="14" rx="1"/><path d="M14 14h3v3h-3z"/><path d="M20 14v7"/><path d="M14 21h7"/>',
  mercadopago: '<rect width="18" height="13" x="3" y="6" rx="2"/><path d="M3 11h18"/><circle cx="16.5" cy="14.5" r="1.5"/>',
  generico: '<path d="M9 17H7A5 5 0 0 1 7 7h2"/><path d="M15 7h2a5 5 0 1 1 0 10h-2"/><line x1="8" x2="16" y1="12" y2="12"/>'
};
function _cjIco(slug, w = 18) {
  const p = _CJ_ICOS[slug] || _CJ_ICOS.generico;
  return `<svg viewBox="0 0 24 24" width="${w}" height="${w}" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${p}</svg>`;
}
function _cjColorMetodo(slug) {
  const map = {
    efectivo:      { bg: '#e9f9f0', fg: '#1f9d57' },
    tarjeta:       { bg: '#efeafe', fg: '#6D5BD0' },
    qr:            { bg: '#fdf0e1', fg: '#d4881c' },
    transferencia: { bg: '#e6f0fb', fg: '#2b7cc4' },
    mercadopago:   { bg: '#e3f5fb', fg: '#1593b8' },
    generico:      { bg: '#f2f1f7', fg: '#6b6880' }
  };
  return map[slug] || map.generico;
}
function _cjAvatar(nombre) {
  const parts = String(nombre || '').replace(',', ' ').split(/\s+/).filter(Boolean);
  const ini = ((parts[0]?.[0] || '') + (parts[1]?.[0] || '')).toUpperCase() || '?';
  const palette = [
    ['#efeafe', '#6D5BD0'], ['#e6f7ee', '#1f9d57'], ['#e3f5fb', '#1593b8'],
    ['#fdf0e1', '#d4881c'], ['#fbeaf0', '#c44d77'], ['#e6f0fb', '#2b7cc4']
  ];
  let h = 0; for (const c of String(nombre || '')) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  const [bg, fg] = palette[h % palette.length];
  return { ini, bg, fg };
}
function _cjEsc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
function _cjFechaISO(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function _cjFechaLarga(iso) {
  const d = new Date(iso + 'T00:00:00');
  let s = d.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' });
  return s.charAt(0).toUpperCase() + s.slice(1);
}
function _cjParse(v) {
  if (typeof v === 'number') return v;
  const raw = String(v == null ? '' : v).replace(/[^\d]/g, '');
  return raw === '' ? 0 : parseInt(raw, 10);
}

// --- Campo de dinero: signo $ fijo + miles automáticos, sin flechas ---
function _cjMoney(id, valor, extra) {
  const v = valor ? Number(valor).toLocaleString('es-AR') : '';
  return `<div class="cj-money">
    <span class="cj-money-sign">$</span>
    <input type="text" inputmode="numeric" id="${id}" class="cj-money-in" value="${v}" oninput="_cjMoneyFmt(this)" ${extra || ''}>
  </div>`;
}
function _cjMoneyFmt(inp) {
  const raw = inp.value.replace(/[^\d]/g, '');
  inp.value = raw === '' ? '' : Number(raw).toLocaleString('es-AR');
}
function _cjMoneyVal(id) { const e = document.getElementById(id); return e ? _cjParse(e.value) : 0; }

// ------------------------------------------------------------
// Shell + carga
// ------------------------------------------------------------
async function renderCaja(cont) {
  if (!['negocio', 'recepcion'].includes(usuarioActual.rol)) {
    cont.innerHTML = '<div class="vacio">No tenés acceso a este módulo</div>';
    return;
  }
  cont.innerHTML = `
    <style>
      .caja-wrap{padding:22px 26px;max-width:1280px;margin:0 auto;color:#2b2b3a;}
      .cj-loading{padding:40px;text-align:center;color:#8a8f9c;}
      .cj-head{display:flex;justify-content:space-between;align-items:flex-start;gap:16px;flex-wrap:wrap;margin-bottom:24px;}
      .cj-titulo{font-size:24px;font-weight:700;}
      .cj-bc{font-size:13px;color:#a7abb6;margin-top:3px;}
      .cj-bc a{color:#a7abb6;cursor:pointer;text-decoration:none;}
      .cj-bc a:hover{color:#6D5BD0;}
      .cj-head-act{display:flex;align-items:center;gap:10px;flex-wrap:wrap;}
      .cj-btn-tool{display:flex;align-items:center;gap:7px;background:#fff;border:1px solid #c9c2e8;color:#6D5BD0;border-radius:10px;padding:9px 14px;font-size:13px;font-weight:600;cursor:pointer;}
      .cj-btn-tool:hover{background:#faf9fe;}
      .cj-dia{display:flex;align-items:center;gap:6px;}
      .cj-dia-nav{width:34px;height:34px;border:1px solid #e6e3f2;background:#fff;border-radius:9px;cursor:pointer;color:#6D5BD0;display:flex;align-items:center;justify-content:center;font-size:18px;}
      .cj-dia-nav:hover{background:#f6f5fb;}
      .cj-dia-lbl{font-size:14px;font-weight:600;min-width:150px;text-align:center;}
      .cj-saldo{display:flex;align-items:center;gap:9px;background:#fff;border:1px solid #ece9f7;border-radius:11px;padding:7px 11px;}
      .cj-saldo label{font-size:13px;color:#8a8f9c;}
      .cj-money{display:inline-flex;align-items:center;border:1px solid #e6e3f2;border-radius:9px;overflow:hidden;background:#fff;}
      .cj-money:focus-within{border-color:#6D5BD0;}
      .cj-money-sign{padding:0 3px 0 11px;color:#9398a6;font-weight:600;}
      .cj-money-in{border:none;outline:none;padding:8px 11px 8px 4px;font-size:14px;text-align:right;width:110px;background:transparent;}
      .cj-money.full{width:100%;}
      .cj-money.full .cj-money-in{flex:1;width:auto;}

      .cj-page{display:grid;grid-template-columns:minmax(0,1fr) 300px;gap:24px;align-items:start;}
      .cj-main{min-width:0;}
      .cj-side{display:flex;flex-direction:column;gap:18px;}

      .cj-sec-lbl{font-size:14px;color:#6b6880;margin:0 0 13px;display:flex;align-items:center;gap:7px;font-weight:600;}
      .cj-mapa{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:13px;margin-bottom:34px;}
      .cj-mcard{border:1px solid transparent;border-radius:13px;padding:14px 16px;}
      .cj-mcard-top{display:flex;align-items:center;gap:8px;font-size:13px;}
      .cj-mcard-ico{display:flex;}
      .cj-mcard-val{font-size:20px;font-weight:700;margin-top:6px;}
      .cj-mcard-ops{font-size:12px;margin-top:1px;}

      .cj-tabla-wrap{border:1px solid #ece9f7;border-radius:13px;overflow:auto;margin-bottom:34px;background:#fff;}
      .cj-tabla{width:100%;border-collapse:collapse;font-size:13.5px;min-width:560px;}
      .cj-tabla th{background:#faf9fe;font-weight:600;color:#6b6880;padding:11px 12px;text-align:right;white-space:nowrap;}
      .cj-tabla th.l{text-align:left;}
      .cj-td-prof{padding:11px 12px;font-weight:600;color:#2b2b3a;white-space:nowrap;}
      .cj-td-num{padding:11px 12px;text-align:right;white-space:nowrap;}
      .cj-td-tot{padding:11px 12px;text-align:right;font-weight:700;white-space:nowrap;}
      .cj-td-ch{padding:11px 8px;text-align:center;color:#c3c0d4;width:26px;}
      .cj-cero{color:#cfccdd;}
      .cj-tr{cursor:pointer;border-top:1px solid #f1eefb;}
      .cj-tr:hover{background:#faf9fe;}
      .cj-tr-tot{border-top:2px solid #ece9f7;background:#faf9fe;}
      .cj-tr-tot td{font-weight:700;padding:12px;}
      .cj-tabla-vacia{padding:26px;text-align:center;color:#a7abb6;font-size:13px;}

      .cj-cols{display:grid;grid-template-columns:1fr 1fr;gap:18px;margin-bottom:34px;}
      .cj-card{background:#fff;border:1px solid #ece9f7;border-radius:14px;padding:15px 17px;}
      .cj-card-head{display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;}
      .cj-card-tit{font-weight:700;display:flex;align-items:center;gap:8px;color:#2b2b3a;}
      .cj-card-tit svg{color:#8a8f9c;}
      .cj-add{background:#6D5BD0;color:#fff;border:none;border-radius:9px;padding:7px 13px;font-size:13px;font-weight:600;cursor:pointer;}
      .cj-add:hover{background:#5d4cc0;}
      .cj-mov{display:flex;justify-content:space-between;align-items:center;padding:9px 0;border-top:1px solid #f1eefb;font-size:14px;}
      .cj-mov-con{color:#2b2b3a;}
      .cj-mov-met{color:#a7abb6;font-size:12px;}
      .cj-mov-r{display:flex;align-items:center;gap:12px;}
      .cj-mov-monto{font-weight:600;}
      .cj-mov-x{border:none;background:#f6f5fb;color:#9398a6;width:28px;height:28px;border-radius:7px;cursor:pointer;font-size:15px;}
      .cj-mov-x:hover{background:#ffe1e1;color:#d35;}
      .cj-vacio{padding:14px 0;color:#b3b7c0;font-size:13px;border-top:1px solid #f1eefb;}
      .cj-hint{font-size:12px;color:#a7abb6;margin-top:9px;}

      .cj-cierre{background:#fff;border:1px solid #ece9f7;border-radius:14px;padding:18px 20px;display:grid;grid-template-columns:1fr 230px;gap:24px;align-items:center;}
      .cj-cierre-row{display:flex;justify-content:space-between;align-items:center;padding:9px 0;font-size:14px;}
      .cj-cierre-row.sep{border-top:1px solid #f1eefb;}
      .cj-cierre-row .lbl{color:#6b6880;}
      .cj-cierre-card{background:#e9f9f0;border-radius:13px;padding:18px 20px;}
      .cj-cierre-card .l{font-size:13px;color:#1f9d57;display:flex;align-items:center;gap:7px;font-weight:600;}
      .cj-cierre-card .v{font-size:26px;font-weight:800;color:#1f9d57;margin-top:8px;}

      .cj-panel{background:#fff;border:1px solid #ece9f7;border-radius:14px;padding:16px 17px;}
      .cj-panel-tit{font-weight:700;font-size:14px;margin-bottom:13px;color:#2b2b3a;}
      .cj-qa{display:flex;align-items:center;gap:11px;width:100%;background:none;border:none;padding:9px 6px;border-radius:9px;cursor:pointer;text-align:left;}
      .cj-qa:hover{background:#f6f5fb;}
      .cj-qa-ico{width:34px;height:34px;border-radius:9px;background:#efeafe;color:#6D5BD0;display:flex;align-items:center;justify-content:center;flex:none;}
      .cj-qa-txt b{display:block;font-size:13.5px;color:#2b2b3a;font-weight:600;}
      .cj-qa-txt small{font-size:12px;color:#9398a6;}
      .cj-donut{width:150px;height:150px;border-radius:50%;margin:2px auto 16px;position:relative;}
      .cj-donut-hole{position:absolute;inset:22px;background:#fff;border-radius:50%;display:flex;flex-direction:column;align-items:center;justify-content:center;}
      .cj-donut-val{font-weight:800;font-size:16px;color:#2b2b3a;}
      .cj-donut-lbl{font-size:11px;color:#9398a6;}
      .cj-leg-row{display:flex;align-items:center;gap:8px;font-size:13px;padding:4px 0;}
      .cj-leg-dot{width:9px;height:9px;border-radius:50%;flex:none;}
      .cj-leg-nom{flex:1;color:#4a4a58;}
      .cj-leg-pct{color:#8a8f9c;}
      .cj-donut-empty{text-align:center;color:#a7abb6;font-size:12px;}
      .cj-rs{display:flex;align-items:center;gap:11px;padding:10px 0;}
      .cj-rs+.cj-rs{border-top:1px solid #f1eefb;}
      .cj-rs-ico{width:34px;height:34px;border-radius:9px;background:#f2f1f7;color:#6b6880;display:flex;align-items:center;justify-content:center;flex:none;}
      .cj-rs-num{font-weight:800;font-size:18px;color:#2b2b3a;line-height:1;}
      .cj-rs-lbl{font-size:12px;color:#9398a6;margin-top:2px;}

      @media (max-width:1080px){ .cj-page{grid-template-columns:1fr;} }
      @media (max-width:720px){ .cj-cols,.cj-cierre{grid-template-columns:1fr;} }
    </style>
    <div class="caja-wrap" id="caja-wrap"><div class="cj-loading">Cargando caja…</div></div>`;

  await cajaCargar(_cjFechaISO(new Date()));
}

async function cajaCargar(fechaStr) {
  const neg = usuarioActual.negocio_id;
  const desde = new Date(fechaStr + 'T00:00:00');
  const hasta = new Date(desde); hasta.setDate(hasta.getDate() + 1);

  const [diaR, movR, metR, pagosR] = await Promise.all([
    sb.from('caja_dia').select('*').eq('negocio_id', neg).eq('fecha', fechaStr).maybeSingle(),
    sb.from('caja_movimientos').select('*').eq('negocio_id', neg).eq('fecha', fechaStr).order('creado_en'),
    sb.from('metodos_pago').select('id, nombre, icono, afecta_caja').eq('negocio_id', neg).order('orden').order('creado_en'),
    sb.from('cobro_pagos').select('cobro_id, metodo_id, metodo_nombre, monto').eq('negocio_id', neg)
      .gte('creado_en', desde.toISOString()).lt('creado_en', hasta.toISOString())
  ]);

  const pagos = pagosR.data || [];
  const cobroIds = [...new Set(pagos.map(p => p.cobro_id).filter(Boolean))];
  let cobros = [], turnos = [];
  if (cobroIds.length) {
    const cR = await sb.from('cobros').select('id, turno_id, total').in('id', cobroIds);
    cobros = cR.data || [];
    const turnoIds = [...new Set(cobros.map(c => c.turno_id).filter(Boolean))];
    if (turnoIds.length) {
      const tR = await sb.from('turnos')
        .select('id, profesional_id, profesionales(nombre), pacientes(nombre, apellido)')
        .in('id', turnoIds);
      turnos = tR.data || [];
    }
  }

  const turnoById = {};
  turnos.forEach(t => {
    const ap = t.pacientes?.apellido || '', no = t.pacientes?.nombre || '';
    const pac = `${ap}${ap && no ? ', ' : ''}${no}`.trim() || '—';
    turnoById[t.id] = { profId: t.profesional_id || '_sin', profNombre: t.profesionales?.nombre || 'Sin asignar', pacienteNombre: pac };
  });
  const cobroById = {};
  cobros.forEach(c => { cobroById[c.id] = { turnoId: c.turno_id, total: Number(c.total) || 0 }; });

  const metodos = metR.data || [];
  const efIds = new Set(), efNames = new Set();
  metodos.forEach(m => { if (m.afecta_caja) { efIds.add(m.id); efNames.add((m.nombre || '').toLowerCase()); } });

  const mapa = {};
  metodos.forEach(m => { mapa[m.nombre] = { nombre: m.nombre, icono: m.icono || 'generico', count: 0, monto: 0 }; });
  const cols = metodos.map(m => m.nombre);
  const matriz = {};
  const pagosPorCobro = {};
  let totalCobrado = 0, totalOps = 0, efectivoCobrado = 0;

  pagos.forEach(p => {
    const monto = Number(p.monto) || 0;
    const k = p.metodo_nombre || 'Otro';
    if (!mapa[k]) mapa[k] = { nombre: k, icono: 'generico', count: 0, monto: 0 };
    if (!cols.includes(k)) cols.push(k);
    mapa[k].count++; mapa[k].monto += monto; totalCobrado += monto; totalOps++;
    if ((p.metodo_id && efIds.has(p.metodo_id)) || efNames.has((p.metodo_nombre || '').toLowerCase())) efectivoCobrado += monto;

    const cob = cobroById[p.cobro_id];
    const tur = cob ? turnoById[cob.turnoId] : null;
    const profId = tur ? tur.profId : '_sin';
    const profNombre = tur ? tur.profNombre : 'Sin asignar';
    if (!matriz[profId]) matriz[profId] = { nombre: profNombre, porMetodo: {}, total: 0 };
    matriz[profId].porMetodo[k] = (matriz[profId].porMetodo[k] || 0) + monto;
    matriz[profId].total += monto;

    (pagosPorCobro[p.cobro_id] = pagosPorCobro[p.cobro_id] || []).push({ metodo: k, monto });
  });

  const cobrosArr = cobros.map(c => {
    const tur = turnoById[c.turno_id] || {};
    return {
      cobroId: c.id, turnoId: c.turno_id,
      profId: tur.profId || '_sin', profNombre: tur.profNombre || 'Sin asignar',
      pacienteNombre: tur.pacienteNombre || '—', total: Number(c.total) || 0,
      pagos: pagosPorCobro[c.id] || []
    };
  });

  const profArr = Object.entries(matriz).sort((a, b) => a[1].nombre.localeCompare(b[1].nombre));
  const dia = diaR.data || { saldo_anterior: 0, _nuevo: true };

  window._caja = {
    fecha: fechaStr, dia, movimientos: movR.data || [], metodos, efNames,
    mapa, cols, matriz, profArr, cobrosArr,
    totalCobrado, totalOps, efectivoCobrado,
    pacientes: cobrosArr.length, profesionales: profArr.length
  };
  cajaRender();
}

function _cjDonut(st) {
  const segs = Object.values(st.mapa).filter(m => m.monto > 0).sort((a, b) => b.monto - a.monto);
  const total = st.totalCobrado;
  if (!total || !segs.length) {
    return `<div class="cj-donut" style="background:#ece9f7;"><div class="cj-donut-hole"><div class="cj-donut-val">${formatearPrecio(0)}</div><div class="cj-donut-lbl">Total cobrado</div></div></div><div class="cj-donut-empty">Sin cobros todavía</div>`;
  }
  let acc = 0; const stops = [];
  segs.forEach((m, i) => {
    const pct = m.monto / total * 100;
    const end = i === segs.length - 1 ? 100 : acc + pct;
    stops.push(`${_cjColorMetodo(m.icono).fg} ${acc.toFixed(3)}% ${end.toFixed(3)}%`);
    acc = end;
  });
  const leg = segs.map(m => `<div class="cj-leg-row"><span class="cj-leg-dot" style="background:${_cjColorMetodo(m.icono).fg}"></span><span class="cj-leg-nom">${_cjEsc(m.nombre)}</span><span class="cj-leg-pct">${(m.monto / total * 100).toFixed(1)}%</span></div>`).join('');
  return `<div class="cj-donut" style="background:conic-gradient(${stops.join(',')})"><div class="cj-donut-hole"><div class="cj-donut-val">${formatearPrecio(total)}</div><div class="cj-donut-lbl">Total cobrado</div></div></div>${leg}`;
}

function cajaRender() {
  const st = window._caja;
  const wrap = document.getElementById('caja-wrap');
  if (!wrap) return;

  const mapIco = '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>';
  const tablaIco = '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M3 9h18"/><path d="M3 15h18"/><path d="M12 3v18"/></svg>';
  const cashIco = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect width="20" height="12" x="2" y="6" rx="2"/><circle cx="12" cy="12" r="2"/><path d="M6 12h.01M18 12h.01"/></svg>';

  // estadísticas
  const totalCol = { bg: '#efeafe', fg: '#6D5BD0' };
  let mapaCards = Object.values(st.mapa).map(m => {
    const c = _cjColorMetodo(m.icono);
    return `<div class="cj-mcard" style="background:${c.bg};">
      <div class="cj-mcard-top" style="color:${c.fg};"><span class="cj-mcard-ico">${_cjIco(m.icono, 17)}</span> ${_cjEsc(m.nombre)}</div>
      <div class="cj-mcard-val" style="color:${c.fg};">${formatearPrecio(m.monto)}</div>
      <div class="cj-mcard-ops" style="color:${c.fg};opacity:.72;">${m.count} ${m.count === 1 ? 'operación' : 'operaciones'}</div>
    </div>`;
  }).join('');
  mapaCards += `<div class="cj-mcard" style="background:${totalCol.bg};">
      <div class="cj-mcard-top" style="color:${totalCol.fg};">Total cobrado</div>
      <div class="cj-mcard-val" style="color:${totalCol.fg};">${formatearPrecio(st.totalCobrado)}</div>
      <div class="cj-mcard-ops" style="color:${totalCol.fg};opacity:.72;">${st.totalOps} ${st.totalOps === 1 ? 'operación' : 'operaciones'}</div>
    </div>`;

  // matriz
  let tabla;
  if (!st.profArr.length) {
    tabla = '<div class="cj-tabla-wrap"><div class="cj-tabla-vacia">Todavía no hay cobros registrados en este día.</div></div>';
  } else {
    const head = `<tr><th class="l">Profesional</th>${st.cols.map(c => `<th>${_cjEsc(c)}</th>`).join('')}<th>Total</th><th></th></tr>`;
    const totByCol = {}; st.cols.forEach(c => totByCol[c] = 0); let granTotal = 0;
    const rows = st.profArr.map(([pid, p]) => {
      const tds = st.cols.map(c => {
        totByCol[c] += (p.porMetodo[c] || 0);
        return `<td class="cj-td-num">${p.porMetodo[c] ? formatearPrecio(p.porMetodo[c]) : '<span class="cj-cero">—</span>'}</td>`;
      }).join('');
      granTotal += p.total;
      return `<tr class="cj-tr" onclick="cajaVerProfesional('${pid}')"><td class="cj-td-prof">${_cjEsc(p.nombre)}</td>${tds}<td class="cj-td-tot">${formatearPrecio(p.total)}</td><td class="cj-td-ch">›</td></tr>`;
    }).join('');
    const totRow = `<tr class="cj-tr-tot"><td>Total</td>${st.cols.map(c => `<td class="cj-td-num">${formatearPrecio(totByCol[c])}</td>`).join('')}<td class="cj-td-num">${formatearPrecio(granTotal)}</td><td></td></tr>`;
    tabla = `<div class="cj-tabla-wrap"><table class="cj-tabla"><thead>${head}</thead><tbody>${rows}${totRow}</tbody></table></div>`;
  }

  // gastos / retiros
  const gastos = st.movimientos.filter(m => m.tipo === 'gasto');
  const retiros = st.movimientos.filter(m => m.tipo === 'retiro');
  const filaMov = (m, mostrarMet) => `
    <div class="cj-mov">
      <div><span class="cj-mov-con">${_cjEsc(m.concepto || '(sin concepto)')}</span>${mostrarMet && m.metodo ? ` · <span class="cj-mov-met">${_cjEsc(m.metodo)}</span>` : ''}</div>
      <div class="cj-mov-r"><span class="cj-mov-monto">${formatearPrecio(m.monto)}</span><button class="cj-mov-x" title="Quitar" onclick="cajaBorrarMov('${m.id}')">&times;</button></div>
    </div>`;

  // efectivo en caja
  const saldo = Number(st.dia.saldo_anterior) || 0;
  const gastosEf = gastos.filter(m => st.efNames.has((m.metodo || '').toLowerCase())).reduce((s, m) => s + (Number(m.monto) || 0), 0);
  const totRetiros = retiros.reduce((s, m) => s + (Number(m.monto) || 0), 0);
  const efectivoCaja = saldo + st.efectivoCobrado - gastosEf - totRetiros;

  // panel: acciones rápidas
  const qaIco = {
    contar: cashIco,
    gasto: '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z"/><path d="M8 7h8"/><path d="M8 11h8"/></svg>',
    retiro: '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12"/><path d="m7 10 5 5 5-5"/><rect width="18" height="6" x="3" y="17" rx="2"/></svg>',
    hist: '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3v5h5"/><path d="M3.05 13A9 9 0 1 0 6 5.3L3 8"/><path d="M12 7v5l4 2"/></svg>'
  };
  const acciones = `
    <div class="cj-panel">
      <div class="cj-panel-tit">Acciones rápidas</div>
      <button class="cj-qa" onclick="cajaContarBilletes()"><span class="cj-qa-ico">${qaIco.contar}</span><span class="cj-qa-txt"><b>Contar billetes</b><small>Contá y registrá el efectivo</small></span></button>
      <button class="cj-qa" onclick="cajaNuevoMov('gasto')"><span class="cj-qa-ico">${qaIco.gasto}</span><span class="cj-qa-txt"><b>Nuevo gasto</b><small>Agregá un gasto del día</small></span></button>
      <button class="cj-qa" onclick="cajaNuevoMov('retiro')"><span class="cj-qa-ico">${qaIco.retiro}</span><span class="cj-qa-txt"><b>Nuevo retiro</b><small>Registrá un retiro a banco</small></span></button>
      <button class="cj-qa" onclick="cajaHistorial()"><span class="cj-qa-ico">${qaIco.hist}</span><span class="cj-qa-txt"><b>Historial de caja</b><small>Otros días cargados</small></span></button>
    </div>`;

  // panel: dona
  const donut = `
    <div class="cj-panel">
      <div class="cj-panel-tit">Métodos de pago</div>
      ${_cjDonut(st)}
    </div>`;

  // panel: resumen del día
  const rsIco = {
    op: '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M16 3h5v5"/><path d="M8 3H3v5"/><path d="M21 3l-7 7"/><path d="M3 21l7-7"/><path d="M16 21h5v-5"/><path d="M8 21H3v-5"/></svg>',
    pac: '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/></svg>',
    prof: '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M16 18a4 4 0 0 0-8 0"/><circle cx="12" cy="11" r="3"/><rect width="18" height="18" x="3" y="3" rx="2"/></svg>'
  };
  const resumen = `
    <div class="cj-panel">
      <div class="cj-panel-tit">Resumen del día</div>
      <div class="cj-rs"><span class="cj-rs-ico">${rsIco.op}</span><div><div class="cj-rs-num">${st.totalOps}</div><div class="cj-rs-lbl">Operaciones realizadas</div></div></div>
      <div class="cj-rs"><span class="cj-rs-ico">${rsIco.pac}</span><div><div class="cj-rs-num">${st.pacientes}</div><div class="cj-rs-lbl">Pacientes atendidos</div></div></div>
      <div class="cj-rs"><span class="cj-rs-ico">${rsIco.prof}</span><div><div class="cj-rs-num">${st.profesionales}</div><div class="cj-rs-lbl">${st.profesionales === 1 ? 'Profesional' : 'Profesionales'}</div></div></div>
    </div>`;

  wrap.innerHTML = `
    <div class="cj-head">
      <div>
        <div class="cj-titulo">Caja</div>
        <div class="cj-bc"><a onclick="navegar('dashboard')">Inicio</a> / Caja</div>
      </div>
      <div class="cj-head-act">
        <button class="cj-btn-tool" onclick="cajaContarBilletes()">${cashIco} Contar billetes</button>
        <div class="cj-dia">
          <button class="cj-dia-nav" title="Día anterior" onclick="cajaCambiarDia(-1)">‹</button>
          <span class="cj-dia-lbl">${_cjFechaLarga(st.fecha)}</span>
          <button class="cj-dia-nav" title="Día siguiente" onclick="cajaCambiarDia(1)">›</button>
        </div>
        <div class="cj-saldo">
          <label>Saldo anterior</label>
          ${_cjMoney('cj-saldo', saldo, 'onchange="cajaSaldo()"')}
        </div>
      </div>
    </div>

    <div class="cj-page">
      <div class="cj-main">
        <div class="cj-sec-lbl">${mapIco} Operaciones del día</div>
        <div class="cj-mapa">${mapaCards}</div>

        <div class="cj-sec-lbl">${tablaIco} Detalle por profesional y método</div>
        ${tabla}

        <div class="cj-cols">
          <div class="cj-card">
            <div class="cj-card-head">
              <div class="cj-card-tit"><svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z"/><path d="M8 7h8"/><path d="M8 11h8"/></svg> Gastos</div>
              <button class="cj-add" onclick="cajaNuevoMov('gasto')">+ Gasto</button>
            </div>
            ${gastos.length ? gastos.map(m => filaMov(m, true)).join('') : '<div class="cj-vacio">Sin gastos cargados.</div>'}
          </div>
          <div class="cj-card">
            <div class="cj-card-head">
              <div class="cj-card-tit"><svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12"/><path d="m7 10 5 5 5-5"/><rect width="18" height="6" x="3" y="17" rx="2"/></svg> Retiros a banco</div>
              <button class="cj-add" onclick="cajaNuevoMov('retiro')">+ Retiro</button>
            </div>
            ${retiros.length ? retiros.map(m => filaMov(m, false)).join('') : '<div class="cj-vacio">Sin retiros cargados.</div>'}
            <div class="cj-hint">Tip: usá "Contar billetes" para contar un retiro y cargarlo acá.</div>
          </div>
        </div>

        <div class="cj-sec-lbl">${cashIco} Efectivo en caja</div>
        <div class="cj-cierre">
          <div>
            <div class="cj-cierre-row"><span class="lbl">Saldo anterior</span><span>${formatearPrecio(saldo)}</span></div>
            <div class="cj-cierre-row sep"><span class="lbl">Efectivo cobrado</span><span>+ ${formatearPrecio(st.efectivoCobrado)}</span></div>
            <div class="cj-cierre-row sep"><span class="lbl">Gastos en efectivo</span><span>− ${formatearPrecio(gastosEf)}</span></div>
            <div class="cj-cierre-row sep"><span class="lbl">Retiros a banco</span><span>− ${formatearPrecio(totRetiros)}</span></div>
          </div>
          <div class="cj-cierre-card">
            <div class="l">${cashIco} Efectivo en caja</div>
            <div class="v">${formatearPrecio(efectivoCaja)}</div>
          </div>
        </div>
      </div>

      <div class="cj-side">
        ${acciones}
        ${donut}
        ${resumen}
      </div>
    </div>`;
}

// ------------------------------------------------------------
// Día / saldo
// ------------------------------------------------------------
function cajaCambiarDia(delta) {
  const d = new Date(window._caja.fecha + 'T00:00:00');
  d.setDate(d.getDate() + delta);
  cajaCargar(_cjFechaISO(d));
}
function cajaHoy() { cajaCargar(_cjFechaISO(new Date())); }

async function _cjUpsertDia(patch) {
  const base = { negocio_id: usuarioActual.negocio_id, fecha: window._caja.fecha };
  const r = await sb.from('caja_dia').upsert({ ...base, ...patch }, { onConflict: 'negocio_id,fecha' }).select('*').single();
  if (r.error) { mostrarMensaje('No se pudo guardar la caja: ' + r.error.message, 'error'); return null; }
  window._caja.dia = r.data;
  return r.data;
}
async function cajaSaldo() {
  const n = _cjMoneyVal('cj-saldo');
  window._caja.dia.saldo_anterior = n;
  await _cjUpsertDia({ saldo_anterior: n });
  cajaRender();
}

// ------------------------------------------------------------
// Detalle de un profesional (modal)
// ------------------------------------------------------------
async function cajaVerProfesional(profId) {
  const st = window._caja;
  const items = st.cobrosArr.filter(c => c.profId === profId);
  if (!items.length) { mostrarMensaje('Sin cobros para mostrar', 'info'); return; }
  const profNombre = items[0].profNombre;
  const turnoIds = [...new Set(items.map(i => i.turnoId).filter(Boolean))];

  const [atR, prR, catAR, catPR] = await Promise.all([
    sb.from('turno_atenciones').select('turno_id, cantidad, tipo_atencion_id').in('turno_id', turnoIds),
    sb.from('turno_productos').select('turno_id, cantidad, producto_id').in('turno_id', turnoIds),
    sb.from('tipos_atencion').select('id, nombre').eq('negocio_id', usuarioActual.negocio_id),
    sb.from('productos').select('id, nombre').eq('negocio_id', usuarioActual.negocio_id)
  ]);
  const catA = {}; (catAR.data || []).forEach(t => catA[t.id] = t.nombre);
  const catP = {}; (catPR.data || []).forEach(p => catP[p.id] = p.nombre);
  const atPorTurno = {}, prPorTurno = {};
  (atR.data || []).forEach(a => {
    (atPorTurno[a.turno_id] = atPorTurno[a.turno_id] || []).push(`${catA[a.tipo_atencion_id] || 'Atención'}${a.cantidad > 1 ? ' ×' + a.cantidad : ''}`);
  });
  (prR.data || []).forEach(p => {
    (prPorTurno[p.turno_id] = prPorTurno[p.turno_id] || []).push(`${catP[p.producto_id] || 'Producto'}${p.cantidad > 1 ? ' ×' + p.cantidad : ''}`);
  });

  const metIco = {}; st.metodos.forEach(m => { metIco[m.nombre] = m.icono || 'generico'; });

  let totalGen = 0, ops = 0;
  const filas = items.map(it => {
    totalGen += it.total; ops += it.pagos.length;
    const av = _cjAvatar(it.pacienteNombre);
    const at = (atPorTurno[it.turnoId] || []).join(', ') || '—';
    const pr = (prPorTurno[it.turnoId] || []).join(', ') || '—';
    const pagos = (it.pagos.length ? it.pagos : [{ metodo: '—', monto: it.total }]).map(pg => {
      const slug = metIco[pg.metodo] || 'generico';
      const col = _cjColorMetodo(slug);
      return `<div class="cjm-pago"><span class="cjm-pago-ico" style="background:${col.bg};color:${col.fg};">${_cjIco(slug, 14)}</span><span class="cjm-pago-nom">${_cjEsc(pg.metodo)}</span><span class="cjm-pago-monto">${formatearPrecio(pg.monto)}</span></div>`;
    }).join('');
    return `<tr>
      <td><div class="cjm-pac"><span class="cjm-av" style="background:${av.bg};color:${av.fg};">${av.ini}</span><span class="cjm-pac-nom">${_cjEsc(it.pacienteNombre)}</span></div></td>
      <td class="cjm-at">${_cjEsc(at)}</td>
      <td class="cjm-pr">${_cjEsc(pr)}</td>
      <td class="cjm-tot">${formatearPrecio(it.total)}</td>
      <td class="cjm-pagos">${pagos}</td>
    </tr>`;
  }).join('');

  abrirModal(`
    <style>
      .modal{max-width:880px;}
      .cjm-head{padding:20px 24px;}
      .cjm-tit{font-size:19px;font-weight:700;color:#2b2b3a;letter-spacing:-.01em;}
      .cjm-sub{font-size:13px;color:#8a8f9c;margin-top:2px;}
      .cjm-x{border:none;background:#f6f5fb;width:34px;height:34px;border-radius:10px;font-size:19px;color:#9398a6;cursor:pointer;line-height:1;}
      .cjm-x:hover{background:#eee;}
      .cjm-body{padding:8px 14px 6px;max-height:62vh;overflow:auto;}
      .cjm-tabla{width:100%;border-collapse:separate;border-spacing:0;font-size:13.5px;}
      .cjm-tabla th{position:sticky;top:0;background:#faf9fe;color:#8a8f9c;font-weight:600;text-align:left;padding:11px 14px;font-size:12px;text-transform:uppercase;letter-spacing:.03em;z-index:1;}
      .cjm-tabla th.n,.cjm-tot{text-align:right;}
      .cjm-tabla td{padding:14px;border-top:1px solid #f1eefb;vertical-align:middle;}
      .cjm-tabla tbody tr:first-child td{border-top:none;}
      .cjm-pac{display:flex;align-items:center;gap:11px;}
      .cjm-av{width:36px;height:36px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:12px;flex:none;}
      .cjm-pac-nom{font-weight:600;color:#2b2b3a;}
      .cjm-at{color:#4a4a58;}
      .cjm-pr{color:#6b6880;}
      .cjm-tot{font-weight:700;color:#2b2b3a;white-space:nowrap;}
      .cjm-pagos{min-width:190px;}
      .cjm-pago{display:flex;align-items:center;gap:9px;padding:3px 0;}
      .cjm-pago-ico{width:26px;height:26px;border-radius:7px;display:flex;align-items:center;justify-content:center;flex:none;}
      .cjm-pago-nom{color:#3a3a48;flex:1;}
      .cjm-pago-monto{font-weight:600;color:#2b2b3a;white-space:nowrap;}
      .cjm-foot{padding:16px 24px;display:flex;justify-content:space-between;align-items:center;}
      .cjm-foot-tot{display:flex;align-items:center;gap:12px;}
      .cjm-foot-tot .l{font-size:13px;color:#8a8f9c;}
      .cjm-foot-tot .v{font-size:22px;font-weight:800;color:#6D5BD0;}
      .cjm-badge{font-size:12px;font-weight:600;color:#6D5BD0;background:#efeafe;border-radius:999px;padding:4px 12px;}
    </style>
    <div class="modal-header cjm-head">
      <div>
        <div class="cjm-tit">${_cjEsc(profNombre)}</div>
        <div class="cjm-sub">Cobros del día · ${_cjFechaLarga(st.fecha)}</div>
      </div>
      <button class="cjm-x" onclick="cerrarModal()">&times;</button>
    </div>
    <div class="modal-body cjm-body">
      <table class="cjm-tabla">
        <thead><tr><th>Paciente</th><th>Atención</th><th>Productos</th><th class="n">Total</th><th>Pagó con</th></tr></thead>
        <tbody>${filas}</tbody>
      </table>
    </div>
    <div class="modal-footer cjm-foot">
      <div class="cjm-foot-tot"><span class="l">Total cobrado</span><span class="v">${formatearPrecio(totalGen)}</span><span class="cjm-badge">${ops} ${ops === 1 ? 'operación' : 'operaciones'}</span></div>
      <button class="btn" onclick="cerrarModal()">Cerrar</button>
    </div>`);
}

// ------------------------------------------------------------
// Gastos y retiros
// ------------------------------------------------------------
function cajaNuevoMov(tipo, prefillMonto) {
  const st = window._caja;
  const esGasto = tipo === 'gasto';
  const metOpts = st.metodos.map(m => `<option value="${_cjEsc(m.nombre)}">${_cjEsc(m.nombre)}</option>`).join('');
  abrirModal(`
    <style>
      .cjmv-body{padding:20px 24px;display:flex;flex-direction:column;gap:16px;}
      .cjmv-f label{font-size:13px;color:#8a8f9c;display:block;margin-bottom:6px;font-weight:600;}
      .cjmv-f input[type=text],.cjmv-f select{width:100%;box-sizing:border-box;padding:11px 12px;border:1px solid #e6e3f2;border-radius:10px;outline:none;font-size:14px;background:#fff;}
      .cjmv-f input:focus,.cjmv-f select:focus{border-color:#6D5BD0;}
    </style>
    <div class="modal-header">
      <div class="modal-titulo">${esGasto ? 'Nuevo gasto' : 'Nuevo retiro a banco'}</div>
      <button class="modal-cerrar" onclick="cerrarModal()">&times;</button>
    </div>
    <div class="modal-body cjmv-body">
      <div class="cjmv-f">
        <label>Concepto</label>
        <input type="text" id="cj-mov-con" placeholder="${esGasto ? 'Ej. insumos, librería…' : 'Ej. depósito mediodía'}">
      </div>
      ${esGasto ? `<div class="cjmv-f"><label>Pagado con</label><select id="cj-mov-met">${metOpts || '<option value="">—</option>'}</select></div>` : ''}
      <div class="cjmv-f">
        <label>Importe</label>
        ${_cjMoney('cj-mov-monto', prefillMonto || 0, '')}
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn" onclick="cerrarModal()">Cancelar</button>
      <button class="btn btn-primary-sm" onclick="cajaGuardarMov('${tipo}')">Guardar</button>
    </div>`);
  setTimeout(() => document.getElementById('cj-mov-con')?.focus(), 30);
}

async function cajaGuardarMov(tipo) {
  const concepto = (document.getElementById('cj-mov-con')?.value || '').trim();
  const monto = _cjMoneyVal('cj-mov-monto');
  const metodo = tipo === 'gasto' ? (document.getElementById('cj-mov-met')?.value || null) : 'Efectivo';
  if (monto <= 0) { mostrarMensaje('Poné un importe mayor a cero', 'advertencia'); return; }

  const r = await sb.from('caja_movimientos').insert({
    negocio_id: usuarioActual.negocio_id, fecha: window._caja.fecha,
    tipo, concepto: concepto || null, metodo, monto, creado_por: usuarioActual.id
  }).select('*').single();
  if (r.error) { mostrarMensaje('Error: ' + r.error.message, 'error'); return; }

  cerrarModal();
  await cajaReloadMovs();
}

async function cajaBorrarMov(id) {
  const ok = await confirmarModal({
    titulo: 'Quitar movimiento', texto: '¿Querés quitar este movimiento de la caja?',
    textoSi: 'Quitar', textoNo: 'Cancelar', peligro: true
  });
  if (!ok) return;
  const r = await sb.from('caja_movimientos').delete().eq('id', id);
  if (r.error) { mostrarMensaje('Error: ' + r.error.message, 'error'); return; }
  await cajaReloadMovs();
}

async function cajaReloadMovs() {
  const st = window._caja;
  const { data } = await sb.from('caja_movimientos').select('*')
    .eq('negocio_id', usuarioActual.negocio_id).eq('fecha', st.fecha).order('creado_en');
  st.movimientos = data || [];
  cajaRender();
}

// ------------------------------------------------------------
// Herramienta: contar billetes
// ------------------------------------------------------------
function cajaContarBilletes() {
  const rows = _CJ_DENOMS.map(d => `
    <div class="cjc-row">
      <span class="cjc-den">${formatearPrecio(d)}</span>
      <input type="text" inputmode="numeric" class="cjc-in" data-denom="${d}" placeholder="0" oninput="_cjCalcRecalc()">
      <span class="cjc-sub" id="cjc-sub-${d}">${formatearPrecio(0)}</span>
    </div>`).join('');
  abrirModal(`
    <style>
      .modal{max-width:560px;}
      .cjc-body{padding:18px 24px;}
      .cjc-intro{font-size:13px;color:#8a8f9c;margin-bottom:16px;}
      .cjc-row{display:grid;grid-template-columns:100px 1fr 110px;gap:12px;align-items:center;margin-bottom:9px;}
      .cjc-den{font-size:14px;color:#2b2b3a;font-weight:600;}
      .cjc-in{height:38px;text-align:center;border:1px solid #e6e3f2;border-radius:9px;outline:none;font-size:14px;}
      .cjc-in:focus{border-color:#6D5BD0;}
      .cjc-sub{text-align:right;color:#6b6880;font-size:14px;}
      .cjc-total{display:flex;justify-content:space-between;align-items:center;background:#f3f0fb;border-radius:12px;padding:14px 16px;margin-top:14px;}
      .cjc-total .l{color:#5d4cc0;font-weight:600;}
      .cjc-total .v{font-weight:800;font-size:21px;color:#6D5BD0;}
    </style>
    <div class="modal-header">
      <div class="modal-titulo">Contar billetes</div>
      <button class="modal-cerrar" onclick="cerrarModal()">&times;</button>
    </div>
    <div class="modal-body cjc-body">
      <div class="cjc-intro">Cargá la cantidad de cada billete. Sirve para contar un retiro y después cargarlo en Retiros.</div>
      ${rows}
      <div class="cjc-total"><span class="l">Total contado</span><span class="v" id="cjc-total">${formatearPrecio(0)}</span></div>
    </div>
    <div class="modal-footer">
      <button class="btn" onclick="cerrarModal()">Cerrar</button>
      <button class="btn btn-primary-sm" onclick="cajaCalcUsarRetiro()">Usar como retiro</button>
    </div>`);
}
function _cjCalcTotal() {
  let total = 0;
  document.querySelectorAll('.cjc-in[data-denom]').forEach(inp => {
    const d = Number(inp.getAttribute('data-denom'));
    const q = parseInt(inp.value.replace(/[^\d]/g, ''), 10) || 0;
    total += q * d;
  });
  return total;
}
function _cjCalcRecalc() {
  document.querySelectorAll('.cjc-in[data-denom]').forEach(inp => {
    inp.value = inp.value.replace(/[^\d]/g, '');
    const d = Number(inp.getAttribute('data-denom'));
    const q = parseInt(inp.value, 10) || 0;
    const sub = document.getElementById('cjc-sub-' + d);
    if (sub) sub.textContent = formatearPrecio(q * d);
  });
  const t = document.getElementById('cjc-total');
  if (t) t.textContent = formatearPrecio(_cjCalcTotal());
}
function cajaCalcUsarRetiro() {
  const total = _cjCalcTotal();
  if (total <= 0) { mostrarMensaje('Contá al menos un billete', 'advertencia'); return; }
  cerrarModal();
  cajaNuevoMov('retiro', total);
}

// ------------------------------------------------------------
// Historial de caja (otros días cargados)
// ------------------------------------------------------------
async function cajaHistorial() {
  const { data } = await sb.from('caja_dia').select('fecha, saldo_anterior')
    .eq('negocio_id', usuarioActual.negocio_id).order('fecha', { ascending: false }).limit(30);
  const dias = data || [];
  const filas = dias.length
    ? dias.map(d => `<button class="cjh-row" onclick="cajaIrDia('${d.fecha}')"><span>${_cjFechaLarga(d.fecha)}</span><span class="cjh-saldo">Saldo: ${formatearPrecio(d.saldo_anterior || 0)}</span></button>`).join('')
    : '<div class="cjh-vacio">Todavía no hay días cargados.</div>';
  abrirModal(`
    <style>
      .modal{max-width:460px;}
      .cjh-body{padding:14px 18px;max-height:60vh;overflow:auto;}
      .cjh-row{display:flex;justify-content:space-between;align-items:center;width:100%;background:none;border:none;border-top:1px solid #f1eefb;padding:12px 6px;cursor:pointer;font-size:14px;text-align:left;}
      .cjh-row:first-child{border-top:none;}
      .cjh-row:hover{background:#f6f5fb;}
      .cjh-saldo{color:#8a8f9c;font-size:13px;}
      .cjh-vacio{padding:22px;text-align:center;color:#a7abb6;font-size:13px;}
    </style>
    <div class="modal-header">
      <div class="modal-titulo">Historial de caja</div>
      <button class="modal-cerrar" onclick="cerrarModal()">&times;</button>
    </div>
    <div class="modal-body cjh-body">${filas}</div>
    <div class="modal-footer"><button class="btn" onclick="cerrarModal()">Cerrar</button></div>`);
}
function cajaIrDia(fecha) { cerrarModal(); cajaCargar(fecha); }

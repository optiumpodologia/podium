// ============================================================
// liquidaciones.js — Comisiones acumuladas y liquidaciones
// ============================================================
// Lee el ledger `comisiones`. Una comisión con liquidacion_id NULL
// está PENDIENTE (todavía no se la pagaron al profesional).
//
// Vista por rol:
//   - negocio: todos los profesionales, con su acumulado pendiente y
//     el detalle de cobros que lo componen.
//   - profesional: solo lo suyo (la RLS ya filtra), su acumulado y su
//     detalle. Más el historial de liquidaciones cerradas.
//
// Por ahora es SOLO LECTURA (sirve para verificar que las comisiones
// se registran bien). El acto de "liquidar" se agrega en el paso
// siguiente.
// ============================================================

function _liqNum(n) { return Number(n) || 0; }

function _liqFecha(s) {
  if (!s) return '';
  const d = new Date(s);
  return d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function _liqSvg(p, w = 18) {
  return `<svg viewBox="0 0 24 24" width="${w}" height="${w}" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${p}</svg>`;
}

const _LIQ_ICOS = {
  money: '<line x1="12" x2="12" y1="2" y2="22"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>',
  bill: '<rect width="20" height="12" x="2" y="6" rx="2"/><circle cx="12" cy="12" r="2"/><path d="M6 12h.01"/><path d="M18 12h.01"/>',
  user: '<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
  receipt: '<path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z"/><path d="M8 7h8"/><path d="M8 11h8"/><path d="M8 15h5"/>',
  chevron: '<path d="m6 9 6 6 6-6"/>'
};

async function renderLiquidaciones(container) {
  if (!puedeVerModulo(usuarioActual, 'liquidaciones')) {
    container.innerHTML = '<div class="vacio">Acceso restringido</div>';
    return;
  }

  const esProfesional = usuarioActual.rol === 'profesional';
  const titulo = esProfesional ? 'Mis comisiones' : 'Comisiones';
  const subt = esProfesional
    ? 'Tus comisiones por día, hasta la próxima liquidación.'
    : 'Comisiones acumuladas por profesional, pendientes de liquidar.';

  container.innerHTML = `
    <style>
      .liq-strip{display:flex;gap:14px;flex-wrap:wrap;margin-bottom:18px;}
      .liq-hero{flex:1;min-width:240px;background:linear-gradient(135deg,#6D5BD0,#574bb0);color:#fff;border-radius:16px;padding:18px 20px;display:flex;align-items:center;gap:16px;box-shadow:0 8px 24px rgba(109,91,208,.25);}
      .liq-hero-ico{width:46px;height:46px;border-radius:12px;background:rgba(255,255,255,.18);display:flex;align-items:center;justify-content:center;flex:none;}
      .liq-hero-ico svg{transform:rotate(-18deg);}
      .liq-hero-lbl{font-size:13px;opacity:.85;}
      .liq-hero-val{font-size:28px;font-weight:800;line-height:1.1;margin-top:2px;}
      .liq-hero-sub{font-size:12px;opacity:.8;margin-top:4px;}
      .liq-mini{background:#faf9fe;border:1px solid #ece9f7;border-radius:14px;padding:14px 16px;min-width:150px;}
      .liq-mini-lbl{font-size:12px;color:#8a8f9c;}
      .liq-mini-val{font-size:19px;font-weight:700;color:#2b2b3a;margin-top:3px;}
      .liq-card{background:#fff;border:1px solid #ece9f7;border-radius:14px;overflow:hidden;margin-bottom:18px;}
      .liq-card-tit{padding:13px 16px;font-weight:700;color:#2b2b3a;border-bottom:1px solid #f1eefb;display:flex;align-items:center;gap:8px;}
      .liq-prof{border-bottom:1px solid #f4f2fb;}
      .liq-prof:last-child{border-bottom:none;}
      .liq-prof-head{display:grid;grid-template-columns:1fr auto auto auto;gap:14px;align-items:center;padding:13px 16px;cursor:pointer;transition:background .12s;}
      .liq-prof-head:hover{background:#faf9fe;}
      .liq-prof-nom{display:flex;align-items:center;gap:10px;font-weight:600;color:#2b2b3a;}
      .liq-prof-av{width:34px;height:34px;border-radius:50%;background:#efeafe;color:#6D5BD0;display:flex;align-items:center;justify-content:center;flex:none;}
      .liq-prof-cobros{font-size:12px;color:#8a8f9c;}
      .liq-prof-total{font-weight:800;color:#6D5BD0;font-size:17px;text-align:right;}
      .liq-btn-liquidar{background:#6D5BD0;color:#fff;border:none;border-radius:9px;padding:7px 14px;font-size:13px;font-weight:600;cursor:pointer;white-space:nowrap;}
      .liq-btn-liquidar:hover{background:#5d4cc0;}
      .liq-btn-liquidar:disabled{opacity:.6;cursor:default;}
      .liq-chev{color:#b6b2c8;transition:transform .15s;}
      .liq-prof.abierto .liq-chev{transform:rotate(180deg);}
      .liq-detalle{display:none;background:#faf9fe;border-top:1px solid #f1eefb;}
      .liq-prof.abierto .liq-detalle{display:block;}
      .liq-tabla{width:100%;border-collapse:collapse;font-size:13px;}
      .liq-tabla th{text-align:left;color:#8a8f9c;font-weight:600;padding:9px 16px;border-bottom:1px solid #ece9f7;font-size:12px;}
      .liq-tabla td{padding:9px 16px;border-bottom:1px solid #f1eefb;color:#3a3a48;}
      .liq-tabla tr:last-child td{border-bottom:none;}
      .liq-tabla .num{text-align:right;white-space:nowrap;}
      .liq-tabla .tot{font-weight:700;color:#2b2b3a;}
      .liq-vacio{padding:26px 16px;text-align:center;color:#8a8f9c;}
      .liq-hist-row{display:grid;grid-template-columns:1fr auto auto;gap:14px;align-items:center;padding:12px 16px;border-bottom:1px solid #f1eefb;}
      .liq-hist-row:last-child{border-bottom:none;}
      .liq-badge{font-size:11px;font-weight:700;padding:3px 9px;border-radius:999px;}
      .liq-badge.pagada{background:#e6f7ee;color:#1f9d57;}
      .liq-badge.pendiente{background:#fff4e0;color:#c98a13;}
      .liq-tabs{display:flex;gap:6px;margin-bottom:16px;background:#f4f2fb;padding:4px;border-radius:11px;width:fit-content;}
      .liq-tab{border:none;background:transparent;color:#6b6880;font-weight:600;font-size:14px;padding:8px 18px;border-radius:8px;cursor:pointer;}
      .liq-tab.activo{background:#fff;color:#6D5BD0;box-shadow:0 1px 3px rgba(0,0,0,.08);}
      .liq-dia, .liq-periodo{border-bottom:1px solid #f4f2fb;}
      .liq-dia:last-child, .liq-periodo:last-child{border-bottom:none;}
      .liq-dia-head{display:grid;grid-template-columns:1fr auto auto;gap:12px;align-items:center;padding:13px 16px;cursor:pointer;transition:background .12s;}
      .liq-dia-head:hover{background:#faf9fe;}
      .liq-dia-fecha{font-weight:600;color:#2b2b3a;}
      .liq-dia-total{font-weight:700;color:#6D5BD0;}
      .liq-dia-det{display:none;background:#faf9fe;border-top:1px solid #f1eefb;}
      .liq-dia.abierto > .liq-dia-head, .liq-periodo.abierto > .liq-dia-head{background:#f6f4fd;}
      .liq-dia.abierto > .liq-dia-det{display:block;}
      .liq-dia .liq-chev, .liq-periodo .liq-chev{color:#b6b2c8;transition:transform .15s;}
      .liq-dia.abierto > .liq-dia-head .liq-chev, .liq-periodo.abierto > .liq-dia-head .liq-chev{transform:rotate(180deg);}
      .liq-periodo-det{display:none;border-top:1px solid #f1eefb;}
      .liq-periodo.abierto > .liq-periodo-det{display:block;}
      .liq-periodo .liq-dia-det{background:#fff;}
      .liq-detalle .liq-dia-det{background:#fff;}
      .liq-mov .nom{color:#3a3a48;}
      .liq-mov .sub{color:#9a9aa8;}
      .liq-tot-dia td{font-weight:700;color:#2b2b3a;background:#f3f0fb;}
      .liq-cel{display:flex;justify-content:space-between;gap:12px;align-items:baseline;}
      .liq-cel-nom{color:#3a3a48;min-width:0;}
      .liq-cel-val{color:#6b6880;font-weight:600;white-space:nowrap;}
      .liq-cel-vacio{color:#c2c2cc;}
      .liq-layout{display:grid;grid-template-columns:264px 1fr;gap:18px;align-items:start;}
      .liq-side{background:#fff;border:1px solid #ece9f7;border-radius:14px;padding:12px;position:sticky;top:12px;}
      .liq-side-tit{font-size:12px;font-weight:700;color:#8a8f9c;text-transform:uppercase;letter-spacing:.04em;padding:2px 8px 8px;}
      .liq-aviso-off{background:#fff4e0;border:1px solid #ffe2b0;color:#8a6d1f;border-radius:12px;padding:11px 14px;font-size:13px;margin-bottom:16px;}
      .liq-buscar{width:100%;padding:9px 12px;border:1px solid #e6e3f2;border-radius:10px;font-size:14px;margin-bottom:10px;box-sizing:border-box;outline:none;}
      .liq-buscar:focus{border-color:#6D5BD0;}
      .liq-side-lista{display:flex;flex-direction:column;gap:3px;max-height:62vh;overflow:auto;}
      .liq-side-item{display:flex;align-items:center;gap:10px;padding:8px 10px;border-radius:10px;cursor:pointer;transition:background .12s;}
      .liq-side-item:hover{background:#faf9fe;}
      .liq-side-item.sel{background:#efeafe;}
      .liq-side-av{width:32px;height:32px;border-radius:50%;background:#efeafe;color:#6D5BD0;display:flex;align-items:center;justify-content:center;flex:none;font-size:13px;font-weight:700;}
      .liq-side-info{flex:1;min-width:0;}
      .liq-side-info .n{font-weight:600;color:#2b2b3a;font-size:14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
      .liq-side-info .t{font-size:12px;color:#6D5BD0;font-weight:700;}
      .liq-side-vacio{padding:14px;text-align:center;color:#8a8f9c;font-size:13px;}
      .liq-panel{min-width:0;}
      .liq-panel-head{display:flex;align-items:center;gap:12px;background:#fff;border:1px solid #ece9f7;border-radius:14px;padding:14px 16px;margin-bottom:16px;}
      .liq-panel-head .liq-prof-av{width:42px;height:42px;font-size:15px;font-weight:700;}
      .liq-panel-info{flex:1;min-width:0;}
      .liq-panel-info .n{font-weight:700;color:#2b2b3a;font-size:16px;}
      .liq-panel-info .s{font-size:12px;color:#8a8f9c;margin-top:2px;}
      .liq-panel-total{font-weight:800;color:#6D5BD0;font-size:18px;}
    </style>
    <div class="page-header">
      <div>
        <div class="page-title">${titulo}</div>
        <div class="page-subtitle">${subt}</div>
      </div>
    </div>
    <div id="liq-main"><div class="vacio">Cargando…</div></div>
  `;

  const main = document.getElementById('liq-main');

  try {
    if (esProfesional) await _liqRenderProfesional(main);
    else await _liqRenderNegocio(main);
  } catch (err) {
    console.error(err);
    main.innerHTML = `<div class="liq-vacio">No se pudieron cargar las comisiones.<br><small>${(err.message || err)}</small></div>`;
  }
}

// ---------- Vista PROFESIONAL ----------
async function _liqRenderProfesional(main) {
  // La RLS devuelve solo las comisiones del profesional logueado.
  const [{ data: rows, error }, { data: liqs }] = await Promise.all([
    sb.from('comisiones')
      .select('id, turno_id, liquidacion_id, comision_total, comision_atencion, comision_producto, creado_en')
      .order('creado_en', { ascending: false }),
    sb.from('liquidaciones')
      .select('id, desde, hasta, total_comision, estado, pagada_en, creado_en')
      .order('creado_en', { ascending: false })
  ]);
  if (error) throw error;

  const items = rows || [];
  const pendientes = items.filter(r => !r.liquidacion_id);

  // Nombres de atención/producto por turno (catálogo actual; tolerante a fallos).
  const detalleTurno = await _liqCargarDetalleTurnos(items.map(r => r.turno_id));

  const total = pendientes.reduce((s, r) => s + _liqNum(r.comision_total), 0);
  const totAt = pendientes.reduce((s, r) => s + _liqNum(r.comision_atencion), 0);
  const totProd = pendientes.reduce((s, r) => s + _liqNum(r.comision_producto), 0);

  // --- Pestaña Pendientes: días desplegables ---
  const dias = _liqAgruparPorDia(pendientes);
  const panePend = dias.length
    ? dias.map(d => _liqBloqueDia(d, detalleTurno)).join('')
    : `<div class="liq-vacio">Todavía no tenés comisiones pendientes.</div>`;

  // --- Pestaña Liquidados: períodos → días → movimientos ---
  const paneLiq = (liqs && liqs.length)
    ? liqs.map(l => {
        const rowsLiq = items.filter(r => r.liquidacion_id === l.id);
        const diasLiq = _liqAgruparPorDia(rowsLiq);
        const periodo = (l.desde || l.hasta)
          ? `${l.desde ? _liqFecha(l.desde) : '—'} al ${l.hasta ? _liqFecha(l.hasta) : '—'}`
          : `Liquidación del ${_liqFecha(l.creado_en)}`;
        const cuerpo = diasLiq.length
          ? diasLiq.map(d => _liqBloqueDia(d, detalleTurno)).join('')
          : `<div class="liq-vacio">Sin movimientos.</div>`;
        return `
          <div class="liq-periodo">
            <div class="liq-dia-head" onclick="this.closest('.liq-periodo').classList.toggle('abierto')">
              <div>
                <div class="liq-dia-fecha">${periodo}</div>
                <div class="liq-prof-cobros">Pagada el ${_liqFecha(l.pagada_en || l.creado_en)}</div>
              </div>
              <div class="liq-dia-total">${formatearPrecio(_liqNum(l.total_comision))}</div>
              <div class="liq-chev">${_liqSvg(_LIQ_ICOS.chevron, 18)}</div>
            </div>
            <div class="liq-periodo-det">${cuerpo}</div>
          </div>`;
      }).join('')
    : `<div class="liq-vacio">Todavía no hay comisiones liquidadas.</div>`;

  main.innerHTML = `
    <div class="liq-strip">
      <div class="liq-hero">
        <div class="liq-hero-ico">${_liqSvg(_LIQ_ICOS.bill, 24)}</div>
        <div>
          <div class="liq-hero-lbl">Acumulado pendiente de liquidar</div>
          <div class="liq-hero-val">${formatearPrecio(total)}</div>
          <div class="liq-hero-sub">${pendientes.length} ${pendientes.length === 1 ? 'cobro' : 'cobros'}</div>
        </div>
      </div>
      <div class="liq-mini">
        <div class="liq-mini-lbl">Por atenciones</div>
        <div class="liq-mini-val">${formatearPrecio(totAt)}</div>
      </div>
      <div class="liq-mini">
        <div class="liq-mini-lbl">Por productos</div>
        <div class="liq-mini-val">${formatearPrecio(totProd)}</div>
      </div>
    </div>

    <div class="liq-tabs">
      <button class="liq-tab activo" data-pane="pend" onclick="_liqTab(this)">Pendientes</button>
      <button class="liq-tab" data-pane="liq" onclick="_liqTab(this)">Liquidados</button>
    </div>

    <div class="liq-card" id="liq-pane-pend">${panePend}</div>
    <div class="liq-card" id="liq-pane-liq" style="display:none;">${paneLiq}</div>
  `;
}

// Carga los nombres de atención/producto de cada turno. Tolerante: si algo
// no se puede leer, devuelve lo que tenga (la vista cae a nombres genéricos).
async function _liqCargarDetalleTurnos(turnoIds) {
  const ids = [...new Set((turnoIds || []).filter(Boolean))];
  const mapa = {};
  if (!ids.length) return mapa;
  ids.forEach(id => { mapa[id] = { atenciones: [], productos: [] }; });

  try {
    const [{ data: tas }, { data: tipos }, { data: tps }, { data: prods }] = await Promise.all([
      sb.from('turno_atenciones').select('turno_id, tipo_atencion_id').in('turno_id', ids),
      sb.from('tipos_atencion').select('id, nombre'),
      sb.from('turno_productos').select('turno_id, producto_id').in('turno_id', ids),
      sb.from('productos').select('id, nombre')
    ]);
    const nomTipo = {}; (tipos || []).forEach(t => { nomTipo[t.id] = t.nombre; });
    const nomProd = {}; (prods || []).forEach(p => { nomProd[p.id] = p.nombre; });
    (tas || []).forEach(a => {
      if (mapa[a.turno_id]) mapa[a.turno_id].atenciones.push(nomTipo[a.tipo_atencion_id] || 'Atención');
    });
    (tps || []).forEach(p => {
      if (mapa[p.turno_id]) mapa[p.turno_id].productos.push(nomProd[p.producto_id] || 'Producto');
    });
  } catch (err) {
    console.warn('No se pudieron cargar los nombres de atención/producto:', err);
  }
  return mapa;
}

// Agrupa filas de comisión por día (clave YYYY-MM-DD), más nuevo primero.
function _liqAgruparPorDia(rows) {
  const dias = {};
  (rows || []).forEach(r => {
    const k = (r.creado_en || '').slice(0, 10);
    if (!dias[k]) dias[k] = { key: k, total: 0, items: [] };
    dias[k].total += _liqNum(r.comision_total);
    dias[k].items.push(r);
  });
  return Object.values(dias).sort((a, b) => b.key.localeCompare(a.key));
}

// Un día desplegable: header con fecha + comisión del día; detalle con los
// movimientos (atención / producto con su nombre y comisión) + total del día.
function _liqBloqueDia(dia, detalleTurno) {
  const fecha = dia.key ? _liqFecha(dia.key) : '';
  const movs = dia.items.map(r => {
    const det = detalleTurno[r.turno_id] || { atenciones: [], productos: [] };
    const nomAt = det.atenciones.length ? det.atenciones.join(', ') : 'Atención';
    const nomProd = det.productos.length ? det.productos.join(', ') : '';
    const cAt = _liqNum(r.comision_atencion);
    const cProd = _liqNum(r.comision_producto);
    const celProd = nomProd
      ? `<div class="liq-cel"><span class="liq-cel-nom">${nomProd}</span><span class="liq-cel-val">${cProd ? formatearPrecio(cProd) : ''}</span></div>`
      : `<span class="liq-cel-vacio">—</span>`;
    return `
      <tr class="liq-mov">
        <td><div class="liq-cel"><span class="liq-cel-nom">${nomAt}</span><span class="liq-cel-val">${cAt ? formatearPrecio(cAt) : ''}</span></div></td>
        <td>${celProd}</td>
        <td class="num tot">${formatearPrecio(_liqNum(r.comision_total))}</td>
      </tr>`;
  }).join('');

  return `
    <div class="liq-dia">
      <div class="liq-dia-head" onclick="this.closest('.liq-dia').classList.toggle('abierto')">
        <div class="liq-dia-fecha">${fecha}</div>
        <div class="liq-dia-total">Comisión del día ${formatearPrecio(dia.total)}</div>
        <div class="liq-chev">${_liqSvg(_LIQ_ICOS.chevron, 18)}</div>
      </div>
      <div class="liq-dia-det">
        <table class="liq-tabla">
          <thead><tr><th>Atención</th><th>Producto</th><th class="num">Total</th></tr></thead>
          <tbody>
            ${movs}
            <tr class="liq-tot-dia"><td colspan="2">Total del día</td><td class="num">${formatearPrecio(dia.total)}</td></tr>
          </tbody>
        </table>
      </div>
    </div>`;
}

function _liqTab(btn) {
  const pane = btn.getAttribute('data-pane');
  document.querySelectorAll('.liq-tab').forEach(b => b.classList.toggle('activo', b === btn));
  const pend = document.getElementById('liq-pane-pend');
  const liq = document.getElementById('liq-pane-liq');
  if (pend) pend.style.display = pane === 'pend' ? '' : 'none';
  if (liq) liq.style.display = pane === 'liq' ? '' : 'none';
}

// ---------- Vista NEGOCIO ----------
async function _liqRenderNegocio(main) {
  const [{ data: rows, error }, { data: liqs }, { data: profs }] = await Promise.all([
    sb.from('comisiones')
      .select('id, turno_id, profesional_id, liquidacion_id, comision_total, comision_atencion, comision_producto, creado_en')
      .order('creado_en', { ascending: false }),
    sb.from('liquidaciones')
      .select('id, profesional_id, desde, hasta, total_comision, estado, pagada_en, creado_en')
      .order('creado_en', { ascending: false }),
    sb.from('profesionales').select('id, nombre, activo, comision_habilitada')
  ]);
  if (error) throw error;

  const nombreDe = {};
  const habilDe = {};
  (profs || []).forEach(p => { nombreDe[p.id] = p.nombre; habilDe[p.id] = p.comision_habilitada !== false; });

  const detalleTurno = await _liqCargarDetalleTurnos((rows || []).map(r => r.turno_id));

  // Agrupar comisiones por profesional (todas, y aparte las pendientes)
  const porProf = {};
  (rows || []).forEach(r => {
    const k = r.profesional_id || '_sin';
    if (!porProf[k]) porProf[k] = { all: [], pend: [], totalPend: 0, atPend: 0, prodPend: 0 };
    porProf[k].all.push(r);
    if (!r.liquidacion_id) {
      porProf[k].pend.push(r);
      porProf[k].totalPend += _liqNum(r.comision_total);
      porProf[k].atPend += _liqNum(r.comision_atencion);
      porProf[k].prodPend += _liqNum(r.comision_producto);
    }
  });

  // Liquidaciones por profesional
  const liqsDe = {};
  (liqs || []).forEach(l => {
    const k = l.profesional_id || '_sin';
    if (!liqsDe[k]) liqsDe[k] = [];
    liqsDe[k].push(l);
  });

  // Listamos TODOS los profesionales activos, más cualquiera que tenga
  // comisiones o historial (aunque esté inactivo). Orden alfabético.
  const set = {};
  (profs || []).forEach(p => { if (p.activo !== false) set[p.id] = true; });
  Object.keys(porProf).forEach(k => { set[k] = true; });
  Object.keys(liqsDe).forEach(k => { set[k] = true; });
  const claves = Object.keys(set).sort((a, b) => {
    if (a === '_sin') return 1;
    if (b === '_sin') return -1;
    return (nombreDe[a] || '').localeCompare(nombreDe[b] || '');
  });

  const totalNegocio = claves.reduce((s, k) => s + (porProf[k]?.totalPend || 0), 0);
  const conPend = claves.filter(k => (porProf[k]?.totalPend || 0) > 0).length;

  window._liqNeg = { porProf, liqsDe, nombreDe, habilDe, detalleTurno };

  const itemsHtml = claves.map(k => {
    const nom = k === '_sin' ? 'Sin asignar' : (nombreDe[k] || 'Profesional');
    const inic = (nom.trim()[0] || '?').toUpperCase();
    const tot = porProf[k]?.totalPend || 0;
    return `
      <div class="liq-side-item" data-prof="${k}" onclick="_liqSelProf(this.getAttribute('data-prof'))">
        <div class="liq-side-av">${inic}</div>
        <div class="liq-side-info">
          <div class="n">${nom}</div>
          <div class="t">${formatearPrecio(tot)}</div>
        </div>
      </div>`;
  }).join('');

  main.innerHTML = `
    <div class="liq-strip">
      <div class="liq-hero">
        <div class="liq-hero-ico">${_liqSvg(_LIQ_ICOS.bill, 24)}</div>
        <div>
          <div class="liq-hero-lbl">Total pendiente de liquidar</div>
          <div class="liq-hero-val">${formatearPrecio(totalNegocio)}</div>
          <div class="liq-hero-sub">${conPend} ${conPend === 1 ? 'profesional con comisiones' : 'profesionales con comisiones'}</div>
        </div>
      </div>
    </div>

    <div class="liq-layout">
      <aside class="liq-side">
        <div class="liq-side-tit">Profesionales</div>
        <div class="liq-side-lista" id="liq-side-lista">
          ${itemsHtml || '<div class="liq-side-vacio">No hay profesionales.</div>'}
        </div>
      </aside>
      <section class="liq-panel" id="liq-panel"></section>
    </div>
  `;

  if (claves.length) {
    _liqSelProf(claves[0]);
  } else {
    document.getElementById('liq-panel').innerHTML =
      '<div class="liq-card"><div class="liq-vacio">Todavía no hay comisiones registradas.<br><small>Cobrá un turno finalizado y va a aparecer acá.</small></div></div>';
  }
}

// Pinta el panel derecho con el profesional seleccionado.
function _liqSelProf(k) {
  const st = window._liqNeg;
  if (!st) return;
  document.querySelectorAll('.liq-side-item').forEach(el => {
    el.classList.toggle('sel', el.getAttribute('data-prof') === k);
  });
  const panel = document.getElementById('liq-panel');
  if (panel) panel.innerHTML = _liqPanelProfesional(k);
}

// HTML del panel de un profesional: header + Liquidar + pestañas
// Pendientes (días → movimientos) y Liquidados (período → días → movimientos).
function _liqPanelProfesional(k) {
  const st = window._liqNeg;
  const g = (st.porProf && st.porProf[k]) || { all: [], pend: [], totalPend: 0, atPend: 0, prodPend: 0 };
  const nom = k === '_sin' ? 'Sin profesional asignado' : (st.nombreDe[k] || 'Profesional');
  const inic = (nom.trim()[0] || '?').toUpperCase();
  const habil = !st.habilDe || st.habilDe[k] !== false;

  const dias = _liqAgruparPorDia(g.pend);
  const panePend = dias.length
    ? dias.map(d => _liqBloqueDia(d, st.detalleTurno)).join('')
    : '<div class="liq-vacio">Sin comisiones pendientes.</div>';

  const liqs = (st.liqsDe && st.liqsDe[k]) || [];
  const paneLiq = liqs.length
    ? liqs.map(l => {
        const rowsLiq = g.all.filter(r => r.liquidacion_id === l.id);
        const diasLiq = _liqAgruparPorDia(rowsLiq);
        const periodo = (l.desde || l.hasta)
          ? `${l.desde ? _liqFecha(l.desde) : '—'} al ${l.hasta ? _liqFecha(l.hasta) : '—'}`
          : `Liquidación del ${_liqFecha(l.creado_en)}`;
        const cuerpo = diasLiq.length
          ? diasLiq.map(d => _liqBloqueDia(d, st.detalleTurno)).join('')
          : '<div class="liq-vacio">Sin movimientos.</div>';
        return `
          <div class="liq-periodo">
            <div class="liq-dia-head" onclick="this.closest('.liq-periodo').classList.toggle('abierto')">
              <div>
                <div class="liq-dia-fecha">${periodo}</div>
                <div class="liq-prof-cobros">Pagada el ${_liqFecha(l.pagada_en || l.creado_en)}</div>
              </div>
              <div class="liq-dia-total">${formatearPrecio(_liqNum(l.total_comision))}</div>
              <div class="liq-chev">${_liqSvg(_LIQ_ICOS.chevron, 18)}</div>
            </div>
            <div class="liq-periodo-det">${cuerpo}</div>
          </div>`;
      }).join('')
    : '<div class="liq-vacio">Todavía no hay comisiones liquidadas.</div>';

  const puedeLiq = habil && k !== '_sin' && g.totalPend > 0;
  const btnLiq = puedeLiq
    ? `<button class="liq-btn-liquidar" data-prof="${k}" data-nom="${_liqEscAttr(nom)}" data-total="${g.totalPend}" onclick="_liqLiquidar(this)">Liquidar</button>`
    : '';

  const avisoOff = !habil
    ? `<div class="liq-aviso-off">La comisión está deshabilitada para este profesional. No se le registran comisiones nuevas.</div>`
    : '';

  return `
    <div class="liq-panel-head">
      <div class="liq-prof-av">${inic}</div>
      <div class="liq-panel-info">
        <div class="n">${nom}</div>
        <div class="s">${g.pend.length} ${g.pend.length === 1 ? 'cobro pendiente' : 'cobros pendientes'} · Atención ${formatearPrecio(g.atPend)} · Producto ${formatearPrecio(g.prodPend)}</div>
      </div>
      <div class="liq-panel-total">${formatearPrecio(g.totalPend)}</div>
      ${btnLiq}
    </div>
    ${avisoOff}

    <div class="liq-tabs">
      <button class="liq-tab activo" data-pane="pend" onclick="_liqTab(this)">Pendientes</button>
      <button class="liq-tab" data-pane="liq" onclick="_liqTab(this)">Liquidados</button>
    </div>

    <div class="liq-card" id="liq-pane-pend">${panePend}</div>
    <div class="liq-card" id="liq-pane-liq" style="display:none;">${paneLiq}</div>
  `;
}

function _liqToggle(i) {
  const el = document.getElementById('liq-prof-' + i);
  if (el) el.classList.toggle('abierto');
}

function _liqEscAttr(s) {
  return String(s)
    .replace(/&/g, '&amp;').replace(/"/g, '&quot;')
    .replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// Liquida TODO lo pendiente del profesional al momento del corte.
// La función SQL `liquidar_comisiones` hace el cierre en una sola
// transacción (crea la liquidación + engancha las comisiones).
async function _liqLiquidar(btn) {
  const profId = btn.getAttribute('data-prof');
  const nom = btn.getAttribute('data-nom') || 'el profesional';
  const total = Number(btn.getAttribute('data-total')) || 0;

  const ok = await confirmarModal({
    titulo: 'Liquidar comisiones',
    texto: `Vas a liquidar ${formatearPrecio(total)} a ${nom}. Esto cierra el período actual y reinicia su acumulado en cero. ¿Confirmás?`,
    textoSi: 'Liquidar',
    textoNo: 'Cancelar'
  });
  if (!ok) return;

  btn.disabled = true;
  const txtOrig = btn.textContent;
  btn.textContent = 'Liquidando…';

  const { data, error } = await sb.rpc('liquidar_comisiones', { p_profesional_id: profId });
  if (error) {
    mostrarMensaje('Error al liquidar: ' + error.message, 'error');
    btn.disabled = false;
    btn.textContent = txtOrig;
    return;
  }

  const cant = data?.cantidad ?? 0;
  if (!cant) {
    mostrarMensaje('No había comisiones pendientes para liquidar', 'advertencia');
  } else {
    mostrarMensaje('Liquidación registrada por ' + formatearPrecio(_liqNum(data.total)), 'exito');
  }

  const cont = document.getElementById('main');
  if (cont) renderLiquidaciones(cont);
}

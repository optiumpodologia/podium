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
  const titulo = esProfesional ? 'Mi liquidación' : 'Liquidaciones';
  const subt = esProfesional
    ? 'Tus comisiones acumuladas hasta la próxima liquidación.'
    : 'Comisiones acumuladas por profesional, pendientes de liquidar.';

  container.innerHTML = `
    <style>
      .liq-strip{display:flex;gap:14px;flex-wrap:wrap;margin-bottom:18px;}
      .liq-hero{flex:1;min-width:240px;background:linear-gradient(135deg,#6D5BD0,#574bb0);color:#fff;border-radius:16px;padding:18px 20px;display:flex;align-items:center;gap:16px;box-shadow:0 8px 24px rgba(109,91,208,.25);}
      .liq-hero-ico{width:46px;height:46px;border-radius:12px;background:rgba(255,255,255,.18);display:flex;align-items:center;justify-content:center;flex:none;}
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
  const { data: rows, error } = await sb.from('comisiones')
    .select('id, comision_total, comision_atencion, comision_producto, base_atencion, base_producto, creado_en')
    .is('liquidacion_id', null)
    .order('creado_en', { ascending: false });
  if (error) throw error;

  const items = rows || [];
  const total = items.reduce((s, r) => s + _liqNum(r.comision_total), 0);
  const totAt = items.reduce((s, r) => s + _liqNum(r.comision_atencion), 0);
  const totProd = items.reduce((s, r) => s + _liqNum(r.comision_producto), 0);

  const filas = items.length
    ? items.map(r => `
        <tr>
          <td>${_liqFecha(r.creado_en)}</td>
          <td class="num">${formatearPrecio(_liqNum(r.comision_atencion))}</td>
          <td class="num">${formatearPrecio(_liqNum(r.comision_producto))}</td>
          <td class="num tot">${formatearPrecio(_liqNum(r.comision_total))}</td>
        </tr>`).join('')
    : `<tr><td colspan="4" class="liq-vacio">Todavía no tenés comisiones pendientes.</td></tr>`;

  const hist = await _liqHistorial(false);

  main.innerHTML = `
    <div class="liq-strip">
      <div class="liq-hero">
        <div class="liq-hero-ico">${_liqSvg(_LIQ_ICOS.money, 24)}</div>
        <div>
          <div class="liq-hero-lbl">Acumulado pendiente de liquidar</div>
          <div class="liq-hero-val">${formatearPrecio(total)}</div>
          <div class="liq-hero-sub">${items.length} ${items.length === 1 ? 'cobro' : 'cobros'}</div>
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

    <div class="liq-card">
      <div class="liq-card-tit">${_liqSvg(_LIQ_ICOS.receipt, 16)} Detalle de comisiones pendientes</div>
      <table class="liq-tabla">
        <thead><tr><th>Fecha</th><th class="num">Atención</th><th class="num">Producto</th><th class="num">Comisión</th></tr></thead>
        <tbody>${filas}</tbody>
      </table>
    </div>

    <div class="liq-card">
      <div class="liq-card-tit">${_liqSvg(_LIQ_ICOS.receipt, 16)} Historial de liquidaciones</div>
      ${hist}
    </div>
  `;
}

// ---------- Vista NEGOCIO ----------
async function _liqRenderNegocio(main) {
  const [{ data: rows, error }, { data: profs }] = await Promise.all([
    sb.from('comisiones')
      .select('id, profesional_id, comision_total, comision_atencion, comision_producto, creado_en')
      .is('liquidacion_id', null)
      .order('creado_en', { ascending: false }),
    sb.from('profesionales').select('id, nombre')
  ]);
  if (error) throw error;

  const nombreDe = {};
  (profs || []).forEach(p => { nombreDe[p.id] = p.nombre; });

  // Agrupar por profesional
  const grupos = {};
  (rows || []).forEach(r => {
    const k = r.profesional_id || '_sin';
    if (!grupos[k]) grupos[k] = { total: 0, atencion: 0, producto: 0, items: [] };
    grupos[k].total += _liqNum(r.comision_total);
    grupos[k].atencion += _liqNum(r.comision_atencion);
    grupos[k].producto += _liqNum(r.comision_producto);
    grupos[k].items.push(r);
  });

  const claves = Object.keys(grupos).sort((a, b) => grupos[b].total - grupos[a].total);
  const totalNegocio = claves.reduce((s, k) => s + grupos[k].total, 0);

  const bloques = claves.length
    ? claves.map((k, i) => {
        const g = grupos[k];
        const nom = k === '_sin' ? 'Sin profesional asignado' : (nombreDe[k] || 'Profesional');
        const inic = (nom.trim()[0] || '?').toUpperCase();
        const det = g.items.map(r => `
          <tr>
            <td>${_liqFecha(r.creado_en)}</td>
            <td class="num">${formatearPrecio(_liqNum(r.comision_atencion))}</td>
            <td class="num">${formatearPrecio(_liqNum(r.comision_producto))}</td>
            <td class="num tot">${formatearPrecio(_liqNum(r.comision_total))}</td>
          </tr>`).join('');
        return `
          <div class="liq-prof" id="liq-prof-${i}">
            <div class="liq-prof-head" onclick="_liqToggle(${i})">
              <div class="liq-prof-nom">
                <div class="liq-prof-av">${inic}</div>
                <div>
                  ${nom}
                  <div class="liq-prof-cobros">${g.items.length} ${g.items.length === 1 ? 'cobro' : 'cobros'} · Atención ${formatearPrecio(g.atencion)} · Producto ${formatearPrecio(g.producto)}</div>
                </div>
              </div>
              <div class="liq-prof-total">${formatearPrecio(g.total)}</div>
              ${k === '_sin'
                ? '<span></span>'
                : `<button class="liq-btn-liquidar" data-prof="${k}" data-nom="${_liqEscAttr(nom)}" data-total="${g.total}" onclick="event.stopPropagation(); _liqLiquidar(this)">Liquidar</button>`}
              <div class="liq-chev">${_liqSvg(_LIQ_ICOS.chevron, 18)}</div>
            </div>
            <div class="liq-detalle">
              <table class="liq-tabla">
                <thead><tr><th>Fecha</th><th class="num">Atención</th><th class="num">Producto</th><th class="num">Comisión</th></tr></thead>
                <tbody>${det}</tbody>
              </table>
            </div>
          </div>`;
      }).join('')
    : `<div class="liq-vacio">Todavía no hay comisiones registradas.<br><small>Cobrá un turno finalizado y va a aparecer acá.</small></div>`;

  const hist = await _liqHistorial(true, nombreDe);

  main.innerHTML = `
    <div class="liq-strip">
      <div class="liq-hero">
        <div class="liq-hero-ico">${_liqSvg(_LIQ_ICOS.money, 24)}</div>
        <div>
          <div class="liq-hero-lbl">Total pendiente de liquidar</div>
          <div class="liq-hero-val">${formatearPrecio(totalNegocio)}</div>
          <div class="liq-hero-sub">${claves.length} ${claves.length === 1 ? 'profesional' : 'profesionales'}</div>
        </div>
      </div>
    </div>

    <div class="liq-card">
      <div class="liq-card-tit">${_liqSvg(_LIQ_ICOS.user, 16)} Acumulado por profesional</div>
      ${bloques}
    </div>

    <div class="liq-card">
      <div class="liq-card-tit">${_liqSvg(_LIQ_ICOS.receipt, 16)} Historial de liquidaciones</div>
      ${hist}
    </div>
  `;
}

// ---------- Historial (compartido) ----------
async function _liqHistorial(esNegocio, nombreDe) {
  const { data: liqs } = await sb.from('liquidaciones')
    .select('id, profesional_id, desde, hasta, total_comision, estado, pagada_en, creado_en')
    .order('creado_en', { ascending: false });

  if (!liqs || !liqs.length) {
    return `<div class="liq-vacio">Todavía no hay liquidaciones cerradas.</div>`;
  }

  return liqs.map(l => {
    const periodo = (l.desde || l.hasta)
      ? `${l.desde ? _liqFecha(l.desde) : '—'} al ${l.hasta ? _liqFecha(l.hasta) : '—'}`
      : `Liquidación del ${_liqFecha(l.creado_en)}`;
    const quien = esNegocio
      ? `<div class="liq-prof-cobros">${(nombreDe && nombreDe[l.profesional_id]) || 'Profesional'}</div>`
      : '';
    const badge = l.estado === 'pagada'
      ? '<span class="liq-badge pagada">Pagada</span>'
      : '<span class="liq-badge pendiente">Pendiente</span>';
    return `
      <div class="liq-hist-row">
        <div>
          <div style="font-weight:600;color:#2b2b3a;">${periodo}</div>
          ${quien}
        </div>
        <div class="liq-prof-total">${formatearPrecio(_liqNum(l.total_comision))}</div>
        <div>${badge}</div>
      </div>`;
  }).join('');
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

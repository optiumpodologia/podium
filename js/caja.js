// ============================================================
// caja.js — Caja del día (recepción y negocio)
// ============================================================
// Control diario de caja: "foto" de las operaciones del día por
// método (mapa del día), carga de gastos y retiros a banco, y arqueo
// de EFECTIVO con contador de billetes.
//
// El arqueo es solo de efectivo:
//   efectivo teórico = saldo anterior + efectivo cobrado
//                      − gastos en efectivo − retiros a banco
//   efectivo contado = suma del contador de billetes
//   diferencia       = contado − teórico
//
// Cargan recepción y negocio. El profesional no ve este módulo.
// El "es efectivo" de cada método es interno (metodos_pago.afecta_caja).
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
function _cjIcoClase(slug) {
  if (slug === 'efectivo') return 'green';
  if (slug === 'mercadopago') return 'cyan';
  return '';
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
  let s = String(v == null ? '' : v).trim().replace(/\$/g, '').replace(/\s/g, '');
  s = s.replace(/\.(?=\d{3}(\D|$))/g, '');
  s = s.replace(',', '.');
  const n = parseFloat(s.replace(/[^\d.-]/g, ''));
  return isNaN(n) ? 0 : n;
}

// ------------------------------------------------------------
// Carga + render
// ------------------------------------------------------------
async function renderCaja(cont) {
  if (!['negocio', 'recepcion'].includes(usuarioActual.rol)) {
    cont.innerHTML = '<div class="vacio">No tenés acceso a este módulo</div>';
    return;
  }
  cont.innerHTML = `
    <style>
      .caja-wrap{padding:22px 26px;max-width:1100px;margin:0 auto;color:#2b2b3a;}
      .cj-loading{padding:40px;text-align:center;color:#8a8f9c;}
      .cj-top{display:flex;justify-content:space-between;align-items:center;gap:16px;flex-wrap:wrap;margin-bottom:20px;}
      .cj-titulo{font-size:22px;font-weight:700;}
      .cj-dia{display:flex;align-items:center;gap:8px;}
      .cj-dia-nav{width:34px;height:34px;border:1px solid #e6e3f2;background:#fff;border-radius:9px;cursor:pointer;color:#6D5BD0;display:flex;align-items:center;justify-content:center;font-size:18px;}
      .cj-dia-nav:hover{background:#f6f5fb;}
      .cj-dia-lbl{font-size:16px;font-weight:600;min-width:200px;text-align:center;}
      .cj-dia-hoy{font-size:12px;color:#6D5BD0;cursor:pointer;background:none;border:none;text-decoration:underline;}
      .cj-saldo{display:flex;align-items:center;gap:9px;background:#fff;border:1px solid #ece9f7;border-radius:12px;padding:10px 14px;}
      .cj-saldo label{font-size:13px;color:#8a8f9c;}
      .cj-saldo input{width:120px;text-align:right;border:1px solid #e6e3f2;border-radius:8px;padding:8px 10px;font-size:14px;outline:none;}
      .cj-saldo input:focus{border-color:#6D5BD0;}
      .cj-sec-lbl{font-size:13px;color:#8a8f9c;margin:0 0 11px;display:flex;align-items:center;gap:7px;font-weight:600;}
      .cj-mapa{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:13px;margin-bottom:26px;}
      .cj-mcard{background:#fff;border:1px solid #ece9f7;border-radius:12px;padding:13px 15px;}
      .cj-mcard.total{background:#efeafe;border-color:#ddd3f7;}
      .cj-mcard-top{display:flex;align-items:center;gap:8px;font-size:13px;color:#6b6880;}
      .cj-mcard.total .cj-mcard-top{color:#5d4cc0;}
      .cj-mcard-ico{color:#6D5BD0;display:flex;}
      .cj-mcard-ico.green{color:#1f9d57;}
      .cj-mcard-ico.cyan{color:#1593b8;}
      .cj-mcard-val{font-size:20px;font-weight:700;margin-top:6px;}
      .cj-mcard.total .cj-mcard-val{color:#5d4cc0;}
      .cj-mcard-ops{font-size:12px;color:#a7abb6;margin-top:1px;}
      .cj-cols{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:26px;}
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
      .cj-arqueo{background:#fff;border:1px solid #ece9f7;border-radius:14px;padding:17px 19px;}
      .cj-arq-grid{display:grid;grid-template-columns:1.1fr 1fr;gap:28px;}
      .cj-bill{display:flex;flex-direction:column;gap:8px;}
      .cj-bill-row{display:grid;grid-template-columns:80px 70px 1fr;gap:10px;align-items:center;font-size:14px;}
      .cj-bill-row input{height:34px;text-align:center;border:1px solid #e6e3f2;border-radius:8px;outline:none;font-size:14px;}
      .cj-bill-row input:focus{border-color:#6D5BD0;}
      .cj-bill-sub{text-align:right;color:#6b6880;}
      .cj-res-row{display:flex;justify-content:space-between;align-items:center;padding:9px 0;font-size:14px;}
      .cj-res-row.sep{border-top:1px solid #f1eefb;}
      .cj-res-row .lbl{color:#6b6880;}
      .cj-dif{display:flex;justify-content:space-between;align-items:center;padding:12px 0 4px;border-top:1px solid #ece9f7;margin-top:4px;}
      .cj-dif-tit{font-weight:700;}
      .cj-dif-badge{font-size:13px;font-weight:700;padding:4px 13px;border-radius:999px;}
      .cj-dif-badge.ok{background:#e6f7ee;color:#1f9d57;}
      .cj-dif-badge.bad{background:#fdeaea;color:#d35;}
      .cj-cerrar{width:100%;margin-top:16px;background:#6D5BD0;color:#fff;border:none;border-radius:10px;padding:11px;font-weight:600;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;gap:8px;}
      .cj-cerrar:hover{background:#5d4cc0;}
      .cj-cerrada{margin-top:14px;text-align:center;font-size:13px;color:#1f9d57;font-weight:600;}
      @media (max-width:820px){ .cj-cols,.cj-arq-grid{grid-template-columns:1fr;} }
    </style>
    <div class="caja-wrap" id="caja-wrap"><div class="cj-loading">Cargando caja…</div></div>`;

  await cajaCargar(_cjFechaISO(new Date()));
}

async function cajaCargar(fechaStr) {
  const neg = usuarioActual.negocio_id;
  const desde = new Date(fechaStr + 'T00:00:00');
  const hasta = new Date(desde); hasta.setDate(hasta.getDate() + 1);

  const [diaR, movR, pagosR, metR] = await Promise.all([
    sb.from('caja_dia').select('*').eq('negocio_id', neg).eq('fecha', fechaStr).maybeSingle(),
    sb.from('caja_movimientos').select('*').eq('negocio_id', neg).eq('fecha', fechaStr).order('creado_en'),
    sb.from('cobro_pagos').select('metodo_id, metodo_nombre, monto, creado_en').eq('negocio_id', neg)
      .gte('creado_en', desde.toISOString()).lt('creado_en', hasta.toISOString()),
    sb.from('metodos_pago').select('id, nombre, icono, afecta_caja').eq('negocio_id', neg).order('orden').order('creado_en')
  ]);

  const dia = diaR.data || { saldo_anterior: 0, arqueo_billetes: {}, cerrada: false, _nuevo: true };
  const movimientos = movR.data || [];
  const pagos = pagosR.data || [];
  const metodos = metR.data || [];

  const efIds = new Set(), efNames = new Set();
  metodos.forEach(m => { if (m.afecta_caja) { efIds.add(m.id); efNames.add((m.nombre || '').toLowerCase()); } });

  // Mapa del día: arranca con todos los métodos configurados (en 0).
  const mapa = {};
  metodos.forEach(m => { mapa[m.nombre] = { nombre: m.nombre, icono: m.icono || 'generico', count: 0, monto: 0 }; });
  let totalCobrado = 0, totalOps = 0, efectivoCobrado = 0;
  pagos.forEach(p => {
    const k = p.metodo_nombre || 'Otro';
    if (!mapa[k]) mapa[k] = { nombre: k, icono: 'generico', count: 0, monto: 0 };
    const monto = Number(p.monto) || 0;
    mapa[k].count++; mapa[k].monto += monto;
    totalCobrado += monto; totalOps++;
    const esEf = (p.metodo_id && efIds.has(p.metodo_id)) || efNames.has((p.metodo_nombre || '').toLowerCase());
    if (esEf) efectivoCobrado += monto;
  });

  window._caja = {
    fecha: fechaStr, dia, movimientos, metodos, efNames,
    efectivoCobrado, mapa, totalCobrado, totalOps,
    billetes: Object.assign({}, dia.arqueo_billetes || {})
  };
  cajaRender();
}

function cajaRender() {
  const st = window._caja;
  const wrap = document.getElementById('caja-wrap');
  if (!wrap) return;

  const calIco = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="color:#8a8f9c;"><path d="M8 2v4"/><path d="M16 2v4"/><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18"/></svg>';
  const mapIco = '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>';
  const coinIco = '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="8" cy="8" r="6"/><path d="M18.09 10.37A6 6 0 1 1 10.34 18"/><path d="M7 6h1v4"/><path d="m16.71 13.88.7.71-2.82 2.82"/></svg>';

  const mapaArr = Object.values(st.mapa);
  const mapaCards = mapaArr.map(m => `
    <div class="cj-mcard">
      <div class="cj-mcard-top"><span class="cj-mcard-ico ${_cjIcoClase(m.icono)}">${_cjIco(m.icono, 17)}</span> ${_cjEsc(m.nombre)}</div>
      <div class="cj-mcard-val">${formatearPrecio(m.monto)}</div>
      <div class="cj-mcard-ops">${m.count} ${m.count === 1 ? 'operación' : 'operaciones'}</div>
    </div>`).join('');
  const totalCard = `
    <div class="cj-mcard total">
      <div class="cj-mcard-top">Total cobrado</div>
      <div class="cj-mcard-val">${formatearPrecio(st.totalCobrado)}</div>
      <div class="cj-mcard-ops">${st.totalOps} ${st.totalOps === 1 ? 'operación' : 'operaciones'}</div>
    </div>`;

  const gastos = st.movimientos.filter(m => m.tipo === 'gasto');
  const retiros = st.movimientos.filter(m => m.tipo === 'retiro');

  const filaMov = (m, mostrarMet) => `
    <div class="cj-mov">
      <div>
        <span class="cj-mov-con">${_cjEsc(m.concepto || '(sin concepto)')}</span>
        ${mostrarMet && m.metodo ? ` · <span class="cj-mov-met">${_cjEsc(m.metodo)}</span>` : ''}
      </div>
      <div class="cj-mov-r">
        <span class="cj-mov-monto">${formatearPrecio(m.monto)}</span>
        <button class="cj-mov-x" title="Quitar" onclick="cajaBorrarMov('${m.id}')">&times;</button>
      </div>
    </div>`;

  const billRows = _CJ_DENOMS.map(d => {
    const q = st.billetes[d] || st.billetes[String(d)] || '';
    const sub = (Number(q) || 0) * d;
    return `
      <div class="cj-bill-row">
        <span>${formatearPrecio(d)}</span>
        <input type="number" min="0" step="1" value="${q}" data-denom="${d}"
          oninput="cajaBillete(${d}, this.value, false)" onchange="cajaBillete(${d}, this.value, true)">
        <span class="cj-bill-sub" id="cj-sub-${d}">${formatearPrecio(sub)}</span>
      </div>`;
  }).join('');

  wrap.innerHTML = `
    <div class="cj-top">
      <div>
        <div class="cj-titulo">Caja</div>
        <button class="cj-dia-hoy" onclick="cajaHoy()">Ir a hoy</button>
      </div>
      <div class="cj-dia">
        <button class="cj-dia-nav" title="Día anterior" onclick="cajaCambiarDia(-1)">‹</button>
        <span class="cj-dia-lbl">${_cjFechaLarga(st.fecha)}</span>
        <button class="cj-dia-nav" title="Día siguiente" onclick="cajaCambiarDia(1)">›</button>
      </div>
      <div class="cj-saldo">
        <label>Saldo anterior</label>
        <input type="text" id="cj-saldo" value="${formatearPrecio(st.dia.saldo_anterior || 0)}" onchange="cajaSaldo(this.value)">
      </div>
    </div>

    <div class="cj-sec-lbl">${mapIco} Operaciones del día</div>
    <div class="cj-mapa">${mapaCards}${totalCard}</div>

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
        <div class="cj-hint">Los retiros salen siempre del efectivo.</div>
      </div>
    </div>

    <div class="cj-sec-lbl">${coinIco} Arqueo de efectivo</div>
    <div class="cj-arqueo">
      <div class="cj-arq-grid">
        <div>
          <div class="cj-sec-lbl" style="margin-bottom:10px;">Contador de billetes</div>
          <div class="cj-bill">${billRows}</div>
        </div>
        <div>
          <div class="cj-sec-lbl" style="margin-bottom:10px;">Resultado</div>
          <div class="cj-res-row"><span class="lbl">Saldo anterior</span><span>${formatearPrecio(st.dia.saldo_anterior || 0)}</span></div>
          <div class="cj-res-row sep"><span class="lbl">Efectivo cobrado</span><span>${formatearPrecio(st.efectivoCobrado)}</span></div>
          <div class="cj-res-row sep"><span class="lbl">Gastos en efectivo</span><span id="cj-gastos-ef">−</span></div>
          <div class="cj-res-row sep"><span class="lbl">Retiros a banco</span><span id="cj-retiros">−</span></div>
          <div class="cj-res-row sep"><span class="lbl" style="font-weight:600;color:#2b2b3a;">Efectivo teórico</span><span id="cj-teorico" style="font-weight:700;"></span></div>
          <div class="cj-res-row"><span class="lbl">Efectivo contado</span><span id="cj-contado" style="font-weight:700;"></span></div>
          <div class="cj-dif">
            <span class="cj-dif-tit">Diferencia</span>
            <span class="cj-dif-badge ok" id="cj-dif">$ 0</span>
          </div>
          <button class="cj-cerrar" onclick="cajaCerrarCaja()"><svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="11" x="3" y="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg> Cerrar caja del día</button>
          <div class="cj-cerrada" id="cj-cerrada" style="display:${st.dia.cerrada ? 'block' : 'none'};">Caja cerrada</div>
        </div>
      </div>
    </div>`;

  cajaRecalcArqueo();
}

// ------------------------------------------------------------
// Recalcular arqueo (sin recargar)
// ------------------------------------------------------------
function cajaRecalcArqueo() {
  const st = window._caja;
  if (!st) return;
  const saldo = Number(st.dia.saldo_anterior) || 0;
  const gastosEf = st.movimientos
    .filter(m => m.tipo === 'gasto' && st.efNames.has((m.metodo || '').toLowerCase()))
    .reduce((s, m) => s + (Number(m.monto) || 0), 0);
  const retiros = st.movimientos
    .filter(m => m.tipo === 'retiro')
    .reduce((s, m) => s + (Number(m.monto) || 0), 0);

  const teorico = saldo + st.efectivoCobrado - gastosEf - retiros;
  let contado = 0;
  _CJ_DENOMS.forEach(d => { contado += (Number(st.billetes[d]) || 0) * d; });
  const dif = Math.round((contado - teorico) * 100) / 100;

  const set = (id, v) => { const e = document.getElementById(id); if (e) e.textContent = v; };
  set('cj-gastos-ef', '− ' + formatearPrecio(gastosEf));
  set('cj-retiros', '− ' + formatearPrecio(retiros));
  set('cj-teorico', formatearPrecio(teorico));
  set('cj-contado', formatearPrecio(contado));

  const badge = document.getElementById('cj-dif');
  if (badge) {
    const ok = Math.abs(dif) < 0.5;
    badge.className = 'cj-dif-badge ' + (ok ? 'ok' : 'bad');
    badge.textContent = ok ? '$ 0 · ok' : (dif > 0 ? 'Sobra ' + formatearPrecio(dif) : 'Falta ' + formatearPrecio(-dif));
  }
}

// ------------------------------------------------------------
// Acciones
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

async function cajaSaldo(val) {
  const n = _cjParse(val);
  window._caja.dia.saldo_anterior = n;
  const inp = document.getElementById('cj-saldo');
  if (inp) inp.value = formatearPrecio(n);
  cajaRecalcArqueo();
  await _cjUpsertDia({ saldo_anterior: n });
}

function cajaBillete(denom, val, persistir) {
  const st = window._caja;
  const q = Math.max(0, Math.floor(Number(val) || 0));
  st.billetes[denom] = q;
  const sub = document.getElementById('cj-sub-' + denom);
  if (sub) sub.textContent = formatearPrecio(q * denom);
  cajaRecalcArqueo();
  if (persistir) _cjUpsertDia({ arqueo_billetes: st.billetes });
}

async function cajaCerrarCaja() {
  const st = window._caja;
  let contado = 0;
  _CJ_DENOMS.forEach(d => { contado += (Number(st.billetes[d]) || 0) * d; });

  const ok = await confirmarModal({
    titulo: 'Cerrar caja del día',
    texto: `Vas a guardar el arqueo de ${_cjFechaLarga(st.fecha)} con un efectivo contado de ${formatearPrecio(contado)}. ¿Confirmás?`,
    textoSi: 'Cerrar caja', textoNo: 'Cancelar'
  });
  if (!ok) return;

  const row = await _cjUpsertDia({ arqueo_billetes: st.billetes, arqueo_contado: contado, cerrada: true });
  if (row) {
    mostrarMensaje('Caja cerrada', 'exito');
    const c = document.getElementById('cj-cerrada');
    if (c) c.style.display = 'block';
  }
}

// ------------------------------------------------------------
// Gastos y retiros
// ------------------------------------------------------------
function cajaNuevoMov(tipo) {
  const st = window._caja;
  const esGasto = tipo === 'gasto';
  const metOpts = st.metodos.map(m => `<option value="${_cjEsc(m.nombre)}">${_cjEsc(m.nombre)}</option>`).join('');
  abrirModal(`
    <div class="modal-header">
      <div class="modal-titulo">${esGasto ? 'Nuevo gasto' : 'Nuevo retiro a banco'}</div>
      <button class="modal-cerrar" onclick="cerrarModal()">&times;</button>
    </div>
    <div class="modal-body" style="display:flex;flex-direction:column;gap:14px;">
      <div>
        <label style="font-size:13px;color:#8a8f9c;display:block;margin-bottom:5px;">Concepto</label>
        <input type="text" id="cj-mov-con" placeholder="${esGasto ? 'Ej. insumos, librería…' : 'Ej. depósito mediodía'}"
          style="width:100%;box-sizing:border-box;padding:10px 12px;border:1px solid #e6e3f2;border-radius:9px;outline:none;">
      </div>
      ${esGasto ? `
      <div>
        <label style="font-size:13px;color:#8a8f9c;display:block;margin-bottom:5px;">Pagado con</label>
        <select id="cj-mov-met" style="width:100%;box-sizing:border-box;padding:10px 12px;border:1px solid #e6e3f2;border-radius:9px;outline:none;background:#fff;">
          ${metOpts || '<option value="">—</option>'}
        </select>
      </div>` : ''}
      <div>
        <label style="font-size:13px;color:#8a8f9c;display:block;margin-bottom:5px;">Importe</label>
        <input type="number" id="cj-mov-monto" min="0" step="0.01" placeholder="0"
          style="width:100%;box-sizing:border-box;padding:10px 12px;border:1px solid #e6e3f2;border-radius:9px;outline:none;text-align:right;">
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
  const monto = _cjParse(document.getElementById('cj-mov-monto')?.value);
  const metodo = tipo === 'gasto' ? (document.getElementById('cj-mov-met')?.value || null) : 'Efectivo';
  if (monto <= 0) { mostrarMensaje('Poné un importe mayor a cero', 'advertencia'); return; }

  const r = await sb.from('caja_movimientos').insert({
    negocio_id: usuarioActual.negocio_id,
    fecha: window._caja.fecha,
    tipo, concepto: concepto || null, metodo, monto,
    creado_por: usuarioActual.id
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

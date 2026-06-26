// ============================================================
// cobro.js — Pantalla de cobro (recepción / negocio)
// ============================================================
// Lee las atenciones y productos cargados por el profesional en la
// ficha, permite ajustarlos (recepción saca/agrega/cambia), suma el
// total, registra el pago en `cobros`, descuenta el stock de los
// productos vendidos y deja el turno en estado 'cobrado'.
//
// Permiso: negocio y recepcion. (profesional_full queda pendiente de
// la columna en DB.)
// ============================================================

const COBRO_METODOS = ['Efectivo', 'Débito', 'Crédito', 'Transferencia', 'Otro'];

async function abrirCobro(turnoId) {
  if (!['negocio', 'recepcion'].includes(usuarioActual.rol)) {
    mostrarMensaje('Solo recepción o el dueño pueden cobrar', 'advertencia');
    return;
  }

  const { data: turno } = await sb.from('turnos')
    .select('*, pacientes(nombre, apellido), profesionales(nombre)')
    .eq('id', turnoId).single();
  if (!turno) { mostrarMensaje('Turno no encontrado', 'error'); return; }

  if (turno.estado === 'cobrado') { mostrarMensaje('Este turno ya fue cobrado', 'advertencia'); return; }
  if (turno.estado !== 'finalizado') { mostrarMensaje('El turno tiene que estar finalizado para cobrar', 'advertencia'); return; }

  const { data: tipos } = await sb.from('tipos_atencion').select('*').eq('activo', true).order('nombre');
  const { data: productosCat } = await sb.from('productos').select('*').eq('activo', true).order('nombre');
  const { data: atExist } = await sb.from('turno_atenciones').select('*').eq('turno_id', turnoId);
  const { data: prodExist } = await sb.from('turno_productos').select('*').eq('turno_id', turnoId);
  const { data: fichaAt } = await sb.from('fichas_atencion').select('proxima_visita_nota').eq('turno_id', turnoId).maybeSingle();

  const lineasAt = (atExist || []).map(a => {
    const c = (tipos || []).find(t => t.id === a.tipo_atencion_id);
    return { tipo_atencion_id: a.tipo_atencion_id, nombre: c?.nombre || 'Atención', cantidad: a.cantidad || 1, precio: a.precio_unitario ?? c?.precio ?? 0 };
  });
  const lineasProd = (prodExist || []).map(p => {
    const c = (productosCat || []).find(x => x.id === p.producto_id);
    return { producto_id: p.producto_id, nombre: c?.nombre || 'Producto', descripcion: c?.descripcion || '', cantidad: p.cantidad || 1, precio: p.precio_unitario ?? c?.precio ?? 0 };
  });

  const totalLineas = arr => arr.reduce((s, l) => s + (l.precio * l.cantidad), 0);

  const pac = turno.pacientes || {};
  const inic = ((pac.apellido?.[0] || '') + (pac.nombre?.[0] || '')).toUpperCase() || '?';
  const fechaLarga = new Date(turno.fecha_hora).toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' });

  const sv = (p, w = 16) => `<svg viewBox="0 0 24 24" width="${w}" height="${w}" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${p}</svg>`;
  const I = {
    at:    sv('<rect x="8" y="2" width="8" height="4" rx="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="M9 13h6"/><path d="M9 17h4"/>'),
    prod:  sv('<path d="M6 7h12l-1 13a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L6 7Z"/><path d="M9 7V5a3 3 0 0 1 6 0v2"/>'),
    pago:  sv('<rect width="20" height="14" x="2" y="5" rx="2"/><line x1="2" x2="22" y1="10" y2="10"/>'),
    wallet:sv('<path d="M3 7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z"/><path d="M16 12h.01"/><path d="M3 9h18"/>', 20),
    bag:   sv('<path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/>', 22),
    efvo:  sv('<rect width="20" height="12" x="2" y="6" rx="2"/><circle cx="12" cy="12" r="2"/><path d="M6 12h.01M18 12h.01"/>'),
    card:  sv('<rect width="20" height="14" x="2" y="5" rx="2"/><line x1="2" x2="22" y1="10" y2="10"/>'),
    transf:sv('<path d="M3 8h14l-3-3M21 16H7l3 3"/>'),
    shield:sv('<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/>'),
    check: sv('<polyline points="20 6 9 17 4 12"/>'),
    finok: sv('<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>', 14)
  };
  const METODOS = [
    { k: 'Efectivo', ico: I.efvo },
    { k: 'Débito', ico: I.card },
    { k: 'Crédito', ico: I.card },
    { k: 'Transferencia', ico: I.transf },
    { k: 'Obra social / Prepaga', ico: I.shield, full: true }
  ];

  window._cobro = {
    lineasAt, lineasProd,
    metodo: 'Efectivo',

    filaItem(l, i, tipo) {
      const tint = tipo === 'prod' ? 'cb-ico-verde' : 'cb-ico-violeta';
      return `<div class="cb-item">
        <div class="cb-item-ico ${tint}">${tipo === 'prod' ? I.prod : I.at}</div>
        <div class="cb-item-body">
          <div class="cb-item-nom">${l.nombre}</div>
          <div class="cb-item-sub">Cantidad: ${l.cantidad}</div>
        </div>
        <div class="cb-item-precio">${formatearPrecio(l.precio * l.cantidad)}</div>
        <button type="button" class="cb-item-del" title="Quitar" onclick="_cobro.quitar('${tipo}', ${i})">&times;</button>
      </div>`;
    },
    renderAt() {
      const c = document.getElementById('cobro-list-at');
      if (!c) return;
      c.innerHTML = this.lineasAt.length
        ? this.lineasAt.map((l, i) => this.filaItem(l, i, 'at')).join('')
        : `<div class="cb-vacio">${I.at} <div><strong>Sin atenciones</strong><div>Agregá al menos una para cobrar.</div></div></div>`;
      this.renderResumen();
    },
    renderProd() {
      const c = document.getElementById('cobro-list-prod');
      if (!c) return;
      c.innerHTML = this.lineasProd.length
        ? this.lineasProd.map((l, i) => this.filaItem(l, i, 'prod')).join('')
        : `<div class="cb-vacio">${I.bag} <div><strong>Aún no se agregaron productos</strong><div>Agregá productos si el paciente compró algo.</div></div></div>`;
      this.renderResumen();
    },
    renderResumen() {
      const sa = totalLineas(this.lineasAt);
      const sp = totalLineas(this.lineasProd);
      const total = sa + sp;
      const set = (id, v) => { const e = document.getElementById(id); if (e) e.textContent = v; };
      set('cobro-sub-at', formatearPrecio(sa));
      set('cobro-sub-prod', formatearPrecio(sp));
      set('cobro-total', formatearPrecio(total));
      set('cobro-hero-total', formatearPrecio(total));
      const btn = document.getElementById('cobro-btn-txt');
      if (btn) btn.textContent = 'Registrar pago ' + formatearPrecio(total);
      this.renderBanner();
    },
    renderBanner() {
      const na = this.lineasAt.length, np = this.lineasProd.length;
      const set = (id, v) => { const e = document.getElementById(id); if (e) e.textContent = v; };
      set('cobro-ban-at', `${na} ${na === 1 ? 'atención' : 'atenciones'}`);
      set('cobro-ban-prod', `${np} ${np === 1 ? 'producto' : 'productos'}`);
      set('cobro-ban-metodo', 'Método: ' + this.metodo);
    },
    setMetodo(m) {
      this.metodo = m;
      document.querySelectorAll('.cb-metodo').forEach(b => b.classList.toggle('on', b.dataset.metodo === m));
      this.renderBanner();
    },

    abrirPicker(tipo) {
      this._pt = tipo;
      const titulo = tipo === 'prod' ? 'Agregar producto' : 'Agregar atención';
      const ov = document.createElement('div');
      ov.id = 'cb-picker';
      ov.className = 'cb-picker-ov';
      ov.onclick = (e) => { if (e.target === ov) _cobro.cerrarPicker(); };
      ov.innerHTML = `
        <div class="cb-picker-modal">
          <div class="cb-picker-head"><span>${titulo}</span><button type="button" class="cb-picker-x" onclick="_cobro.cerrarPicker()">&times;</button></div>
          <input type="text" class="cb-picker-search" placeholder="Buscar…" oninput="_cobro.renderPicker(this.value)">
          <div class="cb-picker-list" id="cb-picker-list"></div>
        </div>`;
      document.body.appendChild(ov);
      this.renderPicker('');
      setTimeout(() => ov.querySelector('.cb-picker-search')?.focus(), 30);
    },
    renderPicker(filtro) {
      const tipo = this._pt;
      const cat = (tipo === 'prod' ? productosCat : tipos) || [];
      const f = (filtro || '').trim().toLowerCase();
      const items = cat.filter(c => !f || (c.nombre || '').toLowerCase().includes(f));
      const cont = document.getElementById('cb-picker-list');
      if (!cont) return;
      cont.innerHTML = items.length ? items.map(c => {
        const sub = tipo === 'prod' ? (c.descripcion || '') : '';
        const tint = tipo === 'prod' ? 'cb-ico-verde' : 'cb-ico-violeta';
        return `<button type="button" class="cb-picker-item" onclick="_cobro.elegirPicker('${c.id}')">
          <div class="cb-item-ico ${tint}">${tipo === 'prod' ? I.prod : I.at}</div>
          <div class="cb-item-body"><div class="cb-item-nom">${c.nombre}</div>${sub ? `<div class="cb-item-sub">${sub}</div>` : ''}</div>
          <div class="cb-item-precio">${formatearPrecio(c.precio || 0)}</div>
        </button>`;
      }).join('') : '<div class="cb-picker-vacio">Sin resultados</div>';
    },
    cerrarPicker() { const o = document.getElementById('cb-picker'); if (o) o.remove(); },
    elegirPicker(id) {
      const tipo = this._pt;
      if (tipo === 'prod') {
        const c = (productosCat || []).find(x => x.id === id); if (!c) return;
        const ya = this.lineasProd.find(l => l.producto_id === id);
        if (ya) ya.cantidad += 1;
        else this.lineasProd.push({ producto_id: id, nombre: c.nombre, descripcion: c.descripcion || '', cantidad: 1, precio: c.precio || 0 });
        this.renderProd();
      } else {
        const c = (tipos || []).find(t => t.id === id); if (!c) return;
        const ya = this.lineasAt.find(l => l.tipo_atencion_id === id);
        if (ya) ya.cantidad += 1;
        else this.lineasAt.push({ tipo_atencion_id: id, nombre: c.nombre, cantidad: 1, precio: c.precio || 0 });
        this.renderAt();
      }
      this.cerrarPicker();
    },
    quitar(tipo, i) {
      if (tipo === 'prod') { this.lineasProd.splice(i, 1); this.renderProd(); }
      else { this.lineasAt.splice(i, 1); this.renderAt(); }
    }
  };

  abrirModal(`
    <style>
      .modal { max-width: 800px; }
      .cb-body { background:#fff; }
      .cb-hero { display:flex; align-items:center; gap:16px; background:linear-gradient(120deg,#F6F4FE,#FBFAFF); border:1px solid var(--borde-tenue); border-radius:16px; padding:15px 18px; margin-bottom:20px; }
      .cb-avatar { width:56px; height:56px; flex:none; border-radius:50%; background:linear-gradient(135deg,#C9BEF6,#9E8DE8); color:#fff; display:flex; align-items:center; justify-content:center; font-size:18px; font-weight:700; }
      .cb-hero-info { flex:1; min-width:0; }
      .cb-hero-nombre { font-size:19px; font-weight:700; }
      .cb-hero-line { display:flex; align-items:center; gap:6px; font-size:12.5px; color:var(--texto-secundario); margin-top:3px; }
      .cb-hero-line svg { width:14px; height:14px; flex:none; }
      .cb-badge-fin { display:inline-flex; align-items:center; gap:5px; margin-top:7px; font-size:11.5px; font-weight:600; color:var(--exito); background:var(--exito-claro); border-radius:20px; padding:3px 10px; }
      .cb-hero-total { display:flex; align-items:center; gap:12px; background:var(--exito-claro); border:1px solid rgba(31,157,107,.3); border-radius:14px; padding:12px 18px; }
      .cb-hero-total-ico { width:42px; height:42px; border-radius:50%; background:rgba(31,157,107,.16); color:var(--exito); display:flex; align-items:center; justify-content:center; flex:none; }
      .cb-hero-total-lbl { font-size:12px; color:#1F9D6B; }
      .cb-hero-total-val { font-size:26px; font-weight:700; color:#1F9D6B; line-height:1.1; }

      .cb-grid { display:grid; grid-template-columns:1fr 1fr; gap:20px 24px; }
      .cb-sec-head { display:flex; align-items:center; justify-content:space-between; margin-bottom:10px; }
      .cb-sec-lbl { display:flex; align-items:center; gap:8px; font-size:13.5px; font-weight:600; }
      .cb-sec-lbl svg { color:var(--primario); }
      .cb-add { display:inline-flex; align-items:center; gap:6px; font-size:12.5px; font-weight:600; border:none; border-radius:8px; padding:6px 11px; cursor:pointer; background:var(--primario-claro); color:var(--primario); }
      .cb-add.verde { background:var(--exito-claro); color:var(--exito); }
      .cb-card { border:1px solid var(--borde-tenue); border-radius:12px; padding:6px; margin-bottom:16px; }
      .cb-item { display:flex; align-items:center; gap:11px; padding:9px 7px; border-bottom:1px solid var(--borde-tenue); }
      .cb-item:last-child { border-bottom:none; }
      .cb-item-ico { width:34px; height:34px; flex:none; border-radius:9px; display:flex; align-items:center; justify-content:center; }
      .cb-ico-violeta { background:var(--primario-claro); color:var(--primario); }
      .cb-ico-verde { background:var(--exito-claro); color:var(--exito); }
      .cb-item-body { flex:1; min-width:0; }
      .cb-item-nom { font-size:13px; font-weight:600; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
      .cb-item-sub { font-size:11.5px; color:var(--texto-secundario); }
      .cb-item-precio { font-size:13.5px; font-weight:700; white-space:nowrap; }
      .cb-item-del { border:none; background:transparent; color:var(--texto-tenue); font-size:18px; line-height:1; cursor:pointer; padding:0 4px; }
      .cb-item-del:hover { color:var(--peligro); }
      .cb-vacio { display:flex; align-items:center; gap:12px; padding:16px 10px; color:var(--texto-secundario); font-size:12px; text-align:left; }
      .cb-vacio svg { color:var(--borde); flex:none; }
      .cb-vacio strong { color:var(--texto); font-size:12.5px; display:block; }

      .cb-metodos { display:grid; grid-template-columns:1fr 1fr; gap:9px; margin-bottom:16px; }
      .cb-metodo { position:relative; display:flex; align-items:center; gap:9px; border:1px solid var(--borde-tenue); border-radius:11px; padding:11px 12px; font-size:13px; font-weight:600; cursor:pointer; background:#fff; transition:.12s; text-align:left; }
      .cb-metodo svg { color:var(--texto-secundario); }
      .cb-metodo.full { grid-column:1 / -1; }
      .cb-metodo:hover { border-color:var(--primario-medio); }
      .cb-metodo.on { border-color:var(--primario); background:var(--primario-claro); color:var(--primario); }
      .cb-metodo.on svg { color:var(--primario); }
      .cb-metodo-check { position:absolute; top:-6px; right:-6px; width:18px; height:18px; border-radius:50%; background:var(--primario); color:#fff; display:none; align-items:center; justify-content:center; }
      .cb-metodo.on .cb-metodo-check { display:flex; }

      .cb-resumen { background:var(--fondo); border:1px solid var(--borde-tenue); border-radius:12px; padding:14px 16px; }
      .cb-resumen-tit { font-size:12px; font-weight:600; color:var(--texto-secundario); margin-bottom:10px; }
      .cb-resumen-fila { display:flex; justify-content:space-between; font-size:13px; margin-bottom:7px; color:var(--texto-secundario); }
      .cb-resumen-fila span:last-child { color:var(--texto); font-weight:600; }
      .cb-resumen-sep { border-top:1px dashed var(--borde); margin:10px 0; }
      .cb-resumen-total { display:flex; justify-content:space-between; align-items:baseline; font-size:14px; font-weight:700; }
      .cb-resumen-total .v { font-size:21px; color:var(--primario); }

      .cb-listo { display:flex; align-items:center; gap:14px; background:var(--exito-claro); border:1px solid rgba(31,157,107,.28); border-radius:14px; padding:13px 16px; margin-top:18px; }
      .cb-listo-ico { width:34px; height:34px; border-radius:50%; background:var(--exito); color:#fff; display:flex; align-items:center; justify-content:center; flex:none; }
      .cb-listo-tit { font-size:13.5px; font-weight:700; color:#0B5E3E; }
      .cb-listo-meta { display:flex; gap:16px; font-size:12px; color:#1F9D6B; margin-top:3px; }
      .cb-listo-meta span { display:inline-flex; align-items:center; gap:5px; }
      .cb-listo-meta svg { width:13px; height:13px; }

      .cb-footer-right { margin-left:auto; display:flex; gap:10px; }
      .cb-registrar { display:inline-flex; align-items:center; gap:8px; background:var(--exito); border-color:var(--exito); }
      .cb-registrar:hover { filter:brightness(.96); }

      .cb-picker-ov { position:fixed; inset:0; background:rgba(20,16,40,.42); display:flex; align-items:center; justify-content:center; z-index:9999; padding:20px; }
      .cb-picker-modal { background:#fff; width:430px; max-width:calc(100vw - 40px); max-height:72vh; display:flex; flex-direction:column; border-radius:16px; box-shadow:0 22px 60px rgba(20,16,40,.32); overflow:hidden; }
      .cb-picker-head { display:flex; align-items:center; justify-content:space-between; padding:15px 18px; border-bottom:1px solid var(--borde-tenue); font-size:14.5px; font-weight:700; background:linear-gradient(120deg,#F6F4FE,#FFFFFF); }
      .cb-picker-x { border:none; background:transparent; font-size:22px; line-height:1; color:var(--texto-secundario); cursor:pointer; }
      .cb-picker-search { margin:14px 16px 8px; padding:10px 13px; border:1px solid var(--borde-tenue); border-radius:10px; font:inherit; font-size:13px; outline:none; }
      .cb-picker-search:focus { border-color:var(--primario-medio); }
      .cb-picker-list { overflow-y:auto; padding:4px 10px 12px; }
      .cb-picker-item { width:100%; display:flex; align-items:center; gap:11px; text-align:left; background:#fff; border:1px solid transparent; border-radius:11px; padding:9px 10px; cursor:pointer; }
      .cb-picker-item:hover { background:var(--primario-claro); }
      .cb-picker-vacio { font-size:13px; color:var(--texto-secundario); text-align:center; padding:24px; }
    </style>

    <div class="modal-header">
      <div class="modal-titulo">Cobrar</div>
      <button class="modal-cerrar" onclick="cerrarModal()">&times;</button>
    </div>
    <div class="modal-body cb-body">

      <div class="cb-hero">
        <div class="cb-avatar">${inic}</div>
        <div class="cb-hero-info">
          <div class="cb-hero-nombre">${pac.apellido || ''}, ${pac.nombre || ''}</div>
          <div class="cb-hero-line">${I.at} ${turno.profesionales?.nombre || ''}</div>
          <div class="cb-hero-line">${sv('<path d="M8 2v4"/><path d="M16 2v4"/><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18"/>', 14)} ${fechaLarga}</div>
          <span class="cb-badge-fin">${I.finok} Atención finalizada</span>
        </div>
        <div class="cb-hero-total">
          <div class="cb-hero-total-ico">${I.wallet}</div>
          <div>
            <div class="cb-hero-total-lbl">Total a cobrar</div>
            <div class="cb-hero-total-val" id="cobro-hero-total">${formatearPrecio(0)}</div>
          </div>
        </div>
      </div>

      <div class="cb-grid">
        <div>
          <div class="cb-sec-head">
            <div class="cb-sec-lbl">${I.at} Atenciones</div>
            <button type="button" class="cb-add" onclick="_cobro.abrirPicker('at')">+ Agregar atención</button>
          </div>
          <div class="cb-card" id="cobro-list-at"></div>

          <div class="cb-sec-head">
            <div class="cb-sec-lbl">${I.prod} Productos</div>
            <button type="button" class="cb-add verde" onclick="_cobro.abrirPicker('prod')">+ Agregar producto</button>
          </div>
          <div class="cb-card" id="cobro-list-prod"></div>
          ${fichaAt?.proxima_visita_nota ? `
          <div class="cb-sec-lbl" style="margin:6px 0 10px;">${sv('<path d="M8 2v4"/><path d="M16 2v4"/><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18"/>', 16)} Próxima visita sugerida</div>
          <div style="border:1px solid var(--borde-tenue); border-radius:12px; padding:12px 14px; font-size:13px; color:var(--texto); background:var(--fondo);">${String(fichaAt.proxima_visita_nota).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>
          ` : ''}
        </div>

        <div>
          <div class="cb-sec-lbl" style="margin-bottom:10px;">${I.pago} Método de pago</div>
          <div class="cb-metodos">
            ${METODOS.map(m => `<button type="button" class="cb-metodo${m.full ? ' full' : ''}${m.k === 'Efectivo' ? ' on' : ''}" data-metodo="${m.k}" onclick="_cobro.setMetodo('${m.k}')">
              ${m.ico} <span>${m.k}</span>
              <span class="cb-metodo-check">${sv('<polyline points="20 6 9 17 4 12"/>', 11)}</span>
            </button>`).join('')}
          </div>

          <div class="cb-resumen">
            <div class="cb-resumen-tit">Resumen del cobro</div>
            <div class="cb-resumen-fila"><span>Subtotal por atenciones</span><span id="cobro-sub-at">${formatearPrecio(0)}</span></div>
            <div class="cb-resumen-fila"><span>Productos</span><span id="cobro-sub-prod">${formatearPrecio(0)}</span></div>
            <div class="cb-resumen-fila"><span>Descuentos</span><span>${formatearPrecio(0)}</span></div>
            <div class="cb-resumen-sep"></div>
            <div class="cb-resumen-total"><span>TOTAL</span><span class="v" id="cobro-total">${formatearPrecio(0)}</span></div>
          </div>
        </div>
      </div>

      <div class="cb-listo">
        <div class="cb-listo-ico">${I.check}</div>
        <div>
          <div class="cb-listo-tit">Listo para cobrar</div>
          <div class="cb-listo-meta">
            <span>${I.at} <b id="cobro-ban-at"></b></span>
            <span>${I.prod} <b id="cobro-ban-prod"></b></span>
            <span>${I.pago} <b id="cobro-ban-metodo"></b></span>
          </div>
        </div>
      </div>

    </div>
    <div class="modal-footer">
      <button type="button" class="btn" onclick="cerrarModal()">Cancelar</button>
      <div class="cb-footer-right">
        <button type="button" id="cobro-btn" class="btn btn-primary-sm cb-registrar" onclick="confirmarCobro('${turnoId}')">${I.check} <span id="cobro-btn-txt">Registrar pago</span></button>
      </div>
    </div>
  `);

  _cobro.renderAt();
  _cobro.renderProd();
  _cobro.setMetodo('Efectivo');
}

async function confirmarCobro(turnoId) {
  if (!_cobro || _cobro.lineasAt.length === 0) {
    mostrarMensaje('Tiene que haber al menos una atención para cobrar', 'advertencia');
    return;
  }

  const btn = document.getElementById('cobro-btn');
  const btnTxt = document.getElementById('cobro-btn-txt');
  if (btn) btn.disabled = true;
  if (btnTxt) btnTxt.textContent = 'Cobrando…';

  const metodo = _cobro.metodo || null;
  const total = _cobro.lineasAt.reduce((s, l) => s + l.precio * l.cantidad, 0)
              + _cobro.lineasProd.reduce((s, l) => s + l.precio * l.cantidad, 0);

  // 1) Persistir las líneas finales (recepción pudo haberlas ajustado)
  await sb.from('turno_atenciones').delete().eq('turno_id', turnoId);
  await sb.from('turno_productos').delete().eq('turno_id', turnoId);

  if (_cobro.lineasAt.length) {
    const filas = _cobro.lineasAt.map(l => ({
      turno_id: turnoId, tipo_atencion_id: l.tipo_atencion_id,
      cantidad: l.cantidad, precio_unitario: l.precio,
      negocio_id: usuarioActual.negocio_id
    }));
    const r = await sb.from('turno_atenciones').insert(filas);
    if (r.error) { mostrarMensaje('Error en atenciones: ' + r.error.message, 'error'); if (btn) btn.disabled = false; return; }
  }
  if (_cobro.lineasProd.length) {
    const filas = _cobro.lineasProd.map(l => ({
      turno_id: turnoId, producto_id: l.producto_id,
      cantidad: l.cantidad, precio_unitario: l.precio,
      negocio_id: usuarioActual.negocio_id
    }));
    const r = await sb.from('turno_productos').insert(filas);
    if (r.error) { mostrarMensaje('Error en productos: ' + r.error.message, 'error'); if (btn) btn.disabled = false; return; }
  }

  // 2) Registrar el cobro
  const { error: eCobro } = await sb.from('cobros').insert({
    turno_id: turnoId,
    negocio_id: usuarioActual.negocio_id,
    total,
    metodo_pago: metodo,
    cobrado_por: usuarioActual.id
  });
  if (eCobro) { mostrarMensaje('Error al registrar el cobro: ' + eCobro.message, 'error'); if (btn) btn.disabled = false; return; }

  // 3) Descontar stock de los productos vendidos
  for (const l of _cobro.lineasProd) {
    const { data: pr } = await sb.from('productos').select('stock').eq('id', l.producto_id).single();
    const nuevo = Math.max(0, (pr?.stock ?? 0) - l.cantidad);
    await sb.from('productos').update({ stock: nuevo }).eq('id', l.producto_id);
  }

  // 4) Turno cobrado
  const { error: eEstado } = await sb.from('turnos').update({ estado: 'cobrado' }).eq('id', turnoId);
  if (eEstado) {
    mostrarMensaje('El pago se registró pero el turno no pasó a cobrado: ' + eEstado.message, 'error');
    if (btn) btn.disabled = false;
    if (btnTxt) btnTxt.textContent = 'Registrar pago';
    return;
  }

  mostrarMensaje('Cobro registrado por ' + formatearPrecio(total), 'exito');
  cerrarModal();

  const moduloActivo = document.querySelector('.nav-item.active')?.dataset.modulo;
  if (moduloActivo === 'agenda') dibujarAgenda();
  else if (moduloActivo === 'dashboard') renderDashboard(document.getElementById('main'));
}

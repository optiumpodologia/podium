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
  window._cobro = {
    lineasAt, lineasProd,
    pacienteId: turno.paciente_id,
    profesionalId: turno.profesional_id,
    pacienteLabel: `${pac.apellido || ''}, ${(pac.nombre || '').split(' ')[0]}`.replace(/^,\s*/, '').replace(/,\s*$/, '') || 'el paciente',
    proxNota: fichaAt?.proxima_visita_nota || '',
    proxTurno: null,

    // Sección "Próxima visita": muestra la sugerencia + botón para dar el turno,
    // o el turno ya agendado con opción de cambiarlo. Sin salir del cobro.
    renderProx() {
      const c = document.getElementById('cobro-prox');
      if (!c) return;
      const calIco = sv('<path d="M8 2v4"/><path d="M16 2v4"/><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18"/>', 16);
      const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

      if (this.proxTurno) {
        const d = new Date(this.proxTurno.fecha_hora);
        let f = d.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' });
        f = f.charAt(0).toUpperCase() + f.slice(1);
        const h = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
        c.innerHTML = `
          <div class="cb-sec-lbl" style="margin:6px 0 10px;">${calIco} Próximo turno</div>
          <div class="cb-prox">
            <div class="cb-prox-info ok">
              <span class="cb-prox-check">${I.finok}</span>
              <span>${f} · ${h} hs${this.proxTurno.profNombre ? ' · ' + esc(this.proxTurno.profNombre) : ''}</span>
            </div>
            <button type="button" class="cb-prox-btn ghost" onclick="_cobro.darProximoTurno()">Cambiar</button>
          </div>`;
      } else {
        const sugerencia = this.proxNota
          ? esc(this.proxNota)
          : 'Agendá el próximo turno del paciente.';
        c.innerHTML = `
          <div class="cb-sec-lbl" style="margin:6px 0 10px;">${calIco} ${this.proxNota ? 'Próxima visita sugerida' : 'Próximo turno'}</div>
          <div class="cb-prox">
            <div class="cb-prox-info">${sugerencia}</div>
            <button type="button" class="cb-prox-btn" onclick="_cobro.darProximoTurno()">${sv('<circle cx="12" cy="12" r="9"/><path d="M12 8v8M8 12h8"/>', 15)} Dar turno</button>
          </div>`;
      }
    },
    darProximoTurno() {
      const cb = (info) => _cobro.onProxTurno(info);
      if (this.proxTurno && this.proxTurno.id) {
        abrirReprogramar(this.proxTurno.id, this.pacienteId, cb);
      } else {
        abrirDarTurnoPaciente(this.pacienteId, this.pacienteLabel, cb);
      }
    },
    onProxTurno(info) {
      if (!info) return;
      this.proxTurno = { id: info.id || (this.proxTurno && this.proxTurno.id), fecha_hora: info.fecha_hora, profNombre: info.profNombre || '' };
      this.renderProx();
    },

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
      if (btn) btn.textContent = 'Cobrar ' + formatearPrecio(total);
      this.renderBanner();
    },
    renderBanner() {
      const na = this.lineasAt.length, np = this.lineasProd.length;
      const set = (id, v) => { const e = document.getElementById(id); if (e) e.textContent = v; };
      set('cobro-ban-at', `${na} ${na === 1 ? 'atención' : 'atenciones'}`);
      set('cobro-ban-prod', `${np} ${np === 1 ? 'producto' : 'productos'}`);
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

      .cb-grid { display:grid; grid-template-columns:1fr 1fr; gap:20px 24px; align-items:start; }
      .cb-cell { min-width:0; }
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
      .cb-prox { display:flex; align-items:center; gap:12px; border:1px solid var(--borde-tenue); border-radius:12px; padding:11px 13px; background:var(--fondo); }
      .cb-prox-info { flex:1; min-width:0; font-size:13px; color:var(--texto); }
      .cb-prox-info.ok { display:flex; align-items:center; gap:8px; font-weight:600; }
      .cb-prox-check { color:var(--exito); display:inline-flex; flex:none; }
      .cb-prox-btn { flex:none; display:inline-flex; align-items:center; gap:7px; background:var(--primario); color:#fff; border:none; border-radius:10px; padding:9px 14px; font-size:13px; font-weight:600; cursor:pointer; transition:.12s; }
      .cb-prox-btn:hover { filter:brightness(1.06); }
      .cb-prox-btn.ghost { background:#fff; color:var(--primario); border:1px solid var(--primario-medio); }
      .cb-prox-btn.ghost:hover { background:var(--primario-claro); }
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
        <div class="cb-cell">
          <div class="cb-sec-head">
            <div class="cb-sec-lbl">${I.at} Atenciones</div>
            <button type="button" class="cb-add" onclick="_cobro.abrirPicker('at')">+ Agregar atención</button>
          </div>
          <div class="cb-card" id="cobro-list-at"></div>
        </div>

        <div class="cb-cell">
          <div class="cb-sec-head">
            <div class="cb-sec-lbl">${I.prod} Productos</div>
            <button type="button" class="cb-add verde" onclick="_cobro.abrirPicker('prod')">+ Agregar producto</button>
          </div>
          <div class="cb-card" id="cobro-list-prod"></div>
        </div>

        <div class="cb-cell" id="cobro-prox"></div>

        <div class="cb-cell">
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
          </div>
        </div>
      </div>

    </div>
    <div class="modal-footer">
      <button type="button" class="btn" onclick="cerrarModal()">Cancelar</button>
      <div class="cb-footer-right">
        <button type="button" id="cobro-btn" class="btn btn-primary-sm cb-registrar" onclick="abrirModalPago('${turnoId}')">${I.check} <span id="cobro-btn-txt">Cobrar</span></button>
      </div>
    </div>
  `);

  _cobro.renderAt();
  _cobro.renderProd();
  _cobro.renderProx();
}

// ============================================================
// Modal de pago (al apretar Cobrar)
// ============================================================
const _PAGO_ICOS = {
  efectivo: '<rect width="20" height="12" x="2" y="6" rx="2"/><circle cx="12" cy="12" r="2"/><path d="M6 12h.01"/><path d="M18 12h.01"/>',
  tarjeta: '<rect width="20" height="14" x="2" y="5" rx="2"/><line x1="2" x2="22" y1="10" y2="10"/>',
  transferencia: '<line x1="3" x2="21" y1="22" y2="22"/><line x1="6" x2="6" y1="18" y2="11"/><line x1="10" x2="10" y1="18" y2="11"/><line x1="14" x2="14" y1="18" y2="11"/><line x1="18" x2="18" y1="18" y2="11"/><polygon points="12 2 20 7 4 7"/>',
  qr: '<rect width="7" height="7" x="3" y="3" rx="1"/><rect width="7" height="7" x="14" y="3" rx="1"/><rect width="7" height="7" x="3" y="14" rx="1"/><path d="M14 14h3v3h-3z"/><path d="M20 14v7"/><path d="M14 21h7"/>',
  mercadopago: '<rect width="18" height="13" x="3" y="6" rx="2"/><path d="M3 11h18"/><circle cx="16.5" cy="14.5" r="1.5"/>',
  generico: '<path d="M9 17H7A5 5 0 0 1 7 7h2"/><path d="M15 7h2a5 5 0 1 1 0 10h-2"/><line x1="8" x2="16" y1="12" y2="12"/>'
};
function _pagoIco(slug, w = 18) {
  const p = _PAGO_ICOS[slug] || _PAGO_ICOS.generico;
  return `<svg viewBox="0 0 24 24" width="${w}" height="${w}" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${p}</svg>`;
}
function _pagoIcoClase(slug) {
  if (slug === 'efectivo') return 'green';
  if (slug === 'mercadopago') return 'cyan';
  return '';
}

async function abrirModalPago(turnoId) {
  if (!_cobro || _cobro.lineasAt.length === 0) {
    mostrarMensaje('Tiene que haber al menos una atención para cobrar', 'advertencia');
    return;
  }
  const total = _cobro.lineasAt.reduce((s, l) => s + l.precio * l.cantidad, 0)
              + _cobro.lineasProd.reduce((s, l) => s + l.precio * l.cantidad, 0);

  const { data: metodos } = await sb.from('metodos_pago')
    .select('id, nombre, icono')
    .eq('negocio_id', usuarioActual.negocio_id)
    .order('orden').order('creado_en');

  if (!metodos || !metodos.length) {
    mostrarMensaje('Primero configurá los medios de pago en Configuración → Caja', 'advertencia');
    return;
  }

  window._pago = { turnoId, total, metodos, agregados: [] };

  const wallet = '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M19 7V5a2 2 0 0 0-2-2H5a2 2 0 0 0 0 4h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5"/><path d="M16 14h.01"/></svg>';
  const lock = '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="11" x="3" y="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>';
  const listIco = '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><line x1="8" x2="21" y1="6" y2="6"/><line x1="8" x2="21" y1="12" y2="12"/><line x1="8" x2="21" y1="18" y2="18"/><line x1="3" x2="3.01" y1="6" y2="6"/><line x1="3" x2="3.01" y1="12" y2="12"/><line x1="3" x2="3.01" y1="18" y2="18"/></svg>';

  const ov = document.createElement('div');
  ov.id = 'pago-ov';
  ov.className = 'pg-ov';
  ov.onclick = (e) => { if (e.target === ov) _pagoCerrar(); };
  ov.innerHTML = `
    <style>
      .pg-ov{position:fixed;inset:0;background:rgba(20,18,40,.45);display:flex;align-items:center;justify-content:center;z-index:200;padding:20px;}
      .pg-modal{background:#fff;border-radius:20px;width:760px;max-width:96vw;max-height:92vh;overflow:auto;box-shadow:0 24px 70px rgba(0,0,0,.32);}
      .pg-head{display:flex;align-items:center;gap:14px;padding:18px 22px;border-bottom:1px solid #f1eefb;}
      .pg-head-ico{width:48px;height:48px;border-radius:14px;background:#efeafe;color:#6D5BD0;display:flex;align-items:center;justify-content:center;flex:none;}
      .pg-head-tit{flex:1;}
      .pg-head-tit .t{font-weight:700;font-size:18px;color:#2b2b3a;}
      .pg-head-tit .s{font-size:13px;color:#8a8f9c;margin-top:1px;}
      .pg-head .x{border:none;background:#f6f5fb;width:32px;height:32px;border-radius:9px;font-size:18px;color:#9398a6;cursor:pointer;}
      .pg-body{display:grid;grid-template-columns:1.35fr 1fr;}
      .pg-col{padding:20px 22px;min-height:0;}
      .pg-col-r{border-left:1px solid #f1eefb;background:#fcfbff;display:flex;flex-direction:column;}
      .pg-step{font-size:13px;font-weight:700;color:#6D5BD0;margin-bottom:12px;display:flex;align-items:center;gap:7px;}
      .pg-carga{display:grid;grid-template-columns:1fr 130px;gap:12px;}
      .pg-f{display:flex;flex-direction:column;gap:5px;}
      .pg-f label{font-size:12px;font-weight:600;color:#8a8f9c;}
      .pg-met-box{display:flex;align-items:center;gap:8px;border:1px solid #e6e3f2;border-radius:10px;padding:0 11px;}
      .pg-met-box:focus-within{border-color:#6D5BD0;}
      .pg-met-ico{color:#6D5BD0;display:flex;flex:none;}
      .pg-met{border:none;background:transparent;flex:1;padding:10px 0;outline:none;font-size:14px;color:#2b2b3a;}
      .pg-imp{display:flex;align-items:center;gap:5px;border:1px solid #e6e3f2;border-radius:10px;padding:0 10px;}
      .pg-imp:focus-within{border-color:#6D5BD0;}
      .pg-imp>span{color:#9398a6;font-weight:600;}
      .pg-imp-in{border:none;padding:10px 0;text-align:right;width:100%;outline:none;font-size:14px;}
      .pg-ref{margin-top:12px;width:100%;box-sizing:border-box;padding:10px 11px;border:1px solid #e6e3f2;border-radius:10px;font-size:14px;outline:none;}
      .pg-ref:focus{border-color:#6D5BD0;}
      .pg-agregar{margin-top:12px;background:#fff;color:#6D5BD0;border:1px solid #c9c2e8;border-radius:10px;padding:10px 18px;font-weight:600;cursor:pointer;width:100%;}
      .pg-agregar:hover{background:#faf9fe;}
      .pg-cards{display:flex;flex-direction:column;gap:9px;height:264px;overflow-y:auto;padding-right:2px;}
      .pg-card{display:flex;align-items:center;gap:11px;border:1px solid #ece9f7;border-radius:12px;padding:10px 12px;}
      .pg-card-ico{width:38px;height:38px;border-radius:10px;background:#efeafe;color:#6D5BD0;display:flex;align-items:center;justify-content:center;flex:none;}
      .pg-card-ico.green{background:#e6f7ee;color:#1f9d57;}
      .pg-card-ico.cyan{background:#e3f5fb;color:#1593b8;}
      .pg-card-info{flex:1;min-width:0;}
      .pg-card-nom{font-weight:600;color:#2b2b3a;}
      .pg-card-ref{font-size:12px;color:#9398a6;}
      .pg-card-imp{font-weight:700;color:#2b2b3a;white-space:nowrap;}
      .pg-card-x{border:none;background:#f6f5fb;color:#9398a6;width:30px;height:30px;border-radius:8px;cursor:pointer;font-size:16px;flex:none;}
      .pg-card-x:hover{background:#ffe1e1;color:#d35;}
      .pg-cards-vacio{padding:18px;text-align:center;color:#a7abb6;font-size:13px;border:1px dashed #e6e3f2;border-radius:12px;}
      .pg-status{display:flex;align-items:center;gap:12px;border-radius:14px;padding:14px 16px;margin-bottom:16px;}
      .pg-status.ok{background:#e9f9f0;}
      .pg-status.warn{background:#fff3ea;}
      .pg-status.over{background:#fdeaea;}
      .pg-status-ico{width:40px;height:40px;border-radius:50%;display:flex;align-items:center;justify-content:center;flex:none;color:#fff;}
      .pg-status.ok .pg-status-ico{background:#1f9d57;}
      .pg-status.warn .pg-status-ico{background:#fb923c;}
      .pg-status.over .pg-status-ico{background:#d35;}
      .pg-status-body{flex:1;}
      .pg-status-lbl{font-size:12px;color:#6b6880;}
      .pg-status-val{font-size:22px;font-weight:800;}
      .pg-status.ok .pg-status-val{color:#1f9d57;}
      .pg-status.warn .pg-status-val{color:#e07b2e;}
      .pg-status.warn .pg-status-pill{color:#b45309;}
      .pg-status.over .pg-status-val{color:#d35;}
      .pg-status-pill{font-size:11px;font-weight:700;padding:3px 9px;border-radius:999px;background:rgba(255,255,255,.75);color:#2b2b3a;}
      .pg-bd{display:flex;flex-direction:column;gap:10px;margin-bottom:16px;flex:1;overflow-y:auto;min-height:0;}
      .pg-bd-row{display:flex;justify-content:space-between;font-size:14px;color:#3a3a48;}
      .pg-bd-row .m{font-weight:600;}
      .pg-total-row{display:flex;justify-content:space-between;align-items:center;border-top:1px solid #ece9f7;padding-top:14px;}
      .pg-total-row span:first-child{color:#6b6880;font-size:14px;}
      .pg-total-row .v{font-weight:800;font-size:20px;color:#6D5BD0;}
      .pg-foot{display:flex;justify-content:space-between;align-items:center;padding:16px 22px;border-top:1px solid #f1eefb;}
      .pg-foot .btn-primary-sm{display:inline-flex;align-items:center;gap:7px;}
    </style>
    <div class="pg-modal">
      <div class="pg-head">
        <div class="pg-head-ico">${wallet}</div>
        <div class="pg-head-tit">
          <div class="t">Cobrar · Método de pago</div>
          <div class="s">Seleccioná la forma de pago y el importe a cobrar.</div>
        </div>
        <button type="button" class="x" onclick="_pagoCerrar()">×</button>
      </div>
      <div class="pg-body">
        <div class="pg-col pg-col-l">
          <div class="pg-step">${_pagoIco('tarjeta', 15)} Seleccioná el método de pago</div>
          <div class="pg-carga">
            <div class="pg-f">
              <label>Forma de pago</label>
              <div class="pg-met-box">
                <span class="pg-met-ico" id="pago-met-ico">${_pagoIco(metodos[0].icono || 'generico')}</span>
                <select class="pg-met" id="pago-met" onchange="_pagoMetIco()">
                  ${metodos.map(m => `<option value="${m.id}" data-ico="${m.icono || 'generico'}">${_pagoEsc(m.nombre)}</option>`).join('')}
                </select>
              </div>
            </div>
            <div class="pg-f">
              <label>Importe</label>
              <div class="pg-imp"><span>$</span><input type="number" class="pg-imp-in" id="pago-imp" min="0" step="0.01" value="${total}"></div>
            </div>
          </div>
          <input type="text" class="pg-ref" id="pago-ref" placeholder="Cupón / N° de operación (opcional)">
          <button type="button" class="pg-agregar" onclick="_pagoAgregar()">+ Agregar método</button>

          <div class="pg-step" style="margin-top:22px;">${listIco} Métodos agregados</div>
          <div id="pago-lista" class="pg-cards"></div>
        </div>

        <div class="pg-col pg-col-r">
          <div class="pg-step">${wallet.replace('width="24" height="24"', 'width="15" height="15"')} Resumen del cobro</div>
          <div id="pago-status"></div>
          <div id="pago-breakdown" class="pg-bd"></div>
          <div class="pg-total-row"><span>Total a cobrar</span><span class="v">${formatearPrecio(total)}</span></div>
        </div>
      </div>
      <div class="pg-foot">
        <button type="button" class="btn" onclick="_pagoCerrar()">Cancelar</button>
        <button type="button" id="pago-confirmar" class="btn btn-primary-sm" onclick="finalizarCobro()">${lock} Confirmar cobro</button>
      </div>
    </div>`;
  document.body.appendChild(ov);
  _pagoRenderLista();
  _pagoRecompute();
}

function _pagoCerrar() {
  const ov = document.getElementById('pago-ov');
  if (ov) ov.remove();
}

function _pagoEsc(s) { return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

function _pagoMetIco() {
  const sel = document.getElementById('pago-met');
  if (!sel) return;
  const ico = sel.options[sel.selectedIndex]?.getAttribute('data-ico') || 'generico';
  const el = document.getElementById('pago-met-ico');
  if (el) el.innerHTML = _pagoIco(ico);
}

function _pagoResto() {
  const st = window._pago;
  const asignado = st.agregados.reduce((s, p) => s + p.monto, 0);
  return Math.max(0, Math.round((st.total - asignado) * 100) / 100);
}

function _pagoAgregar() {
  const st = window._pago;
  if (!st) return;
  const metId = document.getElementById('pago-met').value;
  const imp = Math.round((parseFloat(document.getElementById('pago-imp').value) || 0) * 100) / 100;
  const ref = (document.getElementById('pago-ref').value || '').trim();
  if (imp <= 0) { mostrarMensaje('Poné un importe mayor a cero', 'advertencia'); return; }
  const m = st.metodos.find(x => x.id === metId) || {};
  st.agregados.push({ metodoId: metId, metodo_nombre: m.nombre || 'Pago', icono: m.icono || 'generico', monto: imp, ref: ref || null });

  document.getElementById('pago-ref').value = '';
  _pagoRenderLista();
  _pagoRecompute();
  const resto = _pagoResto();
  document.getElementById('pago-imp').value = resto > 0 ? resto : '';
}

function _pagoQuitar(i) {
  const st = window._pago;
  st.agregados.splice(i, 1);
  _pagoRenderLista();
  _pagoRecompute();
  const resto = _pagoResto();
  const imp = document.getElementById('pago-imp');
  if (imp) imp.value = resto > 0 ? resto : '';
}

function _pagoRenderLista() {
  const st = window._pago;
  const cont = document.getElementById('pago-lista');
  if (!cont) return;
  if (!st.agregados.length) {
    cont.innerHTML = '<div class="pg-cards-vacio">Todavía no agregaste pagos. Elegí forma de pago e importe y tocá Agregar.</div>';
    return;
  }
  cont.innerHTML = st.agregados.map((p, i) => `
    <div class="pg-card">
      <div class="pg-card-ico ${_pagoIcoClase(p.icono)}">${_pagoIco(p.icono, 20)}</div>
      <div class="pg-card-info">
        <div class="pg-card-nom">${_pagoEsc(p.metodo_nombre)}</div>
        ${p.ref ? `<div class="pg-card-ref">${_pagoEsc(p.ref)}</div>` : ''}
      </div>
      <div class="pg-card-imp">${formatearPrecio(p.monto)}</div>
      <button type="button" class="pg-card-x" title="Quitar" onclick="_pagoQuitar(${i})">×</button>
    </div>`).join('');
}

function _pagoRecompute() {
  const st = window._pago;
  if (!st) return;
  const asignado = st.agregados.reduce((s, p) => s + p.monto, 0);
  const dif = Math.round((st.total - asignado) * 100) / 100;

  const checkSvg = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>';
  const bang = '<span style="font-weight:800;font-size:19px;">!</span>';

  let cls, pill;
  if (st.agregados.length && Math.abs(dif) < 0.5) { cls = 'ok'; pill = '✓ Listo'; }
  else if (dif < 0) { cls = 'over'; pill = 'De más ' + formatearPrecio(-dif); }
  else { cls = 'warn'; pill = 'Falta ' + formatearPrecio(dif); }

  const status = document.getElementById('pago-status');
  if (status) {
    status.className = 'pg-status ' + cls;
    status.innerHTML = `
      <span class="pg-status-ico">${cls === 'ok' ? checkSvg : bang}</span>
      <div class="pg-status-body">
        <div class="pg-status-lbl">Asignado</div>
        <div class="pg-status-val">${formatearPrecio(asignado)}</div>
      </div>
      <span class="pg-status-pill">${pill}</span>`;
  }

  const bd = document.getElementById('pago-breakdown');
  if (bd) {
    const byMet = {};
    st.agregados.forEach(p => { byMet[p.metodo_nombre] = (byMet[p.metodo_nombre] || 0) + p.monto; });
    bd.innerHTML = Object.keys(byMet).map(n =>
      `<div class="pg-bd-row"><span class="m">${_pagoEsc(n)}</span><span>${formatearPrecio(byMet[n])}</span></div>`
    ).join('');
  }

  const btn = document.getElementById('pago-confirmar');
  if (btn) btn.disabled = (!st.agregados.length) || Math.abs(dif) >= 0.5;
}

async function finalizarCobro() {
  const st = window._pago;
  if (!st) return;
  const asignado = st.agregados.reduce((s, p) => s + p.monto, 0);
  if (!st.agregados.length) { mostrarMensaje('Agregá al menos un medio de pago', 'advertencia'); return; }
  if (Math.abs(st.total - asignado) > 0.5) { mostrarMensaje('El pago tiene que sumar el total', 'advertencia'); return; }

  const pagos = st.agregados.map(p => ({
    metodo_id: p.metodoId || null,
    metodo_nombre: p.metodo_nombre,
    monto: p.monto,
    referencia: p.ref || null
  }));

  const btn = document.getElementById('pago-confirmar');
  if (btn) { btn.disabled = true; btn.textContent = 'Cobrando…'; }

  await ejecutarCobro(st.turnoId, st.total, pagos);
}

function _pagoReactivar() {
  const btn = document.getElementById('pago-confirmar');
  if (btn) { btn.disabled = false; btn.textContent = 'Confirmar cobro'; }
}

// Ejecuta el cobro real: guarda líneas, cobro, pagos, comisión, stock y estado.
async function ejecutarCobro(turnoId, total, pagos) {
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
    if (r.error) { mostrarMensaje('Error en atenciones: ' + r.error.message, 'error'); _pagoReactivar(); return; }
  }
  if (_cobro.lineasProd.length) {
    const filas = _cobro.lineasProd.map(l => ({
      turno_id: turnoId, producto_id: l.producto_id,
      cantidad: l.cantidad, precio_unitario: l.precio,
      negocio_id: usuarioActual.negocio_id
    }));
    const r = await sb.from('turno_productos').insert(filas);
    if (r.error) { mostrarMensaje('Error en productos: ' + r.error.message, 'error'); _pagoReactivar(); return; }
  }

  // 2) Registrar el cobro. metodo_pago: el medio si fue uno, "Combinado" si fueron varios.
  const metodoResumen = pagos.length === 1 ? pagos[0].metodo_nombre : 'Combinado';
  const { data: cobroRow, error: eCobro } = await sb.from('cobros').insert({
    turno_id: turnoId,
    negocio_id: usuarioActual.negocio_id,
    total,
    metodo_pago: metodoResumen,
    cobrado_por: usuarioActual.id
  }).select('id').single();
  if (eCobro) { mostrarMensaje('Error al registrar el cobro: ' + eCobro.message, 'error'); _pagoReactivar(); return; }

  // 2.b) Detalle de pagos (un cobro → uno o varios medios)
  const filasPago = pagos.map(p => ({
    cobro_id: cobroRow.id, negocio_id: usuarioActual.negocio_id,
    metodo_id: p.metodo_id, metodo_nombre: p.metodo_nombre,
    monto: p.monto, referencia: p.referencia
  }));
  const { error: ePagos } = await sb.from('cobro_pagos').insert(filasPago);
  if (ePagos) console.error('No se pudo guardar el detalle de pagos:', ePagos.message);

  // 2.c) Comisión del profesional (congelada). No bloquea el cobro.
  try {
    await registrarComisionCobro(turnoId, cobroRow?.id);
  } catch (err) {
    console.error('No se pudo registrar la comisión:', err);
  }

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
    _pagoReactivar(); return;
  }

  mostrarMensaje('Cobro registrado por ' + formatearPrecio(total), 'exito');
  _pagoCerrar();
  cerrarModal();

  const moduloActivo = document.querySelector('.nav-item.active')?.dataset.modulo;
  if (moduloActivo === 'agenda') dibujarAgenda();
  else if (moduloActivo === 'dashboard') renderDashboard(document.getElementById('main'));
}

// ============================================================
// Comisión del cobro → ledger `comisiones`
// ============================================================
// Calcula la comisión del profesional para este cobro y la deja
// CONGELADA (base, %, montos) para que la liquidación no dependa de
// que después cambien las tasas. Atención: % global. Producto: % por
// defecto, salvo que el producto tenga comisión propia (% o monto fijo).
async function registrarComisionCobro(turnoId, cobroId) {
  if (!_cobro) return;
  const profesionalId = _cobro.profesionalId || null;

  // Si el profesional tiene la comisión deshabilitada, no se le registra nada.
  if (profesionalId) {
    const { data: prof } = await sb.from('profesionales')
      .select('comision_habilitada').eq('id', profesionalId).maybeSingle();
    if (prof && prof.comision_habilitada === false) return;
  }

  const r2 = n => Math.round((Number(n) || 0) * 100) / 100;
  const baseAt = _cobro.lineasAt.reduce((s, l) => s + l.precio * l.cantidad, 0);
  const baseProd = _cobro.lineasProd.reduce((s, l) => s + l.precio * l.cantidad, 0);

  const { data: cfg } = await sb.from('configuracion')
    .select('comision_atencion_pct, comision_producto_pct')
    .eq('negocio_id', usuarioActual.negocio_id).maybeSingle();
  const pctAt = Number(cfg?.comision_atencion_pct) || 0;
  const pctProdDef = Number(cfg?.comision_producto_pct) || 0;

  // Config de comisión de cada producto vendido en este cobro
  const comMap = {};
  const prodIds = [...new Set(_cobro.lineasProd.map(l => l.producto_id).filter(Boolean))];
  if (prodIds.length) {
    const { data: pcom } = await sb.from('productos')
      .select('id, comision_modo, comision_valor').in('id', prodIds);
    (pcom || []).forEach(p => { comMap[p.id] = p; });
  }

  const comisionAtencion = r2(baseAt * pctAt / 100);
  let comisionProducto = 0;
  for (const l of _cobro.lineasProd) {
    const pc = comMap[l.producto_id] || {};
    const modo = pc.comision_modo || 'default';
    const valor = Number(pc.comision_valor) || 0;
    const subtotal = l.precio * l.cantidad;
    if (modo === 'fijo') comisionProducto += valor * l.cantidad;
    else if (modo === 'porcentaje') comisionProducto += subtotal * valor / 100;
    else comisionProducto += subtotal * pctProdDef / 100;
  }
  comisionProducto = r2(comisionProducto);
  const comisionTotal = r2(comisionAtencion + comisionProducto);

  const { error } = await sb.from('comisiones').insert({
    negocio_id: usuarioActual.negocio_id,
    turno_id: turnoId,
    cobro_id: cobroId || null,
    profesional_id: profesionalId,
    base_atencion: r2(baseAt),
    base_producto: r2(baseProd),
    pct_atencion: pctAt,
    comision_atencion: comisionAtencion,
    comision_producto: comisionProducto,
    comision_total: comisionTotal,
    liquidacion_id: null
  });
  if (error) console.error('Comisión no registrada:', error.message);
}

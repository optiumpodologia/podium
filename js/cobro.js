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
  const { data: ficha } = await sb.from('fichas_atencion').select('*').eq('turno_id', turnoId).maybeSingle();
  const { data: atExist } = await sb.from('turno_atenciones').select('*').eq('turno_id', turnoId);
  const { data: prodExist } = await sb.from('turno_productos').select('*').eq('turno_id', turnoId);

  const lineasAt = (atExist || []).map(a => {
    const c = (tipos || []).find(t => t.id === a.tipo_atencion_id);
    return { tipo_atencion_id: a.tipo_atencion_id, nombre: c?.nombre || 'Atención', cantidad: a.cantidad || 1, precio: a.precio_unitario ?? c?.precio ?? 0 };
  });
  const lineasProd = (prodExist || []).map(p => {
    const c = (productosCat || []).find(x => x.id === p.producto_id);
    return { producto_id: p.producto_id, nombre: c?.nombre || 'Producto', cantidad: p.cantidad || 1, precio: p.precio_unitario ?? c?.precio ?? 0 };
  });

  const totalLineas = arr => arr.reduce((s, l) => s + (l.precio * l.cantidad), 0);

  window._cobro = {
    lineasAt, lineasProd,

    fila(l, i, tipo) {
      return `
        <tr>
          <td>${l.nombre}</td>
          <td style="text-align:center;"><input type="number" min="1" value="${l.cantidad}" style="width:48px;" onchange="_cobro.setCant('${tipo}', ${i}, this.value)"></td>
          <td style="text-align:right;">${formatearPrecio(l.precio)}</td>
          <td style="text-align:right;">${formatearPrecio(l.precio * l.cantidad)}</td>
          <td style="text-align:right;"><button type="button" class="btn-icon" style="color:var(--peligro);" onclick="_cobro.quitar('${tipo}', ${i})">&times;</button></td>
        </tr>`;
    },

    renderAt() {
      const tb = document.getElementById('cobro-tbody-at');
      if (!tb) return;
      tb.innerHTML = this.lineasAt.length
        ? this.lineasAt.map((l, i) => this.fila(l, i, 'at')).join('')
        : `<tr><td colspan="5" class="vacio" style="padding:8px;">Sin atenciones</td></tr>`;
      this.renderTotal();
    },
    renderProd() {
      const tb = document.getElementById('cobro-tbody-prod');
      if (!tb) return;
      tb.innerHTML = this.lineasProd.length
        ? this.lineasProd.map((l, i) => this.fila(l, i, 'prod')).join('')
        : `<tr><td colspan="5" class="vacio" style="padding:8px;">Sin productos</td></tr>`;
      this.renderTotal();
    },
    renderTotal() {
      const total = totalLineas(this.lineasAt) + totalLineas(this.lineasProd);
      const elT = document.getElementById('cobro-total');
      if (elT) elT.textContent = formatearPrecio(total);
      const btn = document.getElementById('cobro-btn');
      if (btn) btn.textContent = 'Cobrar ' + formatearPrecio(total);
    },

    agregarAt() {
      const sel = document.getElementById('cobro-sel-at');
      const id = sel.value; if (!id) return;
      const c = (tipos || []).find(t => t.id === id); if (!c) return;
      const ya = this.lineasAt.find(l => l.tipo_atencion_id === id);
      if (ya) ya.cantidad += 1;
      else this.lineasAt.push({ tipo_atencion_id: id, nombre: c.nombre, cantidad: 1, precio: c.precio || 0 });
      sel.value = ''; this.renderAt();
    },
    agregarProd() {
      const sel = document.getElementById('cobro-sel-prod');
      const id = sel.value; if (!id) return;
      const c = (productosCat || []).find(x => x.id === id); if (!c) return;
      const ya = this.lineasProd.find(l => l.producto_id === id);
      if (ya) ya.cantidad += 1;
      else this.lineasProd.push({ producto_id: id, nombre: c.nombre, cantidad: 1, precio: c.precio || 0 });
      sel.value = ''; this.renderProd();
    },
    quitar(tipo, i) {
      if (tipo === 'at') { this.lineasAt.splice(i, 1); this.renderAt(); }
      else { this.lineasProd.splice(i, 1); this.renderProd(); }
    },
    setCant(tipo, i, v) {
      const n = Math.max(1, parseInt(v) || 1);
      if (tipo === 'at') { this.lineasAt[i].cantidad = n; this.renderAt(); }
      else { this.lineasProd[i].cantidad = n; this.renderProd(); }
    }
  };

  const obs = ficha?.observaciones || '';
  const prox = ficha?.proxima_visita_nota || '';

  abrirModal(`
    <div class="modal-header">
      <div class="modal-titulo">Cobrar</div>
      <button class="modal-cerrar" onclick="cerrarModal()">&times;</button>
    </div>
    <div class="modal-body">
      <div style="background: var(--fondo); padding:8px 12px; border-radius: var(--radio); margin-bottom:1rem; font-size:13px;">
        <strong>${turno.pacientes ? turno.pacientes.apellido + ', ' + turno.pacientes.nombre : '-'}</strong>
        <span style="color: var(--texto-secundario);"> &middot; ${turno.profesionales?.nombre || ''} &middot; ${new Date(turno.fecha_hora).toLocaleDateString('es-AR')}</span>
      </div>

      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
        <strong style="font-size:13px;">Atenciones</strong>
        <div style="display:flex; gap:6px;">
          <select id="cobro-sel-at" style="font-size:12px;">
            <option value="">+ atención...</option>
            ${(tipos || []).map(t => `<option value="${t.id}">${t.nombre} &middot; ${formatearPrecio(t.precio || 0)}</option>`).join('')}
          </select>
          <button type="button" class="btn" style="font-size:12px; padding:4px 8px;" onclick="_cobro.agregarAt()">Agregar</button>
        </div>
      </div>
      <table class="tabla" style="font-size:12px; margin-bottom:1rem;">
        <tbody id="cobro-tbody-at"></tbody>
      </table>

      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
        <strong style="font-size:13px;">Productos</strong>
        <div style="display:flex; gap:6px;">
          <select id="cobro-sel-prod" style="font-size:12px;">
            <option value="">+ producto...</option>
            ${(productosCat || []).map(p => `<option value="${p.id}">${p.nombre} &middot; ${formatearPrecio(p.precio || 0)} &middot; stock ${p.stock}</option>`).join('')}
          </select>
          <button type="button" class="btn" style="font-size:12px; padding:4px 8px;" onclick="_cobro.agregarProd()">Agregar</button>
        </div>
      </div>
      <table class="tabla" style="font-size:12px; margin-bottom:1rem;">
        <tbody id="cobro-tbody-prod"></tbody>
      </table>

      ${obs ? `<div style="font-size:12px; color:var(--texto-secundario); margin-bottom:6px;"><strong>Observaciones:</strong> ${obs}</div>` : ''}
      ${prox ? `<div style="font-size:12px; color:var(--texto-secundario); margin-bottom:1rem;"><strong>Próxima visita:</strong> ${prox}</div>` : ''}

      <div style="border-top:1px solid var(--borde-tenue); padding-top:12px; display:flex; align-items:center; justify-content:space-between; gap:12px;">
        <div>
          <label style="font-size:12px; color:var(--texto-secundario); display:block; margin-bottom:4px;">Método de pago</label>
          <select id="cobro-metodo">
            ${COBRO_METODOS.map(m => `<option value="${m}">${m}</option>`).join('')}
          </select>
        </div>
        <div style="text-align:right;">
          <div style="font-size:12px; color:var(--texto-secundario);">Total</div>
          <div id="cobro-total" style="font-size:24px; font-weight:700;">${formatearPrecio(0)}</div>
        </div>
      </div>
    </div>
    <div class="modal-footer">
      <button type="button" class="btn" onclick="cerrarModal()">Cancelar</button>
      <button type="button" id="cobro-btn" class="btn btn-primary-sm" onclick="confirmarCobro('${turnoId}')">Cobrar</button>
    </div>
  `);

  _cobro.renderAt();
  _cobro.renderProd();
}

async function confirmarCobro(turnoId) {
  if (!_cobro || _cobro.lineasAt.length === 0) {
    mostrarMensaje('Tiene que haber al menos una atención para cobrar', 'advertencia');
    return;
  }

  const btn = document.getElementById('cobro-btn');
  if (btn) { btn.disabled = true; btn.textContent = 'Cobrando...'; }

  const metodo = document.getElementById('cobro-metodo')?.value || null;
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
  await sb.from('turnos').update({ estado: 'cobrado' }).eq('id', turnoId);

  mostrarMensaje('Cobro registrado por ' + formatearPrecio(total), 'exito');
  cerrarModal();

  const moduloActivo = document.querySelector('.nav-item.active')?.dataset.modulo;
  if (moduloActivo === 'agenda') dibujarAgenda();
  else if (moduloActivo === 'dashboard') renderDashboard(document.getElementById('main'));
}

async function verFichaPaciente(pacienteId) {
  const { data: paciente } = await sb.from('pacientes').select('*').eq('id', pacienteId).single();
  if (!paciente) {
    mostrarMensaje('Paciente no encontrado', 'error');
    return;
  }

  const { data: turnos } = await sb.from('turnos')
    .select('*, tipos_atencion(nombre), profesionales(nombre)')
    .eq('paciente_id', pacienteId)
    .order('fecha_hora', { ascending: false })
    .limit(20);

  let fichas = [];
  if (usuarioActual.rol === 'profesional') {
    const { data } = await sb.from('fichas_atencion')
      .select('*, turnos(fecha_hora)')
      .eq('paciente_id', pacienteId)
      .order('creado_en', { ascending: false });
    fichas = data || [];
  }

  const edad = paciente.fecha_nacimiento
    ? Math.floor((Date.now() - new Date(paciente.fecha_nacimiento)) / (365.25 * 24 * 60 * 60 * 1000))
    : null;

  abrirModal(`
    <div class="modal-header">
      <div class="modal-titulo">Ficha de paciente</div>
      <button class="modal-cerrar" onclick="cerrarModal()">×</button>
    </div>
    <div class="modal-body">
      <div style="margin-bottom: 1.5rem;">
        <div style="font-size: 18px; font-weight: 600;">${paciente.apellido}, ${paciente.nombre}</div>
        <div style="color: var(--texto-secundario); font-size: 13px;">
          ${edad !== null ? `${edad} años · ` : ''}
          ${paciente.dni ? 'DNI ' + paciente.dni : 'Sin DNI'}
        </div>
      </div>

      <table style="width:100%; font-size: 13px; margin-bottom: 1.5rem;">
        ${paciente.telefono ? `<tr><td style="color:var(--texto-secundario); padding:4px 0; width:120px;">Teléfono</td><td>${paciente.telefono}</td></tr>` : ''}
        ${paciente.email ? `<tr><td style="color:var(--texto-secundario); padding:4px 0;">Email</td><td>${paciente.email}</td></tr>` : ''}
        ${paciente.direccion ? `<tr><td style="color:var(--texto-secundario); padding:4px 0;">Dirección</td><td>${paciente.direccion}</td></tr>` : ''}
        ${paciente.obra_social ? `<tr><td style="color:var(--texto-secundario); padding:4px 0;">Obra social</td><td>${paciente.obra_social}${paciente.numero_afiliado ? ' · ' + paciente.numero_afiliado : ''}</td></tr>` : ''}
        ${paciente.notas ? `<tr><td style="color:var(--texto-secundario); padding:4px 0; vertical-align:top;">Notas</td><td>${paciente.notas}</td></tr>` : ''}
      </table>

      <div style="margin-bottom: 0.75rem; font-weight: 600; font-size: 14px;">Historial de turnos</div>
      ${turnos && turnos.length > 0 ? `
        <div class="turnos-dia-lista" style="margin-bottom: 1.5rem;">
          ${turnos.map(t => `
            <div class="turno-row" onclick="cerrarModal(); setTimeout(() => abrirModalTurno('${t.id}'), 100);">
              <div class="turno-row-hora">${new Date(t.fecha_hora).toLocaleDateString('es-AR')}</div>
              <div class="turno-row-info">
                <div class="turno-row-nombre">${t.tipos_atencion?.nombre || 'Pendiente'}</div>
                <div class="turno-row-tipo">${t.profesionales?.nombre || ''} · ${formatearHora(t.fecha_hora)}</div>
              </div>
              <span class="badge badge-${t.estado}">${etiquetaEstado(t.estado)}</span>
            </div>
          `).join('')}
        </div>
      ` : '<div class="vacio" style="padding: 1rem;">Sin turnos registrados</div>'}

      ${usuarioActual.rol === 'profesional' ? `
        <div style="margin-bottom: 0.75rem; font-weight: 600; font-size: 14px;">Historia clínica</div>
        ${fichas.length > 0 ? `
          <div style="display: flex; flex-direction: column; gap: 10px;">
            ${fichas.map(f => `
              <div style="padding: 12px; background: var(--fondo); border-radius: var(--radio);">
                <div style="font-size: 12px; color: var(--texto-secundario); margin-bottom: 4px;">
                  ${f.turnos ? new Date(f.turnos.fecha_hora).toLocaleDateString('es-AR') : new Date(f.creado_en).toLocaleDateString('es-AR')}
                  ${f.tipos_atencion ? ' · ' + f.tipos_atencion.nombre : ''}
                </div>
                ${f.motivo_consulta ? `<div style="margin-bottom: 4px;"><strong>Motivo:</strong> ${f.motivo_consulta}</div>` : ''}
                ${f.diagnostico ? `<div style="margin-bottom: 4px;"><strong>Diagnóstico:</strong> ${f.diagnostico}</div>` : ''}
                ${f.tratamiento ? `<div style="margin-bottom: 4px;"><strong>Tratamiento:</strong> ${f.tratamiento}</div>` : ''}
                ${f.observaciones ? `<div style="font-size: 13px;">${f.observaciones}</div>` : ''}
                ${f.proxima_visita_nota ? `<div style="font-size: 12px; color: var(--texto-secundario); margin-top: 4px;">Próxima visita: ${f.proxima_visita_nota}</div>` : ''}
              </div>
            `).join('')}
          </div>
        ` : '<div class="vacio" style="padding: 1rem;">Sin fichas cargadas</div>'}
      ` : ''}
    </div>
    <div class="modal-footer">
      <button class="btn" onclick="cerrarModal()">Cerrar</button>
    </div>
  `);
}

async function abrirFichaAtencion(turnoId, soloLectura = false) {
  if (usuarioActual.rol !== 'profesional') {
    mostrarMensaje('Solo el profesional puede cargar fichas', 'advertencia');
    return;
  }

  const { data: turno } = await sb.from('turnos')
    .select('*, pacientes(nombre, apellido), profesionales(id, usuario_id)')
    .eq('id', turnoId).single();

  if (!turno) { mostrarMensaje('Turno no encontrado', 'error'); return; }

  if (turno.profesionales.usuario_id !== usuarioActual.id) {
    mostrarMensaje('Solo podés cargar fichas de tus propios turnos', 'advertencia');
    return;
  }

  // --- Catálogos --------------------------------------------------------
  const { data: tipos } = await sb.from('tipos_atencion').select('*').eq('activo', true).order('nombre');
  const { data: productosCat } = await sb.from('productos').select('*').eq('activo', true).order('nombre');

  // --- Ficha + líneas ya cargadas --------------------------------------
  const { data: fichaExistente } = await sb.from('fichas_atencion')
    .select('*').eq('turno_id', turnoId).maybeSingle();
  const { data: atExist } = await sb.from('turno_atenciones').select('*').eq('turno_id', turnoId);
  const { data: prodExist } = await sb.from('turno_productos').select('*').eq('turno_id', turnoId);

  // Estado local de las líneas (se edita en memoria, se persiste al guardar)
  const lineasAt = (atExist || []).map(a => {
    const c = (tipos || []).find(t => t.id === a.tipo_atencion_id);
    return { tipo_atencion_id: a.tipo_atencion_id, nombre: c?.nombre || 'Atención', cantidad: a.cantidad || 1, precio: a.precio_unitario ?? c?.precio ?? 0 };
  });
  const lineasProd = (prodExist || []).map(p => {
    const c = (productosCat || []).find(x => x.id === p.producto_id);
    return { producto_id: p.producto_id, nombre: c?.nombre || 'Producto', cantidad: p.cantidad || 1, precio: p.precio_unitario ?? c?.precio ?? 0 };
  });

  const PROX_FIJAS = ['En 7 días', 'En 21 días', 'En 30 días'];
  const proxInicial = fichaExistente?.proxima_visita_nota || '';

  const dis = soloLectura ? 'disabled' : '';

  // --- Cronómetro -------------------------------------------------------
  const inicioAtencion = turno.hora_inicio_atencion ? new Date(turno.hora_inicio_atencion) : null;
  const mostrarCrono = turno.estado === 'en_atencion' && inicioAtencion && !soloLectura;

  let cronoHTML = '';
  if (mostrarCrono) {
    cronoHTML = `
      <div style="background: var(--fondo); border-left: 3px solid var(--exito); padding: 10px 14px; border-radius: var(--radio); margin-bottom: 1rem; display: flex; align-items: center; gap: 12px;">
        <span style="font-size: 20px;">⏱</span>
        <div>
          <div style="font-size: 11px; color: var(--texto-secundario); text-transform: uppercase; letter-spacing: .5px;">En atención</div>
          <div id="ficha-cronometro" style="font-size: 24px; font-weight: 700; font-variant-numeric: tabular-nums; line-height: 1.1; color: var(--exito);">00:00</div>
        </div>
      </div>
    `;
  } else if (turno.estado === 'finalizado' && inicioAtencion && turno.hora_fin_atencion) {
    const totalMin = Math.max(0, Math.round((new Date(turno.hora_fin_atencion) - inicioAtencion) / 60000));
    cronoHTML = `
      <div style="background: var(--fondo); padding: 8px 12px; border-radius: var(--radio); margin-bottom: 1rem; font-size: 13px; color: var(--texto-secundario);">
        ⏱ Duración de la atención: <strong style="color: var(--texto);">${totalMin} min</strong>
      </div>
    `;
  }

  // --- Próxima visita: botones (o texto en solo-lectura) ---------------
  let proxHTML = '';
  if (soloLectura) {
    proxHTML = `<div style="font-size: 13px;">${proxInicial || '<span style="color:var(--texto-secundario);">No indicada</span>'}</div>`;
  } else {
    proxHTML = `
      <div style="display:flex; gap:6px; flex-wrap:wrap;">
        ${PROX_FIJAS.map(p => `<button type="button" class="btn ficha-prox-btn" data-prox="${p}" onclick="_ficha.setProx('${p}')">${p}</button>`).join('')}
        <button type="button" class="btn ficha-prox-btn" data-prox="__otra__" onclick="_ficha.setProxOtra()">Otra</button>
      </div>
      <div id="ficha-prox-otra-wrap" style="display:none; margin-top:8px;">
        <input type="text" id="ficha-prox-otra" placeholder="Ej: en 2 meses" oninput="_ficha.prox = this.value">
      </div>
    `;
  }

  // --- Estado/helpers de líneas (en window para los onclick inline) ----
  const totalLineas = arr => arr.reduce((s, l) => s + (l.precio * l.cantidad), 0);

  window._ficha = {
    lineasAt, lineasProd,
    prox: proxInicial,

    renderAt() {
      const tb = document.getElementById('ficha-tbody-at');
      if (!tb) return;
      if (this.lineasAt.length === 0) {
        tb.innerHTML = `<tr><td colspan="${soloLectura ? 4 : 5}" class="vacio" style="padding:10px;">Sin atenciones</td></tr>`;
      } else {
        tb.innerHTML = this.lineasAt.map((l, i) => `
          <tr>
            <td>${l.nombre}</td>
            <td style="text-align:center;"><input type="number" min="1" value="${l.cantidad}" style="width:54px;" onchange="_ficha.setCantAt(${i}, this.value)" ${dis}></td>
            <td style="text-align:right;">${formatearPrecio(l.precio)}</td>
            <td style="text-align:right;">${formatearPrecio(l.precio * l.cantidad)}</td>
            ${soloLectura ? '' : `<td style="text-align:right;"><button type="button" class="btn-icon" style="color:var(--peligro);" onclick="_ficha.quitarAt(${i})">×</button></td>`}
          </tr>
        `).join('');
      }
      this.renderTotales();
    },

    renderProd() {
      const tb = document.getElementById('ficha-tbody-prod');
      if (!tb) return;
      if (this.lineasProd.length === 0) {
        tb.innerHTML = `<tr><td colspan="${soloLectura ? 4 : 5}" class="vacio" style="padding:10px;">Sin productos</td></tr>`;
      } else {
        tb.innerHTML = this.lineasProd.map((l, i) => `
          <tr>
            <td>${l.nombre}</td>
            <td style="text-align:center;"><input type="number" min="1" value="${l.cantidad}" style="width:54px;" onchange="_ficha.setCantProd(${i}, this.value)" ${dis}></td>
            <td style="text-align:right;">${formatearPrecio(l.precio)}</td>
            <td style="text-align:right;">${formatearPrecio(l.precio * l.cantidad)}</td>
            ${soloLectura ? '' : `<td style="text-align:right;"><button type="button" class="btn-icon" style="color:var(--peligro);" onclick="_ficha.quitarProd(${i})">×</button></td>`}
          </tr>
        `).join('');
      }
      this.renderTotales();
    },

    renderTotales() {
      const ta = totalLineas(this.lineasAt);
      const tp = totalLineas(this.lineasProd);
      const elTotal = document.getElementById('ficha-total');
      if (elTotal) elTotal.textContent = formatearPrecio(ta + tp);
    },

    agregarAt() {
      const sel = document.getElementById('ficha-sel-at');
      const id = sel.value;
      if (!id) return;
      const c = (tipos || []).find(t => t.id === id);
      if (!c) return;
      const ya = this.lineasAt.find(l => l.tipo_atencion_id === id);
      if (ya) ya.cantidad += 1;
      else this.lineasAt.push({ tipo_atencion_id: id, nombre: c.nombre, cantidad: 1, precio: c.precio || 0 });
      sel.value = '';
      this.renderAt();
    },

    agregarProd() {
      const sel = document.getElementById('ficha-sel-prod');
      const id = sel.value;
      if (!id) return;
      const c = (productosCat || []).find(x => x.id === id);
      if (!c) return;
      const ya = this.lineasProd.find(l => l.producto_id === id);
      if (ya) ya.cantidad += 1;
      else this.lineasProd.push({ producto_id: id, nombre: c.nombre, cantidad: 1, precio: c.precio || 0 });
      sel.value = '';
      this.renderProd();
    },

    quitarAt(i) { this.lineasAt.splice(i, 1); this.renderAt(); },
    quitarProd(i) { this.lineasProd.splice(i, 1); this.renderProd(); },
    setCantAt(i, v) { this.lineasAt[i].cantidad = Math.max(1, parseInt(v) || 1); this.renderAt(); },
    setCantProd(i, v) { this.lineasProd[i].cantidad = Math.max(1, parseInt(v) || 1); this.renderProd(); },

    marcarProx() {
      document.querySelectorAll('.ficha-prox-btn').forEach(b => {
        const esFija = PROX_FIJAS.includes(b.dataset.prox);
        const on = esFija ? (b.dataset.prox === this.prox) : (!PROX_FIJAS.includes(this.prox) && this.prox !== '');
        b.className = on ? 'btn btn-primary-sm ficha-prox-btn' : 'btn ficha-prox-btn';
      });
    },
    setProx(label) {
      this.prox = label;
      const wrap = document.getElementById('ficha-prox-otra-wrap');
      if (wrap) wrap.style.display = 'none';
      const inp = document.getElementById('ficha-prox-otra');
      if (inp) inp.value = '';
      this.marcarProx();
    },
    setProxOtra() {
      const wrap = document.getElementById('ficha-prox-otra-wrap');
      if (wrap) wrap.style.display = 'block';
      const inp = document.getElementById('ficha-prox-otra');
      this.prox = inp ? inp.value : '';
      if (inp) inp.focus();
      this.marcarProx();
    }
  };

  abrirModal(`
    <div class="modal-header">
      <div class="modal-titulo">${soloLectura ? 'Ficha de atención · solo lectura' : 'Ficha de atención'}</div>
      <button class="modal-cerrar" onclick="cerrarModal()">×</button>
    </div>
    <form id="form-ficha">
      <div class="modal-body">
        <div style="background: var(--fondo); padding: 10px 12px; border-radius: var(--radio); margin-bottom: 1rem; font-size: 13px;">
          <strong>${turno.pacientes?.apellido}, ${turno.pacientes?.nombre}</strong>
          <span style="color: var(--texto-secundario);"> · ${new Date(turno.fecha_hora).toLocaleDateString('es-AR')}</span>
        </div>

        ${cronoHTML}

        <div style="font-weight:600; font-size:14px; margin-bottom:8px;">Atenciones</div>
        ${soloLectura ? '' : `
          <div style="display:flex; gap:8px; margin-bottom:8px;">
            <select id="ficha-sel-at" style="flex:1;">
              <option value="">Seleccionar atención...</option>
              ${(tipos || []).map(t => `<option value="${t.id}">${t.nombre} · ${formatearPrecio(t.precio || 0)}</option>`).join('')}
            </select>
            <button type="button" class="btn btn-primary-sm" onclick="_ficha.agregarAt()">Agregar</button>
          </div>
        `}
        <table class="tabla" style="font-size:13px; margin-bottom:1.25rem;">
          <thead><tr>
            <th>Atención</th><th style="text-align:center;">Cant.</th>
            <th style="text-align:right;">Precio</th><th style="text-align:right;">Subtotal</th>
            ${soloLectura ? '' : '<th></th>'}
          </tr></thead>
          <tbody id="ficha-tbody-at"></tbody>
        </table>

        <div style="font-weight:600; font-size:14px; margin-bottom:8px;">Productos</div>
        ${soloLectura ? '' : `
          <div style="display:flex; gap:8px; margin-bottom:8px;">
            <select id="ficha-sel-prod" style="flex:1;">
              <option value="">Seleccionar producto...</option>
              ${(productosCat || []).map(p => `<option value="${p.id}">${p.nombre} · ${formatearPrecio(p.precio || 0)} · stock ${p.stock}</option>`).join('')}
            </select>
            <button type="button" class="btn btn-primary-sm" onclick="_ficha.agregarProd()">Agregar</button>
          </div>
        `}
        <table class="tabla" style="font-size:13px; margin-bottom:1rem;">
          <thead><tr>
            <th>Producto</th><th style="text-align:center;">Cant.</th>
            <th style="text-align:right;">Precio</th><th style="text-align:right;">Subtotal</th>
            ${soloLectura ? '' : '<th></th>'}
          </tr></thead>
          <tbody id="ficha-tbody-prod"></tbody>
        </table>

        <div style="text-align:right; font-size:14px; margin-bottom:1.25rem;">
          Total: <strong id="ficha-total" style="font-size:18px;">${formatearPrecio(0)}</strong>
          <div style="font-size:11px; color:var(--texto-secundario);">El cobro lo registra recepción</div>
        </div>

        <div class="input-group">
          <label>Observaciones / evolución</label>
          <textarea name="observaciones" rows="3" ${dis}>${fichaExistente?.observaciones || ''}</textarea>
        </div>

        <div class="input-group">
          <label>Próxima visita sugerida</label>
          ${proxHTML}
        </div>
      </div>
      <div class="modal-footer">
        ${soloLectura ? `
          <button type="button" class="btn" onclick="cerrarModal()">Cerrar</button>
        ` : `
          <button type="button" class="btn" onclick="cerrarModal()">Cancelar</button>
          <button type="submit" class="btn btn-primary-sm">Cerrar ficha y finalizar turno</button>
        `}
      </div>
    </form>
  `);

  // Pintar líneas + estado inicial de próxima visita
  _ficha.renderAt();
  _ficha.renderProd();
  if (!soloLectura && proxInicial) {
    if (!PROX_FIJAS.includes(proxInicial)) {
      const wrap = document.getElementById('ficha-prox-otra-wrap');
      const inp = document.getElementById('ficha-prox-otra');
      if (wrap) wrap.style.display = 'block';
      if (inp) inp.value = proxInicial;
    }
    _ficha.marcarProx();
  }

  // Cronómetro corriendo (se autolimpia cuando el modal se cierra)
  if (mostrarCrono) {
    const fmt = (ms) => {
      const s = Math.max(0, Math.floor(ms / 1000));
      const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
      const pad = n => String(n).padStart(2, '0');
      return h > 0 ? `${pad(h)}:${pad(m)}:${pad(sec)}` : `${pad(m)}:${pad(sec)}`;
    };
    const tick = () => {
      const el = document.getElementById('ficha-cronometro');
      if (!el) { clearInterval(window._fichaCronoInt); return; }
      el.textContent = fmt(Date.now() - inicioAtencion.getTime());
    };
    clearInterval(window._fichaCronoInt);
    tick();
    window._fichaCronoInt = setInterval(tick, 1000);
  }

  if (soloLectura) return;

  document.getElementById('form-ficha').addEventListener('submit', async (e) => {
    e.preventDefault();

    if (_ficha.lineasAt.length === 0) {
      mostrarMensaje('Agregá al menos una atención', 'advertencia');
      return;
    }

    clearInterval(window._fichaCronoInt);

    const fd = new FormData(e.target);
    const observaciones = fd.get('observaciones') || null;
    const primeraAtencion = _ficha.lineasAt[0].tipo_atencion_id;

    const datosFicha = {
      turno_id: turnoId,
      paciente_id: turno.paciente_id,
      profesional_id: turno.profesional_id,
      observaciones,
      proxima_visita_nota: _ficha.prox || null,
      negocio_id: usuarioActual.negocio_id
    };

    let res;
    if (fichaExistente) res = await sb.from('fichas_atencion').update(datosFicha).eq('id', fichaExistente.id);
    else res = await sb.from('fichas_atencion').insert(datosFicha);
    if (res.error) { mostrarMensaje('Error: ' + res.error.message, 'error'); return; }

    // Reemplazar líneas: borrar las viejas e insertar las actuales
    await sb.from('turno_atenciones').delete().eq('turno_id', turnoId);
    await sb.from('turno_productos').delete().eq('turno_id', turnoId);

    if (_ficha.lineasAt.length) {
      const filas = _ficha.lineasAt.map(l => ({
        turno_id: turnoId, tipo_atencion_id: l.tipo_atencion_id,
        cantidad: l.cantidad, precio_unitario: l.precio,
        negocio_id: usuarioActual.negocio_id
      }));
      const r = await sb.from('turno_atenciones').insert(filas);
      if (r.error) { mostrarMensaje('Error en atenciones: ' + r.error.message, 'error'); return; }
    }
    if (_ficha.lineasProd.length) {
      const filas = _ficha.lineasProd.map(l => ({
        turno_id: turnoId, producto_id: l.producto_id,
        cantidad: l.cantidad, precio_unitario: l.precio,
        negocio_id: usuarioActual.negocio_id
      }));
      const r = await sb.from('turno_productos').insert(filas);
      if (r.error) { mostrarMensaje('Error en productos: ' + r.error.message, 'error'); return; }
    }

    await sb.from('turnos').update({
      estado: 'finalizado',
      tipo_atencion_id: primeraAtencion,
      hora_fin_atencion: new Date().toISOString()
    }).eq('id', turnoId);

    mostrarMensaje('Ficha guardada y turno finalizado', 'exito');
    cerrarModal();
    const moduloActivo = document.querySelector('.nav-item.active')?.dataset.modulo;
    if (moduloActivo === 'agenda') dibujarAgenda();
    else if (moduloActivo === 'dashboard') renderDashboard(document.getElementById('main'));
  });
}

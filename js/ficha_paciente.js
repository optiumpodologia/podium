// ============================================================
// FICHA DE PACIENTE — Vista rápida (dos paneles + pestañas)
// ============================================================

function calcularEdad(fechaNac) {
  if (!fechaNac) return null;
  const f = new Date(fechaNac + 'T00:00'), h = new Date();
  let e = h.getFullYear() - f.getFullYear();
  const m = h.getMonth() - f.getMonth();
  if (m < 0 || (m === 0 && h.getDate() < f.getDate())) e--;
  return e;
}

// --- Anamnesis: campos y armado del panel clínico ---
const ANAMNESIS_CAMPOS = [
  { k: 'primera_visita',       label: 'Primera visita' },
  { k: 'enfermedad_base',      label: 'Enfermedad de base' },
  { k: 'bajo_tratamiento',     label: 'Bajo tratamiento' },
  { k: 'medicacion',           label: 'Medicación' },
  { k: 'antitetanica',         label: 'Antitetánica' },
  { k: 'presion_arterial',     label: 'Presión arterial' },
  { k: 'diabetico',            label: 'Diabético' },
  { k: 'discrasias',           label: 'Discrasias sanguíneas' },
  { k: 'procesos_infecciosos', label: 'Procesos infecciosos' },
  { k: 'valoracion_piel',      label: 'Valoración de la piel' },
  { k: 'cianosis',             label: 'Cianosis' },
  { k: 'turgencia',            label: 'Turgencia' },
  { k: 'problemas_vasculares', label: 'Problemas vasculares' },
  { k: 'alergias',             label: 'Alergias' },
];
const PIE_OPCIONES = ['Normal', 'Frío', 'Caliente', 'Húmedo', 'Intertrigo'];

function panelAnamnesisHTML(anam, editable, pacienteId) {
  const v = (k) => (anam && anam[k]) ? anam[k] : '';
  const esc = (s) => String(s).replace(/"/g, '&quot;');

  if (!editable) {
    // Solo lectura (recepción)
    if (!anam) {
      return `<div class="panel-placeholder" style="padding:2rem 1rem;">
        <div>Anamnesis pendiente de carga.<br>La completa el profesional en la primera atención.</div>
      </div>`;
    }
    const campos = ANAMNESIS_CAMPOS.map(c => `
      <div class="ficha-campo">
        <div class="ficha-campo-lbl">${c.label}</div>
        <div class="ficha-campo-val${v(c.k) ? '' : ' vacio'}">${v(c.k) || '—'}</div>
      </div>`).join('');
    return `<div class="ficha-grid">${campos}
      <div class="ficha-campo"><div class="ficha-campo-lbl">Pie</div><div class="ficha-campo-val${v('pie') ? '' : ' vacio'}">${v('pie') || '—'}</div></div>
      <div class="ficha-campo" style="grid-column:1/-1;"><div class="ficha-campo-lbl">Observaciones</div><div class="ficha-campo-val${v('observaciones') ? '' : ' vacio'}">${v('observaciones') || '—'}</div></div>
    </div>`;
  }

  // Editable (profesional / negocio)
  const inputs = ANAMNESIS_CAMPOS.map(c => `
    <div class="ficha-campo">
      <label class="ficha-campo-lbl">${c.label}</label>
      <input class="anam-input" id="anam_${c.k}" value="${esc(v(c.k))}">
    </div>`).join('');
  const pieRadios = PIE_OPCIONES.map(op => `
    <label class="anam-pie-op"><input type="radio" name="anam_pie" value="${op}" ${v('pie') === op ? 'checked' : ''}> ${op}</label>`).join('');
  return `
    <div class="ficha-grid">${inputs}
      <div class="ficha-campo" style="grid-column:1/-1;">
        <div class="ficha-campo-lbl" style="margin-bottom:6px;">Pie</div>
        <div class="anam-pie">${pieRadios}</div>
      </div>
      <div class="ficha-campo" style="grid-column:1/-1;">
        <label class="ficha-campo-lbl">Observaciones</label>
        <textarea class="anam-input" id="anam_observaciones" rows="3" style="resize:vertical;">${v('observaciones')}</textarea>
      </div>
    </div>
    <div style="display:flex; justify-content:flex-end; margin-top:14px;">
      <button class="btn btn-primary-sm" onclick="guardarAnamnesis('${pacienteId}')">Guardar anamnesis</button>
    </div>`;
}

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

  const edad = calcularEdad(paciente.fecha_nacimiento);
  const inic = ((paciente.apellido?.[0] || '') + (paciente.nombre?.[0] || '')).toUpperCase() || '?';
  const ultimaVisita = (turnos && turnos.length)
    ? new Date(turnos[0].fecha_hora).toLocaleDateString('es-AR')
    : '—';

  const { data: anam } = await sb.from('anamnesis').select('*').eq('paciente_id', pacienteId).maybeSingle();
  const anamPendiente = !anam;
  const puedeEditarClinica = puede(usuarioActual, 'atender');   // profesional/negocio/full editan; recepción solo ve

  const puedeEditar = ['recepcion', 'negocio'].includes(usuarioActual.rol);

  const dato = (lbl, val, full) => `
    <div class="ficha-campo"${full ? ' style="grid-column:1/-1;"' : ''}>
      <div class="ficha-campo-lbl">${lbl}</div>
      <div class="ficha-campo-val${val ? '' : ' vacio'}">${val || 'Sin cargar'}</div>
    </div>`;

  const fechaNacLinda = paciente.fecha_nacimiento
    ? new Date(paciente.fecha_nacimiento + 'T00:00').toLocaleDateString('es-AR')
    : '';

  abrirModal(`
    <style>.modal{max-width:740px;}</style>
    <div class="modal-header">
      <div class="modal-titulo">Vista rápida</div>
      <button class="modal-cerrar" onclick="cerrarModal()">×</button>
    </div>
    <div class="modal-body" style="padding:0;">
      <div class="ficha-cols">
        <aside class="ficha-resumen">
          <div class="ficha-avatar">${inic}</div>
          <div class="ficha-nombre">${paciente.apellido}, ${paciente.nombre}</div>
          <div class="ficha-dni">${paciente.dni ? 'DNI ' + paciente.dni : 'Sin DNI'}</div>
          <div class="ficha-resumen-datos">
            <div><span>Edad</span><strong>${edad !== null ? edad : '—'}</strong></div>
            <div><span>Obra social</span><strong>${paciente.obra_social || '—'}</strong></div>
            <div><span>Última visita</span><strong>${ultimaVisita}</strong></div>
          </div>
          ${puedeEditar ? `<button class="btn btn-primary-sm ficha-editar" onclick="abrirModalPaciente('${paciente.id}')">Editar</button>` : ''}
        </aside>

        <div class="ficha-main">
          <div class="ficha-tabs">
            <button class="ficha-tab active" data-ftab="personales" onclick="fichaTab('personales')">Datos personales</button>
            <button class="ficha-tab" data-ftab="clinica" onclick="fichaTab('clinica')">Datos clínicos${anamPendiente ? ` <span class="ficha-tab-alerta" title="Pendiente de carga"></span>` : ''}</button>
            <button class="ficha-tab" data-ftab="consultas" onclick="fichaTab('consultas')">Últimas consultas</button>
          </div>

          <div class="ficha-panel active" data-fpanel="personales">
            <div class="ficha-grid">
              ${dato('Teléfono', paciente.telefono)}
              ${dato('Email', paciente.email)}
              ${dato('Fecha de nacimiento', fechaNacLinda)}
              ${dato('N° de afiliado', paciente.numero_afiliado)}
              ${dato('Dirección', paciente.direccion, true)}
              ${dato('Obra social', paciente.obra_social, true)}
              ${paciente.notas ? dato('Notas', paciente.notas, true) : ''}
            </div>
          </div>

          <div class="ficha-panel" data-fpanel="clinica">
            ${panelAnamnesisHTML(anam, puedeEditarClinica, paciente.id)}
          </div>

          <div class="ficha-panel" data-fpanel="consultas">
            ${turnos && turnos.length > 0 ? `
              <div class="turnos-dia-lista">
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
            ` : '<div class="vacio" style="padding:1.5rem;">Sin turnos registrados</div>'}
          </div>
        </div>
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn" onclick="cerrarModal()">Cerrar</button>
    </div>
  `);
}

// Cambia de pestaña dentro de la ficha.
function fichaTab(id) {
  document.querySelectorAll('.ficha-tab').forEach(t => t.classList.toggle('active', t.dataset.ftab === id));
  document.querySelectorAll('.ficha-panel').forEach(p => p.classList.toggle('active', p.dataset.fpanel === id));
}

// Guarda la anamnesis del paciente (una por paciente). La completa el profesional/negocio.
async function guardarAnamnesis(pacienteId) {
  const val = (k) => {
    const el = document.getElementById('anam_' + k);
    return el ? (el.value.trim() || null) : null;
  };
  const pieEl = document.querySelector('input[name="anam_pie"]:checked');

  const datos = {
    paciente_id: pacienteId,
    negocio_id: usuarioActual.negocio_id,
    actualizado_por: usuarioActual.id,
    actualizado_en: new Date().toISOString()
  };
  ANAMNESIS_CAMPOS.forEach(c => { datos[c.k] = val(c.k); });
  datos.observaciones = val('observaciones');
  datos.pie = pieEl ? pieEl.value : null;

  const { error } = await sb.from('anamnesis').upsert(datos, { onConflict: 'paciente_id' });
  if (error) { mostrarMensaje('No se pudo guardar la anamnesis: ' + error.message, 'error'); return; }

  mostrarMensaje('Anamnesis guardada', 'exito');
  const dot = document.querySelector('.ficha-tab-alerta');
  if (dot) dot.remove();   // ya no está pendiente
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

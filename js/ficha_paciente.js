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
// Modelo de datos (todas las columnas ya existen en la tabla anamnesis, son text):
//   - texto    -> se guarda el texto tal cual.
//   - unica    -> radio; se guarda la opción elegida (ej. "Hipertenso").
//   - multiple -> checkboxes; se guardan las elegidas unidas por ", " (ej. "Hemofilia, Anticoagulado").
//   - check    -> un solo checkbox; se guarda "Sí" o null.
//   - pie      -> única columna que combina temperatura (única) + estado de piel (múltiple),
//                 serializadas como JSON: {"temp":"Frío","piel":["Resequedad"]}.
// Nota: primera_visita y observaciones se manejan como texto, igual que antes.
const ANAM_TEXTO = [
  { k: 'enfermedad_base',  label: 'Enfermedad de base' },
  { k: 'bajo_tratamiento', label: '¿Bajo tratamiento médico?' },
  { k: 'medicacion',       label: 'Medicación que toma' },
];
const ANAM_GRUPOS = [
  { k: 'antitetanica',         label: 'Vacuna antitetánica',   tipo: 'unica',    ops: ['Sí', 'No'] },
  { k: 'presion_arterial',     label: 'Presión arterial',      tipo: 'unica',    ops: ['Hipotenso', 'Normal', 'Hipertenso'] },
  { k: 'diabetico',            label: 'Diabético',             tipo: 'unica',    ops: ['Sí', 'No'] },
  { k: 'discrasias',           label: 'Discrasias sanguíneas', tipo: 'multiple', ops: ['Hemofilia', 'Anticoagulado'] },
  { k: 'procesos_infecciosos', label: 'Procesos infecciosos',  tipo: 'multiple', ops: ['Infección', 'Adenitis', 'Linfangitis'] },
  { k: 'valoracion_piel',      label: 'Valoración de la piel', tipo: 'unica',    ops: ['Normal', 'Palidez'] },
  { k: 'cianosis',             label: 'Cianosis',              tipo: 'unica',    ops: ['Sí', 'No'] },
  { k: 'turgencia',            label: 'Turgencia',             tipo: 'unica',    ops: ['Normal', 'Anormal'] },
  { k: 'problemas_vasculares', label: 'Problemas vasculares',  tipo: 'check',    ops: ['Presenta'] },
  { k: 'alergias',             label: 'Alergias',              tipo: 'check',    ops: ['Presenta'], detalle: true },
];
const PIE_TEMP = ['Frío', 'Normal', 'Caliente'];
const PIE_PIEL = ['Normal', 'Resequedad', 'Humedad', 'Intertrigo'];

// "Hemofilia, Anticoagulado" -> ['Hemofilia','Anticoagulado'] (tolerante a vacío/null)
function anamLista(valor) {
  return String(valor || '').split(',').map(s => s.trim()).filter(Boolean);
}
// Parsea la columna pie. Si es JSON la usa; si es dato viejo en texto plano, no fuerza nada.
function piePartes(valor) {
  if (!valor) return { temp: '', piel: [] };
  try {
    const o = JSON.parse(valor);
    return { temp: o.temp || '', piel: Array.isArray(o.piel) ? o.piel : [] };
  } catch (e) {
    return { temp: '', piel: [] };
  }
}

function anamOpsUnicaHTML(k, ops, valor) {
  return ops.map(op =>
    `<label class="anam-op"><input type="radio" name="anam_${k}" value="${op}" ${valor === op ? 'checked' : ''}> ${op}</label>`).join('');
}
function anamOpsMultiHTML(campo, ops, seleccion) {
  const set = seleccion.map(s => s.toLowerCase());
  return ops.map(op =>
    `<label class="anam-op"><input type="checkbox" class="anam-chk" data-campo="${campo}" value="${op}" ${set.includes(op.toLowerCase()) ? 'checked' : ''}> ${op}</label>`).join('');
}

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
    const fila = (lbl, valor) =>
      `<div class="ficha-campo"><div class="ficha-campo-lbl">${lbl}</div><div class="ficha-campo-val${valor ? '' : ' sin-dato'}">${valor || '—'}</div></div>`;
    const textos = ANAM_TEXTO.map(c => fila(c.label, v(c.k))).join('');
    const grupos = ANAM_GRUPOS.map(g => {
      let val;
      if (g.tipo === 'check') val = v(g.k) ? ((g.detalle && v(g.k) !== 'Sí') ? v(g.k) : 'Sí') : '';
      else val = v(g.k);
      return fila(g.label, val);
    }).join('');
    const pie = piePartes(v('pie'));
    const pieTxt = [pie.temp, pie.piel.join(', ')].filter(Boolean).join(' · ');
    return `<div class="ficha-grid">${textos}${grupos}
      ${fila('Pie', pieTxt)}
      <div class="ficha-campo" style="grid-column:1/-1;"><div class="ficha-campo-lbl">Observaciones</div><div class="ficha-campo-val${v('observaciones') ? '' : ' sin-dato'}">${v('observaciones') || '—'}</div></div>
    </div>`;
  }

  // Editable (profesional / negocio)
  const textos = ANAM_TEXTO.map(c => `
    <div class="anam-texto">
      <label class="anam-texto-lbl">${c.label}</label>
      <input class="anam-input" id="anam_${c.k}" value="${esc(v(c.k))}">
    </div>`).join('');

  const grupos = ANAM_GRUPOS.map(g => {
    let ops;
    if (g.tipo === 'unica') ops = anamOpsUnicaHTML(g.k, g.ops, v(g.k));
    else if (g.tipo === 'multiple') ops = anamOpsMultiHTML(g.k, g.ops, anamLista(v(g.k)));
    else {
      const marcado = v(g.k) ? 'checked' : '';
      ops = `<label class="anam-op"><input type="checkbox" id="anam_chk_${g.k}" value="Sí" ${marcado} ${g.detalle ? `onchange="anamToggleDetalle('${g.k}')"` : ''}> ${g.ops[0]}</label>`;
      if (g.detalle) {
        const det = (v(g.k) && v(g.k) !== 'Sí') ? esc(v(g.k)) : '';
        const oculto = v(g.k) ? '' : 'style="display:none;"';
        ops += `<input class="anam-input anam-detalle" id="anam_det_${g.k}" placeholder="Alergia a..." value="${det}" ${oculto}>`;
      }
    }
    return `<div class="anam-grupo"><div class="anam-grupo-lbl">${g.label}</div><div class="anam-ops">${ops}</div></div>`;
  }).join('');

  const pie = piePartes(v('pie'));
  const pieTempHTML = PIE_TEMP.map(op =>
    `<label class="anam-op"><input type="radio" name="anam_pie_temp" value="${op}" ${pie.temp === op ? 'checked' : ''}> ${op}</label>`).join('');
  const pielSet = pie.piel.map(s => s.toLowerCase());
  const piePielHTML = PIE_PIEL.map(op =>
    `<label class="anam-op"><input type="checkbox" class="anam-chk" data-campo="pie_piel" value="${op}" ${pielSet.includes(op.toLowerCase()) ? 'checked' : ''}> ${op}</label>`).join('');

  return `
    <div class="anam-textos">${textos}</div>
    <div class="anam-grid">
      ${grupos}
      <div class="anam-grupo"><div class="anam-grupo-lbl">Pie · temperatura</div><div class="anam-ops">${pieTempHTML}</div></div>
      <div class="anam-grupo"><div class="anam-grupo-lbl">Pie · piel</div><div class="anam-ops">${piePielHTML}</div></div>
    </div>
    <div style="margin-top:12px;">
      <label class="ficha-campo-lbl" style="display:block; margin-bottom:5px;">Observaciones</label>
      <textarea class="anam-input" id="anam_observaciones" rows="3" style="resize:vertical;">${v('observaciones')}</textarea>
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

  const { data: primeraVisitaRow } = await sb.from('turnos')
    .select('fecha_hora')
    .eq('paciente_id', pacienteId)
    .in('estado', ['finalizado', 'cobrado'])
    .order('fecha_hora', { ascending: true })
    .limit(1)
    .maybeSingle();
  const primeraVisita = primeraVisitaRow
    ? new Date(primeraVisitaRow.fecha_hora).toLocaleDateString('es-AR')
    : '—';

  const { data: anam } = await sb.from('anamnesis').select('*').eq('paciente_id', pacienteId).maybeSingle();
  const anamPendiente = !anam;
  const puedeEditarClinica = puede(usuarioActual, 'atender');   // profesional/negocio/full editan; recepción solo ve

  const puedeEditar = ['recepcion', 'negocio'].includes(usuarioActual.rol);
  _notaOriginal = paciente.notas || '';

  const ic = (p, s = 18) => `<svg viewBox="0 0 24 24" width="${s}" height="${s}" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0">${p}</svg>`;

  const ICO = {
    tel:    '<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>',
    mail:   '<rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>',
    cal:    '<path d="M8 2v4"/><path d="M16 2v4"/><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18"/>',
    afil:   '<rect width="20" height="14" x="2" y="5" rx="2"/><line x1="2" x2="22" y1="10" y2="10"/>',
    dir:    '<path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/>',
    obra:   '<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/>',
    header: '<rect width="8" height="4" x="8" y="2" rx="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="M9 12h6"/><path d="M9 16h6"/>',
    lock:   '<rect width="18" height="11" x="3" y="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
    nota:   '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M9 13h6"/><path d="M9 17h6"/>'
  };

  const cardDato = (iconKey, lbl, val, full) => `
    <div class="ficha-card${full ? ' full' : ''}">
      <div class="ficha-card-head"><span class="ficha-card-ico">${ic(ICO[iconKey], 16)}</span><span class="ficha-card-lbl">${lbl}</span></div>
      <div class="ficha-card-val${val ? '' : ' sin-dato'}">${val || 'Sin cargar'}</div>
    </div>`;

  const fechaNacLinda = paciente.fecha_nacimiento
    ? new Date(paciente.fecha_nacimiento + 'T00:00').toLocaleDateString('es-AR')
    : '';

  abrirModal(`
    <style>.modal{max-width:860px;}</style>
    <div class="modal-header">
      <div class="modal-titulo" style="display:flex; align-items:center; gap:10px;">
        <span class="ficha-header-ico">${ic(ICO.header, 18)}</span>Ficha clínica
      </div>
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
            <div><span>Primera visita</span><strong>${primeraVisita}</strong></div>
            <div><span>Última visita</span><strong>${ultimaVisita}</strong></div>
          </div>
          ${puedeEditar ? `<button class="btn btn-primary-sm ficha-editar" onclick="abrirModalPaciente('${paciente.id}')">Editar datos</button>` : ''}

          <div class="ficha-nota">
            <div class="ficha-nota-head"><span class="ficha-nota-ico">${ic(ICO.nota, 15)}</span> Nota rápida</div>
            ${puedeEditar
              ? `<textarea id="nota-input" class="ficha-nota-area" rows="3" placeholder="+ Agregar nota..." onblur="guardarNota('${paciente.id}')">${paciente.notas || ''}</textarea>`
              : `<div class="ficha-nota-texto${paciente.notas ? '' : ' sin-dato'}">${paciente.notas || 'Sin notas'}</div>`}
          </div>
        </aside>

        <div class="ficha-main">
          <div class="ficha-tabs">
            <button class="ficha-tab active" data-ftab="personales" onclick="fichaTab('personales')">Datos personales</button>
            <button class="ficha-tab" data-ftab="clinica" onclick="fichaTab('clinica')">Datos clínicos${anamPendiente ? ` <span class="ficha-tab-alerta" title="Pendiente de carga"></span>` : ''}</button>
            <button class="ficha-tab" data-ftab="consultas" onclick="fichaTab('consultas')">Últimas consultas</button>
          </div>

          <div class="ficha-panel active" data-fpanel="personales">
            <div class="ficha-cards">
              ${cardDato('tel', 'Teléfono', paciente.telefono)}
              ${cardDato('mail', 'Email', paciente.email)}
              ${cardDato('cal', 'Fecha de nacimiento', fechaNacLinda)}
              ${cardDato('afil', 'N° de afiliado', paciente.numero_afiliado)}
              ${cardDato('dir', 'Dirección', paciente.direccion, true)}
              ${cardDato('obra', 'Obra social', paciente.obra_social, true)}
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
    <div class="modal-footer" style="justify-content:space-between; align-items:center;">
      <div class="ficha-footer-conf">${ic(ICO.lock, 15)} Información confidencial. Uso exclusivo profesional.</div>
      <button class="btn" onclick="cerrarModal()">Cerrar</button>
    </div>
  `);
}

// --- Nota rápida (campo pacientes.notas) — se guarda sola al salir del campo ---
let _notaOriginal = '';
async function guardarNota(pacienteId) {
  const ta = document.getElementById('nota-input');
  if (!ta) return;
  const texto = ta.value.trim();
  if (texto === (_notaOriginal || '').trim()) return;   // sin cambios, no guarda ni avisa
  const { error } = await sb.from('pacientes').update({ notas: texto || null }).eq('id', pacienteId);
  if (error) { mostrarMensaje('No se pudo guardar la nota: ' + error.message, 'error'); return; }
  _notaOriginal = texto;
  mostrarMensaje('Nota guardada', 'exito');
}

// Cambia de pestaña dentro de la ficha.
function fichaTab(id) {
  document.querySelectorAll('.ficha-tab').forEach(t => t.classList.toggle('active', t.dataset.ftab === id));
  document.querySelectorAll('.ficha-panel').forEach(p => p.classList.toggle('active', p.dataset.fpanel === id));
}

// Guarda la anamnesis del paciente (una por paciente). La completa el profesional/negocio.
async function guardarAnamnesis(pacienteId) {
  const txt = (k) => { const el = document.getElementById('anam_' + k); return el ? (el.value.trim() || null) : null; };
  const radio = (name) => { const el = document.querySelector(`input[name="${name}"]:checked`); return el ? el.value : null; };
  const multi = (campo) => {
    const els = document.querySelectorAll(`.anam-chk[data-campo="${campo}"]:checked`);
    const vals = Array.from(els).map(e => e.value);
    return vals.length ? vals.join(', ') : null;
  };

  const datos = {
    paciente_id: pacienteId,
    negocio_id: usuarioActual.negocio_id,
    actualizado_por: usuarioActual.id,
    actualizado_en: new Date().toISOString()
  };

  // Campos de texto (incluye primera_visita) + observaciones
  ANAM_TEXTO.forEach(c => { datos[c.k] = txt(c.k); });
  datos.observaciones = txt('observaciones');

  // Grupos de opciones
  ANAM_GRUPOS.forEach(g => {
    if (g.tipo === 'unica') datos[g.k] = radio('anam_' + g.k);
    else if (g.tipo === 'multiple') datos[g.k] = multi(g.k);
    else {
      const el = document.getElementById('anam_chk_' + g.k);
      if (!el || !el.checked) { datos[g.k] = null; }
      else if (g.detalle) {
        const det = document.getElementById('anam_det_' + g.k);
        const t = det ? det.value.trim() : '';
        datos[g.k] = t || 'Sí';
      } else { datos[g.k] = 'Sí'; }
    }
  });

  // Pie: temperatura (única) + estado de piel (múltiple) en una sola columna (JSON)
  const pieTemp = radio('anam_pie_temp');
  const piePiel = Array.from(document.querySelectorAll('.anam-chk[data-campo="pie_piel"]:checked')).map(e => e.value);
  datos.pie = (pieTemp || piePiel.length) ? JSON.stringify({ temp: pieTemp || '', piel: piePiel }) : null;

  const { error } = await sb.from('anamnesis').upsert(datos, { onConflict: 'paciente_id' });
  if (error) { mostrarMensaje('No se pudo guardar la anamnesis: ' + error.message, 'error'); return; }

  mostrarMensaje('Anamnesis guardada', 'exito');
  cerrarModal();
}

// Muestra/oculta el campo de detalle (ej. alergias) según el check.
function anamToggleDetalle(k) {
  const chk = document.getElementById('anam_chk_' + k);
  const det = document.getElementById('anam_det_' + k);
  if (!chk || !det) return;
  det.style.display = chk.checked ? '' : 'none';
  if (!chk.checked) det.value = '';
  else det.focus();
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

  // --- Cabecera: paciente + cronómetro (en una sola línea) -------------
  const pac = turno.pacientes || {};
  const inic = ((pac.apellido?.[0] || '') + (pac.nombre?.[0] || '')).toUpperCase() || '?';
  const fechaTurno = new Date(turno.fecha_hora).toLocaleDateString('es-AR');

  const inicioAtencion = turno.hora_inicio_atencion ? new Date(turno.hora_inicio_atencion) : null;
  const mostrarCrono = turno.estado === 'en_atencion' && inicioAtencion && !soloLectura;
  const RELOJ_SVG = '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><line x1="10" x2="14" y1="2" y2="2"/><line x1="12" x2="15" y1="14" y2="11"/><circle cx="12" cy="14" r="8"/></svg>';

  let cronoChip = '';
  if (mostrarCrono) {
    cronoChip = `
      <div class="atn-crono">
        <span class="atn-crono-ico">${RELOJ_SVG}</span>
        <div>
          <div class="atn-crono-lbl">En atención</div>
          <div id="ficha-cronometro" class="atn-crono-val">00:00</div>
        </div>
      </div>`;
  } else if (turno.estado === 'finalizado' && inicioAtencion && turno.hora_fin_atencion) {
    const totalMin = Math.max(0, Math.round((new Date(turno.hora_fin_atencion) - inicioAtencion) / 60000));
    cronoChip = `
      <div class="atn-crono atn-crono-fin">
        <span class="atn-crono-ico">${RELOJ_SVG}</span>
        <div>
          <div class="atn-crono-lbl">Duración</div>
          <div class="atn-crono-val">${totalMin} min</div>
        </div>
      </div>`;
  }

  // --- Próxima visita: botones (o texto en solo-lectura) ---------------
  let proxHTML = '';
  if (soloLectura) {
    proxHTML = `<div style="font-size: 13px;">${proxInicial || '<span style="color:var(--texto-secundario);">No indicada</span>'}</div>`;
  } else {
    proxHTML = `
      <div style="display:flex; gap:6px; flex-wrap:wrap; align-items:center;">
        ${PROX_FIJAS.map(p => `<button type="button" class="btn ficha-prox-btn" data-prox="${p}" onclick="_ficha.setProx('${p}')">${p}</button>`).join('')}
        <button type="button" class="btn ficha-prox-btn" data-prox="__otra__" onclick="_ficha.setProxOtra()">Otra</button>
        <input type="text" id="ficha-prox-otra" class="ficha-prox-input" placeholder="Ej: en 2 meses" oninput="_ficha.prox = this.value" style="display:none; width:170px; flex:none;">
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
      const inp = document.getElementById('ficha-prox-otra');
      if (inp) { inp.style.display = 'none'; inp.value = ''; }
      this.marcarProx();
    },
    setProxOtra() {
      const inp = document.getElementById('ficha-prox-otra');
      if (inp) { inp.style.display = 'inline-block'; this.prox = inp.value; inp.focus(); }
      this.marcarProx();
    }
  };

  abrirModal(`
    <style>.modal{max-width:920px;}</style>
    <div class="modal-header">
      <div class="modal-titulo" style="font-size:15px; font-weight:600;">${soloLectura ? 'Ficha de atención · solo lectura' : 'Ficha de atención'}</div>
      <button class="modal-cerrar" onclick="cerrarModal()">×</button>
    </div>
    <form id="form-ficha">
      <div class="modal-body">
        <div class="atn-head">
          <div class="atn-id">
            <div class="atn-avatar">${inic}</div>
            <div>
              <div class="atn-nombre">${pac.apellido || ''}, ${pac.nombre || ''}</div>
              <div class="atn-sub">Paciente · ${fechaTurno}</div>
            </div>
          </div>
          ${cronoChip}
        </div>

        <div class="atn-cols">
          <div class="atn-col">
            <div class="atn-sec-lbl">Atenciones</div>
            ${soloLectura ? '' : `
              <div style="display:flex; gap:8px; margin-bottom:8px;">
                <select id="ficha-sel-at" style="flex:1; min-width:0;">
                  <option value="">Seleccionar atención...</option>
                  ${(tipos || []).map(t => `<option value="${t.id}">${t.nombre} · ${formatearPrecio(t.precio || 0)}</option>`).join('')}
                </select>
                <button type="button" class="btn btn-primary-sm" onclick="_ficha.agregarAt()">Agregar</button>
              </div>
            `}
            <table class="tabla" style="font-size:13px;">
              <thead><tr>
                <th>Atención</th><th style="text-align:center;">Cant.</th>
                <th style="text-align:right;">Precio</th><th style="text-align:right;">Subtotal</th>
                ${soloLectura ? '' : '<th></th>'}
              </tr></thead>
              <tbody id="ficha-tbody-at"></tbody>
            </table>
          </div>

          <div class="atn-col">
            <div class="atn-sec-lbl">Productos</div>
            ${soloLectura ? '' : `
              <div style="display:flex; gap:8px; margin-bottom:8px;">
                <select id="ficha-sel-prod" style="flex:1; min-width:0;">
                  <option value="">Seleccionar producto...</option>
                  ${(productosCat || []).map(p => `<option value="${p.id}">${p.nombre} · ${formatearPrecio(p.precio || 0)} · stock ${p.stock}</option>`).join('')}
                </select>
                <button type="button" class="btn btn-primary-sm" onclick="_ficha.agregarProd()">Agregar</button>
              </div>
            `}
            <table class="tabla" style="font-size:13px;">
              <thead><tr>
                <th>Producto</th><th style="text-align:center;">Cant.</th>
                <th style="text-align:right;">Precio</th><th style="text-align:right;">Subtotal</th>
                ${soloLectura ? '' : '<th></th>'}
              </tr></thead>
              <tbody id="ficha-tbody-prod"></tbody>
            </table>
          </div>
        </div>

        <div style="text-align:right; font-size:14px; margin-bottom:0.85rem;">
          Total: <strong id="ficha-total" style="font-size:18px;">${formatearPrecio(0)}</strong>
          <div style="font-size:11px; color:var(--texto-secundario);">El cobro lo registra recepción</div>
        </div>

        <div class="input-group">
          <label>Observaciones / evolución</label>
          <textarea name="observaciones" rows="2" ${dis}>${fichaExistente?.observaciones || ''}</textarea>
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
      const inp = document.getElementById('ficha-prox-otra');
      if (inp) { inp.style.display = 'inline-block'; inp.value = proxInicial; }
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

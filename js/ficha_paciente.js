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
    .select('*, pacientes(nombre, apellido, creado_en), profesionales(id, usuario_id)')
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

  // Última visita previa (para la cabecera)
  const { data: ultV } = await sb.from('turnos')
    .select('fecha_hora').eq('paciente_id', turno.paciente_id)
    .in('estado', ['finalizado', 'cobrado'])
    .lt('fecha_hora', turno.fecha_hora)
    .order('fecha_hora', { ascending: false }).limit(1).maybeSingle();

  // Estado local de las líneas (se edita en memoria, se persiste al guardar)
  const lineasAt = (atExist || []).map(a => {
    const c = (tipos || []).find(t => t.id === a.tipo_atencion_id);
    return { tipo_atencion_id: a.tipo_atencion_id, nombre: c?.nombre || 'Atención', cantidad: a.cantidad || 1, precio: a.precio_unitario ?? c?.precio ?? 0, color: c?.color || null };
  });
  const lineasProd = (prodExist || []).map(p => {
    const c = (productosCat || []).find(x => x.id === p.producto_id);
    return { producto_id: p.producto_id, nombre: c?.nombre || 'Producto', descripcion: c?.descripcion || '', cantidad: p.cantidad || 1, precio: p.precio_unitario ?? c?.precio ?? 0 };
  });

  const proxInicial = fichaExistente?.proxima_visita_nota || '';
  const dis = soloLectura ? 'disabled' : '';

  // --- Cabecera --------------------------------------------------------
  const pac = turno.pacientes || {};
  const inic = ((pac.apellido?.[0] || '') + (pac.nombre?.[0] || '')).toUpperCase() || '?';
  const fechaTurno = new Date(turno.fecha_hora).toLocaleDateString('es-AR');

  let meta = 'Paciente';
  if (pac.creado_en) meta = `Paciente desde ${new Date(pac.creado_en).getFullYear()}`;
  if (ultV?.fecha_hora) {
    const d = Math.max(0, Math.round((Date.now() - new Date(ultV.fecha_hora).getTime()) / 86400000));
    meta += ` &middot; Última visita hace ${d} día${d === 1 ? '' : 's'}`;
  }

  const inicioAtencion = turno.hora_inicio_atencion ? new Date(turno.hora_inicio_atencion) : null;
  const mostrarCrono = turno.estado === 'en_atencion' && inicioAtencion && !soloLectura;
  const RELOJ_SVG = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><line x1="10" x2="14" y1="2" y2="2"/><line x1="12" x2="15" y1="14" y2="11"/><circle cx="12" cy="14" r="8"/></svg>';

  let cronoChip = '';
  if (mostrarCrono) {
    cronoChip = `<div class="fa-crono"><span class="fa-crono-ico">${RELOJ_SVG}</span><div><div class="fa-crono-lbl">EN ATENCIÓN</div><div id="ficha-cronometro" class="fa-crono-val">00:00</div></div></div>`;
  } else if (turno.estado === 'finalizado' && inicioAtencion && turno.hora_fin_atencion) {
    const totalMin = Math.max(0, Math.round((new Date(turno.hora_fin_atencion) - inicioAtencion) / 60000));
    cronoChip = `<div class="fa-crono fa-crono-fin"><span class="fa-crono-ico">${RELOJ_SVG}</span><div><div class="fa-crono-lbl">DURACIÓN</div><div class="fa-crono-val">${totalMin} min</div></div></div>`;
  }

  // --- Iconos ----------------------------------------------------------
  const ICO = {
    at:    '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="8" y="2" width="8" height="4" rx="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="M9 13h6"/><path d="M9 17h4"/></svg>',
    prod:  '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M6 7h12l-1 13a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L6 7Z"/><path d="M9 7V5a3 3 0 0 1 6 0v2"/></svg>',
    evo:   '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>',
    total: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6a2 2 0 0 1 2-2h12l4 4v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z"/><path d="M7 9h6"/><path d="M7 13h10"/></svg>',
    cal:   '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>',
    mas:   '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 8v8M8 12h8"/></svg>',
    tacho: '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>',
    spark: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M18.4 5.6l-2.8 2.8M8.4 15.6l-2.8 2.8"/></svg>',
    guardar: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M7 10l5 5 5-5"/><path d="M12 15V3"/></svg>',
    check: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>'
  };
  const FOOT = '<svg class="fa-hero-foot" viewBox="0 0 100 100"><g fill="currentColor"><ellipse cx="52" cy="64" rx="22" ry="29"/><circle cx="34" cy="28" r="7"/><circle cx="49" cy="21" r="8"/><circle cx="64" cy="25" r="7"/><circle cx="75" cy="37" r="6"/><circle cx="27" cy="43" r="5"/></g></svg>';

  const PROX = [7, 21, 30];
  const fmtFechaLarga = (d) => d.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).replace(',', '');

  // --- Estado / helpers (en window para los onclick inline) ------------
  const totalLineas = arr => arr.reduce((s, l) => s + (l.precio * l.cantidad), 0);

  window._ficha = {
    lineasAt, lineasProd,
    prox: '',
    proxFecha: null,
    proxPers: false,
    fichaId: fichaExistente?.id || null,

    filaItem(l, i, tipo) {
      const sub = tipo === 'prod'
        ? (l.descripcion || (l.cantidad > 1 ? `${l.cantidad} × ${formatearPrecio(l.precio)}` : ''))
        : (l.cantidad > 1 ? `${l.cantidad} × ${formatearPrecio(l.precio)}` : '');
      const tint = tipo === 'prod' ? 'fa-ico-verde' : 'fa-ico-violeta';
      const del = soloLectura ? '' : `<button type="button" class="fa-item-del" title="Quitar" onclick="_ficha.quitar('${tipo}',${i})">${ICO.tacho}</button>`;
      return `<div class="fa-item">
        <div class="fa-item-ico ${tint}">${tipo === 'prod' ? ICO.prod : ICO.at}</div>
        <div class="fa-item-body">
          <div class="fa-item-nombre">${l.nombre}</div>
          ${sub ? `<div class="fa-item-sub">${sub}</div>` : ''}
        </div>
        <div class="fa-item-precio">${formatearPrecio(l.precio * l.cantidad)}</div>
        ${del}
      </div>`;
    },

    renderAt() {
      const c = document.getElementById('fa-list-at');
      if (!c) return;
      c.innerHTML = this.lineasAt.length
        ? this.lineasAt.map((l, i) => this.filaItem(l, i, 'at')).join('')
        : '<div class="fa-vacio">Todavía no agregaste atenciones</div>';
      this.renderTotales();
    },
    renderProd() {
      const c = document.getElementById('fa-list-prod');
      if (!c) return;
      c.innerHTML = this.lineasProd.length
        ? this.lineasProd.map((l, i) => this.filaItem(l, i, 'prod')).join('')
        : '<div class="fa-vacio">Sin productos</div>';
      this.renderTotales();
    },
    renderTotales() {
      const el = document.getElementById('ficha-total');
      if (el) el.textContent = formatearPrecio(totalLineas(this.lineasAt) + totalLineas(this.lineasProd));
    },

    pick(tipo) {
      const wrap = document.getElementById(tipo === 'prod' ? 'fa-pick-prod' : 'fa-pick-at');
      if (!wrap) return;
      const abierto = wrap.style.display !== 'none';
      wrap.style.display = abierto ? 'none' : 'block';
      if (!abierto) { const s = wrap.querySelector('select'); if (s) s.focus(); }
    },
    agregarAt() {
      const sel = document.getElementById('ficha-sel-at');
      const id = sel.value; if (!id) return;
      const c = (tipos || []).find(t => t.id === id); if (!c) return;
      const ya = this.lineasAt.find(l => l.tipo_atencion_id === id);
      if (ya) ya.cantidad += 1;
      else this.lineasAt.push({ tipo_atencion_id: id, nombre: c.nombre, cantidad: 1, precio: c.precio || 0, color: c.color || null });
      sel.value = '';
      const w = document.getElementById('fa-pick-at'); if (w) w.style.display = 'none';
      this.renderAt();
    },
    agregarProd() {
      const sel = document.getElementById('ficha-sel-prod');
      const id = sel.value; if (!id) return;
      const c = (productosCat || []).find(x => x.id === id); if (!c) return;
      const ya = this.lineasProd.find(l => l.producto_id === id);
      if (ya) ya.cantidad += 1;
      else this.lineasProd.push({ producto_id: id, nombre: c.nombre, descripcion: c.descripcion || '', cantidad: 1, precio: c.precio || 0 });
      sel.value = '';
      const w = document.getElementById('fa-pick-prod'); if (w) w.style.display = 'none';
      this.renderProd();
    },
    quitar(tipo, i) {
      if (tipo === 'prod') { this.lineasProd.splice(i, 1); this.renderProd(); }
      else { this.lineasAt.splice(i, 1); this.renderAt(); }
    },

    contarObs() {
      const t = document.querySelector('#form-ficha [name=observaciones]');
      const c = document.getElementById('fa-obs-count');
      if (t && c) c.textContent = t.value.length;
    },

    setProx(dias) {
      this.prox = `En ${dias} días`;
      const d = new Date(); d.setDate(d.getDate() + dias);
      this.proxFecha = d; this.proxPers = false;
      const inp = document.getElementById('fa-prox-fecha'); if (inp) inp.style.display = 'none';
      this.marcarProx(); this.previewProx();
    },
    pickProxPersonalizada() {
      const inp = document.getElementById('fa-prox-fecha');
      if (inp) { inp.style.display = 'inline-block'; inp.focus(); if (inp.showPicker) try { inp.showPicker(); } catch (e) {} }
      this.proxPers = true; this.marcarProx();
    },
    setProxFecha(v) {
      if (!v) return;
      const d = new Date(v + 'T00:00:00');
      this.proxFecha = d; this.prox = fmtFechaLarga(d); this.proxPers = true;
      this.marcarProx(); this.previewProx();
    },
    marcarProx() {
      document.querySelectorAll('.fa-prox-btn').forEach(b => {
        const on = b.dataset.note === '__pers__' ? this.proxPers : (b.dataset.note === this.prox);
        b.classList.toggle('on', !!on);
      });
    },
    previewProx() {
      const el = document.getElementById('fa-prox-fecha-txt');
      const box = document.getElementById('fa-prox-preview');
      if (!el || !box) return;
      const txt = this.proxFecha ? fmtFechaLarga(this.proxFecha) : (this.prox || '');
      if (txt) { el.textContent = 'al ' + txt; box.classList.add('on'); }
      else { el.textContent = ''; box.classList.remove('on'); }
    },

    async persistir(finalizar) {
      if (finalizar && this.lineasAt.length === 0) {
        mostrarMensaje('Agregá al menos una atención', 'advertencia');
        return false;
      }
      const obsEl = document.querySelector('#form-ficha [name=observaciones]');
      const observaciones = obsEl ? (obsEl.value || null) : null;

      const datosFicha = {
        turno_id: turnoId, paciente_id: turno.paciente_id, profesional_id: turno.profesional_id,
        observaciones, proxima_visita_nota: this.prox || null, negocio_id: usuarioActual.negocio_id
      };

      let res;
      if (this.fichaId) res = await sb.from('fichas_atencion').update(datosFicha).eq('id', this.fichaId);
      else {
        res = await sb.from('fichas_atencion').insert(datosFicha).select('id').single();
        if (!res.error && res.data) this.fichaId = res.data.id;
      }
      if (res.error) { mostrarMensaje('Error: ' + res.error.message, 'error'); return false; }

      await sb.from('turno_atenciones').delete().eq('turno_id', turnoId);
      await sb.from('turno_productos').delete().eq('turno_id', turnoId);

      if (this.lineasAt.length) {
        const r = await sb.from('turno_atenciones').insert(this.lineasAt.map(l => ({
          turno_id: turnoId, tipo_atencion_id: l.tipo_atencion_id, cantidad: l.cantidad,
          precio_unitario: l.precio, negocio_id: usuarioActual.negocio_id
        })));
        if (r.error) { mostrarMensaje('Error en atenciones: ' + r.error.message, 'error'); return false; }
      }
      if (this.lineasProd.length) {
        const r = await sb.from('turno_productos').insert(this.lineasProd.map(l => ({
          turno_id: turnoId, producto_id: l.producto_id, cantidad: l.cantidad,
          precio_unitario: l.precio, negocio_id: usuarioActual.negocio_id
        })));
        if (r.error) { mostrarMensaje('Error en productos: ' + r.error.message, 'error'); return false; }
      }

      if (finalizar) {
        clearInterval(window._fichaCronoInt);
        await sb.from('turnos').update({
          estado: 'finalizado', tipo_atencion_id: this.lineasAt[0].tipo_atencion_id,
          hora_fin_atencion: new Date().toISOString()
        }).eq('id', turnoId);
        mostrarMensaje('Ficha guardada y turno finalizado', 'exito');
        cerrarModal();
        if (typeof moduloActivo !== 'undefined' && moduloActivo === 'agenda' && typeof dibujarAgenda === 'function') dibujarAgenda();
        else if (typeof moduloActivo !== 'undefined' && moduloActivo === 'dashboard' && typeof renderDashboard === 'function') renderDashboard(document.getElementById('main'));
      } else {
        mostrarMensaje('Borrador guardado', 'exito');
      }
      return true;
    },

    guardarBorrador() { this.persistir(false); }
  };

  // --- Bloques condicionados a edición ---------------------------------
  const pickAtHTML = soloLectura ? '' : `
    <div id="fa-pick-at" class="fa-pick" style="display:none;">
      <select id="ficha-sel-at" onchange="_ficha.agregarAt()">
        <option value="">Seleccionar atención…</option>
        ${(tipos || []).map(t => `<option value="${t.id}">${t.nombre} · ${formatearPrecio(t.precio || 0)}</option>`).join('')}
      </select>
    </div>
    <button type="button" class="fa-add" onclick="_ficha.pick('at')">${ICO.mas} Agregar atención</button>`;

  const pickProdHTML = soloLectura ? '' : `
    <div id="fa-pick-prod" class="fa-pick" style="display:none;">
      <select id="ficha-sel-prod" onchange="_ficha.agregarProd()">
        <option value="">Seleccionar producto…</option>
        ${(productosCat || []).map(p => `<option value="${p.id}">${p.nombre} · ${formatearPrecio(p.precio || 0)} · stock ${p.stock}</option>`).join('')}
      </select>
    </div>
    <button type="button" class="fa-add fa-add-verde" onclick="_ficha.pick('prod')">${ICO.mas} Agregar producto</button>`;

  const proxHTML = soloLectura
    ? `<div class="fa-prox-ro">${proxInicial || 'No indicada'}</div>`
    : `<div class="fa-prox-btns">
        ${PROX.map(n => `<button type="button" class="fa-prox-btn" data-note="En ${n} días" onclick="_ficha.setProx(${n})">${n} días</button>`).join('')}
        <button type="button" class="fa-prox-btn fa-prox-pers" data-note="__pers__" onclick="_ficha.pickProxPersonalizada()">${ICO.cal} Personalizada</button>
        <input type="date" id="fa-prox-fecha" class="fa-prox-date" style="display:none;" onchange="_ficha.setProxFecha(this.value)">
      </div>
      <div class="fa-prox-preview" id="fa-prox-preview">${ICO.spark}<span>La próxima visita quedará agendada <strong id="fa-prox-fecha-txt"></strong></span></div>`;

  // --- Modal -----------------------------------------------------------
  abrirModal(`
    <style>
      .modal { max-width: 720px; }
      .fa-body { background:#fff; }
      .fa-hero { position:relative; overflow:hidden; display:flex; align-items:center; gap:16px; background:linear-gradient(120deg,#F3F0FE,#ECE8FB); border:1px solid var(--borde-tenue); border-radius:16px; padding:16px 18px; margin-bottom:18px; }
      .fa-hero-foot { position:absolute; right:130px; top:50%; transform:translateY(-50%); width:120px; height:120px; color:var(--primario); opacity:0.10; pointer-events:none; }
      .fa-avatar { width:56px; height:56px; flex:none; border-radius:50%; background:linear-gradient(135deg,#C9BEF6,#9E8DE8); color:#fff; display:flex; align-items:center; justify-content:center; font-size:19px; font-weight:700; box-shadow:0 2px 8px rgba(83,74,183,.25); }
      .fa-hero-info { min-width:0; }
      .fa-hero-nombre { font-size:19px; font-weight:700; color:var(--texto); }
      .fa-hero-meta { font-size:12.5px; color:var(--texto-secundario); margin-top:2px; }
      .fa-hero-fecha { display:inline-flex; align-items:center; gap:5px; font-size:12.5px; color:var(--texto-secundario); margin-top:5px; }
      .fa-hero-fecha svg { width:14px; height:14px; }
      .fa-crono { margin-left:auto; display:flex; align-items:center; gap:9px; background:var(--exito-claro); border:1px solid var(--exito); color:#0B5E3E; border-radius:12px; padding:8px 14px; }
      .fa-crono-ico { display:flex; }
      .fa-crono-lbl { font-size:9.5px; font-weight:700; letter-spacing:.06em; opacity:.8; }
      .fa-crono-val { font-size:20px; font-weight:700; line-height:1; font-variant-numeric:tabular-nums; }
      .fa-crono-fin { background:var(--fondo); border-color:var(--borde-tenue); color:var(--texto-secundario); }

      .fa-grid2 { display:grid; grid-template-columns:1fr 1fr; gap:16px; margin-bottom:18px; }
      .fa-grid-evo { display:grid; grid-template-columns:1.55fr 1fr; gap:16px; margin-bottom:18px; }
      .fa-sec-lbl { display:flex; align-items:center; gap:7px; font-size:13px; font-weight:600; color:var(--texto); margin-bottom:9px; }
      .fa-sec-lbl svg { color:var(--primario); }
      .fa-card { border:1px solid var(--borde-tenue); border-radius:13px; padding:11px; background:#fff; }

      .fa-item { display:flex; align-items:center; gap:11px; padding:9px 4px; border-bottom:1px solid var(--borde-tenue); }
      .fa-item:last-child { border-bottom:none; }
      .fa-item-ico { width:34px; height:34px; flex:none; border-radius:9px; display:flex; align-items:center; justify-content:center; }
      .fa-ico-violeta { background:var(--primario-claro); color:var(--primario); }
      .fa-ico-verde { background:var(--exito-claro); color:var(--exito); }
      .fa-item-body { flex:1; min-width:0; }
      .fa-item-nombre { font-size:13px; font-weight:600; color:var(--texto); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
      .fa-item-sub { font-size:11.5px; color:var(--texto-secundario); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
      .fa-item-precio { font-size:13.5px; font-weight:700; color:var(--texto); white-space:nowrap; }
      .fa-item-del { border:1px solid var(--borde-tenue); background:#fff; border-radius:7px; width:28px; height:28px; flex:none; display:flex; align-items:center; justify-content:center; color:var(--texto-secundario); cursor:pointer; transition:.1s; }
      .fa-item-del:hover { color:var(--peligro); border-color:var(--peligro); background:var(--peligro-claro); }
      .fa-vacio { font-size:12.5px; color:var(--texto-secundario); padding:14px 4px; text-align:center; }

      .fa-pick { margin:8px 0; }
      .fa-pick select { width:100%; }
      .fa-add { width:100%; margin-top:8px; display:flex; align-items:center; justify-content:center; gap:7px; background:var(--primario-claro); color:var(--primario); border:1px dashed var(--primario-medio); border-radius:10px; padding:10px; font-size:13px; font-weight:600; cursor:pointer; transition:.12s; }
      .fa-add:hover { filter:brightness(.97); }
      .fa-add-verde { background:var(--exito-claro); color:var(--exito); border-color:var(--exito); }

      .fa-evo { display:flex; flex-direction:column; }
      .fa-evo textarea { width:100%; resize:vertical; min-height:96px; border:1px solid var(--borde-tenue); border-radius:10px; padding:10px; font:inherit; font-size:13px; }
      .fa-evo-count { text-align:right; font-size:11px; color:var(--texto-secundario); margin-top:4px; }

      .fa-total { background:linear-gradient(135deg,#F3F0FE,#E9E4FB); border:1px solid var(--primario-medio); border-radius:13px; padding:15px 16px; display:flex; flex-direction:column; justify-content:center; }
      .fa-total-lbl { display:flex; align-items:center; justify-content:space-between; font-size:12.5px; font-weight:600; color:var(--texto-secundario); }
      .fa-total-lbl svg { color:var(--primario); }
      .fa-total-val { font-size:32px; font-weight:800; color:var(--primario); line-height:1.1; margin:8px 0 4px; }
      .fa-total-sub { font-size:11px; color:var(--texto-secundario); }

      .fa-prox { margin-bottom:4px; }
      .fa-prox-btns { display:flex; flex-wrap:wrap; gap:8px; align-items:center; }
      .fa-prox-btn { display:inline-flex; align-items:center; gap:6px; border:1px solid var(--borde-tenue); background:#fff; color:var(--texto); border-radius:9px; padding:8px 13px; font-size:13px; font-weight:600; cursor:pointer; transition:.12s; }
      .fa-prox-btn:hover { border-color:var(--primario-medio); }
      .fa-prox-btn.on { background:var(--primario); color:#fff; border-color:var(--primario); }
      .fa-prox-date { border:1px solid var(--borde-tenue); border-radius:9px; padding:7px 10px; font:inherit; font-size:13px; }
      .fa-prox-preview { display:none; align-items:center; gap:7px; margin-top:11px; font-size:12.5px; color:var(--texto-secundario); }
      .fa-prox-preview.on { display:flex; }
      .fa-prox-preview svg { color:var(--primario); flex:none; }
      .fa-prox-preview strong { color:var(--primario); font-weight:700; }
      .fa-prox-ro { font-size:13px; }

      .fa-footer { display:flex; align-items:center; }
      .fa-footer-right { margin-left:auto; display:flex; gap:10px; }
      .fa-btn-borrador { display:inline-flex; align-items:center; gap:7px; background:#fff; border:1px solid var(--borde-tenue); color:var(--texto-secundario); border-radius:10px; padding:9px 15px; font-size:13px; font-weight:600; cursor:pointer; }
      .fa-btn-borrador:hover { border-color:var(--primario-medio); color:var(--primario); }
      .fa-finalizar { display:inline-flex; align-items:center; gap:7px; }
    </style>

    <div class="modal-header">
      <div class="modal-titulo" style="font-size:15px; font-weight:600;">${soloLectura ? 'Ficha de atención · solo lectura' : 'Ficha de atención'}</div>
      <button class="modal-cerrar" onclick="cerrarModal()">×</button>
    </div>

    <form id="form-ficha">
      <div class="modal-body fa-body">

        <div class="fa-hero">
          ${FOOT}
          <div class="fa-avatar">${inic}</div>
          <div class="fa-hero-info">
            <div class="fa-hero-nombre">${pac.apellido || ''}, ${pac.nombre || ''}</div>
            <div class="fa-hero-meta">${meta}</div>
            <div class="fa-hero-fecha">${ICO.cal} ${fechaTurno}</div>
          </div>
          ${cronoChip}
        </div>

        <div class="fa-grid2">
          <div>
            <div class="fa-sec-lbl">${ICO.at} Atenciones realizadas</div>
            <div class="fa-card">
              <div id="fa-list-at"></div>
              ${pickAtHTML}
            </div>
          </div>
          <div>
            <div class="fa-sec-lbl">${ICO.prod} Productos utilizados / vendidos</div>
            <div class="fa-card">
              <div id="fa-list-prod"></div>
              ${pickProdHTML}
            </div>
          </div>
        </div>

        <div class="fa-grid-evo">
          <div class="fa-card fa-evo">
            <div class="fa-sec-lbl">${ICO.evo} Evolución / observaciones</div>
            <textarea name="observaciones" maxlength="500" placeholder="Escribí aquí la evolución del paciente…" oninput="_ficha.contarObs()" ${dis}>${fichaExistente?.observaciones || ''}</textarea>
            <div class="fa-evo-count"><span id="fa-obs-count">0</span>/500</div>
          </div>
          <div class="fa-total">
            <div class="fa-total-lbl">Total a cobrar ${ICO.total}</div>
            <div id="ficha-total" class="fa-total-val">${formatearPrecio(0)}</div>
            <div class="fa-total-sub">El cobro lo registra recepción</div>
          </div>
        </div>

        <div class="fa-card fa-prox">
          <div class="fa-sec-lbl">${ICO.cal} Próxima visita sugerida</div>
          ${proxHTML}
        </div>

      </div>

      <div class="modal-footer fa-footer">
        ${soloLectura ? `
          <button type="button" class="btn" onclick="cerrarModal()" style="margin-left:auto;">Cerrar</button>
        ` : `
          <button type="button" class="fa-btn-borrador" onclick="_ficha.guardarBorrador()">${ICO.guardar} Guardar borrador</button>
          <div class="fa-footer-right">
            <button type="button" class="btn" onclick="cerrarModal()">Cancelar</button>
            <button type="submit" class="btn btn-primary-sm fa-finalizar">${ICO.check} Finalizar atención</button>
          </div>
        `}
      </div>
    </form>
  `);

  // --- Post-render -----------------------------------------------------
  _ficha.renderAt();
  _ficha.renderProd();
  _ficha.contarObs();

  if (!soloLectura && proxInicial) {
    _ficha.prox = proxInicial;
    const m = proxInicial.match(/^En (\d+) días$/);
    if (m) { const d = new Date(); d.setDate(d.getDate() + parseInt(m[1])); _ficha.proxFecha = d; }
    else { _ficha.proxPers = true; }
    _ficha.marcarProx();
    _ficha.previewProx();
  }

  // Cronómetro corriendo (se autolimpia cuando el modal se cierra)
  if (mostrarCrono) {
    const fmt = (ms) => {
      const s = Math.max(0, Math.floor(ms / 1000));
      const h = Math.floor(s / 3600), mm = Math.floor((s % 3600) / 60), sec = s % 60;
      const pad = n => String(n).padStart(2, '0');
      return h > 0 ? `${pad(h)}:${pad(mm)}:${pad(sec)}` : `${pad(mm)}:${pad(sec)}`;
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

  document.getElementById('form-ficha').addEventListener('submit', (e) => {
    e.preventDefault();
    _ficha.persistir(true);
  });
}

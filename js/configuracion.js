// Variables que se reemplazan al EMITIR el documento (paso siguiente).
const PLANTILLA_VARS = [
  { k: 'paciente', d: 'Nombre y apellido del paciente' },
  { k: 'dni', d: 'DNI del paciente' },
  { k: 'fecha', d: 'Fecha de hoy' },
  { k: 'profesional', d: 'Profesional que atiende' },
  { k: 'negocio', d: 'Nombre del negocio' },
  { k: 'motivo', d: 'Motivo / diagnóstico de la consulta' },
  { k: 'horas', d: 'Horas de reposo (se completa al emitir)' },
  { k: 'direccion', d: 'Dirección del negocio' },
  { k: 'telefono', d: 'Teléfono del negocio' },
  { k: 'whatsapp', d: 'WhatsApp del negocio' },
  { k: 'email', d: 'Email de contacto del negocio' },
  { k: 'web', d: 'Sitio web / Instagram' }
];

// Íconos chiquitos para la sección de plantillas.
const _icoDoc = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M8 13h8"/><path d="M8 17h8"/><path d="M8 9h2"/></svg>';
const _icoDocMini = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></svg>';
const _icoLapiz = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>';
const _icoTachoMini = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>';

// Íconos de las tarjetas del hub de Configuración.
const _cfgIcoConsultorio = '<svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z"/><path d="M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2"/><path d="M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2"/><path d="M10 6h4"/><path d="M10 10h4"/><path d="M10 14h4"/></svg>';
const _cfgIcoAgenda = '<svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M8 2v4"/><path d="M16 2v4"/><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18"/></svg>';
const _cfgIcoDocumentos = '<svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M8 13h8"/><path d="M8 17h8"/></svg>';
const _cfgIcoNotif = '<svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg>';
const _cfgIcoCaja = '<svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12V7H5a2 2 0 0 1 0-4h14v4"/><path d="M3 5v14a2 2 0 0 0 2 2h16v-5"/><path d="M18 12a2 2 0 0 0 0 4h4v-4Z"/></svg>';
const _cfgIcoComisiones = '<svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="5" x2="5" y2="19"/><circle cx="6.5" cy="6.5" r="2.5"/><circle cx="17.5" cy="17.5" r="2.5"/></svg>';
const _icoLogo = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>';

// Fondos ilustrados de las tarjetas del hub (JPG optimizado, base64).
// Cuando una tarjeta no tiene fondo cargado acá, se muestra con su color
// de tinte + ícono. Agregar más entradas a medida que lleguen las imágenes.
const CFG_CARD_BG = {
  consultorio: 'data:image/jpeg;base64,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'
};

// Consentimiento informado sugerido (el negocio lo carga y puede editarlo).
const CONSENTIMIENTO_SUGERIDO = {
  nombre: 'Consentimiento general - Asume responsabilidad',
  contenido:
`CONSENTIMIENTO INFORMADO
ASUME RESPONSABILIDAD - SE NOTIFICA

Fecha: {fecha}

Por la presente se le comunica al Sr./Sra. {paciente}, DNI {dni}, que padece: {motivo}.

Procediendo en este acto a autorizar la acción podológica.

El paciente toma la responsabilidad de concurrir de inmediato a su médico de confianza para evaluar el caso y prescribir la medicación correspondiente. Queda de esta forma notificado, eximiendo de toda responsabilidad al profesional actuante ({profesional}) por la falta de concurrencia al médico.


Firma del paciente: ............................................
Aclaración: ............................................

* Firma del padre, tutor o encargado: ............................................
Aclaración: ............................................

* Si el paciente fuera menor de edad o inhabilitado.

{negocio}`
};

// Certificado de atención sugerido (predefinido y editable; sirve también
// como justificativo de asistencia). El negocio lo carga y puede editarlo.
const CERTIFICADO_SUGERIDO = {
  nombre: 'Certificado de atención',
  contenido:
`CERTIFICADO DE ATENCIÓN

Fecha: {fecha}

Se certifica que el/la Sr./Sra. {paciente}, DNI {dni}, concurrió en el día de la fecha a este consultorio, donde recibió atención podológica.

Motivo de la consulta: {motivo}

Se extiende el presente a pedido del interesado, a los fines que estime corresponder.


.............................................
{profesional}
Firma y sello del profesional

{negocio}`
};

// Segundo certificado predefinido: reposo, con horas editables al emitir ({horas}).
const CERTIFICADO_REPOSO_SUGERIDO = {
  nombre: 'Certificado de reposo',
  contenido:
`CERTIFICADO DE REPOSO

Fecha: {fecha}

Se certifica que {paciente}, DNI {dni}, fue atendido/a en este consultorio y debe permanecer en reposo, sin realizar actividad, por el término de {horas} horas a partir de la fecha.

Motivo: {motivo}

Se extiende el presente a pedido del interesado, a los fines que estime corresponder.


.............................................
{profesional}
Firma y sello del profesional

{negocio}`
};

// Esqueletos para "+ Agregar": traen la estructura y las variables {} ya
// ubicadas, para que sea más fácil empezar. El usuario edita el texto.
const PLANTILLA_SCAFFOLD = {
  consentimiento:
`CONSENTIMIENTO INFORMADO

Fecha: {fecha}

Por la presente, {paciente}, DNI {dni}, autoriza el siguiente procedimiento podológico:
[Escribí acá el detalle del procedimiento y lo que el paciente autoriza. Motivo: {motivo}]


Firma del paciente: ............................................
Aclaración: ............................................

{negocio} · {profesional}`,
  certificado:
`CERTIFICADO

Fecha: {fecha}

Se certifica que {paciente}, DNI {dni}, [escribí acá el texto del certificado]. Motivo: {motivo}.


.............................................
{profesional}
Firma y sello del profesional

{negocio}`
};

function cfgEsc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// ============================================================
// RECORDATORIOS AUTOMÁTICOS (datos)
// ============================================================
const RECORDATORIO_VARS = [
  { k: 'paciente',    d: 'Nombre del paciente' },
  { k: 'fecha',       d: 'Fecha del turno' },
  { k: 'hora',        d: 'Hora del turno' },
  { k: 'negocio',     d: 'Nombre del negocio' },
  { k: 'profesional', d: 'Profesional del turno' }
];

const RECORDATORIO_MSG_DEFAULT =
  'Hola {paciente}, te recordamos tu turno en {negocio} para mañana {fecha} a las {hora} hs con {profesional}. Si no vas a poder asistir, avisanos así liberamos el espacio. ¡Te esperamos!';

// Pie automático de los documentos (variables del negocio).
const PIE_VARS = [
  { k: 'negocio',   d: 'Nombre del negocio' },
  { k: 'direccion', d: 'Dirección' },
  { k: 'telefono',  d: 'Teléfono' },
  { k: 'whatsapp',  d: 'WhatsApp' },
  { k: 'email',     d: 'Email de contacto' },
  { k: 'web',       d: 'Sitio web / Instagram' }
];
const PIE_DEFAULT = '{negocio} · {direccion} · Tel: {telefono} · WhatsApp: {whatsapp} · {email}';

// ============================================================
// HUB DE CONFIGURACIÓN — grilla de tarjetas
// ============================================================
async function renderConfiguracion(container) {
  if (!puedeVerModulo(usuarioActual, 'configuracion')) {
    container.innerHTML = '<div class="vacio">Acceso restringido</div>';
    return;
  }

  const esNegocio = usuarioActual.rol === 'negocio';

  const tarjetas = [
    { id: 'consultorio', titulo: 'Información del consultorio', desc: 'Datos del negocio, logo, email de contacto y horarios.', tint: 'violeta', ico: _cfgIcoConsultorio, accion: 'abrirCfgConsultorio()', soloNegocio: false },
    { id: 'agenda', titulo: 'Agenda y turnos', desc: 'Duración de turnos, días laborales y feriados.', tint: 'verde', ico: _cfgIcoAgenda, accion: 'abrirCfgAgenda()', soloNegocio: false },
    { id: 'documentos', titulo: 'Modelos de documentos', desc: 'Certificados y consentimientos para emitir.', tint: 'naranja', ico: _cfgIcoDocumentos, accion: 'abrirCfgDocumentos()', soloNegocio: false },
    { id: 'notificaciones', titulo: 'Notificaciones', desc: 'Recordatorios automáticos por email a los pacientes.', tint: 'celeste', ico: _cfgIcoNotif, accion: 'abrirCfgNotificaciones()', soloNegocio: true },
    { id: 'caja', titulo: 'Caja', desc: 'Medios de pago, moneda y opciones de caja.', tint: 'rosa', ico: _cfgIcoCaja, accion: "abrirCfgProximamente('Caja','Acá vas a poder configurar medios de pago, moneda y opciones de caja.')", soloNegocio: true, prox: true },
    { id: 'comisiones', titulo: 'Comisiones', desc: 'Comisiones por profesional y por servicio.', tint: 'amarillo', ico: _cfgIcoComisiones, accion: "abrirCfgProximamente('Comisiones','Acá vas a poder configurar las comisiones de cada profesional.')", soloNegocio: true, prox: true }
  ].filter(t => !t.soloNegocio || esNegocio);

  const cards = tarjetas.map(t => {
    const bg = CFG_CARD_BG[t.id];
    const tieneImg = bg && bg.indexOf('data:') === 0;
    const claseFondo = tieneImg ? 'cfg-card-img' : ('cfg-tint-' + t.tint);
    const estilo = tieneImg ? ` style="background-image:url('${bg}')"` : '';
    const iconoFallback = tieneImg ? '' : `<div class="cfg-card-ico-bg">${t.ico}</div>`;
    return `
      <div class="cfg-card ${claseFondo}"${estilo} onclick="${t.accion}" tabindex="0"
           onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();${t.accion}}">
        ${iconoFallback}
        <div class="cfg-card-contenido">
          <div class="cfg-card-titulo">${t.titulo}${t.prox ? ' <span class="cfg-badge-prox">Próximamente</span>' : ''}</div>
          <div class="cfg-card-desc">${t.desc}</div>
          <div class="cfg-card-cta">Configurar</div>
        </div>
      </div>
    `;
  }).join('');

  container.innerHTML = `
    <div class="page-header">
      <div>
        <div class="page-title">Configuración</div>
        <div class="page-subtitle">Personalizá y administrá tu negocio</div>
      </div>
    </div>
    <div class="cfg-hub-grid">${cards}</div>
  `;
}

// ============================================================
// TARJETA: Información del consultorio
// ============================================================
async function abrirCfgConsultorio() {
  const { data: config } = await sb.from('configuracion')
    .select('*').eq('negocio_id', usuarioActual.negocio_id).maybeSingle();

  const logoActual = config?.logo_url
    ? `<img src="${config.logo_url}" alt="Logo">`
    : _icoLogo;

  abrirModal(`
    <div class="modal-header">
      <div class="modal-titulo">Información del consultorio</div>
      <button class="modal-cerrar" onclick="cerrarModal()">×</button>
    </div>
    <form id="form-config">
      <div class="modal-body">
        <div class="input-group">
          <label>Nombre e identidad del negocio</label>
          <div class="cfg-identidad">
            <div class="cfg-logo-preview" id="cfg-logo-preview">${logoActual}</div>
            <input type="text" name="nombre_consultorio" placeholder="Nombre del negocio"
                   value="${cfgEsc(config?.nombre_consultorio || '')}">
            <button type="button" class="btn" id="cfg-logo-btn">Cambiar logo</button>
            <input type="file" id="cfg-logo-input" accept="image/*" style="display:none">
          </div>
          <small class="cfg-ayuda">El nombre y el logo aparecen arriba a la izquierda para todos los usuarios del negocio.</small>
        </div>

        <div class="input-group">
          <label>Email de contacto del negocio</label>
          <input type="email" name="email_contacto" value="${cfgEsc(config?.email_contacto || '')}" placeholder="contacto@tunegocio.com">
          <small class="cfg-ayuda">Si un paciente responde un recordatorio, la respuesta llega a este email.</small>
        </div>

        <div class="form-row">
          <div class="input-group">
            <label>Teléfono</label>
            <input type="text" name="telefono" value="${cfgEsc(config?.telefono || '')}" placeholder="Ej: 011 4123-4567">
          </div>
          <div class="input-group">
            <label>WhatsApp</label>
            <input type="text" name="whatsapp" value="${cfgEsc(config?.whatsapp || '')}" placeholder="Ej: 11 2345-6789">
          </div>
        </div>

        <div class="input-group">
          <label>Dirección</label>
          <input type="text" name="direccion" value="${cfgEsc(config?.direccion || '')}" placeholder="Calle, número, localidad">
        </div>

        <div class="input-group">
          <label>Sitio web / Instagram</label>
          <input type="text" name="web" value="${cfgEsc(config?.web || '')}" placeholder="Ej: @tunegocio o www.tunegocio.com">
        </div>

        <div class="form-row">
          <div class="input-group">
            <label>Hora de apertura</label>
            <input type="time" name="hora_apertura" value="${config?.hora_apertura?.slice(0,5) || '09:00'}">
          </div>
          <div class="input-group">
            <label>Hora de cierre</label>
            <input type="time" name="hora_cierre" value="${config?.hora_cierre?.slice(0,5) || '18:00'}">
          </div>
        </div>
      </div>
      <div class="modal-footer">
        <button type="button" class="btn" onclick="cerrarModal()">Cancelar</button>
        <button type="submit" class="btn btn-primary-sm">Guardar cambios</button>
      </div>
    </form>
  `);

  document.getElementById('form-config').addEventListener('submit', guardarInfoConsultorio);
  document.getElementById('cfg-logo-btn').addEventListener('click', () => {
    document.getElementById('cfg-logo-input').click();
  });
  document.getElementById('cfg-logo-input').addEventListener('change', subirLogo);
}

async function guardarInfoConsultorio(e) {
  e.preventDefault();
  const fd = new FormData(e.target);
  const d = Object.fromEntries(fd.entries());
  const payload = {
    negocio_id: usuarioActual.negocio_id,
    nombre_consultorio: d.nombre_consultorio || null,
    email_contacto: (d.email_contacto || '').trim() || null,
    telefono: (d.telefono || '').trim() || null,
    whatsapp: (d.whatsapp || '').trim() || null,
    direccion: (d.direccion || '').trim() || null,
    web: (d.web || '').trim() || null,
    hora_apertura: d.hora_apertura,
    hora_cierre: d.hora_cierre,
    actualizado_en: new Date().toISOString()
  };
  const { error } = await sb.from('configuracion').upsert(payload, { onConflict: 'negocio_id' });
  if (error) { mostrarMensaje('Error: ' + error.message, 'error'); return; }
  const txt = document.getElementById('sidebar-logo-text');
  if (txt) txt.textContent = d.nombre_consultorio || 'Podología';
  mostrarMensaje('Configuración guardada', 'exito');
  cerrarModal();
}

async function subirLogo(e) {
  const file = e.target.files[0];
  if (!file) return;
  mostrarMensaje('Procesando logo...', 'info');
  try {
    const path = `${usuarioActual.negocio_id}/logo.jpg`;
    const url = await logoSubir(file, path);

    const { error } = await sb.from('configuracion')
      .upsert({
        negocio_id: usuarioActual.negocio_id,
        logo_url: url,
        actualizado_en: new Date().toISOString()
      }, { onConflict: 'negocio_id' });
    if (error) { mostrarMensaje('Error al guardar logo: ' + error.message, 'error'); return; }

    const prev = document.getElementById('cfg-logo-preview');
    if (prev) prev.innerHTML = `<img src="${url}" alt="Logo">`;
    const ic = document.getElementById('sidebar-logo-icon');
    if (ic) ic.innerHTML = `<img src="${url}" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:inherit;display:block;">`;

    mostrarMensaje('Logo actualizado', 'exito');
  } catch (err) {
    mostrarMensaje('Error: ' + (err.message || err), 'error');
  } finally {
    e.target.value = '';
  }
}

// ============================================================
// TARJETA: Agenda y turnos
// ============================================================
async function abrirCfgAgenda() {
  const { data: config } = await sb.from('configuracion')
    .select('duracion_turno_minutos').eq('negocio_id', usuarioActual.negocio_id).maybeSingle();

  abrirModal(`
    <div class="modal-header">
      <div class="modal-titulo">Agenda y turnos</div>
      <button class="modal-cerrar" onclick="cerrarModal()">×</button>
    </div>
    <div class="modal-body">
      <form id="form-agenda">
        <div class="input-group">
          <label>Duración de cada turno (minutos) *</label>
          <input type="number" name="duracion_turno_minutos" value="${config?.duracion_turno_minutos || 45}" min="10" max="240" required>
          <small class="cfg-ayuda">Todos los turnos nuevos van a tener esta duración.</small>
        </div>
        <button type="submit" class="btn btn-primary-sm">Guardar duración</button>
      </form>

      <div class="cfg-sep"></div>

      <div class="cfg-bloque-titulo">Días laborales</div>
      <div class="cfg-ayuda" style="margin-bottom:12px;">Seleccioná los días en los que atendés habitualmente.</div>
      <div id="dias-laborales-lista">Cargando...</div>

      <div class="cfg-sep"></div>

      <div class="cfg-bloque-titulo cfg-bloque-flex">
        <span>Feriados</span>
        <button class="btn cfg-mini" onclick="abrirModalFeriado()">+ Agregar</button>
      </div>
      <div class="cfg-ayuda" style="margin-bottom:12px;">Los feriados se bloquean automáticamente en la agenda.</div>
      <div id="feriados-lista">Cargando...</div>
    </div>
    <div class="modal-footer">
      <button type="button" class="btn" onclick="cerrarModal()">Cerrar</button>
    </div>
  `);

  document.getElementById('form-agenda').addEventListener('submit', guardarDuracionTurno);
  await cargarDiasLaborales();
  await cargarFeriados();
}

async function guardarDuracionTurno(e) {
  e.preventDefault();
  const fd = new FormData(e.target);
  const payload = {
    negocio_id: usuarioActual.negocio_id,
    duracion_turno_minutos: parseInt(fd.get('duracion_turno_minutos'), 10),
    actualizado_en: new Date().toISOString()
  };
  const { error } = await sb.from('configuracion').upsert(payload, { onConflict: 'negocio_id' });
  if (error) { mostrarMensaje('Error: ' + error.message, 'error'); return; }
  mostrarMensaje('Duración guardada', 'exito');
}

// ============================================================
// TARJETA: Modelos de documentos
// ============================================================
async function abrirCfgDocumentos() {
  const { data: cfg } = await sb.from('configuracion')
    .select('documentos_pie_activo, documentos_pie')
    .eq('negocio_id', usuarioActual.negocio_id).maybeSingle();

  const chipsPie = PIE_VARS.map(v =>
    `<button type="button" class="btn cfg-mini" onclick="insertarVariablePie('${v.k}')" title="${v.d}">{${v.k}}</button>`
  ).join(' ');

  abrirModal(`
    <div class="modal-header">
      <div class="modal-titulo">Modelos de documentos</div>
      <button class="modal-cerrar" onclick="cerrarModal()">×</button>
    </div>
    <div class="modal-body">
      <div class="cfg-ayuda" style="margin-bottom:14px;">Textos predefinidos que se completan con los datos del paciente al emitir. Se generan en PDF para imprimir o enviar.</div>

      <div class="cfg-bloque-titulo cfg-bloque-flex">
        <span>Certificados / Justificativos</span>
        <button class="btn cfg-mini" onclick="abrirModalPlantilla('certificado')">+ Agregar</button>
      </div>
      <div id="plantillas-certificado-lista" style="margin-bottom:8px;">Cargando...</div>

      <div class="cfg-sep"></div>

      <div class="cfg-bloque-titulo cfg-bloque-flex">
        <span>Consentimientos informados</span>
        <button class="btn cfg-mini" onclick="abrirModalPlantilla('consentimiento')">+ Agregar</button>
      </div>
      <div id="plantillas-consentimiento-lista">Cargando...</div>

      <div class="cfg-sep"></div>

      <form id="form-pie">
        <div class="cfg-bloque-flex" style="margin-bottom:10px;">
          <div>
            <div style="font-weight:600;">Pie de los documentos</div>
            <small class="cfg-ayuda">Se agrega al final de todos los documentos al emitirlos.</small>
          </div>
          <label class="cfg-switch">
            <input type="checkbox" name="documentos_pie_activo" ${cfg?.documentos_pie_activo ? 'checked' : ''}>
            <span class="cfg-slider"></span>
          </label>
        </div>
        <div class="input-group">
          <textarea name="documentos_pie" id="documentos-pie" rows="3">${cfgEsc(cfg?.documentos_pie || PIE_DEFAULT)}</textarea>
          <small class="cfg-ayuda">Variables (se completan con los datos del negocio):</small>
          <div style="display:flex; flex-wrap:wrap; gap:6px; margin-top:6px;">${chipsPie}</div>
        </div>
        <button type="submit" class="btn btn-primary-sm">Guardar pie</button>
      </form>
    </div>
    <div class="modal-footer">
      <button type="button" class="btn" onclick="cerrarModal()">Cerrar</button>
    </div>
  `);
  document.getElementById('form-pie').addEventListener('submit', guardarPieDocumentos);
  await cargarPlantillas();
}

function insertarVariablePie(k) {
  const ta = document.getElementById('documentos-pie');
  if (!ta) return;
  const ins = '{' + k + '}';
  const s = ta.selectionStart != null ? ta.selectionStart : ta.value.length;
  const e = ta.selectionEnd != null ? ta.selectionEnd : ta.value.length;
  ta.value = ta.value.slice(0, s) + ins + ta.value.slice(e);
  ta.focus();
  const pos = s + ins.length;
  ta.setSelectionRange(pos, pos);
}

async function guardarPieDocumentos(e) {
  e.preventDefault();
  const fd = new FormData(e.target);
  const payload = {
    negocio_id: usuarioActual.negocio_id,
    documentos_pie_activo: fd.get('documentos_pie_activo') === 'on',
    documentos_pie: (fd.get('documentos_pie') || '').trim() || null,
    actualizado_en: new Date().toISOString()
  };
  const { error } = await sb.from('configuracion').upsert(payload, { onConflict: 'negocio_id' });
  if (error) { mostrarMensaje('Error: ' + error.message, 'error'); return; }
  mostrarMensaje('Pie guardado', 'exito');
}

// ============================================================
// TARJETA: Notificaciones (recordatorios automáticos)
// ============================================================
async function abrirCfgNotificaciones() {
  const { data: config } = await sb.from('configuracion')
    .select('recordatorios_activo, recordatorios_hora, recordatorios_mensaje')
    .eq('negocio_id', usuarioActual.negocio_id).maybeSingle();

  const horaSel = config?.recordatorios_hora ?? 10;
  const horasOpts = Array.from({ length: 17 }, (_, i) => i + 6).map(h =>
    `<option value="${h}" ${h === horaSel ? 'selected' : ''}>${String(h).padStart(2, '0')}:00 hs</option>`
  ).join('');
  const chipsRec = RECORDATORIO_VARS.map(v =>
    `<button type="button" class="btn cfg-mini" onclick="insertarVariableRecordatorio('${v.k}')" title="${v.d}">{${v.k}}</button>`
  ).join(' ');

  abrirModal(`
    <div class="modal-header">
      <div class="modal-titulo">Notificaciones</div>
      <button class="modal-cerrar" onclick="cerrarModal()">×</button>
    </div>
    <div class="modal-body">
      <div class="cfg-ayuda" style="margin-bottom:16px;">Recordatorio automático por email el día anterior al turno, a la hora que elijas. Sólo a pacientes que tengan email cargado.</div>

      <form id="form-recordatorios">
        <div class="cfg-bloque-flex" style="margin-bottom:16px;">
          <div>
            <div style="font-weight:600;">Enviar recordatorios automáticos</div>
            <small class="cfg-ayuda">Si está apagado, no se manda ningún recordatorio.</small>
          </div>
          <label class="cfg-switch">
            <input type="checkbox" name="recordatorios_activo" ${config?.recordatorios_activo ? 'checked' : ''}>
            <span class="cfg-slider"></span>
          </label>
        </div>

        <div class="input-group">
          <label>Hora de envío</label>
          <select name="recordatorios_hora">${horasOpts}</select>
          <small class="cfg-ayuda">Se manda el día anterior, a esta hora.</small>
        </div>

        <div class="input-group">
          <label>Texto del mensaje</label>
          <textarea name="recordatorios_mensaje" id="recordatorio-mensaje" rows="5">${cfgEsc(config?.recordatorios_mensaje || RECORDATORIO_MSG_DEFAULT)}</textarea>
          <small class="cfg-ayuda">Variables (se reemplazan con los datos del turno):</small>
          <div style="display:flex; flex-wrap:wrap; gap:6px; margin-top:6px;">${chipsRec}</div>
        </div>

        <button type="submit" class="btn btn-primary-sm">Guardar</button>
      </form>

      <div class="cfg-sep"></div>

      <div class="cfg-bloque-flex">
        <div>
          <div style="font-weight:600;">Envío manual</div>
          <small class="cfg-ayuda" id="uso-emails-texto">Cargando uso del mes...</small>
        </div>
        <button class="btn cfg-mini" onclick="enviarRecordatoriosAhora()">Enviar recordatorios ahora</button>
      </div>
      <small class="cfg-ayuda" style="display:block; margin-top:8px;">"Enviar ahora" manda los recordatorios de los turnos de mañana sin esperar a la hora configurada.</small>
      <small class="cfg-ayuda" style="display:block; margin-top:8px;">Las respuestas de los pacientes llegan al email de contacto configurado en "Información del consultorio".</small>
    </div>
    <div class="modal-footer">
      <button type="button" class="btn" onclick="cerrarModal()">Cerrar</button>
    </div>
  `);

  document.getElementById('form-recordatorios').addEventListener('submit', guardarRecordatorios);
  await cargarUsoEmails();
}

// ============================================================
// TARJETA: placeholder "Próximamente" (Caja / Comisiones)
// ============================================================
function abrirCfgProximamente(titulo, texto) {
  const icoTuerca = '<svg viewBox="0 0 24 24" width="40" height="40" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>';
  abrirModal(`
    <div class="modal-header">
      <div class="modal-titulo">${titulo}</div>
      <button class="modal-cerrar" onclick="cerrarModal()">×</button>
    </div>
    <div class="modal-body">
      <div class="cfg-proximamente">
        <div class="cfg-prox-ico">${icoTuerca}</div>
        <div class="cfg-prox-titulo">Próximamente</div>
        <div class="cfg-ayuda" style="max-width:340px; margin:0 auto;">${texto}</div>
      </div>
    </div>
    <div class="modal-footer">
      <button type="button" class="btn" onclick="cerrarModal()">Cerrar</button>
    </div>
  `);
}

// ============================================================
// MODELOS DE DOCUMENTOS (tabla plantillas_documento, por negocio)
// ============================================================
async function cargarPlantillas() {
  let { data } = await sb.from('plantillas_documento')
    .select('*').eq('negocio_id', usuarioActual.negocio_id)
    .order('orden').order('creado_en');
  let todas = data || [];

  const faltan = [];
  if (!todas.some(p => p.tipo === 'consentimiento'))
    faltan.push({ negocio_id: usuarioActual.negocio_id, tipo: 'consentimiento', nombre: CONSENTIMIENTO_SUGERIDO.nombre, contenido: CONSENTIMIENTO_SUGERIDO.contenido });
  if (!todas.some(p => p.tipo === 'certificado')) {
    faltan.push({ negocio_id: usuarioActual.negocio_id, tipo: 'certificado', nombre: CERTIFICADO_SUGERIDO.nombre, contenido: CERTIFICADO_SUGERIDO.contenido });
    faltan.push({ negocio_id: usuarioActual.negocio_id, tipo: 'certificado', nombre: CERTIFICADO_REPOSO_SUGERIDO.nombre, contenido: CERTIFICADO_REPOSO_SUGERIDO.contenido });
  }
  if (faltan.length) {
    await sb.from('plantillas_documento').insert(faltan);
    ({ data } = await sb.from('plantillas_documento')
      .select('*').eq('negocio_id', usuarioActual.negocio_id)
      .order('orden').order('creado_en'));
    todas = data || [];
  }

  renderListaPlantillas('certificado', todas.filter(p => p.tipo === 'certificado'));
  renderListaPlantillas('consentimiento', todas.filter(p => p.tipo === 'consentimiento'));
}

function renderListaPlantillas(tipo, lista) {
  const cont = document.getElementById('plantillas-' + tipo + '-lista');
  if (!cont) return;
  if (!lista.length) {
    cont.innerHTML = '<div class="vacio" style="padding:1rem;">Sin modelos cargados</div>';
    return;
  }
  cont.innerHTML = lista.map(p => {
    const resumen = (p.contenido || '').replace(/\s+/g, ' ').trim().slice(0, 70);
    return `
      <div class="cfg-feriado">
        <div class="cfg-feriado-ico">${_icoDocMini}</div>
        <div class="cfg-feriado-info">
          <div class="cfg-feriado-nombre">${cfgEsc(p.nombre)}</div>
          <div class="cfg-feriado-sub">${cfgEsc(resumen)}${(p.contenido || '').length > 70 ? '…' : ''}</div>
        </div>
        <button class="cfg-feriado-del" onclick="abrirModalPlantilla('${tipo}','${p.id}')" title="Editar">${_icoLapiz}</button>
        <button class="cfg-feriado-del" onclick="eliminarPlantilla('${p.id}')" title="Eliminar">${_icoTachoMini}</button>
      </div>`;
  }).join('');
}

async function abrirModalPlantilla(tipo, id, sugerido) {
  let p = { nombre: '', contenido: PLANTILLA_SCAFFOLD[tipo] || '', tipo };
  if (id) {
    const { data } = await sb.from('plantillas_documento').select('*').eq('id', id).maybeSingle();
    if (data) p = data;
  } else if (sugerido && tipo === 'consentimiento') {
    p = { tipo, nombre: CONSENTIMIENTO_SUGERIDO.nombre, contenido: CONSENTIMIENTO_SUGERIDO.contenido };
  } else if (sugerido && tipo === 'certificado') {
    p = { tipo, nombre: CERTIFICADO_SUGERIDO.nombre, contenido: CERTIFICADO_SUGERIDO.contenido };
  }
  const etiqueta = p.tipo === 'consentimiento' ? 'consentimiento' : 'certificado';
  const chips = PLANTILLA_VARS.map(v =>
    `<button type="button" class="btn cfg-mini" onclick="insertarVariablePlantilla('${v.k}')" title="${v.d}">{${v.k}}</button>`
  ).join(' ');

  abrirModal(`
    <div class="modal-header">
      <div class="modal-titulo">${id ? 'Editar' : 'Nuevo'} modelo de ${etiqueta}</div>
      <button class="modal-cerrar" onclick="abrirCfgDocumentos()">×</button>
    </div>
    <form id="form-plantilla">
      <input type="hidden" name="id" value="${id || ''}">
      <input type="hidden" name="tipo" value="${cfgEsc(p.tipo)}">
      <div class="modal-body">
        <div class="input-group">
          <label>Nombre del modelo *</label>
          <input type="text" name="nombre" value="${cfgEsc(p.nombre)}" placeholder="Ej: Uña encarnada" required>
        </div>
        <div class="input-group">
          <label>Texto del documento *</label>
          <textarea name="contenido" id="plantilla-contenido" rows="9" required placeholder="Escribí el texto. Insertá variables con los botones de abajo.">${cfgEsc(p.contenido)}</textarea>
          <small class="cfg-ayuda">Variables (se reemplazan con los datos al emitir):</small>
          <div style="display:flex; flex-wrap:wrap; gap:6px; margin-top:6px;">${chips}</div>
        </div>
      </div>
      <div class="modal-footer">
        <button type="button" class="btn" onclick="abrirCfgDocumentos()">Cancelar</button>
        <button type="submit" class="btn btn-primary-sm">${id ? 'Guardar' : 'Crear'}</button>
      </div>
    </form>
  `);

  document.getElementById('form-plantilla').addEventListener('submit', guardarPlantilla);
}

function insertarVariablePlantilla(k) {
  const ta = document.getElementById('plantilla-contenido');
  if (!ta) return;
  const ins = '{' + k + '}';
  const s = ta.selectionStart != null ? ta.selectionStart : ta.value.length;
  const e = ta.selectionEnd != null ? ta.selectionEnd : ta.value.length;
  ta.value = ta.value.slice(0, s) + ins + ta.value.slice(e);
  ta.focus();
  const pos = s + ins.length;
  ta.setSelectionRange(pos, pos);
}

async function guardarPlantilla(e) {
  e.preventDefault();
  const fd = new FormData(e.target);
  const d = Object.fromEntries(fd.entries());
  const payload = {
    negocio_id: usuarioActual.negocio_id,
    tipo: d.tipo,
    nombre: (d.nombre || '').trim(),
    contenido: d.contenido || ''
  };
  let error;
  if (d.id) {
    ({ error } = await sb.from('plantillas_documento').update(payload).eq('id', d.id));
  } else {
    ({ error } = await sb.from('plantillas_documento').insert(payload));
  }
  if (error) { mostrarMensaje('Error: ' + error.message, 'error'); return; }
  mostrarMensaje('Modelo guardado', 'exito');
  await abrirCfgDocumentos();
}

async function eliminarPlantilla(id) {
  if (!await confirmarModal({ titulo: 'Eliminar modelo', texto: '¿Eliminar este modelo?', textoSi: 'Eliminar', peligro: true })) return;
  const { error } = await sb.from('plantillas_documento').delete().eq('id', id);
  if (error) { mostrarMensaje('Error: ' + error.message, 'error'); return; }
  mostrarMensaje('Modelo eliminado', 'exito');
  await cargarPlantillas();
}

// ============================================================
// DÍAS LABORALES
// ============================================================
async function cargarDiasLaborales() {
  const { data } = await sb.from('dias_laborales').select('*').order('dia_semana');
  const nombres = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

  const cont = document.getElementById('dias-laborales-lista');
  if (!cont) return;
  cont.innerHTML = `
    <div class="cfg-dias">
      ${[1,2,3,4,5,6,0].map(d => {
        const dia = (data || []).find(x => x.dia_semana === d);
        const activo = dia?.activo || false;
        return `
          <label class="cfg-dia ${activo ? 'on' : ''}">
            <input type="checkbox" ${activo ? 'checked' : ''} onchange="toggleDiaLaboral(${d}, this.checked)">
            <span>${nombres[d].slice(0,3)}</span>
          </label>
        `;
      }).join('')}
    </div>
  `;
}

async function toggleDiaLaboral(diaSemana, activo) {
  const { data: existente } = await sb.from('dias_laborales')
    .select('*').eq('dia_semana', diaSemana).maybeSingle();

  if (existente) {
    await sb.from('dias_laborales').update({ activo }).eq('id', existente.id);
  } else {
    await sb.from('dias_laborales').insert({
      negocio_id: usuarioActual.negocio_id,
      dia_semana: diaSemana,
      hora_inicio: '09:00',
      hora_fin: '18:00',
      activo
    });
  }
  await cargarDiasLaborales();
}

// ============================================================
// FERIADOS
// ============================================================
async function cargarFeriados() {
  const { data } = await sb.from('feriados').select('*').order('fecha');
  const cont = document.getElementById('feriados-lista');
  if (!cont) return;

  if (!data || data.length === 0) {
    cont.innerHTML = '<div class="vacio" style="padding: 1rem;">Sin feriados cargados</div>';
    return;
  }

  const icoCal = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M8 2v4"/><path d="M16 2v4"/><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18"/></svg>';
  const icoTacho = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>';

  cont.innerHTML = data.map(f => {
    const fecha = new Date(f.fecha + 'T00:00');
    const corta = fecha.toLocaleDateString('es-AR', { day: 'numeric', month: 'long' });
    const larga = fecha.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' });
    return `
      <div class="cfg-feriado">
        <div class="cfg-feriado-ico">${icoCal}</div>
        <div class="cfg-feriado-info">
          <div class="cfg-feriado-nombre">${f.descripcion || corta}</div>
          <div class="cfg-feriado-sub">${larga}</div>
        </div>
        <button class="cfg-feriado-del" onclick="eliminarFeriado('${f.id}')" title="Eliminar">${icoTacho}</button>
      </div>
    `;
  }).join('');
}

function abrirModalFeriado() {
  abrirModal(`
    <div class="modal-header">
      <div class="modal-titulo">Agregar feriado</div>
      <button class="modal-cerrar" onclick="abrirCfgAgenda()">×</button>
    </div>
    <form id="form-feriado">
      <div class="modal-body">
        <div class="input-group">
          <label>Fecha *</label>
          <input type="date" name="fecha" required>
        </div>
        <div class="input-group">
          <label>Descripción</label>
          <input type="text" name="descripcion" placeholder="Ej: Día del trabajador">
        </div>
      </div>
      <div class="modal-footer">
        <button type="button" class="btn" onclick="abrirCfgAgenda()">Cancelar</button>
        <button type="submit" class="btn btn-primary-sm">Agregar</button>
      </div>
    </form>
  `);

  document.getElementById('form-feriado').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const d = Object.fromEntries(fd.entries());
    if (!d.descripcion) d.descripcion = null;

    const { error } = await sb.from('feriados').insert({
      ...d,
      negocio_id: usuarioActual.negocio_id
    });
    if (error) { mostrarMensaje('Error: ' + error.message, 'error'); return; }
    mostrarMensaje('Feriado agregado', 'exito');
    await abrirCfgAgenda();
  });
}

async function eliminarFeriado(id) {
  if (!await confirmarModal({ titulo: 'Eliminar feriado', texto: '¿Eliminar este feriado?', textoSi: 'Eliminar', peligro: true })) return;
  await sb.from('feriados').delete().eq('id', id);
  mostrarMensaje('Feriado eliminado', 'exito');
  await cargarFeriados();
}

// ============================================================
// RECORDATORIOS — guardar config, envío manual, uso del mes
// ============================================================
function insertarVariableRecordatorio(k) {
  const ta = document.getElementById('recordatorio-mensaje');
  if (!ta) return;
  const ins = '{' + k + '}';
  const s = ta.selectionStart != null ? ta.selectionStart : ta.value.length;
  const e = ta.selectionEnd != null ? ta.selectionEnd : ta.value.length;
  ta.value = ta.value.slice(0, s) + ins + ta.value.slice(e);
  ta.focus();
  const pos = s + ins.length;
  ta.setSelectionRange(pos, pos);
}

async function guardarRecordatorios(e) {
  e.preventDefault();
  const fd = new FormData(e.target);
  const payload = {
    negocio_id: usuarioActual.negocio_id,
    recordatorios_activo: fd.get('recordatorios_activo') === 'on',
    recordatorios_hora: parseInt(fd.get('recordatorios_hora'), 10),
    recordatorios_mensaje: (fd.get('recordatorios_mensaje') || '').trim() || RECORDATORIO_MSG_DEFAULT,
    actualizado_en: new Date().toISOString()
  };
  const { error } = await sb.from('configuracion')
    .upsert(payload, { onConflict: 'negocio_id' });
  if (error) { mostrarMensaje('Error: ' + error.message, 'error'); return; }
  mostrarMensaje('Recordatorios guardados', 'exito');
}

async function enviarRecordatoriosAhora() {
  const ok = await confirmarModal({
    titulo: 'Enviar recordatorios ahora',
    texto: 'Se van a enviar los recordatorios de los turnos de mañana a los pacientes que tengan email cargado. ¿Continuar?',
    textoSi: 'Enviar',
    textoNo: 'Cancelar'
  });
  if (!ok) return;

  mostrarMensaje('Enviando recordatorios...', 'info');
  const { data, error } = await sb.functions.invoke('recordatorio-turnos', {
    body: { negocio_id: usuarioActual.negocio_id }
  });
  if (error) { mostrarMensaje('Error al enviar: ' + error.message, 'error'); return; }

  const n = data?.enviados ?? 0;
  const errs = data?.errores ?? 0;
  if (n === 0 && errs === 0) {
    mostrarMensaje('No había recordatorios pendientes para mañana', 'info');
  } else if (errs > 0) {
    mostrarMensaje(`Enviados: ${n}. Con ${errs} error(es).`, 'advertencia');
  } else {
    mostrarMensaje(`Recordatorios enviados: ${n}`, 'exito');
  }
  await cargarUsoEmails();
}

async function cargarUsoEmails() {
  const el = document.getElementById('uso-emails-texto');
  if (!el) return;
  const now = new Date();
  const periodo = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const { data } = await sb.from('uso_emails')
    .select('enviados')
    .eq('negocio_id', usuarioActual.negocio_id)
    .eq('periodo', periodo)
    .maybeSingle();
  const usados = data?.enviados ?? 0;
  el.textContent = `Enviaste ${usados} email${usados === 1 ? '' : 's'} este mes.`;
}

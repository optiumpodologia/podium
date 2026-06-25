// Variables que se reemplazan al EMITIR el documento (paso siguiente).
const PLANTILLA_VARS = [
  { k: 'paciente', d: 'Nombre y apellido del paciente' },
  { k: 'dni', d: 'DNI del paciente' },
  { k: 'fecha', d: 'Fecha de hoy' },
  { k: 'profesional', d: 'Profesional que atiende' },
  { k: 'negocio', d: 'Nombre del negocio' },
  { k: 'motivo', d: 'Motivo / diagnóstico de la consulta' },
  { k: 'horas', d: 'Horas de reposo (se completa al emitir)' }
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
    { titulo: 'Información del consultorio', desc: 'Datos del negocio, logo, email de contacto y horarios.', tint: 'violeta', ico: _cfgIcoConsultorio, accion: 'abrirCfgConsultorio()', soloNegocio: false },
    { titulo: 'Agenda y turnos', desc: 'Duración de turnos, días laborales y feriados.', tint: 'verde', ico: _cfgIcoAgenda, accion: 'abrirCfgAgenda()', soloNegocio: false },
    { titulo: 'Modelos de documentos', desc: 'Certificados y consentimientos para emitir.', tint: 'naranja', ico: _cfgIcoDocumentos, accion: 'abrirCfgDocumentos()', soloNegocio: false },
    { titulo: 'Notificaciones', desc: 'Recordatorios automáticos por email a los pacientes.', tint: 'celeste', ico: _cfgIcoNotif, accion: 'abrirCfgNotificaciones()', soloNegocio: true },
    { titulo: 'Caja', desc: 'Medios de pago, moneda y opciones de caja.', tint: 'rosa', ico: _cfgIcoCaja, accion: "abrirCfgProximamente('Caja','Acá vas a poder configurar medios de pago, moneda y opciones de caja.')", soloNegocio: true, prox: true },
    { titulo: 'Comisiones', desc: 'Comisiones por profesional y por servicio.', tint: 'amarillo', ico: _cfgIcoComisiones, accion: "abrirCfgProximamente('Comisiones','Acá vas a poder configurar las comisiones de cada profesional.')", soloNegocio: true, prox: true }
  ].filter(t => !t.soloNegocio || esNegocio);

  const cards = tarjetas.map(t => `
    <div class="cfg-card cfg-tint-${t.tint}" onclick="${t.accion}" tabindex="0"
         onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();${t.accion}}">
      <div class="cfg-card-ico">${t.ico}</div>
      <div class="cfg-card-titulo">${t.titulo}${t.prox ? ' <span class="cfg-badge-prox">Próximamente</span>' : ''}</div>
      <div class="cfg-card-desc">${t.desc}</div>
      <div class="cfg-card-cta">Configurar</div>
    </div>
  `).join('');

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
    </div>
    <div class="modal-footer">
      <button type="button" class="btn" onclick="cerrarModal()">Cerrar</button>
    </div>
  `);
  await cargarPlantillas();
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

// ============================================================
// PACIENTES — listado con buscador, orden, paginado y acciones
// Estilo base reutilizable para todos los listados (clases .lista-*).
// ============================================================

const PAC_COLS = [
  { k: 'apellido',         label: 'Apellido, Nombre',    orden: true },
  { k: 'dni',              label: 'DNI',                 orden: true },
  { k: 'telefono',         label: 'Teléfono',            orden: false },
  { k: 'fecha_nacimiento', label: 'Fecha de nacimiento', orden: true },
  { k: 'obra_social',      label: 'Obra social',         orden: true },
];

// Paleta de avatares (fondo, texto) — se elige de forma estable por nombre.
const LISTA_AVATAR = [
  ['#EDE9FB', '#6D5BD0'], ['#E3F1FD', '#2E6FB8'], ['#E3F6EC', '#1F9D6B'],
  ['#FCEAD6', '#E27A2E'], ['#FBE4EF', '#C2418A'], ['#FBEAEA', '#CB3A3A'],
  ['#E6F4F1', '#0E8C8C'], ['#F0ECF9', '#7A53C9'],
];
function listaAvatarColor(s) {
  let h = 0; for (const c of String(s)) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return LISTA_AVATAR[h % LISTA_AVATAR.length];
}

const LISTA_ICO = {
  buscar:   '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>',
  tel:      '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>',
  ojo:      '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>',
  lapiz:    '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>',
  tacho:    '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>',
  exportar: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/></svg>',
  imprimir: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect width="12" height="8" x="6" y="14"/></svg>',
};

const _pac = { all: [], filtro: '', col: 'apellido', dir: 'asc', pagina: 1, porPagina: 10 };

async function renderPacientes(container) {
  const esRecep = usuarioActual.rol === 'recepcion';
  container.innerHTML = `
    <div class="lista-toolbar">
      ${esRecep ? `<button class="btn btn-primary-sm" onclick="abrirModalPaciente()"><span>+</span> Nuevo paciente</button>` : ''}
      <button class="btn" onclick="pacExportar()">${LISTA_ICO.exportar} Exportar</button>
      <button class="btn" onclick="pacImprimir()">${LISTA_ICO.imprimir} Imprimir</button>
      <div class="lista-toolbar-sp"></div>
      <div class="lista-buscar">
        ${LISTA_ICO.buscar}
        <input type="text" id="buscar-paciente" placeholder="Buscar paciente..." oninput="pacBuscar(this.value)">
      </div>
    </div>

    <div class="lista-card">
      <table class="lista">
        <thead><tr id="pac-thead"></tr></thead>
        <tbody id="tabla-pacientes">
          <tr><td colspan="${PAC_COLS.length + 1}" class="lista-vacio">Cargando...</td></tr>
        </tbody>
      </table>
    </div>
    <div class="lista-pie" id="pac-pie"></div>
  `;

  document.getElementById('pac-thead').innerHTML =
    PAC_COLS.map(c => c.orden
      ? `<th class="lista-th-sort" data-col="${c.k}" onclick="pacOrden('${c.k}')">${c.label}<span class="sort-ico">⇅</span></th>`
      : `<th>${c.label}</th>`).join('') +
    `<th style="text-align:right;">Acciones</th>`;

  await cargarPacientes();
}

async function cargarPacientes() {
  const { data, error } = await sb.from('pacientes').select('*').order('apellido').order('nombre');
  if (error) { mostrarMensaje('Error al cargar pacientes', 'error'); console.error(error); return; }
  _pac.all = data || [];
  pacRender();
}

function pacBuscar(v) { _pac.filtro = v.toLowerCase().trim(); _pac.pagina = 1; pacRender(); }
function pacOrden(col) {
  if (_pac.col === col) _pac.dir = (_pac.dir === 'asc') ? 'desc' : 'asc';
  else { _pac.col = col; _pac.dir = 'asc'; }
  pacRender();
}
function pacPagina(n) { _pac.pagina = n; pacRender(); }
function pacPorPagina(n) { _pac.porPagina = parseInt(n) || 10; _pac.pagina = 1; pacRender(); }

function pacFiltrados() {
  const q = _pac.filtro;
  const l = !q ? _pac.all.slice() : _pac.all.filter(p =>
    `${p.apellido} ${p.nombre} ${p.dni || ''} ${p.telefono || ''} ${p.obra_social || ''}`.toLowerCase().includes(q));
  const dir = (_pac.dir === 'asc') ? 1 : -1;
  const col = _pac.col;
  l.sort((a, b) => {
    let va, vb;
    if (col === 'apellido') { va = `${a.apellido} ${a.nombre}`; vb = `${b.apellido} ${b.nombre}`; }
    else { va = a[col]; vb = b[col]; }
    va = (va == null ? '' : String(va)).toLowerCase();
    vb = (vb == null ? '' : String(vb)).toLowerCase();
    return va < vb ? -dir : (va > vb ? dir : 0);
  });
  return l;
}

function pacFechaLinda(f) { return f ? new Date(f + 'T00:00').toLocaleDateString('es-AR') : '—'; }

function pacRender() {
  const esRecep = usuarioActual.rol === 'recepcion';
  const lista = pacFiltrados();
  const total = lista.length;
  const porPag = _pac.porPagina;
  const totalPags = Math.max(1, Math.ceil(total / porPag));
  if (_pac.pagina > totalPags) _pac.pagina = totalPags;
  const ini = (_pac.pagina - 1) * porPag;
  const pageItems = lista.slice(ini, ini + porPag);

  // Indicadores de orden en la cabecera
  document.querySelectorAll('#pac-thead .lista-th-sort').forEach(th => {
    const act = th.dataset.col === _pac.col;
    th.classList.toggle('activo', act);
    const ico = th.querySelector('.sort-ico');
    if (ico) ico.textContent = act ? (_pac.dir === 'asc' ? '↑' : '↓') : '⇅';
  });

  const tbody = document.getElementById('tabla-pacientes');
  if (total === 0) {
    tbody.innerHTML = `<tr><td colspan="${PAC_COLS.length + 1}" class="lista-vacio">${_pac.filtro ? 'No hay resultados para la búsqueda' : 'No hay pacientes'}</td></tr>`;
  } else {
    tbody.innerHTML = pageItems.map(p => {
      const [bg, fg] = listaAvatarColor(`${p.apellido}${p.nombre}`);
      const inic = ((p.apellido?.[0] || '') + (p.nombre?.[0] || '')).toUpperCase() || '?';
      return `
      <tr>
        <td>
          <div class="lista-nombre">
            <div class="lista-avatar" style="background:${bg}; color:${fg};">${inic}</div>
            <span class="lista-nombre-txt">${p.apellido}, ${p.nombre}</span>
          </div>
        </td>
        <td>${p.dni || '—'}</td>
        <td>${p.telefono ? `<span class="lista-tel">${LISTA_ICO.tel}${p.telefono}</span>` : '—'}</td>
        <td>${pacFechaLinda(p.fecha_nacimiento)}</td>
        <td>${p.obra_social || '—'}</td>
        <td>
          <div class="lista-acciones">
            <button class="lista-acc-btn" onclick="verFichaPaciente('${p.id}')" title="Ver ficha">${LISTA_ICO.ojo}</button>
            ${esRecep ? `
              <button class="lista-acc-btn" onclick="abrirModalPaciente('${p.id}')" title="Editar">${LISTA_ICO.lapiz}</button>
              <button class="lista-acc-btn peligro" onclick="eliminarPaciente('${p.id}')" title="Eliminar">${LISTA_ICO.tacho}</button>
            ` : ''}
          </div>
        </td>
      </tr>`;
    }).join('');
  }

  const desde = total === 0 ? 0 : ini + 1;
  const hasta = Math.min(ini + porPag, total);
  document.getElementById('pac-pie').innerHTML = `
    <div class="lista-pie-info">Mostrando ${desde} a ${hasta} de ${total} paciente${total !== 1 ? 's' : ''}</div>
    <div class="lista-pag">${listaPaginadoHTML(_pac.pagina, totalPags, 'pacPagina')}</div>
    <select class="lista-perpag" onchange="pacPorPagina(this.value)">
      ${[10, 25, 50].map(n => `<option value="${n}" ${n === porPag ? 'selected' : ''}>${n} por página</option>`).join('')}
    </select>
  `;
}

// Paginado reutilizable: recibe el nombre de la función que cambia de página.
function listaPaginadoHTML(actual, totalPags, fnNombre) {
  if (totalPags <= 1) return '';
  const set = new Set([1, totalPags, actual]);
  for (let i = actual - 1; i <= actual + 1; i++) if (i >= 1 && i <= totalPags) set.add(i);
  const nums = [...set].sort((a, b) => a - b);
  let html = `<button ${actual === 1 ? 'disabled' : `onclick="${fnNombre}(${actual - 1})"`}>‹</button>`;
  let prev = 0;
  for (const n of nums) {
    if (n - prev > 1) html += `<span class="puntos">…</span>`;
    html += `<button class="${n === actual ? 'activo' : ''}" ${n === actual ? '' : `onclick="${fnNombre}(${n})"`}>${n}</button>`;
    prev = n;
  }
  html += `<button ${actual === totalPags ? 'disabled' : `onclick="${fnNombre}(${actual + 1})"`}>›</button>`;
  return html;
}

function pacExportar() {
  const lista = pacFiltrados();
  if (!lista.length) { mostrarMensaje('No hay pacientes para exportar', 'advertencia'); return; }
  const cols = [['Apellido', 'apellido'], ['Nombre', 'nombre'], ['DNI', 'dni'], ['Teléfono', 'telefono'], ['Email', 'email'], ['Fecha nacimiento', 'fecha_nacimiento'], ['Obra social', 'obra_social'], ['N° afiliado', 'numero_afiliado']];
  const esc = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const filas = [cols.map(c => esc(c[0])).join(',')];
  lista.forEach(p => filas.push(cols.map(c => esc(p[c[1]])).join(',')));
  const blob = new Blob(['\ufeff' + filas.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `pacientes_${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
}

function pacImprimir() {
  const lista = pacFiltrados();
  const filas = lista.map(p =>
    `<tr><td>${p.apellido}, ${p.nombre}</td><td>${p.dni || ''}</td><td>${p.telefono || ''}</td><td>${pacFechaLinda(p.fecha_nacimiento)}</td><td>${p.obra_social || ''}</td></tr>`).join('');
  const w = window.open('', '_blank');
  if (!w) { mostrarMensaje('Habilitá las ventanas emergentes para imprimir', 'advertencia'); return; }
  w.document.write(`<html><head><title>Pacientes</title><style>
    body{font-family:system-ui,-apple-system,sans-serif;padding:24px;color:#1a1a1a}
    h1{font-size:18px;margin:0 0 4px}
    .sub{color:#666;font-size:12px;margin-bottom:14px}
    table{width:100%;border-collapse:collapse;font-size:13px}
    th,td{text-align:left;padding:8px 10px;border-bottom:1px solid #e3e3e3}
    th{font-size:11px;text-transform:uppercase;letter-spacing:.4px;color:#777}
  </style></head><body>
    <h1>Pacientes</h1><div class="sub">${lista.length} registro${lista.length !== 1 ? 's' : ''} · ${new Date().toLocaleDateString('es-AR')}</div>
    <table><thead><tr><th>Apellido, Nombre</th><th>DNI</th><th>Teléfono</th><th>Fecha nac.</th><th>Obra social</th></tr></thead>
    <tbody>${filas}</tbody></table>
  </body></html>`);
  w.document.close(); w.focus(); w.print();
}

function _pacSyncHero() {
  const a = (document.querySelector('#form-paciente [name=apellido]')?.value || '').trim();
  const n = (document.querySelector('#form-paciente [name=nombre]')?.value || '').trim();
  const nom = document.getElementById('pac-hero-nombre');
  const ini = document.getElementById('pac-hero-ini');
  if (nom) nom.textContent = (a || n) ? `${a}${a && n ? ', ' : ''}${n}` : 'Nuevo paciente';
  if (ini) ini.textContent = ((a[0] || '') + (n[0] || '')).toUpperCase() || '?';
}

async function abrirModalPaciente(id) {
  let paciente = {
    nombre: '', apellido: '', dni: '', fecha_nacimiento: '',
    telefono: '', email: '', direccion: '', obra_social: '',
    numero_afiliado: '', notas: ''
  };

  if (id) {
    const { data } = await sb.from('pacientes').select('*').eq('id', id).single();
    if (data) paciente = data;
  }

  const inic = ((paciente.apellido?.[0] || '') + (paciente.nombre?.[0] || '')).toUpperCase() || '?';
  const nombreHero = (paciente.apellido || paciente.nombre) ? `${paciente.apellido || ''}${paciente.apellido && paciente.nombre ? ', ' : ''}${paciente.nombre || ''}` : 'Nuevo paciente';
  const sub = paciente.creado_en ? `Paciente desde ${new Date(paciente.creado_en).getFullYear()}` : (id ? 'Paciente' : 'Datos del nuevo paciente');

  const sv = (p) => `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${p}</svg>`;
  const I = {
    user:  sv('<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4.2 3.6-6.5 8-6.5s8 2.3 8 6.5"/>'),
    tel:   sv('<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2 4.2 2 2 0 0 1 4 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.9.7 2.8a2 2 0 0 1-.4 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.9.6 2.8.7A2 2 0 0 1 22 16.9z"/>'),
    mail:  sv('<rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>'),
    cal:   sv('<path d="M8 2v4"/><path d="M16 2v4"/><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18"/>'),
    dni:   sv('<rect width="20" height="14" x="2" y="5" rx="2"/><circle cx="8" cy="12" r="2"/><path d="M14 10h4M14 14h4"/>'),
    pin:   sv('<path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/>'),
    obra:  sv('<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/>'),
    afil:  sv('<rect width="20" height="14" x="2" y="5" rx="2"/><line x1="2" x2="22" y1="10" y2="10"/>'),
    shield:sv('<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/>'),
    note:  sv('<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M9 13h6"/><path d="M9 17h4"/>'),
    tacho: sv('<path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>'),
    check: sv('<polyline points="20 6 9 17 4 12"/>'),
    verif: '<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M9 12l2 2 4-4m6 2a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>'
  };
  const OBRAS = ['OSDE', 'Swiss Medical', 'Galeno', 'Medifé', 'OMINT', 'IOMA', 'PAMI', 'OSECAC', 'Sancor Salud', 'Particular'];
  const notas = paciente.notas || '';

  abrirModal(`
    <style>
      .modal { max-width: 860px; }
      .pac-body { background:#fff; }
      .pac-hero { position:relative; display:flex; align-items:center; gap:16px; background:linear-gradient(120deg,#F6F4FE,#FBFAFF); border:1px solid var(--borde-tenue); border-radius:16px; padding:16px 18px; margin-bottom:22px; }
      .pac-avatar { width:60px; height:60px; flex:none; border-radius:50%; background:linear-gradient(135deg,#C9BEF6,#9E8DE8); color:#fff; display:flex; align-items:center; justify-content:center; font-size:20px; font-weight:700; box-shadow:0 2px 8px rgba(83,74,183,.25); }
      .pac-hero-nombre { font-size:20px; font-weight:700; color:var(--texto); }
      .pac-hero-sub { display:flex; align-items:center; gap:6px; font-size:13px; color:var(--texto-secundario); margin-top:3px; }
      .pac-verif { color:var(--primario); display:inline-flex; }
      .pac-grid { display:grid; grid-template-columns:1fr 1fr; gap:24px 28px; }
      .pac-sec-card { background:rgba(83,74,183,.05); border:1px solid var(--borde-tenue); border-radius:14px; padding:16px 18px; }
      .pac-sec-lbl { display:flex; align-items:center; gap:10px; font-size:14px; font-weight:600; color:var(--texto); margin-bottom:14px; }
      .pac-sec-ico { width:30px; height:30px; flex:none; border-radius:9px; display:flex; align-items:center; justify-content:center; }
      .pac-ico-violeta { background:var(--primario-claro); color:var(--primario); }
      .pac-ico-verde { background:var(--exito-claro); color:var(--exito); }
      .pac-row { display:flex; gap:12px; margin-bottom:12px; }
      .pac-row:last-child { margin-bottom:0; }
      .pac-field { flex:1; min-width:0; }
      .pac-field label { display:block; font-size:12px; color:var(--texto-secundario); margin-bottom:5px; }
      .pac-iw { position:relative; }
      .pac-iw .pac-fico { position:absolute; left:11px; top:50%; transform:translateY(-50%); color:var(--texto-tenue); pointer-events:none; display:flex; }
      .pac-iw input { width:100%; padding:10px 12px; border:1px solid var(--borde-tenue); border-radius:10px; font:inherit; font-size:13.5px; background:#fff; transition:border-color .12s; }
      .pac-iw.ico input { padding-left:36px; }
      .pac-iw input:focus { border-color:var(--primario-medio); outline:none; }
      .pac-textarea { width:100%; min-height:104px; resize:vertical; padding:10px 12px; border:1px solid var(--borde-tenue); border-radius:10px; font:inherit; font-size:13.5px; transition:border-color .12s; }
      .pac-textarea:focus { border-color:var(--primario-medio); outline:none; }
      .pac-count { text-align:right; font-size:11px; color:var(--texto-secundario); margin-top:4px; }
      .pac-footer { display:flex; align-items:center; }
      .pac-footer-right { margin-left:auto; display:flex; gap:10px; }
      .pac-del { display:inline-flex; align-items:center; gap:7px; color:var(--peligro); border:1px solid var(--borde-tenue); }
      .pac-del:hover { border-color:var(--peligro); background:var(--peligro-claro); }
      .pac-guardar { display:inline-flex; align-items:center; gap:7px; }
    </style>

    <div class="modal-header">
      <div class="modal-titulo">${id ? 'Editar paciente' : 'Nuevo paciente'}</div>
      <button class="modal-cerrar" onclick="cerrarModal()">×</button>
    </div>
    <form id="form-paciente">
      <div class="modal-body pac-body">

        <div class="pac-hero">
          <div class="pac-avatar" id="pac-hero-ini">${inic}</div>
          <div>
            <div class="pac-hero-nombre" id="pac-hero-nombre">${nombreHero}</div>
            <div class="pac-hero-sub">${sub} ${id ? `<span class="pac-verif">${I.verif}</span>` : ''}</div>
          </div>
        </div>

        <div class="pac-grid">
          <div>
            <div class="pac-sec-lbl"><span class="pac-sec-ico pac-ico-violeta">${I.user}</span> Datos personales</div>
            <div class="pac-row">
              <div class="pac-field"><label>Apellido *</label><div class="pac-iw"><input type="text" name="apellido" value="${(paciente.apellido || '').replace(/"/g, '&quot;')}" required oninput="_pacSyncHero()"></div></div>
              <div class="pac-field"><label>Nombre *</label><div class="pac-iw"><input type="text" name="nombre" value="${(paciente.nombre || '').replace(/"/g, '&quot;')}" required oninput="_pacSyncHero()"></div></div>
            </div>
            <div class="pac-row">
              <div class="pac-field"><label>DNI</label><div class="pac-iw ico"><span class="pac-fico">${I.dni}</span><input type="text" name="dni" value="${paciente.dni || ''}"></div></div>
              <div class="pac-field"><label>Fecha de nacimiento</label><div class="pac-iw ico"><span class="pac-fico">${I.cal}</span><input type="date" name="fecha_nacimiento" value="${paciente.fecha_nacimiento || ''}"></div></div>
            </div>
          </div>

          <div>
            <div class="pac-sec-lbl"><span class="pac-sec-ico pac-ico-violeta">${I.tel}</span> Contacto</div>
            <div class="pac-row">
              <div class="pac-field"><label>Teléfono</label><div class="pac-iw ico"><span class="pac-fico">${I.tel}</span><input type="text" name="telefono" value="${paciente.telefono || ''}"></div></div>
              <div class="pac-field"><label>Email</label><div class="pac-iw ico"><span class="pac-fico">${I.mail}</span><input type="email" name="email" value="${paciente.email || ''}" placeholder="correo@ejemplo.com"></div></div>
            </div>
            <div class="pac-row">
              <div class="pac-field"><label>Dirección</label><div class="pac-iw ico"><span class="pac-fico">${I.pin}</span><input type="text" name="direccion" value="${(paciente.direccion || '').replace(/"/g, '&quot;')}" placeholder="Ej: Av. Rivadavia 1234, CABA"></div></div>
            </div>
          </div>

          <div class="pac-sec-card">
            <div class="pac-sec-lbl"><span class="pac-sec-ico pac-ico-verde">${I.shield}</span> Cobertura</div>
            <div class="pac-row">
              <div class="pac-field"><label>Obra social</label><div class="pac-iw ico"><span class="pac-fico">${I.obra}</span><input type="text" name="obra_social" list="pac-os" value="${(paciente.obra_social || '').replace(/"/g, '&quot;')}" placeholder="Seleccionar obra social"></div></div>
            </div>
            <div class="pac-row">
              <div class="pac-field"><label>N° de afiliado</label><div class="pac-iw ico"><span class="pac-fico">${I.afil}</span><input type="text" name="numero_afiliado" value="${paciente.numero_afiliado || ''}" placeholder="Número de afiliado"></div></div>
            </div>
            <datalist id="pac-os">${OBRAS.map(o => `<option value="${o}">`).join('')}</datalist>
          </div>

          <div class="pac-sec-card">
            <div class="pac-sec-lbl"><span class="pac-sec-ico pac-ico-violeta">${I.note}</span> Observaciones</div>
            <label style="display:block; font-size:12px; color:var(--texto-secundario); margin-bottom:5px;">Notas</label>
            <textarea name="notas" class="pac-textarea" maxlength="500" placeholder="Escribí aquí cualquier observación relevante sobre el paciente…" oninput="document.getElementById('pac-notas-count').textContent=this.value.length">${notas}</textarea>
            <div class="pac-count"><span id="pac-notas-count">${notas.length}</span>/500</div>
          </div>
        </div>

      </div>
      <div class="modal-footer pac-footer">
        ${id ? `<button type="button" class="btn pac-del" onclick="eliminarPaciente('${id}')">${I.tacho} Eliminar paciente</button>` : ''}
        <div class="pac-footer-right">
          <button type="button" class="btn" onclick="cerrarModal()">Cancelar</button>
          <button type="submit" class="btn btn-primary-sm pac-guardar">${I.check} ${id ? 'Guardar cambios' : 'Crear paciente'}</button>
        </div>
      </div>
    </form>
  `);

  document.getElementById('form-paciente').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const datos = Object.fromEntries(fd.entries());
    Object.keys(datos).forEach(k => { if (datos[k] === '') datos[k] = null; });

    let res;
    if (id) {
      res = await sb.from('pacientes').update(datos).eq('id', id);
    } else {
      res = await sb.from('pacientes').insert({ ...datos, negocio_id: usuarioActual.negocio_id });
    }

    if (res.error) {
      mostrarMensaje('Error al guardar: ' + res.error.message, 'error');
      return;
    }

    mostrarMensaje(id ? 'Paciente actualizado' : 'Paciente creado', 'exito');
    cerrarModal();
    await cargarPacientes();
  });
}

async function eliminarPaciente(id) {
  if (!confirm('¿Eliminar este paciente? Esta acción no se puede deshacer.')) return;
  const { error } = await sb.from('pacientes').delete().eq('id', id);
  if (error) {
    mostrarMensaje('No se puede eliminar: tiene turnos asociados', 'error');
    return;
  }
  mostrarMensaje('Paciente eliminado', 'exito');
  if (typeof cerrarModal === 'function') cerrarModal();
  await cargarPacientes();
}

# Sistema de Podología

Sistema de gestión de turnos, pacientes e historias clínicas para consultorio de podología.

## Estructura

```
podologia/
├── index.html              ← Pantalla de login
├── app.html                ← Aplicación principal
├── css/
│   └── styles.css          ← Estilos
└── js/
    ├── config.js           ← URL y key de Supabase (editar si cambia el proyecto)
    ├── supabase.js         ← Cliente y helpers
    ├── dashboard.js        ← Inicio
    ├── agenda.js           ← Calendario semanal
    ├── pacientes.js        ← Lista de pacientes
    ├── turnos.js           ← Crear/editar turnos
    ├── profesionales.js    ← Gestión de profesionales
    ├── tipos_atencion.js   ← Catálogo de servicios
    ├── productos.js        ← Inventario
    └── ficha_paciente.js   ← Historia clínica
```

## Roles

**Recepción**: maneja todo (pacientes, turnos, configuración, productos).
**Profesional**: ve solo sus propios turnos y carga fichas clínicas.

## Cómo probar en local

1. Descomprimí el ZIP en una carpeta
2. Abrí esa carpeta en VS Code (o cualquier editor)
3. Instalá la extensión "Live Server" en VS Code
4. Hacé click derecho en `index.html` → "Open with Live Server"
5. Se abre en el navegador en `http://localhost:5500` o similar
6. Logueate con tu email y contraseña

**Importante**: NO abras el archivo directamente con doble click (`file://`).
Supabase necesita un servidor (aunque sea local) para funcionar bien.

## Cómo subir a GitHub Pages

1. Creá un repositorio nuevo en GitHub (público o privado)
2. Subí todos los archivos de esta carpeta
3. En el repo: Settings → Pages → Source: "Deploy from a branch"
4. Branch: `main`, carpeta: `/ (root)` → Save
5. Esperá 1-2 minutos. Vas a tener una URL tipo:
   `https://tuusuario.github.io/podologia`

Una vez tengas la URL, agregala en Supabase:
- Authentication → URL Configuration → Redirect URLs

## Crear más usuarios

**Recepción**:
1. Supabase → Authentication → Add user → Create new user
2. Marcar "Auto Confirm User"
3. Copiar el User UID
4. En SQL Editor:
   ```sql
   insert into public.usuarios (id, email, nombre, rol)
   values ('USER_UID', 'email@ejemplo.com', 'Nombre', 'recepcion');
   ```

**Profesional** (2 pasos):
1. Crear el usuario en Authentication (igual que arriba)
2. En SQL Editor, crear el registro de usuario:
   ```sql
   insert into public.usuarios (id, email, nombre, rol)
   values ('USER_UID', 'profesional@ejemplo.com', 'Dra. María González', 'profesional');
   ```
3. Después, desde la app → módulo "Profesionales" → editar o crear el profesional
   y vincularlo con ese usuario en el campo "Usuario vinculado"

## Soporte / mejoras futuras

Cosas que se pueden agregar después:
- Cobranza y facturación al finalizar turno
- Recordatorios automáticos por WhatsApp / mail
- Reportes mensuales de ingresos
- Exportar historias clínicas en PDF
- Modo offline (PWA)
- Foto de la zona tratada en la ficha

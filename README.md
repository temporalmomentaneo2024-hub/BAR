# BarFlow - Sistema de Contabilidad (Netlify + Postgres)

Frontend React + Vite, backend Express empacado como Netlify Function, persistencia en Postgres (Neon).

## Variables de entorno

Configura `.env.local` (local) y las mismas claves en Netlify:

```
DATABASE_URL=postgres://USER:PASSWORD@HOST:PORT/DB
JWT_SECRET=una_clave_secreta
VITE_API_URL=/api
```

## Preparar base de datos (Neon)

1. Crea un proyecto en Neon y copia el `postgres://...` (usar opción pooled si está disponible).
2. Ejecuta el schema (idempotente) desde tu máquina o consola SQL de Neon:
   ```
   psql "$DATABASE_URL" -f server/schema.sql
   ```
   Esto crea tablas normalizadas (usuarios, categorías, productos, turnos, ventas, fiao, contabilidad, etc.) y si no existe un admin, inserta `admin / 123`.

## Correr en local

1. Instala dependencias:
   ```
   npm install
   ```
2. Levanta backend Express en 3000:
   ```
   npm run dev:api
   ```
3. Levanta frontend Vite (usa API en 3000 por defecto):
   ```
   npm run dev
   ```
   o bien modo Netlify (proxy API + Vite en 8888):
   ```
   npm run dev:netlify
   ```
   - Frontend: http://localhost:5173 (Vite) o http://localhost:8888 (Netlify dev)
   - API: http://localhost:3000/api (o proxied en 8888/api con Netlify dev)

## Despliegue en Netlify

1. Configura variables `DATABASE_URL` y `JWT_SECRET` en el panel de Netlify.
2. `VITE_API_URL` puede quedar como `/api` (usa el redirect del `netlify.toml`).
3. Build command: `npm run build`
4. Publish directory: `dist`
5. Functions directory: `netlify/functions`

## Endpoints principales

- Auth: `POST /api/login`, `GET /api/me` (JWT)
- Categorías/Productos: CRUD bajo `/api/categories`, `/api/products`
- Turnos: abrir `/api/shifts/open`, cerrar `/api/shifts/:id/close`, activo `/api/shifts/active`, historial `/api/shifts`, reabrir `/api/shifts/:id/reopen`
- Crédito (fiao): `/api/credit/customers`, `/api/credit/customers/:id/debt`, `/api/credit/customers/:id/payment`, historial `/api/credit/customers/:id/history`
- Contabilidad: gastos fijos `/api/accounting/fixed-expenses`, nómina `/api/accounting/payroll`, compras `/api/accounting/purchases`
- Configuración y limpieza: `/api/config`, `/api/admin/clear`

## Notas rápidas

- El login valida en la base de datos y entrega JWT; el front guarda token y usuario en `localStorage`.
- El backend calcula el cierre de turno con inventario inicial/final y movimientos de crédito en el rango del turno.
- Esquema y seeds en `server/schema.sql`. 

# F2 — Pacientes y expediente básico

## Alcance

Lista y búsqueda de pacientes (hasta 100 coincidencias), alta manual con consentimiento
expreso, fecha e IP registradas en servidor, ficha con Resumen, Antropometría e Historial.
Citas y pagos se consultan para el resumen, sin modificar su comportamiento.
Mediciones: alta, edición y borrado, gráficas SVG por fecha, índices y calculadora energética.
Notas clínicas: alta y lista descendente, enlace opcional a una cita del mismo paciente y tenant.

Los datos clínicos llegan al cliente mediante server actions autenticadas (frontera API).
La sesión define el tenant; los UUID y los cuerpos se validan con Zod. Ninguna acción recibe
un nutritionist_id del navegador. Los pagos se filtran por el tenant de la cita enlazada.
El acceso a una ficha se audita antes de entregar sus datos. Las mutaciones clínicas y
su audit_log se escriben atómicamente: batch transaccional para altas y CTE para edición/borrado.
La bitácora contiene actor, acción, entidad, UUID e IP, sin copiar textos ni mediciones.

La IP se toma de x-forwarded-for (primer salto) o x-real-ip; el proxy de despliegue debe
sobrescribir estos encabezados. Si falta una IP válida, el alta con consentimiento falla.
Las fechas de medición se capturan en la zona del dispositivo, se convierten a UTC y se
presentan en la zona del profesional. Las fechas de nacimiento conservan su día calendario.

## DB y seed locales

Crear una DB propia según docs/worktrees.md; este trabajo usa granola_expediente en 5433
y un proxy Neon separado en 4446. No usar la DB compartida granola para estas migraciones.
Aplicar, con psql y ON_ERROR_STOP, 0000_init.sql, 0001_f1_gaps.sql y 0002_f2_expediente.sql
(en ese orden, cada archivo en una transacción). No usar drizzle-kit push.
La migración se generó con `pnpm db:generate --name f2_expediente`.

Configurar apps/web/.env.local con DATABASE_URL, NEON_LOCAL_PROXY, NEON_LOCAL_PG_HOST,
BETTER_AUTH_SECRET, BETTER_AUTH_URL y NEXT_PUBLIC_APP_URL. No versionar el archivo.
Para probar simultáneamente varios worktrees, utilizar un host distinto: las cookies
para localhost se comparten entre puertos.

```sh
pnpm install --frozen-lockfile
pnpm db:seed
pnpm exec tsx scripts/seed-expediente.ts
pnpm --filter @granola/web exec next typegen
pnpm typecheck && pnpm lint && pnpm test && pnpm --filter @granola/web exec next build
```

El seed F2 es idempotente, solo agrega datos ficticios para Ana de Karla.
No genera mensajes, cobros, jobs ni cambios en auth. Iniciar Next con el mismo origen
configurado en BETTER_AUTH_URL y entrar con la cuenta demo documentada en AGENTS.md.

## Recorrido de comprobación

1. /app/pacientes: buscar Ana por nombre y Luis por parte de su WhatsApp.
2. Alta manual: comprobar bloqueo sin consentimiento; guardar un paciente ficticio
   y comprobar nacimiento, sexo, notas, fecha de consentimiento e IP en Resumen.
3. Ana: comprobar próximas/últimas citas y el pago de $800 del seed.
4. Antropometría: revisar gráficas del seed. Crear una medición con decimales,
   editar peso y borrar únicamente esa medición de prueba. Revisar IMC e índices.
5. Calculadora: factor de actividad y objetivos déficit/mantenimiento/superávit;
   comprobar GET y objetivo con ambas ecuaciones. Menores de 18 no se calculan.
6. /app/agenda/[id]: Agregar nota de consulta debe abrir Historial con la cita vinculada;
   guardar texto ficticio, recargar y comprobar el enlace de regreso a la cita.
7. Crear un paciente ficticio de otro tenant en la DB local: su nombre no aparece
   en la lista de Karla y abrir su UUID muestra Paciente no encontrado.
8. Consultar audit_log: patient.create, patient.read, measurement.create/update/delete
   y clinical_note.create; comprobar que no hay datos clínicos en meta.

## Cobertura y límites

Vitest cubre fórmulas, ambos sexos de cada ecuación, umbrales exactos OMS, índices,
actividad, objetivos y entradas inválidas; también las fronteras Zod de consentimiento,
fechas, decimales y notas. `main` (7938cc0) no exporta @granola/db/testing.
Quedan pendientes tests de integración automatizados contra DB para alta con
consentimiento, rechazo por tenant en lecturas y mutaciones y rollback de auditoría.
La revisión manual de navegador/SQL no sustituye esos tests.

IMC y ecuaciones son para adultos. La calculadora requiere elegir explícitamente f/m
según las ecuaciones; no infiere coeficientes para sexo "otro". IMC usa la edad de hoy;
los índices se calculan con los campos de la misma medición más reciente. No mezcla
peso/talla de registros distintos. Los resultados no se redondean en core, solo en UI.
El objetivo usa un ajuste proporcional elegido por el profesional (20% predeterminado,
0–50% permitido); no se guarda como prescripción.

Fuera del alcance: IA, laboratorios/PDF, edición de datos demográficos, exportación,
notas editables/borrables y cambios en auth, pagos, WhatsApp o jobs.

## Referencias de las ecuaciones

- [OMS: clasificación IMC adulto](https://www.who.int/data/nutrition/nlis/info/malnutrition-in-women).
- [Mifflin et al., ecuación simplificada de 1990](https://ajcn.nutrition.org/article/S0002-9165%2823%2916698-6/abstract):
  10 × kg + 6.25 × cm − 5 × años + 5 (m) / −161 (f).
- [Harris-Benedict revisada, coeficientes documentados](https://pmc.ncbi.nlm.nih.gov/articles/PMC12743684/):
  88.362 + 13.397 × kg + 4.799 × cm − 5.677 × años (m);
  447.593 + 9.247 × kg + 3.098 × cm − 4.330 × años (f).

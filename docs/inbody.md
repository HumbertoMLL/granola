# InBody y análisis de laboratorio

## Flujo

Pacientes → expediente → Documentos → Subir documento (PDF/JPG/PNG, máximo 15 MB).
El servidor obtiene texto con pdf-parse y aplica parsers deterministas de core.
Con R2, begin crea la fila pending y autoriza un PutObject privado de 10 minutos;
el navegador sube directo y complete relee/valida tamaño real y MIME, extrae texto
y guarda una copia final con una key diferente. El PUT inicial nunca puede modificar
el original final. En desarrollo sin R2, el route handler recibe el FormData.
Esto mantiene los 15 MB sin exceder el [límite de cuerpo de Vercel](https://vercel.com/docs/functions/limitations).
La descarga valida tenant/capacidad y redirige a un GET privado de R2 de hasta 10 min;
sin R2 sirve los bytes locales. No hay URLs públicas.
Los resultados son borradores: Revisar y personalizar → valores, unidades,
referencias, visibilidad y comentario por indicador → interpretación y marca →
vista previa → Generar PDF → WhatsApp o correo. Imágenes, PDFs escaneados,
cifrados o sin etiquetas reconocibles ofrecen captura manual; no hay OCR.
Otro documento permite conservar el original y preparar un reporte de laboratorio manual.

La tabla del editor se adapta a filas apiladas en móvil, con labels visibles.
Stepper y Sheet reutilizan packages/ui; no se introduce un Dialog de edición.
Los indicadores ocultos no salen en el PDF. El servidor renderiza el PDF con
@react-pdf/renderer; nunca confía en un PDF subido desde el navegador como reporte.

El color se toma del tema, la firma de nombre/cédula y el logo del avatar.
El PDF incorpora avatares PNG/JPG alojados bajo el prefijo propio de R2_PUBLIC_URL;
no descarga URLs arbitrarias ni imágenes de terceros. Si no hay un avatar admitido,
conserva la firma profesional. La marca puede quitar el logo y ajustar color/firma.

Antropometría combina peso, grasa y músculo de los reportes InBody guardados tras revisar (indicadores visibles) con
mediciones manuales cuando hay al menos dos estudios. La fecha es la de carga,
se indica en pantalla; no se inventa una fecha de medición a partir del PDF.

## Seguridad y almacenamiento

- Todas las operaciones de panel resuelven la sesión en servidor y filtran por
  nutritionist_id. El paciente debe pertenecer al mismo tenant y tener consentimiento.
- Lecturas/escrituras/envíos se registran en audit_log, sin contenido clínico en meta.
- Se validan MIME, firma del archivo y tamaño real; el route handler acota el stream
  antes de leer FormData, incluso sin Content-Length.
- **R2_PRIVATE_BUCKET** es obligatorio con R2 y distinto de R2_BUCKET (avatares).
  Crear este bucket sin dominio público ni acceso r2.dev. No habilitar acceso público.
  Las mismas credenciales deben poder leer/escribir/borrar ambos buckets.
  CORS del bucket privado: AllowedOrigins = origen exacto de la app; AllowedMethods
  = PUT; AllowedHeaders = Content-Type, Cache-Control. No habilitar orígenes amplios.
- Sin R2, solo NODE_ENV=development admite `.uploads/clinical/<tenant>/` con permisos
  locales restrictivos; producción/test fallan con mensaje de configuración. No es
  almacenamiento durable para múltiples procesos o réplicas.
- **DOCUMENT_LINK_SECRET**: secreto independiente de al menos 32 caracteres; puede
  usar BETTER_AUTH_SECRET como fallback. Se lee al firmar/verificar, no al compilar.
  Rotarlo invalida enlaces anteriores. Configurarlo en todos los procesos web.
- Originales/PDFs se autorizan en /api/documents/download/<token>; los GET de R2 siempre son privados y firmados.
  Enlace de panel: 10 minutos y sesión del mismo tenant. Enlace al paciente: 7 días,
  capacidad HMAC vinculada a tenant/paciente/reporte/versión. No requiere cuenta del
  paciente; quien posea el enlace puede leer ese PDF hasta vencer. No compartirlo.
- Edición o regeneración revoca el enlace de la versión previa. Cuenta en gracia o
  purgada no emite nuevas descargas; un GET de R2 emitido antes conserva hasta 10 minutos. Cache-Control privado/no-store, sin referrer.
- WhatsApp usa reporte_listo y sendTemplateAndRecord: dry run queda queued/dry_run;
  en reports se registra el intento exitoso del cliente (sent_at/sent_via), y audit_log
  distingue dryRun. Correo usa sendEmail/reporteListo; solo manda aviso y enlace,
  nunca indicadores en el cuerpo. Aceptación del proveedor no prueba entrega final.

## Migración y release expand/contract

0005_documents fue generada con `pnpm db:generate --name documents`; journal 0..5.
Solo agrega enums/tablas/índices y FKs, sin borrar ni renombrar datos existentes.
La expansión se debe aplicar **antes de activar el código** que usa documentos:

1. Publicar/aplicar el commit de expansión con el código anterior todavía activo.
2. Verificar ambas tablas y desplegar después el consumidor. El guard documentsReady
   comprueba to_regclass por request: con schema previo el expediente sigue funcionando,
   Documentos responde "aplicar migración" y export/purge omiten las tablas ausentes.
3. Rollback del código conserva las tablas. No hay contract ni rollback destructivo.

Exportación de cuenta agrega documents/reports bajo el filtro del tenant, sin emitir
links firmados nuevos. Purge borra el prefijo clínico privado (y local en dev) **antes**
de marcar purged_at; errores de DeleteObjects impiden finalizar para permitir reintento.
Anonimiza JSON/textos y referencias a archivos conservando indicadores numéricos.
No cambia citas, pagos ni el plazo de conservación del expediente existente.

## Parsers y referencias

Fixtures inventados y sin pacientes reales en packages/core/src/documents/fixtures:
InBody 270/770 (570 comparte etiquetas), español/inglés, punto/coma decimal;
dos laboratorios con unidades convencionales/alternativas y rangos impresos.
Se extraen líneas etiquetadas; las maquetaciones sin correspondencia inequívoca entre
etiqueta y valor requieren captura manual. No se adivinan columnas.
Los segmentos admiten masa magra y grasa de brazos, piernas y tronco.

Los rangos impresos prevalecen. Sin ellos hay referencias editables de adulto para
unidades conocidas; no se trasladan a mmol/L/nmol/L ni se usan para diagnosticar.
HDL y otros valores dependen de sexo, edad, método y contexto; la profesional los revisa.
Fuentes para los defaults (consultadas 25 oct 2026):

- [Glucosa en ayuno](https://medlineplus.gov/ency/article/003482.htm)
- [HbA1c](https://medlineplus.gov/lab-tests/hemoglobin-a1c-hba1c-test/)
- [Colesterol](https://medlineplus.gov/lab-tests/cholesterol-levels/)
- [Triglicéridos](https://medlineplus.gov/triglycerides.html)
- [Creatinina](https://medlineplus.gov/ency/article/003468.htm)
- [TSH](https://www.btf-thyroid.org/thyroid-function-tests)
- [Vitamina D](https://medlineplus.gov/ency/article/003569.htm)

## Validación local

```sh
docker-compose -p granola -f docker-compose.local.yml up -d
# DB exclusiva local: aplicar migrations/0000..0005 con psql -v ON_ERROR_STOP=1.
pnpm typecheck && pnpm lint && pnpm test
pnpm test:integration
pnpm --filter @granola/web exec next build
pnpm --filter @granola/web exec playwright test documents.spec.ts
```

Se pueden usar GRANOLA_TEST_DATABASE_URL (nombre terminado en \_test),
GRANOLA_TEST_PROXY y E2E_PORT para aislarse de otros worktrees.
Las capturas móviles están en docs/inbody-captures. Los tests no envían mensajes reales.

Fuera de alcance: OCR, interpretación automática, voz, captura de fecha del estudio,
plantillas Meta aprobadas en la cuenta real, provisión de R2/Resend/Meta y comprobación
de entrega real. Pagos, agenda, auth y booking se conservan.

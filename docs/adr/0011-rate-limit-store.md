# ADR 0011 — Rate limit distribuido con Upstash REST

**Fecha:** 2026-10-24 · **Estado:** aceptado para esta implementación

## Contexto

El limitador de ADR 0007 mantenía un sliding log en globalThis. En Vercel cada instancia imponía su propio límite; multiplicar instancias multiplicaba la cuota real. Esto era el hueco del factor VI de Twelve-Factor. API y server actions anónimas deben compartir contadores sin depender de Next ni agregar un SDK.

## Decisión

- Interfaz `RateLimitStore.incr(key, windowMs): Promise<{ count, resetAt }>` con `MemoryStore` y `UpstashStore`, seleccionados en `packages/api/src/store.ts`.
- Ambas variables `UPSTASH_REDIS_REST_URL` y `UPSTASH_REDIS_REST_TOKEN` habilitan Upstash en cualquier entorno. Si falta alguna, memoria. En producción se registra una única advertencia por proceso: `rate limit no distribuido`. No se consultan servicios al importar el módulo o al compilar.
- Cambiar de ventana deslizante a **ventana fija alineada al epoch**, igual en ambos stores. Cada key incluye namespace Granola, tamaño de ventana, índice del bucket y llave lógica. Así instancias distintas calculan el mismo contador y `resetAt` sin consultar TTL.
- Cada intento envía `POST {URL}/pipeline`, bearer en header y un array JSON con `INCR key` + `PEXPIRE key remainingMs NX`. NX evita renovar el vencimiento. Se comprueba el estado HTTP y se validan con zod el JSON y los resultados de los dos comandos, incluidos errores individuales con HTTP 200. No registrar respuestas del proveedor ni credenciales.
- El pipeline no es una transacción: Upstash garantiza el orden de sus comandos, pero otros clientes pueden intercalarse. INCR es atómico; NX es condicional y evita extender el vencimiento. Incluir el bucket en la key evita reutilizar un contador viejo cuando cambia la ventana. La expiración sirve para limpiar; no define la identidad de la ventana. Un fallo parcial de PEXPIRE podría dejar una key vieja sin TTL: requiere monitoreo/limpieza operativa; no bloquea futuras ventanas.
- `checkRateLimit` y el middleware esperan el store. Las tres llamadas existentes de server actions agregan únicamente `await`. El middleware mantiene headers `RateLimit-Limit`, `RateLimit-Remaining`, `RateLimit-Reset` (segundos relativos) y `Retry-After` al devolver 429. No se agregan límites a health o rutas autenticadas que no los tenían.

## Disponibilidad y fail-open

Presupuesto total de **500 ms**, desde fetch hasta leer/validar el cuerpo. Se combinan AbortController y Promise.race para no depender de que un fetch respete abort. El timer se limpia al terminar. No hay reintentos automáticos que incrementen dos veces el contador.

Si Upstash falla, devuelve HTTP no exitoso, un comando falla, el JSON es inválido o se agotan los 500 ms, la política **permite la solicitud**. Devuelve `ok=true`, `remaining=limit`, `resetAt=now` y `retryAfterMs=0`. Loguea un warning con razón controlada (`store_error` o `timeout`), sin llaves/IPs, tokens, URL ni errores crudos. La siguiente solicitud vuelve a consultar Redis. No se cae a memoria durante la indisponibilidad: tampoco sería un límite global fiable. La validación de opciones incorrectas es un error de programación y no se oculta con fail-open.

Esto prioriza disponibilidad de reservas sobre contención de abuso cuando Redis cae. No sustituye autenticación, autorización, constraints de reservas, CAPTCHA ni controles de borde. Una ventana fija permite ráfagas de hasta dos cuotas alrededor de un cambio de bucket; los relojes de las instancias deben estar sincronizados.

## Costos y evidencia

Pricing oficial verificado el **24 oct 2026**: free **500K comandos/mes**, 250 MB y 10 GB de transferencia; pago por uso **USD 0.20/100K comandos**. La referencia de 10K comandos/día del encargo ya no coincide con la página actual. Dos comandos por intento permiten hasta 250K intentos/mes en free si la DB no tiene otros consumidores; un pipeline no equivale a un comando facturado.

- [Pricing de Upstash Redis](https://upstash.com/pricing/redis)
- [REST, pipeline, orden y falta de atomicidad](https://upstash.com/docs/redis/features/restapi#pipelining)
- [PEXPIRE y NX](https://redis.io/docs/latest/commands/pexpire/)

Vitest cubre ventanas/reset en memoria, selección por entorno y warning único, pipeline correcto, bucket entre instancias, errores de red/HTTP/comandos/JSON, timeout con fetch o body colgado, limpieza del timer y headers tanto de éxito como de 429/fail-open. Los tests no necesitan credenciales ni llaman al proveedor real.

## Fuera del alcance

Provisionar una DB Upstash o credenciales, configurar secretos en Vercel, pruebas con Redis de pago/producción, circuit breaker, métricas/drain de logs, CAPTCHA, nuevas rutas limitadas y cambios al formato de errores HTTP.

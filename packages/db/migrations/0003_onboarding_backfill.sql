-- Migración de datos (manual, sin cambios de schema).
-- El wizard de onboarding (PR #3) redirige mientras onboarding_step < 4. Las
-- nutriólogas que ya existían cuando se aplica esto nunca vieron el wizard y no
-- deben caer en él: se marcan como terminadas. Las nuevas siguen naciendo con 0
-- (default de la columna) y pasan por el wizard.
-- now() es el inicio de la transacción de la migración: solo toca filas previas.
UPDATE "nutritionists" SET "onboarding_step" = 4 WHERE "onboarding_step" < 4 AND "created_at" < now();

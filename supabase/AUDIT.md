# Auditoria Supabase - QR Quest

## Estado encontrado

El repositorio tenia una coleccion de SQL incremental, ya retirada para evitar
que se mezclase con la base comercial reconstruible:

- `20260826_question_history_answers.sql`: anade respuestas a `question_history`.
- `20260826_arena_matches.sql`: parchea `arena_matches` y crea `resolve_arena_match`.
- `20260826_reset_game.sql`: reset manual de la partida privada anterior.
- `20260829_event_completion.sql`: final rewards, ajustes admin y funciones atomicas parciales.
- `20260902_commercial_clean_game.sql`: perfiles libres, capturas salvajes y policies abiertas.
- `20260902_game_instances.sql`: separacion por `game_code`, master token y borrado de perfiles.

No habia un esquema completo que permita crear Supabase desde cero. Varias tablas
base (`profiles`, `captures`, `game_progress`, etc.) se asumian ya existentes.

## Riesgos detectados

- RLS demasiado abierto en los scripts comerciales anteriores: `select` y
  `update` sobre `profiles`/`captures` para `anon` con `using (true)`.
- `tokens` existia como saldo directo en `profiles`; faltaba ledger como fuente
  auditable.
- El master dependia de un token local. La creacion anonima ya esta cerrada y el
  enlace comprado solo valida el token existente; asociarlo a Supabase Auth
  sigue siendo el siguiente refuerzo recomendado.
- La compra de Stripe no quedaba registrada en una tabla `purchases` idempotente.
- Las preguntas y respuestas correctas siguen viviendo en codigo frontend; para
  antifraude real deben validarse desde backend/RPC.
- Algunas escrituras sensibles todavia se hacen desde el cliente cuando falta la
  RPC correspondiente.
- Los QR de ruta actuales usan `station_id` legible; para el lanzamiento deben
  usar `checkpoints.public_token`.

## Bloqueo legal para venta publica

PokéAPI permite reutilizar su software bajo su licencia, pero esa licencia no
concede derechos comerciales sobre nombres, personajes ni ilustraciones de
Pokémon. La portada comercial ya usa arte raster original. Antes de vender el
producto al publico hay que sustituir tambien los sprites, nombres y referencias
de Pokémon del juego por criaturas propias, o conseguir una licencia expresa.

## Cambios aplicados en esta revision

- `pgcrypto` queda instalado en `extensions` y las funciones llaman a
  `extensions.digest` y `extensions.gen_random_bytes` de forma explicita.
- Stripe crea partidas exclusivamente con `service_role`; el navegador solo
  puede validar una credencial master que ya exista.
- Se ha eliminado la partida seed y cualquier acceso de demostracion.
- La navegacion del jugador concentra ruta, estado y QR personal en Aventura;
  solo quedan Pokédex y Escaner como vistas voluntarias.

## Nueva base propuesta

La nueva base usa `games.id` como unidad central. Todo lo personalizable o
generado por una partida cuelga de `game_id`: jugadores, checkpoints, QR,
capturas, tokens, canjes, batallas, hall of fame y compras.

Archivos nuevos:

- `000_reset_public_schema_dev.sql`: borra el schema `public` para reutilizar
  una base de desarrollo ya contaminada por tablas antiguas.
- `001_schema.sql`: crea tablas, tipos, claves, indices y triggers.
- `002_rls_security.sql`: cierra RLS por defecto y expone funciones controladas.
No se incluye ningun seed ni partida de demostracion. Las partidas se crean
unicamente desde una compra confirmada por Stripe.

## Datos que se perderian al reconstruir

Si se elimina la base anterior o se ejecuta un reset destructivo se perderan:

- jugadores creados;
- progreso de QR;
- capturas;
- tokens y canjes;
- invitaciones Team Rocket;
- combates de arena;
- premios finales;
- historico administrativo;
- compras Stripe si ya se hubieran registrado fuera del nuevo esquema.

Antes de borrar, exporta copia desde Supabase:

```bash
supabase db dump --data-only --file backup-data.sql
supabase db dump --schema public --file backup-schema.sql
```

## Secuencia unica

Para un proyecto Supabase nuevo usa solo:

1. `000_reset_public_schema_dev.sql` solo si la base ya tenia tablas antiguas
2. `001_schema.sql`
3. `002_rls_security.sql`

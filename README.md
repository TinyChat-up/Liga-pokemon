# QR Quest Party

Juego web móvil para eventos con ruta QR, combates estilo RPG, capturas, tokens,
canjes y panel master.

## Qué incluye

- Jugadores creados por nombre, sin lista fija previa.
- Partidas aisladas con un usuario y contraseña master elegidos por cada comprador.
- QR virtual personal para cada jugador.
- Un único dispositivo master por código de partida.
- Borrado de perfiles individuales o de toda la partida desde el panel master.
- Ruta de 12 QR: 8 entrenadores y 4 encuentros cooperativos.
- Encuentros salvajes aleatorios si un jugador tarda demasiado tras el primer QR.
- Portada comercial en `/` con Stripe Checkout a 1,99 EUR.

## Desarrollo local

```bash
npm install
npm run dev
```

Abre `http://localhost:3000` para probar la página de venta. Las rutas antiguas
`/comprar` y `/jugar` redirigen a la portada; los enlaces con `?game=...`
siguen abriendo el juego.

## Uso por comprador

1. El comprador entra en `/` y elige su usuario y contraseña master.
2. Stripe redirige a `/success?session_id=...`.
3. El servidor verifica que el pago está completado.
4. La pantalla de entrega muestra sus credenciales, el link master, el link de
   jugadores y el ZIP con los QR de ruta.
5. El organizador entra en `/master` con el usuario y la contraseña elegidos.
6. Desde el panel master puede abrir Jugadores, Centro Pokémon, Tienda,
   Premios y Resumen operativo.
7. Comparte el link de jugadores por WhatsApp o cualquier canal. Ese enlace ya
   lleva la partida incluida: el jugador solo escribe su nombre.
8. Cada jugador recibe un QR virtual ampliable desde su perfil.

El usuario y la contraseña master los elige el comprador. La contraseña se
guarda únicamente como hash en Supabase y no se incluye en Stripe metadata.

## Variables de entorno

Copia `.env.example` a `.env.local` y rellena los valores:

```text
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
NEXT_PUBLIC_SITE_URL=http://localhost:3000
STRIPE_SECRET_KEY=
SUPABASE_SECRET_KEY=
DELIVERY_SECRET=
PROMO_CODE=
```

`SUPABASE_SECRET_KEY`, `STRIPE_SECRET_KEY`, `DELIVERY_SECRET` y `PROMO_CODE` son solo de
servidor. No los pongas nunca en variables `NEXT_PUBLIC_` ni en codigo que
llegue al navegador. La antigua `SUPABASE_SERVICE_ROLE_KEY` tambien funciona,
pero para una configuracion nueva se recomienda la clave Secret de Supabase.

`DELIVERY_SECRET` debe ser un valor aleatorio estable de al menos 32 caracteres.
Generalo una sola vez con `openssl rand -hex 32`. No lo cambies al rotar Stripe:
es la clave que permite reconstruir de forma segura el mismo código interno de
partida para una compra existente. El usuario y la contraseña master los elige
el comprador durante la compra.

En Vercel añade las siete variables en Project Settings > Environment Variables
y aplícalas a Production y Preview. Después crea un nuevo deployment; cambiar
una variable no modifica deployments que ya estaban construidos.

La `SUPABASE_SECRET_KEY` se obtiene en Supabase desde Project Settings > API
Keys, creando o copiando una clave de tipo Secret. Debe guardarse únicamente
como variable sensible de Vercel y nunca con prefijo `NEXT_PUBLIC_`.

Para regalar partidas, define un valor privado en `PROMO_CODE` dentro de Vercel.
Quien lo reciba y lo escriba tras elegir el usuario y contraseña master recibirá
una partida completa sin pasar por Stripe. Para desactivarlo, define
`PROMO_CODE=OFF` y vuelve a desplegar.

## PDF original de la ruta

Deja tu archivo aquí:

```text
private-assets/qr-route-source.pdf
```

La carpeta está protegida por `.gitignore`. Cuando el PDF esté colocado se puede
revisar y convertir en una plantilla personalizada por compra sin publicarlo
directamente.

## Crear Base De Datos Desde Cero

Para un proyecto Supabase nuevo, ejecuta solamente estos archivos y en este
orden desde el editor SQL:

```text
supabase/001_schema.sql
supabase/002_rls_security.sql
supabase/003_master_settings.sql
supabase/004_buyer_credentials.sql
```

Si estás reutilizando una base donde ya existen tablas antiguas como
`profiles`, primero ejecuta este reset de desarrollo:

```text
supabase/000_reset_public_schema_dev.sql
```

Después ejecuta `001_schema.sql` y `002_rls_security.sql`.

Si la estructura nueva ya estaba instalada y el pago mostraba
`function digest(text, unknown) does not exist`, no vuelvas a borrar la base:
ejecuta de nuevo solamente `supabase/002_rls_security.sql`. El archivo es
reejecutable y corrige la referencia a `pgcrypto`.

Esto crea la estructura comercial limpia: `games` como entidad central,
compras Stripe idempotentes, jugadores por `game_id`, QR/checkpoints por
partida, ledger de tokens, canjes, capturas, batallas, hall of fame y RLS
cerrado por defecto.

`003_master_settings.sql` añade la configuración editable por partida: nombre,
precio de cura, demora del encuentro salvaje, productos de la Tienda Pokémon y
premios del Alto Mando. Ejecútalo también en Supabase antes de probar el panel.

`004_buyer_credentials.sql` añade el usuario master elegido por el comprador y
la función de inicio de sesión. Ejecútalo después de las tres migraciones
anteriores. Si la base ya tiene partidas, sus códigos internos se convierten en
usuarios de compatibilidad; las compras nuevas usan el usuario elegido.

Antes de borrar una base antigua, haz backup:

```bash
supabase db dump --schema public --file backup-schema.sql
supabase db dump --data-only --file backup-data.sql
```

No hay datos ni partidas de demostracion: la primera partida se crea solamente
cuando Stripe confirma un pago. Las migraciones parciales antiguas se han
retirado para evitar que se ejecuten por error.

### Supabase Auth

Para el producto final, activa Supabase Auth para compradores/master. Los
jugadores pueden seguir entrando rapido por link de partida y sesion anonima de
jugador, pero el master debe quedar asociado a un usuario autenticado o a una
compra verificada.

Redirects recomendados:

```text
http://localhost:3000/**
https://tu-dominio.com/**
```

### Storage

No hace falta bucket para la primera version. Los QR se generan en el navegador
tras validar el pago. Si mas adelante quieres guardar PDFs historicos, crea un
bucket privado `qr-kits` y sirvelo con URLs firmadas desde backend.

## Venta con Stripe

La ruta `POST /api/checkout` crea una sesión de Stripe Checkout por 1,99 EUR.
La ruta `POST /api/delivery` verifica la sesión pagada y prepara la entrega:
usuario y contraseña master, link master, link de jugadores y QR descargables.

Para vender públicamente, configura `STRIPE_SECRET_KEY` y
`NEXT_PUBLIC_SITE_URL` en Vercel. Configura tambien
`SUPABASE_SECRET_KEY` solo en servidor para que Stripe pueda crear la
partida y la fila `purchases` sin abrir permisos publicos.

Webhook recomendado:

```text
checkout.session.completed -> crear/confirmar purchase + game
checkout.session.expired   -> marcar purchase como expired si se habia creado
payment_intent.payment_failed -> marcar fallo de pago
```

La funcion SQL `create_game_after_purchase(...)` es idempotente: si Stripe manda
dos veces el mismo evento, devuelve la misma partida y no crea duplicados.

## Seguridad pendiente

La base nueva ya deja el modelo correcto, pero el frontend todavia conserva
compatibilidad con algunos scripts antiguos. La siguiente fase recomendada es
mover todas las escrituras sensibles del cliente a RPC/rutas backend:

- validar preguntas sin enviar la respuesta correcta al navegador;
- usar tokens publicos opacos de `checkpoints.public_token` en los QR;
- crear compras desde webhook con `SUPABASE_SECRET_KEY`;
- asociar master a Supabase Auth;
- leer snapshots por `get_game_snapshot(...)` y no por selects directos.

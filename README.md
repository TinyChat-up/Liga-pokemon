# Nivel 27 · Liga de la Terraza

Juego móvil de cumpleaños con ruta QR, capturas, Team Rocket, Arena de Payá,
tokens, canjes y panel de Alejandro.

## Despliegue en Vercel

1. Sube esta carpeta completa a Vercel.
2. Añade `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.
3. Pulsa Deploy.

La clave `service_role` nunca debe añadirse al navegador ni a variables
`NEXT_PUBLIC_`.

## Desarrollo local

```bash
npm install
npm run dev
```

## Preparación de Supabase para el evento

Antes de desplegar esta versión, abre el editor SQL del proyecto Supabase
`lxiuaxybilichtekloip` y ejecuta completo:

```text
supabase/20260829_event_completion.sql
```

La migración es idempotente. Añade el Hall de la Fama, la recompensa final,
el registro de ajustes administrativos y la resolución atómica de Team Rocket.
También actualiza `reset_liga27_game()` para limpiar estas tablas.

## Seguridad pendiente

El código 8128 es adecuado como barrera práctica para este evento privado,
pero está presente en la aplicación web y no sustituye una autenticación real.
Antes de compartir públicamente el panel de administración, hay que protegerlo
con Supabase Auth y comprobar la identidad de Alejandro en las RPC y políticas
RLS. Nunca debe resolverse añadiendo una clave `service_role` al navegador.

import { createHmac } from "crypto";
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import Stripe from "stripe";
import { journeyIds, stations } from "@/lib/game/data";
import { PRODUCT } from "@/lib/product";
import type { Database } from "@/lib/supabase-types";

function getOrigin(request: Request): string {
  const configuredUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (configuredUrl) return new URL(configuredUrl).origin;
  if (process.env.NODE_ENV === "production") throw new Error("NEXT_PUBLIC_SITE_URL is required");
  return new URL(request.url).origin;
}

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function createGameCode(sessionId: string, deliverySecret: string): string {
  const hash = createHmac("sha256", deliverySecret).update(`game:${sessionId}`).digest("hex").slice(0, 10);
  return `quest-${hash}`;
}

function noStoreJson(body: object, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "private, no-store, max-age=0" },
  });
}

function paymentIntentId(session: Stripe.Checkout.Session): string | null {
  if (!session.payment_intent) return null;
  return typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent.id;
}

async function ensureGameSession(gameCode: string, masterUsername: string, masterPassword: string, session: Stripe.Checkout.Session): Promise<void> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Falta configurar Supabase en el servidor para entregar la partida.");
  }

  const client = createClient<Database>(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });
  const { error } = await client.rpc("create_game_after_purchase", {
    p_stripe_checkout_session_id: session.id,
    p_stripe_payment_intent_id: paymentIntentId(session),
    p_amount: session.amount_total ?? 0,
    p_currency: session.currency ?? "eur",
    p_status: session.payment_status,
    p_game_code: gameCode,
    p_join_code: gameCode,
    p_master_username: masterUsername,
    p_master_password: masterPassword,
    p_buyer_email: session.customer_details?.email ?? null,
  });

  if (error) throw new Error(error.message);
}

async function getPromoGameCode(sessionId: string, masterUsername: string, masterPassword: string): Promise<string> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Falta configurar Supabase en el servidor para entregar la partida.");
  }

  const client = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });
  const { data: purchaseData, error: purchaseError } = await client
    .from("purchases")
    .select("game_id, amount, status")
    .eq("stripe_checkout_session_id", sessionId)
    .maybeSingle();
  const purchase = purchaseData as { game_id: string; amount: number; status: string } | null;

  if (purchaseError || !purchase || purchase.status !== "promo" || purchase.amount !== 0) {
    throw new Error("La activación promocional no es válida.");
  }

  const { data: login, error: loginError } = await client.rpc("login_game_master", {
    p_master_username: masterUsername,
    p_master_password: masterPassword,
  });
  const loggedGameCode = (login as { gameCode?: unknown } | null)?.gameCode;

  if (loginError || typeof loggedGameCode !== "string") {
    throw new Error("Las credenciales master no coinciden con esta partida.");
  }

  const { data: gameData, error: gameError } = await client
    .from("games")
    .select("game_code")
    .eq("id", purchase.game_id)
    .maybeSingle();
  const game = gameData as { game_code: string } | null;

  if (gameError || !game || game.game_code !== loggedGameCode) {
    throw new Error("Las credenciales master no coinciden con esta partida.");
  }

  return game.game_code;
}

export async function POST(request: Request) {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  const deliverySecret = process.env.DELIVERY_SECRET;
  let body: { session_id?: unknown; master_username?: unknown; master_password?: unknown };
  try {
    body = (await request.json()) as { session_id?: unknown; master_username?: unknown; master_password?: unknown };
  } catch {
    return noStoreJson({ error: "La solicitud de entrega no es válida." }, 400);
  }
  const sessionId = typeof body.session_id === "string" ? body.session_id.trim() : "";
  const masterUsername = typeof body.master_username === "string" ? body.master_username.trim().toLowerCase() : "";
  const masterPassword = typeof body.master_password === "string" ? body.master_password.trim() : "";

  if (!deliverySecret || deliverySecret.length < 32) {
    return noStoreJson({ error: "Falta DELIVERY_SECRET o es demasiado corto." }, 503);
  }

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    return noStoreJson({ error: "Falta NEXT_PUBLIC_SUPABASE_URL en el servidor." }, 503);
  }

  if (!process.env.SUPABASE_SECRET_KEY && !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return noStoreJson({ error: "Falta SUPABASE_SECRET_KEY en el servidor." }, 503);
  }

  if (!sessionId.startsWith("cs_") && !sessionId.startsWith("promo_")) {
    return noStoreJson({ error: "Falta una sesión de entrega válida." }, 400);
  }

  if (!/^[a-z0-9][a-z0-9._-]{2,31}$/.test(masterUsername)) {
    return noStoreJson({ error: "El usuario debe tener entre 3 y 32 caracteres y solo usar letras, números, punto o guion." }, 400);
  }

  if (masterPassword.length < 12 || masterPassword.length > 80) {
    return noStoreJson({ error: "La contraseña debe tener entre 12 y 80 caracteres." }, 400);
  }

  try {
    let gameCode: string;
    if (sessionId.startsWith("promo_")) {
      gameCode = await getPromoGameCode(sessionId, masterUsername, masterPassword);
    } else {
      if (!secretKey) {
        return noStoreJson({ error: "Falta STRIPE_SECRET_KEY en el servidor." }, 503);
      }

      const stripe = new Stripe(secretKey);
      const session = await stripe.checkout.sessions.retrieve(sessionId);

      if (session.payment_status !== "paid") {
        return noStoreJson({ error: "El pago todavía no aparece como completado." }, 402);
      }

      if (
        session.metadata?.product !== PRODUCT.legalName
        || session.amount_total !== PRODUCT.priceCents
        || session.currency !== PRODUCT.priceCurrency
      ) {
        return noStoreJson({ error: "La sesión no corresponde a una compra válida de QR Quest." }, 403);
      }

      gameCode = createGameCode(session.id, deliverySecret);
      await ensureGameSession(gameCode, masterUsername, masterPassword, session);
    }

    const origin = getOrigin(request);
    const playerUrl = `${origin}/?game=${encodeURIComponent(gameCode)}&mode=player`;
    const masterUrl = `${origin}/master`;

    const routeQrs = journeyIds.map((id, index) => {
      const station = stations.find((item) => item.id === id);
      return {
        id,
        order: index + 1,
        title: station?.title ?? id,
        url: `${origin}/?game=${encodeURIComponent(gameCode)}&qr=${encodeURIComponent(id)}`,
      };
    });

    return noStoreJson({
      gameCode,
      masterUsername,
      masterPassword,
      playerUrl,
      masterUrl,
      routeQrs,
      finalQr: {
        id: "alto-mando",
        title: "Alto Mando",
        url: `${origin}/?game=${encodeURIComponent(gameCode)}&qr=alto-mando`,
      },
      arenaQr: {
        id: "arena",
        title: "Arena sorpresa",
        url: `${origin}/?game=${encodeURIComponent(gameCode)}&qr=arena`,
      },
    });
  } catch (error) {
    console.error("QR Quest delivery failed", error);
    return noStoreJson({ error: "No se pudo preparar la entrega. Revisa la configuración del servidor." }, 500);
  }
}

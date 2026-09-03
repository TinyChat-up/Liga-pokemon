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

function createMasterToken(sessionId: string, deliverySecret: string): string {
  return createHmac("sha256", deliverySecret).update(`master:${sessionId}`).digest("hex");
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

async function ensureGameSession(gameCode: string, masterToken: string, session: Stripe.Checkout.Session): Promise<void> {
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
    p_master_token: masterToken,
    p_buyer_email: session.customer_details?.email ?? null,
  });

  if (error) throw new Error(error.message);
}

export async function GET(request: Request) {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  const deliverySecret = process.env.DELIVERY_SECRET;
  const sessionId = new URL(request.url).searchParams.get("session_id") ?? "";

  if (!secretKey) {
    return noStoreJson({ error: "Falta STRIPE_SECRET_KEY en el servidor." }, 503);
  }

  if (!deliverySecret || deliverySecret.length < 32) {
    return noStoreJson({ error: "Falta DELIVERY_SECRET o es demasiado corto." }, 503);
  }

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    return noStoreJson({ error: "Falta NEXT_PUBLIC_SUPABASE_URL en el servidor." }, 503);
  }

  if (!process.env.SUPABASE_SECRET_KEY && !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return noStoreJson({ error: "Falta SUPABASE_SECRET_KEY en el servidor." }, 503);
  }

  if (!sessionId.startsWith("cs_")) {
    return noStoreJson({ error: "Falta una sesión de pago válida." }, 400);
  }

  const stripe = new Stripe(secretKey);

  try {
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

    const origin = getOrigin(request);
    const gameCode = createGameCode(session.id, deliverySecret);
    const masterToken = createMasterToken(session.id, deliverySecret);
    await ensureGameSession(gameCode, masterToken, session);
    const playerUrl = `${origin}/?game=${encodeURIComponent(gameCode)}&mode=player`;
    const masterUrl = `${origin}/?game=${encodeURIComponent(gameCode)}&claimMaster=1&masterToken=${encodeURIComponent(masterToken)}`;

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

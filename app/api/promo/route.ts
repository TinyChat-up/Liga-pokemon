import { createHmac, randomUUID, timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase-types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function noStoreJson(body: object, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "private, no-store, max-age=0" },
  });
}

function isValidPromotionCode(value: string): boolean {
  const configuredCode = process.env.PROMO_CODE?.trim().toUpperCase();
  const suppliedCode = value.trim().toUpperCase();
  if (!configuredCode || !suppliedCode) return false;

  const configuredBuffer = Buffer.from(configuredCode);
  const suppliedBuffer = Buffer.from(suppliedCode);
  return configuredBuffer.length === suppliedBuffer.length && timingSafeEqual(configuredBuffer, suppliedBuffer);
}

function createGameCode(sessionId: string, deliverySecret: string): string {
  const hash = createHmac("sha256", deliverySecret).update(`game:${sessionId}`).digest("hex").slice(0, 10);
  return `quest-${hash}`;
}

export async function POST(request: Request) {
  let body: { promotion_code?: unknown; master_username?: unknown; master_password?: unknown };
  try {
    body = (await request.json()) as { promotion_code?: unknown; master_username?: unknown; master_password?: unknown };
  } catch {
    return noStoreJson({ error: "La solicitud no es válida." }, 400);
  }

  const promotionCode = typeof body.promotion_code === "string" ? body.promotion_code : "";
  const masterUsername = typeof body.master_username === "string" ? body.master_username.trim().toLowerCase() : "";
  const masterPassword = typeof body.master_password === "string" ? body.master_password.trim() : "";
  const deliverySecret = process.env.DELIVERY_SECRET;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!isValidPromotionCode(promotionCode)) {
    return noStoreJson({ error: "El código promocional no es válido." }, 400);
  }

  if (!/^[a-z0-9][a-z0-9._-]{2,31}$/.test(masterUsername)) {
    return noStoreJson({ error: "El usuario debe tener entre 3 y 32 caracteres y solo usar letras, números, punto o guion." }, 400);
  }

  if (masterPassword.length < 12 || masterPassword.length > 80) {
    return noStoreJson({ error: "La contraseña debe tener entre 12 y 80 caracteres." }, 400);
  }

  if (!deliverySecret || deliverySecret.length < 32 || !supabaseUrl || !serviceRoleKey) {
    return noStoreJson({ error: "La activación promocional no está configurada en el servidor." }, 503);
  }

  const sessionId = `promo_${randomUUID().replaceAll("-", "")}`;
  const gameCode = createGameCode(sessionId, deliverySecret);
  const client = createClient<Database>(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });
  const { error } = await client.rpc("create_game_after_purchase", {
    p_stripe_checkout_session_id: sessionId,
    p_stripe_payment_intent_id: null,
    p_amount: 0,
    p_currency: "eur",
    p_status: "promo",
    p_game_code: gameCode,
    p_join_code: gameCode,
    p_master_username: masterUsername,
    p_master_password: masterPassword,
    p_buyer_email: null,
  });

  if (error) {
    console.error("QR Quest promo activation failed", error);
    return noStoreJson({ error: "No se pudo activar la partida. Puede que ese usuario ya esté en uso." }, 500);
  }

  return noStoreJson({ session_id: sessionId });
}

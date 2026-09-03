import { NextResponse } from "next/server";
import Stripe from "stripe";
import { PRODUCT } from "@/lib/product";

function getOrigin(request: Request): string {
  const configuredUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (configuredUrl) return new URL(configuredUrl).origin;
  if (process.env.NODE_ENV === "production") throw new Error("NEXT_PUBLIC_SITE_URL is required");
  return new URL(request.url).origin;
}

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  const secretKey = process.env.STRIPE_SECRET_KEY;

  if (!secretKey) {
    return NextResponse.json(
      { error: "Stripe no está configurado. Añade STRIPE_SECRET_KEY en el entorno del servidor." },
      { status: 503 },
    );
  }

  try {
    const stripe = new Stripe(secretKey);
    const origin = getOrigin(request);
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      allow_promotion_codes: true,
      line_items: [
        {
          price_data: {
            currency: PRODUCT.priceCurrency,
            unit_amount: PRODUCT.priceCents,
            product_data: {
              name: PRODUCT.legalName,
              description: "Juego web para eventos con ruta QR, capturas y panel master.",
            },
          },
          quantity: 1,
        },
      ],
      metadata: {
        product: PRODUCT.legalName,
        fulfillment: "web-download",
      },
      success_url: `${origin}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/cancel`,
    });

    return NextResponse.json(
      { url: session.url },
      { headers: { "Cache-Control": "private, no-store, max-age=0" } },
    );
  } catch (error) {
    console.error("QR Quest checkout failed", error);
    return NextResponse.json(
      { error: "No se pudo abrir el pago. Inténtalo de nuevo." },
      { status: 500, headers: { "Cache-Control": "private, no-store, max-age=0" } },
    );
  }
}

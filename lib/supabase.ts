import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

export const supabase = url && key
  ? createClient(url, key, {
      auth: { persistSession: false },
      realtime: { params: { eventsPerSecond: 10 } },
    })
  : null;

export const supabaseConfigured = Boolean(url && key);

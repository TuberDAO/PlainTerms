import { createBrowserClient as createBrowserClientSSR } from "@supabase/ssr";
import type { Database } from "@/types/database";

function getSupabaseEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
  return { url, key };
}

export function createBrowserClient() {
  const { url, key } = getSupabaseEnv();
  return createBrowserClientSSR<Database>(url, key);
}

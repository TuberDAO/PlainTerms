import { NextRequest, NextResponse } from "next/server";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, vertical, locale, utm } = body;

    if (!email || typeof email !== "string" || !EMAIL_REGEX.test(email)) {
      return NextResponse.json(
        { error: "Please provide a valid email address." },
        { status: 400 }
      );
    }

    // Supabase insert — requires configured env vars
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey =
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

    if (supabaseUrl && supabaseKey) {
      const { createRouteHandlerClient } = await import(
        "@/lib/supabase/server"
      );
      const supabase = await createRouteHandlerClient();

      const { error } = await supabase.from("waitlist_leads").insert({
        email: email.toLowerCase().trim(),
        vertical: vertical || null,
        locale: locale || null,
        utm: utm || null,
      });

      if (error) {
        if (error.code === "23505") {
          return NextResponse.json({ success: true, message: "Already subscribed." });
        }
        console.error("Supabase insert error:", error);
        return NextResponse.json(
          { error: "Failed to save. Please try again." },
          { status: 500 }
        );
      }
    } else {
      // Dev mode without Supabase — log and succeed
      console.log("[leads] Email captured (no Supabase):", {
        email,
        vertical,
        locale,
        utm,
      });
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { error: "Invalid request." },
      { status: 400 }
    );
  }
}

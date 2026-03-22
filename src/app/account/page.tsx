"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { LogIn, LogOut, User, AlertCircle } from "lucide-react";
import { createBrowserClient } from "@/lib/supabase/client";
import type { User as SupabaseUser } from "@supabase/supabase-js";
import { Suspense } from "react";

function AccountContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const authError = searchParams.get("error");

  const [user, setUser] = useState<SupabaseUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [signOutLoading, setSignOutLoading] = useState(false);
  const [oauthError, setOauthError] = useState<string | null>(null);

  const supabase = createBrowserClient();

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user: u } }) => {
      setUser(u);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, [supabase.auth]);

  async function handleGoogleSignIn() {
    setOauthError(null);
    setGoogleLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      });
      if (error) {
        setOauthError(
          error.message ||
            "Google sign in could not start. Check your connection and try again.",
        );
      }
    } finally {
      setGoogleLoading(false);
    }
  }

  async function handleGoogleUpgrade() {
    setOauthError(null);
    setGoogleLoading(true);
    try {
      const { error } = await supabase.auth.linkIdentity({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      });
      if (error) {
        setOauthError(
          error.message ||
            "Linking Google could not start. Check your connection and try again.",
        );
      }
    } finally {
      setGoogleLoading(false);
    }
  }

  async function handleSignOut() {
    setOauthError(null);
    setSignOutLoading(true);
    try {
      const { error } = await supabase.auth.signOut();
      if (error) {
        setOauthError(
          error.message ||
            "Sign out did not complete. Please try again.",
        );
        return;
      }
      setUser(null);
      router.refresh();
    } finally {
      setSignOutLoading(false);
    }
  }

  const isAnonymous = user?.is_anonymous === true;

  if (loading) {
    return (
      <div className="py-20 text-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return (
    <div className="py-14 sm:py-20">
      <div className="container mx-auto max-w-sm px-4">
        <h1 className="text-center text-2xl font-bold tracking-tight sm:text-3xl">
          Account
        </h1>

        {(authError || oauthError) && (
          <div className="mt-4 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
            <p>{oauthError ?? "Sign-in failed. Please try again."}</p>
          </div>
        )}

        <Card className="mt-8 rounded-xl">
          <CardContent className="p-6">
            {/* Not signed in */}
            {!user && (
              <div className="space-y-5">
                <div className="text-center">
                  <User className="mx-auto h-10 w-10 text-muted-foreground/40" />
                  <p className="mt-3 text-sm text-muted-foreground">
                    Sign in to save your reports and access them later.
                  </p>
                </div>
                <Button
                  className="w-full gap-2 rounded-lg font-semibold shadow-sm"
                  size="lg"
                  onClick={handleGoogleSignIn}
                  disabled={googleLoading}
                >
                  <LogIn className="h-4 w-4" />
                  Continue with Google
                </Button>
              </div>
            )}

            {/* Anonymous user */}
            {user && isAnonymous && (
              <div className="space-y-5">
                <div className="text-center">
                  <User className="mx-auto h-10 w-10 text-muted-foreground/40" />
                  <p className="mt-3 text-sm font-medium">Guest account</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Your reports are saved for this session. Sign in with
                    Google to keep them permanently and access from any device.
                  </p>
                </div>
                <Button
                  className="w-full gap-2 rounded-lg font-semibold shadow-sm"
                  size="lg"
                  onClick={handleGoogleUpgrade}
                  disabled={googleLoading}
                >
                  <LogIn className="h-4 w-4" />
                  Sign in with Google
                </Button>
                <Separator />
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full gap-2 text-muted-foreground"
                  onClick={handleSignOut}
                  disabled={signOutLoading}
                >
                  <LogOut className="h-4 w-4" />
                  Sign out
                </Button>
              </div>
            )}

            {/* Authenticated (non-anonymous) user */}
            {user && !isAnonymous && (
              <div className="space-y-5">
                <div className="text-center">
                  <User className="mx-auto h-10 w-10 text-primary/60" />
                  <p className="mt-3 text-sm font-medium">
                    {user.email ?? "Signed in"}
                  </p>
                  {user.app_metadata?.provider && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      via{" "}
                      {user.app_metadata.provider.charAt(0).toUpperCase() +
                        user.app_metadata.provider.slice(1)}
                    </p>
                  )}
                </div>
                <Separator />
                <Button
                  variant="outline"
                  className="w-full gap-2 rounded-lg"
                  onClick={handleSignOut}
                  disabled={signOutLoading}
                >
                  <LogOut className="h-4 w-4" />
                  Sign out
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function AccountPage() {
  return (
    <Suspense>
      <AccountContent />
    </Suspense>
  );
}

"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { LogIn, LogOut, ArrowUpCircle, User, AlertCircle } from "lucide-react";
import { createBrowserClient } from "@/lib/supabase/client";
import type { User as SupabaseUser } from "@supabase/supabase-js";
import { Suspense } from "react";

function AccountContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const authError = searchParams.get("error");

  const [user, setUser] = useState<SupabaseUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

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
    setActionLoading(true);
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
  }

  async function handleGoogleUpgrade() {
    setActionLoading(true);
    await supabase.auth.linkIdentity({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
  }

  async function handleSignOut() {
    setActionLoading(true);
    await supabase.auth.signOut();
    setUser(null);
    setActionLoading(false);
    router.refresh();
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

        {authError && (
          <div className="mt-4 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
            <p>Sign-in failed. Please try again.</p>
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
                  disabled={actionLoading}
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
                    Upgrade to keep your reports permanently and access
                    them from any device.
                  </p>
                </div>
                <Button
                  className="w-full gap-2 rounded-lg font-semibold shadow-sm"
                  size="lg"
                  onClick={handleGoogleUpgrade}
                  disabled={actionLoading}
                >
                  <ArrowUpCircle className="h-4 w-4" />
                  Upgrade with Google
                </Button>
                <Separator />
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full gap-2 text-muted-foreground"
                  onClick={handleSignOut}
                  disabled={actionLoading}
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
                  disabled={actionLoading}
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

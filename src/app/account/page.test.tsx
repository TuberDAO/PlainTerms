import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";

const refreshMock = vi.fn();

const authMocks = vi.hoisted(() => {
  const sharedAuth = {
    getUser: vi.fn(async () => ({
      data: { user: { id: "guest-1", is_anonymous: true } },
    })),
    onAuthStateChange: vi.fn(() => ({
      data: { subscription: { unsubscribe: () => {} } },
    })),
    signInWithOAuth: vi.fn(() => Promise.resolve({ error: null })),
    linkIdentity: vi.fn(),
    signOut: vi.fn(() => Promise.resolve({ error: null })),
  };
  return { sharedAuth };
});

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: refreshMock, push: vi.fn() }),
  useSearchParams: () => ({ get: () => null }),
}));

vi.mock("@/lib/supabase/client", () => ({
  createBrowserClient: () => ({ auth: authMocks.sharedAuth }),
}));

import AccountPage from "./page";

describe("Account page — guest and Google controls", () => {
  let unblockGoogle: () => void;

  beforeEach(() => {
    vi.clearAllMocks();
    authMocks.sharedAuth.getUser.mockImplementation(async () => ({
      data: { user: { id: "guest-1", is_anonymous: true } },
    }));
    authMocks.sharedAuth.linkIdentity.mockImplementation(
      () =>
        new Promise<{ error: null }>((resolve) => {
          unblockGoogle = () => resolve({ error: null });
        }),
    );
    authMocks.sharedAuth.signOut.mockResolvedValue({ error: null });
  });

  it("does not disable Sign out while Google linking is in progress", async () => {
    render(<AccountPage />);

    await act(async () => {
      await Promise.resolve();
    });

    const googleBtn = await screen.findByRole("button", {
      name: /sign in with google/i,
    });
    const signOutBtn = screen.getByRole("button", { name: /^sign out$/i });

    expect(signOutBtn).not.toBeDisabled();

    await act(async () => {
      fireEvent.click(googleBtn);
    });

    expect(googleBtn).toBeDisabled();
    expect(signOutBtn).not.toBeDisabled();

    await act(async () => {
      unblockGoogle();
      await Promise.resolve();
    });
  });
});

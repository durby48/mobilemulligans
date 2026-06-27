"use client";

import { useRouter } from "next/navigation";
import { createSupabaseBrowserAuthClient } from "@/lib/supabase/auth-browser";

// Floating sign-out, top-left so it clears the ops overlay (top-right). Sits
// above the fullscreen iframe.
export function SignOutButton() {
  const router = useRouter();
  async function signOut() {
    try {
      await createSupabaseBrowserAuthClient().auth.signOut();
    } finally {
      router.replace("/login");
      router.refresh();
    }
  }
  return (
    <button
      onClick={signOut}
      style={{
        position: "fixed",
        top: 12,
        left: 12,
        zIndex: 2147483647,
        padding: "6px 12px",
        borderRadius: 8,
        border: "1px solid rgba(255,255,255,0.2)",
        background: "rgba(10,20,31,0.85)",
        color: "#e8f0f8",
        font: "12px ui-sans-serif, system-ui, sans-serif",
        cursor: "pointer",
      }}
    >
      Sign out
    </button>
  );
}

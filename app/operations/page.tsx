// app/operations/page.tsx — embedded Global Operations remote client.
//
// Serves the vendored web client (public/ops-client/, built in Global Operations
// via `npm run build:web` + scripts/sync-ops-client.ps1) inside an iframe so its
// React + three.js root stays isolated from this Next app. The client connects to
// the platform on the owner's PC over the Ops WebSocket transport; this site only
// hosts the static bundle and (in WS4) mints the short-lived session token.
//
// AUTH (WS4): middleware.ts requires a logged-in employee to reach this route
// (unauthenticated → /login). The embedded client then fetches /api/ops-token
// (same-origin, with the session cookie) to get its scoped token. OPS_PUBLIC_ENABLED
// remains a feature kill-switch (404 until launch + the tunnel are live).

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SignOutButton } from "./SignOutButton";

export const metadata: Metadata = {
  title: "Operations",
  robots: { index: false, follow: false },
};

// The gate reads an env var at request time — never statically cache the result.
export const dynamic = "force-dynamic";

export default function OperationsPage({
  searchParams,
}: {
  searchParams: { [key: string]: string | string[] | undefined };
}) {
  // Auth (middleware + the employees table) is the real gate. OPS_PUBLIC_ENABLED
  // is now an explicit kill-switch: set it to "false" to take operations offline.
  if (process.env.OPS_PUBLIC_ENABLED === "false") notFound();

  // Normally the embedded client fetches /api/ops-token itself. A ?opsToken=…
  // override is still honored for dev (e.g. a manually minted token).
  const raw = searchParams.opsToken;
  const token = typeof raw === "string" ? raw : undefined;
  const src = token
    ? `/ops-client/index.web.html?opsToken=${encodeURIComponent(token)}`
    : "/ops-client/index.web.html";

  return (
    <>
      <iframe
        src={src}
        title="Global Operations"
        allow="fullscreen"
        style={{ position: "fixed", inset: 0, width: "100vw", height: "100vh", border: 0 }}
      />
      <SignOutButton />
    </>
  );
}

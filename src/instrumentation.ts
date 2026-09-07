/**
 * Next.js instrumentation hook — runs once when a Node server instance
 * starts (including cold starts on Vercel / Hostinger).
 *
 * Guarantees the database schema exists before requests are served and
 * logs an unmissable startup diagnostic so host logs (Hostinger/Vercel)
 * immediately show whether DATABASE_URL is configured and reachable.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const configured = Boolean(process.env.DATABASE_URL);
  console.log(
    `[boot] DATABASE_URL configured: ${configured ? "yes" : "NO — set it in your host environment variables"}`
  );

  if (!configured) return;

  try {
    const { bootstrapDatabase } = await import("./db/bootstrap");
    await bootstrapDatabase();
    console.log("[boot] Database schema verified / migrated.");
  } catch (err: any) {
    // Never crash server start. Request handlers surface real errors and
    // /api/health reports the exact connection problem.
    console.error("[boot] Database bootstrap failed:", err?.message || err);
  }
}

import { NextResponse } from "next/server";
import { probeDatabase } from "@/db";
import { bootstrapDatabase } from "@/db/bootstrap";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await bootstrapDatabase();
  } catch (error) {
    console.error("[health] schema bootstrap failed:", error);
  }
  const probe = await probeDatabase();

  if (!probe.ok) {
    return NextResponse.json(
      {
        ok: false,
        status: "database_unreachable",
        detail: probe.detail,
        hint: "Set DATABASE_URL (Supabase session-pooler connection string) in your host environment variables, then reload. See DEPLOYMENT.md.",
      },
      { status: 503 }
    );
  }

  return NextResponse.json({ ok: true, database: probe.detail });
}

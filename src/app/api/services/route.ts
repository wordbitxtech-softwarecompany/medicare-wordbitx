import { NextResponse } from "next/server";
import { db } from "@/db";
import { services } from "@/db/schema";
import { eq, desc } from "drizzle-orm";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const includeAll = searchParams.get("all") === "true";
    const category = searchParams.get("category");

    let query = db.select().from(services);
    
    if (includeAll) {
      if (category && category !== "All") {
        const results = await db.select().from(services).where(eq(services.category, category)).orderBy(desc(services.featured), services.id);
        return NextResponse.json(results);
      }
      const results = await db.select().from(services).orderBy(desc(services.featured), services.id);
      return NextResponse.json(results);
    } else {
      if (category && category !== "All") {
        const results = await db.select().from(services).where(eq(services.active, true)).orderBy(desc(services.featured), services.id);
        return NextResponse.json(results.filter(s => s.category === category));
      }
      const results = await db.select().from(services).where(eq(services.active, true)).orderBy(desc(services.featured), services.id);
      return NextResponse.json(results);
    }
  } catch (error) {
    console.error("Error fetching services:", error);
    return NextResponse.json({ error: "Failed to fetch services" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const [created] = await db
      .insert(services)
      .values({
        name: body.name,
        category: body.category || "General Medicine",
        description: body.description,
        durationMinutes: Number(body.durationMinutes) || 30,
        price: Number(body.price) || 2500,
        icon: body.icon || "Stethoscope",
        badge: body.badge || null,
        preparationInstructions: body.preparationInstructions || null,
        active: body.active !== undefined ? body.active : true,
        featured: body.featured !== undefined ? body.featured : false,
      })
      .returning();

    return NextResponse.json({ success: true, service: created });
  } catch (error) {
    console.error("Error creating service:", error);
    return NextResponse.json({ error: "Failed to create service" }, { status: 500 });
  }
}

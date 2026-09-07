import { NextResponse } from "next/server";
import { db } from "@/db";
import { blogPosts } from "@/db/schema";
import { eq, desc } from "drizzle-orm";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const includeAll = searchParams.get("all") === "true";
    const category = searchParams.get("category");

    let results;
    if (includeAll) {
      results = await db.select().from(blogPosts).orderBy(desc(blogPosts.id));
    } else {
      results = await db
        .select()
        .from(blogPosts)
        .where(eq(blogPosts.published, true))
        .orderBy(desc(blogPosts.id));
    }

    if (category && category !== "All") {
      results = results.filter((p) => p.category.toLowerCase() === category.toLowerCase());
    }

    return NextResponse.json(results);
  } catch (error) {
    console.error("Error fetching blog posts:", error);
    return NextResponse.json({ error: "Failed to fetch blog posts" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { title, category, authorName, authorRole, readTime, summary, content, published } = body;

    if (!title || !category || !content) {
      return NextResponse.json({ error: "Title, category, and content are required" }, { status: 400 });
    }

    const slug = title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") + `-${Date.now().toString().slice(-4)}`;

    const [created] = await db
      .insert(blogPosts)
      .values({
        slug,
        title: title.trim(),
        category: category.trim(),
        authorName: authorName ? authorName.trim() : "Medical Team",
        authorRole: authorRole || "Consultant Physician",
        readTime: readTime || "4 min read",
        summary: summary || title,
        content: content.trim(),
        published: published !== undefined ? published : true,
      })
      .returning();

    return NextResponse.json({ success: true, post: created });
  } catch (error) {
    console.error("Error creating blog post:", error);
    return NextResponse.json({ error: "Failed to create blog post" }, { status: 500 });
  }
}

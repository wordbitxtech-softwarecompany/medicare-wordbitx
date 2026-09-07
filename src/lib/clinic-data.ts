import { db, probeDatabase } from "@/db";
import { bootstrapDatabase } from "@/db/bootstrap";
import {
  clinicSettings,
  doctors,
  services,
  reviews,
  blogPosts,
  faqs,
} from "@/db/schema";
import { eq, desc } from "drizzle-orm";

export type PublicDataResult =
  | { ok: true; data: Awaited<ReturnType<typeof getPublicClinicData>> }
  | { ok: false; detail: string };

/**
 * Same as getPublicClinicData but never throws — returns the exact database
 * error so pages can render an explanatory notice instead of crashing with a
 * generic host error page (Hostinger/Vercel "This page couldn't load").
 */
export async function getPublicClinicDataSafe(): Promise<PublicDataResult> {
  try {
    return { ok: true, data: await getPublicClinicData() };
  } catch (err: any) {
    const probe = await probeDatabase();
    return {
      ok: false,
      detail: probe.ok ? err?.message || String(err) : probe.detail,
    };
  }
}

export async function getPublicClinicData() {
  await bootstrapDatabase();
  const [settingsRows, allDoctors, allServices, allReviews, allBlogPosts, allFaqs] =
    await Promise.all([
      db.select().from(clinicSettings).limit(1),
      db
        .select()
        .from(doctors)
        .where(eq(doctors.active, true))
        .orderBy(desc(doctors.featured), doctors.id),
      db
        .select()
        .from(services)
        .where(eq(services.active, true))
        .orderBy(desc(services.featured), services.id),
      db
        .select()
        .from(reviews)
        .where(eq(reviews.published, true))
        .orderBy(desc(reviews.id)),
      db
        .select()
        .from(blogPosts)
        .where(eq(blogPosts.published, true))
        .orderBy(desc(blogPosts.id)),
      db
        .select()
        .from(faqs)
        .where(eq(faqs.active, true))
        .orderBy(faqs.orderNumber, faqs.id),
    ]);

  const settings = settingsRows[0] ?? {
    id: 1,
    clinicName: "Medicare Plus",
    tagline: "WordbitX Specialty Care",
    clinicType: "Multi-Specialty",
    phone: "+92 325 1888841",
    emergencyPhone: "+92 325 1888841",
    whatsapp: "923251888841",
    email: "info@wordbitxtech.com",
    address: "Plot 42-B, Main Boulevard, Gulberg III, Lahore, Pakistan",
    city: "Lahore",
    openingHoursWeekday: "Mon - Fri: 08:00 AM - 10:00 PM",
    openingHoursSaturday: "Saturday: 09:00 AM - 08:00 PM",
    openingHoursSunday: "Sunday: 10:00 AM - 04:00 PM (Emergency 24/7)",
    currency: "PKR",
    primaryColor: "#0f2b48",
    secondaryColor: "#0d9488",
    heroHeadline: "Specialist Healthcare in Lahore, Without the Wait",
    heroSubheadline:
      "Consultant-led medical, dental and diagnostic care close to home, with clear fees and confirmed appointment times.",
    aboutText:
      "Medicare Plus is a premier healthcare institution providing comprehensive medical, surgical, dental, and diagnostic services in Pakistan.",
    updatedAt: new Date(),
  };

  return {
    settings,
    doctors: allDoctors,
    services: allServices,
    reviews: allReviews,
    blogPosts: allBlogPosts,
    faqs: allFaqs,
  };
}

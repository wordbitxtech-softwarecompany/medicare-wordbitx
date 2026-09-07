import { NextResponse } from "next/server";
import { db } from "@/db";
import { appointments, doctors, services } from "@/db/schema";
import { desc, eq, ilike, or } from "drizzle-orm";

/**
 * Track appointments by:
 *  - Reference number  (e.g. MED-2026-1234567)
 *  - Patient name      (partial, case-insensitive)
 *  - CNIC              (exact)
 *
 * Returns all matching appointments ordered by date descending.
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get("query")?.trim() || "";

    if (!query) {
      return NextResponse.json(
        { error: "Please enter a reference number, your name, or CNIC." },
        { status: 400 }
      );
    }

    const searchCondition = or(
      // Exact reference number match
      ilike(appointments.appointmentNumber, query),
      // Patient name — partial match
      ilike(appointments.patientName, `%${query}%`),
      // CNIC — exact match
      ilike(appointments.patientCnic, query)
    );

    const rows = await db
      .select({
        id: appointments.id,
        appointmentNumber: appointments.appointmentNumber,
        patientName: appointments.patientName,
        patientPhone: appointments.patientPhone,
        patientCnic: appointments.patientCnic,
        appointmentDate: appointments.appointmentDate,
        appointmentTime: appointments.appointmentTime,
        status: appointments.status,
        fee: appointments.fee,
        paymentStatus: appointments.paymentStatus,
        visitType: appointments.visitType,
        doctorName: doctors.name,
        doctorSpecialty: doctors.specialty,
        doctorRoom: doctors.roomNo,
        serviceName: services.name,
        prescription: appointments.prescription,
      })
      .from(appointments)
      .leftJoin(doctors, eq(appointments.doctorId, doctors.id))
      .leftJoin(services, eq(appointments.serviceId, services.id))
      .where(searchCondition)
      .orderBy(desc(appointments.appointmentDate), desc(appointments.id))
      .limit(20);

    if (rows.length === 0) {
      return NextResponse.json(
        {
          error:
            "No appointments found. Try your reference number (e.g. MED-2026-1001), full name, or CNIC.",
          rows: [],
        },
        { status: 404 }
      );
    }

    return NextResponse.json({ rows, total: rows.length });
  } catch (error) {
    console.error("Error tracking appointment:", error);
    return NextResponse.json({ error: "Failed to track appointment" }, { status: 500 });
  }
}

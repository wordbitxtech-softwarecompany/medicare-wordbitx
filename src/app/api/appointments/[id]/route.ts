import { NextResponse } from "next/server";
import { db } from "@/db";
import { appointments } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { getSession } from "@/lib/auth";

export async function GET(
  _request: Request,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const params = await props.params;
    const id = Number(params.id);
    const [appointment] = await db
      .select()
      .from(appointments)
      .where(eq(appointments.id, id))
      .limit(1);

    if (!appointment) {
      return NextResponse.json({ error: "Appointment not found" }, { status: 404 });
    }
    return NextResponse.json(appointment);
  } catch (error) {
    console.error("Error fetching appointment:", error);
    return NextResponse.json({ error: "Failed to fetch appointment" }, { status: 500 });
  }
}

export async function PUT(
  request: Request,
  props: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const params = await props.params;
    const id = Number(params.id);
    const body = await request.json();

    const [existing] = await db
      .select()
      .from(appointments)
      .where(eq(appointments.id, id))
      .limit(1);

    if (!existing) {
      return NextResponse.json({ error: "Appointment not found" }, { status: 404 });
    }

    // Doctor-only clinical note access.
    const isClinicalUpdate =
      body.doctorNotes !== undefined || body.prescription !== undefined;

    if (isClinicalUpdate) {
      if (session.role !== "doctor" || !session.doctorId || session.doctorId !== existing.doctorId) {
        return NextResponse.json(
          { error: "Only the assigned doctor can edit prescriptions and clinical notes." },
          { status: 403 }
        );
      }

      const [updatedClinical] = await db
        .update(appointments)
        .set({
          doctorNotes: body.doctorNotes,
          prescription: body.prescription,
          status: body.status || existing.status,
        })
        .where(eq(appointments.id, id))
        .returning();

      return NextResponse.json({ success: true, appointment: updatedClinical });
    }

    // Operational edits for super admin / receptionist.
    if (session.role === "doctor") {
      return NextResponse.json(
        { error: "Doctors cannot change operational appointment fields from this endpoint." },
        { status: 403 }
      );
    }

    const [updated] = await db
      .update(appointments)
      .set({
        status: body.status,
        appointmentDate: body.appointmentDate,
        appointmentTime: body.appointmentTime,
        paymentStatus: body.paymentStatus,
        fee: body.fee !== undefined ? Number(body.fee) : undefined,
        patientNotes: body.patientNotes,
        doctorId: body.doctorId !== undefined ? Number(body.doctorId) : undefined,
      })
      .where(eq(appointments.id, id))
      .returning();

    return NextResponse.json({ success: true, appointment: updated });
  } catch (error) {
    console.error("Error updating appointment:", error);
    return NextResponse.json({ error: "Failed to update appointment" }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  props: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session || session.role === "doctor") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const params = await props.params;
    const id = Number(params.id);
    await db.delete(appointments).where(eq(appointments.id, id));
    return NextResponse.json({ success: true, message: "Appointment deleted successfully" });
  } catch (error) {
    console.error("Error deleting appointment:", error);
    return NextResponse.json({ error: "Failed to delete appointment" }, { status: 500 });
  }
}

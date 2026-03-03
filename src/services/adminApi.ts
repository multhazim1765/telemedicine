import { createDocument, deleteDocumentById, listCollection, setDocumentById, updateDocumentById } from "./firestoreService";
import { AppUser, Patient } from "../types/models";

export const adminApi = {
  getOverview: async () => {
    const [users, patients, appointments, pharmacyRequests] = await Promise.all([
      listCollection("users"),
      listCollection("patients"),
      listCollection("appointments"),
      listCollection("pharmacy_requests")
    ]);

    const smsUsageCount = pharmacyRequests.filter((item) => item.smsDeliveryStatus === "sent" || Boolean(item.smsMessageId)).length;

    return {
      totalUsers: users.length,
      totalPatients: patients.length,
      totalAppointments: appointments.length,
      smsUsageCount
    };
  },
  addUser: async (user: AppUser & { password?: string }) => {
    await setDocumentById("users", user.uid, user);
  },
  deleteUser: async (uid: string) => {
    await deleteDocumentById("users", uid);
  },
  updatePatient: async (id: string, payload: Partial<Patient>) => {
    await updateDocumentById("patients", id, payload);
  },
  addLog: async (entry: { action: string; details: string; actor: string }) => {
    await createDocument("triage_sessions", {
      patientId: entry.actor,
      symptoms: [entry.action, entry.details],
      result: {
        severityScore: 0,
        severityLevel: "low",
        recommendedAction: "log"
      }
    });
  }
};

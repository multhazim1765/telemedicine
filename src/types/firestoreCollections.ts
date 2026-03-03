import {
  AppUser,
  Appointment,
  Consultation,
  Doctor,
  MedicineStock,
  Patient,
  PharmacyRequest,
  Prescription,
  TriageSession
} from "./models";

export interface FirestoreCollections {
  users: AppUser;
  patients: Patient;
  doctors: Doctor;
  appointments: Appointment;
  triage_sessions: TriageSession;
  consultations: Consultation;
  prescriptions: Prescription;
  pharmacy_requests: PharmacyRequest;
  medicine_stock: MedicineStock;
}

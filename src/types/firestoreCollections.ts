import {
  AppUser,
  Appointment,
  Consultation,
  Doctor,
  HospitalCatalog,
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
  hospital_catalog: HospitalCatalog;
  appointments: Appointment;
  triage_sessions: TriageSession;
  consultations: Consultation;
  prescriptions: Prescription;
  pharmacy_requests: PharmacyRequest;
  medicine_stock: MedicineStock;
}

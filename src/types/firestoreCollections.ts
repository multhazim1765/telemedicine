import {
  AppUser,
  Appointment,
  Consultation,
  Doctor,
  HospitalCatalog,
  IvrMenuConfig,
  MedicineStock,
  Patient,
  PharmacyRequest,
  Prescription,
  SmsBooking,
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
  sms_bookings: SmsBooking;
  ivr_menu_config: IvrMenuConfig;
}

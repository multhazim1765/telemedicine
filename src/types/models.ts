export type UserRole = "patient" | "doctor" | "pharmacy" | "super_admin";

export interface AppUser {
  id?: string;
  uid: string;
  email: string;
  role: UserRole;
  displayName: string;
  phone?: string;
  hospitalName?: string;
}

export interface Patient {
  id: string;
  userId: string;
  name: string;
  age: number;
  gender: "male" | "female" | "other";
  village: string;
  phone: string;
  comorbidities?: string[];
  allergies?: string[];
  createdAt: string;
}

export interface Doctor {
  id: string;
  userId: string;
  doctorCode: string;
  name: string;
  hospitalName: string;
  place: string;
  district: string;
  designation: string;
  specialization: string;
  availabilitySlots: string[];
  city?: string;
  phone?: string;
}

export interface TriageResult {
  severityScore: number;
  severityLevel: "low" | "medium" | "high";
  recommendedAction: string;
}

export interface TriageSession {
  id: string;
  patientId: string;
  patientName?: string;
  patientPhone?: string;
  symptoms: string[];
  result: TriageResult;
  preferredSpecialization?: string;
  assignedDoctorId?: string;
  createdAt: string;
}

export interface Appointment {
  id: string;
  patientId: string;
  patientName?: string;
  patientPhone?: string;
  triageSessionId?: string;
  doctorId: string;
  doctorName?: string;
  specialization: string;
  slot: string;
  appointmentDate: string;
  tokenNumber: number;
  status: "booked" | "cancelled";
  createdAt: string;
}

export interface Consultation {
  id: string;
  triageSessionId: string;
  patientId: string;
  doctorId: string;
  notes: string;
  createdAt: string;
}

export interface Prescription {
  id: string;
  consultationId: string;
  patientId: string;
  doctorId: string;
  medicines: string[];
  dosageInstructions: string[];
  notes: string;
  createdAt: string;
}

export type PharmacySmsStatus = "pending" | "available" | "not_available";
export type DeliveryStatus = "pending" | "sent" | "failed";

export interface PharmacyRequest {
  id: string;
  prescriptionId: string;
  patientId: string;
  pharmacyId?: string;
  doctorId?: string;
  doctorName?: string;
  medicines: string[];
  smsStatus: PharmacySmsStatus;
  smsDeliveryStatus?: DeliveryStatus;
  smsMessageId?: string;
  smsError?: string;
  patientPhone: string;
  updatedAt: string;
}

export interface MedicineStock {
  id: string;
  medicineId: string;
  medicineName: string;
  quantity: number;
  inStock: boolean;
  alternatives: string[];
  updatedAt: string;
}

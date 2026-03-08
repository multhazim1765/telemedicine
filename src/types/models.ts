export type UserRole = "patient" | "doctor" | "pharmacy" | "super_admin";

export interface AppUser {
  id?: string;
  uid: string;
  email: string;
  role: UserRole;
  displayName: string;
  phone?: string;
  hospitalName?: string;
  pharmacyName?: string;
  district?: string;
}

export interface Patient {
  id: string;
  userId: string;
  name: string;
  age: number;
  gender: "male" | "female" | "other";
  district?: string;
  village?: string;
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

export interface HospitalCatalog {
  id: string;
  hospitalName: string;
  district: string;
  ivrDigit?: string;
}

export interface IvrMenuMapping {
  digit: string;
  hospitalName: string;
  doctorId?: string;
  doctorName?: string;
  priority: number;
  active: boolean;
}

export interface IvrMenuConfig {
  id: string;
  active: boolean;
  menuVersion: number;
  defaultHospitalName?: string;
  mappings: IvrMenuMapping[];
  updatedBy?: string;
  updatedAt: string;
  createdAt?: string;
}

export interface SmsBooking {
  id: string;
  smsMessageId: string;
  senderPhone: string;
  normalizedSenderPhone: string;
  messageStatus?: string;
  parsedCommand?: string;
  smsText?: string;
  selectedHospitalName?: string;
  menuVersion?: number;
  patientId?: string;
  patientName?: string;
  doctorId?: string;
  doctorName?: string;
  slot?: string;
  appointmentDate?: string;
  tokenNumber?: number;
  triageSessionId?: string;
  appointmentId?: string;
  status: "received" | "booked" | "failed";
  smsStatus?: "queued" | "failed" | "not_sent";
  smsDeliveryMessageId?: string;
  smsError?: string;
  failureReason?: string;
  createdAt: string;
  updatedAt: string;
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
  clinicalDecision?: ClinicalDecisionSummary;
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
  clinicalDecision?: ClinicalDecisionSummary;
  createdAt: string;
}

export interface ClinicalDecisionMatchSummary {
  condition: string;
  category: string;
  triageOption: string;
  matchPercent: number;
  matchedSymptoms: string[];
}

export interface ClinicalDecisionMedicineSummary {
  medicineName: string;
  selectedMedicineName: string;
  suggestedDosage: string;
  selectedDosage: string;
  inStock: boolean;
  alternativeMedicineNames: string[];
  explanation: string;
}

export interface ClinicalDecisionSummary {
  symptoms: string[];
  severityScore: number;
  severityLevel: TriageResult["severityLevel"];
  recommendedAction: string;
  feverDays: number;
  reviewAfterDays: number;
  notes: string;
  primaryMatch?: ClinicalDecisionMatchSummary;
  alternativeMatches: ClinicalDecisionMatchSummary[];
  riskScore: number;
  riskLevel: "low" | "moderate" | "high";
  riskReasons: string[];
  medicines: ClinicalDecisionMedicineSummary[];
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
  dosageInstructions?: string[];
  notes?: string;
  reviewAfterDays?: number;
  clinicalDecision?: ClinicalDecisionSummary;
  smsContent?: string;
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

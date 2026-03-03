import { createDocument, updateDocumentById } from "../services/firestoreService";
import { PharmacyRequest, Prescription } from "../types/models";
import { nowIso } from "../utils/date";

const normalizePhoneForSms = (phone: string): string => {
  const cleaned = phone.replace(/[^\d+]/g, "").trim();
  if (cleaned.startsWith("+")) {
    return cleaned;
  }

  const digitsOnly = cleaned.replace(/\D/g, "");
  if (digitsOnly.length === 10) {
    return `+91${digitsOnly}`;
  }
  if (digitsOnly.length === 12 && digitsOnly.startsWith("91")) {
    return `+${digitsOnly}`;
  }
  return cleaned;
};

export const formatPharmacyRequest = (
  prescription: Prescription,
  patientPhone: string,
  doctorName?: string
): Omit<PharmacyRequest, "id"> => ({
  prescriptionId: prescription.id,
  patientId: prescription.patientId,
  doctorId: prescription.doctorId,
  doctorName,
  medicines: prescription.medicines,
  patientPhone: normalizePhoneForSms(patientPhone),
  smsStatus: "pending",
  smsDeliveryStatus: "pending",
  updatedAt: nowIso()
});

export const createPharmacyRequest = async (
  prescription: Prescription,
  patientPhone: string,
  doctorName?: string
): Promise<string> => {
  const request = formatPharmacyRequest(prescription, patientPhone, doctorName);
  return createDocument("pharmacy_requests", request);
};

export const updatePharmacyAvailability = async (
  requestId: string,
  available: boolean
): Promise<void> => {
  await updateDocumentById("pharmacy_requests", requestId, {
    smsStatus: available ? "available" : "not_available",
    updatedAt: nowIso()
  });
};

import { httpsCallable } from "firebase/functions";
import { functions, isFirebaseConfigured } from "./firebase";
import { UserRole } from "../types/models";

interface AssignRolePayload {
  role: UserRole;
  displayName: string;
  phone: string;
  specialization?: string;
  hospitalName?: string;
  district?: string;
  village?: string;
  age?: number;
  gender?: "male" | "female" | "other";
}

export const assignUserRole = async (payload: AssignRolePayload): Promise<void> => {
  if (!isFirebaseConfigured) {
    return;
  }

  const callable = httpsCallable<AssignRolePayload, { success: boolean }>(
    functions,
    "assignUserRole"
  );
  await callable(payload);
};

export const seedChennaiDoctors = async (): Promise<void> => {
  if (!isFirebaseConfigured) {
    return;
  }

  const callable = httpsCallable<undefined, { seeded: number }>(functions, "seedChennaiDoctors");
  await callable();
};

interface SendPrescriptionSmsPayload {
  patientPhone: string;
  medicines: string[];
  dosageInstructions?: string[];
  reviewAfterDays?: number;
  customMessage?: string;
  requestId: string;
  doctorName?: string;
}

interface SendPrescriptionSmsResult {
  success: boolean;
  to: string;
  messageId: string;
  status: string;
}

const normalizePhoneForSms = (phone: string): string => {
  const cleaned = phone.replace(/[^\d+]/g, "").trim();
  if (cleaned.startsWith("+")) {
    return cleaned;
  }

  const digits = cleaned.replace(/\D/g, "");
  if (digits.length === 10) {
    return `+91${digits}`;
  }
  if (digits.length === 12 && digits.startsWith("91")) {
    return `+${digits}`;
  }
  return cleaned;
};

const smsMobileApiKey = "2598c2561e888cc1f1e876e9aea092ff269452a576570d5e";
const smsMobileApiUrl = import.meta.env.DEV
  ? "/smsmobileapi/sendsms/"
  : "https://api.smsmobileapi.com/sendsms/";

const sendPrescriptionSmsViaSmsMobile = async (
  payload: SendPrescriptionSmsPayload
): Promise<SendPrescriptionSmsResult> => {
  const normalizedPhone = normalizePhoneForSms(payload.patientPhone);
  const pairedLines = payload.medicines
    .slice(0, 4)
    .map((medicine, index) => `${medicine} - ${payload.dosageInstructions?.[index] ?? "As advised"}`)
    .join("\n");

  const message = payload.customMessage?.trim()
    ? payload.customMessage
    : [
        "Civil Hospital PHC:",
        "Prescription:",
        pairedLines || "Please check telehealth dashboard.",
        `Review after ${payload.reviewAfterDays ?? 3} days.`,
        "If symptoms worsen, visit hospital immediately."
      ].join("\n");

  const response = await fetch(smsMobileApiUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: new URLSearchParams({
      from: "multo2",
      apikey: smsMobileApiKey,
      recipients: normalizedPhone,
      message,
      sendwa: "0",
      sendsms: "1"
    })
  });

  if (!response.ok) {
    throw new Error(`SMSMobile API error: HTTP ${response.status}`);
  }

  const data = (await response.json().catch(() => ({}))) as {
    success?: boolean;
    textId?: string;
    id?: string;
    messageId?: string;
    status?: string;
    error?: string;
    message?: string;
    result?: {
      error?: number | string;
      sent?: number | string;
      id?: string;
      note?: string;
    };
  };

  if (data.success === false) {
    throw new Error(data.error ?? data.message ?? "SMSMobile send failed");
  }

  const apiError = Number(data.result?.error ?? 0);
  if (!Number.isNaN(apiError) && apiError !== 0) {
    throw new Error(data.message ?? data.error ?? data.result?.note ?? "SMSMobile send failed");
  }

  const sentFlag = String(data.result?.sent ?? "");
  const status = sentFlag === "1" ? "queued" : "pending";

  return {
    success: true,
    to: normalizedPhone,
    messageId: data.result?.id ?? data.textId ?? data.id ?? data.messageId ?? "",
    status
  };
};

const shouldFallbackToDirectSms = (error: unknown): boolean => {
  const code = String((error as { code?: string } | undefined)?.code ?? "").toLowerCase();
  if (!code) {
    return true;
  }

  return [
    "functions/not-found",
    "functions/unimplemented",
    "functions/internal",
    "functions/unavailable",
    "functions/deadline-exceeded"
  ].includes(code);
};

export const sendPrescriptionSMSNow = async (
  payload: SendPrescriptionSmsPayload
): Promise<SendPrescriptionSmsResult> => {
  if (!isFirebaseConfigured) {
    return sendPrescriptionSmsViaSmsMobile(payload);
  }

  const callable = httpsCallable<SendPrescriptionSmsPayload, SendPrescriptionSmsResult>(
    functions,
    "sendPrescriptionSMSNow"
  );
  try {
    const response = await callable(payload);
    return response.data;
  } catch (error) {
    if (!shouldFallbackToDirectSms(error)) {
      throw error;
    }
    return sendPrescriptionSmsViaSmsMobile(payload);
  }
};

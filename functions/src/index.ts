import * as admin from "firebase-admin";
import { onDocumentUpdated } from "firebase-functions/v2/firestore";
import { onCall, HttpsError } from "firebase-functions/v2/https";

admin.initializeApp();
const db = admin.firestore();

const smsMobileApiKey = "2598c2561e888cc1f1e876e9aea092ff269452a576570d5e";
const smsMobileApiUrl = "https://api.smsmobileapi.com/sendsms/";

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

const sendTextbeltSMS = async (phone: string, message: string): Promise<{ textId: string; status: string }> => {
  const response = await fetch(smsMobileApiUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: new URLSearchParams({
      from: "multo2",
      apikey: smsMobileApiKey,
      recipients: phone,
      message,
      sendwa: "0",
      sendsms: "1"
    })
  });

  if (!response.ok) {
    throw new Error(`SMSMobile API error: HTTP ${response.status}`);
  }

  const payload = (await response.json().catch(() => ({}))) as {
    success: boolean;
    textId?: string;
    id?: string;
    status?: string;
    messageId?: string;
    error?: string;
    message?: string;
    result?: {
      error?: number | string;
      sent?: number | string;
      id?: string;
      note?: string;
    };
  };

  if (payload.success === false) {
    throw new Error(payload.error ?? payload.message ?? "SMSMobile send failed");
  }

  const apiError = Number(payload.result?.error ?? 0);
  if (!Number.isNaN(apiError) && apiError !== 0) {
    throw new Error(payload.message ?? payload.error ?? payload.result?.note ?? "SMSMobile send failed");
  }

  const sentFlag = String(payload.result?.sent ?? "");
  const status = sentFlag === "1" ? "queued" : "pending";

  return {
    textId: payload.result?.id ?? payload.textId ?? payload.id ?? payload.messageId ?? "",
    status
  };
};

const hospitalSeedDoctors = [
  {
    id: "d001",
    userId: "d001",
    doctorCode: "D001",
    name: "Dr. Ashok Kumar",
    hospitalName: "Shifa Hospital",
    place: "Thanjavur District",
    district: "Thanjavur District",
    designation: "Physician",
    specialization: "general",
    availabilitySlots: ["Morning", "Afternoon"],
    city: "Thanjavur District",
    phone: ""
  },
  {
    id: "d002",
    userId: "d002",
    doctorCode: "D002",
    name: "Dr. Ghulam Mohideen",
    hospitalName: "Shifa Hospital",
    place: "Thanjavur District",
    district: "Thanjavur District",
    designation: "Physician",
    specialization: "general",
    availabilitySlots: ["Morning", "Afternoon"],
    city: "Thanjavur District",
    phone: ""
  },
  {
    id: "d003",
    userId: "d003",
    doctorCode: "D003",
    name: "Dr. K. Muthu Selvan",
    hospitalName: "Shifa Hospital",
    place: "Thanjavur District",
    district: "Thanjavur District",
    designation: "Physician",
    specialization: "general",
    availabilitySlots: ["Morning", "Afternoon"],
    city: "Thanjavur District",
    phone: ""
  },
  {
    id: "d004",
    userId: "d004",
    doctorCode: "D004",
    name: "Dr. Geetha Saravanan",
    hospitalName: "Shifa Hospital",
    place: "Thanjavur District",
    district: "Thanjavur District",
    designation: "Physician",
    specialization: "general",
    availabilitySlots: ["Morning", "Afternoon"],
    city: "Thanjavur District",
    phone: ""
  },
  {
    id: "d005",
    userId: "d005",
    doctorCode: "D005",
    name: "Dr. Mohamed Shafi Abdulla",
    hospitalName: "Shifa Hospital",
    place: "Thanjavur District",
    district: "Thanjavur District",
    designation: "General Physician",
    specialization: "general",
    availabilitySlots: ["Morning", "Afternoon"],
    city: "Thanjavur District",
    phone: ""
  },
  {
    id: "d006",
    userId: "d006",
    doctorCode: "D006",
    name: "Dr. Prasanna P",
    hospitalName: "Meenakshi Hospital",
    place: "Thanjavur District",
    district: "Thanjavur District",
    designation: "Gastroenterologist",
    specialization: "general",
    availabilitySlots: ["Morning", "Afternoon"],
    city: "Thanjavur District",
    phone: ""
  },
  {
    id: "d007",
    userId: "d007",
    doctorCode: "D007",
    name: "Dr. R. V. Shivakumar",
    hospitalName: "Meenakshi Hospital",
    place: "Thanjavur District",
    district: "Thanjavur District",
    designation: "Cardiologist",
    specialization: "cardiology",
    availabilitySlots: ["Morning", "Afternoon"],
    city: "Thanjavur District",
    phone: ""
  },
  {
    id: "d008",
    userId: "d008",
    doctorCode: "D008",
    name: "Dr. Shivkumar Rathinam Venkatesan",
    hospitalName: "Meenakshi Hospital",
    place: "Thanjavur District",
    district: "Thanjavur District",
    designation: "Cardiologist",
    specialization: "cardiology",
    availabilitySlots: ["Morning", "Afternoon"],
    city: "Thanjavur District",
    phone: ""
  },
  {
    id: "d009",
    userId: "d009",
    doctorCode: "D009",
    name: "Dr. Sasikumar Sambasivam",
    hospitalName: "Meenakshi Hospital",
    place: "Thanjavur District",
    district: "Thanjavur District",
    designation: "Oncologist",
    specialization: "general",
    availabilitySlots: ["Morning", "Afternoon"],
    city: "Thanjavur District",
    phone: ""
  },
  {
    id: "d010",
    userId: "d010",
    doctorCode: "D010",
    name: "Dr. R. Anbarasu",
    hospitalName: "A to Z Speciality Hospital",
    place: "Thanjavur District",
    district: "Thanjavur District",
    designation: "General Medicine",
    specialization: "general",
    availabilitySlots: ["Morning", "Afternoon"],
    city: "Thanjavur District",
    phone: ""
  },
  {
    id: "d011",
    userId: "d011",
    doctorCode: "D011",
    name: "Dr. S. Balaji Prathep",
    hospitalName: "A to Z Speciality Hospital",
    place: "Thanjavur District",
    district: "Thanjavur District",
    designation: "Brain & Spine Surgeon",
    specialization: "general",
    availabilitySlots: ["Morning", "Afternoon"],
    city: "Thanjavur District",
    phone: ""
  },
  {
    id: "d012",
    userId: "d012",
    doctorCode: "D012",
    name: "Dr. R. VijaiAnanth",
    hospitalName: "A to Z Speciality Hospital",
    place: "Thanjavur District",
    district: "Thanjavur District",
    designation: "Cardiologist",
    specialization: "cardiology",
    availabilitySlots: ["Morning", "Afternoon"],
    city: "Thanjavur District",
    phone: ""
  },
  {
    id: "d013",
    userId: "d013",
    doctorCode: "D013",
    name: "Dr. M. S. Rubini",
    hospitalName: "A to Z Speciality Hospital",
    place: "Thanjavur District",
    district: "Thanjavur District",
    designation: "Pediatrician",
    specialization: "pediatrics",
    availabilitySlots: ["Morning", "Afternoon"],
    city: "Thanjavur District",
    phone: ""
  },
  {
    id: "d014",
    userId: "d014",
    doctorCode: "D014",
    name: "Dr. K. Saranyadevi",
    hospitalName: "A to Z Speciality Hospital",
    place: "Thanjavur District",
    district: "Thanjavur District",
    designation: "Obstetrics & Gynaecology",
    specialization: "general",
    availabilitySlots: ["Morning", "Afternoon"],
    city: "Thanjavur District",
    phone: ""
  }
];

export const assignUserRole = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Login required.");
  }

  const role = request.data?.role as "patient" | "doctor" | "pharmacy";
  const displayName = String(request.data?.displayName ?? "").trim();
  const phone = String(request.data?.phone ?? "").trim();
  const specialization = String(request.data?.specialization ?? "general").trim();
  const hospitalName = String(request.data?.hospitalName ?? "Apollo Hospital Chennai").trim();
  const district = String(request.data?.district ?? "Chennai District").trim();
  const village = String(request.data?.village ?? "").trim();
  const age = Number(request.data?.age ?? 0);
  const gender = String(request.data?.gender ?? "other") as "male" | "female" | "other";

  if (!["patient", "doctor", "pharmacy"].includes(role)) {
    throw new HttpsError("invalid-argument", "Invalid role.");
  }

  if (!displayName || !phone) {
    throw new HttpsError("invalid-argument", "Display name and phone are required.");
  }

  const uid = request.auth.uid;
  await admin.auth().setCustomUserClaims(uid, { role });

  await db.collection("users").doc(uid).set(
    {
      uid,
      role,
      displayName,
      phone,
      email: request.auth.token.email ?? ""
    },
    { merge: true }
  );

  if (role === "patient") {
    const resolvedDistrict = district || village || "Unknown District";
    await db.collection("patients").doc(uid).set(
      {
        userId: uid,
        name: displayName,
        age: age > 0 ? age : 25,
        gender,
        district: resolvedDistrict,
        village: village || resolvedDistrict,
        phone,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      },
      { merge: true }
    );
  }

  if (role === "doctor") {
    const designation =
      specialization === "cardiology"
        ? "Cardiologist"
        : specialization === "pediatrics"
          ? "Pediatrician"
          : "General Physician";

    await db.collection("doctors").doc(uid).set(
      {
        userId: uid,
        doctorCode: `D${uid.slice(-4).toUpperCase()}`,
        name: displayName,
        hospitalName,
        place: district,
        district,
        designation,
        specialization,
        availabilitySlots: ["09:00", "11:00", "15:00"],
        city: district,
        phone,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      },
      { merge: true }
    );
  }

  return { success: true };
});

export const seedChennaiDoctors = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Login required.");
  }

  for (const doctor of hospitalSeedDoctors) {
    await db.collection("doctors").doc(doctor.id).set(
      {
        ...doctor,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      },
      { merge: true }
    );
  }

  return { seeded: hospitalSeedDoctors.length };
});

export const sendPrescriptionSMSNow = onCall(
  {},
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Login required.");
    }

    const patientPhone = String(request.data?.patientPhone ?? "").trim();
    const requestId = String(request.data?.requestId ?? "manual").trim();
    const doctorName = String(request.data?.doctorName ?? "Doctor").trim() || "Doctor";
    const medicines = Array.isArray(request.data?.medicines)
      ? (request.data?.medicines as string[])
      : [];
    const dosageInstructions = Array.isArray(request.data?.dosageInstructions)
      ? (request.data?.dosageInstructions as string[])
      : [];
    const reviewAfterDays = Number(request.data?.reviewAfterDays ?? 3);
    const customMessage = String(request.data?.customMessage ?? "").trim();

    if (!patientPhone) {
      throw new HttpsError("invalid-argument", "Patient phone is required.");
    }

    const normalizedPhone = normalizePhoneForSms(patientPhone);
    const medicinesLine = medicines
      .slice(0, 4)
      .map((medicine, index) => `${medicine} - ${dosageInstructions[index] ?? "As advised"}`)
      .join("\n");
    const body = customMessage || [
      "Civil Hospital PHC:",
      "Prescription:",
      medicinesLine || `Dr. ${doctorName} created your prescription.`,
      `Review after ${Number.isFinite(reviewAfterDays) && reviewAfterDays > 0 ? reviewAfterDays : 3} days.`,
      "If symptoms worsen, visit hospital immediately."
    ].join("\n");

    try {
      const message = await sendTextbeltSMS(normalizedPhone, body);

      await db.collection("sms_logs").add({
        type: "prescription_created",
        requestId,
        to: normalizedPhone,
        body,
        provider: "smsmobileapi",
        messageId: message.textId,
        status: message.status,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });

      return {
        success: true,
        to: normalizedPhone,
        messageId: message.textId,
        status: message.status
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown SMS error";
      await db.collection("sms_logs").add({
        type: "prescription_created",
        requestId,
        to: normalizedPhone,
        body,
        status: "failed",
        error: errorMessage,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });
      throw new HttpsError("internal", `SMSMobile send failed: ${errorMessage}`);
    }
  }
);

export const sendSMSOnPharmacyUpdate = onDocumentUpdated(
  {
    document: "pharmacy_requests/{requestId}"
  },
  async (event) => {
    const before = event.data?.before.data() as { smsStatus?: string } | undefined;
    const after = event.data?.after.data() as { smsStatus?: string; patientPhone?: string; doctorName?: string } | undefined;

    if (!after?.patientPhone || before?.smsStatus === after.smsStatus) {
      return;
    }

    const requestId = event.params.requestId;
    const normalizedPhone = normalizePhoneForSms(after.patientPhone);
    const doctorName = after.doctorName?.trim() || "Doctor";

    let body = "";
    if (after.smsStatus === "available") {
      body = `Dr. ${doctorName}: Your medicines are Available`;
    } else if (after.smsStatus === "not_available") {
      body = `Dr. ${doctorName}: Your medicines are Not Available`;
    } else {
      return;
    }

    try {
      const message = await sendTextbeltSMS(normalizedPhone, body);

      await db.collection("sms_logs").add({
        type: "pharmacy_status_update",
        requestId,
        to: normalizedPhone,
        body,
        provider: "textbelt",
        messageId: message.textId,
        status: message.status,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });
    } catch (error) {
      await db.collection("sms_logs").add({
        type: "pharmacy_status_update",
        requestId,
        to: normalizedPhone,
        body,
        status: "failed",
        error: error instanceof Error ? error.message : "Unknown SMS error",
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });
      throw error;
    }
  }
);

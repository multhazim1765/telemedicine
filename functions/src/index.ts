import * as admin from "firebase-admin";
import { onDocumentUpdated } from "firebase-functions/v2/firestore";
import { onCall, HttpsError, onRequest } from "firebase-functions/v2/https";

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

const sendSmsMobileSMS = async (phone: string, message: string): Promise<{ textId: string; status: string }> => {
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

type SmsMobileRequestLike = {
  body?: unknown;
  query?: Record<string, unknown>;
  rawBody?: Buffer;
  headers?: Record<string, unknown>;
};

const getRawBodyParams = (request: SmsMobileRequestLike): URLSearchParams | null => {
  const rawBody = request.rawBody?.toString("utf8") ?? "";
  if (!rawBody) {
    return null;
  }
  return new URLSearchParams(rawBody);
};

const getInboundField = (request: SmsMobileRequestLike, key: string): string => {
  const body = request.body;
  if (body && typeof body === "object" && !Array.isArray(body)) {
    const value = (body as Record<string, unknown>)[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  const rawParams = getRawBodyParams(request);
  const rawValue = rawParams?.get(key);
  if (rawValue?.trim()) {
    return rawValue.trim();
  }

  const queryValue = request.query?.[key];
  if (typeof queryValue === "string" && queryValue.trim()) {
    return queryValue.trim();
  }

  return "";
};

const getInboundFieldAny = (request: SmsMobileRequestLike, keys: string[]): string => {
  for (const key of keys) {
    const value = getInboundField(request, key);
    if (value) {
      return value;
    }
  }
  return "";
};

const resolveInboundMessageId = (request: SmsMobileRequestLike, from: string): string => {
  const explicitId = getInboundFieldAny(request, [
    "id",
    "message_id",
    "messageId",
    "sms_id",
    "sid",
    "MessageSid",
    "MessageId",
    "Sid"
  ]);

  if (explicitId) {
    return explicitId;
  }

  const phoneKey = toPhoneDigits(from).slice(-10) || "unknown";
  return `smsm-${Date.now()}-${phoneKey}`;
};

const appointmentDateIst = (): string =>
  new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });

const resolveSlotByIstTime = (currentDate = new Date()): "Morning" | "Afternoon" | "Evening" => {
  const istHour = Number(
    currentDate.toLocaleString("en-US", {
      hour: "numeric",
      hour12: false,
      timeZone: "Asia/Kolkata"
    })
  );

  if (istHour >= 6 && istHour < 9) {
    return "Morning";
  }
  if (istHour >= 9 && istHour < 12) {
    return "Afternoon";
  }
  if (istHour >= 12 && istHour < 15) {
    return "Evening";
  }

  // Outside configured ranges, keep deterministic fallback order.
  if (istHour < 6) {
    return "Morning";
  }
  return "Evening";
};

const toPhoneDigits = (value: string): string => value.replace(/\D/g, "");

const parseSmsBookingCommand = (rawText: string): string => {
  const text = String(rawText ?? "").trim();
  if (!text) {
    return "";
  }

  // Supports: BOOK3812, BOOK 3812, BOOK(3812), plain 3812
  const bookingMatch = text.match(/book\s*\(?\s*(\d{2,8})\s*\)?/i);
  if (bookingMatch?.[1]) {
    return bookingMatch[1];
  }

  const anyDigits = toPhoneDigits(text);
  return anyDigits;
};

const decodeBasicAuth = (authorizationHeader: string): { username: string; password: string } | null => {
  const [scheme, encoded] = authorizationHeader.split(" ");
  if (!scheme || !encoded || scheme.toLowerCase() !== "basic") {
    return null;
  }

  try {
    const decoded = Buffer.from(encoded, "base64").toString("utf8");
    const separatorIndex = decoded.indexOf(":");
    if (separatorIndex < 0) {
      return null;
    }
    return {
      username: decoded.slice(0, separatorIndex),
      password: decoded.slice(separatorIndex + 1)
    };
  } catch {
    return null;
  }
};

export const smsMobileInboundWebhook = onRequest(async (request, response) => {
  response.set("Cache-Control", "no-store");

  if (request.method !== "POST" && request.method !== "GET") {
    response.status(405).json({ success: false, error: "Method not allowed" });
    return;
  }

  const configuredToken = process.env.SMS_MOBILE_WEBHOOK_TOKEN?.trim() ?? "";
  const configuredApiKey = process.env.SMS_MOBILE_INBOUND_API_KEY?.trim() ?? "";
  const configuredApiToken = process.env.SMS_MOBILE_INBOUND_API_TOKEN?.trim() ?? "";
  const incomingApiKey =
    getInboundFieldAny(request, ["apikey", "api_key", "apiKey"]) ||
    String(request.headers["x-api-key"] ?? "").trim();
  const incomingToken =
    getInboundFieldAny(request, ["token", "webhook_token", "auth_token"]) ||
    String(request.headers["x-smsmobile-token"] ?? request.headers["x-webhook-token"] ?? "").trim();

  const authHeader = String(request.headers["authorization"] ?? "").trim();
  const basicAuth = authHeader ? decodeBasicAuth(authHeader) : null;
  const hasConfiguredBasicAuth = Boolean(configuredApiKey && configuredApiToken);

  if (
    hasConfiguredBasicAuth &&
    (!basicAuth || basicAuth.username !== configuredApiKey || basicAuth.password !== configuredApiToken)
  ) {
    response.status(403).json({ success: false, error: "Unauthorized SMS Mobile API credentials" });
    return;
  }

  if (configuredToken && incomingToken !== configuredToken) {
    response.status(403).json({ success: false, error: "Unauthorized webhook token" });
    return;
  }

  if (configuredApiKey && incomingApiKey && incomingApiKey !== configuredApiKey) {
    response.status(403).json({ success: false, error: "Unauthorized SMS Mobile API key" });
    return;
  }

  const from = getInboundFieldAny(request, ["from", "sender", "phone", "msisdn", "From", "Sender", "FromNumber"]);
  const inboundSmsMessageId = resolveInboundMessageId(request, from);
  const smsText = getInboundFieldAny(request, ["message", "body", "text", "Body", "Text"]);
  const parsedCommand = parseSmsBookingCommand(smsText);
  const messageStatus = getInboundFieldAny(request, ["status", "sms_status", "SmsStatus", "Status"]) || "received";

  if (!from) {
    response.status(400).json({ success: false, error: "Missing sender phone" });
    return;
  }

  if (!parsedCommand) {
    await db.collection("sms_bookings").doc(inboundSmsMessageId).set(
      {
        smsMessageId: inboundSmsMessageId,
        senderPhone: from,
        normalizedSenderPhone: normalizePhoneForSms(from),
        parsedCommand: "",
        smsText,
        messageStatus,
        status: "failed",
        failureReason: "Invalid SMS command. Use format BOOK<doctor_ivr_number>",
        smsStatus: "not_sent",
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      },
      { merge: true }
    );
    response.status(200).json({ success: false, status: "failed", reason: "Invalid command" });
    return;
  }

  const normalizedPhone = normalizePhoneForSms(from);
  const smsRef = db.collection("sms_bookings").doc(inboundSmsMessageId);
  const existingSms = await smsRef.get();
  const existingData = existingSms.data() as { appointmentId?: string } | undefined;

  if (existingData?.appointmentId) {
    response.status(200).json({ success: true, status: "duplicate", smsMessageId: inboundSmsMessageId, appointmentId: existingData.appointmentId });
    return;
  }

  const menuSnapshot = await db.collection("ivr_menu_config").doc("active").get();
  const menuData = menuSnapshot.data() as {
    menuVersion?: number;
    defaultHospitalName?: string;
    mappings?: Array<{ digit?: string; hospitalName?: string; doctorId?: string; doctorName?: string; priority?: number; active?: boolean }>;
  } | undefined;

  const selectedMapping = (menuData?.mappings ?? [])
    .filter((entry) => toPhoneDigits(String(entry.digit ?? "").trim()) === parsedCommand && entry.active !== false)
    .sort((a, b) => (a.priority ?? Number.MAX_SAFE_INTEGER) - (b.priority ?? Number.MAX_SAFE_INTEGER))[0];
  const selectedHospitalName =
    selectedMapping?.hospitalName?.trim() ||
    menuData?.defaultHospitalName?.trim() ||
    process.env.SMS_MOBILE_DEFAULT_HOSPITAL?.trim() ||
    "";
  const selectedDoctorId = selectedMapping?.doctorId?.trim() || "";

  if (!selectedHospitalName) {
    await smsRef.set(
      {
        smsMessageId: inboundSmsMessageId,
        senderPhone: from,
        normalizedSenderPhone: normalizedPhone,
        parsedCommand,
        smsText,
        messageStatus,
        status: "failed",
        failureReason: "No SMS command mapping/default hospital found",
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      },
      { merge: true }
    );
    response.status(200).json({ success: false, status: "failed", reason: "No hospital mapping" });
    return;
  }

  const patientsByExactPhone = await db.collection("patients").where("phone", "==", normalizedPhone).limit(1).get();
  let patientDoc: FirebaseFirestore.QueryDocumentSnapshot<FirebaseFirestore.DocumentData> | undefined = patientsByExactPhone.docs[0];

  if (!patientDoc) {
    const normalizedDigits = toPhoneDigits(normalizedPhone);
    const patientSnapshot = await db.collection("patients").limit(400).get();
    patientDoc = patientSnapshot.docs.find((doc) => {
      const phone = String(doc.data().phone ?? "");
      const digitsOnly = toPhoneDigits(phone);
      return digitsOnly.endsWith(normalizedDigits.slice(-10));
    });
  }

  let patient = (patientDoc?.data() ?? {}) as {
    userId?: string;
    name?: string;
    phone?: string;
  };
  let resolvedPatientId = patient.userId ?? patientDoc?.id ?? "";

  if (!resolvedPatientId) {
    const phoneDigits = toPhoneDigits(normalizedPhone);
    const inferredPatientId = `sms-${phoneDigits.slice(-10) || Date.now().toString()}`;
    const inferredName = `SMS Patient ${phoneDigits.slice(-4) || "0000"}`;

    await db.collection("patients").doc(inferredPatientId).set(
      {
        id: inferredPatientId,
        userId: inferredPatientId,
        name: inferredName,
        age: 30,
        gender: "other",
        district: selectedHospitalName,
        village: selectedHospitalName,
        phone: normalizedPhone,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      },
      { merge: true }
    );

    patient = {
      userId: inferredPatientId,
      name: inferredName,
      phone: normalizedPhone
    };
    resolvedPatientId = inferredPatientId;
  }

  let doctorDoc: FirebaseFirestore.QueryDocumentSnapshot<FirebaseFirestore.DocumentData> | undefined;

  if (selectedDoctorId) {
    const doctorByIdSnapshot = await db.collection("doctors").where("id", "==", selectedDoctorId).limit(1).get();
    doctorDoc = doctorByIdSnapshot.docs[0];
  }

  if (!doctorDoc) {
    const doctorsSnapshot = await db.collection("doctors").where("hospitalName", "==", selectedHospitalName).limit(100).get();
    const byCommand = doctorsSnapshot.docs.find((entry) => {
      const data = entry.data() as { doctorCode?: string; id?: string; ivrDigit?: string };
      const codeDigits = toPhoneDigits(String(data.doctorCode ?? data.id ?? ""));
      const ivrDigits = toPhoneDigits(String(data.ivrDigit ?? ""));
      return codeDigits === parsedCommand || ivrDigits === parsedCommand;
    });
    doctorDoc = byCommand ?? doctorsSnapshot.docs[0];
  }

  if (!doctorDoc) {
    await smsRef.set(
      {
        smsMessageId: inboundSmsMessageId,
        senderPhone: from,
        normalizedSenderPhone: normalizedPhone,
        parsedCommand,
        smsText,
        selectedHospitalName,
        patientId: resolvedPatientId,
        patientName: patient.name ?? "Unknown Patient",
        menuVersion: menuData?.menuVersion ?? 1,
        messageStatus,
        status: "failed",
        failureReason: "No doctor found for selected hospital",
        smsStatus: "not_sent",
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      },
      { merge: true }
    );
    response.status(200).json({ success: false, status: "failed", reason: "No doctor available" });
    return;
  }

  const doctor = doctorDoc.data() as {
    id?: string;
    name?: string;
    specialization?: string;
    availabilitySlots?: string[];
  };
  const resolvedDoctorId = String(doctor.id ?? "").trim() || doctorDoc.id;

  const timeWindowSlot = resolveSlotByIstTime();
  const selectedSlot = Array.isArray(doctor.availabilitySlots)
    ? doctor.availabilitySlots.find((slot) => slot.trim().toLowerCase() === timeWindowSlot.toLowerCase()) ?? timeWindowSlot
    : timeWindowSlot;
  const appointmentDate = appointmentDateIst();

  const existingSlotAppointments = await db
    .collection("appointments")
    .where("doctorId", "==", resolvedDoctorId)
    .where("appointmentDate", "==", appointmentDate)
    .where("slot", "==", selectedSlot)
    .where("status", "==", "booked")
    .get();
  const tokenNumber = existingSlotAppointments.size + 1;

  const triageRef = await db.collection("triage_sessions").add({
    patientId: resolvedPatientId,
    patientName: patient.name ?? "Unknown Patient",
    patientPhone: patient.phone ?? normalizedPhone,
    symptoms: ["sms booking"],
    result: {
      severityScore: 2,
      severityLevel: "low",
      recommendedAction: "Routine teleconsultation"
    },
    preferredSpecialization: doctor.specialization ?? "general",
    assignedDoctorId: doctorDoc.id,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  });

  const appointmentRef = await db.collection("appointments").add({
    patientId: resolvedPatientId,
    patientName: patient.name ?? "Unknown Patient",
    patientPhone: patient.phone ?? normalizedPhone,
    triageSessionId: triageRef.id,
    doctorId: resolvedDoctorId,
    doctorName: doctor.name ?? "Doctor",
    specialization: doctor.specialization ?? "general",
    slot: selectedSlot,
    appointmentDate,
    tokenNumber,
    status: "booked",
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  });

  const confirmationSms = [
    "Civil Hospital PHC:",
    `Appointment booked at ${selectedHospitalName}.`,
    `Doctor: ${doctor.name ?? "Doctor"}`,
    `Date: ${appointmentDate}`,
    `Slot: ${selectedSlot}`,
    `Token: #${tokenNumber}`,
    "Please arrive 10 minutes early."
  ].join("\n");

  let smsStatus: "queued" | "failed" | "not_sent" = "not_sent";
  let outboundSmsMessageId = "";
  let smsError = "";

  try {
    const smsResult = await sendSmsMobileSMS(normalizedPhone, confirmationSms);
    smsStatus = "queued";
    outboundSmsMessageId = smsResult.textId;
  } catch (error) {
    smsStatus = "failed";
    smsError = error instanceof Error ? error.message : "Unknown SMS error";
  }

  await smsRef.set(
    {
      smsMessageId: inboundSmsMessageId,
      senderPhone: from,
      normalizedSenderPhone: normalizedPhone,
      parsedCommand,
      smsText,
      messageStatus,
      selectedHospitalName,
      menuVersion: menuData?.menuVersion ?? 1,
      patientId: resolvedPatientId,
      patientName: patient.name ?? "Unknown Patient",
      doctorId: resolvedDoctorId,
      doctorName: doctor.name ?? "Doctor",
      slot: selectedSlot,
      appointmentDate,
      tokenNumber,
      triageSessionId: triageRef.id,
      appointmentId: appointmentRef.id,
      status: "booked",
      smsStatus,
      smsDeliveryMessageId: outboundSmsMessageId,
      smsError,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    },
    { merge: true }
  );

  response.status(200).json({
    success: true,
    smsMessageId: inboundSmsMessageId,
    smsDeliveryMessageId: outboundSmsMessageId,
    appointmentId: appointmentRef.id,
    triageSessionId: triageRef.id,
    tokenNumber,
    smsStatus
  });
});

const hospitalSeedDoctors = [
  {
    id: "d001",
    userId: "d001",
    doctorCode: "D001",
    name: "Dr. ABDUL ADHIL T",
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
    name: "Dr. ABDUL MALIK B J",
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
    name: "Dr. ABU AASEEM K",
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
    name: "Dr. ADHRA K M",
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
    name: "Dr. AFRAA K S",
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
    name: "Dr. AHAMED MULTHAZIM A",
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
    name: "Dr. AKHIL HUSSAIN A",
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
    name: "Dr. ASIL JAMESHA T",
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
    name: "Dr. ATHIFA FAREEZA A",
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
    name: "Dr. DELLI GANESH J",
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
    name: "Dr. DIVYA K",
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
    name: "Dr. FAHEEN ASHAR N",
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
    name: "Dr. GOPINATHAN S",
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
    name: "Dr. GOWTHAM T",
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
      const message = await sendSmsMobileSMS(normalizedPhone, body);

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
      const message = await sendSmsMobileSMS(normalizedPhone, body);

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

import { Doctor } from "../types/models";
import doctorsDataset from "./doctors.json";
import hospitals from "./hospitals.json";

const slots = ["Morning", "Afternoon"];

interface DatasetDoctor {
  hospital: string;
  doctorName: string;
  id: string;
  place: string;
  designation: string;
}

interface HospitalRecord {
  hospitalName: string;
  district: string;
}

const specializationFromDesignation = (designation: string): string => {
  const lower = designation.toLowerCase();
  if (lower.includes("cardio")) {
    return "cardiology";
  }
  if (lower.includes("pedia")) {
    return "pediatrics";
  }
  return "general";
};

export const hospitalDoctors: Doctor[] = (doctorsDataset as DatasetDoctor[]).map((doctor) => ({
  id: doctor.id.toLowerCase(),
  userId: doctor.id.toLowerCase(),
  doctorCode: doctor.id,
  name: doctor.doctorName,
  hospitalName: doctor.hospital,
  place: doctor.place,
  district: doctor.place,
  designation: doctor.designation,
  specialization: specializationFromDesignation(doctor.designation),
  availabilitySlots: slots,
  city: doctor.place,
  phone: ""
}));

export const hospitalNameToSlug = (hospitalName: string): string =>
  hospitalName
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

export const hospitalLoginAccounts = (hospitals as HospitalRecord[]).map((hospital, index) => {
  const slug = hospitalNameToSlug(hospital.hospitalName);
  return {
    uid: `hospital-${slug}`,
    email: `${slug}@hospital.local`,
    password: "am9790",
    role: "doctor" as const,
    displayName: hospital.hospitalName,
    hospitalName: hospital.hospitalName,
    district: hospital.district,
    phone: `+9100002${String(index + 1).padStart(5, "0")}`
  };
});

export const hospitalSlugToName = (hospitalSlug: string): string | undefined => {
  const normalized = hospitalSlug.trim().toLowerCase();
  const match = hospitalLoginAccounts.find(
    (account) => hospitalNameToSlug(account.hospitalName ?? "") === normalized
  );
  return match?.hospitalName;
};

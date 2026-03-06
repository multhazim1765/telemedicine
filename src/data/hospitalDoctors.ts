import { Doctor } from "../types/models";

const slots = ["Morning", "Afternoon"];

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

const doctor = (
  doctorCode: string,
  name: string,
  hospitalName: string,
  place: string,
  designation: string
): Doctor => ({
  id: doctorCode.toLowerCase(),
  userId: doctorCode.toLowerCase(),
  doctorCode,
  name,
  hospitalName,
  place,
  district: place,
  designation,
  specialization: specializationFromDesignation(designation),
  availabilitySlots: slots,
  city: place,
  phone: ""
});

export const hospitalDoctors: Doctor[] = [
  doctor("D001", "Dr. Ashok Kumar", "Shifa Hospital", "Thanjavur District", "Physician"),
  doctor("D002", "Dr. Ghulam Mohideen", "Shifa Hospital", "Thanjavur District", "Physician"),
  doctor("D003", "Dr. K. Muthu Selvan", "Shifa Hospital", "Thanjavur District", "Physician"),
  doctor("D004", "Dr. Geetha Saravanan", "Shifa Hospital", "Thanjavur District", "Physician"),
  doctor("D005", "Dr. Mohamed Shafi Abdulla", "Shifa Hospital", "Thanjavur District", "General Physician"),
  doctor("D006", "Dr. Prasanna P", "Meenakshi Hospital", "Thanjavur District", "Gastroenterologist"),
  doctor("D007", "Dr. R. V. Shivakumar", "Meenakshi Hospital", "Thanjavur District", "Cardiologist"),
  doctor("D008", "Dr. Shivkumar Rathinam Venkatesan", "Meenakshi Hospital", "Thanjavur District", "Cardiologist"),
  doctor("D009", "Dr. Sasikumar Sambasivam", "Meenakshi Hospital", "Thanjavur District", "Oncologist"),
  doctor("D010", "Dr. R. Anbarasu", "A to Z Speciality Hospital", "Thanjavur District", "General Medicine"),
  doctor("D011", "Dr. S. Balaji Prathep", "A to Z Speciality Hospital", "Thanjavur District", "Brain & Spine Surgeon"),
  doctor("D012", "Dr. R. VijaiAnanth", "A to Z Speciality Hospital", "Thanjavur District", "Cardiologist"),
  doctor("D013", "Dr. M. S. Rubini", "A to Z Speciality Hospital", "Thanjavur District", "Pediatrician"),
  doctor("D014", "Dr. K. Saranyadevi", "A to Z Speciality Hospital", "Thanjavur District", "Obstetrics & Gynaecology")
];

export const hospitalLoginAccounts = [
  {
    uid: "hospital-shifa",
    email: "shifa@hospital.local",
    password: "Shifa@123",
    role: "doctor" as const,
    displayName: "Shifa Hospital",
    hospitalName: "Shifa Hospital",
    phone: "+910000200001"
  },
  {
    uid: "hospital-meenakshi",
    email: "meenakshi@hospital.local",
    password: "Meenakshi@123",
    role: "doctor" as const,
    displayName: "Meenakshi Hospital",
    hospitalName: "Meenakshi Hospital",
    phone: "+910000200002"
  },
  {
    uid: "hospital-atoz",
    email: "atoz@hospital.local",
    password: "AtoZ@123",
    role: "doctor" as const,
    displayName: "A to Z Speciality Hospital",
    hospitalName: "A to Z Speciality Hospital",
    phone: "+910000200003"
  }
];

export const hospitalNameToSlug = (hospitalName: string): string =>
  hospitalName
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

export const hospitalSlugToName = (hospitalSlug: string): string | undefined => {
  const normalized = hospitalSlug.trim().toLowerCase();
  const match = hospitalLoginAccounts.find(
    (account) => hospitalNameToSlug(account.hospitalName ?? "") === normalized
  );
  return match?.hospitalName;
};

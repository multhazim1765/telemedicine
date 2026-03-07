import { districts } from "../constants/districts";

export interface DemoPharmacyRecord {
  uid: string;
  email: string;
  password: string;
  displayName: string;
  pharmacyName: string;
  district: string;
  phone: string;
}

const toDistrictBaseName = (district: string): string => district.replace(/\s+District$/i, "").trim();

const toSlug = (value: string): string =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

export const demoPharmacies: DemoPharmacyRecord[] = districts.map((district, index) => {
  const districtBaseName = toDistrictBaseName(district);
  const districtSlug = toSlug(districtBaseName);
  const sequence = String(index + 1).padStart(2, "0");

  return {
    uid: `demo-pharmacy-${sequence}`,
    email: `${districtSlug}-pharmacy@demo.local`,
    password: "am9790",
    displayName: `${districtBaseName} Pharmacy Desk`,
    pharmacyName: `${districtBaseName} Community Pharmacy`,
    district,
    phone: `+91000000${String(index + 1).padStart(3, "0")}`
  };
});
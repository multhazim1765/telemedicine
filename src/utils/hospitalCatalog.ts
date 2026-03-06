import hospitals from "../data/hospitals.json";
import { HospitalCatalog } from "../types/models";

export const createHospitalCatalogId = (hospitalName: string, district: string): string => {
  const normalizedHospital = hospitalName.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  const normalizedDistrict = district.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return `${normalizedDistrict}__${normalizedHospital}`;
};

export const defaultHospitalCatalog: HospitalCatalog[] = (hospitals as Array<{ hospitalName: string; district: string }>)
  .map((entry) => ({
    id: createHospitalCatalogId(entry.hospitalName, entry.district),
    hospitalName: entry.hospitalName,
    district: entry.district
  }))
  .sort((a, b) => {
    const districtOrder = a.district.localeCompare(b.district);
    if (districtOrder !== 0) {
      return districtOrder;
    }
    return a.hospitalName.localeCompare(b.hospitalName);
  });

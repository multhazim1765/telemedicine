import { useEffect, useMemo, useRef, useState } from "react";
import { setDocumentById, subscribeCollection } from "../services/firestoreService";
import { isFirebaseConfigured } from "../services/firebase";
import { HospitalCatalog } from "../types/models";
import { defaultHospitalCatalog } from "../utils/hospitalCatalog";

export const useHospitalCatalog = (): HospitalCatalog[] => {
  const [catalog, setCatalog] = useState<HospitalCatalog[]>([]);
  const seededRef = useRef(false);

  useEffect(() => {
    const unsub = subscribeCollection("hospital_catalog", setCatalog);
    return unsub;
  }, []);

  useEffect(() => {
    if (seededRef.current || isFirebaseConfigured || catalog.length > 0) {
      return;
    }

    seededRef.current = true;
    const seed = async () => {
      await Promise.all(
        defaultHospitalCatalog.map((entry) =>
          setDocumentById("hospital_catalog", entry.id, {
            id: entry.id,
            hospitalName: entry.hospitalName,
            district: entry.district
          })
        )
      );
    };

    void seed();
  }, [catalog]);

  return useMemo(() => {
    const source = catalog.length > 0 ? catalog : defaultHospitalCatalog;
    return [...source].sort((a, b) => {
      const districtOrder = a.district.localeCompare(b.district);
      if (districtOrder !== 0) {
        return districtOrder;
      }
      return a.hospitalName.localeCompare(b.hospitalName);
    });
  }, [catalog]);
};

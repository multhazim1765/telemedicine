import { useEffect, useState } from "react";
import { getBusinessDate, subscribeBusinessDate } from "../services/businessDateService";

export const useBusinessDate = () => {
  const [businessDate, setBusinessDate] = useState(getBusinessDate());

  useEffect(() => {
    return subscribeBusinessDate(setBusinessDate);
  }, []);

  return businessDate;
};

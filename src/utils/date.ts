import { getBusinessDate } from "../services/businessDateService";

export const nowIso = (): string => {
	const isoNow = new Date().toISOString();
	const businessDate = getBusinessDate();
	return `${businessDate}${isoNow.slice(10)}`;
};

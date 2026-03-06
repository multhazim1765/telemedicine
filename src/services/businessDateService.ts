const BUSINESS_DATE_KEY = "telehealth-business-date";
const BUSINESS_DATE_EVENT = "telehealth-business-date-changed";

const isoDate = (date: Date): string => date.toISOString().slice(0, 10);

const isValidIsoDate = (value: string): boolean => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && isoDate(parsed) === value;
};

const emitBusinessDateChanged = () => {
  window.dispatchEvent(new Event(BUSINESS_DATE_EVENT));
};

export const getSystemDate = (): string => isoDate(new Date());

export const getBusinessDate = (): string => {
  const stored = localStorage.getItem(BUSINESS_DATE_KEY);
  if (!stored || !isValidIsoDate(stored)) {
    return getSystemDate();
  }
  return stored;
};

export const setBusinessDate = (dateText: string): string => {
  if (!isValidIsoDate(dateText)) {
    throw new Error("Invalid date format. Use YYYY-MM-DD.");
  }

  localStorage.setItem(BUSINESS_DATE_KEY, dateText);
  emitBusinessDateChanged();
  return dateText;
};

export const moveBusinessDateByDays = (days: number): string => {
  const current = getBusinessDate();
  const base = new Date(`${current}T00:00:00.000Z`);
  base.setUTCDate(base.getUTCDate() + days);
  const next = isoDate(base);
  return setBusinessDate(next);
};

export const resetBusinessDateToSystem = (): string => {
  const today = getSystemDate();
  localStorage.removeItem(BUSINESS_DATE_KEY);
  emitBusinessDateChanged();
  return today;
};

export const subscribeBusinessDate = (callback: (value: string) => void): (() => void) => {
  const run = () => callback(getBusinessDate());
  run();

  const onStorage = (event: StorageEvent) => {
    if (event.key === BUSINESS_DATE_KEY) {
      run();
    }
  };

  window.addEventListener(BUSINESS_DATE_EVENT, run);
  window.addEventListener("storage", onStorage);

  return () => {
    window.removeEventListener(BUSINESS_DATE_EVENT, run);
    window.removeEventListener("storage", onStorage);
  };
};

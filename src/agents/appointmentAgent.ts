import { Doctor } from "../types/models";

interface AppointmentInput {
  specialization: string;
  doctors: Doctor[];
}

export const appointmentAgent = ({ specialization, doctors }: AppointmentInput): Doctor | null => {
  const filtered = doctors
    .filter((doctor) => doctor.specialization.toLowerCase() === specialization.toLowerCase())
    .sort((a, b) => b.availabilitySlots.length - a.availabilitySlots.length);

  if (filtered.length > 0) {
    return filtered[0];
  }

  const fallback = [...doctors].sort((a, b) => b.availabilitySlots.length - a.availabilitySlots.length);
  return fallback[0] ?? null;
};

import { describe, expect, it } from "vitest";
import { appointmentAgent } from "./appointmentAgent";

describe("appointmentAgent", () => {
  it("returns matched specialist", () => {
    const doctor = appointmentAgent({
      specialization: "cardiology",
      doctors: [
        {
          id: "1",
          userId: "u1",
          doctorCode: "D101",
          name: "A",
          hospitalName: "Test Hospital",
          place: "Thanjavur District",
          district: "Test District",
          designation: "General Physician",
          specialization: "general",
          availabilitySlots: ["10:00"]
        },
        {
          id: "2",
          userId: "u2",
          doctorCode: "D102",
          name: "B",
          hospitalName: "Test Hospital",
          place: "Thanjavur District",
          district: "Test District",
          designation: "Cardiologist",
          specialization: "cardiology",
          availabilitySlots: ["11:00"]
        }
      ]
    });

    expect(doctor?.id).toBe("2");
  });
});

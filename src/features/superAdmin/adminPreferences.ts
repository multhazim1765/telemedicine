const ADMIN_PREFERENCES_KEY = "telehealth-admin-preferences";

export interface AdminPreferences {
  maintenanceMode: boolean;
  supportEmail: string;
  disabledHospitals: Record<string, boolean>;
}

const defaultPreferences: AdminPreferences = {
  maintenanceMode: false,
  supportEmail: "support@telehealth.local",
  disabledHospitals: {}
};

export const loadAdminPreferences = (): AdminPreferences => {
  const raw = localStorage.getItem(ADMIN_PREFERENCES_KEY);
  if (!raw) {
    return defaultPreferences;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<AdminPreferences>;
    return {
      maintenanceMode: Boolean(parsed.maintenanceMode),
      supportEmail: typeof parsed.supportEmail === "string" && parsed.supportEmail.trim()
        ? parsed.supportEmail
        : defaultPreferences.supportEmail,
      disabledHospitals: parsed.disabledHospitals ?? {}
    };
  } catch {
    return defaultPreferences;
  }
};

export const saveAdminPreferences = (preferences: AdminPreferences): void => {
  localStorage.setItem(ADMIN_PREFERENCES_KEY, JSON.stringify(preferences));
};
import { FormEvent, ReactNode, Suspense, lazy, useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Link, Navigate, Route, Routes, useLocation, useNavigate, useParams } from "react-router-dom";
import { RoleRoute } from "./components/routes/RoleRoute";
import { getDemoCredentials, getPatientHospitalLoginPassword, loginWithEmail, signUpWithPhone } from "./services/authService";
import { isFirebaseConfigured } from "./services/firebase";
import { UserRole } from "./types/models";
import { useAuth } from "./hooks/useAuth";
import { hospitalNameToSlug } from "./data/hospitalDoctors";
import { pageTransition } from "./utils/animations";
import { ToastProvider } from "./components/ui/ToastProvider";
import { MedicalSpinner } from "./components/ui/Feedback";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { useHospitalCatalog } from "./hooks/useHospitalCatalog";
import { districts } from "./constants/districts";

const PatientDashboard = lazy(() => import("./features/patient/PatientDashboard").then((module) => ({ default: module.PatientDashboard })));
const DoctorDashboard = lazy(() => import("./features/doctor/DoctorDashboard").then((module) => ({ default: module.DoctorDashboard })));
const PharmacyDashboard = lazy(() => import("./features/pharmacy/PharmacyDashboard").then((module) => ({ default: module.PharmacyDashboard })));
const SuperAdminLayout = lazy(() => import("./features/superAdmin/SuperAdminLayout").then((module) => ({ default: module.SuperAdminLayout })));
const SystemOverviewPage = lazy(() => import("./features/superAdmin/SystemOverviewPage").then((module) => ({ default: module.SystemOverviewPage })));
const UserManagementPage = lazy(() => import("./features/superAdmin/UserManagementPage").then((module) => ({ default: module.UserManagementPage })));
const PatientManagementPage = lazy(() => import("./features/superAdmin/PatientManagementPage").then((module) => ({ default: module.PatientManagementPage })));
const PharmacyManagementPage = lazy(() => import("./features/superAdmin/PharmacyManagementPage").then((module) => ({ default: module.PharmacyManagementPage })));
const LogsPage = lazy(() => import("./features/superAdmin/LogsPage").then((module) => ({ default: module.LogsPage })));
const SecurityPage = lazy(() => import("./features/superAdmin/SecurityPage").then((module) => ({ default: module.SecurityPage })));
const HospitalManagementPage = lazy(() => import("./features/superAdmin/HospitalManagementPage").then((module) => ({ default: module.HospitalManagementPage })));
const TriageRuleViewPage = lazy(() => import("./features/superAdmin/TriageRuleViewPage").then((module) => ({ default: module.TriageRuleViewPage })));
const MedicineDatabaseViewPage = lazy(() => import("./features/superAdmin/MedicineDatabaseViewPage").then((module) => ({ default: module.MedicineDatabaseViewPage })));
const SmsLogsViewPage = lazy(() => import("./features/superAdmin/SmsLogsViewPage").then((module) => ({ default: module.SmsLogsViewPage })));
const AnalyticsPage = lazy(() => import("./features/superAdmin/AnalyticsPage").then((module) => ({ default: module.AnalyticsPage })));
const SystemSettingsPage = lazy(() => import("./features/superAdmin/SystemSettingsPage").then((module) => ({ default: module.SystemSettingsPage })));
const SmsBookingDeskPage = lazy(() => import("./features/superAdmin/SmsBookingDeskPage").then((module) => ({ default: module.SmsBookingDeskPage })));

const dashboardPathByRole: Record<Exclude<UserRole, "doctor">, string> = {
  patient: "/patient",
  pharmacy: "/pharmacy",
  super_admin: "/super-admin"
};

const resolveDoctorDashboardPath = (hospitalName?: string): string => {
  if (!hospitalName) {
    return "/doctor";
  }
  return `/doctor/hospital/${hospitalNameToSlug(hospitalName)}`;
};

const resolveDashboardPath = (role: UserRole, hospitalName?: string): string => {
  if (role === "doctor") {
    return resolveDoctorDashboardPath(hospitalName);
  }
  return dashboardPathByRole[role];
};

const prettyRole = (role: UserRole): string => role.charAt(0).toUpperCase() + role.slice(1);

const RootRedirect = () => {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return <MedicalSpinner label="Preparing workspace" message="Loading your care dashboard" fullScreen />;
  }

  return <Navigate to={user ? resolveDashboardPath(user.role, user.hospitalName) : "/login"} replace />;
};

const AuthCard = ({ children, wide = false, panelClassName = "" }: { children: ReactNode; wide?: boolean; panelClassName?: string }) => (
  <main className={`mx-auto flex min-h-screen w-full items-center p-4 ${wide ? "max-w-7xl" : "max-w-md"}`}>
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className={`w-full rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200 ${panelClassName}`}
    >
      {children}
    </motion.section>
  </main>
);

const AuthMascot = ({ imageClassName = "auth-mascot-image" }: { imageClassName?: string }) => (
  <motion.div
    className="auth-mascot"
    initial={{ opacity: 0, y: 8 }}
    animate={{ opacity: 1, y: 0 }}
  >
    <motion.img
      src="/doctor-3d.svg"
      alt="Telemedicine mascot"
      className={imageClassName}
      animate={{ y: [0, -6, 0] }}
      transition={{ duration: 4.5, repeat: Infinity, ease: "easeInOut" }}
    />
  </motion.div>
);

const LoginPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { hospitalSlug } = useParams();
  const isSuperAdminLogin = location.pathname === "/login/super-admin";
  const hospitalCatalog = useHospitalCatalog();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [showResetHint, setShowResetHint] = useState(false);
  const [activeCategory, setActiveCategory] = useState<"patient" | "hospital" | "pharmacy">("patient");
  const [selectedDistrict, setSelectedDistrict] = useState("");
  const [selectedHospital, setSelectedHospital] = useState("");
  const [selectedDoctorUid, setSelectedDoctorUid] = useState("");
  const [selectedPharmacyDistrict, setSelectedPharmacyDistrict] = useState("");
  const [selectedPharmacyUid, setSelectedPharmacyUid] = useState("");
  const sharedPassword = getPatientHospitalLoginPassword();
  const requestedHospitalName = hospitalSlug
    ? hospitalCatalog.find((hospital) => hospitalNameToSlug(hospital.hospitalName) === hospitalSlug)?.hospitalName
    : undefined;

  const districtOptions = Array.from(new Set(hospitalCatalog.map((item) => item.district))).sort((a, b) => a.localeCompare(b));
  const hospitalsInDistrict = hospitalCatalog
    .filter((item) => !selectedDistrict || item.district === selectedDistrict)
    .sort((a, b) => a.hospitalName.localeCompare(b.hospitalName));

  useEffect(() => {
    if (requestedHospitalName) {
      setActiveCategory("hospital");
      const matched = hospitalCatalog.find((item) => item.hospitalName === requestedHospitalName);
      if (matched) {
        setSelectedDistrict(matched.district);
        setSelectedHospital(matched.hospitalName);
      }
      return;
    }

    if (!selectedDistrict && districtOptions.length > 0) {
      setSelectedDistrict(districtOptions[0]);
    }
  }, [requestedHospitalName, hospitalCatalog, districtOptions, selectedDistrict]);

  useEffect(() => {
    if (activeCategory !== "hospital") {
      return;
    }

    if (!selectedDistrict && districtOptions.length > 0) {
      setSelectedDistrict(districtOptions[0]);
      return;
    }

    if (!hospitalsInDistrict.some((item) => item.hospitalName === selectedHospital)) {
      setSelectedHospital(hospitalsInDistrict[0]?.hospitalName ?? "");
    }
  }, [activeCategory, districtOptions, hospitalsInDistrict, selectedDistrict, selectedHospital]);

  const demoCredentials = getDemoCredentials().filter((credential) => {
    if (activeCategory === "patient") {
      return credential.role === "patient";
    }

    if (activeCategory === "pharmacy") {
      return credential.role === "pharmacy";
    }

    if (requestedHospitalName) {
      return credential.role === "doctor" && credential.hospitalName === requestedHospitalName;
    }

    if (!selectedHospital) {
      return credential.role === "doctor";
    }

    return credential.role === "doctor" && credential.hospitalName === selectedHospital;
  });

  const pharmacyCredentials = getDemoCredentials()
    .filter((credential) => credential.role === "pharmacy" && credential.pharmacyName && credential.district)
    .sort((a, b) => {
      const districtOrder = (a.district ?? "").localeCompare(b.district ?? "");
      if (districtOrder !== 0) {
        return districtOrder;
      }
      return (a.pharmacyName ?? a.displayName).localeCompare(b.pharmacyName ?? b.displayName);
    });

  const pharmacyDistrictOptions = Array.from(
    new Set(pharmacyCredentials.map((credential) => credential.district).filter((district): district is string => Boolean(district)))
  );

  const pharmaciesInDistrict = pharmacyCredentials.filter(
    (credential) => !selectedPharmacyDistrict || credential.district === selectedPharmacyDistrict
  );

  useEffect(() => {
    if (activeCategory !== "pharmacy") {
      return;
    }

    if (!selectedPharmacyDistrict && pharmacyDistrictOptions.length > 0) {
      setSelectedPharmacyDistrict(pharmacyDistrictOptions[0]);
      return;
    }

    if (!pharmaciesInDistrict.some((pharmacy) => pharmacy.uid === selectedPharmacyUid)) {
      setSelectedPharmacyUid(pharmaciesInDistrict[0]?.uid ?? "");
    }
  }, [activeCategory, pharmaciesInDistrict, pharmacyDistrictOptions, selectedPharmacyDistrict, selectedPharmacyUid]);

  const filteredDoctorCredentials = (() => {
    const candidates = demoCredentials
      .filter((credential) => credential.role === "doctor" && /^d\d+$/i.test(credential.uid))
      .sort((a, b) => {
        const nameOrder = a.displayName.localeCompare(b.displayName);
        if (nameOrder !== 0) {
          return nameOrder;
        }
        return a.uid.localeCompare(b.uid);
      });

    const byName = new Map<string, (typeof candidates)[number]>();
    for (const doctor of candidates) {
      const key = `${(doctor.hospitalName ?? "").toLowerCase()}::${doctor.displayName.toLowerCase().replace(/[^a-z0-9]/g, "")}`;
      const existing = byName.get(key);
      if (!existing) {
        byName.set(key, doctor);
        continue;
      }

      // Keep the canonical-looking shorter UID when duplicate names exist.
      if (doctor.uid.length < existing.uid.length) {
        byName.set(key, doctor);
      }
    }

    return Array.from(byName.values());
  })();

  useEffect(() => {
    if (activeCategory !== "hospital") {
      return;
    }

    if (!filteredDoctorCredentials.some((doctor) => doctor.uid === selectedDoctorUid)) {
      setSelectedDoctorUid(filteredDoctorCredentials[0]?.uid ?? "");
    }
  }, [activeCategory, filteredDoctorCredentials, selectedDoctorUid]);

  const selectedDoctorCredential = filteredDoctorCredentials.find((doctor) => doctor.uid === selectedDoctorUid) ?? null;
  const selectedPharmacyCredential = pharmaciesInDistrict.find((pharmacy) => pharmacy.uid === selectedPharmacyUid) ?? null;

  const completeLogin = async (
    identifier: string,
    loginPassword: string,
    category: "patient" | "hospital" | "pharmacy" | "super_admin"
  ) => {
    const profile = await loginWithEmail(identifier, loginPassword);

    if (category === "super_admin") {
      if (profile.role !== "super_admin") {
        throw new Error("This page is for super admin login only.");
      }
      navigate(resolveDashboardPath(profile.role, profile.hospitalName));
      return;
    }

    if (category === "patient" && profile.role !== "patient") {
      throw new Error("This section is for patient login only.");
    }

    if (category === "pharmacy" && profile.role !== "pharmacy") {
      throw new Error("This section is for pharmacy login only.");
    }

    if (category === "hospital") {
      const expectedHospital = requestedHospitalName ?? selectedHospital;
      if (profile.role !== "doctor") {
        throw new Error("This section is for hospital login only.");
      }
      if (expectedHospital && profile.hospitalName && profile.hospitalName !== expectedHospital) {
        throw new Error(`Use the ${profile.hospitalName} login page for this account.`);
      }
      navigate(resolveDashboardPath(profile.role, expectedHospital ?? profile.hospitalName));
      return;
    }

    if (requestedHospitalName && profile.role !== "doctor") {
      throw new Error(`This page is only for ${requestedHospitalName} doctor login.`);
    }

    if (requestedHospitalName && profile.role === "doctor" && profile.hospitalName && profile.hospitalName !== requestedHospitalName) {
      throw new Error(`Use the ${profile.hospitalName} login page for this account.`);
    }

    navigate(resolveDashboardPath(profile.role, requestedHospitalName ?? profile.hospitalName));
  };

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    try {
      const loginCategory = isSuperAdminLogin ? "super_admin" : activeCategory;
      const loginIdentifier = !isSuperAdminLogin && activeCategory === "hospital"
        ? selectedDoctorCredential?.email ?? ""
        : !isSuperAdminLogin && activeCategory === "pharmacy"
          ? selectedPharmacyCredential?.email ?? ""
          : email;
      if (!loginIdentifier) {
        throw new Error(
          isSuperAdminLogin
            ? "Enter super admin email or phone."
            : activeCategory === "hospital"
              ? "Select a doctor to login."
              : activeCategory === "pharmacy"
                ? "Select a pharmacy to login."
                : "Enter patient login details."
        );
      }
      await completeLogin(loginIdentifier, password, loginCategory);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  return (
    <AuthCard wide panelClassName="login-auth-panel auth-stage-panel">
      <div className="login-shell">
        <section className="doctor-panel auth-mascot-stage">
          <AuthMascot imageClassName="auth-mascot-image auth-mascot-image-large" />
          {!isSuperAdminLogin && (
            <div className="doctor-panel-actions auth-mascot-actions">
              <Link className="tab-item inline-block" to="/login/super-admin">
                Super Admin Login
              </Link>
            </div>
          )}
        </section>

        <section className="tabs-panel">
          {!isSuperAdminLogin && (
            <div className="tab-header" role="tablist" aria-label="Login sections">
              <button type="button" role="tab" aria-selected={activeCategory === "patient"} className={`tab-button ${activeCategory === "patient" ? "active" : ""}`} onClick={() => setActiveCategory("patient")}>[PATIENT]</button>
              <button type="button" role="tab" aria-selected={activeCategory === "hospital"} className={`tab-button ${activeCategory === "hospital" ? "active" : ""}`} onClick={() => setActiveCategory("hospital")}>[HOSPITAL]</button>
              <button type="button" role="tab" aria-selected={activeCategory === "pharmacy"} className={`tab-button ${activeCategory === "pharmacy" ? "active" : ""}`} onClick={() => setActiveCategory("pharmacy")}>[PHARMACY]</button>
            </div>
          )}

          <div className="tab-content">
            {isSuperAdminLogin ? (
              <>
                <h1 className="login-title">Super Admin Login</h1>
                <p className="login-subtitle">Access system administration dashboard.</p>
                <p className="mt-1 text-xs text-slate-300">
                  Super admin username: <span className="font-semibold">am9790</span>. Password: <span className="font-semibold">am9790@@</span>
                </p>
                <div className="doctor-panel-actions">
                  <Link className="tab-item inline-block" to="/login">
                    General Login
                  </Link>
                  <Link className="tab-item inline-block" to="/signup">
                    Create New Account
                  </Link>
                </div>

                <form className="mt-4 space-y-3" onSubmit={onSubmit}>
                  <input
                    className="login-input"
                    placeholder="Super admin username, email, or phone"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                  />
                  <input className="login-input" type="password" placeholder="Password" value={password} onChange={(event) => setPassword(event.target.value)} />
                  <button className="login-action" type="submit">Login as Super Admin</button>
                </form>

                <p className="mt-3 text-xs text-slate-300">
                  Back to <Link className="login-link" to="/login">general login</Link>
                </p>

                {error && (
                  <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-2 text-xs text-rose-300">
                    {error}
                  </motion.p>
                )}
              </>
            ) : (
              <>
                <h1 className="login-title">
                  {activeCategory === "patient" && "Patient Login"}
                  {activeCategory === "hospital" && "Hospital Login"}
                  {activeCategory === "pharmacy" && "Pharmacy Login"}
                </h1>
                <p className="login-subtitle">Secure access with role-based medical dashboards.</p>
                <p className="mt-1 text-xs text-slate-300">
                  Patient username: mobile number. Patient/Hospital shared password: <span className="font-semibold">{sharedPassword}</span>
                </p>

                <form className="mt-4 space-y-3" onSubmit={onSubmit}>
                  {activeCategory === "hospital" && (
                    <>
                      <select className="login-input" value={selectedDistrict} onChange={(event) => setSelectedDistrict(event.target.value)}>
                        {districtOptions.map((district) => (
                          <option key={district} value={district}>{district}</option>
                        ))}
                      </select>
                      <select className="login-input" value={selectedHospital} onChange={(event) => setSelectedHospital(event.target.value)}>
                        {hospitalsInDistrict.map((hospital) => (
                          <option key={hospital.id} value={hospital.hospitalName}>{hospital.hospitalName}</option>
                        ))}
                      </select>
                      <select className="login-input" value={selectedDoctorUid} onChange={(event) => setSelectedDoctorUid(event.target.value)}>
                        {filteredDoctorCredentials.map((doctor) => (
                          <option key={doctor.uid} value={doctor.uid}>
                            {doctor.displayName} ({(doctor.doctorCode || doctor.uid).toUpperCase()})
                          </option>
                        ))}
                      </select>
                    </>
                  )}

                  {activeCategory === "pharmacy" && (
                    <>
                      <select className="login-input" value={selectedPharmacyDistrict} onChange={(event) => setSelectedPharmacyDistrict(event.target.value)}>
                        {pharmacyDistrictOptions.map((district) => (
                          <option key={district} value={district}>{district}</option>
                        ))}
                      </select>
                      <select className="login-input" value={selectedPharmacyUid} onChange={(event) => setSelectedPharmacyUid(event.target.value)}>
                        {pharmaciesInDistrict.map((pharmacy) => (
                          <option key={pharmacy.uid} value={pharmacy.uid}>
                            {pharmacy.pharmacyName ?? pharmacy.displayName}
                          </option>
                        ))}
                      </select>
                    </>
                  )}

                  {activeCategory !== "hospital" && activeCategory !== "pharmacy" && (
                    <input
                      className="login-input"
                      placeholder={activeCategory === "patient" ? "Patient mobile number (or email)" : "Phone number (or email)"}
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                    />
                  )}
                  <input className="login-input" type="password" placeholder="Password" value={password} onChange={(event) => setPassword(event.target.value)} />
                  <button className="login-action" type="submit">
                    {activeCategory === "patient" && "Login as Patient"}
                    {activeCategory === "hospital" && "Login as Hospital"}
                    {activeCategory === "pharmacy" && "Login as Pharmacy"}
                  </button>
                </form>

                <button className="login-link mt-2" onClick={() => setShowResetHint((value) => !value)}>
                  Reset password help
                </button>
                <AnimatePresence>
                  {showResetHint && (
                    <motion.p initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} className="login-hint">
                      Admin can reset from Security section. Firebase users also support email reset.
                    </motion.p>
                  )}
                </AnimatePresence>

                <p className="mt-3 text-xs text-slate-300">
                  New user? <Link className="login-link" to="/signup">Create account</Link>
                </p>

                <div className="mt-3 space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#8dffbf]">Demo Accounts</p>
                  {!isFirebaseConfigured ? (
                    <div className="grid gap-2">
                      {demoCredentials.map((demoUser) => (
                        <button
                          key={demoUser.email}
                          className="tab-item w-full text-left"
                          type="button"
                          onClick={() => {
                            setEmail(demoUser.phone ?? demoUser.email);
                            setPassword(demoUser.password);
                            if (activeCategory === "hospital") {
                              setSelectedDoctorUid(demoUser.uid);
                            }
                            const identifier = activeCategory === "hospital" ? demoUser.email : (demoUser.phone ?? demoUser.email);
                            void completeLogin(identifier, demoUser.password, activeCategory).catch((err) => setError((err as Error).message));
                          }}
                        >
                          {prettyRole(demoUser.role)} · {activeCategory === "hospital" ? `${demoUser.displayName} (${(demoUser.doctorCode || demoUser.uid).toUpperCase()})` : (demoUser.phone ?? demoUser.email)}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-slate-300">Demo access is hidden when Firebase is configured.</p>
                  )}
                </div>

                {error && (
                  <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-2 text-xs text-rose-300">
                    {error}
                  </motion.p>
                )}
              </>
            )}
          </div>
        </section>
      </div>
    </AuthCard>
  );
};

const SignUpPage = () => {
  const navigate = useNavigate();
  const hospitalOptions = useHospitalCatalog();
  const sharedPassword = getPatientHospitalLoginPassword();
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [role, setRole] = useState<Exclude<UserRole, "super_admin">>("patient");
  const [specialization, setSpecialization] = useState("general");
  const [hospital, setHospital] = useState("");
  const [district, setDistrict] = useState<string>(districts[0]);
  const [patientDistrict, setPatientDistrict] = useState<string>(districts[0]);
  const [age, setAge] = useState(25);
  const [gender, setGender] = useState<"male" | "female" | "other">("male");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (role !== "doctor") {
      return;
    }

    const selectedHospital = hospitalOptions.find((item) => item.hospitalName === hospital);
    if (selectedHospital) {
      if (district !== selectedHospital.district) {
        setDistrict(selectedHospital.district);
      }
      return;
    }

    const fallback = hospitalOptions[0];
    if (!fallback) {
      setHospital("");
      setDistrict("");
      return;
    }

    setHospital(fallback.hospitalName);
    setDistrict(fallback.district);
  }, [role, hospitalOptions, hospital, district]);

  const onChangeHospital = (hospitalName: string) => {
    setHospital(hospitalName);
    const selectedHospital = hospitalOptions.find((item) => item.hospitalName === hospitalName);
    setDistrict(selectedHospital?.district ?? "");
  };

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      const normalizedPhoneForName = phone.replace(/\D/g, "");
      const resolvedDisplayName =
        displayName.trim() || (role === "patient" ? `Patient ${normalizedPhoneForName.slice(-4) || "User"}` : "");

      const profile = await signUpWithPhone({
        phone,
        password: role === "patient" || role === "doctor" ? sharedPassword : password,
        role,
        displayName: resolvedDisplayName,
        specialization: role === "doctor" ? specialization : undefined,
        hospitalName: role === "doctor" ? hospital : undefined,
        district: role === "doctor" ? district : role === "patient" ? patientDistrict : undefined,
        village: role === "patient" ? patientDistrict : undefined,
        age: role === "patient" ? age : undefined,
        gender: role === "patient" ? gender : undefined
      });
      navigate(resolveDashboardPath(profile.role, profile.hospitalName));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthCard wide panelClassName="login-auth-panel auth-stage-panel">
      <div className="login-shell">
        <section className="doctor-panel auth-mascot-stage" aria-hidden="true">
          <AuthMascot imageClassName="auth-mascot-image auth-mascot-image-large" />
        </section>

        <section className="tabs-panel signup-panel">
          <div className="tab-content signup-content">
            <h1 className="login-title">Create Account</h1>
            <p className="login-subtitle">Phone number acts as the login ID and the SMS delivery contact.</p>

            <form onSubmit={onSubmit} className="mt-4 space-y-3">
              <input className="input" placeholder="Phone number (+91...)" value={phone} onChange={(event) => setPhone(event.target.value)} />
              {role !== "patient" && <input className="input" placeholder="Full name" value={displayName} onChange={(event) => setDisplayName(event.target.value)} />}

              <select className="input" value={role} onChange={(event) => setRole(event.target.value as Exclude<UserRole, "super_admin">)}>
                <option value="patient">Patient</option>
                <option value="doctor">Doctor</option>
                <option value="pharmacy">Pharmacy</option>
              </select>

              {role === "doctor" && (
                <>
                  <select className="input" value={specialization} onChange={(event) => setSpecialization(event.target.value)}>
                    <option value="general">General Medicine</option>
                    <option value="cardiology">Cardiology</option>
                    <option value="pediatrics">Pediatrics</option>
                  </select>
                  <select className="input" value={hospital} onChange={(event) => onChangeHospital(event.target.value)}>
                    {hospitalOptions.map((item) => (
                      <option key={item.hospitalName} value={item.hospitalName}>
                        {item.hospitalName}
                      </option>
                    ))}
                  </select>
                  <input className="input" value={district} readOnly aria-label="District" />
                </>
              )}

              {role === "patient" && (
                <>
                  <select className="input" value={patientDistrict} onChange={(event) => setPatientDistrict(event.target.value)}>
                    {districts.map((districtOption) => (
                      <option key={districtOption} value={districtOption}>
                        {districtOption}
                      </option>
                    ))}
                  </select>
                  <input className="input" type="number" min={1} max={120} value={age} onChange={(event) => setAge(Number(event.target.value))} />
                  <select className="input" value={gender} onChange={(event) => setGender(event.target.value as "male" | "female" | "other")}>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="other">Other</option>
                  </select>
                </>
              )}

              {role === "patient" || role === "doctor" ? (
                <input className="input" type="text" readOnly value={sharedPassword} aria-label="Shared password" />
              ) : (
                <input className="input" type="password" placeholder="Password" value={password} onChange={(event) => setPassword(event.target.value)} />
              )}
              <button className="btn-primary w-full" disabled={loading}>{loading ? "Creating..." : "Sign Up"}</button>
            </form>

            {error && <p className="mt-2 text-xs text-rose-300">{error}</p>}
            <p className="mt-3 text-xs text-slate-300">Already registered? <Link className="login-link" to="/login">Login</Link></p>
          </div>
        </section>
      </div>
    </AuthCard>
  );
};

const AnimatedRoutes = () => {
  const location = useLocation();

  return (
    <AnimatePresence mode="sync">
      <motion.div key={location.pathname} variants={pageTransition} initial="initial" animate="animate" exit="exit">
        <Routes location={location}>
          <Route path="/" element={<RootRedirect />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/login/super-admin" element={<LoginPage />} />
          <Route path="/login/hospital/:hospitalSlug" element={<LoginPage />} />
          <Route path="/signup" element={<SignUpPage />} />

          <Route
            path="/patient"
            element={
              <RoleRoute roles={["patient"]}>
                <PatientDashboard />
              </RoleRoute>
            }
          />
          <Route
            path="/doctor"
            element={
              <RoleRoute roles={["doctor"]}>
                <DoctorDashboard />
              </RoleRoute>
            }
          />
          <Route
            path="/doctor/hospital/:hospitalSlug"
            element={
              <RoleRoute roles={["doctor"]}>
                <DoctorDashboard />
              </RoleRoute>
            }
          />
          <Route
            path="/doctor/hospital/:hospitalSlug/:doctorId"
            element={
              <RoleRoute roles={["doctor"]}>
                <DoctorDashboard />
              </RoleRoute>
            }
          />
          <Route
            path="/doctor/:doctorId"
            element={
              <RoleRoute roles={["doctor"]}>
                <DoctorDashboard />
              </RoleRoute>
            }
          />
          <Route
            path="/pharmacy"
            element={
              <RoleRoute roles={["pharmacy"]}>
                <PharmacyDashboard />
              </RoleRoute>
            }
          />

          <Route
            path="/super-admin"
            element={
              <RoleRoute roles={["super_admin"]}>
                <SuperAdminLayout />
              </RoleRoute>
            }
          >
            <Route index element={<SystemOverviewPage />} />
            <Route path="users" element={<UserManagementPage />} />
            <Route path="hospitals" element={<HospitalManagementPage />} />
            <Route path="patients" element={<PatientManagementPage />} />
            <Route path="pharmacies" element={<PharmacyManagementPage />} />
            <Route path="sms-booking" element={<SmsBookingDeskPage />} />
            <Route path="triage-rules" element={<TriageRuleViewPage />} />
            <Route path="medicines" element={<MedicineDatabaseViewPage />} />
            <Route path="sms-logs" element={<SmsLogsViewPage />} />
            <Route path="analytics" element={<AnalyticsPage />} />
            <Route path="logs" element={<LogsPage />} />
            <Route path="settings" element={<SystemSettingsPage />} />
            <Route path="security" element={<SecurityPage />} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </motion.div>
    </AnimatePresence>
  );
};

const App = () => {
  return (
    <ErrorBoundary>
      <ToastProvider>
        {!isFirebaseConfigured && (
          <div className="bg-amber-100 px-3 py-2 text-center text-xs text-amber-900">
            Demo mode: Firebase env values are missing. Add keys in .env to enable Auth and Firestore.
          </div>
        )}
        <Suspense fallback={<MedicalSpinner fullScreen label="Opening page" message="Syncing the next care view" />}>
          <AnimatedRoutes />
        </Suspense>
      </ToastProvider>
    </ErrorBoundary>
  );
};

export default App;

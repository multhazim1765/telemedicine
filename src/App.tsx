import { FormEvent, ReactNode, Suspense, lazy, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Link, Navigate, Route, Routes, useLocation, useNavigate, useParams } from "react-router-dom";
import { ShieldPlus, Stethoscope, UserRoundCheck } from "lucide-react";
import { RoleRoute } from "./components/routes/RoleRoute";
import { getDemoCredentials, loginWithEmail, logout, signUpWithPhone } from "./services/authService";
import { isFirebaseConfigured } from "./services/firebase";
import { UserRole } from "./types/models";
import { useAuth } from "./hooks/useAuth";
import { seedChennaiDoctors } from "./services/functionService";
import { hospitalLoginAccounts, hospitalNameToSlug, hospitalSlugToName } from "./data/hospitalDoctors";
import { pageTransition } from "./utils/animations";
import { ToastProvider } from "./components/ui/ToastProvider";
import { MedicalSpinner } from "./components/ui/Feedback";
import { ErrorBoundary } from "./components/ErrorBoundary";
import hospitals from "./data/hospitals.json";

const PatientDashboard = lazy(() => import("./features/patient/PatientDashboard").then((module) => ({ default: module.PatientDashboard })));
const DoctorDashboard = lazy(() => import("./features/doctor/DoctorDashboard").then((module) => ({ default: module.DoctorDashboard })));
const PharmacyDashboard = lazy(() => import("./features/pharmacy/PharmacyDashboard").then((module) => ({ default: module.PharmacyDashboard })));
const SuperAdminLayout = lazy(() => import("./features/superAdmin/SuperAdminLayout").then((module) => ({ default: module.SuperAdminLayout })));
const SystemOverviewPage = lazy(() => import("./features/superAdmin/SystemOverviewPage").then((module) => ({ default: module.SystemOverviewPage })));
const UserManagementPage = lazy(() => import("./features/superAdmin/UserManagementPage").then((module) => ({ default: module.UserManagementPage })));
const PatientManagementPage = lazy(() => import("./features/superAdmin/PatientManagementPage").then((module) => ({ default: module.PatientManagementPage })));
const LogsPage = lazy(() => import("./features/superAdmin/LogsPage").then((module) => ({ default: module.LogsPage })));
const SecurityPage = lazy(() => import("./features/superAdmin/SecurityPage").then((module) => ({ default: module.SecurityPage })));
const HospitalManagementPage = lazy(() => import("./features/superAdmin/HospitalManagementPage").then((module) => ({ default: module.HospitalManagementPage })));
const TriageRuleViewPage = lazy(() => import("./features/superAdmin/TriageRuleViewPage").then((module) => ({ default: module.TriageRuleViewPage })));
const MedicineDatabaseViewPage = lazy(() => import("./features/superAdmin/MedicineDatabaseViewPage").then((module) => ({ default: module.MedicineDatabaseViewPage })));
const SmsLogsViewPage = lazy(() => import("./features/superAdmin/SmsLogsViewPage").then((module) => ({ default: module.SmsLogsViewPage })));
const AnalyticsPage = lazy(() => import("./features/superAdmin/AnalyticsPage").then((module) => ({ default: module.AnalyticsPage })));
const SystemSettingsPage = lazy(() => import("./features/superAdmin/SystemSettingsPage").then((module) => ({ default: module.SystemSettingsPage })));

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

const AuthCard = ({ children, wide = false, panelClassName = "" }: { children: ReactNode; wide?: boolean; panelClassName?: string }) => (
  <main className={`mx-auto flex min-h-screen w-full items-center p-4 ${wide ? "max-w-5xl" : "max-w-md"}`}>
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className={`w-full rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200 ${panelClassName}`}
    >
      {children}
    </motion.section>
  </main>
);

const LoginPage = () => {
  const navigate = useNavigate();
  const { hospitalSlug } = useParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [showResetHint, setShowResetHint] = useState(false);
  const [activeTab, setActiveTab] = useState<"login" | "facilities" | "demo">("login");
  const requestedHospitalName = hospitalSlug ? hospitalSlugToName(hospitalSlug) : undefined;

  const demoCredentials = getDemoCredentials().filter((credential) => {
    if (!requestedHospitalName) {
      return true;
    }
    if (credential.role !== "doctor") {
      return false;
    }
    const matchedHospital = hospitalLoginAccounts.find((account) => account.email.toLowerCase() === credential.email.toLowerCase())?.hospitalName;
    return matchedHospital === requestedHospitalName;
  });

  const completeLogin = async (identifier: string, loginPassword: string) => {
    const profile = await loginWithEmail(identifier, loginPassword);

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
      await completeLogin(email, password);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  return (
    <AuthCard wide panelClassName="login-auth-panel">
      <div className="login-shell">
        <section className="doctor-panel">
          <img src="/doctor-3d.svg" alt="3D doctor illustration" className="doctor-image" />
          <p className="doctor-caption">Rural Health Network</p>
        </section>

        <section className="tabs-panel">
          <div className="tab-header" role="tablist" aria-label="Login sections">
            <button type="button" role="tab" aria-selected={activeTab === "login"} className={`tab-button ${activeTab === "login" ? "active" : ""}`} onClick={() => setActiveTab("login")}>[LOGIN]</button>
            <button type="button" role="tab" aria-selected={activeTab === "facilities"} className={`tab-button ${activeTab === "facilities" ? "active" : ""}`} onClick={() => setActiveTab("facilities")}>[FACILITIES]</button>
            <button type="button" role="tab" aria-selected={activeTab === "demo"} className={`tab-button ${activeTab === "demo" ? "active" : ""}`} onClick={() => setActiveTab("demo")}>[DEMO ACCESS]</button>
          </div>

          <div className="tab-content">
            {activeTab === "login" && (
              <>
                <h1 className="login-title">{requestedHospitalName ? `${requestedHospitalName} Login` : "Welcome Back"}</h1>
                <p className="login-subtitle">Secure access with role-based medical dashboards.</p>

                <form className="mt-4 space-y-3" onSubmit={onSubmit}>
                  <input className="login-input" placeholder="Phone number (or email)" value={email} onChange={(event) => setEmail(event.target.value)} />
                  <input className="login-input" type="password" placeholder="Password" value={password} onChange={(event) => setPassword(event.target.value)} />
                  <button className="login-action" type="submit">Login</button>
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

                {error && (
                  <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-2 text-xs text-rose-300">
                    {error}
                  </motion.p>
                )}
              </>
            )}

            {activeTab === "facilities" && (
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#8dffbf]">Hospital Login Pages</p>
                <div className="grid gap-2">
                  {hospitalLoginAccounts.map((account) => (
                    <Link key={account.uid} className="tab-item" to={`/login/hospital/${hospitalNameToSlug(account.hospitalName ?? "")}`}>
                      {account.hospitalName}
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {activeTab === "demo" && (
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#8dffbf]">Demo Accounts</p>
                {!isFirebaseConfigured ? (
                  <div className="grid gap-2">
                    {demoCredentials.map((demoUser) => (
                      <button
                        key={demoUser.email}
                        className="tab-item w-full text-left"
                        type="button"
                        onClick={() => {
                          setEmail(demoUser.email);
                          setPassword(demoUser.password);
                          void completeLogin(demoUser.email, demoUser.password).catch((err) => setError((err as Error).message));
                        }}
                      >
                        {prettyRole(demoUser.role)} · {demoUser.email}
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-slate-300">Demo access is hidden when Firebase is configured.</p>
                )}
              </div>
            )}
          </div>
        </section>
      </div>
    </AuthCard>
  );
};

const SignUpPage = () => {
  const navigate = useNavigate();
  const hospitalOptions = hospitals as { hospitalName: string; district: string }[];
  const initialHospital = hospitalOptions[0];
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [role, setRole] = useState<Exclude<UserRole, "super_admin">>("patient");
  const [specialization, setSpecialization] = useState("general");
  const [hospital, setHospital] = useState(initialHospital?.hospitalName ?? "");
  const [district, setDistrict] = useState(initialHospital?.district ?? "");
  const [village, setVillage] = useState("");
  const [age, setAge] = useState(25);
  const [gender, setGender] = useState<"male" | "female" | "other">("male");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

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
        password,
        role,
        displayName: resolvedDisplayName,
        specialization: role === "doctor" ? specialization : undefined,
        hospitalName: role === "doctor" ? hospital : undefined,
        district: role === "doctor" ? district : undefined,
        village: role === "patient" ? village : undefined,
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
    <AuthCard>
      <h1 className="text-2xl font-semibold text-slate-800">Create Account</h1>
      <p className="mt-1 text-sm text-slate-500">Phone number acts as login ID and SMS contact.</p>

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
            <input className="input" placeholder="Village" value={village} onChange={(event) => setVillage(event.target.value)} />
            <input className="input" type="number" min={1} max={120} value={age} onChange={(event) => setAge(Number(event.target.value))} />
            <select className="input" value={gender} onChange={(event) => setGender(event.target.value as "male" | "female" | "other")}> 
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="other">Other</option>
            </select>
          </>
        )}

        <input className="input" type="password" placeholder="Password" value={password} onChange={(event) => setPassword(event.target.value)} />
        <button className="btn-primary w-full" disabled={loading}>{loading ? "Creating..." : "Sign Up"}</button>
      </form>

      {error && <p className="mt-2 text-xs text-rose-700">{error}</p>}
      <p className="mt-3 text-xs text-slate-600">Already registered? <Link className="font-semibold text-[#2BB673]" to="/login">Login</Link></p>
    </AuthCard>
  );
};

const HomePage = () => {
  const { user } = useAuth();
  const [seedStatus, setSeedStatus] = useState("");

  const onSeedDoctors = async () => {
    try {
      await seedChennaiDoctors();
      setSeedStatus("Doctors seeded successfully.");
    } catch (error) {
      setSeedStatus((error as Error).message);
    }
  };

  return (
    <main className="mx-auto max-w-5xl p-5">
      <section className="overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-slate-200">
        <div className="bg-medical-gradient p-5 text-white">
          <h1 className="text-2xl font-semibold">Offline-First Rural Telehealth</h1>
          <p className="mt-1 text-sm text-emerald-50">Modern, reliable care workflows with low-bandwidth support.</p>
        </div>
        <div className="space-y-4 p-5">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <Link className="btn-primary flex items-center justify-center gap-2" to="/patient"><UserRoundCheck className="h-4 w-4" /> Patient</Link>
            <Link className="btn-primary flex items-center justify-center gap-2" to="/doctor"><Stethoscope className="h-4 w-4" /> Doctor</Link>
            <Link className="btn-primary flex items-center justify-center gap-2" to="/pharmacy"><ShieldPlus className="h-4 w-4" /> Pharmacy</Link>
            <Link className="btn-primary flex items-center justify-center gap-2" to="/super-admin"><ShieldPlus className="h-4 w-4" /> Super Admin</Link>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Link className="btn-muted" to="/login">Open Login</Link>
            <button className="btn-muted" onClick={() => void logout()}>Logout</button>
            {user && isFirebaseConfigured && <button className="btn-muted" onClick={() => void onSeedDoctors()}>Seed Doctors</button>}
          </div>

          {user && <p className="text-sm text-slate-700">Logged in as {user.displayName} ({prettyRole(user.role)})</p>}
          {seedStatus && <p className="text-xs text-slate-600">{seedStatus}</p>}
        </div>
      </section>
    </main>
  );
};

const AnimatedRoutes = () => {
  const location = useLocation();

  return (
    <AnimatePresence mode="wait">
      <motion.div key={location.pathname} variants={pageTransition} initial="initial" animate="animate" exit="exit">
        <Routes location={location}>
          <Route path="/" element={<HomePage />} />
          <Route path="/login" element={<LoginPage />} />
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
        <Suspense fallback={<MedicalSpinner />}>
          <AnimatedRoutes />
        </Suspense>
      </ToastProvider>
    </ErrorBoundary>
  );
};

export default App;

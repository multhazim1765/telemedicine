import { Button, TextField } from "@mui/material";
import { AnimatePresence, motion } from "framer-motion";
import { FormEvent, useState } from "react";
import {
  changeCurrentPassword,
  getPatientHospitalLoginPassword,
  requestPasswordReset,
  setPatientHospitalLoginPassword
} from "../../services/authService";
import { useToast } from "../../components/ui/ToastProvider";

export const SecurityPage = () => {
  const { pushToast } = useToast();
  const [resetIdentifier, setResetIdentifier] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [sharedPassword, setSharedPassword] = useState(getPatientHospitalLoginPassword());
  const [errors, setErrors] = useState<string[]>([]);

  const validatePassword = (password: string, confirm: string): string[] => {
    const validationErrors: string[] = [];
    if (password.length < 8) {
      validationErrors.push("Password must be at least 8 characters.");
    }
    if (!/[A-Z]/.test(password)) {
      validationErrors.push("Password requires one uppercase letter.");
    }
    if (!/\d/.test(password)) {
      validationErrors.push("Password requires one number.");
    }
    if (password !== confirm) {
      validationErrors.push("Passwords do not match.");
    }
    return validationErrors;
  };

  const onReset = async (event: FormEvent) => {
    event.preventDefault();
    try {
      await requestPasswordReset(resetIdentifier);
      pushToast("Password reset initiated", "success");
      setResetIdentifier("");
    } catch (error) {
      pushToast((error as Error).message, "error");
    }
  };

  const onChangePassword = async (event: FormEvent) => {
    event.preventDefault();
    const validation = validatePassword(newPassword, confirmPassword);
    setErrors(validation);
    if (validation.length > 0) {
      return;
    }

    try {
      await changeCurrentPassword(newPassword);
      pushToast("Password updated", "success");
      setNewPassword("");
      setConfirmPassword("");
      setErrors([]);
    } catch (error) {
      pushToast((error as Error).message, "error");
    }
  };

  const onSaveSharedPassword = (event: FormEvent) => {
    event.preventDefault();
    try {
      setPatientHospitalLoginPassword(sharedPassword);
      setSharedPassword(getPatientHospitalLoginPassword());
      pushToast("Patient/Hospital shared login password updated", "success");
    } catch (error) {
      pushToast((error as Error).message, "error");
    }
  };

  return (
    <section className="grid gap-4 lg:grid-cols-2">
      <motion.form
        onSubmit={onSaveSharedPassword}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl bg-white/80 p-4 shadow-[0_10px_30px_rgba(15,23,42,0.08)] ring-1 ring-cyan-100"
      >
        <h2 className="mb-3 text-base font-semibold text-slate-800">Patient/Hospital Login Password</h2>
        <p className="mb-3 text-xs text-slate-600">
          This password is used for all patient and hospital (doctor role) logins in demo mode.
        </p>
        <TextField
          fullWidth
          size="small"
          label="Shared Password"
          value={sharedPassword}
          onChange={(event) => setSharedPassword(event.target.value)}
        />
        <Button className="!mt-3" type="submit" variant="contained" fullWidth>
          Save Shared Password
        </Button>
      </motion.form>

      <motion.form
        onSubmit={onReset}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl bg-white/80 p-4 shadow-[0_10px_30px_rgba(15,23,42,0.08)] ring-1 ring-cyan-100"
      >
        <h2 className="mb-3 text-base font-semibold text-slate-800">Reset Password</h2>
        <TextField
          fullWidth
          size="small"
          label="Email or phone"
          value={resetIdentifier}
          onChange={(event) => setResetIdentifier(event.target.value)}
        />
        <Button className="!mt-3" type="submit" variant="contained" fullWidth>
          Send Reset Link
        </Button>
      </motion.form>

      <motion.form
        onSubmit={onChangePassword}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl bg-white/80 p-4 shadow-[0_10px_30px_rgba(15,23,42,0.08)] ring-1 ring-cyan-100"
      >
        <h2 className="mb-3 text-base font-semibold text-slate-800">Change Password</h2>
        <div className="space-y-3">
          <TextField
            fullWidth
            size="small"
            type="password"
            label="New Password"
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
          />
          <TextField
            fullWidth
            size="small"
            type="password"
            label="Confirm Password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
          />
        </div>
        <AnimatePresence>
          {errors.length > 0 && (
            <motion.ul
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              className="mt-3 list-disc space-y-1 pl-5 text-xs text-rose-600"
            >
              {errors.map((error) => (
                <li key={error}>{error}</li>
              ))}
            </motion.ul>
          )}
        </AnimatePresence>
        <Button className="!mt-3" type="submit" variant="contained" fullWidth>
          Update Password
        </Button>
      </motion.form>

      <motion.article
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200 lg:col-span-2"
      >
        <h2 className="mb-3 text-base font-semibold text-slate-800">Security Incident Preview</h2>
        <p className="mb-3 text-sm text-slate-600">Reference image shown in security section as requested.</p>
        <img
          src="/security-error-preview.svg"
          alt="Security incident preview"
          className="w-full rounded-xl ring-1 ring-slate-200"
        />
      </motion.article>
    </section>
  );
};

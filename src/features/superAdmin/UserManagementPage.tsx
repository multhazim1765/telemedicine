import { Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle, Drawer, TextField } from "@mui/material";
import { AnimatePresence, motion } from "framer-motion";
import { Trash2, UserPlus } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { AppUser, UserRole } from "../../types/models";
import { useToast } from "../../components/ui/ToastProvider";
import { adminApi } from "../../services/adminApi";
import { subscribeCollection } from "../../services/firestoreService";
import { addDemoUser, deleteDemoUser } from "../../services/authService";
import { isFirebaseConfigured } from "../../services/firebase";
import { useAuth } from "../../hooks/useAuth";

type UserCategory = "all" | "hospital" | "patient" | "pharmacy";

const roleColor: Record<UserRole, "default" | "primary" | "secondary" | "success" | "warning" | "error" | "info"> = {
  patient: "info",
  doctor: "success",
  pharmacy: "warning",
  super_admin: "secondary"
};

export const UserManagementPage = () => {
  const { pushToast } = useToast();
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<AppUser[]>([]);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<UserCategory>("all");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [confirmDeleteUid, setConfirmDeleteUid] = useState<string | null>(null);
  const [form, setForm] = useState({
    email: "",
    password: "",
    displayName: "",
    role: "patient" as UserRole
  });

  useEffect(() => {
    const unsub = subscribeCollection("users", setUsers);
    return unsub;
  }, []);

  const categoryCount = useMemo(() => {
    return {
      all: users.length,
      hospital: users.filter((user) => user.role === "doctor").length,
      patient: users.filter((user) => user.role === "patient").length,
      pharmacy: users.filter((user) => user.role === "pharmacy").length
    };
  }, [users]);

  const filteredUsers = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return users.filter((user) => {
      const inCategory =
        category === "all"
          ? true
          : category === "hospital"
            ? user.role === "doctor"
            : user.role === category;

      if (!inCategory) {
        return false;
      }

      if (!normalizedSearch) {
        return true;
      }

      return [user.displayName, user.email, user.phone ?? "", user.hospitalName ?? "", user.pharmacyName ?? "", user.district ?? ""]
        .some((value) => value.toLowerCase().includes(normalizedSearch));
    });
  }, [users, category, search]);

  const onCreateUser = async () => {
    try {
      if (isFirebaseConfigured) {
        throw new Error("Create user is disabled in Firebase mode. Create users in Firebase Auth first.");
      }

      const createdUser = addDemoUser({
        email: form.email,
        password: form.password,
        displayName: form.displayName,
        role: form.role
      });

      await adminApi.addUser({
        ...createdUser,
        id: createdUser.uid,
        phone: createdUser.phone ?? ""
      });

      setDrawerOpen(false);
      setForm({ email: "", password: "", displayName: "", role: "patient" });
      pushToast("User added successfully", "success");
    } catch (error) {
      pushToast((error as Error).message, "error");
    }
  };

  const onDelete = async () => {
    if (!confirmDeleteUid) {
      return;
    }

    try {
      if (isFirebaseConfigured) {
        throw new Error("Delete user is disabled in Firebase mode. Remove users from Firebase Auth.");
      }

      if (confirmDeleteUid === currentUser?.uid) {
        throw new Error("You cannot delete the currently signed-in account.");
      }

      deleteDemoUser(confirmDeleteUid);
      await adminApi.deleteUser(confirmDeleteUid);
      setConfirmDeleteUid(null);
      pushToast("User removed", "info");
    } catch (error) {
      pushToast((error as Error).message, "error");
    }
  };

  return (
    <section className="rounded-2xl bg-white/80 p-4 shadow-[0_10px_30px_rgba(15,23,42,0.08)] ring-1 ring-cyan-100 backdrop-blur-md">
      <div className="mb-4 flex items-center justify-between gap-2">
        <h2 className="text-base font-semibold text-slate-800">User Management</h2>
        <Button variant="contained" startIcon={<UserPlus size={16} />} onClick={() => setDrawerOpen(true)}>
          Add User
        </Button>
      </div>

      <div className="mb-3 grid gap-2 rounded-xl bg-slate-50 p-3 ring-1 ring-slate-200 md:grid-cols-[1fr_auto_auto_auto_auto]">
        <TextField
          size="small"
          fullWidth
          label="Search users"
          placeholder="Name, email, phone, hospital"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <Button variant={category === "all" ? "contained" : "outlined"} onClick={() => setCategory("all")}>All ({categoryCount.all})</Button>
        <Button variant={category === "hospital" ? "contained" : "outlined"} onClick={() => setCategory("hospital")}>Hospital ({categoryCount.hospital})</Button>
        <Button variant={category === "patient" ? "contained" : "outlined"} onClick={() => setCategory("patient")}>Patient ({categoryCount.patient})</Button>
        <Button variant={category === "pharmacy" ? "contained" : "outlined"} onClick={() => setCategory("pharmacy")}>Pharmacy ({categoryCount.pharmacy})</Button>
      </div>

      <div className="space-y-2">
        {filteredUsers.map((user) => (
          <motion.div key={user.uid} layout className="flex items-center gap-2 rounded-xl bg-slate-50 p-3">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-slate-800">{user.displayName}</p>
              <p className="truncate text-xs text-slate-500">{user.email}</p>
              {user.phone && <p className="truncate text-xs text-slate-500">{user.phone}</p>}
              {user.role === "doctor" && user.hospitalName && <p className="truncate text-xs text-slate-500">Hospital: {user.hospitalName}</p>}
              {user.role === "pharmacy" && user.pharmacyName && <p className="truncate text-xs text-slate-500">Pharmacy: {user.pharmacyName}</p>}
              {user.district && <p className="truncate text-xs text-slate-500">District: {user.district}</p>}
            </div>
            <Chip size="small" color={roleColor[user.role]} label={user.role === "doctor" ? "hospital" : user.role} />
            <Button color="error" onClick={() => setConfirmDeleteUid(user.uid)} startIcon={<Trash2 size={14} />}>
              Delete
            </Button>
          </motion.div>
        ))}
        {filteredUsers.length === 0 && (
          <p className="rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-600 ring-1 ring-slate-200">No users found for current category/search.</p>
        )}
      </div>

      <Drawer anchor="right" open={drawerOpen} onClose={() => setDrawerOpen(false)}>
        <div className="w-[340px] p-4">
          <h3 className="mb-3 text-base font-semibold text-slate-800">Add New User</h3>
          <div className="space-y-3">
            <TextField label="Display Name" fullWidth size="small" value={form.displayName} onChange={(event) => setForm((v) => ({ ...v, displayName: event.target.value }))} />
            <TextField label="Email" fullWidth size="small" value={form.email} onChange={(event) => setForm((v) => ({ ...v, email: event.target.value }))} />
            <TextField label="Password" type="password" fullWidth size="small" value={form.password} onChange={(event) => setForm((v) => ({ ...v, password: event.target.value }))} />
            <TextField
              select
              SelectProps={{ native: true }}
              label="Role"
              fullWidth
              size="small"
              value={form.role}
              onChange={(event) => setForm((v) => ({ ...v, role: event.target.value as UserRole }))}
            >
              <option value="patient">patient</option>
              <option value="doctor">doctor</option>
              <option value="pharmacy">pharmacy</option>
              <option value="super_admin">super_admin</option>
            </TextField>
            <Button variant="contained" fullWidth onClick={() => void onCreateUser()}>Create</Button>
          </div>
        </div>
      </Drawer>

      <AnimatePresence>
        {confirmDeleteUid && (
          <Dialog open onClose={() => setConfirmDeleteUid(null)}>
            <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.96 }}>
              <DialogTitle>Confirm Delete</DialogTitle>
              <DialogContent>
                <p className="text-sm text-rose-600">This action cannot be undone.</p>
              </DialogContent>
              <DialogActions>
                <Button onClick={() => setConfirmDeleteUid(null)}>Cancel</Button>
                <Button color="error" variant="contained" onClick={() => void onDelete()}>Delete</Button>
              </DialogActions>
            </motion.div>
          </Dialog>
        )}
      </AnimatePresence>
    </section>
  );
};

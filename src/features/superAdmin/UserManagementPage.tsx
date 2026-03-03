import { Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle, Drawer, TextField } from "@mui/material";
import { AnimatePresence, motion } from "framer-motion";
import { Trash2, UserPlus } from "lucide-react";
import { useEffect, useState } from "react";
import { AppUser, UserRole } from "../../types/models";
import { useToast } from "../../components/ui/ToastProvider";
import { adminApi } from "../../services/adminApi";
import { subscribeCollection } from "../../services/firestoreService";

const roleColor: Record<UserRole, "default" | "primary" | "secondary" | "success" | "warning" | "error" | "info"> = {
  patient: "info",
  doctor: "success",
  pharmacy: "warning",
  super_admin: "secondary"
};

export const UserManagementPage = () => {
  const { pushToast } = useToast();
  const [users, setUsers] = useState<AppUser[]>([]);
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

  const onCreateUser = async () => {
    try {
      await adminApi.addUser({
        uid: `admin-created-${Date.now()}`,
        email: form.email,
        displayName: form.displayName,
        role: form.role,
        phone: ""
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
    await adminApi.deleteUser(confirmDeleteUid);
    setConfirmDeleteUid(null);
    pushToast("User removed", "info");
  };

  return (
    <section className="rounded-2xl bg-white/80 p-4 shadow-[0_10px_30px_rgba(15,23,42,0.08)] ring-1 ring-cyan-100 backdrop-blur-md">
      <div className="mb-4 flex items-center justify-between gap-2">
        <h2 className="text-base font-semibold text-slate-800">User Management</h2>
        <Button variant="contained" startIcon={<UserPlus size={16} />} onClick={() => setDrawerOpen(true)}>
          Add User
        </Button>
      </div>

      <div className="space-y-2">
        {users.map((user) => (
          <motion.div key={user.uid} layout className="flex items-center gap-2 rounded-xl bg-slate-50 p-3">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-slate-800">{user.displayName}</p>
              <p className="truncate text-xs text-slate-500">{user.email}</p>
            </div>
            <Chip size="small" color={roleColor[user.role]} label={user.role} />
            <Button color="error" onClick={() => setConfirmDeleteUid(user.uid)} startIcon={<Trash2 size={14} />}>
              Delete
            </Button>
          </motion.div>
        ))}
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

"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from "@/components/ui/dialog";
import { api } from "@/lib/api";
import { User, Role, CreateUserRequest, UpdateUserRequest } from "@/lib/types";
import {
  Search,
  Plus,
  Pencil,
  UserX,
  UserCheck,
  Loader2,
} from "lucide-react";

type FormMode = "create" | "edit";

interface UserForm {
  name: string;
  email: string;
  password: string;
  role: Role;
  department: string;
  position: string;
  leader_id: string;
}

const emptyForm: UserForm = {
  name: "",
  email: "",
  password: "",
  role: "collaborator",
  department: "",
  position: "",
  leader_id: "",
};

export default function AdminEmployeesPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [search, setSearch] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<FormMode>("create");
  const [form, setForm] = useState<UserForm>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    try {
      const data = await api.getUsers();
      setUsers(data);
    } catch {
      setUsers([]);
    }
  };

  const filtered = users.filter(
    (u) =>
      u.name.toLowerCase().includes(search.toLowerCase()) ||
      (u.email && u.email.toLowerCase().includes(search.toLowerCase())) ||
      (u.department &&
        u.department.toLowerCase().includes(search.toLowerCase())) ||
      (u.position && u.position.toLowerCase().includes(search.toLowerCase()))
  );

  const openCreate = () => {
    setForm(emptyForm);
    setFormMode("create");
    setEditingId(null);
    setFormError("");
    setFormOpen(true);
  };

  const openEdit = (user: User) => {
    setForm({
      name: user.name,
      email: user.email,
      password: "",
      role: user.role,
      department: user.department || "",
      position: user.position || "",
      leader_id: user.leader_id || "",
    });
    setFormMode("edit");
    setEditingId(user.id);
    setFormError("");
    setFormOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");
    setSaving(true);

    try {
      if (formMode === "create") {
        const data: CreateUserRequest = {
          name: form.name,
          email: form.email,
          password: form.password,
          role: form.role,
          department: form.department || undefined,
          position: form.position || undefined,
          leader_id: form.leader_id || undefined,
        };
        await api.createUser(data);
      } else if (editingId) {
        const data: UpdateUserRequest = {
          name: form.name,
          email: form.email,
          role: form.role,
          department: form.department || undefined,
          position: form.position || undefined,
          leader_id: form.leader_id || undefined,
        };
        await api.updateUser(editingId, data);
      }
      setFormOpen(false);
      await loadUsers();
    } catch (err) {
      setFormError(
        err instanceof Error ? err.message : "Failed to save user"
      );
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (user: User) => {
    try {
      await api.updateUser(user.id, { is_active: !user.is_active });
      await loadUsers();
    } catch {
      setUsers((prev) =>
        prev.map((u) =>
          u.id === user.id ? { ...u, is_active: !u.is_active } : u
        )
      );
    }
  };

  const leaders = users.filter(
    (u) => u.is_active !== false && u.id !== editingId
  );

  return (
    <div className="space-y-6 animate-slide-up">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">User Management</h1>
          <p className="text-muted-foreground">
            Create, edit, and manage user accounts
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="mr-2 h-4 w-4" />
          Create User
        </Button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search users..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10"
        />
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead className="hidden sm:table-cell">Email</TableHead>
              <TableHead className="hidden md:table-cell">Position</TableHead>
              <TableHead className="hidden lg:table-cell">
                Department
              </TableHead>
              <TableHead>Role</TableHead>
              <TableHead className="hidden lg:table-cell">Leader</TableHead>
              <TableHead>Status</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((user) => (
              <TableRow
                key={user.id}
                className={user.is_active === false ? "opacity-40" : ""}
              >
                <TableCell>
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-purple-600 text-white text-xs font-semibold">
                      {user.name.charAt(0)}
                    </div>
                    <div>
                      <p className="font-medium">{user.name}</p>
                      <p className="text-xs text-muted-foreground sm:hidden">
                        {user.email}
                      </p>
                    </div>
                  </div>
                </TableCell>
                <TableCell className="hidden sm:table-cell text-muted-foreground">
                  {user.email}
                </TableCell>
                <TableCell className="hidden md:table-cell text-muted-foreground">
                  {user.position}
                </TableCell>
                <TableCell className="hidden lg:table-cell text-muted-foreground">
                  {user.department}
                </TableCell>
                <TableCell>
                  <Badge
                    variant={user.role === "admin" ? "default" : "secondary"}
                  >
                    {user.role}
                  </Badge>
                </TableCell>
                <TableCell className="hidden lg:table-cell text-muted-foreground">
                  {user.leader_name || "\u2014"}
                </TableCell>
                <TableCell>
                  {user.is_active === false ? (
                    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-red-400">
                      <span className="h-2 w-2 rounded-full bg-red-500/50" />
                      Inactive
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-400">
                      <span className="h-2 w-2 rounded-full bg-emerald-500 shadow-lg shadow-emerald-500/50" />
                      Active
                    </span>
                  )}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => openEdit(user)}
                      title="Edit user"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => toggleActive(user)}
                      title={
                        user.is_active === false
                          ? "Reactivate user"
                          : "Deactivate user"
                      }
                    >
                      {user.is_active === false ? (
                        <UserCheck className="h-4 w-4 text-emerald-400" />
                      ) : (
                        <UserX className="h-4 w-4 text-red-400" />
                      )}
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {filtered.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={8}
                  className="text-center text-muted-foreground py-8"
                >
                  No users found
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>

      {/* Create / Edit User Dialog */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent>
          <DialogClose onClose={() => setFormOpen(false)} />
          <DialogHeader>
            <DialogTitle>
              {formMode === "create" ? "Create User" : "Edit User"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 mt-4">
            {formError && (
              <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-400">
                {formError}
              </div>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="form-name">Full Name</Label>
                <Input
                  id="form-name"
                  value={form.name}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, name: e.target.value }))
                  }
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="form-email">Email</Label>
                <Input
                  id="form-email"
                  type="email"
                  value={form.email}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, email: e.target.value }))
                  }
                  required
                />
              </div>
            </div>

            {formMode === "create" && (
              <div className="space-y-2">
                <Label htmlFor="form-password">Password</Label>
                <Input
                  id="form-password"
                  type="password"
                  value={form.password}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, password: e.target.value }))
                  }
                  required={formMode === "create"}
                  minLength={6}
                />
              </div>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="form-position">Position</Label>
                <Input
                  id="form-position"
                  value={form.position}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, position: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="form-department">Department</Label>
                <Input
                  id="form-department"
                  value={form.department}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, department: e.target.value }))
                  }
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="form-role">Role</Label>
                <Select
                  id="form-role"
                  value={form.role}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      role: e.target.value as Role,
                    }))
                  }
                >
                  <option value="collaborator">Collaborator</option>
                  <option value="admin">Admin</option>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="form-leader">Leader</Label>
                <Select
                  id="form-leader"
                  value={form.leader_id}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      leader_id: e.target.value,
                    }))
                  }
                >
                  <option value="">No leader</option>
                  {leaders.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name} — {l.position}
                    </option>
                  ))}
                </Select>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setFormOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : formMode === "create" ? (
                  "Create User"
                ) : (
                  "Save Changes"
                )}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

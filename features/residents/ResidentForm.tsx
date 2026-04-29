"use client";

import { type FormEvent, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { appRoleSchema, residentFormSchema, type ResidentFormInput } from "@/lib/validation";

interface ResidentFormProps {
  initialValues?: Partial<ResidentFormInput>;
  submitLabel: string;
  saving?: boolean;
  canManageSuperAdmin: boolean;
  onSubmit: (values: ResidentFormInput) => Promise<void>;
}

const roleOptions = appRoleSchema.options;

function normalizeFormValues(values?: Partial<ResidentFormInput>) {
  return {
    fullName: values?.full_name ?? "",
    displayName: values?.display_name ?? "",
    phone: values?.phone ?? "",
    email: values?.email ?? "",
    role: values?.role ?? "resident",
    isActive: values?.is_active ?? true,
  } as const;
}

export function ResidentForm({
  initialValues,
  submitLabel,
  saving = false,
  canManageSuperAdmin,
  onSubmit,
}: Readonly<ResidentFormProps>) {
  const normalized = useMemo(() => normalizeFormValues(initialValues), [initialValues]);
  const [fullName, setFullName] = useState(normalized.fullName);
  const [displayName, setDisplayName] = useState(normalized.displayName);
  const [phone, setPhone] = useState(normalized.phone);
  const [email, setEmail] = useState(normalized.email);
  const [role, setRole] = useState<ResidentFormInput["role"]>(normalized.role);
  const [isActive, setIsActive] = useState(normalized.isActive);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const availableRoles = canManageSuperAdmin
    ? roleOptions
    : roleOptions.filter((item) => item !== "super_admin");

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const parsed = residentFormSchema.safeParse({
      full_name: fullName,
      display_name: displayName,
      phone,
      email,
      role,
      is_active: isActive,
    });

    if (!parsed.success) {
      const nextErrors: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        if (issue.path.length > 0) {
          nextErrors[String(issue.path[0])] = issue.message;
        }
      }
      setErrors(nextErrors);
      return;
    }

    if (!canManageSuperAdmin && parsed.data.role === "super_admin") {
      setErrors({ role: "Hanya super admin yang dapat menetapkan role super_admin." });
      return;
    }

    setErrors({});
    await onSubmit(parsed.data);
  };

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      <div className="grid gap-4 md:grid-cols-2">
        <label className="space-y-2 text-sm text-slate-700">
          <span>Nama Lengkap</span>
          <Input value={fullName} onChange={(event) => setFullName(event.target.value)} />
          {errors.full_name ? <p className="text-xs text-red-600">{errors.full_name}</p> : null}
        </label>

        <label className="space-y-2 text-sm text-slate-700">
          <span>Nama Tampilan</span>
          <Input value={displayName} onChange={(event) => setDisplayName(event.target.value)} />
          {errors.display_name ? <p className="text-xs text-red-600">{errors.display_name}</p> : null}
        </label>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="space-y-2 text-sm text-slate-700">
          <span>Email</span>
          <Input value={email} onChange={(event) => setEmail(event.target.value)} placeholder="resident@contoh.id" />
          {errors.email ? <p className="text-xs text-red-600">{errors.email}</p> : null}
        </label>

        <label className="space-y-2 text-sm text-slate-700">
          <span>Telepon</span>
          <Input value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="08xxxxxxxxxx" />
          {errors.phone ? <p className="text-xs text-red-600">{errors.phone}</p> : null}
        </label>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="space-y-2 text-sm text-slate-700">
          <span>Role</span>
          <select
            className="flex h-10 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus-visible:ring-2 focus-visible:ring-slate-300"
            value={role}
            onChange={(event) => setRole(event.target.value as ResidentFormInput["role"])}
          >
            {availableRoles.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
          {errors.role ? <p className="text-xs text-red-600">{errors.role}</p> : null}
        </label>

        <label className="flex items-center gap-2 self-end pb-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={isActive}
            onChange={(event) => setIsActive(event.target.checked)}
            className="size-4 rounded border-slate-300"
          />
          <span>Akun aktif</span>
        </label>
      </div>

      <Button type="submit" disabled={saving}>
        {saving ? "Menyimpan..." : submitLabel}
      </Button>
    </form>
  );
}

"use client";

import { type FormEvent, useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { feeTypeFormSchema, type FeeTypeFormInput } from "@/lib/validation";

interface FeeTypeFormProps {
  initialValues?: Partial<FeeTypeFormInput>;
  submitLabel: string;
  saving?: boolean;
  onSubmit: (values: FeeTypeFormInput) => Promise<void>;
}

function normalizeValues(values?: Partial<FeeTypeFormInput>) {
  return {
    code: values?.code ?? "",
    name: values?.name ?? "",
    description: values?.description ?? "",
    defaultAmount: String(values?.default_amount ?? 0),
    isRecurring: values?.is_recurring ?? true,
    billingCycle: values?.billing_cycle ?? "monthly",
    chargeMonth: values?.charge_month ? String(values.charge_month) : "",
    isPenalty: values?.is_penalty ?? false,
    active: values?.active ?? true,
    sortOrder: String(values?.sort_order ?? 0),
  };
}

export function FeeTypeForm({ initialValues, submitLabel, saving = false, onSubmit }: Readonly<FeeTypeFormProps>) {
  const normalized = useMemo(() => normalizeValues(initialValues), [initialValues]);

  const [code, setCode] = useState(normalized.code);
  const [name, setName] = useState(normalized.name);
  const [description, setDescription] = useState(normalized.description);
  const [defaultAmount, setDefaultAmount] = useState(normalized.defaultAmount);
  const [isRecurring, setIsRecurring] = useState(normalized.isRecurring);
  const [billingCycle, setBillingCycle] = useState<"monthly" | "yearly">(normalized.billingCycle);
  const [chargeMonth, setChargeMonth] = useState(normalized.chargeMonth);
  const [isPenalty, setIsPenalty] = useState(normalized.isPenalty);
  const [active, setActive] = useState(normalized.active);
  const [sortOrder, setSortOrder] = useState(normalized.sortOrder);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    setCode(normalized.code);
    setName(normalized.name);
    setDescription(normalized.description);
    setDefaultAmount(normalized.defaultAmount);
    setIsRecurring(normalized.isRecurring);
    setBillingCycle(normalized.billingCycle);
    setChargeMonth(normalized.chargeMonth);
    setIsPenalty(normalized.isPenalty);
    setActive(normalized.active);
    setSortOrder(normalized.sortOrder);
    setErrors({});
  }, [normalized]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const parsed = feeTypeFormSchema.safeParse({
      code,
      name,
      description,
      default_amount: Number(defaultAmount),
      is_recurring: isRecurring,
      billing_cycle: billingCycle,
      charge_month: chargeMonth ? Number(chargeMonth) : null,
      is_penalty: isPenalty,
      active,
      sort_order: Number(sortOrder),
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

    setErrors({});
    await onSubmit(parsed.data);
  };

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      <div className="grid gap-4 md:grid-cols-2">
        <label className="space-y-2 text-sm text-slate-700">
          <span>Kode</span>
          <Input value={code} onChange={(event) => setCode(event.target.value.toUpperCase())} placeholder="IPL_BULANAN" />
          {errors.code ? <p className="text-xs text-red-600">{errors.code}</p> : null}
        </label>

        <label className="space-y-2 text-sm text-slate-700">
          <span>Nama</span>
          <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="Iuran Bulanan" />
          {errors.name ? <p className="text-xs text-red-600">{errors.name}</p> : null}
        </label>
      </div>

      <label className="space-y-2 text-sm text-slate-700">
        <span>Deskripsi</span>
        <textarea
          className="min-h-20 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus-visible:ring-2 focus-visible:ring-slate-300"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          placeholder="Opsional"
        />
        {errors.description ? <p className="text-xs text-red-600">{errors.description}</p> : null}
      </label>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="space-y-2 text-sm text-slate-700">
          <span>Nominal default</span>
          <Input
            type="number"
            min={0}
            value={defaultAmount}
            onChange={(event) => setDefaultAmount(event.target.value)}
            placeholder="0"
          />
          {errors.default_amount ? <p className="text-xs text-red-600">{errors.default_amount}</p> : null}
        </label>

        <label className="space-y-2 text-sm text-slate-700">
          <span>Urutan</span>
          <Input type="number" min={0} value={sortOrder} onChange={(event) => setSortOrder(event.target.value)} placeholder="0" />
          {errors.sort_order ? <p className="text-xs text-red-600">{errors.sort_order}</p> : null}
        </label>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="space-y-2 text-sm text-slate-700">
          <span>Siklus tagihan</span>
          <select
            className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none focus-visible:ring-2 focus-visible:ring-slate-300"
            value={billingCycle}
            onChange={(event) => {
              const next = event.target.value as "monthly" | "yearly";
              setBillingCycle(next);
              if (next === "monthly") {
                setChargeMonth("");
              }
              if (!isRecurring) {
                setChargeMonth("");
              }
            }}
            disabled={!isRecurring}
          >
            <option value="monthly">Monthly</option>
            <option value="yearly">Yearly</option>
          </select>
          {errors.billing_cycle ? <p className="text-xs text-red-600">{errors.billing_cycle}</p> : null}
        </label>

        <label className="space-y-2 text-sm text-slate-700">
          <span>Bulan tagih tahunan</span>
          <Input
            type="number"
            min={1}
            max={12}
            value={chargeMonth}
            onChange={(event) => setChargeMonth(event.target.value)}
            placeholder="1-12"
            disabled={!isRecurring || billingCycle !== "yearly"}
          />
          {errors.charge_month ? <p className="text-xs text-red-600">{errors.charge_month}</p> : null}
        </label>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={isRecurring}
            onChange={(event) => {
              const checked = event.target.checked;
              setIsRecurring(checked);
              if (!checked) {
                setBillingCycle("monthly");
                setChargeMonth("");
              }
            }}
            className="size-4 rounded border-slate-300"
          />
          <span>Recurring</span>
        </label>

        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={isPenalty}
            onChange={(event) => setIsPenalty(event.target.checked)}
            className="size-4 rounded border-slate-300"
          />
          <span>Denda (flat per periode)</span>
        </label>

        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={active}
            onChange={(event) => setActive(event.target.checked)}
            className="size-4 rounded border-slate-300"
          />
          <span>Aktif</span>
        </label>
      </div>

      {isPenalty ? (
        <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          <p className="font-medium">Konfigurasi Denda</p>
          <p className="mt-1 text-xs">Denda bersifat flat per periode keterlambatan. Nominal yang diisi akan langsung diterapkan ke invoice yang terlambat.</p>
        </div>
      ) : null}

      <Button type="submit" disabled={saving}>
        {saving ? "Menyimpan..." : submitLabel}
      </Button>
    </form>
  );
}

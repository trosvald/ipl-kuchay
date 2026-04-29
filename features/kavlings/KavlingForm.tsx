"use client";

import { type FormEvent, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  type KavlingFormInput,
  kavlingFormSchema,
} from "@/lib/validation";

interface KavlingFormProps {
  initialValues?: Partial<KavlingFormInput>;
  submitLabel: string;
  saving?: boolean;
  onSubmit: (values: KavlingFormInput) => Promise<void>;
}

function normalizeFormValues(values?: Partial<KavlingFormInput>) {
  return {
    code: values?.code ?? "",
    block: values?.block ?? "",
    sortOrder: String(values?.sort_order ?? 0),
    active: values?.active ?? true,
    notes: values?.notes ?? "",
  };
}

export function KavlingForm({
  initialValues,
  submitLabel,
  saving = false,
  onSubmit,
}: Readonly<KavlingFormProps>) {
  const normalized = useMemo(() => normalizeFormValues(initialValues), [initialValues]);
  const [code, setCode] = useState(normalized.code);
  const [block, setBlock] = useState(normalized.block);
  const [sortOrder, setSortOrder] = useState(normalized.sortOrder);
  const [active, setActive] = useState(normalized.active);
  const [notes, setNotes] = useState(normalized.notes);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const parsed = kavlingFormSchema.safeParse({
      code,
      block,
      sort_order: Number(sortOrder),
      active,
      notes,
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
          <span>Kode Kavling</span>
          <Input value={code} onChange={(event) => setCode(event.target.value)} placeholder="Kav 1" />
          {errors.code ? <p className="text-xs text-red-600">{errors.code}</p> : null}
        </label>

        <label className="space-y-2 text-sm text-slate-700">
          <span>Blok</span>
          <Input value={block} onChange={(event) => setBlock(event.target.value)} placeholder="A" />
          {errors.block ? <p className="text-xs text-red-600">{errors.block}</p> : null}
        </label>
      </div>

      <label className="space-y-2 text-sm text-slate-700">
        <span>Urutan</span>
        <Input
          type="number"
          min={0}
          value={sortOrder}
          onChange={(event) => setSortOrder(event.target.value)}
          placeholder="0"
        />
        {errors.sort_order ? <p className="text-xs text-red-600">{errors.sort_order}</p> : null}
      </label>

      <label className="space-y-2 text-sm text-slate-700">
        <span>Catatan</span>
        <textarea
          className="min-h-24 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus-visible:ring-2 focus-visible:ring-slate-300"
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          placeholder="Catatan kavling"
        />
        {errors.notes ? <p className="text-xs text-red-600">{errors.notes}</p> : null}
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

      <Button type="submit" disabled={saving}>
        {saving ? "Menyimpan..." : submitLabel}
      </Button>
    </form>
  );
}

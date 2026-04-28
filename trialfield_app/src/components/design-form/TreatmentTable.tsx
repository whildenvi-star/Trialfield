"use client";

import type { TreatmentIn } from "@/lib/types";

interface Props {
  treatments: TreatmentIn[];
  onChange: (treatments: TreatmentIn[]) => void;
}

export function TreatmentTable({ treatments, onChange }: Props) {
  function update(index: number, field: keyof TreatmentIn, raw: string) {
    const next = treatments.map((t, i) => {
      if (i !== index) return t;
      if (field === "value") {
        return { ...t, value: raw === "" ? null : parseFloat(raw) };
      }
      return { ...t, [field]: raw };
    });
    onChange(next);
  }

  function add() {
    onChange([...treatments, { label: "", value: null, unit: "" }]);
  }

  function remove(index: number) {
    onChange(treatments.filter((_, i) => i !== index));
  }

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-[1fr_1fr_1fr_2rem] gap-2 text-xs font-medium text-gray-500 px-1">
        <span>Label</span>
        <span>Value</span>
        <span>Unit</span>
        <span />
      </div>
      {treatments.map((t, i) => (
        <div key={i} className="grid grid-cols-[1fr_1fr_1fr_2rem] gap-2 items-center">
          <input
            className="border rounded px-2 py-1 text-sm w-full"
            placeholder="0 N"
            value={t.label}
            onChange={(e) => update(i, "label", e.target.value)}
          />
          <input
            className="border rounded px-2 py-1 text-sm w-full"
            placeholder="0"
            type="number"
            value={t.value ?? ""}
            onChange={(e) => update(i, "value", e.target.value)}
          />
          <input
            className="border rounded px-2 py-1 text-sm w-full"
            placeholder="lb N/ac"
            value={t.unit}
            onChange={(e) => update(i, "unit", e.target.value)}
          />
          <button
            type="button"
            onClick={() => remove(i)}
            disabled={treatments.length <= 2}
            className="text-gray-400 hover:text-red-500 disabled:opacity-20 text-lg leading-none"
            aria-label="Remove treatment"
          >
            ×
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={add}
        className="text-sm text-blue-600 hover:underline"
      >
        + Add treatment
      </button>
    </div>
  );
}

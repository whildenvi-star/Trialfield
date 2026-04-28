"use client";

interface Props {
  trialSwathFt: string;
  combineFt: string;
  onSwathChange: (v: string) => void;
  onCombineChange: (v: string) => void;
}

export function SwathPanel({
  trialSwathFt,
  combineFt,
  onSwathChange,
  onCombineChange,
}: Props) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">
          Trial swath width (ft) <span className="text-red-400">*</span>
        </label>
        <input
          className="border rounded px-2 py-1 text-sm w-full"
          placeholder="60"
          type="number"
          step="any"
          min="1"
          value={trialSwathFt}
          onChange={(e) => onSwathChange(e.target.value)}
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">
          Combine width (ft) — optional
        </label>
        <input
          className="border rounded px-2 py-1 text-sm w-full"
          placeholder="30"
          type="number"
          step="any"
          min="1"
          value={combineFt}
          onChange={(e) => onCombineChange(e.target.value)}
        />
      </div>
    </div>
  );
}

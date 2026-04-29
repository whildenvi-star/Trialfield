"use client";

interface Props {
  trialSwathFt: string;
  combineFt: string;
  onSwathChange: (v: string) => void;
  onCombineChange: (v: string) => void;
}

const inp = "border border-stone-300 rounded-md bg-white px-3 py-1.5 text-sm w-full";
const lbl = "block text-xs font-medium text-stone-500 mb-1";

export function SwathPanel({ trialSwathFt, combineFt, onSwathChange, onCombineChange }: Props) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <div>
        <label className={lbl}>
          Trial swath width (ft) <span className="text-red-400">*</span>
        </label>
        <input className={inp} placeholder="60" type="number" step="any" min="1" value={trialSwathFt} onChange={(e) => onSwathChange(e.target.value)} />
      </div>
      <div>
        <label className={lbl}>Combine width (ft) — optional</label>
        <input className={inp} placeholder="30" type="number" step="any" min="1" value={combineFt} onChange={(e) => onCombineChange(e.target.value)} />
      </div>
    </div>
  );
}

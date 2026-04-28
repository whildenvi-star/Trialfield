"use client";

interface Props {
  value: string;
  onChange: (v: string) => void;
}

export function ProseInput({ value, onChange }: Props) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">
        Trial description (parsed by AI)
      </label>
      <textarea
        className="border rounded px-2 py-1 text-sm w-full h-24 resize-y"
        placeholder='e.g. "6 nitrogen rates (0, 50, 100, 150, 200, 250 lb N/ac), 4 reps, 400 ft plots"'
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      <p className="text-xs text-gray-400 mt-1">
        When prose is provided the treatment table above is ignored.
      </p>
    </div>
  );
}

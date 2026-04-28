"use client";

import { useState } from "react";
import { TreatmentTable } from "@/components/design-form/TreatmentTable";
import { ABLinePanel } from "@/components/design-form/ABLinePanel";
import { SwathPanel } from "@/components/design-form/SwathPanel";
import { ProseInput } from "@/components/design-form/ProseInput";
import { FileList } from "@/components/results/FileList";
import { MapPreview } from "@/components/results/MapPreview";
import { useDesign } from "@/hooks/useDesign";
import type { TreatmentIn, TrialType, RxFormat } from "@/lib/types";
import type { GeoJSONPolygon } from "@/components/design-form/ABLineMap";

const TRIAL_TYPES: TrialType[] = [
  "fertility",
  "seeding",
  "spray",
  "tillage",
  "ground_speed",
  "other",
];

export default function DesignPage() {
  const { submit, loading, error, result } = useDesign();

  // Design source
  const [name, setName] = useState("Schultz N-rate 2026");
  const [trialType, setTrialType] = useState<TrialType>("fertility");
  const [reps, setReps] = useState("4");
  const [plotLengthFt, setPlotLengthFt] = useState("400");
  const [treatments, setTreatments] = useState<TreatmentIn[]>([
    { label: "0", value: 0, unit: "lb N/ac" },
    { label: "50", value: 50, unit: "lb N/ac" },
    { label: "100", value: 100, unit: "lb N/ac" },
    { label: "150", value: 150, unit: "lb N/ac" },
    { label: "200", value: 200, unit: "lb N/ac" },
    { label: "250", value: 250, unit: "lb N/ac" },
  ]);
  const [prose, setProse] = useState("");

  // Geometry
  const [aLon, setALon] = useState("-89.10575128");
  const [aLat, setALat] = useState("42.56240918");
  const [bLon, setBLon] = useState("-89.11104903");
  const [bLat, setBLat] = useState("42.56250344");
  const [trialSwathFt, setTrialSwathFt] = useState("60");
  const [combineFt, setCombineFt] = useState("");
  const [boundary, setBoundary] = useState<GeoJSONPolygon | null>(null);

  // Options
  const [soilMode, setSoilMode] = useState<"auto" | "skip">("skip");
  const [seed, setSeed] = useState("42");
  const [rxFormats, setRxFormats] = useState<RxFormat[]>(["fieldview", "isoxml", "agx"]);

  function toggleRxFormat(fmt: RxFormat) {
    setRxFormats((prev) =>
      prev.includes(fmt) ? prev.filter((f) => f !== fmt) : [...prev, fmt]
    );
  }

  function handleAbChange(
    field: "aLon" | "aLat" | "bLon" | "bLat",
    value: string
  ) {
    ({ aLon: setALon, aLat: setALat, bLon: setBLon, bLat: setBLat }[
      field
    ])(value);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    await submit({
      design: {
        name,
        trial_type: trialType,
        treatments: prose ? undefined : treatments,
        reps: parseInt(reps),
        plot_length_ft: plotLengthFt ? parseFloat(plotLengthFt) : null,
        prose: prose || null,
      },
      geometry: {
        a_lon: parseFloat(aLon),
        a_lat: parseFloat(aLat),
        b_lon: parseFloat(bLon),
        b_lat: parseFloat(bLat),
        trial_swath_ft: parseFloat(trialSwathFt),
        combine_ft: combineFt ? parseFloat(combineFt) : null,
        field_boundary_geojson: boundary ?? null,
      },
      soil_mode: soilMode,
      seed: parseInt(seed),
      rx_formats: rxFormats,
    });
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Design a trial</h1>
        <p className="text-sm text-gray-500 mt-1">
          Fill in the form below, then click Run to generate your prescription
          file bundle.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Trial identity */}
        <section className="space-y-3 border rounded-lg p-4">
          <h2 className="font-semibold text-gray-700">Trial</h2>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Name
              </label>
              <input
                className="border rounded px-2 py-1 text-sm w-full"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Type
              </label>
              <select
                className="border rounded px-2 py-1 text-sm w-full"
                value={trialType}
                onChange={(e) => setTrialType(e.target.value as TrialType)}
              >
                {TRIAL_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Reps
              </label>
              <input
                className="border rounded px-2 py-1 text-sm w-full"
                type="number"
                min={2}
                max={8}
                value={reps}
                onChange={(e) => setReps(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Plot length (ft)
              </label>
              <input
                className="border rounded px-2 py-1 text-sm w-full"
                type="number"
                step="any"
                value={plotLengthFt}
                onChange={(e) => setPlotLengthFt(e.target.value)}
              />
            </div>
          </div>
        </section>

        {/* Treatments */}
        <section className="space-y-3 border rounded-lg p-4">
          <h2 className="font-semibold text-gray-700">Treatments</h2>
          <TreatmentTable treatments={treatments} onChange={setTreatments} />
          <div className="border-t pt-3 mt-3">
            <ProseInput value={prose} onChange={setProse} />
          </div>
        </section>

        {/* Geometry */}
        <section className="space-y-3 border rounded-lg p-4">
          <h2 className="font-semibold text-gray-700">Geometry</h2>
          <ABLinePanel
            aLon={aLon}
            aLat={aLat}
            bLon={bLon}
            bLat={bLat}
            onChange={handleAbChange}
            boundary={boundary}
            onBoundaryChange={setBoundary}
          />
          <SwathPanel
            trialSwathFt={trialSwathFt}
            combineFt={combineFt}
            onSwathChange={setTrialSwathFt}
            onCombineChange={setCombineFt}
          />
        </section>

        {/* Options */}
        <section className="space-y-3 border rounded-lg p-4">
          <h2 className="font-semibold text-gray-700">Options</h2>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Soil data
              </label>
              <select
                className="border rounded px-2 py-1 text-sm w-full"
                value={soilMode}
                onChange={(e) =>
                  setSoilMode(e.target.value as "auto" | "skip")
                }
              >
                <option value="skip">Skip (faster)</option>
                <option value="auto">Fetch from SDA</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Random seed
              </label>
              <input
                className="border rounded px-2 py-1 text-sm w-full"
                type="number"
                value={seed}
                onChange={(e) => setSeed(e.target.value)}
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-2">
              Prescription formats
            </label>
            <div className="flex flex-wrap gap-4 text-sm">
              {(
                [
                  { id: "fieldview", label: "FieldView" },
                  { id: "isoxml", label: "John Deere / ISO" },
                  { id: "agx", label: "AgX (AgLeader)" },
                ] as { id: RxFormat; label: string }[]
              ).map(({ id, label }) => (
                <label key={id} className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={rxFormats.includes(id)}
                    onChange={() => toggleRxFormat(id)}
                    className="accent-blue-600"
                  />
                  {label}
                </label>
              ))}
            </div>
          </div>
        </section>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-blue-600 text-white py-2 rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? "Running…" : "Run design"}
        </button>
      </form>

      {error && (
        <div className="border border-red-300 bg-red-50 rounded-lg p-4 text-sm text-red-700">
          <strong>Error:</strong> {error}
        </div>
      )}

      {result && (
        <div className="space-y-6 border-t pt-6">
          <MapPreview files={result.files} />
          <FileList
            files={result.files}
            zipBlob={result.zipBlob}
            trialName={result.trialName}
          />
        </div>
      )}
    </div>
  );
}

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

  const card = "bg-white rounded-xl shadow-sm p-5 space-y-4";
  const sectionHeading = "font-semibold text-stone-700 border-l-4 border-green-600 pl-3";
  const fieldLabel = "block text-xs font-medium text-stone-500 mb-1";
  const input = "border border-stone-300 rounded-md bg-white px-3 py-1.5 text-sm w-full";

  return (
    <div className="bg-stone-50 min-h-[calc(100vh-3.5rem)]">
      <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-stone-900">Design a trial</h1>
          <p className="text-sm text-stone-400 mt-1">
            Fill in the form below, then click Run to generate your prescription file bundle.
          </p>
        </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Trial identity */}
        <section className={card}>
          <h2 className={sectionHeading}>Trial</h2>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={fieldLabel}>Name</label>
              <input
                className={input}
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div>
              <label className={fieldLabel}>Type</label>
              <select
                className={input}
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
              <label className={fieldLabel}>Reps</label>
              <input
                className={input}
                type="number"
                min={2}
                max={8}
                value={reps}
                onChange={(e) => setReps(e.target.value)}
              />
            </div>
            <div>
              <label className={fieldLabel}>Plot length (ft)</label>
              <input
                className={input}
                type="number"
                step="any"
                value={plotLengthFt}
                onChange={(e) => setPlotLengthFt(e.target.value)}
              />
            </div>
          </div>
        </section>

        {/* Treatments */}
        <section className={card}>
          <h2 className={sectionHeading}>Treatments</h2>
          <TreatmentTable treatments={treatments} onChange={setTreatments} />
          <div className="border-t border-stone-100 pt-4">
            <ProseInput value={prose} onChange={setProse} />
          </div>
        </section>

        {/* Geometry */}
        <section className={card}>
          <h2 className={sectionHeading}>Geometry</h2>
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
        <section className={card}>
          <h2 className={sectionHeading}>Options</h2>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={fieldLabel}>Soil data</label>
              <select
                className={input}
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
              <label className={fieldLabel}>Random seed</label>
              <input
                className={input}
                type="number"
                value={seed}
                onChange={(e) => setSeed(e.target.value)}
              />
              <p className="text-xs text-stone-400 mt-1">
                Controls how treatments are shuffled across reps. Change this to get a different valid layout.
              </p>
            </div>
          </div>
          <div>
            <label className={`${fieldLabel} mb-2`}>Prescription formats</label>
            <div className="flex flex-wrap gap-4 text-sm">
              {(
                [
                  { id: "fieldview", label: "FieldView" },
                  { id: "isoxml", label: "John Deere / ISO" },
                  { id: "agx", label: "AgX (AgLeader)" },
                ] as { id: RxFormat; label: string }[]
              ).map(({ id, label }) => (
                <label key={id} className="flex items-center gap-1.5 cursor-pointer text-stone-600">
                  <input
                    type="checkbox"
                    checked={rxFormats.includes(id)}
                    onChange={() => toggleRxFormat(id)}
                    className="accent-green-600"
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
          className="w-full bg-green-600 hover:bg-green-700 active:bg-green-800 text-white py-3.5 rounded-full font-semibold text-base shadow-md shadow-green-200 transition-all hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? "Running…" : "Run design →"}
        </button>
      </form>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">
          <strong>Error:</strong> {error}
        </div>
      )}

      {result && (
        <div className="space-y-4">
          <MapPreview files={result.files} />
          <FileList
            files={result.files}
            zipBlob={result.zipBlob}
            trialName={result.trialName}
          />
        </div>
      )}
      </div>
    </div>
  );
}

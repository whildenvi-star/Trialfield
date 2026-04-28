export type TrialType =
  | "fertility"
  | "seeding"
  | "spray"
  | "tillage"
  | "ground_speed"
  | "other";

export interface TreatmentIn {
  label: string;
  value: number | null;
  unit: string;
}

export interface DesignSource {
  name: string;
  trial_type: TrialType;
  treatments?: TreatmentIn[];
  reps: number;
  plot_length_ft?: number | null;
  prose?: string | null;
}

export interface GeometryIn {
  a_lon: number;
  a_lat: number;
  b_lon: number;
  b_lat: number;
  trial_swath_ft: number;
  combine_ft?: number | null;
  field_boundary_geojson?: object | null;
}

export interface DesignRequest {
  design: DesignSource;
  geometry: GeometryIn;
  soil_mode: "auto" | "skip";
  seed: number;
}

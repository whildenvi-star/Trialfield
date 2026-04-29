export type TrialType =
  | "fertility"
  | "seeding"
  | "spray"
  | "fungicide"
  | "herbicide"
  | "lime"
  | "cover_crop"
  | "biologicals"
  | "tillage"
  | "variety"
  | "ground_speed"
  | "planting_depth"
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

export type RxFormat = "fieldview" | "isoxml" | "agx";

export interface DesignRequest {
  design: DesignSource;
  geometry: GeometryIn;
  soil_mode: "auto" | "skip";
  seed: number;
  rx_formats: RxFormat[];
}

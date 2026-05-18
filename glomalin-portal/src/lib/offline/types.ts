// Queued operation — a field pass confirmation or addition waiting to sync
export interface QueuedOperation {
  id: string;                    // crypto.randomUUID()
  type: 'confirm-pass' | 'add-pass';
  fieldId: string;               // farm-registry field ID (required for replay)
  passId?: string;               // budget implement ID for confirm-pass replay
  passType?: string;             // operation type string for confirm-pass replay
  fieldOperationId?: string;     // existing ID for confirm-pass
  fieldEnterpriseId?: string;    // for add-pass
  operationType?: string;        // FieldOpType value (TILLAGE, CULTIVATION, etc.)
  operationDate: string;         // ISO date string
  operatorId: string;            // Supabase user ID
  operatorName: string;          // display name for optimistic UI
  description?: string;          // optional notes
  passNumber?: number;           // which pass number
  acresWorked?: number;
  createdAt: string;             // ISO timestamp when queued
  status: 'pending' | 'syncing' | 'failed' | 'synced';
  errorMessage?: string;         // populated on failure
  retryCount: number;
}

// Cached crop plan — field + enterprise + inputs + passes snapshot
export interface CachedCropPlan {
  fieldId: string;               // key — farm-registry field ID
  fieldName: string;
  crop: string;
  variety?: string;
  acres: number;
  enterprise?: string;
  inputs: Array<{
    product: string;
    rate: string;
    unit: string;
  }>;
  passes: Array<{
    id: string;
    type: string;
    passNumber?: number;
    status: 'PLANNED' | 'CONFIRMED';
    operationDate?: string;
    operatorName?: string;
  }>;
  cachedAt: string;              // ISO timestamp of cache write
}

// Pending observation — queued for upload, stored in IDB
export interface PendingObservation {
  localId?: number;          // autoIncrement key
  note: string;
  photoBlob?: Blob;          // resized JPEG blob stored in IDB
  synced: 0 | 1;             // 0 = pending, 1 = synced (number for reliable IDB indexing)
  createdAt: number;         // Date.now()
}

// Conflict record — captured when processQueue encounters a true data conflict
export interface ConflictRecord {
  id: string              // crypto.randomUUID()
  type: 'confirm-pass' | 'add-pass' | 'observation'
  fieldId: string
  operationDate: string
  localPayload: Record<string, unknown>
  serverPayload: Record<string, unknown>
  createdAt: string       // ISO timestamp
  resolved: 0 | 1        // 0 = unresolved, 1 = resolved (number not boolean — IDB index reliability)
}

// DB schema type for idb
export interface OfflineDB {
  'operation-queue': {
    key: string;
    value: QueuedOperation;
    indexes: { 'by-status': string };
  };
  'crop-plan-cache': {
    key: string;
    value: CachedCropPlan;
  };
  'observation-queue': {
    key: number;
    value: PendingObservation;
    indexes: { 'by-synced': number };
  };
  'sync-config': {
    key: string;
    value: { key: string; value: string };
  };
  'conflicts': {
    key: string;
    value: ConflictRecord;
    indexes: { 'by-resolved': 0 | 1 };
  };
}

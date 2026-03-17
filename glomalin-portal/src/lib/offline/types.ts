// Queued operation — a field pass confirmation or addition waiting to sync
export interface QueuedOperation {
  id: string;                    // crypto.randomUUID()
  type: 'confirm-pass' | 'add-pass';
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
}

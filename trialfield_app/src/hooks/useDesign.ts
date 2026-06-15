"use client";

import { useState } from "react";
import { postDesign } from "@/lib/api";
import { extractFilesFromZip } from "@/lib/zip";
import type { DesignRequest } from "@/lib/types";

export interface DesignResult {
  zipBlob: Blob;
  files: Map<string, Blob>;
  trialName: string;
}

export function useDesign() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<DesignResult | null>(null);

  async function submit(req: DesignRequest) {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const blob = await postDesign(req);
      const files = await extractFilesFromZip(blob);
      setResult({ zipBlob: blob, files, trialName: req.design.name });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  return { submit, loading, error, result };
}

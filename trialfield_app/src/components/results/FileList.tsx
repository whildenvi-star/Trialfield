"use client";

interface Props {
  files: Map<string, Blob>;
  zipBlob: Blob;
  trialName: string;
}

const ICON: Record<string, string> = {
  csv: "📄",
  zip: "📦",
  kml: "🗺️",
  md: "📝",
  xlsx: "📊",
  png: "🖼️",
  pdf: "📋",
};

function ext(name: string) {
  return name.split(".").pop()?.toLowerCase() ?? "";
}

export function FileList({ files, zipBlob, trialName }: Props) {
  function downloadFile(blob: Blob, name: string) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.click();
    URL.revokeObjectURL(url);
  }

  function downloadAll() {
    downloadFile(zipBlob, `${trialName.replace(/\s+/g, "_")}_bundle.zip`);
  }

  const entries = [...files.entries()].sort((a, b) => a[0].localeCompare(b[0]));

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-gray-700">Output files</h3>
        <button
          onClick={downloadAll}
          className="text-sm bg-green-600 text-white px-3 py-1 rounded hover:bg-green-700"
        >
          Download all (.zip)
        </button>
      </div>
      <ul className="divide-y border rounded overflow-hidden">
        {entries.map(([name, blob]) => (
          <li key={name} className="flex items-center justify-between px-3 py-2 hover:bg-gray-50">
            <span className="text-sm flex items-center gap-2">
              <span>{ICON[ext(name)] ?? "📁"}</span>
              <span className="font-mono text-gray-700">{name}</span>
            </span>
            <button
              onClick={() => downloadFile(blob, name)}
              className="text-xs text-blue-600 hover:underline"
            >
              Download
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

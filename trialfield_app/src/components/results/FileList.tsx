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
  json: "📋",
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
    <div className="bg-white rounded-xl shadow-sm p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-stone-700">Output files</h3>
        <button
          onClick={downloadAll}
          className="text-sm bg-green-600 hover:bg-green-700 text-white px-4 py-1.5 rounded-full font-medium transition-colors shadow-sm"
        >
          Download all (.zip)
        </button>
      </div>
      <ul className="divide-y divide-stone-100 border border-stone-100 rounded-lg overflow-hidden">
        {entries.map(([name, blob]) => (
          <li key={name} className="flex items-center justify-between px-4 py-2.5 hover:bg-stone-50 transition-colors">
            <span className="text-sm flex items-center gap-2">
              <span>{ICON[ext(name)] ?? "📁"}</span>
              <span className="font-mono text-stone-600 text-xs">{name}</span>
            </span>
            <button
              onClick={() => downloadFile(blob, name)}
              className="text-xs text-green-700 hover:text-green-900 font-medium"
            >
              Download
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

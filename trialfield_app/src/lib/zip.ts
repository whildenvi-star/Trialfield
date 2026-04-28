import { unzip } from "fflate";

export async function extractFilesFromZip(
  blob: Blob
): Promise<Map<string, Blob>> {
  const buf = await blob.arrayBuffer();
  const bytes = new Uint8Array(buf);

  return new Promise((resolve, reject) => {
    unzip(bytes, (err, files) => {
      if (err) {
        reject(err);
        return;
      }
      const map = new Map<string, Blob>();
      for (const [name, data] of Object.entries(files)) {
        map.set(name, new Blob([data.buffer as ArrayBuffer]));
      }
      resolve(map);
    });
  });
}

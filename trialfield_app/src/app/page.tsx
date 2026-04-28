import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-4 bg-gray-50">
      <div className="max-w-lg text-center space-y-6">
        <h1 className="text-4xl font-bold text-gray-900">Trialfield</h1>
        <p className="text-gray-500 text-lg">
          On-farm strip trial designer. Enter your AB line, treatments, and
          implement widths — get a FieldView-ready prescription in seconds.
        </p>
        <Link
          href="/design"
          className="inline-block bg-blue-600 text-white px-8 py-3 rounded-lg font-semibold text-lg hover:bg-blue-700"
        >
          Design a trial
        </Link>
      </div>
    </main>
  );
}

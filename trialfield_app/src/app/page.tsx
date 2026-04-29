import Link from "next/link";

const FEATURES = [
  { icon: "⬡", text: "AB line & boundary upload" },
  { icon: "⚗", text: "AI-powered treatment parsing" },
  { icon: "⬇", text: "FieldView · John Deere ISO · AgX output" },
];

export default function Home() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-3.5rem)] px-4 bg-gradient-to-b from-stone-50 to-white">
      <div className="max-w-xl w-full text-center space-y-8 py-20">

        {/* Badge */}
        <div className="inline-flex items-center gap-2 bg-green-50 text-green-700 text-xs font-semibold px-3 py-1 rounded-full border border-green-200">
          <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block" />
          Free & open source
        </div>

        {/* Headline */}
        <div className="space-y-3">
          <h1 className="text-5xl font-bold text-stone-900 tracking-tight leading-none">
            Strip trials.<br />
            <span className="text-green-600">Done in seconds.</span>
          </h1>
          <p className="text-stone-500 text-lg leading-relaxed max-w-md mx-auto">
            Enter your AB guidance line, treatments, and implement widths.
            Get a field-ready prescription bundle — no GIS software needed.
          </p>
        </div>

        {/* CTA */}
        <Link
          href="/design"
          className="inline-flex items-center gap-2 bg-green-600 hover:bg-green-700 active:bg-green-800 text-white px-8 py-3.5 rounded-full font-semibold text-lg shadow-md shadow-green-200 transition-all hover:shadow-lg hover:-translate-y-0.5"
        >
          Design your trial
          <span aria-hidden>→</span>
        </Link>

        {/* Feature chips */}
        <div className="flex flex-wrap justify-center gap-2 pt-2">
          {FEATURES.map((f) => (
            <span
              key={f.text}
              className="inline-flex items-center gap-1.5 text-sm text-stone-500 bg-white border border-stone-200 rounded-full px-3 py-1 shadow-sm"
            >
              <span className="text-green-600">{f.icon}</span>
              {f.text}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

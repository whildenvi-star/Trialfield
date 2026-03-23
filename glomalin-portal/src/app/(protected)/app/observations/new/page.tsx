import { ObservationForm } from '@/components/observations/ObservationForm'

export default function NewObservationPage() {
  return (
    <div className="max-w-lg mx-auto p-4">
      <h1 className="text-xl font-bold text-glomalin-text mb-4 font-mono">
        New Field Observation
      </h1>
      <ObservationForm />
    </div>
  )
}

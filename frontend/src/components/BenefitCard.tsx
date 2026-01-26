export default function BenefitCard({
  title,
  description,
}: {
  title: string
  description: string
}) {
  return (
    <div className="card">
      <h3 className="text-xl font-semibold mb-3">{title}</h3>
      <p className="text-gray-600">{description}</p>
    </div>
  )
}

import BenefitCard from "./BenefitCard"

export default function Benefits() {
  return (
    <section className="py-24 px-6 bg-[#fff6f1]">
      <div className="text-center mb-16">
        <span className="inline-block mb-3 text-sm bg-orange-100 text-orange-600 px-4 py-1 rounded-full">
          😊 Benefits
        </span>

        <h2 className="text-4xl font-bold max-w-3xl mx-auto">
          Unlock Tier-1 Job Offers, Even Without a Perfect CGPA
        </h2>

        <p className="mt-4 text-gray-600 max-w-2xl mx-auto">
          Get a proven roadmap, expert mentorship, and real-world practice to
          land consulting, analytics, and product roles.
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-10 max-w-6xl mx-auto">
        <BenefitCard
          title="All-in-one Course"
          description="Only one course to prep for all the Non-tech companies visiting your campus."
        />
        <BenefitCard
          title="Interactive Mock Interviews"
          description="Master placement interviews with hands-on practice tailored to real scenarios."
        />
      </div>
    </section>
  )
}

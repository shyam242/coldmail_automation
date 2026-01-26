export default function Hero() {
  return (
    <section className="grid-bg text-center py-24 px-6">
      <h1 className="text-5xl md:text-6xl font-bold leading-tight max-w-4xl mx-auto">
        Unlock Your Non-Tech Dream Job
      </h1>

      <p className="mt-6 text-lg text-gray-600 max-w-2xl mx-auto">
        BeyondTech offers a mentor-led, structured course designed to help you
        master guesstimates, cases, and interviews with confidence.
      </p>

      <div className="mt-10 flex justify-center gap-4">
        <a
          href="http://localhost:8501?action=login"
          className="bg-orange-500
  text-white
  px-6 py-3
  rounded-xl
  font-semibold
  hover:bg-orange-600
  transition"
        >
          Start Your Journey →
        </a>

        <button className="btn-secondary flex items-center gap-2">
          View Success Stories →
        </button>
      </div>
    </section>
  )
}

export default function Container({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <main className="max-w-6xl mx-auto px-6">
      {children}
    </main>
  );
}

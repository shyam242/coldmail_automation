import Link from "next/link";

export default function Navbar() {
  return (
    <nav className="px-10 py-6 flex justify-between items-center">
      <Link href="/" className="text-2xl font-bold hover:opacity-80 transition">
        BeyondTech
      </Link>
      <div className="space-x-6 text-sm font-medium">
        <Link href="/dashboard">Dashboard</Link>
        <Link href="/upload">Upload</Link>
        <Link href="/senders">Senders</Link>
        <Link href="/preview">Preview</Link>
      </div>
    </nav>
  );
}

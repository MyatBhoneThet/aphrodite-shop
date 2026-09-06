import Link from "next/link";
import LocationSharing from "../components/LocationSharing";
import BrandLogo from "../components/BrandLogo";

export default function LocationPage() {
  return <main className="min-h-screen bg-zinc-50 px-5 py-10 text-zinc-950"><div className="mx-auto max-w-xl"><Link href="/" aria-label="Aphrodite home"><BrandLogo /></Link><h1 className="mb-6 mt-10 text-3xl font-bold">Your location, your choice</h1><LocationSharing expanded /><Link href="/" className="mt-6 inline-block text-sm font-semibold text-red-700">← Back to store</Link></div></main>;
}

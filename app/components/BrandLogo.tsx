export default function BrandLogo({ className = "" }: { className?: string }) {
  return <img src="/brand/aphrodite-myanmar.svg" width="248" height="72" alt="Aphrodite Myanmar" className={`h-11 w-auto max-w-full object-contain sm:h-12 ${className}`} />;
}

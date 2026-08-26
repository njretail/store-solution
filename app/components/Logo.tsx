export default function Logo({ className = "" }: { className?: string }) {
  return (
    <span className={`font-extrabold tracking-tight ${className}`}>
      <span className="text-[#C8075F]">NJ</span>{" "}
      <span className="text-zinc-900">RETAIL</span>
    </span>
  );
}

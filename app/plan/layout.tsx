import { caveat, figtree, playfairDisplay } from "@/lib/schriften";

export default function PlanLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div
      className={`${playfairDisplay.variable} ${figtree.variable} ${caveat.variable}`}
    >
      {children}
    </div>
  );
}

import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="band-dark flex min-h-screen flex-col">
      <div className="container relative z-10 py-8">
        <Logo inverse />
      </div>
      <div className="container relative z-10 flex flex-1 flex-col items-start justify-center gap-6 pb-24">
        <p className="eyebrow text-white/60">Error 404</p>
        <h1 className="display-xl max-w-3xl text-white">Esta página no existe.</h1>
        <p className="max-w-xl text-white/70">Puede que el enlace esté mal escrito o que el contenido se haya movido.</p>
        <Button variant="inverse" asChild>
          <Link href="/">Volver al inicio</Link>
        </Button>
      </div>
    </div>
  );
}

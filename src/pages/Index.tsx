import { useNavigate } from "react-router-dom";
import { ChevronRight, Info, LogIn, Zap } from "lucide-react";
import heroImage from "@/assets/hero-calisthenics.jpg";

const Index = () => {
  const navigate = useNavigate();

  return (
    <div className="relative min-h-[100dvh] overflow-hidden bg-black text-white">
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: `url(${heroImage})` }}
      />
      <div className="absolute inset-0 bg-gradient-to-b from-black/55 via-[#150019]/70 to-black" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_35%,rgba(218,0,255,0.22),transparent_42%)]" />

      <div className="relative z-10 flex min-h-[100dvh] flex-col px-5 native-safe-top native-safe-bottom">
        <header className="flex items-center gap-3 pt-5">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary shadow-lg shadow-primary/20">
            <Zap className="h-6 w-6 fill-current text-primary-foreground" />
          </div>
          <div>
            <p className="font-display text-xl tracking-[0.16em]">SUPER POWER GYM</p>
            <p className="text-xs text-white/55">La tua palestra, sempre con te</p>
          </div>
        </header>

        <main className="mt-auto pb-7">
          <div className="mb-7 max-w-sm">
            <span className="inline-flex rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-medium uppercase tracking-[0.16em] text-white/75 backdrop-blur-md">
              Allenamento e coaching
            </span>
            <h1 className="mt-4 font-display text-[3.25rem] leading-[0.9] tracking-wide sm:text-6xl">
              SUPERA I TUOI LIMITI.
            </h1>
            <p className="mt-4 max-w-xs text-base leading-relaxed text-white/68">
              Schede, progressi, appuntamenti e comunicazioni in un'unica app.
            </p>
          </div>

          <div className="space-y-3">
            <button
              type="button"
              onClick={() => navigate("/login")}
              className="flex w-full items-center gap-4 rounded-2xl bg-primary px-5 py-4 text-left text-primary-foreground shadow-xl shadow-primary/15 transition active:scale-[0.99]"
            >
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-black/10">
                <LogIn className="h-5 w-5" />
              </span>
              <span className="flex-1">
                <span className="block font-semibold">Accedi all'area clienti</span>
                <span className="block text-sm opacity-70">Allenamenti, appuntamenti e progressi</span>
              </span>
              <ChevronRight className="h-5 w-5" />
            </button>

            <button
              type="button"
              onClick={() => navigate("/contatti")}
              className="flex w-full items-center gap-4 rounded-2xl border border-white/12 bg-white/[0.07] px-5 py-4 text-left backdrop-blur-xl transition active:scale-[0.99]"
            >
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/10">
                <Info className="h-5 w-5 text-primary" />
              </span>
              <span className="flex-1">
                <span className="block font-semibold">Info e contatti</span>
                <span className="block text-sm text-white/55">Orari, sede e assistenza</span>
              </span>
              <ChevronRight className="h-5 w-5 text-white/55" />
            </button>
          </div>
        </main>
      </div>
    </div>
  );
};

export default Index;

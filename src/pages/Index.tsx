import { useNavigate } from "react-router-dom";
import heroImage from "@/assets/hero-calisthenics.jpg";

const Index = () => {
  const navigate = useNavigate();

  return (
    <div className="relative h-[100dvh] w-full overflow-hidden native-safe-top native-safe-bottom">
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: `url(${heroImage})` }}
      />
      <div className="absolute inset-0 bg-black/20" />

      <div className="relative z-10 flex h-full flex-col md:flex-row">
        <button
          type="button"
          className="split-panel group flex-1 border-b border-foreground/10 md:border-b-0 md:border-r"
          onClick={() => navigate("/contatti")}
          aria-label="Apri informazioni e contatti"
        >
          <div className="px-6 text-center">
            <h2 className="split-title group-hover:text-primary transition-colors duration-500">
              INFO & CONTATTI
            </h2>
            <p className="mt-3 text-sm sm:text-base tracking-[0.2em] text-foreground/70 font-body uppercase">
              Scopri la palestra
            </p>
          </div>
        </button>

        <div className="split-divider hidden md:block md:absolute md:left-1/2 md:top-1/4 md:h-1/2 md:w-px" />

        <button
          type="button"
          className="split-panel group flex-1"
          onClick={() => navigate("/login")}
          aria-label="Accedi all'area clienti"
        >
          <div className="px-6 text-center">
            <h2 className="split-title group-hover:text-primary transition-colors duration-500">
              AREA CLIENTI
            </h2>
            <p className="mt-3 text-sm sm:text-base tracking-[0.2em] text-foreground/70 font-body uppercase">
              Accedi al tuo profilo
            </p>
          </div>
        </button>
      </div>

      <div className="pointer-events-none absolute left-1/2 z-20 -translate-x-1/2 text-center" style={{ top: "calc(1rem + var(--safe-top))" }}>
        <h1 className="whitespace-nowrap font-display text-xl sm:text-2xl tracking-[0.22em] text-foreground drop-shadow-lg">
          SUPER POWER GYM
        </h1>
      </div>
    </div>
  );
};

export default Index;

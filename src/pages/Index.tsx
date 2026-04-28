import { useNavigate } from "react-router-dom";
import heroImage from "@/assets/hero-calisthenics.jpg";

const Index = () => {
  const navigate = useNavigate();

  return (
    <div className="relative h-screen w-full overflow-hidden">
      {/* Background Image */}
      <div 
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: `url(${heroImage})` }}
      />
      
      {/* Split Screen Container */}
      <div className="relative z-10 flex h-full flex-col md:flex-row">
        {/* Left Panel - Info & Contatti */}
        <div 
          className="split-panel group flex-1 border-b border-foreground/10 md:border-b-0 md:border-r"
          onClick={() => navigate("/contatti")}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === 'Enter' && navigate("/contatti")}
        >
          <div className="text-center">
            <h2 className="split-title group-hover:text-primary transition-colors duration-500">
              INFO & CONTATTI
            </h2>
            <p className="mt-4 text-lg tracking-widest text-foreground/60 font-body uppercase">
              Scopri la palestra
            </p>
          </div>
        </div>

        {/* Divider Line */}
        <div className="split-divider hidden md:block md:absolute md:left-1/2 md:top-1/4 md:h-1/2 md:w-px" />

        {/* Right Panel - Area Clienti */}
        <div 
          className="split-panel group flex-1"
          onClick={() => navigate("/login")}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === 'Enter' && navigate("/login")}
        >
          <div className="text-center">
            <h2 className="split-title group-hover:text-primary transition-colors duration-500">
              AREA CLIENTI
            </h2>
            <p className="mt-4 text-lg tracking-widest text-foreground/60 font-body uppercase">
              Accedi al tuo profilo
            </p>
          </div>
        </div>
      </div>

      {/* Logo/Brand in center */}
      <div className="absolute left-1/2 top-8 z-20 -translate-x-1/2 text-center">
        <h1 className="font-display text-2xl tracking-[0.3em] text-foreground/80">
          CALISTHENICS
        </h1>
      </div>
    </div>
  );
};

export default Index;
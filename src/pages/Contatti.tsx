import { useState } from "react";
import { Link } from "react-router-dom";
import { Phone, Mail, MapPin, Clock, MessageCircle, ArrowLeft, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { z } from "zod";

const contactSchema = z.object({
  nome: z.string().trim().min(1, "Il nome è obbligatorio").max(100, "Nome troppo lungo"),
  email: z.string().trim().email("Email non valida").max(255, "Email troppo lunga"),
  telefono: z.string().trim().min(1, "Il telefono è obbligatorio").max(20, "Telefono troppo lungo"),
  obiettivo: z.string().min(1, "Seleziona un obiettivo"),
  messaggio: z.string().trim().max(1000, "Messaggio troppo lungo"),
});

type ContactFormData = z.infer<typeof contactSchema>;

const Contatti = () => {
  const [formData, setFormData] = useState<ContactFormData>({
    nome: "",
    email: "",
    telefono: "",
    obiettivo: "",
    messaggio: "",
  });
  const [errors, setErrors] = useState<Partial<Record<keyof ContactFormData, string>>>({});
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleChange = (field: keyof ContactFormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: undefined }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    const result = contactSchema.safeParse(formData);
    
    if (!result.success) {
      const fieldErrors: Partial<Record<keyof ContactFormData, string>> = {};
      result.error.errors.forEach((err) => {
        if (err.path[0]) {
          fieldErrors[err.path[0] as keyof ContactFormData] = err.message;
        }
      });
      setErrors(fieldErrors);
      setIsSubmitting(false);
      return;
    }

    // Simulate form submission
    await new Promise(resolve => setTimeout(resolve, 1000));
    setIsSubmitted(true);
    setIsSubmitting(false);
  };

  const whatsappNumber = "+393484157414";
  const whatsappMessage = encodeURIComponent("Ciao! Vorrei informazioni sulla palestra.");

  return (
    <div className="page-container">
      <div className="mx-auto max-w-4xl">
        {/* Back Link */}
        <Link 
          to="/" 
          className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors mb-8"
        >
          <ArrowLeft className="h-4 w-4" />
          <span className="font-body text-sm uppercase tracking-wider">Torna alla Home</span>
        </Link>

        {/* Header */}
        <header className="mb-12 animate-fade-in">
          <h1 className="section-title text-foreground">
            INFO & CONTATTI
          </h1>
          <p className="text-lg text-muted-foreground font-body leading-relaxed max-w-2xl">
            Palestra Calisthenics è il tuo punto di riferimento per l'allenamento a corpo libero. 
            Offriamo corsi per tutti i livelli, dal principiante all'atleta avanzato, 
            in un ambiente moderno e attrezzato.
          </p>
        </header>

        <div className="grid gap-12 lg:grid-cols-2">
          {/* Contact Info */}
          <section className="space-y-8 animate-fade-in" style={{ animationDelay: '0.1s' }}>
            <h2 className="font-display text-2xl tracking-wider text-foreground">CONTATTI</h2>
            
            <div className="space-y-6">
              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-sm bg-secondary">
                  <Phone className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-display text-lg text-foreground">Telefono</h3>
                  <a href="tel:+393331234567" className="text-muted-foreground hover:text-primary transition-colors">
                    +39 348 415 7414
                  </a>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-sm bg-secondary">
                  <Mail className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-display text-lg text-foreground">Email</h3>
                  <a href="mailto:mariano@superpowergym.it" className="text-muted-foreground hover:text-primary transition-colors">
                    mariano@superpowergym.it
                  </a>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-sm bg-secondary">
                  <MapPin className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-display text-lg text-foreground">Indirizzo</h3>
                  <p className="text-muted-foreground">
                    Via CARLO RICCIONI N°1<br />
                    64100 San Nicolò (TE)
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-sm bg-secondary">
                  <Clock className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-display text-lg text-foreground">Orari</h3>
                  <p className="text-muted-foreground">
                    Lun - Ven: 07:00 - 22:00<br />
                    Sab: 09:00 - 18:00<br />
                    Dom: 09:00 - 13:00
                  </p>
                </div>
              </div>
            </div>

            {/* WhatsApp Button */}
            <a
              href={`https://wa.me/${whatsappNumber}?text=${whatsappMessage}`}
              target="_blank"
              rel="noopener noreferrer"
              className="whatsapp-button"
            >
              <MessageCircle className="h-5 w-5" />
              <span className="font-display text-lg tracking-wider">SCRIVICI SU WHATSAPP</span>
            </a>
          </section>

          {/* Contact Form */}
          <section className="animate-fade-in" style={{ animationDelay: '0.2s' }}>
            <h2 className="font-display text-2xl tracking-wider text-foreground mb-6">RICHIEDI INFORMAZIONI</h2>
            
            {isSubmitted ? (
              <div className="form-container text-center py-12 animate-scale-in">
                <div className="flex justify-center mb-4">
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-success/20">
                    <CheckCircle className="h-8 w-8 text-success" />
                  </div>
                </div>
                <h3 className="font-display text-2xl text-foreground mb-2">RICHIESTA INVIATA</h3>
                <p className="text-muted-foreground">
                  Ti risponderemo il prima possibile.
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="form-container space-y-5">
                <div>
                  <label htmlFor="nome" className="block text-sm font-medium text-foreground mb-2">
                    Nome *
                  </label>
                  <Input
                    id="nome"
                    type="text"
                    value={formData.nome}
                    onChange={(e) => handleChange("nome", e.target.value)}
                    className={errors.nome ? "border-destructive" : ""}
                    placeholder="Il tuo nome"
                  />
                  {errors.nome && <p className="mt-1 text-sm text-destructive">{errors.nome}</p>}
                </div>

                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-foreground mb-2">
                    Email *
                  </label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => handleChange("email", e.target.value)}
                    className={errors.email ? "border-destructive" : ""}
                    placeholder="La tua email"
                  />
                  {errors.email && <p className="mt-1 text-sm text-destructive">{errors.email}</p>}
                </div>

                <div>
                  <label htmlFor="telefono" className="block text-sm font-medium text-foreground mb-2">
                    Telefono *
                  </label>
                  <Input
                    id="telefono"
                    type="tel"
                    value={formData.telefono}
                    onChange={(e) => handleChange("telefono", e.target.value)}
                    className={errors.telefono ? "border-destructive" : ""}
                    placeholder="Il tuo numero"
                  />
                  {errors.telefono && <p className="mt-1 text-sm text-destructive">{errors.telefono}</p>}
                </div>

                <div>
                  <label htmlFor="obiettivo" className="block text-sm font-medium text-foreground mb-2">
                    Obiettivo *
                  </label>
                  <Select value={formData.obiettivo} onValueChange={(value) => handleChange("obiettivo", value)}>
                    <SelectTrigger className={errors.obiettivo ? "border-destructive" : ""}>
                      <SelectValue placeholder="Seleziona il tuo obiettivo" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="iniziare">Iniziare il calisthenics</SelectItem>
                      <SelectItem value="migliorare">Migliorare le mie skills</SelectItem>
                      <SelectItem value="dimagrire">Dimagrire e tonificare</SelectItem>
                      <SelectItem value="forza">Aumentare la forza</SelectItem>
                      <SelectItem value="altro">Altro</SelectItem>
                    </SelectContent>
                  </Select>
                  {errors.obiettivo && <p className="mt-1 text-sm text-destructive">{errors.obiettivo}</p>}
                </div>

                <div>
                  <label htmlFor="messaggio" className="block text-sm font-medium text-foreground mb-2">
                    Messaggio
                  </label>
                  <Textarea
                    id="messaggio"
                    value={formData.messaggio}
                    onChange={(e) => handleChange("messaggio", e.target.value)}
                    className={errors.messaggio ? "border-destructive" : ""}
                    placeholder="Raccontaci di più..."
                    rows={4}
                  />
                  {errors.messaggio && <p className="mt-1 text-sm text-destructive">{errors.messaggio}</p>}
                </div>

                <Button 
                  type="submit" 
                  className="w-full font-display text-lg tracking-wider"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? "INVIO IN CORSO..." : "INVIA RICHIESTA"}
                </Button>
              </form>
            )}
          </section>
        </div>
      </div>
    </div>
  );
};

export default Contatti;

import { useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, Pause, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Carousel, CarouselContent, CarouselItem, type CarouselApi } from "@/components/ui/carousel";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import electrical from "@/assets/training-electrical.jpg";
import automotive from "@/assets/training-automotive.jpg";
import hospitality from "@/assets/training-hospitality.jpg";
import networking from "@/assets/training-networking.jpg";
import welding from "@/assets/training-welding.jpg";
import webDevelopment from "@/assets/training-web-development.jpg";

const slides = [
  { image: electrical, title: "Electrical training", caption: "Precision. Practice. Possibility.", alt: "Trainees and an instructor working at an electrical training bench" },
  { image: automotive, title: "Automotive training", caption: "Practical skills. Real-world confidence.", alt: "Trainees inspecting an engine with their automotive instructor" },
  { image: hospitality, title: "Hospitality & culinary", caption: "Craft. Creativity. Care.", alt: "Culinary trainees learning to plate food in a teaching kitchen" },
  { image: networking, title: "Networking", caption: "Connect systems. Build possibilities.", alt: "Networking trainees connecting cables to switches with their instructor" },
  { image: welding, title: "Welding", caption: "Strong skills. Lasting craftsmanship.", alt: "A trainee wearing protective equipment learning welding in a training workshop" },
  { image: webDevelopment, title: "Web Development", caption: "Create. Code. Bring ideas to life.", alt: "Web development trainees creating websites in a computer classroom" },
];

export function TrainingHeroCarousel({ centreName, onApply, onTrack }: { centreName?: string; onApply: () => void; onTrack: () => void }) {
  const [api, setApi] = useState<CarouselApi>();
  const [active, setActive] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [interacting, setInteracting] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    if (!api) return;
    const update = () => setActive(api.selectedScrollSnap());
    update();
    api.on("select", update);
    api.on("reInit", update);
    return () => { api.off("select", update); api.off("reInit", update); };
  }, [api]);

  useEffect(() => {
    if (!api || !playing || interacting || reducedMotion) return;
    const timer = window.setInterval(() => { if (!document.hidden) api.scrollNext(); }, 6500);
    return () => window.clearInterval(timer);
  }, [api, playing, interacting, reducedMotion]);

  const current = slides[active] ?? slides[0];
  return (
    <section className="training-hero" aria-label="Vocational training highlights">
      <Carousel opts={{ loop: true, duration: reducedMotion ? 0 : 35 }} setApi={setApi}
        aria-label="Training image carousel" tabIndex={0}
        onMouseEnter={() => setInteracting(true)} onMouseLeave={() => setInteracting(false)}
        onFocusCapture={() => setInteracting(true)}
        onBlurCapture={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setInteracting(false); }}>
        <CarouselContent className="ml-0">
          {slides.map((slide, index) => (
            <CarouselItem key={slide.title} className="pl-0" aria-label={`${index + 1} of ${slides.length}: ${slide.title}`}>
              <div className="training-hero-frame">
                <img src={slide.image} alt={slide.alt} width={1920} height={1024} loading={index === 0 ? "eager" : "lazy"} className="training-hero-image" />
              </div>
            </CarouselItem>
          ))}
        </CarouselContent>
        <div className="training-hero-shade pointer-events-none absolute inset-0" />
        <div className="pointer-events-none absolute inset-0">
          <div className="container mx-auto flex h-full items-center px-6 md:px-10">
            <div className="training-hero-copy pointer-events-auto max-w-xl space-y-5">
              <p className="text-sm font-medium uppercase">Your next chapter starts here</p>
              <h1 className="text-4xl font-bold leading-tight md:text-5xl lg:text-6xl">{centreName ? `Apply to ${centreName}` : "VTC Management System"}</h1>
              <p className="training-hero-description max-w-md text-base leading-relaxed md:text-lg">Build your future through vocational training. Apply to your chosen centre and follow your journey from application to registration.</p>
              <div className="flex flex-wrap gap-3 pt-2">
                <Button size="lg" onClick={onApply}>Start an application <ArrowRight /></Button>
                <Button size="lg" variant="outline" className="text-foreground" onClick={onTrack}>Track my application</Button>
              </div>
            </div>
          </div>
        </div>
        <div className="training-hero-caption pointer-events-none absolute bottom-5 right-6 hidden text-right md:block md:right-10">
          <p className="text-sm">{current.title}</p>
          <p className="mt-1 text-lg font-semibold">{current.caption}</p>
        </div>
      </Carousel>
      <div className="border-b bg-card">
        <div className="container mx-auto flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-2 md:px-10">
          <div className="min-w-0 basis-full sm:flex-1 sm:basis-auto" aria-live="polite" aria-atomic="true">
            <p className="text-sm font-semibold text-foreground">{current.title} <span className="ml-2 text-xs font-normal tabular-nums text-muted-foreground">{active + 1} / {slides.length}</span></p>
          </div>
          <div className="flex max-w-full flex-wrap items-center gap-x-2 gap-y-1">
          <div className="flex flex-wrap items-center" role="group" aria-label="Choose a course">
            {slides.map((slide, index) => (
              <Tooltip key={slide.title}><TooltipTrigger asChild>
                <Button size="icon" variant="ghost" onClick={() => api?.scrollTo(index)} aria-label={`Show ${slide.title}`} aria-pressed={active === index}
                  className="h-7 w-7 shrink-0 rounded-full p-0">
                  <span aria-hidden="true" className={`h-1.5 rounded-full transition-[width] motion-reduce:transition-none ${active === index ? "w-4 bg-primary" : "w-1.5 bg-muted-foreground/40"}`} />
                </Button>
              </TooltipTrigger><TooltipContent>{slide.title}</TooltipContent></Tooltip>
            ))}
          </div>
          <div className="flex shrink-0 items-center">
            {[{ label: "Previous image", icon: ArrowLeft, action: () => api?.scrollPrev() }, { label: "Next image", icon: ArrowRight, action: () => api?.scrollNext() },
              ...(!reducedMotion ? [{ label: playing ? "Pause slideshow" : "Play slideshow", icon: playing ? Pause : Play, action: () => setPlaying(!playing) }] : [])].map(({ label, icon: Icon, action }) => (
                <Tooltip key={label}><TooltipTrigger asChild><Button size="icon" variant="ghost" aria-label={label} onClick={action} className="h-8 w-8"><Icon className="h-4 w-4" /></Button></TooltipTrigger><TooltipContent>{label}</TooltipContent></Tooltip>
              ))}
          </div>
          </div>
        </div>
      </div>
    </section>
  );
}
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
import webdev from "@/assets/training-webdev.jpg";
import plumbing from "@/assets/training-plumbing.jpg";
import carpentry from "@/assets/training-carpentry.jpg";
import solar from "@/assets/training-solar.jpg";
import baking from "@/assets/training-baking.jpg";

const slides = [
  { image: electrical, title: "Electrical training", caption: "Precision. Practice. Possibility.", alt: "Trainees and an instructor working at an electrical training bench" },
  { image: automotive, title: "Automotive training", caption: "Practical skills. Real-world confidence.", alt: "Trainees inspecting an engine with their automotive instructor" },
  { image: hospitality, title: "Hospitality & culinary", caption: "Craft. Creativity. Care.", alt: "Culinary trainees learning to plate food in a teaching kitchen" },
  { image: networking, title: "Networking", caption: "Connect. Configure. Communicate.", alt: "Trainees and an instructor working with server racks and network cables" },
  { image: welding, title: "Welding & fabrication", caption: "Strong hands. Strong futures.", alt: "A trainee welding metal with sparks while an instructor supervises" },
  { image: webdev, title: "Web development", caption: "Code. Create. Launch.", alt: "Trainees coding websites on laptops in a modern computer classroom" },
  { image: plumbing, title: "Plumbing", caption: "Skill. Precision. Reliability.", alt: "A trainee installing copper pipes on a training rig with an instructor" },
  { image: carpentry, title: "Carpentry & joinery", caption: "Measure twice. Build once.", alt: "Trainees measuring and cutting timber in a woodworking workshop" },
  { image: solar, title: "Solar & renewable energy", caption: "Powering tomorrow, today.", alt: "Trainees installing a solar panel on a training roof rig" },
  { image: baking, title: "Baking & pastry", caption: "Rise to the occasion.", alt: "A trainee in chef whites baking bread and pastries in a training kitchen" },
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
                <img src={slide.image} alt={slide.alt} width={1280} height={720} loading={index === 0 ? "eager" : "lazy"} className="training-hero-image" />
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
        <div className="container mx-auto flex items-center justify-between gap-3 px-4 py-2 md:px-10">
          <div className="flex min-w-0 flex-1 items-center gap-2" role="tablist" aria-label="Choose a course slide">
            {slides.map((slide, index) => (
              <button key={slide.title} type="button" role="tab" aria-selected={active === index} aria-label={`Show ${slide.title}`}
                onClick={() => api?.scrollTo(index)}
                className={`h-2.5 rounded-full transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${active === index ? "w-6 bg-primary" : "w-2.5 bg-muted-foreground/30 hover:bg-muted-foreground/50"}`} />
            ))}
            <span className="ml-2 hidden whitespace-nowrap text-xs text-muted-foreground sm:inline">{current.title}</span>
          </div>
          <div className="flex shrink-0 items-center gap-1 md:gap-2">
            {[{ label: "Previous image", icon: ArrowLeft, action: () => api?.scrollPrev() }, { label: "Next image", icon: ArrowRight, action: () => api?.scrollNext() },
              ...(!reducedMotion ? [{ label: playing ? "Pause slideshow" : "Play slideshow", icon: playing ? Pause : Play, action: () => setPlaying(!playing) }] : [])].map(({ label, icon: Icon, action }) => (
                <Tooltip key={label}><TooltipTrigger asChild><Button size="icon" variant="ghost" aria-label={label} onClick={action} className="h-9 w-9"><Icon /></Button></TooltipTrigger><TooltipContent>{label}</TooltipContent></Tooltip>
              ))}
          </div>
        </div>
      </div>
    </section>
  );
}

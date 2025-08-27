import Head from 'next/head';
import { useState, useRef, useEffect } from "react";
import { ChevronDown, ArrowRight, FileText, Layers, CheckCircle2, Sparkles } from "lucide-react";

// TPA Homepage — merged: SVG logo + final nav/copy + AGPL footer

// Accessible popover menu for desktop
function DesktopPopover({ id, label, tooltip, active, onOpen, onClose, children }) {
  const ref = useRef(null);
  useEffect(() => {
    function handleKey(e){
      if (e.key === 'Escape') onClose();
    }
    if (active) document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [active, onClose]);
  return (
    <div className="relative" ref={ref}>
      <button
        className={`inline-flex items-center gap-1 px-3 py-2 text-sm font-medium ${active ? 'text-zinc-900' : 'text-zinc-800 hover:text-zinc-900'}`}
        aria-haspopup="true"
        aria-expanded={active}
        title={tooltip}
        onClick={() => (active ? onClose() : onOpen(id))}
      >
        {label}
        <ChevronDown className={`h-4 w-4 transition-transform ${active ? 'rotate-180' : ''}`} />
      </button>
      {active && (
        <div
          role="menu"
          className="absolute left-0 mt-2 min-w-[260px] rounded-md border border-zinc-200 bg-white shadow-lg z-50 animate-fadeIn"
        >
          <div className="py-1">{children}</div>
        </div>
      )}
    </div>
  );
}

function MenuItem({ title, desc, href }) {
  return (
    <a href={href} className="block px-4 py-2.5 hover:bg-zinc-50" role="menuitem">
      <div className="text-sm font-medium text-zinc-900">{title}</div>
      <div className="text-xs text-zinc-600">{desc}</div>
    </a>
  );
}

function SplitCTA() {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <div className="isolate inline-flex shadow-sm">
        <a
          href="/tool/development-management"
          className="inline-flex items-center gap-2 rounded-l-md bg-amber-500 px-4 py-2 text-sm font-semibold text-black hover:bg-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-600"
          title="Jump straight into the sandbox"
        >
          Start now <ArrowRight className="h-4 w-4" />
        </a>
        <button
          onClick={() => setOpen(!open)}
          aria-haspopup="menu"
          aria-expanded={open}
          className="rounded-r-md bg-amber-500 px-2 text-black hover:bg-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-600"
          title="Pick a mode"
        >
          <ChevronDown className="h-4 w-4" />
        </button>
      </div>
      {open && (
        <div role="menu" className="absolute right-0 mt-2 w-64 rounded-md border border-zinc-200 bg-white shadow-lg z-50">
          <div className="py-1">
            <MenuItem title="Assess an application" desc="Step through a planning application assessment." href="/tool/development-management" />
            <MenuItem title="Explore a local plan" desc="Review or model a local plan scenario." href="/tool/local-plan" />
          </div>
        </div>
      )}
    </div>
  );
}

function Header() {
  const [activeMenu, setActiveMenu] = useState(null); // desktop
  const [mobileOpen, setMobileOpen] = useState(false);
  const [mobileSections, setMobileSections] = useState({ try:false, help:false });

  // Close menus on outside click (desktop)
  useEffect(() => {
    function handleClick(e){
      if (!e.target.closest || !e.target.closest('[data-desktop-nav-root]')) {
        setActiveMenu(null);
      }
    }
    if (activeMenu) document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, [activeMenu]);

  return (
    <header className="sticky top-0 z-40 bg-white/90 backdrop-blur border-b border-zinc-200">
      <div className="mx-auto max-w-6xl h-16 px-4 sm:px-6 flex items-center justify-between" data-desktop-nav-root>
        {/* Logo left-aligned with your SVG */}
        <a href="/" className="flex items-center gap-2 font-semibold text-zinc-900" aria-label="The Planner's Assistant home">
          <span className="inline-flex items-center">
            <svg
              className="shrink-0"
              width="28"
              height="24"
              viewBox="0 0 100 85"
              xmlns="http://www.w3.org/2000/svg"
              aria-hidden="true"
              focusable="false"
            >
              <title>Shorter Map Pin Icon with 8-Point Compass Rose</title>
              <desc>A deep navy, flat-style map pin with a proportionally reduced height below the compass rose. Features smooth curves and an obtuse point. Contains a detailed golden yellow 8-point compass rose with significantly shorter, wider-based intercardinal points.</desc>
              <path id="pin-background" d="M 50 80 C 35 70, 15 55, 15 35 A 35 35 0 1 1 85 35 C 85 55, 65 70, 50 80 Z" fill="#1C2C4C" stroke="none"></path>
              <g id="compass-rose" transform="translate(0, -15)">
                <path d="M 37.3 37.3 A 18 18 0 0 1 62.7 37.3" stroke="#FFD100" strokeWidth="4" fill="none"></path>
                <path d="M 62.7 37.3 A 18 18 0 0 1 62.7 62.7" stroke="#FFD100" strokeWidth="4" fill="none"></path>
                <path d="M 62.7 62.7 A 18 18 0 0 1 37.3 62.7" stroke="#FFD100" strokeWidth="4" fill="none"></path>
                <path d="M 37.3 62.7 A 18 18 0 0 1 37.3 37.3" stroke="#FFD100" strokeWidth="4" fill="none"></path>
                <polygon points="50,22 53,50 47,50" fill="#FFD100"></polygon>
                <polygon points="50,78 53,50 47,50" fill="#FFD100"></polygon>
                <polygon points="76,50 50,52.5 50,47.5" fill="#FFD100"></polygon>
                <polygon points="24,50 50,52.5 50,47.5" fill="#FFD100"></polygon>
                <polygon points="56.4,43.6 54,50 50,46" fill="#FFD100"></polygon>
                <polygon points="56.4,56.4 50,54 54,50" fill="#FFD100"></polygon>
                <polygon points="43.6,56.4 46,50 50,54" fill="#FFD100"></polygon>
                <polygon points="43.6,43.6 50,46 46,50" fill="#FFD100"></polygon>
                <circle cx="50" cy="50" r="3" fill="#1C2C4C"></circle>
              </g>
            </svg>
          </span>
          <span className="hidden sm:inline">The Planner's Assistant</span>
        </a>
        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-2">
          <DesktopPopover
            id="try"
            label="Try the tool"
            tooltip="Open the Planner's Assistant sandbox."
            active={activeMenu==='try'}
            onOpen={setActiveMenu}
            onClose={() => setActiveMenu(null)}
          >
            <MenuItem title="Assess an application" desc="Upload docs and walk a DM case." href="/tool/development-management" />
            <MenuItem title="Explore a local plan" desc="Review or model a plan scenario." href="/tool/local-plan" />
          </DesktopPopover>
          <DesktopPopover
            id="help"
            label="Help build it"
            tooltip="Ways to contribute code, data, or ideas."
            active={activeMenu==='help'}
            onOpen={setActiveMenu}
            onClose={() => setActiveMenu(null)}
          >
            <MenuItem title="Open tasks" desc="Small, well-defined tasks to start now." href="/contribute/tasks" />
            <MenuItem title="Full design brief" desc="The complete technical & design plan." href="/contribute/spec" />
            <MenuItem title="Run it on your computer" desc="Clone & run locally (needs API key)." href="/contribute/run-locally" />
          </DesktopPopover>
          <a href="/about" className="px-3 py-2 text-sm text-zinc-800 hover:text-zinc-900" title="The academic story, open-source ethos, and guardrails.">Why this exists</a>
        </nav>
        {/* Mobile hamburger */}
        <button
          className="md:hidden inline-flex items-center justify-center w-10 h-10 rounded-md border border-zinc-300 text-zinc-700 hover:bg-white"
          onClick={()=>setMobileOpen(o=>!o)}
          aria-label="Toggle navigation menu"
          aria-expanded={mobileOpen}
        >
          <span className="sr-only">Menu</span>
          <div className="space-y-1.5">
            <span className={`block h-0.5 w-5 bg-current transition-transform ${mobileOpen ? 'translate-y-1.5 rotate-45' : ''}`}></span>
            <span className={`block h-0.5 w-5 bg-current transition-opacity ${mobileOpen ? 'opacity-0' : 'opacity-100'}`}></span>
            <span className={`block h-0.5 w-5 bg-current transition-transform ${mobileOpen ? '-translate-y-1.5 -rotate-45' : ''}`}></span>
          </div>
        </button>
        <div className="flex items-center gap-3">
          <SplitCTA />
        </div>
      </div>
      {mobileOpen && (
        <div className="md:hidden border-t border-zinc-200 bg-white/95 backdrop-blur px-4 sm:px-6 py-4 space-y-4 animate-fadeIn">
          <div>
            <button
              className="w-full flex items-center justify-between py-2 text-sm font-medium text-zinc-800"
              onClick={()=>setMobileSections(s=>({...s, try:!s.try}))}
              aria-expanded={mobileSections.try}
            >
              <span>Try the tool</span>
              <ChevronDown className={`h-4 w-4 transition-transform ${mobileSections.try?'rotate-180':''}`} />
            </button>
            {mobileSections.try && (
              <div className="pl-2 border-l border-zinc-200 space-y-1 mt-2">
                <a href="/tool/development-management" className="block text-sm py-1.5 text-zinc-700 hover:text-zinc-900">Assess an application</a>
                <a href="/tool/local-plan" className="block text-sm py-1.5 text-zinc-700 hover:text-zinc-900">Explore a local plan</a>
              </div>
            )}
          </div>
          <div>
            <button
              className="w-full flex items-center justify-between py-2 text-sm font-medium text-zinc-800"
              onClick={()=>setMobileSections(s=>({...s, help:!s.help}))}
              aria-expanded={mobileSections.help}
            >
              <span>Help build it</span>
              <ChevronDown className={`h-4 w-4 transition-transform ${mobileSections.help?'rotate-180':''}`} />
            </button>
            {mobileSections.help && (
              <div className="pl-2 border-l border-zinc-200 space-y-1 mt-2">
                <a href="/contribute/tasks" className="block text-sm py-1.5 text-zinc-700 hover:text-zinc-900">Open tasks</a>
                <a href="/contribute/spec" className="block text-sm py-1.5 text-zinc-700 hover:text-zinc-900">Full design brief</a>
                <a href="/contribute/run-locally" className="block text-sm py-1.5 text-zinc-700 hover:text-zinc-900">Run it locally</a>
              </div>
            )}
          </div>
          <a href="/about" className="block text-sm py-1.5 text-zinc-700 hover:text-zinc-900">Why this exists</a>
        </div>
      )}
    </header>
  );
}

function Hero() {
  return (
    <section className="bg-zinc-50">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 py-10 lg:py-16 grid lg:grid-cols-2 gap-10 items-center">
        <div>
          <h1 className="text-4xl/tight sm:text-5xl font-extrabold text-zinc-900">
            AI-assisted planning, from first idea to signed-off report.
          </h1>
          <p className="mt-4 text-lg text-zinc-700 max-w-xl">
            Analyse proposals, explore local plans, and test scenarios — all in one open, explainable tool, grounded in real policy and mapped data.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <SplitCTA />
            <a href="/contribute/tasks" className="inline-flex items-center gap-2 rounded-md border border-zinc-300 px-5 py-2 text-sm font-medium text-zinc-900 hover:bg-white">Help build it</a>
          </div>
        </div>
        <div className="rounded-xl border border-zinc-200 bg-white shadow-sm p-6">
          <div className="text-sm font-medium text-zinc-800">What you'll see</div>
          <ul className="mt-3 grid gap-2 text-sm text-zinc-700">
            <li className="flex items-start gap-2"><FileText className="mt-0.5 h-4 w-4 text-amber-700"/> Upload plans (PDF/PNG/SVG) or paste GeoJSON</li>
            <li className="flex items-start gap-2"><Layers className="mt-0.5 h-4 w-4 text-amber-700"/> Run checks: plot ratio, overlooking, daylight proxies, policy matches</li>
            <li className="flex items-start gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-700"/> Get an officer-style draft with paragraph-level citations</li>
          </ul>
          <div className="mt-4 rounded-lg border border-zinc-200 bg-[linear-gradient(135deg,#e9edf3,white)] grid place-items-center aspect-video">
            <span className="text-zinc-700 text-sm">Sandbox preview</span>
          </div>
        </div>
      </div>
    </section>
  );
}

function Workflows() {
  return (
    <section className="bg-white">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 py-10 lg:py-16">
        <h2 className="text-3xl sm:text-4xl font-bold text-zinc-900">Two big workflows</h2>
        <div className="mt-8 grid gap-6 md:grid-cols-2">
          <div className="rounded-xl border border-[#1C2C4C] bg-[#1C2C4C] p-6 shadow-sm text-white">
            <div className="text-sm font-semibold text-white">Development Management</div>
            <ul className="mt-3 space-y-2 text-white/90 text-sm">
              <li>• Upload plans, statements, and maps</li>
              <li>• Check heights, daylight, overlooking, parking, and more</li>
              <li>• See relevant policies and constraints — with clickable sources</li>
              <li>• Export a draft officer-style report you can edit</li>
            </ul>
          </div>
          <div className="rounded-xl border border-[#1C2C4C] bg-[#1C2C4C] p-6 shadow-sm text-white">
            <div className="text-sm font-semibold text-white">Local Plan</div>
            <ul className="mt-3 space-y-2 text-white/90 text-sm">
              <li>• Import policies, evidence base, and site allocations</li>
              <li>• Map capacity, density, and constraints in one view</li>
              <li>• Spot policy gaps, overlaps, and conflicts</li>
              <li>• Generate clear summaries for topic papers or consultation</li>
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}

function Differentiators() {
  const items = [
    { title: "All evidence is linked", desc: "Every policy paragraph, map layer, and calculation is cited.", icon: CheckCircle2 },
    { title: "Runs locally", desc: "Works in your browser by default — no accounts, no cookies.", icon: Sparkles },
    { title: "Open & adaptable", desc: "AGPLv3. Councils, communities, and researchers can extend it.", icon: FileText },
    { title: "Expandable checks", desc: "Add your own datasets or analysis modules over time.", icon: Layers },
  ];
  return (
    <section className="bg-zinc-50">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 py-10 lg:py-16">
        <h2 className="text-3xl sm:text-4xl font-bold text-zinc-900">What makes it different</h2>
        <div className="mt-8 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {items.map(({ title, desc, icon:Icon }) => (
            <div key={title} className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
              <div className="h-10 w-10 rounded-full bg-amber-500/20 text-amber-700 grid place-items-center"><Icon className="h-5 w-5"/></div>
              <h3 className="mt-4 text-lg font-semibold text-zinc-900">{title}</h3>
              <p className="mt-2 text-zinc-600 text-sm">{desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function CapabilityCatalogue() {
  const items = [
    { title: "Policy checks", desc: "National and local policies with changes tracked across versions." },
    { title: "Spatial checks", desc: "Distances, heights, frontage length, and daylight proxies." },
    { title: "Design cues", desc: "Massing, rhythm, materials, mapped to design codes." },
    { title: "Evidence parsing", desc: "Transport, flood risk, viability, and heritage summaries." },
    { title: "Precedent search", desc: "Appeal and committee decisions by issue." },
    { title: "Data sources", desc: "MHCLG constraints, LPA packs, and your uploads; optional live fetch with your API key." },
  ];
  return (
    <section className="bg-white">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 py-10 lg:py-16">
        <h2 className="text-3xl sm:text-4xl font-bold text-zinc-900">Built for real planning work</h2>
        <div className="mt-8 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {items.map(({ title, desc }) => (
            <div key={title} className="rounded-xl border border-[#1C2C4C] bg-[#1C2C4C] p-6 shadow-sm text-white">
              <h3 className="text-lg font-semibold text-white">{title}</h3>
              <p className="mt-2 text-white/80 text-sm">{desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function ComingSoon() {
  const items = [
    "Automated design code scoring",
    "Biodiversity net gain and tree canopy mapping",
    "Transport network and access modelling",
    "Side-by-side precedent comparisons in reports",
  ];
  return (
    <section className="bg-zinc-50">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 py-10 lg:py-16">
        <h2 className="text-3xl sm:text-4xl font-bold text-zinc-900">Coming soon</h2>
        <ul className="mt-6 grid md:grid-cols-2 lg:grid-cols-4 gap-4 text-sm text-zinc-700">
          {items.map((t) => (
            <li key={t} className="rounded-xl border border-[#1C2C4C] bg-[#1C2C4C] p-5 shadow-sm text-white">{t}</li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function CallToContribute() {
  return (
    <section className="bg-zinc-900 text-white">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 py-12 lg:py-16 grid lg:grid-cols-[1.2fr,0.8fr] gap-8 items-center">
        <div>
          <h2 className="text-3xl sm:text-4xl font-bold">Help build a planning tool the public can trust.</h2>
          <p className="mt-4 text-white/85 max-w-2xl">This is an academic project — not a commercial product. If you've got skills in planning, civic tech, geospatial analysis, or UI design, you can make a real impact here.</p>
        </div>
        <div className="flex flex-wrap gap-3 lg:justify-end">
          <a href="/contribute/tasks" className="inline-flex items-center gap-2 rounded-md bg-amber-500 px-5 py-2.5 text-sm font-semibold text-black shadow-sm hover:bg-amber-400">See open tasks <ArrowRight className="h-4 w-4"/></a>
          <a href="mailto:hello@theplannersassistant.uk" className="inline-flex items-center gap-2 rounded-md border border-white/30 px-5 py-2.5 text-sm font-medium text-white/90 hover:bg-white/10">Email us</a>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="bg-[#182430] text-white">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 h-20 flex items-center justify-between text-sm">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center">
            <svg
              className="shrink-0"
              width="20"
              height="18"
              viewBox="0 0 100 85"
              xmlns="http://www.w3.org/2000/svg"
              aria-hidden="true"
              focusable="false"
            >
              <path id="pin-background" d="M 50 80 C 35 70, 15 55, 15 35 A 35 35 0 1 1 85 35 C 85 55, 65 70, 50 80 Z" fill="#ffffff" opacity="0.95" stroke="none"></path>
            </svg>
          </span>
          <span className="text-white/90">© {new Date().getFullYear()} The Planner's Assistant • Licensed under GNU AGPLv3</span>
        </div>
        <nav className="flex items-center gap-4 text-white/80">
          <a href="/contribute/tasks" className="hover:text-white">Open tasks</a>
          <a href="/contribute/spec" className="hover:text-white">Design brief</a>
          <a href="/about" className="hover:text-white">Why this exists</a>
        </nav>
      </div>
    </footer>
  );
}

export default function Home() {
  return (
    <>
      <Head>
        <title>The Planner's Assistant - AI-assisted planning tools</title>
        <meta name="description" content="AI-assisted planning, from first idea to signed-off report. Analyse proposals, explore local plans, and test scenarios — all in one open, explainable tool." />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <div className="min-h-screen bg-white text-zinc-900">
        <Header />
        <Hero />
        <Workflows />
        <Differentiators />
        <CapabilityCatalogue />
        <ComingSoon />
        <CallToContribute />
        <Footer />
      </div>
    </>
  );
}
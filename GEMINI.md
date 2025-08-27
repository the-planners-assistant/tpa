# The Planner’s Assistant (TPA) — Canonical Design Document v3.1

**Purpose:** A single, contradiction-free design blueprint for The Planner’s Assistant MVP. This unifies technical, UX, and visual specs into one coherent reference.

---

## **1. Core Intent**

TPA is an **evidence-driven planning reasoning assistant**. It helps planning officers and policy teams get from **planning documents → draft officer report** in minutes, while keeping every claim **traceable**, **adjustable**, and **under planner control**.

> **Tagline:**
> *"From documents to draft report in minutes — evidence-first, transparent, and under your control."*

---

## **2. MVP Objective**

Deliver a **working demo** where a planner can:

1. Upload a stack of PDFs (e.g. DAS, plans, reports) or use a sample dataset.
2. Automatically parse, embed, and index them locally.
3. Generate a **suggested draft officer report** in under **10 minutes**.
4. **Review, adjust, and refine** via:

   * Planning balance widgets (policy weight sliders).
   * One-click evidence previews for policies, constraints, and precedent.
5. Export the draft as Markdown or PDF, with an optional evidence appendix.

---

## **3. Design Priorities**

| Priority                     | Implication                                                                |
| ---------------------------- | -------------------------------------------------------------------------- |
| **Speed**                    | Auto-parsing and embedding happen silently; progress shown but tucked away |
| **Transparency on demand**   | Evidence previews and provenance chips always available in one click       |
| **Credibility**              | Clean, professional design — no prototype vibes                            |
| **Colourful but restrained** | Subtle accenting and highlights for clarity, not decoration                |
| **Accessibility**            | WCAG AA compliant; full keyboard nav; screen-reader-friendly               |

---

## **4. MVP Scope**

### **4.1 In Scope**

* **Planning document upload** (multi-PDF).

* **Local parsing and embedding** with transformers.js + onnxruntime-web.

* **Hybrid retrieval** combining:

  * Document chunks
  * Parsed policy metadata
  * Site constraints (GeoJSON)
  * Sample PINS precedents

* **First-draft officer report generation**:

  * Suggested recommendation (approve/refuse/defer)
  * Reasoning steps grouped by topic
  * Collapsible provenance chips

* **Planning balance widget**:

  * Horizontal sliders adjust weight of key material considerations
  * Live update of recommendation and narrative

* **Interactive map**:

  * Site boundary + constraint overlays
  * Selectable features attachable as evidence

* **Export**:

  * Markdown and PDF with optional evidence appendix

* **Background visuospatial analysis**: auto-compute site–constraint overlaps (intersections & coverage %), proximities (buffers to stations/centres/assets), and basic site metrics (area, frontage length, plot ratio). Results surface as **spatial evidence chips** and inform the first-draft reasoning and planning-balance weights.

### **4.2 Deferred**

* Automated Local Plan drafting
* Negotiation sandbox
* Full precedent ingest pipeline
* Vision-based design code parsing (stub only for MVP)

---

## **5. Technical Architecture**

### **5.1 Monorepo Layout**

```
tpa/
  apps/
    web/       # Next.js app (public site + demo)
    lab/       # Experimental playground (feature-flagged)
  packages/
    ui/        # shadcn/ui + Tailwind components + tokens
    core/      # domain models, Dexie schema, retrieval logic
    nlp/       # ONNX + transformers.js embedder, reranker
    map/       # MapLibre components, layer registry, styling
    fixtures/  # sample PDFs, policies, constraints, precedents
```

\$1

### **5.3 Background Visuospatial Analysis (MVP)**

**Inputs**: Site polygon (required); optional proposed footprints/massing (GeoJSON); constraint layers from fixtures (e.g., conservation areas, flood zones, heritage assets, town centres, PTAL proxy via station buffers).

**Computations (run in Web Workers via Turf.js):**

* **Intersections**: which constraints overlap the site; area & % coverage per layer.
* **Proximities**: nearest station/centre/asset with distances (straight-line for MVP).
* **Site metrics**: site area, perimeter, frontage length on primary road, crude plot ratio (using provided or inferred GFA when available).
* **Triggers**: derive policy relevance flags from overlaps/proximities (e.g., in Conservation Area ⇒ weight heritage higher).

**Outputs**:

* **Spatial evidence items** (chips) auto-attached to the draft report (e.g., "Site overlaps Conservation Area by 32%", "150m to District Line station").
* **Layer highlights** in Map view corresponding to each evidence item.

**Performance targets**: < 2s for intersections/proximities on ≤20 layers; all work off-thread; UI never blocks.

**Notes**: Vision-based plan parsing (heights/setbacks from drawings) remains deferred; MVP relies on vector layers in `fixtures/` and optional user-provided GeoJSON.

---

## **6. UX Flows**

### **6.1 Demo Wizard**

**Goal:** Get to first draft fast.

**Flow:**

1. **Step 1 — Load data**:

   * Upload PDFs or choose sample dataset.
   * Minimal visible friction.
2. **Step 2 — Auto process**:

   * Parse → embed → index silently.
   * Show progress bar if user wants to watch.
3. **Step 3 — Draft ready**:

   * “Your suggested officer report is ready.”
   * CTA = **Review & Refine**.

---

### **6.2 Draft Officer Report**

**Goal:** Show the AI’s first draft clearly, with transparency one click away.

**Layout:**

* **Center:** Generated officer report.
* **Inline provenance chips** on claims link to evidence.
* **Top-right:** Export panel.
* **Right sidebar:**

  * Planning balance sliders.
  * Live recommendation impact.
* **Collapsible panels** for policies, constraints, and precedent.

---

### **6.3 Planning Balance Widgets**

* Horizontal sliders for key considerations: design, heritage, daylight, transport, etc.
* Adjusting sliders:

  * Recalculates AI’s recommendation live.
  * Highlights which reasoning steps are most affected.

---

### **6.4 Evidence on Demand**

* Provenance chips visible inline:

  * Policy IDs, constraint names, document excerpts, PINS references.
* Click → evidence side panel opens:

  * Summary + snippet + “open source” button.
* No evidence hidden, but never clutters primary flow.

---

### **6.5 Export**

* Export as Markdown or PDF.
* Include appendix of attached evidence (optional toggle).
* Export modal previews report live.

---

## **7. Visual Language**

### **7.1 Aesthetic Goals**

* **Professional, confident, and neutral**.
* **Colourful but restrained**: accent-driven highlights.
* **Subtle motion**: microinteractions make actions feel “assisted,” not noisy.

### **7.2 Design Tokens**

| Token    | Value   | Usage                |
| -------- | ------- | -------------------- |
| `bg`     | #F8F9FA | App background       |
| `fg`     | #111827 | Primary text         |
| `accent` | #4F46E5 | Buttons, highlights  |
| `ok`     | #10B981 | Success states       |
| `warn`   | #F59E0B | Low-confidence steps |
| `danger` | #EF4444 | Errors               |

### **7.3 Typography**

* **Font:** Inter or SF Pro.
* **Hierarchy:**

  * h1: 32px / 600
  * h2: 24px / 600
  * body: 16px / 400
  * small: 14px / 400

### **7.4 Motion Specs**

* **Progress indicators**: smooth ease-in-out, <250ms.
* **Evidence chips**: subtle float-in when attached.
* **Panel transitions**: fade + slide, <200ms.

---

## **8. Transparency vs Magic**

* **Default UX = magic**: PDFs in → draft report out, no config.
* **On-demand transparency**:

  * One click shows which policies, constraints, precedent, and chunks informed each claim.
  * Inline provenance + evidence panels make the AI’s reasoning visible without overwhelming.

---

\$1| **Spatial evidence auto-generated** | ≥5 spatial facts (overlaps or proximities) are computed and referenced in the draft; map highlights match evidence chips |

---

## **10. Roadmap**

| Milestone | Deliverable                          | ETA    |
| --------- | ------------------------------------ | ------ |
| **M1**    | Monorepo scaffold + UI tokens        | Week 1 |
| **M2**    | Parsing + embedding pipeline         | Week 2 |
| **M3**    | Draft report generation + provenance | Week 3 |
| **M4**    | Planning balance widgets + export    | Week 4 |
| **M5**    | Polish + test + docs                 | Week 5 |

---

## **11. Future Extensions**

* Automated precedent ingestion pipeline.
* Vision-based plan and design code parsing.
* Negotiation sandbox for live “what-if” policy weighting.
* Multi-application comparison dashboard.

---

**End of Canonical Design Document**

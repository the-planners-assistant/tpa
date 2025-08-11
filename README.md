# The Planner’s Assistant — Main Repository

**Planner-first. Local-first. Open.**
This is the home of the next release of **The Planner’s Assistant** — a browser-based AI toolkit for UK planning that keeps reasoning visible, data open, and planners in control.

---

## Vision

Build the tool planners actually need:

* **Planner-first UX** for development management, scenario modelling, and local plan work.
* **Local-first architecture** that runs in the browser with static hosting.
* **Explainable AI** with traceable sources and auditable reasoning.
* **Open data + open code** to strengthen trust, scrutiny, and reuse.

---

## What it will do

### Core Modes

* **Development Management**
  Upload applications (PDFs/CGIs), parse to chunks, map constraints, and draft **officer-style reports** with provenance.
* **Policy Mode**
  Search and author policies, traverse **cross-references as a graph**, and surface material considerations.
* **Site Allocation & Scenario Modelling**
  Combine sites, policies, and goals; assess interactions and track implications.
* **Goal Tracking**
  Monitor delivery against plan targets and strategic objectives.
* **Precedent / Appeals**
  Retrieve relevant appeal decisions to inform judgement (with vector search).

### Spatial & Data

* **Constraint overlays** from MHCLG and other public layers.
* **Hybrid search** (semantic + spatial + filters) over policies, sites, and docs.
* **Offline-ready** — once loaded, core tools work without a network.

### AI & Reasoning

* **Local embeddings + in-browser RAG** (transformers.js + onnxruntime-web).
* **Optional cloud LLMs** via user-supplied API key (kept client-side).
* **Argumentation support**: material considerations, balance notes, and **reasoning trace** tied to sources.
* **VLM-assisted plan interpretation** (design codes, massing cues, frontage rhythm — explainable checks, not black-box).

### Viability & Agreements

* **Early-signal viability logic** feeding **draft S106 heads of terms** (configurable, not prescriptive).

### Governance & Audit

* **Provenance everywhere**: each statement links back to policy text, spatial layer, or document fragment.
* **Versioned reasoning & edits** for transparent officer/AI collaboration.
* **Accessibility** aligned with GOV.UK standards.

---

## Principles

* **No proprietary backend required** for v0.x — static hosting is enough.
* **Planner control**: AI is assistive, optional, and inspectable.
* **Security-aware**: treat uploads as untrusted; minimise data movement.
* **Modular**: swap model backends, parsers, and data sources cleanly.

---

## High-level Architecture (v3)

* **Apps**

  * `apps/demo` – interactive planning demo (map-centric)
  * `apps/site` – marketing/docs (optional)
* **Packages**

  * `packages/core` – domain models, policy/site/application types
  * `packages/retriever` – hybrid search, chunk stores, provenance
  * `packages/embeddings` – local embeddings + adapters for cloud LLMs
  * `packages/spatial` – MapLibre/Turf helpers, constraint pipelines
  * `packages/ui` – shared components (panels, inspectors, graph viewer)
  * `packages/ingest` – PDF parsing, chunking, metadata extraction
* **Tooling**

  * `tooling/scripts` – ingest, dev data, sanity checks

> Tech stack: Svelte + Vite + TypeScript, Tailwind, MapLibre, Turf.js, Dexie + entity-db, transformers.js + onnxruntime-web.

### How it fits together

```
[apps/*] UI
   │ uses
[packages/ui] components ──┬──► [packages/retriever] query/orchestrate
   │                        │        │
   │                        │        ├──► [packages/embeddings] (local) ── optional ► cloud LLM
   │                        │        └──► [packages/spatial] geoprocessing
   │                        │
   └──► [packages/core] types & domain logic
            │
            └──► Dexie/entity-db (browser storage) ⇄ chunk stores/provenance
                      ▲
                      └── [packages/ingest] PDF→chunks→metadata
```

* **Ingest → Store**: `packages/ingest` parses PDFs to chunks + metadata, saved in Dexie/entity-db.
* **Types everywhere**: `packages/core` defines shared domain types used across all packages.
* **Query & reasoning**: `packages/retriever` performs hybrid search, assembles provenance, and orchestrates AI calls.
* **Embeddings**: `packages/embeddings` provides local models; can optionally call a cloud LLM with a user key.
* **Spatial**: `packages/spatial` handles geoprocessing (buffers, intersects, tiling) and constraint overlays.
* **UI**: `packages/ui` renders inspectors, maps, graphs; `apps/demo` wires screens and routes together.

---

## Roadmap at a Glance

* Map-centric DM workflow (upload → parse → constraints → draft report)

* Policy authoring and graph explorer (cross-refs, material considerations)

* Hybrid search (semantic + bbox/polygon + filters)

* VLM checkers for design-code-style cues (explainable outputs)

* Viability signals + S106 draft template engine

* Appeals/precedent vector retrieval with citations

* Provenance-linked, versioned report editor

* Accessibility passes and keyboard-first UX

---

## Contributing

Issues and PRs welcome — particularly from **planners**, **UX designers**, and **geospatial/AI** folks.
Please start with an issue to discuss scope before large changes.

---

## License

**AGPL-3.0** — improvements to deployed versions must remain open.

---

### Repo tagline (for the pinned description)

> *Planner-first, local-first AI for UK planning — map-centric workflows, explainable reasoning, policy authoring, and open data, built in the browser.*

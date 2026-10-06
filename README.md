# WishScout

**Enterprise-Grade Offline B2B Discovery, Contact Enrichment & Outreach Intelligence Platform**

WishScout is an offline-first desktop application engineered for sales intelligence, B2B lead generation, agency client acquisition, and local market intelligence. Built with Electron, Vanilla JavaScript, embedded SQLite (`better-sqlite3`), and Playwright, WishScout operates strictly on the operator's local workstation. All discovered businesses, enriched contact vectors, interaction histories, and CRM pipeline records remain sovereign and local—never transmitted to third-party cloud servers or external aggregators.

---

## Architectural Principles

- **Offline-First & Data Sovereign:** Zero telemetry, no cloud subscriptions, and no external tracking. The prospect database resides in a high-performance local SQLite database operated in Write-Ahead Logging (WAL) mode with triple-point indexing.
- **Dual-Engine Architecture:** Combines a native Playwright headless browser extraction engine for precision exploratory scraping with a containerized Go-based engine (Gosom) for high-throughput batch extraction.
- **Multi-Process Sandboxing:** Complete separation of concerns between the Electron main coordinator, isolated background utility processes for automated crawling, and a sandboxed UI renderer.
- **Enterprise-Grade IPC Security:** The renderer operates with `contextIsolation: true`, `nodeIntegration: false`, and `sandbox: true`. Inter-process communication occurs strictly through a frozen, allow-listed IPC channel registry.
- **Spreadsheet Formula Injection Defense:** All CSV export routines automatically neutralize potentially dangerous formula trigger characters (`=`, `@`, `+`, `-`), preventing CSV injection attacks in spreadsheet processors such as Microsoft Excel and LibreOffice Calc.
- **Zero Build Toolchain Overhead:** Leverages precompiled binaries for `better-sqlite3`, ensuring frictionless cross-platform setup on Windows workstations without requiring Python or Visual C++ compilation toolchains.

---

## Core Capabilities & Features

### 1. Dual Discovery Engines

#### Native Headless Discovery Engine
- **Multi-Directory Coverage:** Deep extraction across **Google Maps**, **Bing Maps** (global), **YellowPages** (United States and Canada), and **Yelp** (commercial regional directories).
- **Radial Micro-Coordinate Grid Expansion:** Overcomes directory listing view caps (~120 listings) by calculating concentric radial coordinate offsets around the search epicenter, enabling comprehensive regional sweeps.
- **Live Event Stream:** Extracted records stream into the active workspace view immediately upon extraction.

#### High-Concurrency Engine Integration (Gosom)
- **Containerized Extraction:** Integrated with Georgios Somarakis' open-source [gosom/google-maps-scraper](https://github.com/gosom/google-maps-scraper) (MIT License) for high-speed batch discovery (~120 places per minute).
- **Live Incremental Stream Ingestion:** Ingests output continuously in real time directly from NDJSON streams into the local SQLite CRM database as businesses are crawled, providing live counter updates without post-crawl delays.
- **Automatic Container Management:** Automated Docker environment verification, container lifecycle supervision, and clean teardown upon crawl completion.

---

### 2. Query Automation & Productivity Tools

- **Matrix Query Multiplier:** Combinatorial niche-by-location query generator. Input target business niches and multiple target cities or districts, select a templating pattern (e.g., `{niche} in {location}`, `{niche} near {location}`, `{location} {niche}`), and generate dozens or hundreds of structured search queries instantly.
- **Curated Industry Preset Packs:** Pre-built, high-converting query packages tailored for agency client acquisition:
  - *Healthcare & Clinics Pack* (35 targeted queries: hospitals, dental clinics, dermatology, diagnostic labs, etc.)
  - *Real Estate & Construction Ecosystem* (35 targeted queries: developers, architects, interior designers, contractors, etc.)
  - *Home Improvement & Local Services* (35 targeted queries: electricians, plumbers, HVAC, pest control, solar contractors, etc.)
  - *Hospitality, Food & Nightlife* (30 targeted queries: cafes, boutique hotels, resorts, banquet halls, event planners, etc.)
  - *Professional B2B Services & Education* (30 targeted queries: accounting firms, legal practices, software agencies, IT services, etc.)
- **Live Progress & Dynamic ETA Engine:** Visual progress bar tracking current query status (`Query X of Y`), dynamic percentage completion, real-time estimated time remaining, and granular execution breakdown pills (Completed, Zero Results, Blocked/Failed).
- **Single-Click Failed Query Retry:** Automatically captures queries that encountered network timeouts, rate limiting, or zero results, allowing operators to relaunch targeted retries with a single click.

---

### 3. Contact & Social Intelligence Enrichment

- **Autonomous Website Crawler:** For businesses with an identified website, an asynchronous background enrichment worker systematically inspects the homepage, `/contact`, `/about`, and `/team` endpoints.
- **Extracted Contact Data:** Direct business email addresses (RFC 5322 compliant regex with asset and CDN exclusion), direct phone numbers, and official social media profile URLs (LinkedIn, Instagram, Facebook, Twitter/X, YouTube).
- **Polite Crawling Compliance:** Adheres to target website `robots.txt` Disallow directives, employs randomized request jitter, and avoids aggressive polling.

---

### 4. Anti-Ban & Network Protection

- **Rotating Proxy Pool:** Built-in support for HTTP, HTTPS, and SOCKS5 proxy pools (`user:pass@host:port` or `host:port`). The engine cycles proxies in round-robin sequence across concurrent workers.
- **Dynamic User-Agent Rotation:** Distributes requests across a curated list of modern desktop browser User-Agent strings.
- **Headless / Headful Mode Toggle:** Execute silently in headless mode for maximum extraction velocity, or toggle headful browser execution via Settings to monitor crawling behavior or inspect site layout variations.

---

### 5. Multi-Key Deduplication Engine

- Evaluates duplicate candidates prior to database insertion across four independent identity dimensions:
  1. Canonical Google Place ID (`place_id`)
  2. Normalized Domain Name (`domain`)
  3. Standardized Telephone Number (`normalized_phone`)
  4. Normalized Business Name combined with Geographic City (`name_city`)
- **Pipeline Overwrite Protection:** Businesses currently engaged in active pipeline stages (`Contacted`, `Meeting Scheduled`, `Proposal Sent`, `Won`, `Lost`) are protected from automated overwriting. New contact details (such as newly discovered email addresses or social handles) are merged non-destructively.
- **Interactive Deduplication Assistant:** A visual merge tool that surfaces duplicate candidates, displaying side-by-side Record A (Primary) and Record B (Secondary) comparisons for manual review and non-destructive consolidation.

---

### 6. Integrated Pipeline CRM & Outreach Management

- **Lifecycle Stage Tracking:** Categorize leads across standardized operational stages: `New Lead`, `Contacted`, `Qualified`, `Meeting Scheduled`, `Proposal Sent`, `Won`, and `Lost`.
- **Deep Search & Filtering:** Comprehensive search bar querying business names, domains, categories, cities, states, countries, complete addresses, telephone numbers, emails, and decision-maker names simultaneously.
- **VoIP Click-to-Call & Mobile QR Dialing:**
  - One-click desktop dialing via Windows Phone Link, Skype, or configured softphone clients.
  - Generated dynamic high-resolution QR codes: operators can scan directly with a smartphone camera to initiate calls instantly without typing phone numbers.
- **Direct Multi-Channel Outreach:**
  - **WhatsApp Web Integration:** One-click WhatsApp message initiation with automated international phone normalization and dynamic template population.
  - **Email Pitch Composer:** Integrated email composition interface with system default mailto client support.
- **Personalized Template Variables:**
  - `{name}` — Business name
  - `{city}` — Business city
  - `{category}` — Business category
  - `{owner_name}` — Contact person or business owner
  - `{website}` — Website URL
  - `{phone}` — Telephone number
- **Follow-up Reminders & Timeline Auditing:** Schedule exact follow-up dates with visual "Due Today" badges, multi-channel interaction checkmarks (WhatsApp Sent, Email Sent, Phone Call Logged, Social DM), and complete activity history logging.

---

### 7. Exporting & Dossier Generation

- **Formula-Sanitized CSV Export:** Export complete lead metadata with automated CSV injection neutralization.
- **Structured JSON Dumps:** Complete database export including outreach histories, audit logs, and search queries.
- **Executive Prospect Dossier (PDF):** Generates high-resolution, printable PDF client audits containing business branding, reputation scores, opening hours, verified contacts, and decision-maker dossiers.

---

## Technical Architecture

```text
wishscout/
├── assets/                    # Application icons, branding marks, and vector assets
├── scripts/
│   └── check.mjs              # Automated static syntax and IPC allow-list verification
├── src/
│   ├── main/
│   │   ├── main.js            # Electron application lifecycle and IPC registration
│   │   ├── preload.cjs        # Context-isolated secure preload bridge
│   │   ├── db.js              # SQLite database schema, WAL configuration, migrations
│   │   ├── exporter.js        # CSV sanitization, JSON export, and PDF dossier generation
│   │   ├── scraperManager.js  # Headless Playwright worker coordinator
│   │   └── gosomManager.js    # Docker Gosom container coordinator & live stream ingestor
│   ├── scraper/
│   │   ├── discoveryWorker.js # UtilityProcess worker executing Playwright discovery
│   │   ├── enrichmentWorker.js# Asynchronous HTTP crawler extracting emails & social links
│   │   ├── helpers.js         # Proxy rotator, radial coordinate math, address parser
│   │   └── sources/
│   │       ├── bing.js        # Bing Maps directory scraper module
│   │       ├── yellowpages.js # YellowPages business directory module
│   │       └── yelp.js        # Yelp regional commercial listings module
│   ├── shared/
│   │   └── channels.js        # Single source of truth for IPC protocol definitions
│   └── renderer/
│       ├── index.html         # Single-page application shell
│       ├── css/
│       │   ├── variables.css  # Design system tokens, color palettes, typography
│       │   └── components.css # Component styles, tables, cards, drawers, and modal sheets
│       └── js/
│           ├── app.js         # Navigation router, view manager, and theme controller
│           ├── discovery.js   # Native multi-source discovery view and live stream
│           ├── gosom.js       # Gosom high-concurrency engine interface and query matrix
│           ├── pipeline.js    # Pipeline CRM table, detail drawer, and QR dialing modal
│           ├── qrcode.min.js  # Client-side vector QR code generator
│           ├── analytics.js   # Database metrics, coverage rates, and performance charts
│           ├── settings.js    # Concurrency controls, proxy pool, and outreach templates
│           ├── cities.js      # Offline global metropolitan database
│           └── util.js        # Safe DOM builder, external link launcher, and SVG icon library
├── DISCLAIMER.md              # Operator compliance, acceptable use, and safe harbor policy
├── LICENSE                    # GNU General Public License v3.0 (GPL-3.0)
├── NOTICE                     # Copyright and third-party attribution declarations
└── package.json               # Package configuration and build commands
```

---

## Installation & Setup

### System Prerequisites
- **Node.js:** v20.x or higher (tested on Node.js v22 and v24 LTS).
- **Operating System:** Windows 10 / 11 (x64), Linux (x64), or macOS (ARM64 / x64).
- **Browser:** Google Chrome or Microsoft Edge installed on the host system. Playwright binds to the host browser installation directly, avoiding large standalone browser downloads.
- **Docker Desktop (Optional):** Required only if utilizing the containerized Gosom High-Concurrency Engine. Standard discovery runs natively without Docker.

### Getting Started

1. **Clone the repository:**
   ```bash
   git clone https://github.com/your-username/wishscout.git
   cd wishscout
   ```

2. **Install project dependencies:**
   ```bash
   npm install
   ```

3. **Execute static verification and security validation:**
   ```bash
   npm run check
   ```

4. **Launch WishScout in desktop development mode:**
   ```bash
   npm start
   ```

---

## Production Packaging

WishScout is configured with `electron-builder` to compile standalone desktop installers.

To build the standalone Windows x64 NSIS installer:
```bash
npm run dist
```

The compiled distributable will be output to:
```text
dist/WishScout Setup 1.0.0.exe
```

---

## Continuous Integration & Security Audits

The project includes GitHub Actions workflows under `.github/workflows/`:

- **Continuous Integration (`ci.yml`):** Validates code integrity, runs `npm run check`, tests syntax across Windows and Ubuntu on Node.js v22 LTS and v24, and ensures strict preload IPC allow-list adherence.
- **Release Automation (`release.yml`):** Triggers upon version tag pushes (e.g., `v1.0.0`), builds the production NSIS executable, calculates cryptographic SHA-256 checksums (`SHA256SUMS.txt`), and drafts formal GitHub Releases.
- **Security Audit (`security.yml`):** Runs automated dependency vulnerability assessments on a weekly schedule.

---

## Compliance & Responsible Use Policy

WishScout is an automation and discovery utility intended strictly for legitimate B2B business development and market analysis. Operators are solely responsible for ensuring adherence to regional, national, and international data privacy and commercial messaging statutes:

- **United States:** CAN-SPAM Act of 2003 (15 U.S.C. § 7701) and TCPA (47 U.S.C. § 227).
- **European Union:** General Data Protection Regulation (GDPR Article 6 and Article 14) and ePrivacy Directive.
- **United Kingdom:** Data Protection Act 2018 and Privacy and Electronic Communications Regulations (PECR).
- **India:** Digital Personal Data Protection Act, 2023 (DPDP Act).

Always honor opt-out and communication removal requests promptly, avoid transmission of unsolicited mass spam, and configure appropriate crawler concurrency to respect target server bandwidth. Refer to [DISCLAIMER.md](DISCLAIMER.md) for full policy details.

---

## Third-Party Software & Open-Source Acknowledgments

WishScout acknowledges, credits, and respects the following upstream open-source project:

### [Google Maps Scraper (gosom/google-maps-scraper)](https://github.com/gosom/google-maps-scraper)
- **Author & Maintainer:** Georgios Somarakis ([@gosom](https://github.com/gosom))
- **License:** [MIT License](https://github.com/gosom/google-maps-scraper/blob/main/LICENSE)
- **Role in WishScout:** Coordinates the high-concurrency containerized scraping workflow for batch geographic crawling. WishScout provides automated Docker container management, live log extraction, and seamless real-time ingestion into its local SQLite CRM database.

Full license text for the upstream component is maintained in the root [NOTICE](NOTICE) file.

---

## License & Attribution

WishScout is released under the **GNU General Public License v3.0 (GPL-3.0)**.

```text
Copyright (C) 2026 Vishwjeet Singh Vilkhu
Original Creator & Architect: Vishwjeet Singh Vilkhu
```

Under **Section 7 of the GNU GPL-3.0**, any fork, redistribution, compiled distribution, or derivative work must preserve:
1. Prominent credit to the original creator and architect, **Vishwjeet Singh Vilkhu**.
2. The root [NOTICE](NOTICE) file.
3. The persistent sidebar credit element and interactive "About WishScout" modal.
4. Authorship and copyright notices in all source file headers.

Refer to [LICENSE](LICENSE) and [NOTICE](NOTICE) for complete terms.

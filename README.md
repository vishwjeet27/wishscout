# WishScout

**Offline-First Local B2B Discovery, Contact Enrichment & Outreach Pipeline**

WishScout is an offline-first desktop application designed for sales intelligence, agency client acquisition, and local market discovery. Built with Electron, Vanilla JavaScript, embedded SQLite (`better-sqlite3`), and Playwright, WishScout runs entirely on your local workstation. All discovered businesses, enriched contact data, interaction logs, and pipeline states remain strictly local—never transmitted to third-party cloud servers or external databases.

---

## Architectural Highlights

- **Offline-First & Local Sovereign:** Zero telemetry, no cloud subscriptions, and no external tracking. Your prospecting database resides in a high-performance local SQLite database operated in Write-Ahead Logging (WAL) mode.
- **Multi-Process Sandboxing:** Complete separation of concerns between the Electron main coordinator, an isolated utility background process for headless automation, and a sandboxed UI renderer.
- **Zero C++ Build Toolchains Required:** Uses prebuilt binaries via `better-sqlite3`, ensuring seamless cross-platform installation on Windows workstations without requiring Python or Visual Studio C++ build dependencies.
- **Enterprise-Grade IPC Security:** The renderer operates with `contextIsolation: true`, `nodeIntegration: false`, and `sandbox: true`. Communication occurs solely through a strictly allow-listed, frozen IPC bridge.
- **Spreadsheet Formula Injection Defense:** All CSV export operations automatically sanitize dangerous formula characters (`=`, `@`, `+`, `-`), preventing CSV injection attacks in Excel or LibreOffice.

---

## Core Capabilities

### 1. Multi-Source Discovery Engine
- **Google Maps:** Full extraction of business identities, categories, star ratings, review counts, geographic coordinates, price levels, opening hours, plus codes, thumbnails, and descriptions.
- **Multi-Point Radial Grid Search:** Google Maps limits individual map views to approximately 120 listings. WishScout overcomes this by calculating radial micro-coordinate grid points around the target epicenter to discover 500+ unique listings per city.
- **Alternative Global Sources:** Built-in secondary scraping modules for **Bing Maps** (global coverage), **YellowPages** (US business directories), and **Yelp** (regional commercial profiles).
- **Live Event-Streamed UI:** Listings stream into the user interface in real time as they are parsed from directory pages.

### 2. Deep Contact & Social Intelligence Enrichment
- **Automated Website Crawler:** For every business with an authoritative website URL, an asynchronous background enrichment worker navigates the homepage, `/contact`, `/about`, and `/team` pages.
- **Data Extracted:** Direct business email addresses (RFC 5322 compliant regex with asset exclusion), direct telephone numbers, and official social media profile links (LinkedIn, Instagram, Facebook, Twitter/X, YouTube).
- **Domain & Whois Intelligence:** Automated extraction of registered domain names and business ownership cues.
- **Polite Crawling Compliance:** Adheres to target website `robots.txt` Disallow directives, implements human-like randomized request jitter, and never attempts to bypass login walls or CAPTCHAs.

### 3. Anti-Ban & Rate-Limit Mitigation
- **Rotating Proxy Pool:** Built-in support for multiple HTTP, HTTPS, and SOCKS5 proxies (`user:pass@host:port` or `host:port`). The engine rotates proxies in round-robin order across concurrent crawl tasks.
- **Smart User-Agent Rotation:** Distributes requests across modern desktop browser User-Agent strings.
- **Headless / Headful Diagnostic Toggle:** Run silently in headless mode for maximum speed, or toggle headful browser execution via Settings to monitor crawling behavior or fulfill regional prompts.

### 4. Smart Multi-Key Deduplication
- Detects existing businesses before insertion across 4 distinct identity dimensions:
  1. Google Place ID
  2. Normalized E.164 / Domestic Phone Number
  3. Domain Name
  4. Normalized Business Name + City Match
- **Pipeline Protection:** Existing leads in active outreach stages (`Contacted`, `Meeting Scheduled`, `Proposal Sent`, `Won`, `Lost`) are protected from accidental overwrites. If new contact channels (e.g., email or socials) are discovered for an existing lead, they are merged non-destructively.

### 5. Agency Qualification & Discovery Filters
- **Website Filter:** Filter prospects by **"No Website"** (a prime segment for web design, development, and hosting agencies) or **"Has Website"** (for SEO, CRO, and digital advertising services).
- **Reputation Tiers:** Target businesses with lower ratings (`< 4.0`) for online reputation management (ORM) and review booster campaigns, or well-rated establishments (`>= 4.5`) for premium B2B partnerships.
- **Multi-Category Batch Discovery:** Execute multi-niche discovery queries in a single pass (e.g., `dentists, pediatricians, chiropractors`).
- **Offline City Autocomplete:** Built-in offline database covering major commercial metropolitan centers across the United States, United Kingdom, Canada, Australia, India, and Europe.

### 6. Integrated Pipeline CRM & Follow-Up Management
- **Status Lifecycle Tracking:** Track prospects through standardized stages: `New Lead`, `Contacted`, `Qualified`, `Meeting Scheduled`, `Proposal Sent`, `Won`, `Lost`.
- **Custom Tagging System:** Quickly tag records with operational labels (`Hot Lead`, `High Budget`, `Call Back`, `Proposal Sent`, `Wrong Number`) or create custom tags.
- **Follow-up Reminders:** Schedule exact follow-up dates. WishScout displays visual "Due Today" badges and fires native desktop notifications upon application launch.
- **Comprehensive Activity Logging:** Maintain an audit trail of every call, message, proposal, and status change with structured notes and timestamps.

### 7. Direct 1-Click Outreach
- **WhatsApp Web Integration:** Direct one-click chat initiation with country-code normalization and automatic pre-filled dynamic message text.
- **Email Pitch Composer:** Integrated composition modal supporting system default mailto clients.
- **Custom Outreach Template Manager:** Create, update, and manage reusable multi-channel pitch templates directly in the Settings tab.
- **Dynamic Personalization Variables:**
  - `{name}` — Business name
  - `{city}` — Business city
  - `{category}` — Business category / industry
  - `{owner_name}` — Identified decision maker / business owner
  - `{website}` — Website URL
  - `{phone}` — Contact telephone number

### 8. Enterprise Reporting & Dossier Generation
- **Excel-Compatible CSV Export:** Clean export of all lead metadata and enrichment records with formula sanitization.
- **Full JSON Backups:** Export full database dumps or filtered segments including outreach histories and search statistics.
- **Executive Prospect Dossier (PDF):** Generate professional, high-resolution printable PDF audits containing hero thumbnail imagery, price tiers, operating hours, decision maker details, reputation metrics, and full contact sheets.

---

## Technical Architecture

```
wishscout/
├── assets/                  # Application icons and branding assets
├── scripts/
│   └── check.mjs            # Static syntax and IPC security integrity verification
├── src/
│   ├── main/
│   │   ├── main.js          # Electron lifecycle, window creation, IPC handlers
│   │   ├── preload.cjs      # Sandboxed preload exposing frozen IPC channels
│   │   ├── db.js            # SQLite database schema, migrations, indexing, and queries
│   │   ├── exporter.js      # CSV formula neutralization, JSON, and PDF dossier generator
│   │   └── scraperManager.js# Child utility process coordinator and state manager
│   ├── scraper/
│   │   ├── discoveryWorker.js # UtilityProcess worker executing Playwright discovery
│   │   ├── enrichmentWorker.js# Asynchronous HTTP crawler extracting emails & socials
│   │   ├── helpers.js       # Proxy rotator, geocoding, radial math, address parser
│   │   └── sources/
│   │       ├── bing.js      # Bing Maps directory scraper module
│   │       ├── yellowpages.js # YellowPages business directory module
│   │       └── yelp.js      # Yelp regional commercial listings module
│   ├── shared/
│   │   └── channels.js      # Single source of truth for IPC protocol definitions
│   └── renderer/
│       ├── index.html       # Single-page application shell
│       ├── css/
│       │   ├── variables.css# Design system tokens, color palettes, and typography
│       │   └── components.css# Glassmorphic layout, tables, drawers, and modal styles
│       └── js/
│           ├── app.js       # UI initialization, navigation controller, and theme toggle
│           ├── discovery.js # Live streaming discovery view and controls
│           ├── pipeline.js  # Leads management table, detail drawer, and CRM features
│           ├── analytics.js # Local database metrics, charts, and activity summaries
│           ├── settings.js  # Concurrency, proxy pool, template manager, and legal modals
│           ├── cities.js    # Curated offline metropolitan database
│           └── util.js      # Safe DOM builder, sanitized external link launcher, toast notifications
├── DISCLAIMER.md            # Operator legal compliance and safe harbor notice
├── LICENSE                  # GNU General Public License v3.0 (GPL-3.0)
├── NOTICE                   # Copyright and author attribution notices
└── package.json             # Application dependencies and build scripts
```

---

## Installation & Setup

### Prerequisites
- **Node.js:** v20.x or higher (tested on Node.js v22 and v24 LTS).
- **Operating System:** Windows 10 / 11 (x64), Linux, or macOS.
- **Browser:** Microsoft Edge or Google Chrome installed locally. Playwright binds directly to your existing system browser installation without requiring separate multi-hundred megabyte browser downloads.

### Quick Start

1. **Clone the repository:**
   ```bash
   git clone https://github.com/your-username/wishscout.git
   cd wishscout
   ```

2. **Install project dependencies:**
   ```bash
   npm install
   ```

3. **Run code integrity and static security verification:**
   ```bash
   npm run check
   ```

4. **Launch WishScout in development mode:**
   ```bash
   npm start
   ```

---

## Production Packaging

WishScout is configured with `electron-builder` to produce standalone, signed, or unsigned desktop distributables.

To generate a Windows x64 NSIS standalone installer:
```bash
npm run dist
```
The compiled installer will be placed in the `dist/` directory:
```
dist/WishScout Setup 1.0.0.exe
```

---

## Proxy Configuration Guide

To configure rotating proxies for heavy extraction tasks:
1. Navigate to the **Settings** view in the WishScout sidebar.
2. Under **Rotating Proxy Pool**, input your proxy endpoints (one per line). Supported protocols include:
   ```text
   http://127.0.0.1:8080
   http://username:password@proxy-host.com:3128
   socks5://192.168.1.100:1080
   socks5://authuser:authpass@socks-pool.net:1080
   ```
3. WishScout will parse the entries and display a live verification badge (e.g., `4 proxies in pool`).
4. Click **Save crawler settings**. All background workers will cycle through the pool in round-robin order.

---

## Continuous Integration & Git Pipelines

WishScout includes preconfigured, enterprise-grade GitHub Actions workflows located in `.github/workflows/`:

- **Continuous Integration (`ci.yml`):**
  - Triggers on every push and pull request against `main` and `master`.
  - Runs cross-platform matrix testing on **Windows** and **Ubuntu** across Node.js versions (v22 LTS and v24 Current).
  - Executes strict static analysis, preload IPC allow-list verification, and syntax validation (`npm run check`).
  - Scans for prohibited binary or environment files to preserve repository cleanliness.

- **Automated Release Pipeline (`release.yml`):**
  - Triggers on version tag pushes (e.g., `v1.0.0`) or manual execution via `workflow_dispatch`.
  - Compiles the standalone Windows NSIS x64 installer (`npm run dist`).
  - Automatically computes cryptographic SHA-256 checksums (`SHA256SUMS.txt`).
  - Publishes a formal GitHub Release attaching the executable installer, update blockmaps, and verification checksums.

- **Security & Dependency Audit (`security.yml`):**
  - Runs scheduled weekly audits against production dependencies to surface potential upstream vulnerabilities.

---

## Responsible Use & Compliance

WishScout is an automation and discovery utility intended strictly for legitimate B2B sales development and market research. The operator of the software is exclusively responsible for complying with international and domestic outreach regulations:

- **United States:** CAN-SPAM Act (15 U.S.C. § 7701) and TCPA (47 U.S.C. § 227).
- **European Union:** General Data Protection Regulation (GDPR Article 6 and Article 14) and ePrivacy Directive.
- **United Kingdom:** Data Protection Act 2018 and PECR.
- **India:** Digital Personal Data Protection Act, 2023 (DPDP Act).

Always honor contact removal requests immediately, never transmit spam or deceptive communications, and respect target server bandwidth by configuring moderate concurrency and delay intervals. Refer to [DISCLAIMER.md](DISCLAIMER.md) for full policy details.

---

## License & Attribution

WishScout is licensed under the **GNU General Public License v3.0 (GPL-3.0)**.

```text
Copyright (C) 2026 Vishwjeet Singh Vilkhu
Original Creator & Architect: Vishwjeet Singh Vilkhu
```

In accordance with **Section 7 of the GNU GPL-3.0**, any fork, redistribution, compiled release, or derivative work must preserve:
1. Credit to the original creator and architect, **Vishwjeet Singh Vilkhu**.
2. The root [NOTICE](NOTICE) file.
3. The persistent sidebar credit widget and the interactive "About WishScout" modal.
4. Copyright and authorship headers present in all source files.

See [LICENSE](LICENSE) and [NOTICE](NOTICE) for complete terms.

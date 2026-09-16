import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const sampleDir = path.join(rootDir, 'public', 'sample-map');

if (!fs.existsSync(sampleDir)) {
  fs.mkdirSync(sampleDir, { recursive: true });
}

// 1. Generate Main Site Plan Map
const sitePlanSvg = `
<svg xmlns="http://www.w3.org/2000/svg" width="2400" height="1600" viewBox="0 0 2400 1600">
  <defs>
    <pattern id="grid" width="80" height="80" patternUnits="userSpaceOnUse">
      <path d="M 80 0 L 0 0 0 80" fill="none" stroke="#e2e8f0" stroke-width="1.5" stroke-dasharray="4,4"/>
    </pattern>
    <filter id="shadow" x="-5%" y="-5%" width="110%" height="110%">
      <feDropShadow dx="5" dy="8" stdDeviation="6" flood-opacity="0.3"/>
    </filter>
  </defs>

  <!-- Background blueprint / parchment style -->
  <rect width="2400" height="1600" fill="#f1f5f9"/>
  <rect width="2400" height="1600" fill="url(#grid)"/>

  <!-- Outer drafting border -->
  <rect x="30" y="30" width="2340" height="1540" fill="none" stroke="#0f172a" stroke-width="6"/>
  <rect x="42" y="42" width="2316" height="1516" fill="none" stroke="#64748b" stroke-width="2"/>

  <!-- Title Cartouche -->
  <g transform="translate(70, 70)">
    <rect width="760" height="130" fill="#ffffff" stroke="#0f172a" stroke-width="3" rx="6" filter="url(#shadow)"/>
    <text x="30" y="48" font-family="Arial, Helvetica, sans-serif" font-size="32" font-weight="900" fill="#0f172a" letter-spacing="1">JANOV RESIDENTIAL COMPLEX</text>
    <text x="30" y="82" font-family="Arial, Helvetica, sans-serif" font-size="18" font-weight="bold" fill="#2563eb">URBAN MASTER PLAN & SITE INVENTORY</text>
    <text x="30" y="110" font-family="Courier New, monospace" font-size="14" fill="#64748b">CADASTRAL SECTOR 08-B • SCALE 1:500 • SURVEY: ARCHIVES 2024</text>
  </g>

  <!-- Compass Rose -->
  <g transform="translate(2220, 160)">
    <circle cx="0" cy="0" r="60" fill="#ffffff" stroke="#0f172a" stroke-width="3" filter="url(#shadow)"/>
    <polygon points="0,-52 14,-10 0,0" fill="#dc2626"/>
    <polygon points="0,-52 -14,-10 0,0" fill="#991b1b"/>
    <polygon points="0,52 14,10 0,0" fill="#475569"/>
    <polygon points="0,52 -14,10 0,0" fill="#1e293b"/>
    <polygon points="52,0 10,14 0,0" fill="#64748b"/>
    <polygon points="-52,0 -10,-14 0,0" fill="#94a3b8"/>
    <text x="-9" y="-60" font-family="Arial, sans-serif" font-size="22" font-weight="900" fill="#dc2626">N</text>
  </g>

  <!-- Green park areas -->
  <path d="M 120,240 C 400,210 800,260 1200,230 L 1200,420 C 800,450 400,410 120,440 Z" fill="#bbf7d0" stroke="#22c55e" stroke-width="3"/>
  <text x="450" y="340" font-family="Arial, sans-serif" font-size="22" font-weight="bold" fill="#15803d" letter-spacing="3">NORTH GREEN BELT & COMMUNITY PARK</text>

  <path d="M 1550,750 C 1850,720 2150,760 2320,740 L 2320,1450 C 2150,1420 1850,1470 1550,1440 Z" fill="#dcfce7" stroke="#16a34a" stroke-width="3"/>
  <text x="1750" y="1120" font-family="Arial, sans-serif" font-size="22" font-weight="bold" fill="#15803d" letter-spacing="2">PUBLIC SPORTS & RECREATION AREA</text>

  <!-- Roads -->
  <!-- Severni Trida -->
  <path d="M 60,490 L 2340,490" stroke="#64748b" stroke-width="56" fill="none"/>
  <path d="M 60,490 L 2340,490" stroke="#f8fafc" stroke-width="48" fill="none"/>
  <path d="M 60,490 L 2340,490" stroke="#cbd5e1" stroke-width="3" stroke-dasharray="25,20" fill="none"/>
  <text x="250" y="482" font-family="Arial, sans-serif" font-size="18" font-weight="bold" fill="#475569" letter-spacing="2">SEVERNI TRIDA (MAIN NORTH AVENUE)</text>

  <!-- Central Avenue -->
  <path d="M 940,490 L 940,1540" stroke="#64748b" stroke-width="46" fill="none"/>
  <path d="M 940,490 L 940,1540" stroke="#f8fafc" stroke-width="38" fill="none"/>
  <path d="M 940,490 L 940,1540" stroke="#cbd5e1" stroke-width="2" stroke-dasharray="20,16" fill="none"/>

  <!-- South Avenue -->
  <path d="M 60,1380 L 2340,1380" stroke="#64748b" stroke-width="46" fill="none"/>
  <path d="M 60,1380 L 2340,1380" stroke="#f8fafc" stroke-width="38" fill="none"/>
  <path d="M 60,1380 L 2340,1380" stroke="#cbd5e1" stroke-width="2" stroke-dasharray="20,16" fill="none"/>
  <text x="250" y="1372" font-family="Arial, sans-serif" font-size="18" font-weight="bold" fill="#475569" letter-spacing="2">JIH CESTA (SOUTH RING ROAD)</text>

  <!-- Parking Areas -->
  <rect x="180" y="600" width="220" height="300" fill="#e2e8f0" stroke="#64748b" stroke-width="3" rx="6"/>
  <text x="220" y="760" font-family="Arial, sans-serif" font-size="22" font-weight="bold" fill="#64748b">PARKING P1</text>

  <rect x="180" y="980" width="220" height="300" fill="#e2e8f0" stroke="#64748b" stroke-width="3" rx="6"/>
  <text x="220" y="1140" font-family="Arial, sans-serif" font-size="22" font-weight="bold" fill="#64748b">PARKING P2</text>

  <!-- ================= BUILDINGS ================= -->

  <!-- Building A -->
  <g id="bldg-A">
    <rect x="520" y="600" width="340" height="220" fill="#dbeafe" stroke="#1d4ed8" stroke-width="4" filter="url(#shadow)" rx="4"/>
    <line x1="520" y1="710" x2="860" y2="710" stroke="#3b82f6" stroke-width="2" stroke-dasharray="8,6"/>
    <line x1="690" y1="600" x2="690" y2="820" stroke="#3b82f6" stroke-width="2" stroke-dasharray="8,6"/>
    <text x="545" y="635" font-family="Arial, sans-serif" font-size="22" font-weight="900" fill="#1e3a8a">BUILDING [A]</text>
    <text x="545" y="665" font-family="Arial, sans-serif" font-size="16" font-weight="bold" fill="#1d4ed8">RESIDENTIAL BLOCK ALPHA</text>
    <text x="545" y="795" font-family="Courier New, monospace" font-size="15" font-weight="bold" fill="#2563eb">4 FLOORS • 32 APARTMENTS</text>
  </g>

  <!-- Building B -->
  <g id="bldg-B">
    <rect x="1060" y="600" width="420" height="220" fill="#d1fae5" stroke="#047857" stroke-width="4" filter="url(#shadow)" rx="4"/>
    <line x1="1060" y1="710" x2="1480" y2="710" stroke="#10b981" stroke-width="2" stroke-dasharray="8,6"/>
    <line x1="1200" y1="600" x2="1200" y2="820" stroke="#10b981" stroke-width="2" stroke-dasharray="8,6"/>
    <line x1="1340" y1="600" x2="1340" y2="820" stroke="#10b981" stroke-width="2" stroke-dasharray="8,6"/>
    <text x="1085" y="635" font-family="Arial, sans-serif" font-size="22" font-weight="900" fill="#064e3b">BUILDING [B]</text>
    <text x="1085" y="665" font-family="Arial, sans-serif" font-size="16" font-weight="bold" fill="#047857">RESIDENTIAL BLOCK BETA</text>
    <text x="1085" y="795" font-family="Courier New, monospace" font-size="15" font-weight="bold" fill="#059669">6 ENTRANCES • 48 APARTMENTS</text>
  </g>

  <!-- Building C -->
  <g id="bldg-C">
    <rect x="520" y="980" width="360" height="260" fill="#fef3c7" stroke="#b45309" stroke-width="4" filter="url(#shadow)" rx="4"/>
    <line x1="520" y1="1110" x2="880" y2="1110" stroke="#f59e0b" stroke-width="2" stroke-dasharray="8,6"/>
    <text x="545" y="1020" font-family="Arial, sans-serif" font-size="22" font-weight="900" fill="#78350f">BUILDING [C]</text>
    <text x="545" y="1050" font-family="Arial, sans-serif" font-size="16" font-weight="bold" fill="#b45309">CIVIC & COMMERCIAL CENTER</text>
    <text x="545" y="1210" font-family="Courier New, monospace" font-size="15" font-weight="bold" fill="#d97706">POST • PHARMACY • GROCERY</text>
  </g>

  <!-- Building D -->
  <g id="bldg-D">
    <rect x="1060" y="980" width="400" height="260" fill="#fce7f3" stroke="#be185d" stroke-width="4" filter="url(#shadow)" rx="4"/>
    <text x="1085" y="1020" font-family="Arial, sans-serif" font-size="22" font-weight="900" fill="#831843">BUILDING [D]</text>
    <text x="1085" y="1050" font-family="Arial, sans-serif" font-size="16" font-weight="bold" fill="#be185d">MUNICIPAL KINDERGARTEN</text>
    <text x="1085" y="1210" font-family="Courier New, monospace" font-size="15" font-weight="bold" fill="#db2777">PLAYGROUND • 80 CHILDREN</text>
  </g>

  <!-- Scale Bar bottom right -->
  <g transform="translate(1920, 1460)">
    <rect x="0" y="0" width="320" height="50" fill="#ffffff" stroke="#0f172a" stroke-width="2" filter="url(#shadow)"/>
    <rect x="0" y="0" width="80" height="25" fill="#0f172a"/>
    <rect x="80" y="0" width="80" height="25" fill="#ffffff"/>
    <rect x="160" y="0" width="80" height="25" fill="#0f172a"/>
    <rect x="240" y="0" width="80" height="25" fill="#ffffff"/>
    <text x="5" y="42" font-family="Courier New, monospace" font-size="15" font-weight="bold" fill="#0f172a">0m</text>
    <text x="75" y="42" font-family="Courier New, monospace" font-size="15" font-weight="bold" fill="#0f172a">25m</text>
    <text x="155" y="42" font-family="Courier New, monospace" font-size="15" font-weight="bold" fill="#0f172a">50m</text>
    <text x="235" y="42" font-family="Courier New, monospace" font-size="15" font-weight="bold" fill="#0f172a">75m</text>
    <text x="295" y="42" font-family="Courier New, monospace" font-size="15" font-weight="bold" fill="#0f172a">100m</text>
  </g>
</svg>
`;

// 2. Documentation for Building A
const docA1Svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="1200" viewBox="0 0 1600 1200">
  <rect width="1600" height="1200" fill="#0f172a"/>
  <rect x="30" y="30" width="1540" height="1140" fill="none" stroke="#38bdf8" stroke-width="3"/>
  
  <text x="70" y="90" font-family="Arial, sans-serif" font-size="32" font-weight="bold" fill="#38bdf8">ARCHITECTURAL BLUEPRINT — BUILDING ALPHA [A]</text>
  <text x="70" y="130" font-family="Courier New, monospace" font-size="18" fill="#94a3b8">DRAWING REF: BLDG-A-FL01 • GROUND FLOOR APARTMENT DISTRIBUTION</text>

  <!-- Floor Layout -->
  <rect x="100" y="180" width="1400" height="780" fill="#1e293b" stroke="#38bdf8" stroke-width="6"/>

  <!-- Corridor -->
  <rect x="100" y="520" width="1400" height="100" fill="#0284c7" fill-opacity="0.3" stroke="#38bdf8" stroke-dasharray="12,8"/>
  <text x="650" y="580" font-family="Arial, sans-serif" font-size="20" font-weight="bold" fill="#7dd3fc">CENTRAL SERVICE CORRIDOR</text>

  <!-- Stairwell -->
  <rect x="680" y="180" width="240" height="340" fill="#334155" stroke="#38bdf8" stroke-width="3"/>
  <text x="715" y="240" font-family="Arial, sans-serif" font-size="18" font-weight="bold" fill="#38bdf8">MAIN STAIRCASE</text>
  <line x1="680" y1="280" x2="920" y2="280" stroke="#7dd3fc" stroke-width="2"/>
  <line x1="680" y1="320" x2="920" y2="320" stroke="#7dd3fc" stroke-width="2"/>
  <line x1="680" y1="360" x2="920" y2="360" stroke="#7dd3fc" stroke-width="2"/>
  <line x1="680" y1="400" x2="920" y2="400" stroke="#7dd3fc" stroke-width="2"/>
  <line x1="680" y1="440" x2="920" y2="440" stroke="#7dd3fc" stroke-width="2"/>
  <line x1="680" y1="480" x2="920" y2="480" stroke="#7dd3fc" stroke-width="2"/>

  <!-- Units -->
  <rect x="100" y="180" width="580" height="340" fill="none" stroke="#38bdf8" stroke-width="3"/>
  <text x="140" y="260" font-family="Arial, sans-serif" font-size="26" font-weight="bold" fill="#ffffff">APARTMENT 01 (3+1)</text>
  <text x="140" y="300" font-family="Courier New, monospace" font-size="18" fill="#7dd3fc">Total Living Area: 78.4 m²</text>
  <text x="140" y="340" font-family="Courier New, monospace" font-size="16" fill="#94a3b8">Living: 24m² | Kitchen: 12m² | Master Bed: 18m²</text>

  <rect x="920" y="180" width="580" height="340" fill="none" stroke="#38bdf8" stroke-width="3"/>
  <text x="960" y="260" font-family="Arial, sans-serif" font-size="26" font-weight="bold" fill="#ffffff">APARTMENT 02 (3+1)</text>
  <text x="960" y="300" font-family="Courier New, monospace" font-size="18" fill="#7dd3fc">Total Living Area: 78.4 m²</text>
  <text x="960" y="340" font-family="Courier New, monospace" font-size="16" fill="#94a3b8">Living: 24m² | Kitchen: 12m² | Master Bed: 18m²</text>

  <rect x="100" y="620" width="460" height="340" fill="none" stroke="#38bdf8" stroke-width="3"/>
  <text x="140" y="700" font-family="Arial, sans-serif" font-size="24" font-weight="bold" fill="#ffffff">APARTMENT 03 (2+1)</text>
  <text x="140" y="740" font-family="Courier New, monospace" font-size="18" fill="#7dd3fc">Area: 58.2 m²</text>

  <rect x="560" y="620" width="480" height="340" fill="none" stroke="#38bdf8" stroke-width="3"/>
  <text x="600" y="700" font-family="Arial, sans-serif" font-size="24" font-weight="bold" fill="#ffffff">APARTMENT 04 (1+1)</text>
  <text x="600" y="740" font-family="Courier New, monospace" font-size="18" fill="#7dd3fc">Area: 44.0 m²</text>

  <rect x="1040" y="620" width="460" height="340" fill="none" stroke="#38bdf8" stroke-width="3"/>
  <text x="1080" y="700" font-family="Arial, sans-serif" font-size="24" font-weight="bold" fill="#ffffff">APARTMENT 05 (2+1)</text>
  <text x="1080" y="740" font-family="Courier New, monospace" font-size="18" fill="#7dd3fc">Area: 58.2 m²</text>

  <!-- Title Stamp Block -->
  <g transform="translate(1050, 990)">
    <rect width="490" height="150" fill="#1e293b" stroke="#38bdf8" stroke-width="2"/>
    <text x="25" y="40" font-family="Arial, sans-serif" font-size="18" font-weight="bold" fill="#38bdf8">JANOV MUNICIPAL HOUSING ARCHIVE</text>
    <text x="25" y="70" font-family="Courier New, monospace" font-size="14" fill="#cbd5e1">ARCHITECT: Ing. Arch. P. Horak (Prague)</text>
    <text x="25" y="95" font-family="Courier New, monospace" font-size="14" fill="#cbd5e1">APPROVAL STAMP: APPROVED 14.05.1978</text>
    <rect x="350" y="30" width="110" height="80" fill="none" stroke="#ef4444" stroke-width="3" transform="rotate(-6 350 30)"/>
    <text x="365" y="65" font-family="Arial, sans-serif" font-size="14" font-weight="bold" fill="#ef4444" transform="rotate(-6 350 30)">APPROVED</text>
    <text x="375" y="85" font-family="Courier New, monospace" font-size="12" fill="#ef4444" transform="rotate(-6 350 30)">1978-05-14</text>
  </g>
</svg>
`;

// 3. Technical Inspection for Building A
const docA2Svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="1400" height="1000" viewBox="0 0 1400 1000">
  <rect width="1400" height="1000" fill="#ffffff"/>
  <rect x="25" y="25" width="1350" height="950" fill="none" stroke="#334155" stroke-width="3"/>
  <rect x="50" y="50" width="1300" height="100" fill="#f1f5f9" stroke="#cbd5e1"/>
  <text x="80" y="95" font-family="Arial, sans-serif" font-size="26" font-weight="bold" fill="#0f172a">PERIODIC TECHNICAL REVISION PROTOCOL</text>
  <text x="80" y="128" font-family="Courier New, monospace" font-size="15" fill="#475569">BUILDING: ALPHA (No. 101) • ELECTRICAL & STRUCTURAL AUDIT (2021)</text>

  <rect x="1120" y="65" width="200" height="68" fill="#dcfce7" stroke="#16a34a" stroke-width="2" rx="6"/>
  <text x="1145" y="108" font-family="Arial, sans-serif" font-size="18" font-weight="bold" fill="#15803d">STATUS: PASSED</text>

  <g transform="translate(80, 200)">
    <text x="0" y="30" font-family="Arial, sans-serif" font-size="20" font-weight="bold" fill="#1e293b">1. Electrical Risers & Earth Grounding</text>
    <text x="0" y="65" font-family="Courier New, monospace" font-size="16" fill="#334155">• Main substation incoming voltage: 400/230V ± 2% stable.</text>
    <text x="0" y="95" font-family="Courier New, monospace" font-size="16" fill="#334155">• Earthing impedance test: 1.84 Ohm (Limit: under 5.0 Ohm).</text>
    <text x="0" y="125" font-family="Courier New, monospace" font-size="16" fill="#334155">• Lightning conductor continuity: 0.12 Ω across all 4 roof terminals.</text>

    <!-- Schematic Box -->
    <rect x="0" y="160" width="650" height="280" fill="#f8fafc" stroke="#94a3b8" stroke-dasharray="6,4"/>
    <text x="30" y="200" font-family="Arial, sans-serif" font-size="16" font-weight="bold" fill="#2563eb">RISER JUNCTION BOX DIAGRAM (ENTRY HALL A)</text>
    <line x1="80" y1="260" x2="580" y2="260" stroke="#2563eb" stroke-width="4"/>
    <line x1="180" y1="260" x2="180" y2="380" stroke="#2563eb" stroke-width="3"/>
    <line x1="330" y1="260" x2="330" y2="380" stroke="#2563eb" stroke-width="3"/>
    <line x1="480" y1="260" x2="480" y2="380" stroke="#2563eb" stroke-width="3"/>
    <rect x="155" y="310" width="50" height="40" fill="#dbeafe" stroke="#2563eb"/>
    <text x="162" y="335" font-family="Courier New, monospace" font-size="14" font-weight="bold">L1</text>
    <rect x="305" y="310" width="50" height="40" fill="#dbeafe" stroke="#2563eb"/>
    <text x="312" y="335" font-family="Courier New, monospace" font-size="14" font-weight="bold">L2</text>
    <rect x="455" y="310" width="50" height="40" fill="#dbeafe" stroke="#2563eb"/>
    <text x="462" y="335" font-family="Courier New, monospace" font-size="14" font-weight="bold">L3</text>
  </g>

  <g transform="translate(80, 700)">
    <rect width="1240" height="180" fill="#f8fafc" stroke="#cbd5e1" rx="6"/>
    <text x="30" y="45" font-family="Arial, sans-serif" font-size="18" font-weight="bold" fill="#0f172a">CERTIFIED INSPECTOR SIGN-OFF</text>
    <text x="30" y="80" font-family="Courier New, monospace" font-size="15" fill="#475569">Lead Auditor: Ing. R. Kovář • License: ITI-REV-4981/CZ</text>
    <text x="30" y="110" font-family="Courier New, monospace" font-size="15" fill="#475569">Inspection Timestamp: 2021-09-18 • Next Revision Due: 2026-09</text>
    
    <circle cx="1050" cy="90" r="55" fill="none" stroke="#2563eb" stroke-width="3"/>
    <text x="1005" y="85" font-family="Arial, sans-serif" font-size="12" font-weight="bold" fill="#2563eb">REVISION STAMP</text>
    <text x="1015" y="105" font-family="Courier New, monospace" font-size="11" fill="#2563eb">OFFICIAL 2021</text>
  </g>
</svg>
`;

// 4. Building B Facade
const docB1Svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="1000" viewBox="0 0 1600 1000">
  <rect width="1600" height="1000" fill="#f8fafc"/>
  <rect x="25" y="25" width="1550" height="950" fill="none" stroke="#065f46" stroke-width="3"/>
  <text x="60" y="80" font-family="Arial, sans-serif" font-size="30" font-weight="bold" fill="#065f46">BUILDING BETA [B] — SOUTH FACADE & INSULATION STUDY</text>
  <text x="60" y="115" font-family="Courier New, monospace" font-size="16" fill="#047857">DRAWING NO. FA-B-04 • 6 ENTRANCES ELEVATION ARCHIVE</text>

  <!-- Ground Line -->
  <line x1="80" y1="750" x2="1520" y2="750" stroke="#0f172a" stroke-width="5"/>
  <text x="100" y="785" font-family="Arial, sans-serif" font-size="16" font-weight="bold" fill="#64748b">GROUND ELEVATION ±0.000 (314.5 m)</text>

  <!-- Facade block -->
  <rect x="120" y="260" width="1360" height="490" fill="#ffffff" stroke="#047857" stroke-width="4"/>

  <!-- Entrances -->
  <g fill="#064e3b">
    <rect x="180" y="650" width="70" height="100"/><text x="195" y="710" fill="#fff" font-weight="bold">E1</text>
    <rect x="400" y="650" width="70" height="100"/><text x="415" y="710" fill="#fff" font-weight="bold">E2</text>
    <rect x="620" y="650" width="70" height="100"/><text x="635" y="710" fill="#fff" font-weight="bold">E3</text>
    <rect x="840" y="650" width="70" height="100"/><text x="855" y="710" fill="#fff" font-weight="bold">E4</text>
    <rect x="1060" y="650" width="70" height="100"/><text x="1075" y="710" fill="#fff" font-weight="bold">E5</text>
    <rect x="1280" y="650" width="70" height="100"/><text x="1295" y="710" fill="#fff" font-weight="bold">E6</text>
  </g>

  <!-- Windows -->
  <g fill="#bae6fd" stroke="#0284c7" stroke-width="2">
    <rect x="170" y="320" width="90" height="60"/><rect x="390" y="320" width="90" height="60"/>
    <rect x="610" y="320" width="90" height="60"/><rect x="830" y="320" width="90" height="60"/>
    <rect x="1050" y="320" width="90" height="60"/><rect x="1270" y="320" width="90" height="60"/>
    
    <rect x="170" y="420" width="90" height="60"/><rect x="390" y="420" width="90" height="60"/>
    <rect x="610" y="420" width="90" height="60"/><rect x="830" y="420" width="90" height="60"/>
    <rect x="1050" y="420" width="90" height="60"/><rect x="1270" y="420" width="90" height="60"/>

    <rect x="170" y="520" width="90" height="60"/><rect x="390" y="520" width="90" height="60"/>
    <rect x="610" y="520" width="90" height="60"/><rect x="830" y="520" width="90" height="60"/>
    <rect x="1050" y="520" width="90" height="60"/><rect x="1270" y="520" width="90" height="60"/>
  </g>
</svg>
`;

// 5. Building C Zoning
const docC1Svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="1400" height="900" viewBox="0 0 1400 900">
  <rect width="1400" height="900" fill="#fffbeb"/>
  <rect x="25" y="25" width="1350" height="850" fill="none" stroke="#d97706" stroke-width="3"/>
  <text x="60" y="80" font-family="Arial, sans-serif" font-size="28" font-weight="bold" fill="#92400e">BUILDING [C] — CIVIC & COMMERCIAL PAVILION</text>
  <text x="60" y="115" font-family="Courier New, monospace" font-size="16" fill="#b45309">MUNICIPAL LEASE REGISTRY • SECTOR 08-C</text>

  <g transform="translate(60, 160)">
    <rect x="0" y="0" width="400" height="600" fill="#fef08a" stroke="#d97706" stroke-width="3" rx="8"/>
    <text x="30" y="50" font-family="Arial, sans-serif" font-size="22" font-weight="bold" fill="#78350f">ZONE 1: SUPERMARKET</text>
    <text x="30" y="90" font-family="Courier New, monospace" font-size="16" fill="#92400e">Retail Area: 340 m²</text>
    <text x="30" y="120" font-family="Courier New, monospace" font-size="16" fill="#92400e">Loading bay: Rear dock</text>
    <text x="30" y="150" font-family="Courier New, monospace" font-size="16" fill="#92400e">Lease Ref: COM-2022-01</text>

    <rect x="440" y="0" width="400" height="600" fill="#fde68a" stroke="#d97706" stroke-width="3" rx="8"/>
    <text x="470" y="50" font-family="Arial, sans-serif" font-size="22" font-weight="bold" fill="#78350f">ZONE 2: PHARMACY & POST</text>
    <text x="470" y="90" font-family="Courier New, monospace" font-size="16" fill="#92400e">Pharmacy: 140 m²</text>
    <text x="470" y="120" font-family="Courier New, monospace" font-size="16" fill="#92400e">Post Office: 160 m²</text>
    <text x="470" y="150" font-family="Courier New, monospace" font-size="16" fill="#92400e">Lease Ref: CIV-2018-09</text>

    <rect x="880" y="0" width="400" height="600" fill="#fef3c7" stroke="#d97706" stroke-width="3" rx="8"/>
    <text x="910" y="50" font-family="Arial, sans-serif" font-size="22" font-weight="bold" fill="#78350f">ZONE 3: COMMUNITY HALL</text>
    <text x="910" y="90" font-family="Courier New, monospace" font-size="16" fill="#92400e">Assembly Hall: 220 m²</text>
    <text x="910" y="120" font-family="Courier New, monospace" font-size="16" fill="#92400e">Capacity: 120 seats</text>
  </g>
</svg>
`;

// 6. Building D Kindergarten
const docD1Svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="1400" height="900" viewBox="0 0 1400 900">
  <rect width="1400" height="900" fill="#fff1f2"/>
  <rect x="25" y="25" width="1350" height="850" fill="none" stroke="#e11d48" stroke-width="3"/>
  <text x="60" y="80" font-family="Arial, sans-serif" font-size="28" font-weight="bold" fill="#9f1239">BUILDING [D] — MUNICIPAL KINDERGARTEN & NURSERY</text>
  <text x="60" y="115" font-family="Courier New, monospace" font-size="16" fill="#be123c">FLOORPLAN & OUTDOOR RECREATION ENCLOSURE</text>

  <g transform="translate(60, 160)">
    <rect x="0" y="0" width="580" height="580" fill="#fce7f3" stroke="#db2777" stroke-width="3" rx="8"/>
    <text x="30" y="50" font-family="Arial, sans-serif" font-size="22" font-weight="bold" fill="#831843">PAVILION FACILITIES</text>
    <text x="30" y="95" font-family="Courier New, monospace" font-size="16" fill="#9d174d">• Class 1 (Toddlers): 65 m²</text>
    <text x="30" y="130" font-family="Courier New, monospace" font-size="16" fill="#9d174d">• Class 2 (Pre-school): 75 m²</text>
    <text x="30" y="165" font-family="Courier New, monospace" font-size="16" fill="#9d174d">• Kitchen & Dining: 120 m²</text>
    <text x="30" y="200" font-family="Courier New, monospace" font-size="16" fill="#9d174d">• Staff & Nurse Office: 35 m²</text>

    <rect x="640" y="0" width="640" height="580" fill="#dcfce7" stroke="#16a34a" stroke-width="3" stroke-dasharray="10,6" rx="12"/>
    <text x="670" y="50" font-family="Arial, sans-serif" font-size="22" font-weight="bold" fill="#14532d">OUTDOOR PLAY ENCLOSURE (1,200 m²)</text>
    <circle cx="820" cy="220" r="60" fill="#fef08a" stroke="#ca8a04" stroke-width="3"/>
    <text x="780" y="225" font-family="Arial, sans-serif" font-size="16" font-weight="bold" fill="#854d0e">SANDPIT</text>
    <rect x="960" y="160" width="180" height="120" fill="#e0e7ff" stroke="#4338ca" stroke-width="2" rx="6"/>
    <text x="990" y="225" font-family="Arial, sans-serif" font-size="16" font-weight="bold" fill="#3730a3">SWINGS & SLIDE</text>
  </g>
</svg>
`;

async function convertAndSave(svgStr, filename) {
  const cleanSvg = svgStr.replace(/&(?!(amp|lt|gt|quot|apos);)/g, '&amp;');
  const filePath = path.join(sampleDir, filename);
  await sharp(Buffer.from(cleanSvg))
    .png({ quality: 90 })
    .toFile(filePath);
  console.log(`Generated PNG: ${filename}`);
}

async function run() {
  await convertAndSave(sitePlanSvg, 'sample_site_plan.png');
  await convertAndSave(docA1Svg, 'sample_doc_a1.png');
  await convertAndSave(docA2Svg, 'sample_doc_a2.png');
  await convertAndSave(docB1Svg, 'sample_doc_b1.png');
  await convertAndSave(docC1Svg, 'sample_doc_c1.png');
  await convertAndSave(docD1Svg, 'sample_doc_d1.png');
  console.log('All sample PNG images generated successfully!');
}

run().catch(console.error);

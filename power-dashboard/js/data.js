// data.js — static reference data for US states

// ISO name → GridStatus dataset prefix
const ISO_GRID_PREFIXES = {
  'PJM':    'pjm',
  'ERCOT':  'ercot',
  'MISO':   'miso',
  'CAISO':  'caiso',
  'NYISO':  'nyiso',
  'ISO-NE': 'isone',
  'SPP':    'spp',
};

// EIA energy source code → human label + fuel key for coloring
const FUEL_META = {
  NG:  { label: 'Natural Gas',    key: 'gas'     },
  NGA: { label: 'Natural Gas',    key: 'gas'     },
  OG:  { label: 'Other Gas',      key: 'gas'     },
  SUN: { label: 'Solar',          key: 'solar'   },
  WND: { label: 'Wind',           key: 'wind'    },
  NUC: { label: 'Nuclear',        key: 'nuclear' },
  WAT: { label: 'Hydro',          key: 'hydro'   },
  BIT: { label: 'Coal',           key: 'coal'    },
  SUB: { label: 'Coal',           key: 'coal'    },
  LIG: { label: 'Coal',           key: 'coal'    },
  COL: { label: 'Coal',           key: 'coal'    },
  RC:  { label: 'Coal',           key: 'coal'    },
  MWH: { label: 'Battery',        key: 'battery' },
  BAT: { label: 'Battery',        key: 'battery' },
  DFO: { label: 'Distillate Oil', key: 'oil'     },
  RFO: { label: 'Residual Oil',   key: 'oil'     },
  PC:  { label: 'Pet. Coke',      key: 'oil'     },
  WH:  { label: 'Waste Heat',     key: 'other'   },
  GEO: { label: 'Geothermal',     key: 'geo'     },
  MSW: { label: 'Waste',          key: 'other'   },
  LFG: { label: 'Landfill Gas',   key: 'other'   },
  WO:  { label: 'Waste Oil',      key: 'other'   },
  AB:  { label: 'Biomass',        key: 'bio'     },
  WDS: { label: 'Biomass',        key: 'bio'     },
  OTH: { label: 'Other',          key: 'other'   },
  OBG: { label: 'Other Gas',      key: 'other'   },
  OBS: { label: 'Biomass',        key: 'bio'     },
  PUR: { label: 'Purchase',       key: 'other'   },
};

const FUEL_COLORS = {
  gas:     '#f97316',
  nuclear: '#3b82f6',
  solar:   '#eab308',
  wind:    '#22c55e',
  coal:    '#78716c',
  hydro:   '#06b6d4',
  battery: '#ec4899',
  oil:     '#b45309',
  geo:     '#a3e635',
  bio:     '#84cc16',
  other:   '#a855f7',
};

function fuelKey(sourceCode) {
  return (FUEL_META[sourceCode] || FUEL_META['OTH']).key;
}
function fuelLabel(sourceCode) {
  return (FUEL_META[sourceCode] || { label: sourceCode }).label;
}
function fuelColor(sourceCode) {
  return FUEL_COLORS[fuelKey(sourceCode)] || FUEL_COLORS.other;
}

// State reference data
// capacity_gw: approximate total installed nameplate (EIA 2023)
// peak_gw: approximate summer peak demand
// mix: % breakdown by fuel type (approximate)
// score: infrastructure composite 0–100
// dc_demand: data center market intensity 0–100
const STATE_DATA = {
  AL: { name:'Alabama',             fips:'01', iso:'Non-ISO', utility:'Alabama Power (Southern Co.)',            capacity_gw:32.5,  peak_gw:18.2, mix:{gas:38,coal:22,nuclear:25,solar:3,hydro:12},                     score:52, dc_demand:25, dc_note:'Emerging market; incentives attracting hyperscalers to Birmingham area' },
  AK: { name:'Alaska',              fips:'02', iso:'Non-ISO', utility:'Golden Valley Electric Assoc.',           capacity_gw:3.1,   peak_gw:1.9,  mix:{gas:55,hydro:22,oil:14,wind:6,coal:3},                            score:20, dc_demand:5,  dc_note:'Isolated island grid; minimal DC activity due to remote location' },
  AZ: { name:'Arizona',             fips:'04', iso:'Non-ISO', utility:'Arizona Public Service (APS)',            capacity_gw:35.2,  peak_gw:23.5, mix:{gas:40,solar:25,nuclear:18,coal:7,hydro:5,wind:5},                score:72, dc_demand:65, dc_note:'Phoenix metro booming with hyperscale demand; water constraints a concern' },
  AR: { name:'Arkansas',            fips:'05', iso:'MISO',    utility:'Entergy Arkansas',                        capacity_gw:16.8,  peak_gw:10.2, mix:{gas:42,nuclear:28,hydro:10,coal:12,wind:5,solar:3},               score:48, dc_demand:20, dc_note:'Low-cost power attracting initial DC investments; growing market' },
  CA: { name:'California',          fips:'06', iso:'CAISO',   utility:'PG&E / SCE / SDG&E',                     capacity_gw:88.5,  peak_gw:52.3, mix:{solar:25,gas:32,hydro:12,wind:10,nuclear:9,other:12},             score:68, dc_demand:70, dc_note:'Silicon Valley anchor market; power constraints limiting new campus builds' },
  CO: { name:'Colorado',            fips:'08', iso:'Non-ISO', utility:'Xcel Energy',                            capacity_gw:21.8,  peak_gw:12.4, mix:{gas:32,wind:30,coal:15,solar:14,hydro:4,other:5},                 score:65, dc_demand:50, dc_note:'Denver/Aurora emerging hyperscale destination; strong renewables story' },
  CT: { name:'Connecticut',         fips:'09', iso:'ISO-NE',  utility:'Eversource / United Illuminating',       capacity_gw:10.8,  peak_gw:7.5,  mix:{gas:55,nuclear:30,solar:5,hydro:4,oil:5,other:1},                 score:55, dc_demand:30, dc_note:'Limited buildable land; high costs constrain large-scale DC development' },
  DE: { name:'Delaware',            fips:'10', iso:'PJM',     utility:'Delmarva Power (Exelon)',                 capacity_gw:3.9,   peak_gw:2.8,  mix:{gas:70,solar:12,wind:8,oil:5,other:5},                            score:58, dc_demand:35, dc_note:'Favorable tax laws attract some DC; small market overall' },
  DC: { name:'Dist. of Columbia',   fips:'11', iso:'PJM',     utility:'Pepco (Exelon)',                         capacity_gw:0.5,   peak_gw:1.2,  mix:{gas:90,other:10},                                                 score:30, dc_demand:45, dc_note:'Dense urban area; minimal local generation; served via PJM imports' },
  FL: { name:'Florida',             fips:'12', iso:'Non-ISO', utility:'FPL (NextEra Energy)',                   capacity_gw:78.5,  peak_gw:53.2, mix:{gas:69,nuclear:12,solar:11,coal:4,oil:2,other:2},                 score:70, dc_demand:55, dc_note:'Miami/Jacksonville emerging; NextEra solar buildout supports DC growth' },
  GA: { name:'Georgia',             fips:'13', iso:'Non-ISO', utility:'Georgia Power (Southern Co.)',           capacity_gw:42.5,  peak_gw:26.5, mix:{gas:42,nuclear:22,solar:12,coal:14,hydro:5,other:5},              score:78, dc_demand:75, dc_note:'Atlanta is top-5 US DC market; Vogtle expansion adds nuclear baseload' },
  HI: { name:'Hawaii',              fips:'15', iso:'Non-ISO', utility:'Hawaiian Electric (HEI)',                capacity_gw:3.4,   peak_gw:1.8,  mix:{solar:30,oil:35,wind:12,hydro:5,other:18},                        score:22, dc_demand:8,  dc_note:'Isolated island grid; limited DC market; high power costs' },
  ID: { name:'Idaho',               fips:'16', iso:'Non-ISO', utility:'Idaho Power',                            capacity_gw:8.2,   peak_gw:4.5,  mix:{hydro:55,wind:18,gas:15,solar:8,geo:4},                           score:62, dc_demand:35, dc_note:'Boise area growing; abundant cheap hydro power attractive for DCs' },
  IL: { name:'Illinois',            fips:'17', iso:'MISO',    utility:'ComEd (Exelon) / Ameren',               capacity_gw:55.8,  peak_gw:32.8, mix:{nuclear:55,gas:22,wind:12,solar:4,coal:5,hydro:2},                score:80, dc_demand:65, dc_note:'Chicago is major DC hub; nuclear backbone; strongest grid in MISO' },
  IN: { name:'Indiana',             fips:'18', iso:'MISO',    utility:'Duke Energy Indiana / AES Indiana',     capacity_gw:30.2,  peak_gw:17.8, mix:{gas:35,coal:30,wind:15,solar:8,hydro:2,other:10},                 score:60, dc_demand:35, dc_note:'Indianapolis area attracting DCs; competitive power rates in MISO' },
  IA: { name:'Iowa',                fips:'19', iso:'MISO',    utility:'MidAmerican Energy / Alliant Energy',   capacity_gw:25.8,  peak_gw:11.2, mix:{wind:60,gas:18,solar:8,coal:10,hydro:2,other:2},                  score:72, dc_demand:55, dc_note:'Microsoft, Google, Meta hyperscale campus presence; wind power hub' },
  KS: { name:'Kansas',              fips:'20', iso:'SPP',     utility:'Evergy',                                 capacity_gw:22.5,  peak_gw:12.1, mix:{wind:50,gas:28,nuclear:12,coal:7,solar:2,other:1},                score:58, dc_demand:28, dc_note:'Emerging DC market; low costs and abundant wind power attractive' },
  KY: { name:'Kentucky',            fips:'21', iso:'Non-ISO', utility:'LG&E and KU (PPL Corp)',                capacity_gw:23.8,  peak_gw:14.2, mix:{gas:40,coal:35,hydro:10,solar:5,wind:5,other:5},                  score:55, dc_demand:30, dc_note:'Louisville data center market growing; low power costs' },
  LA: { name:'Louisiana',           fips:'22', iso:'MISO',    utility:'Entergy Louisiana / CLECO',             capacity_gw:28.5,  peak_gw:18.8, mix:{gas:68,nuclear:16,hydro:6,solar:4,wind:3,coal:2,other:1},         score:58, dc_demand:28, dc_note:'Baton Rouge attracting HPC and cloud; natural gas abundance' },
  ME: { name:'Maine',               fips:'23', iso:'ISO-NE',  utility:'Central Maine Power (Avangrid)',        capacity_gw:5.8,   peak_gw:2.8,  mix:{wind:35,hydro:30,gas:20,solar:8,bio:7},                           score:45, dc_demand:12, dc_note:'Cold climate attractive; small market; limited transmission capacity' },
  MD: { name:'Maryland',            fips:'24', iso:'PJM',     utility:'BGE / Pepco (Exelon)',                  capacity_gw:15.5,  peak_gw:11.2, mix:{gas:50,nuclear:32,solar:8,wind:4,hydro:3,coal:1,other:2},         score:72, dc_demand:65, dc_note:'Prince Georges County DC corridor extending from Northern Virginia' },
  MA: { name:'Massachusetts',       fips:'25', iso:'ISO-NE',  utility:'Eversource / National Grid',           capacity_gw:18.5,  peak_gw:14.2, mix:{gas:58,wind:15,solar:12,nuclear:8,hydro:4,oil:2,other:1},         score:58, dc_demand:40, dc_note:'Boston area market; constrained grid limits large-scale expansion' },
  MI: { name:'Michigan',            fips:'26', iso:'MISO',    utility:'Consumers Energy / DTE Energy',        capacity_gw:35.8,  peak_gw:22.5, mix:{gas:38,nuclear:25,wind:15,coal:12,solar:5,hydro:3,other:2},        score:65, dc_demand:40, dc_note:'Grand Rapids and Detroit markets growing; strong industrial grid' },
  MN: { name:'Minnesota',           fips:'27', iso:'MISO',    utility:'Xcel Energy / Great River Energy',     capacity_gw:24.8,  peak_gw:15.5, mix:{wind:28,gas:28,nuclear:20,coal:10,solar:8,hydro:4,other:2},        score:65, dc_demand:42, dc_note:'Twin Cities market growing; cold climate advantage for cooling' },
  MS: { name:'Mississippi',         fips:'28', iso:'MISO',    utility:'Entergy Mississippi / Mississippi Power', capacity_gw:16.2, peak_gw:10.5, mix:{gas:62,coal:18,nuclear:12,solar:4,hydro:2,other:2},             score:45, dc_demand:15, dc_note:'Low-cost power; limited current DC market; improving connectivity' },
  MO: { name:'Missouri',            fips:'29', iso:'MISO',    utility:'Ameren Missouri / Evergy Missouri',    capacity_gw:28.8,  peak_gw:17.5, mix:{gas:35,coal:28,nuclear:10,wind:14,solar:6,hydro:4,other:3},        score:62, dc_demand:42, dc_note:'Kansas City and St. Louis growing; Google, Meta investments' },
  MT: { name:'Montana',             fips:'30', iso:'Non-ISO', utility:'NorthWestern Energy',                   capacity_gw:8.2,   peak_gw:4.1,  mix:{hydro:45,wind:20,gas:18,coal:12,solar:3,other:2},                 score:48, dc_demand:18, dc_note:'Abundant hydro; cold climate; limited market but emerging interest' },
  NE: { name:'Nebraska',            fips:'31', iso:'SPP',     utility:'OPPD / NPPD / LES',                    capacity_gw:13.5,  peak_gw:7.8,  mix:{wind:38,nuclear:25,gas:18,coal:12,solar:5,hydro:2},               score:60, dc_demand:35, dc_note:'Omaha growing; public power model attractive for large load customers' },
  NV: { name:'Nevada',              fips:'32', iso:'Non-ISO', utility:'NV Energy (Berkshire Hathaway)',        capacity_gw:18.5,  peak_gw:11.2, mix:{solar:25,gas:45,geo:12,wind:8,hydro:5,coal:2,other:3},            score:75, dc_demand:65, dc_note:'Las Vegas and Reno major DC markets; Switch campus flagship; tax incentives' },
  NH: { name:'New Hampshire',       fips:'33', iso:'ISO-NE',  utility:'Eversource',                           capacity_gw:4.5,   peak_gw:3.0,  mix:{nuclear:48,hydro:22,gas:18,wind:7,solar:4,other:1},               score:48, dc_demand:15, dc_note:'Limited market; Seabrook nuclear provides stable baseload' },
  NJ: { name:'New Jersey',          fips:'34', iso:'PJM',     utility:'PSE&G / JCP&L (FirstEnergy)',          capacity_gw:22.5,  peak_gw:18.5, mix:{gas:52,nuclear:30,wind:8,solar:6,hydro:2,other:2},               score:72, dc_demand:55, dc_note:'NYC metro overflow DC market; strong fiber connectivity; PJM stability' },
  NM: { name:'New Mexico',          fips:'35', iso:'Non-ISO', utility:'PNM / Xcel Energy',                    capacity_gw:12.8,  peak_gw:6.2,  mix:{wind:28,solar:25,gas:32,coal:8,other:7},                          score:52, dc_demand:25, dc_note:'Albuquerque and Santa Teresa seeing early DC investment; low costs' },
  NY: { name:'New York',            fips:'36', iso:'NYISO',   utility:'Con Edison / National Grid / NYSEG',   capacity_gw:42.5,  peak_gw:33.8, mix:{hydro:22,gas:38,nuclear:25,wind:8,solar:4,other:3},               score:65, dc_demand:55, dc_note:'NYC and Upstate NY markets; NYISO capacity constraints; high costs' },
  NC: { name:'North Carolina',      fips:'37', iso:'Non-ISO', utility:'Duke Energy Carolinas / Duke Progress', capacity_gw:52.5, peak_gw:28.5, mix:{gas:40,nuclear:30,solar:18,coal:6,hydro:4,wind:1,other:1},         score:80, dc_demand:72, dc_note:'Research Triangle (RTP) top-5 US DC market; Duke nuclear baseload' },
  ND: { name:'North Dakota',        fips:'38', iso:'MISO',    utility:'Otter Tail Power / MDU',               capacity_gw:9.8,   peak_gw:4.2,  mix:{wind:40,coal:30,gas:18,solar:5,hydro:5,other:2},                  score:45, dc_demand:12, dc_note:'Cold climate advantage; low land costs; limited market currently' },
  OH: { name:'Ohio',                fips:'39', iso:'PJM',     utility:'AEP Ohio / FirstEnergy',               capacity_gw:38.5,  peak_gw:26.5, mix:{gas:38,nuclear:22,wind:12,coal:18,solar:5,hydro:2,other:3},        score:78, dc_demand:65, dc_note:'Columbus is top-10 US DC market; Amazon, Google, Microsoft campuses' },
  OK: { name:'Oklahoma',            fips:'40', iso:'SPP',     utility:'OG&E / PSO (AEP)',                     capacity_gw:28.5,  peak_gw:15.5, mix:{wind:42,gas:38,solar:10,coal:7,hydro:2,other:1},                  score:65, dc_demand:38, dc_note:'Tulsa market growing; abundant cheap wind power; low land costs' },
  OR: { name:'Oregon',              fips:'41', iso:'Non-ISO', utility:'PacifiCorp / Portland General Electric', capacity_gw:28.5, peak_gw:13.5, mix:{hydro:48,wind:20,gas:18,solar:8,geo:3,other:3},                   score:80, dc_demand:70, dc_note:'Hillsboro/Portland major hyperscale campus hub; cheap hydro power' },
  PA: { name:'Pennsylvania',        fips:'42', iso:'PJM',     utility:'PPL Electric / PECO / Met-Ed',         capacity_gw:45.8,  peak_gw:33.2, mix:{gas:42,nuclear:35,wind:8,solar:4,hydro:3,coal:5,other:3},         score:80, dc_demand:62, dc_note:'Pittsburgh and Philadelphia markets; PJM anchor; strong nuclear base' },
  RI: { name:'Rhode Island',        fips:'44', iso:'ISO-NE',  utility:'National Grid',                        capacity_gw:3.8,   peak_gw:2.8,  mix:{gas:72,wind:15,solar:8,hydro:3,other:2},                          score:40, dc_demand:12, dc_note:'Small market; limited DC activity; high power costs' },
  SC: { name:'South Carolina',      fips:'45', iso:'Non-ISO', utility:'Duke Energy Carolinas / Dominion SC',  capacity_gw:28.5,  peak_gw:17.8, mix:{nuclear:52,gas:25,hydro:8,solar:8,coal:4,other:3},               score:72, dc_demand:45, dc_note:'Growing market; highest nuclear % share in US; low-cost stable power' },
  SD: { name:'South Dakota',        fips:'46', iso:'SPP',     utility:'Xcel Energy / NorthWestern Energy',    capacity_gw:6.2,   peak_gw:2.8,  mix:{wind:45,hydro:30,gas:15,solar:5,coal:4,other:1},                  score:50, dc_demand:15, dc_note:'Cold climate; cheap renewables; emerging market with few large DCs' },
  TN: { name:'Tennessee',           fips:'47', iso:'Non-ISO', utility:'Tennessee Valley Authority (TVA)',     capacity_gw:38.5,  peak_gw:22.8, mix:{gas:32,nuclear:30,hydro:18,coal:10,solar:5,wind:2,other:3},        score:72, dc_demand:50, dc_note:'TVA rates competitive; Memphis and Nashville growing DC markets' },
  TX: { name:'Texas',               fips:'48', iso:'ERCOT',   utility:'ERCOT (AEP, Oncor, CenterPoint)',      capacity_gw:155.5, peak_gw:85.5, mix:{gas:42,wind:25,solar:12,nuclear:9,coal:8,hydro:1,other:3},         score:90, dc_demand:88, dc_note:'Dallas-Fort Worth is #2 global DC market; massive ERCOT buildout; deregulated' },
  UT: { name:'Utah',                fips:'49', iso:'Non-ISO', utility:'Rocky Mountain Power (PacifiCorp)',    capacity_gw:14.8,  peak_gw:8.5,  mix:{gas:35,coal:28,wind:16,solar:14,hydro:5,other:2},                 score:65, dc_demand:48, dc_note:'Salt Lake City market growing; Microsoft, Adobe; data center corridor forming' },
  VT: { name:'Vermont',             fips:'50', iso:'ISO-NE',  utility:'Green Mountain Power',                 capacity_gw:2.8,   peak_gw:1.5,  mix:{hydro:42,wind:22,solar:18,nuclear:10,bio:8},                       score:38, dc_demand:8,  dc_note:'Tiny market; 100% renewable grid attractive but limited scale' },
  VA: { name:'Virginia',            fips:'51', iso:'PJM',     utility:'Dominion Energy Virginia',             capacity_gw:35.8,  peak_gw:22.5, mix:{gas:42,nuclear:32,solar:10,hydro:5,wind:3,coal:4,other:4},         score:92, dc_demand:98, dc_note:'#1 global data center market; Loudoun County corridor; hyperscale leaders' },
  WA: { name:'Washington',          fips:'53', iso:'Non-ISO', utility:'Puget Sound Energy / PacifiCorp',      capacity_gw:38.5,  peak_gw:19.5, mix:{hydro:62,wind:12,gas:15,nuclear:8,solar:2,other:1},               score:85, dc_demand:72, dc_note:'Eastern WA major hyperscale campus zone; Microsoft, Google, Meta; abundant hydro' },
  WV: { name:'West Virginia',       fips:'54', iso:'PJM',     utility:'Appalachian Power (AEP)',              capacity_gw:16.5,  peak_gw:9.8,  mix:{gas:38,coal:32,hydro:12,wind:10,solar:4,other:4},                 score:55, dc_demand:28, dc_note:'Low power costs; tax incentives; growing DC market in Charleston area' },
  WI: { name:'Wisconsin',           fips:'55', iso:'MISO',    utility:'We Energies / Alliant Energy',        capacity_gw:22.8,  peak_gw:15.5, mix:{gas:38,nuclear:20,wind:15,coal:14,solar:6,hydro:5,other:2},        score:62, dc_demand:38, dc_note:'Milwaukee area market growing; competitive power rates in MISO' },
  WY: { name:'Wyoming',             fips:'56', iso:'Non-ISO', utility:'Rocky Mountain Power (PacifiCorp)',    capacity_gw:10.8,  peak_gw:4.2,  mix:{wind:38,coal:30,gas:18,hydro:8,solar:4,other:2},                  score:45, dc_demand:15, dc_note:'Abundant wind; limited market; Microsoft edge campus emerging' },
};

// FIPS → state ID lookup
const FIPS_TO_STATE = {};
for (const [id, d] of Object.entries(STATE_DATA)) {
  FIPS_TO_STATE[d.fips] = id;
}

// ISO color palette
const ISO_COLORS = {
  'PJM':     '#3b82f6',
  'ERCOT':   '#ef4444',
  'MISO':    '#8b5cf6',
  'CAISO':   '#f59e0b',
  'NYISO':   '#10b981',
  'ISO-NE':  '#06b6d4',
  'SPP':     '#f97316',
  'Non-ISO': '#6b7280',
};

// 345+ kV transmission network density score (0–100)
// Based on known grid topology: PJM/ERCOT cores score highest; rural non-ISO lowest.
// Used for the "345 kV Network" US map toggle view.
// Line-mile data from the live Overpass/OSM layer is shown in state detail.
const KV345_SCORES = {
  AL:55, AK:5,  AZ:62, AR:58, CA:78, CO:60, CT:52, DE:55, DC:30,
  FL:72, GA:70, HI:5,  ID:45, IL:85, IN:80, IA:68, KS:65, KY:65,
  LA:60, ME:38, MD:78, MA:58, MI:78, MN:70, MS:52, MO:68, MT:40,
  NE:62, NV:55, NH:45, NJ:83, NM:48, NY:75, NC:82, ND:40, OH:88,
  OK:68, OR:68, PA:90, RI:42, SC:62, SD:42, TN:65, TX:92, UT:52,
  VT:35, VA:85, WA:72, WV:72, WI:72, WY:42,
};

// ── EPA eGRID 2022 ────────────────────────────────────────────────────────────
// Annual average CO₂ output emission rates (lbs CO₂/MWh) by eGRID subregion.
// Source: EPA eGRID 2022 Summary Tables (published Jan 2024)
// https://www.epa.gov/egrid

const EGRID_DATA = {
  AKGD: { name: 'Alaska (Railbelt)',       co2: 883,  nox: 0.98, so2: 0.44 },
  AKMS: { name: 'Alaska (Southcentral)',   co2: 1095, nox: 1.32, so2: 0.52 },
  AZNM: { name: 'Southwest (AZNM)',        co2: 959,  nox: 0.62, so2: 0.31 },
  CAMX: { name: 'California (CAMX)',       co2: 397,  nox: 0.18, so2: 0.04 },
  ERCT: { name: 'ERCOT (Texas)',           co2: 870,  nox: 0.42, so2: 0.06 },
  FRCC: { name: 'Florida (FRCC)',          co2: 832,  nox: 0.38, so2: 0.10 },
  HIOA: { name: 'Hawaii (Oahu)',           co2: 1571, nox: 1.24, so2: 1.10 },
  HIMS: { name: 'Hawaii (non-Oahu)',       co2: 1520, nox: 1.18, so2: 1.05 },
  MROE: { name: 'MRO East (WI)',           co2: 1198, nox: 0.78, so2: 0.86 },
  MROW: { name: 'MRO West (IA/MN/ND)',     co2: 1099, nox: 0.68, so2: 0.72 },
  NEWE: { name: 'New England (ISO-NE)',    co2: 516,  nox: 0.22, so2: 0.06 },
  NWPP: { name: 'Northwest (NWPP)',        co2: 541,  nox: 0.30, so2: 0.12 },
  NYCW: { name: 'NYC / Westchester',       co2: 547,  nox: 0.28, so2: 0.02 },
  NYLI: { name: 'Long Island',             co2: 716,  nox: 0.38, so2: 0.08 },
  NYUP: { name: 'Upstate New York',        co2: 288,  nox: 0.14, so2: 0.04 },
  RFCE: { name: 'RFC East (PJM East)',     co2: 643,  nox: 0.36, so2: 0.22 },
  RFCM: { name: 'RFC Michigan',            co2: 1132, nox: 0.66, so2: 0.52 },
  RFCW: { name: 'RFC West (PJM West)',     co2: 1128, nox: 0.74, so2: 0.66 },
  RMPA: { name: 'Rocky Mountain (RMPA)',   co2: 1071, nox: 0.58, so2: 0.42 },
  SPNO: { name: 'SPP North (KS/NE)',       co2: 1057, nox: 0.58, so2: 0.46 },
  SPSO: { name: 'SPP South (OK/TX)',       co2: 959,  nox: 0.52, so2: 0.22 },
  SRDA: { name: 'SERC Delta (AR/MS)',      co2: 856,  nox: 0.50, so2: 0.28 },
  SRMV: { name: 'SERC Mississippi V.',     co2: 1045, nox: 0.62, so2: 0.38 },
  SRMW: { name: 'SERC Midwest (AR/MO)',    co2: 1139, nox: 0.74, so2: 0.62 },
  SRSO: { name: 'SERC South (AL/GA)',      co2: 964,  nox: 0.56, so2: 0.34 },
  SRTV: { name: 'SERC Tennessee V.',       co2: 809,  nox: 0.44, so2: 0.22 },
  SRVC: { name: 'SERC Virginia/Carolina',  co2: 672,  nox: 0.36, so2: 0.18 },
};

// State → primary eGRID subregion (where a state spans multiple, use the dominant one)
const STATE_EGRID = {
  AL:'SRSO', AK:'AKGD', AZ:'AZNM', AR:'SRMW', CA:'CAMX', CO:'RMPA',
  CT:'NEWE', DE:'RFCE', DC:'RFCE', FL:'FRCC', GA:'SRSO', HI:'HIOA',
  ID:'NWPP', IL:'MROW', IN:'RFCW', IA:'MROW', KS:'SPNO', KY:'RFCW',
  LA:'SRMV', ME:'NEWE', MD:'RFCE', MA:'NEWE', MI:'RFCM', MN:'MROW',
  MS:'SRMV', MO:'MROW', MT:'NWPP', NE:'MROW', NV:'NWPP', NH:'NEWE',
  NJ:'RFCE', NM:'AZNM', NY:'NYUP', NC:'SRVC', ND:'MROW', OH:'RFCW',
  OK:'SPSO', OR:'NWPP', PA:'RFCE', RI:'NEWE', SC:'SRVC', SD:'MROW',
  TN:'SRTV', TX:'ERCT', UT:'NWPP', VT:'NEWE', VA:'RFCE', WA:'NWPP',
  WV:'RFCW', WI:'MROE', WY:'NWPP',
};

function egridForState(stateId) {
  const sub = STATE_EGRID[stateId];
  return sub ? { subregion: sub, ...EGRID_DATA[sub] } : null;
}

// EIA RTO "respondent" codes for each ISO/RTO — used by electricity/rto/region-data
const ISO_BA_CODES = {
  'PJM':    'PJM',
  'ERCOT':  'ERCO',
  'MISO':   'MISO',
  'CAISO':  'CISO',
  'NYISO':  'NYIS',
  'ISO-NE': 'ISNE',
  'SPP':    'SWPP',
};

// ── Regulatory environment for power plant development ────────────────────────
// structure: 'Regulated' | 'Deregulated' | 'Hybrid'
// complexity: 'Low' | 'Medium' | 'High' | 'Very High'
// cpcn: true = Certificate of Public Convenience & Necessity required for competitive generators
const STATE_REGULATORY = {
  AL: { regulator:'Alabama PSC', structure:'Regulated', cpcn:true, rps:'None', rpsPct:0, timeline:'3–5 yrs', complexity:'Medium', permits:['Alabama PSC Certificate','ADEM Air Quality Permit','Army Corps §404','Southern Co. Interconnection'], notes:'Alabama Power (Southern Co.) is vertically integrated. New generation requires PSC approval. No ISO — interconnection negotiated with utility directly.' },
  AK: { regulator:'Regulatory Commission of Alaska (RCA)', structure:'Regulated', cpcn:true, rps:'None', rpsPct:0, timeline:'4–7 yrs', complexity:'High', permits:['RCA Certificate','Alaska DEC Air Permit','DLNR Land Use Permit','Corps of Engineers §404'], notes:'Isolated island grids. Interconnection costs often prohibitive. Each utility negotiates independently outside any ISO framework.' },
  AZ: { regulator:'Arizona Corporation Commission (ACC)', structure:'Regulated', cpcn:true, rps:'15% by 2025 (AES)', rpsPct:15, timeline:'3–5 yrs', complexity:'Medium', permits:['ACC CPCN','ADEQ Air Quality Permit','BLM/State Land Lease (public land)','Army Corps §404','WECC Interconnection'], notes:'APS and TEP are vertically integrated IOUs. Significant utility-scale solar via PPA structures. BLM solar energy zones available in western AZ.' },
  AR: { regulator:'Arkansas PSC', structure:'Regulated', cpcn:true, rps:'None', rpsPct:0, timeline:'3–5 yrs', complexity:'Medium', permits:['PSC CPCN','ADEQ Air Quality Permit','ADEQ NPDES Permit','MISO Interconnection'], notes:'Entergy Arkansas is the primary IOU. Competitive wholesale generators can connect to MISO without PSC approval but must execute an interconnection agreement.' },
  CA: { regulator:'CPUC + California Energy Commission (CEC)', structure:'Hybrid', cpcn:true, rps:'100% Clean by 2045 (60% by 2030)', rpsPct:60, timeline:'5–8 yrs', complexity:'Very High', permits:['CEC Site Certification (≥50 MW thermal)','CPUC CPCN (utility-scale)','CARB Air Quality Permit','CEQA Environmental Review','State Water Board NPDES','CAISO Interconnection'], notes:'CEC has sole siting authority for large thermal plants. CEQA review typically adds 2–3 years. CAISO interconnection queue is severely congested. Offshore wind requires BOEM leasing. Most complex permitting environment in the US.' },
  CO: { regulator:'Colorado PUC', structure:'Regulated', cpcn:true, rps:'80% Renewables by 2030 (Xcel)', rpsPct:80, timeline:'3–5 yrs', complexity:'Medium', permits:['PUC CPCN','CDPHE Air Quality Permit','BLM/State ROW (public lands)','Army Corps §404','WECC Interconnection'], notes:'Xcel Energy dominant IOU. IPPs may develop as QFs under PURPA or via competitive RFP. Mountain siting requires additional CDOT and BLM coordination.' },
  CT: { regulator:'CT Public Utilities Regulatory Authority (PURA)', structure:'Deregulated', cpcn:false, rps:'48% Renewables by 2030', rpsPct:48, timeline:'3–6 yrs', complexity:'High', permits:['CT Siting Council Certificate (≥1 MW)','DEEP Air Quality Permit','Army Corps §404','ISO-NE Interconnection'], notes:'Connecticut Siting Council has jurisdiction over virtually all generation ≥1 MW. Limited buildable land and high community opposition. ISO-NE queue delays are common.' },
  DE: { regulator:'Delaware PSC', structure:'Deregulated', cpcn:false, rps:'40% by 2035', rpsPct:40, timeline:'2–4 yrs', complexity:'Medium', permits:['DNREC Air Quality Permit','DNREC Wetlands Permit','Army Corps §404','PJM Interconnection'], notes:'Retail electricity deregulated. Wholesale generators connect to PJM without PSC approval. Small state with limited capacity for large-scale builds.' },
  DC: { regulator:'Public Service Commission of DC', structure:'Regulated', cpcn:true, rps:'100% Clean by 2032', rpsPct:100, timeline:'5–8 yrs', complexity:'Very High', permits:['DC PSC Certificate','DC DOEE Air Permit','PJM Interconnection'], notes:'Dense urban area with no viable utility-scale generation sites. Power is imported entirely via PJM. Development is limited to building-scale solar and storage.' },
  FL: { regulator:'Florida PSC', structure:'Regulated', cpcn:true, rps:'None (voluntary goals)', rpsPct:0, timeline:'3–5 yrs', complexity:'Medium', permits:['Florida PSC Need Determination + CPCN','FDEP Air Quality Permit','Water Management District Permit','Army Corps §404','FPL/Duke Interconnection'], notes:'PSC requires a need determination before a CPCN is issued. FPL (NextEra) and Duke Energy Florida dominate. No ISO — utility interconnection. Hurricane resiliency requirements add cost and design complexity.' },
  GA: { regulator:'Georgia PSC', structure:'Regulated', cpcn:true, rps:'None', rpsPct:0, timeline:'3–5 yrs', complexity:'Medium', permits:['Georgia PSC Certificate','EPD Air Quality Permit','EPD NPDES Permit','Army Corps §404','Georgia Power Interconnection'], notes:'Georgia Power (Southern Co.) is the dominant IOU. PSC approval required for utility-owned generation. IPPs may sell wholesale without PSC approval. Atlanta is a top-5 US data center market driving procurement.' },
  HI: { regulator:'Hawaii PUC', structure:'Regulated', cpcn:true, rps:'100% Renewables by 2045', rpsPct:100, timeline:'5–8 yrs', complexity:'Very High', permits:['Hawaii PUC CPCN','DOH Air Quality Permit','DLNR Land Use Permit','Army Corps §404','Hawaiian Electric Interconnection'], notes:'Island grids with no interstate connections. 100% RPS mandate drives solar+storage buildout. Land constraints and cultural/environmental sensitivity make siting extremely challenging.' },
  ID: { regulator:'Idaho PUC', structure:'Regulated', cpcn:true, rps:'None', rpsPct:0, timeline:'3–5 yrs', complexity:'Medium', permits:['Idaho PUC Certificate','DEQ Air Quality Permit','BLM ROW (public lands)','Army Corps §404','Idaho Power/PacifiCorp Interconnection'], notes:'Idaho Power and PacifiCorp serve most of the state. PURPA has historically been strong in Idaho. Hydro development requires additional FERC licensing on top of state permits.' },
  IL: { regulator:'Illinois Commerce Commission (ICC)', structure:'Deregulated', cpcn:false, rps:'50% Renewables by 2040 (CEJA)', rpsPct:50, timeline:'2–4 yrs', complexity:'Medium', permits:['IEPA Air Quality Permit','Army Corps §404','MISO Interconnection','Local Zoning / Special Use Permit'], notes:'Illinois deregulated retail electricity. Wholesale generators connect to MISO without ICC approval. The 2021 Climate + Equitable Jobs Act created aggressive renewable incentives. Northern Illinois has strong grid infrastructure.' },
  IN: { regulator:'Indiana Utility Regulatory Commission (IURC)', structure:'Regulated', cpcn:true, rps:'None (10% voluntary goal)', rpsPct:10, timeline:'3–5 yrs', complexity:'Medium', permits:['IURC CPCN','IDEM Air Quality Permit','IDEM NPDES Permit','Army Corps §404','MISO Interconnection'], notes:'Duke Energy Indiana and AES Indiana are primary IOUs. IURC approval required for utility-owned generation. IPPs selling wholesale via MISO do not need IURC approval.' },
  IA: { regulator:'Iowa Utilities Board (IUB)', structure:'Regulated', cpcn:true, rps:'105 MW Wind Mandate (achieved)', rpsPct:0, timeline:'2–4 yrs', complexity:'Medium', permits:['IUB CPCN','Iowa DNR Air Quality Permit','Army Corps §404','MISO Interconnection'], notes:'MidAmerican Energy and Alliant Energy are primary utilities. Iowa leads the US in wind penetration (60%+). Wind farms under certain height thresholds only require county-level approval.' },
  KS: { regulator:'Kansas Corporation Commission (KCC)', structure:'Regulated', cpcn:true, rps:'20% by 2020 (achieved)', rpsPct:20, timeline:'2–4 yrs', complexity:'Low', permits:['KCC CPCN','KDHE Air Quality Permit','Army Corps §404','SPP Interconnection'], notes:'Evergy is the primary utility. Abundant wind resources with streamlined permitting. SPP interconnection queue is less congested than PJM/MISO. Very favorable for wind and solar development.' },
  KY: { regulator:'Kentucky PSC', structure:'Regulated', cpcn:true, rps:'None', rpsPct:0, timeline:'3–5 yrs', complexity:'Medium', permits:['Kentucky PSC Certificate','KDAQ Air Quality Permit','Army Corps §404','LG&E/KU Interconnection (PJM/MISO)'], notes:'LG&E and KU (PPL Corp) are the primary utilities. Coal transition underway with accelerating solar investment. Both PJM and MISO have footprints in Kentucky.' },
  LA: { regulator:'Louisiana PSC', structure:'Regulated', cpcn:true, rps:'None', rpsPct:0, timeline:'3–5 yrs', complexity:'Medium', permits:['Louisiana PSC CPCN','LDEQ Air Quality Permit','Army Corps §404','MISO Interconnection'], notes:'Entergy Louisiana and CLECO are primary IOUs. Natural gas dominates. Industrial corridor has significant self-generation. Coastal projects require additional environmental review.' },
  ME: { regulator:'Maine PUC', structure:'Deregulated', cpcn:false, rps:'80% by 2030 (100% by 2050)', rpsPct:80, timeline:'3–5 yrs', complexity:'Medium', permits:['Maine DEP Site Location Permit','Maine DEP Air Quality Permit','Army Corps §404','ISO-NE Interconnection'], notes:'Maine deregulated retail electricity. DEP Site Location of Development Act requires approval for large facilities. Offshore wind is a major growth sector. ISO-NE interconnection capacity is constrained.' },
  MD: { regulator:'Maryland PSC', structure:'Deregulated', cpcn:false, rps:'50% Renewables by 2030', rpsPct:50, timeline:'3–6 yrs', complexity:'High', permits:['MDE Air Quality Permit','MDE Wetlands Permit','Army Corps §404','PJM Interconnection','Local Zoning Approval'], notes:'Retail electricity deregulated. PJM wholesale generators do not need Maryland PSC approval. Strong offshore wind ambitions (9.1 GW by 2031). PJM interconnection queue is highly congested.' },
  MA: { regulator:'MA DPU + Energy Facilities Siting Board (EFSB)', structure:'Deregulated', cpcn:false, rps:'40% RPS by 2030 (100% Clean by 2050)', rpsPct:40, timeline:'4–7 yrs', complexity:'Very High', permits:['EFSB Certificate (≥100 MW)','MassDEP Air Quality Permit','MassDEP §401 Cert','Army Corps §404','ISO-NE Interconnection','Local Conservation Commission'], notes:'EFSB reviews all projects ≥100 MW. Article 97 of the state constitution protects conservation land. Offshore wind (Vineyard Wind, SouthCoast Wind) is the primary growth path. ISO-NE queue severely congested.' },
  MI: { regulator:'Michigan PSC (MPSC)', structure:'Hybrid', cpcn:true, rps:'60% Clean Energy by 2035', rpsPct:60, timeline:'3–5 yrs', complexity:'Medium', permits:['MPSC Certificate (utility generation)','EGLE Air Quality Permit','Army Corps §404','MISO Interconnection','Local Zoning'], notes:'Michigan has partial retail choice (10% of load). Consumers Energy and DTE Energy are dominant IOUs. The 2023 Clean Energy and Jobs Act set aggressive targets. Great Lakes offshore wind is under active study.' },
  MN: { regulator:'Minnesota PUC', structure:'Regulated', cpcn:true, rps:'100% Carbon-Free by 2040', rpsPct:100, timeline:'3–5 yrs', complexity:'Medium', permits:['MN PUC Certificate (≥50 MW)','MPCA Air Quality Permit','Army Corps §404','MISO Interconnection'], notes:'Xcel Energy and Great River Energy are primary utilities. PUC has jurisdiction over Large Energy Facilities (≥50 MW). The 2023 carbon-free electricity law sets one of the most ambitious mandates in the nation.' },
  MS: { regulator:'Mississippi PSC', structure:'Regulated', cpcn:true, rps:'None', rpsPct:0, timeline:'3–5 yrs', complexity:'Medium', permits:['Mississippi PSC Certificate','MDEQ Air Quality Permit','Army Corps §404','MISO Interconnection'], notes:'Entergy Mississippi and Mississippi Power (Southern Co.) are primary utilities. Limited independent power development to date. Natural gas dominates with an emerging solar market.' },
  MO: { regulator:'Missouri PSC', structure:'Regulated', cpcn:true, rps:'15% by 2021 (for utilities >2 GW)', rpsPct:15, timeline:'3–5 yrs', complexity:'Medium', permits:['Missouri PSC CPCN','MDNR Air Quality Permit','Army Corps §404','MISO Interconnection'], notes:'Ameren Missouri and Evergy Missouri are primary IOUs. Growing solar and wind via utility IRP process. Google and Meta have large facilities in the state driving renewable procurement.' },
  MT: { regulator:'Montana PSC', structure:'Hybrid', cpcn:true, rps:'15% by 2015 (achieved)', rpsPct:15, timeline:'3–5 yrs', complexity:'Medium', permits:['Montana PSC Certificate','Montana DEQ Air Quality Permit','BLM ROW (public lands)','Army Corps §404','NorthWestern Energy Interconnection'], notes:'NorthWestern Energy is the dominant utility. Significant wind and hydro resources. BLM land permitting is key for most development sites. Long transmission build-out often required.' },
  NE: { regulator:'Nebraska Power Review Board (PRB)', structure:'Regulated', cpcn:true, rps:'None', rpsPct:0, timeline:'2–4 yrs', complexity:'Low', permits:['Nebraska PRB Certificate','NDEE Air Quality Permit','Army Corps §404','SPP Interconnection'], notes:'All electric utilities in Nebraska are publicly owned (municipal, cooperative, public power districts). OPPD, NPPD, and LES serve major load centers. Public power model requires regulatory justification for investment. SPP interconnection applies.' },
  NV: { regulator:'Public Utilities Commission of Nevada (PUCN)', structure:'Regulated', cpcn:true, rps:'50% by 2030 (100% Carbon-Free by 2050)', rpsPct:50, timeline:'3–5 yrs', complexity:'Medium', permits:['PUCN CPCN','NDEP Air Quality Permit','BLM Solar Energy Zones','Army Corps §404','WECC Interconnection'], notes:'NV Energy (Berkshire Hathaway) is the dominant utility. Nevada has some of the best solar irradiance in the US. BLM solar energy zones in southern Nevada streamline federal permitting significantly.' },
  NH: { regulator:'New Hampshire PUC', structure:'Deregulated', cpcn:false, rps:'25.2% by 2025', rpsPct:25, timeline:'3–5 yrs', complexity:'Medium', permits:['NH Site Evaluation Committee (≥30 MW)','NH DES Air Quality Permit','Army Corps §404','ISO-NE Interconnection'], notes:'New Hampshire deregulated retail electricity. Site Evaluation Committee reviews large projects. Limited new generation development due to small market size and siting challenges.' },
  NJ: { regulator:'NJ Board of Public Utilities (BPU)', structure:'Deregulated', cpcn:false, rps:'50% Renewables by 2030', rpsPct:50, timeline:'3–6 yrs', complexity:'High', permits:['NJDEP Air Quality Permit','NJDEP Wetlands Permit','Army Corps §404','PJM Interconnection','Local MLUL Approval'], notes:'Retail electricity deregulated. PJM generators connect without BPU approval. NJ BPU has jurisdiction over offshore wind leases. Dense population makes onshore siting challenging. NJ has 11 GW offshore wind ambitions by 2040.' },
  NM: { regulator:'NM Public Regulation Commission (PRC)', structure:'Regulated', cpcn:true, rps:'100% Carbon-Free by 2045 (50% by 2030)', rpsPct:50, timeline:'3–5 yrs', complexity:'Medium', permits:['NM PRC CPCN','NMED Air Quality Permit','BLM ROW (extensive public land)','Army Corps §404','WECC Interconnection'], notes:'PNM and Xcel Energy are primary IOUs. Aggressive clean energy mandate. Extensive BLM and state trust land available. Large solar farms on federal land involve NEPA review — BLM has prioritized energy development.' },
  NY: { regulator:'NY PSC + Office of Renewable Energy Siting (ORES)', structure:'Deregulated', cpcn:false, rps:'70% RES by 2030 (100% Zero-Carbon by 2040)', rpsPct:70, timeline:'4–7 yrs', complexity:'Very High', permits:['ORES/Article 94 Siting Certificate (≥25 MW)','NYSDEC Air Quality Permit','NYSDEC §401 Cert','Army Corps §404','NYISO Interconnection'], notes:'NY created ORES to replace the Article 10 process and accelerate permitting. Despite reforms, NYISO interconnection queue is one of the most congested nationally. CLCPA drives aggressive offshore wind targets. Downstate NYC faces severe grid constraints.' },
  NC: { regulator:'NC Utilities Commission (NCUC)', structure:'Regulated', cpcn:true, rps:'70% Carbon Reduction by 2030 (CEJA)', rpsPct:70, timeline:'3–5 yrs', complexity:'Medium', permits:['NCUC CPCN','NCDEQ Air Quality Permit','Army Corps §404','Duke Energy Carolinas/Progress Interconnection'], notes:'Duke Energy Carolinas and Duke Progress are dominant utilities. The 2021 Clean Energy Plan (HB 951) set a pathway to 70% carbon reduction by 2030. RTP solar market is one of the most active in the Southeast.' },
  ND: { regulator:'North Dakota PSC', structure:'Regulated', cpcn:true, rps:'10% by 2015 (voluntary, achieved)', rpsPct:10, timeline:'2–4 yrs', complexity:'Low', permits:['ND PSC Siting Certificate (≥100 MW)','NDDOH Air Quality Permit','Army Corps §404','MISO Interconnection'], notes:'Excellent wind resources and a streamlined siting process. Basin Electric and MDU Resources are primary utilities. Very developer-friendly for wind and solar. MISO interconnection applies.' },
  OH: { regulator:'Public Utilities Commission of Ohio (PUCO)', structure:'Deregulated', cpcn:false, rps:'8.5% Advanced Energy by 2026', rpsPct:8, timeline:'2–4 yrs', complexity:'Medium', permits:['Ohio Power Siting Board Certificate (≥50 MW)','Ohio EPA Air Quality Permit','Army Corps §404','PJM Interconnection'], notes:'Ohio deregulated retail electricity. PJM wholesale generators do not need PUCO approval. Ohio Power Siting Board reviews projects ≥50 MW. Columbus data center market drives significant new load growth.' },
  OK: { regulator:'Oklahoma Corporation Commission (OCC)', structure:'Regulated', cpcn:true, rps:'15% by 2015 (achieved)', rpsPct:15, timeline:'2–4 yrs', complexity:'Low', permits:['OCC CPCN','ODEQ Air Quality Permit','Army Corps §404','SPP Interconnection'], notes:'OG&E and PSO (AEP) are primary utilities. Abundant wind and growing solar. SPP interconnection is less congested than PJM/MISO. Very favorable regulatory environment for independent power development.' },
  OR: { regulator:'Oregon PUC + Energy Facility Siting Council (EFSC)', structure:'Hybrid', cpcn:true, rps:'80% Renewables by 2030 (100% by 2040)', rpsPct:80, timeline:'3–6 yrs', complexity:'High', permits:['EFSC Site Certificate (≥35 MW)','Oregon DEQ Air Quality Permit','DSL Removal-Fill Permit','Army Corps §404','WECC Interconnection (PGE/PacifiCorp)'], notes:'EFSC has jurisdiction over plants ≥35 MW. Portland General Electric and PacifiCorp serve most of Oregon. Hillsboro/Portland data center corridor creates significant load. BPA transmission is key for eastern Oregon resources.' },
  PA: { regulator:'Pennsylvania PUC', structure:'Deregulated', cpcn:false, rps:'18% by 2021 (AEPS)', rpsPct:18, timeline:'2–4 yrs', complexity:'Medium', permits:['PA DEP Air Quality Permit','PA DEP NPDES Permit','Army Corps §404','PJM Interconnection','Local Zoning Approval'], notes:'Pennsylvania deregulated retail electricity in 1999. PJM wholesale generators connect without PUC approval. One of the most active wholesale power markets in PJM. Western PA natural gas enables gas-fired development.' },
  RI: { regulator:'Rhode Island PUC', structure:'Deregulated', cpcn:false, rps:'100% Renewable by 2033', rpsPct:100, timeline:'3–5 yrs', complexity:'High', permits:['RI DEM Air Quality Permit','RI CRMC Coastal Permit','Army Corps §404','ISO-NE Interconnection'], notes:'Small state with limited onshore land. Primary growth is in offshore wind — Block Island Wind Farm was the first operational US offshore wind project. ISO-NE interconnection capacity is constrained.' },
  SC: { regulator:'South Carolina PSC', structure:'Regulated', cpcn:true, rps:'None', rpsPct:0, timeline:'3–5 yrs', complexity:'Medium', permits:['SC PSC CPCN','SCDHEC Air Quality Permit','Army Corps §404','Duke Energy/Dominion SC Interconnection'], notes:'Duke Energy Carolinas and Dominion Energy SC are primary utilities. Highest nuclear capacity percentage of any US state. No RPS, but strong utility-driven solar procurement via IRP process.' },
  SD: { regulator:'South Dakota PUC', structure:'Regulated', cpcn:true, rps:'10% by 2015 (voluntary, achieved)', rpsPct:10, timeline:'2–4 yrs', complexity:'Low', permits:['SD PUC Certificate','DENR Air Quality Permit','Army Corps §404','SPP Interconnection'], notes:'Xcel Energy and NorthWestern Energy serve South Dakota. Excellent wind resources with a streamlined siting process. SPP interconnection is less congested. Very developer-friendly for wind and solar.' },
  TN: { regulator:'Tennessee Regulatory Authority (TRA) + TVA', structure:'Regulated', cpcn:true, rps:'None', rpsPct:0, timeline:'3–5 yrs', complexity:'Medium', permits:['TVA Interconnection Agreement','TDEC Air Quality Permit','Army Corps §404','TVA Land Use Permit (if on TVA land)'], notes:'TVA (federal corporation) supplies most of Tennessee\'s power and runs its own interconnection process outside FERC-regulated ISOs. Independent generators must negotiate directly with TVA. Solar development accelerating via TVA Green Invest program.' },
  TX: { regulator:'Public Utility Commission of Texas (PUCT)', structure:'Deregulated', cpcn:false, rps:'None (25 GW wind goal exceeded; now ~40 GW wind installed)', rpsPct:0, timeline:'1–3 yrs', complexity:'Low', permits:['TCEQ Air Quality Permit','ERCOT Registration & Interconnection Agreement','Local County/City Permits','Army Corps §404 (if wetlands)'], notes:'Most developer-friendly regulatory environment for independent power producers in the US. No CPCN required — competitive generators only need ERCOT registration and interconnection. No franchise territory restrictions within ERCOT. Primary constraints are interconnection queue position, land acquisition, and transmission upgrade costs. ERCOT is islanded from the Eastern/Western Interconnection, creating unique market dynamics.' },
  UT: { regulator:'Utah Public Service Commission (PSC)', structure:'Regulated', cpcn:true, rps:'None (20% goal)', rpsPct:20, timeline:'3–5 yrs', complexity:'Medium', permits:['Utah PSC CPCN','Utah DEQ Air Quality Permit','BLM ROW (extensive federal land)','Army Corps §404','Rocky Mountain Power Interconnection (WECC)'], notes:'Rocky Mountain Power (PacifiCorp) dominates Utah. Significant BLM land available for solar/wind. PacifiCorp Energy Vision plan includes major solar and wind buildout. Salt Lake City data center market is growing rapidly.' },
  VT: { regulator:'Vermont Public Utility Commission (PUC)', structure:'Regulated', cpcn:true, rps:'75% by 2032 (100% by 2035)', rpsPct:75, timeline:'3–6 yrs', complexity:'High', permits:['Vermont PUC §248 Certificate','Act 250 Land Use Permit','ANR Air Quality Permit','Army Corps §404','ISO-NE Interconnection'], notes:'Act 250 land use law and §248 of the Public Service Act create rigorous multi-agency review. Green Mountain Power is the dominant utility. Very strong community and environmental review requirements. Most power is imported via ISO-NE.' },
  VA: { regulator:'State Corporation Commission (SCC)', structure:'Regulated', cpcn:true, rps:'100% Carbon-Free by 2050 (VCEA)', rpsPct:100, timeline:'3–5 yrs', complexity:'Medium', permits:['VA SCC CPCN','VA DEQ Air Quality Permit','VA DEQ Water Quality Cert','Army Corps §404','Dominion Energy Virginia Interconnection (PJM)'], notes:"Virginia Clean Economy Act (VCEA, 2020) set one of the most aggressive clean energy mandates. Dominion Energy Virginia serves the world's largest data center market. Loudoun County's massive load growth drives major new generation needs. Offshore wind (Coastal Virginia Offshore Wind) is a primary focus." },
  WA: { regulator:'Washington Utilities & Transportation Commission (UTC)', structure:'Regulated', cpcn:true, rps:'100% Clean by 2045 (CETA)', rpsPct:100, timeline:'3–6 yrs', complexity:'High', permits:['EFSEC Site Certification (≥350 MW)','Ecology Air Quality Permit','Ecology Water Quality Cert','Army Corps §404','BPA/PSE/PacifiCorp Interconnection'], notes:'EFSEC reviews projects ≥350 MW. Puget Sound Energy and PacifiCorp are primary IOUs. Abundant cheap hydro via BPA. Eastern WA is a major hyperscale campus zone. BPA transmission access is critical for eastern WA resources.' },
  WV: { regulator:'West Virginia PSC', structure:'Regulated', cpcn:true, rps:'None', rpsPct:0, timeline:'3–5 yrs', complexity:'Medium', permits:['WV PSC Certificate','WV DEP Air Quality Permit','Army Corps §404','AEP Appalachian Power Interconnection (PJM)'], notes:'Appalachian Power (AEP) is the primary utility. Coal has historically dominated but gas and solar are growing. No RPS. PJM interconnection applies. WV is attracting data center development with tax incentives.' },
  WI: { regulator:'Public Service Commission of Wisconsin (PSC)', structure:'Regulated', cpcn:true, rps:'10% by 2015 (achieved)', rpsPct:10, timeline:'3–5 yrs', complexity:'Medium', permits:['Wisconsin PSC Certificate','DNR Air Quality Permit','Army Corps §404','MISO Interconnection'], notes:'We Energies and Alliant Energy are primary IOUs. PSC approval required for utility-owned generation. Offshore wind in Lake Michigan is under active study. Growing solar market through MISO.' },
  WY: { regulator:'Wyoming PSC', structure:'Regulated', cpcn:true, rps:'None', rpsPct:0, timeline:'2–4 yrs', complexity:'Low', permits:['Wyoming PSC Certificate','Wyoming DEQ Air Quality Permit','BLM ROW (extensive federal land)','Army Corps §404','Rocky Mountain Power Interconnection (WECC)'], notes:'Rocky Mountain Power (PacifiCorp) is the dominant utility. Excellent wind resources and extensive BLM land availability. No RPS. Very developer-friendly. Transmission export capacity to other states is a growing infrastructure focus.' },
};

// Complexity color for regulatory display
const REG_COMPLEXITY_COLOR = {
  'Low':       '#22c55e',
  'Medium':    '#eab308',
  'High':      '#f97316',
  'Very High': '#ef4444',
};

// Market structure color
const REG_STRUCTURE_COLOR = {
  'Deregulated': '#38bdf8',
  'Regulated':   '#94a3b8',
  'Hybrid':      '#a78bfa',
};

// ── Top fuel source name from a mix object ────────────────────────────────────
function topFuel(mix) {
  if (!mix) return 'Unknown';
  return Object.entries(mix).sort((a, b) => b[1] - a[1])[0][0];
}

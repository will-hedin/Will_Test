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

// ── Top fuel source name from a mix object ────────────────────────────────────
function topFuel(mix) {
  if (!mix) return 'Unknown';
  return Object.entries(mix).sort((a, b) => b[1] - a[1])[0][0];
}

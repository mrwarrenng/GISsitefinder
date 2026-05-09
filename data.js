// Medford, OR site-finder reference data.
//
// Candidate sites below are ILLUSTRATIVE — they sit in real Medford
// industrial/commercial corridors but the parcels, owners, and acreages are
// not from a verified listing source. They exist so the tool produces useful
// output before live parcel data is wired in.

export const MEDFORD = {
  center: [-122.8756, 42.3265],
  zoom: 11.4,
  bounds: [
    [-122.96, 42.24],
    [-122.78, 42.42],
  ],
};

// Reference points used for proximity scoring.
export const POIS = {
  airport: { name: "Rogue Valley Intl–Medford Airport (MFR)", lng: -122.8735, lat: 42.3742, kind: "airport" },
  downtown: { name: "Downtown Medford", lng: -122.8756, lat: 42.3265, kind: "downtown" },
  i5_exits: [
    { name: "I-5 Exit 24 (S Medford / Phoenix)", lng: -122.8902, lat: 42.2620, kind: "i5" },
    { name: "I-5 Exit 27 (Barnett Rd)", lng: -122.8755, lat: 42.3105, kind: "i5" },
    { name: "I-5 Exit 30 (Crater Lake Hwy / S Medford)", lng: -122.8680, lat: 42.3310, kind: "i5" },
    { name: "I-5 Exit 33 (Whittle Pkwy / Hwy 62)", lng: -122.8600, lat: 42.3550, kind: "i5" },
  ],
  // Approximate CORP rail line waypoints through Medford.
  rail: [
    { name: "CORP Rail @ South Stage", lng: -122.8755, lat: 42.2880, kind: "rail" },
    { name: "CORP Rail @ Downtown Yard", lng: -122.8770, lat: 42.3270, kind: "rail" },
    { name: "CORP Rail @ Table Rock", lng: -122.8650, lat: 42.3700, kind: "rail" },
  ],
};

// Zoning code → simplified group used by the criteria form.
// (Medford uses codes like I-G, I-L, M-P, C-R, C-H, C-N, C-S/P.)
export const ZONING_GROUP = {
  "I-G": "industrial",
  "I-L": "industrial",
  "M-P": "industrial",
  "C-H": "commercial",
  "C-R": "commercial",
  "C-N": "commercial",
  "C-S/P": "office",
  "MU": "mixed",
  "EFU": "agriculture",
};

// Illustrative candidate sites. Each in a real Medford corridor.
export const CANDIDATE_SITES = [
  {
    id: "S01",
    name: "Sage Rd Industrial Tract",
    address: "Sage Rd at Whittle Pkwy",
    lng: -122.8702, lat: 42.3712,
    acres: 8.5, zoning: "I-G",
    utilities: ["water", "sewer", "power3", "gas"],
    floodplain: false, slope: 3, hasRailSpur: false,
    notes: "Adjacent to airport industrial cluster.",
  },
  {
    id: "S02",
    name: "Whittle Pkwy Light Industrial",
    address: "Whittle Pkwy near Crater Lake Hwy",
    lng: -122.8632, lat: 42.3582,
    acres: 4.2, zoning: "I-L",
    utilities: ["water", "sewer", "power3", "gas", "fiber"],
    floodplain: false, slope: 2, hasRailSpur: false,
  },
  {
    id: "S03",
    name: "Table Rock Rd North — Heavy Industrial",
    address: "Table Rock Rd N",
    lng: -122.8585, lat: 42.3852,
    acres: 22.0, zoning: "I-G",
    utilities: ["water", "sewer", "power3", "gas"],
    floodplain: false, slope: 4, hasRailSpur: true,
  },
  {
    id: "S04",
    name: "Table Rock / Vilas Industrial",
    address: "Table Rock Rd at Vilas",
    lng: -122.8665, lat: 42.3500,
    acres: 6.0, zoning: "I-L",
    utilities: ["water", "sewer", "gas"],
    floodplain: true, slope: 2, hasRailSpur: false,
  },
  {
    id: "S05",
    name: "Vilas/Crater Lake Hwy Commercial Pad",
    address: "Crater Lake Hwy at Vilas Rd",
    lng: -122.8570, lat: 42.3650,
    acres: 12.0, zoning: "C-R",
    utilities: ["water", "sewer", "power3", "gas", "fiber"],
    floodplain: false, slope: 1, hasRailSpur: false,
  },
  {
    id: "S06",
    name: "South Stage Industrial Park",
    address: "South Stage Rd",
    lng: -122.8702, lat: 42.2920,
    acres: 18.0, zoning: "M-P",
    utilities: ["water", "sewer", "power3", "gas", "fiber"],
    floodplain: false, slope: 2, hasRailSpur: true,
  },
  {
    id: "S07",
    name: "Stewart Ave Heavy Commercial",
    address: "Stewart Ave at Center Dr",
    lng: -122.8722, lat: 42.3022,
    acres: 5.5, zoning: "C-H",
    utilities: ["water", "sewer", "power3", "gas", "fiber"],
    floodplain: false, slope: 1, hasRailSpur: false,
  },
  {
    id: "S08",
    name: "Barnett Rd Retail Pad",
    address: "Barnett Rd",
    lng: -122.8745, lat: 42.3140,
    acres: 3.0, zoning: "C-R",
    utilities: ["water", "sewer", "gas", "fiber"],
    floodplain: false, slope: 1, hasRailSpur: false,
  },
  {
    id: "S09",
    name: "Riverside Mixed-Use Block",
    address: "Riverside Ave",
    lng: -122.8650, lat: 42.3045,
    acres: 1.8, zoning: "MU",
    utilities: ["water", "sewer", "power3", "gas", "fiber"],
    floodplain: false, slope: 1, hasRailSpur: false,
  },
  {
    id: "S10",
    name: "N Pacific Hwy Commercial",
    address: "N Pacific Hwy at Court",
    lng: -122.8800, lat: 42.3350,
    acres: 2.5, zoning: "C-N",
    utilities: ["water", "sewer", "gas", "fiber"],
    floodplain: false, slope: 2, hasRailSpur: false,
  },
  {
    id: "S11",
    name: "Black Oak Office Park",
    address: "McAndrews Rd at Black Oak",
    lng: -122.8400, lat: 42.3600,
    acres: 9.0, zoning: "C-S/P",
    utilities: ["water", "sewer", "power3", "gas", "fiber"],
    floodplain: false, slope: 6, hasRailSpur: false,
  },
  {
    id: "S12",
    name: "E Main Commercial Lot",
    address: "E Main St at Royal",
    lng: -122.8350, lat: 42.3280,
    acres: 4.0, zoning: "C-N",
    utilities: ["water", "sewer", "gas", "fiber"],
    floodplain: false, slope: 4, hasRailSpur: false,
  },
  {
    id: "S13",
    name: "Foothill Rd Acreage (rezone candidate)",
    address: "Foothill Rd",
    lng: -122.8250, lat: 42.3450,
    acres: 35.0, zoning: "EFU",
    utilities: ["water"],
    floodplain: false, slope: 12, hasRailSpur: false,
    notes: "Outside city limits — would require annexation/rezoning.",
  },
  {
    id: "S14",
    name: "Center Dr / Garfield Light Industrial",
    address: "Center Dr at Garfield",
    lng: -122.8895, lat: 42.3180,
    acres: 11.0, zoning: "I-L",
    utilities: ["water", "sewer", "power3", "gas"],
    floodplain: false, slope: 2, hasRailSpur: false,
  },
  {
    id: "S15",
    name: "South Stage Rail-Served Tract",
    address: "South Stage Rd at Bear Creek",
    lng: -122.8755, lat: 42.2820,
    acres: 14.0, zoning: "I-G",
    utilities: ["water", "sewer", "power3", "gas"],
    floodplain: true, slope: 1, hasRailSpur: true,
  },
];

// Public ArcGIS REST endpoints to attempt for live overlays.
// Update the URLs once you confirm the City of Medford's exact published layers.
export const ARCGIS = {
  cityLimits:
    "https://maps.medfordmaps.org/arcgis/rest/services/Public/AdministrativeBoundary_Service/FeatureServer/0/query?where=1%3D1&outFields=*&outSR=4326&f=geojson",
  zoning:
    "https://maps.medfordmaps.org/arcgis/rest/services/Public/PlanningZoning_Service/FeatureServer/0/query?where=1%3D1&outFields=*&outSR=4326&f=geojson",
};

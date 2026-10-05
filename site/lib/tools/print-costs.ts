// 3D print cost calculator: constants and pure math. Every price carries the
// URL it came from and the date it was checked (fact sheet sections 3-5).
// Figures marked "derived" are calculated from cited numbers, not quoted.

import { PRICES_CHECKED_ISO, type SourceLink } from "./sources";

const CHECKED = PRICES_CHECKED_ISO;

export interface Sourced {
  source: string;
  checked: string;
}

export type Material = "pla" | "petg" | "abs-asa";
export type Urgency = "same-day" | "this-week" | "no-rush";
export type Fit = "yes" | "maybe" | "no";

export const MATERIALS: ReadonlyArray<{ id: Material; label: string }> = [
  { id: "pla", label: "PLA (most parts)" },
  { id: "petg", label: "PETG" },
  { id: "abs-asa", label: "ABS or ASA" },
];

export const URGENCIES: ReadonlyArray<{ id: Urgency; label: string }> = [
  { id: "same-day", label: "Same day" },
  { id: "this-week", label: "Within a week" },
  { id: "no-rush", label: "No rush" },
];

// --- Printers --------------------------------------------------------------

const BAMBU_PLATE: Sourced & { price: number; label: string } = {
  price: 19.99,
  label: "Bambu Textured PEI build plate, from $19.99",
  source: "https://us.store.bambulab.com/products/bambu-textured-pei-plate",
  checked: CHECKED,
};

const PRUSA_SHEET: Sourced & { price: number; label: string } = {
  price: 37,
  label: "Prusa print sheet replacement, about $37",
  source: "https://www.prusa3d.com/product/prusa-core-one/",
  checked: CHECKED,
};

export const NOZZLE: Sourced & { price: number; label: string } = {
  price: 20,
  label: "Nozzle replacement, about $20 (Prusa's estimate; it lasts hundreds of print hours)",
  source: "https://www.prusa3d.com/product/prusa-core-one/",
  checked: CHECKED,
};

export type PrinterId = "a1-mini" | "p1s" | "prusa-mini";

export interface Printer extends Sourced {
  id: PrinterId;
  name: string;
  price: number;
  plate: Sourced & { price: number; label: string };
  /** true/false when the maker says so, null when the fact sheet doesn't. */
  enclosed: boolean | null;
  /** false when the maker says ABS/ASA is not recommended. */
  absAsaOk: boolean | null;
  detail: string;
}

export const PRINTERS: readonly Printer[] = [
  {
    id: "a1-mini",
    name: "Bambu Lab A1 mini",
    price: 219,
    plate: BAMBU_PLATE,
    enclosed: false,
    absAsaOk: false,
    detail: "180 mm build volume, open frame. Made for PLA, PETG and TPU.",
    source: "https://us.store.bambulab.com/products/a1-mini",
    checked: CHECKED,
  },
  {
    id: "p1s",
    name: "Bambu Lab P1S",
    price: 399,
    plate: BAMBU_PLATE,
    enclosed: true,
    absAsaOk: null,
    detail: "256 mm build volume, enclosed.",
    source: "https://us.store.bambulab.com/products/p1s",
    checked: CHECKED,
  },
  {
    id: "prusa-mini",
    name: "Original Prusa MINI+",
    price: 508.33,
    plate: PRUSA_SHEET,
    enclosed: null,
    absAsaOk: null,
    detail: "Semi-assembled kit.",
    source: "https://www.prusa3d.com/category/original-prusa-mini/",
    checked: CHECKED,
  },
];

// --- Running costs ---------------------------------------------------------

export const FILAMENT_PRICES = {
  bambuWithSpool: {
    price: 18.99,
    label: "Bambu PLA Basic, 1 kg with spool: $18.99",
    source: "https://us.store.bambulab.com/products/pla-basic-filament",
    checked: CHECKED,
  },
  bambuRefill: {
    price: 15.99,
    label: "Bambu PLA Basic refill: $15.99",
    source: "https://us.store.bambulab.com/products/pla-basic-filament",
    checked: CHECKED,
  },
  prusaEstimate: {
    price: 25,
    label: "Prusa's PLA estimate: about $25/kg",
    source: "https://www.prusa3d.com/product/prusa-core-one/",
    checked: CHECKED,
  },
} as const;

/**
 * Derived: a 10-hour PLA print at about 100 W uses about 1 kWh, which is
 * about $0.18 at the July 2026 US average of 18.31 cents/kWh.
 */
export const ELECTRICITY = {
  perTenHourPrint: 0.18,
  centsPerKwh: 18.31,
  hoursPerPart: 10,
  label: "About $0.18 per 10-hour print (about 100 W at 18.31 cents per kWh)",
  sources: [
    { label: "Bambu Lab power draw", url: "https://wiki.bambulab.com/en/general/power-consumption" },
    { label: "EIA electricity prices", url: "https://www.eia.gov/electricity/monthly/epm_table_grapher.php?t=epmt_5_6_a" },
  ] as SourceLink[],
  checked: CHECKED,
} as const;

// --- Print service ---------------------------------------------------------

export const PRINT_SERVICE = {
  name: "JLC3DP",
  fdmFrom: 1.0,
  buildDays: 3,
  label: "JLC3DP FDM printing, from $1.00 a part, 3-day build",
  source: "https://jlc3dp.com/",
  checked: CHECKED,
  /** Placeholder the user should change; shipping only shows up in a quote. */
  defaultShipping: 8,
} as const;

// --- Libraries -------------------------------------------------------------

export type LibraryId = "downers-grove" | "brownsville" | "arlington" | "austin";

export interface Library extends Sourced {
  id: LibraryId;
  name: string;
  perGram: number;
  minPerPrint: number;
  /** Free prints a year, when the library gives them away. */
  freePrintsPerYear?: number;
  turnaround: string;
  timing: Record<Urgency, Fit>;
  note: string;
}

export const LIBRARIES: readonly Library[] = [
  {
    id: "brownsville",
    name: "Brownsville Public Library (TX)",
    perGram: 0.15,
    minPerPrint: 0,
    turnaround: "60 minutes to a few days",
    timing: { "same-day": "maybe", "this-week": "yes", "no-rush": "yes" },
    note: "$0.15 per gram for all colors and projects.",
    source: "https://www.brownsvilletx.gov/2305/3D-Printing",
    checked: CHECKED,
  },
  {
    id: "downers-grove",
    name: "Downers Grove Public Library (IL)",
    perGram: 0.1,
    minPerPrint: 1,
    turnaround: "up to three weeks",
    timing: { "same-day": "no", "this-week": "maybe", "no-rush": "yes" },
    note: "$0.10 per gram with a $1.00 minimum. Its PLA is not food safe.",
    source: "https://dglibrary.org/3d-printing/",
    checked: CHECKED,
  },
  {
    id: "arlington",
    name: "Arlington Public Library (TX)",
    perGram: 0.2,
    minPerPrint: 0,
    turnaround: "not listed",
    timing: { "same-day": "maybe", "this-week": "maybe", "no-rush": "yes" },
    note: "$0.20 per gram, charged after the print finishes. STL files and library filament only.",
    source: "https://arlingtonlibrary.org/maker",
    checked: CHECKED,
  },
  {
    id: "austin",
    name: "Austin Public Library (TX)",
    perGram: 0,
    minPerPrint: 0,
    freePrintsPerYear: 12,
    turnaround: "not listed",
    timing: { "same-day": "maybe", "this-week": "maybe", "no-rush": "yes" },
    note: "One free print a month for Austin residents with a full access card.",
    source: "https://library.austintexas.gov/node/7751100",
    checked: CHECKED,
  },
];

// --- Makerspaces -----------------------------------------------------------

export type MakerspaceId = "dallas" | "maker-nexus" | "asmbly";

export interface Makerspace extends Sourced {
  id: MakerspaceId;
  name: string;
  monthly: number;
  note: string;
}

export const MAKERSPACES: readonly Makerspace[] = [
  {
    id: "dallas",
    name: "Dallas Makerspace",
    monthly: 72,
    note: "$72 a month in 2026, with 24/7 access.",
    source: "https://dallasmakerspace.org/join/",
    checked: CHECKED,
  },
  {
    id: "maker-nexus",
    name: "Maker Nexus (Sunnyvale, CA)",
    monthly: 75,
    note: "Limited plan, $75 a month, includes the 3D printers.",
    source: "https://www.makernexus.org/join-maker-nexus",
    checked: CHECKED,
  },
  {
    id: "asmbly",
    name: "Asmbly Makerspace (Austin)",
    monthly: 95,
    note: "Base plan, $95 a month, includes 3D printing.",
    source: "https://asmbly.org/join",
    checked: CHECKED,
  },
];

// --- Inputs ----------------------------------------------------------------

export interface CostInputs {
  partsPerYear: number;
  gramsPerPart: number;
  material: Material;
  urgency: Urgency;
  filamentPerKg: number;
  servicePricePerPart: number;
  shippingPerOrder: number;
  ordersPerYear: number;
  libraryId: LibraryId;
  makerspaceId: MakerspaceId;
  makerspaceMonths: number;
}

export const DEFAULT_INPUTS: CostInputs = {
  partsPerYear: 20,
  gramsPerPart: 40,
  material: "pla",
  urgency: "this-week",
  filamentPerKg: FILAMENT_PRICES.bambuWithSpool.price,
  servicePricePerPart: PRINT_SERVICE.fdmFrom,
  shippingPerOrder: PRINT_SERVICE.defaultShipping,
  ordersPerYear: 4,
  libraryId: "brownsville",
  makerspaceId: "dallas",
  makerspaceMonths: 12,
};

export const LIMITS = {
  partsPerYear: { min: 1, max: 200 },
  gramsPerPart: { min: 1, max: 2000 },
  filamentPerKg: { min: 1, max: 200 },
  servicePricePerPart: { min: 0, max: 1000 },
  shippingPerOrder: { min: 0, max: 500 },
  ordersPerYear: { min: 1, max: 200 },
  makerspaceMonths: { min: 1, max: 12 },
} as const;

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

/** Clamp every number into a sane range so the math never sees NaN. */
export function normalizeInputs(inputs: Partial<CostInputs>): CostInputs {
  const merged = { ...DEFAULT_INPUTS, ...inputs };
  return {
    ...merged,
    partsPerYear: Math.round(clamp(merged.partsPerYear, LIMITS.partsPerYear.min, 100000)),
    gramsPerPart: clamp(merged.gramsPerPart, LIMITS.gramsPerPart.min, LIMITS.gramsPerPart.max),
    filamentPerKg: clamp(merged.filamentPerKg, LIMITS.filamentPerKg.min, LIMITS.filamentPerKg.max),
    servicePricePerPart: clamp(
      merged.servicePricePerPart,
      LIMITS.servicePricePerPart.min,
      LIMITS.servicePricePerPart.max,
    ),
    shippingPerOrder: clamp(merged.shippingPerOrder, LIMITS.shippingPerOrder.min, LIMITS.shippingPerOrder.max),
    ordersPerYear: Math.round(clamp(merged.ordersPerYear, LIMITS.ordersPerYear.min, LIMITS.ordersPerYear.max)),
    makerspaceMonths: Math.round(
      clamp(merged.makerspaceMonths, LIMITS.makerspaceMonths.min, LIMITS.makerspaceMonths.max),
    ),
    libraryId: LIBRARIES.some((library) => library.id === merged.libraryId)
      ? merged.libraryId
      : DEFAULT_INPUTS.libraryId,
    makerspaceId: MAKERSPACES.some((space) => space.id === merged.makerspaceId)
      ? merged.makerspaceId
      : DEFAULT_INPUTS.makerspaceId,
  };
}

// --- Math --------------------------------------------------------------------

export function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/** Filament for a year: parts x grams, priced per kg. */
export function filamentCost(parts: number, grams: number, perKg: number): number {
  return (parts * grams * perKg) / 1000;
}

/** Electricity for a year, counting each part as one 10-hour print. */
export function electricityCost(parts: number): number {
  return parts * ELECTRICITY.perTenHourPrint * (ELECTRICITY.hoursPerPart / 10);
}

export function maintenanceCost(printer: Printer): number {
  return NOZZLE.price + printer.plate.price;
}

/** What one more part costs on your own printer: filament plus power. */
export function printerCostPerPart(inputs: CostInputs): number {
  return filamentCost(1, inputs.gramsPerPart, inputs.filamentPerKg) + electricityCost(1);
}

export interface CostLine {
  label: string;
  amount: number;
}

export type OptionKind = "printer" | "service" | "library" | "makerspace";

export interface OptionCost {
  id: string;
  kind: OptionKind;
  name: string;
  total: number;
  lines: CostLine[];
  timing: Fit;
  timingNote: string;
  material: Fit;
  materialNote?: string;
  volumeOk: boolean;
  volumeNote?: string;
  /** The service total uses a starting price, so real quotes are higher. */
  isFloor?: boolean;
  /** Printers only: what it costs to run in later years. */
  yearTwo?: number;
  sources: SourceLink[];
}

export function printerOption(printer: Printer, raw: CostInputs): OptionCost {
  const inputs = normalizeInputs(raw);
  const parts = inputs.partsPerYear;
  const filament = filamentCost(parts, inputs.gramsPerPart, inputs.filamentPerKg);
  const power = electricityCost(parts);
  const upkeep = maintenanceCost(printer);
  const total = printer.price + upkeep + filament + power;

  let material: Fit = "yes";
  let materialNote: string | undefined;
  if (inputs.material === "abs-asa") {
    if (printer.absAsaOk === false) {
      material = "no";
      materialNote = "Bambu says ABS and ASA are not recommended on the A1 mini.";
    } else if (printer.enclosed) {
      materialNote =
        "Enclosed. ABS fumes still need ventilation that vents outside; budget for it.";
    } else {
      material = "maybe";
      materialNote = "ABS and ASA give off more fumes. Plan for ventilation that vents outside.";
    }
  }

  return {
    id: `printer:${printer.id}`,
    kind: "printer",
    name: `Buy the ${printer.name}`,
    total: round2(total),
    lines: [
      { label: `${printer.name}`, amount: printer.price },
      { label: "Nozzle and build plate (one each a year)", amount: round2(upkeep) },
      {
        label: `Filament (${parts} x ${inputs.gramsPerPart} g at $${inputs.filamentPerKg}/kg)`,
        amount: round2(filament),
      },
      { label: "Electricity (about $0.18 per 10-hour print)", amount: round2(power) },
    ],
    timing: "yes",
    timingNote: "Print the same day once it's set up.",
    material,
    materialNote,
    volumeOk: true,
    yearTwo: round2(upkeep + filament + power),
    sources: [
      { label: `${printer.name} price`, url: printer.source },
      { label: "Build plate", url: printer.plate.source },
      { label: "Nozzle", url: NOZZLE.source },
      { label: "Filament", url: FILAMENT_PRICES.bambuWithSpool.source },
      ...ELECTRICITY.sources,
    ],
  };
}

export function ordersFor(inputs: CostInputs): number {
  return Math.min(inputs.ordersPerYear, inputs.partsPerYear);
}

export function serviceOption(raw: CostInputs): OptionCost {
  const inputs = normalizeInputs(raw);
  const parts = inputs.partsPerYear;
  const orders = ordersFor(inputs);
  const printing = parts * inputs.servicePricePerPart;
  const shipping = orders * inputs.shippingPerOrder;
  const timing: Fit =
    inputs.urgency === "same-day" ? "no" : inputs.urgency === "this-week" ? "maybe" : "yes";
  return {
    id: "service",
    kind: "service",
    name: "Order from a print service: JLC3DP",
    total: round2(printing + shipping),
    lines: [
      {
        label: `Parts (${parts} x $${inputs.servicePricePerPart.toFixed(2)})`,
        amount: round2(printing),
      },
      {
        label: `Shipping (${orders} ${orders === 1 ? "order" : "orders"} x $${inputs.shippingPerOrder})`,
        amount: round2(shipping),
      },
    ],
    timing,
    timingNote: "3-day build, plus shipping.",
    material: "yes",
    volumeOk: true,
    isFloor: inputs.servicePricePerPart <= PRINT_SERVICE.fdmFrom,
    sources: [{ label: "JLC3DP prices and build times", url: PRINT_SERVICE.source }],
  };
}

export function libraryById(id: LibraryId): Library {
  return LIBRARIES.find((library) => library.id === id) ?? LIBRARIES[0]!;
}

export function makerspaceById(id: MakerspaceId): Makerspace {
  return MAKERSPACES.find((space) => space.id === id) ?? MAKERSPACES[0]!;
}

export function libraryOption(raw: CostInputs): OptionCost {
  const inputs = normalizeInputs(raw);
  const library = libraryById(inputs.libraryId);
  const parts = inputs.partsPerYear;
  const perPrint = Math.max(library.minPerPrint, inputs.gramsPerPart * library.perGram);
  const total = parts * perPrint;
  const free = library.freePrintsPerYear;
  const volumeOk = free === undefined || parts <= free;
  const material: Fit = inputs.material === "pla" ? "yes" : "maybe";
  return {
    id: "library",
    kind: "library",
    name: `Use the library: ${library.name}`,
    total: round2(total),
    lines: [
      free !== undefined
        ? { label: `Up to ${free} free prints a year`, amount: 0 }
        : {
            label:
              library.minPerPrint > 0
                ? `Printing (${parts} x ${inputs.gramsPerPart} g at $${library.perGram.toFixed(2)}/g, $${library.minPerPrint.toFixed(2)} minimum)`
                : `Printing (${parts} x ${inputs.gramsPerPart} g at $${library.perGram.toFixed(2)}/g)`,
            amount: round2(total),
          },
    ],
    timing: library.timing[inputs.urgency],
    timingNote: `Turnaround: ${library.turnaround}.`,
    material,
    materialNote:
      material === "maybe"
        ? "Libraries print with their own filament. Ask before you count on PETG, ABS or ASA."
        : undefined,
    volumeOk,
    volumeNote: volumeOk ? undefined : `Covers ${free} of your ${parts} parts a year.`,
    sources: [{ label: library.name, url: library.source }],
  };
}

export function makerspaceOption(raw: CostInputs): OptionCost {
  const inputs = normalizeInputs(raw);
  const space = makerspaceById(inputs.makerspaceId);
  const parts = inputs.partsPerYear;
  const membership = inputs.makerspaceMonths * space.monthly;
  const filament = filamentCost(parts, inputs.gramsPerPart, inputs.filamentPerKg);
  return {
    id: "makerspace",
    kind: "makerspace",
    name: `Join a makerspace: ${space.name}`,
    total: round2(membership + filament),
    lines: [
      {
        label: `Membership (${inputs.makerspaceMonths} ${inputs.makerspaceMonths === 1 ? "month" : "months"} x $${space.monthly})`,
        amount: round2(membership),
      },
      { label: "Filament, if you buy your own", amount: round2(filament) },
    ],
    timing: "yes",
    timingNote: "You print it yourself when you're there.",
    material: "yes",
    materialNote:
      inputs.material === "abs-asa" ? "Ask whether the space has a vented printer for ABS." : undefined,
    volumeOk: true,
    sources: [{ label: space.name, url: space.source }],
  };
}

export function computeOptions(raw: CostInputs): OptionCost[] {
  const inputs = normalizeInputs(raw);
  return [
    ...PRINTERS.map((printer) => printerOption(printer, inputs)),
    serviceOption(inputs),
    libraryOption(inputs),
    makerspaceOption(inputs),
  ];
}

/** An option you could actually use: timing, material and volume all work. */
export function isEligible(option: OptionCost): boolean {
  return option.timing !== "no" && option.material !== "no" && option.volumeOk;
}

/** Cheapest printer you could use for this material. */
export function bestPrinter(raw: CostInputs): Printer {
  const inputs = normalizeInputs(raw);
  const usable = PRINTERS.filter((printer) => isEligible(printerOption(printer, inputs)));
  const pool = usable.length > 0 ? usable : [...PRINTERS];
  return pool.reduce((best, printer) =>
    printerOption(printer, inputs).total < printerOption(best, inputs).total ? printer : best,
  );
}

/** Cheapest option that isn't a printer and fits timing, material and volume. */
export function bestAlternative(raw: CostInputs): OptionCost | null {
  const inputs = normalizeInputs(raw);
  const options = [serviceOption(inputs), libraryOption(inputs), makerspaceOption(inputs)].filter(
    isEligible,
  );
  if (options.length === 0) return null;
  return options.reduce((best, option) => (option.total < best.total ? option : best));
}

export const BREAK_EVEN_SEARCH_MAX = 2000;

export interface BreakEven {
  printer: Printer;
  /** Smallest parts-per-year count where the printer costs no more than the best alternative. */
  parts: number | null;
  /** Name of the alternative at that point; null when nothing else fits. */
  versus: string | null;
  versusKind: OptionKind | null;
}

/**
 * Smallest yearly part count at which buying the printer costs no more, in
 * year one, than the cheapest other option that fits. Searches 1..2000.
 */
export function breakEven(raw: CostInputs, printer = bestPrinter(raw)): BreakEven {
  const inputs = normalizeInputs(raw);
  for (let parts = 1; parts <= BREAK_EVEN_SEARCH_MAX; parts += 1) {
    const at = { ...inputs, partsPerYear: parts };
    const alternative = bestAlternative(at);
    const own = printerOption(printer, at).total;
    if (!alternative) return { printer, parts, versus: null, versusKind: null };
    if (own <= alternative.total) {
      return { printer, parts, versus: alternative.name, versusKind: alternative.kind };
    }
  }
  const alternative = bestAlternative(inputs);
  return {
    printer,
    parts: null,
    versus: alternative?.name ?? null,
    versusKind: alternative?.kind ?? null,
  };
}

/**
 * The service price per part above which the printer is cheaper at your
 * volume. Null when it would not be positive (shipping alone costs more than
 * the printer).
 */
export function serviceQuoteThreshold(raw: CostInputs, printer = bestPrinter(raw)): number | null {
  const inputs = normalizeInputs(raw);
  const own = printerOption(printer, inputs).total;
  const shipping = ordersFor(inputs) * inputs.shippingPerOrder;
  const threshold = (own - shipping) / inputs.partsPerYear;
  return threshold > 0 ? round2(threshold) : null;
}

export interface Recommendation {
  winner: OptionCost | null;
  options: OptionCost[];
  breakEven: BreakEven;
  quoteThreshold: number | null;
  /** Cost of a one-month makerspace stint if you batch every print into it. */
  batchedMakerspace: number;
}

export function recommend(raw: CostInputs): Recommendation {
  const inputs = normalizeInputs(raw);
  const options = computeOptions(inputs).sort((a, b) => a.total - b.total);
  const eligible = options.filter(isEligible);
  const winner = eligible[0] ?? null;
  const printer = bestPrinter(inputs);
  return {
    winner,
    options,
    breakEven: breakEven(inputs, printer),
    quoteThreshold: serviceQuoteThreshold(inputs, printer),
    batchedMakerspace: makerspaceOption({ ...inputs, makerspaceMonths: 1 }).total,
  };
}

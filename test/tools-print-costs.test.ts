import { describe, expect, it } from "vitest";
import {
  BREAK_EVEN_SEARCH_MAX,
  DEFAULT_INPUTS,
  ELECTRICITY,
  FILAMENT_PRICES,
  LIBRARIES,
  MAKERSPACES,
  NOZZLE,
  PRINTERS,
  PRINT_SERVICE,
  bestAlternative,
  bestPrinter,
  breakEven,
  computeOptions,
  electricityCost,
  filamentCost,
  isEligible,
  libraryOption,
  makerspaceOption,
  normalizeInputs,
  printerCostPerPart,
  printerOption,
  recommend,
  serviceOption,
  serviceQuoteThreshold,
  type CostInputs,
} from "../site/lib/tools/print-costs";

const a1 = PRINTERS.find((printer) => printer.id === "a1-mini")!;
const p1s = PRINTERS.find((printer) => printer.id === "p1s")!;
const mini = PRINTERS.find((printer) => printer.id === "prusa-mini")!;

function inputs(overrides: Partial<CostInputs> = {}): CostInputs {
  return { ...DEFAULT_INPUTS, ...overrides };
}

describe("print cost constants", () => {
  it("match the fact sheet and carry a source and a check date", () => {
    expect(a1.price).toBe(219);
    expect(p1s.price).toBe(399);
    expect(mini.price).toBe(508.33);
    expect(FILAMENT_PRICES.bambuWithSpool.price).toBe(18.99);
    expect(FILAMENT_PRICES.bambuRefill.price).toBe(15.99);
    expect(FILAMENT_PRICES.prusaEstimate.price).toBe(25);
    expect(NOZZLE.price).toBe(20);
    expect(ELECTRICITY.perTenHourPrint).toBe(0.18);
    expect(PRINT_SERVICE.fdmFrom).toBe(1);
    expect(PRINT_SERVICE.buildDays).toBe(3);
    expect(LIBRARIES.map((library) => library.perGram).sort()).toEqual([0, 0.1, 0.15, 0.2]);
    expect(MAKERSPACES.map((space) => space.monthly).sort()).toEqual([72, 75, 95]);

    const sourced = [
      ...PRINTERS,
      ...PRINTERS.map((printer) => printer.plate),
      NOZZLE,
      ...Object.values(FILAMENT_PRICES),
      PRINT_SERVICE,
      ...LIBRARIES,
      ...MAKERSPACES,
    ];
    for (const item of sourced) {
      expect(item.source, JSON.stringify(item)).toMatch(/^https:\/\//);
      expect(item.checked).toBe("2026-10-05");
    }
    for (const source of ELECTRICITY.sources) expect(source.url).toMatch(/^https:\/\//);
  });
});

describe("print cost math", () => {
  it("prices filament per kg and power per 10-hour print", () => {
    expect(filamentCost(20, 40, 18.99)).toBeCloseTo(15.192, 6);
    expect(filamentCost(1, 1000, 25)).toBe(25);
    expect(electricityCost(20)).toBeCloseTo(3.6, 6);
    expect(printerCostPerPart(inputs())).toBeCloseTo(0.04 * 18.99 + 0.18, 6);
  });

  it("adds printer, nozzle, build plate, filament and power for year one", () => {
    const option = printerOption(a1, inputs());
    // 219 + (20 + 19.99) + 15.192 + 3.6
    expect(option.total).toBeCloseTo(277.78, 2);
    expect(option.yearTwo).toBeCloseTo(58.78, 2);
    expect(option.lines.map((line) => line.amount)).toEqual([219, 39.99, 15.19, 3.6]);

    const prusa = printerOption(mini, inputs());
    // 508.33 + (20 + 37) + 15.192 + 3.6
    expect(prusa.total).toBeCloseTo(584.12, 2);
  });

  it("charges the service per part plus shipping per order, capped at one order per part", () => {
    expect(serviceOption(inputs()).total).toBe(20 * 1 + 4 * 8);
    expect(serviceOption(inputs({ partsPerYear: 2 })).total).toBe(2 * 1 + 2 * 8);
    expect(serviceOption(inputs({ servicePricePerPart: 12.5, shippingPerOrder: 0 })).total).toBe(250);
    expect(serviceOption(inputs()).isFloor).toBe(true);
    expect(serviceOption(inputs({ servicePricePerPart: 5 })).isFloor).toBe(false);
  });

  it("prices library prints per gram with the minimum charge", () => {
    expect(libraryOption(inputs({ libraryId: "brownsville" })).total).toBe(20 * 40 * 0.15);
    expect(libraryOption(inputs({ libraryId: "arlington" })).total).toBe(20 * 40 * 0.2);
    // 5 g at $0.10/g is $0.50, below the $1.00 minimum.
    expect(libraryOption(inputs({ libraryId: "downers-grove", gramsPerPart: 5 })).total).toBe(20);
    expect(libraryOption(inputs({ libraryId: "downers-grove", gramsPerPart: 40 })).total).toBe(80);
  });

  it("caps Austin's free prints at one a month", () => {
    const fits = libraryOption(inputs({ libraryId: "austin", partsPerYear: 12 }));
    expect(fits.total).toBe(0);
    expect(fits.volumeOk).toBe(true);
    const tooMany = libraryOption(inputs({ libraryId: "austin", partsPerYear: 13 }));
    expect(tooMany.volumeOk).toBe(false);
    expect(isEligible(tooMany)).toBe(false);
  });

  it("charges makerspace months plus filament", () => {
    const year = makerspaceOption(inputs({ makerspaceId: "dallas", makerspaceMonths: 12 }));
    expect(year.total).toBeCloseTo(12 * 72 + 15.192, 2);
    const month = makerspaceOption(inputs({ makerspaceId: "asmbly", makerspaceMonths: 1 }));
    expect(month.total).toBeCloseTo(95 + 15.192, 2);
  });

  it("drops options that miss the deadline or the material", () => {
    expect(serviceOption(inputs({ urgency: "same-day" })).timing).toBe("no");
    expect(serviceOption(inputs({ urgency: "this-week" })).timing).toBe("maybe");
    expect(serviceOption(inputs({ urgency: "no-rush" })).timing).toBe("yes");
    expect(libraryOption(inputs({ libraryId: "downers-grove", urgency: "same-day" })).timing).toBe("no");

    const abs = inputs({ material: "abs-asa" });
    expect(printerOption(a1, abs).material).toBe("no");
    expect(printerOption(p1s, abs).material).toBe("yes");
    expect(bestPrinter(abs).id).toBe("p1s");
    expect(bestPrinter(inputs()).id).toBe("a1-mini");
    expect(libraryOption(inputs({ material: "petg" })).material).toBe("maybe");
  });

  it("clamps bad input instead of returning NaN", () => {
    const cleaned = normalizeInputs({ partsPerYear: Number.NaN, gramsPerPart: -5, ordersPerYear: 0 });
    expect(cleaned.partsPerYear).toBe(1);
    expect(cleaned.gramsPerPart).toBe(1);
    expect(cleaned.ordersPerYear).toBe(1);
    for (const option of computeOptions(cleaned)) expect(Number.isFinite(option.total)).toBe(true);
  });
});

describe("break-even and recommendation", () => {
  it("finds the part count where the A1 mini beats library printing", () => {
    // No print service in the running (same day), library at $0.15/g and a
    // makerspace year at $72/month: the library is the cheapest alternative
    // until the printer catches up.
    const setup = inputs({ urgency: "no-rush", servicePricePerPart: 50 });
    const result = breakEven(setup);
    expect(result.printer.id).toBe("a1-mini");
    // Printer: 258.99 + 0.9396n. Library: 6n. Equal at n = 51.2, so 52.
    expect(result.parts).toBe(52);
    expect(result.versus).toMatch(/library/i);
    expect(printerOption(a1, { ...setup, partsPerYear: 52 }).total).toBeLessThanOrEqual(
      libraryOption({ ...setup, partsPerYear: 52 }).total,
    );
    expect(printerOption(a1, { ...setup, partsPerYear: 51 }).total).toBeGreaterThan(
      libraryOption({ ...setup, partsPerYear: 51 }).total,
    );
  });

  it("reports no break-even when a $1 print service stays cheaper", () => {
    const result = breakEven(inputs({ urgency: "no-rush" }));
    expect(result.parts).toBeNull();
    expect(BREAK_EVEN_SEARCH_MAX).toBeGreaterThanOrEqual(1000);
  });

  it("says the printer wins at once when nothing else fits", () => {
    // Same day rules out the service, and a 1-part year makes the
    // makerspace year the only other choice, which costs more.
    const result = breakEven(inputs({ urgency: "same-day", libraryId: "downers-grove" }));
    expect(result.parts).toBe(1);
    expect(result.versus).toMatch(/makerspace/i);
  });

  it("gives the quote above which the printer is cheaper", () => {
    const setup = inputs();
    const threshold = serviceQuoteThreshold(setup)!;
    // (277.782 - 32) / 20
    expect(threshold).toBeCloseTo(12.29, 2);
    const atQuote = serviceOption({ ...setup, servicePricePerPart: threshold + 0.01 }).total;
    expect(printerOption(a1, setup).total).toBeLessThan(atQuote);
  });

  it("recommends the cheapest option that fits", () => {
    const rec = recommend(inputs());
    expect(rec.winner?.id).toBe("service");
    expect(rec.options[0]!.total).toBeLessThanOrEqual(rec.options[1]!.total);
    expect(rec.batchedMakerspace).toBeCloseTo(72 + 15.192, 2);

    const sameDay = recommend(inputs({ urgency: "same-day", partsPerYear: 150 }));
    expect(sameDay.winner?.kind).toBe("printer");
    expect(bestAlternative(inputs({ urgency: "same-day", partsPerYear: 150 }))?.kind).toBe("library");
  });
});

// Plain-language advice for the 3D print cost calculator, built from the
// numbers in print-costs.ts.

import {
  BREAK_EVEN_SEARCH_MAX,
  PRINT_SERVICE,
  libraryById,
  makerspaceById,
  normalizeInputs,
  recommend,
  type CostInputs,
  type OptionKind,
  type Recommendation,
} from "./print-costs";
import { formatUsd } from "./sources";

export interface Advice {
  headline: string;
  body: string[];
  breakEvenLine: string;
  tips: string[];
  recommendation: Recommendation;
}

const SHORT_NAME: Record<OptionKind, string> = {
  printer: "a printer",
  service: "a print service",
  library: "the library",
  makerspace: "a makerspace",
};

function dollars(value: number): string {
  return value >= 100 ? formatUsd(Math.round(value)) : formatUsd(value, { cents: !Number.isInteger(value) });
}

export function adviceFor(raw: CostInputs): Advice {
  const inputs = normalizeInputs(raw);
  const rec = recommend(inputs);
  const { winner, breakEven, quoteThreshold } = rec;
  const parts = inputs.partsPerYear;
  const printerName = breakEven.printer.name;
  const body: string[] = [];
  const tips: string[] = [];
  let headline = "Nothing fits all of that";

  if (winner?.kind === "service") {
    headline = "Use an online print service";
    body.push(`At ${parts} parts a year, ${PRINT_SERVICE.name} comes to about ${dollars(winner.total)} with shipping.`);
    if (winner.isFloor && quoteThreshold !== null) {
      body.push(
        `That uses its $1.00 starting price, and real quotes depend on size and material. Upload your file for a quote: above ${dollars(quoteThreshold)} a part, buying the ${printerName} costs less.`,
      );
    }
    if (winner.timing === "maybe") body.push("Its 3-day build plus shipping may not beat a one-week deadline.");
  } else if (winner?.kind === "library") {
    const library = libraryById(inputs.libraryId);
    headline = "Use your public library";
    body.push(
      library.freePrintsPerYear !== undefined
        ? `Austin residents with a full access card get one free print a month, which covers your ${parts} parts.`
        : `At ${dollars(library.perGram)} a gram, ${parts} parts of ${inputs.gramsPerPart} g cost about ${dollars(winner.total)} a year at ${library.name}.`,
    );
    body.push(`Turnaround there: ${library.turnaround}. Rules and prices vary by library, so check yours.`);
  } else if (winner?.kind === "makerspace") {
    const space = makerspaceById(inputs.makerspaceId);
    headline = "Join a makerspace";
    body.push(
      `${inputs.makerspaceMonths} ${inputs.makerspaceMonths === 1 ? "month" : "months"} at ${space.name} plus filament comes to about ${dollars(winner.total)}, and you can use the space's other tools.`,
    );
  } else if (winner?.kind === "printer") {
    const yearTwo = winner.yearTwo ?? 0;
    headline = `Buy a printer: the ${winner.name.replace(/^Buy the /, "")}`;
    body.push(
      `It costs about ${dollars(winner.total)} in year one, then about ${dollars(yearTwo)} a year for filament, power and upkeep.`,
    );
  } else {
    body.push("Try a later deadline or a different material.");
  }

  let breakEvenLine: string;
  if (breakEven.parts === null) {
    breakEvenLine = `At these prices, buying the ${printerName} doesn't pay for itself in year one, even at ${BREAK_EVEN_SEARCH_MAX.toLocaleString("en-US")} parts. ${capitalize(SHORT_NAME[breakEven.versusKind ?? "service"])} stays cheaper.`;
  } else if (breakEven.versusKind === null) {
    breakEvenLine = `Nothing else meets your deadline, so the ${printerName} is the way to get parts that fast.`;
  } else if (breakEven.parts === 1) {
    breakEvenLine = `Buying the ${printerName} costs less than ${SHORT_NAME[breakEven.versusKind]} from the very first part.`;
  } else {
    const gap = breakEven.parts - parts;
    breakEvenLine = `At ${breakEven.parts} parts a year, buying the ${printerName} pays for itself compared with ${SHORT_NAME[breakEven.versusKind]}. ${
      gap > 0 ? `You're ${gap} parts a year short of that.` : "You're past that point."
    }`;
  }

  if (winner && winner.kind !== "makerspace" && inputs.urgency === "no-rush" && rec.batchedMakerspace < winner.total) {
    const space = makerspaceById(inputs.makerspaceId);
    tips.push(
      `If you can batch every print into one month, a month at ${space.name} plus filament is about ${dollars(rec.batchedMakerspace)}.`,
    );
  }
  if (inputs.material === "abs-asa") {
    tips.push(
      "ABS and ASA give off far more particles and fumes than PLA. UL recommends ventilation that vents outside, which is a cost on top of the printer.",
    );
  }

  return { headline, body, breakEvenLine, tips, recommendation: rec };
}

function capitalize(text: string): string {
  return text.length === 0 ? text : `${text[0]!.toUpperCase()}${text.slice(1)}`;
}

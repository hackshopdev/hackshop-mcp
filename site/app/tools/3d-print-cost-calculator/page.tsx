import { pageMetadata } from "@/lib/page-metadata";
import { toolBySlug } from "@/lib/tools/catalog";
import {
  DEFAULT_INPUTS,
  ELECTRICITY,
  FILAMENT_PRICES,
  LIBRARIES,
  MAKERSPACES,
  NOZZLE,
  PRINTERS,
  PRINT_SERVICE,
  breakEven,
  filamentCost,
  libraryOption,
  printerCostPerPart,
  printerOption,
  serviceOption,
} from "@/lib/tools/print-costs";
import { formatUsd, type SourceLink } from "@/lib/tools/sources";
import { ToolPage, type FaqItem } from "../_components/ToolPage";
import shared from "../tools.module.css";
import { PrintCostCalculator } from "./PrintCostCalculator";

export const dynamic = "force-static";

const TOOL = toolBySlug("3d-print-cost-calculator");
const TITLE = "Should I buy a 3D printer? Cost calculator";

export const metadata = pageMetadata(`${TITLE} · Hackshop`, TOOL.description, TOOL.path);

// Headline numbers for the intro and FAQ, computed from the same constants
// the calculator uses so the copy never drifts from the math.
const a1 = PRINTERS[0]!;
const base = DEFAULT_INPUTS;
const a1Year = printerOption(a1, base);
const libraryYear = libraryOption(base);
const serviceYear = serviceOption(base);
const libraryBreakEven = breakEven({ ...base, urgency: "same-day" }, a1);
const perPart = printerCostPerPart(base);
const filamentPerPart = filamentCost(1, base.gramsPerPart, base.filamentPerKg);
const brownsville = LIBRARIES.find((library) => library.id === "brownsville")!;

const whole = (value: number) => formatUsd(Math.round(value));
const cents = (value: number) => formatUsd(value, { cents: true });

const FAQ: FaqItem[] = [
  {
    question: "How much does it cost to 3D print a part at home?",
    answer: `About ${cents(perPart)} for a ${base.gramsPerPart} g PLA part: ${cents(filamentPerPart)} of filament at $${base.filamentPerKg} a kg and about $0.18 of electricity for a 10-hour print. The printer, a nozzle and a build plate are most of the real cost.`,
  },
  {
    question: "Which 3D printer should a beginner buy?",
    answer:
      "For PLA and PETG parts, the Bambu Lab A1 mini ($219, 180 mm build volume) is the cheapest of the three here. Bambu says ABS and ASA are not recommended on it, so for those the enclosed Bambu Lab P1S ($399) is the pick, with ventilation that vents outside.",
  },
  {
    question: "Can my library 3D print for me?",
    answer:
      "Some do. Downers Grove Public Library (IL) charges $0.10 a gram with a $1.00 minimum and can take up to three weeks. Brownsville (TX) charges $0.15 a gram, Arlington (TX) $0.20 a gram, and Austin gives residents one free print a month. Ask your library for its rules.",
  },
  {
    question: "Are online 3D printing services cheaper?",
    answer:
      "For a few parts, usually. JLC3DP lists FDM printing from $1.00 a part with a 3-day build, but that is a starting price: your quote depends on size, material and shipping. Craftcloud compares quotes from more than 150 services.",
  },
  {
    question: "Is it safe to print ABS at home?",
    answer:
      "Take care. UL's research found ABS and nylon print hotter and release significantly more ultrafine particles and VOCs than PLA. UL recommends ventilation that vents directly outside, and found ventilated enclosures cut particles by 99.7%.",
  },
  {
    question: "Is a makerspace worth it just for printing?",
    answer:
      "It can be if you batch your prints. Dallas Makerspace is $72 a month in 2026, Maker Nexus's Limited plan is $75 and Asmbly in Austin is $95; the Maker Nexus and Asmbly plans include 3D printers. Nation of Makers keeps a map of US maker spaces.",
  },
];

const SOURCES: SourceLink[] = [
  ...PRINTERS.map((printer) => ({ label: `${printer.name} ($${printer.price})`, url: printer.source })),
  { label: "Bambu PLA Basic filament", url: FILAMENT_PRICES.bambuWithSpool.source },
  { label: "Bambu Textured PEI plate", url: PRINTERS[0]!.plate.source },
  { label: "Prusa cost of ownership (nozzle, sheet, PLA)", url: NOZZLE.source },
  ...ELECTRICITY.sources,
  { label: "JLC3DP prices and build times", url: PRINT_SERVICE.source },
  { label: "Craftcloud", url: "https://craftcloud3d.com/" },
  ...LIBRARIES.map((library) => ({ label: library.name, url: library.source })),
  ...MAKERSPACES.map((space) => ({ label: space.name, url: space.source })),
  { label: "UL Chemical Insights on 3D printing", url: "https://chemicalinsights.ul.org/3d-printing/" },
  { label: "Nation of Makers map", url: "https://www.nationofmakers.us/find-a-maker-organization" },
];

const PRICE_ROWS: Array<{ item: string; price: string; source: string }> = [
  ...PRINTERS.map((printer) => ({
    item: printer.name,
    price: formatUsd(printer.price),
    source: printer.source,
  })),
  { item: "PLA filament, 1 kg (Bambu PLA Basic with spool)", price: "$18.99", source: FILAMENT_PRICES.bambuWithSpool.source },
  { item: "PLA refill, 1 kg (Bambu)", price: "$15.99", source: FILAMENT_PRICES.bambuRefill.source },
  { item: "Bambu build plate (Textured PEI)", price: "from $19.99", source: PRINTERS[0]!.plate.source },
  { item: "Nozzle (Prusa's estimate)", price: "about $20", source: NOZZLE.source },
  { item: "Print sheet (Prusa's estimate)", price: "about $37", source: PRINTERS[2]!.plate.source },
  { item: "Electricity per 10-hour print", price: "about $0.18", source: ELECTRICITY.sources[1]!.url },
  { item: "JLC3DP FDM part", price: "from $1.00", source: PRINT_SERVICE.source },
  ...LIBRARIES.map((library) => ({
    item: library.name,
    price: library.freePrintsPerYear ? "1 free print a month" : `$${library.perGram.toFixed(2)} a gram`,
    source: library.source,
  })),
  ...MAKERSPACES.map((space) => ({ item: space.name, price: `$${space.monthly} a month`, source: space.source })),
];

export default function PrintCostCalculatorPage() {
  return (
    <ToolPage
      path={TOOL.path}
      crumb="3D printer cost calculator"
      eyebrow="Free tool · 3D printing"
      title={TITLE}
      showPricesChecked
      app={{ name: "3D printer cost calculator", description: TOOL.description }}
      intro={
        <>
          <p>
            Only if you print a lot. For {base.partsPerYear} parts of {base.gramsPerPart} g a year, a $219 Bambu
            Lab A1 mini costs about <strong>{whole(a1Year.total)}</strong> in its first year. The same parts cost
            about <strong>{whole(libraryYear.total)}</strong> at a library charging ${brownsville.perGram.toFixed(2)} a
            gram, and an online service starts around <strong>{whole(serviceYear.total)}</strong> with shipping.
          </p>
          <p>
            The printer beats library prices at about <strong>{libraryBreakEven.parts} parts a year</strong>, and
            after year one it costs about {whole(a1Year.yearTwo ?? 0)} a year to run. Put in your own numbers below.
          </p>
        </>
      }
      toolLabel="3D printer cost calculator"
      howItWorks={
        <>
          <p>
            For each option the calculator adds up one year of printing your parts. <strong>Buying a printer</strong>{" "}
            counts the printer, one nozzle and one build plate, filament by weight and about $0.18 of
            electricity per part, which assumes a 10-hour print at about 100 W. That is on the high side for
            small parts, and power is small next to filament anyway.
          </p>
          <p>
            <strong>A print service</strong> is your quote per part plus shipping per order. It starts at
            JLC3DP&apos;s $1.00 FDM price, which is a floor: upload your file for a real number.{" "}
            <strong>The library</strong> charges by the gram, with any minimum. <strong>A makerspace</strong> is
            the monthly fee times the months you&apos;re a member, plus filament if you buy your own.
          </p>
          <p>
            Then it drops anything that misses your deadline or can&apos;t print your material, picks the cheapest
            option left, and searches for the part count where buying the cheapest suitable printer costs no more
            than the best alternative.
          </p>
          <h3>Prices the calculator uses</h3>
          <table className={shared.dataTable}>
            <caption className="sr-only">Prices used by the calculator, with sources</caption>
            <thead>
              <tr>
                <th scope="col">Item</th>
                <th scope="col">Price</th>
                <th scope="col">Source</th>
              </tr>
            </thead>
            <tbody>
              {PRICE_ROWS.map((row) => (
                <tr key={row.item}>
                  <td>{row.item}</td>
                  <td>{row.price}</td>
                  <td>
                    <a href={row.source} target="_blank" rel="noopener noreferrer">
                      {new URL(row.source).hostname.replace(/^www\./, "")}
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      }
      faq={FAQ}
      related={[
        { href: "/tools/muse-board-picker", label: "Muse board picker", blurb: "Pick a board first, then see if it needs a printed stand." },
        { href: "/templates", label: "Templates", blurb: "Gadget builds you can start from." },
        { href: "/store", label: "Store", blurb: "Boards and parts, with seller links." },
      ]}
      cta={{
        title: "Print a stand for your gadget",
        body: "Some hackshop builds come with a printable stand. Start a build to get the parts list, the print files and the steps.",
        primary: { href: "/#start", label: "Start a build" },
        secondary: { href: "/muse", label: "See the boards" },
      }}
      sources={SOURCES}
    >
      <PrintCostCalculator />
    </ToolPage>
  );
}

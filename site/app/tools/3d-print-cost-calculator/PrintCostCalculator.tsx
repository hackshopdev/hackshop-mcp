"use client";

import { useMemo, useState } from "react";
import { adviceFor } from "@/lib/tools/print-advice";
import {
  DEFAULT_INPUTS,
  FILAMENT_PRICES,
  LIBRARIES,
  LIMITS,
  MAKERSPACES,
  MATERIALS,
  URGENCIES,
  isEligible,
  type CostInputs,
  type OptionCost,
} from "@/lib/tools/print-costs";
import { formatUsd } from "@/lib/tools/sources";
import shared from "../tools.module.css";
import styles from "./calculator.module.css";

function money(value: number): string {
  return value >= 100 ? formatUsd(Math.round(value)) : formatUsd(value, { cents: !Number.isInteger(value) });
}

function numberOr(value: string, fallback: number): number {
  const parsed = Number(value);
  return value.trim() === "" || !Number.isFinite(parsed) ? fallback : parsed;
}

export function PrintCostCalculator() {
  const [inputs, setInputs] = useState<CostInputs>(DEFAULT_INPUTS);
  // Raw text for number boxes so people can clear and retype.
  const [text, setText] = useState({
    gramsPerPart: String(DEFAULT_INPUTS.gramsPerPart),
    filamentPerKg: String(DEFAULT_INPUTS.filamentPerKg),
    servicePricePerPart: DEFAULT_INPUTS.servicePricePerPart.toFixed(2),
    shippingPerOrder: String(DEFAULT_INPUTS.shippingPerOrder),
    ordersPerYear: String(DEFAULT_INPUTS.ordersPerYear),
  });

  const advice = useMemo(() => adviceFor(inputs), [inputs]);
  const options = advice.recommendation.options;
  const max = Math.max(...options.map((option) => option.total), 1);
  const winnerId = advice.recommendation.winner?.id ?? null;

  const set = <K extends keyof CostInputs>(key: K, value: CostInputs[K]) =>
    setInputs((current) => ({ ...current, [key]: value }));

  const numberField = (
    key: "gramsPerPart" | "filamentPerKg" | "servicePricePerPart" | "shippingPerOrder" | "ordersPerYear",
    value: string,
  ) => {
    setText((current) => ({ ...current, [key]: value }));
    set(key, numberOr(value, DEFAULT_INPUTS[key]));
  };

  return (
    <div className={styles.layout} data-testid="print-calculator">
      <form className={`${shared.panel} ${styles.inputs}`} onSubmit={(event) => event.preventDefault()}>
        <h2 className={shared.panelTitle}>Your printing</h2>

        <div className={styles.field}>
          <label className={shared.fieldLabel} htmlFor="calc-parts">
            Parts a year: <output htmlFor="calc-parts" className={styles.output}>{inputs.partsPerYear}</output>
          </label>
          <input
            id="calc-parts"
            className={styles.range}
            type="range"
            min={LIMITS.partsPerYear.min}
            max={LIMITS.partsPerYear.max}
            step={1}
            value={inputs.partsPerYear}
            onChange={(event) => set("partsPerYear", Number(event.target.value))}
            aria-describedby="calc-parts-hint"
          />
          <p className={shared.hint} id="calc-parts-hint">
            1 to 200. Count every print, including stands, cases and mounts.
          </p>
        </div>

        <div className={styles.field}>
          <label className={shared.fieldLabel} htmlFor="calc-grams">
            Average part weight (grams)
          </label>
          <input
            id="calc-grams"
            className={shared.textInput}
            type="number"
            inputMode="decimal"
            min={LIMITS.gramsPerPart.min}
            max={LIMITS.gramsPerPart.max}
            value={text.gramsPerPart}
            onChange={(event) => numberField("gramsPerPart", event.target.value)}
            aria-describedby="calc-grams-hint"
          />
          <p className={shared.hint} id="calc-grams-hint">
            Your slicer shows the weight of a part. 40 g is the default.
          </p>
        </div>

        <fieldset className={`${shared.segmented} ${styles.field}`}>
          <legend>Material</legend>
          {MATERIALS.map((material) => (
            <button
              type="button"
              key={material.id}
              className={shared.segmentButton}
              aria-pressed={inputs.material === material.id}
              onClick={() => set("material", material.id)}
            >
              {material.label}
            </button>
          ))}
        </fieldset>

        <fieldset className={`${shared.segmented} ${styles.field}`}>
          <legend>How soon do you need parts?</legend>
          {URGENCIES.map((urgency) => (
            <button
              type="button"
              key={urgency.id}
              className={shared.segmentButton}
              aria-pressed={inputs.urgency === urgency.id}
              onClick={() => set("urgency", urgency.id)}
            >
              {urgency.label}
            </button>
          ))}
        </fieldset>

        <details className={styles.more}>
          <summary>Fine-tune prices</summary>
          <div className={styles.moreGrid}>
            <div>
              <label className={shared.fieldLabel} htmlFor="calc-filament">
                Filament, $ per kg
              </label>
              <input
                id="calc-filament"
                className={shared.textInput}
                type="number"
                inputMode="decimal"
                step="0.01"
                min={LIMITS.filamentPerKg.min}
                value={text.filamentPerKg}
                onChange={(event) => numberField("filamentPerKg", event.target.value)}
              />
              <p className={shared.hint}>
                {FILAMENT_PRICES.bambuWithSpool.label}. Refill ${FILAMENT_PRICES.bambuRefill.price}. Prusa estimates
                about ${FILAMENT_PRICES.prusaEstimate.price}.
                {inputs.material !== "pla" ? " These are PLA prices; enter what you pay for yours." : ""}
              </p>
            </div>
            <div>
              <label className={shared.fieldLabel} htmlFor="calc-quote">
                Print service quote, $ per part
              </label>
              <input
                id="calc-quote"
                className={shared.textInput}
                type="number"
                inputMode="decimal"
                step="0.01"
                min={LIMITS.servicePricePerPart.min}
                value={text.servicePricePerPart}
                onChange={(event) => numberField("servicePricePerPart", event.target.value)}
              />
              <p className={shared.hint}>JLC3DP FDM starts at $1.00. Upload your file for a real quote.</p>
            </div>
            <div>
              <label className={shared.fieldLabel} htmlFor="calc-shipping">
                Shipping per order, $
              </label>
              <input
                id="calc-shipping"
                className={shared.textInput}
                type="number"
                inputMode="decimal"
                min={LIMITS.shippingPerOrder.min}
                value={text.shippingPerOrder}
                onChange={(event) => numberField("shippingPerOrder", event.target.value)}
              />
              <p className={shared.hint}>A placeholder. Shipping shows up in your quote.</p>
            </div>
            <div>
              <label className={shared.fieldLabel} htmlFor="calc-orders">
                Orders a year
              </label>
              <input
                id="calc-orders"
                className={shared.textInput}
                type="number"
                inputMode="numeric"
                min={LIMITS.ordersPerYear.min}
                max={LIMITS.ordersPerYear.max}
                value={text.ordersPerYear}
                onChange={(event) => numberField("ordersPerYear", event.target.value)}
              />
              <p className={shared.hint}>Batch parts into fewer orders to save shipping.</p>
            </div>
            <div className={styles.wide}>
              <label className={shared.fieldLabel} htmlFor="calc-library">
                Library example
              </label>
              <select
                id="calc-library"
                className={shared.select}
                value={inputs.libraryId}
                onChange={(event) => set("libraryId", event.target.value as CostInputs["libraryId"])}
              >
                {LIBRARIES.map((library) => (
                  <option key={library.id} value={library.id}>
                    {library.name}
                  </option>
                ))}
              </select>
            </div>
            <div className={styles.wide}>
              <label className={shared.fieldLabel} htmlFor="calc-space">
                Makerspace example
              </label>
              <select
                id="calc-space"
                className={shared.select}
                value={inputs.makerspaceId}
                onChange={(event) => set("makerspaceId", event.target.value as CostInputs["makerspaceId"])}
              >
                {MAKERSPACES.map((space) => (
                  <option key={space.id} value={space.id}>
                    {space.name}, ${space.monthly}/month
                  </option>
                ))}
              </select>
            </div>
            <div className={styles.wide}>
              <label className={shared.fieldLabel} htmlFor="calc-months">
                Makerspace months: <output htmlFor="calc-months" className={styles.output}>{inputs.makerspaceMonths}</output>
              </label>
              <input
                id="calc-months"
                className={styles.range}
                type="range"
                min={LIMITS.makerspaceMonths.min}
                max={LIMITS.makerspaceMonths.max}
                value={inputs.makerspaceMonths}
                onChange={(event) => set("makerspaceMonths", Number(event.target.value))}
              />
            </div>
          </div>
        </details>
      </form>

      <div className={styles.results}>
        <div className={styles.verdict} data-testid="calc-verdict" aria-live="polite">
          <p className={styles.verdictLabel}>Our pick for you</p>
          <h2>{advice.headline}</h2>
          {advice.body.map((line) => (
            <p key={line}>{line}</p>
          ))}
          <p className={styles.breakEven} data-testid="calc-break-even">
            {advice.breakEvenLine}
          </p>
          {advice.tips.map((tip) => (
            <p className={styles.tip} key={tip}>
              {tip}
            </p>
          ))}
        </div>

        <h3 className={styles.listTitle}>One year of printing</h3>
        <ul className={styles.options} aria-label="Year-one cost of each option">
          {options.map((option) => (
            <OptionRow key={option.id} option={option} max={max} best={option.id === winnerId} />
          ))}
        </ul>
      </div>
    </div>
  );
}

function OptionRow({ option, max, best }: { option: OptionCost; max: number; best: boolean }) {
  const usable = isEligible(option);
  const flags: string[] = [];
  if (option.timing === "no") flags.push("Too slow for your deadline");
  else if (option.timing === "maybe") flags.push("Might miss your deadline");
  if (option.material === "no") flags.push(option.materialNote ?? "Not for this material");
  else if (option.materialNote) flags.push(option.materialNote);
  if (!option.volumeOk && option.volumeNote) flags.push(option.volumeNote);
  const width = Math.max(2, Math.round((option.total / max) * 100));
  return (
    <li className={`${styles.option} ${best ? styles.optionBest : ""} ${usable ? "" : styles.optionOut}`}>
      <div className={styles.optionHead}>
        <span className={styles.optionName}>
          {option.name}
          {best ? <span className={styles.bestTag}>Cheapest that fits</span> : null}
        </span>
        <strong className={styles.optionTotal}>
          {option.isFloor ? "from " : ""}
          {money(option.total)}
        </strong>
      </div>
      <div className={styles.bar} aria-hidden="true">
        <span style={{ width: `${width}%` }} />
      </div>
      <p className={styles.optionMeta}>
        {option.timingNote}
        {option.yearTwo !== undefined ? ` Later years: about ${money(option.yearTwo)}.` : ""}
      </p>
      {flags.length > 0 ? (
        <ul className={styles.flags}>
          {flags.map((flag) => (
            <li key={flag}>{flag}</li>
          ))}
        </ul>
      ) : null}
      <details className={styles.breakdown}>
        <summary>
          How we got {money(option.total)}
          <span className="sr-only"> for {option.name}</span>
        </summary>
        <ul>
          {option.lines.map((line) => (
            <li key={line.label}>
              <span>{line.label}</span>
              <span>{money(line.amount)}</span>
            </li>
          ))}
        </ul>
        <p>
          Sources:{" "}
          {option.sources.map((source, index) => (
            <span key={source.url + source.label}>
              {index > 0 ? ", " : ""}
              <a href={source.url} target="_blank" rel="noopener noreferrer">
                {source.label}
              </a>
            </span>
          ))}
        </p>
      </details>
    </li>
  );
}

import type { BoardModel } from "@/lib/models/types";
import styles from "./exploded.module.css";
import { KIND_LABELS, MODEL_NOTE, formatOuter } from "./labels";

/** Shown when WebGL is not available: the board photo and the parts list. */
export function ModelFallback({ model, reason }: { model: BoardModel; reason?: string }) {
  return (
    <div className={styles.fallback} data-testid="model-fallback">
      <div>
        <div className={styles.fallbackPhoto}>
          <img
            src={`/api/img?slug=${encodeURIComponent(model.deviceId)}`}
            alt={`${model.name} photo`}
            width={640}
            height={480}
            loading="lazy"
            decoding="async"
          />
        </div>
        <p className={styles.note}>
          The 3D view needs WebGL, which is not available in this browser{reason ? ` (${reason})` : ""}. Outer size:{" "}
          {formatOuter(model)}. {MODEL_NOTE}
        </p>
      </div>
      <ul className={styles.fallbackList}>
        {model.parts.map((part) => (
          <li key={part.id}>
            <strong>
              {part.name} <span>· {KIND_LABELS[part.kind]}</span>
            </strong>
            <span>{part.lesson}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

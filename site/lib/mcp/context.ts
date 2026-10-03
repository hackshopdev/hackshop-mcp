import platformsJson from "../../platforms.json";
import cadManifestJson from "../../public/cad/manifest.json";
import { loadCatalog } from "../catalog";
import { Platforms } from "../platform-types";
import type {
  CoreContext,
  DeviceEntry,
  Printable,
  PrintableFab,
} from "../core/types";

const DEFAULT_SITE_URL = "https://www.hackshop.dev";

interface CadManifest {
  parts: Array<{
    device_id: string;
    part: "desk-stand" | "enclosure";
    title?: string;
    checks?: Record<string, boolean | null>;
    files: {
      stl: string;
      step: string;
      svg: string;
      fab: string;
    };
  }>;
}

const platforms = Platforms.parse(platformsJson);
const cadManifest = cadManifestJson as CadManifest;

export function loadCoreContext(siteUrl = DEFAULT_SITE_URL): CoreContext {
  const { devices, tags } = loadCatalog();
  return {
    catalog: devices,
    platforms,
    printablesFor: printablesForDevice,
    siteUrl,
    tags: [...tags].sort(),
  };
}

export function defaultSiteUrl(): string {
  return DEFAULT_SITE_URL;
}

function printablesForDevice(device: DeviceEntry, siteUrl: string): Printable[] {
  const base = siteUrl.replace(/\/+$/, "");
  return cadManifest.parts
    .filter((part) => part.device_id === device.id)
    .map((part) => ({
      part: part.part,
      title: part.title ?? titleForPart(part.part),
      stl_url: absoluteUrl(base, part.files.stl),
      step_url: absoluteUrl(base, part.files.step),
      svg_url: absoluteUrl(base, part.files.svg),
      fab_url: absoluteUrl(base, part.files.fab),
      fab: manifestFab(part.checks),
    }));
}

function manifestFab(checks: Record<string, boolean | null> | undefined): PrintableFab {
  return { checks };
}

function absoluteUrl(base: string, path: string): string {
  return path.startsWith("http") ? path : `${base}${path.startsWith("/") ? "" : "/"}${path}`;
}

function titleForPart(part: "desk-stand" | "enclosure"): string {
  return part === "desk-stand" ? "Printable desk stand" : "Printable enclosure";
}

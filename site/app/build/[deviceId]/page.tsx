import { notFound } from "next/navigation";
import { BuildExperience } from "@/components/BuildExperience";
import {
  allBuildDeviceIds,
  buildPlanForDevice,
} from "@/lib/build-plan-data";
import { pageMetadata } from "@/lib/page-metadata";

export const dynamic = "force-static";

export function generateStaticParams() {
  return allBuildDeviceIds().map((deviceId) => ({ deviceId }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ deviceId: string }>;
}) {
  const { deviceId } = await params;
  const plan = buildPlanForDevice(deviceId);
  if (!plan) return {};
  return pageMetadata(`Build a ${plan.name} · Hackshop`, plan.summary, `/build/${deviceId}`);
}

export default async function BuildPage({
  params,
}: {
  params: Promise<{ deviceId: string }>;
}) {
  const { deviceId } = await params;
  const plan = buildPlanForDevice(deviceId);
  if (!plan) notFound();
  return <BuildExperience plan={plan} />;
}

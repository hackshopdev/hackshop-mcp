import { notFound } from "next/navigation";
import {
  allBuildDeviceIds,
  buildPlanForDevice,
} from "@/lib/build-plan-data";

export const dynamic = "force-static";

export function generateStaticParams() {
  return allBuildDeviceIds().map((deviceId) => ({ deviceId }));
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ deviceId: string }> },
) {
  const { deviceId } = await params;
  const plan = buildPlanForDevice(deviceId);
  if (!plan) notFound();

  return new Response(plan.agent_brief_md, {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Cache-Control": "public, s-maxage=3600",
    },
  });
}

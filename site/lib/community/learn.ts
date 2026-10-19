export const HARDWARE_STARTER_PROMPT = `Help me build one small hardware project, one verified step at a time.

My goal: [what I want it to do]
My hardware: [exact model, board revision, and what I already own]
My budget and experience: [budget, tools, and comfort with electronics]

Start by identifying the exact hardware and checking its official documentation. Ask for missing model or revision details; don't guess pins, firmware, voltage, compatibility, or price. Cite the source and version for hardware-specific claims.

Define one minimal first success on the real device before adding an AI API, automation, or enclosure. Explain backups, power limits, flash risks, and recovery before any risky step. Never purchase, flash, erase, or upload anything without my specific permission.

Give me one step, its expected result, and how to check it. Wait for my actual result before continuing. Keep simulator results, rendered concepts, source-based expectations, and real-device tests separate.

Maintain a secret-free HARDWARE.md with confirmed facts, source links, exact software revisions, checks I actually ran, failures, and unresolved questions. Keep tokens, personal information, and private network details out.

When it works, help me document the exact parts and version, a real-device demo, limitations, and a reproducible walkthrough. Prepare a public preview for my review; don't publish or claim verification on my behalf.`;

export async function copyPromptToClipboard(
  text: string,
  clipboard?: { writeText(text: string): Promise<void> },
): Promise<"copied" | "unavailable" | "failed"> {
  if (!clipboard?.writeText) return "unavailable";
  try {
    await clipboard.writeText(text);
    return "copied";
  } catch {
    return "failed";
  }
}

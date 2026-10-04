"use client";

import { type FormEvent, useState } from "react";
import ui from "@/components/ui.module.css";

type Status =
  | { kind: "idle"; text: string }
  | { kind: "sending"; text: string }
  | { kind: "sent"; text: string }
  | { kind: "error"; text: string };

export function ContactForm() {
  const [status, setStatus] = useState<Status>({ kind: "idle", text: "" });

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const message = String(formData.get("message") ?? "").trim();

    if (message.length < 10 || message.length > 5000) {
      setStatus({ kind: "error", text: "Message must be 10 to 5000 characters." });
      return;
    }

    setStatus({ kind: "sending", text: "Sending..." });
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: String(formData.get("name") ?? ""),
          email: String(formData.get("email") ?? ""),
          message,
          company: String(formData.get("company") ?? ""),
        }),
      });

      if (res.ok) {
        form.reset();
        setStatus({ kind: "sent", text: "Thanks. The message was sent." });
        return;
      }

      const data = (await res.json().catch(() => ({}))) as { error?: string };
      setStatus({
        kind: "error",
        text:
          data.error === "contact_not_configured"
            ? "Contact is not configured yet."
            : "Could not send that message. Try again in a minute.",
      });
    } catch {
      setStatus({ kind: "error", text: "Could not send that message. Try again in a minute." });
    }
  }

  return (
    <form className={ui.form} onSubmit={onSubmit}>
      <label className={ui.field}>
        <span>Name <span className={ui.muted}>(optional)</span></span>
        <input className={ui.input} name="name" type="text" maxLength={120} autoComplete="name" />
      </label>
      <label className={ui.field}>
        <span>Email <span className={ui.muted}>(optional, for a reply)</span></span>
        <input className={ui.input} name="email" type="email" maxLength={254} autoComplete="email" />
      </label>
      <label className={ui.field}>
        <span>Message</span>
        <textarea className={ui.textarea} name="message" required minLength={10} maxLength={5000} rows={7} />
      </label>
      <label className={ui.formTrap} aria-hidden="true">
        Company
        <input name="company" type="text" tabIndex={-1} autoComplete="off" />
      </label>
      <div className={ui.actions}>
        <button className={ui.btnPrimary} type="submit" disabled={status.kind === "sending" || status.kind === "sent"}>
          {status.kind === "sending" ? "Sending..." : status.kind === "sent" ? "Sent" : "Send message"}
        </button>
        {status.text ? (
          <p className={status.kind === "error" ? ui.formError : ui.formStatus} role="status">
            {status.text}
          </p>
        ) : null}
      </div>
    </form>
  );
}

"use client";

import { SignInButton, useUser } from "@clerk/nextjs";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import ui from "@/components/ui.module.css";
import { track } from "@/lib/analytics";
import { clerkEnabled } from "@/lib/auth-config";
import {
  DEFAULT_DISPLAY_NAME,
  IDEA_BODY_MAX,
  IDEA_NAME_MAX,
  IDEA_QUESTIONS,
  IDEA_TITLE_MAX,
  IDEA_TITLE_MIN,
  type IdeaQuestionId,
} from "@/lib/ideas/types";
import { containsUrl } from "@/lib/ideas/urls";
import styles from "./ideas.module.css";

type Field = "title" | "body" | "display_name";

const ERROR_TEXT: Record<string, string> = {
  links_not_allowed: "Remove the link. Ideas can't include links or web addresses.",
  blocked_words: "Please reword this. It has a word we don't allow.",
  daily_limit: "You can submit 5 ideas a day. Try again tomorrow.",
  rate_limited: "Too many tries in a short time. Wait a bit and try again.",
  sign_in_required: "Your session ended. Sign in again, then submit.",
  invalid_json: "Something went wrong sending the form. Try again.",
};

export function IdeaForm() {
  if (!clerkEnabled) return <SignInNeeded available={false} />;
  return <ClerkIdeaForm />;
}

function ClerkIdeaForm() {
  const { isLoaded, isSignedIn } = useUser();
  if (!isLoaded) return <p className={`${ui.muted} ${styles.formCard}`}>Loading…</p>;
  if (!isSignedIn) return <SignInNeeded available />;
  return <SubmitForm />;
}

function SignInNeeded({ available }: { available: boolean }) {
  return (
    <div className={styles.signInCard}>
      <h2>Sign in to submit an idea</h2>
      <p>
        Ideas are public, and signing in keeps spam out. You can browse ideas and
        start a build without an account.
      </p>
      <div className={ui.actions}>
        {available ? (
          <SignInButton mode="modal">
            <button
              type="button"
              className={ui.btnPrimary}
              onClick={() => track("sign_in_clicked", { surface: "idea_submit" })}
            >
              Sign in
            </button>
          </SignInButton>
        ) : (
          <span className={ui.muted}>Sign-in is not available right now.</span>
        )}
        <Link className={ui.btnSecondary} href="/ideas">
          Browse ideas
        </Link>
      </div>
    </div>
  );
}

function SubmitForm() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [answers, setAnswers] = useState<Partial<Record<IdeaQuestionId, string>>>({});
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<{ field: Field | null; message: string } | null>(null);
  const refs = {
    title: useRef<HTMLInputElement | null>(null),
    body: useRef<HTMLTextAreaElement | null>(null),
    display_name: useRef<HTMLInputElement | null>(null),
  };

  const fail = (field: Field | null, message: string) => {
    setError({ field, message });
    if (field) refs[field].current?.focus();
  };

  const checkLocally = (): boolean => {
    const cleanTitle = title.trim();
    if (cleanTitle.length < IDEA_TITLE_MIN) {
      fail("title", `Title needs at least ${IDEA_TITLE_MIN} characters.`);
      return false;
    }
    const fields: Array<[Field, string]> = [
      ["title", title],
      ["body", body],
      ["display_name", displayName],
    ];
    for (const [field, text] of fields) {
      if (containsUrl(text)) {
        fail(field, ERROR_TEXT.links_not_allowed ?? "Remove the link.");
        return false;
      }
    }
    return true;
  };

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (sending) return;
    setError(null);
    if (!checkLocally()) return;
    setSending(true);
    try {
      const response = await fetch("/api/ideas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          body,
          display_name: displayName,
          size: answers.size ?? null,
          interaction: answers.interaction ?? null,
          sensing: answers.sensing ?? null,
          budget: answers.budget ?? null,
        }),
      });
      const data = (await response.json().catch(() => ({}))) as {
        idea?: { id: string };
        error?: string;
        field?: string;
        message?: string;
      };
      if (!response.ok || !data.idea) {
        const field = data.field === "title" || data.field === "body" || data.field === "display_name"
          ? data.field
          : null;
        const message = data.error === "invalid_input" && data.message
          ? data.message
          : ERROR_TEXT[data.error ?? ""] ?? "Could not save your idea. Try again.";
        fail(field, message);
        setSending(false);
        return;
      }
      track("idea_submitted", {
        answer_count: Object.values(answers).filter(Boolean).length,
        has_body: body.trim().length > 0,
        has_display_name: displayName.trim().length > 0,
      });
      router.push(`/ideas/${data.idea.id}`);
    } catch {
      fail(null, "Could not reach hackshop. Check your connection and try again.");
      setSending(false);
    }
  };

  const describedBy = (field: Field, hintId: string) =>
    error?.field === field ? `${hintId} idea-form-error` : hintId;

  return (
    <div className={styles.formCard}>
      <form className={ui.form} onSubmit={submit} noValidate>
        <label className={ui.field}>
          <span className={styles.fieldHead}>
            <span>Idea title</span>
            <span className={styles.counter} aria-hidden="true">
              {title.length}/{IDEA_TITLE_MAX}
            </span>
          </span>
          <input
            ref={refs.title}
            className={ui.input}
            name="title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            maxLength={IDEA_TITLE_MAX}
            required
            autoComplete="off"
            placeholder="Plant reminder on my desk"
            aria-invalid={error?.field === "title" || undefined}
            aria-describedby={describedBy("title", "idea-title-hint")}
          />
          <span id="idea-title-hint" className={styles.hint}>
            {IDEA_TITLE_MIN} to {IDEA_TITLE_MAX} characters.
          </span>
        </label>

        <label className={ui.field}>
          <span className={styles.fieldHead}>
            <span>
              Describe it <span className={styles.optional}>(optional)</span>
            </span>
            <span className={styles.counter} aria-hidden="true">
              {body.length}/{IDEA_BODY_MAX}
            </span>
          </span>
          <textarea
            ref={refs.body}
            className={ui.textarea}
            name="body"
            value={body}
            onChange={(event) => setBody(event.target.value)}
            maxLength={IDEA_BODY_MAX}
            rows={5}
            placeholder="What should it do? Where does it go? What should your agent say or show?"
            aria-invalid={error?.field === "body" || undefined}
            aria-describedby={describedBy("body", "idea-body-hint")}
          />
          <span id="idea-body-hint" className={styles.hint}>
            Up to {IDEA_BODY_MAX} characters. No links.
          </span>
        </label>

        {IDEA_QUESTIONS.map((question) => {
          const labelId = `idea-q-${question.id}`;
          return (
            <div key={question.id} className={styles.question} role="group" aria-labelledby={labelId}>
              <span id={labelId} className={styles.questionLabel}>
                {question.question} <span className={styles.optional}>(optional)</span>
              </span>
              <div className={styles.chips}>
                {question.options.map((option) => {
                  const pressed = answers[question.id] === option.value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      className={styles.chip}
                      aria-pressed={pressed}
                      onClick={() =>
                        setAnswers((current) => ({
                          ...current,
                          [question.id]: pressed ? undefined : option.value,
                        }))
                      }
                    >
                      {option.label}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}

        <label className={ui.field}>
          <span>
            Name to show <span className={styles.optional}>(optional)</span>
          </span>
          <input
            ref={refs.display_name}
            className={ui.input}
            name="display_name"
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
            maxLength={IDEA_NAME_MAX}
            autoComplete="nickname"
            placeholder={DEFAULT_DISPLAY_NAME}
            aria-invalid={error?.field === "display_name" || undefined}
            aria-describedby={describedBy("display_name", "idea-name-hint")}
          />
          <span id="idea-name-hint" className={styles.hint}>
            Shown next to your idea. Leave it empty to show &quot;{DEFAULT_DISPLAY_NAME}&quot;.
          </span>
        </label>

        <p className={styles.hint}>
          Your idea is public. Don&apos;t include personal info. We pick a suggested board
          for it with the same planner as the home page.
        </p>

        {error ? (
          <p id="idea-form-error" className={ui.formError} role="alert">
            {error.message}
          </p>
        ) : null}

        <div className={ui.actions}>
          <button type="submit" className={ui.btnPrimary} disabled={sending}>
            {sending ? "Submitting…" : "Submit idea"}
          </button>
          <Link className={ui.btnSecondary} href="/ideas">
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}

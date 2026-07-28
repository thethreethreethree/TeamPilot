"use client";

import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";

/**
 * PasswordInput — a password field with a show/hide toggle so a user can see
 * what they typed before submitting (cuts failed logins from typos).
 *
 * Drop-in for `<input type="password" … />`: it spreads every input prop through
 * and toggles ONLY the `type` between "password" and "text", so autoComplete,
 * password-manager behaviour, validation (required/minLength), disabled state and
 * the caller's className are all preserved. `type` is intentionally omitted from
 * the accepted props — this component owns it.
 *
 * The eye button is keyboard-reachable (real <button>, aria-label + aria-pressed),
 * full-height on the right, and the input gets a guaranteed right padding so the
 * icon never overlaps the text regardless of the caller's Tailwind classes.
 */
type Props = Omit<React.InputHTMLAttributes<HTMLInputElement>, "type">;

export function PasswordInput({ className = "", style, ...props }: Props) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <input
        {...props}
        type={show ? "text" : "password"}
        className={className}
        style={{ paddingRight: "2.5rem", ...style }}
      />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        aria-label={show ? "Hide password" : "Show password"}
        aria-pressed={show}
        title={show ? "Hide password" : "Show password"}
        className="absolute right-0 top-0 h-full px-2.5 flex items-center text-muted hover:text-secondary focus:text-secondary focus:outline-none transition-colors"
      >
        {show ? (
          <EyeOff className="w-4 h-4" aria-hidden="true" />
        ) : (
          <Eye className="w-4 h-4" aria-hidden="true" />
        )}
      </button>
    </div>
  );
}

"use client";

import { useState, type InputHTMLAttributes } from "react";
import { Icon } from "@/components/ui/icons";

export function PasswordInput(props: Omit<InputHTMLAttributes<HTMLInputElement>, "type">) {
  const [visible, setVisible] = useState(false);
  const { className, ...rest } = props;
  return (
    <div className="password-field">
      <input {...rest} type={visible ? "text" : "password"} className={className || "input"} />
      <button
        type="button"
        className="password-toggle"
        onClick={() => setVisible((value) => !value)}
        aria-label={visible ? "Hide password" : "Show password"}
        aria-pressed={visible}
        title={visible ? "Hide password" : "Show password"}
      >
        <Icon name={visible ? "eyeOff" : "eye"} />
      </button>
    </div>
  );
}

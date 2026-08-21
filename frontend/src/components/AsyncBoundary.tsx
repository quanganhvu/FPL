import type { ReactNode } from "react";

export function LoadingState({ label = "Loading..." }: { label?: string }) {
  return <p className="muted">{label}</p>;
}

export function ErrorState({ message }: { message: string }) {
  return <div className="error-box">Something went wrong: {message}</div>;
}

export function EmptyState({ children }: { children: ReactNode }) {
  return <p className="muted">{children}</p>;
}

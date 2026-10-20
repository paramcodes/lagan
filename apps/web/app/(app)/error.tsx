"use client";

interface AppErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function AppError(props: AppErrorProps) {
  return <p>{props.error.message}</p>;
}

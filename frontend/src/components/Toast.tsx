"use client";

import { useEffect, useState } from "react";

type ToastMessage = {
  id: string;
  type: "success" | "error" | "info";
  message: string;
};

let toastId = 0;

const toastCallbacks: Array<(message: ToastMessage) => void> = [];

export function showToast(
  message: string,
  type: "success" | "error" | "info" = "info"
) {
  const id = `toast-${++toastId}`;
  const toastMessage: ToastMessage = { id, message, type };
  toastCallbacks.forEach((cb) => cb(toastMessage));
}

export function Toast() {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  useEffect(() => {
    const handleAddToast = (message: ToastMessage) => {
      setToasts((prev) => [...prev, message]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== message.id));
      }, 3000);
    };

    toastCallbacks.push(handleAddToast);
    return () => {
      toastCallbacks.pop();
    };
  }, []);

  return (
    <div className="fixed bottom-4 right-4 z-50 space-y-2">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`px-6 py-3 rounded-lg text-white font-medium shadow-lg animate-fadeIn ${
            toast.type === "success"
              ? "bg-green-500"
              : toast.type === "error"
              ? "bg-red-500"
              : "bg-blue-500"
          }`}
        >
          {toast.message}
        </div>
      ))}
    </div>
  );
}

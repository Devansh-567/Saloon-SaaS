# Copyright (c) 2026 Devansh Singh
# All Rights Reserved.
#
# This software and its source code are proprietary
# and confidential property of Guru AI Technologies.
#
# Unauthorized copying, modification, distribution,
# or use of this software, in whole or in part,
# is strictly prohibited without prior written
# permission from Guru AI Technologies.
// 2026 Devansh Singh
// Guru AI Technologies
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiRequest, clearUrlParam, errorMessage } from "@/lib/client";

import { qr } from "lucide-react";

type QueueDialogResult = {
  open: boolean;
  setOpen: (open: boolean) => void;
  status: "idle" | "joining" | "active" | "completed";
  setStatus: (status: QueueDialogResult["status"]) => void;
};

export function QueueDialog({ onClose }: { onClose: () => void }) {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState("idle");
  const [code, setCode] = useState("");
  const [isConnecting, setIsConnecting] = useState(false);

  const router = useRouter();

  const join = async (code: string) => {
    setIsConnecting(true);
    setStatus("joining");
    try {
      const response = await apiRequest("/api/queue/join", {
        method: "POST",
        body: JSON.stringify({ code }),
      });
      const data = await response.json();
      setStatus("active");
      setCode("");
      if (data.redirect) {
        router.push(data.redirect);
      }
    } catch (err) {
      console.error("Failed to join queue:", err);
      setStatus("idle");
    } finally {
      setIsConnecting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-lg w-full max-w-md mx-4 transform overflow-hidden">
        <div className="p-6">
          <h2 className="mb-4 text-2xl font-bold text-gray-900">Join Queue</h2>
          {status === "idle" && (
            <p className="mb-4 text-gray-600">
              Enter the queue code to join the stylist's queue.
            </p>
          )}
          {status === "joining" && (
            <p className="mb-4 text-gray-600">
              Connecting to the queue&hellip;
            </p>
          )}
          {status === "active" && (
            <div className="mb-4 flex items-center space-x-3">
              <span className="text-gray-500">Queue Code: </span>
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                readOnly
                className="flex-1 border border-gray-300 rounded px-3 py-2 text-sm focus outline-none focus-border-color"
              />
            </div>
          )}
          {status === "completed" && (
            <p className="mb-4 text-green-600">You've been added to the queue!</p>
          )}
          {isConnecting && (
            <p className="mb-4 text-gray-600">Connecting&hellip;</p>
          )}
          <div className="mt-6 flex justify-end">
            <button
              onClick={() => setOpen(false)}
              className="mr-2 px-4 py-2 text-sm font-medium text-white bg-gray-800 rounded-lg hover:bg-gray-700"
            >
              Cancel
            </button>
            <button
              onClick={() => join(code)}
              disabled={!code || isConnecting}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-500 disabled:opacity-50"
            >
              {isConnecting ? "Connecting..." : "Join Queue"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

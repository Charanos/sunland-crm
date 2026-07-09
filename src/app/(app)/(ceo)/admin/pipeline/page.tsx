"use client";

import { PipelineBoard } from "@/components/sunland/pipeline-board";

export default function PipelinePage() {
  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col gap-1">
        <h1 className="title-serif mt-2 text-slate-900">
          Property Management Pipeline
        </h1>
        <p className="text-slate-500 max-w-2xl">
          Track leads, enquiries, property viewings, commercial offers, and transaction closure splits across agents.
        </p>
      </div>

      <PipelineBoard />
    </div>
  );
}

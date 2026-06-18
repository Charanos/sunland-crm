"use client";

import { PipelineBoard } from "@/components/sunland/pipeline-board";

export default function PipelineKanbanPage() {
  return (
    <div className="w-full h-screen overflow-hidden">
      <PipelineBoard defaultView="kanban" isFullPageFocus={true} />
    </div>
  );
}

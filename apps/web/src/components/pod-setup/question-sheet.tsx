"use client";

import { useState } from "react";
import type { Pin, PodQuestion } from "@karakas/shared";
import { CardAutocomplete } from "@/components/card-autocomplete";

type Props = {
  question: PodQuestion;
  remaining: number;
  onAnswer: (pins: Pin[]) => void;
  onSkipAll: () => void;
};

/** One setup question at a time, as a bottom sheet. */
export function QuestionSheet({ question, remaining, onAnswer, onSkipAll }: Props) {
  const [customName, setCustomName] = useState("");

  return (
    <div className="fixed inset-0 z-40 flex items-end sm:items-center justify-center bg-black/60">
      <div className="w-full max-w-lg bg-zinc-900 border-t sm:border border-zinc-700 rounded-t-2xl sm:rounded-2xl p-5 pb-8">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs text-zinc-500 uppercase tracking-wider">
            Quick check{remaining > 1 ? ` · ${remaining} left` : ""}
          </span>
          <button type="button" onClick={onSkipAll} className="text-sm text-zinc-400 hover:text-zinc-100">
            Use suggestions
          </button>
        </div>

        {question.imageUrls.length > 0 && (
          <div className="flex gap-2 mb-3">
            {question.imageUrls.map((url) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={url} src={url} alt="" className="h-16 w-24 object-cover rounded-md border border-zinc-700" />
            ))}
          </div>
        )}

        <h2 className="text-lg font-semibold text-zinc-100 mb-4">{question.prompt}</h2>

        <div className="space-y-2">
          {question.options.map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => onAnswer(option.pins)}
              className={[
                "w-full text-left p-3 rounded-lg border transition-colors",
                option.id === question.defaultOptionId
                  ? "border-amber-500 bg-amber-700/20 hover:bg-amber-700/30"
                  : "border-zinc-700 bg-zinc-800 hover:bg-zinc-700",
              ].join(" ")}
            >
              <div className="text-zinc-100 font-medium">{option.label}</div>
              {option.detail && <div className="text-xs text-zinc-400">{option.detail}</div>}
            </button>
          ))}
        </div>

        {question.allowCustomName && (
          <div className="mt-4 flex gap-2 items-start">
            <div className="flex-1">
              <CardAutocomplete
                id="custom-commander"
                name="custom-commander"
                value={customName}
                onChange={setCustomName}
                placeholder="Search for the commander"
                commanderOnly
                showPreview={false}
              />
            </div>
            <button
              type="button"
              disabled={customName.trim().length < 2}
              onClick={() =>
                onAnswer([
                  { type: "rename", detectionId: question.allowCustomName!.detectionId, name: customName.trim() },
                ])
              }
              className="px-3 py-2 rounded-lg bg-amber-500 text-zinc-950 font-semibold disabled:opacity-40"
            >
              Use
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

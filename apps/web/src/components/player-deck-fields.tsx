"use client";

import { CardAutocomplete } from "@/components/card-autocomplete";
import {
  isCommanderFormat,
  hasBrackets,
  EDH_BRACKETS,
  BRACKET_DESCRIPTIONS,
  type EdhBracket,
} from "@/types/mtg";

export type PlayerDeckEdit = {
  commanderUsed1: string;
  commanderUsed2: string;
  bracketUsed: string;
  saveAsNewDeck: boolean;
};

type Props = {
  playerId: string;
  playerName: string;
  format: string;
  deckName?: string | null;
  edit: PlayerDeckEdit;
  onChange: (edit: PlayerDeckEdit) => void;
  /** Whether this player can save a new deck (has userId or playgroupPlayerId) */
  canSaveDeck: boolean;
};

export function PlayerDeckFields({
  playerId,
  playerName,
  format,
  deckName,
  edit,
  onChange,
  canSaveDeck,
}: Props) {
  const showCommander = isCommanderFormat(format);
  const showBracket = hasBrackets(format);

  if (!showCommander && !showBracket) return null;

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-semibold text-zinc-300">{playerName}</span>
        {deckName && (
          <span className="text-xs text-amber-500/80 truncate ml-2">
            {deckName}
          </span>
        )}
      </div>

      {showCommander && (
        <div className="grid grid-cols-2 gap-3 mb-3">
          <div>
            <label className="block text-xs text-zinc-500 mb-1">
              Commander
            </label>
            <CardAutocomplete
              id={`end-cmdr1-${playerId}`}
              name={`end-cmdr1-${playerId}`}
              value={edit.commanderUsed1}
              onChange={(value) =>
                onChange({ ...edit, commanderUsed1: value })
              }
              placeholder="Commander name"
              commanderOnly={true}
              showPreview={true}
            />
          </div>
          <div>
            <label className="block text-xs text-zinc-500 mb-1">
              Partner (optional)
            </label>
            <CardAutocomplete
              id={`end-cmdr2-${playerId}`}
              name={`end-cmdr2-${playerId}`}
              value={edit.commanderUsed2}
              onChange={(value) =>
                onChange({ ...edit, commanderUsed2: value })
              }
              placeholder="Partner commander"
              commanderOnly={true}
              showPreview={true}
            />
          </div>
        </div>
      )}

      {showBracket && (
        <div className="mb-3">
          <label className="block text-xs text-zinc-500 mb-1">
            EDH Bracket
          </label>
          <select
            value={edit.bracketUsed}
            onChange={(e) =>
              onChange({ ...edit, bracketUsed: e.target.value })
            }
            className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-amber-500 transition-colors"
          >
            <option value="">Select bracket...</option>
            {EDH_BRACKETS.map((b) => (
              <option key={b} value={b}>
                Bracket {b} - {BRACKET_DESCRIPTIONS[b as EdhBracket]}
              </option>
            ))}
          </select>
        </div>
      )}

      {showCommander && canSaveDeck && !deckName && edit.commanderUsed1 && (
        <label className="flex items-center gap-2 text-sm text-zinc-400 cursor-pointer">
          <input
            type="checkbox"
            checked={edit.saveAsNewDeck}
            onChange={(e) =>
              onChange({ ...edit, saveAsNewDeck: e.target.checked })
            }
            className="rounded border-zinc-600 bg-zinc-800 text-amber-500 focus:ring-amber-500"
          />
          Save as new deck for this player
        </label>
      )}
    </div>
  );
}

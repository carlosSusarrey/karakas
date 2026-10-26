import type { Confidence } from "../types/ai-events";
import type {
  CandidateDeck,
  DeckRef,
  DetectedCommander,
  MatchInput,
  MatchResult,
  Pin,
  PlayerIdentity,
  PodGroup,
  PodQuestion,
  QuestionOption,
  QuestionType,
  SeatProposal,
  SetupPlayer,
} from "../types/pod-setup";

// --- Scoring ---------------------------------------------------------------

const SCORE_DECK_MATCH = 50;
const SCORE_OWNER = 100;
const SCORE_PER_RECENT_GAME = 10;
const MAX_RECENT_GAMES = 4;
const SCORE_REMATCH = 200;
const SCORE_FORMAT = 5;
const PENALTY_PARTIAL_PARTNER = 20;
const SCORE_NO_MATCH = 10;
/** Alternatives scoring within this margin of the chosen pilot are asked about */
const AMBIGUITY_MARGIN = 20;

const QUESTION_ORDER: QuestionType[] = [
  "confirm_commander",
  "which_player",
  "borrowed_confirm",
  "duplicate_deck",
  "new_deck",
  "unmatched_player",
];

// --- Helpers ---------------------------------------------------------------

/** Lowercase, strip accents and punctuation, front face only. */
export function normalizeCardName(name: string): string {
  return name
    .split("//")[0]
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function commanderSetKey(names: string[]): string {
  return names.map(normalizeCardName).sort().join("|");
}

function deckCommanders(d: CandidateDeck): string[] {
  return [d.commander1, d.commander2].filter((c): c is string => !!c);
}

export function deckRefKey(ref: DeckRef): string {
  return `${ref.kind}:${ref.id}`;
}

function sameIdentity(a: PlayerIdentity, b: PlayerIdentity): boolean {
  return (
    (!!a.userId && a.userId === b.userId) ||
    (!!a.playgroupPlayerId && a.playgroupPlayerId === b.playgroupPlayerId)
  );
}

function isGuest(p: SetupPlayer): boolean {
  return !p.userId && !p.playgroupPlayerId;
}

function minConfidence(cs: Confidence[]): Confidence {
  if (cs.includes("low")) return "low";
  if (cs.includes("medium")) return "medium";
  return "high";
}

// --- Grouping --------------------------------------------------------------

/** Merge partner/background pairs into one group per deck. */
function buildGroups(
  detections: DetectedCommander[],
  candidates: CandidateDeck[],
  players: SetupPlayer[],
): PodGroup[] {
  const used = new Set<string>();
  const groups: DetectedCommander[][] = [];
  const recognized = detections.filter((d) => d.name);
  const free = (pred: (d: DetectedCommander) => boolean, exclude?: string) =>
    recognized.find((d) => !used.has(d.id) && d.id !== exclude && pred(d));

  const ownerListed = (d: CandidateDeck) => (players.some((p) => sameIdentity(p, d.owner)) ? 1 : 0);
  const partnerDecks = candidates
    .filter((d) => d.commander1 && d.commander2)
    .sort((a, b) => ownerListed(b) - ownerListed(a) || deckRefKey(a.ref).localeCompare(deckRefKey(b.ref)));

  for (const deck of partnerDecks) {
    const [n1, n2] = deckCommanders(deck).map(normalizeCardName);
    const a = free((d) => normalizeCardName(d.name!) === n1);
    if (!a) continue;
    const b = free((d) => normalizeCardName(d.name!) === n2, a.id);
    if (!b) continue;
    used.add(a.id).add(b.id);
    groups.push([a, b]);
  }

  for (const d of recognized) {
    if (used.has(d.id) || !d.partnerOf) continue;
    const partner = free((x) => x.id === d.partnerOf, d.id);
    if (!partner) continue;
    used.add(d.id).add(partner.id);
    groups.push([d, partner]);
  }

  for (const d of detections) {
    if (!used.has(d.id)) groups.push([d]);
  }

  const order = new Map(detections.map((d, i) => [d.id, i]));
  return groups
    .map((members) => members.sort((a, b) => order.get(a.id)! - order.get(b.id)!))
    .sort((a, b) => order.get(a[0].id)! - order.get(b[0].id)!)
    .map((members) => ({
      id: members.map((d) => d.id).join("+"),
      detectionIds: members.map((d) => d.id),
      commanders: members.every((d) => d.name) ? members.map((d) => d.name!) : [],
      imageUrls: members.map((d) => d.imageUrl).filter((u): u is string => !!u),
      confidence: minConfidence(members.map((d) => d.confidence)),
    }));
}

// --- Options per (group, player) -------------------------------------------

type SeatOption = {
  kind: "deck" | "new" | "none";
  deck: CandidateDeck | null;
  score: number;
};

type GroupCandidate = { deck: CandidateDeck; partial: boolean };

function groupCandidates(group: PodGroup, candidates: CandidateDeck[]): GroupCandidate[] {
  if (group.commanders.length === 0) return [];
  const key = commanderSetKey(group.commanders);
  const exact = candidates.filter((d) => commanderSetKey(deckCommanders(d)) === key);
  const result: GroupCandidate[] = exact.map((deck) => ({ deck, partial: false }));
  // A partner deck where only one commander made it into the photo
  if (group.commanders.length === 1) {
    const name = normalizeCardName(group.commanders[0]);
    for (const deck of candidates) {
      if (deck.commander2 && !exact.includes(deck) && deckCommanders(deck).some((c) => normalizeCardName(c) === name)) {
        result.push({ deck, partial: true });
      }
    }
  }
  return result;
}

function pilotCount(deck: CandidateDeck, player: SetupPlayer): number {
  return deck.pilots.filter((p) => sameIdentity(p, player)).length;
}

// --- Main ------------------------------------------------------------------

export function matchPod(input: MatchInput): MatchResult {
  const pins = input.pins ?? [];
  const playerByKey = new Map(input.players.map((p) => [p.key, p]));
  const candidateByKey = new Map(input.candidates.map((d) => [deckRefKey(d.ref), d]));

  // Renames fix misread cards and confirm uncertain ones
  const renames = new Map<string, string>();
  for (const pin of pins) if (pin.type === "rename") renames.set(pin.detectionId, pin.name);
  const detections = input.detections.map((d) =>
    renames.has(d.id) ? { ...d, name: renames.get(d.id)!, confidence: "high" as const } : d,
  );

  const groups = buildGroups(detections, input.candidates, input.players);
  const ignored = new Set(pins.filter((p) => p.type === "ignore").map((p) => p.groupId));
  const assignPins = new Map<string, Extract<Pin, { type: "assign" }>>();
  for (const pin of pins) {
    if (pin.type === "assign" && playerByKey.has(pin.playerKey)) assignPins.set(pin.groupId, pin);
  }
  const playerDeckPins = new Map<string, Extract<Pin, { type: "playerDeck" }>>();
  for (const pin of pins) {
    if (pin.type === "playerDeck" && playerByKey.has(pin.playerKey)) playerDeckPins.set(pin.playerKey, pin);
  }

  const assignable = groups.filter((g) => g.commanders.length > 0 && !ignored.has(g.id));
  const candsByGroup = new Map(assignable.map((g) => [g.id, groupCandidates(g, input.candidates)]));
  const previous = new Map((input.previous ?? []).map((p) => [p.playerKey, deckRefKey(p.deck)]));

  // All options for a player taking a group, best first
  const optionCache = new Map<string, SeatOption[]>();
  function optionsFor(group: PodGroup, player: SetupPlayer): SeatOption[] {
    const cacheKey = `${group.id}/${player.key}`;
    const cached = optionCache.get(cacheKey);
    if (cached) return cached;

    let options: SeatOption[] = (candsByGroup.get(group.id) ?? []).map(({ deck, partial }) => ({
      kind: "deck" as const,
      deck,
      score:
        SCORE_DECK_MATCH +
        (sameIdentity(player, deck.owner) ? SCORE_OWNER : 0) +
        Math.min(MAX_RECENT_GAMES, pilotCount(deck, player)) * SCORE_PER_RECENT_GAME +
        (previous.get(player.key) === deckRefKey(deck.ref) ? SCORE_REMATCH : 0) +
        (deck.format === input.format ? SCORE_FORMAT : 0) -
        (partial ? PENALTY_PARTIAL_PARTNER : 0),
    }));
    options.push({ kind: isGuest(player) ? "none" : "new", deck: null, score: SCORE_NO_MATCH });

    const pin = assignPins.get(group.id);
    if (pin?.playerKey === player.key && pin.deck) {
      if (pin.deck === "new" || pin.deck === "none") {
        options = [{ kind: pin.deck, deck: null, score: SCORE_NO_MATCH }];
      } else {
        const deck = candidateByKey.get(deckRefKey(pin.deck));
        options = deck ? [{ kind: "deck", deck, score: SCORE_DECK_MATCH }] : options;
      }
    }

    options.sort(
      (a, b) =>
        b.score - a.score ||
        (a.deck && b.deck ? deckRefKey(a.deck.ref).localeCompare(deckRefKey(b.deck.ref)) : 0),
    );
    optionCache.set(cacheKey, options);
    return options;
  }
  const bestScore = (g: PodGroup, p: SetupPlayer) => optionsFor(g, p)[0].score;

  // Exhaustive search: pods are at most ~8 players
  const freePlayers = input.players.filter((p) => !playerDeckPins.has(p.key));
  const maxSkips = Math.max(0, assignable.length - freePlayers.length);
  type Pick = { player: SetupPlayer; option: SeatOption };
  let best: { score: number; picks: Map<string, Pick> } = { score: -Infinity, picks: new Map() };

  function search(i: number, usedPlayers: Set<string>, usedDecks: Set<string>, skips: number, score: number, picks: Map<string, Pick>) {
    if (i === assignable.length) {
      if (score > best.score) best = { score, picks: new Map(picks) };
      return;
    }
    const group = assignable[i];
    const pin = assignPins.get(group.id);
    const pool = pin
      ? freePlayers.filter((p) => p.key === pin.playerKey && !usedPlayers.has(p.key))
      : freePlayers.filter((p) => !usedPlayers.has(p.key));
    for (const player of pool) {
      const option = optionsFor(group, player).find((o) => !o.deck || !usedDecks.has(deckRefKey(o.deck.ref)));
      if (!option) continue;
      usedPlayers.add(player.key);
      if (option.deck) usedDecks.add(deckRefKey(option.deck.ref));
      picks.set(group.id, { player, option });
      search(i + 1, usedPlayers, usedDecks, skips, score + option.score, picks);
      picks.delete(group.id);
      usedPlayers.delete(player.key);
      if (option.deck) usedDecks.delete(deckRefKey(option.deck.ref));
    }
    if ((!pin || pool.length === 0) && skips < maxSkips + (pin ? 1 : 0)) {
      search(i + 1, usedPlayers, usedDecks, skips + 1, score, picks);
    }
  }
  search(0, new Set(), new Set(), 0, 0, new Map());
  const picks = best.picks;
  const groupOfPlayer = new Map<string, PodGroup>();
  for (const g of assignable) {
    const pick = picks.get(g.id);
    if (pick) groupOfPlayer.set(pick.player.key, g);
  }

  // --- Questions -----------------------------------------------------------

  const questions: PodQuestion[] = [];
  const asked = new Set<string>();
  const label = (g: PodGroup) => g.commanders.join(" + ") || "this commander";
  const ask = (q: Omit<PodQuestion, "id" | "imageUrls">, g: PodGroup | null) => {
    const id = `${q.type}:${q.groupId ?? q.playerKey}`;
    questions.push({ ...q, id, imageUrls: g?.imageUrls ?? [] });
    if (q.groupId) asked.add(q.groupId);
  };
  const assignOption = (g: PodGroup, p: SetupPlayer, deck?: DeckRef | "new" | "none", text?: string): QuestionOption => ({
    id: `${p.key}:${deck ? (typeof deck === "string" ? deck : deckRefKey(deck)) : "auto"}`,
    label: text ?? p.name,
    pins: [{ type: "assign", groupId: g.id, playerKey: p.key, ...(deck ? { deck } : {}) }],
  });
  const ignoreOption = (g: PodGroup): QuestionOption => ({
    id: "ignore",
    label: "Not in this game",
    pins: [{ type: "ignore", groupId: g.id }],
  });

  // Commanders we couldn't read, or aren't sure about
  for (const g of groups) {
    if (ignored.has(g.id)) continue;
    const unsure = g.detectionIds
      .map((id) => detections.find((d) => d.id === id)!)
      .find((d) => !d.name || d.confidence === "low");
    if (!unsure) continue;
    const names = [...new Set([unsure.name, ...unsure.suggestions].filter((n): n is string => !!n))].slice(0, 4);
    ask(
      {
        type: "confirm_commander",
        groupId: g.id,
        playerKey: null,
        prompt: unsure.name ? `Is this ${unsure.name}?` : `Couldn't read "${unsure.rawName}". Which commander is it?`,
        options: [
          ...names.map((name) => ({
            id: `rename:${name}`,
            label: name,
            pins: [{ type: "rename" as const, detectionId: unsure.id, name }],
          })),
          ignoreOption(g),
        ],
        defaultOptionId: unsure.name ? `rename:${unsure.name}` : null,
        allowCustomName: { detectionId: unsure.id },
      },
      g,
    );
  }

  const isPinnedPlayer = (p: SetupPlayer) =>
    playerDeckPins.has(p.key) || [...assignPins.values()].some((pin) => pin.playerKey === p.key);

  for (const g of assignable) {
    if (asked.has(g.id)) continue;
    const pick = picks.get(g.id);
    const pin = assignPins.get(g.id);

    // Unassigned extra commander: who's playing it, if anyone?
    if (!pick) {
      ask(
        {
          type: "which_player",
          groupId: g.id,
          playerKey: null,
          prompt: `Who's playing ${label(g)}?`,
          options: [...freePlayers.map((p) => assignOption(g, p)), ignoreOption(g)],
          defaultOptionId: "ignore",
        },
        g,
      );
      continue;
    }

    const { player, option } = pick;

    // Is another pilot nearly as plausible?
    if (!pin) {
      const alternatives = freePlayers.filter((q) => {
        if (q.key === player.key || isPinnedPlayer(q)) return false;
        const qGroup = groupOfPlayer.get(q.key);
        if (qGroup && commanderSetKey(qGroup.commanders) === commanderSetKey(g.commanders)) return false;
        const current = option.score + (qGroup ? picks.get(qGroup.id)!.option.score : 0);
        const swapped = bestScore(g, q) + (qGroup ? bestScore(qGroup, player) : 0);
        return current - swapped < AMBIGUITY_MARGIN;
      });
      if (alternatives.length > 0) {
        ask(
          {
            type: "which_player",
            groupId: g.id,
            playerKey: player.key,
            prompt: `Who's playing ${label(g)}?`,
            options: [player, ...alternatives].map((p) => assignOption(g, p)),
            defaultOptionId: assignOption(g, player).id,
          },
          g,
        );
        continue;
      }
    }

    if (pin?.deck) continue; // fully answered

    if (option.kind === "deck" && option.deck && !sameIdentity(player, option.deck.owner)) {
      const deck = option.deck;
      ask(
        {
          type: "borrowed_confirm",
          groupId: g.id,
          playerKey: player.key,
          prompt: `Is ${player.name} borrowing ${deck.owner.name}'s ${deck.name}?`,
          options: [
            assignOption(g, player, deck.ref, `Yes, borrowing it`),
            ...(isGuest(player)
              ? [assignOption(g, player, "none", `No, it's ${player.name}'s own copy`)]
              : [assignOption(g, player, "new", `No, it's ${player.name}'s own deck`)]),
          ],
          defaultOptionId: assignOption(g, player, deck.ref).id,
        },
        g,
      );
      continue;
    }

    if (option.kind === "deck" && option.deck) {
      const owned = optionsFor(g, player).filter(
        (o) => o.kind === "deck" && o.deck && sameIdentity(player, o.deck.owner),
      );
      if (owned.length > 1) {
        ask(
          {
            type: "duplicate_deck",
            groupId: g.id,
            playerKey: player.key,
            prompt: `${player.name} has ${owned.length} ${label(g)} decks. Which one?`,
            options: owned.map((o) => ({
              ...assignOption(g, player, o.deck!.ref, o.deck!.name),
              detail: o.deck!.bracket ? `Bracket ${o.deck!.bracket}` : undefined,
            })),
            defaultOptionId: assignOption(g, player, option.deck.ref).id,
          },
          g,
        );
      }
      continue;
    }

    if (option.kind === "new") {
      ask(
        {
          type: "new_deck",
          groupId: g.id,
          playerKey: player.key,
          prompt: `New deck: register ${label(g)} for ${player.name}?`,
          options: [
            assignOption(g, player, "new", "Yes, add it"),
            assignOption(g, player, "none", "Just this game"),
          ],
          defaultOptionId: assignOption(g, player, "new").id,
        },
        g,
      );
    }
  }

  // Players with no commander in the photo
  for (const player of input.players) {
    if (groupOfPlayer.has(player.key) || playerDeckPins.has(player.key)) continue;
    const own = input.candidates
      .filter((d) => sameIdentity(player, d.owner) && d.format === input.format)
      .sort((a, b) => pilotCount(b, player) - pilotCount(a, player) || a.name.localeCompare(b.name));
    ask(
      {
        type: "unmatched_player",
        groupId: null,
        playerKey: player.key,
        prompt: `No commander found for ${player.name}. What are they playing?`,
        options: [
          ...own.map((d) => ({
            id: deckRefKey(d.ref),
            label: d.name,
            detail: deckCommanders(d).join(" + "),
            pins: [{ type: "playerDeck" as const, playerKey: player.key, deck: d.ref }],
          })),
          { id: "none", label: "No deck", pins: [{ type: "playerDeck", playerKey: player.key, deck: "none" }] },
        ],
        defaultOptionId: own[0] ? deckRefKey(own[0].ref) : "none",
      },
      null,
    );
  }

  questions.sort((a, b) => QUESTION_ORDER.indexOf(a.type) - QUESTION_ORDER.indexOf(b.type));

  // --- Seats ---------------------------------------------------------------

  const seats: SeatProposal[] = input.players.map((player) => {
    const empty: SeatProposal = {
      playerKey: player.key,
      groupId: null,
      commanders: [],
      imageUrls: [],
      deck: null,
      deckName: null,
      deckOwnerName: null,
      bracket: null,
      pendingNewDeck: null,
      status: "unmatched",
    };

    const manual = playerDeckPins.get(player.key);
    if (manual) {
      if (manual.deck === "none") return { ...empty, status: "no_deck" };
      const deck = candidateByKey.get(deckRefKey(manual.deck));
      return deck ? deckSeat(empty, player, deck) : { ...empty, deck: manual.deck, status: "owned" };
    }

    const group = groupOfPlayer.get(player.key);
    if (!group) return empty;
    const { option } = picks.get(group.id)!;
    const base = { ...empty, groupId: group.id, commanders: group.commanders, imageUrls: group.imageUrls };
    if (option.kind === "deck" && option.deck) return deckSeat(base, player, option.deck);
    if (option.kind === "new") {
      const [commander1, commander2] = group.commanders;
      return {
        ...base,
        status: "new_deck",
        pendingNewDeck: { name: commander1, commander1, ...(commander2 ? { commander2 } : {}) },
      };
    }
    return { ...base, status: "no_deck" };
  });

  return { groups, seats, questions };
}

function deckSeat(base: SeatProposal, player: SetupPlayer, deck: CandidateDeck): SeatProposal {
  const owned = sameIdentity(player, deck.owner);
  return {
    ...base,
    commanders: deckCommanders(deck),
    deck: deck.ref,
    deckName: deck.name,
    deckOwnerName: owned ? null : deck.owner.name,
    bracket: deck.bracket,
    status: owned ? "owned" : "borrowed",
  };
}

/** Apply each question's default answer — used for "skip the rest". */
export function defaultPins(result: MatchResult): Pin[] {
  return result.questions.flatMap((q) => q.options.find((o) => o.id === q.defaultOptionId)?.pins ?? []);
}

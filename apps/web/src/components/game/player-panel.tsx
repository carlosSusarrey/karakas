"use client";

import { memo, useCallback, useRef } from "react";
import type { PlayerState } from "@/lib/game-reducer";

type Props = {
  player: PlayerState;
  color: string;
  isActive: boolean;
  rotated?: boolean;
  onLifeChange: (amount: number) => void;
  onPress: () => void;
  onLongPress?: () => void;
  compact?: boolean;
  isSwapSource?: boolean;
  isSwapTarget?: boolean;
};

function vibrate(ms: number) {
  if (typeof navigator !== "undefined" && "vibrate" in navigator) {
    try {
      navigator.vibrate(ms);
    } catch {
      // ignore
    }
  }
}

function PlayerPanelInner({
  player,
  color,
  isActive,
  rotated = false,
  onLifeChange,
  onPress,
  onLongPress,
  compact = false,
  isSwapSource = false,
  isSwapTarget = false,
}: Props) {
  const repeatTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressFiredRef = useRef(false);

  const stopRepeat = useCallback(() => {
    if (repeatTimerRef.current) {
      clearInterval(repeatTimerRef.current);
      repeatTimerRef.current = null;
    }
  }, []);

  const handleLifeTap = useCallback(
    (amount: number) => {
      vibrate(8);
      onLifeChange(amount);
    },
    [onLifeChange],
  );

  const startRepeat = useCallback(
    (amount: number) => {
      vibrate(15);
      onLifeChange(amount * 5);
      repeatTimerRef.current = setInterval(() => {
        vibrate(8);
        onLifeChange(amount * 5);
      }, 300);
    },
    [onLifeChange],
  );

  const handleLifeButton = (
    amount: number,
  ): React.PointerEventHandler<HTMLButtonElement> => {
    return (e) => {
      e.preventDefault();
      e.stopPropagation();
      let didLongPress = false;
      const onTimeout = () => {
        didLongPress = true;
        startRepeat(amount);
      };
      const timer = setTimeout(onTimeout, 500);

      const target = e.currentTarget;
      const cleanup = () => {
        clearTimeout(timer);
        stopRepeat();
        target.removeEventListener("pointerup", cleanup);
        target.removeEventListener("pointerleave", cleanup);
        target.removeEventListener("pointercancel", cleanup);
        if (!didLongPress) {
          handleLifeTap(amount);
        }
      };
      target.addEventListener("pointerup", cleanup);
      target.addEventListener("pointerleave", cleanup);
      target.addEventListener("pointercancel", cleanup);
    };
  };

  const handlePanelPointerDown: React.PointerEventHandler<HTMLDivElement> = (e) => {
    // Don't trigger panel-level press from buttons
    if ((e.target as HTMLElement).closest("button")) return;
    longPressFiredRef.current = false;
    longPressTimerRef.current = setTimeout(() => {
      longPressFiredRef.current = true;
      vibrate(25);
      onLongPress?.();
    }, 500);
  };

  const handlePanelPointerUp: React.PointerEventHandler<HTMLDivElement> = (e) => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    if ((e.target as HTMLElement).closest("button")) return;
    if (!longPressFiredRef.current) {
      onPress();
    }
  };

  const handlePanelPointerCancel = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  const lifeFontClass = compact
    ? "text-7xl sm:text-8xl"
    : "text-8xl sm:text-9xl";

  const badges: { icon: string; value: number; color: string }[] = [];
  if (player.poisonCounters > 0) badges.push({ icon: "☠", value: player.poisonCounters, color: "#22c55e" });
  if (player.energyCounters > 0) badges.push({ icon: "⚡", value: player.energyCounters, color: "#facc15" });
  if (player.experienceCounters > 0) badges.push({ icon: "★", value: player.experienceCounters, color: "#c084fc" });

  const cmdDamage = Object.entries(player.commanderDamage).filter(([, v]) => v > 0);

  const specialBorderColor = player.isMonarch
    ? "#fbbf24"
    : player.hasInitiative
      ? "#60a5fa"
      : null;

  const borderClasses = isSwapSource
    ? "ring-[3px] ring-amber-500 opacity-80"
    : isSwapTarget
      ? "ring-2 ring-amber-500/40 ring-dashed"
      : isActive
        ? "ring-2 ring-amber-300"
        : "";

  return (
    <div
      onPointerDown={handlePanelPointerDown}
      onPointerUp={handlePanelPointerUp}
      onPointerCancel={handlePanelPointerCancel}
      style={{
        backgroundColor: color,
        ...(specialBorderColor
          ? { boxShadow: `inset 0 0 0 3px ${specialBorderColor}` }
          : {}),
        ...(rotated ? { transform: "rotate(180deg)" } : {}),
      }}
      className={[
        "relative flex flex-col items-center justify-center rounded-xl m-[3px] overflow-hidden select-none touch-none flex-1",
        borderClasses,
        player.isEliminated ? "opacity-40" : "",
      ].join(" ")}
    >
      {/* Monarch badge */}
      {player.isMonarch && (
        <div className="absolute top-2 left-2 bg-amber-300/30 rounded-full p-1.5 z-10 text-lg leading-none">
          <span aria-label="Monarch">👑</span>
        </div>
      )}

      {/* Initiative badge */}
      {player.hasInitiative && (
        <div className="absolute top-2 right-2 bg-blue-400/30 rounded-full p-1.5 z-10 text-lg leading-none">
          <span aria-label="Initiative">⚔</span>
        </div>
      )}

      {/* Player name */}
      <div className="absolute top-2 px-2 text-white/85 font-bold uppercase tracking-widest text-base">
        {player.name}
      </div>

      {/* Life with +/- zones */}
      <div className="flex flex-col items-center justify-center w-full flex-1">
        <button
          type="button"
          onPointerDown={handleLifeButton(1)}
          className="flex-1 w-full flex items-center justify-center text-white/35 text-2xl font-bold cursor-pointer"
          aria-label="Increase life"
        >
          +
        </button>

        <div
          className={[
            lifeFontClass,
            "font-bold text-white tabular-nums drop-shadow-md",
            player.isEliminated ? "text-white/35" : "",
            player.lifeTotal <= 0 && !player.isEliminated ? "text-red-500" : "",
          ].join(" ")}
        >
          {player.lifeTotal}
        </div>

        <button
          type="button"
          onPointerDown={handleLifeButton(-1)}
          className="flex-1 w-full flex items-center justify-center text-white/35 text-2xl font-bold cursor-pointer"
          aria-label="Decrease life"
        >
          −
        </button>
      </div>

      {/* Commander damage row */}
      {cmdDamage.length > 0 && (
        <div className="absolute bottom-10 flex gap-1 flex-wrap justify-center px-2">
          {cmdDamage.map(([sourceId, dmg]) => (
            <div
              key={sourceId}
              className="flex items-center gap-1 bg-black/50 rounded px-1.5 py-0.5 text-xs text-white/70 font-bold"
            >
              <span aria-hidden>☠</span>
              <span>{dmg}</span>
            </div>
          ))}
        </div>
      )}

      {/* Counter badges */}
      {badges.length > 0 && (
        <div className="absolute bottom-2 flex gap-1 flex-wrap justify-center px-2">
          {badges.map((badge, i) => (
            <div
              key={i}
              className="flex items-center gap-1 bg-black/50 rounded px-1.5 py-0.5 text-xs font-bold"
              style={{ color: badge.color }}
            >
              <span>{badge.icon}</span>
              <span>{badge.value}</span>
            </div>
          ))}
        </div>
      )}

      {/* Swap source overlay */}
      {isSwapSource && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/30 text-amber-500 text-4xl">
          ⇅
        </div>
      )}

      {/* Eliminated overlay */}
      {player.isEliminated && !isSwapSource && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/40 gap-1">
          <div className="text-red-500 text-5xl">⊗</div>
          <div className="text-red-500 font-bold tracking-widest">ELIMINATED</div>
        </div>
      )}
    </div>
  );
}

export const PlayerPanel = memo(PlayerPanelInner);

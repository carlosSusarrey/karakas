import { GameProvider } from "@/contexts/game-context";

export default function PlayLayout({ children }: { children: React.ReactNode }) {
  return <GameProvider>{children}</GameProvider>;
}

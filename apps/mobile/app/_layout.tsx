import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { GameProvider } from "../src/contexts/game-context";
import { colors } from "../src/constants/theme";

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.background }}>
      <GameProvider>
        <StatusBar style="light" />
        <Stack
          screenOptions={{
            headerStyle: { backgroundColor: colors.background },
            headerTintColor: colors.text,
            headerTitleStyle: { fontWeight: "bold" },
            contentStyle: { backgroundColor: colors.background },
          }}
        />
      </GameProvider>
    </GestureHandlerRootView>
  );
}

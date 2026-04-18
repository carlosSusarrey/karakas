import { Tabs } from "expo-router";
import { colors } from "../../src/constants/theme";

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
        },
        tabBarActiveTintColor: colors.amber,
        tabBarInactiveTintColor: colors.textMuted,
        headerStyle: { backgroundColor: colors.background },
        headerTintColor: colors.text,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ title: "Home", tabBarLabel: "Home", tabBarIcon: () => null }}
      />
      <Tabs.Screen
        name="games"
        options={{ title: "Games", tabBarLabel: "Games", headerShown: false, tabBarIcon: () => null }}
      />
      <Tabs.Screen
        name="playgroups"
        options={{ title: "Playgroups", tabBarLabel: "Groups", headerShown: false, tabBarIcon: () => null }}
      />
      <Tabs.Screen
        name="decks"
        options={{ title: "Decks", tabBarLabel: "Decks", headerShown: false, tabBarIcon: () => null }}
      />
      <Tabs.Screen
        name="profile"
        options={{ title: "Profile", tabBarLabel: "Profile", headerShown: false, tabBarIcon: () => null }}
      />
    </Tabs>
  );
}

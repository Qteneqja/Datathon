import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { View } from "react-native";
import { Colors } from "@/constants/colors";

export default function RootLayout() {
  return (
    <View style={{ flex: 1 }}>
      <StatusBar style="light" backgroundColor={Colors.navy} />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
      </Stack>
    </View>
  );
}

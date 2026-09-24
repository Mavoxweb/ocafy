import { Stack } from "expo-router";

export default function Layout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: {
          backgroundColor: "#FFB7C5",
        },
        headerTintColor: "#2B2226",
        headerTitleStyle: {
          fontWeight: "bold",
        },
      }}
    />
  );
}

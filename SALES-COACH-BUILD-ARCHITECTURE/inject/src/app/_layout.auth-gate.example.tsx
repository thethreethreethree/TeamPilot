// _layout.auth-gate.example.tsx — EXAMPLE root layout showing the auth gate. Merge this into your real
// src/app/_layout.tsx (don't blind-copy over your existing layout, fonts, theme, splash handling).
//
// The gate: wrap the app in <AuthProvider>, then redirect based on `status`. A screen rendered behind a gate is
// not proof the user is authorized (§7) — but here the gate is navigational and every privileged data call is
// ALSO authorized server-side by RLS / the Bearer token, so the surface and the substance agree.
//
// Route groups: put sign-in in app/(auth)/ and the real app in app/(app)/ (or your tabs group). The gate sends a
// signed-out user to (auth) and a signed-in user into the app; while "loading" it shows a splash so the user
// never sees a flash of the wrong screen.

import { useEffect } from "react";
import { View, ActivityIndicator } from "react-native";
import { Slot, useRouter, useSegments } from "expo-router";
import { AuthProvider, useAuth } from "@/lib/auth-context";

function AuthGate() {
  const { status } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (status === "loading") return;
    const inAuthGroup = segments[0] === "(auth)";
    if (status === "signedOut" && !inAuthGroup) {
      router.replace("/(auth)/sign-in");
    } else if (status === "signedIn" && inAuthGroup) {
      router.replace("/"); // into the app's first authenticated screen
    }
  }, [status, segments]);

  if (status === "loading") {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator />
      </View>
    );
  }
  return <Slot />;
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <AuthGate />
    </AuthProvider>
  );
}

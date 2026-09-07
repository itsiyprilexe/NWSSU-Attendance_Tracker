// src/screens/LoginScreen.tsx
import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
} from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { signInWithEmailAndPassword } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "../firebase/config";
import DepartmentBadge from "../components/DepartmentBadge";
import { COLORS, SPACING } from "../constants/theme";
import { AuthStackParamList, AdminProfile } from "../types";

type Props = NativeStackScreenProps<AuthStackParamList, "Login">;

export default function LoginScreen({ route, navigation }: Props) {
  // Guard against this screen rendering without a department param
  // (e.g. set as an initial route, or navigated to without params).
  const department = route.params?.department;

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  // Central helper: go back if possible, otherwise fall back to the
  // department picker instead of firing an unhandled GO_BACK action.
  // Adjust "DepartmentSelect" to match your actual route name if different.
  const goBackOrToDepartments = () => {
    if (loading) return; // don't let the user navigate away mid-request
    if (navigation.canGoBack()) {
      navigation.goBack();
    } else {
      navigation.navigate("DepartmentSelect" as never);
    }
  };

  if (!department) {
    // Don't guess a route name that might not exist in this navigator —
    // just show a safe fallback instead of crashing.
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.missingParamsContainer}>
          <Text style={styles.title}>No department selected</Text>
          <Text style={styles.subtitle}>
            This screen needs a department to know which portal to sign you
            into.
          </Text>
          <Pressable
            style={[styles.submitButton, { marginTop: SPACING.lg }]}
            onPress={goBackOrToDepartments}
          >
            <Text style={styles.submitButtonText}>Go Back</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const handleSignIn = async () => {
    if (!username.trim() || !password) {
      Alert.alert("Missing info", "Please enter both username and password.");
      return;
    }
    setLoading(true);
    try {
      const cred = await signInWithEmailAndPassword(
        auth,
        username.trim(),
        password
      );

      // Check admin profile first...
      const adminSnap = await getDoc(doc(db, "admins", cred.user.uid));
      if (adminSnap.exists()) {
        const adminData = adminSnap.data() as AdminProfile;
        if (adminData.departmentCode !== department.code) {
          await auth.signOut();
          throw new Error(
            `This account belongs to ${adminData.departmentCode}, not ${department.code}. Please pick the correct department.`
          );
        }
        // Match found — navigation to AdminHomeScreen happens automatically
        // via the onAuthStateChanged listener in the root navigator.
        return;
      }

      // ...then fall back to checking instructor profile.
      const instructorSnap = await getDoc(doc(db, "instructors", cred.user.uid));
      if (instructorSnap.exists()) {
        const instructorData = instructorSnap.data() as AdminProfile;
        if (instructorData.departmentCode !== department.code) {
          await auth.signOut();
          throw new Error(
            `This account belongs to ${instructorData.departmentCode}, not ${department.code}. Please pick the correct department.`
          );
        }
        // Match found — navigation to InstructorHomeScreen happens automatically
        // via the onAuthStateChanged listener in the root navigator.
        return;
      }

      // Neither profile exists for this account.
      await auth.signOut();
      throw new Error(
        "No account profile found. Please create an account first."
      );
    } catch (err: any) {
      Alert.alert("Sign in failed", err?.message ?? "Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
      >
        <Pressable style={styles.backLink} onPress={goBackOrToDepartments} disabled={loading}>
          <Text style={styles.backLinkText}>{"\u2190"} Back to Departments</Text>
        </Pressable>

        <View style={styles.header}>
          <DepartmentBadge department={department} size={110} />
          <Text style={styles.title}>Portal Login</Text>
          <Text style={styles.subtitle}>
            {department.name} ({department.code})
          </Text>
        </View>

        <View style={styles.form}>
          <Text style={styles.label}>Username</Text>
          <TextInput
            style={[styles.input, loading && styles.inputDisabled]}
            placeholder="Enter your username"
            placeholderTextColor={COLORS.placeholder}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            value={username}
            onChangeText={setUsername}
            editable={!loading}
          />

          <Text style={styles.label}>Password</Text>
          <TextInput
            style={[styles.input, loading && styles.inputDisabled]}
            placeholder="Enter your password"
            placeholderTextColor={COLORS.placeholder}
            secureTextEntry
            value={password}
            onChangeText={setPassword}
            editable={!loading}
          />

          <Pressable
            style={({ pressed }) => [
              styles.submitButton,
              pressed && { opacity: 0.9 },
              loading && styles.submitButtonDisabled,
            ]}
            onPress={handleSignIn}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.submitButtonText}>Sign in to Dashboard</Text>
            )}
          </Pressable>

          <Pressable
            style={styles.createAccountLink}
            onPress={() =>
              navigation.navigate("CreateAccount", { department })
            }
            disabled={loading}
          >
            <Text style={[styles.createAccountText, loading && styles.linkDisabledText]}>
              Don't have an account?{" "}
              <Text style={styles.createAccountTextBold}>Create one</Text>
            </Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  backLink: {
    alignSelf: "center",
    marginTop: SPACING.md,
  },
  backLinkText: {
    marginTop: 80,
    color: COLORS.textMuted,
    fontSize: 14,
  },
  header: {
    alignItems: "center",
    marginTop: SPACING.lg,
    marginBottom: SPACING.lg,
  },
  missingParamsContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: SPACING.lg,
  },
  title: {
    fontSize: 26,
    fontWeight: "800",
    color: COLORS.text,
    marginTop: SPACING.md,
  },
  subtitle: {
    fontSize: 14,
    color: COLORS.textMuted,
    marginTop: SPACING.xs,
    textAlign: "center",
    paddingHorizontal: SPACING.lg,
  },
  form: {
    marginHorizontal: SPACING.lg,
    backgroundColor: COLORS.card,
    borderRadius: 14,
    padding: SPACING.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  input: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm + 4,
    fontSize: 15,
    color: COLORS.text,
    marginBottom: SPACING.md,
  },
  inputDisabled: {
    opacity: 0.6,
    backgroundColor: COLORS.background,
  },
  submitButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 10,
    paddingVertical: SPACING.md - 2,
    alignItems: "center",
    marginTop: SPACING.xs,
  },
  submitButtonDisabled: {
    opacity: 0.7,
  },
  submitButtonText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 16,
  },
  createAccountLink: {
    marginTop: SPACING.md,
    alignItems: "center",
  },
  createAccountText: {
    color: COLORS.textMuted,
    fontSize: 13,
  },
  linkDisabledText: {
    opacity: 0.5,
  },
  createAccountTextBold: {
    color: COLORS.primary,
    fontWeight: "700",
  },
});
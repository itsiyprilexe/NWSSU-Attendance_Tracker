// src/screens/CreateAccountScreen.tsx
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
import { createUserWithEmailAndPassword } from "firebase/auth";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "../firebase/config";
import { DEPARTMENTS } from "../data/departments";
import DepartmentBadge from "../components/DepartmentBadge";
import { COLORS, SPACING } from "../constants/theme";
import { AuthStackParamList } from "../types";

type Props = NativeStackScreenProps<AuthStackParamList, "CreateAccount">;

type AccountRole = "Admin" | "Instructor";

export default function CreateAccountScreen({ route, navigation }: Props) {
  // Locked to whatever department the user came from — no picker, since
  // they already chose their department on the previous screen.
  const department = route.params?.department ?? DEPARTMENTS[0];

  const [role, setRole] = useState<AccountRole>("Admin");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleCreateAccount = async () => {
    if (!username.trim() || !password) {
      Alert.alert("Missing info", "Please fill in all fields.");
      return;
    }
    if (password.length < 6) {
      Alert.alert("Weak password", "Password must be at least 6 characters.");
      return;
    }

    setLoading(true);
    try {
      const cred = await createUserWithEmailAndPassword(
        auth,
        username.trim(),
        password
      );

      const collectionName = role === "Admin" ? "admins" : "instructors";

      await setDoc(doc(db, collectionName, cred.user.uid), {
        email: username.trim(),
        departmentCode: department.code,
        role,
        createdAt: serverTimestamp(),
      });

      Alert.alert("Account created", "You can now sign in.", [
        { text: "OK", onPress: () => navigation.goBack() },
      ]);
    } catch (err: any) {
      Alert.alert("Could not create account", err?.message ?? "Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const emailPlaceholder =
    role === "Admin"
      ? `lastname.admin@${department.code.toLowerCase()}.edu`
      : `lastname.instructor@${department.code.toLowerCase()}.edu`;

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
      >
        <Pressable style={styles.backLink} onPress={() => navigation.goBack()} disabled={loading}>
          <Text style={styles.backLinkText}>{"\u2190"} Back to Login</Text>
        </Pressable>

        <View style={styles.header}>
          <DepartmentBadge department={department} size={80} />
          <Text style={styles.title}>Create an Account</Text>
          <Text style={styles.subtitle}>
            {department.name} ({department.code})
          </Text>
        </View>

        <View style={styles.form}>
          <Text style={styles.label}>I am a...</Text>
          <View style={styles.roleRow}>
            <Pressable
              style={[
                styles.roleBtn,
                role === "Admin" && styles.roleBtnActive,
                loading && styles.roleBtnDisabled,
              ]}
              onPress={() => setRole("Admin")}
              disabled={loading}
            >
              <Text style={role === "Admin" ? styles.roleTextActive : styles.roleText}>
                Admin
              </Text>
            </Pressable>
            <Pressable
              style={[
                styles.roleBtn,
                role === "Instructor" && styles.roleBtnActive,
                loading && styles.roleBtnDisabled,
              ]}
              onPress={() => setRole("Instructor")}
              disabled={loading}
            >
              <Text style={role === "Instructor" ? styles.roleTextActive : styles.roleText}>
                Instructor
              </Text>
            </Pressable>
          </View>

          <Text style={styles.label}>Username</Text>
          <TextInput
            style={[styles.input, loading && styles.inputDisabled]}
            placeholder={emailPlaceholder}
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
            onPress={handleCreateAccount}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.submitButtonText}>Create Account</Text>
            )}
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
    marginTop: SPACING.md,
    marginBottom: SPACING.lg,
  },
  title: {
    fontSize: 24,
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
  roleRow: {
    flexDirection: "row",
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  roleBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    paddingVertical: SPACING.sm,
    alignItems: "center",
    backgroundColor: COLORS.background,
  },
  roleBtnActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  roleBtnDisabled: {
    opacity: 0.6,
  },
  roleText: {
    color: COLORS.text,
    fontWeight: "600",
  },
  roleTextActive: {
    color: "#fff",
    fontWeight: "700",
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
});
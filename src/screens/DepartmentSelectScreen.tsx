// src/screens/DepartmentSelectScreen.tsx
import React from "react";
import {
  View,
  Text,
  FlatList,
  Pressable,
  StyleSheet,
  SafeAreaView,
  ListRenderItem,
} from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { DEPARTMENTS } from "../data/departments";
import DepartmentBadge from "../components/DepartmentBadge";
import { COLORS, SPACING } from "../constants/theme";
import { AuthStackParamList, Department } from "../types";

type Props = NativeStackScreenProps<AuthStackParamList, "DepartmentSelect">;

export default function DepartmentSelectScreen({ navigation }: Props) {
  const renderItem: ListRenderItem<Department> = ({ item }) => (
    <Pressable
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
      onPress={() => navigation.navigate("Login", { department: item })}
    >
      <DepartmentBadge department={item} size={56} />
      <View style={styles.cardText}>
        <Text style={styles.cardCode}>{item.code}</Text>
        <Text style={styles.cardName}>{item.name}</Text>
      </View>
    </Pressable>
  );

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Text style={styles.title}>Select Your Department</Text>
        <Text style={styles.subtitle}>
          Choose your college department to access the UniMonitor dashboard
          and event attendance records.
        </Text>
      </View>

      <FlatList
        data={DEPARTMENTS}
        keyExtractor={(item) => item.code}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.lg,
    paddingBottom: SPACING.md,
  },
  title: {
    fontSize: 24,
    fontWeight: "800",
    color: COLORS.text,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 14,
    color: COLORS.textMuted,
    textAlign: "center",
    marginTop: SPACING.sm,
    lineHeight: 20,
  },
  list: {
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.lg,
    gap: SPACING.md,
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.md,
    gap: SPACING.md,
  },
  cardPressed: {
    backgroundColor: "#EFF4F1",
  },
  cardText: {
    flex: 1,
  },
  cardCode: {
    fontSize: 16,
    fontWeight: "700",
    color: COLORS.text,
  },
  cardName: {
    fontSize: 13,
    color: COLORS.textMuted,
    marginTop: 2,
  },
});

// src/components/DepartmentBadge.tsx
import React from "react";
import { View, Text, Image, StyleSheet } from "react-native";
import { Department } from "../types";

interface Props {
  department: Department;
  size?: number;
}

export default function DepartmentBadge({ department, size = 64 }: Props) {
  const dimStyle = { width: size, height: size, borderRadius: size / 2 };

  if (department.logo) {
    return (
      <Image
        source={department.logo}
        style={[styles.image, dimStyle]}
        resizeMode="cover"
      />
    );
  }

  return (
    <View style={[styles.fallback, dimStyle, { backgroundColor: department.color }]}>
      <Text style={[styles.fallbackText, { fontSize: size * 0.34 }]}>
        {department.code}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  image: {
    backgroundColor: "#eee",
  },
  fallback: {
    alignItems: "center",
    justifyContent: "center",
  },
  fallbackText: {
    color: "#fff",
    fontWeight: "700",
  },
});
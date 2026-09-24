import { StyleSheet, Text, View } from "react-native";

export default function Home() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Ocafy Mobile</Text>
      <Text style={styles.subtitle}>Deixa a casa ok.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#C24B68",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: "#8A8286",
  },
});

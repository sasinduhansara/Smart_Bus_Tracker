import { Ionicons } from "@expo/vector-icons";
import { usePathname, useRouter } from "expo-router";
import {
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

const COLORS = {
  primary: "#0B4C8C",
  textDark: "#111827",
  textGray: "#4B5563",
  borderLight: "#E5E7EB",
  white: "#FFFFFF",
  tabActiveYellow: "#FCD34D",
};

const TABS = [
  {
    name: "Home",
    icon: "home-outline",
    activeIcon: "home",
    route: "/passenger/home",
  },
  {
    name: "Map",
    icon: "map-outline",
    activeIcon: "map",
    route: "/passenger/map",
  },
  {
    name: "Search",
    icon: "search-outline",
    activeIcon: "search",
    route: "/passenger/search",
  },
  {
    name: "Alerts",
    icon: "notifications-outline",
    activeIcon: "notifications",
    route: "/passenger/alert",
  },
  {
    name: "Chat",
    icon: "chatbox-outline",
    activeIcon: "chatbox",
    route: "/passenger/chat",
  },
] as const;

export default function BottomTabBar() {
  const router = useRouter();
  const pathname = usePathname();

  const handlePress = (route: string) => {
    if (route === "#") return; // Not implemented yet
    router.replace(route as any);
  };

  return (
    <View style={styles.container}>
      {TABS.map((tab) => {
        const isActive = pathname === tab.route;

        return (
          <TouchableOpacity
            key={tab.name}
            style={styles.tabItem}
            onPress={() => handlePress(tab.route)}
            activeOpacity={0.7}
          >
            {isActive ? (
              <View style={styles.activeTabCircle}>
                <Ionicons
                  name={tab.activeIcon as any}
                  size={20}
                  color={COLORS.textDark}
                />
              </View>
            ) : (
              <Ionicons
                name={tab.icon as any}
                size={22}
                color={COLORS.textGray}
              />
            )}
            <Text style={[styles.tabLabel, isActive && styles.activeTabLabel]}>
              {tab.name}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 74,
    backgroundColor: COLORS.white,
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: COLORS.borderLight,
    paddingBottom: Platform.OS === "ios" ? 15 : 0,
  },
  tabItem: {
    alignItems: "center",
    justifyContent: "center",
  },
  activeTabCircle: {
    backgroundColor: COLORS.tabActiveYellow,
    width: 44,
    height: 26,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 2,
  },
  activeTabLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: COLORS.textDark,
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: "500",
    color: COLORS.textGray,
    marginTop: 4,
  },
});

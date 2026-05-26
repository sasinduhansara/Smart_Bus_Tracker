import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  FlatList,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

const { width, height } = Dimensions.get("window");

const slides = [
  {
    id: "1",
    emoji: "🗺️",
    bg: "#1565C0",
    accent: "#1976D2",
    titleSi: "සජීවී බස් ට්‍රැකිං",
    titleEn: "Live Bus Tracking",
    titleTa: "நேரடி பேருந்து கண்காணிப்பு",
    descSi: "ඔබේ බස් රථය සිතියමේ සජීවීව නරඹන්න. GPS තාක්ෂණය මගින් නිවැරදිව!",
    descEn:
      "Track your bus live on the map using GPS technology with pinpoint accuracy.",
    descTa:
      "GPS தொழில்நுட்பம் மூலம் உங்கள் பேருந்தை வரைபடத்தில் நேரலையில் கண்காணிக்கவும்.",
  },
  {
    id: "2",
    emoji: "⏱️",
    bg: "#0D47A1",
    accent: "#1565C0",
    titleSi: "AI පැමිණීමේ වේලාව",
    titleEn: "AI-Powered ETA",
    titleTa: "AI வருகை நேர கணிப்பு",
    descSi:
      "කෘත්‍රිම බුද්ධිය භාවිතයෙන් ඔබේ බස් රථය පැමිණෙන නිශ්චිත වේලාව කල්තියා දැනගන්න.",
    descEn:
      "Know exactly when your bus arrives using our smart AI prediction engine.",
    descTa:
      "எங்கள் AI கணிப்பு மூலம் பேருந்து எப்போது வருமென்று சரியாக அறியுங்கள்.",
  },
  {
    id: "3",
    emoji: "🔔",
    bg: "#1565C0",
    accent: "#1976D2",
    titleSi: "ස්මාර්ට් දැනුම්දීම්",
    titleEn: "Smart Notifications",
    titleTa: "புத்திசாலி அறிவிப்புகள்",
    descSi:
      "බස් රථය ළඟා වන විට ස්වයංක්‍රීයව දැනුම්දීමක් ලබා, කිසිදා බස් රථයක් අතහැරිය නොහරින්න!",
    descEn:
      "Never miss your bus again! Get smart alerts when your bus is approaching.",
    descTa:
      "பேருந்து வரும்போது தானாக அறிவிப்பு பெறுங்கள். இனி பேருந்தை தவறவிட வேண்டாம்!",
  },
];

export default function OnboardingScreen() {
  const router = useRouter();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [language, setLanguage] = useState("en");
  const flatListRef = useRef<FlatList>(null);
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const slideAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const getLang = async () => {
      const lang = await AsyncStorage.getItem("language");
      if (lang) setLanguage(lang);
    };
    getLang();
  }, []);

  const nativeDriver = Platform.OS !== "web";

  const animateTransition = (nextIndex: number) => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 150,
        useNativeDriver: nativeDriver,
      }),
      Animated.timing(slideAnim, {
        toValue: -30,
        duration: 150,
        useNativeDriver: nativeDriver,
      }),
    ]).start(() => {
      flatListRef.current?.scrollToIndex({ index: nextIndex });
      setCurrentIndex(nextIndex);
      slideAnim.setValue(30);

      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: nativeDriver,
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: nativeDriver,
        }),
      ]).start();
    });
  };

  const handleNext = async () => {
    if (currentIndex < slides.length - 1) {
      animateTransition(currentIndex + 1);
    } else {
      await AsyncStorage.setItem("onboarded", "true");
      router.replace("/welcome");
    }
  };

  const handleSkip = async () => {
    await AsyncStorage.setItem("onboarded", "true");
    router.replace("/welcome");
  };

  const getTitle = (slide: (typeof slides)[0]) => {
    if (language === "si") return slide.titleSi;
    if (language === "ta") return slide.titleTa;
    return slide.titleEn;
  };

  const getDesc = (slide: (typeof slides)[0]) => {
    if (language === "si") return slide.descSi;
    if (language === "ta") return slide.descTa;
    return slide.descEn;
  };

  const getSkipText = () => {
    if (language === "si") return "මඟ හරින්න";
    if (language === "ta") return "தவிர்க்கவும்";
    return "Skip";
  };

  const getNextText = () => {
    const isLast = currentIndex === slides.length - 1;
    if (isLast) {
      if (language === "si") return "පටන් ගනිමු! 🚀";
      if (language === "ta") return "தொடங்குவோம்! 🚀";
      return "Get Started! 🚀";
    }
    if (language === "si") return "ඊළඟ →";
    if (language === "ta") return "அடுத்து →";
    return "Next →";
  };

  const currentSlide = slides[currentIndex];

  return (
    <View style={[styles.container, { backgroundColor: currentSlide.bg }]}>
      {/* Background Circles */}
      <View
        style={[styles.circle1, { backgroundColor: currentSlide.accent }]}
      />
      <View
        style={[styles.circle2, { backgroundColor: currentSlide.accent }]}
      />

      {/* Top Row */}
      <View style={styles.topRow}>
        <Text style={styles.stepText}>
          {currentIndex + 1} / {slides.length}
        </Text>
        {currentIndex < slides.length - 1 && (
          <TouchableOpacity onPress={handleSkip} style={styles.skipBtn}>
            <Text style={styles.skipText}>{getSkipText()}</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Hidden FlatList – pointerEvents: "none" prevents ARIA focus conflicts */}
      <FlatList
        ref={flatListRef}
        data={slides}
        horizontal
        pagingEnabled
        scrollEnabled={false}
        showsHorizontalScrollIndicator={false}
        keyExtractor={(item) => item.id}
        style={{ pointerEvents: "none" }}
        accessible={false}
        importantForAccessibility="no-hide-descendants"
        renderItem={() => <View style={{ width }} />}
      />

      {/* Animated Content */}
      <Animated.View
        style={[
          styles.content,
          {
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }],
          },
        ]}
      >
        <View style={styles.emojiBox}>
          <Text style={styles.emoji}>{currentSlide.emoji}</Text>
        </View>
        <Text style={styles.title}>{getTitle(currentSlide)}</Text>
        <Text style={styles.desc}>{getDesc(currentSlide)}</Text>
      </Animated.View>

      {/* Bottom Section */}
      <View style={styles.bottom}>
        {/* Progress Bar */}
        <View style={styles.progressBar}>
          <View
            style={[
              styles.progressFill,
              { width: `${((currentIndex + 1) / slides.length) * 100}%` },
            ]}
          />
        </View>

        {/* Dots */}
        <View style={styles.dotsContainer}>
          {slides.map((_, index) => (
            <TouchableOpacity
              key={index}
              onPress={() => index < currentIndex && animateTransition(index)}
            >
              <View
                style={[
                  styles.dot,
                  currentIndex === index && styles.activeDot,
                  index < currentIndex && styles.completedDot,
                ]}
              />
            </TouchableOpacity>
          ))}
        </View>

        {/* Next Button */}
        <TouchableOpacity
          style={[
            styles.nextBtn,
            currentIndex === slides.length - 1 && styles.getStartedBtn,
          ]}
          onPress={handleNext}
          activeOpacity={0.85}
        >
          <Text style={styles.nextText}>{getNextText()}</Text>
        </TouchableOpacity>

        {/* Back Button */}
        {currentIndex > 0 && (
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => animateTransition(currentIndex - 1)}
          >
            <Text style={styles.backText}>
              {language === "si"
                ? "← ආපසු"
                : language === "ta"
                  ? "← பின்செல்"
                  : "← Back"}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    overflow: "hidden",
  },
  circle1: {
    position: "absolute",
    width: width * 0.8,
    height: width * 0.8,
    borderRadius: width * 0.4,
    top: -width * 0.3,
    right: -width * 0.2,
    opacity: 0.5,
  },
  circle2: {
    position: "absolute",
    width: width * 0.6,
    height: width * 0.6,
    borderRadius: width * 0.3,
    bottom: -width * 0.1,
    left: -width * 0.15,
    opacity: 0.4,
  },
  topRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    width: "100%",
    paddingHorizontal: 24,
    paddingTop: height * 0.07,
    paddingBottom: 10,
  },
  stepText: {
    color: "rgba(255,255,255,0.6)",
    fontSize: width * 0.04,
    fontWeight: "600",
  },
  skipBtn: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.15)",
  },
  skipText: {
    color: "#FFFFFF",
    fontSize: width * 0.038,
    fontWeight: "500",
  },
  content: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: width * 0.08,
  },
  emojiBox: {
    width: width * 0.42,
    height: width * 0.42,
    borderRadius: width * 0.12,
    backgroundColor: "rgba(255,255,255,0.15)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 40,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.25)",
  },
  emoji: {
    fontSize: width * 0.2,
  },
  title: {
    fontSize: width * 0.072,
    fontWeight: "800",
    color: "#FFFFFF",
    textAlign: "center",
    marginBottom: 20,
    lineHeight: width * 0.09,
  },
  desc: {
    fontSize: width * 0.04,
    color: "rgba(255,255,255,0.75)",
    textAlign: "center",
    lineHeight: 26,
  },
  bottom: {
    width: "100%",
    alignItems: "center",
    paddingHorizontal: width * 0.06,
    paddingBottom: height * 0.06,
    gap: 16,
  },
  progressBar: {
    width: "100%",
    height: 4,
    backgroundColor: "rgba(255,255,255,0.2)",
    borderRadius: 2,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    backgroundColor: "#FFFFFF",
    borderRadius: 2,
  },
  dotsContainer: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "rgba(255,255,255,0.3)",
  },
  activeDot: {
    width: 28,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#FFFFFF",
  },
  completedDot: {
    backgroundColor: "rgba(255,255,255,0.6)",
  },
  nextBtn: {
    backgroundColor: "#FFA000",
    paddingVertical: 18,
    borderRadius: 50,
    width: "100%",
    alignItems: "center",
  },
  getStartedBtn: {
    backgroundColor: "#2E7D32",
  },
  nextText: {
    color: "#FFFFFF",
    fontSize: width * 0.045,
    fontWeight: "700",
  },
  backBtn: {
    paddingVertical: 10,
  },
  backText: {
    color: "rgba(255,255,255,0.6)",
    fontSize: width * 0.038,
  },
});

# Concertly backend — Railway/Docker kurulum tarifi
# Bu dosya sayesinde sunucu doğru Java sürümüyle (17) kurulur ve çalışır.
# Railway bu dosyayı otomatik bulur; elle ayar yapman gerekmez.

# --- 1) Derleme aşaması: Maven ile JAR üret (testler atlanır) ---
FROM maven:3.9-eclipse-temurin-17 AS build
WORKDIR /app
COPY pom.xml .
COPY src ./src
RUN mvn -q clean package -DskipTests

# --- 2) Çalıştırma aşaması: sadece üretilen JAR'ı çalıştır ---
FROM eclipse-temurin:17-jre
WORKDIR /app
COPY --from=build /app/target/*.jar app.jar
# Railway PORT'u kendisi atar; uygulama ${PORT}'u dinler (application.properties)
ENTRYPOINT ["java", "-jar", "app.jar"]

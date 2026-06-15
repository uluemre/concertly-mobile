# Concertly backend — Railway/Docker kurulum tarifi
# Bu dosya sayesinde sunucu doğru Java sürümüyle (17) kurulur ve çalışır.
# Railway bu dosyayı otomatik bulur; elle ayar yapman gerekmez.

# --- 1) Derleme aşaması: Maven ile JAR üret (testler atlanır) ---
FROM maven:3.9-eclipse-temurin-17 AS build
WORKDIR /app
# Maven heap'ini sınırla — küçük build ortamında sınırsız bırakılırsa
# cgroup limitini aşıp "out of memory" ile öldürülebiliyor.
ENV MAVEN_OPTS="-Xmx512m"
COPY pom.xml .
COPY src ./src
RUN mvn -q -B clean package -DskipTests

# --- 2) Çalıştırma aşaması: sadece üretilen JAR'ı çalıştır ---
FROM eclipse-temurin:17-jre
WORKDIR /app
COPY --from=build /app/target/*.jar app.jar
# Railway PORT'u kendisi atar; uygulama ${PORT}'u dinler (application.properties)
# Bellek: 1GB container'da heap'i SABİT 384MB'a, metaspace'i 128MB'a tavanla.
# Böylece toplam (heap 384 + metaspace 128 + thread/Tomcat ~150) <700MB kalır,
# startup'taki bean-oluşturma pikinde bile 1GB'ı asla aşmaz. %50 (512MB heap)
# bu piki aşıp OOM-kill yiyordu ("Started" satırına varmadan temiz kesiliyordu).
# SerialGC az RAM/az çekirdek ortamında daha az bellek ve thread harcar.
ENTRYPOINT ["java", "-Xmx384m", "-XX:MaxMetaspaceSize=128m", "-XX:+UseSerialGC", "-jar", "app.jar"]

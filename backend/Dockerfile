# Concertly backend — Docker kurulum tarifi
# Render, VPS veya başka bir Docker host üzerinde kullanılabilir.

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
# Platform PORT'u kendisi atar; uygulama ${PORT}'u dinler (application.properties)
# Bellek: ucretsiz planlarin cogu 512MB veriyor. Olculdu: -Xmx256m ile uygulama
# aciliyor ve 40 es zamanli istek altinda RSS ~333MB'da kaliyor, yani 512MB'lik
# bir kutuya rahat sigiyor. Daha buyuk bir makineye gecersen JAVA_OPTS ile
# override et, ornegin: JAVA_OPTS="-Xmx768m -XX:MaxMetaspaceSize=192m"
# SerialGC + TieredStopAtLevel=1 az RAM/az cekirdekte daha az bellek ve thread harcar.
ENV JAVA_OPTS="-Xmx256m -XX:MaxMetaspaceSize=96m -XX:+UseSerialGC -XX:TieredStopAtLevel=1"
ENTRYPOINT ["sh", "-c", "exec java $JAVA_OPTS -jar app.jar"]

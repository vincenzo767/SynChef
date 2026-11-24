FROM maven:3.9-eclipse-temurin-17 AS build
WORKDIR /app
COPY pom.xml .
RUN mvn -B -q dependency:go-offline
COPY src ./src
# Runs the full unit + integration test suite (H2) as part of the image build.
RUN mvn -B package

FROM eclipse-temurin:17-jre-alpine
WORKDIR /app
RUN addgroup -S synchef && adduser -S synchef -G synchef && mkdir -p /app/uploads && chown synchef:synchef /app/uploads
COPY --from=build /app/target/*.jar app.jar
USER synchef
EXPOSE 8080
ENV APP_UPLOAD_DIR=/app/uploads
ENTRYPOINT ["java", "-jar", "app.jar"]

# Basisimage mit Chromium und allen Abhängigkeiten
FROM mcr.microsoft.com/playwright:v1.42.0-focal

WORKDIR /app

COPY package*.json ./
RUN npm install --omit=dev

COPY . .

EXPOSE 8080
CMD ["node", "index.js"]

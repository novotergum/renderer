# Basis-Image mit Playwright
FROM mcr.microsoft.com/playwright:v1.45.3-focal

WORKDIR /app

# Paketdefinitionen kopieren
COPY package.json package-lock.json* ./

RUN npm install --omit=dev

# Code kopieren
COPY . .

# Startkommando
CMD ["npm", "start"]

FROM node:18-bullseye

# Install Python and pip
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 python3-pip \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Node dependencies
COPY package*.json ./
RUN npm ci --omit=dev || npm install --omit=dev

# Copy source code
COPY . .

# Install Python deps
RUN pip3 install --no-cache-dir PyPDF2 pdfminer.six

# Build Next.js
COPY .env* ./
COPY ./.env ./hydration-app/.env
RUN npm run build

ENV NODE_ENV=production
ENV PORT=10000
EXPOSE 10000

CMD ["node", ".next/standalone/server.js"]


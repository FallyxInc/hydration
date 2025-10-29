FROM node:18-bullseye

# Install Python and pip
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 python3-pip curl \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package files first for better caching
COPY package*.json ./

# Install Node dependencies
RUN npm ci --omit=dev || npm install --omit=dev

# Copy source code
COPY . .

# Install Python deps
RUN pip3 install --no-cache-dir PyPDF2 pdfminer.six
 
# Build Next.js
RUN npm run build

# Copy static files to standalone directory
RUN cp -r .next/static .next/standalone/.next/ && \
    cp -r public .next/standalone/

# Set environment variables
ENV NODE_ENV=production
ENV PORT=8080
ENV HOSTNAME=0.0.0.0

EXPOSE 8080

# Add health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:8080/api/health || exit 1

# Start the application using standalone mode
CMD ["npm", "run", "start:standalone"]


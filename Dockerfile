FROM node:18-alpine

# Add Python
RUN apk add --no-cache python3 py3-pip

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY vite.config.ts ./
COPY index.html ./  

# === FOR STARTUP WITH LOCAL DATA ===
# Copy data from zip file and unzip
RUN apk add --no-cache unzip

COPY data.zip /app/data.zip
RUN mkdir -p public \
    && unzip data.zip -d public \
    && rm data.zip
# === END ===

# === FOR STARTUP WITH DATA FETCH ===
# Copy Python preprocessing scripts
# COPY data_preparation ./data_preparation

# Install Python dependencies
# COPY ./requirements.txt ./requirements.txt
# RUN pip install -r requirements.txt --no-cache-dir

# Copy startup script
# COPY data-preparation.sh /usr/local/bin/
# RUN chmod +x /usr/local/bin/data-preparation.sh
# ENTRYPOINT ["data-preparation.sh"]
# === END ===

# Install dependencies
RUN npm i

# Copy source code
COPY src ./src

EXPOSE 3000

CMD ["npm", "run", "dev", "--", "--host"]
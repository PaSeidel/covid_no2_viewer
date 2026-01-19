FROM node:18-alpine

# Add Python
RUN apk add --no-cache python3 py3-pip

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY vite.config.ts ./
COPY index.html ./  

# Install dependencies
RUN npm i

# Copy source code
COPY src ./src

# Copy Python preprocessing scripts
# COPY data_preparation ./data_preparation

# Install Python dependencies
# COPY ./requirements.txt ./requirements.txt
# RUN pip install -r requirements.txt --no-cache-dir

# Copy startup script
# COPY data-preparation.sh /usr/local/bin/
# RUN chmod +x /usr/local/bin/data-preparation.sh
EXPOSE 3000

# ENTRYPOINT ["data-preparation.sh"]
CMD ["npm", "run", "dev"]
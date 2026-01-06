FROM node:20-alpine

WORKDIR /app

# Copy package files and install
COPY package*.json ./
RUN npm install

# Fix permissions for the entire /app directory to allow the mapped user to write
# This is needed for Vite's cache directories (.vite-temp, etc.)
RUN chmod -R 777 /app

# We don't copy the code here because we volume map it in docker-compose
# for development, but having node_modules in the image helps.

CMD ["npm", "run", "dev"]

FROM node:20-alpine

WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm install

# The code and node_modules are volume-mapped in docker-compose dev mode
CMD ["npm", "run", "dev", "--", "--host"]
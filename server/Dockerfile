# Use the standard Node image (larger, but better network compatibility than Alpine)
FROM node:18

WORKDIR /app

COPY package.json ./

# CONFIG: Tell npm to not worry about valid SSL certificates
# (Crucial for school networks that inspect traffic)
RUN npm config set strict-ssl false

# Install dependencies
RUN npm install

COPY . .

EXPOSE 3000

CMD ["npm", "run", "dev"]
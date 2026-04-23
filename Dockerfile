# 1. Use the official Node.js Alpine image for version 24
FROM node:24-alpine

# 2. Set the working directory inside the container
WORKDIR /app

# 3. Copy package.json and package-lock.json first
COPY package*.json ./

# 4. Install your dependencies
RUN npm install

# 5. Copy the rest of your application's source code
# (This grabs your server, static, and src folders)
COPY . .

# 6. Expose the port your application uses 
# (Change 3000 if your server listens on a different port)
EXPOSE 3000

# 7. Define the command to start your game server
CMD ["npm", "start"]
# below is copy and pasted from gemini for testing

FROM node:18-alpine

WORKDIR /app

# Copy package definitions first (better caching)
COPY package.json ./

# Install dependencies inside the container
RUN npm install

# Copy the rest of the code
COPY . .

# Expose the port
EXPOSE 3000

# Start the server using nodemon (for auto-reloading)
CMD ["npm", "run", "dev"]
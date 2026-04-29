# 1. Use the standard Node 24 image
FROM node:24

# 2. Set the working directory
WORKDIR /app

# 3. Copy ONLY the package files first
COPY package*.json ./

# 4. The Trusted Corporate Bypass: Use the Yarn/Cloudflare registry
RUN npm config set registry https://registry.yarnpkg.com
RUN npm config set strict-ssl false -g
ENV NODE_TLS_REJECT_UNAUTHORIZED=0

# 5. Install dependencies natively in Linux
RUN npm install --no-package-lock

# 6. Copy the rest of your code (This will copy your .env file too!)
COPY . .

# 7. Expose the ports (8001 for your backend, 5173 for Vite)
EXPOSE 8001 5173

# 8. Start the server and Vite directly
CMD ["sh", "-c", "node server/server.js & node node_modules/vite/bin/vite.js dev --host"]
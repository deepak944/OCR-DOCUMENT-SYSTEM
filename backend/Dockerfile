FROM node:20-alpine

WORKDIR /app
ENV NODE_ENV=production

COPY package*.json ./
RUN npm install --omit=dev

COPY server.js ./
COPY src ./src

EXPOSE 5000

CMD ["npm", "run", "start"]

FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY index.html ./
COPY vite.config.js ./
COPY eslint.config.js ./
COPY public ./public
COPY src ./src

ENV VITE_API_URL=http://localhost:5000

EXPOSE 5173

CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0", "--port", "5173"]

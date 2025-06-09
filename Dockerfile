FROM node:20-alpine

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm install --legacy-peer-deps
COPY . .

RUN npm install -g pm2
EXPOSE 3000
CMD ["pm2-runtime", "npm", "--", "start"]
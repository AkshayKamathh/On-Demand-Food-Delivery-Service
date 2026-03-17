FROM node:24-alpine

WORKDIR /app

COPY ofs-frontend/package*.json ./
RUN npm install

COPY ofs-frontend/ .

EXPOSE 3000

CMD ["npm", "run", "dev"]
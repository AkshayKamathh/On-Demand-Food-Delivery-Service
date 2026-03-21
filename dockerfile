FROM node:24-alpine

WORKDIR /app

COPY ofs-frontend/ .
RUN npm install

EXPOSE 3000

CMD ["npm", "run", "dev"]
FROM node:latest
ENV FILES_PORT 10207

WORKDIR /app
ADD . /app

RUN npm install

EXPOSE $FILES_PORT

CMD ["node", "index.js"]

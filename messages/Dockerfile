FROM node:latest
ENV MESSAGES_PORT 10204

WORKDIR /app
ADD . /app

RUN npm install

EXPOSE $MESSAGES_PORT

CMD ["node", "index.js"]

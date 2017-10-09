FROM node:latest
ENV MESSAGES_PORT 10204

WORKDIR /app
ADD . /app

RUN npm install

EXPOSE $MESSAGES_PORT

CMD ["./wait-for-it.sh", "couchdb:5984", "--", "node", "index.js"]

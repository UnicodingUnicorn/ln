FROM node:latest
ENV OPENID_PORT 10202

WORKDIR /app
ADD . /app

RUN npm install

EXPOSE $OPENID_PORT

CMD ["./wait-for-it.sh", "couchdb:5984", "--", "./wait-for-it.sh", "redis:6379", "--", "node", "index.js"]

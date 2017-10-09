FROM node:latest
ENV OPENID_PORT 10202

WORKDIR /app
ADD . /app

RUN npm install

EXPOSE $OPENID_PORT

CMD ["./wait-for-it.sh", "couchdb:5984", "--", "./wait-for-it.sh", "memcached:11211", "--", "node", "index.js"]

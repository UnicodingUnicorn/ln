FROM node:latest
ENV ACCOUNTS_PORT 10206

WORKDIR /app
ADD . /app

RUN npm install

EXPOSE $ACCOUNTS_PORT

CMD ["./wait-for-it.sh", "couchdb:5984", "--", "node", "index.js"]

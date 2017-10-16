FROM node:latest
ENV PERMISSIONS_PORT 10208

WORKDIR /app
ADD . /app

RUN npm install

EXPOSE $PERMISSIONS_PORT

CMD ["./wait-for-it.sh", "couchdb:5984", "--", "node", "index.js"]

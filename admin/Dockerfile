FROM node:latest
ENV ADMIN_PORT 10201

WORKDIR /app
ADD . /app

RUN npm install

EXPOSE $ADMIN_PORT

CMD ["./wait-for-it.sh", "couchdb:5984", "--", "node", "index.js"]

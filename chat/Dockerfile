FROM node:latest
ENV SOCKETCLUSTER_PORT 10203

WORKDIR /app
ADD . /app

RUN npm install

EXPOSE $SOCKETCLUSTER_PORT

CMD ["./wait-for-it.sh", "couchdb:5984", "--", "npm", "start"]

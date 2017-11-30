FROM node:8.4.0-slim
ENV SOCKETCLUSTER_PORT 10203

RUN mkdir -p /usr/src/
WORKDIR /usr/src/
COPY . /usr/src/

RUN npm install .

EXPOSE $SOCKETCLUSTER_PORT

CMD ["./wait-for-it.sh", "couchdb:5984", "--", "./wait-for-it.sh", "redis:6379", "--", "npm", "run", "start:docker"]

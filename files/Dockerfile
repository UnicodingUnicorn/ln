FROM node:latest
ENV FILES_PORT 10207

WORKDIR /app
ADD . /app

RUN npm install

EXPOSE $FILES_PORT

CMD ["./wait-for-it.sh", "minio:9000", "--", "node", "index.js"]

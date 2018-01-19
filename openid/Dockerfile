FROM node:latest
ENV OPENID_PORT 10202

WORKDIR /app
ADD . /app

RUN npm install

EXPOSE $OPENID_PORT

CMD ["node", "index.js"]

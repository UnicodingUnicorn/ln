FROM node:latest
ENV ACCOUNTS_PORT 10206

WORKDIR /app
ADD . /app

RUN npm install

EXPOSE $ACCOUNTS_PORT

CMD ["node", "index.js"]

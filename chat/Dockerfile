FROM node:8.4.0-slim
ENV SOCKETCLUSTER_PORT 10203

RUN mkdir -p /usr/src/
WORKDIR /usr/src/
COPY . /usr/src/

RUN npm install .

EXPOSE $SOCKETCLUSTER_PORT

CMD ["npm", "run", "start:docker"]

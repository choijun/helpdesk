FROM node:current-alpine

RUN npm install -g pm2 \
	&& apk add curl

RUN mkdir /modules
COPY ./package.json /modules
RUN cd /modules && npm install
ENV NODE_PATH /modules

WORKDIR /code

CMD [ "pm2-runtime", "--watch", "server.js" ]

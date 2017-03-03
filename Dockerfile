FROM node:7.6.0

RUN apt-key adv --keyserver hkp://keyserver.ubuntu.com:80 --recv 0C49F3730359A14518585931BC711F9BA15703C6 \
    && apt-get update \
    && apt-get install -y cron \
    && echo "deb http://repo.mongodb.org/apt/debian jessie/mongodb-org/3.4 main" | tee /etc/apt/sources.list.d/mongodb-org-3.4.list \
    && apt-get install -y mongodb

RUN mkdir -p /usr/src/app
WORKDIR /usr/src/app
COPY . /usr/src/app/
RUN npm install
RUN crontab < /usr/src/app/cron.txt
EXPOSE 8080
CMD [ "npm", "start" ]
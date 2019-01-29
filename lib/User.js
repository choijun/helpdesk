"use strict";

const
  Service = new (require('./Service').Service),
  logger = require('log4js').getLogger(),
  assert = require('assert')
  ;

logger.level = 'debug';

class User {

  constructor(config) {
    this.config = config;
    this.mongo = Service.get('mongo');
    this.users = this.mongo.collection('users');
    this.HelpDeskApi = Service.get('HelpDeskApi');
  }

  fetchApiPage(settings) {
    let usersUri = settings.uri.replace('{page}', settings.page);

    this.HelpDeskApi.get(usersUri, (err, data) => {
      assert.equal(null, err);
      for(let i in data.Users) {
        let user = data.Users[i];

        this.users.update({Id: user.Id}, {
          $currentDate: {
            lastModified: true,
            HDUserUpdate: { $type: "timestamp" }
          }, $set: user
        }, {upsert: true, multi: false});
      }

      logger.info(`User: fetched page [ ${settings.page} / ${data.Paginator.PageCount} ]`);

      if(settings.page >= data.Paginator.PageCount) {
        logger.info(`User: fetching done`);
        if(typeof settings.cb == 'function') settings.cb();
      } else {
        settings.page++;
        this.fetchApiPage(settings);
      }
    });
  }

  // Полный обход пользователей с сохранением
  fetchAll() {
    if(this.config.enabled != 1) return;

		// Только периодическая проверка
		if(this.config.reindex != 1) {
			this.fetchAllDelay();
			return;
		}

		logger.info(`User: start fetching`);
    let paginationUri = this.config.uri + '?sort=Id%20asc&page={page}&pagesize=' + this.config.limit;
    this.fetchApiPage({
      uri: paginationUri,
      page: 1,
      cb: () => {
        this.fetchAllDelay();
      }
    });
  }

  // Переобход с задержкой
  fetchAllDelay() {
    if(this.config.enabled != 1) return;
    logger.info(`User: waiting for new fetching: ${this.config.checkDelay} ...`);
    setTimeout(() => {
      this.fetchAll();
    }, this.config.checkDelay);
  }

}

module.exports.User = User;

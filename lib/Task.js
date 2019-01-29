"use strict";

const
  Service = new (require('./Service').Service),
  logger = require('log4js').getLogger(),
  assert = require('assert'),
  xpath = require('xpath'),
  dom = require('xmldom').DOMParser
  ;

logger.level = 'debug';

class Task {

  constructor(config, activeUsers) {
    this.config = config;
    this.activeUsers = activeUsers;
    this.mongo = Service.get('mongo');
    this.tasks = this.mongo.collection('tasks');
    this.HelpDeskApi = Service.get('HelpDeskApi');
  }

  fetchApiPage(settings) {
    let tasksUri = settings.uri.replace('{page}', settings.page);

    this.HelpDeskApi.get(tasksUri, (err, data) => {
      assert.equal(null, err);
      for(var i in data.Tasks) {
        var task = data.Tasks[i];
        task.ExecutorIds = task.ExecutorIds.split(",");
        task.ExecutorIds = task.ExecutorIds.map( (val) => { return parseInt(val.trim()); });
        task.ChangedUTC = Date.parse(task.Changed);

        task.HDStartTime = this.parseDateBegin(task);
        task.checkExp = 1;
        task.checkLife = 1;

        this.tasks.update({Id: task.Id}, {
          $currentDate: {
            lastModified: true,
            HDTaskUpdate: { $type: "timestamp" }
          }, $set: task
        }, {upsert: true, multi: false});
      }

      logger.info(`Task: fetched page [ ${settings.page} / ${data.Paginator.PageCount} ]`);

      if(settings.page >= data.Paginator.PageCount) {
        logger.info(`Task: fetching done`);
        if(typeof settings.cb == 'function') settings.cb();
      } else {
        settings.page++;
        this.fetchApiPage(settings);
      }
    });
  }

  // Полный обход задач и наблюдение
  fetchAll() {
    if(this.config.enabled != 1) return;

		// Только дельта
		if(this.config.reindex != 1) {
			this.deltaIndex();
			return;
		}

		logger.info(`Task: start fetching`);
		let paginationUri = this.config.uri + '?ExecutorIds=' + this.activeUsers.join(',') + '&sort=Id%20asc&page={page}&pagesize=' + this.config.limit;
    this.fetchApiPage({
      uri: paginationUri,
      page: 1,
      cb: () => {
        this.deltaIndex();
      }
    });
  }

  // Дельта - наблюдение
  deltaIndex() {
    let cursor = this.tasks.find({}, {Id: 1, Changed: 1}).sort({Changed: -1}).limit(1);
    cursor.toArray((err, task) => {
      assert.equal(null, err);
      if(task.length == 0) return; // невозможно делать дельту для пустой коллекции

      // Uri для получения небольшой порции "последних обновленных" задач
      let newerThan = task[0].Changed.substr(0, 19).replace('T', '+');
      let paginationUri = this.config.uri + '?ExecutorIds=' + this.activeUsers.join(',') + '&sort=Changed%20desc&page={page}&pagesize=' + this.config.deltaLimit
        + '&ChangedMoreThan=' + newerThan;

      logger.info(`Task: fetching newer than: ${newerThan} [ ${task[0].Id} ]...`);

      this.fetchApiPage({
        uri: paginationUri,
        page: 1,
        cb: () => {
          setTimeout(() => {
            this.deltaIndex();
          }, this.config.checkDelay);
        }
      });
    });
  }


  parseDateBegin(task) {
    // let xml = '<root><field id="1081">8</field><field id="1082">2017-04-26 00:00</field><field id="1114" /><field id="1195" /><field id="1196" /></root>';
    let xml = '<root>' + task.Data + '</root>';
    let doc = new dom().parseFromString(xml);
    // 1082 - поле "начало работы"
    let nodes = xpath.select("//field[@id=1082]", doc);
    if(!nodes.length) return null;
    try {
      return Date.parse(nodes[0].firstChild.data);
    } catch (e) {
      return null;
    }
  }

}

module.exports.Task = Task;

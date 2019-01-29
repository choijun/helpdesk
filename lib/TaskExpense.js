"use strict";

const
  Service = new (require('./Service').Service),
  logger = require('log4js').getLogger(),
  assert = require('assert')
  ;

logger.level = 'debug';

class TaskExpense {

  constructor(config) {
    this.config = config;
    this.mongo = Service.get('mongo');
    this.tasks = this.mongo.collection('tasks');
    this.HelpDeskApi = Service.get('HelpDeskApi');
  }

  /*
    Обновляем задачи, полученные в `Task.fetchApiPage()` с флагом `checkExp = 1`, начиная со старых
    (иначе при переобходе `Task.fetchAll()` будет браться одна и та же задача)
  */

  fetchMarked() {
    if(this.config.enabled != 1) return;

    let cursor = this.tasks.find({checkExp: 1}).limit(1).sort({Changed: 1});

    cursor.toArray((err, task) => {
      assert.equal(null, err);

      // нет задач для получения трудозатрат, ставим в ожидание
      if(task.length == 0) {
        logger.info(`TaskExpense: wait for Task updates ...`);
        setTimeout(() => {
          this.fetchMarked();
        }, this.config.checkDelay);
        return;
      }

      logger.info(`TaskExpense: update [ ${task[0].Id} ]`);

      let expensesUri = this.config.uri + '?taskid=' + task[0].Id + '&pagesize=100&page=1';

      this.HelpDeskApi.get(expensesUri, (err, data) => {
        var Expenses;
        switch(true) {
          // нормальный случай, данные есть
          case err === null && data !== null:
            Expenses = {checkExp: 0, Expenses: data.Expenses};
            break;
          // удален или нет прав (снимаем флаг)
          case err !== null && err.statusCode == 400:
            Expenses = {checkExp: 0};
            break;
          // нет данных
          default:
            Expenses = {checkExp: 0};
        }

        this.tasks.updateOne({Id: task[0].Id}, {
          $currentDate: {
            lastModified: true,
            HDExpUpdate: { $type: "timestamp" }
          },
          $set: Expenses
        }, (err, res) => {
          this.fetchMarked();
        });

      });

    });

  }


}

module.exports.TaskExpense = TaskExpense;

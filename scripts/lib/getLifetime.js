'use strict';

var
  EventEmitter = require('events'),
  emitter = new EventEmitter(),
  assert = require('assert'),

  config, mongoDb, getData, tasks;

function init(conf) {
  config = conf.config;
  mongoDb = conf.mongoDb;
  getData = conf.getData;

  tasks = mongoDb.collection('tasks');
}

function run() {
  if(config.active != 1) return;
  emitter.emit('getLifetime');
}

emitter.on('getLifetime', function(){

  // Обновляем задачи, переданные из getTasks с флагом checkLife = 1, начиная со старых
  // (иначе при переиндексации getTasks будет браться одна и та же задача)

  var cursor = tasks.find({checkLife: 1}).sort({Changed: 1}).limit(1);

  cursor.toArray(function(err, task){
    assert.equal(null, err);

    // нет задач для получения трудозатрат, ставим в ожидание
    if(task.length == 0) {
      setTimeout(function(){
        emitter.emit('getLifetime');
      }, config.checkDelay);
      return;
    }

    var lifetimeUri = config.uri + '?taskid=' + task[0].Id + '&pagesize=100&page=1';
    if(config.traceUri == 1) console.log(lifetimeUri);

    getData(lifetimeUri, function (err, data) {
      switch(true) {
        // нормальный случай, данные есть
        case err === null && data !== null:
          var Lifetime = {checkLife: 0, Lifetime: data.TaskLifetimes};
          break;
        // удален или нет прав (снимаем флаг)
        case err !== null && err.statusCode == 400:
          var Lifetime = {checkLife: 0};
          break;
        // нет данных
        default:
          var Lifetime = {checkLife: 0};
      }

      tasks.update({Id: task[0].Id}, {
        $currentDate: {
          lastModified: true,
          "HDLifeUpdate": { $type: "timestamp" }
        },
        $set: Lifetime
      });

      emitter.emit('getLifetime');
    });

  });

});

module.exports.init = init;
module.exports.run = run;

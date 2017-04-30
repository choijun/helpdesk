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
  emitter.emit('getExp');
}

emitter.on('getExp', function(){

  // Обновляем все недавно измененные, переданные из getTasks с флагом checkExp = 1
  var cursor = tasks.find({checkExp: 1}).sort({Changed: -1}).limit(1);

  cursor.toArray(function(err, task){
    assert.equal(null, err);

    // нет задач для получения трудозатрат, ставим в ожидание
    if(task.length == 0) {
      setTimeout(function(){
        emitter.emit('getExp');
      }, config.checkDelay);
      return;
    }

    var expensesUri = config.uri + '?taskid=' + task[0].Id + '&pagesize=100&page=1';
    if(config.traceUri == 1) console.log(expensesUri);

    getData(expensesUri, function (data) {
      if(data !== null) {
          var Expenses = {checkExp: 0, Expenses: data.Expenses};
          tasks.update({Id: task[0].Id}, {
            $currentDate: {
              lastModified: true,
              "HDExpUpdate": { $type: "timestamp" }
            },
            $set: Expenses
          });
      }
      emitter.emit('getExp');
    });

  });

});

module.exports.init = init;
module.exports.run = run;

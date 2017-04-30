'use strict';

var
  EventEmitter = require('events'),
  emitter = new EventEmitter(),
  assert = require('assert'),
  libxmljs = require('libxmljs'),

  config, usersServed, mongoDb, getData, tasks;

function init(conf){
  config = conf.config;
  mongoDb = conf.mongoDb;
  usersServed = conf.usersServed;
  getData = conf.getData;

  tasks = mongoDb.collection('tasks');
}

function run() {
  if(config.active != 1) return;
  if(config.fullReindex == 1) {
    emitter.emit('fullReindex');
  } else {
    emitter.emit('deltaIndex');
  }
}

emitter.on('paginationUri', function(settings){

  var tasksUri = settings.uri.replace('{page}', settings.page);
  if(config.traceUri == 1) console.log(tasksUri);

  getData(tasksUri, function(data){
    for(var i in data.Tasks) {
      var task = data.Tasks[i];
      task.ExecutorIds = task.ExecutorIds.split(",");
      task.ExecutorIds = task.ExecutorIds.map(function (val) { return parseInt(val.trim()); });
      task.ChangedUTC = Date.parse(task.Changed);

      task.HDStartTime = parseDateBegin(task);
      task.checkExp = 1;

      tasks.update({Id: task.Id}, {
        $currentDate: {
          lastModified: true,
          "HDTaskUpdate": { $type: "timestamp" }
        }, $set: task
      }, {upsert: true, multi: false});
    }

    if(settings.page >= data.Paginator.PageCount) {
      if(typeof settings.endCallback == 'function') settings.endCallback();
    } else {
      settings.page++;
      emitter.emit('paginationUri', settings);
    }
  });
});

// Полный обход задач
emitter.on('fullReindex', function() {
  var paginationUri = config.uri + '?ExecutorIds=' + usersServed.join(',') + '&sort=Id%20asc&page={page}&pagesize=' + config.fullReindexLimit;
  emitter.emit('paginationUri', {
    uri: paginationUri,
    page: 1,
    endCallback: function(){
      emitter.emit('deltaIndex');
    }
  });
});

// Дельта - наблюдение
emitter.on('deltaIndex', function() {
  var cursor = tasks.find({}, {Changed: 1}).sort({Changed: -1}).limit(1);
  cursor.toArray(function(err, task){
    assert.equal(null, err);
    if(task.length == 0) return; // невозможно делать дельту для пустой коллекции

    // Uri для получения небольшой порции "последних обновленных" задач
    var paginationUri = config.uri + '?ExecutorIds=' + usersServed.join(',') + '&sort=Changed%20desc&page={page}&pagesize=' + config.deltaLimit;
    paginationUri += '&ChangedMoreThan=' + task[0]['Changed'].substr(0, 19).replace('T', '+');

    emitter.emit('paginationUri', {
      uri: paginationUri,
      page: 1,
      endCallback: function(){
        setTimeout(function(){
          emitter.emit('deltaIndex');
        }, config.deltaCheckDelay);
      }
    });
  });
});


function parseDateBegin(task) {
  var xmlData = '<?xml version="1.0" encoding="UTF-8"?><root>' + task.Data + '</root>';
  // var xmlData = '<?xml version="1.0" encoding="UTF-8"?><root><field id="1081">8</field><field id="10820">2017-04-26 00:00</field><field id="1114" /><field id="1195" /><field id="1196" /></root>';

  var xmlDoc = libxmljs.parseXml(xmlData);

  // 1082 - поле "начало работы"
  var field = xmlDoc.get('//field[@id=1082]');
  return field === undefined ? null : Date.parse(field.text());
}


module.exports.init = init;
module.exports.run = run;

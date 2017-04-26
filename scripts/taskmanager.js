'use strict';

// Менеджер задач

var helpdeskapi = require('./lib/helpdeskapi'),
    libxmljs = require('libxmljs'),

    _mongoDb = require('mongodb'),
    MongoClient = _mongoDb.MongoClient,
    ObjectID = _mongoDb.ObjectID,

    EventEmitter = require('events'),
    emitter = new EventEmitter(),

    assert = require('assert'),

    config = require('../etc/config')
    ;

var mongoDb, getData, initEvents = [];

app();

function app() {

  var connectMongo = new Promise(function(resolve, reject) {
    MongoClient.connect(config.mongo.uri, function(err, db) {
      assert.equal(null, err);
      resolve(db);
    });
  });

  connectMongo.then(
    function(db){
      mongoDb = db;
      emitter.emit('init', 'mongo');
    },
    function(err){
      console.log('Mongo connection error');
      process.exit(1);
    }
  );

  helpdeskapi.set('config', config.ntlmOptions).connect().then(function(_getData){
    emitter.emit('init', 'getData');
    getData = _getData;
  }, function(err){
    console.log('Intraservice connection error');
    process.exit(1);
  });

  emitter.on('init', function(type){
    initEvents.push(type);

    // Все инициировано (монго, API)
    if(initEvents.indexOf('mongo') > -1 && initEvents.indexOf('getData') > -1) {

      // коллекция задач
      var tasks = mongoDb.collection('tasks');

      // коллекция пользователей
      var users = mongoDb.collection('users');

      // коллекция различных значений
      var options = mongoDb.collection('options');

      // Uri для получения небольшой порции "последних обновленных" задач
      var smallLimitUri = config.helpdesk.getTasks.uri.replace('{limit}', config.helpdesk.getTasks.smallLimit);
      var bigLimitUri = config.helpdesk.getTasks.uri.replace('{limit}', config.helpdesk.getTasks.bigLimit);

      // запускаем получение задач
      var getTasks = function(tasksUri, checkDelay) {
        setTimeout(function(){

          // TODO сделать механизм против сбоев сети/helpdesk
          getData(tasksUri, function(data){

            var tasksUpdateDates = [];

            for(var i in data.Tasks) {
              var task = data.Tasks[i];
              task.ExecutorIds = task.ExecutorIds.split(",");
              task.ExecutorIds = task.ExecutorIds.map(function (val) { return parseInt(val.trim()); });
              task.ChangedUTC = Date.parse(task.Changed);

              tasksUpdateDates.push(task.ChangedUTC);


              task.HDStartTime = parseDateBegin(task);

              tasks.update({Id: task.Id}, {
                $currentDate: {
                  lastModified: true,
                  "HDTaskUpdate": { $type: "timestamp" }
                }, $set: task
              }, {upsert: true, multi: false});
            }

            // TODO: сделать проверку: если самая старая заявка не была обновлена с прошлого раза - продолжаем получать маленькими порциями
            // иначе - "мы взяли слишком мало", и делаем "большое получение"
            // получаем самую старую заявку из этой порции данных
            // console.log(Date.now() - Math.min.apply(null, tasksUpdateDates));

            console.log('getTasks');
            getTasks(smallLimitUri, config.helpdesk.getTasks.checkDelay);
          });
        }, checkDelay);
      }

      // сначала запускаем на небольшой порции, если не удастся получить все - то на большой
      if(config.helpdesk.getTasks.active == 1) getTasks(smallLimitUri, 0);

      // запускаем получение пользователей
      var getUsers = function(usersUri, checkDelay) {
        setTimeout(function(){
          getData(usersUri, function(data){
            for(var i in data.Users) {
              var user = data.Users[i];

              users.update({Id: user.Id}, {
                $currentDate: {
                  lastModified: true,
                  "HDUserUpdate": { $type: "timestamp" }
                }, $set: user
              }, {upsert: true, multi: false});
            }

            console.log('getUsers');
            getUsers(usersUri, config.helpdesk.getUsers.checkDelay);
          });

        }, checkDelay);
      };

      // сначала запускаем сразу, затем - с промежутком
      if(config.helpdesk.getUsers.active == 1) getUsers(config.helpdesk.getUsers.uri, 0);



      // TODO переделать на события обновления заявки (например, взводить флаг "обновить трудозатраты")
      // сейчас же каждый раз просто дергаются последние заявки

      var getExpenses = function(checkDelay) {
        setTimeout(function(){

          // Обновляем все недавно измененные
          var cursor = tasks.find({}).sort({Changed: -1}).limit(20); // {Id: 116080}

          // Могут быть "пропуски", поэтому периодически надо "обновлять все", но планомерно
          // TODO критерии, например "все открытые" + "закрытые недавно"
          // var cursor = tasks.find({}).sort({HDExpUpdate: 1}).limit(10); // {Id: 116080}

          cursor.each(function(err, task){
            if(task == null) {
              // nothing
            } else {
              var uri = config.helpdesk.getExpenses.uri.replace('{taskid}', task.Id);
              getData(uri, function (data) {
                console.log(data);
                if(data !== null) {
                    var Expenses = {Expenses: data.Expenses};
                    tasks.update({Id: task.Id}, {
                      $currentDate: {
                        lastModified: true,
                        "HDExpUpdate": { $type: "timestamp" }
                      },
                      $set: Expenses
                    });
                }

              });

            }
          });

          console.log('getExpenses');
          getExpenses(config.helpdesk.getExpenses.checkDelay);

        }, checkDelay);
      };

      // сначала запускаем сразу, затем - с промежутком
      if(config.helpdesk.getExpenses.active == 1) getExpenses(0);

    }
  });

}

function parseDateBegin(task) {
  var xmlData = '<?xml version="1.0" encoding="UTF-8"?><root>' + task.Data + '</root>';
  // var xmlData = '<?xml version="1.0" encoding="UTF-8"?><root><field id="1081">8</field><field id="10820">2017-04-26 00:00</field><field id="1114" /><field id="1195" /><field id="1196" /></root>';

  var xmlDoc = libxmljs.parseXml(xmlData);

  // 1082 - поле "начало работы"
  var field = xmlDoc.get('//field[@id=1082]');
  return field === undefined ? null : Date.parse(field.text());
}
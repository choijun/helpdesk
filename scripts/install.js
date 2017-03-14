'use strict';

// Установка приложения
// Создание индексов mongodb, etc

var _mongoDb = require('mongodb'),
    MongoClient = _mongoDb.MongoClient,
    ObjectID = _mongoDb.ObjectID,

    EventEmitter = require('events'),
    emitter = new EventEmitter(),

    assert = require('assert'),

    config = require('../etc/config')
    ;

var mongoDb;

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
      console.log('mongo error');
      process.exit(1);
    }
  );

  emitter.on('init', function(){
    var tasks = mongoDb.collection('tasks');
    var users = mongoDb.collection('users');
    tasks.createIndex({Id: 1}, {unique: true});
    users.createIndex({Id: 1}, {unique: true});
    mongoDb.close();
  });

}

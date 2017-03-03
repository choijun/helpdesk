'use strict';

// Получение пользователей... как я люблю копи-пасту... аппетитненько!

var httpntlm = require('httpntlm'),
    httpreq = require('httpreq'),

    _mongoDb = require('mongodb'),
    MongoClient = _mongoDb.MongoClient,
    ObjectID = _mongoDb.ObjectID,

    EventEmitter = require('events'),
    emitter = new EventEmitter(),

    assert = require('assert'),

    config = require('../etc/config')
    ;

var mongoDb, insertUsers, initEvents = [];

app();

function app() {

  var connectMongo = new Promise(function(resolve, reject) {
    MongoClient.connect(config.mongo.uri, function(err, db) {
      assert.equal(null, err);
      resolve(db);
    });
  });

  var getApiUsers = new Promise(function(resolve, reject) {
    httpntlm.get(config.ntlmOptions, function(err, res) {
      assert.equal(null, err);
      assert.equal(302, res.statusCode);

      var options = {
        cookies: res.headers['set-cookie'],
        headers: {'Accept': 'application/json;q=0.9'}
      }

      httpreq.get(config.helpdesk.getUsers, options, function(err, res) {
        assert.equal(null, err);
        assert.equal(200, res.statusCode);
        resolve(JSON.parse(res.body).Users);
      });
    });
  });

  getApiUsers.then(function(users){
    insertUsers = users;
    emitter.emit('init', 'users');
  }, function(err){
    console.log('users error');
    process.exit(1);
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

  emitter.on('init', function(type){
    initEvents.push(type);

    if(initEvents.indexOf('users') > -1 && initEvents.indexOf('mongo') > -1) {
      var users = mongoDb.collection('users');

      for(var i in insertUsers) {
        var user = insertUsers[i];

        users.update({Id: user.Id}, {
          $currentDate: {
            lastModified: true,
            "HDUserUpdate": { $type: "timestamp" }
          }, $set: user
        }, {upsert: true, multi: false});
      }

      mongoDb.close();
    }
  });

}


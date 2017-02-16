'use strict';

var express = require('express'),
    app = express(),

    _mongoDb = require('mongodb'),
    MongoClient = _mongoDb.MongoClient,
    ObjectID = _mongoDb.ObjectID,

    EventEmitter = require('events'),
    emitter = new EventEmitter(),

    assert = require('assert'),

    config = require('./etc/config.json')
    ;

var mongoDb;

app.set('config', config);

function initApp() {
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
}

app.get('/report', function(req, res) {
  var tasks = mongoDb.collection('tasks');
  var cursor = tasks.find({ExecutorIds: config.telegram.ExecutorId.toString()});
  cursor.each(function(err, task){
    if(task == null) {
      res.send('ok');
      return;
    } else {
      // task.
    }
  });


});

emitter.on('request', function(params){



});



initApp();

app.use(express.static('public'));
app.listen(config.web.port, config.web.host);



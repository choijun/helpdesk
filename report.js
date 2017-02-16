'use strict';

var express = require('express'),
    app = express(),
    bodyParser = require('body-parser'),

    _mongoDb = require('mongodb'),
    MongoClient = _mongoDb.MongoClient,
    ObjectID = _mongoDb.ObjectID,

    EventEmitter = require('events'),
    emitter = new EventEmitter(),

    assert = require('assert'),

    config = require('./etc/config.json')
    ;

var mongoDb, tasks;

app.set('config', config);
app.use(bodyParser.urlencoded({extended: false}));

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
      tasks = mongoDb.collection('tasks');
      emitter.emit('init', 'mongo');
    },
    function(err){
      console.log('mongo error');
      process.exit(1);
    }
  );
}

app.post('/report.json', function(req, res) {
  res.setHeader('Content-Type', 'application/json');
  var cursor = tasks.find({ExecutorIds: req.body.ExecutorId.toString()});
  cursor.toArray(function(err, items){
    assert.equal(null, err);
    res.send(JSON.stringify(items));
  });
});


initApp();

// Статика
app.use(express.static('public'));
app.listen(config.web.port, config.web.host);



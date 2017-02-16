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

app.get('/report', function(req, res) {
  emitter.emit('request', {req: req, res: res})
  // res.send('ok');
});

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

emitter.on('request', function(params){
  // params.req
  params.res.send('ok');


});



initApp();

app.use(express.static('public'));
app.listen(config.web.port, config.web.host);



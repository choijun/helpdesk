'use strict';

var
  EventEmitter = require('events'),
  emitter = new EventEmitter(),

  config, mongoDb, getData, users;

function init(conf) {
  config = conf.config;
  mongoDb = conf.mongoDb;
  getData = conf.getData;

  users = mongoDb.collection('users');
}

function run() {
  if(config.active != 1) return;
  if(config.fullReindex == 1) {
    emitter.emit('fullReindex');
  } else {
    emitter.emit('waitReindex');
  }
}

emitter.on('paginationUri', function(settings){

  var usersUri = settings.uri.replace('{page}', settings.page);
  if(config.traceUri == 1) console.log(usersUri);

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

    if(settings.page >= data.Paginator.PageCount) {
      if(typeof settings.endCallback == 'function') settings.endCallback();
    } else {
      settings.page++;
      emitter.emit('paginationUri', settings);
    }
  });
});



// Полный обход пользователей
emitter.on('fullReindex', function() {
  var paginationUri = config.uri + '?sort=Id%20asc&page={page}&pagesize=' + config.limit;
  emitter.emit('paginationUri', {
    uri: paginationUri,
    page: 1,
    endCallback: function(){
      emitter.emit('waitReindex');
    }
  });
});

// Переиндексация по расписанию
emitter.on('waitReindex', function() {
  setTimeout(function(){
    emitter.emit('fullReindex');
  }, config.checkDelay);
});


module.exports.init = init;
module.exports.run = run;

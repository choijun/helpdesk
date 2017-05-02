'use strict';

var httpntlm = require('httpntlm'),
    httpreq = require('httpreq'),
    assert = require('assert');

var settings = {},
    options,
    getApiTasks;

function set(setting, val){
  settings[setting] = val;
  return this;
}

function connect() {

  getApiTasks = new Promise(function(resolve, reject) {
    httpntlm.get(settings.config, function(err, res) {
      assert.equal(null, err);
      assert.equal(302, res.statusCode);

      options = {
        cookies: res.headers['set-cookie'],
        headers: {'Accept': 'application/json;q=0.9'}
      }

      resolve(getData);
    });
  });

  return getApiTasks;
}

function getData(uri, callback) {
  httpreq.get(uri, options, function(err, res) {
    if (err !== null) {
      callback(err, null)
    }

    if(res.statusCode !== 200) {
      err = new Error('Error response code: ' + res.statusCode);
      err.statusCode = res.statusCode;
      callback(err, null);
      return;
    }

    callback(null, JSON.parse(res.body));
  });
}



module.exports.set = set;
module.exports.connect = connect;

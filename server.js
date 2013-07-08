#!/usr/bin/env node
var util = require('util');
var socket = require('socket.io');
var http = require("http");
var commander = require('commander');
var merge = require('deepmerge');
var applyConfig = require('./functions/applyConfig.js');
var verifyPayload = require('./functions/verifyPayload.js');

commander
	.version('0.5')
	.option('-c, --config [value]', 'Set config file, use relative or absolute paths', './config.js')
	.parse(process.argv);

var configPath = commander.config;
var defaultConfig = './defaults.js';

var defaults = require(defaultConfig);
var config = {};

try {
	config = require(configPath);
} catch(err) {
	console.log(util.format('%s not found, using default host and port: %s:%s', configPath, defaults.server.host, defaults.server.port));
}
config = merge(defaults, config);


var server = http.createServer();
server.listen(config.server.port, config.server.host);
var io = socket.listen(server, config.app);

applyConfig(config, config.app, io);



if(config.security.enabled === true) {
	var crypto = require('crypto');
}

io.sockets.on('connection', function (socket) {

	socket.on('subscribe', function(data) {
		if(config.app.debug) {
			console.log(socket.id + ' joined room: ' + data.room);
		}
		socket.join(data.room);
	});

	socket.on('unsubscribe', function(data) {
		if(config.app.debug) {
			console.log(socket.id + ' left room: ' + data.room);
		}
		socket.leave(data.room); 
	});

	socket.on('push', function(data) {
		var callback = function() {
			if(config.push.volatile) {
				io.sockets.in(data.room).volatile.emit(data.event, data.data);
			} else {
				io.sockets.in(data.room).emit(data.event, data.data);
			}
		};
		
		var errorCallback = function (message) {
			if(config.app.debug) {
				console.log('Could not verify payload: ' + message);
			}
		}
		verifyPayload(config, crypto, data, callback, errorCallback);
	});

	socket.on('disconnect', function () {
		if(config.app.debug) {
			console.log(socket.id + ' disconnected');
		}
	});
});
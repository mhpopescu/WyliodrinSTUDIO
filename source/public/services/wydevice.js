
"use strict";

var angular = require ('angular');

var EventEmitter = require ('events').EventEmitter;

var settings = require ('settings');
require ('debug').enable (settings.debug);
var debug = require ('debug')('wyliodrin:lacy:wydevice');

var compare_versions = require ('compare-versions');

var uuid = require ('uuid');

var _ = require ('lodash');

debug ('Loading');

module.exports = function ()
{

	var app = angular.module ('wyliodrinApp');

	app.factory ('$wydevice', function ($http)
	{
		debug ('Registering');
		var device = null;

		var WyliodrinDevice = null;
		// var service = null;

		var status = 'DISCONNECTED';

		chrome.runtime.getBackgroundPage(function (backgroundPage) {
		    WyliodrinDevice = backgroundPage.WyliodrinDevice;
		});

		var deviceService = {
			connect: function (strdevice, options)
			{
				if (!WyliodrinDevice) throw ('Wyliodrin device not initialised');
				if (device && device.status !== 'DISCONNECTED') device.disconnect();
				device = new WyliodrinDevice (strdevice, options);
				var that = this;
				
				
				device.on ('connection_login_failed', function ()
							{
								if (device) that.emit ('connection_login_failed');
							});

				device.on ('connection_error', function ()
							{
								if (device) that.emit ('connection_error');
							});

				device.on ('connection_timeout', function ()
							{
								if (device) that.emit ('connection_timeout');
							});
				
				device.on ('status', function (_status)
				{
					status = _status;
					if (status !== 'CONNECTED') deviceService.device = 
					{
						category: 'board',
						network: false
					};
					if (status === 'ERROR' || status === 'DISCONNECTED')
					{
						device.removeAllListeners ();
						device = null;
					}
					that.emit ('status', _status);
				});

				device.on ('message', function (t, d)
				{
					if (t === 'i')
					{
						// console.log (d);
						deviceService.device = {
							category: d.c,
							network: d.i
						};
					}
					else
					if (t === 'v' || t === 'sv')
					{
						if (deviceService.device)
						{
							deviceService.device.version = d.v;
						}
						$http.get('https://cdn.rawgit.com/Wyliodrin/wyliodrin-app-server/master/package.json?'+uuid.v4())
					       .then(function(res){
						       	try
						       	{
						        	var version = res.data.version;
						        	debug ('Version '+version);
						        	debug (compare_versions(d.v, version));
						        	if (compare_versions(d.v, version) < 0) that.emit ('update');
						        }
						        catch (e)
						        {
						        	debug ('Version error');
						        	debug (e);
						        }
					    	});
					}
					that.emit ('message', t, d);
				});
			},

			getStatus: function ()
			{
				return status;
			},

			send: function (tag, data)
			{
				if (device)
				{
					device.send (tag, data);
				}
			},

			listDevices: function (done)
			{
				if (WyliodrinDevice)
				{
					WyliodrinDevice.listDevices ("serial", function (err, list)
					{
						done (err, list);
					});
				}
				else
				{
					done (new Error ('Wyliodrin device not initialised'));
				}
			},

			disconnect: function ()
			{
				// console.log (device);
				if (device)
				{
					device.disconnect ();
				}
			}
		};

		deviceService = _.assign (new EventEmitter(), deviceService);

		return deviceService;
	});
};

/*
	@author : Mickey
	@email : mickey.in.foshan@gmail.com

	****************************************

	DataStation is a core concept in PipeFlux. 
	An undirectional application is like a tree
	and a data station is like a node of the tree.
	A data station take the responsibility to receive
	data, process data, and then dispatch the processed
	data to the next.
	Everything can be a data station. Models, views and 
	controllers in MVC can be data stations. Dispatchers
	and stores in Flux can be data stations.
	A data station can have several data sources. Sources can be 
	added through 'addSource' method, 
	which will create a receiver waiting for data. 
	A data station can have one or more data destinations. When a data station
	add an another data station as a data source, this data station will be a data
	destination of the other one.
	A data station can have several handlers dealing
	with a certain data type. When data comes, a data station will choose the 
	corresponding handler to process the data.
	If no corresponding handler found, do nothing.
	If a handler returns value, then the data station will
	dispatch the return value to all data destinations of it. 
	Otherwise, nothing more to do.
	If the return value doesn't have '$type' attribute, 
	the origin $type will add to it.
*/

'use strict';

var assign = require("object-assign");
var Emitter = require("events").EventEmitter;
var Set = require("es6-set");
var Map = require("es6-map");
var CONSTANTS = require("../Constants/constants.js");

var DEFAULT_TYPE = CONSTANTS.DEFAULT_TYPE;
var DEFAULT_EVENT = CONSTANTS.DEFAULT_EVENT;

function DataStationBase() {
	this.$sources = new Map();
	this.$destinations = new Set();
	this.$handlers = new Map();
};

DataStationBase.prototype = assign({},DataStationBase,{

	//adding a data source will create an EventEmitter waiting for data 
	addSource : function(dataStation) {

		dataStation._addDestination(this);
		var emitter = new Emitter();
		emitter.on(DEFAULT_EVENT, this.process.bind(this));
		this.$sources.set(dataStation, emitter);
	},
	removeSource : function(dataStation) {
		dataStation._removeDestination(this);
		this.$sources.delete(dataStation);
	},
	hasSource : function(dataStation) {
		return this.$sources.has(dataStation);
	},
	getSourcesCount : function() {
		return this.$sources.size;
	},
	//shouldn't invoke by users, this is
	// a private method
	_addDestination : function(dataStation) {
		this.$destinations.add(dataStation);
	},
	_removeDestination : function(dataStation) {
		this.$destinations.delete(dataStation);
	},
	hasDestination : function(dataStation) {
		return this.$destinations.has(dataStation);
	},
	getDestinationsCount : function() {
		return this.$destinations.size;
	},

	//deliver the data to another dataStation
	deliver : function(data, dataStation) {
		if(!data){
			return;
		}
		var receiver = dataStation._getReceiver(this);
		if(!receiver) {
			return;
		}
		receiver.emit(DEFAULT_EVENT, data);
	},

	_getReceiver : function(dataStation) {
		var receiver = this.$sources.get(dataStation);	
		return receiver;
	},
	addHandler : function($type,handler) {
		//adding the handler of data type existed
		//will override the origin one
		//`this` needs to be binded when the handler use `this` ,
		//For example:
		//  var foo = {
		// 		func : function(){		        // a method use `this`
		//	    	...
		//			...this...
		//			...
		// 		}
		// 	};
		// 	var ds = new DataStationBase();
		// 	ds.addHandler(foo.func);			//NOT OK! foo.func won't work as you expect
		// 	ds.addHandler(foo.func.bind(foo));  //OK
		if(typeof $type === "function") {
			handler = $type;
			$type = undefined;
		}
		if($type == undefined) {
			$type = DEFAULT_TYPE;
		}
		this.$handlers.set($type, handler);
	},
	removeHandler : function($type) {
		if($type == undefined) {
			$type = DEFAULT_TYPE;
		}
		this.$handlers.delete($type);
	},	
	//process the data received
	process : function(data,callback) {
		var handler = this.$handlers.get(data.$type);
		//if the handler of such data type doesn't exist, then 
		//do nothing
		if(!handler) {
			return;
		}

		//handle the data
		var processedData = handler(data);
		if(processedData && processedData.$type == undefined){
			processedData.$type = data.$type;
		}
		//default callback is this.dispatch
		callback = callback || this.dispatch;
		callback = callback.bind(this);
		return callback(processedData);
	},
	hasHandler : function($type) {
		if($type == undefined) {
			$type = DEFAULT_TYPE;
		}
		return this.$handlers.has($type);
	},
	//dispatch the data to all destinations
	dispatch : function(data) {
		//If the handler didn't produce any data, 
		//do nothing.
		if(!data) {
			return;
		}
		if(data.$type == undefined) {
			data.$type = DEFAULT_TYPE;
		}
		this.$destinations.forEach(this.deliver.bind(this,data));		
	}
});

module.exports = DataStationBase;
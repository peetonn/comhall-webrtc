//
// index.js
// 
//  Copyright 2013 Regents of the University of California
//  For licensing details see the LICENSE file.
//
//  Author:  Peter Gusev
//

var gumWidth = getCookie('gumWidth') || "1280";
var gumHeight = getCookie('gumHeight') || "720";
var gumFps = getCookie('gumFps') || "30";

var ptzcamServerUrl = 'http://localhost:'+ptzCameraPort
var webcamServerUrl = 'http://localhost:'+webCameraPort;
var defaultServerUrl = (getChosenCamera() == 'ptz')?ptzcamServerUrl:webcamServerUrl;

var socket;
var peerConnections = [];
var consumers = [];
var localStream;
var pendingRequests = [];

var recordRtc = undefined;
var mediaRecorder = undefined;

var qvgaConstraints  = {
	mandatory: {
		maxWidth: 320,
		maxHeight: 180
	}
};

var vgaConstraints  = {
	mandatory: {
		maxWidth: 640,
		maxHeight: 360
	}
};

var hdConstraints  = {
	mandatory: {
		minWidth: 1280,
		minHeight: 720
	}
};

function setupSocket(url){
	trace('connecting to '+url);
	socket = io.connect(url, {'force new connection': true});

	socket.on('connect', function(){
		trace('connected');
		socket.emit('id', 'producer');
	});

	socket.on('new consumer', function (msg){
		trace('new request from '+msg.from);
		if (!localStream)
		{
			trace('media is not ready yet. adding request from '+msg.from+' to pending');
			pendingRequests[pendingRequests.length] = msg.from;
		}
		else
		{
			if (!peerConnections[msg.from])
			{
				createPeerConnection(msg.from);
			}
			else
				logError('violation: got second request from the same consumer');
		}
	});

	socket.on('answer', function(msg){
		trace('got answer from '+msg.from + ': '+msg.data.sdp);
		var pc = peerConnections[msg.from];

		if (pc)
		{
			pc.setRemoteDescription(new RTCSessionDescription(msg.data))
			.then(function (){
					trace('remote description set');
				})
			.catch(function (error){
					trace('error setting remote description: '+error.toString());
				});
			
			updateStatus();
		}
	});

	socket.on('ice', function (msg){
		var ice = msg.data;
		trace('received ICE from '+msg.from+': '+JSON.stringify(ice));
		var consumerPc = peerConnections[msg.from];

		if (consumerPc)
		{
			if (ice && ice.candidate)
				addIce(consumerPc, ice);
			else
				logError('bad ICE');
		}
		else
		{
			logError('no peer connection for '+msg.from);
		}
	});

	socket.on('bye', function (msg){
		trace(msg.from+' disconnected');
		if (peerConnections[msg.from])
		{
			peerConnections[msg.from].close();
			delete consumers[peerConnections[msg.from]];
			delete peerConnections[msg.from];
		}
		updateStatus();
	});

	socket.on('recstart', function(msg) {
		trace('request to start recording received from ' + msg.from);
		startRecording();
	});

	socket.on('recstop', function(msg) {
		trace('request to stop recording received from ' + msg.from);
		stopRecording();
	});
}

function createPeerConnection(consumerId){
	trace('creating peer connection for '+consumerId);
	var pc = new RTCPeerConnection(
		{ "iceServers": [{ "url": "stun:stun.l.google.com:19302" }] },
		{ 'optional': [{DtlsSrtpKeyAgreement: true}] });
	peerConnections[consumerId] = pc;
	consumers[pc] = consumerId;

	pc.onicecandidate = function (event){
		trace('new ICE candidate '+JSON.stringify(event.candidate));
		if (event.candidate)
		{
			var consumerId = consumers[pc];
			socket.emit('ice', {to: consumerId, data:event.candidate});
		}
	}

	if (localStream)
	{
		trace('creating offer...');

		pc.addStream(localStream);
		pc.createOffer().then(function (offer) {
			trace('generated offer '+offer)
			return pc.setLocalDescription(offer);
			})
		.then(function (){
				var consumerId = consumers[pc];
				trace('sending offer to '+consumerId);
				socket.emit('offer', {to:consumerId, data:pc.localDescription});
			})
		.catch(function (error) {
				logError('error creating offer '+error.toString());
			});
	}

	return pc;
}

function closeAllPeerConnections(){
	trace('closing active peer connections...');
	peerConnections = [];
	consumers = [];
	pendingRequests = [];
	updateStatus();
}

function replyPendingRequests(){
	trace('answering pending requests...');

	for (var idx in Object.keys(pendingRequests))
	{
		var consumerId = pendingRequests[idx];
		createPeerConnection(consumerId);		
	}
}

function shutdownSocket(){
	trace('shutting down connection...');
	socket.disconnect();
	socket = null;
}

function onErrorCallback(error){
	logError(error);
	setStatus('error');
}

function gotUserMedia(stream){
	trace('got stream. audio tracks: '+stream.getAudioTracks().length + ' video tracks: '+stream.getVideoTracks().length);
	trace('using audio device: '+ (stream.getAudioTracks().length > 0 ? stream.getAudioTracks()[0].label : 'none'));
	trace('using video device: '+stream.getVideoTracks()[0].label);
	
	localStream = stream;
	var localVideo = document.querySelector('#local-video');
	attachMediaStream(localVideo, stream);

	localVideo.addEventListener("playing", function () {
        setTimeout(function () {
            trace('video size:' + localVideo.videoWidth+'X'+localVideo.videoHeight);
			document.getElementById('currentDevices').innerHTML = 'Current audio source: '+
				(stream.getAudioTracks().length ? stream.getAudioTracks()[0].label : 'none') +
				'<br>Current video source:'+stream.getVideoTracks()[0].label;            
            document.getElementById('currentDevices').innerHTML += '<br>Video size: '+localVideo.videoWidth+'X'+localVideo.videoHeight;
        }, 500);
    });

	if (pendingRequests && pendingRequests.length > 0)
	{
		replyPendingRequests();
	}
	else
	{
		trace('waiting for connections...');
		setStatus('waiting for incoming connections...');
	}
}

function getAudioDevices(callback){
	return getMediaSources('audio', callback);
}

function getVideoDevices(callback){
	return getMediaSources('video', callback);
}

function getMediaSources(type, callback){
	var sources = [];

	if (!MediaStreamTrack) 
		logError('Current browser is incompatible for media sources enumeration');
	else
		// MediaStreamTrack.getSources(function (media_sources) {
		navigator.mediaDevices.enumerateDevices().then(function(media_sources) {
			var idx = 0;
			for (var i = 0; i < media_sources.length; i++) {
				var media_source = media_sources[i];
				var constraints = {};

				if (media_source.kind == type+'input') {
            		sources[idx] = media_source;
            		idx++;
        		} // if
    		} // for

    	callback(sources);
	});

	return sources;
}

function setStatus(status){
	document.getElementById('status').innerHTML = status;
}

function toggleSettings(){
	toggleElement(document.getElementById('settings'));
}

function toggleVideo(){
	toggleElement(document.getElementById('local-video'));
}

function updateStatus(){
	if (Object.size(peerConnections) == 0)
		setStatus('Waiting for incoming connections...');
	else
		setStatus('Currently active consumers: '+Object.size(peerConnections));
}

document.onkeypress = function (event){
	switch (String.fromCharCode(event.charCode)){
		case 's': 
		toggleSettings();
		break;
		case 'v':
		toggleVideo();
		break;
		case 'l': 
		toggleElement(document.getElementById('log'));
		break;			
		default:
		break;
	}
}

function stopRecording(){
  if (mediaRecorder.state != "recording")
    return false;
  else
  {
    mediaRecorder.stop()
    return true;
  }
}

var recordings = []
var recordedChunks = []
function startRecording(){
  if (localStream)
  {
  	var options = {
        // audioBitsPerSecond : 128000,
        // videoBitsPerSecond : 2500000,
        // mimeType : 'video/mp4'
      }
    mediaRecorder = new MediaRecorder(localStream, options);

    mediaRecorder.onstop = function(e) {
    	console.log("onstop called. mime type "+mediaRecorder.mimeType);
    	var recordedBlob = new Blob(recordedChunks);
    	
    	// download video
    	// var a = document.createElement('a');
    	// a.download = ['video_', (new Date() + '').slice(4, 28), '.mp4'].join('');
    	// a.href = URL.createObjectURL(recordedBlob);
    	// a.textContent = a.download;
    	// document.getElementById('downloadlink').appendChild(a);

    	socket.emit('recstop', recordings.length)

    	recordings.push(recordedBlob);
    	document.getElementById('recorded-video').src = URL.createObjectURL(recordedBlob);
    }

    mediaRecorder.ondataavailable = function(e) {
    	console.log("new chunk, "+e.data.size + ' bytes');
    	recordedChunks.push(e.data);
    	socket.emit('recchunk', {'id':recordings.length, 'data':e.data});
    }

    mediaRecorder.onstart = function(e) {
    	console.log("recording started");
    	socket.emit('recstart', recordings.length)
    }

    mediaRecorder.onerror = function(e) {
    	console.log("media recorder error: "+e.message);
    }

    recordedChunks = [];
    mediaRecorder.start(1000);
    return true;
  }
  else
  {
    console.log("there's no stream to record!");
    return false;
  }
}


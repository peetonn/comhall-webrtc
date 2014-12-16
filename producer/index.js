//
// index.js
// 
//  Copyright 2013 Regents of the University of California
//  For licensing details see the LICENSE file.
//
//  Author:  Peter Gusev
//

var defaultServerUrl = 'http://localhost:3001';
var socket;
var peerConnections = [];
var consumers = [];
var localStream;
var pendingOffers = [];

var qvgaConstraints  = {
	video: {
		mandatory: {
			maxWidth: 320,
			maxHeight: 180
		}
	}
};

var vgaConstraints  = {
	video: {
		mandatory: {
			maxWidth: 640,
			maxHeight: 360
		}
	}
};

var hdConstraints  = {
	video: {
		mandatory: {
			minWidth: 1280,
			minHeight: 720
		}
	}
};

function setupSocket(url){
	socket = io(url);
	socket.emit('id', 'producer');

	socket.on('offer', function(msg){
		trace('got offer from '+msg.from+' : '+JSON.stringify(msg.data));

		if (!peerConnections[msg.from])
		{
			var pc = createPeerConnection(msg);
			consumers[pc] = msg.from;
		}
		else
			logError('violation: got second offer from the same consumer');
	});

	socket.on('ice', function (msg){
		trace('received ICE from '+msg.from+': '+msg.data);
		var consumerPc = peerConnections[msg.from];

		if (consumerPc)
		{
			if (msg.candidate)
			{
				consumerPc.addIceCandidate(
					new RTCIceCandidate({
						sdpMLineIndex: msg.data.sdpMLineIndex,
						candidate: msg.data.candidate
					}), 
					function (){
						trace('remote candidate added successfully')
					},
					function (){
						trace('error on adding remote candidate');
					});
			}
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
	});
}

function createPeerConnection(msg){
	var pc = new RTCPeerConnection(
		{ "iceServers": [{ "url": "stun:stun.l.google.com:19302" }] },
		{ 'optional': [{DtlsSrtpKeyAgreement: true}] });
	peerConnections[msg.from] = pc;
	// trace('PC: '+peerConnections[msg.from]+' msg: '+JSON.stringify(msg)+' PCs: '+JSON.stringify(peerConnections));

	pc.onaddstream = function (obj){
		trace('remote stream added. do nothing '+' video tracks: '+obj.stream.getVideoTracks().length+
			' audio tracks: '+obj.stream.getAudioTracks().length);
		attachMediaStream(document.getElementById('remote-video'), obj.stream);
	}

	pc.onicecandidate = function (event){
		trace('new ICE candidate '+event.candidate);
		if (event.candidate)
		{
			var consumerId = consumers[pc];
			socket.emit('ice', {to: consumerId, data:event.candidate});
		}
	}


	trace('setting remote description...');
	pc.setRemoteDescription(new RTCSessionDescription(msg.data),
		function (){
			trace('remote description set');
			if (localStream)
				sendAnswer(pc);
			else
			{
				trace('stream is not ready yet. pending offer from '+msg.from);
				pendingOffers[pendingOffers.length] = msg.from;
			}
		},
		function (error){
			trace('error setting remote description: '+error.toString());
		});

	return pc;
}

function sendAnswer(pc){
	pc.addStream(localStream);
	trace('creating answer...');
	pc.createAnswer(function (description){
		trace('generated answer');
		pc.setLocalDescription(description);
		var consumerId = consumers[pc];
		socket.emit('answer', {to: consumerId, data: description});
	},
	function (error){
		logError('error creating answer '+error.toString())
	},
	{
		optional: [],
		mandatory: {
			OfferToReceiveAudio: true,
			OfferToReceiveVideo: true
		}
	});
}

function replyPendingOffers(){
	trace('answering pending offers for '+JSON.stringify(pendingOffers));

	for (var idx in Object.keys(pendingOffers))
	{
		var consumerId = pendingOffers[idx];
		var consumerPc = peerConnections[consumerId];
		sendAnswer(consumerPc);
	}
	pendingOffers = [];
}

function shutdownSocket(){
	socket.disconnect();
}

function onErrorCallback(error){
	logError(error);
	setStatus('error');
}

function gotUserMedia(stream){
	trace('got stream. audio tracks: '+stream.getAudioTracks().length + ' video tracks: '+stream.getVideoTracks().length);
	
	localStream = stream;
	var localVideo = document.querySelector('#local-video');
	attachMediaStream(localVideo, stream);

	if (pendingOffers && pendingOffers.length > 0)
	{
		replyPendingOffers();
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
		MediaStreamTrack.getSources(function (media_sources) {
			var idx = 0;
			for (var i = 0; i < media_sources.length; i++) {
				var media_source = media_sources[i];
				var constraints = {};

				if (media_source.kind == type) {
            // trace('media source of type ' + type + ' id '+media_source.id + ' label '+media_source.label);
            sources[idx] = media_source;
            idx++;
        }
    }

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
//
// index.js
// 
//  Copyright 2013 Regents of the University of California
//  For licensing details see the LICENSE file.
//
//  Author:  Peter Gusev
//

var allowSettingRemoteIce = false;
var pendingIce = [];

function toggleElement(element){
	if (element.style.display == 'none')
		element.style.display = 'inline';
	else
		element.style.display = 'none';	
}

function trace(text){
	var textArea = document.getElementById('log');
	var now = (window.performance.now() / 1000).toFixed(3);
	textArea.value += now+'\tINFO: \t' + text + '\n';
	console.log(text);
}

function logError(text){
	var textArea = document.getElementById('log');
	var now = (window.performance.now() / 1000).toFixed(3);
	textArea.value += now + '\tERROR:\t' + text + '\n';
	console.error(text);
}

function addIce(pc, msg)
{
	trace('adding remote ICE...');
	pc.addIceCandidate(
		new RTCIceCandidate({
			sdpMLineIndex: msg.sdpMLineIndex,
			candidate: msg.candidate
		}), 
		function (){
			trace('remote candidate added successfully')
		},
		function (){
			trace('error on adding remote candidate');
		});	
}

function setPendingRemoteIce(pc){
	if (pendingIce.length)
		trace('setting pending ICE candidates...');

	for (var idx in Object.keys(pendingIce))
	{
		var iceCandidate = pendingIce[idx];
		addIce(pc, iceCandidate);
	}
}

function getCookie(cname) {
    var name = cname + "=";
    var ca = document.cookie.split(';');
    for(var i=0; i<ca.length; i++) {
        var c = ca[i];
        while (c.charAt(0)==' ') c = c.substring(1);
        if (c.indexOf(name) != -1) return c.substring(name.length,c.length);
    }
    return null;
}

function setCookie(cname, cvalue, exdays) {
    var d = new Date();
    d.setTime(d.getTime() + (exdays*24*60*60*1000));
    var expires = "expires="+d.toUTCString();
    document.cookie = cname + "=" + cvalue + "; " + expires;
}

Object.size = function(obj) {
    var size = 0, key;
    for (key in obj) {
        if (obj.hasOwnProperty(key)) size++;
    }
    return size;
};

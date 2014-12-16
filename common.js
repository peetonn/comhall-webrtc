//
// index.js
// 
//  Copyright 2013 Regents of the University of California
//  For licensing details see the LICENSE file.
//
//  Author:  Peter Gusev
//

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
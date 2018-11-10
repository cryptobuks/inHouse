var pc, index = 0, dict;
var firefox = (window.mozRTCPeerConnection != undefined);

navigator.getUserMedia = navigator.mozGetUserMedia || navigator.webkitGetUserMedia;
navigator.getUserMedia({audio: true, video: true}, onUserMediaSuccess, onUserMediaError);

function onUserMediaSuccess(stream) {
	var local = document.getElementById('localVideo');
	local.src = URL.createObjectURL(stream);
	local.style.display = 'block';
	var PeerConnection = window.RTCPeerConnection || window.mozRTCPeerConnection || window.webkitRTCPeerConnection;
	pc = new PeerConnection({iceServers: [{urls: 'stun:stun.l.google.com:19302'}, {urls: 'stun:stun.services.mozilla.com'}]});
	pc.addStream(stream);
	pc.onicecandidate = function (evt) { if (pc.localDescription) prepareEmail(); };
	pc.onaddstream = function(evt) { document.getElementById('remoteVideo').src = URL.createObjectURL(evt.stream); };
	if (location.search == '')
		pc.createOffer(onDescCreated, onCreateOfferError);
	else
		processPeerData(location.search.substr(1));
	document.getElementsByTagName('input')[0].onchange = function() {
		if (this.checked)
			pc.addStream(stream);
		else
			pc.removeStream(stream);
		local.style.display = (this.checked) ? 'block' : 'none';
		};
}

function onUserMediaError(msg) {
	console.log('User media error: ' + JSON.stringify(msg));
	}
	
function onCreateOfferError(msg) {
	logError('Error creating offer: ' + JSON.stringify(msg));
	}

function onDescCreated(desc) {
    pc.setLocalDescription(desc, onLocalDescSuccess, onLocalDescError);
	}
	
function onLocalDescSuccess() {
	//console.log('Local sdp created: ' + JSON.stringify(pc.localDescription));
	prepareEmail();
	}
	
function onLocalDescError(msg) {
	logError('Local description could not be created: ' + JSON.stringify(msg));
	}

function prepareEmail() {
	var link = document.getElementsByTagName('a')[0];
	if (pc.iceGatheringState != 'complete' || link.textContent != '') return;
	dict = 'udp ~typ ~tcp ~host ~srflx ~raddr ~rport ~tcptype ~active '.split('~'); //keep global
	//extract parameters that will constitute query string
	var data = new Array(34);
	data[0] = strBetween('o=', '\r\n');//.replace(/\s/g, '+'); //sessionId + session version (8712560502560883686 2)
	//data[1] = strBetween('a=msid-semantic: WMS ', '\r'); //msid
	data[5] = strBetween('a=group:BUNDLE ', ' ');
	index--;
	data[6] = strBetween(' ', '\r\n');
	data[2] = strBetween('m=audio ', ' '); //port for audio srtp and rtcp
	addToDict(data[2]);
	data[3] = strBetween('SAVPF ', '\r');//.replace(/\s/g, '+'); //srtp protocol & media transport descriptions for audio
	data[4] = strBetween('c=IN IP4 ', '\r');
	addToDict(data[4]);
	//data[5] = strBetween('a=rtcp:', ' '); // port number for audio
	//data[6] = strBetween('IN IP4 ', '\r'); // ip address
	for (var i = 20; i < 26; i++)
		{
		data[i] = nextIceCandidate();
		if (pc.localDescription.sdp.substr(index, 12) != 'a=candidate:') break;
		}		
	//data[11] = strBetween('a=extmap:', '\r').replace(/:/g, '_').replace(/\//g, '*'); //rtp header extension for audio
	//var i = pc.localDescription.sdp.indexOf('a=rtcp-mux', index);
	//data[12] = rtcp(); //equals 'r' if this peer supports multiplexing rtcp
	//codecs: replace each codec prefix (e.g. a=rtpmap:) with a code (e.g. *1)
	//codec lines are between the next a= line and the a=ssrc line
	//data[32] = compressCodecs(pc.localDescription.sdp.substring(pc.localDescription.sdp.indexOf('a=rtcp-mux', index), pc.localDescription.sdp.indexOf('a=ssrc:', index))); //audio codecs
	//ssrc lines for audio then video (don't bother handling ssrc-groups yet) 
	data[1] = strBetween('msid:', ' ');//.replace('{','').replace('}',''); //msid part 1
	index--;
	data[12] = strBetween(' ', '\r');//.replace('{','').replace('}',''); //msid part 2
	index = 0;
	data[10] = strBetween('a=ssrc:', ' '); //audio ssrc id
	data[11] = strBetween('cname:', '\r').replace(/\//g, '.');//.replace('{','').replace('}',''); //ssrc cname for audio (cname is same throughout including for video)
	//data[12] = strBetween('msid:' + data[1] + ' ' , '\r'); //msid for audio (2nd part)
	data[13] = strBetween('m=video ', ' ');// port for video srtp and rtcp
	data[14] = strBetween('SAVPF ', '\r');//.replace(/\s/g, '+'); ////srtp protocol & media transport descriptions for video
	//data[15] = strBetween('a=rtcp:', ' '); // port number for video
	//data[16] = strBetween('a=extmap:', '\r').replace(/:/g, '_').replace(/\//g, '*'); // video extmap
	//data[33] = compressCodecs(pc.localDescription.sdp.substring(pc.localDescription.sdp.indexOf('a=rtcp-mux:', index), pc.localDescription.sdp.indexOf('a=ssrc', index))); // video codecs
	for (var i = 26; i < 32; i++)
		{
		data[i] = nextIceCandidate();
		if (pc.localDescription.sdp.substr(index, 12) != 'a=candidate:') break;
		}
	/*var i = pc.localDescription.sdp.indexOf('a=ssrc-group:', index);
	if (i > 0) {
		//collect data for second ssrc
		index = i + 17;
		data[18] = strBetween(' ', '\r\n');
		}*/
	data[16] = strBetween('a=ssrc:', ' '); // video ssrc id
	data[17] = strBetween('msid:' + data[1] + ' ', '\r'); //2nd part of msid for video
	
	index = 0;
	data[9] = strBetween('a=fingerprint:sha-256 ', '\r').replace(/:/g, ''); //fingerprint
	index = 0;
	data[7] = strBetween('a=ice-ufrag:', '\r').replace(/\//g, '.').replace(/;/g, '_'); //ice ufrag
	index = 0;
	data[8] = strBetween('a=ice-pwd:', '\r').replace(/\//g, '.').replace(/;/g, '_'); //ice password

	data[19] = pc.localDescription.type.charAt(0); //type (offer or answer)
	
	var qstring = data.join('~');
	for (var i = 0; i < dict.length; i++) {
		var token = '*' + String.fromCharCode(i + ((i < 26) ? 65 : 97));
		 //escape . and + so they're not interpreted as special chr. '\\.' and '\\+' as \ also seems to need escaping in replacement string
		var regex = new RegExp(dict[i].replace(/\./g, '\\.')/*.replace(/\s/g, '\\+')*/, 'g');
		qstring = qstring.replace(regex, token);
		}
	var qstring = "?" + (dict.slice(9).join('~')/*.replace(/\s/g, '+')*/ + '*' + qstring).replace(/\s/g, '+') + '%0D%0A%0D%0A'; //skip dict preset elements
	var S = "&body=Please click the link below to connect with me. Note: Chrome must be your default browser.%0D%0A%0D%0A" + location.hostname + location.pathname;
	if (location.search == '') {
		link.textContent = 'Send email inviting someone to talk';
		link.href = "mailto:?subject=Can we talk%3F" + S + qstring;
		link.onclick = "window.open(" + link.href + ", 'mail'); event.preventDefault()"; 
		window.addEventListener('storage', function(e) {
			processPeerData(e.newValue);
			localStorage.clear();
			});
		}
	else {
		link.textContent = 'Send email accepting invitation to talk';
		link.href = "mailto:?subject=Yes, we can talk" + S + "answer.htm" + qstring;
		link.onclick = setupDone;
	}
}
	
/*function rtcp() {
	var i = pc.localDescription.sdp.indexOf('a=rtcp-mux', index);
	if (i < 0) {
		index = pc.localDescription.sdp.indexOf('a=sendrecv', index) + 10;
		return '';
		}
	else {
		index = i + 10;
		return 'r';
		}
}*/

function addToDict(str) {
	if (dict.indexOf(str) < 0 && str.length > 2 && pc.localDescription.sdp.indexOf(str, index) > 0) dict.push(str);
}

function nextIceCandidate() {
	var iceLine = strBetween('a=candidate:', '\r\n').replace('generation 0', '');//.replace(/\s/g, '+');
	var parts = iceLine.split(' ');
	for (var j = 0; j < parts.length; j++) addToDict(parts[j] + ' ');
	return iceLine;
}

function strBetween(startStr, endStr) {
	var sdpstr = pc.localDescription.sdp;
	var start = sdpstr.indexOf(startStr, index);
	if (start < 0)
		return '';
	else {
		start+=startStr.length;
		var end = sdpstr.indexOf(endStr, start);
		index = end + endStr.length;
		return sdpstr.substring(start, end);
		}
}
	
function processPeerData(qstring) {
	//console.log('Processing peer data');
	var SessionDescription = window.RTCSessionDescription || window.mozRTCSessionDescription || window.webkitRTCSessionDescription;
	var sdp = new SessionDescription();
	var i = qstring.indexOf('*');
	var dict = ('udp+~typ+~tcp+~host+~srflx+~raddr+~rport+~tcptype+~active+~' + qstring.substring(0, i)).split('~');
	qstring = qstring.substr(i + 1);
	for (i = 0; i < dict.length; i++) {
		var regex = new RegExp('\\*' + String.fromCharCode(i + ((i < 26) ? 65 : 97)), 'g');
		qstring = qstring.replace(regex, dict[i]);
		}
	var data = qstring./*replace(/\+/g,' ').*/split('~');
	var isChrome = data[0].indexOf('mozilla') < 0;
	sdp.sdp = 'v=0\r\no=' + data[0].replace(/\+/g,' ') + '\r\ns=-\r\nt=0 0\r\na=group:BUNDLE ' + data[5] + ' ' + data[6] + lines('audio', data) + 'a=sendrecv\r\na=rtcp-mux'
	+ audioCodecs(isChrome)
//+ data[i].replace(/\*/g, '/').replace(/_/g, ':') + '\r\na=sendrecv\r\n' + (data[9] == 'r' ? 'a=rtcp-mux' : '')
 //+ expandCodecs(data[32])
	+ ssrcLines(data[1], data[12], data[10], data[11]) 
	+ lines('video', data) + 'a=sendrecv\r\na=rtcp-mux'
	+ videoCodecs(isChrome)
 //+ expandCodecs(data[33])
	+ ssrcLines(data[1], data[17], data[16], data[11]) + '\r\n';
	/*if (data[18] != '') //ssrc-group has two ssrc groups
		sdp.sdp += '\r\na=ssrc-group:FID ' + data[16] + ' ' + data[18] + ssrcLines(data[16], data[11], data[1], data[17]) + ssrcLines(data[18], data[11], data[1], data[17]) + '\r\n';
	else
		sdp.sdp += ssrcLines(data[16], data[11], data[1], data[17]) + '\r\n';*/
	sdp.type = (data[19] == 'o') ? 'offer' : 'answer';
	//console.log("sdp string:" + sdp.sdp);
	//var remoteIce = data.split(String.fromCharCode(0));
	//var sdp = remoteIce.shift();
	pc.setRemoteDescription(sdp, onRemoteDescSuccess, onRemoteDescError);
	/*var IceCandidate = window.mozRTCIceCandidate || window.RTCIceCandidate;
	for (var i=0; i<remoteIce.length; i++) pc.addIceCandidate(new IceCandidate(JSON.parse(remoteIce[i])));*/
	}

function ssrcLines(msid_pt1, msid_pt2, ssrcid, cname) {
	return '\r\na=msid:' + msid_pt1 + ' ' + msid_pt2 + '\r\na=ssrc:' + ssrcid + ' cname:' + cname.replace(/\./g, '/');
//	+ '\r\na=ssrc:' + id + ' msid:' + msid_pt1 + ' ' + msid_pt2 + '\r\na=ssrc:' + id + ' mslabel:' + msid_pt1 + '\r\na=ssrc:' + id + ' label:' + msid_pt2;
}

function lines(type, data) {
	var start = (type == 'audio') ? 20 : 26;
	var iceCandidates = '';
	for (var i = start; i < start + 6; i++) {
		if (data[i] == '' || data[i] === undefined) // latter to cater for end of link missing
			break;
		else
			iceCandidates += '\r\na=candidate:' + data[i];
		}
	return '\r\nm=' + type + ' ' + data[(type == 'audio') ? 2 : 13]
	+ ' RTP/SAVPF ' + data[(type == 'audio') ? 3 : 14].replace(/\+/g,' ')
	+ '\r\nc=IN IP4 ' + data[4] /*+ '\r\na=rtcp:' + data[(type == 'audio') ? 5 : 15] + ' IN IP4 ' + data[6]*/
	+ iceCandidates.replace(/\+/g,' ')
	+ '\r\na=ice-ufrag:' + data[7].replace(/\./g, '/').replace(/_/g, ';')
	+ '\r\na=ice-pwd:' + data[8].replace(/\./g, '/').replace(/_/g, ';') 
	+ '\r\na=fingerprint:sha-256 ' + data[9].replace(/(.{2})/g,'$1:').slice(0, -1)
	+ '\r\na=setup:' + ((data[19] == 'o') ? 'actpass' : 'active')
	+ '\r\na=mid:' + data[(type == 'audio') ? 5 : 6] + '\r\n';
}

function audioCodecs(isChrome) {
	if (isChrome)
		return '\r\na=rtpmap:111 opus/48000/2\r\na=fmtp:111 minptime=10; useinbandfec=1\r\na=rtpmap:103 ISAC/16000\r\na=rtpmap:104 ISAC/32000\r\na=rtpmap:9 G722/8000\r\na=rtpmap:0 PCMU/8000\r\na=rtpmap:8 PCMA/8000\r\na=rtpmap:106 CN/32000\r\na=rtpmap:105 CN/16000\r\na=rtpmap:13 CN/8000\r\na=rtpmap:126 telephone-event/8000\r\na=maxptime:60';
	else
		return '\r\na=rtpmap:109 opus/48000/2\r\na=rtpmap:9 G722/8000/1\r\na=rtpmap:0 PCMU/8000\r\na=rtpmap:8 PCMA/8000';
}

function videoCodecs(isChrome) {
	if (isChrome)
		return '\r\na=rtpmap:100 VP8/90000\r\na=rtcp-fb:100 ccm fir\r\na=rtcp-fb:100 nack\r\na=rtcp-fb:100 nack pli\r\na=rtcp-fb:100 goog-remb\r\na=rtpmap:116 red/90000\r\na=rtpmap:117 ulpfec/90000\r\na=rtpmap:96 rtx/90000\r\na=fmtp:96 apt=100';
	else
		return '\r\na=rtcp-fb:120 nack\r\na=rtcp-fb:120 nack pli\r\na=rtcp-fb:120 ccm fir\r\na=rtcp-fb:126 nack\r\na=rtcp-fb:126 nack pli\r\na=rtcp-fb:126 ccm fir\r\na=rtcp-fb:97 nack\r\na=rtcp-fb:97 nack pli\r\na=rtcp-fb:97 ccm fir\r\na=rtcp-mux\r\na=rtpmap:120 VP8/90000\r\na=rtpmap:126 H264/90000\r\na=rtpmap:97 H264/90000';
}

// query string permitted chrs: * - _ .

/*function compressCodecs(str) {
	//replace / with _ | ; with *5 | = with _
	return str.replace(/a=rtpmap:/g,'*1').replace(/a=fmtp:/g,'*2').replace(/a=maxptime:/g,'*3').replace(/a=rtcp-fb:/g,'*4').replace(/\//g, '_').replace(/;/g, '*5').replace(/=/g, '.').replace(/\r\n/g, '').replace(/\s/g, '+');
}

function expandCodecs(str) {
	// *1=rtpmap, *2=fmtp, *3=maxptime, *4=rtcp-fb
	//following regexes replace every occurrence of *n with corresponding a= prefix
	return str.replace(/_/g, '/').replace(/\./g, '=').replace(/\*5/g, ';').replace(/\*1/g,'\r\na=rtpmap:').replace(/\*2/g,'\r\na=fmtp:').replace(/\*3/g,'\r\na=maxptime:').replace(/\*4/g,'\r\na=rtcp-fb:');
}*/

function onRemoteDescSuccess() {
	console.log('Remote sdp successfully set');
	if (pc.remoteDescription.type == 'offer')
		pc.createAnswer(onDescCreated, onCreateAnswerError);
	else
		setupDone();
	}

function onRemoteDescError(evt) {
	logError('Remote sdp could not be set: ' + (evt.message ? evt.message : evt));
	}

function onCreateAnswerError(evt) {
	logError('Error creating answer: ' + (evt.message ? evt.message : evt));
	}

function setupDone() {
	document.getElementsByTagName('a')[0].style.display = 'none';
	document.getElementById('remoteVideo').style.display = 'block';
	document.getElementsByTagName('label')[0].style.display = 'block';
	console.log('Connected');
	}	

function logError(msg) {
	console.log(msg);
	}
	
function gotoFullScreen(elem) {
elem.requestFullscreen = elem.mozRequestFullScreen || elem.webkitRequestFullscreen;
elem.requestFullscreen();
}
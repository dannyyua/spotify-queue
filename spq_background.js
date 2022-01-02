function bytesToJson(bytes) {
	const intArr = new Uint8Array(bytes);
	var unparsedString = "";
	
	for (const i of intArr) {
		unparsedString += String.fromCharCode(i);
	}
	
	const parsedJson = JSON.parse(unparsedString);
	return parsedJson;
}

// Used to obtain device id
chrome.webRequest.onBeforeRequest.addListener(function(details) {
	if (details.url.endsWith("spclient.spotify.com/track-playback/v1/devices")) {
		deviceId = bytesToJson(details.requestBody.raw[0].bytes)["device"]["device_id"];
		
		chrome.tabs.query({url: "https://open.spotify.com/*"}, function(tabs) {
			for (const tab of tabs) {
				chrome.tabs.sendMessage(tab.id, {deviceId: deviceId});
			}
		});
	}
}, { urls: ["<all_urls>"] }, ["requestBody"]);

// Used to obtain connection id
chrome.webRequest.onSendHeaders.addListener(function(details) {
	if (details.url.includes("spclient.spotify.com/connect-state/v1/devices/hobs_")) {
		for (const header of details.requestHeaders) {
			if (header.name === "x-spotify-connection-id") {
				chrome.tabs.query({url: "https://open.spotify.com/*"}, function(tabs) {
					for (const tab of tabs) {
						chrome.tabs.sendMessage(tab.id, {connectionId: header.value});
					}
				});
				break;
			}
		}
	}
}, { urls: ["<all_urls>"] }, ["requestHeaders"]);

var spQ_deviceId = "";
var spQ_connectionId = "";
var spQ_subdomain = "";
var spQ_isUnlocked = false;
var spQ_accessToken = "";
var spQ_accessTokenExpiry = 0;

const Action = {
	SendToTop: 0,
	SendToBottom: 1,
	ShuffleQueue: 2
};

const QueueType = {
	Queue: 0,
	NextUp: 1
};

// Detect when a context menu is opened, add the options
new MutationObserver(function() {
	if (!window.location.pathname.startsWith('/queue')) return;

	const contextMenus = document.querySelectorAll("#context-menu > ul");
	
	for (const menu of contextMenus) {
		const menuSecondButton = menu.children[1].firstChild.firstChild;
		const menuThirdButton = menu.children[2].firstChild.firstChild;
		if (menuSecondButton.innerText === 'Remove from queue' && menuThirdButton.innerText !== 'Send to top') {
			const queueList = getQueueSongs();
			const nextList = getNextSongs();
			var selectedIndex = -1;
			
			for (let i = 0; i < 3; i++) {
				menu.insertBefore(menu.children[1].cloneNode(true), menu.children[2]);
			}
			
			menu.children[2].firstChild.firstChild.innerText = 'Send to top';
			menu.children[3].firstChild.firstChild.innerText = 'Send to bottom';
			menu.children[4].firstChild.firstChild.innerText = 'Shuffle queue';

			if (queueList) {
				for (var i = 0; i < queueList.children.length; i++) {
					if (queueList.children[i].firstChild.getAttribute("class") === "h4HgbO_Uu1JYg5UGANeQ wTUruPetkKdWAR1dd6w4 eRuZMo_HNLjb1IalIeRb"
						|| queueList.children[i].firstChild.getAttribute("data-context-menu-open") === "true") {
						selectedIndex = queueList.children[i].getAttribute("aria-rowindex")-1;

						menu.children[2].onclick = () => { updateQueue(QueueType.Queue, selectedIndex, Action.SendToTop) };
						menu.children[3].onclick = () => { updateQueue(QueueType.Queue, selectedIndex, Action.SendToBottom) };
						menu.children[4].onclick = () => { updateQueue(QueueType.Queue, selectedIndex, Action.ShuffleQueue) };
						break;
					}
				}
			}
		
			if (selectedIndex === -1) {
				for (var i = 0; i < nextList.children.length; i++) {
					if (nextList.children[i].firstChild.getAttribute("class") === "h4HgbO_Uu1JYg5UGANeQ wTUruPetkKdWAR1dd6w4 eRuZMo_HNLjb1IalIeRb"
						|| nextList.children[i].firstChild.getAttribute("data-context-menu-open") === "true") {
						selectedIndex = nextList.children[i].getAttribute("aria-rowindex")-1;

						menu.children[2].onclick = () => { updateQueue(QueueType.NextUp, selectedIndex, Action.SendToTop) };
						menu.children[3].onclick = () => { updateQueue(QueueType.NextUp, selectedIndex, Action.SendToBottom) };
						menu.children[4].onclick = () => { updateQueue(QueueType.NextUp, selectedIndex, Action.ShuffleQueue) };
						break;
					}
				}
			}
		}
	}
}).observe(document.body, { childList: true });

async function updateQueue(queueType, index, action) {
	const authToken = await getOAuthToken();
	const subdomain = await getSubdomain();
	const songLists = await getSongLists();

	if (queueType === QueueType.Queue) {
		updateSongList(songLists.queueSongs, index, action);
	} else if (queueType === QueueType.NextUp) {
		updateSongList(songLists.nextSongs, index, action);
	} else {
		console.log("Unknown queue type");
	}

	let body = {command: {
		next_tracks: [...songLists.queueSongs, ...songLists.nextSongs],
		endpoint: 'set_queue',
	}};
	
	fetch(`https://${subdomain}.spotify.com/connect-state/v1/player/command/from/${spQ_deviceId}/to/${spQ_deviceId}`, {
		headers: {
			authorization: `Bearer ${authToken}`
		},
		body: JSON.stringify(body),
		method: "POST"
	});
}

function updateSongList(list, index, action) {
	if (action === Action.SendToTop) {
		const temp = list[index];
		list.splice(index, 1);
		list.unshift(temp);
	} else if (action === Action.SendToBottom) {
		const temp = list[index];
		list.splice(index, 1);
		list.push(temp);
	} else if (action === Action.ShuffleQueue) {
		// Fisher-Yates shuffle
		var j, temp;
		for (var i = list.length-1; i > 0; i--) {
			j = Math.floor(Math.random() * (i+1));
			temp = list[i];
			list[i] = list[j];
			list[j] = temp;
		}
	} else {
		console.log("Unknown action");
	}

	return list;
}

async function getSongLists() {
	let queueSongs = [];
	let nextSongs = [];

	const authToken = await getOAuthToken();
	const subdomain = await getSubdomain();

	const response = await fetch(`https://${subdomain}.spotify.com/connect-state/v1/devices/hobs_${spQ_deviceId.slice(0, 35)}`, {
		headers: {
		  authorization: `Bearer ${authToken}`,
		  "x-spotify-connection-id": spQ_connectionId
		},
		body: '{"member_type":"CONNECT_STATE","device":{"device_info":{"capabilities":{"can_be_player":false,"hidden":true,"needs_full_player_state":true}}}}',
		method: "PUT"
	  });
	
	const data = await response.json();

	for (const track of data["player_state"]["next_tracks"]) {
		if (track["provider"] === "queue") {
			queueSongs.push(track);
		} else if (track["provider"] === "context") {
			nextSongs.push(track);
		}
	}

	return {queueSongs: queueSongs, nextSongs: nextSongs};
}

async function unlockMenu() {
	spQ_isUnlocked = true;
	const authToken = await getOAuthToken();
	const subdomain = await getSubdomain();
	
	fetch(`https://${subdomain}.spotify.com/connect-state/v1/connect/transfer/from/${spQ_deviceId}/to/${spQ_deviceId}`, {
	  headers: {
		authorization: `Bearer ${authToken}`
	  },
	  body: '{"transfer_options":{"restore_paused":"pause"}}',
	  method: "POST"
	}).then(function(response) {
		if (!response.ok) {
			setTimeout(() => { unlockMenu() }, 500);
		}
	});
}

async function getOAuthToken() {
	if (Date.now() > spQ_accessTokenExpiry) {
		const response = await fetch("https://open.spotify.com/get_access_token?reason=transport&productType=web_player");
		const data = await response.json();
		spQ_accessToken = data["accessToken"];
		spQ_accessTokenExpiry = data["accessTokenExpirationTimestampMs"];
	}

	return spQ_accessToken;
}

async function getSubdomain() {
	if (spQ_subdomain === "") {
		const response = await fetch("https://apresolve.spotify.com/?type=spclient");
		const data = await response.json();

		var subd = "";
		for (var i = 0; data["spclient"][0][i] !== "."; i++) {
			subd += data["spclient"][0][i];
		}
		spQ_subdomain = subd;
	}

	return spQ_subdomain;
}

chrome.runtime.onMessage.addListener(
	function(message) {
		if (message.deviceId && message.connectionId) {
			spQ_deviceId = message.deviceId;
			spQ_connectionId = message.connectionId;
			if (!spQ_isUnlocked) unlockMenu();
		}
	}
);


console.log('Hentai!');

var MPath = require('path');
var MFs = require('fs');

var MRequest = require('request');
var MCheerio = require('cheerio');

var Sequence = require('sequence').Sequence;
var Extend = require('node.extend');

var RESOURCE_STATUS_UNKNOWN = 'unknown';
var RESOURCE_STATUS_DOWNLOADING = 'downloading';
var RESOURCE_STATUS_DOWNLOADED = 'downloaded';

var DOWNLOAD_TASK_STATUS_UNKNOWN = 'unknown';
var DOWNLOAD_TASK_STATUS_RUNNING = 'running';
var DOWNLOAD_TASK_STATUS_STOPPED = 'stopped';
var DOWNLOAD_TASK_STATUS_ABORTED = 'aborted';
var DOWNLOAD_TASK_STATUS_FINISHED = 'finished';

var TIMEOUT = 15000;

var EntranceURI = 'http://g.e-hentai.org/';
var UserAgent = 'Mozilla/5.0 (Windows NT 6.1; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/30.0.1599.66';
var HTTPProxy = '';
var Cookies = 'tips=1; nw=1;';

var CHARACTERS = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

function makeRandomID(size) {

	var randomID = '';

	for(var i = 0; i < size; i++) {
		randomID += CHARACTERS.charAt(Math.random() * CHARACTERS.length);
	}

	return randomID;

}

// 处理文件名，在最大保留原始字符的基础上保证不与Windows冲突。
function handleFilename(filename) {

	return filename.replace(/[\\\/:\*\?"<>\|]/g, '_');

}

// 生成request的参数，动态生成防止属性发生改变。
function makeRequestOptions(options) {

	var defaults = {};

	var headers = defaults.headers = {};

	headers['User-Agent'] = UserAgent;
	headers['Cookie'] = Cookies;

	defaults.proxy = HTTPProxy != '' ? HTTPProxy : null;
	defaults.encoding = null;

	return Extend(true, {}, defaults, options);

}

function makeResource(options) {

	var defaults = {};

	defaults.type = '';
	defaults.title = '';
	defaults.time = '';
	defaults.previewURI = '';
	defaults.uri = '';

	// 由extractResource填充。
	defaults.imageResourceAmount = 0;
	defaults.firstImageResourceURI = '';

	return Extend(true, {}, defaults, options);

}

function MakeResourceDir(resource) {

	var resourceDir = MPath.join(__dirname, 'downloads', resource.title);

	return resourceDir;

}

function makeDownloadTask(options) {

	var defaults = {};

	defaults.id = '';
	defaults.resource = {};

	defaults.imageResourceIndex = 0;
	defaults.progress = 0;

	defaults.status = DOWNLOAD_TASK_STATUS_UNKNOWN;
	defaults.err = null;
	defaults.logs = '';

	// 这个是用来停止的。
	defaults.isStopping = false;

	return Extend(true, {}, defaults, options);

}

// 从首页中提取资源列表。
function extractResourceList(body) {

	var result = {};

	var $ = MCheerio.load(body);

	var $tds = $('.ptt td');

	result.pageAmount = parseInt($tds.eq($tds.length - 2).text(), 10);

	console.log(result.pageAmount);

	result.resourceList = [];

	var $trs = $('.itg tr[class^=gtr]');

	$trs.each(function(index, tr) {

		var $td = $(tr).find('td');

		var options = {};

		options.type = $td.eq(0).find('img').attr('alt');
		options.title = handleFilename(decodeURIComponent(encodeURIComponent($td.eq(2).find('.it5 a').text())));
		options.time = $td.eq(1).text();
		// 第一个。
		options.previewURI = $td.eq(2).find('.it2 img').attr('src');
		// 其它。
		if(!options.previewURI) {
			options.previewURI = $td.eq(2).find('.it2').text()
				.replace('init~ehgt.org~', 'http://ehgt.org/') // 游客。
				.replace('init~ul.ehgt.org~', 'http://ul.ehgt.org/') // 会员。
				.replace('init~st.exhentai.net~', 'http://st.exhentai.net/') // EX。
				.split('~')[0];
		}

		options.uri = $td.eq(2).find('.it5 a').attr('href');

		result.resourceList.push(makeResource(options));

	});

	return result;

}

// 从资源页中更新与补充资源信息。
function extractResource(resource, body) {

	var $ = MCheerio.load(body);

	resource.type = $('#gdc a img').attr('alt');
	resource.title = handleFilename(decodeURIComponent(encodeURIComponent($('#gn').text())));
	resource.time = $('.gdt2').eq(0).text();

	resource.previewURI = $('#gd1 img').attr('src');

	//resource.uri.

	resource.imageResourceAmount = parseInt($('.gdt2').eq(1).text().split(' ')[0], 10);
	resource.firstImageResourceURI = $('#gdt a').eq(0).attr('href');

	return resource;

}

// 从图像资源页中提取图像信息。
function extractImageResource(imageResourceURI, body) {

	var imageResource = {};

	var $ = MCheerio.load(body);

	var $a = $('a img').parent().eq(4);

	imageResource.uri = imageResourceURI;
	imageResource.imageURI = $a.find('img').attr('src');
	imageResource.nextURI = $a.attr('href');
	if(imageResource.nextURI == imageResource.uri) {
		// 如果下一个地址和这个地址相同，说明已经执行到了末尾。
		imageResource.nextURI = null;
	}

	console.log(imageResource);

	return imageResource;

}

// 通过请求获得图像资源。
// callback(err, imageResource)
function getImageResource(refererURI, imageResourceURI, callback) {

		MRequest(makeRequestOptions({
			'uri': imageResourceURI,
			'headers': {
				'Referer': refererURI
			},
			'encoding': 'utf-8',
			'timeout': TIMEOUT
		}), function(err, res, body) {

			if(err) {
				callback(err);
			}
			else {
				var imageResource = extractImageResource(imageResourceURI, body);
				callback(null, imageResource);
			}

		});

}

// 根据图像资源下载图像。
// callback(err, imageResource)
function downloadImage(downloadTask, imageResource, callback) {

	var resource = downloadTask.resource;

	var parts = MPath.basename(imageResource.imageURI).split('.');
	var extension = parts[parts.length - 1];
	var filename = MPath.basename(imageResource.uri) + '.' + extension;
	var path = MPath.join(MakeResourceDir(resource), handleFilename(filename));

	log(downloadTask, '准备下载' + filename + '。');

	MFs.exists(path, function(exists) {

		if(exists) {

			log(downloadTask, filename + '已存在，跳过。');
			callback(null, imageResource);

		}
		else {

			log(downloadTask, '开始下载' + filename + '。');
			MRequest(makeRequestOptions({
				'uri': imageResource.imageURI,
				'headers': {
					'Referer': imageResource.uri
				}
			}), function(err, res, buffer) {

				if(err) {
					callback(err);
				}
				else {

					MFs.writeFile(path, buffer, function(err) {

						if(err) {
							callback(err);
						}
						else {
							log(downloadTask, filename + '下载完成。');
							callback(null, imageResource);
						}

					});

				}

			});

		}

	});

}

function log(downloadTask, message) {

	downloadTask.logs += message;
	downloadTask.logs += '\n';

}

// 通过请求获得资源列表。
// callback(err, pageAmount, resourceList)
function GetResourceList(filter, pageIndex, callback) {

	var uri = EntranceURI;

	MRequest(makeRequestOptions({
		'uri': uri,
		'qs': {
			'f_search': filter,
			'page': pageIndex
		},
		'encoding': 'utf-8',
		'timeout': TIMEOUT
	}), function(err, res, body) {

		if(err) {
			callback(err);
		}
		else {
			var result = extractResourceList(body);
			callback(null, result.pageAmount, result.resourceList);
		}

	});

}

var DownloadTaskList = {};

// 从资源创建下载任务。
// callback(err, downloadTask)
function CreateDownloadTaskByResource(resource, callback) {

	var options = {};
	options.id = makeRandomID(16);
	options.resource = resource;

	var downloadTask = makeDownloadTask(options);

	MRequest(makeRequestOptions({
		'url': resource.uri,
		'encoding': 'utf-8'
	}), function(err, res, body) {
		if(err) {
			callback(err);
		}
		else {
			extractResource(resource, body);
			DownloadTaskList[downloadTask.id] = downloadTask;
			callback(null, downloadTask);
		}
	});

}

// 从资源地址创建下载任务。
// callback(err, downloadTask)
function CreateDownloadTaskByResourceURI(resourceURI, callback) {

	var options = {};
	options.id = makeRandomID(16);
	options.resource = makeResource({
		'uri': resourceURI
	});

	var downloadTask = makeDownloadTask(options);

	MRequest(makeRequestOptions({
		'url': downloadTask.resource.uri,
		'encoding': 'utf-8'
	}), function(err, res, body) {
		if(err) {
			callback(err);
		}
		else {
			extractResource(downloadTask.resource, body);
			DownloadTaskList[downloadTask.id] = downloadTask;
			callback(null, downloadTask);
		}
	});

}

// 开始下载任务，并向回调汇报当前的downloadTask。
// callback(err, downloadTask)
function StartDownloadTask(downloadTaskID, callback) {

	var downloadTask = DownloadTaskList[downloadTaskID];

	var resource = downloadTask.resource;

	var resourceDir = MakeResourceDir(resource);

	downloadTask.isStopping = false;

	// 进入第一张图像资源页。
	Sequence().then(function(next) {

		log(downloadTask, '准备下载：' + resource.title + '。');
		log(downloadTask, '准备解析第一张图像资源。');

		getImageResource(resource.uri, resource.firstImageResourceURI, function(err, firstImageResource) {

			if(err) {
				downloadTask.status = DOWNLOAD_TASK_STATUS_ABORTED;
				downloadTask.err = err;
				callback(err, downloadTask);
			}
			else {
				log(downloadTask, '第一张图像资源解析成功。');
				next(firstImageResource);
			}

		});

	}).then(function(next, firstImageResource) {

		var callback0 = function(err, imageResource) {

			if(err) {
				downloadTask.status = DOWNLOAD_TASK_STATUS_ABORTED;
				downloadTask.err = err;
				callback(err, downloadTask);
			}
			else {

				if(!downloadTask.isStopping) {

					downloadTask.progress = (downloadTask.imageResourceIndex + 1) / resource.imageResourceAmount * 100;
					downloadTask.status = DOWNLOAD_TASK_STATUS_RUNNING;

					if(imageResource.nextURI != null) {

						log(downloadTask, '正在下载，当前进度为：' + downloadTask.imageResourceIndex + ' / ' + resource.imageResourceAmount + '。');
						getImageResource(imageResource.uri, imageResource.nextURI, function(err, nextImageResource) {

							if(err) {
								callback(err, downloadTask);
							}
							else {

								downloadImage(downloadTask, nextImageResource, callback0);
								downloadTask.imageResourceIndex++;

							}

						})

					}
					else {
						// 结束。
						downloadTask.imageResourceIndex = resource.imageResourceAmount - 1;
						downloadTask.progress = 100;
						downloadTask.status = DOWNLOAD_TASK_STATUS_FINISHED;

						MFs.unlink(MPath.join(resourceDir, 'downloading'), function(err) {

						});

						MFs.writeFile(MPath.join(resourceDir, 'downloaded'), '', function(err) {

						});
						log(downloadTask, resource.title + '下载完成。');
					}

				}
				else {
					// 停止。
					downloadTask.status = DOWNLOAD_TASK_STATUS_STOPPED;

				}

				callback(null, downloadTask);

			}

		};

		// FIXME: Marked. 这是因为懒了所以没异步，这点小东西还异步…
		try {

			if(!MFs.existsSync(resourceDir)) {
				MFs.mkdirSync(resourceDir);
			}

			var json = JSON.stringify(resource, null, 4);
			MFs.writeFileSync(MPath.join(resourceDir, 'resource.json'), json);

		}
		catch(err) {
			console.log(err);
		}

		MFs.writeFile(MPath.join(resourceDir, 'downloading'), '', function(err) {

		});

		downloadImage(downloadTask, firstImageResource, callback0);

	});

}

function StopDownloadTask(downloadTaskID) {

	var downloadTask = DownloadTaskList[downloadTaskID];

	downloadTask.isStopping = true;

}

function RemoveDownloadTask(downloadTaskID) {

	DownloadTaskList[downloadTaskID] = null;
	delete DownloadTaskList[downloadTaskID];

}

// 获取代理服务器。
function GetHTTPProxy() {

	return HTTPProxy;

}

// 设置代理服务器。
function SetHTTPProxy(httpProxy) {

	HTTPProxy = httpProxy;

}

// 获取入口URI。
function GetEntranceURI() {

	return Cookies;

}

// 设置入口URI。
function SetEntranceURI(entranceURI) {

	EntranceURI = entranceURI;

}

// 获取Cookies。
function GetCookies() {

	return Cookies;

}

// 设置Cookies。
function SetCookies(cookies) {

	Cookies = cookies;

}

exports.GetResourceList = GetResourceList;
exports.MakeResourceDir = MakeResourceDir;
exports.CreateDownloadTaskByResource = CreateDownloadTaskByResource;
exports.CreateDownloadTaskByResourceURI = CreateDownloadTaskByResourceURI;
exports.StartDownloadTask = StartDownloadTask;
exports.StopDownloadTask = StopDownloadTask;
exports.RemoveDownloadTask = RemoveDownloadTask;

exports.GetHTTPProxy = GetHTTPProxy;
exports.SetHTTPProxy = SetHTTPProxy;
exports.GetEntranceURI = GetEntranceURI;
exports.SetEntranceURI = SetEntranceURI;
exports.GetCookies = GetCookies;
exports.SetCookies = SetCookies;

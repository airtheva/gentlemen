# Gentlemen

Gentlemen是一个E绅士的客户端，使用node-webkit作为宿主环境，在前端使用了avalon与bootstrap，是一次对avalon的尝试，期间踩了挺多的坑，但最后证明avalon还是能用的。

## 写在前面的话

最初做这个应用的原因是某大神做了个半成品，伸手伸了两个星期大神仍说问题多多不好放出，于是索性自己写一个，顺便学习avalon。

算到现在应该过了10天，在这个应用上投入的时间也将近50小时，应用的功能上也已经相对稳定，感觉可以拿出手了。

所以感觉完全是一时兴起的产物，以后可能不经常维护了，就当抛砖引玉了，欢迎fork或者提交issue，有机会的话可能会去解决。

## TODO

* 下次启动时恢复下载任务。
* 下载任务详细信息的实时更新。

## 下载

* [Windows](https://codeload.github.com/airtheva/gentlemen/zip/windows)
* [Linux](https://codeload.github.com/airtheva/gentlemen/zip/linux)

## 前端

前端使用了avalon和bootstrap，avalon负责应用结构，bootstrap负责界面美化。

本来打算只用bootstrap.css，但后来发现要实现modal还是挺麻烦的，最后还是引入了bootstrap.js。

应用结构如下：

* Application - 主框架，控制标签显示。
    * Browse - 浏览，展示与收藏资源。
    * Collect - 收藏，将资源收藏以后才可以进行其它的操作。
    * Download - WIP - 下载，展示下载列表。
    * Configure - WIP- 配置，你懂的。
    * AddDownloadTaskByResourceUriDialog - 从资源地址添加下载任务的对话框。
    * DownloadTaskDetailDialog - 下载任务详细信息的对话框。

## 后端

后端主要使用了request模块用来简化HTTP请求的发送，还有cheerio模块提供类jQuery语法快速解析HTML源代码。

* 私有
    * 工具函数
        * String makeRandomID(int size);
        * String handleFilename(String filename);
    * 工厂函数
        * Object makeRequestOptions(Object options);
        * Resource makeResource(Object options);
        * DownloadTask makeDownloadTask(Object options);
    * 数据获取与处理函数
        * Resource[] extractResourceList(String body);
        * Resource extractResource(Resource resource, String body);
        * ImageResource extractImageResource(String imageResourceUri, String body);
        * void getImageResource(String refererUri, String imageResourceUri, Function(Object err, ImageResource imageResource) callback);
        * void downloadImage(DownloadTask downloadTask, ImageResource imageResource, Function(Object err, ImageResource imageResource) callback);
    * 日志函数
        * String log(DownloadTask downloadTask, String message);
* 公开
    * 浏览接口
        * void GetResourceList(String filter, int pageIndex, Function(Object err, int pageAmount, Resource[] resourceList) callback);
        * String MakeResourceDir(Resource resource);
    * 下载接口
        * void CreateDownloadTaskByResource(Resource resource, Function(Object err, DownloadTask downloadTask) callback);
        * void CreateDownloadTaskByResourceUri(String resourceUri, Function(Object err, DownloadTask downloadTask) callback);
        * void StartDownloadTask(String downloadTaskID, Function(Object err, DownloadTask downloadTask) callback);
        * void StopDownloadTask(String downloadTaskID);
        * void RemoveDownloadTask(String downloadTaskID);
    * 配置接口
        * String GetHTTPProxy();
        * void SetHTTPProxy(String httpProxy);
        * String GetEntranceURI();
        * void SetEntranceURI(String entranceURI);
        * String GetCookies();
        * void SetCookies(String cookies);

## 协议

Gentlemen is licensed under the MIT license.

Copyright (C) 2014 airtheva

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
